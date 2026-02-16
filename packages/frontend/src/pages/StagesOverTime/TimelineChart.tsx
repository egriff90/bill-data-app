import { useState, useMemo } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  Scatter,
  ResponsiveContainer,
  Customized,
} from 'recharts';
import type { StageWithDate } from '../../api/client';

interface TimelineStage {
  billStageId: number;
  billId: number;
  billTitle: string;
  stageDescription: string;
  house: string;
  startDate: number;
  endDate: number;
  amendmentCount: number;
}

function aggregateForTimeline(items: StageWithDate[]): TimelineStage[] {
  const groups = new Map<number, StageWithDate[]>();
  for (const item of items) {
    if (!item.sittingDate) continue;
    const existing = groups.get(item.billStageId);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.billStageId, [item]);
    }
  }

  const result: TimelineStage[] = [];
  for (const [billStageId, rows] of groups) {
    const dates = rows.map(r => new Date(r.sittingDate!).getTime());
    const first = rows[0];
    result.push({
      billStageId,
      billId: first.billId,
      billTitle: first.billTitle,
      stageDescription: first.stageDescription,
      house: first.house,
      startDate: Math.min(...dates),
      endDate: Math.max(...dates),
      amendmentCount: first.amendmentCount,
    });
  }

  result.sort((a, b) => a.startDate - b.startDate);
  return result;
}

const HOUSE_COLORS: Record<string, string> = {
  Commons: '#22c55e',
  Lords: '#ef4444',
};

function formatAxisDate(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function formatTooltipDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface TooltipInfo {
  stage: TimelineStage;
  x: number;
  y: number;
}

function TimelineBars({
  stages,
  xAxisMap,
  yAxisMap,
  hoveredId,
  onHover,
  onTooltip,
}: {
  stages: TimelineStage[];
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onTooltip: (info: TooltipInfo | null) => void;
}) {
  if (!xAxisMap || !yAxisMap) return null;
  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const baseline = yScale(0);

  return (
    <g>
      {stages.map(stage => {
        const x1 = xScale(stage.startDate);
        const x2 = xScale(stage.endDate);
        const width = Math.max(x2 - x1, 6);
        const barHeight = baseline - yScale(stage.amendmentCount);
        const barY = yScale(stage.amendmentCount);
        const fill = HOUSE_COLORS[stage.house] || '#6b7280';

        let opacity = 0.6;
        if (hoveredId !== null) {
          opacity = hoveredId === stage.billStageId ? 1.0 : 0.15;
        }

        return (
          <rect
            key={stage.billStageId}
            x={stage.startDate === stage.endDate ? x1 - 3 : x1}
            y={barY}
            width={width}
            height={Math.max(barHeight, 1)}
            fill={fill}
            opacity={opacity}
            style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
            onMouseEnter={(e) => {
              onHover(stage.billStageId);
              const rect = (e.target as SVGRectElement).closest('svg')?.getBoundingClientRect();
              if (rect) {
                onTooltip({
                  stage,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }
            }}
            onMouseMove={(e) => {
              const rect = (e.target as SVGRectElement).closest('svg')?.getBoundingClientRect();
              if (rect) {
                onTooltip({
                  stage,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }
            }}
            onMouseLeave={() => {
              onHover(null);
              onTooltip(null);
            }}
          />
        );
      })}
    </g>
  );
}

export default function TimelineChart({
  data,
  loading,
}: {
  data: StageWithDate[] | null;
  loading: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);

  const stages = useMemo(() => {
    if (!data) return [];
    return aggregateForTimeline(data);
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || stages.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        No amending stages with sitting dates found
      </div>
    );
  }

  const allDates = stages.flatMap(s => [s.startDate, s.endDate]);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate || 1;
  const datePadding = dateRange * 0.05;

  // Generate first-of-month ticks spanning the padded date range
  const monthlyTicks: number[] = [];
  const tickStart = new Date(minDate - datePadding);
  tickStart.setDate(1);
  tickStart.setHours(0, 0, 0, 0);
  const tickEnd = maxDate + datePadding;
  const cursor = new Date(tickStart);
  while (cursor.getTime() <= tickEnd) {
    monthlyTicks.push(cursor.getTime());
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const maxAmendments = Math.max(...stages.map(s => s.amendmentCount));

  // Dummy scatter data to force axis initialization
  const scatterData = [
    { x: minDate - datePadding, y: 0 },
    { x: maxDate + datePadding, y: Math.ceil(maxAmendments * 1.1) },
  ];

  const uniqueBills = new Set(stages.map(s => s.billId)).size;

  return (
    <div className="space-y-4">
      {/* Summary and legend */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {stages.length.toLocaleString()} amending stages across {uniqueBills.toLocaleString()} bill{uniqueBills !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
            Commons
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
            Lords
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white border rounded-lg p-4" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={[minDate - datePadding, maxDate + datePadding]}
              ticks={monthlyTicks}
              tickFormatter={formatAxisDate}
              angle={-45}
              textAnchor="end"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, Math.ceil(maxAmendments * 1.1)]}
              tick={{ fontSize: 12 }}
              label={{ value: 'Amendments', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
            />
            <Scatter data={scatterData} fill="transparent" />
            <Customized
              component={(props: any) => (
                <TimelineBars
                  {...props}
                  stages={stages}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onTooltip={setTooltipInfo}
                />
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Custom tooltip */}
        {tooltipInfo && (
          <div
            className="bg-white border shadow-lg rounded-lg p-3 text-sm pointer-events-none"
            style={{
              position: 'absolute',
              left: tooltipInfo.x + 12,
              top: tooltipInfo.y - 10,
              zIndex: 50,
              maxWidth: 300,
            }}
          >
            <div className="font-bold text-gray-900">{tooltipInfo.stage.billTitle}</div>
            <div className="text-gray-600">{tooltipInfo.stage.stageDescription}</div>
            <div className="text-gray-600 mt-1">
              {formatTooltipDate(tooltipInfo.stage.startDate)}
              {tooltipInfo.stage.startDate !== tooltipInfo.stage.endDate &&
                ` \u2013 ${formatTooltipDate(tooltipInfo.stage.endDate)}`}
            </div>
            <div className="text-gray-900 font-medium mt-1">
              {tooltipInfo.stage.amendmentCount.toLocaleString()} amendments
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

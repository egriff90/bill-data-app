import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, Amendment, AmendmentText } from '../../api/client';
import { DecisionBadge, amendmentLabel } from '../../components/data/AmendmentTable';

export default function AmendmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const amendmentId = Number(id);

  const [amendment, setAmendment] = useState<Amendment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // The full text comes live from Parliament, so it loads separately and may be slower or fail.
  const [text, setText] = useState<AmendmentText | null>(null);
  const [textLoading, setTextLoading] = useState(true);
  const [textFailed, setTextFailed] = useState(false);

  useEffect(() => {
    if (!Number.isSafeInteger(amendmentId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    api.getAmendment(amendmentId)
      .then(a => { if (!cancelled) setAmendment(a); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    setText(null);
    setTextLoading(true);
    setTextFailed(false);
    api.getAmendmentText(amendmentId)
      .then(t => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setTextFailed(true); })
      .finally(() => { if (!cancelled) setTextLoading(false); });

    return () => { cancelled = true; };
  }, [amendmentId]);

  // Go back to the filtered list if we came from it; otherwise (e.g. a shared link) to the list.
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate('/');
  };

  const backLink = (
    <button onClick={goBack} className="text-sm text-gray-600 hover:underline">
      ← Back to amendments
    </button>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !amendment) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="text-gray-600">Amendment not found.</p>
      </div>
    );
  }

  const parliamentUrl =
    `https://bills.parliament.uk/bills/${amendment.bill.id}/stages/${amendment.billStage.id}/amendments/${amendment.id}`;
  const label = amendmentLabel(amendment);

  return (
    <div className="space-y-6 max-w-3xl">
      {backLink}

      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">{amendment.bill.shortTitle}</h2>
        <div className="text-gray-600">
          <span className="font-medium text-gray-900">Amendment {label}</span>
          {amendment.marshalledListText && amendment.dNum && (
            <span className="text-gray-500"> ({amendment.dNum})</span>
          )}
          {' · '}{amendment.billStage.description}{' · '}{amendment.billStage.house}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DecisionBadge decision={amendment.decision} />
          {amendment.decisionExplanation && (
            <span className="text-sm text-gray-600">{amendment.decisionExplanation}</span>
          )}
        </div>
      </div>

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-medium text-gray-900">Amendment text</h3>
        {textLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            Loading text from Parliament...
          </div>
        ) : textFailed || !text ? (
          <p className="text-sm text-gray-600">
            The full text couldn&apos;t be loaded from Parliament right now.{' '}
            <a href={parliamentUrl} target="_blank" rel="noopener noreferrer" className="underline">
              View it on bills.parliament.uk
            </a>.
          </p>
        ) : (
          <>
            {text.location && <div className="text-sm font-medium text-gray-700">{text.location}</div>}
            {text.lines.length > 0 ? (
              <div className="space-y-2 text-gray-900 leading-relaxed">
                {text.lines.map((line, i) => (
                  <p key={i} style={{ paddingLeft: `${line.indentation * 1.25}rem` }}>
                    {line.label && <span className="mr-2">{line.label}</span>}
                    {line.isImage ? (
                      <span className="text-sm italic text-gray-500">
                        [Image not shown – see the version on bills.parliament.uk]
                      </span>
                    ) : line.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No text is available for this amendment.</p>
            )}
            {text.note.length > 0 && (
              <div className="text-sm text-gray-600 space-y-1">
                {text.note.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
          </>
        )}
      </section>

      {text && text.explanatoryText.length > 0 ? (
        <section className="bg-white border rounded-lg p-4 space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            {text.explanatoryTextPrefix || 'Explanatory statement'}
          </h3>
          {text.explanatoryText.map((p, i) => (
            <p key={i} className="text-gray-700 leading-relaxed">{p}</p>
          ))}
        </section>
      ) : amendment.summaryText && !textLoading ? (
        <section className="bg-white border rounded-lg p-4 space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Summary</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{amendment.summaryText}</p>
        </section>
      ) : null}

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-medium text-gray-900">
          Sponsors{amendment.sponsors.length > 0 && ` (${amendment.sponsors.length})`}
        </h3>
        {amendment.sponsors.length > 0 ? (
          <ul className="divide-y">
            {amendment.sponsors.map(sponsor => (
              <li key={sponsor.id} className="py-2 flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-400"
                  style={sponsor.partyColour ? { backgroundColor: `#${sponsor.partyColour}` } : undefined}
                />
                <Link to={`/members/${sponsor.id}`} className="text-gray-900 hover:underline">
                  {sponsor.displayName}
                </Link>
                <span className="text-sm text-gray-500">{sponsor.party}</span>
                {sponsor.isLead && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">Lead</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No sponsors recorded.</p>
        )}
      </section>

      <a
        href={parliamentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm text-gray-700 underline"
      >
        View this amendment on bills.parliament.uk
      </a>
    </div>
  );
}

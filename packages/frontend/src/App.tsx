import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import AmendmentsPage from './pages/Amendments';
import StatisticsPage from './pages/Statistics';
import BillsPage from './pages/Bills';
import MemberPage from './pages/Members';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AmendmentsPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/members/:id" element={<MemberPage />} />
      </Routes>
    </Layout>
  );
}

export default App;

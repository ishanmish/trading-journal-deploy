import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TradingJournal from './pages/TradingJournal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TradingJournal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

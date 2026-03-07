import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Generator from './pages/Generator';
import Archives from './pages/Archives';
import Manifesto from './pages/Manifesto';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/forge" element={<Generator />} />
        <Route path="/archives" element={<Archives />} />
        <Route path="/manifesto" element={<Manifesto />} />
      </Routes>
    </Router>
  );
}

export default App;

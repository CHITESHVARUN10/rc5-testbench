import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/shell/AppShell'
import { BenchmarkPage } from './routes/BenchmarkPage'
import { ComparePage } from './routes/ComparePage'
import { LearnPage } from './routes/LearnPage'
import { MethodologyPage } from './routes/MethodologyPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { OverviewPage } from './routes/OverviewPage'
import { ReportsPage } from './routes/ReportsPage'
import { ScenarioPage } from './routes/ScenarioPage'
import { SimulatorPage } from './routes/SimulatorPage'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/scenario" element={<ScenarioPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

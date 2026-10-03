import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Dashboard from './pages/Dashboard'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import Elders from './pages/Elders'
import ElderDetail from './pages/ElderDetail'
import Reports from './pages/Reports'

export default function App() {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const activeCount = useStore((s) => s.incidents.filter((i) => i.status === 'active').length)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          长者手环告警处置平台
          <small>幸福里社区 · 独居老人照护</small>
        </div>
        <nav className="nav">
          <NavLink to="/dashboard">📊 处置总览</NavLink>
          <NavLink to="/incidents">🚨 告警事件{activeCount > 0 && `（${activeCount}）`}</NavLink>
          <NavLink to="/elders">👵 老人档案</NavLink>
          <NavLink to="/reports">📈 闭环复盘与画像</NavLink>
        </nav>
        <div className="side-foot">
          演示数据为本地模拟<br />操作通过 Zustand 实时更新
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>
            {role === 'community' ? '社区值班工作台' : '家属确认端'}
          </h1>
          <div className="role-switch" title="切换查看视角（同一事件双端协同）">
            <button className={role === 'community' ? 'on' : ''} onClick={() => setRole('community')}>社区端</button>
            <button className={role === 'family' ? 'on' : ''} onClick={() => setRole('family')}>家属端</button>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
            <Route path="/elders" element={<Elders />} />
            <Route path="/elders/:id" element={<ElderDetail />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

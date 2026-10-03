import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { alarmMeta, fmtTime, priorityScore } from '../flow'
import type { AlarmType, IncidentStatus } from '../types'
import { Empty, Modal, RiskTags, StatusTag, Tag } from '../components/ui'

type Filter = 'active' | 'hospital' | 'resolved' | 'closed' | 'all'

export default function Incidents() {
  const incidents = useStore((s) => s.incidents)
  const elders = useStore((s) => s.elders)
  const role = useStore((s) => s.role)
  const familyIdentity = useStore((s) => s.familyIdentity)
  const setFamilyIdentity = useStore((s) => s.setFamilyIdentity)
  const raiseAlarm = useStore((s) => s.raiseAlarm)
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('all')
  const [simOpen, setSimOpen] = useState(false)
  const [simElder, setSimElder] = useState(elders[0].id)
  const [simType, setSimType] = useState<AlarmType>('fall')
  const [simLoc, setSimLoc] = useState('浴室')

  const allContactNames = useMemo(
    () => Array.from(new Set(elders.flatMap((e) => e.contacts.map((c) => c.name)))),
    [elders]
  )

  const list = useMemo(() => {
    let rows = incidents
    if (role === 'family') rows = rows.filter((i) => i.contacts.some((c) => c.name.includes(familyIdentity)))
    if (filter !== 'all') rows = rows.filter((i) => (filter === 'resolved' ? i.status === 'resolved' : i.status === (filter as IncidentStatus)))
    return [...rows].sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt))
  }, [incidents, role, familyIdentity, filter])

  const elderOf = (id: string) => elders.find((e) => e.id === id)!

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-bd flex between wrap">
          <div className="pill-group">
            {([
              ['all', '全部'],
              ['active', '处置中'],
              ['hospital', '已送医'],
              ['resolved', '已化解'],
              ['closed', '已闭环'],
            ] as [Filter, string][]).map(([k, label]) => (
              <button key={k} className={`filter-pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex wrap">
            {role === 'family' && (
              <select value={familyIdentity} onChange={(e) => setFamilyIdentity(e.target.value)} style={{ width: 160 }}>
                {allContactNames.map((n) => (
                  <option key={n} value={n}>模拟家属：{n}</option>
                ))}
              </select>
            )}
            {role === 'community' && (
              <button className="btn primary" onClick={() => setSimOpen(true)}>📡 模拟手环新告警</button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty text="没有符合条件的事件" />
        ) : (
          list.map((inc) => {
            const e = elderOf(inc.elderId)
            const meta = alarmMeta[inc.type]
            const score = priorityScore(inc)
            return (
              <div key={inc.id} className="inc-row" onClick={() => navigate(`/incidents/${inc.id}`)}>
                <div className="inc-icon" style={{ background: meta.bg, color: meta.color }}>
                  {inc.type === 'fall' ? '🤕' : inc.type === 'heartRate' ? '💓' : inc.type === 'stationary' ? '🧍' : inc.type === 'leftHome' ? '🚶' : '📵'}
                </div>
                <div className="inc-main">
                  <div className="inc-title">
                    {meta.label} · {e.name}
                    <span className="dim small">{inc.id}</span>
                    {score >= 100 && inc.status === 'active' && <span className="priority-flag pf-high">紧急</span>}
                    <StatusTag status={inc.status} />
                    {inc.familyAction && (
                      <Tag tone="primary">
                        家属：{inc.familyAction === 'falseAlarm' ? '确认误报' : inc.familyAction === 'callVerify' ? '请求电话核实' : inc.familyAction === 'homeVisit' ? '要求上门' : '联系急救'}
                      </Tag>
                    )}
                  </div>
                  <div className="inc-meta">
                    <span>🕐 {fmtTime(inc.startAt)}</span>
                    <span>📍 {inc.location}</span>
                    <span>{inc.night ? '🌙 夜间' : '☀️ 白天'}</span>
                    <span>电量 {inc.batteryAtAlarm}%</span>
                    <span>历史误报 {inc.falseAlarmCount} 次</span>
                  </div>
                  <div className="inc-tags"><RiskTags tags={inc.riskTags} /></div>
                </div>
                <div className="small dim" style={{ flexShrink: 0 }}>
                  {inc.timeline.length} 条记录 ›
                </div>
              </div>
            )
          })
        )}
      </div>

      {simOpen && (
        <Modal
          title="模拟手环上报新告警"
          onClose={() => setSimOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setSimOpen(false)}>取消</button>
              <button
                className="btn danger"
                onClick={() => {
                  raiseAlarm(simElder, simType, simLoc)
                  setSimOpen(false)
                  navigate('/incidents')
                }}
              >
                生成告警并进入处置
              </button>
            </>
          }
        >
          <label className="fld">
            <span>老人</span>
            <select value={simElder} onChange={(e) => setSimElder(e.target.value)}>
              {elders.map((e) => <option key={e.id} value={e.id}>{e.name}（{e.address}）</option>)}
            </select>
          </label>
          <label className="fld">
            <span>告警类型</span>
            <select value={simType} onChange={(e) => setSimType(e.target.value as AlarmType)}>
              <option value="fall">跌倒</option>
              <option value="heartRate">心率异常</option>
              <option value="stationary">长时间静止</option>
              <option value="leftHome">离家未归</option>
              <option value="offline">设备离线</option>
            </select>
          </label>
          <label className="fld">
            <span>告警位置（含“浴室/卫生间”将自动打上高风险标签，夜间按当前时间判定）</span>
            <input type="text" value={simLoc} onChange={(e) => setSimLoc(e.target.value)} placeholder="如：浴室 / 客厅 / 小区花园" />
          </label>
          <div className="small muted">系统将自动读取该老人的告警阈值、设备电量、紧急联系人和历史误报数生成处置流程。</div>
        </Modal>
      )}
    </div>
  )
}

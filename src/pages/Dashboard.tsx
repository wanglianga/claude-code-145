import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { alarmMeta, fmtTimeShort, priorityScore } from '../flow'
import { Battery, Empty, RiskTags, StatusTag, Tag, categoryMeta } from '../components/ui'

export default function Dashboard() {
  const incidents = useStore((s) => s.incidents)
  const elders = useStore((s) => s.elders)
  const workers = useStore((s) => s.workers)
  const role = useStore((s) => s.role)
  const familyIdentity = useStore((s) => s.familyIdentity)
  const navigate = useNavigate()

  const visible = role === 'family'
    ? incidents.filter((i) => i.contacts.some((c) => c.name.includes(familyIdentity)))
    : incidents

  const active = visible
    .filter((i) => i.status === 'active')
    .sort((a, b) => priorityScore(b) - priorityScore(a))
  const hospital = visible.filter((i) => i.status === 'hospital')
  const closed = visible.filter((i) => i.status === 'closed')
  const lowBattery = elders.filter((e) => e.battery < 20)
  const riskElders = elders.filter((e) => e.profile.category !== 'normal')
  const onDuty = workers.filter((w) => w.onDuty)

  const elderOf = (id: string) => elders.find((e) => e.id === id)!

  return (
    <div className="grid" style={{ gap: 16 }}>
      {role === 'family' && (
        <div className="banner info">
          <span>👨‍👩‍👧</span>
          <div>
            当前家属身份：<b>{familyIdentity}</b>。您可在此查看与自己相关的告警并进行确认/决策；
            可在 <Link to="/incidents">告警事件</Link> 页切换模拟其他家属身份。
          </div>
        </div>
      )}

      <div className="grid cols-4">
        <div className="card stat alarm">
          <div className="k">处置中告警</div>
          <div className="v">{active.length}</div>
          <div className="sub">含 {active.filter((i) => i.riskTags.includes('familyNoResponse')).length} 起等待家属响应</div>
        </div>
        <div className="card stat">
          <div className="k">送医中事件</div>
          <div className="v" style={{ color: 'var(--warn)' }}>{hospital.length}</div>
          <div className="sub">已联动 120 / 等待回访闭环</div>
        </div>
        <div className="card stat">
          <div className="k">已闭环事件</div>
          <div className="v" style={{ color: 'var(--success)' }}>{closed.length}</div>
          <div className="sub">已完成误报/缺口/风险复盘</div>
        </div>
        <div className="card stat">
          <div className="k">重点照护老人</div>
          <div className="v" style={{ color: 'var(--primary)' }}>{riskElders.length}</div>
          <div className="sub">{lowBattery.length} 人设备低电需维护</div>
        </div>
      </div>

      <div className="layout-2col">
        <div className="card">
          <div className="card-hd between flex">
            <span>🚨 待处置队列（按风险优先级）</span>
            <Link to="/incidents" className="small">全部事件 →</Link>
          </div>
          {active.length === 0 ? (
            <Empty text="当前没有处置中的告警" />
          ) : (
            active.slice(0, 6).map((inc) => {
              const e = elderOf(inc.elderId)
              const score = priorityScore(inc)
              const meta = alarmMeta[inc.type]
              return (
                <div key={inc.id} className="inc-row" onClick={() => navigate(`/incidents/${inc.id}`)}>
                  <div className="inc-icon" style={{ background: meta.bg, color: meta.color }}>
                    {inc.type === 'fall' ? '🤕' : inc.type === 'heartRate' ? '💓' : inc.type === 'stationary' ? '🧍' : inc.type === 'leftHome' ? '🚶' : '📵'}
                  </div>
                  <div className="inc-main">
                    <div className="inc-title">
                      {meta.label} · {e.name}
                      <span className={`priority-flag ${score >= 100 ? 'pf-high' : score >= 40 ? 'pf-mid' : 'pf-low'}`}>
                        {score >= 100 ? '紧急' : score >= 40 ? '高优先' : '常规'}
                      </span>
                      <StatusTag status={inc.status} />
                    </div>
                    <div className="inc-meta">
                      <span>📍 {inc.location}</span>
                      <span>🕐 {fmtTimeShort(inc.startAt)}</span>
                      <span>历史误报 {inc.falseAlarmCount} 次</span>
                      {inc.workerName && <span>处置人：{inc.workerName}</span>}
                    </div>
                    <div className="inc-tags"><RiskTags tags={inc.riskTags} /></div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-hd">👮 今日值班 / 附近网格员</div>
            <div className="card-bd grid" style={{ gap: 10 }}>
              {onDuty.map((w) => (
                <div key={w.id} className="flex between">
                  <div>
                    <b>{w.name}</b>
                    <div className="small muted">{w.area}</div>
                  </div>
                  <div className="small muted">{w.phone}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd">🔋 设备状态预警</div>
            <div className="card-bd grid" style={{ gap: 10 }}>
              {elders.slice(0, 4).map((e) => (
                <div key={e.id} className="flex between">
                  <Link to={`/elders/${e.id}`}>{e.name}</Link>
                  <span className="flex" style={{ gap: 10 }}>
                    {e.online ? <Tag tone="green">在线</Tag> : <Tag tone="gray">离线</Tag>}
                    <Battery value={e.battery} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd">🧭 照护画像提示</div>
            <div className="card-bd grid" style={{ gap: 10 }}>
              {riskElders.length === 0 && <div className="small muted">暂无异常画像</div>}
              {riskElders.map((e) => {
                const m = categoryMeta[e.profile.category]
                return (
                  <div key={e.id}>
                    <div className="flex between">
                      <Link to={`/elders/${e.id}`}><b>{e.name}</b></Link>
                      <Tag tone={m.tone}>{m.label}</Tag>
                    </div>
                    <div className="small muted mt8">{e.profile.note}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

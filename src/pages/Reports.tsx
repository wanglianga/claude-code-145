import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { Tag, categoryMeta } from '../components/ui'
import type { CloseCategory } from '../types'

export default function Reports() {
  const incidents = useStore((s) => s.incidents)
  const elders = useStore((s) => s.elders)

  const closed = incidents.filter((i) => i.closeReport)
  const cats: CloseCategory[] = ['deviceFalse', 'careGap', 'realRisk']
  const catCount = (c: CloseCategory) => closed.filter((i) => i.closeReport!.category === c).length
  const maxCat = Math.max(1, ...cats.map(catCount))

  const responded = closed.filter((i) => (i.closeReport!.familyResponseMin ?? -1) >= 0)
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
  const avgFamily = avg(responded.map((i) => i.closeReport!.familyResponseMin))
  const avgCommunity = avg(closed.map((i) => i.closeReport!.communityElapsedMin))
  const noResponseCount = closed.filter((i) => i.closeReport!.familyResponseMin < 0).length

  // 阈值与设备优化建议（汇总自闭环报告）
  const advices = closed
    .flatMap((i) => {
      const e = elders.find((x) => x.id === i.elderId)!
      return [
        i.closeReport!.thresholdChanged ? { elder: e.name, type: '阈值调整', text: i.closeReport!.thresholdChanged, inc: i.id } : null,
        i.closeReport!.deviceAdvice ? { elder: e.name, type: '设备建议', text: i.closeReport!.deviceAdvice, inc: i.id } : null,
      ]
    })
    .filter(Boolean) as { elder: string; type: string; text: string; inc: string }[]

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-4">
        <div className="card stat"><div className="k">已复盘事件</div><div className="v">{closed.length}</div><div className="sub">均已沉淀画像与改进建议</div></div>
        <div className="card stat"><div className="k">平均家属响应</div><div className="v" style={{ color: avgFamily <= 10 ? 'var(--success)' : 'var(--warn)' }}>{avgFamily}<span style={{ fontSize: 14 }}> 分钟</span></div><div className="sub">{noResponseCount} 起全程未响应</div></div>
        <div className="card stat"><div className="k">平均社区处置时效</div><div className="v" style={{ color: 'var(--primary)' }}>{avgCommunity}<span style={{ fontSize: 14 }}> 分钟</span></div><div className="sub">告警接入到闭环</div></div>
        <div className="card stat"><div className="k">重点照护老人</div><div className="v" style={{ color: 'var(--danger)' }}>{elders.filter((e) => e.profile.category !== 'normal').length}</div><div className="sub">误报/缺口/风险分类管理</div></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-hd">🧩 事件定性分布（设备误报 / 照护缺口 / 真实风险）</div>
          <div className="card-bd grid" style={{ gap: 14 }}>
            {cats.map((c) => {
              const n = catCount(c)
              const m = categoryMeta[c]
              const color = c === 'deviceFalse' ? '#667085' : c === 'careGap' ? '#dc6803' : '#d92d20'
              return (
                <div key={c}>
                  <div className="flex between small mb8">
                    <span><b>{m.label}</b> <span className="dim">— {m.desc}</span></span>
                    <b>{n} 起</b>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: '#f2f4f7', overflow: 'hidden' }}>
                    <div style={{ width: `${(n / maxCat) * 100}%`, height: '100%', background: color, borderRadius: 5, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })}
            <div className="small muted">区分三类问题后，社区可分别采取设备维护、加密巡访/家属提醒、重点风险盯防策略。</div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">🛠️ 阈值与设备优化建议（来自闭环复盘）</div>
          <div className="card-bd grid" style={{ gap: 10 }}>
            {advices.length === 0 && <div className="small dim">暂无建议</div>}
            {advices.map((a, i) => (
              <div key={i} className="flex between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <Tag tone={a.type === '阈值调整' ? 'primary' : 'warn'}>{a.type}</Tag>
                  <span className="small" style={{ marginLeft: 8 }}><b>{a.elder}</b></span>
                  <div className="small muted mt8">{a.text}</div>
                </div>
                <Link to={`/incidents/${a.inc}`} className="small">事件 ›</Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">👵 照护画像总表（连续无人响应 / 频繁离线 / 多次上门无人 → 巡访与提醒调整）</div>
        <table className="table">
          <thead>
            <tr><th>老人</th><th>画像</th><th>无人响应</th><th>30 天离线</th><th>上门无人</th><th>巡访频次</th><th>设备维护</th><th>家属提醒方式</th></tr>
          </thead>
          <tbody>
            {elders.map((e) => {
              const m = categoryMeta[e.profile.category]
              return (
                <tr key={e.id} className="clickable" onClick={() => location.hash = `#/elders/${e.id}`}>
                  <td><Link to={`/elders/${e.id}`}><b>{e.name}</b></Link><div className="small dim">{e.age} 岁 · {e.chronic.join('、') || '无慢病'}</div></td>
                  <td><Tag tone={m.tone}>{m.label}</Tag><div className="small dim mt8" style={{ maxWidth: 220 }}>{e.profile.note}</div></td>
                  <td><Tag tone={e.profile.noResponseStreak >= 2 ? 'danger' : 'gray'}>{e.profile.noResponseStreak} 次</Tag></td>
                  <td><Tag tone={e.profile.offlineCount30d >= 5 ? 'danger' : e.profile.offlineCount30d > 0 ? 'warn' : 'green'}>{e.profile.offlineCount30d} 次</Tag></td>
                  <td><Tag tone={e.profile.nobodyHomeCount >= 2 ? 'danger' : e.profile.nobodyHomeCount > 0 ? 'warn' : 'green'}>{e.profile.nobodyHomeCount} 次</Tag></td>
                  <td className="small">{e.profile.visitFrequency}</td>
                  <td className="small" style={{ maxWidth: 200 }}>{e.profile.maintenance}</td>
                  <td className="small">{e.profile.familyReminder}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-hd">📄 闭环事件明细</div>
        <table className="table">
          <thead><tr><th>事件</th><th>老人</th><th>定性</th><th>误报原因</th><th>家属响应</th><th>处置时效</th></tr></thead>
          <tbody>
            {closed.map((i) => {
              const e = elders.find((x) => x.id === i.elderId)!
              const r = i.closeReport!
              return (
                <tr key={i.id} className="clickable" onClick={() => location.hash = `#/incidents/${i.id}`}>
                  <td><Link to={`/incidents/${i.id}`}>{i.id}</Link></td>
                  <td>{e.name}</td>
                  <td><Tag tone={categoryMeta[r.category].tone}>{categoryMeta[r.category].label}</Tag></td>
                  <td className="small" style={{ maxWidth: 280 }}>{r.falseAlarmReason ?? '—'}</td>
                  <td>{r.familyResponseMin < 0 ? <Tag tone="danger">未响应</Tag> : <Tag tone={r.familyResponseMin <= 10 ? 'green' : 'warn'}>{r.familyResponseMin} 分钟</Tag>}</td>
                  <td className="small">{r.communityElapsedMin} 分钟</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

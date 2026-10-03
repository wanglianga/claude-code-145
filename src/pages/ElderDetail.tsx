import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { alarmMeta, fmtTime } from '../flow'
import type { Thresholds } from '../types'
import { Battery, RiskTags, StatusTag, Tag, categoryMeta } from '../components/ui'

export default function ElderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const elder = useStore((s) => s.elders.find((e) => e.id === id))
  const incidents = useStore((s) => s.incidents.filter((i) => i.elderId === id))
  const worker = useStore((s) => s.workers.find((w) => w.id === elder?.gridWorkerId))
  const updateThresholds = useStore((s) => s.updateThresholds)
  const updateCare = useStore((s) => s.updateCare)

  const [th, setTh] = useState<Thresholds | null>(null)
  const [careNote, setCareNote] = useState('')
  const [careFreq, setCareFreq] = useState('')
  const [careMaint, setCareMaint] = useState('')
  const [careRemind, setCareRemind] = useState('')

  if (!elder) {
    return <div className="card"><div className="card-bd">老人不存在，<Link to="/elders">返回档案列表</Link></div></div>
  }
  const t = th ?? elder.thresholds
  const m = categoryMeta[elder.profile.category]
  const p = elder.profile

  const saveThresholds = () => {
    updateThresholds(elder.id, t)
    setTh(null)
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="flex between wrap">
        <Link to="/elders" className="small">← 返回档案列表</Link>
        <Tag tone={m.tone}>{m.label}</Tag>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="card-hd">👤 基本信息</div>
          <div className="card-bd">
            <div style={{ fontSize: 18, fontWeight: 700 }}>{elder.name} <span className="small dim">{elder.gender} · {elder.age} 岁</span></div>
            <dl className="kv mt12">
              <dt>住址</dt><dd>{elder.address}</dd>
              <dt>慢病</dt><dd>{elder.chronic.join('、') || '无'}</dd>
              <dt>活动范围</dt><dd>{elder.activityRange}</dd>
              <dt>佩戴习惯</dt><dd>{elder.wearHabit}</dd>
              <dt>设备</dt><dd className="flex" style={{ gap: 8 }}>{elder.online ? <Tag tone="green">在线</Tag> : <Tag tone="gray">离线</Tag>}<Battery value={elder.battery} /></dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">🔑 上门关键信息</div>
          <div className="card-bd">
            <dl className="kv">
              <dt>门禁</dt><dd>{elder.doorAccess}</dd>
              <dt>钥匙托管</dt><dd>{elder.keyHeld}</dd>
              <dt>网格员</dt><dd>{worker?.name ?? '—'}<div className="small muted">{worker?.phone} · {worker?.area}</div></dd>
              <dt>上次回访</dt>
              <dd>
                {elder.lastFollowup ? (
                  <>
                    <div>{elder.lastFollowup.at} · {elder.lastFollowup.visitor}</div>
                    <div className="small muted mt8">{elder.lastFollowup.content}</div>
                  </>
                ) : <span className="dim">暂无</span>}
              </dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">📞 紧急联系人</div>
          <div className="card-bd grid" style={{ gap: 12 }}>
            {elder.contacts.length === 0 && <div className="dim small">未登记联系人</div>}
            {elder.contacts
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((c) => (
                <div key={c.id} className="flex between">
                  <div>
                    <b>{c.name}</b> <span className="small dim">{c.relation}</span>
                    <div className="small muted">📞 {c.phone}</div>
                  </div>
                  <Tag tone={c.priority === 1 ? 'danger' : 'gray'}>优先级 {c.priority}</Tag>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        {/* 阈值 */}
        <div className="card">
          <div className="card-hd between flex">
            <span>⚙️ 告警阈值</span>
            {th ? (
              <span className="btn-row">
                <button className="btn sm" onClick={() => setTh(null)}>放弃</button>
                <button className="btn sm primary" onClick={saveThresholds}>保存调整</button>
              </span>
            ) : (
              <button className="btn sm" onClick={() => setTh(elder.thresholds)}>调整阈值</button>
            )}
          </div>
          <div className="card-bd">
            <div className="grid cols-2">
              <label className="fld">
                <span>跌倒灵敏度</span>
                <select disabled={!th} value={t.fallSensitivity} onChange={(e) => setTh({ ...t, fallSensitivity: e.target.value as Thresholds['fallSensitivity'] })}>
                  <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                </select>
              </label>
              <label className="fld">
                <span>电子围栏</span>
                <input type="text" disabled={!th} value={t.geofence} onChange={(e) => setTh({ ...t, geofence: e.target.value })} />
              </label>
              <label className="fld"><span>心率下限</span><input type="number" disabled={!th} value={t.heartLow} onChange={(e) => setTh({ ...t, heartLow: Number(e.target.value) })} /></label>
              <label className="fld"><span>心率上限</span><input type="number" disabled={!th} value={t.heartHigh} onChange={(e) => setTh({ ...t, heartHigh: Number(e.target.value) })} /></label>
              <label className="fld"><span>静止告警(分钟)</span><input type="number" disabled={!th} value={t.stationaryMin} onChange={(e) => setTh({ ...t, stationaryMin: Number(e.target.value) })} /></label>
              <label className="fld"><span>离线告警(分钟)</span><input type="number" disabled={!th} value={t.offlineMin} onChange={(e) => setTh({ ...t, offlineMin: Number(e.target.value) })} /></label>
            </div>
            <div className="small muted">历史闭环事件中的“阈值调整”建议可在此落实，降低误报、提前真实风险预警。</div>
          </div>
        </div>

        {/* 画像 */}
        <div className="card">
          <div className="card-hd">🧭 照护画像与社区干预</div>
          <div className="card-bd">
            <div className="btn-row mb16">
              <Tag tone={p.noResponseStreak >= 2 ? 'danger' : 'gray'}>连续无人响应 {p.noResponseStreak} 次</Tag>
              <Tag tone={p.offlineCount30d >= 5 ? 'danger' : p.offlineCount30d > 0 ? 'warn' : 'green'}>近 30 天离线 {p.offlineCount30d} 次</Tag>
              <Tag tone={p.nobodyHomeCount >= 2 ? 'danger' : p.nobodyHomeCount > 0 ? 'warn' : 'green'}>上门无人 {p.nobodyHomeCount} 次</Tag>
            </div>
            <div className="banner info mb16"><span>💡</span><div>{m.desc}</div></div>
            <div className="grid cols-2">
              <label className="fld"><span>巡访频次</span>
                <select value={careFreq || p.visitFrequency} onChange={(e) => setCareFreq(e.target.value)}>
                  <option>每月 1 次常规巡访</option>
                  <option>每月 2 次</option>
                  <option>建议每周 1 次</option>
                  <option>建议提升至每周 1 次以上</option>
                  <option>每周 2 次重点巡访</option>
                </select>
              </label>
              <label className="fld"><span>家属提醒方式</span>
                <select value={careRemind || p.familyReminder} onChange={(e) => setCareRemind(e.target.value)}>
                  <option>微信 + 电话</option>
                  <option>电话优先</option>
                  <option>微信即可</option>
                  <option>电话 + 短信 + 备用联系人多通道提醒</option>
                </select>
              </label>
            </div>
            <label className="fld"><span>设备维护安排</span>
              <input type="text" value={careMaint || p.maintenance} onChange={(e) => setCareMaint(e.target.value)} />
            </label>
            <label className="fld"><span>画像备注</span>
              <textarea value={careNote || p.note} onChange={(e) => setCareNote(e.target.value)} />
            </label>
            <button
              className="btn primary"
              onClick={() => {
                updateCare(elder.id, {
                  visitFrequency: careFreq || p.visitFrequency,
                  familyReminder: careRemind || p.familyReminder,
                  maintenance: careMaint || p.maintenance,
                  note: careNote || p.note,
                })
                setCareFreq(''); setCareRemind(''); setCareMaint(''); setCareNote('')
              }}
            >
              保存画像与干预方案
            </button>
          </div>
        </div>
      </div>

      {/* 历史事件 */}
      <div className="card">
        <div className="card-hd">📂 历史告警事件（{incidents.length}）</div>
        {incidents.length === 0 ? (
          <div className="card-bd dim small">暂无事件</div>
        ) : (
          <table className="table">
            <thead><tr><th>事件</th><th>发生时间</th><th>位置</th><th>风险标签</th><th>状态</th><th>闭环结论</th></tr></thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="clickable" onClick={() => navigate(`/incidents/${inc.id}`)}>
                  <td>{alarmMeta[inc.type].label}</td>
                  <td className="small">{fmtTime(inc.startAt)}</td>
                  <td className="small">{inc.location}</td>
                  <td><RiskTags tags={inc.riskTags} /></td>
                  <td><StatusTag status={inc.status} /></td>
                  <td className="small">
                    {inc.closeReport
                      ? inc.closeReport.category === 'deviceFalse' ? '设备误报' : inc.closeReport.category === 'careGap' ? '照护缺口' : '真实风险'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

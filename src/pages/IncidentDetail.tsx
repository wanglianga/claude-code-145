import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { alarmMeta, buildPlaybook, fmtTime } from '../flow'
import type { CloseCategory, FamilyAction } from '../types'
import { Modal, RiskTags, StatusTag, Tag } from '../components/ui'

const tlKindLabel: Record<string, string> = {
  alarm: '告警',
  familyAck: '家属确认',
  call: '电话核实',
  dispatch: '派单上门',
  visit: '上门处置',
  escalate: '升级联动',
  medical: '送医',
  followup: '回访',
  close: '闭环',
}

const familyActions: { key: FamilyAction; label: string; desc: string; cls: string }[] = [
  { key: 'falseAlarm', label: '确认误报', desc: '老人平安，是手环误触发', cls: 'success' },
  { key: 'callVerify', label: '请求电话核实', desc: '请社区先打电话确认', cls: 'warn' },
  { key: 'homeVisit', label: '要求上门', desc: '请网格员立即上门查看', cls: 'primary' },
  { key: 'emergency', label: '直接联系急救', desc: '情况危急，请立即拨打 120', cls: 'danger' },
]

export default function IncidentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const incidents = useStore((s) => s.incidents)
  const elders = useStore((s) => s.elders)
  const workers = useStore((s) => s.workers)
  const role = useStore((s) => s.role)
  const familyIdentity = useStore((s) => s.familyIdentity)

  const inc = incidents.find((i) => i.id === id)
  const elder = inc ? elders.find((e) => e.id === inc.elderId) : undefined
  const steps = useMemo(() => (inc && elder ? buildPlaybook(inc, elder) : []), [inc, elder])

  const [visitOpen, setVisitOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [followupOpen, setFollowupOpen] = useState(false)

  if (!inc || !elder) {
    return <div className="card"><div className="card-bd">事件不存在，<Link to="/incidents">返回事件列表</Link></div></div>
  }

  const meta = alarmMeta[inc.type]
  const isFamilyRelated = inc.contacts.some((c) => c.name.includes(familyIdentity))
  const active = inc.status === 'active'
  const gridWorker = workers.find((w) => w.id === elder.gridWorkerId)
  const nearby = workers.filter((w) => w.onDuty)
  const { familyRespond, logCallResult, dispatchWorker, reportVisit, escalate120, markHospital, resolveOnSite, addFollowup, closeIncident } =
    useStore.getState()

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="flex between wrap">
        <Link to="/incidents" className="small">← 返回事件列表</Link>
        <StatusTag status={inc.status} />
      </div>

      {/* 头部信息 */}
      <div className="card">
        <div className="card-bd">
          <div className="flex between wrap">
            <div className="flex" style={{ gap: 14 }}>
              <div className="inc-icon" style={{ width: 52, height: 52, fontSize: 24, background: meta.bg, color: meta.color }}>
                {inc.type === 'fall' ? '🤕' : inc.type === 'heartRate' ? '💓' : inc.type === 'stationary' ? '🧍' : inc.type === 'leftHome' ? '🚶' : '📵'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {meta.label} · <Link to={`/elders/${elder.id}`}>{elder.name}</Link>
                  <span className="dim small" style={{ marginLeft: 10 }}>{inc.id}</span>
                </div>
                <div className="small muted mt8">
                  {fmtTime(inc.startAt)} 发生 · 📍 {inc.location} {inc.night && <Tag tone="warn">🌙 夜间</Tag>} ·
                  告警时电量 {inc.batteryAtAlarm}% · 近 30 天误报 {inc.falseAlarmCount} 次
                </div>
              </div>
            </div>
            <div><RiskTags tags={inc.riskTags} /></div>
          </div>
          <div className="banner info mt16">
            <span>🔎</span>
            <div><b>系统研判：</b>{inc.detail} 处置流程已根据告警类型、最近轨迹、历史误报、家属联系方式与值班人员自动生成。</div>
          </div>
        </div>
      </div>

      <div className="layout-2col">
        {/* 左列：流程 + 轨迹 + 时间线 */}
        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-hd">🧭 智能处置流程</div>
            <div className="card-bd">
              {steps.map((st) => (
                <div key={st.key} className={`step ${st.state}`}>
                  <div className="dot">{st.state === 'done' ? '✓' : st.state === 'active' ? '!' : '·'}</div>
                  <div>
                    <div className="flex wrap" style={{ gap: 8 }}>
                      <span className="st-title">{st.title}</span>
                      <Tag tone={st.owner === '家属' ? 'primary' : st.owner === '急救' ? 'danger' : st.owner === '系统' ? 'gray' : 'green'}>{st.owner}</Tag>
                    </div>
                    <div className="st-detail">{st.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hd">🗺️ 最近活动轨迹</div>
            <div className="card-bd">
              <div className="trajectory">
                {inc.trajectory.map((p, i) => (
                  <span key={i} className="flex">
                    <span className="tp">{p.place}<span className="dim"> · {p.at}</span></span>
                    {i < inc.trajectory.length - 1 && <span className="arrow">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">🕘 同一事件全记录（告警 → 确认 → 上门 → 处置 → 就医 → 回访）</div>
            <div className="card-bd">
              <div className="tl">
                {inc.timeline.map((t) => (
                  <div key={t.id} className={`tl-item ${t.kind}`}>
                    <span className="tl-time">{fmtTime(t.at)}</span>
                    <span className="tl-actor">{t.actor}</span>
                    <Tag tone="gray">{tlKindLabel[t.kind]}</Tag>
                    <div className="tl-content">{t.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {inc.closeReport && <CloseReportCard inc={inc} />}
        </div>

        {/* 右列：联系人 + 双端操作 + 社区上门信息 */}
        <div className="grid" style={{ gap: 16 }}>
          {/* 家属端操作 */}
          {role === 'family' ? (
            <div className="card">
              <div className="card-hd">👨‍👩‍👧 家属确认与决策</div>
              <div className="card-bd">
                {!isFamilyRelated && (
                  <div className="banner warn mb16">当前模拟身份“{familyIdentity}”不是该老人的紧急联系人，请在事件列表页切换身份查看。</div>
                )}
                {inc.familyAction ? (
                  <div className="banner info">
                    <span>✅</span>
                    <div>
                      您已于 {inc.familyActionAt ? fmtTime(inc.familyActionAt) : ''} 选择：
                      <b>{familyActions.find((a) => a.key === inc.familyAction)?.label}</b>，社区处置进展见左侧时间线。
                    </div>
                  </div>
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {familyActions.map((a) => (
                      <button
                        key={a.key}
                        className={`btn ${a.cls}`}
                        disabled={!active || !isFamilyRelated}
                        onClick={() => familyRespond(inc.id, a.key)}
                        style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                      >
                        <span><b>{a.label}</b><span className="small" style={{ display: 'block', opacity: .85 }}>{a.desc}</span></span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="section-title mt16">紧急联系人通知状态</div>
                {inc.contacts.map((c) => (
                  <div key={c.id} className="flex between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                    <div>
                      <b>{c.name}</b> <span className="small dim">{c.relation}（优先级 {c.priority}）</span>
                      <div className="small muted">📞 {c.phone}</div>
                    </div>
                    {c.responded ? <Tag tone="green">已响应</Tag> : c.notified ? <Tag tone="warn">待响应</Tag> : <Tag tone="gray">未通知</Tag>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-hd">🏘️ 社区处置操作（值班台）</div>
              <div className="card-bd grid" style={{ gap: 12 }}>
                <div>
                  <div className="section-title">电话核实</div>
                  <div className="btn-row">
                    <button className="btn sm" disabled={!active} onClick={() => logCallResult(inc.id, true)}>老人已接 · 平安</button>
                    <button className="btn sm warn" disabled={!active} onClick={() => logCallResult(inc.id, false)}>无人接听</button>
                  </div>
                </div>
                <div>
                  <div className="section-title">派单上门（附近值班网格员）</div>
                  <div className="btn-row">
                    {nearby.map((w) => (
                      <button
                        key={w.id}
                        className={`btn sm ${inc.workerId === w.id ? 'success' : ''}`}
                        disabled={!active}
                        onClick={() => dispatchWorker(inc.id, w.id)}
                      >
                        {inc.workerId === w.id ? '✓ ' : ''}{w.name} · {w.area.split(' ')[1] ?? w.area}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="section-title">上门反馈</div>
                  <div className="btn-row">
                    <button className="btn sm" disabled={!active} onClick={() => setVisitOpen(true)}>登记上门结果</button>
                    <button className="btn sm warn" disabled={!active} onClick={() => escalate120(inc.id)}>联动 120</button>
                  </div>
                </div>
                <div>
                  <div className="section-title">处置结论</div>
                  <div className="btn-row">
                    <button className="btn sm success" disabled={!active} onClick={() => resolveOnSite(inc.id, '老人生命体征平稳。')}>现场化解（不送医）</button>
                    <button className="btn sm danger" disabled={!active || inc.status === 'hospital'} onClick={() => markHospital(inc.id)}>确认已送医</button>
                  </div>
                </div>
                <div>
                  <div className="section-title">回访与闭环</div>
                  <div className="btn-row">
                    <button className="btn sm" onClick={() => setFollowupOpen(true)}>登记回访记录</button>
                    <button className="btn sm primary" disabled={inc.status === 'closed'} onClick={() => setCloseOpen(true)}>
                      {inc.status === 'closed' ? '已闭环' : '事件闭环复盘'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 社区视角：上门所需信息 */}
          <div className="card">
            <div className="card-hd">🏠 上门处置信息</div>
            <div className="card-bd">
              <dl className="kv">
                <dt>老人地址</dt><dd>{elder.address}</dd>
                <dt>门禁信息</dt><dd>{elder.doorAccess}</dd>
                <dt>钥匙托管</dt><dd>{elder.keyHeld}</dd>
                <dt>慢病</dt><dd>{elder.chronic.join('、') || '无'}</dd>
                <dt>责任网格员</dt>
                <dd>{gridWorker?.name ?? '—'} {gridWorker && <span className="small muted">（{gridWorker.phone}，{gridWorker.onDuty ? '今日值班' : '今日休息'}）</span>}</dd>
                <dt>上次回访</dt>
                <dd>
                  {elder.lastFollowup ? (
                    <>
                      <div>{elder.lastFollowup.at} · {elder.lastFollowup.visitor} 回访</div>
                      <div className="small muted mt8">{elder.lastFollowup.content}</div>
                    </>
                  ) : <span className="dim">暂无回访记录</span>}
                </dd>
                <dt>佩戴习惯</dt><dd className="small">{elder.wearHabit}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {visitOpen && (
        <VisitModal
          onClose={() => setVisitOpen(false)}
          onSubmit={(result, note) => {
            reportVisit(inc.id, { result, note })
            setVisitOpen(false)
          }}
        />
      )}
      {closeOpen && (
        <CloseModal
          defaultCategory={inc.familyAction === 'falseAlarm' ? 'deviceFalse' : 'realRisk'}
          onClose={() => setCloseOpen(false)}
          onSubmit={(payload) => {
            closeIncident(inc.id, payload)
            setCloseOpen(false)
            navigate('/reports')
          }}
        />
      )}
      {followupOpen && (
        <FollowupModal
          onClose={() => setFollowupOpen(false)}
          onSubmit={(content) => {
            addFollowup(inc.id, content)
            setFollowupOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CloseReportCard({ inc }: { inc: ReturnType<typeof useStore.getState>['incidents'][number] }) {
  const r = inc.closeReport!
  const catLabel = r.category === 'deviceFalse' ? '设备误报' : r.category === 'careGap' ? '照护缺口' : '真实风险'
  const catTone = r.category === 'deviceFalse' ? 'gray' : r.category === 'careGap' ? 'warn' : 'danger'
  return (
    <div className="card">
      <div className="card-hd">📋 闭环复盘报告</div>
      <div className="card-bd">
        <div className="btn-row mb16">
          <Tag tone={catTone as 'gray' | 'warn' | 'danger'}>定性：{catLabel}</Tag>
          <Tag tone={r.familyResponseMin < 0 ? 'danger' : r.familyResponseMin <= 10 ? 'green' : 'warn'}>
            家属响应时长：{r.familyResponseMin < 0 ? '全程未响应' : `${r.familyResponseMin} 分钟`}
          </Tag>
          <Tag tone="primary">社区处置时效：{r.communityElapsedMin} 分钟</Tag>
        </div>
        <dl className="kv">
          {r.falseAlarmReason && <><dt>误报原因</dt><dd>{r.falseAlarmReason}</dd></>}
          {r.deviceAdvice && <><dt>设备调整建议</dt><dd>{r.deviceAdvice}</dd></>}
          {r.thresholdChanged && <><dt>阈值调整</dt><dd>{r.thresholdChanged}</dd></>}
        </dl>
        <div className="small muted mt12">结论已沉淀至老人照护画像，用于调整巡访频次、设备维护与家属提醒方式。</div>
      </div>
    </div>
  )
}

function VisitModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (r: 'nobody' | 'safe' | 'injured', note: string) => void }) {
  const [result, setResult] = useState<'nobody' | 'safe' | 'injured'>('safe')
  const [note, setNote] = useState('')
  return (
    <Modal title="登记上门结果" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" onClick={() => onSubmit(result, note)}>提交</button>
      </>
    }>
      <label className="fld">
        <span>现场情况</span>
        <select value={result} onChange={(e) => setResult(e.target.value as 'nobody' | 'safe' | 'injured')}>
          <option value="safe">老人在家且平安（可现场化解）</option>
          <option value="injured">老人受伤/不适（建议联动 120）</option>
          <option value="nobody">无人开门（需联动物业继续核实）</option>
        </select>
      </label>
      <label className="fld">
        <span>现场记录</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：老人在沙发睡着，手环未佩戴；已协助佩戴并提醒充电……" />
      </label>
    </Modal>
  )
}

function FollowupModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (c: string) => void }) {
  const [content, setContent] = useState('')
  return (
    <Modal title="登记回访记录（48 小时内）" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={!content.trim()} onClick={() => onSubmit(content)}>保存回访</button>
      </>
    }>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="老人恢复情况、家属沟通结果、后续照护安排……" />
    </Modal>
  )
}

function CloseModal({ defaultCategory, onClose, onSubmit }: {
  defaultCategory: CloseCategory
  onClose: () => void
  onSubmit: (p: { category: CloseCategory; falseAlarmReason?: string; deviceAdvice?: string; thresholdChanged?: string }) => void
}) {
  const [category, setCategory] = useState<CloseCategory>(defaultCategory)
  const [falseAlarmReason, setReason] = useState('')
  const [deviceAdvice, setAdvice] = useState('')
  const [thresholdChanged, setTh] = useState('')
  return (
    <Modal title="事件闭环复盘" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" onClick={() => onSubmit({ category, falseAlarmReason: falseAlarmReason || undefined, deviceAdvice: deviceAdvice || undefined, thresholdChanged: thresholdChanged || undefined })}>
          确认闭环并更新画像
        </button>
      </>
    }>
      <label className="fld">
        <span>事件定性（帮助社区区分三类问题）</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as CloseCategory)}>
          <option value="deviceFalse">设备误报（佩戴/电量/信号/灵敏度）</option>
          <option value="careGap">照护缺口（家属失联、上门无人、日常照看不足）</option>
          <option value="realRisk">真实风险（真实跌倒/急病/走失等）</option>
        </select>
      </label>
      {category === 'deviceFalse' && (
        <label className="fld">
          <span>误报原因</span>
          <input type="text" value={falseAlarmReason} onChange={(e) => setReason(e.target.value)} placeholder="如：洗澡时摘下手环 / 腕带松动 / 弱网掉线" />
        </label>
      )}
      <label className="fld">
        <span>设备调整建议</span>
        <input type="text" value={deviceAdvice} onChange={(e) => setAdvice(e.target.value)} placeholder="如：更换腕带、降低跌倒灵敏度、检修电池" />
      </label>
      <label className="fld">
        <span>阈值/围栏调整（可选，用于优化后续告警）</span>
        <input type="text" value={thresholdChanged} onChange={(e) => setTh(e.target.value)} placeholder="如：离线告警 60 → 90 分钟；围栏预警 800 米 → 500 米" />
      </label>
      <div className="small muted">系统将自动计算家属响应时长与社区处置时效，并把连续无人响应、频繁离线、多次上门无人等沉淀进照护画像。</div>
    </Modal>
  )
}

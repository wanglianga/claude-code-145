import { create } from 'zustand'
import { elders as seedElders, incidents as seedIncidents, workers } from './mockData'
import type {
  AlarmType,
  CloseCategory,
  CloseReport,
  Elder,
  FamilyAction,
  Incident,
  RiskTag,
  Thresholds,
  TimelineEvent,
} from './types'
import { minutesBetween } from './flow'

export type Role = 'community' | 'family'

let seq = 100
const nextId = (p: string) => `${p}${++seq}`
const now = () => new Date().toISOString()

interface CloseInput {
  category: CloseCategory
  falseAlarmReason?: string
  deviceAdvice?: string
  thresholdChanged?: string
}

interface VisitInput {
  result: 'nobody' | 'safe' | 'injured'
  note: string
}

interface Store {
  elders: Elder[]
  incidents: Incident[]
  workers: typeof workers
  role: Role
  familyIdentity: string // 当前家属身份（联系人姓名）
  selectedIncidentId?: string

  setRole: (r: Role) => void
  setFamilyIdentity: (name: string) => void
  selectIncident: (id?: string) => void

  // 绑定与档案
  bindElder: (e: Elder) => void
  updateThresholds: (elderId: string, t: Thresholds) => void
  updateCare: (
    elderId: string,
    patch: Pick<Elder['profile'], 'visitFrequency' | 'maintenance' | 'familyReminder' | 'note'>
  ) => void

  // 模拟新手环上报
  raiseAlarm: (elderId: string, type: AlarmType, location: string) => void

  // 家属端
  familyRespond: (incidentId: string, action: FamilyAction) => void

  // 社区端
  logCallResult: (incidentId: string, reached: boolean) => void
  dispatchWorker: (incidentId: string, workerId: string) => void
  reportVisit: (incidentId: string, input: VisitInput) => void
  escalate120: (incidentId: string) => void
  markHospital: (incidentId: string) => void
  resolveOnSite: (incidentId: string, note: string) => void
  addFollowup: (incidentId: string, content: string) => void
  closeIncident: (incidentId: string, input: CloseInput) => void
}

const addTimeline = (inc: Incident, ev: Omit<TimelineEvent, 'id'>): Incident => ({
  ...inc,
  timeline: [...inc.timeline, { ...ev, id: nextId('t') }],
})

const addTags = (inc: Incident, tags: RiskTag[]): Incident => ({
  ...inc,
  riskTags: Array.from(new Set([...inc.riskTags, ...tags])),
})

/** 闭环后照护画像沉淀 */
function applyProfileOnClose(elder: Elder, inc: Incident, report: CloseReport): Elder {
  const p = { ...elder.profile }
  const familyAck = inc.timeline.find((t) => t.kind === 'familyAck')
  const respondedFast = familyAck && minutesBetween(inc.startAt, familyAck.at) <= 10
  p.noResponseStreak = respondedFast ? 0 : inc.riskTags.includes('familyNoResponse') ? p.noResponseStreak + 1 : p.noResponseStreak
  if (inc.type === 'offline') p.offlineCount30d += 1
  if (inc.riskTags.includes('nobodyHome')) p.nobodyHomeCount += 1

  if (report.category === 'deviceFalse') {
    p.category = 'deviceFalse'
    p.note = `闭环定性为设备误报：${report.falseAlarmReason ?? '见事件记录'}。已推动设备维护，暂按常规巡访。`
    p.maintenance = report.deviceAdvice ?? p.maintenance
  } else if (report.category === 'careGap') {
    p.category = 'careGap'
    p.visitFrequency = p.noResponseStreak >= 2 ? '建议每周 1 次以上' : '每月 2 次'
    p.familyReminder = '电话 + 短信 + 备用联系人多通道提醒'
    p.note = `照护缺口画像：连续 ${p.noResponseStreak} 次家属响应超时，近 30 天离线 ${p.offlineCount30d} 次，上门无人 ${p.nobodyHomeCount} 次。`
  } else {
    p.category = 'realRisk'
    p.visitFrequency = '每周 2 次重点巡访'
    p.note = '真实风险老人：需重点盯防，社区与家属保持高频联动。'
  }
  return { ...elder, profile: p }
}

export const useStore = create<Store>((set, get) => ({
  elders: seedElders,
  incidents: seedIncidents,
  workers,
  role: 'community',
  familyIdentity: '张小明',

  setRole: (r) => set({ role: r }),
  setFamilyIdentity: (name) => set({ familyIdentity: name }),
  selectIncident: (id) => set({ selectedIncidentId: id }),

  bindElder: (e) => set((s) => ({ elders: [e, ...s.elders] })),

  updateThresholds: (elderId, t) =>
    set((s) => ({
      elders: s.elders.map((e) => (e.id === elderId ? { ...e, thresholds: t } : e)),
    })),

  updateCare: (elderId, patch) =>
    set((s) => ({
      elders: s.elders.map((e) =>
        e.id === elderId ? { ...e, profile: { ...e.profile, ...patch } } : e
      ),
    })),

  raiseAlarm: (elderId, type, location) => {
    const elder = get().elders.find((e) => e.id === elderId)!
    const start = now()
    const hour = new Date(start).getHours()
    const night = hour < 6 || hour >= 22
    const tags: RiskTag[] = []
    if (elder.battery < 20) tags.push('lowBattery')
    if (location.includes('浴室') || location.includes('卫生间') || location.includes('厕所')) tags.push('bathroom')
    if (night) tags.push('night')

    const typeDetail: Record<AlarmType, string> = {
      fall: '手环检测到疑似跌倒冲击，随后无明显活动。',
      heartRate: `心率持续超出阈值（${elder.thresholds.heartLow}-${elder.thresholds.heartHigh} 次/分）。`,
      stationary: `静止时长超过阈值 ${elder.thresholds.stationaryMin} 分钟。`,
      leftHome: '定位超出电子围栏且超过预计归家时间。',
      offline: `设备离线超过 ${elder.thresholds.offlineMin} 分钟。`,
    }
    const inc: Incident = {
      id: `INC-${new Date(start).getTime().toString().slice(-8)}`,
      elderId,
      type,
      startAt: start,
      status: 'active',
      location: location || '未知位置',
      night,
      batteryAtAlarm: elder.battery,
      detail: typeDetail[type],
      trajectory: [{ at: start.replace('T', ' ').slice(0, 16), place: location || '最后已知位置' }],
      contacts: elder.contacts.map((c) => ({ ...c, notified: true })),
      riskTags: tags,
      timeline: [
        {
          id: nextId('t'),
          at: start,
          kind: 'alarm',
          actor: '手环系统',
          content: `${type} 告警：${location}${night ? '（夜间）' : ''}；已自动通知紧急联系人。`,
        },
      ],
      falseAlarmCount: get()
        .incidents.filter((i) => i.elderId === elderId && i.closeReport?.category === 'deviceFalse')
        .length,
    }
    set((s) => ({ incidents: [inc, ...s.incidents], selectedIncidentId: inc.id }))
  },

  familyRespond: (incidentId, action) => {
    const me = get().familyIdentity
    const actionText: Record<FamilyAction, string> = {
      falseAlarm: '家属确认误报：老人平安，无需处置。',
      callVerify: '家属请求电话核实：请社区立即电话联系老人。',
      homeVisit: '家属要求上门查看，请网格员尽快到场。',
      emergency: '家属要求直接联系急救（120），请立即联动。',
    }
    set((s) => ({
      incidents: s.incidents.map((inc) => {
        if (inc.id !== incidentId || inc.status !== 'active') return inc
        let next = addTimeline(inc, { at: now(), kind: 'familyAck', actor: me, content: actionText[action] })
        next = {
          ...next,
          familyAction: action,
          familyActionAt: now(),
          contacts: next.contacts.map((c) => (c.name.includes(me) ? { ...c, responded: true } : c)),
        }
        next.riskTags = next.riskTags.filter((t) => t !== 'familyNoResponse')
        if (action === 'emergency') next = addTags(next, ['need120'])
        return next
      }),
    }))

    // 家属要求上门 / 急救 → 社区端自动生成待处置派单提示
    if (action === 'homeVisit' || action === 'emergency') {
      const inc = get().incidents.find((i) => i.id === incidentId)!
      const elder = get().elders.find((e) => e.id === inc.elderId)!
      const worker = get().workers.find((w) => w.id === elder.gridWorkerId && w.onDuty)
      set((s) => ({
        incidents: s.incidents.map((i) =>
          i.id === incidentId && worker
            ? addTimeline(
                { ...i, workerId: worker.id, workerName: worker.name },
                {
                  at: now(),
                  kind: 'dispatch',
                  actor: '值班平台',
                  content:
                    action === 'emergency'
                      ? `已按家属要求联动 120；同时通知网格员 ${worker.name} 先行到场。`
                      : `家属要求上门，已向网格员 ${worker.name} 派单。`,
                }
              )
            : i
        ),
      }))
      if (action === 'emergency') {
        get().escalate120(incidentId)
      }
    }
  },

  logCallResult: (incidentId, reached) => {
    set((s) => ({
      incidents: s.incidents.map((inc) => {
        if (inc.id !== incidentId || inc.status !== 'active') return inc
        const next = addTimeline(inc, {
          at: now(),
          kind: 'call',
          actor: '值班网格员',
          content: reached ? '电话已接通：老人自述平安，保持观察。' : '再次外呼老人电话，仍无人接听。',
        })
        return reached ? next : addTags(next, ['elderNoAnswer'])
      }),
    }))
  },

  dispatchWorker: (incidentId, workerId) => {
    const worker = get().workers.find((w) => w.id === workerId)!
    set((s) => ({
      incidents: s.incidents.map((inc) =>
        inc.id === incidentId && inc.status === 'active'
          ? addTimeline(
              { ...inc, workerId, workerName: worker.name },
              {
                at: now(),
                kind: 'dispatch',
                actor: '值班平台',
                content: `网格员 ${worker.name}（${worker.phone}）已接单上门，责任片区：${worker.area}。`,
              }
            )
          : inc
      ),
    }))
  },

  reportVisit: (incidentId, input) => {
    set((s) => ({
      incidents: s.incidents.map((inc) => {
        if (inc.id !== incidentId || inc.status !== 'active') return inc
        if (input.result === 'nobody') {
          return addTags(
            addTimeline(inc, {
              at: now(),
              kind: 'visit',
              actor: inc.workerName ?? '网格员',
              content: `上门无人开门。${input.note} 已通知门岗留意，准备联动楼栋长与家属再次核实行踪。`,
            }),
            ['nobodyHome', 'needProperty']
          )
        }
        const found =
          input.result === 'injured'
            ? `上门发现老人受伤/不适：${input.note} 已做初步处置，等待急救。`
            : `上门确认老人平安：${input.note || '现场情况正常，已安抚老人。'}`
        let next = addTimeline(inc, {
          at: now(),
          kind: 'visit',
          actor: inc.workerName ?? '网格员',
          content: found,
        })
        if (input.result === 'injured') next = addTags(next, ['need120'])
        return next
      }),
    }))
  },

  escalate120: (incidentId) => {
    const elder = get().elders.find((e) => e.id === get().incidents.find((i) => i.id === incidentId)?.elderId)
    set((s) => ({
      incidents: s.incidents.map((inc) =>
        inc.id === incidentId && inc.status === 'active'
          ? addTags(
              addTimeline(inc, {
                at: now(),
                kind: 'escalate',
                actor: '值班平台',
                content: `已拨打 120 并交接：${elder?.name ?? ''}，${elder?.address ?? ''}；慢病史：${elder?.chronic.join('、') ?? '无'}；门禁：${elder?.doorAccess ?? '未知'}。`,
              }),
              ['need120']
            )
          : inc
      ),
    }))
  },

  markHospital: (incidentId) => {
    set((s) => ({
      incidents: s.incidents.map((inc) =>
        inc.id === incidentId && inc.status === 'active'
          ? addTimeline({ ...inc, status: 'hospital' }, {
              at: now(),
              kind: 'medical',
              actor: inc.workerName ?? '网格员',
              content: '急救人员到场，老人已送医，家属/网格员陪同交接。',
            })
          : inc
      ),
    }))
  },

  resolveOnSite: (incidentId, note) => {
    set((s) => ({
      incidents: s.incidents.map((inc) =>
        inc.id === incidentId && inc.status === 'active'
          ? addTimeline({ ...inc, status: 'resolved' }, {
              at: now(),
              kind: 'visit',
              actor: inc.workerName ?? '网格员',
              content: `现场化解，无需送医。${note}`,
            })
          : inc
      ),
    }))
  },

  addFollowup: (incidentId, content) => {
    const inc = get().incidents.find((i) => i.id === incidentId)!
    const ts = now()
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === incidentId
          ? addTimeline(i, { at: ts, kind: 'followup', actor: '社区工作人员', content })
          : i
      ),
      elders: s.elders.map((e) =>
        e.id === inc.elderId
          ? { ...e, lastFollowup: { at: ts.replace('T', ' ').slice(0, 16), visitor: '社区工作人员', content } }
          : e
      ),
    }))
  },

  closeIncident: (incidentId, input) => {
    const state = get()
    const inc = state.incidents.find((i) => i.id === incidentId)!
    const elder = state.elders.find((e) => e.id === inc.elderId)!
    const familyAck = inc.timeline.find((t) => t.kind === 'familyAck')
    const report: CloseReport = {
      category: input.category,
      falseAlarmReason: input.falseAlarmReason,
      deviceAdvice: input.deviceAdvice,
      thresholdChanged: input.thresholdChanged,
      familyResponseMin: familyAck ? minutesBetween(inc.startAt, familyAck.at) : -1, // -1 表示全程未响应
      communityElapsedMin: minutesBetween(inc.startAt, now()),
    }
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === incidentId
          ? addTimeline(
              { ...i, status: 'closed' as const, closeReport: report },
              {
                at: now(),
                kind: 'close',
                actor: '社区工作人员',
                content: `事件闭环：${
                  input.category === 'deviceFalse' ? '设备误报' : input.category === 'careGap' ? '照护缺口' : '真实风险'
                }；家属响应 ${report.familyResponseMin < 0 ? '超时未响应' : report.familyResponseMin + ' 分钟'}，社区处置 ${report.communityElapsedMin} 分钟。`,
              }
            )
          : i
      ),
      elders: s.elders.map((e) => (e.id === elder.id ? applyProfileOnClose(e, inc, report) : e)),
    }))
  },
}))

// ---- 选择器辅助 ----
export const selectElder = (id: string) => useStore((s) => s.elders.find((e) => e.id === id))

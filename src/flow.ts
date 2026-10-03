import type { AlarmType, Elder, Incident, RiskTag } from './types'

export const alarmMeta: Record<
  AlarmType,
  { label: string; short: string; color: string; bg: string }
> = {
  fall: { label: '跌倒告警', short: '跌倒', color: '#b42318', bg: '#fef3f2' },
  heartRate: { label: '心率异常', short: '心率', color: '#b93815', bg: '#fff6ed' },
  stationary: { label: '长时间静止', short: '静止', color: '#b54708', bg: '#fffaeb' },
  leftHome: { label: '离家未归', short: '离家', color: '#175cd3', bg: '#eff8ff' },
  offline: { label: '设备离线', short: '离线', color: '#344054', bg: '#f2f4f7' },
}

export const riskTagMeta: Record<RiskTag, { label: string; tone: 'danger' | 'warn' | 'info' }> = {
  familyNoResponse: { label: '家属未响应', tone: 'danger' },
  elderNoAnswer: { label: '老人电话无人接', tone: 'danger' },
  lowBattery: { label: '设备低电', tone: 'warn' },
  bathroom: { label: '浴室告警', tone: 'warn' },
  night: { label: '夜间告警', tone: 'warn' },
  nobodyHome: { label: '上门无人开门', tone: 'danger' },
  needProperty: { label: '需联动物业', tone: 'info' },
  need120: { label: '需联动 120', tone: 'danger' },
}

export interface PlaybookStep {
  key: string
  title: string
  detail: string
  state: 'done' | 'active' | 'pending'
  owner: '系统' | '家属' | '社区' | '急救'
}

/**
 * 根据告警类型、风险标签、历史误报、时间线生成处置流程。
 * state 由当前事件的实际推进（时间线/标签/处置人）推导。
 */
export function buildPlaybook(inc: Incident, elder: Elder): PlaybookStep[] {
  const has = (t: RiskTag) => inc.riskTags.includes(t)
  const kinds = new Set(inc.timeline.map((t) => t.kind))
  const familyResponded = inc.contacts.some((c) => c.responded)
  const dispatched = !!inc.workerId || kinds.has('dispatch')
  const visited = kinds.has('visit')
  const escalated = kinds.has('escalate')
  const steps: PlaybookStep[] = []

  // 1. 告警接入与风险研判（系统）
  const hist = inc.falseAlarmCount
  steps.push({
    key: 'intake',
    title: '告警接入与自动研判',
    detail: `${alarmMeta[inc.type].label}：${inc.detail} 近 30 天同类误报 ${hist} 次，已结合最近活动轨迹研判。`,
    state: 'done',
    owner: '系统',
  })

  // 2. 联系老人
  const elderCallDone = kinds.has('call') || has('elderNoAnswer')
  steps.push({
    key: 'callElder',
    title: '电话核实老人情况',
    detail: has('elderNoAnswer')
      ? '老人电话无人接听，风险升高，需立即上门核查。'
      : '外呼老人手环/家庭电话，确认本人状态与现场情况。',
    state: elderCallDone ? 'done' : 'active',
    owner: '社区',
  })

  // 3. 通知家属
  steps.push({
    key: 'notifyFamily',
    title: '通知紧急联系人并等待家属决策',
    detail: familyResponded
      ? '家属已响应：' + (inc.contacts.find((c) => c.responded)?.name ?? '')
      : `已按优先级通知 ${inc.contacts.filter((c) => c.notified).length} 位家属，等待确认误报/电话核实/上门/急救。`,
    state: familyResponded ? 'done' : 'active',
    owner: '家属',
  })

  // 4. 超时升级
  if (has('familyNoResponse') || has('elderNoAnswer')) {
    steps.push({
      key: 'escalate',
      title: '超时无响应，升级社区值班处置',
      detail: '家属迟迟未响应且/或老人电话无人接，自动升级值班长，调度附近网格员。',
      state: escalated || dispatched ? 'done' : 'active',
      owner: '社区',
    })
  }

  // 5. 上门
  const visitTitle =
    inc.type === 'leftHome'
      ? '网格员沿活动轨迹寻找并联动门岗'
      : '网格员上门核查（门禁/钥匙托管）'
  let visitDetail = `处置人携带老人地址与门禁信息上门：${elder.doorAccess}；钥匙：${elder.keyHeld}。`
  if (has('bathroom')) visitDetail += ' 浴室告警优先破门/呼叫急救评估。'
  if (has('nobodyHome')) visitDetail += ' 上次上门无人开门，需联动物业核实行踪。'
  steps.push({
    key: 'visit',
    title: visitTitle,
    detail: visitDetail,
    state: visited ? 'done' : dispatched ? 'active' : 'pending',
    owner: '社区',
  })

  // 6. 外部联动
  if (inc.type === 'leftHome' || has('needProperty') || has('nobodyHome')) {
    steps.push({
      key: 'property',
      title: '联动物业 / 门岗 / 楼栋长',
      detail: '调取门岗记录、电梯监控，发动楼栋长在常用活动范围内寻找。',
      state: kinds.has('escalate') && (has('needProperty') || has('nobodyHome')) ? 'done' : 'pending',
      owner: '社区',
    })
  }
  if (inc.familyAction === 'emergency' || has('need120')) {
    steps.push({
      key: 'ems',
      title: '联动 120 急救',
      detail: '向急救人员交接慢病史：' + elder.chronic.join('、') + '，并由家属/网格员陪同就医。',
      state: inc.status === 'hospital' || kinds.has('medical') ? 'done' : 'active',
      owner: '急救',
    })
  }

  // 7. 低电提醒
  if (has('lowBattery')) {
    steps.push({
      key: 'battery',
      title: '设备低电处置',
      detail: `告警时电量 ${inc.batteryAtAlarm}%，上门时协助充电，事后安排充电器/电池维护，避免中断监测。`,
      state: visited ? 'done' : 'pending',
      owner: '社区',
    })
  }

  // 8. 回访闭环
  steps.push({
    key: 'close',
    title: '就医/回访与事件闭环',
    detail: '无论是否送医，均在 48 小时内回访；闭环时沉淀误报原因、设备建议、家属响应时长与处置时效，更新照护画像与阈值。',
    state: inc.status === 'closed' ? 'done' : 'pending',
    owner: '社区',
  })

  return steps
}

export function priorityScore(inc: Incident): number {
  let s = 0
  const weights: Record<RiskTag, number> = {
    need120: 100,
    elderNoAnswer: 60,
    familyNoResponse: 50,
    bathroom: 40,
    night: 30,
    nobodyHome: 35,
    needProperty: 10,
    lowBattery: 15,
  }
  inc.riskTags.forEach((t) => (s += weights[t]))
  if (inc.type === 'fall') s += 30
  if (inc.type === 'heartRate') s += 20
  if (inc.falseAlarmCount >= 3) s -= 15 // 历史误报多，适度降权但仍处置
  if (inc.status !== 'active') s -= 200
  return s
}

export function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtTimeShort(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

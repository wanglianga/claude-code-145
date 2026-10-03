// 领域模型：老人档案、告警事件、处置记录、照护画像

export type AlarmType = 'fall' | 'heartRate' | 'stationary' | 'leftHome' | 'offline'

export type IncidentStatus =
  | 'active' // 处置中
  | 'resolved' // 已化解（无需送医）
  | 'hospital' // 已送医
  | 'closed' // 已闭环复盘

export type EventKind =
  | 'alarm' // 告警
  | 'familyAck' // 家属确认
  | 'call' // 电话核实
  | 'dispatch' // 派单上门
  | 'visit' // 上门结果
  | 'escalate' // 升级联动
  | 'medical' // 就医
  | 'followup' // 回访
  | 'close' // 闭环

export interface TimelineEvent {
  id: string
  at: string // ISO 时间
  kind: EventKind
  actor: string // 操作人/系统
  content: string
}

export interface Contact {
  id: string
  name: string
  relation: string
  phone: string
  /** 通知优先级，1 为最高 */
  priority: number
  notified: boolean
  responded: boolean
}

export interface TrackPoint {
  at: string
  place: string
}

export type FamilyAction = 'falseAlarm' | 'callVerify' | 'homeVisit' | 'emergency'

export type RiskTag =
  | 'familyNoResponse' // 家属迟迟未响应
  | 'elderNoAnswer' // 老人电话无人接
  | 'lowBattery' // 设备低电
  | 'bathroom' // 告警发生在浴室
  | 'night' // 夜间告警
  | 'nobodyHome' // 上门无人开门
  | 'needProperty' // 需要联动物业
  | 'need120' // 需要联动 120

export type CloseCategory = 'deviceFalse' | 'careGap' | 'realRisk'

export interface CloseReport {
  category: CloseCategory
  falseAlarmReason?: string // 误报原因
  deviceAdvice?: string // 设备调整建议
  familyResponseMin: number // 家属响应时长（分钟）
  communityElapsedMin: number // 社区处置时效（分钟）
  thresholdChanged?: string // 阈值调整记录
}

export interface Incident {
  id: string
  elderId: string
  type: AlarmType
  startAt: string
  status: IncidentStatus
  /** 告警发生位置，如 浴室 / 客厅 / 小区花园 */
  location: string
  night: boolean
  batteryAtAlarm: number
  detail: string
  trajectory: TrackPoint[]
  contacts: Contact[]
  workerId?: string // 当前处置网格员
  workerName?: string
  riskTags: RiskTag[]
  familyAction?: FamilyAction
  familyActionAt?: string
  timeline: TimelineEvent[]
  closeReport?: CloseReport
  /** 事件发生时老人近 30 天误报次数快照 */
  falseAlarmCount: number
}

export interface Thresholds {
  fallSensitivity: 'low' | 'medium' | 'high' // 跌倒检测灵敏度
  heartLow: number // 心率下限
  heartHigh: number // 心率上限
  stationaryMin: number // 长时间静止分钟
  offlineMin: number // 离线告警分钟
  geofence: string // 电子围栏（常用活动范围外告警）
}

export interface Followup {
  at: string
  visitor: string
  content: string
}

export interface CareProfile {
  /** 连续无人响应次数 */
  noResponseStreak: number
  /** 频繁离线次数（近 30 天） */
  offlineCount30d: number
  /** 上门无人在家次数 */
  nobodyHomeCount: number
  /** 画像结论 */
  category: CloseCategory | 'normal'
  /** 建议/实际巡访频次 */
  visitFrequency: string
  /** 设备维护安排 */
  maintenance: string
  /** 家属提醒方式 */
  familyReminder: string
  note: string
}

export interface Elder {
  id: string
  name: string
  age: number
  gender: '男' | '女'
  address: string
  doorAccess: string // 门禁信息
  keyHeld: string // 钥匙托管
  chronic: string[] // 慢病
  activityRange: string // 常用活动范围
  battery: number // 设备电量
  wearHabit: string // 佩戴习惯
  online: boolean
  thresholds: Thresholds
  gridWorkerId: string
  contacts: Contact[] // 紧急联系人
  lastFollowup?: Followup // 上一次回访记录
  profile: CareProfile
}

export interface GridWorker {
  id: string
  name: string
  phone: string
  area: string
  onDuty: boolean
}

import type { ReactNode } from 'react'
import type { CloseCategory, IncidentStatus } from '../types'
import { riskTagMeta } from '../flow'
import type { RiskTag } from '../types'

export function Tag({ tone = 'gray', children }: { tone?: 'danger' | 'warn' | 'info' | 'gray' | 'green' | 'primary'; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function RiskTags({ tags }: { tags: RiskTag[] }) {
  if (!tags.length) return null
  return (
    <span className="inc-tags" style={{ marginTop: 0 }}>
      {tags.map((t) => (
        <Tag key={t} tone={riskTagMeta[t].tone}>
          {riskTagMeta[t].label}
        </Tag>
      ))}
    </span>
  )
}

const statusMeta: Record<IncidentStatus, { label: string; tone: 'danger' | 'warn' | 'green' | 'gray' }> = {
  active: { label: '处置中', tone: 'danger' },
  resolved: { label: '已化解', tone: 'green' },
  hospital: { label: '已送医', tone: 'warn' },
  closed: { label: '已闭环', tone: 'gray' },
}

export function StatusTag({ status }: { status: IncidentStatus }) {
  const m = statusMeta[status]
  return <Tag tone={m.tone}>{m.label}</Tag>
}

export const categoryMeta: Record<CloseCategory | 'normal', { label: string; tone: 'gray' | 'warn' | 'danger' | 'green'; desc: string }> = {
  deviceFalse: { label: '设备误报', tone: 'gray', desc: '由设备佩戴、电量、信号、灵敏度等引起，需优化设备与阈值' },
  careGap: { label: '照护缺口', tone: 'warn', desc: '家属响应慢、上门常无人、缺乏日常照看，需加密社区介入' },
  realRisk: { label: '真实风险', tone: 'danger', desc: '存在真实跌倒、走失、急病等风险，需重点巡访与多方联动' },
  normal: { label: '常规关注', tone: 'green', desc: '暂无异常画像' },
}

export function Battery({ value }: { value: number }) {
  const color = value < 20 ? '#d92d20' : value < 40 ? '#dc6803' : '#039855'
  return (
    <span className="battery" title={`电量 ${value}%`}>
      <span className="batt-bar">
        <i style={{ width: `${value}%`, background: color }} />
      </span>
      <span style={{ color }}>{value}%</span>
    </span>
  )
}

export function Modal({ title, onClose, children, footer, width = '640px' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" style={{ width }}>
        <div className="card-hd between flex">
          <span>{title}</span>
          <button className="btn sm" onClick={onClose}>关闭</button>
        </div>
        <div className="card-bd">{children}</div>
        {footer && <div className="card-bd" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ text = '暂无数据' }: { text?: string }) {
  return <div className="empty">{text}</div>
}

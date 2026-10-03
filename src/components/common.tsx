import React from 'react'
import { Tag } from 'antd'
import dayjs from 'dayjs'
import { AlertType, ALERT_TYPE_LABEL, EventStatus, EVENT_STATUS_LABEL, Severity, SEVERITY_LABEL } from '../types'

export const fmtTime = (ts: number) => dayjs(ts).format('MM-DD HH:mm')
export const fmtTimeFull = (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
export const fmtMinutes = (m: number | null) => (m === null ? '未响应' : m < 60 ? `${m}分钟` : `${Math.floor(m / 60)}小时${m % 60}分`)

export const SEVERITY_COLOR: Record<Severity, string> = { high: 'red', medium: 'orange', low: 'blue' }
export const STATUS_COLOR: Record<EventStatus, string> = {
  pending_family: 'gold',
  family_verifying: 'geekblue',
  door_visit: 'purple',
  medical: 'red',
  follow_up: 'cyan',
  closed: 'default',
}
export const ALERT_COLOR: Record<AlertType, string> = {
  fall: 'red',
  heart_rate: 'volcano',
  stillness: 'gold',
  away: 'purple',
  offline: 'default',
}

export const SeverityTag: React.FC<{ v: Severity }> = ({ v }) => <Tag color={SEVERITY_COLOR[v]}>{SEVERITY_LABEL[v]}</Tag>
export const StatusTag: React.FC<{ v: EventStatus }> = ({ v }) => <Tag color={STATUS_COLOR[v]}>{EVENT_STATUS_LABEL[v]}</Tag>
export const AlertTypeTag: React.FC<{ v: AlertType }> = ({ v }) => <Tag color={ALERT_COLOR[v]}>{ALERT_TYPE_LABEL[v]}</Tag>

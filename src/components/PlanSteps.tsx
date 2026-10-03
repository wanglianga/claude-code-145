import React from 'react'
import { Card, Steps, Tag, Typography } from 'antd'
import { AlertEvent } from '../types'
import { deriveStepStates } from '../store/workflow'

const { Text } = Typography

/** 生成的处置流程（含每步依据与当前状态） */
const PlanSteps: React.FC<{ event: AlertEvent }> = ({ event }) => {
  const states = deriveStepStates(event)
  const items = event.plan.map((p) => {
    const st = states[p.key] ?? 'pending'
    return {
      title: (
        <span>
          {p.title} {p.conditional && <Tag>条件触发</Tag>}
        </span>
      ),
      status: st === 'done' ? ('finish' as const) : st === 'active' ? ('process' as const) : st === 'skipped' ? ('error' as const) : ('wait' as const),
      description: (
        <div>
          <div style={{ fontSize: 12 }}>{p.desc}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            依据：{p.reason}
          </Text>
        </div>
      ),
    }
  })
  const current = items.findIndex((i) => i.status === 'process')
  return (
    <Card size="small" title="生成的处置流程" style={{ marginBottom: 12 }}>
      <Steps direction="vertical" size="small" current={current === -1 ? items.length : current} items={items} />
    </Card>
  )
}

export default PlanSteps

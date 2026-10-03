import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { Elder, Thresholds } from '../types'
import { Battery, categoryMeta, Modal, Tag } from '../components/ui'

const emptyForm = {
  name: '',
  age: 78,
  gender: '女' as '男' | '女',
  address: '',
  doorAccess: '',
  keyHeld: '',
  chronic: '',
  activityRange: '',
  battery: 100,
  wearHabit: '',
  contactName: '',
  contactRelation: '',
  contactPhone: '',
  fallSensitivity: 'medium' as Thresholds['fallSensitivity'],
  heartLow: 50,
  heartHigh: 110,
  stationaryMin: 30,
  offlineMin: 60,
  geofence: '',
  workerId: 'w1',
}

export default function Elders() {
  const elders = useStore((s) => s.elders)
  const workers = useStore((s) => s.workers)
  const incidents = useStore((s) => s.incidents)
  const bindElder = useStore((s) => s.bindElder)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const stats = (elderId: string) => {
    const list = incidents.filter((i) => i.elderId === elderId)
    return {
      total: list.length,
      active: list.filter((i) => i.status === 'active').length,
      falseAlarm: list.filter((i) => i.closeReport?.category === 'deviceFalse').length,
    }
  }

  const submit = () => {
    const elder: Elder = {
      id: `e${Date.now()}`,
      name: form.name.trim(),
      age: Number(form.age),
      gender: form.gender,
      address: form.address.trim(),
      doorAccess: form.doorAccess.trim() || '待登记',
      keyHeld: form.keyHeld.trim() || '待登记',
      chronic: form.chronic.split(/[、,，\s]+/).filter(Boolean),
      activityRange: form.activityRange.trim() || '待登记',
      battery: Number(form.battery),
      wearHabit: form.wearHabit.trim() || '待观察',
      online: true,
      thresholds: {
        fallSensitivity: form.fallSensitivity,
        heartLow: Number(form.heartLow),
        heartHigh: Number(form.heartHigh),
        stationaryMin: Number(form.stationaryMin),
        offlineMin: Number(form.offlineMin),
        geofence: form.geofence.trim() || form.activityRange.trim() || '幸福里社区',
      },
      gridWorkerId: form.workerId,
      contacts: form.contactName.trim()
        ? [{ id: `c${Date.now()}`, name: form.contactName.trim(), relation: form.contactRelation.trim() || '家属', phone: form.contactPhone.trim() || '未填写', priority: 1, notified: false, responded: false }]
        : [],
      profile: {
        noResponseStreak: 0,
        offlineCount30d: 0,
        nobodyHomeCount: 0,
        category: 'normal',
        visitFrequency: '每月 1 次常规巡访',
        maintenance: '新绑定设备，30 天内安排一次佩戴与充电指导',
        familyReminder: '微信 + 电话',
        note: '新绑定老人，暂按常规照护。',
      },
    }
    bindElder(elder)
    setOpen(false)
    setForm({ ...emptyForm })
    navigate(`/elders/${elder.id}`)
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-bd flex between wrap">
          <div>
            <b>独居老人与手环绑定档案（{elders.length} 人）</b>
            <div className="small muted mt8">档案记录姓名、住址、慢病、紧急联系人、活动范围、电量、佩戴习惯与告警阈值，作为告警处置依据。</div>
          </div>
          <button className="btn primary" onClick={() => setOpen(true)}>➕ 绑定新老人/手环</button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>老人</th><th>住址 / 门禁 / 钥匙</th><th>慢病与活动范围</th><th>设备</th><th>画像</th><th>事件</th><th></th>
            </tr>
          </thead>
          <tbody>
            {elders.map((e) => {
              const m = categoryMeta[e.profile.category]
              const st = stats(e.id)
              return (
                <tr key={e.id} className="clickable" onClick={() => navigate(`/elders/${e.id}`)}>
                  <td>
                    <b>{e.name}</b>
                    <div className="small dim">{e.gender} · {e.age} 岁</div>
                  </td>
                  <td style={{ maxWidth: 230 }}>
                    <div>{e.address}</div>
                    <div className="small muted">门禁：{e.doorAccess}</div>
                    <div className="small muted">钥匙：{e.keyHeld}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div>{e.chronic.join('、') || '无慢病'}</div>
                    <div className="small muted">{e.activityRange}</div>
                  </td>
                  <td>
                    <div className="flex" style={{ gap: 8 }}>
                      {e.online ? <Tag tone="green">在线</Tag> : <Tag tone="gray">离线</Tag>}
                      <Battery value={e.battery} />
                    </div>
                    <div className="small dim mt8">灵敏度：{e.thresholds.fallSensitivity === 'high' ? '高' : e.thresholds.fallSensitivity === 'medium' ? '中' : '低'}</div>
                  </td>
                  <td><Tag tone={m.tone}>{m.label}</Tag></td>
                  <td className="small">
                    {st.active > 0 && <div><Tag tone="danger">处置中 {st.active}</Tag></div>}
                    <div className="mt8 dim">累计 {st.total} 起 · 误报 {st.falseAlarm} 起</div>
                  </td>
                  <td><span className="small muted">详情 ›</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal
          title="绑定老人与智能手环"
          onClose={() => setOpen(false)}
          width="720px"
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>取消</button>
              <button className="btn primary" disabled={!form.name.trim() || !form.address.trim()} onClick={submit}>完成绑定</button>
            </>
          }
        >
          <div className="grid cols-2">
            <label className="fld"><span>老人姓名 *</span><input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="如：王秀兰" /></label>
            <label className="fld">
              <span>性别 / 年龄</span>
              <div className="flex">
                <select value={form.gender} onChange={(e) => set('gender', e.target.value as '男' | '女')} style={{ width: 90 }}>
                  <option value="女">女</option><option value="男">男</option>
                </select>
                <input type="number" value={form.age} onChange={(e) => set('age', Number(e.target.value))} />
              </div>
            </label>
          </div>
          <label className="fld"><span>住址 *</span><input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="如：幸福里 3 栋 2 单元 501" /></label>
          <div className="grid cols-2">
            <label className="fld"><span>门禁信息</span><input type="text" value={form.doorAccess} onChange={(e) => set('doorAccess', e.target.value)} placeholder="单元门密码 / 入户锁类型" /></label>
            <label className="fld"><span>钥匙托管</span><input type="text" value={form.keyHeld} onChange={(e) => set('keyHeld', e.target.value)} placeholder="如：楼栋长处 / 社区便民柜 B-12" /></label>
          </div>
          <label className="fld"><span>慢病（顿号或逗号分隔）</span><input type="text" value={form.chronic} onChange={(e) => set('chronic', e.target.value)} placeholder="如：高血压、冠心病、糖尿病" /></label>
          <label className="fld"><span>常用活动范围（电子围栏依据）</span><input type="text" value={form.activityRange} onChange={(e) => set('activityRange', e.target.value)} placeholder="如：幸福里社区、滨河公园" /></label>
          <div className="grid cols-2">
            <label className="fld"><span>设备电量</span><input type="number" min={0} max={100} value={form.battery} onChange={(e) => set('battery', Number(e.target.value))} /></label>
            <label className="fld"><span>佩戴习惯</span><input type="text" value={form.wearHabit} onChange={(e) => set('wearHabit', e.target.value)} placeholder="如：24 小时佩戴 / 洗澡时摘下" /></label>
          </div>
          <div className="section-title">紧急联系人（第一顺位）</div>
          <div className="grid cols-3">
            <label className="fld"><span>姓名</span><input type="text" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></label>
            <label className="fld"><span>关系</span><input type="text" value={form.contactRelation} onChange={(e) => set('contactRelation', e.target.value)} placeholder="儿子/女儿" /></label>
            <label className="fld"><span>电话</span><input type="text" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></label>
          </div>
          <div className="section-title">告警阈值（可按老人情况个性化设置）</div>
          <div className="grid cols-2">
            <label className="fld">
              <span>跌倒检测灵敏度</span>
              <select value={form.fallSensitivity} onChange={(e) => set('fallSensitivity', e.target.value as Thresholds['fallSensitivity'])}>
                <option value="high">高（易触发，适合跌倒高风险）</option>
                <option value="medium">中</option>
                <option value="low">低（减少误报，适合活动幅度大老人）</option>
              </select>
            </label>
            <label className="fld"><span>电子围栏范围</span><input type="text" value={form.geofence} onChange={(e) => set('geofence', e.target.value)} placeholder="默认同常用活动范围" /></label>
            <label className="fld"><span>心率下限（次/分）</span><input type="number" value={form.heartLow} onChange={(e) => set('heartLow', Number(e.target.value))} /></label>
            <label className="fld"><span>心率上限（次/分）</span><input type="number" value={form.heartHigh} onChange={(e) => set('heartHigh', Number(e.target.value))} /></label>
            <label className="fld"><span>静止告警（分钟）</span><input type="number" value={form.stationaryMin} onChange={(e) => set('stationaryMin', Number(e.target.value))} /></label>
            <label className="fld"><span>离线告警（分钟）</span><input type="number" value={form.offlineMin} onChange={(e) => set('offlineMin', Number(e.target.value))} /></label>
          </div>
          <label className="fld">
            <span>责任网格员</span>
            <select value={form.workerId} onChange={(e) => set('workerId', e.target.value)}>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}（{w.area}）</option>)}
            </select>
          </label>
        </Modal>
      )}
    </div>
  )
}

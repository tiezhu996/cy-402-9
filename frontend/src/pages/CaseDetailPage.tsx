import {
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import * as documentApi from "../api/document";
import { AmountSummary } from "../components/common/AmountSummary";
import { DocumentList } from "../components/common/DocumentList";
import { StatusBadge } from "../components/common/StatusBadge";
import { TimelineItem } from "../components/common/TimelineItem";
import { PermissionGate } from "../directives/permission";
import { useCaseStore } from "../stores/case";
import type { Billing, PaymentRecord } from "../types";
import { BillingTypeLabels, CaseTypeLabels } from "../types/enums";
import { formatDate, formatMoney } from "../utils/format";

function totalReceived(billing: Billing): number {
  return (billing.paymentRecords ?? []).reduce((sum, pr) => sum + Number(pr.amount), 0);
}

export function CaseDetailPage() {
  const { id } = useParams();
  const { selectedCase, fetchCase, addPaymentRecord } = useCaseStore();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeBilling, setActiveBilling] = useState<Billing | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) void fetchCase(id);
  }, [id, fetchCase]);

  if (!selectedCase) {
    return <main className="page-shell">正在加载案件详情...</main>;
  }

  const billings = selectedCase.billings ?? [];
  const summary = billings.reduce(
    (acc, item) => {
      const amount = Number(item.amount);
      const received = totalReceived(item);
      acc.receivable += amount;
      acc.received += received;
      acc.pending += Math.max(amount - received, 0);
      return acc;
    },
    { receivable: 0, received: 0, pending: 0 }
  );

  async function removeDocument(documentId: string) {
    await documentApi.deleteDocument(documentId);
    message.success("文档已删除");
    if (id) void fetchCase(id);
  }

  function openAddPayment(billing: Billing) {
    setActiveBilling(billing);
    form.resetFields();
    form.setFieldsValue({
      receivedAt: dayjs(),
      amount: Math.max(Number(billing.amount) - totalReceived(billing), 0) || undefined
    });
    setPaymentModalOpen(true);
  }

  async function handleAddPayment(values: { amount: number; receivedAt: dayjs.Dayjs; note?: string }) {
    if (!activeBilling) return;
    try {
      await addPaymentRecord(activeBilling.id, {
        amount: values.amount,
        receivedAt: values.receivedAt.toISOString(),
        note: values.note
      });
      message.success("收款已登记");
      setPaymentModalOpen(false);
      setActiveBilling(null);
    } catch (e) {
      message.error("登记收款失败");
    }
  }

  const paymentColumns: ColumnsType<PaymentRecord> = [
    { title: "到账时间", dataIndex: "receivedAt", render: formatDate, width: 120 },
    { title: "收款金额", dataIndex: "amount", render: formatMoney, width: 140 },
    { title: "备注", dataIndex: "note", render: (value) => value || "-" }
  ];

  return (
    <main className="page-shell">
      <Space align="start" style={{ justifyContent: "space-between", width: "100%" }}>
        <div>
          <h1 className="page-title">{selectedCase.title}</h1>
          <div className="page-subtitle">{selectedCase.caseNo}</div>
        </div>
        <Space>
          <StatusBadge status={selectedCase.status} />
          <PermissionGate permission="case:write">
            <Button>状态流转</Button>
          </PermissionGate>
        </Space>
      </Space>

      <div className="work-band" style={{ marginTop: 18 }}>
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
          <Descriptions.Item label="案件类型">{CaseTypeLabels[selectedCase.type]}</Descriptions.Item>
          <Descriptions.Item label="客户">{selectedCase.client?.name}</Descriptions.Item>
          <Descriptions.Item label="主办律师">{selectedCase.mainLawyer?.name}</Descriptions.Item>
          <Descriptions.Item label="协办律师">
            {selectedCase.collaborators?.map((item) => item.user.name).join("、") || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="受理日期">{formatDate(selectedCase.acceptedAt)}</Descriptions.Item>
          <Descriptions.Item label="结案日期">{formatDate(selectedCase.closedAt)}</Descriptions.Item>
          <Descriptions.Item label="案情摘要" span={3}>
            {selectedCase.summary}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div className="work-grid" style={{ marginTop: 18 }}>
        <section className="work-band">
          <Typography.Title level={4}>文档归档</Typography.Title>
          <DocumentList documents={selectedCase.documents ?? []} onDelete={removeDocument} />
          <Divider />
          <Typography.Title level={4}>账单列表</Typography.Title>
          <AmountSummary {...summary} />
          <div style={{ marginTop: 12 }}>
            {billings.map((billing) => {
              const received = totalReceived(billing);
              const remaining = Math.max(Number(billing.amount) - received, 0);
              const payments = billing.paymentRecords ?? [];
              return (
                <div
                  key={billing.id}
                  className="meta-row"
                  style={{
                    flexDirection: "column",
                    alignItems: "stretch",
                    padding: "12px 0",
                    borderTop: "1px solid #f0f0f0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space size="middle">
                      <span style={{ fontWeight: 500 }}>{billing.billNo}</span>
                      <span>{BillingTypeLabels[billing.type]}</span>
                      <span>
                        账单金额：<strong>{formatMoney(billing.amount)}</strong>
                      </span>
                      <span style={{ color: "#52c41a" }}>已收：{formatMoney(received)}</span>
                      <span style={{ color: remaining > 0 ? "#fa8c16" : "#52c41a" }}>
                        待收：{formatMoney(remaining)}
                      </span>
                      <StatusBadge status={billing.status} />
                    </Space>
                    <PermissionGate permission="billing:write">
                      <Button size="small" type="link" onClick={() => openAddPayment(billing)}>
                        登记收款
                      </Button>
                    </PermissionGate>
                  </div>
                  {payments.length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 16 }}>
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={payments}
                        rowKey="id"
                        columns={paymentColumns}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="work-band">
          <Typography.Title level={4}>案件时间线</Typography.Title>
          <TimelineItem title="案件受理" time={selectedCase.acceptedAt}>
            客户 {selectedCase.client?.name} 建立委托关系。
          </TimelineItem>
          <TimelineItem title="最近更新" time={selectedCase.updatedAt}>
            当前状态：<StatusBadge status={selectedCase.status} />
          </TimelineItem>
          {selectedCase.closedAt ? <TimelineItem title="结案" time={selectedCase.closedAt} /> : null}
        </aside>
      </div>

      <Modal
        title={activeBilling ? `登记收款 - ${activeBilling.billNo}` : "登记收款"}
        open={paymentModalOpen}
        onCancel={() => {
          setPaymentModalOpen(false);
          setActiveBilling(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAddPayment}>
          <Form.Item
            label="收款金额"
            name="amount"
            rules={[{ required: true, message: "请输入收款金额" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0.01}
              max={activeBilling ? Number(activeBilling.amount) - totalReceived(activeBilling) : undefined}
              step={0.01}
              precision={2}
              prefix="¥"
              placeholder="请输入收款金额"
            />
          </Form.Item>
          <Form.Item
            label="到账时间"
            name="receivedAt"
            rules={[{ required: true, message: "请选择到账时间" }]}
          >
            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} placeholder="可选：填写收款备注信息" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => setPaymentModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确认登记
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}

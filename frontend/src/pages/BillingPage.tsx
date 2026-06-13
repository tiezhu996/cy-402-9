import { Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo } from "react";
import { AmountSummary } from "../components/common/AmountSummary";
import { BillingCard } from "../components/common/BillingCard";
import { StatusBadge } from "../components/common/StatusBadge";
import { useBillingStore } from "../stores/billing";
import { useCaseStore } from "../stores/case";
import { useClientStore } from "../stores/client";
import type { Billing, PaymentRecord } from "../types";
import { BillingStatusLabels, BillingTypeLabels } from "../types/enums";
import { formatDate, formatMoney } from "../utils/format";

function totalReceived(billing: Billing): number {
  return (billing.paymentRecords ?? []).reduce((sum, pr) => sum + Number(pr.amount), 0);
}

export function BillingPage() {
  const { billings, summary, loading, fetchBillings, fetchSummary } = useBillingStore();
  const { cases, fetchCases } = useCaseStore();
  const { clients, fetchClients } = useClientStore();

  useEffect(() => {
    void fetchBillings();
    void fetchSummary();
    void fetchCases();
    void fetchClients();
  }, [fetchBillings, fetchSummary, fetchCases, fetchClients]);

  const expandedRowRender = (record: Billing) => {
    const payments = record.paymentRecords ?? [];
    if (payments.length === 0) {
      return <div style={{ padding: "8px 24px", color: "#999" }}>暂无收款记录</div>;
    }
    return (
      <div style={{ padding: "8px 24px" }}>
        <Typography.Text type="secondary" style={{ marginBottom: 8, display: "block" }}>
          收款明细（共 {payments.length} 笔）
        </Typography.Text>
        <Table
          size="small"
          pagination={false}
          dataSource={payments}
          rowKey="id"
          columns={[
            { title: "到账时间", dataIndex: "receivedAt", render: formatDate, width: 140 },
            { title: "收款金额", dataIndex: "amount", render: formatMoney, width: 160 },
            { title: "备注", dataIndex: "note", render: (value) => value || "-" }
          ] as ColumnsType<PaymentRecord>}
        />
      </div>
    );
  };

  const columns: ColumnsType<Billing> = useMemo(
    () => [
      { title: "账单编号", dataIndex: "billNo" },
      { title: "费用类型", dataIndex: "type", render: (value) => BillingTypeLabels[value as Billing["type"]] },
      {
        title: "账单金额",
        dataIndex: "amount",
        render: formatMoney,
        sorter: (a, b) => Number(a.amount) - Number(b.amount)
      },
      {
        title: "已收金额",
        render: (_, record) => formatMoney(totalReceived(record)),
        sorter: (a, b) => totalReceived(a) - totalReceived(b)
      },
      {
        title: "待收金额",
        render: (_, record) => formatMoney(Math.max(Number(record.amount) - totalReceived(record), 0)),
        sorter: (a, b) =>
          Math.max(Number(a.amount) - totalReceived(a), 0) - Math.max(Number(b.amount) - totalReceived(b), 0)
      },
      { title: "状态", dataIndex: "status", render: (value) => <StatusBadge status={value} /> },
      { title: "案件", dataIndex: ["case", "title"] },
      { title: "客户", dataIndex: ["client", "name"] },
      { title: "创建日期", dataIndex: "createdAt", render: formatDate }
    ],
    []
  );

  return (
    <main className="page-shell">
      <h1 className="page-title">费用中心</h1>
      <div className="page-subtitle">按案件、客户、状态筛选账单，并查看本月收款统计。</div>
      <div style={{ marginTop: 18 }}>
        <AmountSummary {...summary} />
      </div>
      <div className="toolbar-band" style={{ marginTop: 18 }}>
        <Space wrap>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="按案件筛选"
            style={{ width: 240 }}
            options={cases.map((item) => ({ value: item.id, label: item.title }))}
            onChange={(caseId) => void fetchBillings({ caseId })}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="按客户筛选"
            style={{ width: 200 }}
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
            onChange={(clientId) => void fetchBillings({ clientId })}
          />
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: 160 }}
            options={Object.entries(BillingStatusLabels).map(([value, label]) => ({ value, label }))}
            onChange={(status) => void fetchBillings({ status })}
          />
        </Space>
      </div>
      <div className="work-grid" style={{ marginTop: 18 }}>
        <section className="work-band">
          <Table
            rowKey="id"
            loading={loading}
            dataSource={billings}
            columns={columns}
            expandable={{ expandedRowRender }}
          />
        </section>
        <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
          {billings.slice(0, 3).map((billing) => (
            <BillingCard billing={billing} key={billing.id} />
          ))}
        </aside>
      </div>
    </main>
  );
}

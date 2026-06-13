import { Progress, Typography } from "antd";
import type { Billing } from "../../types";
import { BillingTypeLabels } from "../../types/enums";
import { formatDate, formatMoney } from "../../utils/format";
import { StatusBadge } from "./StatusBadge";

function totalReceived(billing: Billing): number {
  return (billing.paymentRecords ?? []).reduce((sum, pr) => sum + Number(pr.amount), 0);
}

export function BillingCard({ billing }: { billing: Billing }) {
  const received = totalReceived(billing);
  const amount = Number(billing.amount);
  const percent = amount > 0 ? Math.min(Math.round((received / amount) * 100), 100) : 0;

  return (
    <article className="billing-card">
      <div className="card-kicker">{billing.billNo}</div>
      <Typography.Title level={5} style={{ marginTop: 6, marginBottom: 6 }}>
        {formatMoney(billing.amount)}
      </Typography.Title>
      <div className="meta-row">
        <StatusBadge status={billing.status} />
        <span>{BillingTypeLabels[billing.type]}</span>
        <span>{billing.client?.name}</span>
        <span>{formatDate(billing.createdAt)}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <Progress
          percent={percent}
          size="small"
          status={percent >= 100 ? "success" : "active"}
          format={() => `已收 ${formatMoney(received)}`}
        />
      </div>
    </article>
  );
}

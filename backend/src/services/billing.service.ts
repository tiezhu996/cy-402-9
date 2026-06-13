import type { BillingStatus, BillingType, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

const billingWithPaymentsInclude = {
  case: { select: { id: true, caseNo: true, title: true } },
  client: { select: { id: true, name: true } },
  paymentRecords: { orderBy: { receivedAt: "desc" } }
} as const;

export async function listBillings(filters: { caseId?: string; clientId?: string; status?: BillingStatus }) {
  return prisma.billing.findMany({
    where: {
      caseId: filters.caseId,
      clientId: filters.clientId,
      status: filters.status
    },
    include: billingWithPaymentsInclude,
    orderBy: { createdAt: "desc" }
  });
}

export async function createBilling(input: {
  billNo: string;
  type: BillingType;
  amount: string;
  status?: BillingStatus;
  caseId: string;
  clientId: string;
  invoiceInfo?: Prisma.InputJsonValue;
}) {
  return prisma.billing.create({
    data: input,
    include: billingWithPaymentsInclude
  });
}

export async function updateBillingStatus(id: string, status: BillingStatus) {
  return prisma.billing.update({
    where: { id },
    data: { status },
    include: billingWithPaymentsInclude
  });
}

export async function billingSummary() {
  const current = new Date();
  const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  const rows = await prisma.billing.findMany({
    where: { createdAt: { gte: monthStart }, status: { not: "voided" } },
    include: { paymentRecords: { select: { amount: true } } }
  });

  return rows.reduce(
    (acc, row) => {
      const amount = Number(row.amount);
      const received = row.paymentRecords.reduce((sum, pr) => sum + Number(pr.amount), 0);
      acc.receivable += amount;
      acc.received += received;
      acc.pending += Math.max(amount - received, 0);
      return acc;
    },
    { receivable: 0, received: 0, pending: 0 }
  );
}

export async function listPaymentRecords(billingId: string) {
  return prisma.paymentRecord.findMany({
    where: { billingId },
    orderBy: { receivedAt: "desc" }
  });
}

export async function createPaymentRecord(input: {
  billingId: string;
  amount: string;
  receivedAt: Date | string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const billing = await tx.billing.findUniqueOrThrow({
      where: { id: input.billingId },
      include: { paymentRecords: { select: { amount: true } } }
    });

    await tx.paymentRecord.create({
      data: {
        billingId: input.billingId,
        amount: input.amount,
        receivedAt: new Date(input.receivedAt),
        note: input.note
      }
    });

    const totalReceived =
      billing.paymentRecords.reduce((sum, pr) => sum + Number(pr.amount), 0) + Number(input.amount);
    const billingAmount = Number(billing.amount);

    let newStatus = billing.status;
    if (totalReceived >= billingAmount && billing.status !== "voided") {
      newStatus = "paid";
    } else if (totalReceived > 0 && billing.status === "pending") {
      newStatus = "invoiced";
    }

    await tx.billing.update({
      where: { id: input.billingId },
      data: { status: newStatus }
    });

    return tx.billing.findUniqueOrThrow({
      where: { id: input.billingId },
      include: billingWithPaymentsInclude
    });
  });
}

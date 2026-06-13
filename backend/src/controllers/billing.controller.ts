import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import * as billingService from "../services/billing.service";

const billingTypeSchema = z.enum(["attorney_fee", "court_fee", "travel_fee", "other"]);
const billingStatusSchema = z.enum(["pending", "paid", "invoiced", "voided"]);

const createBillingSchema = z.object({
  billNo: z.string().min(3),
  type: billingTypeSchema,
  amount: z.union([z.string(), z.number()]).transform(String),
  status: billingStatusSchema.optional(),
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  invoiceInfo: z.record(z.unknown()).optional()
});

const statusSchema = z.object({
  status: billingStatusSchema
});

const createPaymentRecordSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(String),
  receivedAt: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : v)),
  note: z.string().optional()
});

export async function list(req: Request, res: Response) {
  const data = await billingService.listBillings({
    caseId: typeof req.query.caseId === "string" ? req.query.caseId : undefined,
    clientId: typeof req.query.clientId === "string" ? req.query.clientId : undefined,
    status: typeof req.query.status === "string" ? billingStatusSchema.parse(req.query.status) : undefined
  });
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const input = createBillingSchema.parse(req.body);
  const data = await billingService.createBilling({
    ...input,
    invoiceInfo: input.invoiceInfo as Prisma.InputJsonValue | undefined
  });
  res.status(201).json({ data });
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = statusSchema.parse(req.body);
  const data = await billingService.updateBillingStatus(req.params.id, status);
  res.json({ data });
}

export async function summary(req: Request, res: Response) {
  const data = await billingService.billingSummary();
  res.json({ data });
}

export async function listPayments(req: Request, res: Response) {
  const data = await billingService.listPaymentRecords(req.params.id);
  res.json({ data });
}

export async function createPayment(req: Request, res: Response) {
  const input = createPaymentRecordSchema.parse(req.body);
  const data = await billingService.createPaymentRecord({
    ...input,
    billingId: req.params.id
  });
  res.status(201).json({ data });
}

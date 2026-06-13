import { create } from "zustand";
import * as billingApi from "../api/billing";
import type { BillingQuery, CreatePaymentPayload } from "../api/billing";
import type { Billing, BillingSummary } from "../types";

type BillingState = {
  billings: Billing[];
  summary: BillingSummary;
  loading: boolean;
  fetchBillings: (params?: BillingQuery) => Promise<void>;
  fetchSummary: () => Promise<void>;
  addPaymentRecord: (billingId: string, payload: CreatePaymentPayload) => Promise<Billing>;
};

export const useBillingStore = create<BillingState>((set, get) => ({
  billings: [],
  summary: { receivable: 0, received: 0, pending: 0 },
  loading: false,
  async fetchBillings(params) {
    set({ loading: true });
    try {
      set({ billings: await billingApi.listBillings(params) });
    } finally {
      set({ loading: false });
    }
  },
  async fetchSummary() {
    set({ summary: await billingApi.getBillingSummary() });
  },
  async addPaymentRecord(billingId, payload) {
    const updated = await billingApi.createPaymentRecord(billingId, payload);
    set({
      billings: get().billings.map((b) => (b.id === billingId ? updated : b))
    });
    void get().fetchSummary();
    return updated;
  }
}));

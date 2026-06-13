import { create } from "zustand";
import * as caseApi from "../api/case";
import type { CaseQuery } from "../api/case";
import * as billingApi from "../api/billing";
import type { CreatePaymentPayload } from "../api/billing";
import type { Billing, CaseRecord } from "../types";

type CaseState = {
  cases: CaseRecord[];
  selectedCase: CaseRecord | null;
  loading: boolean;
  fetchCases: (params?: CaseQuery) => Promise<void>;
  fetchCase: (id: string) => Promise<void>;
  addPaymentRecord: (billingId: string, payload: CreatePaymentPayload) => Promise<Billing>;
};

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  selectedCase: null,
  loading: false,
  async fetchCases(params) {
    set({ loading: true });
    try {
      set({ cases: await caseApi.listCases(params) });
    } finally {
      set({ loading: false });
    }
  },
  async fetchCase(id) {
    set({ selectedCase: await caseApi.getCase(id) });
  },
  async addPaymentRecord(billingId, payload) {
    const updated = await billingApi.createPaymentRecord(billingId, payload);
    const selected = get().selectedCase;
    if (selected) {
      set({
        selectedCase: {
          ...selected,
          billings: (selected.billings ?? []).map((b) => (b.id === billingId ? updated : b))
        }
      });
    }
    return updated;
  }
}));

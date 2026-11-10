import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadUserData, resetStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

describe("Personal finance loading", () => {
  beforeEach(() => { resetStore(); mocks.from.mockReset(); });

  it("restricts every personal list to the signed-in owner", async () => {
    const owner = "0b09ff40-78bb-4078-81cb-f67df8f79c6f";
    const filters: unknown[][] = [];
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({ eq: (...args: unknown[]) => {
        filters.push([table, ...args]);
        return { order: async () => ({ error: null, data: table === "categories" ? [{ id: "category", name: "Salário", icon: "💰", color: "" }] : [] }) };
      } }),
    }));
    await loadUserData(owner);
    expect(filters).toEqual([
      ["categories", "user_id", owner],
      ["banks", "user_id", owner],
      ["cards", "user_id", owner],
      ["transactions", "user_id", owner],
    ]);
  });

  it("reports failure when default categories cannot be persisted", async () => {
    const failure = new Error("write rejected");
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      insert: async () => ({ error: failure }),
    }));
    await expect(loadUserData("owner")).rejects.toThrow("write rejected");
  });
});
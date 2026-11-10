import { describe, expect, it } from "vitest";
import { BANK_CATALOG, getBankLogo } from "@/lib/bank-catalog";

describe("Bank logo catalog", () => {
  it("uses the pinned public SVG repository for supported banks", () => {
    const logo = getBankLogo("Banco do Brasil");

    expect(logo).toContain("Tgentil/Bancos-em-SVG@fe1d43f0cf379135bd01c987bc147a04fdf48c6d");
    expect(logo).toContain("banco-do-brasil-sem-fundo.svg");
  });

  it("matches bank names without case sensitivity and leaves unknown names to fallback", () => {
    expect(getBankLogo("NUBANK")).toBe(getBankLogo("Nubank"));
    expect(getBankLogo("Banco personalizado")).toBeUndefined();
  });

  it("keeps all displayed catalog names unique", () => {
    const names = BANK_CATALOG.map((bank) => bank.name.toLocaleLowerCase());

    expect(new Set(names).size).toBe(names.length);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { applyThemePreference, getThemePreference } from "@/lib/theme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
});

describe("Theme preference", () => {
  it("uses dark mode by default and persists the light preference", () => {
    expect(getThemePreference()).toBe("dark");
    applyThemePreference("light");
    expect(getThemePreference()).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("switches the root class back to dark", () => {
    applyThemePreference("light");
    applyThemePreference("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});

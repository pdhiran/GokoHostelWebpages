import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { civilWeekday, inclusiveNights } from "@/lib/inventoryAvailability";

// Execute the actual shared selector without mounting the authenticated admin page.
const source = readFileSync("src/components/admin/InventoryRatePlan.tsx", "utf8");
const selectorSource = source.slice(source.indexOf("  const toggleDay ="), source.indexOf("  const handleBlockBeds ="));
const compiled = ts.transpileModule(`${selectorSource}\nDaySelector;`, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
}).outputText;
type Button = React.ReactElement<{ children: string; "aria-pressed": boolean; className: string; onClick: () => void }>;
const selector = runInNewContext(compiled, { React, cn }) as (props: { days: number[]; setDays: (days: number[]) => void }) => React.ReactElement<{ children: React.ReactNode }>;

function render(initial: number[]) {
  let days = initial;
  const buttons = () => React.Children.toArray(selector({ days, setDays: (next) => { days = next; } }).props.children) as Button[];
  return {
    click: (label: string) => buttons().find((button) => button.props.children === label)!.props.onClick(),
    selectedPresets: () => buttons().filter((button) => ["All", "Weekdays", "Weekends"].includes(button.props.children) && button.props["aria-pressed"]),
    days: () => days,
  };
}

describe("bulk update day presets", () => {
  it.each([
    ["Weekends", [5, 6], ["2026-09-04", "2026-09-05"]],
    ["Weekdays", [0, 1, 2, 3, 4], ["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]],
    ["All", [0, 1, 2, 3, 4, 5, 6], inclusiveNights("2026-09-04", "2026-09-10")],
  ])("%s selects the correct dates and highlights only that preset blue", (label, expectedDays, expectedDates) => {
    const ui = render([]);
    ui.click(label as string);
    expect(ui.days()).toEqual(expectedDays);
    expect(inclusiveNights("2026-09-04", "2026-09-10").filter((date) => ui.days().includes(civilWeekday(date)))).toEqual(expectedDates);
    expect(ui.selectedPresets().map((button) => button.props.children)).toEqual([label]);
    expect(ui.selectedPresets()[0].props.className).toContain("bg-blue-600");
  });

  it("highlights All initially and follows manual changes, regardless of day order", () => {
    const ui = render([0, 1, 2, 3, 4, 5, 6]);
    expect(ui.selectedPresets().map((button) => button.props.children)).toEqual(["All"]);
    ui.click("Weekends");
    ui.click("Sun");
    expect(ui.selectedPresets()).toHaveLength(0);
    ui.click("Sun");
    ui.click("Fri");
    ui.click("Fri");
    expect(ui.days()).toEqual([6, 5]);
    expect(ui.selectedPresets().map((button) => button.props.children)).toEqual(["Weekends"]);
    expect(render([]).selectedPresets()).toHaveLength(0);
  });

  it("wires the shared selector and submitted day filter into all three tabs", () => {
    for (const prefix of ["rate", "adjust", "restrict"]) {
      expect(source).toContain(`<DaySelector days={${prefix}Days}`);
      expect(source).toContain(`dayFilter: ${prefix}Days`);
    }
  });
});

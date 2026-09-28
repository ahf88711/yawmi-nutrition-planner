import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  nutrition,
  total,
  roundQuantity,
  generatePlan,
  validateTarget,
  quantityLabel,
  keys,
} from "../dist/planner.js";
import { displayNumber, displayDifference } from "../dist/format.js";
const foods = JSON.parse(
  fs.readFileSync(new URL("../dist/data/foods.json", import.meta.url)),
);
const by = Object.fromEntries(foods.map((f) => [f.id, f]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("100g, below and above: independently verified rice arithmetic", () => {
  assert.deepEqual(nutrition(by.rice, 100), {
    calories: 130,
    protein: 2.69,
    carbs: 28.17,
  });
  for (const q of [50, 175]) {
    const n = nutrition(by.rice, q);
    close(n.calories, (130 * q) / 100);
    close(n.protein, (2.69 * q) / 100);
    close(n.carbs, (28.17 * q) / 100);
  }
});
test("fixed servings remain exact: tuna, yogurt, Greek yogurt and whole Nada bottle", () => {
  close(nutrition(by.tuna, 1).calories, 77.4);
  close(nutrition(by.yogurt, 1).calories, 98);
  close(nutrition(by.greek, 1).calories, 94.4);
  const n = nutrition(by.nada, 1);
  close(n.calories, 224.4);
  close(n.protein, 30.03);
  close(n.carbs, 14.85);
});
test("whole eggs, fried recipe with explicit oil, toast slices and milliliters", () => {
  close(nutrition(by.egg, 2).calories, 155);
  close(nutrition(by.egg, 2).protein, 12.58);
  close(nutrition(by.fried, 2).calories, 231.4);
  assert.match(quantityLabel(by.fried, 1), /زيت/);
  close(nutrition(by.toast, 2).calories, 153);
  close(nutrition(by.milk, 250).calories, 108.75);
  close(nutrition(by.laban, 250).calories, 156);
});
test("practical quantity rounding", () => {
  assert.equal(roundQuantity(173.82, 5), 175);
  assert.equal(roundQuantity(253, 10), 250);
  assert.equal(roundQuantity(1.6, 1), 2);
});
test("totals use full precision, not rounded displayed rows", () => {
  const rows = [
    { food: by.rice, quantity: 175 },
    { food: by.chicken, quantity: 175 },
    { food: by.oil, quantity: 7 },
  ];
  const n = total(rows);
  close(n.calories, 130 * 1.75 + 165 * 1.75 + 884 * 0.07);
  close(n.protein, 2.69 * 1.75 + 31.02 * 1.75);
});
test("each verified USDA entry matches independent official CSV extract", () => {
  const audit = JSON.parse(
    fs.readFileSync(new URL("./usda-extract.json", import.meta.url)),
  );
  for (const f of foods.filter((f) => f.source_name.startsWith("USDA"))) {
    const id = f.source_reference.match(/FDC (\d+)/)[1];
    for (const k of keys) assert.equal(f[k], audit[id][k]);
  }
});
test("all approved foods have provenance, preparation and local thumbnails; unverified excluded", () => {
  assert.equal(foods.length, 34);
  assert.equal(new Set(foods.map((f) => f.id)).size, 34);
  for (const f of foods) {
    for (const field of [
      "name_ar",
      "name_en",
      "preparation",
      "basis_amount",
      "source_name",
      "source_reference",
      "source_url",
      "verified_date",
      "image_reference",
    ])
      assert.ok(f[field]);
    assert.ok(fs.existsSync(new URL("../dist/" + f.image, import.meta.url)));
    if (f.available) keys.forEach((k) => assert.ok(Number.isFinite(f[k])));
  }
  assert.throws(() => nutrition(by.bream, 100));
});
for (const [calories, protein, carbs] of [
  [1800, 150, 170],
  [2000, 140, 230],
  [2400, 180, 260],
  [1500, 100, 150],
  [2800, 180, 320],
  [1200, 90, 120],
])
  test(`optimization ${calories}/${protein}/${carbs} and independent meal/day recalculation`, () => {
    const target = { calories, protein, carbs },
      p = generatePlan(foods, target);
    assert.ok(p.within);
    assert.ok(p.meals.length >= 3 && p.meals.length <= 4);
    const independent = { calories: 0, protein: 0, carbs: 0 };
    for (const m of p.meals) {
      const subtotal = { calories: 0, protein: 0, carbs: 0 };
      for (const r of m.rows) {
        assert.ok(by[r.food.id].available);
        assert.ok(Number.isInteger(r.quantity / r.food.step));
        assert.ok(r.quantity > 0);
        keys.forEach(
          (k) =>
            (subtotal[k] +=
              (r.food[k] * r.quantity * r.food.unit_amount) /
              r.food.basis_amount),
        );
        if (["serving", "bottle"].includes(r.food.unit))
          assert.equal(r.quantity, 1);
        if (
          ["chicken", "beef", "lamb", "grouper", "salmon", "thigh"].includes(
            r.food.id,
          )
        )
          assert.ok(r.quantity <= 230);
      }
      keys.forEach((k) => {
        close(subtotal[k], m.totals[k]);
        independent[k] += subtotal[k];
      });
    }
    keys.forEach((k) => {
      close(independent[k], p.totals[k]);
      close(p.differences[k], independent[k] - target[k]);
    });
    assert.deepEqual(p, generatePlan(foods, target));
  });
test("inconsistent and extreme targets produce honest finite bounded results", () => {
  for (const target of [
    { calories: 600, protein: 200, carbs: 200 },
    { calories: 1, protein: 0, carbs: 0 },
    { calories: 10000, protein: 1000, carbs: 2000 },
  ]) {
    const p = generatePlan(foods, target);
    assert.equal(p.within, false);
    keys.forEach((k) => {
      assert.ok(Number.isFinite(p.totals[k]));
      close(p.differences[k], p.totals[k] - target[k]);
    });
  }
});
test("malformed input rejected", () => {
  for (const t of [
    null,
    {},
    { calories: 0, protein: 2, carbs: 3 },
    { calories: NaN, protein: 2, carbs: 3 },
    { calories: 1800, protein: -1, carbs: 100 },
    { calories: "1800", protein: 100, carbs: 100 },
  ])
    assert.throws(() => validateTarget(t));
});
test("display precision never pretends tiny differences are exactly zero", () => {
  assert.equal(displayNumber(149.9823, "protein"), "150");
  assert.equal(displayDifference(0.07, "calories"), "+<0.5");
  assert.equal(displayDifference(-0.017, "protein"), "−<0.1");
});
test("user-selected 2–6 meal counts are exact, coherent and honestly recalculated", () => {
  for (const mealCount of [2, 3, 4, 5, 6])
    for (const calories of [1200, 1800, 2400]) {
      const p = generatePlan(foods, {
        calories,
        protein: 150,
        carbs: 170,
        mealCount,
      });
      assert.equal(p.meals.length, mealCount);
      assert.equal(p.target.mealCount, mealCount);
      const all = p.meals.flatMap((m) => m.rows);
      keys.forEach((k) => close(total(all)[k], p.totals[k]));
      for (const m of p.meals) {
        const ids = m.rows.map((r) => r.food.id);
        assert.ok(ids.length >= 3);
        if (
          ids.some((id) =>
            [
              "chicken",
              "salmon",
              "grouper",
              "beef",
              "lamb",
              "thigh",
              "tuna",
            ].includes(id),
          )
        ) {
          assert.ok(
            !ids.some((id) =>
              [
                "banana",
                "dates",
                "cashews",
                "pistachios",
                "milk",
                "greek",
                "nada",
                "yogurt",
              ].includes(id),
            ),
          );
        }
        if (ids.includes("oats"))
          assert.ok(ids.includes("milk") && ids.includes("banana"));
        for (const r of m.rows) {
          assert.equal(r.quantity % r.food.step, 0);
          if (r.food.id === "banana") assert.ok(r.quantity >= 60);
        }
      }
    }
});
test("invalid meal counts rejected and omitted meal count defaults to three", () => {
  for (const mealCount of [0, 1, 7, 3.5, "4", null, NaN])
    assert.throws(() =>
      generatePlan(foods, {
        calories: 1800,
        protein: 150,
        carbs: 170,
        mealCount,
      }),
    );
  assert.equal(
    generatePlan(foods, { calories: 1800, protein: 150, carbs: 170 }).meals
      .length,
    3,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Worker } from "node:worker_threads";
import {
  generatePlan,
  validateFoods,
  nutrition,
  validateTarget,
} from "../dist/planner.js";
import { createFoodLoader } from "../dist/food-loader.js";
import { calculatePlan } from "../dist/planner-client.js";
const foods = JSON.parse(
  fs.readFileSync(new URL("../dist/data/foods.json", import.meta.url)),
);
const target = { calories: 1800, protein: 150, carbs: 170, mealCount: 4 };
test("reject empty, malformed, duplicate and non-finite catalogs instead of partial plans", () => {
  for (const catalog of [
    [],
    null,
    {},
    [foods[0], foods[0]],
    [{ ...foods[0], basis_amount: 0 }],
    [{ ...foods[0], protein: NaN }],
    [{ ...foods[0], unit_amount: 0 }],
  ])
    assert.throws(() => validateFoods(catalog));
  assert.throws(() => generatePlan([], target));
  assert.throws(() =>
    generatePlan(
      foods.map((f) => ({ ...f, available: false })),
      target,
    ),
  );
  assert.throws(() => nutrition({ ...foods[0], basis_amount: 0 }, 100));
  assert.throws(() => validateTarget({ ...target, calories: 0.5 }));
});
test("unavailable ingredients exclude whole combinations, preserving meal counts", () => {
  const restricted = foods.map((f) =>
    f.id === "egg" ? { ...f, available: false } : f,
  );
  const p = generatePlan(restricted, target);
  assert.equal(p.meals.length, 4);
  assert.ok(p.meals.every((m) => m.rows.length >= 3));
  assert.ok(!p.meals.flatMap((m) => m.rows).some((r) => r.food.id === "egg"));
});
test("loader shares concurrent requests and caches valid data", async () => {
  let calls = 0;
  const load = createFoodLoader(async () => {
    calls++;
    return { ok: true, json: async () => foods };
  });
  const a = load(),
    b = load();
  assert.equal(a, b);
  assert.equal(await a, foods);
  assert.equal(await load(), foods);
  assert.equal(calls, 1);
});
for (const failure of ["network", "http", "json", "catalog"])
  test(`loader recovers after ${failure} failure`, async () => {
    let calls = 0;
    const load = createFoodLoader(async () => {
      calls++;
      if (calls === 1) {
        if (failure === "network") throw Error("offline");
        if (failure === "http") return { ok: false };
        if (failure === "json")
          return {
            ok: true,
            json: async () => {
              throw SyntaxError("bad JSON");
            },
          };
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => foods };
    });
    await assert.rejects(load());
    assert.equal(await load(), foods);
    assert.equal(calls, 2);
  });
test("no-Worker fallback preserves deterministic results", async () => {
  assert.deepEqual(
    await calculatePlan(foods, target),
    generatePlan(foods, target),
  );
});
test("worker uses the same optimizer and returns validation errors without hanging", async () => {
  const url = new URL("../dist/planner-worker.js", import.meta.url).href;
  const worker = new Worker(
    new URL(
      "data:text/javascript," +
        encodeURIComponent(
          `import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));`,
        ),
    ),
  );
  const run = (data) =>
    new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.postMessage(data);
    });
  try {
    const result = await run({ foods, target });
    assert.deepEqual(result.plan, generatePlan(foods, target));
    const bad = await run({ foods: [], target });
    assert.ok(bad.error);
    assert.equal(bad.plan, undefined);
  } finally {
    await worker.terminate();
  }
});

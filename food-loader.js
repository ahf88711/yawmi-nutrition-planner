import { validateFoods } from "./planner.js?v=review1";

// Share concurrent requests, cache successful data, and allow the next attempt
// to recover after an HTTP, JSON or validation failure.
export function createFoodLoader(fetcher = globalThis.fetch) {
  let pending;
  return function loadFoods() {
    if (!pending) {
      pending = Promise.resolve()
        .then(() => fetcher("./data/foods.json"))
        .then((response) => {
          if (!response.ok)
            throw new Error("تعذر تحميل بيانات الأغذية. أعد المحاولة.");
          return response.json();
        })
        .then(validateFoods)
        .catch(() => {
          pending = undefined;
          throw new Error(
            "تعذر تحميل بيانات الأغذية أو التحقق منها. أعد المحاولة.",
          );
        });
    }
    return pending;
  };
}

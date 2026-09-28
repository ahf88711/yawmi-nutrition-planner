import { generatePlan } from "./planner.js?v=review1";

export function calculatePlan(foods, target) {
  // Older environments still calculate locally, after giving the UI a turn.
  if (typeof Worker === "undefined")
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(generatePlan(foods, target));
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./planner-worker.js?v=review1", import.meta.url), {
      type: "module",
    });
    const finish = (error, plan) => {
      clearTimeout(timeout);
      worker.terminate();
      if (error) reject(error);
      else resolve(plan);
    };
    const timeout = setTimeout(
      () =>
        finish(new Error("استغرق الحساب وقتًا أطول من المتوقع. أعد المحاولة.")),
      15000,
    );
    worker.onmessage = ({ data }) =>
      data.error ? finish(new Error(data.error)) : finish(null, data.plan);
    worker.onerror = () =>
      finish(new Error("تعذر تشغيل الحساب. أعد تحميل الصفحة وحاول مجددًا."));
    worker.onmessageerror = () =>
      finish(new Error("تعذر قراءة نتيجة الحساب. أعد المحاولة."));
    try {
      worker.postMessage({ foods, target });
    } catch (error) {
      finish(error);
    }
  });
}

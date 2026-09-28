import { nutrition, quantityLabel, keys, validateTarget } from "./planner.js?v=review1";
import { createFoodLoader } from "./food-loader.js?v=review1";
import { calculatePlan } from "./planner-client.js?v=review1";
import { displayNumber as fmt, displayDifference as diff } from "./format.js?v=review1";
const $ = (s) => document.querySelector(s),
  labels = { calories: "السعرات", protein: "البروتين", carbs: "الكربوهيدرات" },
  units = { calories: "سعرة", protein: "جم", carbs: "جم" };
const loadFoods = createFoodLoader();
let displayedFoods;
async function ensureFoods() {
  const foods = await loadFoods();
  if (displayedFoods !== foods) {
    renderSources(foods);
    displayedFoods = foods;
  }
  return foods;
}
const metric = (n) =>
  keys
    .map(
      (k) =>
        `<span><b dir="ltr">${fmt(n[k], k)}</b> ${k === "calories" ? "سعرة" : `جم ${labels[k]}`}</span>`,
    )
    .join("");
function render(p) {
  $("#results").innerHTML =
    `<div class="result-heading"><div><div class="eyebrow">كميات محسوبة لهدفك</div><h1 tabindex="-1" id="result-title">برنامجك الغذائي.</h1></div><button id="edit" class="text-button">تعديل الهدف</button></div>
 <div class="summary-grid">${keys.map((k) => `<div><span>${labels[k]}</span><strong data-total="${k}" dir="ltr">${fmt(p.totals[k], k)}</strong><small>${units[k]} <span class="target-inline">/ ${fmt(p.target[k], k)}</span></small></div>`).join("")}</div>
 <p class="status ${p.within ? "" : "outside"}">${p.within ? "ضمن هامش المطابقة: ±٣٪ للسعرات و±٥ جم للبروتين والكربوهيدرات." : "لم نجد خطة عملية تحقق هذه الأهداف معًا. هذه أقرب نتيجة وجدناها؛ راجع الفروق أدناه."}</p>
 <p class="weight-note">الأوزان للجزء المأكول. حالة كل طعام موضحة أدناه. عدد الوجبات: ${p.meals.length}.</p>
 ${p.meals
   .map(
     (m, i) =>
       `<article class="meal"><div class="meal-heading"><h2>${m.name}</h2><span dir="ltr">0${i + 1}</span></div>${m.rows
         .map((r) => {
           const n = nutrition(r.food, r.quantity);
           return `<div class="food-row" data-food="${r.food.id}" data-quantity="${r.quantity}"><img src="${r.food.image}" alt="${r.food.name_ar}" width="64" height="64" loading="lazy"><div class="food-content"><h3>${r.food.name_ar}</h3><div class="quantity">${quantityLabel(r.food, r.quantity)}</div><div class="food-macros">${metric(n)}</div><details class="preparation"><summary>حالة الطعام</summary>${r.food.preparation}</details></div></div>`;
         })
         .join(
           "",
         )}<div class="meal-total"><span>إجمالي الوجبة</span><div>${metric(m.totals)}</div></div></article>`,
   )
   .join("")}
 <section class="daily-total"><div class="eyebrow">كل الكميات محسوبة بعد التقريب</div><h2>إجمالي اليوم</h2><div class="daily-head"><span>العنصر</span><span>المحقق / الهدف</span><span>الفرق</span></div>${keys.map((k) => `<div class="daily-line"><span>${labels[k]}<small>${units[k]}</small></span><span dir="ltr"><b>${fmt(p.totals[k], k)}</b> / ${fmt(p.target[k], k)}</span><strong class="difference" dir="ltr">${diff(p.differences[k], k)}</strong></div>`).join("")}<p>القيم المعروضة مقربة؛ يُحسب الإجمالي والفرق من القيم الكاملة.</p></section><button id="edit-bottom" class="secondary">تعديل الأهداف</button>`;
  $("#start").hidden = true;
  $("#results").hidden = false;
  const edit = () => {
    $("#start").hidden = false;
    $("#results").hidden = true;
    $("#calories").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  $("#edit").onclick = edit;
  $("#edit-bottom").onclick = edit;
  $("#result-title").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
let busy = false;
async function submit(target) {
  validateTarget(target);
  if (busy) throw new Error("جارٍ حساب الخطة الحالية. انتظر لحظة.");
  busy = true;
  const button = $(".primary"),
    label = button.innerHTML;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "جارٍ حساب برنامجك…";
  $("#error").hidden = true;
  try {
    const foods = await ensureFoods();
    const plan = await calculatePlan(foods, target);
    render(plan);
    return plan;
  } finally {
    busy = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.innerHTML = label;
  }
}
$("#targets").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submit({
      ...Object.fromEntries(keys.map((k) => [k, Number($("#" + k).value)])),
      mealCount: Number($("#mealCount").value),
    });
  } catch (error) {
    $("#error").textContent = error.message;
    $("#error").hidden = false;
  }
});
function renderSources(foods) {
  $("#source-content").innerHTML =
    `<p>آخر تحقق: ٢٨ سبتمبر ٢٠٢٦. ${foods.filter((f) => f.available).length} صنفًا موثقًا من القائمة المعتمدة. الدنيس مستبعد لحين توثيق قيمه.</p><p>الحساب: قيمة المصدر × الكمية ÷ أساس القياس. نبحث في تركيبات عملية، ثم نقرب الحصص ونعيد الحساب والتحسين. لا تُستخدم نماذج ذكاء اصطناعي في الحساب، ولا نضمن الحل الأمثل عالميًا.</p><p>الأرقام مرجعية؛ قد يختلف المنتج الفعلي. الصور توضيحية مولّدة وليست صور عبوات تجارية. التونة ٩٠ جم بعد التصفية، الزبادي ١٧٠ جم، واليوناني ١٦٠ جم. لا يضاف زيت إلا إذا ظهر في الخطة أو في وصف البيض المقلي.</p><p>رُوجع <a href="https://www.sfda.gov.sa/sites/default/files/2026-04/SFCT-E.pdf" target="_blank" rel="noopener">الجدول السعودي</a>؛ يركز على الأطباق المركبة. للأغذية المفردة استُخدمت بيانات USDA، وللمنتجات التجارية صفحات الشركات.</p>${foods.map((f) => `<details class="source-food"><summary>${f.name_ar}${f.available ? "" : " — غير متاح"}</summary><img src="${f.image}" alt="${f.name_ar}" width="48" height="48" loading="lazy"><p>${f.preparation}</p>${f.available ? `<p>لكل ${f.basis_amount} ${f.basis_unit}: ${f.calories} سعرة، ${f.protein.toFixed(2)} جم بروتين، ${f.carbs.toFixed(2)} جم كربوهيدرات.</p>` : `<p>${f.unavailable_reason}</p>`}<a href="${f.source_url}" target="_blank" rel="noopener">${f.source_name}</a><p dir="ltr">${f.source_reference}</p></details>`).join("")}`;
}
ensureFoods().catch(() => {
  $("#source-content").textContent =
    "تعذر تحميل المصادر. ستتم إعادة المحاولة عند إنشاء البرنامج.";
});
const context = document.modelContext;
if (context?.registerTool) {
  const life = new AbortController();
  try {
    Promise.resolve(
      context.registerTool(
        {
          name: "generate_daily_food_plan",
          title: "إنشاء يوم غذائي",
          description:
            "Generate and display a one-day plan from user-supplied calorie, protein and carbohydrate targets and an exact meal count (2–6; defaults to 3). Does not recommend targets or save personal data.",
          inputSchema: {
            type: "object",
            properties: {
              calories: { type: "number", minimum: 1, maximum: 10000 },
              protein: { type: "number", minimum: 0, maximum: 1000 },
              carbs: { type: "number", minimum: 0, maximum: 2000 },
              mealCount: {
                type: "integer",
                minimum: 2,
                maximum: 6,
                default: 3,
              },
            },
            required: keys,
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            validateTarget(input);
            if (
              Object.keys(input).some(
                (k) => ![...keys, "mealCount"].includes(k),
              )
            )
              throw new Error("Unexpected target field");
            const p = await submit(input);
            keys.forEach((k) => ($("#" + k).value = input[k]));
            $("#mealCount").value = p.target.mealCount;
            return {
              target: p.target,
              totals: p.totals,
              differences: p.differences,
              within: p.within,
              meals: p.meals.map((m) => ({
                name: m.name,
                foods: m.rows.map((r) => ({
                  name: r.food.name_ar,
                  quantity: quantityLabel(r.food, r.quantity),
                })),
              })),
            };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
  } catch {}
  window.addEventListener("pagehide", () => life.abort(), { once: true });
}

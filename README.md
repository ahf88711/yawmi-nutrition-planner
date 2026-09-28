# يومي · Yawmi

A small, mobile-first Arabic/RTL one-day food allocation calculator. Enter calorie, protein and total-carbohydrate targets. The app chooses food quantities and splits them into three main meals, with a fourth eating occasion when useful.

**Live:** https://yawmi-nutrition.ahf8871.chatgpt.site

No account, backend, runtime AI, analytics, target recommendation, or personal data storage. Nutrition calculations run entirely in the browser. Vanilla JavaScript modules and CSS; no production dependencies or build step.

## Run

Requires Python 3 for the local server and Node.js 20+ for tests. No installation is required.

```sh
python3 -m http.server 4173 --directory dist
# Open http://localhost:4173
node --test tests/*.test.js
```

The `dist/` directory is the authored application, not generated output. Edit these files directly:

- `dist/data/foods.json`: nutrition database and provenance.
- `dist/planner.js`: pure arithmetic, portion rules and deterministic optimizer.
- `dist/format.js`: display-only rounding and signed differences.
- `dist/ui.js`: form, results, source details and optional WebMCP tool.
- `dist/style.css`: mobile-first RTL styling.
- `tests/usda-extract.json`: independent extracted official USDA records for audit.

## Nutrition methodology

Verified **2026-09-28**. All **34** requested foods are catalogued; **33** have documented usable nutrition records. Sea bream is **unavailable** and excluded until a matching cooked record is verified. Generic food data are reference values, not laboratory measurements of the user's particular food or every brand.

Source priority:

1. Reviewed the SFDA **Saudi Food Composition Tables**, particularly the methodology and contents (pp. 5–9). This published table covers Saudi prepared dishes with recipes, rather than the exact single-food preparations used here. The searchable database timed out during review. No compound-dish values were substituted for plain rice, meat, etc.
2. Manufacturer nutrition panels for Almarai low-fat long-life milk, full-fat laban, low-fat zabadi and hummus; and Nada Drinking Greek Yoghurt Plain, the low-fat 330 ml bottle.
3. USDA FoodData Central SR Legacy official CSV release for generic foods. Each entry stores its FDC ID, exact English description, preparation, basis, units, source URL and verification date. The database import used nutrient IDs 1008 (kcal), 1003 (protein), 1005 (total carbohydrate).
4. UK Department of Health fish research was checked for sea bream. The identified cooked sea-bream sampling result concerned weight loss and was not treated as a matching nutrient record.

**Official sources:**

- [SFDA tables](https://www.sfda.gov.sa/sites/default/files/2026-04/SFCT-E.pdf)
- [USDA downloadable data](https://fdc.nal.usda.gov/download-datasets/)
- [USDA SR Legacy CSV](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip)
- [Almarai hummus](https://www.almarai.com/en/brands/almarai/dips/hummus/hummus): per 50 g, 109 kcal, 4 g protein, 7 g total carbohydrate.
- [Nada plain drinking Greek yoghurt](https://nada.com.sa/en/product/drinking-greek-yoghurt-plain/): per 100 ml, 68 kcal, 9.1 g protein, 4.5 g total carbohydrate. One complete 330 ml bottle = 224.4 kcal, 30.03 g protein and 14.85 g carbohydrate. Its 30 g front-label claim is rounded. The 0% fat variant is not used.
- [Almarai low-fat zabadi](https://www.almarai.com/en/brands/almarai/yoghurts/zabadi/low-fat-zabadi): per 170 g, 98 kcal, 8 g protein, 11 g carbohydrate.
- [Almarai low-fat long-life milk](https://www.almarai.com/en/brands/almarai/liquid-dairy/long-life-milk/long-life-milk-low-fat): per 200 ml, 87 kcal, 7 g protein, 10 g carbohydrate.
- [Almarai full-fat laban](https://www.almarai.com/en/brands/almarai/liquid-dairy/fresh-laban/fresh-laban-full-fat): per 250 ml, 156 kcal, 8 g protein, 11.6 g carbohydrate.

### Exact food definitions

All meat and fish weights are edible cooked portions, without bone, skin or added oil, using the cut specified in the database. Rice, pasta, potatoes, legumes and mixed vegetables are cooked; oats are weighed dry. Banana, avocado and dates exclude peel/pits. Nuts exclude shells.

White cheese means **feta**; cottage cheese means the documented **2% milkfat** reference. Whole-wheat Lebanese bread is represented by the documented whole-wheat **pita** category and is weighed in grams because local loaf weights differ. Toast means USDA commercially prepared whole-wheat bread, toasted, with a documented 25 g slice. A different actual slice must be weighed to that amount.

- Boiled eggs: whole large eggs, 50 g edible cooked weight each, FDC 173424.
- Fried eggs: a defined recipe of 50 g raw edible whole egg (FDC 171287) plus **5 g olive oil** (FDC 171413) per egg; all the oil is consumed. Values use input mass balance per whole prepared egg, not assumed cooked density. Included oil must not be added again. This recipe is catalogued but not currently selected by menu candidates.
- Tuna: exactly **90 g drained** per serving.
- Low-fat yogurt: exactly **170 g** per serving.
- Greek yogurt: exactly **160 g**, using a generic nonfat plain USDA reference. It does not claim to be a particular branded 160 g package.
- Green salad: equal edible weights of raw tomato, cucumber with peel and green-leaf lettuce; no oil or dressing. FDC 170457, 168409 and 169249. Ingredient values are combined by equal mass fractions.
- Oil: weighed in grams; no guessed ml-to-gram conversion.

For any food, `nutrient = quantity × unit_amount / basis_amount × source_value`. Full precision is preserved internally. Display rounds energy to whole kcal and protein/carbohydrate to at most one decimal. Tiny nonzero deviations are shown as `<0.5` kcal or `<0.1` g with their sign, rather than pretending to be exactly zero.

## Optimizer and limits

The engine evaluates 54 deterministic practical menu candidates with changing proteins, staples and breakfast/dinner combinations. It performs bounded weighted least-squares coordinate descent in continuous quantities, rounds to food-specific practical increments, recalculates, then searches nearby discrete single and paired changes. Daily totals are recomputed from the final shown quantities. Accuracy is prioritized over variety; a small tie-break favors simpler plans and reasonable protein distribution.

Energy, protein and carbohydrate weighted-error priorities are 3, 1.5 and 1. The aim is ±3% kcal and ±5 g for each macro. This is a bounded heuristic search, **not a proof of the global optimum** or a universal feasibility solver. Extreme or conflicting inputs still return the best practical candidate found and clearly disclose differences. The algorithm never changes the user's target or invents an exact match. Bounds constrain portions to practical meal sizes (e.g. cooked meat/fish up to 230 g per meal, nuts up to 30 g per eating occasion, packaged items in whole fixed servings). Input limits protect the calculator; they are not recommended intake ranges.

Only part of the verified catalog is needed by the current menu templates. No food outside the approved list can be emitted. Source components used to calculate green salad are not separately selectable foods.

## Verification

`node --test tests/*.test.js` covers 16 tests: below/at/above 100 g arithmetic; fixed portions; eggs including explicit frying oil; slices; ml; rounding; independent unrounded meal/day recomputation; matching official CSV extracts; source/image completeness; six practical targets; deterministic results; invalid inputs; extreme/conflicting targets; honest display precision.

Browser checks passed at 360, 390, 430 and 1024 px: Arabic RTL, no horizontal overflow, visible food quantities and totals match the calculation module, all meal photographs load, generation/edit buttons work, conflicting-target notice works, and no JavaScript errors occur. Optional WebMCP registration, execution and rejection were tested in a simulated context; native experimental-browser support was not available.

## Deployment

The site is hosted publicly through Sites. `.openai/hosting.json` identifies this site and declares `dist` as static content. Publish edits through the Sites skill/workflow with a fresh source credential, successful tests, an archive from the exact pushed commit, and a successful deployment status. Never place deployment credentials in files or public source.

For independent hosting, deploy `dist/` as the static root on Netlify, Cloudflare Pages or a similar static host, with no build command. There is only one HTML route; refreshes require no special SPA routing. Every asset uses relative URLs. The included GitHub Actions workflow runs arithmetic tests on pushes and pull requests. GitHub is a public source mirror; automatic production deployment is not configured.

## Images and attribution

The 34 local WebP thumbnails are original AI-generated representative food photographs created for this project, compressed to 209×209 px and loaded lazily. Branded entries use neutral representative photographs, **not manufacturer packaging**. Images are for identification, not portion-size estimation. Nutrition facts are attributed to their official providers; USDA data are public-domain US government data. Manufacturer names identify their products; no endorsement is implied. The repository does not redistribute the SFDA publication or manufacturer imagery.

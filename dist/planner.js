// All quantities are edible weights/volumes or integer units. No network or LLM.
export const keys = ['calories', 'protein', 'carbs'];
export function validateTarget(t) {
  if (!t || !keys.every(k => typeof t[k] === 'number' && Number.isFinite(t[k])) || t.calories <= 0 || t.calories > 10000 || t.protein < 0 || t.protein > 1000 || t.carbs < 0 || t.carbs > 2000) throw new Error('أدخل أرقامًا صحيحة ضمن حدود الحاسبة: ١–١٠٠٠٠ سعرة، ٠–١٠٠٠ جم بروتين، ٠–٢٠٠٠ جم كربوهيدرات.');
  if (t.mealCount !== undefined && (!Number.isInteger(t.mealCount) || t.mealCount < 2 || t.mealCount > 6)) throw new Error("اختر عدد الوجبات من ٢ إلى ٦.");
  return t;
}
export function nutrition(food, quantity) {
  if (!food.available || !Number.isFinite(quantity) || quantity < 0) throw new Error('Invalid food or quantity');
  const factor = quantity * (food.unit_amount || 1) / food.basis_amount;
  return Object.fromEntries(keys.map(k => [k, food[k] * factor]));
}
export function total(rows) {return rows.reduce((sum,r)=>{const n=nutrition(r.food,r.quantity);keys.forEach(k=>sum[k]+=n[k]);return sum;},{calories:0,protein:0,carbs:0});}
export function roundQuantity(q,step) { return Math.round(q/step)*step; }
export function quantityLabel(f,q) {
  if(f.quantity_note) return `${q} ${f.quantity_note}`;
  if(f.unit==='egg') return `${q} حبة (${q*f.unit_amount} جم دون القشر)`;
  if(f.unit==='slice') return `${q} شريحة (${q*f.unit_amount} جم)`;
  if(f.unit==='serving') return `${q} حصة × ${f.unit_amount} جم`;
  if(f.unit==='bottle') return `${q} زجاجة كاملة · ${f.unit_amount} مل`;
  return `${q} ${f.unit==='ml'?'مل':'جم'}`;
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Convex weighted least squares on each practical menu; deterministic coordinate
// descent, practical rounding, then a discrete single/pair neighborhood search.
export function generatePlan(foods, target) {
  validateTarget(target);
  const mealCount=target.mealCount ?? 3;
  const mainCount=Math.min(mealCount,3);
  const byId=Object.fromEntries(foods.filter(f=>f.available).map(f=>[f.id,f]));
  const scale=[Math.max(10,target.calories*.015),3,4], weights=[3,1.5,1];
  const desired=keys.map(k=>target[k]);
  const loss=v=>v.reduce((s,n,k)=>s+weights[k]*((n-desired[k])/scale[k])**2,0);
  const proteins=['chicken','grouper','salmon','thigh','beef','lamb'].filter(x=>byId[x]);
  const starches=['rice','potatoes','pasta'].filter(x=>byId[x]);
  let best;
  for(let menu=0;menu<162;menu++) {
    const slots=[];
    const add=(id,meal,min,max)=>{if(byId[id])slots.push({food:byId[id],meal,min,max,step:byId[id].step});};
    // Coherent combinations are hard constraints, not optional accuracy penalties.
    const breakfast=menu%3;
    if(breakfast===0){add('egg',0,1,3);add('toast',0,1,4);add('cottage',0,80,200);add('salad',0,80,150);add('avocado',0,30,100);}
    if(breakfast===1){add('oats',0,25,90);add('milk',0,150,300);add('banana',0,60,150);add('pistachios',0,10,25);if(mealCount<=3)add('greek',0,1,1);}
    if(breakfast===2){add('fava',0,80,220);add('toast',0,1,4);add('egg',0,1,3);add('salad',0,80,150);add('oil',0,0,10);}
    add(proteins[Math.floor(menu/3)%proteins.length],1,80,mealCount===2?300:230);
    add(starches[Math.floor(menu/18)%starches.length],1,80,mealCount===2?400:320);
    add('vegetables',1,100,200);add('oil',1,0,20);
    if(mainCount===3){
      const dinner=Math.floor(menu/54)%3;
      if(dinner===0){add('chicken',2,80,230);add('potatoes',2,80,300);add('vegetables',2,100,200);add('oil',2,0,20);}
      if(dinner===1){add('tuna',2,1,1);add('pasta',2,80,280);add('salad',2,100,180);add('oil',2,0,20);}
      if(dinner===2){add('cottage',2,100,250);add('toast',2,1,4);add('avocado',2,40,120);add('salad',2,100,150);}
    }
    // Snacks remain independent eating occasions: no nuts beside fish or chicken,
    // no isolated oil, and no tiny fruit fragments used only to fine-tune totals.
    for(let snack=0;snack<mealCount-mainCount;snack++){
      const meal=mainCount+snack, kind=(snack+Math.floor(menu/6))%3;
      if(kind===0){add('nada',meal,1,1);add('dates',meal,20,60);add('cashews',meal,10,25);}
      if(kind===1){add('greek',meal,1,1);add('banana',meal,60,150);add('pistachios',meal,10,25);}
      if(kind===2){add('yogurt',meal,1,1);add('banana',meal,60,150);add('cashews',meal,10,25);}
    }
    const A=slots.map(s=>keys.map(k=>nutrition(s.food,1)[k]));
    let q=slots.map(s=>(s.min+s.max)/2);
    let v=keys.map((_,k)=>q.reduce((sum,x,i)=>sum+x*A[i][k],0));
    for(let pass=0;pass<160;pass++) {
      let change=0;
      for(let i=0;i<q.length;i++) {
        let num=0,den=0;
        for(let k=0;k<3;k++){const w=weights[k]/scale[k]**2;num+=w*A[i][k]*(desired[k]-v[k]);den+=w*A[i][k]**2;}
        const next=clamp(q[i]+(den?num/den:0),slots[i].min,slots[i].max),d=next-q[i];
        change+=Math.abs(d);q[i]=next;for(let k=0;k<3;k++)v[k]+=d*A[i][k];
      }
      if(change<.001)break;
    }
    q=q.map((x,i)=>clamp(roundQuantity(x,slots[i].step),slots[i].min,slots[i].max));
    v=keys.map((_,k)=>q.reduce((sum,x,i)=>sum+x*A[i][k],0));
    for(let pass=0;pass<35;pass++) {
      let current=loss(v), move=null;
      for(let i=0;i<q.length;i++)for(const di of [-slots[i].step,slots[i].step]) {
        if(q[i]+di<slots[i].min || q[i]+di>slots[i].max)continue;
        for(let j=i;j<q.length;j++)for(const dj of j===i?[0]:[-slots[j].step,0,slots[j].step]){
          if(q[j]+dj<slots[j].min || q[j]+dj>slots[j].max)continue;
          const next=v.map((x,k)=>x+di*A[i][k]+dj*A[j][k]),cost=loss(next);
          if(cost<current-1e-10){current=cost;move={i,j,di,dj,next};}
        }
      }
      if(!move)break;
      q[move.i]+=move.di;q[move.j]+=move.dj;v=move.next;
    }
    const rows=slots.map((s,i)=>({...s,quantity:q[i]})).filter(r=>r.quantity>0);
    const totals=total(rows);const score=loss(keys.map(k=>totals[k]));
    // Accuracy comes first. Small tie-break favors simpler, balanced plans.
    const balance=Array.from({length:mainCount},(_,i)=>i).map(m=>total(rows.filter(r=>r.meal===m)).protein);
    const rank=score+Math.max(0,Math.max(...balance)-Math.min(...balance)-30)*.002+rows.length*.0001;
    if(!best || rank<best.rank)best={rows,totals,rank};
  }
  if(!best)throw new Error('قاعدة الأغذية غير متاحة.');
  const names=mealCount===2?['الفطور','الوجبة الرئيسية']:['الفطور','الغداء','العشاء',...Array.from({length:mealCount-3},(_,i)=>`وجبة خفيفة ${i+1}`)];
  const meals=names.map((name,i)=>{const rows=best.rows.filter(r=>r.meal===i).map(({food,quantity})=>({food,quantity}));return {name,rows,totals:total(rows)};}).filter(m=>m.rows.length);
  const totals=total(meals.flatMap(m=>m.rows));
  const differences=Object.fromEntries(keys.map(k=>[k,totals[k]-target[k]]));
  const within=Math.abs(differences.calories)<=target.calories*.03 && Math.abs(differences.protein)<=5 && Math.abs(differences.carbs)<=5;
  return {target:{...target,mealCount},totals,differences,within,meals};
}

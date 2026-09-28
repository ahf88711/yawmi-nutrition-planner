// All quantities are edible weights/volumes or integer units. No network or LLM.
export const keys = ['calories', 'protein', 'carbs'];
export function validateTarget(t) {
  if (!t || !keys.every(k => typeof t[k] === 'number' && Number.isFinite(t[k])) || t.calories <= 0 || t.calories > 10000 || t.protein < 0 || t.protein > 1000 || t.carbs < 0 || t.carbs > 2000) throw new Error('أدخل أرقامًا صحيحة ضمن حدود الحاسبة: ١–١٠٠٠٠ سعرة، ٠–١٠٠٠ جم بروتين، ٠–٢٠٠٠ جم كربوهيدرات.');
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
  const byId=Object.fromEntries(foods.filter(f=>f.available).map(f=>[f.id,f]));
  const scale=[Math.max(10,target.calories*.015),3,4], weights=[3,1.5,1];
  const desired=keys.map(k=>target[k]);
  const loss=v=>v.reduce((s,n,k)=>s+weights[k]*((n-desired[k])/scale[k])**2,0);
  const proteins=['chicken','grouper','salmon','thigh','beef','lamb'].filter(x=>byId[x]);
  const starches=['rice','potatoes','pasta'].filter(x=>byId[x]);
  let best;
  for(let menu=0;menu<54;menu++) {
    const slots=[];
    const add=(id,meal,min,max)=>{if(byId[id])slots.push({food:byId[id],meal,min,max,step:byId[id].step});};
    const breakfast=menu%3;
    if(breakfast===0){add('egg',0,1,3);add('toast',0,1,4);add('milk',0,100,300);}
    if(breakfast===1){add('oats',0,25,90);add('milk',0,150,300);add('greek',0,1,1);}
    if(breakfast===2){add('fava',0,80,220);add('toast',0,1,4);add('egg',0,1,2);}
    add(proteins[Math.floor(menu/3)%proteins.length],1,70,230);
    add(starches[Math.floor(menu/6)%starches.length],1,60,320);
    add('salad',1,100,200);add('oil',1,0,20);
    const dinner=Math.floor(menu/9)%3;
    if(dinner===0){add('chicken',2,60,220);add('potatoes',2,60,300);add('vegetables',2,100,200);add('oil',2,0,15);}
    if(dinner===1){add('tuna',2,1,1);add('lentils',2,70,200);add('toast',2,1,3);add('salad',2,100,180);add('oil',2,0,15);}
    if(dinner===2){add('cottage',2,100,250);add('toast',2,1,4);add('avocado',2,30,120);add('salad',2,100,150);}
    // A fourth occasion only for candidates where it improves the fit.
    if(menu%2===1){add('nada',3,1,1);add('banana',3,0,150);add('cashews',3,0,30);}
    else {add('banana',0,0,120);add('pistachios',2,0,25);}
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
    const balance=[0,1,2].map(m=>total(rows.filter(r=>r.meal===m)).protein);
    const rank=score+Math.max(0,Math.max(...balance)-Math.min(...balance)-30)*.002+rows.length*.0001;
    if(!best || rank<best.rank)best={rows,totals,rank};
  }
  if(!best)throw new Error('قاعدة الأغذية غير متاحة.');
  const meals=['الفطور','الغداء','العشاء','وجبة خفيفة'].map((name,i)=>{const rows=best.rows.filter(r=>r.meal===i).map(({food,quantity})=>({food,quantity}));return {name,rows,totals:total(rows)};}).filter(m=>m.rows.length);
  const totals=total(meals.flatMap(m=>m.rows));
  const differences=Object.fromEntries(keys.map(k=>[k,totals[k]-target[k]]));
  const within=Math.abs(differences.calories)<=target.calories*.03 && Math.abs(differences.protein)<=5 && Math.abs(differences.carbs)<=5;
  return {target:{...target},totals,differences,within,meals};
}

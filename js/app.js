/* ============================================================
 * 燃卡 FitCal —— 主应用逻辑
 * ============================================================ */

/* ---------- 全局状态 ---------- */
const S = {
  tab: "today",
  date: Store.todayStr(),
  foodSearch: "",
  foodCat: "全部",
  deferredInstall: null // PWA 安装事件
};
const MEALS = [
  { id: "breakfast", name: "早餐", ico: "🌅" },
  { id: "lunch", name: "午餐", ico: "☀️" },
  { id: "dinner", name: "晚餐", ico: "🌙" },
  { id: "snack", name: "加餐", ico: "🍎" }
];

/* ---------- 工具 ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function r0(n) { return Math.round(n); }
function r1(n) { return Math.round(n * 10) / 10; }
function allFoods() { return [...Store.getCustomFoods(), ...BUILTIN_FOODS]; }
function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 2400);
}
function fmtDate(dateStr) {
  const today = Store.todayStr();
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const diff = Math.round((t - d) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === -1) return "明天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function shiftDate(days) {
  const d = new Date(S.date + "T00:00:00");
  d.setDate(d.getDate() + days);
  S.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  renderToday();
  $("#dateLabel").textContent = fmtDate(S.date);
}

/* ---------- 底部抽屉 ---------- */
function openSheet(html) {
  $("#sheet").innerHTML = html;
  $("#sheet").classList.remove("hidden");
  $("#sheetMask").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeSheet() {
  $("#sheet").classList.add("hidden");
  $("#sheetMask").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ============================================================
 * 视图一：今日
 * ============================================================ */
function renderToday() {
  const plan = Store.getPlan();
  const day = Store.getDay(S.date);
  const { total, byMeal } = sumDay(day, allFoods());
  const target = plan ? plan.targetKcal : 2000;
  const left = target - total.kcal;
  const pct = Math.min(total.kcal / target, 1);
  const over = total.kcal > target;
  const CIRC = 2 * Math.PI * 66;

  let html = "";

  // 无计划提示
  if (!plan) {
    html += `<div class="card install-banner">
      <div class="t"><b>还没有生成你的专属计划</b>先去「我的计划」填资料，目标热量会更准</div>
      <button class="btn btn-primary btn-sm" onclick="switchTab('plan')">去设置</button>
    </div>`;
  }

  // 热量环 + 关键数字
  html += `<div class="card">
    <div class="hero-row">
      <div class="ring-wrap">
        <svg width="148" height="148" viewBox="0 0 148 148">
          <circle class="ring-bg" cx="74" cy="74" r="66" fill="none" stroke-width="11"/>
          <circle class="ring-fg ${over ? "over" : ""}" cx="74" cy="74" r="66" fill="none" stroke-width="11"
            stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - pct)}"/>
        </svg>
        <div class="ring-center">
          <div class="ring-kcal num">${r0(Math.abs(left))}</div>
          <div class="ring-sub">${over ? "已超出 kcal" : "还可以吃 kcal"}</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hstat"><div class="h-label">目标</div><div class="h-val num">${r0(target)} <small>kcal</small></div></div>
        <div class="hstat"><div class="h-label">已摄入</div><div class="h-val num">${r0(total.kcal)} <small>kcal</small></div></div>
        <div class="hstat"><div class="h-label">进度</div><div class="h-val num">${r0(total.kcal / target * 100)}<small>%</small></div></div>
      </div>
    </div>
    <div class="macro-row">
      ${macroBox("蛋白质", total.p, plan?.protein, "var(--protein)")}
      ${macroBox("碳水", total.c, plan?.carb, "var(--carb)")}
      ${macroBox("脂肪", total.f, plan?.fat, "var(--fat)")}
    </div>
  </div>`;

  // 四餐卡片
  for (const meal of MEALS) {
    const entries = day[meal.id] || [];
    const mSum = byMeal[meal.id];
    html += `<div class="card meal-card">
      <div class="meal-head">
        <div><span class="meal-name">${meal.ico} ${meal.name}</span>
          <span class="meal-kcal num">${entries.length ? r0(mSum.kcal) + " kcal" : ""}</span></div>
        <button class="meal-add" onclick="openFoodPicker('${meal.id}')" aria-label="添加到${meal.name}">＋</button>
      </div>
      ${entries.length ? `<div class="meal-list">${entries.map(e => entryRow(meal.id, e)).join("")}</div>` : ""}
    </div>`;
  }

  $("#view-today").innerHTML = html;
}

function macroBox(name, cur, target, color) {
  const pct = target ? Math.min(cur / target * 100, 100) : 0;
  return `<div class="macro">
    <div class="macro-name"><span class="macro-dot" style="background:${color}"></span>${name}</div>
    <div class="macro-val num">${r0(cur)}<small> / ${target ? r0(target) : "--"}g</small></div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
  </div>`;
}

function entryRow(mealId, e) {
  const food = allFoods().find(f => f.id === e.foodId);
  if (!food) return "";
  const k = food.kcal * e.amount / 100;
  return `<div class="entry">
    <div>
      <div class="entry-name">${esc(food.name)}</div>
      <div class="entry-sub num">${e.amount}${food.unit} · 蛋白${r1(food.p * e.amount / 100)} 碳水${r1(food.c * e.amount / 100)} 脂肪${r1(food.f * e.amount / 100)}</div>
    </div>
    <div class="entry-right">
      <span class="entry-kcal num">${r0(k)}</span>
      <button class="entry-del" onclick="delEntry('${mealId}','${e.eid}')" aria-label="删除">✕</button>
    </div>
  </div>`;
}

function delEntry(mealId, eid) {
  Store.removeEntry(S.date, mealId, eid);
  renderToday();
  toast("已删除");
}

/* ============================================================
 * 食物选择抽屉（添加到某一餐）
 * ============================================================ */
let pickerState = { meal: null, search: "", cat: "全部" };

function openFoodPicker(mealId) {
  pickerState = { meal: mealId, search: "", cat: "全部" };
  const mealName = MEALS.find(m => m.id === mealId).name;
  openSheet(`
    <div class="sheet-head">
      <div class="sheet-title">添加到${mealName}</div>
      <button class="sheet-close" onclick="closeSheet()">✕</button>
    </div>
    <div class="sheet-body">
      <div class="search-row">
        <input class="search-input" id="pickerSearch" placeholder="搜索食物，如：鸡胸肉" autocomplete="off">
      </div>
      <div class="cat-scroll" id="pickerCats"></div>
      <div id="pickerList"></div>
    </div>
  `);
  $("#pickerSearch").addEventListener("input", (e) => { pickerState.search = e.target.value.trim(); renderPickerList(); });
  renderPickerCats(); renderPickerList();
}

function renderPickerCats() {
  $("#pickerCats").innerHTML = FOOD_CATS.map(c =>
    `<button class="chip ${pickerState.cat === c ? "active" : ""}" onclick="setPickerCat('${c}')">${c}</button>`).join("");
}
function setPickerCat(c) { pickerState.cat = c; renderPickerCats(); renderPickerList(); }

function filterFoods(search, cat) {
  let list = allFoods();
  if (cat === "我的食物") list = list.filter(f => f.custom);
  else if (cat !== "全部") list = list.filter(f => f.cat === cat);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(f => f.name.toLowerCase().includes(s));
  }
  return list.slice(0, 60);
}

function renderPickerList() {
  const list = filterFoods(pickerState.search, pickerState.cat);
  $("#pickerList").innerHTML = list.length ? list.map(f => `
    <div class="food-item" onclick="openQtySheet('${f.id}')">
      <div>
        <div class="food-name">${esc(f.name)}${f.custom ? '<span class="food-badge">自建</span>' : ""}</div>
        <div class="food-sub">${f.tip ? esc(f.tip) + " · " : ""}蛋白${f.p} 碳水${f.c} 脂肪${f.f}</div>
      </div>
      <div class="food-kcal num"><b>${f.kcal}</b><span>kcal/100${f.unit}</span></div>
    </div>`).join("")
    : `<div class="empty"><div class="big">🔍</div>没找到？去食物库「添加自定义食物」<br>或者用拍照识别包装营养表</div>`;
}

/* ---- 份量选择 ---- */
function openQtySheet(foodId) {
  const food = allFoods().find(f => f.id === foodId);
  if (!food) return;
  const quicks = food.unit === "ml" ? [100, 250, 330, 500] : [50, 100, 150, 200, 300];
  openSheet(`
    <div class="sheet-head">
      <div class="sheet-title">${esc(food.name)}</div>
      <button class="sheet-close" onclick="closeSheet()">✕</button>
    </div>
    <div class="sheet-body">
      <div class="food-sub" style="margin-bottom:4px">${food.kcal} kcal / 100${food.unit}${food.tip ? " · " + esc(food.tip) : ""}</div>
      <div class="qty-quick">
        ${quicks.map(q => `<button class="qty-chip" onclick="setQty(${q})">${q}${food.unit}</button>`).join("")}
      </div>
      <div class="qty-input-row">
        <input class="qty-input num" id="qtyInput" type="number" inputmode="decimal" value="100" min="1" max="5000">
        <span class="qty-unit">${food.unit}</span>
      </div>
      <div class="macro-preview" id="qtyPreview"></div>
      <button class="btn btn-primary btn-lg" onclick="confirmAdd('${food.id}')">添加</button>
    </div>
  `);
  const upd = () => {
    const amt = parseFloat($("#qtyInput").value) || 0;
    const k = amt / 100;
    $("#qtyPreview").innerHTML = `
      <div>热量<b class="num">${r0(food.kcal * k)}</b></div>
      <div>蛋白质<b class="num">${r1(food.p * k)}g</b></div>
      <div>碳水<b class="num">${r1(food.c * k)}g</b></div>
      <div>脂肪<b class="num">${r1(food.f * k)}g</b></div>`;
  };
  $("#qtyInput").addEventListener("input", upd);
  window.setQty = (q) => {
    $("#qtyInput").value = q; upd();
    $$(".qty-chip").forEach(c => c.classList.toggle("active", c.textContent === q + food.unit));
  };
  upd();
}

function confirmAdd(foodId) {
  const amt = parseFloat($("#qtyInput").value);
  if (!amt || amt <= 0) { toast("请输入有效份量", "err"); return; }
  Store.addEntry(S.date, pickerState.meal, {
    eid: "e" + Date.now() + Math.random().toString(36).slice(2, 6),
    foodId, amount: amt
  });
  closeSheet();
  renderToday();
  toast("已记录 ✓", "ok");
}

/* ============================================================
 * 视图二：食物库
 * ============================================================ */
function renderFoods() {
  $("#view-foods").innerHTML = `
    <div class="add-row">
      <button class="btn btn-ghost" onclick="openFoodForm()">✏️ 手动添加食物</button>
      <button class="btn btn-ghost" onclick="openOcrSheet()">📷 拍照识别营养表</button>
    </div>
    <div class="search-row">
      <input class="search-input" id="libSearch" placeholder="搜索 ${allFoods().length} 种食物…" value="${esc(S.foodSearch)}" autocomplete="off">
    </div>
    <div class="cat-scroll" id="libCats"></div>
    <div id="libList"></div>`;
  $("#libSearch").addEventListener("input", (e) => { S.foodSearch = e.target.value.trim(); renderLibList(); });
  renderLibCats(); renderLibList();
}
function renderLibCats() {
  $("#libCats").innerHTML = FOOD_CATS.map(c =>
    `<button class="chip ${S.foodCat === c ? "active" : ""}" onclick="setLibCat('${c}')">${c}</button>`).join("");
}
function setLibCat(c) { S.foodCat = c; renderLibCats(); renderLibList(); }
function renderLibList() {
  const list = filterFoods(S.foodSearch, S.foodCat);
  $("#libList").innerHTML = list.length ? list.map(f => `
    <div class="food-item" onclick="${f.custom ? `openFoodForm('${f.id}')` : `showFoodDetail('${f.id}')`}">
      <div>
        <div class="food-name">${esc(f.name)}${f.custom ? '<span class="food-badge">自建·点击编辑</span>' : ""}</div>
        <div class="food-sub">${f.tip ? esc(f.tip) + " · " : ""}蛋白${f.p}g 碳水${f.c}g 脂肪${f.f}g</div>
      </div>
      <div class="food-kcal num"><b>${f.kcal}</b><span>kcal/100${f.unit}</span></div>
    </div>`).join("")
    : `<div class="empty"><div class="big">🍽️</div>没有找到，试试手动添加或拍照识别</div>`;
}
function showFoodDetail(id) {
  const f = allFoods().find(x => x.id === id);
  if (!f) return;
  toast(`${f.name}：${f.kcal}kcal · 蛋白${f.p} 碳水${f.c} 脂肪${f.f} /100${f.unit}`);
}

/* ---- 手动添加 / 编辑自定义食物 ---- */
function openFoodForm(editId = null, prefill = null) {
  const f = editId ? Store.getCustomFoods().find(x => x.id === editId) : null;
  const v = f || prefill || {};
  const cats = FOOD_CATS.filter(c => c !== "全部" && c !== "我的食物");
  openSheet(`
    <div class="sheet-head">
      <div class="sheet-title">${f ? "编辑" : "添加"}自定义食物</div>
      <button class="sheet-close" onclick="closeSheet()">✕</button>
    </div>
    <div class="sheet-body">
      <div class="form-grid">
        <div class="field full"><label>食物名称 *</label>
          <input id="ffName" placeholder="如：老坛酸菜牛肉面" value="${esc(v.name || "")}"></div>
        <div class="field"><label>分类</label>
          <select id="ffCat">${cats.map(c => `<option ${v.cat === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
        <div class="field"><label>计量单位</label>
          <select id="ffUnit"><option value="g" ${v.unit !== "ml" ? "selected" : ""}>按克(g)</option><option value="ml" ${v.unit === "ml" ? "selected" : ""}>按毫升(ml)</option></select></div>
        <div class="field"><label>热量 kcal / 100 *</label>
          <input id="ffKcal" type="number" inputmode="decimal" placeholder="如 450" value="${v.kcal ?? ""}"></div>
        <div class="field"><label>碳水化合物 g / 100</label>
          <input id="ffC" type="number" inputmode="decimal" placeholder="0" value="${v.c ?? ""}"></div>
        <div class="field"><label>蛋白质 g / 100</label>
          <input id="ffP" type="number" inputmode="decimal" placeholder="0" value="${v.p ?? ""}"></div>
        <div class="field"><label>脂肪 g / 100</label>
          <input id="ffF" type="number" inputmode="decimal" placeholder="0" value="${v.f ?? ""}"></div>
        <div class="field full"><label>份量备注（可选）</label>
          <input id="ffTip" placeholder="如：1袋约120g" value="${esc(v.tip || "")}"></div>
      </div>
      <div class="hint" id="ffHint" style="margin:10px 0"></div>
      <button class="btn btn-primary btn-lg" onclick="saveFoodForm(${f ? `'${f.id}'` : "null"})">${f ? "保存修改" : "保存到我的食物"}</button>
      ${f ? `<button class="btn btn-danger btn-lg" style="margin-top:8px" onclick="deleteFood('${f.id}')">删除这个食物</button>` : ""}
    </div>
  `);
  if (prefill?._ocrNote) $("#ffHint").textContent = prefill._ocrNote;
}

function saveFoodForm(editId) {
  const name = $("#ffName").value.trim();
  const kcal = parseFloat($("#ffKcal").value);
  const c = parseFloat($("#ffC").value) || 0;
  const p = parseFloat($("#ffP").value) || 0;
  const fat = parseFloat($("#ffF").value) || 0;
  if (!name) { toast("请填写食物名称", "err"); return; }
  if (isNaN(kcal) || kcal < 0) { toast("请填写每100克/毫升的热量", "err"); return; }
  const warn = checkMacroConsistency(kcal, c, p, fat);
  const food = {
    id: editId || "u" + Date.now(),
    name, cat: $("#ffCat").value, unit: $("#ffUnit").value,
    kcal: r1(kcal), c: r1(c), p: r1(p), f: r1(fat),
    tip: $("#ffTip").value.trim(), custom: true
  };
  Store.saveCustomFood(food);
  closeSheet();
  if (S.tab === "foods") renderFoods();
  toast(warn ? "已保存（" + warn + "）" : "已保存到我的食物 ✓", warn ? "" : "ok");
}

function deleteFood(id) {
  Store.deleteCustomFood(id);
  closeSheet();
  renderFoods();
  toast("已删除");
}

/* ---- 拍照 OCR ---- */
function openOcrSheet() {
  openSheet(`
    <div class="sheet-head">
      <div class="sheet-title">📷 拍照识别营养成分表</div>
      <button class="sheet-close" onclick="closeSheet()">✕</button>
    </div>
    <div class="sheet-body">
      <div class="ocr-zone" id="ocrZone">
        <div class="big">🏷️</div>
        对准包装背面的<b>「营养成分表」</b>拍照<br>
        <span style="font-size:12px;color:var(--ink-3)">光线充足、表格拍正、占满画面，识别率最高<br>图片只在你手机/电脑本地识别，不会上传</span>
      </div>
      <input type="file" id="ocrFile" accept="image/*" capture="environment" hidden>
      <button class="btn btn-primary btn-lg" onclick="document.getElementById('ocrFile').click()">拍照 / 选择图片</button>
      <div class="ocr-progress hidden" id="ocrProgress"></div>
      <div id="ocrResult"></div>
    </div>
  `);
  $("#ocrFile").addEventListener("change", handleOcrFile);
}

async function handleOcrFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const prog = $("#ocrProgress");
  prog.classList.remove("hidden");
  prog.textContent = "正在加载识别引擎…（首次使用需下载中文语言包，请稍等）";
  try {
    const { text, parsed } = await OCR.recognize(file, (status, p) => {
      const label = status === "recognizing text" ? "正在识别文字" : "正在准备引擎";
      prog.textContent = `${label}… ${Math.round(p * 100)}%`;
    });
    prog.classList.add("hidden");
    if (parsed.found === 0) {
      $("#ocrResult").innerHTML = `
        <div class="empty" style="padding:18px">😥 没能识别出营养数据<br>
        <span style="font-size:12px">试试拍得更清楚，或点下面按钮手动填写</span></div>
        <button class="btn btn-ghost btn-lg" onclick="openFoodForm()">手动填写</button>
        <div class="ocr-raw">${esc(text.slice(0, 600) || "（未识别到文字）")}</div>`;
      return;
    }
    $("#ocrResult").innerHTML = `
      <div class="macro-preview" style="margin-top:14px">
        <div>热量<b class="num">${parsed.kcal ?? "?"}</b></div>
        <div>蛋白质<b class="num">${parsed.p ?? "?"}g</b></div>
        <div>碳水<b class="num">${parsed.c ?? "?"}g</b></div>
        <div>脂肪<b class="num">${parsed.f ?? "?"}g</b></div>
      </div>
      <div class="hint" style="text-align:center;margin-bottom:10px">已按「每100${parsed.perUnit}」折算 · 识别到 ${parsed.found}/4 项${parsed.raw.energy ? " · " + esc(parsed.raw.energy) : ""}</div>
      <button class="btn btn-primary btn-lg" onclick='applyOcr(${JSON.stringify(parsed).replace(/'/g, "&#39;")})'>确认无误，去补充名称</button>
      <div class="ocr-raw">${esc(text.slice(0, 600))}</div>`;
  } catch (err) {
    prog.classList.add("hidden");
    $("#ocrResult").innerHTML = `<div class="empty" style="padding:18px">识别出错：${esc(err.message)}<br>
      <span style="font-size:12px">拍照识别需要联网加载引擎（仅首次）。也可以手动填写 ↓</span></div>
      <button class="btn btn-ghost btn-lg" onclick="openFoodForm()">手动填写</button>`;
  }
}

function applyOcr(parsed) {
  openFoodForm(null, {
    kcal: parsed.kcal ?? "", c: parsed.c ?? "", p: parsed.p ?? "", f: parsed.f ?? "",
    unit: parsed.perUnit === "ml" ? "ml" : "g",
    _ocrNote: "📷 数据来自拍照识别，建议对照包装核对一遍再保存"
  });
}

/* ============================================================
 * 视图三：我的计划
 * ============================================================ */
function renderPlan() {
  const profile = Store.getProfile() || {};
  const plan = Store.getPlan();
  let html = "";

  // 已有计划 → 展示
  if (plan) {
    html += `<div class="card plan-hero">
      <div class="plan-kcal num">${plan.targetKcal}</div>
      <div class="plan-kcal-sub">每日目标摄入 (kcal) · ${GOALS.find(g => g.id === profile.goal)?.label || ""} · ${plan.kcalNote}</div>
      <div class="plan-grid">
        <div class="pstat"><div class="k">基础代谢 BMR</div><div class="v num">${plan.bmr} kcal</div></div>
        <div class="pstat"><div class="k">每日总消耗 TDEE</div><div class="v num">${plan.tdee} kcal</div></div>
        <div class="pstat"><div class="k">🥩 蛋白质</div><div class="v num" style="color:var(--protein)">${plan.protein} g <small style="font-size:11px;color:var(--ink-3)">${plan.proteinKcal}kcal</small></div></div>
        <div class="pstat"><div class="k">🍚 碳水</div><div class="v num" style="color:var(--carb)">${plan.carb} g <small style="font-size:11px;color:var(--ink-3)">${plan.carbKcal}kcal</small></div></div>
        <div class="pstat"><div class="k">🥑 脂肪</div><div class="v num" style="color:var(--fat)">${plan.fat} g <small style="font-size:11px;color:var(--ink-3)">${plan.fatKcal}kcal</small></div></div>
        <div class="pstat"><div class="k">💧 建议饮水</div><div class="v num">${plan.waterMl} ml</div></div>
        <div class="pstat"><div class="k">预期变化</div><div class="v num">${plan.weeklyChange}</div></div>
        <div class="pstat"><div class="k">计算公式</div><div class="v" style="font-size:11.5px;font-weight:400;color:var(--ink-2)">${plan.formula.split("（")[0]}${plan.lbm ? `<br>瘦体重 ${plan.lbm}kg` : ""}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📌 给你的执行建议</div>
      <ul class="tip-list">${plan.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    </div>`;
  }

  // 资料表单
  const p = profile;
  html += `<div class="card">
    <div class="card-title">${plan ? "调整资料，重新生成计划" : "填写资料，生成你的专属计划"}</div>
    <div class="form-grid">
      <div class="field full"><label>目标</label>
        <div class="seg" id="segGoal">
          ${GOALS.map(g => `<button class="seg-btn ${p.goal === g.id || (!p.goal && g.id === "cut") ? "active" : ""}" data-v="${g.id}">${g.label}<br><span style="font-size:10.5px;opacity:.75">${g.desc}</span></button>`).join("")}
        </div></div>
      <div class="field"><label>性别</label>
        <select id="pfGender">
          <option value="male" ${p.gender !== "female" ? "selected" : ""}>男</option>
          <option value="female" ${p.gender === "female" ? "selected" : ""}>女</option>
        </select></div>
      <div class="field"><label>年龄</label>
        <input id="pfAge" type="number" inputmode="numeric" placeholder="25" value="${p.age ?? ""}"></div>
      <div class="field"><label>身高 (cm)</label>
        <input id="pfHeight" type="number" inputmode="decimal" placeholder="175" value="${p.height ?? ""}"></div>
      <div class="field"><label>体重 (kg)</label>
        <input id="pfWeight" type="number" inputmode="decimal" placeholder="70" value="${p.weight ?? ""}"></div>
      <div class="field full"><label>体脂率 %（可选，体脂秤/InBody 数据）</label>
        <input id="pfBodyFat" type="number" inputmode="decimal" placeholder="不知道可以不填" value="${p.bodyFat ?? ""}">
        <div class="hint">填了会用瘦体重(肌肉量)计算，对健身人群更准确</div></div>
      <div class="field full"><label>日常活动量</label>
        <select id="pfActivity">
          ${ACTIVITY_LEVELS.map(a => `<option value="${a.id}" ${p.activity === a.id ? "selected" : ""}>${a.label} —— ${a.desc}</option>`).join("")}
        </select></div>
      <div class="field full"><label>力量训练水平</label>
        <select id="pfIntensity">
          ${TRAINING_INTENSITY.map(t => `<option value="${t.id}" ${p.intensity === t.id ? "selected" : ""}>${t.label} —— ${t.desc}</option>`).join("")}
        </select></div>
    </div>
    <button class="btn btn-primary btn-lg" style="margin-top:16px" onclick="generatePlan()">⚡ 生成我的计划</button>
  </div>`;

  // 数据管理
  html += `<div class="card">
    <div class="card-title">数据管理（所有数据只存在本机）</div>
    <div class="add-row" style="margin-bottom:0">
      <button class="btn btn-ghost btn-sm" onclick="exportData()">导出备份</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('importFile').click()">导入备份</button>
    </div>
    <input type="file" id="importFile" accept=".json" hidden>
  </div>`;

  $("#view-plan").innerHTML = html;

  // 目标segment交互
  $$("#segGoal .seg-btn").forEach(b => b.addEventListener("click", () => {
    $$("#segGoal .seg-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
  }));
  $("#importFile").addEventListener("change", importData);
}

function generatePlan() {
  const p = {
    goal: $("#segGoal .seg-btn.active")?.dataset.v || "cut",
    gender: $("#pfGender").value,
    age: parseInt($("#pfAge").value),
    height: parseFloat($("#pfHeight").value),
    weight: parseFloat($("#pfWeight").value),
    bodyFat: parseFloat($("#pfBodyFat").value) || null,
    activity: $("#pfActivity").value,
    intensity: $("#pfIntensity").value
  };
  if (!p.age || p.age < 10 || p.age > 100) { toast("请填写正确的年龄", "err"); return; }
  if (!p.height || p.height < 100 || p.height > 250) { toast("请填写正确的身高(cm)", "err"); return; }
  if (!p.weight || p.weight < 25 || p.weight > 300) { toast("请填写正确的体重(kg)", "err"); return; }
  if (p.bodyFat && (p.bodyFat < 3 || p.bodyFat > 60)) { toast("体脂率一般在 3-60% 之间", "err"); return; }

  Store.saveProfile(p);
  Store.savePlan(buildPlan(p));
  renderPlan();
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("计划已生成 ✓ 去「今日」开始记录吧", "ok");
}

/* ---- 备份 ---- */
function exportData() {
  const blob = new Blob([Store.exportAll()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `燃卡备份_${Store.todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("备份文件已下载", "ok");
}
function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Store.importAll(reader.result);
      toast("导入成功 ✓", "ok");
      renderAll();
    } catch { toast("文件格式不对", "err"); }
  };
  reader.readAsText(file);
}

/* ============================================================
 * 导航 & 初始化
 * ============================================================ */
function switchTab(tab) {
  S.tab = tab;
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  $("#view-today").classList.toggle("hidden", tab !== "today");
  $("#view-foods").classList.toggle("hidden", tab !== "foods");
  $("#view-plan").classList.toggle("hidden", tab !== "plan");
  $("#dateNav").style.visibility = tab === "today" ? "visible" : "hidden";
  $("#topTitle").textContent = { today: "今日", foods: "食物库", plan: "我的计划" }[tab];
  renderAll();
  window.scrollTo(0, 0);
}
function renderAll() {
  if (S.tab === "today") renderToday();
  else if (S.tab === "foods") renderFoods();
  else renderPlan();
}

function init() {
  // 引导页
  if (!Store.getProfile()) {
    $("#onboard").classList.remove("hidden");
    $("#onboardStart").addEventListener("click", () => {
      $("#onboard").classList.add("hidden");
      switchTab("plan");
    });
  }
  // tab
  $$(".tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  // 日期
  $("#datePrev").addEventListener("click", () => shiftDate(-1));
  $("#dateNext").addEventListener("click", () => shiftDate(1));
  $("#dateLabel").addEventListener("click", () => { S.date = Store.todayStr(); $("#dateLabel").textContent = "今天"; renderToday(); });
  $("#dateLabel").textContent = fmtDate(S.date);
  // 抽屉遮罩
  $("#sheetMask").addEventListener("click", closeSheet);
  // PWA 安装
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    S.deferredInstall = e;
    showInstallBanner();
  });
  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  renderAll();
}

function showInstallBanner() {
  if (localStorage.getItem("fct_install_dismissed") || !S.deferredInstall) return;
  const el = document.createElement("div");
  el.className = "card install-banner";
  el.id = "installBanner";
  el.innerHTML = `
    <div class="t"><b>把「燃卡」装到设备上</b>像 App 一样从桌面打开，全屏无地址栏</div>
    <button class="btn btn-primary btn-sm" id="installYes">安装</button>
    <button class="icon-btn" id="installNo" style="font-size:16px">✕</button>`;
  $("#main").prepend(el);
  $("#installYes").addEventListener("click", async () => {
    S.deferredInstall.prompt();
    const { outcome } = await S.deferredInstall.userChoice;
    if (outcome === "accepted") toast("安装成功 🎉", "ok");
    el.remove();
    S.deferredInstall = null;
  });
  $("#installNo").addEventListener("click", () => {
    localStorage.setItem("fct_install_dismissed", "1");
    el.remove();
  });
}

document.addEventListener("DOMContentLoaded", init);

/* ============================================================
 * 本地存储封装（localStorage）
 * 所有数据只存在你自己的设备上，不上传任何服务器
 * ============================================================ */
const Store = {
  KEYS: {
    profile: "fct_profile",   // 个人资料
    plan: "fct_plan",         // 当前计划
    diary: "fct_diary",       // 饮食日记 { "2026-07-19": { breakfast:[...], ... } }
    customFoods: "fct_custom" // 自定义食物
  },

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  /* ---- 个人资料 & 计划 ---- */
  getProfile() { return this.get(this.KEYS.profile); },
  saveProfile(p) { this.set(this.KEYS.profile, p); },
  getPlan() { return this.get(this.KEYS.plan); },
  savePlan(plan) { this.set(this.KEYS.plan, plan); },

  /* ---- 饮食日记 ---- */
  getDiary() { return this.get(this.KEYS.diary, {}); },
  getDay(dateStr) {
    const d = this.getDiary()[dateStr];
    return d || { breakfast: [], lunch: [], dinner: [], snack: [] };
  },
  saveDay(dateStr, dayData) {
    const diary = this.getDiary();
    diary[dateStr] = dayData;
    this.set(this.KEYS.diary, diary);
  },
  addEntry(dateStr, meal, entry) {
    const day = this.getDay(dateStr);
    day[meal].push(entry);
    this.saveDay(dateStr, day);
  },
  removeEntry(dateStr, meal, entryId) {
    const day = this.getDay(dateStr);
    day[meal] = day[meal].filter(e => e.eid !== entryId);
    this.saveDay(dateStr, day);
  },

  /* ---- 自定义食物 ---- */
  getCustomFoods() { return this.get(this.KEYS.customFoods, []); },
  saveCustomFood(food) {
    const list = this.getCustomFoods();
    const idx = list.findIndex(f => f.id === food.id);
    if (idx >= 0) list[idx] = food; else list.unshift(food);
    this.set(this.KEYS.customFoods, list);
  },
  deleteCustomFood(id) {
    this.set(this.KEYS.customFoods, this.getCustomFoods().filter(f => f.id !== id));
  },

  /* ---- 工具 ---- */
  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
  /** 导出全部数据（备份用） */
  exportAll() {
    return JSON.stringify({
      profile: this.getProfile(), plan: this.getPlan(),
      diary: this.getDiary(), customFoods: this.getCustomFoods(),
      exportedAt: new Date().toISOString(), app: "fit-calorie-tracker/v1"
    }, null, 2);
  },
  importAll(json) {
    const data = JSON.parse(json);
    if (data.profile) this.saveProfile(data.profile);
    if (data.plan) this.savePlan(data.plan);
    if (data.diary) this.set(this.KEYS.diary, data.diary);
    if (data.customFoods) this.set(this.KEYS.customFoods, data.customFoods);
  }
};

/** 汇总一天的摄入 */
function sumDay(dayData, allFoods) {
  const total = { kcal: 0, c: 0, p: 0, f: 0 };
  const byMeal = {};
  for (const meal of ["breakfast", "lunch", "dinner", "snack"]) {
    const m = { kcal: 0, c: 0, p: 0, f: 0 };
    for (const entry of (dayData[meal] || [])) {
      const food = allFoods.find(f => f.id === entry.foodId);
      if (!food) continue;
      const ratio = entry.amount / 100;
      m.kcal += food.kcal * ratio; m.c += food.c * ratio;
      m.p += food.p * ratio; m.f += food.f * ratio;
    }
    byMeal[meal] = m;
    total.kcal += m.kcal; total.c += m.c; total.p += m.p; total.f += m.f;
  }
  return { total, byMeal };
}

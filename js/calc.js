/* ============================================================
 * 计划计算引擎：BMR / TDEE / 目标热量 / 三大宏量营养素
 * 公式依据：
 *  - Mifflin-St Jeor (1990)：无体脂率时估算 BMR，误差最小的通用公式
 *  - Katch-McArdle：已知体脂率时用瘦体重计算，对肌肉量大的人更准
 *  - 活动系数：标准 TDEE 乘数
 *  - 蛋白质推荐：ISSN(国际运动营养学会)立场声明范围
 * ============================================================ */

/** 活动水平选项 */
const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "久坐不动", desc: "办公室工作，几乎不运动", factor: 1.2 },
  { id: "light", label: "轻度活动", desc: "每周运动 1-3 次", factor: 1.375 },
  { id: "moderate", label: "中度活动", desc: "每周运动 3-5 次", factor: 1.55 },
  { id: "active", label: "高度活动", desc: "每周运动 6-7 次", factor: 1.725 },
  { id: "athlete", label: "极高强度", desc: "体力劳动或每天两练", factor: 1.9 }
];

/** 训练强度选项（影响热量盈亏幅度与蛋白质需求） */
const TRAINING_INTENSITY = [
  { id: "novice", label: "新手/低强度", desc: "刚开始力量训练，或以有氧为主" },
  { id: "intermediate", label: "进阶/中等强度", desc: "规律力量训练 6 个月以上" },
  { id: "advanced", label: "高阶/大强度", desc: "系统训练 2 年以上，大重量复合动作" }
];

/** 目标选项 */
const GOALS = [
  { id: "cut", label: "减脂", desc: "降低体脂，保住肌肉" },
  { id: "maintain", label: "维持", desc: "保持当前体重和状态" },
  { id: "bulk", label: "增肌", desc: "增加肌肉量，控制脂肪增长" }
];

/**
 * 计算 BMR（基础代谢率）
 * @param {object} p 个人资料 {gender, age, height, weight, bodyFat}
 * @returns {{bmr:number, formula:string, lbm:number|null}}
 */
function calcBMR(p) {
  let bmr, formula, lbm = null;
  if (p.bodyFat && p.bodyFat > 0 && p.bodyFat < 60) {
    // Katch-McArdle：BMR = 370 + 21.6 × 瘦体重(kg)
    lbm = p.weight * (1 - p.bodyFat / 100);
    bmr = 370 + 21.6 * lbm;
    formula = "Katch-McArdle（基于瘦体重，更适合知道体脂率/肌肉量的人）";
  } else {
    // Mifflin-St Jeor
    bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.gender === "male" ? 5 : -161);
    formula = "Mifflin-St Jeor（通用公式）";
  }
  return { bmr: Math.round(bmr), formula, lbm: lbm ? +lbm.toFixed(1) : null };
}

/**
 * 生成完整营养计划
 * @param {object} p {gender, age, height, weight, bodyFat?, activity, intensity, goal}
 * @returns 计划对象
 */
function buildPlan(p) {
  const { bmr, formula, lbm } = calcBMR(p);
  const act = ACTIVITY_LEVELS.find(a => a.id === p.activity) || ACTIVITY_LEVELS[1];
  const tdee = Math.round(bmr * act.factor);

  // ---- 目标热量 ----
  let targetKcal, kcalNote, weeklyChange;
  if (p.goal === "cut") {
    // 减脂：15-20% 热量缺口（强度越高缺口越保守，保护训练表现）
    const deficitPct = p.intensity === "advanced" ? 0.15 : p.intensity === "intermediate" ? 0.18 : 0.20;
    targetKcal = Math.round(tdee * (1 - deficitPct));
    const weeklyKg = ((tdee - targetKcal) * 7) / 7700; // 1kg脂肪≈7700kcal
    weeklyChange = `-${weeklyKg.toFixed(2)} kg/周`;
    kcalNote = `热量缺口 ${Math.round(deficitPct * 100)}%（${tdee - targetKcal} kcal/天）`;
  } else if (p.goal === "bulk") {
    // 增肌：8-15% 盈余（新手长肌肉快可以多给，高阶保守防脂肪）
    const surplusPct = p.intensity === "novice" ? 0.15 : p.intensity === "intermediate" ? 0.12 : 0.08;
    targetKcal = Math.round(tdee * (1 + surplusPct));
    const weeklyKg = ((targetKcal - tdee) * 7) / 7700;
    weeklyChange = `+${weeklyKg.toFixed(2)} kg/周`;
    kcalNote = `热量盈余 ${Math.round(surplusPct * 100)}%（+${targetKcal - tdee} kcal/天）`;
  } else {
    targetKcal = tdee;
    weeklyChange = "维持体重";
    kcalNote = "摄入 = 消耗";
  }

  // ---- 蛋白质 g/kg ----
  // 减脂期更高保肌肉；增肌期 1.8-2.2；有体脂率时按瘦体重给更精确
  let proteinPerKg;
  if (p.goal === "cut") proteinPerKg = p.intensity === "novice" ? 1.8 : 2.2;
  else if (p.goal === "bulk") proteinPerKg = p.intensity === "novice" ? 1.8 : 2.0;
  else proteinPerKg = 1.6;

  let proteinG;
  if (lbm) {
    // 按瘦体重：减脂 2.4g/kg LBM，增肌 2.2，维持 1.9
    const perLbm = p.goal === "cut" ? 2.4 : p.goal === "bulk" ? 2.2 : 1.9;
    proteinG = Math.round(lbm * perLbm);
  } else {
    proteinG = Math.round(p.weight * proteinPerKg);
  }

  // ---- 脂肪：占总热量比例（不低于 0.6g/kg 保激素水平） ----
  const fatPct = p.goal === "cut" ? 0.22 : p.goal === "bulk" ? 0.25 : 0.28;
  let fatG = Math.round((targetKcal * fatPct) / 9);
  const fatFloor = Math.round(p.weight * 0.6);
  if (fatG < fatFloor) fatG = fatFloor;

  // ---- 碳水：剩余热量 ----
  let carbG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);
  if (carbG < 50) carbG = 50; // 最低碳水保底

  // ---- 饮水 ----
  const waterMl = Math.round(p.weight * 35 + (p.activity === "active" || p.activity === "athlete" ? 500 : 0));

  // ---- 建议文案 ----
  const tips = buildTips(p, proteinG);

  return {
    bmr, formula, lbm, tdee,
    activityLabel: act.label,
    targetKcal, kcalNote, weeklyChange,
    protein: proteinG, fat: fatG, carb: carbG,
    proteinKcal: proteinG * 4, fatKcal: fatG * 9, carbKcal: carbG * 4,
    waterMl, tips,
    createdAt: Date.now()
  };
}

/** 根据目标生成个性化建议 */
function buildTips(p, proteinG) {
  const tips = [];
  const perMeal = Math.round(proteinG / 4);
  if (p.goal === "cut") {
    tips.push(`蛋白质分 4 餐吃，每餐约 ${perMeal}g，饱腹感更强、更保肌肉`);
    tips.push("优先吃够蛋白质和蔬菜，再用碳水填满剩余热量");
    tips.push("每周称重 2-3 次取平均值，连续 2 周不降再减 100-150 kcal");
    tips.push("力量训练不要停！减脂期训练量保持，重量尽量不掉");
  } else if (p.goal === "bulk") {
    tips.push(`蛋白质分 4-5 餐，每餐约 ${perMeal}g，训练后 2 小时内吃一餐`);
    tips.push("碳水集中在训练前后吃，训练表现和恢复都会更好");
    tips.push("每周体重涨幅超过 0.5% 说明脂肪长太快，减 100-200 kcal");
    tips.push("睡够 7-9 小时，睡眠不足会显著拖慢肌肉生长");
  } else {
    tips.push("保持规律三餐 + 优质蛋白，体重波动 ±1kg 属正常");
    tips.push("每周至少 2-3 次力量训练维持肌肉量");
  }
  if (p.bodyFat) tips.push(`当前瘦体重约 ${(p.weight * (1 - p.bodyFat / 100)).toFixed(1)}kg，建议每 4-6 周复测体脂调整计划`);
  else tips.push("如果知道体脂率（体脂秤/InBody），填入后计算会更精确");
  return tips;
}

/** 校验自定义食物的热量与宏量是否一致（4/4/9 法则），返回 null 或提示 */
function checkMacroConsistency(kcal, c, p, f) {
  if (!kcal || (c === 0 && p === 0 && f === 0)) return null;
  const est = c * 4 + p * 4 + f * 9;
  if (est === 0) return null;
  const diff = Math.abs(est - kcal) / Math.max(kcal, 1);
  if (diff > 0.25) {
    return `提示：按碳水×4+蛋白×4+脂肪×9 算出来约 ${Math.round(est)} kcal，和你填的 ${kcal} kcal 差得有点多，建议核对一下`;
  }
  return null;
}

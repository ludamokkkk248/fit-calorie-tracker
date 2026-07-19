/* ============================================================
 * 拍照 OCR：识别包装食品「营养成分表」
 * 使用 Tesseract.js（纯浏览器端识别，图片不会上传到任何服务器）
 * 流程：拍照/选图 → 识别文字 → 正则提取 能量/蛋白质/脂肪/碳水 → 预填表单
 * ============================================================ */
const OCR = {
  worker: null,
  loading: false,

  /** 懒加载 Tesseract worker（首次需联网下载中文语言包，之后走缓存） */
  async getWorker(onProgress) {
    if (this.worker) return this.worker;
    if (typeof Tesseract === "undefined") {
      throw new Error("识别组件未加载，请检查网络后刷新页面再试");
    }
    this.loading = true;
    const worker = await Tesseract.createWorker(["chi_sim", "eng"], 1, {
      logger: m => {
        if (onProgress && m.status && typeof m.progress === "number") {
          onProgress(m.status, m.progress);
        }
      }
    });
    this.worker = worker;
    this.loading = false;
    return worker;
  },

  /** 识别图片，返回 { text, parsed } */
  async recognize(file, onProgress) {
    const worker = await this.getWorker(onProgress);
    const img = await this.preprocess(file);
    const { data } = await worker.recognize(img);
    const text = data.text || "";
    return { text, parsed: this.parseNutrition(text) };
  },

  /** 预处理：压缩到合理尺寸 + 灰度化 + 提高对比度，识别率更高 */
  async preprocess(file) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    let { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    width = Math.round(width * scale); height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    // 灰度 + 对比度增强
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      gray = Math.min(255, Math.max(0, (gray - 128) * 1.25 + 128)); // 对比度1.25
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  },

  /**
   * 从 OCR 文本提取营养成分
   * 兼容：能量(kJ/千焦/kcal/千卡/大卡)、蛋白质、脂肪、碳水化合物
   * 自动识别「每100克/每100毫升/每份」基准并折算到每100g
   */
  parseNutrition(text) {
    const t = text.replace(/\s+/g, " ").replace(/[，,]/g, " ").replace(/[（(]/g, "(").replace(/[）)]/g, ")");
    const num = "([0-9]+(?:[.．][0-9]+)?)";
    const res = { kcal: null, c: null, p: null, f: null, per: 100, perUnit: "g", raw: {} };

    // 基准量：每100克 / 每100毫升 / 每份xx克
    let mPer = t.match(new RegExp("每\\s*100\\s*(毫升|ml|mL)", "i"));
    if (mPer) { res.per = 100; res.perUnit = "ml"; }
    else {
      mPer = t.match(new RegExp("每\\s*份[^0-9]{0,6}" + num + "\\s*(克|g|毫升|ml)", "i"));
      if (mPer) {
        res.per = parseFloat(mPer[1].replace("．", "."));
        res.perUnit = /毫升|ml/i.test(mPer[2]) ? "ml" : "g";
      }
    }

    // 能量：优先 kJ（国标营养成分表用千焦），也兼容 kcal
    const kjMatch = t.match(new RegExp("能\\s*量[^0-9]{0,10}" + num + "\\s*(?:千\\s*焦|kJ|KJ|kj)", "i"))
      || t.match(new RegExp(num + "\\s*(?:千\\s*焦|kJ|KJ)", "i"));
    const kcalMatch = t.match(new RegExp("(?:能\\s*量|热\\s*量)[^0-9]{0,10}" + num + "\\s*(?:千\\s*卡|大\\s*卡|kcal)", "i"))
      || t.match(new RegExp(num + "\\s*(?:千\\s*卡|大\\s*卡|kcal)", "i"));
    if (kcalMatch) {
      res.kcal = parseFloat(kcalMatch[1].replace("．", "."));
      res.raw.energy = kcalMatch[0];
    } else if (kjMatch) {
      const kj = parseFloat(kjMatch[1].replace("．", "."));
      res.kcal = Math.round(kj / 4.184);
      res.raw.energy = kjMatch[0] + " → 换算";
    }

    // 蛋白质 / 脂肪 / 碳水化合物（克）
    const grab = (label) => {
      const m = t.match(new RegExp(label + "[^0-9]{0,10}" + num + "\\s*(?:克|g)", "i"));
      return m ? parseFloat(m[1].replace("．", ".")) : null;
    };
    res.p = grab("蛋\\s*白\\s*质");
    res.f = grab("脂\\s*肪");
    res.c = grab("碳\\s*水\\s*化\\s*合\\s*物") ?? grab("碳\\s*水");

    // 折算到每100g/ml
    if (res.per !== 100 && res.per > 0) {
      const k = 100 / res.per;
      if (res.kcal != null) res.kcal = +(res.kcal * k).toFixed(1);
      if (res.p != null) res.p = +(res.p * k).toFixed(1);
      if (res.f != null) res.f = +(res.f * k).toFixed(1);
      if (res.c != null) res.c = +(res.c * k).toFixed(1);
    }
    res.found = [res.kcal, res.p, res.f, res.c].filter(v => v != null).length;
    return res;
  }
};

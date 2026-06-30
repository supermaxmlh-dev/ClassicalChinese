(() => {
  const Guanzhi = window.Guanzhi || {};
  const STORAGE_KEY = "guanzhi_progress";
  const COOKIE_NAME = "guanzhi_progress";
  const COOKIE_MAX_AGE = 34560000;
  const COOKIE_WARNING_BYTES = 3800;
  const PROGRESS_VERSION = 1;
  const BADGES = {
    13: "文言新秀",
    26: "古文达人",
    39: "国学小将",
    52: "观止学者"
  };

  function createDefaultProgress() {
    const date = Guanzhi.today ? Guanzhi.today() : new Date().toISOString().slice(0, 10);
    return {
      version: PROGRESS_VERSION,
      studentName: "",
      completedArticles: [],
      completedWeeks: [],
      quizScores: {},
      reviewPassed: [],
      badges: [],
      vocabLearned: 0,
      lastVisit: date,
      currentWeek: 1,
      createdAt: date,
      exportedAt: null
    };
  }

  function today() {
    return Guanzhi.today ? Guanzhi.today() : new Date().toISOString().slice(0, 10);
  }

  function readCookie(name) {
    const cookieSource = typeof document === "undefined" ? "" : document.cookie || "";
    const prefix = `${name}=`;
    const cookie = cookieSource.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
    if (!cookie) return "";
    try {
      return decodeURIComponent(cookie.slice(prefix.length));
    } catch (error) {
      return "";
    }
  }

  function writeCookie(name, value) {
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
    return encoded.length;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
  }

  function toPositiveInteger(value) {
    const number = Number(String(value).replace(/^0+/, ""));
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  function toArticleId(value) {
    const number = toPositiveInteger(value);
    return number ? String(number).padStart(3, "0") : null;
  }

  function compactIdList(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(toPositiveInteger)
      .filter(Boolean))];
  }

  function encodeNumberList(values) {
    const numbers = compactIdList(values).sort((a, b) => a - b);
    const ranges = [];
    for (let index = 0; index < numbers.length; index += 1) {
      const start = numbers[index];
      let end = start;
      while (numbers[index + 1] === end + 1) {
        end = numbers[index + 1];
        index += 1;
      }
      ranges.push(start === end ? start.toString(36) : `${start.toString(36)}-${end.toString(36)}`);
    }
    return ranges.join(".");
  }

  function decodeNumberList(value) {
    if (Array.isArray(value)) return compactIdList(value);
    if (!value || typeof value !== "string") return [];
    return value.split(".").flatMap((part) => {
      const [startRaw, endRaw] = part.split("-");
      const start = parseInt(startRaw, 36);
      const end = endRaw ? parseInt(endRaw, 36) : start;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) return [];
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    });
  }

  function encodeQuizScores(scores) {
    return Object.entries(scores).map(([key, score]) => {
      const numericScore = Math.max(0, Math.round(Number(score) || 0)).toString(36);
      const reviewMatch = String(key).match(/^review-(\d+)$/);
      if (reviewMatch) return `r${Number(reviewMatch[1]).toString(36)}-${numericScore}`;
      const articleNumber = toPositiveInteger(key);
      return articleNumber ? `${articleNumber.toString(36)}-${numericScore}` : "";
    }).filter(Boolean).join(".");
  }

  function decodeQuizScores(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (!value || typeof value !== "string") return {};
    return value.split(".").reduce((scores, part) => {
      const [keyRaw, scoreRaw] = part.split("-");
      const score = parseInt(scoreRaw, 36);
      if (!keyRaw || !Number.isFinite(score)) return scores;
      const reviewMatch = keyRaw.match(/^r([0-9a-z]+)$/);
      if (reviewMatch) {
        scores[`review-${parseInt(reviewMatch[1], 36)}`] = score;
        return scores;
      }
      const articleNumber = parseInt(keyRaw, 36);
      if (Number.isInteger(articleNumber) && articleNumber > 0) {
        scores[String(articleNumber).padStart(3, "0")] = score;
      }
      return scores;
    }, {});
  }

  function compact(progress) {
    const normalized = normalizeProgress(progress);
    return {
      v: normalized.version,
      n: normalized.studentName,
      a: encodeNumberList(normalized.completedArticles),
      w: encodeNumberList(normalized.completedWeeks),
      q: encodeQuizScores(normalized.quizScores),
      r: encodeNumberList(normalized.reviewPassed),
      b: normalized.badges,
      vl: Number(normalized.vocabLearned) || 0,
      cw: Number(normalized.currentWeek) || 1,
      lv: normalized.lastVisit,
      ca: normalized.createdAt,
      ea: normalized.exportedAt || null
    };
  }

  function expand(compactObj) {
    if (!compactObj || typeof compactObj !== "object") return compactObj;
    if ("version" in compactObj || "completedArticles" in compactObj) return compactObj;

    const quizScores = {};
    Object.entries(decodeQuizScores(compactObj.q)).forEach(([key, score]) => {
      const reviewMatch = String(key).match(/^r(\d+)$/);
      if (reviewMatch) {
        quizScores[`review-${Number(reviewMatch[1])}`] = score;
        return;
      }
      const articleId = toArticleId(key);
      quizScores[articleId || key] = score;
    });

    return {
      version: compactObj.v,
      studentName: compactObj.n || "",
      completedArticles: decodeNumberList(compactObj.a).map(toArticleId).filter(Boolean),
      completedWeeks: decodeNumberList(compactObj.w),
      quizScores,
      reviewPassed: decodeNumberList(compactObj.r),
      badges: Array.isArray(compactObj.b) ? compactObj.b : [],
      vocabLearned: Number(compactObj.vl) || 0,
      currentWeek: Number(compactObj.cw) || 1,
      lastVisit: compactObj.lv,
      createdAt: compactObj.ca,
      exportedAt: compactObj.ea || null
    };
  }

  function normalizeProgress(progress) {
    const fallback = createDefaultProgress();
    const merged = { ...fallback, ...(progress || {}) };
    merged.version = Number(merged.version) || PROGRESS_VERSION;
    merged.studentName = typeof merged.studentName === "string" ? merged.studentName : "";
    merged.completedArticles = Array.isArray(merged.completedArticles)
      ? [...new Set(merged.completedArticles.map(toArticleId).filter(Boolean))]
      : [];
    merged.completedWeeks = compactIdList(merged.completedWeeks);
    merged.quizScores = merged.quizScores && typeof merged.quizScores === "object" ? merged.quizScores : {};
    merged.reviewPassed = compactIdList(merged.reviewPassed);
    merged.badges = Array.isArray(merged.badges) ? merged.badges : [];
    merged.currentWeek = Number(merged.currentWeek) || 1;
    merged.vocabLearned = Number(merged.vocabLearned) || 0;
    return merged;
  }

  function getProgress() {
    try {
      const value = readCookie(COOKIE_NAME);
      if (!value) return createDefaultProgress();
      return normalizeProgress(expand(JSON.parse(value)));
    } catch (error) {
      return createDefaultProgress();
    }
  }

  function saveProgress(progress) {
    const normalized = normalizeProgress(progress);
    normalized.lastVisit = today();
    const cookieValue = JSON.stringify(compact(normalized));
    const encodedLength = encodeURIComponent(cookieValue).length;
    if (encodedLength > COOKIE_WARNING_BYTES) {
      console.warn(`观止学堂进度 cookie 已接近容量上限：${encodedLength} bytes`);
      window.dispatchEvent(new CustomEvent("guanzhi:progress-too-large", {
        detail: { bytes: encodedLength, limit: COOKIE_WARNING_BYTES }
      }));
    }
    writeCookie(COOKIE_NAME, cookieValue);
    window.dispatchEvent(new CustomEvent("guanzhi:progress-change", { detail: normalized }));
    return normalized;
  }

  function getProgressCookieBytes(progress = getProgress()) {
    return encodeURIComponent(JSON.stringify(compact(progress))).length;
  }

  function isProgressCookieLarge(progress = getProgress()) {
    return getProgressCookieBytes(progress) > COOKIE_WARNING_BYTES;
  }

  function migrateLocalStorageProgress() {
    if (readCookie(COOKIE_NAME)) return;
    try {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (!legacy) return;
      saveProgress(JSON.parse(legacy));
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("旧版进度迁移失败，已改用 cookie 作为进度来源。");
    }
  }

  function updateProgress(updater) {
    const progress = getProgress();
    const next = updater(progress) || progress;
    return saveProgress(next);
  }

  function hasArticleScore(progress, id) {
    return Number.isFinite(Number(progress.quizScores?.[id]));
  }

  function isArticleLearned(progress, id) {
    return progress.completedArticles.includes(id) || hasArticleScore(progress, id);
  }

  function findCurrentWeek(progress, indexData) {
    const weeks = Array.isArray(indexData?.weeks) ? indexData.weeks : [];
    const next = weeks.find((week) => {
      const articleIds = week.articleIds || [];
      return !week.isReview && articleIds.length > 0 && !articleIds.every((articleId) => isArticleLearned(progress, articleId));
    });
    return next ? next.week : 52;
  }

  function plannedArticleIds(indexData) {
    return (indexData?.weeks || []).flatMap((week) => week.articleIds || []);
  }

  function syncCompletionBadges(progress, indexData) {
    const plannedIds = plannedArticleIds(indexData);
    const completedPlanned = plannedIds.filter((id) => isArticleLearned(progress, id)).length;
    if (plannedIds.length && completedPlanned >= plannedIds.length && !progress.badges.includes(BADGES[52])) {
      progress.badges.push(BADGES[52]);
    }
  }

  function syncCompletedWeeks(progress, indexData) {
    if (!indexData) return;
    (indexData.weeks || []).forEach((week) => {
      if (week.isReview || !(week.articleIds || []).length) return;
      const done = week.articleIds.every((articleId) => isArticleLearned(progress, articleId));
      if (done && !progress.completedWeeks.includes(week.week)) {
        progress.completedWeeks.push(week.week);
      }
    });
  }

  function markArticleComplete(id, indexData = null) {
    return updateProgress((progress) => {
      if (!progress.completedArticles.includes(id)) {
        progress.completedArticles.push(id);
      }
      if (indexData) {
        const week = indexData.weeks.find((item) => item.articleIds.includes(id));
        if (week) {
          const done = week.articleIds.length > 0 && week.articleIds.every((articleId) => isArticleLearned(progress, articleId));
          if (done && !progress.completedWeeks.includes(week.week)) {
            progress.completedWeeks.push(week.week);
          }
          progress.currentWeek = findCurrentWeek(progress, indexData);
          syncCompletionBadges(progress, indexData);
        }
      }
      return progress;
    });
  }

  function isArticleComplete(id) {
    return isArticleLearned(getProgress(), id);
  }

  function markWeekComplete(week) {
    return updateProgress((progress) => {
      const weekNumber = Number(week);
      if (!progress.completedWeeks.includes(weekNumber)) {
        progress.completedWeeks.push(weekNumber);
      }
      progress.currentWeek = Math.min(52, Math.max(progress.currentWeek, weekNumber + 1));
      return progress;
    });
  }

  function saveQuizScore(id, score) {
    return updateProgress((progress) => {
      progress.quizScores[id] = Number(score) || 0;
      if (/^\d{3}$/.test(id) && !progress.completedArticles.includes(id)) {
        progress.completedArticles.push(id);
      }
      return progress;
    });
  }

  function getQuizScore(id) {
    return getProgress().quizScores[id] || 0;
  }

  function awardBadge(name) {
    return updateProgress((progress) => {
      if (!progress.badges.includes(name)) progress.badges.push(name);
      return progress;
    });
  }

  function passReview(week, score) {
    return updateProgress((progress) => {
      const weekNumber = Number(week);
      if (!progress.reviewPassed.includes(weekNumber)) progress.reviewPassed.push(weekNumber);
      if (BADGES[weekNumber] && !progress.badges.includes(BADGES[weekNumber])) {
        progress.badges.push(BADGES[weekNumber]);
      }
      progress.quizScores[`review-${weekNumber}`] = Number(score) || 0;
      progress.currentWeek = Math.min(52, Math.max(progress.currentWeek, weekNumber + 1));
      return progress;
    });
  }

  function exportProgress() {
    const progress = getProgress();
    progress.exportedAt = new Date().toISOString();
    const saved = saveProgress(progress);
    const name = progress.studentName || "学生";
    const date = today();
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-观止学堂进度-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importProgress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (!data.version || !Array.isArray(data.completedArticles)) {
            reject(new Error("进度文件格式不正确"));
            return;
          }
          if (!data.completedArticles.every((id) => toArticleId(id))) {
            reject(new Error("进度文件中的文章编号不正确"));
            return;
          }
          if (data.version > PROGRESS_VERSION) {
            reject(new Error("进度文件版本较新，请更新网站后再导入"));
            return;
          }
          resolve(saveProgress(data));
        } catch (error) {
          reject(new Error("无法解析进度文件"));
        }
      };
      reader.onerror = () => reject(new Error("无法读取进度文件"));
      reader.readAsText(file);
    });
  }

  function shouldShowBackupReminder() {
    const progress = getProgress();
    const learnedCount = new Set([
      ...progress.completedArticles,
      ...Object.keys(progress.quizScores).filter((id) => /^\d{3}$/.test(id))
    ]).size;
    if (!learnedCount) return false;
    const last = progress.exportedAt || progress.createdAt;
    const lastTime = new Date(last).getTime();
    if (!lastTime) return false;
    const days = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);
    return days >= 14;
  }

  function getStats(indexData) {
    const progress = getProgress();
    syncCompletedWeeks(progress, indexData);
    const plannedIds = plannedArticleIds(indexData);
    const total = indexData?.plannedArticleCount || plannedIds.length || indexData?.targetArticleCount || 222;
    const targetTotal = indexData?.targetArticleCount || total;
    const completed = plannedIds.length
      ? plannedIds.filter((id) => isArticleLearned(progress, id)).length
      : new Set([...progress.completedArticles, ...Object.keys(progress.quizScores).filter((id) => /^\d{3}$/.test(id))]).size;
    const scores = Object.values(progress.quizScores).filter((score) => Number.isFinite(Number(score)));
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + Number(score), 0) / scores.length)
      : 0;
    return {
      completed,
      total,
      targetTotal,
      percent: Guanzhi.percent(completed, total),
      completedWeeks: progress.completedWeeks.length,
      currentWeek: indexData ? findCurrentWeek(progress, indexData) : progress.currentWeek,
      badges: progress.badges,
      vocabLearned: progress.vocabLearned,
      averageScore
    };
  }

  Guanzhi.Progress = {
    STORAGE_KEY,
    COOKIE_NAME,
    BADGES,
    getProgress,
    saveProgress,
    updateProgress,
    markArticleComplete,
    isArticleComplete,
    isArticleLearned,
    hasArticleScore,
    markWeekComplete,
    saveQuizScore,
    getQuizScore,
    awardBadge,
    passReview,
    exportProgress,
    importProgress,
    shouldShowBackupReminder,
    getStats,
    findCurrentWeek,
    plannedArticleIds,
    compact,
    expand,
    readCookie,
    writeCookie,
    deleteCookie,
    getProgressCookieBytes,
    isProgressCookieLarge
  };

  window.Guanzhi = Guanzhi;
  migrateLocalStorageProgress();
})();

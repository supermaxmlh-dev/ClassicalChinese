(() => {
  const Guanzhi = window.Guanzhi || {};
  const STORAGE_KEY = "guanzhi_progress";
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

  function normalizeProgress(progress) {
    const fallback = createDefaultProgress();
    const merged = { ...fallback, ...(progress || {}) };
    merged.completedArticles = Array.isArray(merged.completedArticles) ? merged.completedArticles : [];
    merged.completedWeeks = Array.isArray(merged.completedWeeks) ? merged.completedWeeks : [];
    merged.quizScores = merged.quizScores && typeof merged.quizScores === "object" ? merged.quizScores : {};
    merged.reviewPassed = Array.isArray(merged.reviewPassed) ? merged.reviewPassed : [];
    merged.badges = Array.isArray(merged.badges) ? merged.badges : [];
    merged.currentWeek = Number(merged.currentWeek) || 1;
    return merged;
  }

  function getProgress() {
    try {
      return normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (error) {
      return createDefaultProgress();
    }
  }

  function saveProgress(progress) {
    const normalized = normalizeProgress(progress);
    normalized.lastVisit = Guanzhi.today ? Guanzhi.today() : new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("guanzhi:progress-change", { detail: normalized }));
    return normalized;
  }

  function updateProgress(updater) {
    const progress = getProgress();
    const next = updater(progress) || progress;
    return saveProgress(next);
  }

  function markArticleComplete(id, indexData = null) {
    return updateProgress((progress) => {
      if (!progress.completedArticles.includes(id)) {
        progress.completedArticles.push(id);
      }
      if (indexData) {
        const week = indexData.weeks.find((item) => item.articleIds.includes(id));
        if (week) {
          const done = week.articleIds.length > 0 && week.articleIds.every((articleId) => progress.completedArticles.includes(articleId));
          if (done && !progress.completedWeeks.includes(week.week)) {
            progress.completedWeeks.push(week.week);
          }
          progress.currentWeek = Math.min(52, Math.max(progress.currentWeek, week.week + 1));
        }
      }
      return progress;
    });
  }

  function isArticleComplete(id) {
    return getProgress().completedArticles.includes(id);
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
    saveProgress(progress);
    const name = progress.studentName || "学生";
    const date = Guanzhi.today ? Guanzhi.today() : new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
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
    if (!progress.completedArticles.length) return false;
    const last = progress.exportedAt || progress.createdAt;
    const lastTime = new Date(last).getTime();
    if (!lastTime) return false;
    const days = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);
    return days >= 14;
  }

  function getStats(indexData) {
    const progress = getProgress();
    const total = indexData?.targetArticleCount || 222;
    const completed = progress.completedArticles.length;
    const scores = Object.values(progress.quizScores).filter((score) => Number.isFinite(Number(score)));
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + Number(score), 0) / scores.length)
      : 0;
    return {
      completed,
      total,
      percent: Guanzhi.percent(completed, total),
      completedWeeks: progress.completedWeeks.length,
      currentWeek: progress.currentWeek,
      badges: progress.badges,
      vocabLearned: progress.vocabLearned,
      averageScore
    };
  }

  Guanzhi.Progress = {
    STORAGE_KEY,
    BADGES,
    getProgress,
    saveProgress,
    updateProgress,
    markArticleComplete,
    isArticleComplete,
    markWeekComplete,
    saveQuizScore,
    getQuizScore,
    awardBadge,
    passReview,
    exportProgress,
    importProgress,
    shouldShowBackupReminder,
    getStats
  };

  window.Guanzhi = Guanzhi;
})();

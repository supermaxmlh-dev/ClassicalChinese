(() => {
  const G = window.Guanzhi;
  const letters = ["A", "B", "C", "D", "E"];

  function renderChoices(choices, state) {
    return (choices || []).map((item, index) => `
      <div class="quiz-item" data-kind="choice" data-index="${index}">
        <h3>${index + 1}. ${G.escapeHTML(item.question)}</h3>
        <div class="option-list">
          ${(item.options || []).map((option, optionIndex) => `
            <button class="option" type="button" data-answer="${optionIndex}">
              <strong>${letters[optionIndex]}.</strong> ${G.escapeHTML(option)}
            </button>
          `).join("")}
        </div>
        <div class="feedback"></div>
      </div>
    `).join("");
  }

  function renderFillStem(item) {
    const stem = item.stem || item.question || "";
    const targetChar = item.targetChar || "";
    const targetIndex = Number(item.targetIndex);
    if (!targetChar || !Number.isInteger(targetIndex) || targetIndex < 0) {
      return G.escapeHTML(stem);
    }
    const before = stem.slice(0, targetIndex);
    const target = stem.slice(targetIndex, targetIndex + targetChar.length);
    const after = stem.slice(targetIndex + targetChar.length);
    return `${G.escapeHTML(before)}<span class="dot-emphasis">${G.escapeHTML(target)}</span>${G.escapeHTML(after)} → ______`;
  }

  function renderFillBlanks(fillBlanks, offset) {
    return (fillBlanks || []).map((item, index) => `
      <div class="quiz-item" data-kind="fill" data-index="${index}">
        <h3>${offset + index + 1}. ${renderFillStem(item)}</h3>
        <div class="fill-row">
          <input class="fill-input" placeholder="请输入答案">
          <button class="btn" type="button">提交</button>
        </div>
        <div class="feedback"></div>
      </div>
    `).join("");
  }

  function renderShortAnswer(shortAnswer, offset, title = "简答题") {
    if (!shortAnswer?.length) return "";
    return `
      <h3>${title}</h3>
      ${shortAnswer.map((item, index) => `
        <details class="quiz-item">
          <summary>${offset + index + 1}. ${G.escapeHTML(item.question)}</summary>
          <p><strong>参考答案：</strong>${G.escapeHTML(item.sampleAnswer || item.answer || "")}</p>
        </details>
      `).join("")}
    `;
  }

  function computeScore(container) {
    const items = G.qsa(".quiz-item[data-kind]", container);
    const answered = items.filter((item) => item.dataset.done === "true");
    const correct = answered.filter((item) => item.dataset.correct === "true");
    if (answered.length < items.length) return null;
    return Math.round((correct.length / Math.max(1, items.length)) * 100);
  }

  function updateScore(container, articleId) {
    const score = computeScore(container);
    const scoreBox = G.qs(".quiz-score", container);
    if (score === null) {
      scoreBox.textContent = "完成选择题和填空题后会显示得分。";
      return;
    }
    const message = score >= 85 ? "很稳，再读一遍原文就更扎实。" : score >= 60 ? "已经过关，错题可以回到注释里找答案。" : "建议先重读导读和逐句精读。";
    scoreBox.textContent = `本次得分：${score} 分。${message}`;
    if (articleId) G.Progress.saveQuizScore(articleId, score);
  }

  function bindQuiz(container, quiz, articleId) {
    G.qsa('.quiz-item[data-kind="choice"]', container).forEach((item) => {
      const question = quiz.choices[Number(item.dataset.index)];
      G.qsa(".option", item).forEach((button) => {
        button.addEventListener("click", () => {
          if (item.dataset.done === "true") return;
          const selected = Number(button.dataset.answer);
          const correct = Number(question.answerIndex);
          const ok = selected === correct;
          item.dataset.done = "true";
          item.dataset.correct = String(ok);
          G.qsa(".option", item).forEach((option) => {
            option.disabled = true;
            if (Number(option.dataset.answer) === correct) option.classList.add("correct");
          });
          button.classList.add(ok ? "correct" : "wrong");
          const feedback = G.qs(".feedback", item);
          feedback.className = `feedback ${ok ? "success" : "error"}`;
          feedback.textContent = `${ok ? "答对了！" : "再想想。"} ${question.explanation || ""}`;
          updateScore(container, articleId);
        });
      });
    });

    G.qsa('.quiz-item[data-kind="fill"]', container).forEach((item) => {
      const question = quiz.fillBlanks[Number(item.dataset.index)];
      const input = G.qs("input", item);
      G.qs("button", item).addEventListener("click", () => {
        if (item.dataset.done === "true") return;
        const ok = input.value.trim() === String(question.blank || question.answer || "").trim();
        item.dataset.done = "true";
        item.dataset.correct = String(ok);
        input.classList.add(ok ? "correct" : "wrong");
        input.disabled = true;
        const feedback = G.qs(".feedback", item);
        feedback.className = `feedback ${ok ? "success" : "error"}`;
        feedback.textContent = ok ? "填对了！" : `正确答案：${question.blank || question.answer}`;
        updateScore(container, articleId);
      });
    });
  }

  function renderArticleQuiz(container, quiz = {}, articleId) {
    if (!container) return;
    const choices = quiz.choices || [];
    const fillBlanks = quiz.fillBlanks || [];
    container.innerHTML = `
      <div class="quiz-list">
        ${choices.length ? `<h3>选择题</h3>${renderChoices(choices)}` : ""}
        ${fillBlanks.length ? `<h3>填空题</h3>${renderFillBlanks(fillBlanks, choices.length)}` : ""}
        ${renderShortAnswer(quiz.shortAnswer || [], choices.length + fillBlanks.length)}
        ${renderShortAnswer(quiz.challenge || [], choices.length + fillBlanks.length + (quiz.shortAnswer || []).length, "挑战题（选做）")}
        <div class="quiz-score">完成选择题和填空题后会显示得分。</div>
      </div>
    `;
    bindQuiz(container, { choices, fillBlanks }, articleId);
  }

  function renderReview(container, review, week) {
    const quiz = {
      choices: review.questions || [],
      fillBlanks: []
    };
    container.innerHTML = `
      <div class="quiz-list">
        ${renderChoices(quiz.choices)}
        <button id="submit-review" class="btn primary" type="button">提交测评</button>
        <div class="quiz-score">完成题目后提交。</div>
      </div>
    `;
    bindQuiz(container, quiz, null);
    G.qs("#submit-review", container).addEventListener("click", () => {
      const score = computeScore(container) || 0;
      const box = G.qs(".quiz-score", container);
      if (score >= review.passScore) {
        G.Progress.passReview(week, score);
        box.textContent = `测评得分：${score} 分，已达标并解锁称号。`;
      } else {
        box.textContent = `测评得分：${score} 分，暂未达标，可以复习后再试。`;
      }
    });
  }

  G.Quiz = { renderArticleQuiz, renderReview };
  window.Guanzhi = G;
})();

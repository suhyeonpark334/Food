(() => {
  "use strict";

  /* ============================================================
     State
     ============================================================ */
  const STORAGE_KEY = "sumtreum.v1";

  const steps = ["welcome", "profile", "trigger", "snacks", "plan", "summary", "dashboard"];
  // onboarding steps that count toward the progress bar
  const formSteps = ["profile", "trigger", "snacks", "plan", "summary"];

  let current = "welcome";

  const state = {
    age: null,
    gender: null,
    years: null,
    quitDaysAtSignup: null,
    triggers: [],
    dailyCount: null,
    snacks: { dairy: [], crunch: [], drink: [] },
    frequency: null,
    trial: null,
    quitStartISO: null // computed at confirm time
  };

  /* ============================================================
     DOM refs
     ============================================================ */
  const screens = Array.from(document.querySelectorAll(".screen"));
  const navBar = document.getElementById("navBar");
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const progress = document.getElementById("progress");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");

  /* ============================================================
     Screen navigation
     ============================================================ */
  function showScreen(name) {
    current = name;
    screens.forEach(s => s.classList.toggle("active", s.dataset.screen === name));

    const isForm = formSteps.includes(name);
    navBar.hidden = !isForm;
    progress.hidden = !isForm;

    if (isForm) {
      const idx = formSteps.indexOf(name);
      progressFill.style.width = `${((idx + 1) / formSteps.length) * 100}%`;
      progressLabel.textContent = `${idx + 1} / ${formSteps.length}`;
      backBtn.style.visibility = "visible";
      nextBtn.textContent = name === "summary" ? "" : "다음";
      nextBtn.hidden = name === "summary";
    }

    if (name === "summary") renderSummary();
    if (name === "dashboard") renderDashboard();

    window.scrollTo(0, 0);
  }

  document.getElementById("startBtn").addEventListener("click", () => showScreen("profile"));

  backBtn.addEventListener("click", () => {
    const idx = formSteps.indexOf(current);
    if (idx <= 0) { showScreen("welcome"); return; }
    showScreen(formSteps[idx - 1]);
  });

  nextBtn.addEventListener("click", () => {
    if (!validateStep(current)) return;
    const idx = formSteps.indexOf(current);
    showScreen(formSteps[idx + 1]);
  });

  document.getElementById("confirmBtn").addEventListener("click", () => {
    // anchor quit-start date using the days-since-quit the user reported at signup
    const daysAlready = Number(state.quitDaysAtSignup) || 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - daysAlready);
    state.quitStartISO = start.toISOString();

    saveState();
    showScreen("dashboard");
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("처음부터 다시 설정할까요? 지금까지의 기록은 사라져요.")) return;
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, {
      age: null, gender: null, years: null, quitDaysAtSignup: null,
      triggers: [], dailyCount: null,
      snacks: { dairy: [], crunch: [], drink: [] },
      frequency: null, trial: null, quitStartISO: null
    });
    resetAllSelections();
    showScreen("welcome");
  });

  /* ============================================================
     Selection widgets (chips / option-cards / trial cards)
     ============================================================ */
  function bindSingleSelect(selector, onPick) {
    document.querySelectorAll(selector).forEach(group => {
      group.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        group.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        onPick(btn.dataset.value);
      });
    });
  }

  function bindMultiSelect(selector, onToggle) {
    document.querySelectorAll(selector).forEach(group => {
      group.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        btn.classList.toggle("selected");
        onToggle(btn.dataset.value, btn.classList.contains("selected"));
      });
    });
  }

  bindSingleSelect('[data-group="gender"]', v => (state.gender = v));
  bindMultiSelect('[data-group="triggers"]', (v, on) => toggleArr(state.triggers, v, on));
  bindMultiSelect('[data-group="snack-dairy"]', (v, on) => toggleArr(state.snacks.dairy, v, on));
  bindMultiSelect('[data-group="snack-crunch"]', (v, on) => toggleArr(state.snacks.crunch, v, on));
  bindMultiSelect('[data-group="snack-drink"]', (v, on) => toggleArr(state.snacks.drink, v, on));
  bindSingleSelect('[data-group="frequency"]', v => (state.frequency = Number(v)));
  bindSingleSelect('[data-group="trial"]', v => (state.trial = Number(v)));

  function toggleArr(arr, value, on) {
    const i = arr.indexOf(value);
    if (on && i === -1) arr.push(value);
    if (!on && i !== -1) arr.splice(i, 1);
  }

  document.getElementById("age").addEventListener("input", e => (state.age = e.target.value));
  document.getElementById("years").addEventListener("input", e => (state.years = e.target.value));
  document.getElementById("quitDays").addEventListener("input", e => (state.quitDaysAtSignup = e.target.value));
  document.getElementById("dailyCount").addEventListener("input", e => (state.dailyCount = e.target.value));

  function resetAllSelections() {
    document.querySelectorAll(".chip.selected, .option-card.selected, .trial-card.selected")
      .forEach(el => el.classList.remove("selected"));
    ["age", "years", "quitDays", "dailyCount"].forEach(id => (document.getElementById(id).value = ""));
  }

  /* ============================================================
     Validation
     ============================================================ */
  function validateStep(name) {
    if (name === "profile") {
      if (!state.age || !state.gender || state.years === null || state.quitDaysAtSignup === null || state.quitDaysAtSignup === "") {
        alert("모든 항목을 입력해 주세요.");
        return false;
      }
    }
    if (name === "trigger") {
      if (state.triggers.length === 0) {
        alert("최소 한 가지 트리거 시간대를 선택해 주세요.");
        return false;
      }
      if (!state.dailyCount) {
        alert("하루 평균 흡연량을 입력해 주세요.");
        return false;
      }
    }
    if (name === "snacks") {
      const total = state.snacks.dairy.length + state.snacks.crunch.length + state.snacks.drink.length;
      if (total === 0) {
        alert("받고 싶은 스낵을 한 가지 이상 선택해 주세요.");
        return false;
      }
    }
    if (name === "plan") {
      if (!state.frequency || !state.trial) {
        alert("배송 횟수와 체험 기간을 선택해 주세요.");
        return false;
      }
    }
    return true;
  }

  /* ============================================================
     Summary render
     ============================================================ */
  function renderSummary() {
    const allSnacks = [...state.snacks.dairy, ...state.snacks.crunch, ...state.snacks.drink];
    const rows = [
      ["트리거 시간대", state.triggers.join(", ")],
      ["하루 평균 흡연량", `${state.dailyCount}개비 (금연 전 기준)`],
      ["선택한 스낵", allSnacks.join(", ")],
      ["하루 배송 횟수", `${state.frequency}회`],
      ["체험 기간", `${state.trial}일`],
      ["금연 시작", state.quitDaysAtSignup > 0 ? `${state.quitDaysAtSignup}일 전` : "오늘"]
    ];
    const card = document.getElementById("summaryCard");
    card.innerHTML = rows
      .map(([label, value]) => `
        <div class="summary-row">
          <span class="label">${label}</span>
          <span class="value">${escapeHtml(String(value))}</span>
        </div>`)
      .join("");
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  /* ============================================================
     Dashboard render
     ============================================================ */
  const TIME_MAP = {
    "식사 후": { time: "식사 후", icon: "🍚" },
    "출근·등교길": { time: "출근길", icon: "🚶" },
    "업무·야근 스트레스": { time: "업무 중", icon: "💼" },
    "커피 마실 때": { time: "커피 타임", icon: "☕" },
    "술자리·모임": { time: "저녁 모임", icon: "🍻" },
    "잠들기 전": { time: "잠들기 전", icon: "🌙" }
  };

  const ENCOURAGE = [
    "오늘 넘긴 순간 하나가 내일의 습관이 돼요.",
    "충동은 파도예요. 몇 분만 버티면 지나가요.",
    "이미 몸이 회복되고 있어요, 눈에 보이지 않을 뿐.",
    "여기까지 온 것만으로도 잘하고 있는 거예요.",
    "오늘 하루만 생각해요. 그거면 충분해요."
  ];

  function daysSinceQuit() {
    if (!state.quitStartISO) return 1;
    const start = new Date(state.quitStartISO);
    const now = new Date();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }

  function growthStageFor(day, trial) {
    const ratio = day / trial;
    if (ratio < 0.25) return { icon: "🌱", name: "씨앗을 심었어요" };
    if (ratio < 0.6) return { icon: "🌿", name: "새싹이 자라고 있어요" };
    if (ratio < 1) return { icon: "🍃", name: "잎이 무성해지고 있어요" };
    return { icon: "🌳", name: "튼튼한 나무가 됐어요" };
  }

  function renderDashboard() {
    const day = daysSinceQuit();
    document.getElementById("dayCountNum").textContent = day;

    const trial = state.trial || 14;
    const stage = growthStageFor(day, trial);
    document.getElementById("growthIcon").textContent = stage.icon;
    document.getElementById("growthName").textContent = stage.name;
    document.getElementById("growthBarFill").style.width = `${Math.min(100, (day / trial) * 100)}%`;
    document.getElementById("growthGoal").textContent =
      day >= trial ? `${trial}일 목표를 달성했어요` : `${trial}일 목표까지 ${trial - day}일 남았어요`;

    document.getElementById("dashGreeting").textContent =
      day <= 3 ? "가장 힘든 고비를 지나는 중이에요" : day <= 7 ? "고비를 잘 넘기고 있어요" : "습관이 자리 잡고 있어요";

    // schedule: distribute snacks across chosen trigger times, matching daily frequency
    const allSnacks = [...state.snacks.dairy, ...state.snacks.crunch, ...state.snacks.drink];
    const freq = state.frequency || Math.min(state.triggers.length, 3) || 1;
    const slots = (state.triggers.length ? state.triggers : ["식사 후"]).slice(0, freq);
    // if fewer triggers than freq, repeat cycle
    while (slots.length < freq) slots.push(state.triggers[slots.length % state.triggers.length]);

    const list = document.getElementById("scheduleList");
    list.innerHTML = slots
      .map((trig, i) => {
        const meta = TIME_MAP[trig] || { time: trig, icon: "🕒" };
        const snack = allSnacks.length ? allSnacks[i % allSnacks.length] : "물 한 잔";
        return `
          <li>
            <span class="sch-icon">${meta.icon}</span>
            <span class="sch-body">
              <span class="sch-time">${escapeHtml(meta.time)}</span>
              <span class="sch-item">${escapeHtml(snack)}</span>
            </span>
          </li>`;
      })
      .join("");

    document.getElementById("encourageLine").textContent = ENCOURAGE[day % ENCOURAGE.length];
  }

  /* ============================================================
     Persistence
     ============================================================ */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — app still works for this session */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      Object.assign(state, saved);
      return Boolean(state.quitStartISO);
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     Init
     ============================================================ */
  const hasSavedPlan = loadState();
  showScreen(hasSavedPlan ? "dashboard" : "welcome");
})();

const STORAGE_KEYS = {
  token: "fitnessplan_token",
  user: "fitnessplan_user",
  currentPlan: "fitnessplan_current_plan",
  legacyPlan: "fitnessplan_latest_plan",
  plannerDraft: "fitnessplan_planner_draft",
  trackerPrefix: "fitnessplan_tracker_"
};

const API_BASE = "https://fitnessplan-api.cosmowind2013.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {
  const page = detectPage();

  if (page === "planner") {
    initPlanner();
  }

  if (page === "dashboard") {
    await initDashboard();
  }
});

function detectPage() {
  const explicit = document.body?.dataset?.page || "";
  if (explicit) return explicit;
  if (byId("plannerForm") && byId("schedulePreview")) return "planner";
  if (byId("todayBox") && byId("weekTrackerBox")) return "dashboard";
  return "";
}

function byId(id) {
  return document.getElementById(id);
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function safeText(value, fallback = "Not set yet") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function unique(values) {
  return [...new Set(values)];
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseTimeToSeconds(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parts = text.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return null;
}

function formatSeconds(totalSeconds) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

function parseFirstNumber(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function formatDateLabel(dateLike) {
  const date = typeof dateLike === "string" ? new Date(`${dateLike}T12:00:00`) : dateLike;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Date not set";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toISODate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  return date;
}

function setStatus(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.className = "status-box";
  if (type) el.classList.add(type);
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

function getCurrentToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || "";
}

function savePlannerDraft(draft) {
  localStorage.setItem(STORAGE_KEYS.plannerDraft, JSON.stringify(draft));
}

function getPlannerDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.plannerDraft) || "null");
  } catch {
    return null;
  }
}

function cachePlanLocally(plan) {
  const serialized = JSON.stringify(plan);
  localStorage.setItem(STORAGE_KEYS.currentPlan, serialized);
  localStorage.setItem(STORAGE_KEYS.legacyPlan, serialized);
}

function readLocalPlanCache() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.currentPlan) ||
      localStorage.getItem(STORAGE_KEYS.legacyPlan) ||
      "null";
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function tryPostJSON(paths, payload) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (response.ok) {
        return data;
      }

      lastError = new Error(`POST ${path} failed: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Request failed");
}

async function tryGetJSON(paths, query = {}) {
  let lastError = null;

  for (const path of paths) {
    try {
      const url = new URL(`${API_BASE}${path}`);
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });

      const response = await fetch(url.toString(), {
        method: "GET"
      });

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (response.ok) {
        return data;
      }

      lastError = new Error(`GET ${path} failed: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Request failed");
}

async function saveCurrentPlan(plan) {
  cachePlanLocally(plan);

  const user = getCurrentUser();
  if (!user || !user.email) return;

  try {
    await tryPostJSON(
      ["/save-plan", "/savePlan"],
      {
        email: user.email,
        plan
      }
    );
  } catch (error) {
    console.error("Backend save failed:", error);
  }
}

async function loadCurrentPlan() {
  const user = getCurrentUser();

  if (user && user.email) {
    try {
      let data = null;

      try {
        data = await tryPostJSON(
          ["/get-plan", "/getPlan"],
          { email: user.email }
        );
      } catch {
        data = await tryGetJSON(
          ["/get-plan", "/getPlan"],
          { email: user.email }
        );
      }

      let rawPlan = data?.plan ?? data?.data ?? null;

      if (rawPlan) {
        if (typeof rawPlan === "string") {
          rawPlan = JSON.parse(rawPlan);
        }

        cachePlanLocally(rawPlan);
        return normalizeLoadedPlan(rawPlan);
      }
    } catch (error) {
      console.error("Backend load failed:", error);
    }
  }

  return normalizeLoadedPlan(readLocalPlanCache());
}

function getTrackerKey(planId = "local") {
  const user = getCurrentUser();
  const userId = (user?.email || "guest").toLowerCase();
  return `${STORAGE_KEYS.trackerPrefix}${userId}_${planId}`;
}

function getTracker(planId = "local") {
  try {
    return JSON.parse(localStorage.getItem(getTrackerKey(planId)) || '{"days":{}}');
  } catch {
    return { days: {} };
  }
}

function saveTracker(planId, tracker) {
  localStorage.setItem(getTrackerKey(planId), JSON.stringify(tracker));
}

function getTodaySelectionKey(planId = "local") {
  const user = getCurrentUser();
  const userId = (user?.email || "guest").toLowerCase();
  return `fitnessplan_today_selection_${userId}_${planId}`;
}

function getSelectedWorkoutId(planId = "local") {
  return localStorage.getItem(getTodaySelectionKey(planId)) || "";
}

function saveSelectedWorkoutId(planId = "local", workoutId = "") {
  localStorage.setItem(getTodaySelectionKey(planId), workoutId);
}

function getAgeFromDob(dobValue) {
  if (!dobValue) return null;

  const dob = new Date(`${dobValue}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
}

function getAgeBand(age) {
  if (age === null || age === undefined) return "Not set yet";
  if (age < 9) return "Under minimum age";
  if (age <= 12) return "Youth Beginner";
  if (age <= 15) return "Youth Intermediate";
  if (age <= 17) return "Youth Advanced";
  return "Adult Standard";
}

function getSafetyMode(age) {
  return age < 18 ? "Youth-safe mode" : "Standard safe mode";
}

const PUSH_VARIATIONS = [
  { value: "none", name: "Cannot do one yet", level: 0 },
  { value: "plank", name: "Front Plank Hold", level: 1, targetType: "seconds" },
  { value: "scapula", name: "Scapula Push-ups", level: 2 },
  { value: "wall", name: "Wall Push-ups", level: 3 },
  { value: "incline", name: "Incline Push-ups", level: 4 },
  { value: "knee", name: "Knee Push-ups", level: 5 },
  { value: "negatives", name: "Negative Push-ups", level: 6 },
  { value: "regular", name: "Regular Push-ups", level: 7 },
  { value: "wide", name: "Wide Push-ups", level: 8 },
  { value: "diamond", name: "Diamond Push-ups", level: 9 },
  { value: "tricep", name: "Tricep Extensions", level: 10 },
  { value: "exploding", name: "Power Push-ups", level: 11 },
  { value: "archer", name: "Archer Push-ups", level: 12 },
  { value: "one-arm-archer", name: "One-Arm Archer Push-ups", level: 13 },
  { value: "pike", name: "Pike Push-Ups", level: 14 },
  { value: "hspu-wall", name: "Wall Handstand Push-Ups", level: 15 }
];

const PULL_VARIATIONS = [
  { value: "none", name: "Cannot do one yet", level: 0 },
  { value: "dead-hang", name: "Dead Hang", level: 1, targetType: "seconds" },
  { value: "scapula", name: "Scapular Pull-ups", level: 2 },
  { value: "active-hang", name: "Active Hang", level: 3, targetType: "seconds" },
  { value: "negatives", name: "Negative Pull-ups", level: 4 },
  { value: "assisted", name: "Band-Assisted Pull-ups", level: 5, defaultLoadMode: "assistance" },
  { value: "regular", name: "Regular Pull-ups", level: 6 },
  { value: "wide", name: "Wide Pull-ups", level: 7 },
  { value: "archer", name: "Archer Pull-ups", level: 8 },
  { value: "weighted", name: "Weighted Pull-ups", level: 9, defaultLoadMode: "load" },
  { value: "muscle-up", name: "Muscle Up", level: 10 }
];

const SQUAT_VARIATIONS = [
  { value: "none", name: "Cannot do one yet", level: 0 },
  { value: "box", name: "Box Squats", level: 1 },
  { value: "assisted", name: "Assisted Squats", level: 2 },
  { value: "regular", name: "Regular Bodyweight Squats", level: 3 },
  { value: "split", name: "Split Squats / Lunges", level: 4 },
  { value: "bulgarian", name: "Bulgarian Split Squats", level: 5 },
  { value: "pistol-assisted", name: "Assisted Pistol Squats", level: 6 },
  { value: "pistol", name: "Pistol Squats", level: 7 }
];

function findVariation(list, value) {
  return list.find((item) => item.value === value) || list[0];
}

function normalizeFormData(raw) {
  const data = { ...(raw || {}) };

  data.parentConsent = !!data.parentConsent;
  data.focus = unique(Array.isArray(data.focus) ? data.focus : []);
  data.enduranceType = unique(Array.isArray(data.enduranceType) ? data.enduranceType : []);
  data.equipment = unique(Array.isArray(data.equipment) ? data.equipment : []);
  data.strengthGoals = unique(Array.isArray(data.strengthGoals) ? data.strengthGoals : []);
  data.pushSkill = unique(Array.isArray(data.pushSkill) ? data.pushSkill : []);
  data.pullSkill = unique(Array.isArray(data.pullSkill) ? data.pullSkill : []);
  data.daysPerWeek = clamp(toNumber(data.daysPerWeek, 3), 3, 5);
  data.sessionLength = [30, 60, 90].includes(toNumber(data.sessionLength, 60))
    ? toNumber(data.sessionLength, 60)
    : 60;

  data.pushupMax = toNumber(data.pushupMax, 0);
  data.pullupMax = toNumber(data.pullupMax, 0);
  data.squatMax = toNumber(data.squatMax, 0);
  data.wallSit = toNumber(data.wallSit, 0);
  data.plankMax = toNumber(data.plankMax, 0);
  data.pullAssistValue = String(data.pullAssistValue || "").trim();
  data.pullAssistUnit = data.pullAssistUnit || "lbs";
  data.mileTime = data.mileTime || data.mile || "";
  data.runDuration = data.runDuration || "";
  data.runDistance = data.runDistance || "";
  data.startDate = data.startDate || toISODate(new Date());

  return data;
}

function normalizeLoadedPlan(plan) {
  if (!plan) return null;

  let normalized = plan;

  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
      return null;
    }
  }

  if (!normalized || typeof normalized !== "object") return null;

  if (!normalized.profile && normalized.formData) {
    const legacy = normalizeFormData(normalized.formData);
    const age = getAgeFromDob(legacy.dob);

    normalized = {
      ...normalized,
      createdAt: normalized.createdAt || new Date().toISOString(),
      profile: {
        dob: legacy.dob || "",
        age,
        ageBand: getAgeBand(age),
        safetyMode: getSafetyMode(age || 18),
        focus: legacy.focus || [],
        enduranceType: legacy.enduranceType || [],
        equipment: legacy.equipment || [],
        strengthGoals: legacy.strengthGoals || [],
        pushSkill: legacy.pushSkill || [],
        pullSkill: legacy.pullSkill || [],
        daysPerWeek: legacy.daysPerWeek || 3,
        sessionLength: legacy.sessionLength || 60
      },
      records: {
        mileTime: safeText(legacy.mileTime, "Not logged yet"),
        longestRun: safeText(legacy.runDuration, "Not logged yet"),
        longestRunDistance: safeText(legacy.runDistance, "Not logged yet"),
        pushBest: legacy.pushVariation
          ? `${findVariation(PUSH_VARIATIONS, legacy.pushVariation).name}${legacy.pushupMax ? ` • ${legacy.pushupMax} reps` : ""}`
          : "Not logged yet",
        pullBest: legacy.pullVariation
          ? `${findVariation(PULL_VARIATIONS, legacy.pullVariation).name}${legacy.pullupMax ? ` • ${legacy.pullupMax} reps` : legacy.pullVariation === "assisted" && legacy.pullAssistValue ? ` • ${legacy.pullAssistValue} ${legacy.pullAssistUnit || "lbs"}` : ""}`
          : "Not logged yet",
        squatBest: legacy.squatVariation
          ? `${findVariation(SQUAT_VARIATIONS, legacy.squatVariation).name}${legacy.squatMax ? ` • ${legacy.squatMax} reps` : ""}`
          : "Not logged yet",
        plankBest: legacy.plankMax ? `${legacy.plankMax} sec` : "Not logged yet",
        wallSitBest: legacy.wallSit ? `${legacy.wallSit} sec` : "Not logged yet"
      },
      weeks: Array.isArray(normalized.weeks) ? normalized.weeks : []
    };
  }

  normalized.profile = {
    dob: "",
    age: null,
    ageBand: "Not set yet",
    safetyMode: "Not set yet",
    focus: [],
    enduranceType: [],
    equipment: [],
    strengthGoals: [],
    pushSkill: [],
    pullSkill: [],
    daysPerWeek: 0,
    sessionLength: 0,
    ...(normalized.profile || {})
  };

  normalized.records = {
    mileTime: "Not logged yet",
    longestRun: "Not logged yet",
    longestRunDistance: "Not logged yet",
    pushBest: "Not logged yet",
    pullBest: "Not logged yet",
    squatBest: "Not logged yet",
    plankBest: "Not logged yet",
    wallSitBest: "Not logged yet",
    ...(normalized.records || {})
  };

  normalized.weeks = Array.isArray(normalized.weeks)
    ? normalized.weeks.map((week, weekIndex) => ({
        week: toNumber(week.week, weekIndex + 1),
        label: safeText(week.label, `Week ${weekIndex + 1}`),
        note: safeText(week.note, ""),
        workouts: Array.isArray(week.workouts)
          ? week.workouts.map((workout, workoutIndex) => ({
              id: workout.id || `week-${weekIndex + 1}-day-${String.fromCharCode(65 + workoutIndex)}`,
              week: toNumber(workout.week, weekIndex + 1),
              workoutLabel: safeText(workout.workoutLabel, `Workout ${String.fromCharCode(65 + workoutIndex)}`),
              name: safeText(workout.name, "Workout"),
              date: safeText(workout.date, ""),
              dateLabel: safeText(workout.dateLabel, workout.date ? formatDateLabel(workout.date) : "Date not set"),
              description: safeText(workout.description, ""),
              duration: toNumber(workout.duration, normalized.profile.sessionLength || 60),
              warmup: Array.isArray(workout.warmup) ? workout.warmup : [],
              exercises: Array.isArray(workout.exercises) ? workout.exercises : [],
              cooldown: Array.isArray(workout.cooldown) ? workout.cooldown : [],
              isDeload: !!workout.isDeload,
              includesHypertrophy: !!workout.includesHypertrophy
            }))
          : []
      }))
    : [];

  return normalized;
}

function hasEquipment(formData, item) {
  return (formData.equipment || []).includes(item);
}

function getSessionCaps(age, sessionLength) {
  const length = toNumber(sessionLength, 60);

  if (age <= 12) {
    return {
      maxSetsPerExercise: length === 30 ? 2 : 3,
      maxWorkingSets: length === 30 ? 6 : length === 60 ? 9 : 11,
      compoundRest: 90,
      accessoryRest: 60
    };
  }

  if (age <= 15) {
    return {
      maxSetsPerExercise: length === 30 ? 2 : 4,
      maxWorkingSets: length === 30 ? 8 : length === 60 ? 12 : 15,
      compoundRest: 90,
      accessoryRest: 60
    };
  }

  if (age <= 17) {
    return {
      maxSetsPerExercise: 4,
      maxWorkingSets: length === 30 ? 9 : length === 60 ? 14 : 18,
      compoundRest: 90,
      accessoryRest: 60
    };
  }

  return {
    maxSetsPerExercise: 5,
    maxWorkingSets: length === 30 ? 10 : length === 60 ? 16 : 20,
    compoundRest: 105,
    accessoryRest: 60
  };
}

function getSafeProgression(list, chosenValue, maxReps, weekOffset = 0) {
  let index = list.findIndex((item) => item.value === chosenValue);
  if (index < 0) index = 0;

  const max = toNumber(maxReps, 0);
  if (max > 0 && max < 4) index = Math.max(1, index - 2);
  else if (max > 0 && max < 8) index = Math.max(1, index - 1);

  index = Math.min(list.length - 1, index + Math.max(0, weekOffset));
  return list[index] || list[0];
}

function getWorkoutSlots(formData, week = 1) {
  const days = toNumber(formData.daysPerWeek, 3);
  const focus = formData.focus || [];
  const strengthGoals = formData.strengthGoals || [];
  const enduranceTypes = (formData.enduranceType || []).length
    ? formData.enduranceType
    : ["running"];

  const slots = [];
  const wantsStrength = focus.includes("strength") || strengthGoals.length > 0;
  const wantsEndurance = focus.includes("endurance") || focus.includes("cardio");
  const wantsFlexibility = focus.includes("flexibility");

  if (wantsStrength) {
    if (strengthGoals.includes("push") || strengthGoals.length === 0) {
      slots.push({ kind: "strength", emphasis: "push", label: "Push Path" });
    }
    if (strengthGoals.includes("pull") || strengthGoals.length === 0) {
      slots.push({ kind: "strength", emphasis: "pull", label: "Pull Path" });
    }
    if (strengthGoals.includes("squat") || strengthGoals.length === 0) {
      slots.push({ kind: "strength", emphasis: "legs", label: "Leg Path" });
    }
  }

  if (wantsEndurance) {
    const enduranceSlotsToUse = Math.min(2, Math.max(1, days - slots.length));
    const rotationStart = Math.max(0, week - 1);

    for (let i = 0; i < enduranceSlotsToUse; i += 1) {
      const type = enduranceTypes[(rotationStart + i) % enduranceTypes.length];
      const repeatSameType = enduranceTypes.length === 1 && i > 0;

      slots.push({
        kind: "endurance",
        emphasis: repeatSameType ? `${type}-variation` : type,
        label: repeatSameType ? `${titleCase(type)} Variation` : `${titleCase(type)} Engine`
      });
    }
  }

  if (wantsFlexibility) {
    slots.push({ kind: "mobility", emphasis: "mobility", label: "Mobility Reset" });
  }

  if (!slots.length) {
    slots.push({ kind: "strength", emphasis: "push", label: "Push Path" });
    slots.push({ kind: "strength", emphasis: "pull", label: "Pull Path" });
    slots.push({ kind: "strength", emphasis: "legs", label: "Leg Path" });
  }

  const trimmed = [];
  let idx = 0;

  while (trimmed.length < days) {
    trimmed.push({ ...slots[idx % slots.length] });
    idx += 1;
  }

  return trimmed.slice(0, days);
}

function makeWarmup(slot, age) {
  if (slot.kind === "endurance") {
    return [
      { text: "Easy movement", targetType: "minutes", target: 4, note: "Build gradually." },
      { text: "Joint prep", targetType: "reps", target: 8, note: "Keep it smooth." },
      { text: "Short build-ups", targetType: "reps", target: 2, note: "Only if form feels good." }
    ];
  }

  if (slot.kind === "mobility") {
    return [
      { text: "Easy walk or march", targetType: "minutes", target: 3, note: "Relax into movement." },
      { text: "Gentle circles", targetType: "reps", target: 8, note: "No forcing range." }
    ];
  }

  return [
    { text: "Easy movement", targetType: "minutes", target: 3, note: "Wake up the body." },
    { text: "Prep mobility", targetType: "reps", target: age <= 12 ? 6 : 8, note: "Controlled range." },
    { text: "Movement rehearsal", targetType: "reps", target: 6, note: "Practice clean form." }
  ];
}

function makeCooldown(slot) {
  if (slot.kind === "endurance") {
    return [
      { text: "Easy walk", targetType: "minutes", target: 3, note: "Bring heart rate down." },
      { text: "Calf stretch", targetType: "seconds", target: 30, note: "Each side." },
      { text: "Hip flexor stretch", targetType: "seconds", target: 30, note: "Each side." }
    ];
  }

  if (slot.kind === "mobility") {
    return [
      { text: "Breathing reset", targetType: "minutes", target: 2, note: "Slow breaths." },
      { text: "Relaxed stretch", targetType: "seconds", target: 30, note: "No forcing range." }
    ];
  }

  return [
    { text: "Easy walk", targetType: "minutes", target: 2, note: "Reset after the session." },
    { text: "Chest or back stretch", targetType: "seconds", target: 30, note: "Pick what feels tight." },
    { text: "Hip stretch", targetType: "seconds", target: 30, note: "Stay relaxed." }
  ];
}

function buildExercise({
  id,
  name,
  category,
  targetType,
  targets,
  tempo,
  rest,
  loadMode = "normal",
  goalLoadText = "",
  note = "",
  progressionText = "",
  tags = []
}) {
  return {
    id,
    name,
    category,
    targetType,
    targets,
    tempo,
    rest,
    loadMode,
    goalLoadText,
    note,
    progressionText,
    tags
  };
}

function getPushExercise(formData, week, isDeload, caps) {
  const chosen = getSafeProgression(
    PUSH_VARIATIONS,
    formData.pushVariation || "knee",
    formData.pushupMax || 0,
    isDeload ? 0 : week > 2 ? 1 : 0
  );

  const max = toNumber(formData.pushupMax, 0);
  const sets = clamp(isDeload ? 2 : Math.min(3, caps.maxSetsPerExercise), 1, caps.maxSetsPerExercise);

  if (chosen.value === "none" || chosen.value === "plank") {
    return buildExercise({
      id: `push-${week}`,
      name: "Front Plank Hold",
      category: "push",
      targetType: "seconds",
      targets: Array.from({ length: Math.max(2, sets - 1) }, () =>
        clamp(20 + ((week - 1) * 5), 15, Math.max(30, formData.plankMax || 45))
      ),
      tempo: "Brace hard and stay still",
      rest: `${caps.accessoryRest}s`,
      goalLoadText: "Normal bodyweight. Quality over time.",
      note: "This is the safest starting push pattern right now.",
      progressionText: "Earn stronger push variations before more volume."
    });
  }

  let targets = [];
  if (max > 0) {
    const safeTop = clamp(Math.floor(max * (isDeload ? 0.55 : 0.7)), 1, max);
    const prescribed = clamp(safeTop + (week > 2 && !isDeload ? 1 : 0), 1, max);
    targets = Array.from({ length: sets }, () => prescribed);
  } else {
    targets = Array.from({ length: sets }, () => {
      if (chosen.value === "knee") return 5;
      if (chosen.value === "incline") return 6;
      return 4;
    });
  }

  return buildExercise({
    id: `push-${week}`,
    name: chosen.name,
    category: "push",
    targetType: "reps",
    targets,
    tempo: chosen.value === "pike" || chosen.value === "hspu-wall"
      ? "3 sec down, light pause, drive up"
      : "2 sec down, light pause, controlled up",
    rest: `${caps.compoundRest}s`,
    goalLoadText: "Normal bodyweight. Prioritize clean reps.",
    note: "Stay 1 to 3 reps away from failure.",
    progressionText: "Hit all clean reps before progressing the variation."
  });
}

function getPullExercise(formData, week, isDeload, caps) {
  const hasBar = hasEquipment(formData, "pullup-bar");
  const hasBands = hasEquipment(formData, "bands");
  const chosen = getSafeProgression(
    PULL_VARIATIONS,
    formData.pullVariation || (hasBar ? "assisted" : "none"),
    formData.pullupMax || 0,
    isDeload ? 0 : week > 2 ? 1 : 0
  );

  const max = toNumber(formData.pullupMax, 0);
  const sets = clamp(isDeload ? 2 : Math.min(3, caps.maxSetsPerExercise), 1, caps.maxSetsPerExercise);

  if (!hasBar && !hasBands) {
    return buildExercise({
      id: `pull-${week}`,
      name: "Back Widows",
      category: "pull",
      targetType: "reps",
      targets: Array.from({ length: sets }, () => (isDeload ? 5 : 6 + Math.min(week - 1, 2))),
      tempo: "Pull smooth, squeeze, lower under control",
      rest: `${caps.compoundRest}s`,
      goalLoadText: "Normal bodyweight. This replaces hanging work because no pull-up setup was selected.",
      note: "Use a floor-based back pattern when no pull-up setup is available.",
      progressionText: "Add clean reps before harder pull variations."
    });
  }

  let targetType = "reps";
  let targets = [];
  let loadMode = chosen.defaultLoadMode || "normal";
  let goalLoadText = "Normal bodyweight. Clean range first.";

  if (chosen.value === "assisted") {
    const assistText = formData.pullAssistValue
      ? `${formData.pullAssistValue} ${formData.pullAssistUnit || "lbs"} assistance`
      : "Use enough assistance to hit all clean reps";
    goalLoadText = `Assistance mode. ${assistText}.`;
  }

  if (chosen.value === "weighted") {
    loadMode = "load";
    goalLoadText = "Added load mode. Use a weight you can control.";
  }

  if (chosen.targetType === "seconds") {
    targetType = "seconds";
    const base = chosen.value === "dead-hang" ? 15 : 12;
    targets = Array.from({ length: Math.max(2, sets - 1) }, () => base + ((week - 1) * (isDeload ? 0 : 3)));
  } else if (max > 0) {
    const safeTop = clamp(Math.floor(max * (isDeload ? 0.5 : 0.65)), 1, max);
    const prescribed = clamp(safeTop + (week > 2 && !isDeload ? 1 : 0), 1, max);
    targets = Array.from({ length: sets }, () => prescribed);
  } else {
    targets = Array.from({ length: sets }, () => {
      if (chosen.value === "negatives") return 3;
      if (chosen.value === "assisted") return 4;
      return 3;
    });
  }

  const effectiveName =
    chosen.value === "assisted" && hasBands
      ? "Band-Assisted Pull-ups"
      : chosen.name;

  return buildExercise({
    id: `pull-${week}`,
    name: effectiveName,
    category: "pull",
    targetType,
    targets,
    tempo: chosen.value === "negatives"
      ? "Jump up, 4 sec lower"
      : targetType === "seconds"
        ? "Still body, strong grip"
        : "Pull smooth, lower under control",
    rest: `${caps.compoundRest}s`,
    loadMode,
    goalLoadText,
    note: "Stop before form breaks.",
    progressionText: chosen.value === "assisted"
      ? "Use less assistance only after all reps are clean."
      : "Progress only when every rep stays clean."
  });
}

function getLegExercise(formData, week, isDeload, caps) {
  const chosen = getSafeProgression(
    SQUAT_VARIATIONS,
    formData.squatVariation || "regular",
    formData.squatMax || 0,
    isDeload ? 0 : week > 2 ? 1 : 0
  );

  const max = toNumber(formData.squatMax, 0);
  const sets = clamp(isDeload ? 2 : Math.min(4, caps.maxSetsPerExercise), 1, caps.maxSetsPerExercise);
  const weighted = hasEquipment(formData, "dumbbells") || hasEquipment(formData, "bench");

  const name =
    weighted && ["regular", "split", "bulgarian"].includes(chosen.value)
      ? chosen.value === "split"
        ? "Loaded Split Squats"
        : "Goblet Squats"
      : chosen.name;

  let targets = [];
  if (max > 0) {
    const safeTop = clamp(Math.floor(max * (isDeload ? 0.55 : 0.7)), 1, max);
    const prescribed = clamp(safeTop + (week > 2 && !isDeload ? 2 : 0), 1, max);
    targets = Array.from({ length: sets }, () => prescribed);
  } else {
    targets = Array.from({ length: sets }, () => (chosen.value === "box" ? 6 : 8));
  }

  return buildExercise({
    id: `legs-${week}`,
    name,
    category: "legs",
    targetType: "reps",
    targets,
    tempo: "3 sec down, light pause, strong stand",
    rest: `${caps.compoundRest}s`,
    loadMode: weighted ? "load" : "normal",
    goalLoadText: weighted
      ? "Added load mode. Keep the range clean."
      : "Normal bodyweight. Build clean depth first.",
    note: "Do not grind. Stay smooth and upright.",
    progressionText: "Add reps before load when possible."
  });
}

function getCoreExercise(formData, week, isDeload, caps) {
  const sets = Math.max(2, Math.min(3, caps.maxSetsPerExercise));
  const plankBase = clamp(toNumber(formData.plankMax, 30), 10, 300);
  const target = clamp(
    Math.floor(plankBase * (isDeload ? 0.65 : 0.8)) + ((week - 1) * (isDeload ? 0 : 4)),
    12,
    plankBase
  );

  return buildExercise({
    id: `core-${week}`,
    name: "Plank Hold",
    category: "core",
    targetType: "seconds",
    targets: Array.from({ length: sets }, () => target),
    tempo: "Brace hard and breathe steadily",
    rest: `${caps.accessoryRest}s`,
    goalLoadText: "Normal bodyweight. Strong position first.",
    note: "Stop if hips sag or breathing becomes frantic.",
    progressionText: "Build clean time before harder variations."
  });
}

function trimWorkingSets(exercises, maxWorkingSets) {
  let used = 0;

  return exercises
    .map((exercise) => {
      const desired = (exercise.targets || []).length;
      const remaining = Math.max(1, maxWorkingSets - used);
      const limitedTargets = (exercise.targets || []).slice(0, remaining);
      used += limitedTargets.length;
      return { ...exercise, targets: limitedTargets };
    })
    .filter((exercise) => (exercise.targets || []).length > 0);
}

function getEnduranceWorkout(formData, slot, week, isDeload) {
  const rawType = String(slot.emphasis || "running");
  const type = rawType.replace("-variation", "");
  const label = titleCase(type);
  const isVariation = rawType.includes("-variation");

  const baseDuration = Math.max(10, parseFirstNumber(formData.runDuration || "") || 20);
  const adjustedDuration = clamp(
    Math.round(baseDuration * (isDeload ? 0.7 : isVariation ? 0.8 : 1 + ((week - 1) * 0.08))),
    10,
    90
  );

  const warmup = makeWarmup(slot, formData.age || 18);
  const cooldown = makeCooldown(slot);

  const mainExercise = buildExercise({
    id: `endurance-${type}-${week}-${isVariation ? "variation" : "steady"}`,
    name: isVariation ? `${label} Variation` : `${label} Engine`,
    category: "endurance",
    targetType: "minutes",
    targets: [adjustedDuration],
    tempo: isVariation ? "Comfortably hard, controlled effort" : "Aerobic conversational pace",
    rest: isVariation ? "30 to 60s between repeats if needed" : "Steady continuous effort",
    goalLoadText: isVariation
      ? "Stay repeatable. Do not sprint every rep."
      : "Stay smooth and sustainable.",
    note: type === "running"
      ? "Log distance covered or total time."
      : `Log total ${type} work completed.`,
    progressionText: "Increase duration gradually. Do not jump both pace and volume."
  });

  return {
    warmup,
    exercises: [mainExercise],
    cooldown,
    description: isVariation ? `${label} variation day` : `${label} endurance day`,
    hypertrophy: false
  };
}

function buildStrengthWorkout(formData, slot, week, isDeload, caps) {
  const warmup = makeWarmup(slot, formData.age || 18);
  const cooldown = makeCooldown(slot);
  const exercises = [];

  if (slot.emphasis === "push") {
    exercises.push(getPushExercise(formData, week, isDeload, caps));
    exercises.push(getPullExercise(formData, week, week === 4, caps));
    exercises.push(getCoreExercise(formData, week, isDeload, caps));
  } else if (slot.emphasis === "pull") {
    exercises.push(getPullExercise(formData, week, isDeload, caps));
    exercises.push(getPushExercise(formData, week, week === 4, caps));
    exercises.push(getCoreExercise(formData, week, isDeload, caps));
  } else {
    exercises.push(getLegExercise(formData, week, isDeload, caps));
    exercises.push(getCoreExercise(formData, week, isDeload, caps));
    if ((formData.focus || []).includes("strength")) {
      exercises.push(getPushExercise(formData, week, true, caps));
    }
  }

  return {
    warmup,
    exercises: trimWorkingSets(exercises, caps.maxWorkingSets),
    cooldown,
    description: `Strength focus on ${slot.emphasis}`,
    hypertrophy: true
  };
}

function buildMobilityWorkout(slot) {
  const warmup = makeWarmup(slot, 18);
  const cooldown = makeCooldown(slot);

  const exercises = [
    buildExercise({
      id: "mobility-flow",
      name: "Mobility Flow",
      category: "mobility",
      targetType: "minutes",
      targets: [15],
      tempo: "Slow, smooth, controlled range",
      rest: "Move continuously",
      goalLoadText: "No load needed.",
      note: "Never force painful range.",
      progressionText: "Aim for smoother movement, not bigger motion."
    })
  ];

  return {
    warmup,
    exercises,
    cooldown,
    description: "Recovery and mobility",
    hypertrophy: false
  };
}

function buildPlan(rawFormData) {
  const formData = normalizeFormData(rawFormData);
  const age = getAgeFromDob(formData.dob);
  formData.age = age;

  const caps = getSessionCaps(age || 18, formData.sessionLength);
  const startDate = formData.startDate || toISODate(new Date());

  const records = {
    mileTime: safeText(formData.mileTime, "Not logged yet"),
    longestRun: safeText(formData.runDuration, "Not logged yet"),
    longestRunDistance: safeText(formData.runDistance, "Not logged yet"),
    pushBest: formData.pushVariation && formData.pushVariation !== "none"
      ? `${findVariation(PUSH_VARIATIONS, formData.pushVariation).name}${formData.pushupMax ? ` • ${formData.pushupMax} reps` : ""}`
      : "Not logged yet",
    pullBest: formData.pullVariation && formData.pullVariation !== "none"
      ? `${findVariation(PULL_VARIATIONS, formData.pullVariation).name}${formData.pullupMax ? ` • ${formData.pullupMax} reps` : formData.pullVariation === "assisted" && formData.pullAssistValue ? ` • ${formData.pullAssistValue} ${formData.pullAssistUnit || "lbs"}` : ""}`
      : "Not logged yet",
    squatBest: formData.squatVariation && formData.squatVariation !== "none"
      ? `${findVariation(SQUAT_VARIATIONS, formData.squatVariation).name}${formData.squatMax ? ` • ${formData.squatMax} reps` : ""}`
      : "Not logged yet",
    plankBest: formData.plankMax ? `${formData.plankMax} sec` : "Not logged yet",
    wallSitBest: formData.wallSit ? `${formData.wallSit} sec` : "Not logged yet"
  };

  const weeks = [];

  for (let week = 1; week <= 4; week += 1) {
    const isDeload = week === 4;
    const slots = getWorkoutSlots(formData, week);

    const workouts = slots.map((slot, index) => {
      const label = String.fromCharCode(65 + index);
      const date = toISODate(addDays(new Date(`${startDate}T12:00:00`), ((week - 1) * 7) + index));

      const built = slot.kind === "endurance"
        ? getEnduranceWorkout(formData, slot, week, isDeload)
        : slot.kind === "mobility"
          ? buildMobilityWorkout(slot)
          : buildStrengthWorkout(formData, slot, week, isDeload, caps);

      return {
        id: `week-${week}-day-${label}`,
        week,
        workoutLabel: `Workout ${label}`,
        name: slot.label,
        date,
        dateLabel: formatDateLabel(date),
        description: built.description,
        duration: toNumber(formData.sessionLength, 60),
        warmup: built.warmup,
        exercises: built.exercises,
        cooldown: built.cooldown,
        isDeload,
        includesHypertrophy: built.hypertrophy
      };
    });

    weeks.push({
      week,
      label: `Week ${week}`,
      note: isDeload
        ? "Deload week. Reduced stress to protect recovery."
        : week === 3
          ? "Highest training week before deload."
          : "Build week.",
      workouts
    });
  }

  return {
    version: 4,
    createdAt: new Date().toISOString(),
    profile: {
      dob: formData.dob,
      age,
      ageBand: getAgeBand(age),
      safetyMode: getSafetyMode(age || 18),
      focus: formData.focus || [],
      enduranceType: formData.enduranceType || [],
      equipment: formData.equipment || [],
      strengthGoals: formData.strengthGoals || [],
      pushSkill: formData.pushSkill || [],
      pullSkill: formData.pullSkill || [],
      daysPerWeek: toNumber(formData.daysPerWeek, 3),
      sessionLength: toNumber(formData.sessionLength, 60)
    },
    records,
    weeks
  };
}

function initPlanner() {
  const statusBox = byId("plannerStatus");
  const progressFill = byId("plannerStepProgress");
  const nextBtn = byId("plannerNextBtn");
  const backBtn = byId("plannerBackBtn");
  const generateBtn = byId("generatePlanBtn");
  const planSummaryPreview = byId("planSummaryPreview");
  const schedulePreview = byId("schedulePreview");

  const allSteps = [
    "dob",
    "focus",
    "endurance-type",
    "equipment",
    "strength-goals",
    "push-skill",
    "pull-skill",
    "days",
    "session-length",
    "push-variation",
    "push-max",
    "pull-variation",
    "pull-assist",
    "pull-max",
    "squat-variation",
    "squat-max",
    "wall-sit",
    "plank",
    "mile",
    "run-duration",
    "run-distance",
    "start-date"
  ];

  let formData = normalizeFormData(getPlannerDraft() || {});
  let currentStepIndex = 0;

  function getVisibleSteps() {
    return allSteps.filter((step) => {
      if (step === "endurance-type") {
        return formData.focus.includes("endurance") || formData.focus.includes("cardio");
      }

      if (step === "strength-goals") {
        return formData.focus.includes("strength");
      }

      if (step === "push-skill") {
        return formData.strengthGoals.includes("push");
      }

      if (step === "pull-skill") {
        return formData.strengthGoals.includes("pull");
      }

      if (step === "push-variation") {
        return formData.strengthGoals.includes("push") || formData.focus.includes("strength");
      }

      if (step === "push-max") {
        return (formData.strengthGoals.includes("push") || formData.focus.includes("strength"))
          && formData.pushVariation
          && !["none", "plank"].includes(formData.pushVariation);
      }

      if (step === "pull-variation") {
        return formData.strengthGoals.includes("pull") || formData.focus.includes("strength");
      }

      if (step === "pull-assist") {
        return formData.pullVariation === "assisted";
      }

      if (step === "pull-max") {
        return (formData.strengthGoals.includes("pull") || formData.focus.includes("strength"))
          && formData.pullVariation
          && !["none", "dead-hang", "active-hang"].includes(formData.pullVariation);
      }

      if (step === "squat-variation") {
        return formData.strengthGoals.includes("squat") || formData.focus.includes("strength");
      }

      if (step === "squat-max") {
        return (formData.strengthGoals.includes("squat") || formData.focus.includes("strength"))
          && formData.squatVariation
          && formData.squatVariation !== "none";
      }

      if (step === "wall-sit") {
        return formData.strengthGoals.includes("squat") || formData.focus.includes("strength");
      }

      if (step === "plank") {
        return formData.focus.includes("strength") || formData.strengthGoals.length > 0;
      }

      if (step === "mile" || step === "run-duration" || step === "run-distance") {
        return formData.focus.includes("endurance") || formData.focus.includes("cardio");
      }

      return true;
    });
  }

  function syncFromInputs() {
    formData.dob = byId("dob")?.value || formData.dob || "";
    formData.parentConsent = !!byId("parent-consent")?.checked;

    formData.daysPerWeek = toNumber(byId("daysPerWeek")?.value, formData.daysPerWeek || 3);
    formData.sessionLength = toNumber(byId("sessionLength")?.value, formData.sessionLength || 60);

    formData.pushVariation = byId("pushVariation")?.value || formData.pushVariation || "";
    formData.pushupMax = toNumber(byId("pushupMax")?.value, formData.pushupMax || 0);

    formData.pullVariation = byId("pullVariation")?.value || formData.pullVariation || "";
    formData.pullAssistValue = String(byId("pullAssistValue")?.value || formData.pullAssistValue || "").trim();
    formData.pullAssistUnit = byId("pullAssistUnit")?.value || formData.pullAssistUnit || "lbs";
    formData.pullupMax = toNumber(byId("pullupMax")?.value, formData.pullupMax || 0);

    formData.squatVariation = byId("squatVariation")?.value || formData.squatVariation || "";
    formData.squatMax = toNumber(byId("squatMax")?.value, formData.squatMax || 0);

    formData.wallSit = toNumber(byId("wallSit")?.value, formData.wallSit || 0);
    formData.plankMax = toNumber(byId("plankMax")?.value, formData.plankMax || 0);

    formData.mileTime = byId("mileTime")?.value?.trim() || formData.mileTime || "";

    const durationValue = byId("longestRunDurationValue")?.value?.trim() || "";
    const durationUnit = byId("longestRunDurationUnit")?.value || "minutes";
    formData.runDuration = durationValue ? `${durationValue} ${durationUnit}` : "";

    const distanceValue = byId("longestRunDistanceValue")?.value?.trim() || "";
    const distanceUnit = byId("longestRunDistanceUnit")?.value || "miles";
    formData.runDistance = distanceValue ? `${distanceValue} ${distanceUnit}` : "";

    formData.startDate = byId("startDate")?.value || formData.startDate || toISODate(new Date());
    formData = normalizeFormData(formData);
  }

  function applyDraftToInputs() {
    if (byId("dob")) byId("dob").value = formData.dob || "";
    if (byId("parent-consent")) byId("parent-consent").checked = !!formData.parentConsent;

    if (byId("daysPerWeek")) byId("daysPerWeek").value = String(formData.daysPerWeek || 3);
    if (byId("sessionLength")) byId("sessionLength").value = String(formData.sessionLength || 60);

    if (byId("pushVariation")) byId("pushVariation").value = formData.pushVariation || "none";
    if (byId("pushupMax")) byId("pushupMax").value = formData.pushupMax || "";

    if (byId("pullVariation")) byId("pullVariation").value = formData.pullVariation || "none";
    if (byId("pullAssistValue")) byId("pullAssistValue").value = formData.pullAssistValue || "";
    if (byId("pullAssistUnit")) byId("pullAssistUnit").value = formData.pullAssistUnit || "lbs";
    if (byId("pullupMax")) byId("pullupMax").value = formData.pullupMax || "";

    if (byId("squatVariation")) byId("squatVariation").value = formData.squatVariation || "none";
    if (byId("squatMax")) byId("squatMax").value = formData.squatMax || "";

    if (byId("wallSit")) byId("wallSit").value = formData.wallSit || "";
    if (byId("plankMax")) byId("plankMax").value = formData.plankMax || "";
    if (byId("mileTime")) byId("mileTime").value = formData.mileTime || "";

    if (byId("longestRunDurationValue")) byId("longestRunDurationValue").value = parseFirstNumber(formData.runDuration) || "";
    if (byId("longestRunDurationUnit")) {
      const durationText = String(formData.runDuration || "").toLowerCase();
      byId("longestRunDurationUnit").value = durationText.includes("hour") ? "hours" : "minutes";
    }

    if (byId("longestRunDistanceValue")) byId("longestRunDistanceValue").value = parseFirstNumber(formData.runDistance) || "";
    if (byId("longestRunDistanceUnit")) {
      const distanceText = String(formData.runDistance || "").toLowerCase();
      byId("longestRunDistanceUnit").value = distanceText.includes("km") ? "km" : "miles";
    }

    if (byId("startDate")) byId("startDate").value = formData.startDate || toISODate(new Date());

    qsa("[data-focus]").forEach((btn) => {
      btn.classList.toggle("active", formData.focus.includes(btn.dataset.focus));
    });

    qsa("[data-type]").forEach((btn) => {
      btn.classList.toggle("active", formData.enduranceType.includes(btn.dataset.type));
    });

    qsa("[data-equip]").forEach((btn) => {
      btn.classList.toggle("active", formData.equipment.includes(btn.dataset.equip));
    });

    qsa("[data-goal]").forEach((btn) => {
      btn.classList.toggle("active", formData.strengthGoals.includes(btn.dataset.goal));
    });

    qsa("#step-push-skill .tile-btn").forEach((btn) => {
      btn.classList.toggle("active", formData.pushSkill.includes(btn.dataset.skill));
    });

    qsa("#step-pull-skill .tile-btn").forEach((btn) => {
      btn.classList.toggle("active", formData.pullSkill.includes(btn.dataset.skill));
    });
  }

  function updateAgePanels() {
    const ageInfoContainer = byId("age-info-container");
    const countdownMessage = byId("countdown-message");
    const countdownTimer = byId("countdown-timer");
    const parentDisclaimer = byId("parent-disclaimer");
    const dobValue = byId("dob")?.value || "";

    if (!ageInfoContainer || !countdownMessage || !parentDisclaimer) return;

    ageInfoContainer.classList.add("hidden");
    countdownMessage.classList.add("hidden");
    parentDisclaimer.classList.add("hidden");

    if (!dobValue) return;

    const age = getAgeFromDob(dobValue);
    if (age === null) return;

    ageInfoContainer.classList.remove("hidden");

    if (age < 9) {
      countdownMessage.classList.remove("hidden");

      const dob = new Date(`${dobValue}T12:00:00`);
      const ninth = new Date(dob);
      ninth.setFullYear(dob.getFullYear() + 9);

      const diffDays = Math.max(
        0,
        Math.ceil((ninth.getTime() - Date.now()) / 86400000)
      );

      if (countdownTimer) {
        countdownTimer.textContent =
          diffDays > 365
            ? `${Math.floor(diffDays / 365)} years and ${diffDays % 365} days to go`
            : `${diffDays} days to go`;
      }

      return;
    }

    if (age < 13) {
      parentDisclaimer.classList.remove("hidden");
    }
  }

  function toggleArrayValue(key, value, limit = 99) {
    const current = new Set(formData[key] || []);

    if (limit === 1) {
      formData[key] = [value];
      return;
    }

    if (current.has(value)) {
      current.delete(value);
    } else if (current.size < limit) {
      current.add(value);
    }

    formData[key] = [...current];
  }

  function bindTileGroup(selector, key, limit = 99) {
    qsa(selector).forEach((btn) => {
      btn.addEventListener("click", () => {
        const value =
          btn.dataset.focus ||
          btn.dataset.type ||
          btn.dataset.equip ||
          btn.dataset.goal ||
          btn.dataset.skill;

        if (!value) return;

        toggleArrayValue(key, value, limit);

        if (key === "focus" && !formData.focus.includes("endurance") && !formData.focus.includes("cardio")) {
          formData.enduranceType = [];
        }

        if (key === "strengthGoals") {
          if (!formData.strengthGoals.includes("push")) formData.pushSkill = [];
          if (!formData.strengthGoals.includes("pull")) formData.pullSkill = [];
        }

        formData = normalizeFormData(formData);
        applyDraftToInputs();
        savePlannerDraft(formData);
        renderSummaryAndPreview();
        updateStep();
      });
    });
  }

  function fail(message) {
    setStatus(statusBox, message, "bad");
    return false;
  }

  function validateStep() {
    syncFromInputs();
    const visible = getVisibleSteps();
    const stepId = visible[currentStepIndex];

    if (stepId === "dob") {
      if (!formData.dob) return fail("Enter a date of birth.");
      const age = getAgeFromDob(formData.dob);
      if (age === null) return fail("Enter a real date of birth.");
      if (age < 9) return fail("Training starts at age 9.");
      if (age < 13 && !formData.parentConsent) return fail("A parent or guardian needs to confirm supervision.");
    }

    if (stepId === "focus" && formData.focus.length === 0) {
      return fail("Pick at least 1 focus.");
    }

    if (stepId === "endurance-type" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && formData.enduranceType.length === 0) {
      return fail("Pick at least 1 endurance type.");
    }

    if (stepId === "equipment" && formData.equipment.length === 0) {
      return fail("Pick your equipment or choose bodyweight only.");
    }

    if (stepId === "strength-goals" && formData.focus.includes("strength") && formData.strengthGoals.length === 0) {
      return fail("Pick at least 1 strength goal.");
    }

    if (stepId === "push-max" && formData.pushVariation && !["none", "plank"].includes(formData.pushVariation) && formData.pushupMax <= 0) {
      return fail("Enter your max clean reps.");
    }

    if (stepId === "pull-assist" && formData.pullVariation === "assisted" && !String(formData.pullAssistValue).trim()) {
      return fail("Enter your amount of assistance.");
    }

    if (stepId === "pull-max" && formData.pullVariation && !["none", "dead-hang", "active-hang"].includes(formData.pullVariation) && formData.pullupMax <= 0) {
      return fail("Enter your max clean reps.");
    }

    if (stepId === "squat-max" && formData.squatVariation && formData.squatVariation !== "none" && formData.squatMax <= 0) {
      return fail("Enter your max clean reps.");
    }

    if (stepId === "plank" && (formData.focus.includes("strength") || formData.strengthGoals.length > 0) && formData.plankMax <= 0) {
      return fail("Enter your best plank hold.");
    }

    if (stepId === "mile" && (formData.focus.includes("endurance") || formData.focus.includes("cardio"))) {
      if (!formData.mileTime || parseTimeToSeconds(formData.mileTime) === null) {
        return fail("Enter your mile time like 8:05.");
      }
    }

    if (stepId === "run-duration" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && !formData.runDuration) {
      return fail("Enter your longest continuous effort.");
    }

    if (stepId === "run-distance" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && !formData.runDistance) {
      return fail("Enter your longest distance.");
    }

    if (stepId === "start-date" && !formData.startDate) {
      return fail("Pick a start date.");
    }

    return true;
  }

  function updateStep() {
    const visible = getVisibleSteps();
    currentStepIndex = clamp(currentStepIndex, 0, Math.max(0, visible.length - 1));

    qsa(".planner-step").forEach((step) => {
      step.classList.remove("active");
    });

    const currentId = visible[currentStepIndex];
    const currentEl = byId(`step-${currentId}`);

    if (!currentEl) {
      setStatus(statusBox, `Missing planner section: step-${currentId}`, "bad");
      return;
    }

    currentEl.classList.add("active");

    if (progressFill) {
      progressFill.style.width = visible.length
        ? `${((currentStepIndex + 1) / visible.length) * 100}%`
        : "0%";
    }

    if (backBtn) backBtn.classList.toggle("hidden", currentStepIndex === 0);
    if (nextBtn) nextBtn.classList.toggle("hidden", currentStepIndex === visible.length - 1);
    if (generateBtn) generateBtn.classList.toggle("hidden", currentStepIndex !== visible.length - 1);

    if (!statusBox.classList.contains("bad")) {
      setStatus(statusBox, "Answer the questions to build your plan.");
    }
  }

  function renderSummaryAndPreview() {
    syncFromInputs();

    const age = getAgeFromDob(formData.dob);
    const summaryItems = [
      {
        label: "Focus",
        value: formData.focus.length ? formData.focus.map(titleCase).join(", ") : "Not set yet"
      },
      {
        label: "Age Band",
        value: getAgeBand(age)
      },
      {
        label: "Safety",
        value: getSafetyMode(age || 18)
      },
      {
        label: "Equipment",
        value: formData.equipment.length ? formData.equipment.map(titleCase).join(", ") : "Not set yet"
      },
      {
        label: "Workout Length",
        value: formData.sessionLength ? `${formData.sessionLength} minutes` : "Not set yet"
      }
    ];

    if (formData.enduranceType.length) {
      summaryItems.push({
        label: "Endurance",
        value: formData.enduranceType.map(titleCase).join(", ")
      });
    }

    if (formData.strengthGoals.length) {
      summaryItems.push({
        label: "Strength Goals",
        value: formData.strengthGoals.map(titleCase).join(", ")
      });
    }

    if (planSummaryPreview) {
      planSummaryPreview.innerHTML = `
        <div class="summary-list">
          ${summaryItems.map((item) => `
            <div class="summary-item">
              <div class="summary-label">${item.label}</div>
              <div class="summary-value">${safeText(item.value)}</div>
            </div>
          `).join("")}
        </div>
      `;
    }

    if (!schedulePreview) return;

    if (!formData.focus.length && !formData.strengthGoals.length) {
      schedulePreview.innerHTML = `<div class="empty-box">Preview will appear as you answer questions.</div>`;
      return;
    }

    const plan = buildPlan(formData);
    const week1 = plan.weeks[0];

    if (!week1 || !(week1.workouts || []).length) {
      schedulePreview.innerHTML = `<div class="empty-box">Preview will appear as you answer questions.</div>`;
      return;
    }

    schedulePreview.innerHTML = `
      <div class="preview-week">
        <div class="preview-week-title">Week 1 Preview</div>
        <div class="preview-workout-list">
          ${week1.workouts.map((workout) => `
            <div class="preview-workout">
              <div class="preview-workout-top">
                <div class="preview-workout-name">${safeText(workout.workoutLabel).replace("Workout", "Day")} • ${safeText(workout.name)}</div>
                <span class="preview-badge ${workout.isDeload ? "warn" : ""}">${safeText(workout.duration)} min</span>
              </div>
              <div class="preview-workout-sub">${safeText(workout.description)}</div>
              <div class="preview-workout-sub">${(workout.exercises || []).slice(0, 3).map((exercise) => exercise.name).join(" • ")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  async function generate() {
    if (!validateStep()) return;
    syncFromInputs();

    const plan = buildPlan(formData);
    await saveCurrentPlan(plan);
    savePlannerDraft(formData);
    setStatus(statusBox, "Plan generated and saved.", "ok");
    window.location.href = "./dashboard.html";
  }

  bindTileGroup("#step-focus .tile-btn", "focus", 2);
  bindTileGroup("#step-endurance-type .tile-btn", "enduranceType", 3);
  bindTileGroup("#step-equipment .tile-btn", "equipment", 5);
  bindTileGroup("#step-strength-goals .tile-btn", "strengthGoals", 3);
  bindTileGroup("#step-push-skill .tile-btn", "pushSkill", 1);
  bindTileGroup("#step-pull-skill .tile-btn", "pullSkill", 1);

  qsa("input, select").forEach((input) => {
    input.addEventListener("change", () => {
      syncFromInputs();
      updateAgePanels();
      savePlannerDraft(formData);
      renderSummaryAndPreview();
    });

    input.addEventListener("input", () => {
      syncFromInputs();
      updateAgePanels();
      savePlannerDraft(formData);
      renderSummaryAndPreview();
    });

    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && event.target.tagName.toLowerCase() !== "textarea") {
        event.preventDefault();

        if (currentStepIndex === getVisibleSteps().length - 1) {
          await generate();
        } else if (validateStep()) {
          currentStepIndex += 1;
          updateStep();
        }
      }
    });
  });

  byId("dob")?.addEventListener("change", updateAgePanels);

  nextBtn?.addEventListener("click", () => {
    if (!validateStep()) return;
    currentStepIndex += 1;
    updateStep();
  });

  backBtn?.addEventListener("click", () => {
    currentStepIndex -= 1;
    updateStep();
  });

  generateBtn?.addEventListener("click", async () => {
    await generate();
  });

  if (!formData.startDate) {
    formData.startDate = toISODate(new Date());
  }

  applyDraftToInputs();
  updateAgePanels();
  updateStep();
  renderSummaryAndPreview();
}

function getWorkoutHistoryPoint(plan, tracker, predicate, parser) {
  const points = [];

  (plan.weeks || []).forEach((week) => {
    (week.workouts || []).forEach((workout) => {
      (workout.exercises || []).forEach((exercise) => {
        if (!predicate(exercise)) return;
        const entry = tracker.days?.[workout.date]?.[exercise.id];
        const parsed = parser(entry);
        if (parsed === null || parsed === undefined || parsed === "") return;
        points.push({
          date: workout.date,
          value: parsed,
          exerciseName: exercise.name
        });
      });
    });
  });

  return points;
}

function detectPlateau(points, better = "higher") {
  if (points.length < 4) return false;

  const last3 = points.slice(-3);
  const earlier = points.slice(0, -3);

  if (!earlier.length) return false;

  if (better === "lower") {
    const bestEarlier = Math.min(...earlier.map((p) => p.value));
    return last3.every((p) => p.value >= bestEarlier);
  }

  const bestEarlier = Math.max(...earlier.map((p) => p.value));
  return last3.every((p) => p.value <= bestEarlier);
}

function getReadinessSummary(dayData) {
  const readiness = dayData?._readiness;
  if (!readiness) return null;

  const sleep = toNumber(readiness.sleepHours, 0);
  const soreness = clamp(toNumber(readiness.soreness, 3), 1, 5);
  const energy = clamp(toNumber(readiness.energy, 3), 1, 5);

  if (!sleep || !soreness || !energy) return null;

  let score = 0;

  if (sleep >= 8) score += 2;
  else if (sleep >= 7) score += 1;
  else if (sleep <= 5) score -= 2;
  else if (sleep <= 6) score -= 1;

  score += (energy - 3);
  score -= (soreness - 3);

  if (score <= -2) {
    return {
      level: "low",
      label: "Low readiness",
      note: "Volume is reduced for today."
    };
  }

  if (score >= 2) {
    return {
      level: "high",
      label: "High readiness",
      note: "Run the planned session, but keep form clean."
    };
  }

  return {
    level: "normal",
    label: "Normal readiness",
    note: "Run the planned session."
  };
}

function getAdjustedWorkout(workout, readiness) {
  if (!readiness || readiness.level !== "low") return workout;

  const clone = JSON.parse(JSON.stringify(workout));

  clone.exercises = (clone.exercises || []).map((exercise, index) => {
    if (exercise.targetType === "minutes") {
      return {
        ...exercise,
        targets: [Math.max(8, Math.round((exercise.targets?.[0] || 12) * 0.8))],
        note: `${exercise.note} Reduced today because readiness is low.`
      };
    }

    if (index >= 2) {
      return {
        ...exercise,
        skipped: true,
        note: "Accessory removed today because readiness is low."
      };
    }

    return {
      ...exercise,
      targets: (exercise.targets || []).slice(0, Math.max(1, (exercise.targets || []).length - 1)),
      note: `${exercise.note} One set removed because readiness is low.`
    };
  });

  return clone;
}

function renderTrackerChecklist(items, bucket, date, tracker) {
  const doneMap = tracker.days?.[date]?.[bucket] || {};

  return `
    <div class="track-list">
      ${(items || []).map((item, index) => `
        <label class="track-item">
          <input
            type="checkbox"
            data-track-bucket="${bucket}"
            data-track-date="${date}"
            data-track-index="${index}"
            ${doneMap[index] ? "checked" : ""}
          >
          <span>${item.text} • ${item.target} ${item.targetType}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderExerciseCard(exercise, date, existing) {
  if (exercise.skipped) {
    return `
      <div class="exercise-box">
        <div class="exercise-head">
          <div>
            <div class="exercise-name">${safeText(exercise.name)}</div>
            <div class="exercise-sub">${safeText(exercise.note)}</div>
          </div>
          <span class="chip neutral">Skipped</span>
        </div>
      </div>
    `;
  }

  const loadMode = existing?.loadMode || exercise.loadMode || "normal";
  const loadValue = existing?.loadValue || "";

  if (exercise.targetType === "minutes") {
    return `
      <div class="exercise-box">
        <div class="exercise-head">
          <div>
            <div class="exercise-name">${safeText(exercise.name)}</div>
            <div class="exercise-sub">${safeText(exercise.note)}</div>
          </div>
          <span class="chip neutral">${exercise.category === "endurance" ? "Endurance" : "Work"}</span>
        </div>

        <div class="exercise-meta">
          <span class="meta-pill">${safeText(exercise.tempo)}</span>
          <span class="meta-pill">${safeText(exercise.rest)}</span>
        </div>

        <div class="goal-load-box">${safeText(exercise.goalLoadText)}</div>

        <div class="exercise-table-wrap">
          <table class="exercise-log-table single-row-table">
            <thead>
              <tr>
                <th>Set</th>
                <th>Goal</th>
                <th>Log</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Set">Main</td>
                <td data-label="Goal">${exercise.targets[0]} minutes</td>
                <td data-label="Log">
                  <input
                    id="${exercise.id}-log"
                    class="small-input table-input"
                    data-log-kind="text"
                    data-exercise-id="${exercise.id}"
                    data-date="${date}"
                    type="text"
                    placeholder="Example: 24 min or 2.1 miles"
                    value="${existing?.logText || ""}"
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="notes-block">
          <label for="${exercise.id}-note">Notes</label>
          <textarea
            id="${exercise.id}-note"
            class="small-textarea"
            data-log-kind="note"
            data-exercise-id="${exercise.id}"
            data-date="${date}"
            placeholder="Optional notes"
          >${existing?.noteText || ""}</textarea>
        </div>
      </div>
    `;
  }

  return `
    <div class="exercise-box">
      <div class="exercise-head">
        <div>
          <div class="exercise-name">${safeText(exercise.name)}</div>
          <div class="exercise-sub">${safeText(exercise.note)}</div>
        </div>
        <span class="chip neutral">${safeText(titleCase(exercise.category))}</span>
      </div>

      <div class="exercise-meta">
        <span class="meta-pill">${safeText(exercise.tempo)}</span>
        <span class="meta-pill">${safeText(exercise.rest)}</span>
        ${exercise.progressionText ? `<span class="meta-pill">${safeText(exercise.progressionText)}</span>` : ""}
      </div>

      <div class="goal-load-box">${safeText(exercise.goalLoadText)}</div>

      <div class="exercise-table-wrap">
        <table class="exercise-log-table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Goal</th>
              <th>Log</th>
            </tr>
          </thead>
          <tbody>
            ${(exercise.targets || []).map((target, index) => `
              <tr>
                <td data-label="Set">Set ${index + 1}</td>
                <td data-label="Goal">${target} ${exercise.targetType}</td>
                <td data-label="Log">
                  <input
                    class="small-input table-input"
                    data-log-kind="set"
                    data-exercise-id="${exercise.id}"
                    data-date="${date}"
                    data-set-index="${index}"
                    type="text"
                    inputmode="numeric"
                    placeholder="${exercise.targetType}"
                    value="${existing?.values?.[index] || ""}"
                  >
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="load-grid">
        <div>
          <label for="${exercise.id}-mode">Load mode</label>
          <select
            id="${exercise.id}-mode"
            class="small-input"
            data-log-kind="mode"
            data-exercise-id="${exercise.id}"
            data-date="${date}"
          >
            <option value="normal" ${loadMode === "normal" ? "selected" : ""}>Normal</option>
            <option value="load" ${loadMode === "load" ? "selected" : ""}>Added load</option>
            <option value="assistance" ${loadMode === "assistance" ? "selected" : ""}>Assistance</option>
          </select>
        </div>

        <div>
          <label for="${exercise.id}-load">Load / assistance value</label>
          <input
            id="${exercise.id}-load"
            class="small-input"
            data-log-kind="load"
            data-exercise-id="${exercise.id}"
            data-date="${date}"
            type="text"
            inputmode="decimal"
            placeholder="Required for load or assistance"
            value="${loadValue}"
            ${loadMode === "normal" ? "disabled" : ""}
          >
        </div>
      </div>
    </div>
  `;
}

function getWorkoutStreak(plan, tracker) {
  const workouts = (plan.weeks || [])
    .flatMap((week) => week.workouts || [])
    .filter((workout) => workout.date <= toISODate(new Date()));

  let streak = 0;

  for (let i = workouts.length - 1; i >= 0; i -= 1) {
    const day = tracker.days?.[workouts[i].date];
    const hasWorkoutLog =
      day &&
      Object.keys(day).some((key) => !key.startsWith("_") && !["warmup", "cooldown"].includes(key));

    if (!hasWorkoutLog) break;
    streak += 1;
  }

  return streak;
}

function renderProfile(plan, profileBox, currentPlanBox, tracker) {
  const user = getCurrentUser();
  const streak = getWorkoutStreak(plan, tracker);

  if (profileBox) {
    profileBox.innerHTML = `
      <div class="info-card">
        <div class="info-label">User</div>
        <div class="info-value">${safeText(user?.username, "Local user")}</div>
        <div class="info-sub">${safeText(user?.email, "Stored locally")}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Age band</div>
        <div class="info-value">${safeText(plan.profile.ageBand)}</div>
        <div class="info-sub">${safeText(plan.profile.safetyMode)}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Focus</div>
        <div class="info-value">${plan.profile.focus.length ? plan.profile.focus.map(titleCase).join(", ") : "Not set yet"}</div>
        <div class="info-sub">${plan.profile.equipment.length ? plan.profile.equipment.map(titleCase).join(", ") : "Bodyweight only"}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Training split</div>
        <div class="info-value">${plan.profile.daysPerWeek} workouts / week</div>
        <div class="info-sub">${plan.profile.sessionLength} minutes per workout</div>
      </div>
    `;
  }

  if (currentPlanBox) {
    currentPlanBox.innerHTML = `
      <div class="info-card">
        <div class="info-label">Current block</div>
        <div class="info-value">4-week plan</div>
        <div class="info-sub">${safeText(plan.weeks[0]?.note, "Build week.")}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Readiness system</div>
        <div class="info-value">Active</div>
        <div class="info-sub">Low readiness reduces volume.</div>
      </div>

      <div class="info-card">
        <div class="info-label">Progression</div>
        <div class="info-value">Controlled</div>
        <div class="info-sub">No prescriptions above your reported max.</div>
      </div>

      <div class="info-card">
        <div class="info-label">Hypertrophy</div>
        <div class="info-value">Included</div>
        <div class="info-sub">Strength work uses safe hypertrophy ranges and rep reserves.</div>
      </div>
    `;
  }

  if (byId("currentStreakNumber")) {
    byId("currentStreakNumber").textContent = streak;
  }

  if (byId("currentStreakText")) {
    byId("currentStreakText").textContent =
      streak > 0
        ? `You have ${streak} completed workout day${streak === 1 ? "" : "s"} in a row.`
        : "Complete today’s workout to start your streak.";
  }
}

function renderRecords(plan, tracker, recordsBox) {
  if (!recordsBox) return;

  const pushPoints = getWorkoutHistoryPoint(
    plan,
    tracker,
    (exercise) => exercise.category === "push",
    (entry) => Array.isArray(entry?.values) ? Math.max(...entry.values.map(Number)) : null
  );

  const pullAssistPoints = getWorkoutHistoryPoint(
    plan,
    tracker,
    (exercise) => exercise.category === "pull",
    (entry) => entry?.loadMode === "assistance" ? toNumber(entry.loadValue, null) : null
  );

  const plankPoints = getWorkoutHistoryPoint(
    plan,
    tracker,
    (exercise) => exercise.category === "core",
    (entry) => Array.isArray(entry?.values) ? Math.max(...entry.values.map(Number)) : null
  );

  const cards = [
    { label: "Best mile time", value: plan.records.mileTime, note: "Baseline from planner or workout logs." },
    { label: "Longest run distance", value: plan.records.longestRunDistance, note: "Baseline from planner." },
    { label: "Best push result", value: pushPoints.length ? `${Math.max(...pushPoints.map((p) => p.value))} reps` : plan.records.pushBest, note: "Clean reps matter more than grind reps." },
    { label: "Best pull result", value: pullAssistPoints.length ? `${Math.min(...pullAssistPoints.map((p) => p.value))} assistance` : plan.records.pullBest, note: "Lower assistance counts as progress." },
    { label: "Best plank hold", value: plankPoints.length ? `${Math.max(...plankPoints.map((p) => p.value))} sec` : plan.records.plankBest, note: "Stable holds only." },
    { label: "Best squat result", value: plan.records.squatBest, note: "Baseline from planner or logged sessions." }
  ];

  recordsBox.innerHTML = cards.map((card) => `
    <div class="record-card">
      <div class="record-title">${card.label}</div>
      <div class="record-value">${safeText(card.value)}</div>
      <div class="record-note">${safeText(card.note)}</div>
    </div>
  `).join("");
}

function renderSignals(plan, tracker, signalsBox) {
  if (!signalsBox) return;

  const pushPoints = getWorkoutHistoryPoint(
    plan,
    tracker,
    (exercise) => exercise.category === "push",
    (entry) => Array.isArray(entry?.values) ? Math.max(...entry.values.map(Number)) : null
  );

  const pullAssistPoints = getWorkoutHistoryPoint(
    plan,
    tracker,
    (exercise) => exercise.category === "pull",
    (entry) => entry?.loadMode === "assistance" && String(entry?.loadValue || "").trim() ? toNumber(entry.loadValue, null) : null
  );

  const plankPoints = getWorkoutHistoryPoint(
    plan,
    tracker,
    (exercise) => exercise.category === "core",
    (entry) => Array.isArray(entry?.values) ? Math.max(...entry.values.map(Number)) : null
  );

  const notes = [];

  if (detectPlateau(pushPoints, "higher")) {
    notes.push("Push progress looks flat. A reduced-volume week may help.");
  }

  if (detectPlateau(pullAssistPoints, "lower")) {
    notes.push("Pull assistance is not dropping yet. Keep quality high before progressing.");
  }

  if (detectPlateau(plankPoints, "higher")) {
    notes.push("Core endurance is flat. Hold quality first, then time.");
  }

  if (!notes.length) {
    notes.push("No major warning signs right now. Stay consistent and keep quality high.");
  }

  signalsBox.innerHTML = safeText(notes.join(" "));
}

function renderQuickStats(plan, tracker, quickStatsBox) {
  if (!quickStatsBox) return;

  const totalWorkouts = (plan.weeks || []).reduce((sum, week) => sum + (week.workouts || []).length, 0);
  const loggedWorkouts = Object.values(tracker.days || {}).filter((day) =>
    Object.keys(day).some((key) => !key.startsWith("_") && !["warmup", "cooldown"].includes(key))
  ).length;

  const hypertrophyWorkouts = (plan.weeks || [])
    .flatMap((week) => week.workouts || [])
    .filter((workout) => workout.includesHypertrophy).length;

  quickStatsBox.innerHTML = `
    <div class="info-card">
      <div class="info-label">Workouts in block</div>
      <div class="info-value">${totalWorkouts}</div>
      <div class="info-sub">4-week plan</div>
    </div>

    <div class="info-card">
      <div class="info-label">Logged workouts</div>
      <div class="info-value">${loggedWorkouts}</div>
      <div class="info-sub">Saved on this device</div>
    </div>

    <div class="info-card">
      <div class="info-label">Hypertrophy sessions</div>
      <div class="info-value">${hypertrophyWorkouts}</div>
      <div class="info-sub">Strength days use controlled hypertrophy ranges.</div>
    </div>

    <div class="info-card">
      <div class="info-label">Safety mode</div>
      <div class="info-value">${safeText(plan.profile.safetyMode)}</div>
      <div class="info-sub">Deload built into week 4</div>
    </div>
  `;
}

function renderWeek(plan, tracker, weekTrackerBox, weeksAheadBox) {
  const allWeeks = plan.weeks || [];
  const today = toISODate(new Date());

  const currentWeek =
    allWeeks.find((week) => (week.workouts || []).some((workout) => workout.date === today)) ||
    allWeeks[0];

  if (byId("weekTitle")) {
    byId("weekTitle").textContent = safeText(currentWeek?.label, "Week");
  }

  if (weekTrackerBox) {
    if (!currentWeek || !(currentWeek.workouts || []).length) {
      weekTrackerBox.innerHTML = `<div class="empty-box">No week loaded yet.</div>`;
    } else {
      weekTrackerBox.innerHTML = currentWeek.workouts.map((workout) => {
        const dayLog = tracker.days?.[workout.date];
        const logged = dayLog && Object.keys(dayLog).some((key) => !key.startsWith("_") && !["warmup", "cooldown"].includes(key));

        return `
          <div class="week-card">
            <div class="week-card-title">${safeText(workout.workoutLabel).replace("Workout", "Day")} • ${safeText(workout.name)}</div>
            <div class="week-card-sub">${safeText(workout.description)}</div>
            <div class="week-card-sub">${safeText(workout.dateLabel)}</div>
            <div class="week-card-sub">${logged ? "Logged" : workout.isDeload ? "Deload week" : "Planned"}</div>
          </div>
        `;
      }).join("");
    }
  }

  if (weeksAheadBox) {
    if (!allWeeks.length) {
      weeksAheadBox.innerHTML = `<div class="empty-box">No future weeks yet.</div>`;
    } else {
      weeksAheadBox.innerHTML = allWeeks.map((week) => `
        <div class="week-section">
          <div class="week-title">${safeText(week.label)}</div>
          <div class="week-mini-grid">
            ${(week.workouts || []).map((workout) => `
              <div class="week-mini-card">
                <div class="week-mini-label">${safeText(workout.workoutLabel).replace("Workout", "Day")}</div>
                <div class="week-mini-sub">${safeText(workout.name)}</div>
                <div class="week-mini-sub">${safeText(workout.description)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");
    }
  }
}

function renderToday(plan, tracker, todayBox) {
  if (!todayBox) return;

  const today = toISODate(new Date());
  const allWeeks = plan.weeks || [];

  const activeWeek =
    allWeeks.find((week) => (week.workouts || []).some((workout) => workout.date === today)) ||
    allWeeks[0];

  const weekWorkouts = activeWeek?.workouts || [];

  if (!weekWorkouts.length) {
    todayBox.innerHTML = `<div class="empty-box">No workout is available yet.</div>`;
    return;
  }

  let selectedWorkoutId = getSelectedWorkoutId(plan.createdAt);
  let current = weekWorkouts.find((workout) => workout.id === selectedWorkoutId) || weekWorkouts[0];

  if (!selectedWorkoutId || selectedWorkoutId !== current.id) {
    saveSelectedWorkoutId(plan.createdAt, current.id);
  }

  const dayData = tracker.days?.[current.date] || {};
  const readiness = getReadinessSummary(dayData);
  const displayWorkout = getAdjustedWorkout(current, readiness);
  const readinessLocked = !readiness;

  todayBox.innerHTML = `
    <div class="today-tabs">
      ${weekWorkouts.map((workout) => `
        <button
          type="button"
          class="day-tab ${workout.id === current.id ? "active" : ""}"
          data-workout-tab="${workout.id}"
        >
          ${safeText(workout.workoutLabel).replace("Workout", "Day")}
        </button>
      `).join("")}
    </div>

    <div class="today-card">
      <div class="day-top">
        <div>
          <div class="day-label">${safeText(displayWorkout.workoutLabel).replace("Workout", "Day")}</div>
          <div class="day-title">${safeText(displayWorkout.name)}</div>
          <div class="day-meta">${safeText(displayWorkout.description)} • ${safeText(displayWorkout.dateLabel)}</div>
        </div>
        <span class="badge ${displayWorkout.isDeload ? "warn" : ""}">
          ${displayWorkout.isDeload ? "Deload" : "Planned"}
        </span>
      </div>

      <div class="readiness-box">
        <div class="block-title">Readiness</div>
        <div class="readiness-grid">
          <div>
            <label for="sleepHours">Sleep (hours)</label>
            <input id="sleepHours" class="small-input" type="text" inputmode="decimal" value="${dayData._readiness?.sleepHours || ""}">
          </div>
          <div>
            <label for="soreness">Soreness (1 to 5)</label>
            <input id="soreness" class="small-input" type="text" inputmode="numeric" value="${dayData._readiness?.soreness || ""}">
          </div>
          <div>
            <label for="energy">Energy (1 to 5)</label>
            <input id="energy" class="small-input" type="text" inputmode="numeric" value="${dayData._readiness?.energy || ""}">
          </div>
        </div>
        <div class="button-row">
          <button type="button" id="saveReadinessBtn">Save readiness</button>
        </div>
        <div class="small-note">
          ${
            readiness
              ? `${readiness.label}. ${readiness.note}`
              : "Set readiness first. Workout logging stays locked until readiness is saved."
          }
        </div>
      </div>

      <div class="session-block">
        <div class="block-title">Warm-up</div>
        ${renderTrackerChecklist(displayWorkout.warmup || [], "warmup", current.date, tracker)}
      </div>

      ${(displayWorkout.exercises || []).map((exercise) => renderExerciseCard(exercise, current.date, dayData[exercise.id])).join("")}

      <div class="session-block">
        <div class="block-title">Cooldown</div>
        ${renderTrackerChecklist(displayWorkout.cooldown || [], "cooldown", current.date, tracker)}
      </div>

      <div class="button-row">
        <button type="button" id="saveWorkoutBtn" ${readinessLocked ? "disabled" : ""}>Save workout</button>
      </div>
    </div>
  `;

  qsa("[data-workout-tab]", todayBox).forEach((btn) => {
    btn.addEventListener("click", () => {
      saveSelectedWorkoutId(plan.createdAt, btn.dataset.workoutTab);
      initDashboard();
    });
  });

  byId("saveReadinessBtn")?.addEventListener("click", () => {
    const sleep = toNumber(byId("sleepHours")?.value, 0);
    const soreness = toNumber(byId("soreness")?.value, 0);
    const energy = toNumber(byId("energy")?.value, 0);

    if (!sleep || soreness < 1 || soreness > 5 || energy < 1 || energy > 5) {
      alert("Enter sleep, soreness, and energy before saving readiness.");
      return;
    }

    const next = getTracker(plan.createdAt);
    if (!next.days[current.date]) next.days[current.date] = {};

    next.days[current.date]._readiness = {
      sleepHours: byId("sleepHours")?.value || "",
      soreness: byId("soreness")?.value || "",
      energy: byId("energy")?.value || ""
    };

    saveTracker(plan.createdAt, next);
    initDashboard();
  });

  qsa("[data-track-bucket]", todayBox).forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const next = getTracker(plan.createdAt);
      const date = checkbox.dataset.trackDate;
      if (!next.days[date]) next.days[date] = {};
      const bucket = checkbox.dataset.trackBucket;
      if (!next.days[date][bucket]) next.days[date][bucket] = {};
      next.days[date][bucket][checkbox.dataset.trackIndex] = checkbox.checked;
      saveTracker(plan.createdAt, next);
    });
  });

  qsa('[data-log-kind="mode"]', todayBox).forEach((select) => {
    select.addEventListener("change", () => {
      const loadInput = byId(`${select.dataset.exerciseId}-load`);
      if (loadInput) {
        loadInput.disabled = select.value === "normal";
      }
    });
  });

  if (readinessLocked) {
    qsa("[data-log-kind]", todayBox).forEach((el) => {
      el.disabled = true;
    });

    qsa("[data-track-bucket]", todayBox).forEach((el) => {
      el.disabled = true;
    });
  }

  byId("saveWorkoutBtn")?.addEventListener("click", () => {
    const currentTracker = getTracker(plan.createdAt);

    if (!currentTracker.days[current.date]) {
      currentTracker.days[current.date] = {};
    }

    const readinessNow = getReadinessSummary(currentTracker.days[current.date]);

    if (!readinessNow) {
      alert("Save readiness first.");
      return;
    }

    let loadError = "";

    (displayWorkout.exercises || []).forEach((exercise) => {
      if (exercise.skipped) return;

      if (exercise.targetType === "minutes") {
        currentTracker.days[current.date][exercise.id] = {
          logText: byId(`${exercise.id}-log`)?.value || "",
          noteText: byId(`${exercise.id}-note`)?.value || ""
        };
        return;
      }

      const values = qsa(
        `[data-exercise-id="${exercise.id}"][data-log-kind="set"]`,
        todayBox
      )
        .map((input) => toNumber(input.value, 0))
        .filter((v) => v > 0);

      const mode =
        qsa(`[data-exercise-id="${exercise.id}"][data-log-kind="mode"]`, todayBox)[0]
          ?.value || "normal";

      const loadValue =
        qsa(`[data-exercise-id="${exercise.id}"][data-log-kind="load"]`, todayBox)[0]
          ?.value || "";

      if ((mode === "load" || mode === "assistance") && !String(loadValue).trim()) {
        loadError = `${exercise.name}: enter a load or assistance value.`;
      }

      currentTracker.days[current.date][exercise.id] = {
        values,
        loadMode: mode,
        loadValue
      };
    });

    if (loadError) {
      alert(loadError);
      return;
    }

    saveTracker(plan.createdAt, currentTracker);
    initDashboard();
  });
}

function renderEmptyDashboard() {
  if (byId("currentPlanBox")) byId("currentPlanBox").innerHTML = `<div class="empty-box">Build your plan in the planner first.</div>`;
  if (byId("profileBox")) byId("profileBox").innerHTML = `<div class="empty-box">No profile loaded yet.</div>`;
  if (byId("recordsBox")) byId("recordsBox").innerHTML = `<div class="empty-box">No records yet.</div>`;
  if (byId("signalsBox")) byId("signalsBox").innerHTML = `No coaching signals yet.`;
  if (byId("quickStatsBox")) byId("quickStatsBox").innerHTML = `<div class="empty-box">No quick stats yet.</div>`;
  if (byId("todayBox")) byId("todayBox").innerHTML = `<div class="empty-box">No workout to show yet.</div>`;
  if (byId("weekTrackerBox")) byId("weekTrackerBox").innerHTML = `<div class="empty-box">No week loaded yet.</div>`;
  if (byId("weeksAheadBox")) byId("weeksAheadBox").innerHTML = `<div class="empty-box">No future weeks yet.</div>`;
  if (byId("currentStreakNumber")) byId("currentStreakNumber").textContent = "0";
  if (byId("currentStreakText")) byId("currentStreakText").textContent = "Build a plan to get started.";
  if (byId("weekTitle")) byId("weekTitle").textContent = "Week";
}

async function initDashboard() {
  const plan = await loadCurrentPlan();

  if (!plan || !(plan.weeks || []).length) {
    renderEmptyDashboard();
    return;
  }

  const tracker = getTracker(plan.createdAt);
  renderProfile(plan, byId("profileBox"), byId("currentPlanBox"), tracker);
  renderRecords(plan, tracker, byId("recordsBox"));
  renderSignals(plan, tracker, byId("signalsBox"));
  renderQuickStats(plan, tracker, byId("quickStatsBox"));
  renderWeek(plan, tracker, byId("weekTrackerBox"), byId("weeksAheadBox"));
  renderToday(plan, tracker, byId("todayBox"));

  byId("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    window.location.href = "./account-test.html";
  });
}

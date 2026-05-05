const STORAGE_KEYS = {
  token: "fitnessplan_token",
  user: "fitnessplan_user",
  plannerDraft: "fitnessplan_planner_draft",
  currentPlanCache: "fitnessplan_current_plan_cache"
};

const PLANNER_DRAFT_VERSION = 3;

const API_BASE = "https://fitnessplan-api.cosmowind2013.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body?.dataset?.page || "";
  if (page === "account") {
    await initAccount();
  } else if (page === "planner") {
    await initPlanner();
  } else if (page === "dashboard") {
    await initDashboard();
  }
});

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

function unique(arr) {
  return [...new Set(Array.isArray(arr) ? arr : [])];
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function goalLabel(value) {
  const map = {
    "mile": "Mile", "5k": "5K", "10k": "10K",
    "half-marathon": "Half Marathon", "marathon": "Marathon", "ultra": "Ultra Marathon",
    "sprint-tri": "Sprint Triathlon", "olympic-tri": "Olympic Triathlon",
    "half-ironman": "Half Ironman (70.3)", "ironman": "Ironman",
    "cycling-10mi": "10 Mile TT", "cycling-25mi": "25 Mile Ride",
    "cycling-50mi": "Century Prep (50mi)", "cycling-100mi": "Century (100mi)",
    "gran-fondo": "Gran Fondo",
    "swim-500m": "500m Continuous", "swim-1500m": "1500m Swim",
    "swim-open-1k": "Open Water 1K", "swim-ironman": "2.4 Mile Swim",
    "400m": "400m Dash", "800m": "800m Run", "vo2max": "VO2 Max", "rhr": "Cardiac Base"
  };
  return map[value] || titleCase(String(value).replace(/-/g, " "));
}

function getEnduranceGoals(formData) {
  const types = formData.enduranceType || [];
  const focus = formData.focus || [];
  const hasRunning = types.includes("running");
  const hasCycling = types.includes("cycling");
  const hasSwimming = types.includes("swimming");
  const hasCardio = focus.includes("cardio");
  const isTri = hasRunning && hasCycling && hasSwimming;
  const goals = [];

  if (isTri) {
    goals.push(
      { value: "sprint-tri",   label: "Sprint Triathlon",     desc: "750m swim · 20km bike · 5km run" },
      { value: "olympic-tri",  label: "Olympic Triathlon",    desc: "1.5km swim · 40km bike · 10km run" },
      { value: "half-ironman", label: "Half Ironman (70.3)",  desc: "1.9km swim · 90km bike · 21km run" },
      { value: "ironman",      label: "Ironman",              desc: "3.8km swim · 180km bike · 42.2km run" }
    );
  }
  if (hasRunning) {
    goals.push(
      { value: "mile",           label: "Mile",          desc: "Run a fast mile — speed focused" },
      { value: "5k",             label: "5K",            desc: "3.1 miles — speed and aerobic base" },
      { value: "10k",            label: "10K",           desc: "6.2 miles — threshold and endurance" },
      { value: "half-marathon",  label: "Half Marathon", desc: "13.1 miles" },
      { value: "marathon",       label: "Marathon",      desc: "26.2 miles" },
      { value: "ultra",          label: "Ultra Marathon",desc: "50K or beyond" }
    );
  }
  if (hasCycling && !isTri) {
    goals.push(
      { value: "cycling-10mi",  label: "10 Mile TT",       desc: "Sustained time trial effort" },
      { value: "cycling-25mi",  label: "25 Mile Ride",     desc: "Moderate endurance ride" },
      { value: "cycling-50mi",  label: "Century Prep",     desc: "Build to 50 mile ride" },
      { value: "cycling-100mi", label: "Century (100mi)",  desc: "Complete a century ride" },
      { value: "gran-fondo",    label: "Gran Fondo",       desc: "Long sportive event" }
    );
  }
  if (hasSwimming && !isTri) {
    goals.push(
      { value: "swim-500m",    label: "500m Continuous", desc: "Swim 500m non-stop" },
      { value: "swim-1500m",   label: "1500m Swim",      desc: "Olympic distance swim" },
      { value: "swim-open-1k", label: "Open Water 1K",   desc: "Open water 1km" },
      { value: "swim-ironman", label: "2.4 Mile Swim",   desc: "Full Ironman swim leg" }
    );
  }
  if (hasCardio) {
    goals.push(
      { value: "400m",  label: "400m Dash",    desc: "Track sprint event" },
      { value: "800m",  label: "800m Run",     desc: "Middle distance track" },
      { value: "vo2max",label: "VO2 Max",      desc: "Maximize aerobic capacity" },
      { value: "rhr",   label: "Cardiac Base", desc: "Lower resting heart rate" }
    );
  }
  return goals;
}

function getGoalSessionPlan(primaryGoal, daysAvailable, week) {
  const isDeload = week === 4;
  const plans = {
    "mile":           ["easy", "interval", "tempo", "easy"],
    "5k":             ["easy", "interval", "tempo", "easy"],
    "10k":            ["easy", "tempo",    "interval", "long"],
    "half-marathon":  ["easy", "easy",     "tempo",    "long"],
    "marathon":       ["easy", "easy",     "tempo",    "long"],
    "ultra":          ["easy", "easy",     "long",     "long"],
    "sprint-tri":     ["easy", "interval", "brick",    "long"],
    "olympic-tri":    ["easy", "tempo",    "brick",    "long"],
    "half-ironman":   ["easy", "easy",     "tempo",    "long"],
    "ironman":        ["easy", "easy",     "long",     "long"],
    "cycling-10mi":   ["easy", "interval", "tempo",    "easy"],
    "cycling-25mi":   ["easy", "tempo",    "long",     "easy"],
    "cycling-50mi":   ["easy", "easy",     "long",     "easy"],
    "cycling-100mi":  ["easy", "easy",     "long",     "easy"],
    "gran-fondo":     ["easy", "easy",     "long",     "easy"],
    "swim-500m":      ["easy", "interval", "tempo",    "easy"],
    "swim-1500m":     ["easy", "tempo",    "long",     "easy"],
    "swim-open-1k":   ["easy", "tempo",    "long",     "easy"],
    "swim-ironman":   ["easy", "easy",     "long",     "easy"],
    "400m":           ["easy", "interval", "interval", "easy"],
    "800m":           ["easy", "interval", "tempo",    "easy"],
    "vo2max":         ["easy", "interval", "tempo",    "easy"],
    "rhr":            ["easy", "easy",     "long",     "easy"]
  };
  const plan = (plans[primaryGoal] || ["easy", "easy", "long", "easy"]).slice(0, daysAvailable);
  if (isDeload) {
    return plan.map(s => (s === "long" || s === "brick") ? "easy" : s === "interval" ? "tempo" : "easy");
  }
  return plan;
}


function formatDateLabel(dateLike) {
  const date = new Date(typeof dateLike === "string" ? `${dateLike}T12:00:00` : dateLike);
  if (Number.isNaN(date.getTime())) return "Date not set";
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

function parseTimeToSeconds(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parts = text.split(":").map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return (parts[0] * 60) + parts[1];
}

function parseFirstNumber(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function setStatus(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.className = "status-box";
  if (type) el.classList.add(type);
}

function savePlannerDraft(draft) {
  const versionedDraft = {
    ...(draft || {}),
    _draftVersion: PLANNER_DRAFT_VERSION
  };

  localStorage.setItem(STORAGE_KEYS.plannerDraft, JSON.stringify(versionedDraft));
}

function getPlannerDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.plannerDraft) || "null");

    if (!draft || draft._draftVersion !== PLANNER_DRAFT_VERSION) {
      localStorage.removeItem(STORAGE_KEYS.plannerDraft);
      return null;
    }

    return draft;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.plannerDraft);
    return null;
  }
}
}

function cachePlan(plan) {
  localStorage.setItem(STORAGE_KEYS.currentPlanCache, JSON.stringify(plan));
}

function getCachedPlan() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentPlanCache) || "null");
  } catch {
    return null;
  }
}

function setCurrentUser(user, token) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.token, token);
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.token);
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null");
  } catch {
    return null;
  }
}

function getCurrentToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || "";
}

function authHeaders() {
  const token = getCurrentToken();
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    : {
        "Content-Type": "application/json"
      };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders()
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Server error");
  }

  return data;
}

async function signup(payload) {
  const data = await api("/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  setCurrentUser(data.user, data.token);
  return data;
}

async function login(payload) {
  const data = await api("/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  setCurrentUser(data.user, data.token);
  return data;
}

async function logout() {
  try {
    await api("/logout", { method: "POST" });
  } catch {}
  clearCurrentUser();
}

async function fetchMe() {
  const token = getCurrentToken();
  if (!token) return null;

  try {
    const data = await api("/me", { method: "GET" });
    if (data.user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch {
    clearCurrentUser();
    return null;
  }
}

async function saveCurrentPlan(plan) {
  cachePlan(plan);

  try {
    await api("/me/plan", {
      method: "POST",
      body: JSON.stringify({ plan })
    });
  } catch (error) {
    console.error("Plan save failed:", error);
  }
}

async function loadCurrentPlan() {
  try {
    const data = await api("/me/plan", { method: "GET" });
    if (data.plan) {
      cachePlan(data.plan);
      return normalizeLoadedPlan(data.plan);
    }
  } catch (error) {
    console.error("Plan load failed:", error);
  }

  return normalizeLoadedPlan(getCachedPlan());
}

function trackerKey(planId = "default") {
  const user = getCurrentUser();
  return `fitnessplan_tracker_${(user?.email || "guest").toLowerCase()}_${planId}`;
}

function selectionKey(planId = "default") {
  const user = getCurrentUser();
  return `fitnessplan_day_selection_${(user?.email || "guest").toLowerCase()}_${planId}`;
}

async function saveTracker(planId, tracker) {
  localStorage.setItem(trackerKey(planId), JSON.stringify(tracker));

  try {
    await api("/me/tracker", {
      method: "POST",
      body: JSON.stringify({ tracker })
    });
  } catch (error) {
    console.error("Tracker save failed:", error);
  }
}

async function loadTracker(planId) {
  try {
    const data = await api("/me/tracker", { method: "GET" });
    if (data.tracker) {
      localStorage.setItem(trackerKey(planId), JSON.stringify(data.tracker));
      return data.tracker;
    }
  } catch (error) {
    console.error("Tracker load failed:", error);
  }

  try {
    return JSON.parse(localStorage.getItem(trackerKey(planId)) || '{"days":{}}');
  } catch {
    return { days: {} };
  }
}

function getSelectedWorkoutId(planId) {
  return localStorage.getItem(selectionKey(planId)) || "";
}

function setSelectedWorkoutId(planId, workoutId) {
  localStorage.setItem(selectionKey(planId), workoutId);
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
  { value: "none", name: "Cannot do one yet", targetType: "seconds" },
  { value: "plank", name: "Plank (floor)", targetType: "seconds" },
  { value: "scapula", name: "Scapula push-up", targetType: "reps" },
  { value: "wall", name: "Wall push-up", targetType: "reps" },
  { value: "incline", name: "Incline push-up", targetType: "reps" },
  { value: "knee", name: "Knee push-up", targetType: "reps" },
  { value: "negatives", name: "Negative push-up", targetType: "reps" },
  { value: "regular", name: "Regular push-up", targetType: "reps" },
  { value: "wide", name: "Wide push-up", targetType: "reps" },
  { value: "diamond", name: "Diamond push-up", targetType: "reps" },
  { value: "pike", name: "Pike Push-Ups", targetType: "reps" },
  { value: "tricep", name: "Tricep extensions", targetType: "reps" },
  { value: "exploding", name: "Power push-up", targetType: "reps" },
  { value: "archer", name: "Archer push-up", targetType: "reps" },
  { value: "one-arm-archer", name: "One-arm archer", targetType: "reps" },
  { value: "hspu-wall", name: "Wall handstand push-up", targetType: "reps" }
];

const PULL_VARIATIONS = [
  { value: "none", name: "Cannot do one yet", targetType: "seconds" },
  { value: "dead-hang", name: "Dead hang", targetType: "seconds" },
  { value: "scapula", name: "Scapular pull-up", targetType: "reps" },
  { value: "active-hang", name: "Active hang", targetType: "seconds" },
  { value: "negatives", name: "Negative pull-up", targetType: "reps" },
  { value: "assisted", name: "Band-assisted pull-up", targetType: "reps" },
  { value: "regular", name: "Regular pull-up", targetType: "reps" },
  { value: "wide", name: "Wide pull-up", targetType: "reps" },
  { value: "archer", name: "Archer pull-up", targetType: "reps" },
  { value: "weighted", name: "Weighted pull-up", targetType: "reps" },
  { value: "muscle-up", name: "Muscle up", targetType: "reps" }
];

const SQUAT_VARIATIONS = [
  { value: "none", name: "Cannot do one yet" },
  { value: "box", name: "Box squat" },
  { value: "assisted", name: "Assisted squat" },
  { value: "pistol-assisted", name: "Assisted pistol squat" },
  { value: "regular", name: "Regular bodyweight squat" },
  { value: "split", name: "Split squat / lunge" },
  { value: "bulgarian", name: "Bulgarian split squat" },
  { value: "pistol", name: "Pistol squat" }
];

function findVariation(list, value) {
  return list.find((item) => item.value === value) || list[0];
}

function normalizeFormData(raw) {
  const data = { ...(raw || {}) };
  data.parentConsent = !!data.parentConsent;
  data.focus = unique(data.focus);
data.enduranceType = unique(data.enduranceType);
data.enduranceGoal = unique(data.enduranceGoal);
data.equipment = unique(data.equipment);
data.strengthGoals = unique(data.strengthGoals);
data.pushSkill = unique(data.pushSkill);
data.pullSkill = unique(data.pullSkill);

data.gender = data.gender || "";
data.weight = String(data.weight || "").trim();
data.weightUnit = data.weightUnit || "kg";
data.height = String(data.height || "").trim();
data.heightUnit = data.heightUnit || "cm";
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
  data.mileTime = data.mileTime || "";
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

  normalized.weeks = Array.isArray(normalized.weeks) ? normalized.weeks : [];
  return normalized;
}

function buildWarmup(type) {
  if (type === "endurance") {
    return [
      { text: "Easy movement", targetType: "minutes", target: 4 },
      { text: "Joint prep", targetType: "reps", target: 8 },
      { text: "Short build-ups", targetType: "reps", target: 2 }
    ];
  }

  return [
    { text: "Easy movement", targetType: "minutes", target: 3 },
    { text: "Prep mobility", targetType: "reps", target: 8 },
    { text: "Movement rehearsal", targetType: "reps", target: 6 }
  ];
}

function buildCooldown(type) {
  if (type === "endurance") {
    return [
      { text: "Easy walk", targetType: "minutes", target: 3 },
      { text: "Calf stretch", targetType: "seconds", target: 30 },
      { text: "Hip stretch", targetType: "seconds", target: 30 }
    ];
  }

  return [
    { text: "Easy walk", targetType: "minutes", target: 2 },
    { text: "Light stretch", targetType: "seconds", target: 30 }
  ];
}

function buildExercise({ id, name, category, targetType, targets, tempo, rest, loadMode = "normal", goalLoadText = "", note = "" }) {
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
    note
  };
}

function normalizeGoalName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getPrimaryRuleGoal(formData) {
  const explicit = normalizeGoalName(formData.goal || formData.primaryGoal || formData.mainGoal);

  if (["hypertrophy", "strength", "endurance", "tendon", "balance"].includes(explicit)) {
    return explicit;
  }

  if (explicit === "tendon-rehab" || explicit === "rehab") return "tendon";
  if (explicit === "stability" || explicit === "balance-stability") return "balance";

  const focus = formData.focus || [];

  if (focus.includes("hypertrophy")) return "hypertrophy";
  if (focus.includes("strength")) return "strength";
  if (focus.includes("endurance") || focus.includes("cardio")) return "endurance";
  if (focus.includes("tendon") || focus.includes("rehab") || focus.includes("tendon-rehab")) return "tendon";
  if (focus.includes("balance") || focus.includes("flexibility")) return "balance";

  return "strength";
}

function getExperienceLevel(formData) {
  const explicit = normalizeGoalName(formData.experience || formData.experienceLevel || formData.trainingAge);

  if (["beginner", "intermediate", "advanced"].includes(explicit)) {
    return explicit;
  }

  const push = toNumber(formData.pushupMax, 0);
  const pull = toNumber(formData.pullupMax, 0);
  const squat = toNumber(formData.squatMax, 0);
  const mileSeconds = parseTimeToSeconds(formData.mileTime);

  if (push >= 30 || pull >= 8 || squat >= 40 || (mileSeconds && mileSeconds < 420)) {
    return "advanced";
  }

  if (push >= 12 || pull >= 3 || squat >= 20 || (mileSeconds && mileSeconds < 540)) {
    return "intermediate";
  }

  return "beginner";
}

function hasEquipment(formData, item) {
  return (formData.equipment || []).includes(item);
}

function getLoadLimits(formData) {
  const age = getAgeFromDob(formData.dob) || 18;
  const experience = getExperienceLevel(formData);

  const baseSets = {
    beginner: [8, 12],
    intermediate: [10, 16],
    advanced: [12, 20]
  };

  let weeklySets = baseSets[experience] || baseSets.beginner;
  let ageLoad = "full";

  if (age <= 13) {
    ageLoad = "low-moderate";
    weeklySets = [Math.min(weeklySets[0], 8), Math.min(weeklySets[1], 12)];
  } else if (age <= 17) {
    ageLoad = "moderate";
    weeklySets = [weeklySets[0], Math.min(weeklySets[1], 16)];
  }

  return {
    age,
    experience,
    ageLoad,
    weeklySets,
    avoidFailure: experience === "beginner" || age < 18,
    maxHardDays: age < 18 ? 1 : formData.daysPerWeek >= 5 ? 2 : 1,
    deloadWeek: 4
  };
}

function safeRepTarget(maxClean, desired, fallback = 6) {
  const max = toNumber(maxClean, 0);
  if (!max) return fallback;

  return Math.max(1, Math.min(desired, Math.floor(max * 0.7)));
}

function getSplitType(formData) {
  if (formData.sessionLength === 30) return "full-body";
  if (formData.sessionLength === 60) return "upper-lower";
  return "detailed";
}

function getPrimaryEnduranceType(formData, index = 0) {
  const types = formData.enduranceType?.length ? formData.enduranceType : ["running"];
  return types[index % types.length];
}

function getPrimaryEnduranceGoal(formData) {
  return formData.enduranceGoal?.[0] || "5k";
}

function getStrengthEmphasisSequence(formData, goal) {
  const days = formData.daysPerWeek;
  const split = getSplitType(formData);

  if (split === "full-body") {
    return Array.from({ length: days }, () => "full");
  }

  if (split === "upper-lower") {
    const sequence = ["upper", "lower", "upper", "lower", "full"];
    return sequence.slice(0, days);
  }

  if (goal === "hypertrophy") {
    return ["push", "pull", "legs", "upper", "lower"].slice(0, days);
  }

  return ["push", "pull", "legs", "full", "upper"].slice(0, days);
}

function getEnduranceSessionSequence(formData, week) {
  const days = formData.daysPerWeek;
  const goal = getPrimaryEnduranceGoal(formData);
  const isDeload = week === 4;

  let sequence;

  if (goal === "mile" || goal === "400m" || goal === "800m") {
    sequence = ["easy", "speed", "easy", "tempo", "easy"];
  } else if (goal === "10k" || goal === "half-marathon" || goal === "marathon" || goal === "ultra") {
    sequence = ["easy", "tempo", "easy", "long", "easy"];
  } else if (goal === "sprint-tri" || goal === "olympic-tri" || goal === "half-ironman" || goal === "ironman") {
    sequence = ["easy", "technique", "easy", "brick", "long"];
  } else {
    sequence = ["easy", "interval", "easy", "long", "easy"];
  }

  sequence = sequence.slice(0, days);

  if (isDeload) {
    return sequence.map((item) => {
      if (["interval", "speed", "tempo", "brick", "long"].includes(item)) return "easy";
      return item;
    });
  }

  return sequence;
}

function getWorkoutSlots(formData, week = 1) {
  const goal = getPrimaryRuleGoal(formData);
  const days = formData.daysPerWeek;
  const slots = [];

  if (goal === "hypertrophy" || goal === "strength") {
    const sequence = getStrengthEmphasisSequence(formData, goal);

    return sequence.map((emphasis) => ({
      kind: "strength",
      ruleGoal: goal,
      emphasis,
      label:
        goal === "hypertrophy"
          ? `${titleCase(emphasis)} Hypertrophy`
          : `${titleCase(emphasis)} Strength`
    }));
  }

  if (goal === "endurance") {
    const sequence = getEnduranceSessionSequence(formData, week);

    return sequence.map((sessionType, index) => {
      const type = getPrimaryEnduranceType(formData, index);

      return {
        kind: "endurance",
        ruleGoal: "endurance",
        emphasis: type,
        sessionType,
        label: `${titleCase(type)} ${titleCase(sessionType)}`
      };
    });
  }

  if (goal === "tendon") {
    return Array.from({ length: days }, (_, index) => ({
      kind: "rehab",
      ruleGoal: "tendon",
      emphasis: "tendon",
      label: `Tendon Rehab ${index + 1}`
    }));
  }

  if (goal === "balance") {
    return Array.from({ length: days }, (_, index) => ({
      kind: "balance",
      ruleGoal: "balance",
      emphasis: "balance",
      label: `Balance Stability ${index + 1}`
    }));
  }

  return Array.from({ length: days }, (_, index) => ({
    kind: "strength",
    ruleGoal: "strength",
    emphasis: index % 2 === 0 ? "upper" : "lower",
    label: "General Strength"
  }));
}

function choosePushExercise(formData) {
  if (hasEquipment(formData, "dumbbells") || hasEquipment(formData, "full-gym")) {
    return "Dumbbell Press";
  }

  return findVariation(PUSH_VARIATIONS, formData.pushVariation || "incline").name;
}

function choosePullExercise(formData) {
  if (hasEquipment(formData, "dumbbells") || hasEquipment(formData, "full-gym")) {
    return "Dumbbell Row";
  }

  if (hasEquipment(formData, "pullup-bar")) {
    return findVariation(PULL_VARIATIONS, formData.pullVariation || "assisted").name;
  }

  if (hasEquipment(formData, "bands")) {
    return "Band Row";
  }

  return "Prone W Raise";
}

function chooseLegExercise(formData) {
  if (hasEquipment(formData, "dumbbells") || hasEquipment(formData, "full-gym")) {
    return "Goblet Squat";
  }

  return findVariation(SQUAT_VARIATIONS, formData.squatVariation || "regular").name;
}

function buildStrengthExercises(formData, emphasis, week, sessionLength, ruleGoal = getPrimaryRuleGoal(formData)) {
  const limits = getLoadLimits(formData);
  const isHypertrophy = ruleGoal === "hypertrophy";
  const isDeload = week === 4;

  const baseSets =
    sessionLength === 30
      ? 2
      : sessionLength === 60
        ? 3
        : 4;

  const safeSets = limits.age <= 13 ? Math.min(baseSets, 3) : baseSets;
  const finalSets = isDeload ? Math.max(1, safeSets - 1) : safeSets;

  const compoundReps = isHypertrophy
    ? safeRepTarget(formData.pushupMax, 10, 8)
    : safeRepTarget(formData.pushupMax, 5, 5);

  const pullReps = isHypertrophy
    ? safeRepTarget(formData.pullupMax, 10, 8)
    : safeRepTarget(formData.pullupMax, 5, 4);

  const squatReps = isHypertrophy
    ? safeRepTarget(formData.squatMax, 12, 10)
    : safeRepTarget(formData.squatMax, 6, 6);

  const rest = isHypertrophy ? "60-90s" : "2-4 min";
  const tempo = isHypertrophy ? "Controlled reps, 1 to 3 reps in reserve" : "Clean powerful reps, no form breakdown";
  const goalLoadText = isHypertrophy
    ? "Hypertrophy focus: use 6-12 reps on main work and stop with 1 to 3 reps in reserve."
    : "Strength focus: use 3-6 quality reps and rest long enough to keep form sharp.";

  const push = buildExercise({
    id: `push-${ruleGoal}-${week}`,
    name: choosePushExercise(formData),
    category: "push",
    targetType: "reps",
    targets: Array.from({ length: finalSets }, () => compoundReps),
    tempo,
    rest,
    loadMode: hasEquipment(formData, "dumbbells") ? "load" : "normal",
    goalLoadText,
    note: isHypertrophy ? "Main push muscle-building work." : "Main push strength work."
  });

  const pull = buildExercise({
    id: `pull-${ruleGoal}-${week}`,
    name: choosePullExercise(formData),
    category: "pull",
    targetType: "reps",
    targets: Array.from({ length: finalSets }, () => pullReps),
    tempo,
    rest,
    loadMode: hasEquipment(formData, "dumbbells") ? "load" : formData.pullVariation === "assisted" ? "assistance" : "normal",
    goalLoadText,
    note: isHypertrophy ? "Main pull muscle-building work." : "Main pull strength work."
  });

  const legs = buildExercise({
    id: `legs-${ruleGoal}-${week}`,
    name: chooseLegExercise(formData),
    category: "legs",
    targetType: "reps",
    targets: Array.from({ length: finalSets }, () => squatReps),
    tempo,
    rest,
    loadMode: hasEquipment(formData, "dumbbells") ? "load" : "normal",
    goalLoadText,
    note: isHypertrophy ? "Main lower body muscle-building work." : "Main lower body strength work."
  });

  const core = buildExercise({
    id: `core-${ruleGoal}-${week}`,
    name: "Plank Hold",
    category: "core",
    targetType: "seconds",
    targets: Array.from({ length: 2 }, () =>
      Math.max(15, Math.floor((formData.plankMax || 30) * (isDeload ? 0.55 : 0.7)))
    ),
    tempo: "Steady brace",
    rest: "45-60s",
    goalLoadText: "Stop before form breaks.",
    note: "Core support work."
  });

  if (emphasis === "push") return [push, core];
  if (emphasis === "pull") return [pull, core];
  if (emphasis === "legs" || emphasis === "lower") return [legs, core];
  if (emphasis === "upper") return [push, pull, core];

  return [push, legs, pull, core];
}

function buildEnduranceExercises(formData, type, week, sessionType = "easy") {
  const limits = getLoadLimits(formData);
  const baseMinutes = Math.max(10, parseFirstNumber(formData.runDuration) || Math.min(25, formData.sessionLength));
  const isDeload = week === 4;

  let target;
  let note;
  let tempo;
  let rest = "Continuous";

  if (sessionType === "easy" || sessionType === "technique") {
    target = Math.round(baseMinutes * (isDeload ? 0.75 : 1 + (week - 1) * 0.05));
    tempo = "Conversational pace";
    note = sessionType === "technique"
      ? `Technique-focused ${type} session. Keep it controlled.`
      : `Easy ${type} session. This builds the aerobic base.`;
  } else if (sessionType === "interval" || sessionType === "speed") {
    target = Math.round(baseMinutes * 0.7);
    tempo = sessionType === "speed" ? "Fast but controlled repeats" : "200m to 400m repeat effort";
    rest = "Recover fully between repeats";
    note = `Hard ${type} work. Keep this limited. Most weekly work should still be easy.`;
  } else if (sessionType === "tempo") {
    target = Math.round(baseMinutes * 0.85);
    tempo = "Sustained moderate-hard effort";
    note = `Tempo ${type} session. Controlled discomfort, not all-out.`;
  } else if (sessionType === "long" || sessionType === "brick") {
    target = Math.round(baseMinutes * (1.1 + (week - 1) * 0.06));
    tempo = "Smooth steady pace";
    note = sessionType === "brick"
      ? `Brick-style session. Keep intensity low and transitions simple.`
      : `Long ${type} session. Build endurance without racing it.`;
  } else {
    target = baseMinutes;
    tempo = "Smooth steady pace";
    note = `${titleCase(type)} endurance session.`;
  }

  if (limits.age <= 13) {
    target = Math.min(target, 45);
  } else if (limits.age <= 17) {
    target = Math.min(target, 60);
  } else {
    target = Math.min(target, 90);
  }

  return [
    buildExercise({
      id: `endurance-${type}-${sessionType}-${week}`,
      name: `${titleCase(type)} ${titleCase(sessionType)}`,
      category: "endurance",
      targetType: "minutes",
      targets: [Math.max(8, target)],
      tempo,
      rest,
      goalLoadText: "Endurance structure: mostly easy work, limited hard work.",
      note
    })
  ];
}

function buildRehabExercises(formData, week, sessionLength) {
  const pain = toNumber(formData.painLevel || formData.pain || 0, 0);
  const regress = pain > 5;
  const isDeload = week === 4;

  const holdSeconds = regress ? 30 : isDeload ? 30 : 45;
  const reps = regress ? 10 : 15;
  const sets = sessionLength === 30 ? 2 : 3;

  return [
    buildExercise({
      id: `rehab-isometric-${week}`,
      name: "Pain-Free Isometric Hold",
      category: "rehab",
      targetType: "seconds",
      targets: Array.from({ length: sets }, () => holdSeconds),
      tempo: "Hold steady without sharp pain",
      rest: "60-90s",
      goalLoadText: "Pain ≤3/10 is acceptable. Pain >5/10 means regress.",
      note: regress ? "Pain is high, so this session is regressed." : "Build tendon tolerance with controlled holds."
    }),
    buildExercise({
      id: `rehab-eccentric-${week}`,
      name: "Slow Eccentric Control",
      category: "rehab",
      targetType: "reps",
      targets: Array.from({ length: sets }, () => reps),
      tempo: "3-5 sec eccentric",
      rest: "60-90s",
      goalLoadText: "Increase load slowly only if pain stays controlled.",
      note: "Tendon rehab work. Slow control matters more than intensity."
    })
  ];
}

function buildBalanceExercises(formData, week, sessionLength) {
  const experience = getExperienceLevel(formData);
  const sets = sessionLength === 30 ? 2 : 3;

  let level = "static";
  if (experience === "intermediate") level = "controlled";
  if (experience === "advanced") level = "dynamic";

  const exerciseName =
    level === "static"
      ? "Single-Leg Stand"
      : level === "controlled"
        ? "Single-Leg Reach"
        : "Dynamic Single-Leg Balance Drill";

  return [
    buildExercise({
      id: `balance-main-${week}`,
      name: exerciseName,
      category: "balance",
      targetType: "seconds",
      targets: Array.from({ length: sets }, () => 30),
      tempo: "Slow and controlled",
      rest: "30-60s",
      goalLoadText: "Progression: static → controlled movement → unstable → dynamic.",
      note: "Balance work. Regress if control breaks."
    }),
    buildExercise({
      id: `balance-control-${week}`,
      name: "Slow Control Drill",
      category: "balance",
      targetType: "reps",
      targets: Array.from({ length: sets }, () => 8),
      tempo: "3 sec down, pause, controlled return",
      rest: "30-60s",
      goalLoadText: "Quality beats difficulty.",
      note: "Motor control and stability work."
    })
  ];
}

function getLikelyLimiter(formData) {
  const goal = getPrimaryRuleGoal(formData);

  if (goal === "endurance") {
    if (!formData.runDuration || !formData.runDistance) return "aerobic base";
    if (parseTimeToSeconds(formData.mileTime) && parseTimeToSeconds(formData.mileTime) > 600) return "speed ceiling";
    return "aerobic base or pacing";
  }

  if (goal === "hypertrophy") return "volume or load mismatch";
  if (goal === "strength") return "technique or neural fatigue";
  if (goal === "tendon") return "load tolerance";
  if (goal === "balance") return "motor control";

  return "training consistency";
}

function getAdjustmentRule(formData) {
  const goal = getPrimaryRuleGoal(formData);

  if (goal === "hypertrophy") {
    return "If progress stalls, adjust only one factor: add load first, reduce volume if fatigue is high, or add 2 sets only if recovery is good.";
  }

  if (goal === "strength") {
    return "If progress stalls, adjust only one factor: increase rest, reduce frequency, or lower load if form breaks.";
  }

  if (goal === "endurance") {
    return "If early fatigue appears, increase easy volume; if speed is the limiter, add limited intervals.";
  }

  if (goal === "tendon") {
    return "If pain increases above 5/10, regress immediately; if pain stays ≤3/10, increase load slowly.";
  }

  if (goal === "balance") {
    return "If control breaks, regress the drill; if stable, progress to slow movement before unstable surfaces.";
  }

  return "Adjust only the limiting factor.";
}

function buildPlan(rawFormData) {
  const formData = normalizeFormData(rawFormData);
  const age = getAgeFromDob(formData.dob);
  const goal = getPrimaryRuleGoal(formData);
  const limits = getLoadLimits(formData);
  const weeks = [];
  const startDate = formData.startDate || toISODate(new Date());

  for (let week = 1; week <= 4; week += 1) {
    const slots = getWorkoutSlots(formData, week);

    const workouts = slots.map((slot, index) => {
      const label = String.fromCharCode(65 + index);
      const date = toISODate(addDays(new Date(`${startDate}T12:00:00`), ((week - 1) * 7) + index));

      const warmup = buildWarmup(slot.kind === "endurance" ? "endurance" : "strength");
      const cooldown = buildCooldown(slot.kind === "endurance" ? "endurance" : "strength");

      let exercises;

      if (slot.kind === "strength") {
        exercises = buildStrengthExercises(formData, slot.emphasis, week, formData.sessionLength, slot.ruleGoal);
      } else if (slot.kind === "endurance") {
        exercises = buildEnduranceExercises(formData, slot.emphasis, week, slot.sessionType);
      } else if (slot.kind === "rehab") {
        exercises = buildRehabExercises(formData, week, formData.sessionLength);
      } else if (slot.kind === "balance") {
        exercises = buildBalanceExercises(formData, week, formData.sessionLength);
      } else {
        exercises = [
          buildExercise({
            id: `mobility-${week}`,
            name: "Mobility Flow",
            category: "mobility",
            targetType: "minutes",
            targets: [15],
            tempo: "Slow and controlled",
            rest: "Continuous",
            goalLoadText: "No load needed.",
            note: "Recovery and mobility day."
          })
        ];
      }

      return {
        id: `week-${week}-day-${label}`,
        week,
        workoutLabel: `Workout ${label}`,
        name: slot.label,
        date,
        dateLabel: formatDateLabel(date),
        description: `${titleCase(goal)} rule engine • ${safeText(slot.sessionType || slot.emphasis)}`,
        duration: formData.sessionLength,
        warmup,
        exercises,
        cooldown,
        isDeload: week === 4,
        includesHypertrophy: goal === "hypertrophy",
        ruleGoal: goal,
        ageLoad: limits.ageLoad,
        experience: limits.experience
      };
    });

    weeks.push({
      week,
      label: `Week ${week}`,
      note: week === 4
        ? "Deload week. Reduced stress to protect recovery."
        : week === 3
          ? "Highest training week before deload."
          : "Build week.",
      workouts
    });
  }

  return {
    version: 2,
    createdAt: new Date().toISOString(),
    ruleGoal: goal,
    likelyLimiter: getLikelyLimiter(formData),
    adjustmentRule: getAdjustmentRule(formData),
    loadLimits: limits,
    profile: {
      dob: formData.dob,
      age,
      ageBand: getAgeBand(age),
      safetyMode: getSafetyMode(age || 18),
      focus: formData.focus,
      enduranceType: formData.enduranceType,
      enduranceGoal: formData.enduranceGoal || [],
      equipment: formData.equipment,
      strengthGoals: formData.strengthGoals,
      pushSkill: formData.pushSkill,
      pullSkill: formData.pullSkill,
      gender: formData.gender || "",
      weight: formData.weight || "",
      weightUnit: formData.weightUnit || "kg",
      height: formData.height || "",
      heightUnit: formData.heightUnit || "cm",
      daysPerWeek: formData.daysPerWeek,
      sessionLength: formData.sessionLength,
      experience: limits.experience,
      selectedRuleEngine: goal
    },
    records: {
      mileTime: safeText(formData.mileTime, "Not logged yet"),
      longestRun: safeText(formData.runDuration, "Not logged yet"),
      longestRunDistance: safeText(formData.runDistance, "Not logged yet"),
      pushBest: formData.pushVariation
        ? `${findVariation(PUSH_VARIATIONS, formData.pushVariation).name}${formData.pushupMax ? ` • ${formData.pushupMax} reps` : ""}`
        : "Not logged yet",
      pullBest: formData.pullVariation
        ? `${findVariation(PULL_VARIATIONS, formData.pullVariation).name}${formData.pullupMax ? ` • ${formData.pullupMax} reps` : formData.pullVariation === "assisted" && formData.pullAssistValue ? ` • ${formData.pullAssistValue} ${formData.pullAssistUnit}` : ""}`
        : "Not logged yet",
      squatBest: formData.squatVariation
        ? `${findVariation(SQUAT_VARIATIONS, formData.squatVariation).name}${formData.squatMax ? ` • ${formData.squatMax} reps` : ""}`
        : "Not logged yet",
      plankBest: formData.plankMax ? `${formData.plankMax} sec` : "Not logged yet",
      wallSitBest: formData.wallSit ? `${formData.wallSit} sec` : "Not logged yet"
    },
    weeks
  };
}

function renderSummary(plan, target) {
  if (!target) return;
  if (!plan) {
    target.innerHTML = `
      <div class="summary-item">
        <div class="summary-value">No plan generated yet.</div>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="summary-list">
      <div class="summary-item">
        <div class="summary-label">Focus</div>
        <div class="summary-value">${plan.profile.focus.length ? plan.profile.focus.map(titleCase).join(", ") : "Not set yet"}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Age band</div>
        <div class="summary-value">${safeText(plan.profile.ageBand)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Safety</div>
        <div class="summary-value">${safeText(plan.profile.safetyMode)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Equipment</div>
        <div class="summary-value">${plan.profile.equipment.length ? plan.profile.equipment.map(titleCase).join(", ") : "Not set yet"}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Workout length</div>
        <div class="summary-value">${plan.profile.sessionLength} minutes</div>
      </div>
    </div>
  `;
}

function renderPreview(plan, target) {
  if (!target) return;
  if (!plan || !plan.weeks?.[0]?.workouts?.length) {
    target.innerHTML = `<div class="empty-box">Preview will appear as you answer questions.</div>`;
    return;
  }

  const week1 = plan.weeks[0];
  target.innerHTML = `
    <div class="preview-week">
      <div class="preview-week-title">Week 1 Preview</div>
      <div class="preview-workout-list">
        ${week1.workouts.map((workout) => `
          <div class="preview-workout">
            <div class="preview-workout-name">${safeText(workout.workoutLabel).replace("Workout", "Day")} • ${safeText(workout.name)}</div>
            <div class="preview-workout-sub">${safeText(workout.description)}</div>
            <div class="preview-workout-sub">${(workout.exercises || []).slice(0, 3).map((exercise) => exercise.name).join(" • ")}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function initAccount() {
  const statusBox = byId("authStatus");
  const signedInSection = byId("signedInSection");
  const authChoiceSection = byId("authChoiceSection");
  const createSection = byId("createSection");
  const loginSection = byId("loginSection");
  const signedInText = byId("signedInText");

  const showChoice = () => {
    signedInSection?.classList.add("hidden");
    authChoiceSection?.classList.remove("hidden");
    createSection?.classList.add("hidden");
    loginSection?.classList.add("hidden");
  };

  const showCreate = () => {
    signedInSection?.classList.add("hidden");
    authChoiceSection?.classList.add("hidden");
    createSection?.classList.remove("hidden");
    loginSection?.classList.add("hidden");
  };

  const showLogin = () => {
    signedInSection?.classList.add("hidden");
    authChoiceSection?.classList.add("hidden");
    createSection?.classList.add("hidden");
    loginSection?.classList.remove("hidden");
  };

  const showSignedIn = (user) => {
    authChoiceSection?.classList.add("hidden");
    createSection?.classList.add("hidden");
    loginSection?.classList.add("hidden");
    signedInSection?.classList.remove("hidden");
    if (signedInText) {
      signedInText.textContent = `${safeText(user.username)} • ${safeText(user.email)}`;
    }
  };

  const me = await fetchMe();

  if (me) {
    showSignedIn(me);
    setStatus(statusBox, "You are signed in.", "ok");
  } else {
    showLogin();
    setStatus(statusBox, "Account page ready.");
  }

  byId("showCreateBtn")?.addEventListener("click", showCreate);
  byId("showLoginBtn")?.addEventListener("click", showLogin);
  byId("createBackBtn")?.addEventListener("click", showChoice);
  byId("loginBackBtn")?.addEventListener("click", showChoice);

  byId("createAccountBtn")?.addEventListener("click", async () => {
    try {
      const username = byId("signupUsername")?.value?.trim() || "";
      const email = byId("signupEmail")?.value?.trim() || "";
      const password = byId("signupPassword")?.value || "";
      const dob = byId("signupDob")?.value || "";

      if (!username || !email || !password || !dob) {
        setStatus(statusBox, "Fill out all account fields.", "bad");
        return;
      }

      const data = await signup({ username, email, password, dob });
      showSignedIn(data.user);
      setStatus(statusBox, "Account created and signed in.", "ok");

      const cachedPlan = getCachedPlan();
      if (cachedPlan) {
        await saveCurrentPlan(cachedPlan);
      }
    } catch (error) {
      setStatus(statusBox, error.message || "Server error", "bad");
    }
  });

  byId("loginBtn")?.addEventListener("click", async () => {
    try {
      const email = byId("loginEmail")?.value?.trim() || "";
      const password = byId("loginPassword")?.value || "";

      if (!email || !password) {
        setStatus(statusBox, "Enter email and password.", "bad");
        return;
      }

      const data = await login({ email, password });
      showSignedIn(data.user);
      setStatus(statusBox, "Logged in.", "ok");

      const cachedPlan = getCachedPlan();
      if (cachedPlan) {
        const remotePlan = await loadCurrentPlan();
        if (!remotePlan) {
          await saveCurrentPlan(cachedPlan);
        }
      }
    } catch (error) {
      setStatus(statusBox, error.message || "Server error", "bad");
    }
  });

  byId("logoutBtn")?.addEventListener("click", async () => {
    await logout();
    showLogin();
    setStatus(statusBox, "Logged out.");
  });
}

async function initPlanner() {
  const statusBox = byId("plannerStatus");
  const progressFill = byId("plannerStepProgress");
  const backBtn = byId("plannerBackBtn");
  const nextBtn = byId("plannerNextBtn");
  const generateBtn = byId("generatePlanBtn");
  const summaryBox = byId("planSummaryPreview");
  const previewBox = byId("schedulePreview");

    const allSteps = [
    "dob",
    "body",
    "focus",
    "endurance-type",
    "endurance-goal",
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
  let currentIndex = 0;

  const getVisibleSteps = () =>
    allSteps.filter((step) => {
      if (step === "endurance-type") return formData.focus.includes("endurance") || formData.focus.includes("cardio");
      if (step === "endurance-goal") return formData.focus.includes("endurance") || formData.focus.includes("cardio");
      if (step === "strength-goals") return formData.focus.includes("strength");
      if (step === "push-skill") return formData.strengthGoals.includes("push");
      if (step === "pull-skill") return formData.strengthGoals.includes("pull");
      if (step === "push-variation") return formData.strengthGoals.includes("push") || formData.focus.includes("strength");
      if (step === "push-max") return (formData.strengthGoals.includes("push") || formData.focus.includes("strength")) && formData.pushVariation && !["none", "plank"].includes(formData.pushVariation);
      if (step === "pull-variation") return formData.strengthGoals.includes("pull") || formData.focus.includes("strength");
      if (step === "pull-assist") return formData.pullVariation === "assisted";
      if (step === "pull-max") return (formData.strengthGoals.includes("pull") || formData.focus.includes("strength")) && formData.pullVariation && !["none", "dead-hang", "active-hang"].includes(formData.pullVariation);
      if (step === "squat-variation") return formData.strengthGoals.includes("squat") || formData.focus.includes("strength");
      if (step === "squat-max") return (formData.strengthGoals.includes("squat") || formData.focus.includes("strength")) && formData.squatVariation && formData.squatVariation !== "none";
      if (step === "wall-sit") return formData.strengthGoals.includes("squat") || formData.focus.includes("strength");
      if (step === "plank") return formData.focus.includes("strength") || formData.strengthGoals.length > 0;
      if (step === "mile" || step === "run-duration" || step === "run-distance") return formData.focus.includes("endurance") || formData.focus.includes("cardio");
      return true;
    });

  const applyDraftToInputs = () => {
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
    if (byId("longestRunDurationUnit")) byId("longestRunDurationUnit").value = String(formData.runDuration || "").toLowerCase().includes("hour") ? "hours" : "minutes";
    if (byId("longestRunDistanceValue")) byId("longestRunDistanceValue").value = parseFirstNumber(formData.runDistance) || "";
    if (byId("longestRunDistanceUnit")) byId("longestRunDistanceUnit").value = String(formData.runDistance || "").toLowerCase().includes("km") ? "km" : "miles";
    if (byId("startDate")) byId("startDate").value = formData.startDate || toISODate(new Date());

        if (byId("bodyWeight")) byId("bodyWeight").value = formData.weight || "";
    if (byId("bodyWeightUnit")) byId("bodyWeightUnit").value = formData.weightUnit || "kg";
    if (byId("bodyHeight")) byId("bodyHeight").value = formData.height || "";
    if (byId("bodyHeightUnit")) byId("bodyHeightUnit").value = formData.heightUnit || "cm";
    qsa("[data-gender]").forEach((btn) => btn.classList.toggle("active", formData.gender === btn.dataset.gender));
    qsa("[data-focus]").forEach((btn) => btn.classList.toggle("active", formData.focus.includes(btn.dataset.focus)));
    qsa("[data-type]").forEach((btn) => btn.classList.toggle("active", formData.enduranceType.includes(btn.dataset.type)));
    qsa("[data-equip]").forEach((btn) => btn.classList.toggle("active", formData.equipment.includes(btn.dataset.equip)));
    qsa("[data-goal]").forEach((btn) => btn.classList.toggle("active", formData.strengthGoals.includes(btn.dataset.goal)));
    qsa("#step-push-skill .tile-btn").forEach((btn) => btn.classList.toggle("active", formData.pushSkill.includes(btn.dataset.skill)));
    qsa("#step-pull-skill .tile-btn").forEach((btn) => btn.classList.toggle("active", formData.pullSkill.includes(btn.dataset.skill)));
  };

  const syncFromInputs = () => {
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
    formData.weight = String(byId("bodyWeight")?.value || formData.weight || "").trim();
    formData.weightUnit = byId("bodyWeightUnit")?.value || formData.weightUnit || "kg";
    formData.height = String(byId("bodyHeight")?.value || formData.height || "").trim();
    formData.heightUnit = byId("bodyHeightUnit")?.value || formData.heightUnit || "cm";
    formData = normalizeFormData(formData);

  };

  const updateAgePanels = () => {
    const dobValue = byId("dob")?.value || "";
    const ageInfoContainer = byId("age-info-container");
    const countdownMessage = byId("countdown-message");
    const countdownTimer = byId("countdown-timer");
    const parentDisclaimer = byId("parent-disclaimer");

    ageInfoContainer?.classList.add("hidden");
    countdownMessage?.classList.add("hidden");
    parentDisclaimer?.classList.add("hidden");

    if (!dobValue) return;

    const age = getAgeFromDob(dobValue);
    if (age === null) return;

    ageInfoContainer?.classList.remove("hidden");

    if (age < 9) {
      countdownMessage?.classList.remove("hidden");
      const dob = new Date(`${dobValue}T12:00:00`);
      const ninth = new Date(dob);
      ninth.setFullYear(dob.getFullYear() + 9);
      const diffDays = Math.max(0, Math.ceil((ninth.getTime() - Date.now()) / 86400000));
      if (countdownTimer) {
        countdownTimer.textContent = `${diffDays} days to go`;
      }
      return;
    }

    if (age < 13) {
      parentDisclaimer?.classList.remove("hidden");
    }
  };

    const renderEnduranceGoalStep = () => {
    const grid = byId("enduranceGoalGrid");
    if (!grid) return;
    const goals = getEnduranceGoals(formData);
    if (!goals.length) {
      grid.innerHTML = `<div class="empty-box">No goals available for your selections.</div>`;
      return;
    }
    grid.innerHTML = goals.map((g) => `
      <button type="button" class="tile-btn ${(formData.enduranceGoal || []).includes(g.value) ? "active" : ""}"
        data-endurance-goal="${g.value}"
        style="text-align:left;height:auto;padding:14px 16px">
        <span style="display:block;font-weight:800">${g.label}</span>
        <span style="display:block;font-size:0.82rem;font-weight:500;opacity:0.75;margin-top:4px">${g.desc}</span>
      </button>
    `).join("");
    grid.querySelectorAll("[data-endurance-goal]").forEach((btn) => {
      btn.addEventListener("click", () => toggleArrayValue("enduranceGoal", btn.dataset.enduranceGoal, 2));
    });
  };

  const updateStep = () => {
    const visible = getVisibleSteps();
    currentIndex = clamp(currentIndex, 0, Math.max(0, visible.length - 1));

    qsa(".planner-step").forEach((step) => step.classList.add("hidden"));
    const currentId = visible[currentIndex];
    byId(`step-${currentId}`)?.classList.remove("hidden");

    if (currentId === "endurance-goal") renderEnduranceGoalStep();

    if (progressFill) {
      progressFill.style.width = `${((currentIndex + 1) / visible.length) * 100}%`;
    }

    backBtn?.classList.toggle("hidden", currentIndex === 0);
    nextBtn?.classList.toggle("hidden", currentIndex === visible.length - 1);
    generateBtn?.classList.toggle("hidden", currentIndex !== visible.length - 1);
  };


  const validateStep = () => {
    syncFromInputs();
    const stepId = getVisibleSteps()[currentIndex];

    if (stepId === "dob") {
      if (!formData.dob) return setStatus(statusBox, "Enter a date of birth.", "bad"), false;
      const age = getAgeFromDob(formData.dob);
      if (age === null) return setStatus(statusBox, "Enter a real date of birth.", "bad"), false;
      if (age < 9) return setStatus(statusBox, "Training starts at age 9.", "bad"), false;
      if (age < 13 && !formData.parentConsent) return setStatus(statusBox, "A parent or guardian needs to confirm supervision.", "bad"), false;
    }

    if (stepId === "focus" && !formData.focus.length) return setStatus(statusBox, "Pick at least 1 focus.", "bad"), false;
    if (stepId === "endurance-type" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && !formData.enduranceType.length) return setStatus(statusBox, "Pick at least 1 endurance type.", "bad"), false;
    if (stepId === "equipment" && !formData.equipment.length) return setStatus(statusBox, "Pick your equipment or choose bodyweight only.", "bad"), false;
    if (stepId === "strength-goals" && formData.focus.includes("strength") && !formData.strengthGoals.length) return setStatus(statusBox, "Pick at least 1 strength goal.", "bad"), false;
    if (stepId === "push-max" && formData.pushVariation && !["none", "plank"].includes(formData.pushVariation) && formData.pushupMax <= 0) return setStatus(statusBox, "Enter your max clean reps.", "bad"), false;
    if (stepId === "pull-assist" && formData.pullVariation === "assisted" && !String(formData.pullAssistValue).trim()) return setStatus(statusBox, "Enter your amount of assistance.", "bad"), false;
    if (stepId === "pull-max" && formData.pullVariation && !["none", "dead-hang", "active-hang"].includes(formData.pullVariation) && formData.pullupMax <= 0) return setStatus(statusBox, "Enter your max clean reps.", "bad"), false;
    if (stepId === "squat-max" && formData.squatVariation && formData.squatVariation !== "none" && formData.squatMax <= 0) return setStatus(statusBox, "Enter your max clean reps.", "bad"), false;
    if (stepId === "plank" && (formData.focus.includes("strength") || formData.strengthGoals.length > 0) && formData.plankMax <= 0) return setStatus(statusBox, "Enter your best plank hold.", "bad"), false;
    if (stepId === "mile" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && parseTimeToSeconds(formData.mileTime) === null) {
  setStatus(statusBox, "Enter your mile time like 8:05.", "bad");
  return false;
}

if (stepId === "run-duration" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && !formData.runDuration) {
  setStatus(statusBox, "Enter your longest continuous effort.", "bad");
  return false;
}

if (stepId === "run-distance" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && !formData.runDistance) {
  setStatus(statusBox, "Enter your longest distance.", "bad");
  return false;
}

if (stepId === "endurance-goal" && (formData.focus.includes("endurance") || formData.focus.includes("cardio")) && !(formData.enduranceGoal || []).length) {
  setStatus(statusBox, "Pick at least 1 goal.", "bad");
  return false;
}

if (stepId === "start-date" && !formData.startDate) {
  setStatus(statusBox, "Pick a start date.", "bad");
  return false;
}

setStatus(statusBox, "Answer the questions to build your plan.");
return true;
};

const refreshPreview = () => {
    syncFromInputs();
    const hasEnough = formData.focus.length || formData.strengthGoals.length;
    if (!hasEnough) {
      renderSummary(null, summaryBox);
      renderPreview(null, previewBox);
      return;
    }
    const plan = buildPlan(formData);
    renderSummary(plan, summaryBox);
    renderPreview(plan, previewBox);
  };

  const toggleArrayValue = (key, value, limit = 99) => {
    const current = new Set(formData[key] || []);
    if (current.has(value)) current.delete(value);
    else if (current.size < limit) current.add(value);
    formData[key] = [...current];

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
    refreshPreview();
    updateStep();
  };

  qsa("[data-focus]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedGoal = btn.dataset.focus;

    // One primary goal only. No mixing engines.
    formData.focus = [selectedGoal];

    // Clear old endurance choices unless the new goal is endurance.
    if (selectedGoal !== "endurance") {
      formData.enduranceType = [];
      formData.enduranceGoal = [];
      formData.mileTime = "";
      formData.runDuration = "";
      formData.runDistance = "";
    }

    // Clear old strength choices unless the new goal uses strength-style planning.
    if (selectedGoal !== "strength" && selectedGoal !== "hypertrophy") {
      formData.strengthGoals = [];
      formData.pushSkill = [];
      formData.pullSkill = [];
      formData.pushVariation = "";
      formData.pushupMax = 0;
      formData.pullVariation = "";
      formData.pullupMax = 0;
      formData.squatVariation = "";
      formData.squatMax = 0;
      formData.wallSit = 0;
      formData.plankMax = 0;
    }

    formData = normalizeFormData(formData);
    applyDraftToInputs();
    savePlannerDraft(formData);
    refreshPreview();
    updateStep();
  });
});

qsa("[data-type]").forEach((btn) => {
  btn.addEventListener("click", () => toggleArrayValue("enduranceType", btn.dataset.type, 3));
});

qsa("[data-equip]").forEach((btn) => {
  btn.addEventListener("click", () => toggleArrayValue("equipment", btn.dataset.equip, 5));
});

qsa("[data-goal]").forEach((btn) => {
  btn.addEventListener("click", () => toggleArrayValue("strengthGoals", btn.dataset.goal, 3));
});

qsa("#step-push-skill .tile-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    formData.pushSkill = [btn.dataset.skill];
    applyDraftToInputs();
    savePlannerDraft(formData);
    refreshPreview();
  });
});

qsa("#step-pull-skill .tile-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    formData.pullSkill = [btn.dataset.skill];
    applyDraftToInputs();
    savePlannerDraft(formData);
    refreshPreview();
  });
});

qsa("[data-gender]").forEach((btn) => {
  btn.addEventListener("click", () => {
    formData.gender = formData.gender === btn.dataset.gender ? "" : btn.dataset.gender;
    applyDraftToInputs();
    savePlannerDraft(formData);
    refreshPreview();
  });
});

  qsa("input, select").forEach((input) => {
    input.addEventListener("change", () => {
      syncFromInputs();
      updateAgePanels();
      savePlannerDraft(formData);
      refreshPreview();
    });

    input.addEventListener("input", () => {
      syncFromInputs();
      updateAgePanels();
      savePlannerDraft(formData);
      refreshPreview();
    });
  });

  backBtn?.addEventListener("click", () => {
    currentIndex -= 1;
    updateStep();
  });

  nextBtn?.addEventListener("click", () => {
    if (!validateStep()) return;
    currentIndex += 1;
    updateStep();
  });

  generateBtn?.addEventListener("click", async () => {
    if (!validateStep()) return;
    syncFromInputs();
    const plan = buildPlan(formData);
    await saveCurrentPlan(plan);
    setStatus(statusBox, "Plan generated and saved.", "ok");
    window.location.href = "./dashboard.html";
  });

  applyDraftToInputs();
  updateAgePanels();
  updateStep();
  refreshPreview();
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
    return { level: "low", label: "Low readiness", note: "Volume is reduced for today." };
  }

  if (score >= 2) {
    return { level: "high", label: "High readiness", note: "Run the planned session, but keep form clean." };
  }

  return { level: "normal", label: "Normal readiness", note: "Run the planned session." };
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
          <input type="checkbox" data-track-bucket="${bucket}" data-track-date="${date}" data-track-index="${index}" ${doneMap[index] ? "checked" : ""}>
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
              <tr><th>Set</th><th>Goal</th><th>Log</th></tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Set">Main</td>
                <td data-label="Goal">${exercise.targets[0]} minutes</td>
                <td data-label="Log">
                  <input id="${exercise.id}-log" class="small-input table-input" data-log-kind="text" data-exercise-id="${exercise.id}" data-date="${date}" type="text" placeholder="Example: 24 min or 2.1 miles" value="${existing?.logText || ""}">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="notes-block">
          <label for="${exercise.id}-note">Notes</label>
          <textarea id="${exercise.id}-note" class="small-textarea" data-log-kind="note" data-exercise-id="${exercise.id}" data-date="${date}" placeholder="Optional notes">${existing?.noteText || ""}</textarea>
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
      </div>

      <div class="goal-load-box">${safeText(exercise.goalLoadText)}</div>

      <div class="exercise-table-wrap">
        <table class="exercise-log-table">
          <thead>
            <tr><th>Set</th><th>Goal</th><th>Log</th></tr>
          </thead>
          <tbody>
            ${(exercise.targets || []).map((target, index) => `
              <tr>
                <td data-label="Set">Set ${index + 1}</td>
                <td data-label="Goal">${target} ${exercise.targetType}</td>
                <td data-label="Log">
                  <input class="small-input table-input" data-log-kind="set" data-exercise-id="${exercise.id}" data-date="${date}" data-set-index="${index}" type="text" inputmode="numeric" placeholder="${exercise.targetType}" value="${existing?.values?.[index] || ""}">
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="load-grid">
        <div>
          <label for="${exercise.id}-mode">Load mode</label>
          <select id="${exercise.id}-mode" class="small-input" data-log-kind="mode" data-exercise-id="${exercise.id}" data-date="${date}">
            <option value="normal" ${loadMode === "normal" ? "selected" : ""}>Normal</option>
            <option value="load" ${loadMode === "load" ? "selected" : ""}>Added load</option>
            <option value="assistance" ${loadMode === "assistance" ? "selected" : ""}>Assistance</option>
          </select>
        </div>
        <div>
          <label for="${exercise.id}-load">Load / assistance value</label>
          <input id="${exercise.id}-load" class="small-input" data-log-kind="load" data-exercise-id="${exercise.id}" data-date="${date}" type="text" inputmode="decimal" placeholder="Required for load or assistance" value="${loadValue}" ${loadMode === "normal" ? "disabled" : ""}>
        </div>
      </div>
    </div>
  `;
}

async function initDashboard() {
  const plan = await loadCurrentPlan();

  if (!plan || !plan.weeks?.length) {
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
    return;
  }

  const tracker = await loadTracker(plan.createdAt);
  const user = getCurrentUser();

  const streak = Object.values(tracker.days || {}).filter((day) =>
    Object.keys(day).some((key) => !key.startsWith("_") && !["warmup", "cooldown"].includes(key))
  ).length;

  if (byId("currentStreakNumber")) byId("currentStreakNumber").textContent = String(streak);
  if (byId("currentStreakText")) byId("currentStreakText").textContent = streak ? `You have ${streak} completed workout day${streak === 1 ? "" : "s"} in a row.` : "Complete today’s workout to start your streak.";

  if (byId("profileBox")) {
    byId("profileBox").innerHTML = `
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

  if (byId("currentPlanBox")) {
    byId("currentPlanBox").innerHTML = `
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
        <div class="info-sub">Strength work uses safe hypertrophy ranges.</div>
      </div>
    `;
  }

  if (byId("recordsBox")) {
    byId("recordsBox").innerHTML = `
      <div class="record-card"><div class="record-title">Best mile time</div><div class="record-value">${safeText(plan.records.mileTime)}</div></div>
      <div class="record-card"><div class="record-title">Longest run distance</div><div class="record-value">${safeText(plan.records.longestRunDistance)}</div></div>
      <div class="record-card"><div class="record-title">Best push result</div><div class="record-value">${safeText(plan.records.pushBest)}</div></div>
      <div class="record-card"><div class="record-title">Best pull result</div><div class="record-value">${safeText(plan.records.pullBest)}</div></div>
      <div class="record-card"><div class="record-title">Best plank hold</div><div class="record-value">${safeText(plan.records.plankBest)}</div></div>
      <div class="record-card"><div class="record-title">Best squat result</div><div class="record-value">${safeText(plan.records.squatBest)}</div></div>
    `;
  }

  if (byId("signalsBox")) {
    byId("signalsBox").textContent = "No major warning signs right now. Stay consistent and keep quality high.";
  }

  if (byId("quickStatsBox")) {
    const totalWorkouts = plan.weeks.reduce((sum, week) => sum + week.workouts.length, 0);
    const loggedWorkouts = Object.values(tracker.days || {}).filter((day) =>
      Object.keys(day).some((key) => !key.startsWith("_") && !["warmup", "cooldown"].includes(key))
    ).length;

    byId("quickStatsBox").innerHTML = `
      <div class="info-card"><div class="info-label">Workouts in block</div><div class="info-value">${totalWorkouts}</div></div>
      <div class="info-card"><div class="info-label">Logged workouts</div><div class="info-value">${loggedWorkouts}</div></div>
      <div class="info-card"><div class="info-label">Safety mode</div><div class="info-value">${safeText(plan.profile.safetyMode)}</div></div>
      <div class="info-card"><div class="info-label">Workout length</div><div class="info-value">${plan.profile.sessionLength} min</div></div>
    `;
  }

  const today = toISODate(new Date());
  const currentWeek = plan.weeks.find((week) => week.workouts.some((workout) => workout.date === today)) || plan.weeks[0];

  if (byId("weekTitle")) byId("weekTitle").textContent = safeText(currentWeek?.label, "Week");

  if (byId("weekTrackerBox")) {
    byId("weekTrackerBox").innerHTML = currentWeek.workouts.map((workout) => `
      <div class="week-card">
        <div class="week-card-title">${safeText(workout.workoutLabel).replace("Workout", "Day")} • ${safeText(workout.name)}</div>
        <div class="week-card-sub">${safeText(workout.description)}</div>
        <div class="week-card-sub">${safeText(workout.dateLabel)}</div>
      </div>
    `).join("");
  }

  if (byId("weeksAheadBox")) {
    byId("weeksAheadBox").innerHTML = plan.weeks.map((week) => `
      <div class="week-section">
        <div class="week-title">${safeText(week.label)}</div>
        <div class="week-mini-grid">
          ${week.workouts.map((workout) => `
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

  const weekWorkouts = currentWeek.workouts || [];
  let selectedWorkoutId = getSelectedWorkoutId(plan.createdAt);
  let currentWorkout = weekWorkouts.find((w) => w.id === selectedWorkoutId) || weekWorkouts[0];
  if (!selectedWorkoutId || selectedWorkoutId !== currentWorkout.id) {
    setSelectedWorkoutId(plan.createdAt, currentWorkout.id);
  }

  const dayData = tracker.days?.[currentWorkout.date] || {};
  const readiness = getReadinessSummary(dayData);
  const displayWorkout = getAdjustedWorkout(currentWorkout, readiness);
  const readinessLocked = !readiness;

  if (byId("todayBox")) {
    byId("todayBox").innerHTML = `
      <div class="today-tabs">
        ${weekWorkouts.map((workout) => `
          <button type="button" class="day-tab ${workout.id === currentWorkout.id ? "active" : ""}" data-workout-tab="${workout.id}">
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
          <span class="badge ${displayWorkout.isDeload ? "warn" : ""}">${displayWorkout.isDeload ? "Deload" : "Planned"}</span>
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
          <div class="small-note">${readiness ? `${readiness.label}. ${readiness.note}` : "Set readiness first. Workout logging stays locked until readiness is saved."}</div>
        </div>

        <div class="session-block">
          <div class="block-title">Warm-up</div>
          ${renderTrackerChecklist(displayWorkout.warmup || [], "warmup", currentWorkout.date, tracker)}
        </div>

        ${(displayWorkout.exercises || []).map((exercise) => renderExerciseCard(exercise, currentWorkout.date, dayData[exercise.id])).join("")}

        <div class="session-block">
          <div class="block-title">Cooldown</div>
          ${renderTrackerChecklist(displayWorkout.cooldown || [], "cooldown", currentWorkout.date, tracker)}
        </div>

        <div class="button-row">
          <button type="button" id="saveWorkoutBtn" ${readinessLocked ? "disabled" : ""}>Save workout</button>
        </div>
      </div>
    `;
  }

  qsa("[data-workout-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedWorkoutId(plan.createdAt, btn.dataset.workoutTab);
      initDashboard();
    });
  });

  byId("saveReadinessBtn")?.addEventListener("click", async () => {
    const sleepHours = byId("sleepHours")?.value || "";
    const soreness = byId("soreness")?.value || "";
    const energy = byId("energy")?.value || "";

    if (!toNumber(sleepHours, 0) || clamp(toNumber(soreness, 0), 1, 5) !== toNumber(soreness, 0) || clamp(toNumber(energy, 0), 1, 5) !== toNumber(energy, 0)) {
      alert("Enter sleep, soreness, and energy before saving readiness.");
      return;
    }

    if (!tracker.days[currentWorkout.date]) tracker.days[currentWorkout.date] = {};
    tracker.days[currentWorkout.date]._readiness = { sleepHours, soreness, energy };
    await saveTracker(plan.createdAt, tracker);
    await initDashboard();
  });

  qsa("[data-track-bucket]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const date = checkbox.dataset.trackDate;
      const bucket = checkbox.dataset.trackBucket;
      const index = checkbox.dataset.trackIndex;

      if (!tracker.days[date]) tracker.days[date] = {};
      if (!tracker.days[date][bucket]) tracker.days[date][bucket] = {};
      tracker.days[date][bucket][index] = checkbox.checked;
      await saveTracker(plan.createdAt, tracker);
    });
  });

  qsa('[data-log-kind="mode"]').forEach((select) => {
    select.addEventListener("change", () => {
      const loadInput = byId(`${select.dataset.exerciseId}-load`);
      if (loadInput) loadInput.disabled = select.value === "normal";
    });
  });

  if (readinessLocked) {
    qsa("[data-log-kind]").forEach((el) => { el.disabled = true; });
    qsa("[data-track-bucket]").forEach((el) => { el.disabled = true; });
  }

  byId("saveWorkoutBtn")?.addEventListener("click", async () => {
    if (!tracker.days[currentWorkout.date]?._readiness) {
      alert("Save readiness first.");
      return;
    }

    for (const exercise of displayWorkout.exercises || []) {
      if (exercise.skipped) continue;

      if (exercise.targetType === "minutes") {
        if (!tracker.days[currentWorkout.date]) tracker.days[currentWorkout.date] = {};
        tracker.days[currentWorkout.date][exercise.id] = {
          logText: byId(`${exercise.id}-log`)?.value || "",
          noteText: byId(`${exercise.id}-note`)?.value || ""
        };
        continue;
      }

      const values = qsa(`[data-exercise-id="${exercise.id}"][data-log-kind="set"]`)
        .map((input) => toNumber(input.value, 0))
        .filter((n) => n > 0);

      const mode = qsa(`[data-exercise-id="${exercise.id}"][data-log-kind="mode"]`)[0]?.value || "normal";
      const loadValue = qsa(`[data-exercise-id="${exercise.id}"][data-log-kind="load"]`)[0]?.value || "";

      if ((mode === "load" || mode === "assistance") && !String(loadValue).trim()) {
        alert(`${exercise.name}: enter a load or assistance value.`);
        return;
      }

      if (!tracker.days[currentWorkout.date]) tracker.days[currentWorkout.date] = {};
      tracker.days[currentWorkout.date][exercise.id] = { values, loadMode: mode, loadValue };
    }

    await saveTracker(plan.createdAt, tracker);
    await initDashboard();
  });

  byId("logoutBtn")?.addEventListener("click", async () => {
    await logout();
    window.location.href = "./account-test.html";
  });
}

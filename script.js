// "https://fitnessplan-backend.cosmowind2013.workers.dev"
// I will stick to that to maintain consistency with the user's setup.

const API = "https://fitnessplan-backend.cosmowind2013.workers.dev";

document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if (page === "planner") {
        initPlanner();
    } else if (page === "dashboard") {
        initDashboard();
    }
});

/**
 * UTILS
 */
function getToken() {
    return localStorage.getItem("fitnessplan_token");
}

function getUser() {
    const u = localStorage.getItem("fitnessplan_user");
    return u ? JSON.parse(u) : null;
}

function isLoggedIn() {
    return !!getToken();
}

/**
 * PLANNER
 */
function initPlanner() {
    // All possible steps in order
    const allSteps = [
        "dob", "focus", "endurance-type", "strength-goals", "push-skill", "pull-skill",
        "days", "session-length",
        "push-variation", "push-max", 
        "pull-variation", "pull-assist", "pull-max", 
        "plank", "mile", "run-duration", "run-distance", "start-date"
    ];

    let currentStepIndex = 0;
    const formData = {
        focus: [],
        enduranceType: [],
        strengthGoals: [],
        pushSkill: [],
        pullSkill: []
    };

    const nextBtn = document.getElementById("plannerNextBtn");
    const backBtn = document.getElementById("plannerBackBtn");
    const generateBtn = document.getElementById("generatePlanBtn");
    const counter = document.getElementById("plannerStepCounter");
    const progress = document.getElementById("plannerStepProgress");
    const statusBox = document.getElementById("plannerStatus");

    function getVisibleSteps() {
        return allSteps.filter(step => {
            if (step === "endurance-type") return formData.focus.includes("endurance");
            if (step === "strength-goals") return formData.focus.includes("strength");
            if (step === "push-skill") return formData.strengthGoals.includes("push");
            if (step === "pull-skill") return formData.strengthGoals.includes("pull");
            
            // Skill variations
            if (step === "push-variation") return formData.strengthGoals.includes("push");
            if (step === "push-max") {
                const vari = document.getElementById("pushVariation")?.value;
                return formData.strengthGoals.includes("push") && vari !== "none";
            }
            if (step === "pull-variation") return formData.strengthGoals.includes("pull");
            if (step === "pull-assist") {
                const vari = document.getElementById("pullVariation")?.value;
                return formData.strengthGoals.includes("pull") && vari === "assisted";
            }
            if (step === "pull-max") {
                const vari = document.getElementById("pullVariation")?.value;
                return formData.strengthGoals.includes("pull") && vari !== "none";
            }

            // Endurance specific fields
            if (step === "mile" || step === "run-duration" || step === "run-distance") {
                return formData.focus.includes("endurance") || formData.focus.includes("cardio");
            }

            return true;
        });
    }

    function updateStep() {
        const visibleSteps = getVisibleSteps();
        const currentStepId = visibleSteps[currentStepIndex];

        document.querySelectorAll(".planner-step").forEach(s => s.classList.remove("active"));
        const stepEl = document.getElementById(`step-${currentStepId}`);
        if (stepEl) stepEl.classList.add("active");

        progress.style.width = `${((currentStepIndex + 1) / visibleSteps.length) * 100}%`;

        backBtn.classList.toggle("hidden", currentStepIndex === 0);
        nextBtn.classList.toggle("hidden", currentStepIndex === visibleSteps.length - 1);
        generateBtn.classList.toggle("hidden", currentStepIndex !== visibleSteps.length - 1);

        statusBox.textContent = "Answer the questions to build your plan.";
        statusBox.className = "status-box";
    }

    nextBtn.addEventListener("click", () => {
        if (validateStep()) {
            currentStepIndex++;
            updateStep();
            updateSummary();
        }
    });

    backBtn.addEventListener("click", () => {
        currentStepIndex--;
        updateStep();
    });

    generateBtn.addEventListener("click", handleGenerate);

    // Tile Click Handlers
    function setupTiles(selector, dataKey, limit) {
        document.querySelectorAll(`${selector} .tile-btn`).forEach(btn => {
            btn.addEventListener("click", () => {
                const val = btn.dataset.focus || btn.dataset.type || btn.dataset.goal || btn.dataset.skill;
                if (!val) return;

                if (formData[dataKey].includes(val)) {
                    formData[dataKey] = formData[dataKey].filter(v => v !== val);
                    btn.classList.remove("active");
                } else {
                    if (formData[dataKey].length < limit) {
                        formData[dataKey].push(val);
                        btn.classList.add("active");
                    }
                }
                // Skill goals are single select but using buttons for UI
                if (limit === 1) {
                    formData[dataKey] = [val];
                    document.querySelectorAll(`${selector} .tile-btn`).forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                }
                updateSummary();
            });
        });
    }

    setupTiles("#step-focus", "focus", 2);
    setupTiles("#step-endurance-type", "enduranceType", 3);
    setupTiles("#step-strength-goals", "strengthGoals", 3);
    setupTiles("#step-push-skill", "pushSkill", 1);
    setupTiles("#step-pull-skill", "pullSkill", 1);

    function validateStep() {
        const visibleSteps = getVisibleSteps();
        const stepId = visibleSteps[currentStepIndex];

        if (stepId === "dob") {
            formData.dob = document.getElementById("dob").value;
            if (!formData.dob) return error("Date of birth required.");
        }
        if (stepId === "focus") {
            if (formData.focus.length === 0) return error("Pick at least 1 focus.");
        }
        if (stepId === "days") {
            formData.daysPerWeek = parseInt(document.getElementById("daysPerWeek").value);
        }
        if (stepId === "session-length") {
            formData.sessionLength = parseInt(document.getElementById("sessionLength").value);
        }
        if (stepId === "push-variation") {
            formData.pushVariation = document.getElementById("pushVariation").value;
        }
        if (stepId === "push-max") {
            formData.pushupMax = parseInt(document.getElementById("pushupMax").value);
            if (isNaN(formData.pushupMax)) return error("Enter your max reps.");
        }
        if (stepId === "pull-variation") {
            formData.pullVariation = document.getElementById("pullVariation").value;
        }
        if (stepId === "pull-assist") {
            formData.pullAssistValue = parseInt(document.getElementById("pullAssistValue").value);
            formData.pullAssistUnit = document.getElementById("pullAssistUnit").value;
        }
        if (stepId === "pull-max") {
            formData.pullupMax = parseInt(document.getElementById("pullupMax").value);
            if (isNaN(formData.pullupMax)) return error("Enter your max reps.");
        }
        if (stepId === "plank") {
            formData.plankMax = parseInt(document.getElementById("plankMax").value);
            if (isNaN(formData.plankMax)) return error("Enter your plank hold.");
        }
        if (stepId === "start-date") {
            formData.startDate = document.getElementById("startDate").value;
            if (!formData.startDate) return error("Start date required.");
        }

        return true;
    }

    function error(msg) {
        statusBox.textContent = msg;
        statusBox.className = "status-box bad";
        return false;
    }

    function updateSummary() {
        const preview = document.getElementById("planSummaryPreview");
        let html = `<div class="summary-list">`;
        
        if (formData.focus.length > 0) {
            html += `<div class="summary-item"><div class="summary-label">Focus</div><div class="summary-value">${formData.focus.join(", ")}</div></div>`;
        }
        if (formData.strengthGoals.length > 0) {
            html += `<div class="summary-item"><div class="summary-label">Strength Goals</div><div class="summary-value">${formData.strengthGoals.join(", ")}</div></div>`;
        }
        if (formData.pushVariation && formData.pushVariation !== "none") {
            html += `<div class="summary-item"><div class="summary-label">Hardest Push</div><div class="summary-value">${formData.pushVariation}</div></div>`;
        }
        
        html += `</div>`;
        preview.innerHTML = formData.focus.length === 0 ? "Select your focus to see details." : html;
        
        renderWeekPreview();
    }

    function renderWeekPreview() {
        const container = document.getElementById("schedulePreview");
        const plan = generateScientificPlan();
        if (!plan || plan.length === 0) {
            container.innerHTML = `<div class="empty-box">Preview will appear as you answer questions.</div>`;
            return;
        }

        const week1 = plan[0];
        let html = `
            <div class="preview-week">
                <div class="preview-week-title">Week 1 Preview</div>
                <div class="preview-workout-list">
        `;

        week1.workouts.forEach(w => {
            html += `
                <div class="preview-workout">
                    <div class="preview-workout-top">
                        <div class="preview-workout-name">${w.name}</div>
                        <span class="preview-badge">${w.duration} min</span>
                    </div>
                    <div class="preview-workout-sub">${w.description}</div>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    }

    function generateScientificPlan() {
        if (formData.focus.length === 0) return null;

        const weeks = [];
        const days = formData.daysPerWeek || 3;
        const workoutNames = ["Push Focus", "Pull Focus", "Leg Focus", "Skills", "Full Body"];

        for (let w = 1; w <= 4; w++) {
            const isDeload = (w === 4);
            const isHighVolume = (w === 3);
            const workouts = [];

            for (let d = 0; d < days; d++) {
                const workout = {
                    name: workoutNames[d % workoutNames.length],
                    duration: formData.sessionLength || 60,
                    description: "",
                    exercises: []
                };

                // 1. Mobility & Prep
                const pushSkill = formData.pushSkill ? formData.pushSkill[0] : "";
                const pullSkill = formData.pullSkill ? formData.pullSkill[0] : "";
                
                if (pushSkill === "hspu") {
                    workout.exercises.push({ name: "Wrist & T-Spine Mobility", sets: "1", reps: "5 min", note: "Crucial for HSPU overhead path." });
                }
                if (pushSkill === "one-arm") {
                    workout.exercises.push({ name: "Shoulder Taps", sets: "3", reps: "10 per side", note: "Mandatory warm-up for anti-rotation stability." });
                }
                if (formData.strengthGoals.includes("squat")) {
                    workout.exercises.push({ name: "Ankle & Hip Opening", sets: "1", reps: "5 min", note: "Deep squat mobility focus." });
                }

                // 2. Main Strength Work (The Mastery System)
                if (formData.focus.includes("strength")) {
                    formData.strengthGoals.forEach(goal => {
                        let exerciseName = "Skill Movement";
                        let sets = isHighVolume ? 5 : (isDeload ? 2 : 3);
                        let reps = "8-10";
                        let note = "Tempo 3-1-X-1. RIR 2 (Leave 2 in the tank).";
                        let rest = "3 minutes";

                        if (goal === "push") {
                            exerciseName = formData.pushVariation || "Linear Push";
                            const max = formData.pushupMax || 0;
                            if (max > 0 && max < 5) {
                                sets = 5;
                                reps = "2 (Cluster)";
                                note = "Form first. Reset between every rep.";
                            }
                            if (pushSkill === "hspu") note += " Focus on vertical leverage path.";
                        } else if (goal === "pull") {
                            exerciseName = formData.pullVariation || "Linear Pull";
                            const max = formData.pullupMax || 0;
                            if (max > 0 && max < 5) {
                                sets = 5;
                                reps = "2 (Cluster)";
                            }
                            if (pullSkill === "muscle-up") note = "Explosive Chest-to-Bar tempo. Squeeze at top.";
                        } else if (goal === "squat") {
                            exerciseName = "Pistol Squat Progression";
                            note = "Focus on balance and ankle tracking.";
                        }
                        
                        workout.exercises.push({ name: exerciseName, sets, reps, note, rest });
                    });
                }

                // 3. Endurance / Cardio Component
                if (formData.focus.includes("endurance") || formData.focus.includes("cardio")) {
                    const type = formData.enduranceType ? formData.enduranceType[0] : "Run";
                    let sets = isHighVolume ? "6 km" : (isDeload ? "3 km" : "4 km");
                    let reps = "Zone 2";
                    let note = "Keep breathing through nose. Constant pace.";
                    let rest = "90 seconds";

                    if (type === "sprints") {
                        sets = isHighVolume ? "10" : "5";
                        reps = "100m";
                        note = "100% effort. Walk back recovery.";
                    }
                    
                    workout.exercises.push({ name: `Endurance: ${type}`, sets, reps, note, rest });
                }

                // 4. Weekly Mental Challenge
                if (d === days - 1) {
                    const challenges = ["Max Plank Hold", "Max Wall Sit", "Burpee AMRAP (2 min)", "Cold Shower (3 min)"];
                    workout.exercises.push({ 
                        name: "Mental Challenge", 
                        sets: "1", 
                        reps: "MAX", 
                        note: challenges[w - 1] 
                    });
                }

                // Descriptions
                if (isDeload) workout.description = "Recovery Week: System flush and motor pattern mastery.";
                else if (isHighVolume) workout.description = "Peak Week: High-intensity volume for supercompensation.";
                else workout.description = "Base Building: Hierarchical mastery of movement patterns.";

                workouts.push(workout);
            }
            weeks.push({ week: w, workouts });
        }
        return weeks;
    }

    async function handleGenerate() {
        if (!isLoggedIn()) {
            window.location.href = "./account-test.html";
            return;
        }

        generateBtn.disabled = true;
        statusBox.textContent = "Crafting your personalized 4-week plan...";
        
        const fullPlan = generateScientificPlan();
        
        try {
            const response = await fetch(`${API}/plan`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    formData,
                    weeks: fullPlan
                })
            });
            const data = await response.json();
            if (data.ok) {
                window.location.href = "./dashboard.html";
            } else {
                error(data.error || "Failed to save plan.");
            }
        } catch (e) {
            error("Network error: " + e.message);
        } finally {
            generateBtn.disabled = false;
        }
    }

    updateStep();
}

/**
 * DASHBOARD
 */
async function initDashboard() {
    if (!isLoggedIn()) {
        window.location.href = "./account-test.html";
        return;
    }

    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("fitnessplan_token");
        localStorage.removeItem("fitnessplan_user");
        window.location.href = "./account-test.html";
    });

    await loadDashboardData();
}

async function loadDashboardData() {
    try {
        const response = await fetch(`${API}/dashboard`, {
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        const data = await response.json();
        
        if (data.ok) {
            renderDashboard(data);
        } else {
            document.getElementById("todayStatus").textContent = "Error: " + (data.error || "Could not load data.");
        }
    } catch (e) {
        document.getElementById("todayStatus").textContent = "Network error: " + e.message;
    }
}

function renderDashboard(data) {
    const streakEl = document.getElementById("currentStreakNumber");
    if (streakEl) streakEl.textContent = data.streak || 0;

    const streakTxt = document.getElementById("currentStreakText");
    if (streakTxt) {
        streakTxt.textContent = data.streak > 0 ? "Momentum is high. Keep going." : "The best time to start is now.";
    }

    const profileBox = document.getElementById("profileBox");
    if (profileBox && data.user) {
        profileBox.innerHTML = `
            <div class="info-card">
                <div class="info-label">User</div>
                <div class="info-value">${data.user.username}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Started</div>
                <div class="info-value">${data.plan ? data.plan.formData.startDate : "N/A"}</div>
            </div>
        `;
    }

    const planBox = document.getElementById("currentPlanBox");
    if (planBox && data.plan) {
        const fd = data.plan.formData;
        planBox.innerHTML = `
            <div class="info-card">
                <div class="info-label">Target</div>
                <div class="info-value">${fd.focus.join(", ")}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Volume</div>
                <div class="info-value">${fd.daysPerWeek} Days/Week</div>
            </div>
        `;
    }

    const todayBox = document.getElementById("todayBox");
    const todayStatus = document.getElementById("todayStatus");
    if (todayBox && data.today) {
        todayStatus.textContent = "Workout session active.";
        renderWorkout(todayBox, data.today);
    }
}

function renderWorkout(container, workout) {
    container.innerHTML = `
        <div class="today-card">
            <div class="day-top">
                <div>
                    <div class="day-label">${workout.name}</div>
                    <div class="day-title">${workout.description}</div>
                </div>
                <span class="badge">${workout.duration} min</span>
            </div>
            <div class="exercise-meta">
                ${workout.exercises.map(ex => `
                    <div class="exercise-box" style="margin-bottom: 12px; padding: 16px; background: rgba(15, 23, 42, 0.4); border-radius: 14px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div class="exercise-name" style="font-size: 1.1rem; font-weight: 800; color: #60a5fa;">${ex.name}</div>
                            <div class="mini-pill">${ex.sets} sets | ${ex.reps} reps</div>
                        </div>
                        <div class="day-meta" style="font-size: 0.95rem; color: #cbd5e1; line-height: 1.5;">${ex.note || ""}</div>
                        <div style="margin-top: 10px; display: flex; gap: 10px;">
                            ${ex.rest ? `<span class="chip neutral" style="font-size: 0.75rem;">Rest: ${ex.rest}</span>` : ""}
                            <span class="chip neutral" style="font-size: 0.75rem;">Tempo: 3-1-X-1</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

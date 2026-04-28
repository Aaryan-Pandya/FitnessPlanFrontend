// Static Frontend-Only Application
// Persistence: localStorage
// Routing: state-based / file-based

document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if (page === "planner") {
        initPlanner();
    } else if (page === "dashboard") {
        initDashboard();
    }
});

/**
 * MOCK PERSISTENCE LAYER
 */
function getToken() {
    return localStorage.getItem("fitnessplan_token") || "mock-token";
}

function getUser() {
    const u = localStorage.getItem("fitnessplan_user");
    return u ? JSON.parse(u) : { username: "Guest Master", email: "master@fitness.local" };
}

function isLoggedIn() {
    return !!localStorage.getItem("fitnessplan_token");
}

function saveLocalPlan(planData) {
    localStorage.setItem("fitnessplan_current_plan", JSON.stringify(planData));
}

function getLocalPlan() {
    const p = localStorage.getItem("fitnessplan_current_plan");
    return p ? JSON.parse(p) : null;
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
                return formData.focus.includes("endurance");
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

    // De-clumping/Enter-Key Logic
    document.querySelectorAll(".planner-step input, .planner-step select").forEach(el => {
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const visibleSteps = getVisibleSteps();
                if (currentStepIndex === visibleSteps.length - 1) {
                    generateBtn.click();
                } else {
                    nextBtn.click();
                }
            }
        });
    });

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
        // Invisible Operator Protocol: Hide technical details
        let cleanMsg = "We're fine-tuning your mastery track. Please try again.";
        
        if (msg.includes("Date of birth required")) cleanMsg = "Please enter your date of birth to continue.";
        if (msg.includes("Pick at least 1 focus")) cleanMsg = "Select a primary focus to tailor your plan.";
        if (msg.includes("Enter your max reps")) cleanMsg = "A quick rep count helps calibrate your intensity.";
        if (msg.includes("Start date required")) cleanMsg = "Set a start date to lock in your 4-week journey.";
        if (msg.includes("Incorrect Password")) cleanMsg = "Mastery requires the right keys. Try your password again.";
        
        statusBox.textContent = cleanMsg;
        statusBox.className = "status-box bad";

        // Clutter Control: Auto-fade error after 3 seconds
        setTimeout(() => {
            if (statusBox.className.includes("bad")) {
                statusBox.textContent = "Answer the questions to build your plan.";
                statusBox.className = "status-box";
            }
        }, 3000);

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
        
        // "Unlock" Animation: Pulse effect on items
        const items = preview.querySelectorAll(".summary-item");
        items.forEach(item => {
            item.classList.add("pulse");
            setTimeout(() => item.classList.remove("pulse"), 400);
        });
        
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
        const daysCount = formData.daysPerWeek || 3;
        const workoutNames = ["Push Focus", "Pull Focus", "Leg Focus", "Skills", "Full Body"];

        for (let w = 1; w <= 4; w++) {
            const isDeload = (w === 4);
            const isHighVolume = (w === 3);
            const workouts = [];

            for (let d = 0; d < daysCount; d++) {
                const workout = {
                    day: d + 1,
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
                        let setsNum = isHighVolume ? 5 : (isDeload ? 2 : 3);
                        let repsNum = "8-10";
                        let noteStr = "Tempo 3-1-X-1. RIR 2 (Leave 2 in the tank).";
                        let restTime = "3 minutes";

                        if (goal === "push") {
                            exerciseName = formData.pushVariation || "Linear Push";
                            const maxVal = formData.pushupMax || 0;
                            if (maxVal > 0 && maxVal < 5) {
                                setsNum = 5;
                                repsNum = "2 (Cluster)";
                                noteStr = "Form first. Reset between every rep.";
                            }
                            if (pushSkill === "hspu") noteStr += " Focus on vertical leverage path.";
                        } else if (goal === "pull") {
                            exerciseName = formData.pullVariation || "Linear Pull";
                            const maxVal = formData.pullupMax || 0;
                            if (maxVal > 0 && maxVal < 5) {
                                setsNum = 5;
                                repsNum = "2 (Cluster)";
                            }
                            if (pullSkill === "muscle-up") noteStr = "Explosive Chest-to-Bar tempo. Squeeze at top.";
                        } else if (goal === "squat") {
                            exerciseName = "Pistol Squat Progression";
                            noteStr = "Focus on balance and ankle tracking.";
                        }
                        
                        workout.exercises.push({ name: exerciseName, sets: setsNum, reps: repsNum, note: noteStr, rest: restTime });
                    });
                }

                // 3. Endurance / Cardio Component
                if (formData.focus.includes("endurance")) {
                    const eType = formData.enduranceType ? formData.enduranceType[0] : "Run";
                    let setsE = isHighVolume ? "6 km" : (isDeload ? "3 km" : "4 km");
                    let repsE = "Zone 2";
                    let noteE = "Keep breathing through nose. Constant pace.";
                    let restE = "90 seconds";

                    workout.exercises.push({ name: `Endurance: ${eType}`, sets: setsE, reps: repsE, note: noteE, rest: restE });
                }

                // 4. Weekly Mental Challenge
                if (d === daysCount - 1) {
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
        generateBtn.disabled = true;
        statusBox.textContent = "Crafting your personalized 4-week plan...";
        
        // Scientific logic happens on client
        const fullPlan = generateScientificPlan();
        
        // Static persistence
        const planToSave = {
            formData: formData,
            weeks: fullPlan,
            createdAt: new Date().toISOString(),
            streak: 0
        };
        
        saveLocalPlan(planToSave);
        
        // Mocking a network delay for quality feel
        setTimeout(() => {
            window.location.href = "./dashboard.html";
        }, 1500);
    }

    updateStep();
}

/**
 * DASHBOARD
 */
async function initDashboard() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("fitnessplan_token");
            localStorage.removeItem("fitnessplan_user");
            window.location.href = "./account-test.html";
        });
    }

    await loadDashboardData();
}

async function loadDashboardData() {
    // Local static data loading
    const plan = getLocalPlan();
    const user = getUser();
    
    const data = {
        ok: true,
        user: user,
        plan: plan,
        streak: (plan ? plan.streak : 0),
        // Simple logic for "today's workout"
        today: (plan && plan.weeks ? plan.weeks[0].workouts[0] : null)
    };

    renderDashboard(data);
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
                <div class="info-value">${data.plan ? new Date(data.plan.formData.startDate).toLocaleDateString() : "N/A"}</div>
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
    } else if (todayBox) {
        todayStatus.textContent = "No plan active yet.";
        todayBox.innerHTML = `<div class="empty-box">Go to the <a href="./index.html" style="color: #60a5fa;">Planner</a> to start.</div>`;
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
                            <div class="mini-pill" style="font-size: 0.8rem; background: rgba(59,130,246,0.1); color: #60a5fa; padding: 4px 10px; border-radius: 99px;">${ex.sets} sets | ${ex.reps} reps</div>
                        </div>
                        <div class="day-meta" style="font-size: 0.95rem; color: #cbd5e1; line-height: 1.5;">${ex.note || ""}</div>
                        <div style="margin-top: 10px; display: flex; gap: 10px;">
                            ${ex.rest ? `<span style="font-size: 0.75rem; background: rgba(148,163,184,0.1); padding: 4px 8px; border-radius: 6px;">Rest: ${ex.rest}</span>` : ""}
                            <span style="font-size: 0.75rem; background: rgba(148,163,184,0.1); padding: 4px 8px; border-radius: 6px;">Tempo: 3-1-X-1</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

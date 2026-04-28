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
        
        setupEnterKey();
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

    // De-clumping/Enter-Key Logic for Elite Navigation
    function setupEnterKey() {
        document.querySelectorAll("input, select, textarea").forEach(el => {
            el.removeEventListener("keydown", handlePlannerKey);
            el.addEventListener("keydown", handlePlannerKey);
        });
    }

    function handlePlannerKey(e) {
        if (e.key === "Enter") {
            const tagName = e.target.tagName.toLowerCase();
            if (tagName === "textarea") return;

            e.preventDefault();
            const visibleSteps = getVisibleSteps();
            if (currentStepIndex === visibleSteps.length - 1) {
                generateBtn.click();
            } else {
                nextBtn.click();
            }
        }
    }

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
        let cleanMsg = "Adjusting your Mastery Track... Please refresh.";
        
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes("date of birth")) cleanMsg = "Tell the coach your age to personalize the intensity.";
        if (lowerMsg.includes("pick at least 1 focus")) cleanMsg = "Select a primary focus to tailor your level-up path.";
        if (lowerMsg.includes("enter your max reps")) cleanMsg = "A quick rep count helps calibrate your mastery level.";
        if (lowerMsg.includes("start date")) cleanMsg = "Set your start date to lock in your 4-week journey.";
        if (lowerMsg.includes("password")) cleanMsg = "Mastery requires the right keys. Try your password again.";
        
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
        const sessionNames = [
            { id: 'Day A', name: "The Push Path", goals: ["push"], goalDesc: "Chest, Shoulders & Triceps." },
            { id: 'Day B', name: "The Pull Path", goals: ["pull"], goalDesc: "Back, Biceps & Core." },
            { id: 'Day C', name: "The Leg Path", goals: ["squat"], goalDesc: "Quads, Glutes & Core." },
            { id: 'Day D', name: "The Engine", goals: ["endurance"], goalDesc: "Steady Pace, Nose Breathing." },
            { id: 'Day E', name: "Active Recovery", goals: ["mastery"], goalDesc: "Full body mobility and light movement." }
        ];

        for (let w = 1; w <= 4; w++) {
            const isDeload = (w === 4);
            const isHighVolume = (w === 3);
            const workouts = [];

            for (let d = 0; d < 5; d++) {
                const session = sessionNames[d];
                
                // If user selected 3 days, only A, B, D are prioritized for focus=both
                // For simplicity, we ensure minimum 3 sessions as requested by common splits
                const workout = {
                    day: session.id,
                    name: `${session.id}: ${session.name}`,
                    duration: formData.sessionLength || 60,
                    description: session.goalDesc,
                    exercises: []
                };

                const eliteTempo = "3s Down, 1s Pause, Fast Up, 1s Squeeze";

                // 1. THE PRIMER (Warmup)
                if (session.id === 'Day A') {
                    workout.exercises.push({ type: 'primer', name: "Upper Back Warmup", sets: "1", reps: "5 min", note: "Get your upper back moving so you don't snap your shoulders.", rest: "None" });
                    workout.exercises.push({ type: 'primer', name: "Wrist Circles", sets: "2", reps: "10", note: "Prep the joints.", rest: "30s" });
                } else if (session.id === 'Day C') {
                    workout.exercises.push({ type: 'primer', name: "Ankle & Hip Opening", sets: "1", reps: "5 min", note: "Sit deep, breathe easy.", rest: "None" });
                    workout.exercises.push({ type: 'primer', name: "Back of legs Warmup", sets: "2", reps: "10", note: "Wake up the glutes.", rest: "30s" });
                } else {
                    workout.exercises.push({ type: 'primer', name: "System Wake-up", sets: "2", reps: "10", note: "Full body flow.", rest: "30s" });
                }

                // 2. THE MASTERY MOVE (Strength)
                if (session.goals.some(g => formData.strengthGoals.includes(g))) {
                    const goal = session.goals.find(g => formData.strengthGoals.includes(g));
                    let exerciseName = "Mastery Movement";
                    let repsVal = "8-10";
                    let setsVal = isHighVolume ? 4 : (isDeload ? 2 : 3);
                    let noteStr = "Focus on the path of movement.";
                    let maxReps = 10;

                    if (goal === 'push') {
                        exerciseName = formData.pushVariation || "Floor Push";
                        maxReps = formData.pushupMax || 0;
                    } else if (goal === 'pull') {
                        exerciseName = formData.pullVariation || "Linear Pull";
                        maxReps = formData.pullupMax || 0;
                    } else if (goal === 'squat') {
                        exerciseName = "Pistol Squat Level-Up";
                        maxReps = 5; 
                    }

                    // Rule-based Programming Logic
                    if (maxReps < 3) {
                        repsVal = "2 (Cluster)";
                        setsVal = 5;
                        noteStr = "Neurological: 5 sets of 2 reps with 20s rest between reps.";
                    } else if (maxReps >= 3 && maxReps <= 8) {
                        const target = maxReps - 2;
                        repsVal = `${target}`;
                        setsVal = 4;
                        noteStr = "Strength: 4 sets of sub-max reps.";
                    } else if (maxReps > 12) {
                        repsVal = "8-10";
                        noteStr = "Mastery: Move to the Next Harder Variation immediately.";
                    } else {
                        repsVal = "8-10";
                        noteStr = "Standard: Standard sets to build engine.";
                    }

                    workout.exercises.push({ 
                        type: 'mastery',
                        name: exerciseName, 
                        sets: setsVal, 
                        reps: repsVal, 
                        note: noteStr, 
                        rest: "3 minutes",
                        tempo: eliteTempo,
                        metric: "What did you hit?",
                        targetReps: repsVal
                    });
                }

                // 3. THE BUILDER (Hypertrophy)
                if (session.id !== 'Day D') {
                    const finishers = [
                        { name: "Hold Still Plank", note: "Build core stability." },
                        { name: "Glute Squeeze Bridges", note: "The Lift: Size focus." },
                        { name: "The Lowering Phase Push", note: "Focus on the slow down." }
                    ];
                    const fin = finishers[d % finishers.length];
                    workout.exercises.push({ 
                        type: 'builder',
                        name: fin.name, 
                        sets: "3", 
                        reps: "10-12", 
                        note: fin.note, 
                        rest: "60 seconds",
                        metric: "Reps completed",
                        targetReps: "12",
                        tempo: eliteTempo
                    });
                }

                // 4. THE ENGINE (Cardio)
                if (session.id === 'Day D') {
                    const eType = formData.enduranceType ? formData.enduranceType[0] : "Run";
                    workout.exercises.push({ 
                        type: 'mastery',
                        name: `The Engine: ${eType}`, 
                        sets: "1", 
                        reps: isHighVolume ? "6 km" : "4 km", 
                        note: "Steady Pace, Nose Breathing. Move efficiently.", 
                        rest: "Cooldown",
                        tempo: "Steady State",
                        metric: "Distance / Time",
                        targetReps: isHighVolume ? "6km" : "4km"
                    });
                }

                workouts.push(workout);
            }
            weeks.push({ week: w, workouts });
        }
        return weeks;
    }

    async function handleGenerate() {
        generateBtn.disabled = true;
        statusBox.textContent = "Crafting your personalized 4-week plan...";
        
        const fullPlan = generateScientificPlan();
        
        const planToSave = {
            formData: formData,
            weeks: fullPlan,
            createdAt: new Date().toISOString(),
            activeDay: 'Day A', // Store default active day
            streak: 0
        };
        
        saveLocalPlan(planToSave);
        
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

    const profileBox = document.getElementById("profileBox");
    if (profileBox && data.user) {
        let startDateStr = "Not Started";
        if (data.plan && data.plan.formData && data.plan.formData.startDate) {
            const d = new Date(data.plan.formData.startDate);
            if (!isNaN(d.getTime())) {
                startDateStr = d.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            }
        }
        
        profileBox.innerHTML = `
            <div class="info-card">
                <div class="info-label">User</div>
                <div class="info-value">${data.user.username}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Started</div>
                <div class="info-value date-display">${startDateStr}</div>
            </div>
        `;
    }

    const todayBox = document.getElementById("todayBox");
    const dayPickerContainer = document.getElementById("dayPickerContainer");

    if (data.plan && data.plan.weeks) {
        const weekWorkouts = data.plan.weeks[0].workouts;
        
        // Render Day Picker
        if (dayPickerContainer) {
            const days = ['Day A', 'Day B', 'Day C', 'Day D', 'Day E'].filter(d => 
                weekWorkouts.some(w => w.day === d)
            );
            
            dayPickerContainer.innerHTML = days.map(day => `
                <button class="day-tab ${data.plan.activeDay === day ? 'active' : ''}" data-day="${day}">
                    ${day}
                </button>
            `).join("");

            dayPickerContainer.querySelectorAll(".day-tab").forEach(btn => {
                btn.addEventListener("click", () => {
                    const selectedDay = btn.dataset.day;
                    data.plan.activeDay = selectedDay;
                    saveLocalPlan(data.plan);
                    renderDashboard(data);
                });
            });
        }

        const activeWorkout = weekWorkouts.find(w => w.day === data.plan.activeDay) || weekWorkouts[0];
        renderWorkout(todayBox, activeWorkout);
    } else if (todayBox) {
        todayBox.innerHTML = `<div class="empty-box">Go to the <a href="./index.html" style="color: #60a5fa;">Planner</a> to start.</div>`;
    }
}

function renderWorkout(container, workout) {
    if (!container || !workout) return;
    
    container.innerHTML = `
        <div class="today-card animate-fadeIn workout-grid">
            <div class="day-top">
                <div>
                    <div class="day-label">${workout.name}</div>
                    <div class="day-title">${workout.description}</div>
                </div>
                <span class="badge">${workout.duration} min</span>
            </div>
            <div class="exercise-meta">
                ${workout.exercises.map((ex, idx) => `
                    <div class="exercise-card">
                        <div class="exercise-header">
                            <div class="exercise-name">${ex.name}</div>
                            <div class="mini-pill">${ex.sets} x ${ex.reps}</div>
                        </div>
                        <div class="exercise-note">${ex.note}</div>
                        
                        ${ex.type !== 'primer' && ex.metric ? `
                            <div class="tracking-stats" style="margin: 15px 0; display: flex; gap: 10px; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 4px;">Log Reps (${ex.metric})</div>
                                    <input type="text" class="log-input" placeholder="${ex.targetReps || 'Stats'}" data-ex-idx="${idx}" style="width: 100%; background: #0f172a; border: 1px solid rgba(148,163,184,0.2); padding: 8px; border-radius: 6px; color: #fff; font-size: 0.9rem;">
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 4px;">Weight / Assistance</div>
                                    <input type="text" class="load-input" placeholder="e.g. Blue Band" data-ex-idx="${idx}" style="width: 100%; background: #0f172a; border: 1px solid rgba(148,163,184,0.2); padding: 8px; border-radius: 6px; color: #fff; font-size: 0.9rem;">
                                </div>
                                <button class="btn primary save-log-btn" data-ex-idx="${idx}" style="margin-top: 18px; padding: 8px 12px; font-size: 0.8rem;">Log Set</button>
                            </div>
                        ` : ''}

                        <div class="exercise-footer">
                            <span class="meta-item">Tempo: ${ex.tempo || 'Natural Flow'}</span>
                            <span class="meta-item">Rest: ${ex.rest || '60s'}</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    // Add event listeners for logging
    container.querySelectorAll(".save-log-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = e.target.dataset.exIdx;
            const logInput = container.querySelector(`.log-input[data-ex-idx="${idx}"]`);
            const loadInput = container.querySelector(`.load-input[data-ex-idx="${idx}"]`);
            
            if (logInput.value || loadInput.value) {
                const originalText = btn.textContent;
                btn.textContent = "Saved";
                btn.classList.add("good");
                
                // Persistence simulation
                console.log(`Log saved for ${workout.exercises[idx].name}: ${logInput.value} @ ${loadInput.value}`);
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove("good");
                }, 2000);
            }
        });
    });
}

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
        const sessionNames = {
            'Day A': { id: 'Day A', name: "The Push Path", goals: ["push"], goalDesc: "Chest, Shoulders & Triceps." },
            'Day B': { id: 'Day B', name: "The Pull Path", goals: ["pull"], goalDesc: "Back, Biceps & Core." },
            'Day C': { id: 'Day C', name: "The Leg Path", goals: ["squat"], goalDesc: "Quads, Glutes & Core." },
            'Day D': { id: 'Day D', name: "The Engine", goals: ["endurance"], goalDesc: "Steady Pace, Nose Breathing." },
            'Day E': { id: 'Day E', name: "Active Recovery", goals: ["mastery"], goalDesc: "Full body mobility and light movement." }
        };

        // Determine age and programming parameters
        let age = 30;
        if (formData.dob) {
            const birth = new Date(formData.dob);
            if (!isNaN(birth.getTime())) {
                const now = new Date();
                age = now.getFullYear() - birth.getFullYear();
            }
        }

        let ageMaxSets = 5;
        let baseRest = 60; // in seconds
        let ageRepCap = 12;

        if (age >= 50) {
            ageMaxSets = 3;
            baseRest = 120;
            ageRepCap = 8;
        } else if (age >= 35) {
            ageMaxSets = 4;
            baseRest = 90;
            ageRepCap = 10;
        }

        let allowedDays = [];
        const hasEndurance = formData.focus.includes("endurance") || formData.focus.includes("cardio");
        const hasStrength = formData.focus.includes("strength");
        const hasFlexibility = formData.focus.includes("flexibility");

        if (formData.daysPerWeek === 5) {
            allowedDays = ['Day A', 'Day B', 'Day C', 'Day D', 'Day E'];
        } else {
            if (hasStrength && hasEndurance) {
                allowedDays = ['Day A', 'Day B', 'Day D'];
            } else if (hasStrength && hasFlexibility) {
                allowedDays = ['Day A', 'Day B', 'Day E'];
            } else if (hasEndurance) {
                allowedDays = ['Day D', 'Day E', 'Day A'];
            } else {
                allowedDays = ['Day A', 'Day B', 'Day C'];
            }
        }
        allowedDays.sort();

        for (let w = 1; w <= 4; w++) {
            const isDeload = (w === 4);
            const isHighVolume = (w === 3);
            const workouts = [];

            for (let d = 0; d < allowedDays.length; d++) {
                const sessionKey = allowedDays[d];
                const session = sessionNames[sessionKey];
                
                const workout = {
                    day: session.id,
                    name: `${session.id}: ${session.name}`,
                    duration: formData.sessionLength || 60,
                    description: session.goalDesc,
                    exercises: []
                };

                const eliteTempo = "3s Down, 1s Pause, Fast Up, 1s Squeeze";

                if (session.id === 'Day A') {
                    // THE PRIMER (Warmup includes mobility)
                    workout.exercises.push({ type: 'primer', name: "Upper Back Warmup", sets: "2", reps: "10", note: "Get your upper back moving.", rest: "None" });
                    workout.exercises.push({ type: 'primer', name: "Wrist Circles", sets: "2", reps: "10", note: "Prep the joints.", rest: `${baseRest / 2}s` });
                    
                    // THE MASTERY MOVE
                    let exerciseName = formData.pushVariation || "Floor Push";
                    let maxReps = formData.pushupMax || 0;
                    let repsVal = "8-10";
                    let setsVal = isHighVolume ? ageMaxSets : (isDeload ? 2 : Math.min(3, ageMaxSets));
                    let noteStr = "Focus on The Lowering Phase.";

                    if (maxReps > 0 && maxReps < 3) {
                        repsVal = "2";
                        setsVal = ageMaxSets;
                        noteStr = "Power: Short bursts of 2 reps with 20s rest between reps.";
                    } else if (maxReps >= 3 && maxReps <= 8) {
                        repsVal = `${Math.max(1, maxReps - 2)}`;
                        noteStr = `Strength: ${setsVal} sets of sub-max reps.`;
                    } else if (maxReps > 12) {
                        repsVal = `${ageRepCap}`;
                        noteStr = "Mastery Level Reached: Move to the Next Harder Variation immediately.";
                    }

                    workout.exercises.push({ type: 'mastery', name: exerciseName, sets: setsVal, reps: repsVal, note: noteStr, rest: "3 minutes", tempo: eliteTempo, metric: "Sets x Reps", targetReps: `${setsVal}x${repsVal}` });

                    // THE BUILDER: Skill-oriented Push exercises only
                    let builder1 = { name: "Close Grip Push", note: "Triceps and chest focus." };
                    let builder2 = { name: "Tricep Extensions", note: "Tricep Isolation." };
                    
                    if (formData.pushSkill && formData.pushSkill.includes('hspu')) {
                        builder1 = { name: "Pike Push Downs", note: "Shoulder strength for vertical push." };
                        builder2 = { name: "Wall Handstand Hold", note: "Build core and shoulder stability." };
                    } else if (formData.pushSkill && formData.pushSkill.includes('one-arm')) {
                        builder1 = { name: "Archer Pushups", note: "Unilateral strength focus." };
                        builder2 = { name: "Plank Shoulder Taps", note: "Anti-rotation core hold." };
                    }

                    workout.exercises.push({ type: 'builder', name: builder1.name, sets: Math.min(3, ageMaxSets), reps: `8-${ageRepCap}`, note: builder1.note, rest: `${baseRest}s`, metric: "Sets x Reps", targetReps: `3x${ageRepCap}`, tempo: eliteTempo });
                    workout.exercises.push({ type: 'builder', name: builder2.name, sets: Math.min(3, ageMaxSets), reps: `8-${ageRepCap}`, note: builder2.note, rest: `${baseRest}s`, metric: "Sets x Reps", targetReps: `3x${ageRepCap}`, tempo: eliteTempo });

                } else if (session.id === 'Day B') {
                    // THE PRIMER
                    workout.exercises.push({ type: 'primer', name: "Shoulder Circles", sets: "2", reps: "10", note: "Wake up the upper back.", rest: "None" });
                    workout.exercises.push({ type: 'primer', name: "Bar Hangs", sets: "2", reps: "10s", note: "Prep the grip.", rest: `${baseRest / 2}s` });
                    
                    // THE MASTERY MOVE
                    let exerciseName = formData.pullVariation || "Linear Pull";
                    let maxReps = formData.pullupMax || 0;
                    let repsVal = "8-10";
                    let setsVal = isHighVolume ? ageMaxSets : (isDeload ? 2 : Math.min(3, ageMaxSets));
                    let noteStr = "Hold Still for 1s at the top.";

                    if (maxReps > 0 && maxReps < 3) {
                        repsVal = "2"; 
                        setsVal = ageMaxSets; 
                        noteStr = "Power: Short bursts of 2 reps with 20s rest.";
                    } else if (maxReps >= 3 && maxReps <= 8) { 
                        repsVal = `${Math.max(1, maxReps - 2)}`; 
                        noteStr = `Strength: ${setsVal} sets of sub-max reps.`; 
                    } else if (maxReps > 12) { 
                        repsVal = `${ageRepCap}`; 
                        noteStr = "Mastery Level Reached: Move to the Next Harder Variation."; 
                    }

                    workout.exercises.push({ type: 'mastery', name: exerciseName, sets: setsVal, reps: repsVal, note: noteStr, rest: "3 minutes", tempo: eliteTempo, metric: "Sets x Reps", targetReps: `${setsVal}x${repsVal}` });

                    // THE BUILDER: Skill-oriented Pull exercises only
                    let builder1 = { name: "Bodyweight Rows", note: "Back Builder." };
                    let builder2 = { name: "Bicep Curls (Band)", note: "Bicep Builder." };
                    
                    if (formData.pullSkill && formData.pullSkill.includes('muscle-up')) {
                        builder1 = { name: "Explosive High Pulls", note: "Train speed for the transition." };
                        builder2 = { name: "Straight Bar Dips", note: "The top half of the movement." };
                    } else if (formData.pullSkill && formData.pullSkill.includes('one-arm-pull')) {
                        builder1 = { name: "Archer Pullups", note: "Unilateral vertical pull." };
                        builder2 = { name: "Uneven Grip Holds", note: "Lock off strength." };
                    }

                    workout.exercises.push({ type: 'builder', name: builder1.name, sets: Math.min(3, ageMaxSets), reps: `8-${ageRepCap}`, note: builder1.note, rest: `${baseRest}s`, metric: "Sets x Reps", targetReps: `3x${ageRepCap}`, tempo: eliteTempo });
                    workout.exercises.push({ type: 'builder', name: builder2.name, sets: Math.min(3, ageMaxSets), reps: `8-${ageRepCap}`, note: builder2.note, rest: `${baseRest}s`, metric: "Sets x Reps", targetReps: `3x${ageRepCap}`, tempo: eliteTempo });

                } else if (session.id === 'Day C') {
                    // THE PRIMER
                    workout.exercises.push({ type: 'primer', name: "Ankle & Hip Opening", sets: "2", reps: "10", note: "Sit deep, breathe easy.", rest: "None" });
                    workout.exercises.push({ type: 'primer', name: "Back of legs Warmup", sets: "2", reps: "10", note: "Wake up the glutes.", rest: `${baseRest / 2}s` });
                    
                    // THE MASTERY MOVE 
                    let exerciseName = "Pistol Squat Level-Up";
                    let repsVal = "3";
                    let setsVal = isHighVolume ? ageMaxSets : (isDeload ? 2 : Math.min(3, ageMaxSets));
                    let noteStr = `Strength: ${setsVal} sets of sub-max reps.`;
                    
                    if (formData.focus.includes("endurance")) {
                         exerciseName = "High Rep Lunges";
                         repsVal = `${ageRepCap}`;
                         noteStr = "Build muscular endurance for the legs.";
                    }

                    workout.exercises.push({ type: 'mastery', name: exerciseName, sets: setsVal, reps: repsVal, note: noteStr, rest: "3 minutes", tempo: eliteTempo, metric: "Sets x Reps", targetReps: `${setsVal}x${repsVal}` });

                    let builder1 = { name: "Glute Squeeze Bridges", note: "Glute strength for balance." };
                    let builder2 = { name: "Assisted Sissy Squats", note: "Quad isolation." };

                    workout.exercises.push({ type: 'builder', name: builder1.name, sets: Math.min(3, ageMaxSets), reps: `8-${ageRepCap}`, note: builder1.note, rest: `${baseRest}s`, metric: "Sets x Reps", targetReps: `3x${ageRepCap}`, tempo: eliteTempo });
                    workout.exercises.push({ type: 'builder', name: builder2.name, sets: Math.min(3, ageMaxSets), reps: `8-${ageRepCap}`, note: builder2.note, rest: `${baseRest}s`, metric: "Sets x Reps", targetReps: `3x${ageRepCap}`, tempo: eliteTempo });

                } else if (session.id === 'Day D') {
                    const eType = formData.enduranceType ? formData.enduranceType[0] : "Run";
                    workout.exercises.push({ 
                        type: 'mastery',
                        name: `The Engine: ${eType}`, 
                        sets: "1", 
                        reps: isHighVolume ? "6 km" : "4 km", 
                        note: "Steady Pace, Nose Breathing. Easy Pace.", 
                        rest: "Cooldown",
                        tempo: "Steady State",
                        metric: "Distance / Time",
                        targetReps: isHighVolume ? "6km" : "4km"
                    });
                } else if (session.id === 'Day E') {
                    workout.exercises.push({ type: 'primer', name: "Full Body Mobility", sets: "1", reps: "10 min", note: "Light movement. Easy pace.", rest: "None" });
                    workout.exercises.push({ type: 'primer', name: "Joint Rotations", sets: "1", reps: "5 min", note: "Keep everything loose.", rest: "None" });
                }

                    workout.exercises.forEach((ex, idx) => {
                        ex.id = `ex_${idx}`;
                        let setsDetails = [];
                        const numSets = parseInt(ex.sets, 10) || 1;
                        const baseRepsStr = ex.reps || "10";
                        const isTime = typeof baseRepsStr === "string" && (baseRepsStr.includes("min") || baseRepsStr.includes("s") || baseRepsStr.includes("km"));
                        let baseRepNum = parseInt(baseRepsStr, 10) || baseRepsStr;

                        for(let s=0; s < numSets; s++) {
                            let currentTarget = baseRepsStr;
                            if (!isTime && typeof baseRepNum === "number" && ex.type !== 'primer') {
                                 let addedReps = 0;
                                 if (w > 1 && w < 4) { 
                                     let totalIncreases = w - 1; 
                                     if (w === 3) totalIncreases = 2; 
                                     let setsFromEnd = (numSets - 1) - s;
                                     if (totalIncreases > setsFromEnd) addedReps = 1;
                                 }
                                 if (w === 4) {
                                     addedReps = -2; 
                                 }
                                 currentTarget = Math.max(1, baseRepNum + addedReps).toString();
                                 if (baseRepsStr.includes("Cluster")) currentTarget = "2";
                            }
                            setsDetails.push({ setNumber: s + 1, targetReps: currentTarget, rest: ex.rest || "60s" });
                        }
                        ex.setDetails = setsDetails;
                    });

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
        logs: JSON.parse(localStorage.getItem('fitnessplan_logs')) || { readiness: {}, reps: {} }
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
    const weekTrackerBox = document.getElementById("weekTrackerBox");
    const weeksAheadBox = document.getElementById("weeksAheadBox");

    if (data.plan && data.plan.weeks) {
        const weekWorkouts = data.plan.weeks[0].workouts;
        
        // Render Day Picker
        if (dayPickerContainer) {
            const days = ['Day A', 'Day B', 'Day C', 'Day D', 'Day E'].filter(d => 
                weekWorkouts.some(w => w.day === d)
            );
            
            dayPickerContainer.innerHTML = days.map(day => {
                const dateKey = new Date().toDateString() + "_" + day;
                const isDone = data.logs && data.logs.readiness && data.logs.readiness[dateKey] ? '<span style="color:#10b981; margin-left:4px;">✔</span>' : '';
                return `
                    <button class="day-tab ${data.plan.activeDay === day ? 'active' : ''}" data-day="${day}">
                        ${day} ${isDone}
                    </button>
                `;
            }).join("");

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
        renderWorkout(todayBox, activeWorkout, data.logs);
        
        // Render This Week Tracker
        if (weekTrackerBox) {
            weekTrackerBox.innerHTML = weekWorkouts.map(w => `
                <div class="info-card" style="padding: 12px; background: rgba(0,0,0,0.2);">
                    <div style="font-size: 0.9rem; font-weight: bold; color: #fff;">${w.day}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">${w.description}</div>
                </div>
            `).join("");
        }

        // Render Weeks Ahead
        if (weeksAheadBox) {
            const upNext = data.plan.weeks.slice(1);
            if (upNext.length === 0) {
                 weeksAheadBox.innerHTML = `<div class="empty-box">No future weeks built yet.</div>`;
            } else {
                 weeksAheadBox.innerHTML = upNext.map(w => `
                    <div style="margin-bottom: 24px; border-left: 2px solid #3b82f6; padding-left: 16px;">
                        <h3 style="color: #60a5fa; margin-bottom: 12px;">Week ${w.week} ${w.week === 4 ? '(Deload)' : ''}</h3>
                        <div class="week-grid">
                            ${w.workouts.map(wk => `
                                <div class="info-card" style="padding: 12px; background: rgba(0,0,0,0.2);">
                                    <div style="font-size: 0.9rem; font-weight: bold; color: #fff;">${wk.day}</div>
                                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">${wk.name}</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `).join("");
            }
        }

    } else if (todayBox) {
        todayBox.innerHTML = `<div class="empty-box">Go to the <a href="./index.html" style="color: #60a5fa;">Planner</a> to start.</div>`;
    }
}

function renderWorkout(container, workout, dataLogs) {
    if (!container || !workout) return;

    if (!dataLogs) dataLogs = { readiness: {}, reps: {} };
    const dateKey = new Date().toDateString() + "_" + workout.day;
    const isReady = dataLogs.readiness[dateKey] === true;

    let readinessHTML = "";
    if (workout.exercises.length > 0 && !isReady) {
        readinessHTML = `
            <div class="readiness-card" style="background: rgba(255,255,255,0.03); padding: 24px; border-radius: 16px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1);">
                <h3 style="margin-top: 0; color: #60a5fa; font-size: 1.25rem;">Readiness Tracker</h3>
                <p style="font-size: 0.95rem; color: #cbd5e1; margin-bottom: 20px;">Unlock today's session by answering honestly.</p>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 8px;">Sleep (1=Poor, 5=Great)</label>
                    <input type="range" id="sleepVal" min="1" max="5" value="3" style="width: 100%;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 8px;">Nutrition (1=Poor, 5=Great)</label>
                    <input type="range" id="nutriVal" min="1" max="5" value="3" style="width: 100%;">
                </div>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 8px;">Energy (1=Poor, 5=Great)</label>
                    <input type="range" id="energyVal" min="1" max="5" value="3" style="width: 100%;">
                </div>
                <button id="unlockBtn" class="btn primary" style="width: 100%; padding: 12px; font-weight: bold;">Unlock Workout</button>
            </div>
        `;
    }

    const warmup = workout.exercises.filter(ex => ex.type === 'primer');
    const mainWork = workout.exercises.filter(ex => ex.type === 'mastery' || ex.type === 'builder');
    const cooldown = [{ id: 'cd_1', type: 'cooldown', name: "Light Walk & Stretching", note: "Bring the heart rate down safely.", tempo: "Natural Flow", setDetails: [{ setNumber: 1, targetReps: "5 min", rest: "None" }] }];

    function renderSection(title, exercises) {
        if (!exercises || exercises.length === 0) return '';
        return `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 16px;">${title}</h3>
                ${exercises.map(ex => `
                    <div class="exercise-card">
                        <div class="exercise-header" style="margin-bottom: 8px;">
                            <div class="exercise-name" style="font-size: 1.15rem;">${ex.name}</div>
                        </div>
                        <div class="exercise-note">${ex.note}</div>
                        ${ex.tempo ? `<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 16px;"><strong>Tempo:</strong> ${ex.tempo}</div>` : ''}
                        
                        <div class="sets-wrapper" style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
                                <div style="flex: 1;">Set</div>
                                <div style="flex: 1; text-align: center;">Goal Reps</div>
                                <div style="flex: 1; text-align: center;">Rest</div>
                                <div style="flex: 1; text-align: right;">Actual</div>
                            </div>
                            
                            ${ex.setDetails.map(set => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
                                    <div style="flex: 1; color: #94a3b8; font-weight: 600; font-size: 0.95rem;">${set.setNumber}</div>
                                    <div style="flex: 1; text-align: center; color: #60a5fa; font-weight: bold; font-size: 0.95rem;">${set.targetReps}</div>
                                    <div style="flex: 1; text-align: center; color: #cbd5e1; font-size: 0.85rem;">${set.rest}</div>
                                    <div style="flex: 1; text-align: right;">
                                        <input type="text" class="actual-rep-input" data-ex="${ex.id}" data-set="${set.setNumber}" 
                                            value="${dataLogs.reps[dateKey] && dataLogs.reps[dateKey][ex.id] ? (dataLogs.reps[dateKey][ex.id][set.setNumber] || '') : ''}"
                                            placeholder="-" 
                                            style="width: 50px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 8px; color: #fff; text-align: center; font-size: 0.95rem;"
                                            ${!isReady ? 'disabled' : ''}>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="today-card animate-fadeIn workout-grid" style="margin-top: 0;">
            <div class="day-top" style="margin-bottom: 24px;">
                <div>
                    <div class="day-label" style="font-size: 1.5rem; font-weight: 900; color: #fff;">${workout.name}</div>
                    <div class="day-title" style="color: #94a3b8;">${workout.description}</div>
                </div>
                <span class="badge" style="background: rgba(96,165,250,0.15); color: #60a5fa; padding: 6px 12px; border-radius: 20px; font-weight: bold;">${workout.duration} min</span>
            </div>
            
            ${readinessHTML}
            
            <div class="workout-content" style="${!isReady && workout.exercises.length > 0 ? 'opacity: 0.4; pointer-events: none; filter: blur(2px); transition: all 0.3s ease;' : ''}">
                ${renderSection('Warm-up', warmup)}
                ${renderSection('Main Work', mainWork)}
                ${renderSection('Cooldown', cooldown)}
            </div>
        </div>
    `;

    // Event Listeners
    if (!isReady && workout.exercises.length > 0) {
        document.getElementById("unlockBtn").addEventListener("click", () => {
            dataLogs.readiness[dateKey] = true;
            localStorage.setItem("fitnessplan_logs", JSON.stringify(dataLogs));
            const wc = container.querySelector(".workout-content");
            wc.style.opacity = "1";
            wc.style.pointerEvents = "auto";
            wc.style.filter = "none";
            container.querySelector(".readiness-card").style.display = "none";
            container.querySelectorAll("input.actual-rep-input").forEach(inp => inp.disabled = false);
        });
    }

    // Auto-save reps
    container.querySelectorAll("input.actual-rep-input").forEach(inp => {
        inp.addEventListener("change", (e) => {
            const exId = e.target.dataset.ex;
            const setNum = e.target.dataset.set;
            const val = e.target.value;
            
            if (!dataLogs.reps[dateKey]) dataLogs.reps[dateKey] = {};
            if (!dataLogs.reps[dateKey][exId]) dataLogs.reps[dateKey][exId] = {};
            dataLogs.reps[dateKey][exId][setNum] = val;
            
            localStorage.setItem("fitnessplan_logs", JSON.stringify(dataLogs));
            
            // Visual feedback
            e.target.style.borderColor = "#10b981";
            e.target.style.background = "rgba(16, 185, 129, 0.1)";
            setTimeout(() => {
                e.target.style.borderColor = "rgba(255,255,255,0.2)";
                e.target.style.background = "rgba(0,0,0,0.3)";
            }, 800);
        });
    });
}

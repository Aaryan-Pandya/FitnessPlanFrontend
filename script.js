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
    planData.version = 2;
    localStorage.setItem("fitnessplan_current_plan", JSON.stringify(planData));
}

function getLocalPlan() {
    const p = localStorage.getItem("fitnessplan_current_plan");
    if (p) {
        const parsed = JSON.parse(p);
        if (parsed.version !== 2) return null;
        return parsed;
    }
    return null;
}

/**
 * PLANNER
 */
function initPlanner() {
    // All possible steps in order
    const allSteps = [
        "dob", "focus", "endurance-type", "equipment", "strength-goals", "push-skill", "pull-skill",
        "days", "session-length",
        "push-variation", "push-max", 
        "pull-variation", "pull-assist", "pull-max", 
        "squat-variation", "squat-max", "wall-sit",
        "plank", "mile", "run-duration", "run-distance", "start-date"
    ];

    let currentStepIndex = 0;
    const formData = {
        focus: [],
        enduranceType: [],
        equipment: [],
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
            if (step === "squat-variation") return formData.strengthGoals.includes("squat") || formData.focus.includes("strength");
            if (step === "squat-max") {
                const vari = document.getElementById("squatVariation")?.value;
                return (formData.strengthGoals.includes("squat") || formData.focus.includes("strength")) && vari !== "none";
            }
            if (step === "wall-sit") return formData.strengthGoals.includes("squat") || formData.focus.includes("strength");

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
                const val = btn.dataset.focus || btn.dataset.type || btn.dataset.goal || btn.dataset.skill || btn.dataset.equip;
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
    setupTiles(".equipment-grid", "equipment", 5);
    setupTiles("#step-strength-goals", "strengthGoals", 3);
    setupTiles("#step-push-skill", "pushSkill", 1);
    setupTiles("#step-pull-skill", "pullSkill", 1);

    const dobInput = document.getElementById("dob");
    const ageInfoContainer = document.getElementById("age-info-container");
    const countdownMessage = document.getElementById("countdown-message");
    const countdownTimer = document.getElementById("countdown-timer");
    const parentDisclaimer = document.getElementById("parent-disclaimer");

    if (dobInput) {
        dobInput.addEventListener("change", handleAge);
    }

    function handleAge() {
        const dobValue = dobInput.value;
        if (!dobValue) {
            ageInfoContainer.style.display = 'none';
            return;
        }

        const dob = new Date(dobValue);
        const today = new Date();
        
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }

        ageInfoContainer.style.display = 'block';
        
        if (age < 9) {
            countdownMessage.style.display = 'block';
            parentDisclaimer.style.display = 'none';

            const ninthBirthday = new Date(dob);
            ninthBirthday.setFullYear(dob.getFullYear() + 9);
            
            const diffTime = ninthBirthday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 365) {
                const years = Math.floor(diffDays / 365);
                const remainingDays = diffDays % 365;
                countdownTimer.textContent = `${years} year${years > 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''} to go!`;
            } else {
                countdownTimer.textContent = `${diffDays} day${diffDays !== 1 ? 's' : ''} to go!`;
            }
        } else if (age < 13) {
            countdownMessage.style.display = 'none';
            parentDisclaimer.style.display = 'block';
        } else {
            ageInfoContainer.style.display = 'none';
        }
    }

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
            
            const dob = new Date(formData.dob);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                age--;
            }

            if (age < 9) return error("Come back on your 9th birthday!");
            if (age < 13) {
                const consent = document.getElementById("parent-consent").checked;
                if (!consent) return error("Parent/Guardian consent required.");
            }
        }
        if (stepId === "focus") {
            if (formData.focus.length === 0) return error("Pick at least 1 focus.");
        }
        if (stepId === "endurance-type") {
            if (formData.focus.includes('endurance') && (!formData.enduranceType || formData.enduranceType.length === 0)) {
                 return error("Select at least 1 endurance type.");
            }
        }
        if (stepId === "equipment") {
            if (!formData.equipment || formData.equipment.length === 0) {
                 return error("Select equipment (or None for bodyweight).");
            }
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
        if (stepId === "squat-variation") {
            formData.squatVariation = document.getElementById("squatVariation").value;
        }
        if (stepId === "squat-max") {
            formData.squatMax = parseInt(document.getElementById("squatMax").value);
            if (isNaN(formData.squatMax)) return error("Enter your max reps.");
        }
        if (stepId === "wall-sit") {
            formData.wallSit = parseInt(document.getElementById("wallSit").value) || 0;
        }
        if (stepId === "plank") {
            formData.plankMax = parseInt(document.getElementById("plankMax").value);
            if (isNaN(formData.plankMax)) return error("Enter your plank hold.");
        }
        if (stepId === "mile") {
            formData.mile = document.getElementById("mileTime").value;
        }
        if (stepId === "run-duration") {
            formData.runDuration = document.getElementById("longestRunDuration").value;
        }
        if (stepId === "run-distance") {
            const val = document.getElementById("longestRunDistanceValue").value;
            const unit = document.getElementById("longestRunDistanceUnit").value;
            if (val) formData.runDistance = `${val} ${unit}`;
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
        if (lowerMsg.includes("9th birthday")) cleanMsg = "Training begins at age 9. Your time will come soon!";
        if (lowerMsg.includes("parent/guardian consent")) cleanMsg = "Safety first! Please have a parent review the disclaimer.";
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
        
        let age = 30;
        if (formData.dob) {
            const birth = new Date(formData.dob);
            if (!isNaN(birth.getTime())) {
                const now = new Date();
                age = now.getFullYear() - birth.getFullYear();
            }
        }
        
        let ageBandLabel = '';
        if (age >= 9 && age <= 12) ageBandLabel = 'Youth Beginner';
        else if (age >= 13 && age <= 15) ageBandLabel = 'Youth Intermediate';
        else if (age >= 16 && age <= 17) ageBandLabel = 'Youth Advanced';
        else ageBandLabel = 'Adult Standard';

        if (formData.focus.length > 0) {
            html += `<div class="summary-item"><div class="summary-label">Focus</div><div class="summary-value">${formData.focus.join(", ")}</div></div>`;
            html += `<div class="summary-item"><div class="summary-label">Age Band</div><div class="summary-value">${ageBandLabel}</div></div>`;
            html += `<div class="summary-item"><div class="summary-label">Safety Mode</div><div class="summary-value">Enabled</div></div>`;
        }
        if (formData.strengthGoals.length > 0) {
            html += `<div class="summary-item"><div class="summary-label">Strength Goals</div><div class="summary-value">${formData.strengthGoals.join(", ")}</div></div>`;
        }
        if (formData.pushVariation && formData.pushVariation !== "none") {
            const variName = getProgressionConfig('push', formData.pushVariation, formData.pushupMax || 0, 0);
            html += `<div class="summary-item"><div class="summary-label">Hardest Push</div><div class="summary-value">${variName}</div></div>`;
        }
        if (formData.pullVariation && formData.pullVariation !== "none") {
            const variName = getProgressionConfig('pull', formData.pullVariation, formData.pullupMax || 0, 0);
            html += `<div class="summary-item"><div class="summary-label">Hardest Pull</div><div class="summary-value">${variName}</div></div>`;
        }
        if (formData.squatVariation && formData.squatVariation !== "none") {
            const variName = getProgressionConfig('squat', formData.squatVariation, formData.squatMax || 0, 0);
            html += `<div class="summary-item"><div class="summary-label">Hardest Squat</div><div class="summary-value">${variName}</div></div>`;
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

    const pushProgressions = [
        { value: "none", name: "Cannot do one yet" },
        { value: "plank", name: "Plank (Floor)" },
        { value: "scapula", name: "Scapula Push-ups" },
        { value: "wall", name: "Wall Push-ups" },
        { value: "incline", name: "Incline Push-ups" },
        { value: "knee", name: "Knee Push-ups" },
        { value: "negatives", name: "Negative Push-ups" },
        { value: "regular", name: "Regular Push-ups" },
        { value: "wide", name: "Wide Push-ups" },
        { value: "diamond", name: "Diamond Push-ups" },
        { value: "tricep", name: "Tricep Extensions" },
        { value: "exploding", name: "Power Push-ups" },
        { value: "archer", name: "Archer Push-ups" },
        { value: "one-arm-archer", name: "One-Arm Archer Push-ups" },
        { value: "pike", name: "PIKE PUSH UP" }
    ];

    const pullProgressions = [
        { value: "none", name: "Cannot do one yet" },
        { value: "dead-hang", name: "Dead Hang" },
        { value: "scapula", name: "Scapular Pull-ups" },
        { value: "active-hang", name: "Active Hang" },
        { value: "negatives", name: "Negative Pull-ups" },
        { value: "assisted", name: "Band-Assisted Pull-ups" },
        { value: "regular", name: "Regular Pull-ups" },
        { value: "wide", name: "Wide Pull-ups" },
        { value: "archer", name: "Archer Pull-ups" },
        { value: "weighted", name: "Weighted Pull-ups" }
    ];

    const squatProgressions = [
        { value: "none", name: "Cannot do one yet" },
        { value: "assisted", name: "Assisted Squats" },
        { value: "box", name: "Box Squats" },
        { value: "regular", name: "Regular Bodyweight Squats" },
        { value: "split", name: "Split Squats / Lunges" },
        { value: "bulgarian", name: "Bulgarian Split Squats" },
        { value: "pistol-assisted", name: "Assisted Pistol Squats" },
        { value: "pistol", name: "Pistol Squats" }
    ];

    function getProgressionConfig(type, baseValue, maxReps, weekOffset = 0) {
        const list = type === 'push' ? pushProgressions : type === 'pull' ? pullProgressions : squatProgressions;
        let idx = list.findIndex(x => x.value === baseValue);
        if (idx === -1) {
            // Try to find by name if value doesn't match
            idx = list.findIndex(x => x.name.toLowerCase().includes(baseValue.toLowerCase()));
        }
        if (idx === -1) idx = 1; 
        
        if (maxReps < 2 && idx > 1) {
            idx -= 1;
        }

        idx = Math.min(idx + weekOffset, list.length - 1);
        return list[idx] ? list[idx].name : "Regular Exercise";
    }

    function generateScientificPlan() {
        if (formData.focus.length === 0) return null;

        const weeks = [];
        const sessionNames = {
            'Day A': { id: 'Day A', name: "The Push Path", goals: ["push"], goalDesc: "Chest, Shoulders & Triceps." },
            'Day B': { id: 'Day B', name: "The Pull Path", goals: ["pull"], goalDesc: "Back, Biceps & Core." },
            'Day C': { id: 'Day C', name: "The Leg Path", goals: ["squat"], goalDesc: "Quads, Glutes & Core." },
            'Day D': { id: 'Day D', name: "The Engine", goals: ["endurance"], goalDesc: "Steady Pace, Nose Breathing." },
            'Day E': { id: 'Day E', name: "Endurance Variation", goals: ["endurance"], goalDesc: "Intervals or Cross-training." },
            'Day F': { id: 'Day F', name: "Active Recovery", goals: ["mastery"], goalDesc: "Full body mobility and light movement." }
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

        let ageBand = 'adult_standard';
        let ageMaxSets = 4;
        let baseRest = 90; // compounds 75-120s, accessories 45-75s
        let ageRepCap = 15; // default max reps

        if (age >= 9 && age <= 12) {
            ageBand = 'youth_beginner';
            ageMaxSets = 2; // Keep working sets 1-3
            baseRest = 120;
        } else if (age >= 13 && age <= 15) {
            ageBand = 'youth_intermediate';
            ageMaxSets = 3; // 2-4 working sets
            baseRest = 90;
        } else if (age >= 16 && age <= 17) {
            ageBand = 'youth_advanced_youth';
            ageMaxSets = 4; // 2-4 working sets
            baseRest = 90;
        } else {
            ageBand = 'adult_standard';
            ageMaxSets = 4; // Adults tolerate more
            if (age >= 50) baseRest = 120;
        }

        let allowedDays = [];
        const hasEndurance = formData.focus.includes("endurance") || formData.focus.includes("cardio");
        const hasStrength = formData.focus.includes("strength");
        const hasFlexibility = formData.focus.includes("flexibility");

        // Pool all requested session types
        const strengthPool = [];
        if (formData.strengthGoals.includes("push") || hasStrength) strengthPool.push('Day A');
        if (formData.strengthGoals.includes("pull") || hasStrength) strengthPool.push('Day B');
        if (formData.strengthGoals.includes("squat") || hasStrength) strengthPool.push('Day C');
        
        const endurancePool = [];
        if (formData.enduranceType && formData.enduranceType.length > 0) {
            formData.enduranceType.forEach(type => {
                endurancePool.push({ id: 'Day D', subType: type });
            });
            // Ensure at least 2 days if they only picked 1 type
            if (endurancePool.length === 1) {
                endurancePool.push({ id: 'Day E', subType: `${formData.enduranceType[0]} (Intervals)` });
            } else {
                // If they picked multiple, just make the 2nd one Day E
                endurancePool[1].id = 'Day E';
            }
        } else if (hasEndurance) {
            endurancePool.push({ id: 'Day D', subType: 'Running' });
            endurancePool.push({ id: 'Day E', subType: 'Running (Intervals)' });
        }

        const recoveryPool = ['Day F'];

        // Combine into a master cycle
        const masterCycle = [...strengthPool, ...endurancePool, ...recoveryPool];
        const daysPerWeek = formData.daysPerWeek || 3;

        for (let w = 1; w <= 4; w++) {
            const isDeload = (w === 4);
            const isHighVolume = (w === 3);
            const workouts = [];

            // Calculate progression offset based on age
            // Young: +1 per week. Middle: +1 every 2 weeks. Older: +0.5 (rounded)
            let hypertrophyLevel = w - 1; 
            if (age >= 50) hypertrophyLevel = Math.floor((w - 1) * 0.3);
            else if (age >= 35) hypertrophyLevel = Math.floor((w - 1) * 0.6);

            // Determine which items from masterCycle belong to this week
            // If masterCycle is longer than daysPerWeek, we rotate
            const weekStartIndex = ((w - 1) * daysPerWeek) % masterCycle.length;
            
            for (let d = 0; d < daysPerWeek; d++) {
                const cycleItem = masterCycle[(weekStartIndex + d) % masterCycle.length];
                const sessionKey = typeof cycleItem === 'string' ? cycleItem : cycleItem.id;
                const session = { ...sessionNames[sessionKey] };
                
                if (typeof cycleItem === 'object' && cycleItem.subType) {
                    session.subType = cycleItem.subType;
                    session.name = `${cycleItem.subType.charAt(0).toUpperCase() + cycleItem.subType.slice(1)}`;
                }
                
                const workout = {
                    day: `Workout ${d + 1}`,
                    name: `${session.name}`,
                    duration: formData.sessionLength || 60,
                    description: session.goalDesc,
                    exercises: []
                };

                const eliteTempo = (ageBand === 'youth_beginner' || ageBand === 'youth_intermediate') ? "Smooth and controlled" : "2 sec down, 1s pause, explode up";
                const primerTempo = "Controlled, light movement";
                const repsInReserve = "Stop with 1-3 reps in reserve.";

                if (session.id === 'Day A') {
                    // THE PRIMER (Warmup includes mobility)
                    workout.exercises.push({ type: 'primer', name: "Arm Circles & Shoulder Rolls", sets: "2", reps: "10", note: "Forward and backward circles.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                    workout.exercises.push({ type: 'primer', name: "Wrist Rotations", sets: "2", reps: "10", note: "Roll wrists to prep joints.", rest: `${baseRest / 2}s`, tempo: primerTempo, loadMode: "normal" });
                    
                    // THE MASTERY MOVE
                    let baseVar = formData.pushVariation || "knee";
                    let maxReps = formData.pushupMax || 0;
                    // Progression every rotation if age fits
                    let weekOffset = (isDeload) ? 1 : 0; 
                    let exerciseName = getProgressionConfig('push', baseVar, maxReps, weekOffset);
                    
                    let repsVal = "8-12";
                    let setsVal = isHighVolume ? ageMaxSets : (isDeload ? 2 : Math.min(3, ageMaxSets));
                    let noteStr = `${repsInReserve} Focus on form.`;
                    let lMode = baseVar === 'negatives' ? 'assistance' : 'normal';

                    if (maxReps > 0 && maxReps < 6) {
                        repsVal = "4-6";
                        setsVal = ageMaxSets;
                        noteStr = `${repsInReserve} Power focus.`;
                    } else if (maxReps >= 6 && maxReps <= 15) {
                        repsVal = `${Math.max(4, maxReps - 2)}`;
                        noteStr = `${repsInReserve} Strength sets.`;
                    } else if (maxReps > 15) {
                        repsVal = `${ageRepCap}`;
                    }

                    workout.exercises.push({ type: 'mastery', name: exerciseName, sets: setsVal, reps: repsVal, note: noteStr, rest: "60-90s", tempo: eliteTempo, loadMode: lMode, goalLoad: lMode === 'assistance' ? "Use clean assistance" : "Bodyweight" });

                    // THE BUILDER: Skill-oriented Push exercises only
                    let builder1 = { name: "Incline Push-ups (Hands Elevated)", note: "Triceps and chest focus.", loadMode: "normal" };
                    let builder2 = { name: "Tricep Dips (Off a Chair)", note: "Tricep Isolation.", loadMode: "normal" };
                    
                    const hasWeights = formData.equipment && formData.equipment.includes("dumbbells");
                    
                    if (formData.pushSkill && formData.pushSkill.includes('hspu')) {
                        builder1 = { name: hasWeights ? "Dumbbell Overhead Press or PIKE PUSH UP" : "PIKE PUSH UP or Downward Dog Push-ups", note: "Shoulder strength for vertical push.", loadMode: hasWeights ? "added load" : "normal" };
                        builder2 = { name: "Plank Hold", note: "Build core and shoulder stability.", loadMode: "normal" };
                    } else if (formData.pushSkill && formData.pushSkill.includes('one-arm')) {
                        builder1 = { name: "Archer Push-ups or Wide Push-ups", note: "Unilateral strength focus.", loadMode: "normal" };
                        builder2 = { name: "Plank Shoulder Taps", note: "Anti-rotation core hold.", loadMode: "normal" };
                    }

                    workout.exercises.push({ type: 'builder', name: builder1.name, sets: Math.min(3, ageMaxSets), reps: `8-12`, note: builder1.note + " " + repsInReserve, rest: `${Math.max(45, baseRest - 30)}s`, tempo: eliteTempo, loadMode: builder1.loadMode, goalLoad: builder1.loadMode === "added load" ? "Select target weight" : "Bodyweight" });
                    workout.exercises.push({ type: 'builder', name: builder2.name, sets: Math.min(3, ageMaxSets), reps: `8-12`, note: builder2.note + " " + repsInReserve, rest: `${Math.max(45, baseRest - 30)}s`, tempo: eliteTempo, loadMode: builder2.loadMode, goalLoad: builder2.loadMode === "added load" ? "Select target weight" : "Bodyweight" });

                } else if (session.id === 'Day B') {
                    workout.exercises.push({ type: 'primer', name: "Shoulder Shrugs & Rolls", sets: "2", reps: "10", note: "Wake up the upper back.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                    
                    const hasBar = formData.equipment && formData.equipment.includes("pullup-bar");
                    const hasBands = formData.equipment && formData.equipment.includes("bands");
                    const hasWeights = formData.equipment && formData.equipment.includes("dumbbells");
                    
                    if (hasBar) {
                         workout.exercises.push({ type: 'primer', name: "Dead Hang or Scapula Pulls", sets: "2", reps: "10s", note: "Prep the grip.", rest: `${baseRest / 2}s`, tempo: primerTempo, loadMode: "normal" });
                    } else {
                         workout.exercises.push({ type: 'primer', name: "Prone Y-T-W Raises (Floor)", sets: "2", reps: "10", note: "Prep the mid back.", rest: `${baseRest / 2}s`, tempo: primerTempo, loadMode: "normal" });
                    }
                    
                    let baseVar = formData.pullVariation || "none";
                    let maxReps = formData.pullupMax || 0;
                    let weekOffset = (isDeload) ? 1 : 0;
                    let exerciseName = getProgressionConfig('pull', baseVar, maxReps, weekOffset);
                    
                    if (!hasBar) {
                        if (hasWeights) {
                            exerciseName = "Bent Over Dumbbell Rows";
                        } else if (hasBands) {
                            exerciseName = "Band Lat Pulldowns or Band Rows";
                        } else {
                            exerciseName = "Table/Australian Rows or Sliding Floor Pull-ups";
                        }
                    }
                    
                    let repsVal = "8-12";
                    let setsVal = isHighVolume ? ageMaxSets : (isDeload ? 2 : Math.min(3, ageMaxSets));
                    let noteStr = `${repsInReserve} Hold Still for 1s at the top.`;
                    let lMode = (baseVar === 'assisted' || baseVar === 'negatives') ? 'assistance' : 'normal';
                    
                    if (!hasBar && hasWeights) lMode = "added load";

                    if (maxReps > 0 && maxReps < 6) {
                        repsVal = "4-6"; 
                        setsVal = ageMaxSets; 
                        noteStr = `${repsInReserve} Clean form focus.`;
                    } else if (maxReps >= 6 && maxReps <= 15) { 
                        repsVal = `${Math.max(4, maxReps - 2)}`; 
                        noteStr = `${repsInReserve} Strength focus.`; 
                    } else if (maxReps > 15) { 
                        repsVal = `${ageRepCap}`; 
                    }

                    workout.exercises.push({ type: 'mastery', name: exerciseName, sets: setsVal, reps: repsVal, note: noteStr, rest: "60-90s", tempo: eliteTempo, loadMode: lMode, goalLoad: lMode === 'assistance' ? "Use clean assistance" : (lMode === 'added load' ? "Select target weight" : "Bodyweight") });

                    let builder1 = { name: "Negative/Eccentric Pull-ups or Rows", note: "Back Builder. Jump up and lower slowly.", loadMode: "normal" };
                    let builder2 = { name: "Bicep Curls", note: "Bicep Builder.", loadMode: hasWeights ? "added load" : (hasBands ? "added load" : "normal") };
                    
                    if (!hasBar) {
                         builder1 = { name: "Superman Holds or Bodyweight Reverse Flyes", note: "Upper back strength.", loadMode: "normal" };
                    }
                    
                    if (formData.pullSkill && formData.pullSkill.includes('muscle-up') && hasBar) {
                        builder1 = { name: "Band-Assisted Pull-ups (Smooth)", note: "Train the pulling strength for the transition.", loadMode: "assistance" };
                        builder2 = { name: "Tricep Dips (Bars or Chair)", note: "The top half of the movement.", loadMode: "normal" };
                    } else if (formData.pullSkill && formData.pullSkill.includes('one-arm-pull') && hasBar) {
                        builder1 = { name: "Uneven Pull-ups (One hand on towel)", note: "Unilateral vertical pull.", loadMode: "normal" };
                        builder2 = { name: "Active Hangs", note: "Lock off strength.", loadMode: "normal" };
                    }

                    workout.exercises.push({ type: 'builder', name: builder1.name, sets: Math.min(3, ageMaxSets), reps: `8-12`, note: builder1.note + " " + repsInReserve, rest: `${Math.max(45, baseRest - 30)}s`, tempo: eliteTempo, loadMode: builder1.loadMode, goalLoad: builder1.loadMode === "added load" ? "Select target weight" : "Bodyweight" });
                    workout.exercises.push({ type: 'builder', name: builder2.name, sets: Math.min(3, ageMaxSets), reps: `8-12`, note: builder2.note + " " + repsInReserve, rest: `${Math.max(45, baseRest - 30)}s`, tempo: eliteTempo, loadMode: builder2.loadMode, goalLoad: builder2.loadMode === "added load" ? "Select target weight" : "Bodyweight" });

                } else if (session.id === 'Day C') {
                    workout.exercises.push({ type: 'primer', name: "Deep Squat Hold (Use support if needed)", sets: "2", reps: "15s", note: "Sit deep, breathe easy.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                    workout.exercises.push({ type: 'primer', name: "Bodyweight Glute Bridges", sets: "2", reps: "10", note: "Squeeze glutes at top.", rest: `${baseRest / 2}s`, tempo: primerTempo, loadMode: "normal" });
                    
                    let baseVar = formData.squatVariation || "regular";
                    let maxReps = formData.squatMax || 0;
                    let weekOffset = (isDeload) ? 1 : 0;
                    let exerciseName = getProgressionConfig('squat', baseVar, maxReps, weekOffset);
                    
                    let repsVal = "8-12";
                    let setsVal = isHighVolume ? ageMaxSets : (isDeload ? 2 : Math.min(3, ageMaxSets));
                    let noteStr = `${repsInReserve} Focus on depth and control.`;
                    let lMode = (baseVar === 'assisted' || baseVar === 'pistol-assisted') ? 'assistance' : 'normal';
                    
                    if (maxReps > 0 && maxReps < 6) {
                        repsVal = "4-6";
                        setsVal = ageMaxSets;
                        noteStr = `${repsInReserve} Clean focus.`;
                    } else if (maxReps >= 6 && maxReps <= 15) {
                        repsVal = `${Math.max(4, maxReps - 2)}`;
                        noteStr = `${repsInReserve} Strength sets.`;
                    } else if (maxReps > 15) {
                        repsVal = `${ageRepCap}`;
                    }

                    workout.exercises.push({ type: 'mastery', name: exerciseName, sets: setsVal, reps: repsVal, note: noteStr, rest: "60-90s", tempo: eliteTempo, loadMode: lMode, goalLoad: lMode === 'assistance' ? "Use clean assistance" : "Bodyweight" });

                    const hasWeights = formData.equipment && formData.equipment.includes("dumbbells");
                    let builder1 = { name: "Box Step-Ups or Lunges", note: "Unilateral leg strength.", loadMode: hasWeights ? "added load" : "normal" };
                    let builder2 = { name: "Calf Raises (Off a step)", note: "Calf isolation.", loadMode: hasWeights ? "added load" : "normal" };

                    workout.exercises.push({ type: 'builder', name: builder1.name, sets: Math.min(3, ageMaxSets), reps: `8-12`, note: builder1.note + " " + repsInReserve, rest: `${Math.max(45, baseRest - 30)}s`, tempo: eliteTempo, loadMode: builder1.loadMode, goalLoad: builder1.loadMode === "added load" ? "Select target weight" : "Bodyweight" });
                    workout.exercises.push({ type: 'builder', name: builder2.name, sets: Math.min(3, ageMaxSets), reps: `8-12`, note: builder2.note + " " + repsInReserve, rest: `${Math.max(45, baseRest - 30)}s`, tempo: eliteTempo, loadMode: builder2.loadMode, goalLoad: builder2.loadMode === "added load" ? "Select target weight" : "Bodyweight" });

                } else if (session.id === 'Day D' || session.id === 'Day E') {
                    const eType = session.subType || "Running";
                    const isIntervals = session.id === 'Day E';
                    
                    workout.exercises.push({ type: 'primer', name: "Dynamic Leg Swings", sets: "1", reps: "10 per leg", note: "Forward/after and side-to-side.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                    workout.exercises.push({ type: 'primer', name: "High Knees in Place", sets: "1", reps: "30s", note: "Light and bouncy to prep for engine work.", rest: "None", tempo: primerTempo, loadMode: "normal" });

                    workout.exercises.push({ 
                        type: 'mastery',
                        name: isIntervals ? `Intervals: ${eType.charAt(0).toUpperCase() + eType.slice(1)}` : `The Engine: ${eType.charAt(0).toUpperCase() + eType.slice(1)}`, 
                        sets: isIntervals ? "4" : "1", 
                        reps: isIntervals ? "3 min" : (isHighVolume ? "60 min" : "40 min"), 
                        note: isIntervals ? "Hard effort for 3 minutes, active recovery for 2." : "Steady Pace, Nose Breathing. Easy Pace.", 
                        rest: isIntervals ? "2 min" : "Cooldown",
                        tempo: isIntervals ? "Fast / Vigorous" : "Steady State",
                        loadMode: "normal",
                        goalLoad: "N/A"
                    });
                } else if (session.id === 'Day F') {
                    workout.exercises.push({ type: 'primer', name: "Cat-Cow Stretch", sets: "1", reps: "10", note: "Flow with your breath. Spine mobility.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                    workout.exercises.push({ type: 'primer', name: "Hip Flexor Kneeling Stretch", sets: "1", reps: "60s per leg", note: "Tuck pelvis under gently.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                    workout.exercises.push({ type: 'primer', name: "Child's Pose", sets: "1", reps: "2 min", note: "Relax and focus on deep breathing.", rest: "None", tempo: primerTempo, loadMode: "normal" });
                }

                // Add Cooldown properly
                workout.exercises.push({
                    type: 'cooldown',
                    name: "Light Walk & Specific Stretching",
                    note: "Walk for 2 minutes to bring heart rate down. Then perform static stretches: standing quad stretch (30s/leg), toe touch/hamstring stretch (60s), and chest stretch against a doorway (30s).",
                    tempo: "Natural Flow",
                    sets: "1",
                    reps: "5-10 min",
                    rest: "None",
                    loadMode: "normal",
                    goalLoad: "N/A"
                });

                workout.exercises.forEach((ex, idx) => {
                    ex.id = `ex_${idx}`;
                    let setsDetails = [];
                    let numSets = parseInt(ex.sets, 10) || 1;
                    const baseRepsStr = ex.reps || "10";
                    const isTime = typeof baseRepsStr === "string" && (baseRepsStr.match(/^\d+\s*(s|min)$/)); 
                    let baseRepNum = parseInt(baseRepsStr, 10) || baseRepsStr;
                    const isHypertrophyMove = ex.type === 'mastery' || ex.type === 'builder';
                    
                    let currentRestStr = ex.rest || "60s";

                    if (isHypertrophyMove) {
                        // PROGRESSION STEP 1: Increase reps or hold time
                        if (hypertrophyLevel >= 1) {
                            if (typeof baseRepNum === "number") baseRepNum += 1;
                            else if (isTime && baseRepsStr.includes("s")) baseRepNum += 5;
                        }
                        // PROGRESSION STEP 2: Decrease rest
                        if (hypertrophyLevel >= 2) {
                            if (currentRestStr.includes("s") && !currentRestStr.includes("min")) {
                                let restSecs = parseInt(currentRestStr, 10);
                                if (restSecs > 30) currentRestStr = `${restSecs - 15}s`;
                            }
                        }
                        // PROGRESSION STEP 3: Add set (max 1 more)
                        if (hypertrophyLevel >= 3) {
                            numSets = Math.min(numSets + 1, ageMaxSets);
                        }
                        // Week 4 Deload Adjustment
                        if (isDeload) {
                             if (typeof baseRepNum === "number") baseRepNum = Math.max(1, Math.floor(baseRepNum * 0.7));
                             numSets = 2; // Fixed deload sets
                        }
                    }

                    for(let s=0; s < numSets; s++) {
                        let currentTarget = baseRepsStr;

                        if (isHypertrophyMove && !isTime && typeof baseRepNum === "number") {
                            currentTarget = baseRepNum.toString();
                        } else if (isHypertrophyMove && isTime && baseRepsStr.includes("s")) {
                            currentTarget = `${baseRepNum}s`;
                        }

                        setsDetails.push({ setNumber: s + 1, targetReps: currentTarget, rest: currentRestStr });
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
            activeDay: 'Workout 1' // Default to first workout of week
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

function calculateStreak(logs) {
    if (!logs || !logs.readiness || Object.keys(logs.readiness).length === 0) return 0;
    const dates = Object.keys(logs.readiness)
        .map(k => k.split("_")[0]) // extract date string
        .map(ds => new Date(ds))
        .filter(d => !isNaN(d.getTime()))
        .sort((a,b) => b.getTime() - a.getTime());
    
    if (dates.length === 0) return 0;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    let streak = 0;
    
    // Check if the most recent workout was today or yesterday
    const diffDays = Math.floor((today - dates[0]) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return 0; // Streak broken
    
    streak = 1;
    for (let i = 1; i < dates.length; i++) {
        const diff = Math.floor((dates[i-1] - dates[i]) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
            streak++;
        } else if (diff > 1) {
            break;
        }
    }
    return streak;
}

async function loadDashboardData() {
    // Local static data loading
    const plan = getLocalPlan();
    const user = getUser();
    const logs = JSON.parse(localStorage.getItem('fitnessplan_logs')) || { readiness: {}, reps: {} };
    
    const data = {
        ok: true,
        user: user,
        plan: plan,
        streak: calculateStreak(logs),
        logs: logs
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
    const recordsBox = document.getElementById("recordsBox");

    if (recordsBox && data.plan && data.plan.formData) {
        const fd = data.plan.formData;
        let html = '';
        if (fd.pushupMax) html += `<div class="info-card"><div class="info-label">Max Push-ups</div><div class="info-value">${fd.pushupMax}</div></div>`;
        if (fd.pullupMax) html += `<div class="info-card"><div class="info-label">Max Pull-ups</div><div class="info-value">${fd.pullupMax}</div></div>`;
        if (fd.squatMax) html += `<div class="info-card"><div class="info-label">Max Squats</div><div class="info-value">${fd.squatMax}</div></div>`;
        if (fd.plankMax) html += `<div class="info-card"><div class="info-label">Plank Hold</div><div class="info-value">${fd.plankMax}s</div></div>`;
        if (fd.wallSit) html += `<div class="info-card"><div class="info-label">Wall Sit</div><div class="info-value">${fd.wallSit}s</div></div>`;
        if (fd.mile) html += `<div class="info-card" style="border: 1px solid #10b981; background: rgba(16,185,129,0.05);"><div class="info-label" style="color: #10b981;">Best Mile</div><div class="info-value" style="color: #fff;">${fd.mile}</div></div>`;
        
        if (html) {
            recordsBox.innerHTML = html;
        } else {
            recordsBox.innerHTML = `<div class="empty-box">No key records recorded.</div>`;
        }
    }

    if (data.plan && data.plan.weeks) {
        const weekWorkouts = data.plan.weeks[0].workouts;
        
        // Render Day Picker
        if (dayPickerContainer) {
            
            dayPickerContainer.innerHTML = weekWorkouts.map(w => {
                const dateKey = new Date().toDateString() + "_" + w.day;
                const isDone = data.logs && data.logs.readiness && data.logs.readiness[dateKey] ? '<span style="color:#10b981; margin-left:4px;">✔</span>' : '';
                return `
                    <button class="day-tab ${data.plan.activeDay === w.day ? 'active' : ''}" data-day="${w.day}">
                        ${w.day} ${isDone}
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
                    <div style="margin-bottom: 32px; border-left: 2px solid #3b82f6; padding-left: 16px;">
                        <h3 style="color: #60a5fa; margin-bottom: 16px; font-size: 1.25rem;">Week ${w.week} ${w.week === 4 ? '(Deload & Next Progression Intro)' : ''}</h3>
                        <div class="week-grid" style="display: flex; flex-direction: column; gap: 20px;">
                            ${w.workouts.map(wk => renderReadOnlyWorkoutHTML(wk)).join("")}
                        </div>
                    </div>
                `).join("");
            }
        }

    } else if (todayBox) {
        todayBox.innerHTML = `<div class="empty-box">Go to the <a href="./index.html" style="color: #60a5fa;">Planner</a> to start.</div>`;
    }
}

function renderReadOnlyWorkoutHTML(workout) {
    if (!workout) return '';

    const warmup = workout.exercises.filter(ex => ex.type === 'primer');
    const mainWork = workout.exercises.filter(ex => ex.type === 'mastery' || ex.type === 'builder');
    const cooldown = workout.exercises.filter(ex => ex.type === 'cooldown');

    function renderSection(title, exercises) {
        if (!exercises || exercises.length === 0) return '';
        return `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #fff; font-size: 1.1rem; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 12px;">${title}</h4>
                ${exercises.map(ex => `
                    <div class="exercise-card" style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                        <div class="exercise-name" style="font-size: 1.05rem; font-weight: bold; color: #fff;">${ex.name}</div>
                        <div class="exercise-note" style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 8px;">${ex.note}</div>
                        <div class="sets-wrapper" style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #64748b; font-weight: bold; text-transform: uppercase; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px;">
                                <div style="flex: 1;">Set</div>
                                <div style="flex: 1.5; text-align: center;">Tempo</div>
                                <div style="flex: 1; text-align: center;">Target</div>
                                <div style="flex: 1; text-align: center;">Load/Ast.</div>
                                <div style="flex: 1; text-align: center;">Rest</div>
                            </div>
                            ${ex.setDetails.map(set => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                                    <div style="flex: 1; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">${set.setNumber}</div>
                                    <div style="flex: 1.5; text-align: center; color: #cbd5e1; font-size: 0.85rem;">${ex.tempo || '-'}</div>
                                    <div style="flex: 1; text-align: center; color: #60a5fa; font-weight: bold; font-size: 0.85rem;">${set.targetReps}</div>
                                    <div style="flex: 1; text-align: center; color: #cbd5e1; font-size: 0.85rem;">${ex.loadMode === 'normal' ? 'Bodyweight' : (ex.goalLoad || '-')}</div>
                                    <div style="flex: 1; text-align: center; color: #cbd5e1; font-size: 0.85rem;">${set.rest}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="today-card" style="margin-top: 0; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
            <div class="day-top" style="margin-bottom: 16px;">
                <div>
                    <div class="day-label" style="font-size: 1.2rem; font-weight: bold; color: #fff;">${workout.day}: ${workout.name}</div>
                    <div class="day-title" style="color: #94a3b8; font-size: 0.9rem;">${workout.description}</div>
                </div>
            </div>
            <div class="workout-content">
                ${renderSection('Warm-up', warmup)}
                ${renderSection('Main Work', mainWork)}
                ${renderSection('Cooldown', cooldown)}
            </div>
        </div>
    `;
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
    const cooldown = workout.exercises.filter(ex => ex.type === 'cooldown');

    function renderSection(title, exercises) {
        if (!exercises || exercises.length === 0) return '';
        return `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 16px;">${title}</h3>
                ${exercises.map(ex => `
                    <div class="exercise-card" data-type="${ex.type}" style="margin-bottom: 16px; padding: 20px;">
                        <div class="exercise-header" style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div class="exercise-name" style="font-size: 1.15rem;">${ex.name}</div>
                            <select class="load-ast-selector" data-ex="${ex.id}" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 6px 12px; color: #10b981; font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; text-align-last: center;" ${!isReady ? 'disabled' : ''}>
                                <option value="normal" ${ex.loadMode === 'normal' ? 'selected' : ''}>Bodyweight</option>
                                <option value="added load" ${ex.loadMode === 'added load' ? 'selected' : ''}>Added Load</option>
                                <option value="assistance" ${ex.loadMode === 'assistance' ? 'selected' : ''}>Assistance</option>
                            </select>
                        </div>
                        <div class="exercise-note" style="margin-bottom: 16px; color: #94a3b8; font-size: 0.9rem;">${ex.note}</div>
                        
                        <div class="sets-wrapper" style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
                                <div style="flex: 1;">Set</div>
                                <div style="flex: 1.5; text-align: center;">Tempo</div>
                                <div style="flex: 1; text-align: center;">Goal Reps</div>
                                <div style="flex: 1.5; text-align: center;">Load Goal</div>
                                <div style="flex: 1; text-align: center;">Target Rest</div>
                                <div style="flex: 1.5; text-align: right;">Actual (Load & Reps)</div>
                            </div>
                            
                            ${ex.setDetails.map(set => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
                                    <div style="flex: 1; color: #94a3b8; font-weight: 600; font-size: 0.95rem;">${set.setNumber}</div>
                                    <div style="flex: 1.5; text-align: center; color: #cbd5e1; font-size: 0.85rem;">${ex.tempo || '-'}</div>
                                    <div style="flex: 1; text-align: center; color: #60a5fa; font-weight: bold; font-size: 0.95rem;">${set.targetReps}</div>
                                    <div style="flex: 1.5; text-align: center; color: #cbd5e1; font-size: 0.85rem;" class="load-goal-display" data-ex="${ex.id}">${ex.loadMode === 'normal' ? 'Bodyweight' : (ex.goalLoad || '-')}</div>
                                    <div style="flex: 1; text-align: center; color: #cbd5e1; font-size: 0.85rem;">${set.rest}</div>
                                    <div style="flex: 1.5; text-align: right; display: flex; gap: 4px; justify-content: flex-end;">
                                        <input type="text" class="actual-load-input" data-ex="${ex.id}" data-set="${set.setNumber}" 
                                            value="${dataLogs.reps[dateKey] && dataLogs.reps[dateKey][ex.id] && dataLogs.reps[dateKey][ex.id][set.setNumber + '_load'] ? (dataLogs.reps[dateKey][ex.id][set.setNumber + '_load'] || '') : ''}"
                                            placeholder="${ex.loadMode === 'assistance' ? 'Assigned' : 'Weight'}" 
                                            style="display: ${(ex.loadMode && ex.loadMode !== 'normal') ? 'inline-block' : 'none'}; width: 60px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 6px; color: #10b981; text-align: center; font-size: 0.85rem; outline: none;"
                                            ${(ex.loadMode && ex.loadMode !== 'normal') ? 'required' : ''}
                                            ${!isReady ? 'disabled' : ''}>
                                        <input type="text" class="actual-rep-input" data-ex="${ex.id}" data-set="${set.setNumber}" 
                                            value="${dataLogs.reps[dateKey] && dataLogs.reps[dateKey][ex.id] ? (dataLogs.reps[dateKey][ex.id][set.setNumber] || '') : ''}"
                                            placeholder="Reps" 
                                            style="width: 50px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 6px; color: #fff; text-align: center; font-size: 0.85rem; outline: none;"
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

    // Set up dynamic inputs based on load-ast-selector
    container.querySelectorAll(".load-ast-selector").forEach(sel => {
        sel.addEventListener("change", (e) => {
            const exId = e.target.dataset.ex;
            const val = e.target.value;
            const loadInputs = container.querySelectorAll(`input.actual-load-input[data-ex="${exId}"]`);
            loadInputs.forEach(inp => {
                 if (val === 'normal') {
                     inp.style.display = 'none';
                     inp.required = false;
                 } else {
                     inp.style.display = 'inline-block';
                     inp.required = true;
                     inp.placeholder = val === 'assistance' ? 'Assigned' : 'Weight';
                 }
            });
            const displayTargets = container.querySelectorAll(`.load-goal-display[data-ex="${exId}"]`);
            displayTargets.forEach(el => {
                if (val === 'normal') el.innerText = 'Bodyweight';
                else if (val === 'assistance') el.innerText = 'Use clean assistance';
                else if (val === 'added load') el.innerText = 'Select target weight';
            });
            // Update plan in memory so it persists? Not necessarily requested but good if saved
        });
    });

    // Event Listeners
    if (!isReady && workout.exercises.length > 0) {
        document.getElementById("unlockBtn").addEventListener("click", () => {
            const sleepVal = parseInt(document.getElementById("sleepVal").value, 10);
            const energyVal = parseInt(document.getElementById("energyVal").value, 10);
            const nutriVal = parseInt(document.getElementById("nutriVal").value, 10);

            dataLogs.readiness[dateKey] = true;
            localStorage.setItem("fitnessplan_logs", JSON.stringify(dataLogs));
            
            const wc = container.querySelector(".workout-content");
            wc.style.opacity = "1";
            wc.style.pointerEvents = "auto";
            wc.style.filter = "none";
            container.querySelector(".readiness-card").style.display = "none";
            container.querySelectorAll("input.actual-rep-input").forEach(inp => inp.disabled = false);
            container.querySelectorAll("input.actual-load-input").forEach(inp => inp.disabled = false);

            if (sleepVal + energyVal + nutriVal < 8 || sleepVal < 2 || energyVal < 2) {
                // Low readiness / overload
                const alertDiv = document.createElement("div");
                alertDiv.style.padding = "16px";
                alertDiv.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
                alertDiv.style.border = "1px solid #ef4444";
                alertDiv.style.color = "#ef4444";
                alertDiv.style.borderRadius = "8px";
                alertDiv.style.marginBottom = "24px";
                alertDiv.innerHTML = "<strong>Overload Protection Active:</strong> You may be doing too much right now or have low readiness. Volume has been reduced for protection. Progression is paused until readiness and performance improve. Please skip all accessory (builder) exercises today and cut remaining sets by 1.";
                wc.insertBefore(alertDiv, wc.firstChild);

                // Auto-hide builder exercises to reduce volume
                const allExCards = container.querySelectorAll('.exercise-card[data-type="builder"]');
                allExCards.forEach(card => {
                    card.style.display = 'none';
                });
                
                // Cut remaining mastery sets by 1 via DOM hiding
                const masteryCards = container.querySelectorAll('.exercise-card[data-type="mastery"]');
                masteryCards.forEach(card => {
                    const sets = card.querySelectorAll('.sets-wrapper > div:nth-child(n+2)'); // First child is header
                    if (sets.length > 1) {
                         const lastSet = sets[sets.length - 1];
                         lastSet.style.display = 'none';
                         // Disable required inputs so form can submit or not break
                         lastSet.querySelectorAll('input').forEach(inp => inp.disabled = true);
                    }
                });
            } else if (sleepVal + energyVal + nutriVal > 12) {
                // High readiness
                const alertDiv = document.createElement("div");
                alertDiv.style.padding = "12px";
                alertDiv.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
                alertDiv.style.border = "1px solid #10b981";
                alertDiv.style.color = "#10b981";
                alertDiv.style.borderRadius = "8px";
                alertDiv.style.marginBottom = "24px";
                alertDiv.innerText = "High Readiness: You're fully recovered! Maintain clean technique and proceed with the planned session. Do not exceed safe targets.";
                wc.insertBefore(alertDiv, wc.firstChild);
            }
        });
    }

    // Auto-save reps and loads
    container.querySelectorAll("input.actual-rep-input, input.actual-load-input").forEach(inp => {
        inp.addEventListener("change", (e) => {
            const exId = e.target.dataset.ex;
            const setNum = e.target.dataset.set;
            const isLoad = e.target.classList.contains("actual-load-input");
            const val = e.target.value;
            
            if (!dataLogs.reps[dateKey]) dataLogs.reps[dateKey] = {};
            if (!dataLogs.reps[dateKey][exId]) dataLogs.reps[dateKey][exId] = {};
            
            if (isLoad) {
                dataLogs.reps[dateKey][exId][setNum + '_load'] = val;
            } else {
                dataLogs.reps[dateKey][exId][setNum] = val;
            }
            
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

// Fitness Tracker PWA - Main Application
const app = {
    db: null,
    currentExercise: null,
    currentWorkout: null,
    currentSets: [],
    currentSetIndex: 0,
    selectedDate: null, // New: track selected date

    // Initialize app
    async init() {
        await this.initDB();
        await this.seedExercises();
        this.selectedDate = new Date(); // Default to today
        this.loadHome();
        this.registerServiceWorker();
    },

    // Initialize IndexedDB
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FitnessTrackerDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Exercises store
                if (!db.objectStoreNames.contains('exercises')) {
                    const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
                    exerciseStore.createIndex('dayOfWeek', 'dayOfWeek', { unique: false });
                }

                // Workouts store
                if (!db.objectStoreNames.contains('workouts')) {
                    const workoutStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
                    workoutStore.createIndex('date', 'date', { unique: false });
                }

                // Sets store
                if (!db.objectStoreNames.contains('sets')) {
                    const setStore = db.createObjectStore('sets', { keyPath: 'id', autoIncrement: true });
                    setStore.createIndex('workoutId', 'workoutId', { unique: false });
                    setStore.createIndex('exerciseName', 'exerciseName', { unique: false });
                }
            };
        });
    },

    // Seed default exercises
    async seedExercises() {
        const count = await this.countRecords('exercises');
        if (count > 0) return;

        const exercises = [
            // Day 1 - Upper Chest + Delts
            { name: 'Incline Dumbbell Press', muscle: 'Upper Chest', dayOfWeek: 1, order: 0, sets: 4, reps: '8-10' },
            { name: 'Cable or DB Lateral Raises', muscle: 'Delts', dayOfWeek: 1, order: 1, sets: 4, reps: '12-15' },
            { name: 'Low-to-High Cable Fly', muscle: 'Upper Chest', dayOfWeek: 1, order: 2, sets: 3, reps: '12-15' },
            { name: 'Seated DB Shoulder Press', muscle: 'Delts', dayOfWeek: 1, order: 3, sets: 3, reps: '8-10' },
            { name: 'Lateral Raise Burnout', muscle: 'Delts', dayOfWeek: 1, order: 4, sets: 1, reps: 'AMRAP' },
            
            // Day 2 - Back + Abs
            { name: 'Pull-Ups or Lat Pulldown', muscle: 'Lats', dayOfWeek: 2, order: 0, sets: 4, reps: '8-10' },
            { name: 'Chest-Supported Row', muscle: 'Back', dayOfWeek: 2, order: 1, sets: 3, reps: '10-12' },
            { name: 'Single-Arm Cable Pulldown', muscle: 'Lats', dayOfWeek: 2, order: 2, sets: 3, reps: '12 per side' },
            { name: 'Weighted Cable Crunch', muscle: 'Abs', dayOfWeek: 2, order: 3, sets: 4, reps: '10-15' },
            { name: 'Hanging Leg Raises', muscle: 'Abs', dayOfWeek: 2, order: 4, sets: 2, reps: 'AMRAP' },
            
            // Day 3 - Legs
            { name: 'Bulgarian Split Squat', muscle: 'Legs', dayOfWeek: 3, order: 0, sets: 3, reps: '8 per leg' },
            { name: 'Romanian Deadlift', muscle: 'Hamstrings', dayOfWeek: 3, order: 1, sets: 3, reps: '8-10' },
            { name: 'Leg Press (feet high)', muscle: 'Legs', dayOfWeek: 3, order: 2, sets: 3, reps: '12' },
            { name: 'Standing Calf Raises', muscle: 'Calves', dayOfWeek: 3, order: 3, sets: 3, reps: '12-15' },
            
            // Day 4 - Shoulders + Arms
            { name: 'Cable Lateral Raises', muscle: 'Delts', dayOfWeek: 4, order: 0, sets: 4, reps: '12-15' },
            { name: 'EZ Bar or DB Curl', muscle: 'Biceps', dayOfWeek: 4, order: 1, sets: 3, reps: '8-10' },
            { name: 'Rope Tricep Pushdown', muscle: 'Triceps', dayOfWeek: 4, order: 2, sets: 3, reps: '10-12' },
            { name: 'Rear Delt Fly', muscle: 'Rear Delts', dayOfWeek: 4, order: 3, sets: 3, reps: '12-15' },
            { name: 'Hammer Curl + OH Tricep', muscle: 'Arms', dayOfWeek: 4, order: 4, sets: 2, reps: '12 (superset)' },
            
            // Day 5 - Chest + Back
            { name: 'Flat DB Press', muscle: 'Chest', dayOfWeek: 5, order: 0, sets: 3, reps: '10' },
            { name: 'Seated Cable Row', muscle: 'Back', dayOfWeek: 5, order: 1, sets: 3, reps: '12' },
            { name: 'Incline Push-Ups', muscle: 'Chest', dayOfWeek: 5, order: 2, sets: 3, reps: 'AMRAP' },
            { name: 'Straight-Arm Pulldown', muscle: 'Lats', dayOfWeek: 5, order: 3, sets: 3, reps: '12-15' },
            { name: 'Plank Hold', muscle: 'Core', dayOfWeek: 5, order: 4, sets: 3, reps: '45 sec' }
        ];

        for (const exercise of exercises) {
            await this.addRecord('exercises', exercise);
        }
    },

    // Database helpers
    addRecord(storeName, record) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    getRecords(storeName, indexName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let request;

            if (indexName && key !== undefined) {
                const index = store.index(indexName);
                request = index.getAll(key);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    countRecords(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Load home screen
    async loadHome() {
        const today = this.selectedDate;
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        
        // Update header
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayNames = ['Rest', 'Upper Chest + Delts', 'Back + Abs', 'Legs', 'Shoulders + Arms', 'Chest + Back', 'Rest'];
        
        document.getElementById('today-title').textContent = days[dayOfWeek];
        document.getElementById('workout-subtitle').textContent = dayNames[dayOfWeek];

        // Show selected date if not today
        const dateDisplay = document.getElementById('selected-date');
        const actualToday = new Date();
        actualToday.setHours(0, 0, 0, 0);
        const selectedDay = new Date(today);
        selectedDay.setHours(0, 0, 0, 0);
        
        if (selectedDay.getTime() !== actualToday.getTime()) {
            dateDisplay.textContent = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            dateDisplay.style.display = 'block';
        } else {
            dateDisplay.textContent = '';
            dateDisplay.style.display = 'none';
        }

        // Rest day check
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            document.getElementById('exercises-list').innerHTML = `
                <div class="rest-day">
                    <div class="rest-icon">🛌</div>
                    <div class="rest-title">Rest Day</div>
                    <div class="rest-subtitle">Recovery is part of progress</div>
                </div>
            `;
            return;
        }

        // Get or create workout for selected date
        this.currentWorkout = await this.getWorkoutForDate(today, dayOfWeek);

        // Load exercises for this day
        const exercises = await this.getRecords('exercises', 'dayOfWeek', dayOfWeek);
        exercises.sort((a, b) => a.order - b.order);

        // Get completed sets
        const completedSets = await this.getRecords('sets', 'workoutId', this.currentWorkout.id);

        // Render exercises
        const listEl = document.getElementById('exercises-list');
        listEl.innerHTML = exercises.map(ex => {
            const exerciseSets = completedSets.filter(s => s.exerciseName === ex.name);
            const completed = exerciseSets.length >= ex.sets;
            const progress = `${exerciseSets.length}/${ex.sets}`;

            return `
                <div class="card card-clickable exercise-card" onclick="app.openExercise(${ex.id})">
                    <div class="status-dot ${completed ? 'completed' : ''}"></div>
                    <div class="exercise-info">
                        <div class="exercise-name">${ex.name}</div>
                        <div class="exercise-target">${ex.sets} × ${ex.reps}</div>
                    </div>
                    <div class="exercise-progress ${completed ? 'completed' : ''}">${progress}</div>
                    <div class="chevron">›</div>
                </div>
            `;
        }).join('');
    },

    // Get or create workout for specific date
    async getWorkoutForDate(date, dayOfWeek) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const targetTime = targetDate.getTime();

        // Check for existing workout on this date
        const workouts = await this.getRecords('workouts', 'date', targetTime);
        if (workouts.length > 0) {
            return workouts[0];
        }

        // Create new workout
        const workout = {
            date: targetTime,
            dayOfWeek: dayOfWeek,
            completed: false
        };
        const id = await this.addRecord('workouts', workout);
        return { id, ...workout };
    },

    // Get or create today's workout (kept for compatibility)
    async getTodaysWorkout(dayOfWeek) {
        return this.getWorkoutForDate(new Date(), dayOfWeek);
    },

    // Open exercise session
    async openExercise(exerciseId) {
        const exercises = await this.getRecords('exercises');
        this.currentExercise = exercises.find(ex => ex.id === exerciseId);

        // Load existing sets for this exercise
        const allSets = await this.getRecords('sets', 'workoutId', this.currentWorkout.id);
        const exerciseSets = allSets.filter(s => s.exerciseName === this.currentExercise.name);

        // Create sets array
        this.currentSets = [];
        for (let i = 1; i <= this.currentExercise.sets; i++) {
            const existing = exerciseSets.find(s => s.setNumber === i);
            if (existing) {
                this.currentSets.push(existing);
            } else {
                const lastWeight = await this.getLastWeight(this.currentExercise.name);
                this.currentSets.push({
                    setNumber: i,
                    exerciseName: this.currentExercise.name,
                    weight: lastWeight || 0,
                    reps: 0,
                    workoutId: this.currentWorkout.id
                });
            }
        }

        // Find first incomplete set
        this.currentSetIndex = this.currentSets.findIndex(s => !s.id || s.reps === 0);
        if (this.currentSetIndex === -1) this.currentSetIndex = 0;

        this.renderSession();
        this.switchScreen('session');
    },

    // Render workout session
    async renderSession() {
        document.getElementById('exercise-title').textContent = this.currentExercise.name;

        // Stats
        const lastWeight = await this.getLastWeight(this.currentExercise.name);
        const pb = await this.getPersonalBest(this.currentExercise.name);

        document.getElementById('last-weight').textContent = lastWeight 
            ? `Last: ${lastWeight}kg` 
            : 'Last: --';
        
        document.getElementById('personal-best').textContent = pb 
            ? `PB: ${pb.weight}kg × ${pb.reps}` 
            : 'PB: --';

        // Sets list
        const setsEl = document.getElementById('sets-list');
        setsEl.innerHTML = this.currentSets.map((set, idx) => {
            const isActive = idx === this.currentSetIndex;
            const isComplete = set.id && set.weight > 0 && set.reps > 0;
            const value = isComplete 
                ? `${set.weight}kg × ${set.reps}` 
                : 'Not started';

            return `
                <div class="set-row ${isActive ? 'active' : ''}" onclick="app.selectSet(${idx})">
                    <div class="set-number">${set.setNumber}</div>
                    <div class="set-details">
                        <div class="${isComplete ? 'set-value' : 'set-empty'}">${value}</div>
                    </div>
                    ${isComplete ? '<div class="set-check">✓</div>' : ''}
                </div>
            `;
        }).join('');

        // Add set button
        if (this.currentSets.length < this.currentExercise.sets + 2) {
            setsEl.innerHTML += `
                <button class="btn btn-add" onclick="app.addSet()">
                    <span style="font-size: 20px;">+</span>
                    <span>Add Set</span>
                </button>
            `;
        }

        // Update inputs
        this.updateInputs();
    },

    // Select a set
    selectSet(index) {
        this.currentSetIndex = index;
        this.updateInputs();
        this.renderSession();
    },

    // Update input fields
    updateInputs() {
        const currentSet = this.currentSets[this.currentSetIndex];
        document.getElementById('weight-input').value = currentSet.weight || '';
        document.getElementById('reps-input').value = currentSet.reps || '';
        
        // Update button state
        this.updateCompleteButton();
    },

    // Update complete button
    updateCompleteButton() {
        const weight = parseFloat(document.getElementById('weight-input').value) || 0;
        const reps = parseInt(document.getElementById('reps-input').value) || 0;
        const btn = document.getElementById('complete-btn');
        btn.disabled = weight === 0 || reps === 0;
    },

    // Complete current set
    async completeSet() {
        const weight = parseFloat(document.getElementById('weight-input').value);
        const reps = parseInt(document.getElementById('reps-input').value);

        if (!weight || !reps) return;

        const currentSet = this.currentSets[this.currentSetIndex];
        currentSet.weight = weight;
        currentSet.reps = reps;

        // Save to database
        if (currentSet.id) {
            // Update existing
            await this.updateSet(currentSet);
        } else {
            // Create new
            const id = await this.addRecord('sets', currentSet);
            currentSet.id = id;
        }

        // Move to next set
        if (this.currentSetIndex < this.currentSets.length - 1) {
            // Copy weight to next set
            this.currentSets[this.currentSetIndex + 1].weight = weight;
            this.currentSetIndex++;
        }

        this.renderSession();
    },

    // Add extra set
    async addSet() {
        const lastWeight = this.currentSets[this.currentSets.length - 1].weight;
        this.currentSets.push({
            setNumber: this.currentSets.length + 1,
            exerciseName: this.currentExercise.name,
            weight: lastWeight || 0,
            reps: 0,
            workoutId: this.currentWorkout.id
        });
        this.currentSetIndex = this.currentSets.length - 1;
        this.renderSession();
    },

    // Update set in database
    updateSet(set) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sets'], 'readwrite');
            const store = transaction.objectStore('sets');
            const request = store.put(set);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Get last weight for exercise
    async getLastWeight(exerciseName) {
        const sets = await this.getRecords('sets', 'exerciseName', exerciseName);
        if (sets.length === 0) return null;
        
        // Sort by workout date (most recent first)
        sets.sort((a, b) => b.workoutId - a.workoutId);
        return sets[0].weight;
    },

    // Get personal best
    async getPersonalBest(exerciseName) {
        const sets = await this.getRecords('sets', 'exerciseName', exerciseName);
        if (sets.length === 0) return null;

        // Find max volume (weight × reps)
        const best = sets.reduce((max, set) => {
            const volume = set.weight * set.reps;
            const maxVolume = max.weight * max.reps;
            return volume > maxVolume ? set : max;
        });

        return best;
    },

    // Save and exit
    async saveAndExit() {
        this.backToHome();
    },

    // Back to home
    async backToHome() {
        this.switchScreen('home');
        await this.loadHome();
    },

    // Switch screen
    switchScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`${screen}-screen`).classList.add('active');
    },

    // Switch tab
    async switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach((btn, idx) => {
            btn.classList.remove('active');
        });
        event.target.closest('.tab-button').classList.add('active');

        // Load content
        if (tab === 'home') {
            this.switchScreen('home');
            await this.loadHome();
        } else if (tab === 'history') {
            this.switchScreen('history');
            await this.loadHistory();
        } else if (tab === 'progress') {
            this.switchScreen('progress');
        }
    },

    // Load history
    async loadHistory() {
        const workouts = await this.getRecords('workouts');
        workouts.sort((a, b) => b.date - a.date);

        // Calculate stats
        const now = Date.now();
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const monthAgo = now - (30 * 24 * 60 * 60 * 1000);

        const weekCount = workouts.filter(w => w.date >= weekAgo).length;
        const monthCount = workouts.filter(w => w.date >= monthAgo).length;

        document.getElementById('week-count').textContent = weekCount;
        document.getElementById('month-count').textContent = monthCount;

        // Render workouts
        const listEl = document.getElementById('history-list');

        if (workouts.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <div class="empty-title">No workouts yet</div>
                    <div class="empty-text">Complete your first workout to see it here</div>
                </div>
            `;
            return;
        }

        const dayNames = ['Rest', 'Upper Chest + Delts', 'Back + Abs', 'Legs', 'Shoulders + Arms', 'Chest + Back', 'Rest'];

        const historyHTML = await Promise.all(workouts.slice(0, 30).map(async workout => {
            const sets = await this.getRecords('sets', 'workoutId', workout.id);
            const uniqueExercises = new Set(sets.map(s => s.exerciseName)).size;
            const totalVolume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

            const date = new Date(workout.date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <div class="history-card">
                    <div class="history-header">
                        <div>
                            <div class="history-date">${dateStr}</div>
                            <div class="history-day">${dayNames[workout.dayOfWeek]}</div>
                        </div>
                        <div class="history-stats">
                            <div>${uniqueExercises} exercises</div>
                            <div>${sets.length} sets</div>
                        </div>
                    </div>
                    ${totalVolume > 0 ? `
                        <div class="history-volume">
                            <span>📊</span>
                            <span>${Math.round(totalVolume)}kg total</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }));

        listEl.innerHTML = historyHTML.join('');
    },

    // Register service worker
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }
    },

    // Date picker functions
    showDatePicker() {
        const modal = document.getElementById('date-modal');
        const input = document.getElementById('date-input');
        
        // Set input to current selected date
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        input.value = dateStr;
        
        modal.classList.add('active');
    },

    closeDatePicker() {
        document.getElementById('date-modal').classList.remove('active');
    },

    selectToday() {
        const input = document.getElementById('date-input');
        const today = new Date();
        input.value = today.toISOString().split('T')[0];
    },

    selectYesterday() {
        const input = document.getElementById('date-input');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        input.value = yesterday.toISOString().split('T')[0];
    },

    async applyDate() {
        const input = document.getElementById('date-input');
        if (!input.value) return;
        
        this.selectedDate = new Date(input.value + 'T12:00:00');
        this.closeDatePicker();
        await this.loadHome();
    }
};

// Input event listeners
document.addEventListener('DOMContentLoaded', () => {
    app.init();

    // Update button state on input
    const weightInput = document.getElementById('weight-input');
    const repsInput = document.getElementById('reps-input');

    weightInput?.addEventListener('input', () => app.updateCompleteButton());
    repsInput?.addEventListener('input', () => app.updateCompleteButton());

    // Focus weight input when panel appears
    const observer = new MutationObserver(() => {
        if (document.getElementById('session-screen').classList.contains('active')) {
            setTimeout(() => weightInput?.focus(), 300);
        }
    });

    observer.observe(document.getElementById('session-screen'), {
        attributes: true,
        attributeFilter: ['class']
    });
});

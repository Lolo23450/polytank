/**
 * Sector 7 Tactical Level Architect
 * Clean, visual level builder and live testbed for PolyTank.
 */
const LevelEditor = (() => {
    let editorOverlay = null;
    let selectedIndex = 0;
    let currentTab = 'properties'; // properties | waves | timeline | story | arena
    let isTesting = false;

    const AVAILABLE_ENEMIES = [
        { id: 'basic', name: 'Patrol Scout', color: '#f14e54', threat: 'Low' },
        { id: 'rammer', name: 'Rammer', color: '#fc7677', threat: 'Med' },
        { id: 'sniper', name: 'Marksman Railgun', color: '#ff4500', threat: 'High' },
        { id: 'shotgun', name: 'Shotgun Breacher', color: '#c542f5', threat: 'Med' },
        { id: 'shield_carrier', name: 'Shield Carrier', color: '#00d2d3', threat: 'High' },
        { id: 'trapper', name: 'Trapper Minelayer', color: '#708090', threat: 'Severe' },
        { id: 'hive', name: 'Fleet Hive Carrier', color: '#e056fd', threat: 'Severe' },
        { id: 'swarm_drone', name: 'Swarm Dart', color: '#ff7675', threat: 'Swarm' },
        { id: 'striker', name: 'Striker Assault Drone', color: '#006666', threat: 'Med' }
    ];

    function init() {
        injectStyles();
        buildDOM();
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'poly-editor-v2-styles';
        style.textContent = `
            #level-editor-screen {
                position: fixed;
                inset: 0;
                background: #090e17;
                color: #e2e8f0;
                font-family: 'Ubuntu', sans-serif;
                z-index: 600;
                display: none;
                flex-direction: row;
                box-sizing: border-box;
                overflow: hidden;
            }

            .ed-sidebar {
                width: 330px;
                background: #0f172a;
                border-right: 1px solid #1e293b;
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
            }

            .ed-brand-header {
                padding: 16px 20px;
                background: #0b1120;
                border-bottom: 1px solid #1e293b;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .ed-brand-header h2 {
                margin: 0;
                font-size: 15px;
                letter-spacing: 1.5px;
                font-weight: 700;
                color: #00d2d3;
                text-transform: uppercase;
            }

            .ed-level-list {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .ed-level-row {
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 10px;
                padding: 10px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .ed-level-row:hover {
                border-color: #00d2d3;
                background: #27354f;
            }

            .ed-level-row.active {
                border-color: #00d2d3;
                background: #142847;
                box-shadow: 0 0 16px rgba(0, 210, 211, 0.2);
            }

            .ed-level-row-title {
                font-size: 13px;
                font-weight: 700;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 170px;
            }

            .ed-level-row-sub {
                font-size: 10px;
                color: #94a3b8;
                letter-spacing: 0.5px;
                margin-top: 2px;
            }

            .ed-level-row-actions {
                display: flex;
                gap: 4px;
            }

            .ed-mini-btn {
                background: #0f172a;
                border: 1px solid #334155;
                color: #cbd5e1;
                border-radius: 4px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 11px;
                font-weight: 700;
                transition: all 0.1s;
            }

            .ed-mini-btn:hover {
                background: #334155;
                color: #fff;
            }

            .ed-mini-btn.del:hover {
                background: #ff4757;
                border-color: #ff4757;
                color: #fff;
            }

            .ed-workspace {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #090e17;
                min-width: 0;
            }

            .ed-top-toolbar {
                height: 58px;
                background: #0f172a;
                border-bottom: 1px solid #1e293b;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 24px;
                flex-shrink: 0;
            }

            .ed-tabs-group {
                display: flex;
                gap: 6px;
            }

            .ed-tab-pill {
                background: #1e293b;
                border: 1px solid #334155;
                color: #94a3b8;
                padding: 8px 16px;
                border-radius: 8px;
                font-family: inherit;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.5px;
                cursor: pointer;
                transition: all 0.15s;
            }

            .ed-tab-pill:hover {
                color: #ffffff;
                background: #28374d;
            }

            .ed-tab-pill.active {
                background: #00d2d3;
                color: #091322;
                border-color: #00d2d3;
            }

            .ed-scroll-panel {
                flex: 1;
                overflow-y: auto;
                padding: 24px 32px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .ed-card {
                background: #0f172a;
                border: 1px solid #1e293b;
                border-radius: 12px;
                padding: 20px 24px;
                position: relative;
            }

            .ed-card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                border-bottom: 1px solid #1e293b;
                padding-bottom: 10px;
            }

            .ed-card-title {
                font-size: 14px;
                font-weight: 700;
                color: #00d2d3;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin: 0;
            }

            .ed-grid-2 {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
            }

            .ed-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-bottom: 14px;
            }

            .ed-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #94a3b8;
            }

            .ed-input, .ed-select, .ed-textarea {
                background: #090e17;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 9px 12px;
                color: #ffffff;
                font-family: inherit;
                font-size: 13px;
                transition: border-color 0.15s;
                width: 100%;
                box-sizing: border-box;
            }

            .ed-input:focus, .ed-select:focus, .ed-textarea:focus {
                outline: none;
                border-color: #00d2d3;
                background: #0c1524;
            }

            .ed-btn {
                background: #1e293b;
                border: 1px solid #334155;
                color: #ffffff;
                padding: 8px 18px;
                border-radius: 8px;
                font-family: inherit;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.15s ease;
            }

            .ed-btn:hover {
                background: #334155;
            }

            .ed-btn.primary {
                background: #00d2d3;
                border-color: #00d2d3;
                color: #091322;
            }

            .ed-btn.primary:hover {
                background: #38efef;
                box-shadow: 0 0 14px rgba(0, 210, 211, 0.4);
            }

            .ed-btn.danger {
                color: #ff4757;
                border-color: rgba(255, 71, 87, 0.35);
            }

            .ed-btn.danger:hover {
                background: #ff4757;
                color: #ffffff;
            }

            .ed-chips-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 10px;
            }

            .ed-enemy-chip {
                background: #090e17;
                border: 2px solid #1e293b;
                border-radius: 8px;
                padding: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: all 0.15s ease;
                user-select: none;
            }

            .ed-enemy-chip.selected {
                border-color: #00d2d3;
                background: rgba(0, 210, 211, 0.08);
            }

            .ed-enemy-dot {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .ed-timeline-row {
                background: #090e17;
                border: 1px solid #1e293b;
                border-radius: 10px;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 8px;
                transition: all 0.15s;
            }

            .ed-timeline-row:hover {
                border-color: #334155;
            }

            .ed-time-badge {
                background: #1e293b;
                color: #ffd700;
                font-size: 12px;
                font-weight: 700;
                padding: 4px 8px;
                border-radius: 6px;
                min-width: 55px;
                text-align: center;
            }

            #ed-arena-canvas {
                background: #060912;
                border: 2px solid #1e293b;
                border-radius: 10px;
                display: block;
                width: 100%;
                height: 380px;
            }

            #playtest-banner {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 700;
                background: rgba(15, 23, 42, 0.95);
                border: 2px solid #00d2d3;
                color: white;
                padding: 10px 24px;
                border-radius: 30px;
                font-weight: 700;
                font-size: 13px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                display: none;
                align-items: center;
                gap: 16px;
            }
        `;
        document.head.appendChild(style);
    }

    function buildDOM() {
        editorOverlay = document.createElement('div');
        editorOverlay.id = 'level-editor-screen';
        editorOverlay.innerHTML = `
            <div class="ed-sidebar">
                <div class="ed-brand-header">
                    <h2>Sector Architect</h2>
                    <button class="ed-btn primary" style="padding:4px 10px; font-size:11px;" onclick="LevelEditor.addNewLevel()">+ New</button>
                </div>
                <div class="ed-level-list" id="ed-level-items"></div>
                <div style="padding:12px; border-top:1px solid #1e293b; display:flex; gap:8px; background:#0b1120;">
                    <button class="ed-btn" style="flex:1;" onclick="LevelEditor.exportJSON()">Export JSON</button>
                    <button class="ed-btn" style="flex:1;" onclick="LevelEditor.importJSONPrompt()">Import</button>
                </div>
            </div>

            <div class="ed-workspace">
                <div class="ed-top-toolbar">
                    <div class="ed-tabs-group">
                        <button class="ed-tab-pill active" id="tab-btn-properties" onclick="LevelEditor.setTab('properties')">Mission Blueprint</button>
                        <button class="ed-tab-pill" id="tab-btn-waves" onclick="LevelEditor.setTab('waves')">Spawns and Hostiles</button>
                        <button class="ed-tab-pill" id="tab-btn-timeline" onclick="LevelEditor.setTab('timeline')">Tactical Events</button>
                        <button class="ed-tab-pill" id="tab-btn-story" onclick="LevelEditor.setTab('story')">Dialogue and Briefings</button>
                        <button class="ed-tab-pill" id="tab-btn-arena" onclick="LevelEditor.setTab('arena')">Arena Map</button>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="ed-btn primary" onclick="LevelEditor.playtestCurrentLevel()">Playtest</button>
                        <button class="ed-btn danger" onclick="LevelEditor.close()">Exit</button>
                    </div>
                </div>

                <div class="ed-scroll-panel" id="ed-panel-body"></div>
            </div>

            <div id="playtest-banner">
                <span>SIMULATING: <b id="pt-lvl-name" style="color:#00d2d3;">Level</b></span>
                <button class="ed-btn primary" style="padding:5px 14px;" onclick="LevelEditor.stopPlaytest()">Return to Editor</button>
            </div>
        `;
        document.body.appendChild(editorOverlay);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                if (editorOverlay.style.display === 'flex') close();
                else open();
            }
        });
    }

    function open() {
        if (!LEVELS || LEVELS.length === 0) {
            alert('No levels loaded in session!');
            return;
        }
        if (state) state.active = false;
        editorOverlay.style.display = 'flex';
        renderLevelList();
        renderTab();
    }

    function close() {
        editorOverlay.style.display = 'none';
        if (isTesting) stopPlaytest();
        document.getElementById('menu-overlay').style.display = 'flex';
    }

    function renderLevelList() {
        const container = document.getElementById('ed-level-items');
        if (!container) return;
        container.innerHTML = '';

        LEVELS.forEach((lvl, idx) => {
            const row = document.createElement('div');
            row.className = `ed-level-row ${idx === selectedIndex ? 'active' : ''}`;
            row.innerHTML = `
                <div style="overflow:hidden;">
                    <div class="ed-level-row-title">${idx + 1}. ${lvl.name || 'Untitled'}</div>
                    <div class="ed-level-row-sub">Act ${lvl.act || 1} | ${(lvl.type || 'kill').toUpperCase()}</div>
                </div>
                <div class="ed-level-row-actions">
                    <button class="ed-mini-btn" title="Move Up" onclick="event.stopPropagation(); LevelEditor.moveLevel(${idx}, -1)">^</button>
                    <button class="ed-mini-btn" title="Move Down" onclick="event.stopPropagation(); LevelEditor.moveLevel(${idx}, 1)">v</button>
                    <button class="ed-mini-btn del" title="Delete" onclick="event.stopPropagation(); LevelEditor.deleteLevel(${idx})">x</button>
                </div>
            `;
            row.onclick = () => {
                selectedIndex = idx;
                renderLevelList();
                renderTab();
            };
            container.appendChild(row);
        });
    }

    function moveLevel(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= LEVELS.length) return;
        const temp = LEVELS[index];
        LEVELS[index] = LEVELS[target];
        LEVELS[target] = temp;
        selectedIndex = target;
        renderLevelList();
        renderTab();
    }

    function setTab(tab) {
        currentTab = tab;
        ['properties', 'waves', 'timeline', 'story', 'arena'].forEach(t => {
            const btn = document.getElementById(`tab-btn-${t}`);
            if (btn) btn.className = `ed-tab-pill ${t === tab ? 'active' : ''}`;
        });
        renderTab();
    }

    function renderTab() {
        const panel = document.getElementById('ed-panel-body');
        if (!panel) return;
        const lvl = LEVELS[selectedIndex];
        if (!lvl) {
            panel.innerHTML = '<div style="color:#94a3b8;">No sector selected.</div>';
            return;
        }

        if (currentTab === 'properties') renderPropertiesTab(panel, lvl);
        else if (currentTab === 'waves') renderWavesTab(panel, lvl);
        else if (currentTab === 'timeline') renderTimelineTab(panel, lvl);
        else if (currentTab === 'story') renderStoryTab(panel, lvl);
        else if (currentTab === 'arena') renderArenaTab(panel, lvl);
    }

    function renderPropertiesTab(target, lvl) {
        target.innerHTML = `
            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Sector Parameters and Objectives</h3>
                </div>
                <div class="ed-grid-2">
                    <div class="ed-field">
                        <label class="ed-label">Sector Name</label>
                        <input type="text" class="ed-input" value="${lvl.name || ''}" oninput="LevelEditor.updateField('name', this.value); LevelEditor.renderLevelList();">
                    </div>
                    <div class="ed-field">
                        <label class="ed-label">Sector Act Atmosphere</label>
                        <select class="ed-select" onchange="LevelEditor.updateField('act', parseInt(this.value)); LevelEditor.renderLevelList();">
                            <option value="1" ${lvl.act === 1 ? 'selected' : ''}>Act 1: Outpost Perimeter (Bright Clean)</option>
                            <option value="2" ${lvl.act === 2 ? 'selected' : ''}>Act 2: Sector 7 Cyber-Abyss (Deep Cyan)</option>
                            <option value="3" ${lvl.act === 3 ? 'selected' : ''}>Act 3: Autonomous Core (Molten Red)</option>
                        </select>
                    </div>
                </div>

                <div class="ed-grid-2">
                    <div class="ed-field">
                        <label class="ed-label">Objective Archetype</label>
                        <select class="ed-select" onchange="LevelEditor.updateField('type', this.value); LevelEditor.renderTab(); LevelEditor.renderLevelList();">
                            <option value="kill" ${lvl.type === 'kill' ? 'selected' : ''}>Elimination (Kill Count)</option>
                            <option value="time" ${lvl.type === 'time' ? 'selected' : ''}>Timed Survival (Seconds)</option>
                            <option value="shape" ${lvl.type === 'shape' ? 'selected' : ''}>Resource Rush (Shapes)</option>
                            <option value="boss" ${lvl.type === 'boss' ? 'selected' : ''}>Dreadnought Duel (Boss)</option>
                            <option value="hub" ${lvl.type === 'hub' ? 'selected' : ''}>Forward Safe Outpost (Hub)</option>
                            <option value="dialogue_cutscene" ${lvl.type === 'dialogue_cutscene' ? 'selected' : ''}>Cinematic Cutscene</option>
                        </select>
                    </div>
                    <div class="ed-field">
                        <label class="ed-label">Objective Goal (Kills / Seconds / Shapes)</label>
                        <input type="number" class="ed-input" value="${lvl.count || 10}" oninput="LevelEditor.updateField('count', parseInt(this.value) || 0)">
                    </div>
                </div>

                <div class="ed-field">
                    <label class="ed-label">HUD Objective Prompt</label>
                    <input type="text" class="ed-input" value="${lvl.objText || ''}" oninput="LevelEditor.updateField('objText', this.value)">
                </div>

                <div class="ed-grid-2">
                    <div class="ed-field">
                        <label class="ed-label">Combat Arena Boundary (Radius px)</label>
                        <input type="number" step="100" class="ed-input" value="${lvl.mapSize || 1800}" oninput="LevelEditor.updateField('mapSize', parseInt(this.value) || 1500)">
                    </div>
                    ${lvl.type === 'boss' ? `
                        <div class="ed-field">
                            <label class="ed-label">Dreadnought Boss Chassis</label>
                            <select class="ed-select" onchange="LevelEditor.updateField('boss', this.value)">
                                <option value="hexagon" ${lvl.boss === 'hexagon' ? 'selected' : ''}>Hexagon Guardian</option>
                                <option value="final" ${lvl.boss === 'final' ? 'selected' : ''}>The Destroyer Core</option>
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function renderWavesTab(target, lvl) {
        const pool = lvl.types || [];
        const spawnSec = ((lvl.spawnRate || 120) / 60).toFixed(1);

        target.innerHTML = `
            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Spawn Cadence and Reinforcement Speed</h3>
                </div>
                <div class="ed-field">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="ed-label">Reinforcement Interval: <b style="color:#00d2d3;">${spawnSec} seconds</b> (${lvl.spawnRate || 120} frames)</span>
                        <div style="display:flex; gap:6px;">
                            <button class="ed-btn" onclick="LevelEditor.adjustSpawnRate(-30)">Faster (-0.5s)</button>
                            <button class="ed-btn" onclick="LevelEditor.adjustSpawnRate(30)">Slower (+0.5s)</button>
                        </div>
                    </div>
                    <input type="range" min="30" max="600" step="15" value="${lvl.spawnRate || 120}" 
                           oninput="LevelEditor.updateField('spawnRate', parseInt(this.value)); LevelEditor.renderTab();">
                </div>
            </div>

            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Active Hostile Roster</h3>
                </div>
                <div class="ed-chips-grid">
                    ${AVAILABLE_ENEMIES.map(e => {
                        const isSelected = pool.includes(e.id);
                        return `
                            <div class="ed-enemy-chip ${isSelected ? 'selected' : ''}" onclick="LevelEditor.toggleEnemyPool('${e.id}')">
                                <div class="ed-enemy-dot" style="background:${e.color};"></div>
                                <div style="flex:1;">
                                    <div style="font-size:12px; font-weight:700; color:#fff;">${e.name}</div>
                                    <div style="font-size:10px; color:#94a3b8;">Threat: ${e.threat}</div>
                                </div>
                                <div style="font-size:13px; font-weight:700; color:${isSelected ? '#00d2d3' : '#475569'};">
                                    ${isSelected ? 'ACTIVE' : '+'}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function renderTimelineTab(target, lvl) {
        const events = lvl.events || [];

        target.innerHTML = `
            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Timeline Scripting (In Seconds)</h3>
                    <div style="display:flex; gap:6px;">
                        <button class="ed-btn primary" onclick="LevelEditor.addEvent('text')">+ Banner</button>
                        <button class="ed-btn primary" onclick="LevelEditor.addEvent('spawn_formation')">+ Formation</button>
                        <button class="ed-btn primary" onclick="LevelEditor.addEvent('spawn_shape')">+ Shapes</button>
                        <button class="ed-btn primary" onclick="LevelEditor.addEvent('shake')">+ Tremor</button>
                    </div>
                </div>

                <div id="ed-timeline-list">
                    ${events.length === 0 ? '<div style="color:#94a3b8; font-size:13px;">No scripted timeline cues configured for this sector.</div>' : ''}
                    ${events.map((ev, i) => {
                        const sec = (ev.frame / 60).toFixed(1);
                        return `
                            <div class="ed-timeline-row">
                                <div class="ed-time-badge">${sec}s</div>
                                <div style="width:120px;">
                                    <label class="ed-label" style="font-size:9px;">CUE TIME (SEC)</label>
                                    <input type="number" step="0.5" class="ed-input" value="${sec}" 
                                           oninput="LevelEditor.updateEventField(${i}, 'frame', Math.round((parseFloat(this.value) || 0) * 60))">
                                </div>
                                <div style="flex:1;">
                                    ${renderEventInputs(ev, i)}
                                </div>
                                <button class="ed-mini-btn del" title="Remove Cue" onclick="LevelEditor.removeEvent(${i})">x</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function renderEventInputs(ev, idx) {
        if (ev.type === 'text') {
            return `
                <div style="display:flex; gap:8px;">
                    <input type="text" class="ed-input" placeholder="Banner Announcement" value="${ev.message || ''}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'message', this.value)">
                    <input type="color" class="ed-input" style="width:50px; padding:2px;" value="${ev.color || '#ffd700'}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'color', this.value)">
                </div>
            `;
        } else if (ev.type === 'spawn_formation') {
            return `
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <select class="ed-select" style="width:140px;" onchange="LevelEditor.updateEventField(${idx}, 'formation', this.value)">
                        <option value="ring" ${ev.formation === 'ring' ? 'selected' : ''}>Equidistant Ring</option>
                        <option value="pincer" ${ev.formation === 'pincer' ? 'selected' : ''}>Pincer Ambush</option>
                        <option value="line" ${ev.formation === 'line' ? 'selected' : ''}>Horizontal Line</option>
                        <option value="corners" ${ev.formation === 'corners' ? 'selected' : ''}>Corner Quad</option>
                    </select>
                    <select class="ed-select" style="width:140px;" onchange="LevelEditor.updateEventField(${idx}, 'enemyType', this.value)">
                        ${AVAILABLE_ENEMIES.map(e => `<option value="${e.id}" ${ev.enemyType === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
                    </select>
                    <input type="number" class="ed-input" style="width:70px;" placeholder="Count" value="${ev.count || 4}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'count', parseInt(this.value) || 1)">
                    <input type="number" class="ed-input" style="width:80px;" placeholder="Radius" value="${ev.radius || 700}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'radius', parseInt(this.value) || 600)">
                </div>
            `;
        } else if (ev.type === 'spawn_shape') {
            return `
                <div style="display:flex; gap:8px; align-items:center;">
                    <select class="ed-select" style="width:140px;" onchange="LevelEditor.updateEventField(${idx}, 'shapeType', parseInt(this.value))">
                        <option value="0" ${Number(ev.shapeType || 0) === 0 ? 'selected' : ''}>Kinetic Squares</option>
                        <option value="1" ${Number(ev.shapeType || 0) === 1 ? 'selected' : ''}>Thruster Triangles</option>
                        <option value="2" ${Number(ev.shapeType || 0) === 2 ? 'selected' : ''}>Core Pentagons</option>
                    </select>
                    <input type="number" class="ed-input" style="width:70px;" placeholder="Count" value="${ev.count || 8}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'count', parseInt(this.value) || 1)">
                    <input type="number" class="ed-input" style="width:80px;" placeholder="Radius" value="${ev.radius || 360}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'radius', parseInt(this.value) || 300)">
                </div>
            `;
        } else if (ev.type === 'shake') {
            return `
                <div style="display:flex; gap:8px; align-items:center;">
                    <span class="ed-label">Tremor Intensity:</span>
                    <input type="number" class="ed-input" style="width:90px;" value="${ev.intensity || 14}" 
                           oninput="LevelEditor.updateEventField(${idx}, 'intensity', parseInt(this.value) || 5)">
                </div>
            `;
        }
        return '';
    }

    function renderStoryTab(target, lvl) {
        const intro = lvl.intro || [];
        const outro = lvl.outro || [];

        target.innerHTML = `
            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Opening Transmission Briefing</h3>
                    <button class="ed-btn primary" onclick="LevelEditor.addDialogue('intro')">+ Line</button>
                </div>
                ${intro.length === 0 ? '<div style="color:#94a3b8; font-size:13px;">No opening briefing dialogue.</div>' : ''}
                ${intro.map((d, i) => `
                    <div style="display:flex; gap:10px; margin-bottom:8px;">
                        <input type="text" class="ed-input" style="width:160px;" placeholder="Speaker" value="${d.who || 'Command'}" 
                               oninput="LevelEditor.updateDialogue('intro', ${i}, 'who', this.value)">
                        <input type="text" class="ed-input" style="flex:1;" placeholder="Transmission text..." value="${d.text || ''}" 
                               oninput="LevelEditor.updateDialogue('intro', ${i}, 'text', this.value)">
                        <button class="ed-mini-btn del" onclick="LevelEditor.removeDialogue('intro', ${i})">x</button>
                    </div>
                `).join('')}
            </div>

            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Victory Outro Transmission</h3>
                    <button class="ed-btn primary" onclick="LevelEditor.addDialogue('outro')">+ Line</button>
                </div>
                ${outro.length === 0 ? '<div style="color:#94a3b8; font-size:13px;">No completion dialogue configured.</div>' : ''}
                ${outro.map((d, i) => `
                    <div style="display:flex; gap:10px; margin-bottom:8px;">
                        <input type="text" class="ed-input" style="width:160px;" placeholder="Speaker" value="${d.who || 'Command'}" 
                               oninput="LevelEditor.updateDialogue('outro', ${i}, 'who', this.value)">
                        <input type="text" class="ed-input" style="flex:1;" placeholder="Debrief text..." value="${d.text || ''}" 
                               oninput="LevelEditor.updateDialogue('outro', ${i}, 'text', this.value)">
                        <button class="ed-mini-btn del" onclick="LevelEditor.removeDialogue('outro', ${i})">x</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderArenaTab(target, lvl) {
        target.innerHTML = `
            <div class="ed-card">
                <div class="ed-card-header">
                    <h3 class="ed-card-title">Tactical Minimap and Arena Layout</h3>
                    <span style="font-size:11px; color:#94a3b8;">Scale: Boundary +/-${lvl.mapSize || 1800}px</span>
                </div>
                <canvas id="ed-arena-canvas" width="800" height="380"></canvas>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:11px; color:#94a3b8;">
                    <div style="display:flex; gap:16px;">
                        <span><b style="color:#00d2d3;">[P]</b> Player Origin</span>
                        <span><b style="color:#f14e54;">(R)</b> Patrol Range</span>
                        <span><b style="color:#ffd700;">(*)</b> Timeline Formations</span>
                        ${lvl.type === 'hub' ? '<span><b style="color:#2ed573;">[H]</b> Outpost Runway / Proving Ground</span>' : ''}
                    </div>
                    <span>Adjust arena bounds in Mission Blueprint</span>
                </div>
            </div>
        `;

        requestAnimationFrame(() => drawArenaMinimap(lvl));
    }

    function drawArenaMinimap(lvl) {
        const c = document.getElementById('ed-arena-canvas');
        if (!c) return;
        const ctx = c.getContext('2d');
        const w = c.width;
        const h = c.height;

        ctx.clearRect(0, 0, w, h);

        const mapSize = lvl.mapSize || 1800;
        const cx = w / 2;
        const cy = h / 2;
        const scale = (Math.min(w, h) * 0.42) / mapSize;

        // Background grid lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();

        // Arena boundary
        const mapW = mapSize * 2 * scale;
        const mapH = mapSize * 2 * scale;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - mapW / 2, cy - mapH / 2, mapW, mapH);

        // Hub overlay
        if (lvl.type === 'hub') {
            if (lvl.firingRange) {
                const fr = lvl.firingRange;
                ctx.fillStyle = 'rgba(0, 210, 211, 0.12)';
                ctx.strokeStyle = '#00d2d3';
                ctx.lineWidth = 1.5;
                ctx.fillRect(cx + fr.x * scale, cy + fr.y * scale, fr.w * scale, fr.h * scale);
                ctx.strokeRect(cx + fr.x * scale, cy + fr.y * scale, fr.w * scale, fr.h * scale);
            }
            if (lvl.deployZone) {
                const dz = lvl.deployZone;
                ctx.fillStyle = 'rgba(46, 213, 115, 0.25)';
                ctx.strokeStyle = '#2ed573';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx + dz.x * scale, cy + dz.y * scale, 88 * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        // Render Initial Scripted Spawns
        if (lvl.initialSpawns && Array.isArray(lvl.initialSpawns)) {
            lvl.initialSpawns.forEach(sp => {
                if (sp.type === 'shape') {
                    const r = (sp.radius || 260) * scale;
                    ctx.strokeStyle = 'rgba(255, 232, 105, 0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.stroke();

                    const count = sp.count || 8;
                    ctx.fillStyle = '#ffe869';
                    for (let i = 0; i < count; i++) {
                        const a = (i / count) * Math.PI * 2;
                        ctx.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r - 2, 4, 4);
                    }
                } else if (sp.type === 'enemy') {
                    ctx.fillStyle = '#ff4757';
                    if (sp.x !== undefined && sp.y !== undefined) {
                        ctx.beginPath();
                        ctx.arc(cx + sp.x * scale, cy + sp.y * scale, 5, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        const r = (sp.radius || 500) * scale;
                        const count = sp.count || 3;
                        for (let i = 0; i < count; i++) {
                            const a = (i / count) * Math.PI * 2;
                            ctx.beginPath();
                            ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                } else if (sp.type === 'mine') {
                    ctx.fillStyle = 'rgba(255, 71, 87, 0.6)';
                    const count = sp.count || 12;
                    const r = (sp.radius || 600) * scale;
                    for (let i = 0; i < count; i++) {
                        const a = (i / count) * Math.PI * 2;
                        ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r - 1.5, 3, 3);
                    }
                }
            });
        }

        // Spawn perimeter guideline
        if (lvl.spawnRate > 0) {
            ctx.strokeStyle = 'rgba(241, 78, 84, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, 1200 * scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Timeline events
        if (lvl.events) {
            lvl.events.forEach(ev => {
                if (ev.type === 'spawn_formation') {
                    const r = (ev.radius || 700) * scale;
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.stroke();

                    const count = ev.count || 4;
                    ctx.fillStyle = '#ffd700';
                    for (let i = 0; i < count; i++) {
                        const a = (i / count) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            });
        }

        // Boss origin
        if (lvl.type === 'boss') {
            ctx.fillStyle = '#a55eea';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy - 900 * scale, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 10px Ubuntu';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText("BOSS", cx, cy - 900 * scale - 16);
        }

        // Player starting origin
        ctx.fillStyle = '#00d2d3';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function updateField(field, val) {
        if (!LEVELS[selectedIndex]) return;
        LEVELS[selectedIndex][field] = val;
    }

    function adjustSpawnRate(delta) {
        const lvl = LEVELS[selectedIndex];
        if (!lvl) return;
        lvl.spawnRate = Math.max(30, Math.min(600, (lvl.spawnRate || 120) + delta));
        renderTab();
    }

    function toggleEnemyPool(enemyId) {
        const lvl = LEVELS[selectedIndex];
        if (!lvl) return;
        if (!lvl.types) lvl.types = [];
        const idx = lvl.types.indexOf(enemyId);
        if (idx !== -1) {
            lvl.types.splice(idx, 1);
        } else {
            lvl.types.push(enemyId);
        }
        renderTab();
    }

    function addEvent(eventType) {
        const lvl = LEVELS[selectedIndex];
        if (!lvl) return;
        if (!lvl.events) lvl.events = [];

        let lastFrame = 0;
        if (lvl.events.length > 0) {
            lastFrame = Math.max(...lvl.events.map(e => e.frame || 0));
        }
        const nextFrame = lastFrame + 600;

        if (eventType === 'text') {
            lvl.events.push({ frame: nextFrame, type: 'text', message: 'HOSTILE VOLLEY DETECTED', color: '#ffd700' });
        } else if (eventType === 'spawn_formation') {
            lvl.events.push({ frame: nextFrame, type: 'spawn_formation', formation: 'ring', enemyType: 'basic', count: 6, radius: 700 });
        } else if (eventType === 'spawn_shape') {
            lvl.events.push({ frame: nextFrame, type: 'spawn_shape', shapeType: 0, count: 8, radius: 360 });
        } else if (eventType === 'shake') {
            lvl.events.push({ frame: nextFrame, type: 'shake', intensity: 14 });
        }

        lvl.events.sort((a, b) => a.frame - b.frame);
        renderTab();
    }

    function updateEventField(idx, field, val) {
        const lvl = LEVELS[selectedIndex];
        if (lvl && lvl.events && lvl.events[idx]) {
            lvl.events[idx][field] = val;
            if (field === 'frame') {
                lvl.events.sort((a, b) => a.frame - b.frame);
            }
            renderTab();
        }
    }

    function removeEvent(idx) {
        const lvl = LEVELS[selectedIndex];
        if (lvl && lvl.events) {
            lvl.events.splice(idx, 1);
            renderTab();
        }
    }

    function addDialogue(stage) {
        const lvl = LEVELS[selectedIndex];
        if (!lvl) return;
        if (!lvl[stage]) lvl[stage] = [];
        lvl[stage].push({ who: 'Command', text: 'New objective parameters confirmed.' });
        renderTab();
    }

    function updateDialogue(stage, idx, field, val) {
        const lvl = LEVELS[selectedIndex];
        if (lvl && lvl[stage] && lvl[stage][idx]) {
            lvl[stage][idx][field] = val;
        }
    }

    function removeDialogue(stage, idx) {
        const lvl = LEVELS[selectedIndex];
        if (lvl && lvl[stage]) {
            lvl[stage].splice(idx, 1);
            renderTab();
        }
    }

    function addNewLevel() {
        const newLvl = {
            name: `Sector ${LEVELS.length + 1}`,
            type: "kill",
            count: 15,
            act: 1,
            spawnRate: 120,
            types: ["basic", "rammer"],
            mapSize: 1800,
            objText: "Neutralize 15 hostiles in the grid",
            intro: [{ who: "Command", text: "Commencing sector sweep. Stay sharp." }]
        };
        LEVELS.push(newLvl);
        selectedIndex = LEVELS.length - 1;
        renderLevelList();
        renderTab();
    }

    function deleteLevel(idx) {
        if (LEVELS.length <= 1) {
            alert('Cannot delete the last remaining sector!');
            return;
        }
        if (confirm(`Delete level ${LEVELS[idx].name || 'Sector'}?`)) {
            LEVELS.splice(idx, 1);
            if (selectedIndex >= LEVELS.length) selectedIndex = LEVELS.length - 1;
            renderLevelList();
            renderTab();
        }
    }

    function playtestCurrentLevel() {
        isTesting = true;
        editorOverlay.style.display = 'none';
        document.getElementById('playtest-banner').style.display = 'flex';
        document.getElementById('pt-lvl-name').innerText = LEVELS[selectedIndex].name;
        document.getElementById('menu-overlay').style.display = 'none';

        if (!player) player = new Tank(0, 0, true);
        startLevel(selectedIndex);
    }

    function stopPlaytest() {
        isTesting = false;
        document.getElementById('playtest-banner').style.display = 'none';
        editorOverlay.style.display = 'flex';
        state.active = false;
        renderTab();
    }

    function exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(LEVELS, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "levels.json");
        dlAnchor.click();
    }

    function importJSONPrompt() {
        const raw = prompt("Paste your levels JSON array below:");
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error("Root must be a JSON array.");
            window.LEVELS = parsed;
            globalThis.LEVELS = parsed;
            selectedIndex = 0;
            renderLevelList();
            renderTab();
            alert(`Successfully loaded ${parsed.length} levels!`);
        } catch (e) {
            alert("Invalid JSON data: " + e.message);
        }
    }

    return {
        init,
        open,
        close,
        setTab,
        moveLevel,
        addNewLevel,
        deleteLevel,
        updateField,
        adjustSpawnRate,
        toggleEnemyPool,
        addEvent,
        updateEventField,
        removeEvent,
        addDialogue,
        updateDialogue,
        removeDialogue,
        playtestCurrentLevel,
        stopPlaytest,
        exportJSON,
        importJSONPrompt,
        renderLevelList,
        renderTab
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    LevelEditor.init();
});
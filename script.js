// --- Audio System (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'snap') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'run') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'fanfare') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.2);
        osc.frequency.setValueAtTime(659.25, now + 0.4);
        osc.frequency.setValueAtTime(880, now + 0.6);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        osc.start(now); osc.stop(now + 1.5);
    }
}

// --- Screen Management ---
const screenTop = document.getElementById('screen-top');
const screenGame = document.getElementById('screen-game');

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- Game State ---
const State = {
    currentCourse: 'A', // 'A', 'B', 'C'
    currentStage: 1,
    isDragging: false,
    dragType: 'none',
    trainProgress: 0,
    pathLength: 0,
    currentPathNode: null,
    trainNode: null,
    lastRunSoundTime: 0,
    isStepCompleted: false,
    stops: [],
    currentStopIndex: 0,
    waitingForTap: false,
    stations3: [],
    currentStationIndex3: 0,
    drawingLineNode: null,
    draggedShape: null,
    dragOffset: { x: 0, y: 0 },
    targetPos: { x: 400, y: 150 },
    initialAngle: 0,
    lastTrainDragPt: null,
    trailPath: null,

    // 共通設定
    railLength: 2,

    // コース情報
    maxStages: {
        'A': 11,
        'B': 11,
        'C': 10
    },

    // 矢印ナビゲーション用
    arrows: [],

    // 複数路線管理用（旧step4Lines）
    multiLines: [],
    activeLineIndex: -1,

    // 進捗管理用 (個別にどの面をクリアしたか保持する配列)
    progress: {
        'A': [],
        'B': [],
        'C': []
    },

    // 実績管理用 (メダル)
    achievements: {
        courseAClear: false,
        courseBClear: false,
        courseCClear: false,
        courseCClear: false,
        completeAll: false
    },

    // 設定：未クリアステージをロックするか
    lockUnclearedStages: false
};

// --- Progress & Achievements (LocalStorage) ---
function loadProgress() {
    try {
        const saved = localStorage.getItem('okojo_rail_progress_v2');
        if (saved) {
            const parsed = JSON.parse(saved);

            // 下位互換性のため、数値形式の進行データを配列に変換して読み込む
            if (parsed.progress) {
                for (const course of ['A', 'B', 'C']) {
                    if (typeof parsed.progress[course] === 'number') {
                        const maxStageNum = parsed.progress[course];
                        State.progress[course] = [];
                        for (let i = 1; i <= maxStageNum; i++) {
                            State.progress[course].push(i);
                        }
                    } else if (Array.isArray(parsed.progress[course])) {
                        State.progress[course] = parsed.progress[course];
                    }
                }
            }

            State.achievements = { ...State.achievements, ...(parsed.achievements || {}) };
            if (typeof parsed.lockUnclearedStages !== 'undefined') {
                State.lockUnclearedStages = parsed.lockUnclearedStages;
            }
        }
    } catch (e) {
        console.error('Failed to load progress:', e);
    }
}

function saveProgress() {
    try {
        const data = {
            progress: State.progress,
            achievements: State.achievements,
            lockUnclearedStages: State.lockUnclearedStages
        };
        localStorage.setItem('okojo_rail_progress_v2', JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save progress:', e);
    }
}

// --- DOM Elements ---
const svg = document.getElementById('game-svg');
const layerRails = document.getElementById('layer-rails');
const layerActive = document.getElementById('layer-active');
const layerTrain = document.getElementById('layer-train');
const instructionText = document.getElementById('instruction-text');
const stepIndicator = document.getElementById('step-indicator');
const btnHome = document.getElementById('btn-home');

// --- Initialization ---
const roundIndicator = document.getElementById('round-indicator');
const clearOverlay = document.getElementById('clear-overlay');
const clearMessage = document.getElementById('clear-message');
const clearProgress = document.getElementById('clear-progress');
const btnContinue = document.getElementById('btn-continue');
const btnBackTop = document.getElementById('btn-back-top');
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnSettingsClose = document.getElementById('btn-settings-close');

function init() {
    loadProgress(); // 変更: loadAchievements()から変更

    // コースCのロック判定
    updateCourseCLockUI();

    renderAchievements();

    // コースカード
    document.querySelectorAll('.course-card').forEach(card => {
        card.addEventListener('click', () => {
            initAudio();
            const course = card.dataset.course;

            // コースCのロックチェック（設定がオンで、かつAとBのそれぞれ[1〜5]がすべてクリアされている場合のみアンロック、それ以外はロック）
            if (course === 'C' && State.lockUnclearedStages) {
                const isAClearedTo5 = [1, 2, 3, 4, 5].every(stg => State.progress['A'].includes(stg));
                const isBClearedTo5 = [1, 2, 3, 4, 5].every(stg => State.progress['B'].includes(stg));
                if (!isAClearedTo5 || !isBClearedTo5) {
                    // ロックされている場合は何もしない
                    return;
                }
            }

            State.currentCourse = course;
            renderStageSelect(course);
            showScreen('screen-stage-select');
        });
    });

    // ステージ選択画面からトップへ戻る
    const btnStageBack = document.getElementById('btn-stage-back');
    if (btnStageBack) {
        btnStageBack.addEventListener('click', () => {
            initAudio();
            updateCourseCLockUI(); // トップに戻る時にロック状態再評価
            showScreen('screen-top');
        });
    }

    // レールの長さボタン
    document.querySelectorAll('.length-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.railLength = parseInt(btn.dataset.length);
        });
    });

    // 設定モーダル開閉
    btnSettings.addEventListener('click', () => {
        initAudio();
        settingsModal.classList.remove('hidden');
    });
    btnSettingsClose.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // データリセット機能
    const btnResetData = document.getElementById('btn-reset-data');
    if (btnResetData) {
        btnResetData.addEventListener('click', () => {
            if (confirm('これまで あつめた メダル や クリアの きろく が すべて きえます。\nほんとうに リセット しますか？')) {
                // 進捗と実績をリセット
                State.progress = { 'A': [], 'B': [], 'C': [] };
                State.achievements = {
                    courseAClear: false,
                    courseBClear: false,
                    courseCClear: false,
                    completeAll: false
                };
                saveProgress();

                // 現在の画面の再描画
                if (State.currentCourse) {
                    renderStageSelect(State.currentCourse);
                }
                updateCourseCLockUI();
                renderAchievements(); // トップ画面のメダルや称号の描画を更新

                alert('きろく を リセットしました！');
                settingsModal.classList.add('hidden');
            }
        });
    }

    // 駅の色パレット
    document.querySelectorAll('#palette-station .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('#palette-station .color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            document.documentElement.style.setProperty('--station-color', sw.dataset.color);
        });
    });

    // ステージロック設定トグル機能
    document.querySelectorAll('#lock-buttons .length-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#lock-buttons .length-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.lockUnclearedStages = (btn.dataset.lock === 'true');
            saveProgress();
            // トップやステージ選択にいる場合は再描画
            if (State.currentCourse) {
                renderStageSelect(State.currentCourse);
            }
            updateCourseCLockUI();
        });
    });

    // 初期状態のボタンスタイル適用
    document.querySelectorAll('#lock-buttons .length-btn').forEach(btn => {
        const isLockBtn = (btn.dataset.lock === 'true');
        btn.classList.toggle('active', isLockBtn === State.lockUnclearedStages);
    });

    // クリアオーバーレイ：つづける
    btnContinue.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');

        const c = State.currentCourse;
        const maxStage = State.maxStages[c];

        if (State.currentStage >= maxStage) {
            // コース全クリ時はステージ選択画面へ戻る
            clearCanvas();
            renderStageSelect(c);
            showScreen('screen-stage-select');
        } else {
            // 次のステージへ進む
            State.currentStage++;
            loadCourseStage(c, State.currentStage);
        }
    });

    // クリアオーバーレイ：コース選択へ
    btnBackTop.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');
        clearCanvas();
        renderStageSelect(State.currentCourse);
        showScreen('screen-stage-select');
    });

    // プレイ画面：もどる
    btnHome.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');
        clearCanvas();
        renderStageSelect(State.currentCourse);
        showScreen('screen-stage-select');
    });

    // 実績確認画面へ
    const btnShowAchievements = document.getElementById('btn-show-achievements');
    if (btnShowAchievements) {
        btnShowAchievements.addEventListener('click', () => {
            initAudio();
            renderAchievementsScreen();
            showScreen('screen-achievements');
        });
    }

    // 実績確認画面からトップへ戻る
    const btnAchievementsBack = document.getElementById('btn-achievements-back');
    if (btnAchievementsBack) {
        btnAchievementsBack.addEventListener('click', () => {
            showScreen('screen-top');
        });
    }

    document.body.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
}

function updateUI() {
    stepIndicator.textContent = `コース ${State.currentCourse}-${State.currentStage}`;
}

function setOkojoText(text) {
    instructionText.style.transform = 'scale(1.05)';
    setTimeout(() => { instructionText.style.transform = 'scale(1)'; }, 150);
    instructionText.textContent = text;
}

function clearCanvas() {
    layerRails.innerHTML = '';
    layerActive.innerHTML = '';
    layerTrain.innerHTML = '';
    // SVGの表示領域をデフォルトにリセット
    svg.setAttribute('viewBox', '0 0 800 600');
}

// パスのサイズに合わせて画面（viewBox）をズームアウト・センタリングする
function adjustViewBoxToFitPath(pathNodes) {
    const defaultW = 800;
    const defaultH = 600;
    const padding = 150; // 駅や電車が見切れないための余白

    // 引数が配列でない場合は配列に変換
    const nodes = Array.isArray(pathNodes) ? pathNodes : [pathNodes];

    let overallMinX = Infinity, overallMinY = Infinity;
    let overallMaxX = -Infinity, overallMaxY = -Infinity;

    nodes.forEach(node => {
        if (!node || !node.getBBox) return;
        const bbox = node.getBBox();
        overallMinX = Math.min(overallMinX, bbox.x);
        overallMinY = Math.min(overallMinY, bbox.y);
        overallMaxX = Math.max(overallMaxX, bbox.x + bbox.width);
        overallMaxY = Math.max(overallMaxY, bbox.y + bbox.height);
    });

    if (overallMinX === Infinity) return; // 有効な要素がない場合

    const pathMinX = overallMinX - padding;
    const pathMaxX = overallMaxX + padding;
    const pathMinY = overallMinY - padding;
    const pathMaxY = overallMaxY + padding;

    let minX = 0, minY = 0, width = defaultW, height = defaultH;

    // パスがデフォルト領域より大きいか、はみ出している場合は広げる
    if (pathMinX < 0 || pathMaxX > defaultW || pathMinY < 0 || pathMaxY > defaultH) {
        minX = Math.min(0, pathMinX);
        const maxX = Math.max(defaultW, pathMaxX);
        minY = Math.min(0, pathMinY);
        const maxY = Math.max(defaultH, pathMaxY);

        width = maxX - minX;
        height = maxY - minY;

        // アスペクト比（4:3）を維持してレイアウト崩れを防ぐ
        const targetRatio = defaultW / defaultH;
        const currentRatio = width / height;

        if (currentRatio > targetRatio) {
            // 横長すぎる場合は縦を伸ばす
            const newHeight = width / targetRatio;
            minY -= (newHeight - height) / 2;
            height = newHeight;
        } else {
            // 縦長すぎる場合は横を伸ばす
            const newWidth = height * targetRatio;
            minX -= (newWidth - width) / 2;
            width = newWidth;
        }
    }

    svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
}

// --- Screen & Stage Navigation ---
function updateCourseCLockUI() {
    const btnC = document.getElementById('btn-course-c');
    if (!btnC) return;
    const isAClearedTo5 = [1, 2, 3, 4, 5].every(stg => State.progress['A'].includes(stg));
    const isBClearedTo5 = [1, 2, 3, 4, 5].every(stg => State.progress['B'].includes(stg));

    // ロック設定がオフ、またはAとB両方が1〜5までクリアされていればアンロック
    if (!State.lockUnclearedStages || (isAClearedTo5 && isBClearedTo5)) {
        btnC.classList.remove('locked');
        btnC.innerHTML = `
            <div class="card-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#4CAF50" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M 5,20 L 15,10 C 25,0 40,15 30,25" />
                    <circle cx="20" cy="20" r="10" />
                </svg>
            </div>
            <div class="card-label">コースC<br><span>ミックス コース</span></div>
        `;
    } else {
        btnC.classList.add('locked');
        btnC.innerHTML = `
            <div class="card-icon">
                <span style="font-size: 32px">🔒</span>
            </div>
            <div class="card-label">コースC<br><span>ミックス コース</span></div>
        `;
    }
}

function renderStageSelect(course) {
    const title = document.getElementById('stage-select-title');
    const list = document.getElementById('stage-list');

    if (course === 'A') title.textContent = 'コースA：まっすぐ';
    else if (course === 'B') title.textContent = 'コースB：くねくね';
    else if (course === 'C') title.textContent = 'コースC：ミックス';

    list.innerHTML = '';
    const max = State.maxStages[course];
    const clearedList = State.progress[course] || [];

    for (let i = 1; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'stage-item';

        // 設定がオンなら未クリアステージをロックする (ただしステージ1は常にアンロック、または一つ前のステージがクリアされていればアンロック)
        const isLocked = State.lockUnclearedStages && i > 1 && !clearedList.includes(i - 1) && !clearedList.includes(i);
        const isCleared = clearedList.includes(i);

        if (isLocked) {
            item.classList.add('locked');
            item.innerHTML = `
                <span class="stage-num" style="color:#9e9e9e">${i}</span>
                <span style="font-size: 1rem;">🔒</span>
            `;
        } else {
            if (isCleared) item.classList.add('cleared');
            item.innerHTML = `
                <span class="stage-num">${i}</span>
            `;
            item.addEventListener('click', () => {
                initAudio();
                State.currentStage = i;
                loadCourseStage(course, i);
                showScreen('screen-game');
            });
        }
        list.appendChild(item);
    }
}

function loadCourseStage(course, stage) {
    clearCanvas();
    updateUI();
    State.trainProgress = 0;
    State.isStepCompleted = false;
    State.dragType = 'none';
    State.stops = [];
    State.currentStopIndex = 0;
    State.waitingForTap = false;
    State.stations3 = [];
    State.currentStationIndex3 = 0;
    State.drawingLineNode = null;
    State.trainNode = null;
    State.currentPathNode = null;
    State.draggedShape = null;
    State.trailPath = null;
    State.lastTrainDragPt = null;
    State.multiLines = [];
    State.activeLineIndex = -1;

    drawBackground();

    setOkojoText(`コース${course}-${stage} を じゅんび中...`);

    // 各コースの初期化関数を呼ぶ（Task4で実装）
    if (course === 'A' && typeof initCourseA === 'function') initCourseA(stage);
    else if (course === 'B' && typeof initCourseB === 'function') initCourseB(stage);
    else if (course === 'C' && typeof initCourseC === 'function') initCourseC(stage);
}

function drawBackground() {
    let bgLayer = document.getElementById('layer-bg');
    if (!bgLayer) {
        bgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        bgLayer.setAttribute('id', 'layer-bg');
        // layerRailsより奥に描画
        svg.insertBefore(bgLayer, svg.firstChild);
    }
    bgLayer.innerHTML = '';

    // 空と地面の描画は削除（CSSの背景色 #f1f8e9 に全体を任せる）

    // 遠景の家
    const house = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    house.setAttribute('d', 'M 720,130 v -20 h 30 v 20 z');
    house.setAttribute('fill', '#ffe082');
    house.setAttribute('opacity', '0.7');
    bgLayer.appendChild(house);

    const houseRoof = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    houseRoof.setAttribute('d', 'M 715,110 L 735,90 L 755,110 z');
    houseRoof.setAttribute('fill', '#ffab91');
    houseRoof.setAttribute('opacity', '0.7');
    bgLayer.appendChild(houseRoof);

    // 遠景の木
    const treeTrunk = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    treeTrunk.setAttribute('x', '670'); treeTrunk.setAttribute('y', '100');
    treeTrunk.setAttribute('width', '10'); treeTrunk.setAttribute('height', '30');
    treeTrunk.setAttribute('fill', '#8d6e63');
    treeTrunk.setAttribute('opacity', '0.7');
    bgLayer.appendChild(treeTrunk);

    const treeTop = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    treeTop.setAttribute('cx', '675'); treeTop.setAttribute('cy', '95');
    treeTop.setAttribute('r', '22');
    treeTop.setAttribute('fill', '#a5d6a7');
    treeTop.setAttribute('opacity', '0.8');
    bgLayer.appendChild(treeTop);
}

// --- Path Drawing ---
function createRailPath(pathData) {
    // 枕木
    const ties = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ties.setAttribute('d', pathData);
    ties.setAttribute('class', 'rail-ties');
    ties.setAttribute('stroke', '#a1887f');
    ties.setAttribute('stroke-width', '96');
    ties.setAttribute('stroke-dasharray', '32 96');
    ties.setAttribute('fill', 'none');
    layerRails.appendChild(ties);

    // レール2本作成用のマスク
    const maskId = 'mask-' + Math.random().toString(36).substr(2, 9);
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', maskId);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');

    const maskBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskBg.setAttribute('x', '-5000'); maskBg.setAttribute('y', '-5000');
    maskBg.setAttribute('width', '10000'); maskBg.setAttribute('height', '10000');
    maskBg.setAttribute('fill', 'white');
    mask.appendChild(maskBg);

    const maskPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    maskPath.setAttribute('d', pathData);
    maskPath.setAttribute('fill', 'none');
    maskPath.setAttribute('stroke', 'black'); // くり抜く部分
    maskPath.setAttribute('stroke-width', '24'); // レールの間の隙間
    mask.appendChild(maskPath);
    layerRails.appendChild(mask);

    // ダブルレール本体
    const rail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rail.setAttribute('d', pathData);
    rail.setAttribute('mask', `url(#${maskId})`);
    rail.setAttribute('stroke', '#546e7a'); // レール自体の色
    rail.setAttribute('stroke-width', '44');
    rail.setAttribute('fill', 'none');
    layerRails.appendChild(rail);

    // 進行方向の矢印
    const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    temp.setAttribute('d', pathData);
    const len = temp.getTotalLength();
    if (len > 0) {
        for (let l = 100; l < len - 50; l += 150) {
            const p1 = temp.getPointAtLength(l);
            const p2 = temp.getPointAtLength(l + 1);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            arrow.setAttribute('d', 'M -10,-8 L 6,0 L -10,8');
            arrow.setAttribute('fill', 'none');
            arrow.setAttribute('stroke', 'rgba(0,0,0,0.2)'); // うっすら
            arrow.setAttribute('stroke-width', '5');
            arrow.setAttribute('stroke-linecap', 'round');
            arrow.setAttribute('stroke-linejoin', 'round');
            arrow.setAttribute('transform', `translate(${p1.x}, ${p1.y}) rotate(${angle})`);
            layerRails.appendChild(arrow);
        }
    }

    return rail;
}

// 軌跡パスを作成（電車が通ったところだけ黄色く光る）
function createTrailPath(pathData, totalLength) {
    const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trail.setAttribute('d', pathData);
    trail.setAttribute('fill', 'none');
    trail.setAttribute('stroke', 'var(--accent-color)');
    trail.setAttribute('stroke-width', '28');
    trail.setAttribute('stroke-linecap', 'round');
    trail.setAttribute('stroke-linejoin', 'round');
    trail.setAttribute('stroke-dasharray', `${totalLength} ${totalLength}`);
    trail.setAttribute('stroke-dashoffset', totalLength); // 最初は全部非表示
    trail.setAttribute('opacity', '0.85');
    layerRails.appendChild(trail);
    return trail;
}

// ハイブリッド用描画・標識関数を削除

// 座標の配列からSVGパス(d属性)と角(stops)の配列を生成するユーティリティ関数
function buildLinePath(points) {
    if (!points || points.length === 0) return { d: '', stops: [] };

    let d = `M ${points[0][0]},${points[0][1]}`;
    const stops = [];
    let currentLength = 0;

    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0];
        const dy = points[i][1] - points[i - 1][1];
        d += ` L ${points[i][0]},${points[i][1]}`;
        currentLength += Math.hypot(dx, dy);

        // 最後の点以外は角として停止判定ポイントを追加
        if (i < points.length - 1) {
            stops.push({ length: currentLength, x: points[i][0], y: points[i][1] });
        }
    }

    return { d, stops };
}

function drawStation(x, y, color = null) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'station-group');
    group.setAttribute('transform', `translate(${x}, ${y})`);

    // ベース（一番下、青四角）
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', -30);
    rect.setAttribute('y', -20);
    rect.setAttribute('width', 60);
    rect.setAttribute('height', 40);
    rect.setAttribute('rx', 10);
    rect.setAttribute('class', 'station');
    if (color) {
        rect.style.fill = color;
    }
    group.appendChild(rect);

    // 三角屋根（茶色）
    const roof = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    roof.setAttribute('d', 'M -35,-20 L 0,-45 L 35,-20 Z');
    roof.setAttribute('fill', '#8d6e63'); // 茶色
    group.appendChild(roof);

    layerRails.appendChild(group);
}

function drawTrain(x, y, color = null) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'train');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    // 大きめの透明ヒット領域（タッチしやすく）
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hitArea.setAttribute('x', -55); hitArea.setAttribute('y', -45);
    hitArea.setAttribute('width', 110); hitArea.setAttribute('height', 90);
    hitArea.setAttribute('fill', 'transparent');
    g.appendChild(hitArea);

    // 車体（大きめ）
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', -45); rect.setAttribute('y', -30);
    rect.setAttribute('width', 90); rect.setAttribute('height', 60);
    rect.setAttribute('rx', 14);
    rect.setAttribute('fill', color ? color : '#F44336'); // デフォルトは赤に固定
    g.appendChild(rect);

    // 前面パネル（色分け）
    const front = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    front.setAttribute('x', 28); front.setAttribute('y', -30);
    front.setAttribute('width', 17); front.setAttribute('height', 60);
    front.setAttribute('rx', 14); front.setAttribute('fill', '#c62828');
    g.appendChild(front);

    // 窓1
    const win1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    win1.setAttribute('x', -32); win1.setAttribute('y', -18);
    win1.setAttribute('width', 22); win1.setAttribute('height', 22);
    win1.setAttribute('rx', 5); win1.setAttribute('fill', '#e3f2fd');
    g.appendChild(win1);

    // 窓2
    const win2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    win2.setAttribute('x', -4); win2.setAttribute('y', -18);
    win2.setAttribute('width', 22); win2.setAttribute('height', 22);
    win2.setAttribute('rx', 5); win2.setAttribute('fill', '#e3f2fd');
    g.appendChild(win2);

    // 下部の黒帯（レール感）
    const baseBand = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    baseBand.setAttribute('x', -45); baseBand.setAttribute('y', 20);
    baseBand.setAttribute('width', 90); baseBand.setAttribute('height', 10);
    baseBand.setAttribute('rx', 3); baseBand.setAttribute('fill', '#424242');
    g.appendChild(baseBand);

    // 小さなライト
    const light = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    light.setAttribute('cx', 40); light.setAttribute('cy', 15);
    light.setAttribute('r', 4); light.setAttribute('fill', '#ffeb3b');
    g.appendChild(light);

    layerTrain.appendChild(g);
    return g;
}



function setupTrainDrag(node) {
    node.addEventListener('pointerdown', e => {
        if (State.isStepCompleted || State.waitingForTap) return;
        e.preventDefault();
        e.stopPropagation();
        initAudio();
        State.isDragging = true;
        State.dragType = 'train';
        State.activeLineIndex = -1; // 複数路線でない場合は-1
        node.setPointerCapture(e.pointerId);
        State.lastTrainDragPt = getSVGPoint(e);
        node.classList.add('active');
    });
}

function setupMultiTrainDrag(node, lineIndex) {
    node.addEventListener('pointerdown', e => {
        if (State.isStepCompleted || State.waitingForTap) return;
        if (State.multiLines[lineIndex] && State.multiLines[lineIndex].isCompleted) return;

        e.preventDefault();
        e.stopPropagation();
        initAudio();
        State.isDragging = true;
        State.dragType = 'train';
        State.activeLineIndex = lineIndex;
        node.setPointerCapture(e.pointerId);
        State.lastTrainDragPt = getSVGPoint(e);
        node.classList.add('active');
    });
}

// ============================
// コースA：まっすぐコース (全11ステージ)
// ============================
function generateCourseAPath(stage) {
    const scale = State.railLength === 1 ? 0.7 : (State.railLength === 3 ? 1.5 : 1.0);
    const center = { x: 400, y: 300 };

    // stage 1: 縦の道
    if (stage === 1) {
        const h = 250 * scale;
        return { type: 'single', d: `M ${center.x},${center.y - h} L ${center.x},${center.y + h}` };
    }
    // stage 2: 横の道
    else if (stage === 2) {
        const w = 250 * scale;
        return { type: 'single', d: `M ${center.x - w},${center.y} L ${center.x + w},${center.y}` };
    }
    // stage 3: 十字路 (2車両)
    else if (stage === 3) {
        const s = 200 * scale;
        return {
            type: 'multi', lines: [
                `M ${center.x},${center.y - s} L ${center.x},${center.y + s}`,
                `M ${center.x - s},${center.y} L ${center.x + s},${center.y}`
            ]
        };
    }
    // stage 4: L字コーナー
    else if (stage === 4) {
        const s = 150 * scale;
        const pts = [
            [center.x - s, center.y - s],
            [center.x - s, center.y + s],
            [center.x + s, center.y + s]
        ];
        return { type: 'corner', ...buildLinePath(pts) };
    }
    // stage 5: コの字通路
    else if (stage === 5) {
        const w = 180 * scale;
        const h = 180 * scale;
        const pts = [
            [center.x + w, center.y - h],
            [center.x - w, center.y - h],
            [center.x - w, center.y + h],
            [center.x + w, center.y + h]
        ];
        return { type: 'corner', ...buildLinePath(pts) };
    }
    // stage 6: 四角のお部屋 (口形)
    else if (stage === 6) {
        const s = 180 * scale;
        const pts = [
            [center.x - s, center.y - s],
            [center.x + s, center.y - s],
            [center.x + s, center.y + s],
            [center.x - s, center.y + s],
            [center.x - s, center.y - s]
        ];
        return { type: 'corner', ...buildLinePath(pts) };
    }
    // stage 7: 階段迷路
    else if (stage === 7) {
        const s = 80 * scale;
        const pts = [
            [center.x - s * 2, center.y - s * 3],
            [center.x - s, center.y - s * 3],
            [center.x - s, center.y - s],
            [center.x + s, center.y - s],
            [center.x + s, center.y + s],
            [center.x + s * 3, center.y + s]
        ];
        return { type: 'corner', ...buildLinePath(pts) };
    }
    // stage 8: 斜めの道
    else if (stage === 8) {
        const s = 200 * scale;
        return { type: 'single', d: `M ${center.x - s},${center.y - s} L ${center.x + s},${center.y + s}` };
    }
    // stage 9: バツ印の交差点 (2車両)
    else if (stage === 9) {
        const s = 200 * scale;
        return {
            type: 'multi', lines: [
                `M ${center.x - s},${center.y - s} L ${center.x + s},${center.y + s}`,
                `M ${center.x + s},${center.y - s} L ${center.x - s},${center.y + s}`
            ]
        };
    }
    // stage 10: 鋭角ターン (V字)
    else if (stage === 10) {
        const w = 150 * scale;
        const h = 200 * scale;
        const pts = [
            [center.x - w, center.y - h],
            [center.x, center.y + h],
            [center.x + w, center.y - h]
        ];
        return { type: 'corner', ...buildLinePath(pts) };
    }
    // stage 11: 三角のお部屋
    else if (stage === 11) {
        const r = 220 * scale;
        const pts = [];
        for (let i = 0; i <= 3; i++) {
            const angle = -Math.PI / 2 + (i * 120) * (Math.PI / 180);
            pts.push([
                center.x + r * Math.cos(angle),
                center.y + r * Math.sin(angle)
            ]);
        }
        return { type: 'corner', ...buildLinePath(pts) };
    }

    return { type: 'single', d: `M 100,300 L 700,300` };
}

function initCourseA(stage) {
    const stageNames = [
        'たての道', 'よこの道', '十字路', 'L字コーナー', 'コの字通路',
        '四角のお部屋', 'かいだん迷路', 'ななめの道', 'バツ印の交差点',
        '鋭角ターン', '三角のお部屋'
    ];
    setOkojoText(`【${stageNames[stage - 1] || '？'}】 えきまで はこんでね！`);

    const pathInfo = generateCourseAPath(stage);

    if (pathInfo.type === 'multi') {
        const pathsData = pathInfo.lines;
        State.multiLines = [];
        State.activeLineIndex = -1;
        const colors = ['#E91E63', '#2196F3', '#4CAF50', '#FF9800'];

        pathsData.forEach((pathData, index) => {
            const pathNode = createRailPath(pathData);
            const pathLength = pathNode.getTotalLength();
            const trailPath = createTrailPath(pathData, pathLength);
            const startPoint = pathNode.getPointAtLength(0);
            const endPoint = pathNode.getPointAtLength(pathLength);
            const color = colors[index % colors.length];

            drawStation(startPoint.x, startPoint.y, color);
            drawStation(endPoint.x, endPoint.y, color);

            const lineObj = {
                pathNode: pathNode, pathLength: pathLength, trailPath: trailPath,
                trainNode: null, trainProgress: 0, isCompleted: false,
            };
            State.multiLines.push(lineObj);

            drawDirectionArrows(pathNode, 4, color, index);
            const trainNode = drawTrain(startPoint.x, startPoint.y, color);
            lineObj.trainNode = trainNode;
            setupMultiTrainDrag(trainNode, index);
        });

        adjustViewBoxToFitPath(State.multiLines.map(l => l.pathNode));
    } else {
        const pathData = pathInfo.d;
        State.currentPathNode = createRailPath(pathData);
        State.pathLength = State.currentPathNode.getTotalLength();

        // 直線で角があるコースは角での停止を入れる
        State.stops = pathInfo.type === 'corner' ? pathInfo.stops : [];
        State.trailPath = createTrailPath(pathData, State.pathLength);

        const startPoint = State.currentPathNode.getPointAtLength(0);
        const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
        drawStation(startPoint.x, startPoint.y);
        drawStation(endPoint.x, endPoint.y);

        drawDirectionArrows(State.currentPathNode, 4);
        adjustViewBoxToFitPath(State.currentPathNode);

        State.trainNode = drawTrain(startPoint.x, startPoint.y);
        setupTrainDrag(State.trainNode);
    }
}

// ============================
// コースB：くねくねコース (全11ステージ)
// ============================
function generateCourseBPath(stage) {
    const scale = State.railLength === 1 ? 0.7 : (State.railLength === 3 ? 1.5 : 1.0);
    const center = { x: 400, y: 300 };

    // B-1: 大きなカーブ (C)
    if (stage === 1) {
        const r = 200 * scale;
        return `M ${center.x},${center.y - r} A ${r},${r} 0 0,0 ${center.x},${center.y + r}`;
    }
    // B-2: まるいお部屋 (〇)
    else if (stage === 2) {
        const r = 200 * scale;
        return `M ${center.x},${center.y - r} A ${r},${r} 0 1,0 ${center.x},${center.y + r} A ${r},${r} 0 1,0 ${center.x},${center.y - r}`;
    }
    // B-3: ゆるやかな波線 (〰)
    else if (stage === 3) {
        const w = 250 * scale;
        const h = 80 * scale;
        return `M ${center.x - w},${center.y} Q ${center.x - w / 2},${center.y - h} ${center.x},${center.y} Q ${center.x + w / 2},${center.y + h} ${center.x + w},${center.y}`;
    }
    // B-4: 大きなU字ターン (U字単体)
    else if (stage === 4) {
        const w = 150 * scale;
        const h = 180 * scale;
        return `M ${center.x - w},${center.y - h} L ${center.x - w},${center.y + h - w} A ${w},${w} 0 0,0 ${center.x + w},${center.y + h - w} L ${center.x + w},${center.y - h}`;
    }
    // B-5: U字ターンの連続 (蛇行)
    else if (stage === 5) {
        const w = 150 * scale;
        const h = 180 * scale;
        return `M ${center.x - w * 1.5},${center.y - h} 
                L ${center.x - w * 1.5},${center.y + h} 
                A ${w * 0.5},${w * 0.5} 0 0,0 ${center.x - w * 0.5},${center.y + h}
                L ${center.x - w * 0.5},${center.y - h}
                A ${w * 0.5},${w * 0.5} 0 0,1 ${center.x + w * 0.5},${center.y - h}
                L ${center.x + w * 0.5},${center.y + h}
                A ${w * 0.5},${w * 0.5} 0 0,0 ${center.x + w * 1.5},${center.y + h}
                L ${center.x + w * 1.5},${center.y - h}`;
    }
    // B-6: S字カーブ (S)
    else if (stage === 6) {
        const r = 120 * scale;
        return `M ${center.x},${center.y - r * 2} 
                A ${r},${r} 0 1,0 ${center.x},${center.y} 
                A ${r},${r} 0 1,1 ${center.x},${center.y + r * 2}`;
    }
    // B-7: 連続S字 (くねくね迷路)
    else if (stage === 7) {
        const w = 350 * scale;
        const h = 100 * scale;
        return `M ${center.x - w},${center.y} 
                C ${center.x - w * 0.5},${center.y - h * 2} ${center.x - w * 0.5},${center.y + h * 2} ${center.x},${center.y} 
                C ${center.x + w * 0.5},${center.y - h * 2} ${center.x + w * 0.5},${center.y + h * 2} ${center.x + w},${center.y}`;
    }
    // B-8〜11: ループ (1回〜4回)
    else if (stage >= 8 && stage <= 11) {
        const numLoops = stage - 7; // 1, 2, 3, 4
        // 全体の幅を調整
        const loopWidth = 250 * scale;
        const totalWidth = numLoops * loopWidth;
        const startX = center.x - (totalWidth / 2) - 50 * scale;

        let d = `M ${startX},${center.y} `;
        for (let i = 0; i < numLoops; i++) {
            const bx = startX + 50 * scale + i * loopWidth;
            // 右へ進みつつ、バックして上に大きなループを作ってまた右へ
            d += `C ${bx + 200 * scale},${center.y} ${bx + 200 * scale},${center.y - 250 * scale} ${bx + 125 * scale},${center.y - 250 * scale} `;
            d += `C ${bx + 50 * scale},${center.y - 250 * scale} ${bx + 50 * scale},${center.y} ${bx + 250 * scale},${center.y} `;
        }
        return d;
    }

    return `M 100,300 L 700,300`;
}

function initCourseB(stage) {
    const stageNames = [
        '大きなカーブ',    // 1
        'まるいお部屋',    // 2
        'ゆるやかな波線',  // 3
        '大きなU字ターン', // 4
        'U字ターンの連続', // 5
        'S字カーブ',      // 6
        '連続S字',        // 7
        '一回転ループ',    // 8
        '2れんぞくループ',  // 9
        '3れんぞくループ',  // 10
        '4れんぞくループ'   // 11
    ];
    setOkojoText(`【${stageNames[stage - 1] || '？'}】 くねくねレールだよ！`);

    const pathData = generateCourseBPath(stage);
    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();
    State.stops = []; // Bコースは流暢性重視のため基本ノンストップ一筆書き
    State.trailPath = createTrailPath(pathData, State.pathLength);

    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);

    drawDirectionArrows(State.currentPathNode, 4);
    adjustViewBoxToFitPath(State.currentPathNode);

    State.trainNode = drawTrain(startPoint.x, startPoint.y);
    setupTrainDrag(State.trainNode);
}

// ============================
// コースC：ミックスコース (全7ステージ)
// ============================
function generateCourseCPath(stage) {
    const scale = State.railLength === 1 ? 0.7 : (State.railLength === 3 ? 1.5 : 1.0);
    const center = { x: 400, y: 300 };

    // C-1: かまぼこ・D字 (D) - 2ストローク
    if (stage === 1) {
        const h = 180 * scale;
        const w = 150 * scale;
        return {
            type: 'multi',
            lines: [
                `M ${center.x - w},${center.y - h} A ${h},${h} 0 0,1 ${center.x - w},${center.y + h}`, // 曲線
                `M ${center.x - w},${center.y - h} L ${center.x - w},${center.y + h}` // 縦線 (直線)
            ]
        };
    }
    // C-2: 「２」の字ルート (通常レール)
    else if (stage === 2) {
        const r = 120 * scale; // 半円の半径
        const w = 200 * scale; // 水平直線の長さ

        const pts = [
            { x: center.x - r, y: center.y - r },       // Start
            { x: center.x + r, y: center.y - r },       // End of curve (top semicircle)
            { x: center.x - r, y: center.y + r },       // Corner 1
            { x: center.x - r + w, y: center.y + r }    // End
        ];

        const d = `M ${pts[0].x},${pts[0].y} A ${r},${r} 0 0,1 ${pts[1].x},${pts[1].y} L ${pts[2].x},${pts[2].y} L ${pts[3].x},${pts[3].y}`;
        const curveLength = Math.PI * r;
        const line1Dist = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);

        return { type: 'mixed', d: d, stops: [{ length: curveLength + line1Dist, x: pts[2].x, y: pts[2].y }] };
    }
    // C-3: 「の」の始点が伸びた形 (旧C-10)
    else if (stage === 3) {
        const r = 170 * scale;
        const loopCx = center.x;
        const loopCy = center.y + 40 * scale;
        const topX = loopCx;
        const topY = loopCy - r - 150 * scale;
        const entryX = loopCx;
        const entryY = loopCy - r;
        const noPt = (deg) => ({
            x: loopCx + r * Math.cos(deg * Math.PI / 180),
            y: loopCy + r * Math.sin(deg * Math.PI / 180)
        });
        const np1 = noPt(0);
        const np2 = noPt(90);
        const np3 = noPt(180);
        const np4 = noPt(200);
        const d3 = `M ${topX},${topY} L ${entryX},${entryY} ` +
            `A ${r},${r} 0 0,1 ${np1.x},${np1.y} ` +
            `A ${r},${r} 0 0,1 ${np2.x},${np2.y} ` +
            `A ${r},${r} 0 0,1 ${np3.x},${np3.y} ` +
            `A ${r},${r} 0 0,1 ${np4.x},${np4.y}`;
        return { type: 'mixed', d: d3 };
    }
    // C-4: 「５」の字 (旧C-3)
    else if (stage === 4) {
        const w = 150 * scale;
        const h = 100 * scale;
        const r = 130 * scale;
        const ptTopLeft = { x: center.x - w / 2, y: center.y - h - r };
        const ptMidLeft = { x: center.x - w / 2, y: center.y - r };
        const endPt = { x: center.x - w / 2 - r * 0.5, y: center.y + r * 0.8 };
        const d1 = `M ${ptTopLeft.x},${ptTopLeft.y} L ${ptMidLeft.x},${ptMidLeft.y} A ${r},${r} 0 1,1 ${endPt.x},${endPt.y}`;
        const d2 = `M ${ptTopLeft.x},${ptTopLeft.y} L ${center.x + w * 0.8},${ptTopLeft.y}`;
        return { type: 'multi', lines: [d2, d1] };
    }
    // C-5: 「て」の字 (旧C-4)
    else if (stage === 5) {
        const w = 180 * scale;
        const h = 80 * scale;
        const pts = [
            { x: center.x - w, y: center.y - h },
            { x: center.x + w / 2, y: center.y - h * 2 }
        ];
        const endPt = { x: center.x - w * 0.8, y: center.y + h * 2 };
        const d = `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y} Q ${center.x + w * 1.2},${center.y + h * 1.5} ${endPt.x},${endPt.y}`;
        const line1Dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        return { type: 'mixed', d: d, stops: [{ length: line1Dist, x: pts[1].x, y: pts[1].y }] };
    }
    // C-6: カプセル型 (旧C-5)
    else if (stage === 6) {
        const w = 120 * scale;
        const h = 180 * scale;
        return { type: 'mixed', d: `M ${center.x - w},${center.y + h} L ${center.x - w},${center.y - h} A ${w},${w} 0 0,1 ${center.x + w},${center.y - h} L ${center.x + w},${center.y + h} A ${w},${w} 0 0,1 ${center.x - w},${center.y + h}` };
    }
    // C-7: 雪だるま (旧C-6)
    else if (stage === 7) {
        const r1 = 100 * scale;
        const r2 = 130 * scale;
        const gap = 50 * scale;
        const totalHeight = (r1 * 2) + gap + (r2 * 2);
        const topY = center.y - (totalHeight / 2);
        const cy1 = topY + r1;
        const cy2 = cy1 + r1 + gap + r2;
        const d1_cw = `M ${center.x},${cy1 - r1} A ${r1},${r1} 0 1,1 ${center.x},${cy1 + r1} A ${r1},${r1} 0 1,1 ${center.x},${cy1 - r1}`;
        const d1_ccw = `M ${center.x},${cy1 - r1} A ${r1},${r1} 0 1,0 ${center.x},${cy1 + r1} A ${r1},${r1} 0 1,0 ${center.x},${cy1 - r1}`;
        const d2_cw = `M ${center.x},${cy2 - r2} A ${r2},${r2} 0 1,1 ${center.x},${cy2 + r2} A ${r2},${r2} 0 1,1 ${center.x},${cy2 - r2}`;
        const d2_ccw = `M ${center.x},${cy2 - r2} A ${r2},${r2} 0 1,0 ${center.x},${cy2 + r2} A ${r2},${r2} 0 1,0 ${center.x},${cy2 - r2}`;
        return { type: 'multi', lines: [{ d: d2_cw, reverseD: d2_ccw }, { d: d1_cw, reverseD: d1_ccw }] };
    }
    // C-8: 横並びの２つの丸 (旧C-7)
    else if (stage === 8) {
        const r1 = 140 * scale;
        const r2 = 140 * scale;
        const gap = 80 * scale;
        const totalWidth = (r1 * 2) + gap + (r2 * 2);
        const leftX = center.x - (totalWidth / 2);
        const cx1 = leftX + r1;
        const cx2 = cx1 + r1 + gap + r2;
        const d1_cw = `M ${cx1},${center.y - r1} A ${r1},${r1} 0 1,1 ${cx1},${center.y + r1} A ${r1},${r1} 0 1,1 ${cx1},${center.y - r1}`;
        const d1_ccw = `M ${cx1},${center.y - r1} A ${r1},${r1} 0 1,0 ${cx1},${center.y + r1} A ${r1},${r1} 0 1,0 ${cx1},${center.y - r1}`;
        const d2_cw = `M ${cx2},${center.y - r2} A ${r2},${r2} 0 1,1 ${cx2},${center.y + r2} A ${r2},${r2} 0 1,1 ${cx2},${center.y - r2}`;
        const d2_ccw = `M ${cx2},${center.y - r2} A ${r2},${r2} 0 1,0 ${cx2},${center.y + r2} A ${r2},${r2} 0 1,0 ${cx2},${center.y - r2}`;
        return { type: 'multi', lines: [{ d: d1_cw, reverseD: d1_ccw }, { d: d2_cw, reverseD: d2_ccw }] };
    }
    // C-9: 縦の８の字 (始点上)
    else if (stage === 9) {
        const cx = center.x, cy = center.y;
        const w = 170 * scale, h = 260 * scale;
        // 上の頂点から左下へS字を描いて交差する、一般的な「8」の書き順
        const fwd = `M ${cx},${cy - h} ` +
            `C ${cx - w},${cy - h} ${cx - w},${cy} ${cx},${cy} ` +  // 上ループ左側
            `C ${cx + w},${cy} ${cx + w},${cy + h} ${cx},${cy + h} ` + // 下ループ右側
            `C ${cx - w},${cy + h} ${cx - w},${cy} ${cx},${cy} ` +  // 下ループ左側
            `C ${cx + w},${cy} ${cx + w},${cy - h} ${cx},${cy - h}`; // 上ループ右側
        const rev = `M ${cx},${cy - h} ` +
            `C ${cx + w},${cy - h} ${cx + w},${cy} ${cx},${cy} ` +  // 上ループ右側
            `C ${cx - w},${cy} ${cx - w},${cy + h} ${cx},${cy + h} ` + // 下ループ左側
            `C ${cx + w},${cy + h} ${cx + w},${cy} ${cx},${cy} ` +  // 下ループ右側
            `C ${cx - w},${cy} ${cx - w},${cy - h} ${cx},${cy - h}`; // 上ループ左側
        return { type: 'multi', lines: [{ d: fwd }] };
    }
    // C-10: 横の８の字/∞ (交差点スタート)
    else if (stage === 10) {
        const cx = center.x, cy = center.y;
        const w = 350 * scale, h = 320 * scale;
        // 交差点(中央)から右ループ→左ループの順で∞をトレース (右上へ向かう)
        const fwd = `M ${cx},${cy} C ${cx + w},${cy - h} ${cx + w},${cy + h} ${cx},${cy} C ${cx - w},${cy - h} ${cx - w},${cy + h} ${cx},${cy}`;
        return { type: 'multi', lines: [{ d: fwd }] };
    }


    return { type: 'mixed', d: `M 100,300 L 700,300` };
}


function initCourseC(stage) {
    const stageNames = [
        'かまぼこ・D字', '「２」の字', '「の」の始点が伸びた形',
        '「５」の字', '「て」の字', '角の丸い四角・カプセル型',
        '２つの丸・雪だるま', '横並びの２つの丸',
        '縦の８の字', '横の８の字(∞)', '離れた十字とC'
    ];
    setOkojoText(`【${stageNames[stage - 1] || '？'}】 ミックスレールだよ！ むずかしいぞ！`);

    const pathInfo = generateCourseCPath(stage);

    if (pathInfo.type === 'multi') {
        const pathsData = pathInfo.lines;
        State.multiLines = [];
        State.activeLineIndex = -1;
        const colors = ['#00BCD4', '#FF5722', '#9C27B0', '#FFEB3B'];

        pathsData.forEach((pathItem, index) => {
            const isObj = typeof pathItem === 'object';
            const pathData = isObj ? pathItem.d : pathItem;
            const reverseData = isObj ? pathItem.reverseD : null;

            const pathNode = createRailPath(pathData);
            const pathLength = pathNode.getTotalLength();
            const trailPath = createTrailPath(pathData, pathLength);
            const startPoint = pathNode.getPointAtLength(0);
            const endPoint = pathNode.getPointAtLength(pathLength);
            const color = colors[index % colors.length];

            drawStation(startPoint.x, startPoint.y, color);
            drawStation(endPoint.x, endPoint.y, color);

            const lineObj = {
                pathNode: pathNode, pathLength: pathLength, trailPath: trailPath,
                trainNode: null, trainProgress: 0, isCompleted: false,
                pathData: pathData, reverseData: reverseData, isReversed: false
            };
            State.multiLines.push(lineObj);

            // 逆方向可能な面(円など)は矢印を描画しないことでどちらでも描けるように見せる
            if (!reverseData) {
                const arrowCount = Math.max(4, Math.floor(pathLength / 300));
                drawDirectionArrows(pathNode, arrowCount, color, index);
            }
            const trainNode = drawTrain(startPoint.x, startPoint.y, color);
            lineObj.trainNode = trainNode;
            setupMultiTrainDrag(trainNode, index);
        });

        adjustViewBoxToFitPath(State.multiLines.map(l => l.pathNode));
    } else {
        const pathData = pathInfo.d;
        State.currentPathNode = createRailPath(pathData);
        State.pathLength = State.currentPathNode.getTotalLength();

        // 停止点が設定されている場合はストップ配列を使用
        State.stops = pathInfo.stops || [];
        State.trailPath = createTrailPath(pathData, State.pathLength);

        const startPoint = State.currentPathNode.getPointAtLength(0);
        const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
        const mainColor = '#9C27B0'; // Cコースの単線は紫
        drawStation(startPoint.x, startPoint.y, mainColor);
        drawStation(endPoint.x, endPoint.y, mainColor);

        const arrowCount = Math.max(4, Math.floor(State.pathLength / 300));
        drawDirectionArrows(State.currentPathNode, arrowCount, mainColor);
        adjustViewBoxToFitPath(State.currentPathNode);

        State.trainNode = drawTrain(startPoint.x, startPoint.y, mainColor);
        setupTrainDrag(State.trainNode);
    }
}

// ============================
// 矢印マーク描画機能
// ============================
function drawDirectionArrows(pathNode, numArrows = 4, color = '#E91E63', lineIndex = -1) {
    const len = pathNode.getTotalLength();
    const arrowGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    arrowGroup.setAttribute('class', 'direction-arrows');

    const createdArrows = [];

    // 均等間隔で矢印を配置
    for (let i = 1; i <= numArrows; i++) {
        const l = (len / (numArrows + 1)) * i;
        const p0 = pathNode.getPointAtLength(l);
        const p1 = pathNode.getPointAtLength(Math.min(len, l + 1));
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        // 白塗りにカラー枠の矢印
        arrow.setAttribute('points', '-8,-10 10,0 -8,10');
        arrow.setAttribute('fill', 'white');
        arrow.setAttribute('stroke', color);
        arrow.setAttribute('stroke-width', '3');
        arrow.setAttribute('stroke-linejoin', 'round');

        // 最初の1つ目だけアクティブ、それ以降は非表示
        if (i === 1) {
            arrow.setAttribute('class', 'arrow-active');
        } else {
            arrow.setAttribute('class', 'arrow-hidden');
        }

        arrow.setAttribute('transform', `translate(${p0.x}, ${p0.y}) rotate(${angle}) scale(1.2)`);

        arrowGroup.appendChild(arrow);

        createdArrows.push({
            node: arrow,
            length: l
        });
    }

    // レールレイヤーに追加（電車の下）
    layerRails.appendChild(arrowGroup);

    // 複数路線の場合は線のデータに紐づけ、それ以外はState.arrowsに入れる
    if (lineIndex >= 0 && State.multiLines) {
        if (!State.multiLines[lineIndex].arrows) {
            State.multiLines[lineIndex].arrows = [];
        }
        State.multiLines[lineIndex].arrows = createdArrows;
    } else {
        State.arrows = createdArrows;
    }
}

// (旧図形パズル機能は削除済)

function parseTransform(transformStr) {
    let x = 0, y = 0, angle = 0;
    if (transformStr) {
        const tMatch = transformStr.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (tMatch) { x = parseFloat(tMatch[1]); y = parseFloat(tMatch[2]); }
        const rMatch = transformStr.match(/rotate\(([^)]+)\)/);
        if (rMatch) { angle = parseFloat(rMatch[1]); }
    }
    return { x, y, angle };
}

function startShapeDrag(e) {
    if (State.isStepCompleted) return;
    initAudio();
    const node = e.currentTarget;
    const pt = getSVGPoint(e);
    const tf = parseTransform(node.getAttribute('transform'));
    const isRotateHandle = e.target.classList.contains('rotate-handle');

    State.isDragging = true;
    State.draggedShape = node;
    layerActive.appendChild(node);

    if (isRotateHandle) {
        State.dragType = 'shape_rotate';
        State.dragOffset = { x: tf.x, y: tf.y };
        const a = Math.atan2(pt.y - tf.y, pt.x - tf.x) * 180 / Math.PI;
        State.initialAngle = a - tf.angle;
    } else {
        State.dragType = 'shape_move';
        State.dragOffset = { x: tf.x - pt.x, y: tf.y - pt.y };
        node.style.cursor = 'grabbing';
        node.style.opacity = '0.7';
    }
    node.setPointerCapture(e.pointerId);
}

// --- Core Pointer Logic ---
function getSVGPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function getClosestPointOnPath(pathNode, x, y, samples = 200) {
    const length = pathNode.getTotalLength();
    let closestPoint = null, minDistance = Infinity, closestLength = 0;
    for (let i = 0; i <= samples; i++) {
        const l = (i / samples) * length;
        const p = pathNode.getPointAtLength(l);
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist < minDistance) { minDistance = dist; closestPoint = p; closestLength = l; }
    }
    return { point: closestPoint, distance: minDistance, length: closestLength };
}

function showCornerPrompt(stopObj) {
    setOkojoText('「かど」に ついたよ！ すこし まってね...');
    const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    indicator.setAttribute('cx', stopObj.x);
    indicator.setAttribute('cy', stopObj.y);
    indicator.setAttribute('class', 'corner-indicator');
    layerActive.appendChild(indicator);

    // 角を解除する共通処理
    function dismissCorner() {
        indicator.remove();
        State.waitingForTap = false;
        State.currentStopIndex++;
        setOkojoText('よし！ つづけて なぞろう！');
        playSound('snap');
    }

    // 1秒後に自動で解除（タップ不要）
    const autoTimer = setTimeout(dismissCorner, 1000);

    // タッチ/クリックしても即座に解除できる
    indicator.addEventListener('pointerdown', e => {
        e.stopPropagation();
        clearTimeout(autoTimer);
        dismissCorner();
    }, { once: true });
}

function onPointerMove(e) {
    if (!State.isDragging) return;
    const pt = getSVGPoint(e);

    // Train — デルタ投影方式
    // “絶対座標から最近点”ではなく、“指の動き差分をパス接線方向へ投影”して進行量を加算
    if (State.dragType === 'train') {
        if (State.isStepCompleted || State.waitingForTap) return;

        let currentPathNode = State.currentPathNode;
        let pathLength = State.pathLength;
        let trainNode = State.trainNode;
        let trainProgress = State.trainProgress;
        let trailPath = State.trailPath;
        let arrows = State.arrows;

        const isMultiLine = State.activeLineIndex >= 0 && State.multiLines;
        if (isMultiLine) {
            const lineData = State.multiLines[State.activeLineIndex];
            if (lineData.isCompleted) return;
            currentPathNode = lineData.pathNode;
            pathLength = lineData.pathLength;
            trainNode = lineData.trainNode;
            trainProgress = lineData.trainProgress;
            trailPath = lineData.trailPath;
            arrows = lineData.arrows;
        }

        if (!State.lastTrainDragPt) { State.lastTrainDragPt = pt; return; }

        State.lastTrainDragPt = pt;

        // --- どちら回りでも可能にするためのパス動的反転判定 ---
        if (isMultiLine) {
            const lineObj = State.multiLines[State.activeLineIndex];
            // まだ反転しておらず、逆方向データがあり、スタート直後(進行度15未満)の場合のみ判定
            if (lineObj.reverseData && !lineObj.isReversed && lineObj.trainProgress < 15) {
                // 仮のパスを作って逆方向への距離を計る
                const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                tempPath.setAttribute('d', lineObj.reverseData);

                let minDistRev = Infinity;
                let minDistFwd = Infinity;

                for (let l = 0; l <= 150; l += 5) {
                    const pRev = tempPath.getPointAtLength(l);
                    const distRev = Math.hypot(pRev.x - pt.x, pRev.y - pt.y);
                    if (distRev < minDistRev) minDistRev = distRev;

                    const pFwd = currentPathNode.getPointAtLength(l);
                    const distFwd = Math.hypot(pFwd.x - pt.x, pFwd.y - pt.y);
                    if (distFwd < minDistFwd) minDistFwd = distFwd;
                }

                // 明らかに逆方向へ指が動いている場合 (FwdよりRevの方が近く、かつFwdから一定以上離れた)
                if (minDistRev < minDistFwd && minDistFwd > 15 && minDistRev < 40) {
                    lineObj.isReversed = true;
                    const oldD = lineObj.pathData;
                    const newD = lineObj.reverseData;

                    // DOM上の該当する古いパスをすべて新しい反転パスに置換 (レール、マスク、軌跡など)
                    const elements = document.getElementById('game-svg').querySelectorAll('path');
                    elements.forEach(el => {
                        if (el.hasAttribute('d') && el.getAttribute('d') === oldD) {
                            el.setAttribute('d', newD);
                        }
                    });

                    lineObj.pathData = newD;
                }
            }
        }

        // 進行判定を「軌跡接線への投影」から「ローカル範囲での近傍点スナップ」に変更
        // 星形のような鋭角交差でも引っかからず自然に曲がれるよう、進行方向（前方）の探索範囲を広げる
        const searchBackward = 200;  // 後退の許容範囲 (逆走しやすく拡張)
        const searchForward = 200;   // 前進のしやすさ・カーブの許容度
        const searchStart = Math.max(0, trainProgress - searchBackward);
        const searchEnd = Math.min(pathLength, trainProgress + searchForward);

        let minDistance = Infinity;
        let nextProgress = trainProgress;
        const stepSize = 5; // 5px刻みで滑らかに探索する

        for (let l = searchStart; l <= searchEnd; l += stepSize) {
            const p = currentPathNode.getPointAtLength(l);
            const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
            if (dist < minDistance) {
                minDistance = dist;
                nextProgress = l;
            }
        }

        // 指がパスから離れすぎている場合は進めない
        // ユーザー要望の「太さを上げる」を実現するため許容範囲(dragTolerance)を150pxと広めに設定
        const dragTolerance = 150;
        if (minDistance > dragTolerance) {
            nextProgress = trainProgress;
        }

        nextProgress = Math.max(0, Math.min(pathLength, nextProgress));



        trainProgress = nextProgress;

        if (isMultiLine) {
            State.multiLines[State.activeLineIndex].trainProgress = trainProgress;
        } else {
            State.trainProgress = trainProgress;
        }

        const p = currentPathNode.getPointAtLength(trainProgress);
        trainNode.setAttribute('transform', `translate(${p.x}, ${p.y})`);

        if (arrows && arrows.length > 0) {
            let activeSet = false;
            for (let i = 0; i < arrows.length; i++) {
                const arrObj = arrows[i];
                if (trainProgress > arrObj.length - 5) {
                    arrObj.node.setAttribute('class', 'arrow-passed');
                } else if (!activeSet) {
                    arrObj.node.setAttribute('class', 'arrow-active');
                    activeSet = true;
                } else {
                    arrObj.node.setAttribute('class', 'arrow-hidden');
                }
            }
        }

        if (trailPath) {
            trailPath.setAttribute('stroke-dashoffset', pathLength - trainProgress);
        }

        const now = Date.now();
        if (now - State.lastRunSoundTime > 150 && !State.waitingForTap) {
            playSound('run');
            State.lastRunSoundTime = now;
        }

        if (!State.waitingForTap && trainProgress >= pathLength - 5) {
            const endP = currentPathNode.getPointAtLength(pathLength);
            trainNode.setAttribute('transform', `translate(${endP.x}, ${endP.y})`);

            if (isMultiLine) {
                State.multiLines[State.activeLineIndex].isCompleted = true;
                trainNode.classList.remove('active');
                playSound('success');
                const allCompleted = State.multiLines.every(line => line.isCompleted);
                if (allCompleted) {
                    finishStep();
                } else {
                    State.isDragging = false; // この路線のドラッグは終了
                }
            } else {
                finishStep();
            }
        }
    }
    // Shape Move
    else if (State.dragType === 'shape_move' && State.draggedShape) {
        let newX = pt.x + State.dragOffset.x;
        let newY = pt.y + State.dragOffset.y;
        const tf = parseTransform(State.draggedShape.getAttribute('transform'));
        const dist = Math.hypot(newX - State.targetPos.x, newY - State.targetPos.y);
        if (dist < 80) {
            newX = State.targetPos.x; newY = State.targetPos.y;
            if (!State.draggedShape.dataset.posSnapped) {
                playSound('snap');
                State.draggedShape.dataset.posSnapped = 'true';
            }
        } else {
            State.draggedShape.dataset.posSnapped = '';
        }
        State.draggedShape.setAttribute('transform', `translate(${newX}, ${newY}) rotate(${tf.angle})`);
    }
    // Shape Rotate
    else if (State.dragType === 'shape_rotate' && State.draggedShape) {
        const cx = State.dragOffset.x;
        const cy = State.dragOffset.y;
        const a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI;
        let newAngle = a - State.initialAngle;

        // 0〜359度に正規化
        const normalizedAngle = ((newAngle % 360) + 360) % 360;

        // 0度（345〜15度）または 180度（165〜195度）にスナップ
        if (normalizedAngle > 345 || normalizedAngle < 15) {
            newAngle = Math.round(newAngle / 360) * 360; // 0度系にする
            if (!State.draggedShape.dataset.angleSnapped) {
                playSound('snap');
                State.draggedShape.dataset.angleSnapped = 'true';
            }
        } else if (normalizedAngle > 165 && normalizedAngle < 195) {
            newAngle = Math.round((newAngle - 180) / 360) * 360 + 180; // 180度系にする
            if (!State.draggedShape.dataset.angleSnapped) {
                playSound('snap');
                State.draggedShape.dataset.angleSnapped = 'true';
            }
        } else {
            State.draggedShape.dataset.angleSnapped = '';
        }
        State.draggedShape.dataset.angle = newAngle;
        State.draggedShape.setAttribute('transform', `translate(${cx}, ${cy}) rotate(${newAngle})`);
    }
}

function onPointerUp(e) {
    if (!State.isDragging) return;
    State.isDragging = false;

    if (State.dragType === 'train' && !State.isStepCompleted && !State.waitingForTap) {
        if (State.activeLineIndex >= 0 && State.multiLines && State.multiLines[State.activeLineIndex]) {
            State.multiLines[State.activeLineIndex].trainNode.classList.remove('active');
        } else if (State.trainNode) {
            State.trainNode.classList.remove('active');
        }
    }
    if (State.dragType === 'line' && State.drawingLineNode) {
        State.drawingLineNode.remove();
        State.drawingLineNode = null;
    }
    if ((State.dragType === 'shape_move' || State.dragType === 'shape_rotate') && State.draggedShape) {
        const node = State.draggedShape;
        node.style.cursor = 'grab';
        node.style.opacity = '1';
        const tf = parseTransform(node.getAttribute('transform'));
        const isPosSnapped = Math.hypot(tf.x - State.targetPos.x, tf.y - State.targetPos.y) < 10;
        const normalizedA = ((tf.angle % 360) + 360) % 360;
        const isAngleCorrect = normalizedA < 5 || normalizedA > 355 || (normalizedA > 175 && normalizedA < 185);

        if (isPosSnapped) {
            if (node.dataset.correct === 'true') {
                if (State.step === 5 && !isAngleCorrect) {
                    playSound('wrong');
                    setOkojoText('おしい！ むき が ちがう みたい だよ。 まわして あわせてみて！');
                    resetShapePos(node);
                } else {
                    finishStep4(node);
                }
            } else {
                playSound('wrong');
                setOkojoText('ちがうみたい。もういちど さがして！');
                resetShapePos(node);
            }
        } else if (State.dragType === 'shape_move') {
            resetShapePos(node);
        }
        State.draggedShape = null;
    }
    State.dragType = 'none';
}

function resetShapePos(node) {
    const startX = node.dataset.startX;
    const startY = node.dataset.startY;
    const currentAngle = node.dataset.angle || 0;
    node.setAttribute('transform', `translate(${startX}, ${startY}) rotate(${currentAngle})`);
}

// --- 共通クリアオーバーレイ表示 ---
function showClearOverlay(msg) {
    const c = State.currentCourse;
    const total = State.maxStages[c];
    const cur = State.currentStage;
    const allDone = (cur >= total);

    // 個別ステージのクリアを記録 (重複を防いで追加)
    if (!State.progress[c].includes(cur)) {
        State.progress[c].push(cur);
        // 見やすくソートしておく
        State.progress[c].sort((a, b) => a - b);
    }

    // コース全クリアの判定 (クリアしたステージの数が最大ステージ数に達しているか)
    const isCourseAllCleared = State.progress[c].length >= total;

    // 実績判定と保存処理
    let newlyEarned = null; // 'all' | 'complete'
    const ach = State.achievements;

    // コース全部クリア実績判定
    if (isCourseAllCleared && !ach[`course${c}Clear`]) {
        ach[`course${c}Clear`] = true;
        newlyEarned = 'all';
    }

    // 全ステップ完全制覇の判定
    const isCompleteAll = ach.courseAClear && ach.courseBClear && ach.courseCClear;
    if (isCompleteAll && !ach.completeAll) {
        ach.completeAll = true;
        newlyEarned = 'complete';
    }

    saveProgress();

    if (newlyEarned) {
        playSound('fanfare');
    }

    roundIndicator.textContent = `${cur} / ${total}`;

    if (allDone) {
        clearMessage.textContent = 'コースクリア！すごい！';
        clearProgress.textContent = `コース${c} を 全部できたよ！`;
        btnContinue.textContent = 'ステージをえらぶ >';

        let okojoMsg = `コース${c} クリア！ ほんとうに すごいね！ はなまる だよ！`;
        if (newlyEarned === 'complete') okojoMsg = 'ついに レールマスター だね！ おめでとう！！ ぜんぶのメダルがあつまったよ！';
        else if (newlyEarned === 'all') okojoMsg = 'コースクリア メダル を ゲットしたよ！ すごい！';
        setOkojoText(okojoMsg);
    } else {
        clearMessage.textContent = 'クリア！';
        clearProgress.textContent = `${cur} / ${total} くりあ！`;
        btnContinue.textContent = 'つぎのステージへ ▶';

        let okojoMsg = 'クリア！ すごいね！ よくできたよ！';
        setOkojoText(okojoMsg);
    }

    setTimeout(() => { clearOverlay.classList.remove('hidden'); }, 800);
}

// --- Finishes ---
function finishStep(customMsg = 'やったね！えきに ついたよ！') {
    State.isDragging = false;
    State.isStepCompleted = true;
    if (State.trainNode) {
        State.trainNode.classList.remove('active');
        State.trainNode.classList.add('success-fx');
    }
    playSound('success');
    setOkojoText(customMsg);
    showClearOverlay(customMsg);
}

function finishStep4(node) {
    State.isStepCompleted = true;
    State.isDragging = false;
    node.classList.add('success-fx');
    document.querySelectorAll('.draggable-shape').forEach(n => {
        if (n !== node) { n.style.opacity = '0.2'; n.style.pointerEvents = 'none'; }
    });
    const c = State.currentCourse;
    const msg = (State.currentStage >= State.maxStages[c])
        ? 'ぜんぶ クリア だよ！ すごい！ おめでとう！！'
        : 'だいせいかい！ ピタッと かさなったね！';
    playSound((State.currentStage >= State.maxStages[c]) ? 'fanfare' : 'success');
    showClearOverlay(msg);
}

// --- 実績（メダル）UIのレンダリング ---
function renderAchievements() {
    const ach = State.achievements;

    // 1. 各コースカードへのメダル描画
    const cards = document.querySelectorAll('.course-card');
    cards.forEach(card => {
        const course = card.dataset.course;
        let medalsHtml = '';

        let container = card.querySelector('.medal-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'medal-container';
            card.appendChild(container);
        }

        // 制覇メダル (全部クリア)
        if (ach[`course${course}Clear`]) {
            medalsHtml += `<div class="medal medal-silver" title="コースクリア！">👑</div>`;
        }

        container.innerHTML = medalsHtml;
    });

    // 2. トップ画面タイトル横へのコンプリートメダル描画
    const headerTitle = document.querySelector('.top-header h1');
    if (headerTitle) {
        let completeMedal = headerTitle.querySelector('.medal-complete');
        if (ach.completeAll && !completeMedal) {
            completeMedal = document.createElement('div');
            completeMedal.className = 'medal-complete';
            completeMedal.innerHTML = '✨🏆✨<br><span style="font-size: 0.8rem">レールマスター</span>';
            headerTitle.appendChild(completeMedal);
        } else if (!ach.completeAll && completeMedal) {
            completeMedal.remove(); // リセット時に称号も削除する
        }
    }
}

// --- コレクション画面（screen-achievements）のレンダリング ---
function renderAchievementsScreen() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const ach = State.achievements;
    const courseNames = {
        'A': 'まっすぐコース',
        'B': 'くねくねコース',
        'C': 'ミックスコース'
    };

    // コースA,B,Cのメダルを順に生成
    ['A', 'B', 'C'].forEach(c => {
        const allEarned = ach[`course${c}Clear`];
        const allItem = document.createElement('div');
        allItem.className = `achievement-item ${allEarned ? '' : 'locked'}`;
        allItem.innerHTML = `
            <div class="achievement-icon ${allEarned ? 'medal-silver' : 'medal-locked'}">
                ${allEarned ? '👑' : '?'}
            </div>
            <div class="achievement-info">
                <div class="achievement-title">コース${c} クリア</div>
                <div class="achievement-desc">「${courseNames[c]}」の <ruby>全<rt>ぜん</rt></ruby>ステージを クリアしたよ</div>
            </div>
        `;
        grid.appendChild(allItem);
    });

    // --- コンプリートメダル ---
    const completeEarned = ach.completeAll;
    const compItem = document.createElement('div');
    compItem.className = `achievement-item complete-item ${completeEarned ? '' : 'locked'}`;
    compItem.innerHTML = `
        <div class="achievement-icon ${completeEarned ? 'medal-complete-large' : 'medal-locked'}">
            ${completeEarned ? '🏆' : '?'}
        </div>
        <div class="achievement-info">
            <div class="achievement-title" style="color:#d84315;">レールマスター</div>
            <div class="achievement-desc">すべての コースの <ruby>全<rt>ぜん</rt></ruby>ステージを クリアした <ruby>大天才<rt>だいてんさい</rt></ruby>！！</div>
        </div>
    `;
    grid.appendChild(compItem);
}

// Boot
window.onload = init;

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
    step: 1,
    maxStep: 5,
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
    lastTrainDragPt: null,

    // 共通設定
    railLength: 2,

    // 各ステップのステージ用
    step1Stage: 1,
    maxStep1Stage: 8,
    step2Stage: 1,
    maxStep2Stage: 6,
    step3Stage: 1,
    maxStep3Stage: 6,
    step4Stage: 1,
    maxStep4Stage: 5,
    step5Stage: 1,
    maxStep5Stage: 3,

    // 矢印ナビゲーション用
    arrows: [],

    // ステップ4 複数路線管理用
    step4Lines: [],
    activeLineIndex: -1,

    // 実績管理用 (メダル)
    achievements: {
        step1First: false, step1All: false,
        step2First: false, step2All: false,
        step3First: false, step3All: false,
        step4First: false, step4All: false,
        step5First: false, step5All: false,
        completeAll: false
    }
};

// --- Achievements (LocalStorage) ---
function loadAchievements() {
    try {
        const saved = localStorage.getItem('okojo_rail_achievements');
        if (saved) {
            const parsed = JSON.parse(saved);
            State.achievements = { ...State.achievements, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load achievements:', e);
    }
}

function saveAchievements() {
    try {
        localStorage.setItem('okojo_rail_achievements', JSON.stringify(State.achievements));
    } catch (e) {
        console.error('Failed to save achievements:', e);
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
    loadAchievements();
    renderAchievements();

    // ステップカード
    document.querySelectorAll('.step-card').forEach(card => {
        card.addEventListener('click', () => {
            initAudio();
            const step = parseInt(card.dataset.step);
            showScreen('screen-game');
            loadStep(step);
        });
    });

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

    // 駅の色パレット
    document.querySelectorAll('#palette-station .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('#palette-station .color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            document.documentElement.style.setProperty('--station-color', sw.dataset.color);
        });
    });

    // 電車の色パレット
    document.querySelectorAll('#palette-train .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('#palette-train .color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            document.documentElement.style.setProperty('--train-color', sw.dataset.color);
        });
    });

    // クリアオーバーレイ：つづける
    btnContinue.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');

        // 全ステップ共通のステージ進行処理
        const currentStageKey = `step${State.step}Stage`;
        const maxStageKey = `maxStep${State.step}Stage`;

        if (State[currentStageKey] >= State[maxStageKey]) {
            // 全クリ時はトップへ戻り、進捗リセット
            State[currentStageKey] = 1;
            clearCanvas();
            showScreen('screen-top');
        } else {
            // 次のコースへ進む
            State[currentStageKey]++;
            loadStep(State.step);
        }
    });

    // クリアオーバーレイ：トップへ
    btnBackTop.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');
        clearCanvas();
        showScreen('screen-top');
    });

    btnHome.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');
        clearCanvas();
        // ホームに戻ったら面進捗はすべてリセットする
        for (let i = 1; i <= 5; i++) {
            State[`step${i}Stage`] = 1;
        }
        renderAchievements();
        showScreen('screen-top');
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
    stepIndicator.textContent = `ステップ ${State.step}`;
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

function loadStep(stepNumber) {
    clearCanvas();
    State.step = stepNumber;
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

    drawBackground();

    if (stepNumber === 1) initStep1();
    else if (stepNumber === 2) initStep2();
    else if (stepNumber === 3) initStep3();
    else if (stepNumber === 4) initStep4();
    else if (stepNumber === 5) initStep5();
    else setOkojoText(`ステップ ${stepNumber} は じゅんびちゅう だよ！`);
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
    rect.setAttribute('fill', color ? color : 'var(--train-color)');
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
        if (State.step4Lines[lineIndex] && State.step4Lines[lineIndex].isCompleted) return;

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
// ステップ1：直線をなぞる（ランダム次から方向発進）
// ============================
function generateStep1Path() {
    const len = State.railLength * 200; // 1: 200, 2: 400, 3: 600
    const center = { x: 400, y: 300 };

    // 1〜8ステージの出題方向（右、左、下、上、右下、右上、左下、左上）
    const angles = [
        0,                // 1: 右
        Math.PI,          // 2: 左
        Math.PI / 2,      // 3: 下
        -Math.PI / 2,     // 4: 上
        Math.PI / 4,      // 5: 右下
        -Math.PI / 4,     // 6: 右上
        Math.PI * 3 / 4,  // 7: 左下
        -Math.PI * 3 / 4  // 8: 左上
    ];

    const stageIndex = Math.max(0, Math.min(7, State.step1Stage - 1));
    const angle = angles[stageIndex];

    const startX = center.x - (len / 2) * Math.cos(angle);
    const startY = center.y - (len / 2) * Math.sin(angle);
    const endX = center.x + (len / 2) * Math.cos(angle);
    const endY = center.y + (len / 2) * Math.sin(angle);

    return `M ${startX},${startY} L ${endX},${endY}`;
}

function initStep1() {
    setOkojoText(`【線をなぞろう】でんしゃ を さわって、えき まで はこんでね！ （${State.step1Stage}/${State.maxStep1Stage}）`);
    const pathData = generateStep1Path();
    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();

    // 軌跡パス（進行した分だけ光る）
    State.trailPath = createTrailPath(pathData, State.pathLength);

    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);

    // 進行方向の矢印を描画
    drawDirectionArrows(State.currentPathNode, 3);

    // 見切れ防止: レール全体が収まるようSVG領域を調整
    adjustViewBoxToFitPath(State.currentPathNode);

    State.trainNode = drawTrain(startPoint.x, startPoint.y);
    setupTrainDrag(State.trainNode);
}

// ============================
// ステップ2：曲線をなぞる（ランダム）
// ============================
function generateStep2Path() {
    const len = State.railLength * 200;
    const center = { x: 400, y: 300 };

    // 1〜6ステージの出題パターン
    // 1: 右C (右方向へ進みつつ膨らむ)
    // 2: 左C
    // 3: 上C
    // 4: 下C
    // 5: 横S (右方向へ進むS字)
    // 6: 縦S (下方向へ進むS字)
    const patterns = [
        { dir: 'right', type: 0 }, // 1
        { dir: 'left', type: 0 }, // 2
        { dir: 'up', type: 0 }, // 3
        { dir: 'down', type: 0 }, // 4
        { dir: 'right', type: 1 }, // 5
        { dir: 'down', type: 1 }  // 6
    ];

    const stageIndex = Math.max(0, Math.min(5, State.step2Stage - 1));
    const p = patterns[stageIndex];

    const dir = p.dir;
    const curveType = p.type; // 0: アーチ(C), 1: S字(S)

    let angle = 0;
    switch (dir) {
        case 'right': angle = 0; break;
        case 'left': angle = Math.PI; break;
        case 'down': angle = Math.PI / 2; break;
        case 'up': angle = -Math.PI / 2; break;
    }

    const startX = center.x - (len / 2) * Math.cos(angle);
    const startY = center.y - (len / 2) * Math.sin(angle);
    const endX = center.x + (len / 2) * Math.cos(angle);
    const endY = center.y + (len / 2) * Math.sin(angle);

    const perpAngle = angle + Math.PI / 2;
    // 膨らみ具合（長さ設定に応じて調整）
    const curveAmount = 100 + State.railLength * 25; // Cカーブの膨らむ方向を一定にするためMath.randomを排除

    if (curveType === 0) {
        const cx = center.x + curveAmount * Math.cos(perpAngle);
        const cy = center.y + curveAmount * Math.sin(perpAngle);
        return `M ${startX},${startY} Q ${cx},${cy} ${endX},${endY}`;
    } else {
        const d = len / 3;
        const c1x = startX + d * Math.cos(angle) + curveAmount * Math.cos(perpAngle);
        const c1y = startY + d * Math.sin(angle) + curveAmount * Math.sin(perpAngle);

        let c2CurveAmount = -curveAmount; // S字の場合は逆側へ

        const c2x = endX - d * Math.cos(angle) + c2CurveAmount * Math.cos(perpAngle);
        const c2y = endY - d * Math.sin(angle) + c2CurveAmount * Math.sin(perpAngle);

        return `M ${startX},${startY} C ${c1x},${c1y} ${c2x},${c2y} ${endX},${endY}`;
    }
}

function initStep2() {
    setOkojoText(`【曲線をなぞろう】くねくねレール だよ！ えき まで はこんでね！ （${State.step2Stage}/${State.maxStep2Stage}）`);
    const pathData = generateStep2Path();

    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();
    State.stops = []; // 曲線は止まらず一気に進める

    // 軌跡パス
    State.trailPath = createTrailPath(pathData, State.pathLength);

    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);

    // 進行方向の矢印を描画
    drawDirectionArrows(State.currentPathNode, 3);

    // 見切れ防止処理
    adjustViewBoxToFitPath(State.currentPathNode);

    State.trainNode = drawTrain(startPoint.x, startPoint.y);
    setupTrainDrag(State.trainNode);
}

// ============================
// ステップ3：かどに気づく（元ステップ2、ランダム）
// ============================

// 直線座標列からSVGパスと停止点を自動計算するヘルパー
function buildLinePath(points) {
    const d = 'M ' + points.map(p => `${p[0]},${p[1]}`).join(' L ');
    const stops = [];
    let cumLen = 0;
    for (let i = 1; i < points.length - 1; i++) {
        cumLen += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        stops.push({ length: cumLen, x: points[i][0], y: points[i][1] });
    }
    return { d, stops };
}

function generateStep3Path() {
    const len = State.railLength * 200;
    const center = { x: 400, y: 300 };

    const w = len * 0.8;
    const h = len * 0.6;

    const xMin = center.x - w / 2;
    const xMax = center.x + w / 2;
    const yMin = center.y - h / 2;
    const yMax = center.y + h / 2;

    // 1〜6ステージの出題パターン
    // 1: 右下L (右に進んで下へ)
    // 2: 下左L (下に進んで左へ)
    // 3: 左上L (左に進んで上へ)
    // 4: 上右L (上に進んで右へ)
    // 5: 右下右Z (右→下→右)
    // 6: 下右下Z (下→右→下)
    const patterns = [
        { dir: 'right', isZ: false }, // 1
        { dir: 'down', isZ: false }, // 2
        { dir: 'left', isZ: false }, // 3
        { dir: 'up', isZ: false }, // 4
        { dir: 'right', isZ: true },  // 5
        { dir: 'down', isZ: true }   // 6
    ];

    const stageIndex = Math.max(0, Math.min(5, State.step3Stage - 1));
    const p = patterns[stageIndex];
    const dir = p.dir;
    const isZShape = p.isZ;

    let start, corner, end, c1, c2;

    if (!isZShape) {
        if (dir === 'right') {
            start = [xMin, yMin];
            corner = [xMax, yMin];
            end = [xMax, yMax];
        } else if (dir === 'down') {
            start = [xMax, yMin];
            corner = [xMax, yMax];
            end = [xMin, yMax];
        } else if (dir === 'left') {
            start = [xMax, yMax];
            corner = [xMin, yMax];
            end = [xMin, yMin];
        } else { // 'up'
            start = [xMin, yMax];
            corner = [xMin, yMin];
            end = [xMax, yMin];
        }
        return [start, corner, end];
    } else {
        if (dir === 'right') {
            const stepW = w / 2;
            const stepH = h;
            start = [xMin, yMin];
            c1 = [center.x, yMin];
            c2 = [center.x, yMax];
            end = [xMax, yMax];
        } else { // 'down'
            const stepW = w;
            const stepH = h / 2;
            start = [xMin, yMin];
            c1 = [xMin, center.y];
            c2 = [xMax, center.y];
            end = [xMax, yMax];
        }
        return [start, c1, c2, end];
    }
}

function initStep3() {
    setOkojoText(`【かどにきづこう】「かど」が あるよ！ レールを なぞって はこんでね！ （${State.step3Stage}/${State.maxStep3Stage}）`);
    const pts = generateStep3Path();
    const { d: pathData, stops } = buildLinePath(pts);
    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();
    State.stops = []; // 角での停止判定を無効化し、一筆書きにする
    State.trailPath = createTrailPath(pathData, State.pathLength);
    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);

    // 進行方向の矢印を描画
    drawDirectionArrows(State.currentPathNode, 4);

    // 見切れ防止処理
    adjustViewBoxToFitPath(State.currentPathNode);

    State.trainNode = drawTrain(startPoint.x, startPoint.y);
    setupTrainDrag(State.trainNode);
}


// ============================
// ステップ4：こうさ（クロス）をなぞる (複数車両・全8ステージ制)
// ============================
function generateStep4Path() {
    const center = { x: 400, y: 300 };
    const stage = State.step4Stage;
    // レールの長さ設定 (1: みじかい, 2: ふつう, 3: ながい) に応じて全体スケールを劇的に調整
    // 上限で頭打ちにならないようMath.minを廃止し、倍率の差を大きく取る
    const lengthFactor = State.railLength === 1 ? 0.5 : (State.railLength === 3 ? 1.8 : 1.0);
    // デフォルトサイズが小さすぎるという意見を受け、基本スケールを2倍に変更
    const scale = (1.2 + (stage * 0.1)) * lengthFactor;

    if (stage === 1) {
        // --- 1面: 十字 (2車両) ---
        const s = 150 * scale;
        return [
            `M ${center.x},${center.y - s} L ${center.x},${center.y + s}`, // タテ
            `M ${center.x - s},${center.y} L ${center.x + s},${center.y}`  // ヨコ
        ];
    } else if (stage === 2) {
        // --- 2面: T字 (2車両) ---
        const s = 150 * scale;
        return [
            `M ${center.x - s},${center.y - 50 * scale} L ${center.x + s},${center.y - 50 * scale}`, // 上部のヨコ
            `M ${center.x},${center.y + s} L ${center.x},${center.y - 50 * scale}` // 下から上へのタテ
        ];
    } else if (stage === 3) {
        // --- 3面: 斜め交差 (X字, 2車両) ---
        const s = 140 * scale;
        return [
            `M ${center.x - s},${center.y - s} L ${center.x + s},${center.y + s}`, // 左上から右下
            `M ${center.x + s},${center.y - s} L ${center.x - s},${center.y + s}`  // 右上から左下
        ];
    } else if (stage === 4) {
        // --- 4面: キ (3車両) ---
        const w = 150 * scale;
        const h = 180 * scale;
        return [
            `M ${center.x - w},${center.y - 60 * scale} L ${center.x + w},${center.y - 60 * scale}`, // 上ヨコ
            `M ${center.x - w},${center.y + 20 * scale} L ${center.x + w},${center.y + 20 * scale}`, // 中ヨコ
            `M ${center.x},${center.y - h} L ${center.x},${center.y + h}` // タテ
        ];
    } else if (stage === 5) {
        // --- 5面: 井 (4車両) ---
        const w = 160 * scale;
        const h = 160 * scale;
        const offset = 60 * scale;
        return [
            `M ${center.x - offset},${center.y - h} L ${center.x - offset},${center.y + h}`, // 左タテ
            `M ${center.x + offset},${center.y - h} L ${center.x + offset},${center.y + h}`, // 右タテ
            `M ${center.x - w},${center.y - offset} L ${center.x + w},${center.y - offset}`, // 上ヨコ
            `M ${center.x - w},${center.y + offset} L ${center.x + w},${center.y + offset}`  // 下ヨコ
        ];
    }
}

// ============================
// ステップ5：こうさを なぞろう② (1筆書きの複雑な図形)
// ============================
function generateStep5Path() {
    const center = { x: 400, y: 300 };
    const stage = State.step5Stage;
    const lengthFactor = State.railLength === 1 ? 0.5 : (State.railLength === 3 ? 1.8 : 1.0);
    // デフォルトサイズが小さすぎるという意見を受け、基本スケールを2倍に変更
    const scale = (1.2 + (stage * 0.2)) * lengthFactor;

    if (stage === 1) {
        // --- 1面: 4の字 (1筆書き) ---
        const w = 140 * scale;
        const h = 140 * scale;
        return `M ${center.x + w / 2},${center.y + h / 2} L ${center.x - w / 2},${center.y + h / 2} L ${center.x},${center.y - h} L ${center.x},${center.y + h}`;
    } else if (stage === 2) {
        // --- 2面: 星型 (☆, 1筆書き) ---
        const r = 160 * scale;
        const pts = [];
        for (let i = 0; i <= 5; i++) {
            const angle = -Math.PI / 2 + (i * 144) * (Math.PI / 180);
            pts.push({
                x: center.x + r * Math.cos(angle),
                y: center.y + r * Math.sin(angle)
            });
        }
        return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y} L ${pts[2].x},${pts[2].y} L ${pts[3].x},${pts[3].y} L ${pts[4].x},${pts[4].y} L ${pts[5].x},${pts[5].y}`;
    } else {
        // --- 3面: 8の字 (無限大, 1筆書き) ---
        const w = 180 * scale;
        const h = 120 * scale;
        return `M ${center.x},${center.y} C ${center.x + w},${center.y - h} ${center.x + w},${center.y + h} ${center.x},${center.y} C ${center.x - w},${center.y - h} ${center.x - w},${center.y + h} ${center.x},${center.y}`;
    }
}

function initStep5() {
    const stageNames = ['4の字', '星', '8の字'];
    const stageName = stageNames[State.step5Stage - 1];
    setOkojoText(`【${stageName}】こうさを なぞろう！ （${State.step5Stage}/${State.maxStep5Stage}）`);

    const pathData = generateStep5Path();

    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();
    State.stops = []; // 角での停止判定を無効化し、一筆書きにする
    State.trailPath = createTrailPath(pathData, State.pathLength);

    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y, '#E91E63');
    drawStation(endPoint.x, endPoint.y, '#E91E63');

    // 進行方向の矢印
    drawDirectionArrows(State.currentPathNode, 4, '#E91E63');

    // サイズがはみ出ないように全体をフィットさせる
    adjustViewBoxToFitPath(State.currentPathNode);

    State.trainNode = drawTrain(startPoint.x, startPoint.y, '#E91E63');
    setupTrainDrag(State.trainNode);
}

function initStep4() {
    const stageNames = ['十字', 'T字', '斜め交差', 'キ', '井', '4の字', '星', '8の字'];
    const stageName = stageNames[State.step4Stage - 1];
    if (State.step4Stage <= 5) {
        setOkojoText(`【${stageName}】でんしゃ を それぞれの えき に はこんでね！ （${State.step4Stage}/${State.maxStep4Stage}）`);
    } else {
        setOkojoText(`【${stageName}】こうさを なぞろう！ （${State.step4Stage}/${State.maxStep4Stage}）`);
    }

    const pathsData = generateStep4Path();

    State.step4Lines = [];
    State.activeLineIndex = -1;
    const colors = ['#E91E63', '#2196F3', '#4CAF50', '#FF9800']; // ピンク, 青, 緑, オレンジ

    pathsData.forEach((pathData, index) => {
        const pathNode = createRailPath(pathData);
        const pathLength = pathNode.getTotalLength();
        const trailPath = createTrailPath(pathData, pathLength);

        const startPoint = pathNode.getPointAtLength(0);
        const endPoint = pathNode.getPointAtLength(pathLength);

        const isMultiLine = pathsData.length > 1;
        const color = isMultiLine ? colors[index % colors.length] : undefined;

        drawStation(startPoint.x, startPoint.y, color);
        drawStation(endPoint.x, endPoint.y, color);

        const lineObj = {
            pathNode: pathNode,
            pathLength: pathLength,
            trailPath: trailPath,
            trainNode: null,
            trainProgress: 0,
            isCompleted: false,
        };
        State.step4Lines.push(lineObj);

        drawDirectionArrows(pathNode, 4, color || '#E91E63', index);

        const trainNode = drawTrain(startPoint.x, startPoint.y, color);
        lineObj.trainNode = trainNode;

        // ドラッグ設定
        if (isMultiLine) {
            setupMultiTrainDrag(trainNode, index);
        } else {
            // 後半ステージは従来の変数(State.trainNode等)に依存している部分の互換性を持たせるため
            State.trainNode = trainNode;
            State.currentPathNode = pathNode;
            State.pathLength = pathLength;
            State.trailPath = trailPath;
            State.stops = [];
            setupTrainDrag(trainNode);
        }
    });

    if (State.step4Lines.length > 0) {
        // 全ての描画パスの配列を渡して、表示領域が全体にフィットするように計算する
        const allPaths = State.step4Lines.map(line => line.pathNode);
        adjustViewBoxToFitPath(allPaths);
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

    // ステップ4の複数路線の場合は線のデータに紐づけ、それ以外はState.arrowsに入れる
    if (lineIndex >= 0 && State.step4Lines) {
        if (!State.step4Lines[lineIndex].arrows) {
            State.step4Lines[lineIndex].arrows = [];
        }
        State.step4Lines[lineIndex].arrows = createdArrows;
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

        const isMultiLine = State.activeLineIndex >= 0 && State.step4Lines;
        if (isMultiLine) {
            const lineData = State.step4Lines[State.activeLineIndex];
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

        // 進行判定を「軌跡接線への投影」から「ローカル範囲での近傍点スナップ」に変更
        // 星形のような鋭角交差でも引っかからず自然に曲がれるよう、進行方向（前方）の探索範囲を広げる
        const searchBackward = 30;   // 後退の許容範囲
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

        // ストップポイントチェック
        if (!isMultiLine && State.stops && State.stops.length > State.currentStopIndex) {
            const nextStop = State.stops[State.currentStopIndex];
            if (trainProgress <= nextStop.length && nextProgress >= nextStop.length - 5) {
                nextProgress = nextStop.length;
                try { trainNode.releasePointerCapture(e.pointerId); } catch (ex) { }
                State.waitingForTap = true;
                State.isDragging = false;
                trainNode.classList.remove('active');
                showCornerPrompt(nextStop);
            }
        }

        trainProgress = nextProgress;

        if (isMultiLine) {
            State.step4Lines[State.activeLineIndex].trainProgress = trainProgress;
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
                State.step4Lines[State.activeLineIndex].isCompleted = true;
                trainNode.classList.remove('active');
                playSound('success');
                const allCompleted = State.step4Lines.every(line => line.isCompleted);
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
        if (State.activeLineIndex >= 0 && State.step4Lines && State.step4Lines[State.activeLineIndex]) {
            State.step4Lines[State.activeLineIndex].trainNode.classList.remove('active');
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
    // ステップ1〜5共通のステージ制用クリア画面
    const total = State[`maxStep${State.step}Stage`];
    const cur = State[`step${State.step}Stage`];
    const allDone = (cur >= total);

    // 実績判定と保存処理
    let newlyEarned = null; // 'first' | 'all' | 'complete'
    const ach = State.achievements;

    // 1面クリア実績判定
    if (cur === 1 && !ach[`step${State.step}First`]) {
        ach[`step${State.step}First`] = true;
        newlyEarned = 'first';
    }
    // ステップ全部クリア実績判定
    if (allDone && !ach[`step${State.step}All`]) {
        ach[`step${State.step}All`] = true;
        newlyEarned = 'all';
    }

    // 全ステップ完全制覇の判定
    const isCompleteAll = [1, 2, 3, 4, 5].every(s => ach[`step${s}All`]);
    if (isCompleteAll && !ach.completeAll) {
        ach.completeAll = true;
        newlyEarned = 'complete';
    }

    if (newlyEarned) {
        saveAchievements();
        playSound('fanfare');
    }

    roundIndicator.textContent = `${cur} / ${total}`;

    if (allDone) {
        clearMessage.textContent = 'ぜんぶクリア！すごい！';
        clearProgress.textContent = `${total}つのコースを 全部できたよ！`;
        btnContinue.textContent = 'トップにもどる >';

        let okojoMsg = 'ぜんぶ クリア！ ほんとうに すごいね！ はなまる だよ！';
        if (newlyEarned === 'complete') okojoMsg = 'ついに レールマスター だね！ おめでとう！！ ぜんぶのメダルがあつまったよ！';
        else if (newlyEarned === 'all') okojoMsg = 'ステップせいは メダル を ゲットしたよ！ すごい！';
        setOkojoText(okojoMsg);
    } else {
        clearMessage.textContent = 'クリア！';
        clearProgress.textContent = `${cur} / ${total} くりあ！`;
        btnContinue.textContent = 'つぎのコースへ ▶';

        let okojoMsg = 'クリア！ すごいね！ よくできたよ！';
        if (newlyEarned === 'first') okojoMsg = 'ちょうせんメダル を ゲットしたよ！ このちょうしで がんばれ！';
        setOkojoText(okojoMsg);
    }

    setTimeout(() => { clearOverlay.classList.remove('hidden'); }, 800);
}

// --- Finishes ---
function finishStep(customMsg = 'やったね！えきに ついたよ！', playTrainAnim = false) {
    State.isDragging = false;
    State.isStepCompleted = true;
    if (State.trainNode) {
        State.trainNode.classList.remove('active');
        State.trainNode.classList.add('success-fx');
    }
    playSound('success');
    setOkojoText(customMsg);

    // 全ステップ共通：回数設定に基づいてオーバーレイを表示
    showClearOverlay(customMsg);
}

function finishStep4(node) {
    State.isStepCompleted = true;
    State.isDragging = false;
    node.classList.add('success-fx');
    document.querySelectorAll('.draggable-shape').forEach(n => {
        if (n !== node) { n.style.opacity = '0.2'; n.style.pointerEvents = 'none'; }
    });
    const msg = (State.step === State.maxStep)
        ? 'ぜんぶ クリア だよ！ すごい！ おめでとう！！'
        : 'だいせいかい！ ピタッと かさなったね！';
    playSound(State.step === State.maxStep ? 'fanfare' : 'success');
    showClearOverlay(msg);
}

// --- 実績（メダル）UIのレンダリング ---
function renderAchievements() {
    const ach = State.achievements;

    // 1. 各ステップカードへのメダル描画
    const cards = document.querySelectorAll('.step-card');
    cards.forEach(card => {
        const step = parseInt(card.dataset.step);
        let medalsHtml = '';

        // まずコンテナがあるか確認、なければ追加
        let container = card.querySelector('.medal-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'medal-container';
            card.appendChild(container);
        }

        // 挑戦メダル (1面クリア)
        if (ach[`step${step}First`]) {
            medalsHtml += `<div class="medal medal-bronze" title="ちょうせんメダル">★</div>`;
        }
        // 制覇メダル (全部クリア)
        if (ach[`step${step}All`]) {
            medalsHtml += `<div class="medal medal-silver" title="ステップせいは！">👑</div>`;
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
        }
    }
}

// --- コレクション画面（screen-achievements）のレンダリング ---
function renderAchievementsScreen() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const ach = State.achievements;
    const stepNames = [
        '<ruby>線<rt>せん</rt></ruby>を なぞろう',
        '<ruby>曲線<rt>きょくせん</rt></ruby>を なぞろう',
        'かどに きづこう',
        'こうさを なぞろう',
        'こうさを なぞろう②'
    ];

    // ステップ1〜5のメダルを順に生成
    for (let i = 1; i <= 5; i++) {
        // --- 挑戦メダル (1面クリア) ---
        const firstEarned = ach[`step${i}First`];
        const firstItem = document.createElement('div');
        firstItem.className = `achievement-item ${firstEarned ? '' : 'locked'}`;
        firstItem.innerHTML = `
            <div class="achievement-icon ${firstEarned ? 'medal-bronze' : 'medal-locked'}">
                ${firstEarned ? '★' : '?'}
            </div>
            <div class="achievement-info">
                <div class="achievement-title">ステップ${i} ちょうせん</div>
                <div class="achievement-desc">「${stepNames[i - 1]}」の 1<ruby>面<rt>めん</rt></ruby>を クリアしたよ</div>
            </div>
        `;
        grid.appendChild(firstItem);

        // --- 制覇メダル (全部クリア) ---
        const allEarned = ach[`step${i}All`];
        const allItem = document.createElement('div');
        allItem.className = `achievement-item ${allEarned ? '' : 'locked'}`;
        allItem.innerHTML = `
            <div class="achievement-icon ${allEarned ? 'medal-silver' : 'medal-locked'}">
                ${allEarned ? '👑' : '?'}
            </div>
            <div class="achievement-info">
                <div class="achievement-title">ステップ${i} せいは</div>
                <div class="achievement-desc">「${stepNames[i - 1]}」の <ruby>全<rt>ぜん</rt></ruby>コースを クリアしたよ</div>
            </div>
        `;
        grid.appendChild(allItem);
    }

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
            <div class="achievement-desc">すべての ステップの <ruby>全<rt>ぜん</rt></ruby>コースを クリアした <ruby>大天才<rt>だいてんさい</rt></ruby>！！</div>
        </div>
    `;
    grid.appendChild(compItem);
}

// Boot
window.onload = init;

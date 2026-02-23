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
    step1TotalRounds: 1,
    step1CurrentRound: 0,
};

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
    // ステップカード
    document.querySelectorAll('.step-card').forEach(card => {
        card.addEventListener('click', () => {
            initAudio();
            const step = parseInt(card.dataset.step);
            State.step1CurrentRound = 0;
            showScreen('screen-game');
            loadStep(step);
        });
    });

    // 連続回数ボタン（設定モーダル内）
    document.querySelectorAll('.round-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.step1TotalRounds = parseInt(btn.dataset.rounds);
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
        const total = State.step1TotalRounds;
        const allDone = total !== 0 && State.step1CurrentRound >= total;
        if (allDone) State.step1CurrentRound = 0;
        loadStep(State.step);
    });

    // クリアオーバーレイ：トップへ
    btnBackTop.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');
        clearCanvas();
        svg.removeEventListener('pointerdown', startSvgDraw);
        showScreen('screen-top');
    });

    btnHome.addEventListener('click', () => {
        clearOverlay.classList.add('hidden');
        clearCanvas();
        svg.removeEventListener('pointerdown', startSvgDraw);
        showScreen('screen-top');
    });

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
    svg.removeEventListener('pointerdown', startSvgDraw);
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

    // 空（うす水色）
    const sky = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    sky.setAttribute('x', '0'); sky.setAttribute('y', '0');
    sky.setAttribute('width', '100%'); sky.setAttribute('height', '130');
    sky.setAttribute('fill', '#e1f5fe');
    bgLayer.appendChild(sky);

    // 地面（うす緑）
    const ground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ground.setAttribute('x', '0'); ground.setAttribute('y', '130');
    ground.setAttribute('width', '100%'); ground.setAttribute('height', '100%');
    ground.setAttribute('fill', '#f1f8e9');
    bgLayer.appendChild(ground);

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
    ties.setAttribute('stroke-width', '24');
    ties.setAttribute('stroke-dasharray', '8 40');
    ties.setAttribute('fill', 'none');
    layerRails.appendChild(ties);

    // レール2本作成用のマスク
    const maskId = 'mask-' + Math.random().toString(36).substr(2, 9);
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', maskId);

    const maskBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskBg.setAttribute('width', '100%'); maskBg.setAttribute('height', '100%');
    maskBg.setAttribute('fill', 'white');
    mask.appendChild(maskBg);

    const maskPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    maskPath.setAttribute('d', pathData);
    maskPath.setAttribute('fill', 'none');
    maskPath.setAttribute('stroke', 'black'); // くり抜く部分
    maskPath.setAttribute('stroke-width', '12'); // レールの間の隙間
    mask.appendChild(maskPath);
    layerRails.appendChild(mask);

    // ダブルレール本体
    const rail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rail.setAttribute('d', pathData);
    rail.setAttribute('mask', `url(#${maskId})`);
    rail.setAttribute('stroke', '#546e7a'); // レール自体の色
    rail.setAttribute('stroke-width', '22');
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
    trail.setAttribute('stroke-width', '14');
    trail.setAttribute('stroke-linecap', 'round');
    trail.setAttribute('stroke-linejoin', 'round');
    trail.setAttribute('stroke-dasharray', `${totalLength} ${totalLength}`);
    trail.setAttribute('stroke-dashoffset', totalLength); // 最初は全部非表示
    trail.setAttribute('opacity', '0.85');
    layerRails.appendChild(trail);
    return trail;
}

function drawStation(x, y) {
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
    group.appendChild(rect);

    // 三角屋根（茶色）
    const roof = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    roof.setAttribute('d', 'M -35,-20 L 0,-45 L 35,-20 Z');
    roof.setAttribute('fill', '#8d6e63'); // 茶色
    group.appendChild(roof);

    layerRails.appendChild(group);
}

function drawTrain(x, y) {
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
    rect.setAttribute('rx', 14); rect.setAttribute('fill', 'var(--train-color)');
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
        node.setPointerCapture(e.pointerId);
        State.lastTrainDragPt = getSVGPoint(e);
        node.classList.add('active');
    });
}

// ============================
// ステップ1：直線をなぞる（ランダム次から方向発進）
// ============================
const STEP1_PATTERNS = [
    { path: "M 100,300 L 700,300", label: "左から右" },
    { path: "M 700,300 L 100,300", label: "右から左" },
    { path: "M 400,100 L 400,500", label: "上から下" },
    { path: "M 400,500 L 400,100", label: "下から上" },
    { path: "M 100,450 L 700,150", label: "左下から右上" },
    { path: "M 700,150 L 100,450", label: "右上から左下" },
];

function initStep1() {
    // 毎回ランダムにパターンを選ぶ
    const pattern = STEP1_PATTERNS[Math.floor(Math.random() * STEP1_PATTERNS.length)];
    const pathData = pattern.path;

    setOkojoText('でんしゃ を さわって、えき まで はこんでね！');
    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();

    // 軌跡パス（進行した分だけ光る）
    State.trailPath = createTrailPath(pathData, State.pathLength);

    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);

    State.trainNode = drawTrain(startPoint.x, startPoint.y);
    setupTrainDrag(State.trainNode);
}

// ============================
// ステップ2：かどに気づく（ランダム）
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

const STEP2_PATTERNS = [
    // L字 縦先→横 4方向
    { pts: [[150, 450], [150, 150], [650, 150]] },
    { pts: [[650, 450], [650, 150], [150, 150]] },
    { pts: [[150, 150], [150, 450], [650, 450]] },
    { pts: [[650, 150], [650, 450], [150, 450]] },
    // L字 横先→縦 4方向
    { pts: [[150, 150], [650, 150], [650, 450]] },
    { pts: [[650, 150], [150, 150], [150, 450]] },
    { pts: [[150, 450], [650, 450], [650, 150]] },
    { pts: [[650, 450], [150, 450], [150, 150]] },
    // Z字（2コーナー）4方向
    { pts: [[150, 200], [430, 200], [370, 400], [650, 400]] },
    { pts: [[650, 400], [370, 400], [430, 200], [150, 200]] },
    { pts: [[150, 400], [430, 400], [370, 200], [650, 200]] },
    { pts: [[650, 200], [370, 200], [430, 400], [150, 400]] },
];

function initStep2() {
    setOkojoText('「かど」が あるよ！ とちゅうで すこし まってね！');
    const pattern = STEP2_PATTERNS[Math.floor(Math.random() * STEP2_PATTERNS.length)];
    const { d: pathData, stops } = buildLinePath(pattern.pts);
    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();
    State.stops = stops;
    State.trailPath = createTrailPath(pathData, State.pathLength);
    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);
    State.trainNode = drawTrain(startPoint.x, startPoint.y);
    setupTrainDrag(State.trainNode);
}

// ============================
// ステップ3：せんろをつくる（ランダム）
// ============================
const STEP3_PATTERNS = [
    // 長方形ループ（元）
    [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 450 }, { x: 200, y: 450 }, { x: 200, y: 200 }],
    // L字 3駅 4方向
    [{ x: 200, y: 450 }, { x: 200, y: 200 }, { x: 600, y: 200 }],
    [{ x: 600, y: 450 }, { x: 600, y: 200 }, { x: 200, y: 200 }],
    [{ x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 450 }],
    [{ x: 600, y: 200 }, { x: 200, y: 200 }, { x: 200, y: 450 }],
    // Z字 4駅 2方向
    [{ x: 150, y: 450 }, { x: 400, y: 450 }, { x: 400, y: 200 }, { x: 650, y: 200 }],
    [{ x: 150, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 450 }, { x: 650, y: 450 }],
    // U字（コの字）4駅 2方向
    [{ x: 200, y: 200 }, { x: 200, y: 450 }, { x: 600, y: 450 }, { x: 600, y: 200 }],
    [{ x: 200, y: 450 }, { x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 450 }],
    // W字（山形）5駅
    [{ x: 150, y: 450 }, { x: 300, y: 200 }, { x: 400, y: 350 }, { x: 500, y: 200 }, { x: 650, y: 450 }],
];

function initStep3() {
    setOkojoText('ピカピカの えき から じゅんばんに なぞって、せんろ を つくろう！');
    State.stations3 = STEP3_PATTERNS[Math.floor(Math.random() * STEP3_PATTERNS.length)];
    State.currentStationIndex3 = 0;

    const hintPath = `M ${State.stations3[0].x},${State.stations3[0].y} ` +
        State.stations3.slice(1).map(p => `L ${p.x},${p.y}`).join(' ');
    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    outline.setAttribute('d', hintPath);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', 'rgba(0,0,0,0.1)');
    outline.setAttribute('stroke-width', '24');
    outline.setAttribute('stroke-linecap', 'round');
    outline.setAttribute('stroke-dasharray', '10 10');
    layerRails.appendChild(outline);

    // ループの場合は最後の点（=先頭と同じ）をスキップ、それ以外は全駅描画
    const isLoop = State.stations3[0].x === State.stations3[State.stations3.length - 1].x &&
        State.stations3[0].y === State.stations3[State.stations3.length - 1].y;
    State.stations3.forEach((p, i) => {
        if (isLoop && i === State.stations3.length - 1) return;
        drawStation(p.x, p.y);
    });
    updateStep3Indicator();
    svg.addEventListener('pointerdown', startSvgDraw);
}

function updateStep3Indicator() {
    layerActive.innerHTML = '';
    if (State.currentStationIndex3 < State.stations3.length - 1) {
        const p = State.stations3[State.currentStationIndex3];
        const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        indicator.setAttribute('cx', p.x);
        indicator.setAttribute('cy', p.y);
        indicator.setAttribute('class', 'corner-indicator');
        indicator.setAttribute('style', 'pointer-events: none;');
        layerActive.appendChild(indicator);
    }
}

function startSvgDraw(e) {
    if (State.step !== 3 || State.isStepCompleted) return;
    initAudio();
    const pt = getSVGPoint(e);
    const startP = State.stations3[State.currentStationIndex3];
    if (Math.hypot(pt.x - startP.x, pt.y - startP.y) < 50) {
        State.isDragging = true;
        State.dragType = 'line';
        svg.setPointerCapture(e.pointerId);
        State.drawingLineNode = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        State.drawingLineNode.setAttribute('x1', startP.x);
        State.drawingLineNode.setAttribute('y1', startP.y);
        State.drawingLineNode.setAttribute('x2', pt.x);
        State.drawingLineNode.setAttribute('y2', pt.y);
        State.drawingLineNode.setAttribute('class', 'rail-path');
        State.drawingLineNode.setAttribute('stroke', 'var(--accent-color)');
        layerRails.appendChild(State.drawingLineNode);
    }
}

// ============================
// ステップ4/5 共通：形状バリアント定義
// ============================
const SHAPE_VARIANTS = [
    {
        label: 'L字右下',
        targetPath: 'M -50,-50 L 50,-50 L 50,50',
        choices: [
            { path: 'M -50,-50 L 50,-50 L 50,50', correct: true },
            { path: 'M -50,-50 L -50,50 L 50,50', correct: false },
            { path: 'M -50,-50 L 50,-50 L 50,5', correct: false },
        ]
    },
    {
        label: 'L字左下',
        targetPath: 'M -50,-50 L -50,50 L 50,50',
        choices: [
            { path: 'M -50,-50 L -50,50 L 50,50', correct: true },
            { path: 'M -50,-50 L 50,-50 L 50,50', correct: false },
            { path: 'M -60,0 L 60,0', correct: false },
        ]
    },
    {
        label: '直線',
        targetPath: 'M -60,0 L 60,0',
        choices: [
            { path: 'M -60,0 L 60,0', correct: true },
            { path: 'M -50,-50 L 50,-50 L 50,50', correct: false },
            { path: 'M -50,-30 L 50,30', correct: false },
        ]
    },
    {
        label: 'Z字',
        targetPath: 'M -55,-30 L 0,-30 L 0,30 L 55,30',
        choices: [
            { path: 'M -55,-30 L 0,-30 L 0,30 L 55,30', correct: true },
            { path: 'M -55,30 L 0,30 L 0,-30 L 55,-30', correct: false },
            { path: 'M -50,-50 L 50,-50 L 50,50', correct: false },
        ]
    },
    {
        label: 'T字',
        targetPath: 'M -55,0 L 55,0 M 0,-45 L 0,25',
        choices: [
            { path: 'M -55,0 L 55,0 M 0,-45 L 0,25', correct: true },
            { path: 'M -50,-50 L 50,-50 L 50,50', correct: false },
            { path: 'M -60,0 L 60,0', correct: false },
        ]
    },
];

// ============================
// ステップ4：同定（入門）
// ============================
function initStep4() {
    setOkojoText('うえの おてほん と おなじ かたち を さがして、ピタッと あわせてね！');
    setupShapePuzzle(false);
}

// ============================
// ステップ5：回転と同定（応用）
// ============================
function initStep5() {
    setOkojoText('むき が ちがう かたち も あるよ！ まるいボタン で まわしてみてね！');
    setupShapePuzzle(true);
}

function setupShapePuzzle(withRotation) {
    // ランダムにバリアントを選択
    const variant = SHAPE_VARIANTS[Math.floor(Math.random() * SHAPE_VARIANTS.length)];

    // お手本表示
    const targetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    targetGroup.setAttribute('transform', `translate(${State.targetPos.x}, ${State.targetPos.y})`);
    const targetBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    targetBg.setAttribute('x', -90); targetBg.setAttribute('y', -90);
    targetBg.setAttribute('width', 180); targetBg.setAttribute('height', 180);
    targetBg.setAttribute('fill', 'rgba(0,0,0,0.05)'); targetBg.setAttribute('rx', 20);
    targetGroup.appendChild(targetBg);
    const targetPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    targetPath.setAttribute('d', variant.targetPath);
    targetPath.setAttribute('fill', 'none');
    targetPath.setAttribute('stroke', 'var(--rail-color)');
    targetPath.setAttribute('stroke-width', '15');
    targetPath.setAttribute('stroke-linecap', 'round');
    targetPath.setAttribute('stroke-linejoin', 'round');
    targetGroup.appendChild(targetPath);
    layerRails.appendChild(targetGroup);

    // 選択肢（ステップ5は正解の初期回転をランダムに設定）
    const rotAngles = [90, 180, -90];
    const choices = variant.choices.map(c => ({
        ...c,
        angle: (withRotation && c.correct)
            ? rotAngles[Math.floor(Math.random() * rotAngles.length)]
            : 0
    }));
    choices.sort(() => Math.random() - 0.5);

    choices.forEach((choice, index) => {
        const x = 200 + index * 200;
        const y = 450;
        const choiceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        choiceGroup.dataset.correct = String(choice.correct);
        choiceGroup.dataset.startX = x;
        choiceGroup.dataset.startY = y;
        choiceGroup.dataset.angle = choice.angle;
        choiceGroup.setAttribute('transform', `translate(${x}, ${y}) rotate(${choice.angle})`);
        choiceGroup.setAttribute('class', 'draggable-shape');
        choiceGroup.style.cursor = 'grab';

        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitArea.setAttribute('x', -80); hitArea.setAttribute('y', -80);
        hitArea.setAttribute('width', 160); hitArea.setAttribute('height', 160);
        hitArea.setAttribute('fill', 'transparent');
        choiceGroup.appendChild(hitArea);

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', -80); bg.setAttribute('y', -80);
        bg.setAttribute('width', 160); bg.setAttribute('height', 160);
        bg.setAttribute('fill', 'white'); bg.setAttribute('rx', 15);
        bg.setAttribute('stroke', '#ccc'); bg.setAttribute('stroke-width', '2');
        choiceGroup.appendChild(bg);

        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', choice.path);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'var(--station-color)');
        p.setAttribute('stroke-width', '15');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        choiceGroup.appendChild(p);

        if (withRotation) {
            const rHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            rHandle.setAttribute('cx', 80); rHandle.setAttribute('cy', 80);
            rHandle.setAttribute('r', 15); rHandle.setAttribute('class', 'rotate-handle');
            choiceGroup.appendChild(rHandle);
        }

        layerActive.appendChild(choiceGroup);
        choiceGroup.addEventListener('pointerdown', startShapeDrag);
    });
}

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
        if (!State.lastTrainDragPt) { State.lastTrainDragPt = pt; return; }

        // 指の移動差分（SVG座標系）
        const dx = pt.x - State.lastTrainDragPt.x;
        const dy = pt.y - State.lastTrainDragPt.y;
        State.lastTrainDragPt = pt;

        // 現在のパス上の接線ベクトルを求める
        const eps = 0.5;
        const safeLen = Math.max(0, Math.min(State.pathLength - eps, State.trainProgress));
        const p0 = State.currentPathNode.getPointAtLength(safeLen);
        const p1 = State.currentPathNode.getPointAtLength(safeLen + eps);
        const tLen = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
        const tx = (p1.x - p0.x) / tLen;
        const ty = (p1.y - p0.y) / tLen;

        // 移動差分を接線方向へ投影→進行量に加算
        const projected = dx * tx + dy * ty;
        let nextProgress = State.trainProgress + projected;
        nextProgress = Math.max(0, Math.min(State.pathLength, nextProgress));

        // ストップポイントチェック
        if (State.stops.length > State.currentStopIndex) {
            const nextStop = State.stops[State.currentStopIndex];
            if (State.trainProgress <= nextStop.length && nextProgress >= nextStop.length - 5) {
                nextProgress = nextStop.length;
                // 角到達時：PointerCaptureを解放してインジケーターをタップできるようにする
                try { State.trainNode.releasePointerCapture(e.pointerId); } catch (ex) { }
                State.waitingForTap = true;
                State.isDragging = false;
                State.trainNode.classList.remove('active');
                showCornerPrompt(nextStop);
            }
        }

        State.trainProgress = nextProgress;
        const p = State.currentPathNode.getPointAtLength(State.trainProgress);
        State.trainNode.setAttribute('transform', `translate(${p.x}, ${p.y})`);

        // 軌跡 (stroke-dashoffset) を進行量に合わせて更新
        if (State.trailPath) {
            State.trailPath.setAttribute('stroke-dashoffset', State.pathLength - State.trainProgress);
        }

        const now = Date.now();
        if (now - State.lastRunSoundTime > 150 && !State.waitingForTap) {
            playSound('run');
            State.lastRunSoundTime = now;
        }
        if (!State.waitingForTap && State.trainProgress >= State.pathLength - 5) {
            const endP = State.currentPathNode.getPointAtLength(State.pathLength);
            State.trainNode.setAttribute('transform', `translate(${endP.x}, ${endP.y})`);
            finishStep();
        }
    }
    // Line Drawing
    else if (State.dragType === 'line') {
        const targetP = State.stations3[State.currentStationIndex3 + 1];
        const distToTarget = Math.hypot(pt.x - targetP.x, pt.y - targetP.y);
        let endX = distToTarget < 60 ? targetP.x : pt.x;
        let endY = distToTarget < 60 ? targetP.y : pt.y;
        State.drawingLineNode.setAttribute('x2', endX);
        State.drawingLineNode.setAttribute('y2', endY);

        if (distToTarget < 60) {
            playSound('snap');
            State.isDragging = false;

            const x1 = State.drawingLineNode.getAttribute('x1');
            const y1 = State.drawingLineNode.getAttribute('y1');
            layerRails.removeChild(State.drawingLineNode);

            // 新しい2本線＆背景透過の統一スタイルで描画し直す
            createRailPath(`M ${x1},${y1} L ${endX},${endY}`);
            State.drawingLineNode = null;
            State.currentStationIndex3++;
            if (State.currentStationIndex3 < State.stations3.length - 1) {
                updateStep3Indicator();
            } else {
                finishStep("せんろ が かんせい したよ！ すごい！", true);
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

    if (State.dragType === 'train' && State.trainNode && !State.isStepCompleted && !State.waitingForTap) {
        State.trainNode.classList.remove('active');
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
    State.step1CurrentRound++;
    const total = State.step1TotalRounds;
    const cur = State.step1CurrentRound;
    const isInfinite = (total === 0);
    const allDone = !isInfinite && cur >= total;

    roundIndicator.textContent = isInfinite
        ? `${cur}かいめ`
        : `${cur} / ${total}`;

    if (allDone) {
        clearMessage.textContent = 'やった！　全部クリア！';
        clearProgress.textContent = `${total}かい 全部できたよ！`;
        btnContinue.textContent = 'もう1ゲーム >';
    } else {
        clearMessage.textContent = 'クリア！';
        clearProgress.textContent = isInfinite
            ? `${cur}かいめ クリア！`
            : `${cur} / ${total} くりあ！`;
        btnContinue.textContent = 'つづける ▶';
    }

    setOkojoText('クリア！ すごいね！ よくできたよ！');
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

    if (playTrainAnim && State.step === 3) {
        layerActive.innerHTML = '';
        const pathData = `M ${State.stations3[0].x},${State.stations3[0].y} ` +
            State.stations3.slice(1).map(p => `L ${p.x},${p.y}`).join(' ');
        const invisiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        invisiblePath.setAttribute('d', pathData); invisiblePath.setAttribute('fill', 'none');
        layerRails.appendChild(invisiblePath);
        const train = drawTrain(State.stations3[0].x, State.stations3[0].y);
        const totalLen = invisiblePath.getTotalLength();
        let startTime = null;
        function animate(time) {
            if (!startTime) startTime = time;
            let progress = (time - startTime) / 2000;
            if (progress > 1) progress = 1;
            const p = invisiblePath.getPointAtLength(progress * totalLen);
            train.setAttribute('transform', `translate(${p.x}, ${p.y})`);
            if (progress < 1) requestAnimationFrame(animate);
            else train.classList.add('success-fx');
        }
        setTimeout(() => { playSound('run'); requestAnimationFrame(animate); }, 500);
    }
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

// Boot
window.onload = init;

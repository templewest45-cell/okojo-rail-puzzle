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
    railLength: 2,
    railDirection: 'random',

    // ランダム連続防止用の履歴
    lastStep1Dir: null,
    lastStep2Str: null,
    lastStep3Str: null,

    // ステップ4のステージ用
    step4Stage: 1,
    maxStep4Stage: 8,

    // 矢印ナビゲーション用
    arrows: [],

    // ステップ4 複数路線管理用
    step4Lines: [],
    activeLineIndex: -1,
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

    // レールの長さボタン
    document.querySelectorAll('.length-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.railLength = parseInt(btn.dataset.length);
        });
    });

    // レールの向きボタン
    document.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.railDirection = btn.dataset.dir;
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

        if (State.step === 4) {
            // ステップ4の面進行処理
            if (State.step4Stage >= State.maxStep4Stage) {
                // 全クリ時はトップへ戻り、進捗リセット
                State.step4Stage = 1;
                clearCanvas();
                showScreen('screen-top');
            } else {
                // 次のコースへ進む
                State.step4Stage++;
                loadStep(State.step);
            }
        } else {
            // ステップ1〜3の回数進行処理
            const total = State.step1TotalRounds;
            const allDone = total !== 0 && State.step1CurrentRound >= total;
            if (allDone) State.step1CurrentRound = 0;
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
        // ホームに戻ったら面進捗はリセットする
        State.step4Stage = 1;
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
    // SVGの表示領域をデフォルトにリセット
    svg.setAttribute('viewBox', '0 0 800 600');
}

// パスのサイズに合わせて画面（viewBox）をズームアウト・センタリングする
function adjustViewBoxToFitPath(pathNode) {
    const defaultW = 800;
    const defaultH = 600;
    const padding = 150; // 駅や電車が見切れないための余白

    const bbox = pathNode.getBBox();
    const pathMinX = bbox.x - padding;
    const pathMaxX = bbox.x + bbox.width + padding;
    const pathMinY = bbox.y - padding;
    const pathMaxY = bbox.y + bbox.height + padding;

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

    let dir = State.railDirection;
    if (dir === 'random') {
        const dirs = ['right', 'left', 'up', 'down', 'up-right', 'down-right', 'up-left', 'down-left'];
        // 前回と同じ方向が出たら引き直す
        do {
            dir = dirs[Math.floor(Math.random() * dirs.length)];
        } while (dir === State.lastStep1Dir);
        State.lastStep1Dir = dir;
    }

    let angle = 0;
    switch (dir) {
        case 'right': angle = 0; break;
        case 'left': angle = Math.PI; break;
        case 'down': angle = Math.PI / 2; break;
        case 'up': angle = -Math.PI / 2; break;
        case 'up-right': angle = -Math.PI / 4; break;
        case 'down-right': angle = Math.PI / 4; break;
        case 'up-left': angle = -Math.PI * 3 / 4; break;
        case 'down-left': angle = Math.PI * 3 / 4; break;
    }

    const startX = center.x - (len / 2) * Math.cos(angle);
    const startY = center.y - (len / 2) * Math.sin(angle);
    const endX = center.x + (len / 2) * Math.cos(angle);
    const endY = center.y + (len / 2) * Math.sin(angle);

    return `M ${startX},${startY} L ${endX},${endY}`;
}

function initStep1() {
    // 設定値に基づいて動的パスを生成
    const pathData = generateStep1Path();

    setOkojoText('でんしゃ を さわって、えき まで はこんでね！');
    State.currentPathNode = createRailPath(pathData);
    State.pathLength = State.currentPathNode.getTotalLength();

    // 軌跡パス（進行した分だけ光る）
    State.trailPath = createTrailPath(pathData, State.pathLength);

    const startPoint = State.currentPathNode.getPointAtLength(0);
    const endPoint = State.currentPathNode.getPointAtLength(State.pathLength);
    drawStation(startPoint.x, startPoint.y);
    drawStation(endPoint.x, endPoint.y);

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

    // 0: アーチ(Q), 1: S字(C), 2: 同方向カーブ(C)
    let curveType;
    let currentStr;
    const dirs = ['right', 'left', 'up', 'down', 'up-right', 'down-right', 'up-left', 'down-left'];

    // カスタム指定がない限りランダム
    if (State.railDirection === 'random') {
        do {
            dir = dirs[Math.floor(Math.random() * dirs.length)];
            curveType = Math.floor(Math.random() * 3);
            currentStr = `${dir}_${curveType}`;
        } while (currentStr === State.lastStep2Str);
        State.lastStep2Str = currentStr;
    } else {
        dir = State.railDirection;
        curveType = Math.floor(Math.random() * 3);
    }

    let angle = 0;
    switch (dir) {
        case 'right': angle = 0; break;
        case 'left': angle = Math.PI; break;
        case 'down': angle = Math.PI / 2; break;
        case 'up': angle = -Math.PI / 2; break;
        case 'up-right': angle = -Math.PI / 4; break;
        case 'down-right': angle = Math.PI / 4; break;
        case 'up-left': angle = -Math.PI * 3 / 4; break;
        case 'down-left': angle = Math.PI * 3 / 4; break;
    }

    const startX = center.x - (len / 2) * Math.cos(angle);
    const startY = center.y - (len / 2) * Math.sin(angle);
    const endX = center.x + (len / 2) * Math.cos(angle);
    const endY = center.y + (len / 2) * Math.sin(angle);

    const perpAngle = angle + Math.PI / 2;
    // 膨らみ具合（長さ設定に応じて少し調整）
    const curveAmount = (100 + State.railLength * 25) * (Math.random() > 0.5 ? 1 : -1);

    if (curveType === 0) {
        const cx = center.x + curveAmount * Math.cos(perpAngle);
        const cy = center.y + curveAmount * Math.sin(perpAngle);
        return `M ${startX},${startY} Q ${cx},${cy} ${endX},${endY}`;
    } else {
        const d = len / 3;
        const c1x = startX + d * Math.cos(angle) + curveAmount * Math.cos(perpAngle);
        const c1y = startY + d * Math.sin(angle) + curveAmount * Math.sin(perpAngle);

        let c2CurveAmount = curveAmount;
        if (curveType === 1) c2CurveAmount = -curveAmount; // S字の場合は逆側へ

        const c2x = endX - d * Math.cos(angle) + c2CurveAmount * Math.cos(perpAngle);
        const c2y = endY - d * Math.sin(angle) + c2CurveAmount * Math.sin(perpAngle);

        return `M ${startX},${startY} C ${c1x},${c1y} ${c2x},${c2y} ${endX},${endY}`;
    }
}

function initStep2() {
    setOkojoText('くねくねレール だよ！ えき まで はこんでね！');
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

    let dir = State.railDirection;
    let isZShape;
    let currentStr;

    if (dir === 'random') {
        const dirs = ['right', 'left', 'up', 'down'];
        do {
            dir = dirs[Math.floor(Math.random() * dirs.length)];
            // 長さが2以上のときだけZ字も許可
            isZShape = Math.random() > 0.5 && State.railLength >= 2;
            currentStr = `${dir}_${isZShape}`;
        } while (currentStr === State.lastStep3Str);
        State.lastStep3Str = currentStr;
    } else {
        isZShape = Math.random() > 0.5 && State.railLength >= 2;
    }

    let start, corner, end, c1, c2;

    if (!isZShape) {
        if (dir === 'right') {
            start = [xMin, Math.random() > 0.5 ? yMin : yMax];
            end = [xMax, start[1] === yMin ? yMax : yMin];
            corner = Math.random() > 0.5 ? [start[0], end[1]] : [end[0], start[1]];
        } else if (dir === 'left') {
            start = [xMax, Math.random() > 0.5 ? yMin : yMax];
            end = [xMin, start[1] === yMin ? yMax : yMin];
            corner = Math.random() > 0.5 ? [start[0], end[1]] : [end[0], start[1]];
        } else if (dir === 'down') {
            start = [Math.random() > 0.5 ? xMin : xMax, yMin];
            end = [start[0] === xMin ? xMax : xMin, yMax];
            corner = Math.random() > 0.5 ? [end[0], start[1]] : [start[0], end[1]];
        } else { // 'up'
            start = [Math.random() > 0.5 ? xMin : xMax, yMax];
            end = [start[0] === xMin ? xMax : xMin, yMin];
            corner = Math.random() > 0.5 ? [end[0], start[1]] : [start[0], end[1]];
        }
        return [start, corner, end];
    } else {
        if (dir === 'right') {
            start = [xMin, Math.random() > 0.5 ? yMin : yMax];
            end = [xMax, start[1] === yMin ? yMax : yMin];
            c1 = [center.x, start[1]];
            c2 = [center.x, end[1]];
        } else if (dir === 'left') {
            start = [xMax, Math.random() > 0.5 ? yMin : yMax];
            end = [xMin, start[1] === yMin ? yMax : yMin];
            c1 = [center.x, start[1]];
            c2 = [center.x, end[1]];
        } else if (dir === 'down') {
            start = [Math.random() > 0.5 ? xMin : xMax, yMin];
            end = [start[0] === xMin ? xMax : xMin, yMax];
            c1 = [start[0], center.y];
            c2 = [end[0], center.y];
        } else { // 'up'
            start = [Math.random() > 0.5 ? xMin : xMax, yMax];
            end = [start[0] === xMin ? xMax : xMin, yMin];
            c1 = [start[0], center.y];
            c2 = [end[0], center.y];
        }
        return [start, c1, c2, end];
    }
}

function initStep3() {
    setOkojoText('「かど」が あるよ！ レールを なぞって はこんでね！');
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
    const scale = Math.min(1.0, 0.6 + (State.step4Stage * 0.05));
    const stage = State.step4Stage;

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
    } else if (stage === 6) {
        // --- 6面: 4の字 (1筆書き) ---
        const w = 140 * scale;
        const h = 140 * scale;
        return [
            `M ${center.x + w / 2},${center.y + h / 2} L ${center.x - w / 2},${center.y + h / 2} L ${center.x},${center.y - h} L ${center.x},${center.y + h}`
        ];
    } else if (stage === 7) {
        // --- 7面: 星型 (☆, 1筆書き) ---
        const r = 160 * scale;
        const pts = [];
        for (let i = 0; i <= 5; i++) {
            const angle = -Math.PI / 2 + (i * 144) * (Math.PI / 180);
            pts.push({
                x: center.x + r * Math.cos(angle),
                y: center.y + r * Math.sin(angle)
            });
        }
        return [
            `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y} L ${pts[2].x},${pts[2].y} L ${pts[3].x},${pts[3].y} L ${pts[4].x},${pts[4].y} L ${pts[5].x},${pts[5].y}`
        ];
    } else {
        // --- 8面: 8の字 (無限大, 1筆書き) ---
        const w = 180 * scale;
        const h = 120 * scale;
        return [
            `M ${center.x},${center.y} C ${center.x + w},${center.y - h} ${center.x + w},${center.y + h} ${center.x},${center.y} C ${center.x - w},${center.y - h} ${center.x - w},${center.y + h} ${center.x},${center.y}`
        ];
    }
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
        adjustViewBoxToFitPath(State.step4Lines[0].pathNode);
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
    if (State.step === 4) {
        // ステップ4の全6ステージ制用クリア画面
        const total = State.maxStep4Stage;
        const cur = State.step4Stage;
        const allDone = (cur >= total);

        roundIndicator.textContent = `${cur} / ${total}`;

        if (allDone) {
            clearMessage.textContent = 'ぜんぶクリア！すごい！';
            clearProgress.textContent = '8つのコースを 全部できたよ！';
            btnContinue.textContent = 'トップにもどる >';
            setOkojoText('ぜんぶ クリア！ ほんとうに すごいね！ はなまる だよ！');
        } else {
            clearMessage.textContent = 'クリア！';
            clearProgress.textContent = `${cur} / ${total} くりあ！`;
            btnContinue.textContent = 'つぎのコースへ ▶';
            setOkojoText('クリア！ すごいね！ よくできたよ！');
        }
    } else {
        // ステップ1〜3の回数制用クリア画面
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
            btnContinue.textContent = 'おなじステップをもう一度 ▶'; // 表現を他と少し分ける
        }

        setOkojoText('クリア！ すごいね！ よくできたよ！');
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

// Boot
window.onload = init;

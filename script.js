"use strict";

window.params = function () {
    let params = {};
    let param_array = (window.location.href.split('?')[1] || "").split('&');
    for (let i in param_array) {
        let x = param_array[i].split('=');
        params[x[0]] = x[1];
    }
    return params;
}();

let canvas;

const hr = window.innerHeight;
const wr = window.innerWidth;
const hcontrol = 50;
const w = wr;
const h = hr - hcontrol;
const hg = window.params.hg || 40, wg = window.params.wg || 80;
const hpx = h / hg;
const wpx = w / wg;

let boardGraphics;
let playersGraphics;
let board;
let grid;
const noiseX = 0.15, noiseY = 0.15;
let noiseZ = 0;
const minVal = window.params.genVal || window.params.gen_val || 0.4;
const startX = window.params.startX || window.params.start_x || 10;
const startY = window.params.startY || window.params.start_y || 10;
const endX = window.params.endX || window.params.end_x || 10;
const endY = window.params.endY || window.params.end_y || 10;
let players;
let controlGraphics;
const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [0, 255, 255], [255, 0, 255], [255, 128, 50]];

let turn;
const DRAW_BOARD = 0;
const SELECT = 1;
const GAME = 2;
const PAUSE = 3;
let state = DRAW_BOARD;
let turnStarted;
const turnTime = 6;
let won;

class Player {
    constructor(x, y, i) {
        this.x = x;
        this.y = y;
        this.i = i;
        this.vx = 0;
        this.vy = 0;
        this.fail = false;
    }

    draw(gr) {
        gr.noStroke();
        gr.fill(colors[this.i]);
        gr.ellipseMode(CENTER);
        gr.ellipse(this.x * wpx + wpx / 2, this.y * hpx + hpx / 2, wpx / 2, hpx / 2);
        gr.stroke(colors[this.i]);
        gr.strokeWeight(1);
        gr.line(this.x * wpx + wpx / 2, this.y * hpx + hpx / 2, (this.x + this.vx) * wpx + wpx / 2, (this.y + this.vy) * hpx + hpx / 2);
    }

    checkMove() {
        function canGoTo(x, y) {
            function roundToArray(a) {
                let va = [Math.round(a), Math.round(a + 0.001), Math.round(a - 0.001)];
                return va.filter(function (item, pos) {
                    return va.indexOf(item) === pos;
                });
            }

            if (Math.round(x) < 0 || Math.round(y) < 0 || Math.round(x) >= wg || Math.round(y) >= hg)
                return false;

            let vx = roundToArray(x);
            let vy = roundToArray(y);
            if (vx.length < 2 || vy.length < 2) {
                return board[vx[0]][vy[0]] !== 0;
            }
            let values = [];
            for (let x of vx) {
                for (let y of vy) {
                    values.push(board[x][y]);
                }
            }
            values.sort();
            return values[1] !== 0;
        }

        let x = this.x;
        let y = this.y;
        // const konstas = 360360; // lcm(2..13)
        const konstas = Math.max(Math.abs(this.vx), Math.abs(this.vy)) * 2;
        let dx = this.vx / konstas;
        let dy = this.vy / konstas;
        let cc = 0;
        while (cc <= konstas) {
            if (!canGoTo(x, y)) {
                return [Math.round(x - 2 * dx), Math.round(y - 2 * dy), 0, 0];
            }
            x += dx;
            y += dy;
            cc++;
        }
        return [this.x + this.vx, this.y + this.vy, this.vx, this.vy];
    }

    move() {
        [this.x, this.y, this.vx, this.vy] = this.checkMove();
    }

    won() {
        return this.vx === 0 && this.vy === 0 && this.x >= wg - endX && this.y >= hg - endY;
    }
}

function setup() {
    canvas = createCanvas(wr, hr);
    controlGraphics = createGraphics(w, hcontrol);
    pixelDensity(1);

    document.addEventListener('keyup', e => {
        return keyReleasedListener(e.key);
    });

    initGame();
}

function createBoardArray() {
    board = [];
    for (let i = 0; i < wg; i++) {
        board.push([]);
        for (let j = 0; j < hg; j++) {
            board[i].push(1);
        }
    }
}

function nextTurn() {
    turnStarted = +Date.now();
}

function initGame() {
    createBoardArray();
    grid = createGrid(w, h);
    players = [];
    playersGraphics = createGraphics(w, h);
    state = DRAW_BOARD;
    won = [];
    drawAll();
}

function startSelecting() {
    state = SELECT;
    turn = 0;
    drawAll();
}

function startGame() {
    state = GAME;
    turn = 0;
    drawAll();
    nextTurn();
}

function turnTimeLeft() {
    return turnTime - (Date.now() - turnStarted) / 1000;
}

function drawControl() {
    controlGraphics.clear();
    controlGraphics.textSize(15);
    controlGraphics.fill(0);
    if (state === PAUSE) {
        let text = won.length === 1 ? "Player " : "Players ";
        won.forEach(function (x, i) {
            if (i > 0)
                text += ", ";
            text += (x + 1).toString();
        });
        controlGraphics.text(text + " won", 10, 20);
    } else if (state === SELECT) {
        controlGraphics.text("Player " + (turn + 1).toString() + ", select start position or press Space to start", 10, 20);
    } else if (state === GAME) {
        controlGraphics.text("Player " + (turn + 1).toString() + " turn", 10, 20);
        controlGraphics.text(turnTimeLeft().toFixed(2), 150, 20);
    } else if (state === DRAW_BOARD) {
        controlGraphics.text("Draw with the mouse. R - generate random board, A - change pencil color, C - clear the board, SPACE - continue.", 10, 20);
        controlGraphics.fill(drawColor * 255);
        controlGraphics.rect(10, 30, 10, 10);
    }
    if (state >= SELECT) {
        for (let i = 0; i < colors.length; i++) {
            controlGraphics.fill(colors[i]);
            controlGraphics.rect(10 + 10 * i, 30, 10, 10);
        }
    }
}

function draw() {
    if (state === GAME) {
        if (turnTimeLeft() < 0)
            turnEnded();
        drawAll(false);
    }
}

function drawAll(redrawAll = true) {
    background(255);
    if (redrawAll) {
        drawPlayers();
        drawBoard();
    }
    drawControl();

    image(boardGraphics, 0, 0);
    image(grid, 0, 0);
    image(playersGraphics, 0, 0);
    image(controlGraphics, 0, h);
}

function drawPlayers() {
    playersGraphics.clear();
    players.forEach(function (x) {
        x.draw(playersGraphics);
    });
}

function turnEnded() {
    if (state !== GAME)
        return;

    players[turn].move();

    if (players[turn].won())
        won.push(turn);

    turn = (turn + 1) % players.length;

    if (turn === 0 && won.length > 0) {
        state = PAUSE;
    }

    nextTurn();

    drawAll();
}

function checkBoard(board) {
    let eil = [];
    for (let i = 0; i < startX; i++) {
        for (let j = 0; j < startY; j++) {
            if (board[i][j] !== 0)
                eil.push([i, j]);
        }
    }
    let apl = [];
    for (let i = 0; i < wg; i++) {
        apl.push(new Array(hg).fill(false));
    }

    function bang(dx, dy) {
        if (dx < 0 || dy < 0 || dx >= wg || dy >= hg || apl[dx][dy] || board[dx][dy] === 0)
            return;
        apl[dx][dy] = true;
        eil.push([dx, dy]);
    }

    while (eil.length > 0) {
        let [dx, dy] = eil.shift();
        if (dx >= wg - endX && dy >= hg - endY)
            return true;
        bang(dx + 1, dy);
        bang(dx - 1, dy);
        bang(dx, dy - 1);
        bang(dx, dy + 1);
    }
    return false;
}

function drawBoard() {
    boardGraphics = createGraphics(w, h);
    boardGraphics.pixelDensity(1);
    boardGraphics.noStroke();
    for (let i = 0; i < wg; i++) {
        for (let j = 0; j < hg; j++) {
            boardGraphics.fill(board[i][j] * 255);
            boardGraphics.rect(i * wpx, j * hpx, wpx, hpx);
        }
    }
    return boardGraphics;
}

function createBoard() {
    let board;
    let attemps = 200;
    do {
        board = [];
        for (let i = 0; i < wg; i++) {
            board.push([]);
            for (let j = 0; j < hg; j++) {
                let val = noise(i * noiseX, j * noiseY, noiseZ);
                if (val <= minVal)
                    val = 0;
                else
                    val = 1;
                board[i].push(val);
            }
        }
        noiseZ += 1;
        attemps--;
        if (attemps < 0)
            throw new Error("Can't generate board!!!");

        // console.log(board.map(e => e.join('')).join('\n'));
    }
    while (!checkBoard(board));
    return board;
}

function createGrid(w, h) {
    let temp = createGraphics(w, h);
    temp.stroke(125);
    temp.strokeWeight(1);
    for (let i = 0; i < hg; i++) {
        temp.line(0, i * hpx, w, i * hpx);
    }
    for (let i = 0; i < wg; i++) {
        temp.line(i * wpx, 0, i * wpx, h);
    }
    temp.strokeWeight(2);
    temp.fill(0, 0);
    temp.stroke(0, 255, 0);
    temp.rect(0, 0, startX * wpx, startY * hpx);
    temp.stroke(255, 0, 0);
    temp.rect((wg - endX) * wpx, (hg - endY) * hpx, wg * wpx, hg * hpx);
    return temp;
}

function keyReleasedListener(key) {
    if (state === DRAW_BOARD) {
        if (key.toUpperCase() === 'R') {
            board = createBoard();
        }
        else if (key.toUpperCase() === 'A') {
            drawColor ^= 1;
        }
        else if (key.toUpperCase() === 'C') {
            createBoardArray();
        }
        else if (key === ' ') {
            startSelecting();
        } else {
            return true;
        }
        drawAll();
        return false;
    }

    if (state === PAUSE)
        return true;

    if (state === SELECT) {
        if (key === ' ') {
            startGame();
            return false;
        }
        return true;
    }

    if (state === GAME) {
        if (key === "ArrowUp" || key.toUpperCase() === 'W') {
            players[turn].vy--;
        } else if (key === "ArrowDown" || key.toUpperCase() === 'S') {
            players[turn].vy++;
        } else if (key === "ArrowLeft" || key.toUpperCase() === 'A') {
            players[turn].vx--;
        } else if (key === "ArrowRight" || key.toUpperCase() === 'D') {
            players[turn].vx++;
        } else if (key === ' ') {
            // don't change velocity
        } else {
            return true;
        }
        turnEnded();
        return false; // prevent default
    }
    return true;
}

function addPlayer(x, y) {
    if (x === undefined || y === undefined)
        return false;
    if (board[x][y] === 0)
        return false;
    players.push(new Player(x, y, turn));
    turn++;
    if (colors.length <= turn)
        startGame();

    return true;
}

function getMouseInGrid(maxX = wg, maxY = hg) {
    let x = Math.floor(mouseX / wpx);
    let y = Math.floor(mouseY / hpx);
    if (x < 0 || y < 0 || x >= maxX || y >= maxY)
        return [];
    return [x, y];
}

let lastMouse;
let drawColor = 0;

function mousePressed() {
    if (state === DRAW_BOARD) {
        lastMouse = getMouseInGrid();
        board[lastMouse[0]][lastMouse[1]] = drawColor;
        drawAll();
    }

    if (state === SELECT) {
        if (addPlayer(...getMouseInGrid(startX, startY)))
            drawAll();
    }
}

function mouseDragged() {
    if (state === DRAW_BOARD) {
        let mouse = getMouseInGrid();
        if (mouse.length === 0)
            return;

        let x = lastMouse[0];
        let y = lastMouse[1];
        let vx = (mouse[0] - lastMouse[0]);
        let vy = (mouse[1] - lastMouse[1]);
        const konstas = Math.max(Math.abs(vx), Math.abs(vy)) * 2;
        let dx = vx / konstas;
        let dy = vy / konstas;
        let cc = 0;
        while (cc <= konstas) {
            let rx = Math.round(x);
            let ry = Math.round(y);
            board[rx][ry] = drawColor;
            x += dx;
            y += dy;
            cc++;
        }

        lastMouse = mouse;
        drawAll();
    }
}
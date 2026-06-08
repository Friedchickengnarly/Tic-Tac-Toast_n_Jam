const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const timerEl = document.querySelector("#timer");
const moveListEl = document.querySelector("#moveList");
const matchListEl = document.querySelector("#matchList");
const roundLabelEl = document.querySelector("#roundLabel");
const streakEl = document.querySelector("#streak");
const modeEl = document.querySelector("#mode");
const difficultyEl = document.querySelector("#difficulty");
const firstPlayerEl = document.querySelector("#firstPlayer");
const soundToggleEl = document.querySelector("#soundToggle");
const assistToggleEl = document.querySelector("#assistToggle");
const scoreEls = {
  X: document.querySelector("#scoreX"),
  O: document.querySelector("#scoreO"),
  draw: document.querySelector("#scoreDraw")
};

const wins = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

let board;
let currentPlayer;
let gameOver;
let scores = { X: 0, O: 0, draw: 0 };
let round = 1;
let moves = [];
let matches = [];
let roundStart = Date.now();
let timerId;
let lastWinner = null;
let streakCount = 0;
let audioContext;

function createBoard() {
  boardEl.innerHTML = "";
  for (let index = 0; index < 9; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `Square ${index + 1}`);
    button.dataset.index = index;
    button.addEventListener("click", () => handleCellClick(index));
    boardEl.append(button);
  }
}

function startRound(keepRoundNumber = false) {
  board = Array(9).fill("");
  moves = [];
  gameOver = false;
  currentPlayer = firstPlayerEl.value;
  roundStart = Date.now();
  if (!keepRoundNumber) {
    roundLabelEl.textContent = `Round ${round}`;
  }
  render();
  startTimer();
  if (isCpuTurn()) {
    queueCpuMove();
  }
}

function handleCellClick(index) {
  if (gameOver || board[index] || isCpuTurn()) {
    return;
  }
  placeMove(index, currentPlayer);
}

function placeMove(index, player) {
  board[index] = player;
  moves.push({ player, square: index + 1, time: elapsedTime() });
  playTone(player === "X" ? 420 : 560, .06);
  const result = getResult(board);
  if (result) {
    finishRound(result);
    return;
  }
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  render();
  if (isCpuTurn()) {
    queueCpuMove();
  }
}

function queueCpuMove() {
  statusEl.textContent = "Jam is thinking...";
  setTimeout(() => {
    if (!gameOver) {
      placeMove(getCpuMove(), "O");
    }
  }, 420);
}

function isCpuTurn() {
  return modeEl.value === "cpu" && currentPlayer === "O" && !gameOver;
}

function getCpuMove() {
  const empty = getEmptySquares(board);
  if (difficultyEl.value === "random") {
    return randomChoice(empty);
  }
  const winning = findTacticalMove("O");
  if (winning !== null) {
    return winning;
  }
  const blocking = findTacticalMove("X");
  if (blocking !== null) {
    return blocking;
  }
  if (difficultyEl.value === "spicy") {
    return minimaxMove();
  }
  return [4, 0, 2, 6, 8, 1, 3, 5, 7].find((index) => !board[index]);
}

function findTacticalMove(player) {
  for (const index of getEmptySquares(board)) {
    const copy = [...board];
    copy[index] = player;
    const result = getResult(copy);
    if (result && result.winner === player) {
      return index;
    }
  }
  return null;
}

function minimaxMove() {
  let bestScore = -Infinity;
  let bestMove = getEmptySquares(board)[0];
  for (const index of getEmptySquares(board)) {
    board[index] = "O";
    const score = minimax(board, false);
    board[index] = "";
    if (score > bestScore) {
      bestScore = score;
      bestMove = index;
    }
  }
  return bestMove;
}

function minimax(testBoard, maximizing) {
  const result = getResult(testBoard);
  if (result) {
    if (result.winner === "O") return 10;
    if (result.winner === "X") return -10;
    return 0;
  }
  const scoresToCompare = [];
  for (const index of getEmptySquares(testBoard)) {
    testBoard[index] = maximizing ? "O" : "X";
    scoresToCompare.push(minimax(testBoard, !maximizing));
    testBoard[index] = "";
  }
  return maximizing ? Math.max(...scoresToCompare) : Math.min(...scoresToCompare);
}

function getResult(testBoard) {
  for (const combo of wins) {
    const [a, b, c] = combo;
    if (testBoard[a] && testBoard[a] === testBoard[b] && testBoard[a] === testBoard[c]) {
      return { winner: testBoard[a], combo };
    }
  }
  if (testBoard.every(Boolean)) {
    return { winner: "draw", combo: [] };
  }
  return null;
}

function finishRound(result) {
  gameOver = true;
  clearInterval(timerId);
  scores[result.winner] += 1;
  updateStreak(result.winner);
  matches.unshift({
    round,
    winner: result.winner,
    mode: modeEl.value,
    difficulty: modeEl.value === "cpu" ? difficultyEl.value : "none",
    duration: elapsedTime(),
    moves: moves.map((move) => `${move.player}${move.square}`).join(" ")
  });
  round += 1;
  render(result.combo);
  statusEl.textContent = result.winner === "draw"
    ? "Perfectly toasted draw. New round?"
    : `${nameFor(result.winner)} wins this slice.`;
  playTone(result.winner === "draw" ? 260 : 720, .16);
}

function updateStreak(winner) {
  if (winner === "draw") {
    lastWinner = null;
    streakCount = 0;
    return;
  }
  if (lastWinner === winner) {
    streakCount += 1;
  } else {
    lastWinner = winner;
    streakCount = 1;
  }
}

function render(winningCombo = []) {
  const hint = assistToggleEl.checked && !gameOver && !isCpuTurn()
    ? suggestedMove()
    : null;
  [...boardEl.children].forEach((cell, index) => {
    cell.classList.toggle("win", winningCombo.includes(index));
    cell.classList.toggle("hint", hint === index && !board[index]);
    cell.disabled = gameOver || Boolean(board[index]) || isCpuTurn();
    cell.innerHTML = board[index] ? pieceMarkup(board[index]) : "";
    cell.setAttribute("aria-label", board[index]
      ? `Square ${index + 1}, ${nameFor(board[index])}`
      : `Square ${index + 1}, empty`);
  });
  scoreEls.X.textContent = scores.X;
  scoreEls.O.textContent = scores.O;
  scoreEls.draw.textContent = scores.draw;
  document.querySelectorAll("[data-score-card]").forEach((card) => {
    card.classList.toggle("active", card.dataset.scoreCard === currentPlayer && !gameOver);
  });
  if (!gameOver) {
    statusEl.textContent = `${nameFor(currentPlayer)} turn.`;
  }
  roundLabelEl.textContent = `Round ${round}`;
  renderMoves();
  renderMatches();
  streakEl.textContent = streakCount > 1 ? `${nameFor(lastWinner)} streak x${streakCount}` : "No streak yet";
}

function renderMoves() {
  moveListEl.innerHTML = "";
  moves.slice(-8).forEach((move) => {
    const item = document.createElement("li");
    item.textContent = `${nameFor(move.player)} took square ${move.square} at ${move.time}`;
    moveListEl.append(item);
  });
}

function renderMatches() {
  matchListEl.innerHTML = "";
  matches.slice(0, 5).forEach((match) => {
    const item = document.createElement("div");
    item.className = "match";
    item.textContent = `Round ${match.round}: ${nameFor(match.winner)} (${match.duration})`;
    matchListEl.append(item);
  });
}

function suggestedMove() {
  return findTacticalMove(currentPlayer)
    ?? findTacticalMove(currentPlayer === "X" ? "O" : "X")
    ?? [4, 0, 2, 6, 8].find((index) => !board[index])
    ?? getEmptySquares(board)[0]
    ?? null;
}

function pieceMarkup(player) {
  const src = player === "X" ? "assets/toast-x.svg" : "assets/jam-o.svg";
  return `<img src="${src}" alt="${nameFor(player)}" class="piece">`;
}

function getEmptySquares(testBoard) {
  return testBoard
    .map((value, index) => value ? null : index)
    .filter((value) => value !== null);
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function nameFor(player) {
  if (player === "X") return "Toast";
  if (player === "O") return "Jam";
  return "Draw";
}

function startTimer() {
  clearInterval(timerId);
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
}

function updateTimer() {
  timerEl.textContent = elapsedTime();
}

function elapsedTime() {
  const seconds = Math.floor((Date.now() - roundStart) / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function playTone(frequency, duration) {
  if (!soundToggleEl.checked) {
    return;
  }
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "triangle";
  gain.gain.value = .045;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function resetScores() {
  scores = { X: 0, O: 0, draw: 0 };
  round = 1;
  matches = [];
  lastWinner = null;
  streakCount = 0;
  startRound();
}

function exportCsv() {
  const header = ["round", "winner", "mode", "difficulty", "duration", "moves"];
  const rows = matches
    .slice()
    .reverse()
    .map((match) => header.map((key) => csvCell(match[key])).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tictactoast-match-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

document.querySelector("#newRoundBtn").addEventListener("click", () => startRound());
document.querySelector("#resetBtn").addEventListener("click", resetScores);
document.querySelector("#exportBtn").addEventListener("click", exportCsv);
modeEl.addEventListener("change", () => {
  difficultyEl.disabled = modeEl.value !== "cpu";
  startRound(true);
});
difficultyEl.addEventListener("change", () => startRound(true));
firstPlayerEl.addEventListener("change", () => startRound(true));
assistToggleEl.addEventListener("change", () => render());

createBoard();
startRound();

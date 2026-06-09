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
const roomCodeEl = document.querySelector("#roomCode");
const remoteStatusEl = document.querySelector("#remoteStatus");
const createRemoteBtn = document.querySelector("#createRemoteBtn");
const joinRemoteBtn = document.querySelector("#joinRemoteBtn");
const copyInviteBtn = document.querySelector("#copyInviteBtn");
const leaveRemoteBtn = document.querySelector("#leaveRemoteBtn");
const scoreEls = {
  X: document.querySelector("#scoreX"),
  O: document.querySelector("#scoreO"),
  draw: document.querySelector("#scoreDraw")
};

const firebaseSdkVersion = "12.14.0";
const emptyBoardCode = "---------";
const clientId = getClientId();

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
let currentWinningCombo = [];
let remoteStatusMessage = "";
const remote = {
  app: null,
  db: null,
  api: null,
  roomRef: null,
  unsubscribe: null,
  roomId: "",
  player: "",
  active: false,
  room: null
};

function getClientId() {
  try {
    const existing = localStorage.getItem("tictactoastClientId");
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem("tictactoastClientId", created);
    return created;
  } catch (error) {
    return `${Date.now()}-${Math.random()}`;
  }
}

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
  currentWinningCombo = [];
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
  if (isRemoteActive()) {
    submitRemoteMove(index);
    return;
  }
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
  return modeEl.value === "cpu" && currentPlayer === "O" && !gameOver && !isRemoteActive();
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
  currentWinningCombo = result.combo;
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

function render(winningCombo = currentWinningCombo) {
  currentWinningCombo = winningCombo;
  const hint = assistToggleEl.checked && !gameOver && !isCpuTurn() && canUseBoard()
    ? suggestedMove()
    : null;
  [...boardEl.children].forEach((cell, index) => {
    cell.classList.toggle("win", winningCombo.includes(index));
    cell.classList.toggle("hint", hint === index && !board[index]);
    cell.disabled = gameOver || Boolean(board[index]) || isCpuTurn() || !canUseBoard();
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
    statusEl.textContent = statusText();
  }
  roundLabelEl.textContent = `Round ${round}`;
  renderMoves();
  renderMatches();
  streakEl.textContent = streakCount > 1 ? `${nameFor(lastWinner)} streak x${streakCount}` : "No streak yet";
  syncRemoteControls();
}

function statusText() {
  if (!isRemoteActive()) {
    return `${nameFor(currentPlayer)} turn.`;
  }
  if (!remote.room || remote.room.status === "waiting") {
    return `Room ${remote.roomId}: waiting for your friend.`;
  }
  if (remote.player === "spectator") {
    return `Watching room ${remote.roomId}. ${nameFor(currentPlayer)} turn.`;
  }
  if (remote.player === currentPlayer) {
    return `Your turn as ${nameFor(remote.player)}.`;
  }
  return `Room ${remote.roomId}: waiting for ${nameFor(currentPlayer)}.`;
}

function canUseBoard() {
  if (!isRemoteActive()) {
    return true;
  }
  return remote.room?.status === "playing" && remote.player === currentPlayer && remote.player !== "spectator";
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
  return player === "X" ? toastPieceMarkup() : jamPieceMarkup();
}

function toastPieceMarkup() {
  return `
    <svg class="piece" viewBox="0 0 160 160" role="img" aria-label="Toast">
      <path fill="#8c4b1f" d="M25 68C25 32 51 16 80 16s55 16 55 52v55c0 14-11 25-25 25H50c-14 0-25-11-25-25V68Z"/>
      <path fill="#f2a65a" d="M36 70c0-28 19-42 44-42s44 14 44 42v50c0 9-7 16-16 16H52c-9 0-16-7-16-16V70Z"/>
      <path fill="#fff1be" d="M49 76c0-21 13-31 31-31s31 10 31 31v37c0 6-5 11-11 11H60c-6 0-11-5-11-11V76Z"/>
      <path fill="#c72c48" d="M55 60c8-9 21-9 28-1 8-5 19-2 23 7 4 10-2 23-17 35-4 3-9 3-13 0C61 90 51 74 55 60Z" opacity=".18"/>
      <path stroke="#241c18" stroke-linecap="round" stroke-width="15" d="m57 62 46 50M104 62l-47 50"/>
    </svg>
  `;
}

function jamPieceMarkup() {
  return `
    <svg class="piece" viewBox="0 0 160 160" role="img" aria-label="Jam">
      <path fill="#5d1d30" d="M30 59c0-27 22-49 50-49s50 22 50 49v54c0 21-17 38-38 38H68c-21 0-38-17-38-38V59Z"/>
      <path fill="#c72c48" d="M43 60c0-20 16-36 37-36s37 16 37 36v51c0 14-11 25-25 25H68c-14 0-25-11-25-25V60Z"/>
      <path fill="#f8c5ce" d="M57 76c0-13 10-23 23-23s23 10 23 23-10 23-23 23-23-10-23-23Z"/>
      <path fill="#fff8ed" d="M69 76c0-6 5-11 11-11s11 5 11 11-5 11-11 11-11-5-11-11Z"/>
      <path fill="#ffdf75" d="M54 37c6-8 16-13 26-13 12 0 22 5 29 14-18-3-37-3-55-1Z"/>
    </svg>
  `;
}

function isRemoteActive() {
  return modeEl.value === "remote" && remote.active;
}

function firebaseConfig() {
  return window.TICTACTOAST_FIREBASE_CONFIG || {};
}

function isFirebaseConfigured() {
  const config = firebaseConfig();
  return Boolean(config.apiKey && config.databaseURL && config.projectId && config.appId);
}

function setRemoteStatus(message) {
  remoteStatusMessage = message;
  remoteStatusEl.textContent = message;
}

function syncRemoteControls() {
  const configured = isFirebaseConfigured();
  difficultyEl.disabled = modeEl.value !== "cpu";
  firstPlayerEl.disabled = isRemoteActive();
  createRemoteBtn.disabled = !configured;
  joinRemoteBtn.disabled = !configured;
  copyInviteBtn.disabled = !isRemoteActive();
  leaveRemoteBtn.disabled = !isRemoteActive();
  if (isRemoteActive()) {
    roomCodeEl.value = remote.roomId;
  }
  if (!remoteStatusMessage) {
    remoteStatusEl.textContent = configured
      ? "Remote play ready. Create or join a room."
      : "Paste your Firebase config to enable remote play.";
  }
}

function normalizeRoomCode(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 5; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function roomPath(roomId) {
  return `tictactoastRooms/${roomId}`;
}

async function ensureFirebase() {
  if (remote.db) {
    return;
  }
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase config is missing. Paste your web app config into firebase-config.js.");
  }
  const [{ initializeApp }, databaseApi] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-database.js`)
  ]);
  remote.app = initializeApp(firebaseConfig());
  remote.db = databaseApi.getDatabase(remote.app);
  remote.api = databaseApi;
}

async function createRemoteRoom() {
  try {
    modeEl.value = "remote";
    syncRemoteControls();
    setRemoteStatus("Creating remote room...");
    await ensureFirebase();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const roomId = generateRoomCode();
      const roomRef = remote.api.ref(remote.db, roomPath(roomId));
      const snapshot = await remote.api.get(roomRef);
      if (!snapshot.exists()) {
        await remote.api.set(roomRef, buildRemoteRoom(roomId));
        attachRemoteRoom(roomId, "X");
        setRoomUrl(roomId);
        setRemoteStatus(`Room ${roomId} created. Send the invite link to your friend.`);
        return;
      }
    }
    setRemoteStatus("Could not create a unique room. Try again.");
  } catch (error) {
    setRemoteStatus(error.message);
  }
}

async function joinRemoteRoom(roomCode = roomCodeEl.value) {
  const roomId = normalizeRoomCode(roomCode);
  if (!roomId) {
    setRemoteStatus("Enter a room code first.");
    return;
  }
  try {
    modeEl.value = "remote";
    syncRemoteControls();
    setRemoteStatus(`Joining room ${roomId}...`);
    await ensureFirebase();
    const roomRef = remote.api.ref(remote.db, roomPath(roomId));
    const snapshot = await remote.api.get(roomRef);
    if (!snapshot.exists()) {
      setRemoteStatus(`Room ${roomId} was not found.`);
      return;
    }
    const roomData = snapshot.val();
    const players = roomData.players || {};
    let player = "spectator";
    const updates = {};
    if (players.X === clientId) {
      player = "X";
    } else if (players.O === clientId) {
      player = "O";
    } else if (!players.X) {
      player = "X";
      updates["players/X"] = clientId;
    } else if (!players.O) {
      player = "O";
      updates["players/O"] = clientId;
      updates.status = "playing";
    }
    if (Object.keys(updates).length) {
      updates.updatedAt = Date.now();
      await remote.api.update(roomRef, updates);
    }
    attachRemoteRoom(roomId, player);
    setRoomUrl(roomId);
    setRemoteStatus(player === "spectator"
      ? `Room ${roomId} is full. Watching as spectator.`
      : `Joined room ${roomId} as ${nameFor(player)}.`);
  } catch (error) {
    setRemoteStatus(error.message);
  }
}

function attachRemoteRoom(roomId, player) {
  if (remote.unsubscribe) {
    remote.unsubscribe();
  }
  remote.roomId = roomId;
  remote.player = player;
  remote.active = true;
  remote.roomRef = remote.api.ref(remote.db, roomPath(roomId));
  remote.unsubscribe = remote.api.onValue(remote.roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      setRemoteStatus(`Room ${roomId} no longer exists.`);
      leaveRemoteRoom(false);
      return;
    }
    applyRemoteRoom(snapshot.val());
  }, (error) => {
    setRemoteStatus(error.message);
  });
  syncRemoteControls();
}

function applyRemoteRoom(roomData) {
  remote.room = roomData;
  board = decodeBoard(roomData.board);
  currentPlayer = roomData.currentPlayer || "X";
  gameOver = Boolean(roomData.gameOver);
  scores = normalizeScores(roomData.scores);
  round = Number(roomData.round || 1);
  moves = movesFromRemote(roomData.moves);
  lastWinner = roomData.lastWinner || null;
  streakCount = Number(roomData.streakCount || 0);
  currentWinningCombo = decodeCombo(roomData.winningCombo);
  roundStart = Number(roomData.roundStartedAt || Date.now());
  if (gameOver) {
    clearInterval(timerId);
    timerEl.textContent = roomData.duration || elapsedTime();
  } else {
    startTimer();
  }
  render(currentWinningCombo);
  if (gameOver) {
    statusEl.textContent = roomData.winner === "draw"
      ? "Remote round ended in a draw. Start a new round?"
      : `${nameFor(roomData.winner)} wins the remote round.`;
  }
}

async function submitRemoteMove(index) {
  if (!canUseBoard() || board[index]) {
    return;
  }
  const moveId = `${clientId}-${Date.now()}-${index}`;
  const player = remote.player;
  setRemoteStatus(`Sending ${nameFor(player)} move...`);
  try {
    const result = await remote.api.runTransaction(remote.roomRef, (roomData) => {
      if (!roomData || roomData.status !== "playing" || roomData.gameOver || roomData.currentPlayer !== player) {
        return roomData;
      }
      const nextBoard = decodeBoard(roomData.board);
      if (nextBoard[index]) {
        return roomData;
      }
      nextBoard[index] = player;
      const nextMoveCount = Number(roomData.moveCount || 0) + 1;
      const nextMoves = { ...(roomData.moves || {}) };
      nextMoves[`m${nextMoveCount}`] = {
        order: nextMoveCount,
        player,
        square: index + 1,
        time: elapsedTime()
      };
      const gameResult = getResult(nextBoard);
      const baseUpdate = {
        ...roomData,
        board: encodeBoard(nextBoard),
        moves: nextMoves,
        moveCount: nextMoveCount,
        lastMoveId: moveId,
        updatedAt: Date.now()
      };
      if (!gameResult) {
        return {
          ...baseUpdate,
          currentPlayer: player === "X" ? "O" : "X"
        };
      }
      const nextScores = normalizeScores(roomData.scores);
      nextScores[gameResult.winner] += 1;
      const streak = nextRemoteStreak(roomData, gameResult.winner);
      return {
        ...baseUpdate,
        currentPlayer: player === "X" ? "O" : "X",
        gameOver: true,
        status: "complete",
        winner: gameResult.winner,
        winningCombo: encodeCombo(gameResult.combo),
        scores: nextScores,
        round: Number(roomData.round || 1) + 1,
        duration: elapsedTime(),
        ...streak
      };
    });
    const updatedRoom = result.snapshot.val();
    if (updatedRoom?.lastMoveId === moveId) {
      playTone(player === "X" ? 420 : 560, .06);
      setRemoteStatus(`Move sent in room ${remote.roomId}.`);
    } else {
      setRemoteStatus("That move was not accepted. Check whose turn it is.");
    }
  } catch (error) {
    setRemoteStatus(error.message);
  }
}

async function resetRemoteRound(resetAllScores = false) {
  if (!isRemoteActive()) {
    return;
  }
  setRemoteStatus("Starting a fresh remote round...");
  try {
    await remote.api.runTransaction(remote.roomRef, (roomData) => {
      if (!roomData) {
        return roomData;
      }
      const scoresForRound = resetAllScores ? { X: 0, O: 0, draw: 0 } : normalizeScores(roomData.scores);
      return {
        ...roomData,
        board: emptyBoardCode,
        currentPlayer: "X",
        gameOver: false,
        status: roomData.players?.O ? "playing" : "waiting",
        winner: "",
        winningCombo: "",
        moves: {},
        moveCount: 0,
        lastMoveId: "",
        scores: scoresForRound,
        round: resetAllScores ? 1 : Number(roomData.round || 1),
        roundStartedAt: Date.now(),
        duration: "",
        lastWinner: resetAllScores ? "" : roomData.lastWinner || "",
        streakCount: resetAllScores ? 0 : Number(roomData.streakCount || 0),
        updatedAt: Date.now()
      };
    });
    setRemoteStatus(resetAllScores ? "Remote scores reset." : "Remote round started.");
  } catch (error) {
    setRemoteStatus(error.message);
  }
}

async function leaveRemoteRoom(updateSlot = true, nextMode = "cpu") {
  const priorRoomRef = remote.roomRef;
  const priorPlayer = remote.player;
  if (remote.unsubscribe) {
    remote.unsubscribe();
  }
  remote.unsubscribe = null;
  remote.roomRef = null;
  remote.roomId = "";
  remote.player = "";
  remote.active = false;
  remote.room = null;
  clearRoomUrl();
  if (updateSlot && priorRoomRef && (priorPlayer === "X" || priorPlayer === "O")) {
    try {
      await remote.api.update(priorRoomRef, {
        [`players/${priorPlayer}`]: "",
        status: "waiting",
        updatedAt: Date.now()
      });
    } catch (error) {
      setRemoteStatus(error.message);
    }
  }
  modeEl.value = nextMode;
  setRemoteStatus("Left remote play.");
  startRound(true);
}

function buildRemoteRoom(roomId) {
  return {
    roomId,
    board: emptyBoardCode,
    currentPlayer: "X",
    gameOver: false,
    status: "waiting",
    winner: "",
    winningCombo: "",
    scores: { X: 0, O: 0, draw: 0 },
    round: 1,
    moves: {},
    moveCount: 0,
    lastMoveId: "",
    players: {
      X: clientId,
      O: ""
    },
    lastWinner: "",
    streakCount: 0,
    roundStartedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function encodeBoard(boardState) {
  return boardState.map((cell) => cell || "-").join("");
}

function decodeBoard(boardCode) {
  return String(boardCode || emptyBoardCode)
    .padEnd(9, "-")
    .slice(0, 9)
    .split("")
    .map((cell) => cell === "-" ? "" : cell);
}

function encodeCombo(combo) {
  return combo.join(",");
}

function decodeCombo(comboCode) {
  if (!comboCode) {
    return [];
  }
  return String(comboCode)
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

function movesFromRemote(remoteMoves) {
  return Object.values(remoteMoves || {})
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((move) => ({
      player: move.player,
      square: move.square,
      time: move.time
    }));
}

function normalizeScores(scoreData = {}) {
  return {
    X: Number(scoreData.X || 0),
    O: Number(scoreData.O || 0),
    draw: Number(scoreData.draw || 0)
  };
}

function nextRemoteStreak(roomData, winner) {
  if (winner === "draw") {
    return { lastWinner: "", streakCount: 0 };
  }
  const previousWinner = roomData.lastWinner || "";
  const previousCount = Number(roomData.streakCount || 0);
  return {
    lastWinner: winner,
    streakCount: previousWinner === winner ? previousCount + 1 : 1
  };
}

function setRoomUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  window.history.replaceState({}, "", url);
}

function clearRoomUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url);
}

async function copyInviteLink() {
  if (!isRemoteActive()) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("room", remote.roomId);
  try {
    await navigator.clipboard.writeText(url.toString());
    setRemoteStatus(`Invite link copied for room ${remote.roomId}.`);
  } catch (error) {
    roomCodeEl.select();
    setRemoteStatus(`Copy failed. Send room code ${remote.roomId} instead.`);
  }
}

function initRemoteFromUrl() {
  const roomId = normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
  syncRemoteControls();
  if (!roomId) {
    return;
  }
  modeEl.value = "remote";
  roomCodeEl.value = roomId;
  if (!isFirebaseConfigured()) {
    setRemoteStatus(`Room ${roomId} found in link. Add Firebase config, then press Join.`);
    syncRemoteControls();
    return;
  }
  joinRemoteRoom(roomId);
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

document.querySelector("#newRoundBtn").addEventListener("click", () => {
  if (isRemoteActive()) {
    resetRemoteRound(false);
    return;
  }
  startRound();
});
document.querySelector("#resetBtn").addEventListener("click", () => {
  if (isRemoteActive()) {
    resetRemoteRound(true);
    return;
  }
  resetScores();
});
document.querySelector("#exportBtn").addEventListener("click", exportCsv);
modeEl.addEventListener("change", () => {
  difficultyEl.disabled = modeEl.value !== "cpu";
  if (modeEl.value === "remote") {
    setRemoteStatus(isFirebaseConfigured()
      ? "Create a room or enter a code to join your friend."
      : "Paste your Firebase config to enable remote play.");
    render();
    return;
  }
  if (remote.active) {
    leaveRemoteRoom(false, modeEl.value);
    return;
  }
  startRound(true);
});
difficultyEl.addEventListener("change", () => startRound(true));
firstPlayerEl.addEventListener("change", () => startRound(true));
assistToggleEl.addEventListener("change", () => render());
roomCodeEl.addEventListener("input", () => {
  roomCodeEl.value = normalizeRoomCode(roomCodeEl.value);
});
createRemoteBtn.addEventListener("click", createRemoteRoom);
joinRemoteBtn.addEventListener("click", () => joinRemoteRoom());
copyInviteBtn.addEventListener("click", copyInviteLink);
leaveRemoteBtn.addEventListener("click", () => leaveRemoteRoom(true));

createBoard();
startRound();
initRemoteFromUrl();

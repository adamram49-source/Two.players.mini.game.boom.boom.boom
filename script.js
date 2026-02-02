import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ----- Firebase config -----
const firebaseConfig = {
  apiKey: "AIzaSyAMp5-wqinWTl4z0ms6bmnXgm9EvqPcbug",
  authDomain: "mytwoplayergame.firebaseapp.com",
  projectId: "mytwoplayergame",
  storageBucket: "mytwoplayergame.firebasestorage.app",
  messagingSenderId: "1003705475156",
  appId: "1:1003705475156:web:0d56aeef31623413238dc1",
  measurementId: "G-1KN2B16XVG"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ----- משתנים -----
let gameCode = "";
let playerId = "";
let myBombs = [];
let hearts = { me: 3, opponent: 3 };
let isMyTurn = false;
let gameStatus = "waiting";

const createGameBtn = document.getElementById("createGameBtn");
const joinGameBtn = document.getElementById("joinGameBtn");
const codeInput = document.getElementById("codeInput");
const gameContainer = document.getElementById("gameContainer");
const gameCodeDisplay = document.getElementById("gameCodeDisplay");

const myBoardEl = document.getElementById("myBoard");
const opponentBoardEl = document.getElementById("opponentBoard");

const myHeartsEl = document.getElementById("myHearts");
const opponentHeartsEl = document.getElementById("opponentHearts");

// ----- פונקציות -----
function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// יצירת משחק
function createGame() {
  gameCode = generateGameCode();
  playerId = "player1";
  const gameRef = ref(db, `games/${gameCode}`);

  // לוח ריק 3x3
  const emptyBoard = Array(9).fill(0);

  set(gameRef, {
    player1: playerId,
    player2: null,
    status: "waiting",
    turn: playerId,
    board: { player1: emptyBoard, player2: emptyBoard },
    hearts: { player1: 3, player2: 3 }
  });

  listenToGame();
  gameContainer.style.display = "block";
  gameCodeDisplay.textContent = gameCode;
  alert(`משחק נוצר! שלח את הקוד לחבר: ${gameCode}`);
}

// הצטרפות למשחק
function joinGame(code) {
  if (!code) return alert("אנא הכנס קוד!");
  gameCode = code.toUpperCase();
  playerId = "player2";

  const gameRef = ref(db, `games/${gameCode}`);
  get(gameRef).then(snapshot => {
    if (!snapshot.exists()) return alert("קוד לא קיים!");
    const data = snapshot.val();
    if (data.player2) return alert("משחק מלא!");

    set(ref(db, `games/${gameCode}/player2`), playerId);
    set(ref(db, `games/${gameCode}/status`), "choosing");
    listenToGame();
    gameContainer.style.display = "block";
    gameCodeDisplay.textContent = gameCode;
    alert("הצטרפת למשחק! בחר 3 פצצות על הלוח שלך.");
  });
}

// מאזין לשינויים בזמן אמת
function listenToGame() {
  const gameRef = ref(db, `games/${gameCode}`);
  onValue(gameRef, snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // עדכון לבבות
    hearts.me = playerId === "player1" ? data.hearts.player1 : data.hearts.player2;
    hearts.opponent = playerId === "player1" ? data.hearts.player2 : data.hearts.player1;
    myHeartsEl.textContent = hearts.me;
    opponentHeartsEl.textContent = hearts.opponent;

    // עדכון לוחות
    renderBoards(data.board);

    // תור
    isMyTurn = data.turn === playerId;
    gameStatus = data.status;

    // סיום משחק
    if (hearts.me <= 0 || hearts.opponent <= 0) {
      alert(hearts.me > hearts.opponent ? "ניצחת!" : "הפסדת!");
      return;
    }
  });
}

// הצגת לוחות
function renderBoards(board) {
  myBoardEl.innerHTML = "";
  opponentBoardEl.innerHTML = "";
  const myCells = board[playerId];
  const opponentId = playerId === "player1" ? "player2" : "player1";
  const opponentCells = board[opponentId];

  for (let i = 0; i < 9; i++) {
    // לוח שלי
    const myCell = document.createElement("div");
    myCell.classList.add("cell");
    if (myCells[i] === 1) myCell.classList.add("bomb");
    if (gameStatus === "choosing") myCell.onclick = () => selectBomb(i);
    myBoardEl.appendChild(myCell);

    // לוח היריב
    const opCell = document.createElement("div");
    opCell.classList.add("cell");
    if (opponentCells[i] === 2) opCell.classList.add("hit");
    if (opponentCells[i] === 3) opCell.classList.add("safe");
    if (gameStatus === "attacking" && isMyTurn) opCell.onclick = () => attackCell(i);
    opponentBoardEl.appendChild(opCell);
  }
}

// בחירת פצצה
function selectBomb(index) {
  const gameRef = ref(db, `games/${gameCode}/board/${playerId}`);
  get(gameRef).then(snapshot => {
    const board = snapshot.val();
    if (board[index] === 1) return;
    const bombs = board.slice();
    if (bombs.filter(v => v === 1).length >= 3) return alert("בחרת כבר 3 פצצות!");
    bombs[index] = 1;
    set(ref(db, `games/${gameCode}/board/${playerId}`), bombs);

    // אם שני השחקנים בחרו 3 פצצות, מתחילים התקפות
    get(ref(db, `games/${gameCode}`)).then(snap => {
      const data = snap.val();
      const p1Bombs = data.board.player1.filter(v => v === 1).length;
      const p2Bombs = data.board.player2.filter(v => v === 1).length;
      if (p1Bombs === 3 && p2Bombs === 3) {
        set(ref(db, `games/${gameCode}/status`), "attacking");
        set(ref(db, `games/${gameCode}/turn`), "player1");
      }
    });
  });
}

// התקפה על עיגול היריב
function attackCell(index) {
  if (!isMyTurn) return alert("לא התור שלך!");
  const opponentId = playerId === "player1" ? "player2" : "player1";
  const boardRef = ref(db, `games/${gameCode}/board/${opponentId}`);
  get(boardRef).then(snapshot => {
    const oppBoard = snapshot.val();
    let hit = oppBoard[index] === 1;

    // עדכון לבבות
    const heartsRef = ref(db, `games/${gameCode}/hearts`);
    get(heartsRef).then(snap => {
      const currentHearts = snap.val();
      const newHearts = { ...currentHearts };
      if (hit) {
        newHearts[playerId === "player1" ? "player2" : "player1"] -= 1;
        alert("Boom! פצצה!");
      } else alert("Safe!");
      set(heartsRef, newHearts);
    });

    // עדכון לוח היריב
    const newBoard = oppBoard.slice();
    newBoard[index] = hit ? 2 : 3;
    set(boardRef, newBoard);

    // מעבר תור
    set(ref(db, `games/${gameCode}/turn`), opponentId);
  });
}

// ----- אירועים -----
window.addEventListener("DOMContentLoaded", () => {
  createGameBtn.onclick = createGame;
  joinGameBtn.onclick = () => joinGame(codeInput.value);
});

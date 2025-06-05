// Firebase 初期化
var firebaseConfig = {
  apiKey: "AIzaSyDgBgkXa7l2KAIFhJLblLWIrSWgmGJ-3nQ",
  authDomain: "zeco-testplay-card.firebaseapp.com",
  databaseURL: "https://zeco-testplay-card-default-rtdb.firebaseio.com",
  projectId: "zeco-testplay-card",
  storageBucket: "zeco-testplay-card.firebasestorage.app",
  messagingSenderId: "704932554647",
  appId: "1:704932554647:web:9af5788a30e759129a06d2"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const MAX_HAND = 4;
const INITIAL_DECK_SIZE = 50;

function registerPlayer() {
  const name = document.getElementById("playerNameInput").value.trim();
  if (!name) {
    alert("名前を入力してください");
    return;
  }
  localStorage.setItem("playerName", name);
  document.getElementById("nameEntry").style.display = "none";
  document.getElementById("mainGame").style.display = "flex";
  updateDiscardArea();
  updateHandCount();
  updateDeckCount();
  listenPublicCards();
  showHand();
  listenDice();  // サイコロの同期を開始
}

function getCurrentPlayerName() {
  return localStorage.getItem("playerName");
}

function initDeck() {
  const newDeck = [];
  for (let i = 1; i <= INITIAL_DECK_SIZE; i++) {
    const filename = `card${String(i).padStart(2, "0")}.png`;
    newDeck.push(filename);
  }
  shuffle(newDeck);
  db.ref("deck").set(newDeck);
  alert("山札を初期化しました！");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function drawCard() {
  const name = getCurrentPlayerName();
  const deckRef = db.ref("deck");
  deckRef.once("value").then((snapshot) => {
    let deck = snapshot.val() || [];
    if (deck.length === 0) {
      db.ref("discardPile").once("value").then((dsnap) => {
        let discard = dsnap.val() || [];
        if (discard.length === 0) {
          alert("山札も捨て札も空です。カードを引けません。");
          return;
        }
        shuffle(discard);
        db.ref("deck").set(discard);
        db.ref("discardPile").set([]);
        alert("捨て札をシャッフルして山札に戻しました。もう一度カードを引いてください。");
      });
      return;
    }
    const card = deck.pop();
    db.ref(`deck`).set(deck);
    db.ref(`hands/${name}`).once("value").then((hsnap) => {
      let hand = hsnap.val() || [];
      hand.push(card);
      db.ref(`hands/${name}`).set(hand);
      showHand();
    });
  });
}

function showHand() {
  const name = getCurrentPlayerName();
  const area = document.getElementById("handArea");
  area.innerHTML = "";
  db.ref(`hands/${name}`).once("value").then((snapshot) => {
    const hand = snapshot.val() || [];
    hand.forEach((card, index) => {
      const img = document.createElement("img");
      img.src = `images/${card}`;
      img.title = "左クリック：捨てる／右クリック：公開";
      img.onclick = () => discardCard(name, index);
      img.oncontextmenu = (e) => {
        e.preventDefault();
        revealCard(name, index);
      };
      area.appendChild(img);
    });
  });
}

function discardCard(name, index) {
  const handRef = firebase.database().ref(`hands/${name}`);
  const discardRef = firebase.database().ref("discardPile");

  handRef.once("value").then((snapshot) => {
    let hand = snapshot.val() || [];

    if (hand.length <= MAX_HAND) {
      alert("手札が4枚以下のため、カードを捨てることはできません。");
      return;
    }

    const confirmResult = confirm("このカードを捨てますか？");
    if (!confirmResult) return;

    const card = hand.splice(index, 1)[0];
    handRef.set(hand);
    discardRef.once("value").then((discardSnap) => {
      const discardPile = discardSnap.val() || [];
      discardPile.push(card);
      discardRef.set(discardPile);
    });

    updateHandCount();
    showHand();
  });
}

function revealCard(name, index) {
  db.ref(`hands/${name}`).once("value").then((snapshot) => {
    let hand = snapshot.val() || [];

    // ✅ 手札が5枚以上のときは公開させない
    if (hand.length >= 5) {
      alert("手札が5枚以上のときはカードを使用できません。先に捨ててください。");
      return;
    }

    const card = hand.splice(index, 1)[0];
    db.ref(`hands/${name}`).set(hand);
    db.ref("publicCardList").push({ card, owner: name });
    showHand();
    updateHandCount();
  });
}

function listenPublicCards() {
  const area = document.getElementById("publicCardArea");
  db.ref("publicCardList").on("value", (snapshot) => {
    const cards = snapshot.val() || {};
    area.innerHTML = "";
    for (let key in cards) {
      const data = cards[key];
      const wrapper = document.createElement("div");
      wrapper.style.display = "inline-block";

      const img = document.createElement("img");
      img.src = `images/${data.card}`;
      img.style.width = "175px";
      wrapper.appendChild(img);

      const label = document.createElement("p");
      label.textContent = `${data.owner} のカード`;
      wrapper.appendChild(label);

      if (data.owner === getCurrentPlayerName()) {
        const btn1 = document.createElement("button");
        btn1.textContent = "捨てる";
        btn1.onclick = () => confirmPublicCard(key, data.card);
        wrapper.appendChild(btn1);

        const btn2 = document.createElement("button");
        btn2.textContent = "戻す";
        btn2.onclick = () => returnPublicCardToHand(key, data.card);
        wrapper.appendChild(btn2);
      }
      area.appendChild(wrapper);
    }
  });
}

function confirmPublicCard(key, card) {
  const discardRef = db.ref("discardPile");
  discardRef.once("value").then((snapshot) => {
    const pile = snapshot.val() || [];
    pile.push(card);
    db.ref("discardPile").set(pile);
    db.ref(`publicCardList/${key}`).remove();
    listenPublicCards(); // 公開カードエリアを再描画する
  });
}

function returnPublicCardToHand(key, card) {
  const name = getCurrentPlayerName();
  db.ref(`hands/${name}`).once("value").then((snapshot) => {
    const hand = snapshot.val() || [];
    hand.push(card);
    db.ref(`hands/${name}`).set(hand);
    db.ref(`publicCardList/${key}`).remove();
    showHand();
    updateHandCount();
    listenPublicCards(); // 公開カードエリアを再描画する
  });
}

function updateDiscardArea() {
  const area = document.getElementById("discardArea");
  db.ref("discardPile").on("value", (snapshot) => {
    const pile = snapshot.val() || [];
    area.innerHTML = "";
    pile.forEach((card, index) => {
      const img = document.createElement("img");
      img.src = `images/${card}`;
      img.title = "クリックで手札に回収";
      img.onclick = () => recoverFromDiscard(index);
      area.appendChild(img);
    });
  });
}

function recoverFromDiscard(index) {
  const confirmResult = confirm("このカードを手札に回収しますか？");
  if (!confirmResult) return;

  const name = getCurrentPlayerName();
  db.ref("discardPile").once("value").then((snapshot) => {
    const pile = snapshot.val() || [];
    const card = pile.splice(index, 1)[0];
    db.ref("discardPile").set(pile);
    db.ref(`hands/${name}`).once("value").then((hsnap) => {
      const hand = hsnap.val() || [];
      hand.push(card);
      db.ref(`hands/${name}`).set(hand).then(() => {
        if (hand.length > MAX_HAND) {
          alert("手札が5枚以上です。不要なカードを捨ててください。");
        }
        showHand(); // ✅ 手札を更新表示
      });
    });
  });
}

function updateHandCount() {
  const area = document.getElementById("handCountArea");
  area.innerHTML = "";
  db.ref("hands").once("value").then((snapshot) => {
    const hands = snapshot.val() || {};
    for (let name in hands) {
      const p = document.createElement("p");
      p.textContent = `${name}：${hands[name].length} 枚`;
      area.appendChild(p);
    }
  });
}

function updateDeckCount() {
  const area = document.getElementById("deckCountArea");
  db.ref("deck").on("value", (snapshot) => {
    const deck = snapshot.val() || [];
    area.textContent = `${deck.length} 枚`;
  });
}

function resetGameData() {
  if (!confirm("本当に初期化しますか？")) return;
  db.ref("hands").remove();
  db.ref("deck").remove();
  db.ref("discardPile").remove();
  db.ref("publicCardList").remove();
  db.ref("dice").remove();  // ← 追加：サイコロのリセット

  alert("初期化しました");
  location.reload();
}

function refreshAllViews() {
  showHand();             // 手札を表示
  updateDiscardArea();    // 捨て札を表示
  updateHandCount();      // プレイヤーの手札枚数を表示
  updateDeckCount();      // 山札の残り枚数を表示

  // 公開カードの再表示（リアルタイムでなく1回だけ）
  const area = document.getElementById("publicCardArea");
  db.ref("publicCardList").once("value").then((snapshot) => {
    const cards = snapshot.val() || {};
    area.innerHTML = "";
    for (let key in cards) {
      const data = cards[key];
      const wrapper = document.createElement("div");
      const img = document.createElement("img");
      img.src = `images/${data.card}`;
      img.style.width = "175px";
      wrapper.appendChild(img);

      if (data.owner === getCurrentPlayerName()) {
        const btn1 = document.createElement("button");
        btn1.textContent = "捨てる";
        btn1.onclick = () => confirmPublicCard(key, data.card);
        wrapper.appendChild(btn1);

        const btn2 = document.createElement("button");
        btn2.textContent = "戻す";
        btn2.onclick = () => returnPublicCardToHand(key, data.card);
        wrapper.appendChild(btn2);
      }

      area.appendChild(wrapper);
    }
  });
}

// サイコロの出目を表示・同期
function listenDice() {
  const diceResult = document.getElementById("diceResult");
  const rollBtn = document.getElementById("rollDiceButton");
  const resetBtn = document.getElementById("resetDiceButton");

  db.ref("dice").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      diceResult.textContent = `出目：${data.value}`;
      rollBtn.disabled = data.locked;
    } else {
      diceResult.textContent = "出目：--";
      rollBtn.disabled = false;
    }
  });
}

// サイコロを振る（誰でも振れる）
function rollDice() {
  const value = Math.floor(Math.random() * 6) + 1;
  db.ref("dice").set({ value: value, locked: true });
}

// サイコロをリセット（誰でも押せる）
function resetDice() {
  db.ref("dice").set(null);
}
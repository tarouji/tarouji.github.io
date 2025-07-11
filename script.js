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
    alert("プレイヤー名を入力してください");
    return;
  }

  // ✅ プレイヤー一覧に登録
  db.ref(`players/${name}`).set(true);

  localStorage.setItem("playerName", name);
  document.getElementById("nameEntry").style.display = "none";
  document.getElementById("mainGame").style.display = "flex";
  document.getElementById("playerNameDisplay").textContent = `プレイヤー名：${name}`;
  updateDiscardArea();
  updateDeckCount();
  listenPublicCards();
  showHand();
  listenDice(); // サイコロの同期
  listenHandCounts();
  document.getElementById("refreshButton").disabled = false;
  document.getElementById("drawCardButton").disabled = false;
  document.getElementById("rollDiceButton").disabled = false;
  document.getElementById("resetDiceButton").disabled = false;
  document.getElementById("logoutButton").disabled = false;
  document.getElementById("resetGameButton").disabled = false;

}

function initDeck() {
  const newDeck = [];
  for (let i = 1; i <= INITIAL_DECK_SIZE; i++) {
    const filename = `card${String(i).padStart(2, "0")}.png`;
    newDeck.push(filename);
  }
  shuffle(newDeck);
  db.ref("deck").set(newDeck);
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
      const cardDiv = document.createElement("div");
      cardDiv.style.display = "inline-block";
      cardDiv.style.textAlign = "center";
      cardDiv.style.margin = "10px";

      const img = document.createElement("img");
      img.src = `images/${card}`;
      img.style.width = "175px";
      img.style.display = "block";
      img.style.marginBottom = "5px";

      // 公開ボタン
      const revealBtn = document.createElement("button");
      revealBtn.textContent = "使用"
      revealBtn.onclick = () => revealCard(name, index);

      // 捨てるボタン
      const discardBtn = document.createElement("button");
      discardBtn.textContent = "捨てる";
      discardBtn.onclick = () => discardCard(name, index);

      cardDiv.appendChild(img);
      cardDiv.appendChild(revealBtn);
      cardDiv.appendChild(discardBtn);

      area.appendChild(cardDiv);
    });
  });
}

function discardCard(name, index) {
  const handRef = firebase.database().ref(`hands/${name}`);
  const discardRef = firebase.database().ref("discardPile");

  handRef.once("value").then((snapshot) => {
    let hand = snapshot.val() || [];

    const confirmResult = confirm("このカードを捨てますか？");
    if (!confirmResult) return;

    const card = hand.splice(index, 1)[0];
    handRef.set(hand);
    discardRef.once("value").then((discardSnap) => {
      const discardPile = discardSnap.val() || [];
      discardPile.push(card);
      discardRef.set(discardPile);
    });

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
  });
}

function listenHandCounts() {
  db.ref("hands").on("value", () => {
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
      label.textContent = `${data.owner} が使用`;
      wrapper.appendChild(label);

      if (data.owner === getCurrentPlayerName()) {
        if (data.card === "s_unit01.png" || data.card === "s_unit02.png") {
          const delBtn = document.createElement("button");
          delBtn.textContent = "削除";
          delBtn.onclick = () => db.ref(`publicCardList/${key}`).remove();
          wrapper.appendChild(delBtn);
        } else {
          const btn1 = document.createElement("button");
          btn1.textContent = "捨てる";
          btn1.onclick = () => confirmPublicCard(key, data.card);
          wrapper.appendChild(btn1);

          const btn2 = document.createElement("button");
          btn2.textContent = "戻す";
          btn2.onclick = () => returnPublicCardToHand(key, data.card);
          wrapper.appendChild(btn2);
        }
      }

      area.appendChild(wrapper);
    }

    // ✅ 初期ユニットAまたはBがすでに出ていれば、両方のボタンを無効化
    const currentPlayer = getCurrentPlayerName();
    const hasInitialUnit = Object.values(cards).some(
      (card) =>
        (card.card === "s_unit01.png" || card.card === "s_unit02.png") &&
        card.owner === currentPlayer
    );

    const btnA = document.getElementById("initUnitAButton");
    const btnB = document.getElementById("initUnitBButton");
    if (btnA) btnA.disabled = hasInitialUnit;
    if (btnB) btnB.disabled = hasInitialUnit;
  });
}

function confirmPublicCard(key, card) {
  if (card === "s_unit01.png" || card === "s_unit02.png") {
    // 初期ユニットA または B は削除のみ
    db.ref(`publicCardList/${key}`).remove();
    return;
  }

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
  if (card === "s_unit01.png" || card === "s_unit02.png") {
    // 初期ユニットA または B は削除のみ
    db.ref(`publicCardList/${key}`).remove();
    return;
  }

  const name = getCurrentPlayerName();
  db.ref(`hands/${name}`).once("value").then((snapshot) => {
    const hand = snapshot.val() || [];
    hand.push(card);
    db.ref(`hands/${name}`).set(hand);
    db.ref(`publicCardList/${key}`).remove();
    showHand();
    listenPublicCards(); // 公開カードエリアを再描画する
  });
}

function updateDiscardArea() {
  const area = document.getElementById("discardArea");
  db.ref("discardPile").on("value", (snapshot) => {
    const pile = snapshot.val() || [];
    area.innerHTML = "";
    pile.forEach((card, index) => {
      const wrapper = document.createElement("div");
      wrapper.style.display = "inline-block";
      wrapper.style.textAlign = "center";
      wrapper.style.margin = "10px";

      const img = document.createElement("img");
      img.src = `images/${card}`;
      img.style.width = "175px";
      img.style.display = "block";
      img.style.marginBottom = "5px";

      const btn = document.createElement("button");
      btn.textContent = "回収";
      btn.onclick = () => recoverFromDiscard(index);

      wrapper.appendChild(img);
      wrapper.appendChild(btn);
      area.appendChild(wrapper);
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
  area.innerHTML = ""; // まず完全クリア

  db.ref("players").once("value").then((psnap) => {
    const players = psnap.val() || {};
    const playerNames = Object.keys(players);

    // 全プレイヤーの手札枚数取得をPromise.allで一斉取得
    const handPromises = playerNames.map(name =>
      db.ref(`hands/${name}`).once("value").then(hsnap => {
        return { name, count: (hsnap.val() || []).length };
      })
    );

    Promise.all(handPromises).then(results => {
      // 表示は一気にまとめて行う（←これが重要）
      results.forEach(({ name, count }) => {
        const p = document.createElement("p");
        p.textContent = `${name}：${count} 枚`;
        area.appendChild(p);
      });
    });
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

  // Firebase 上の各情報を削除
  db.ref("hands").remove();
  db.ref("deck").remove();
  db.ref("discardPile").remove();
  db.ref("publicCardList").remove();
  db.ref("dice").remove();
  db.ref("players").remove();

  // ✅ 山札を初期化（ログアウト前に行う）
  initDeck();

  // ✅ ログアウト（画面リセット・ボタン無効化）
  logout();

  alert("初期化してログアウトしました");

  // ✅ ページをリロードしてログアウト＆画面リセット
  location.reload();
}

function refreshAllViews() {
  showHand();             // 手札を表示
  updateDiscardArea();    // 捨て札を表示
  updateHandCount();      // プレイヤーの手札枚数を表示
  updateDeckCount();      // 山札の残り枚数を表示

  const area = document.getElementById("publicCardArea");
  db.ref("publicCardList").once("value").then((snapshot) => {
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

      // ⭐ ここが抜けていた
      const label = document.createElement("p");
      label.textContent = `${data.owner} のカード`;
      wrapper.appendChild(label);

      if (data.owner === getCurrentPlayerName()) {
        if (data.card === "s_unit01.png" || data.card === "s_unit02.png") {
          const delBtn = document.createElement("button");
          delBtn.textContent = "削除";
          delBtn.onclick = () => db.ref(`publicCardList/${key}`).remove();
          wrapper.appendChild(delBtn);
        } else {
          const btn1 = document.createElement("button");
          btn1.textContent = "捨てる";
          btn1.onclick = () => confirmPublicCard(key, data.card);
          wrapper.appendChild(btn1);

          const btn2 = document.createElement("button");
          btn2.textContent = "戻す";
          btn2.onclick = () => returnPublicCardToHand(key, data.card);
          wrapper.appendChild(btn2);
        }
      }

      area.appendChild(wrapper);
    }
  });
}

function listenDice() {
  const diceResult = document.getElementById("diceResult");
  const rollBtn = document.getElementById("rollDiceButton");
  const resetBtn = document.getElementById("resetDiceButton");

  db.ref("dice").on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      diceResult.textContent = `　${data.value}　`;
      rollBtn.disabled = data.locked;
    } else {
      diceResult.textContent = "　--　";
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

function getCurrentPlayerName() {
  return localStorage.getItem("playerName");
}

function logout() {
    localStorage.removeItem("playerName");

  // 各ボタン等を無効化
  document.getElementById("playerNameDisplay").textContent = "";
  document.getElementById("refreshButton").disabled = true;
  document.getElementById("drawCardButton").disabled = true;
  document.getElementById("rollDiceButton").disabled = true;
  document.getElementById("resetDiceButton").disabled = true;
  document.getElementById("logoutButton").disabled = true;
  document.getElementById("resetGameButton").disabled = true;
  document.getElementById("initUnitAButton").disabled = true;
  document.getElementById("initUnitBButton").disabled = true;

  // データのクリア（任意）
  // location.reload(); ← これは使わずにそのままUI切り替えのほうが自然
  location.reload();
}

function spawnInitialUnitA() {
  const name = getCurrentPlayerName();
  const specialKey = `initA_${name}`; // ← 固定キーにする（1人1枚制限）

  // すでに出していないか確認
  db.ref(`publicCardList/${specialKey}`).once("value").then((snapshot) => {
    if (snapshot.exists()) {
      alert("初期ユニットAはすでに出しています。");
      return;
    }

    // まだ出してなければ追加
    db.ref(`publicCardList/${specialKey}`).set({
      card: "s_unit01.png",
      owner: name,
      isTemporary: true
    });

    // ボタンを無効にする
    document.getElementById("initUnitAButton").disabled = true;
  });
}

function spawnInitialUnitB() {
  const name = getCurrentPlayerName();
  const specialKey = `initB_${name}`; // 1人1枚制限のキー

  db.ref(`publicCardList/${specialKey}`).once("value").then((snapshot) => {
    if (snapshot.exists()) {
      alert("初期ユニットBはすでに出しています。");
      return;
    }

    db.ref(`publicCardList/${specialKey}`).set({
      card: "s_unit02.png",
      owner: name,
      isTemporary: true
    });

    document.getElementById("initUnitBButton").disabled = true;
  });
}

window.onload = () => {
  const savedName = localStorage.getItem("playerName");
  const isLoggedIn = !!savedName;

  if (isLoggedIn) {
    document.getElementById("nameEntry").style.display = "none";
    document.getElementById("mainGame").style.display = "flex";

    document.getElementById("refreshButton").disabled = false;
    document.getElementById("drawCardButton").disabled = false;
    document.getElementById("rollDiceButton").disabled = false;
    document.getElementById("resetDiceButton").disabled = false;
    document.getElementById("resetGameButton").disabled = false;
    document.getElementById("logoutButton").disabled = false;

    document.getElementById("playerNameDisplay").textContent = `プレイヤー名：${savedName}`;

    updateDiscardArea();
    updateHandCount();
    updateDeckCount();
    listenPublicCards();
    showHand();
    listenDice();
    listenHandCounts();

  } else {
    document.getElementById("refreshButton").disabled = true;
    document.getElementById("drawCardButton").disabled = true;
    document.getElementById("rollDiceButton").disabled = true;
    document.getElementById("resetDiceButton").disabled = true;
    document.getElementById("resetGameButton").disabled = true;
    document.getElementById("logoutButton").disabled = true;
  }

  // プレイヤーが存在しない場合のリスナーはここに入れてOK
  db.ref("players").on("value", (snapshot) => {
    const players = snapshot.val();
    if (savedName && (!players || !players[savedName])) {
      alert("ゲームが初期化されました。ログインしてください。");
      logout();
    }
  });
};
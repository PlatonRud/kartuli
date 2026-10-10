(() => {
  'use strict';

  const STORE_KEY = 'kartuli.v1';
  const $ = (id) => document.getElementById(id);

  const allWords = DECKS.flatMap((deck) =>
    deck.words.map(([ka, tr, ru]) => ({ ka, tr, ru, deck: deck.id }))
  );

  const state = load();
  let queue = [];

  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY));
    } catch {
      // хранилище недоступно (приватный режим) — работаем без сохранения
    }
    const deckExists = saved && DECKS.some((d) => d.id === saved.deck);
    return {
      deck: deckExists ? saved.deck : 'all',
      reverse: Boolean(saved && saved.reverse),
      known: new Set((saved && saved.known) || []),
    };
  }

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ deck: state.deck, reverse: state.reverse, known: [...state.known] })
      );
    } catch {
      // см. load()
    }
  }

  function deckWords() {
    return state.deck === 'all' ? allWords : allWords.filter((w) => w.deck === state.deck);
  }

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue() {
    queue = shuffle(deckWords().filter((w) => !state.known.has(w.ka)));
  }

  function renderDecks() {
    const nav = $('decks');
    nav.textContent = '';
    for (const deck of [{ id: 'all', title: 'Все' }, ...DECKS]) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = deck.title;
      chip.setAttribute('aria-pressed', String(deck.id === state.deck));
      chip.addEventListener('click', () => {
        state.deck = deck.id;
        save();
        buildQueue();
        renderDecks();
        renderCard();
      });
      nav.append(chip);
    }
  }

  function renderDirection() {
    $('direction').textContent = state.reverse ? 'рус → ქართ' : 'ქართ → рус';
  }

  function renderCard() {
    const words = deckWords();
    const knownCount = words.filter((w) => state.known.has(w.ka)).length;
    $('bar').style.width = `${(knownCount / words.length) * 100}%`;
    $('count').textContent = `${knownCount} / ${words.length}`;

    const word = queue[0];
    const card = $('card');
    card.hidden = !word;
    $('actions').hidden = !word;
    $('done').hidden = Boolean(word);
    if (!word) return;

    // Возвращаем карточку лицом без анимации, иначе при смене слова мелькнёт ответ
    card.classList.add('no-anim');
    card.classList.remove('flipped', 'enter');

    const question = state.reverse ? word.ru : word.ka;
    const answer = state.reverse ? word.ka : word.ru;
    const questionLang = state.reverse ? 'ru' : 'ka';
    const answerLang = state.reverse ? 'ka' : 'ru';

    setText($('front-main'), question, questionLang);
    setText($('back-top'), question, questionLang);
    setText($('back-main'), answer, answerLang);
    $('back-sub').textContent = `[${word.tr}]`;

    void card.offsetWidth;
    card.classList.remove('no-anim');
    card.classList.add('enter');
  }

  function setText(el, text, lang) {
    el.textContent = text;
    el.lang = lang;
  }

  function flip() {
    $('card').classList.toggle('flipped');
  }

  function answer(isKnown) {
    const word = queue.shift();
    if (!word) return;
    if (isKnown) {
      state.known.add(word.ka);
      save();
    } else {
      queue.push(word);
    }
    renderCard();
  }

  function restartDeck() {
    for (const w of deckWords()) state.known.delete(w.ka);
    save();
    buildQueue();
    renderCard();
  }

  $('card').addEventListener('click', flip);
  $('know').addEventListener('click', () => answer(true));
  $('again').addEventListener('click', () => answer(false));
  $('restart').addEventListener('click', restartDeck);
  $('direction').addEventListener('click', () => {
    state.reverse = !state.reverse;
    save();
    renderDirection();
    renderCard();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('button')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flip();
    } else if (e.key === 'ArrowRight') {
      answer(true);
    } else if (e.key === 'ArrowLeft') {
      answer(false);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  }

  buildQueue();
  renderDecks();
  renderDirection();
  renderCard();
})();

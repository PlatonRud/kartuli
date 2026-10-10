(() => {
  'use strict';

  const STORE_KEY = 'kartuli.v1';
  const HEART_SVG =
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  const $ = (id) => document.getElementById(id);

  const state = load();
  let currentDeck = null;
  let queue = [];

  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY));
    } catch {
      // хранилище недоступно (приватный режим) — работаем без сохранения
    }
    saved = saved || {};
    return {
      reverse: Boolean(saved.reverse),
      tab: saved.tab === 'focus' ? 'focus' : 'all',
      known: new Set(saved.known || []),
      focus: new Set(saved.focus || []),
    };
  }

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          reverse: state.reverse,
          tab: state.tab,
          known: [...state.known],
          focus: [...state.focus],
        })
      );
    } catch {
      // см. load()
    }
  }

  function knownCount(deck) {
    return deck.words.filter(([ka]) => state.known.has(ka)).length;
  }

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ——— Экран выбора темы ———

  function renderTopics() {
    const query = $('search').value.trim().toLowerCase();
    const focused = DECKS.filter((d) => state.focus.has(d.id));

    $('tab-all').textContent = `Все — ${DECKS.length}`;
    $('tab-focus').textContent = `В фокусе — ${focused.length}`;
    $('tab-all').setAttribute('aria-pressed', String(state.tab === 'all'));
    $('tab-focus').setAttribute('aria-pressed', String(state.tab === 'focus'));

    const pool = state.tab === 'focus' ? focused : DECKS;
    const decks = pool.filter((d) => d.title.toLowerCase().includes(query));

    const list = $('topic-list');
    list.textContent = '';
    for (const deck of decks) list.append(topicRow(deck));
    list.hidden = decks.length === 0;

    const empty = $('topics-empty');
    empty.hidden = decks.length > 0;
    empty.textContent = pool.length
      ? 'Ничего не найдено'
      : 'В фокусе пока пусто. Нажмите на сердечко у темы, чтобы добавить её сюда.';
  }

  function topicRow(deck) {
    const known = knownCount(deck);
    const total = deck.words.length;
    const inFocus = state.focus.has(deck.id);

    const row = document.createElement('li');
    row.className = 'topic';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'topic-open';
    open.append(
      el('span', 'topic-icon', deck.icon),
      el('span', 'topic-text', el('span', 'topic-title', deck.title), el('span', 'topic-count', `${known} / ${total}`))
    );
    open.firstChild.setAttribute('aria-hidden', 'true');
    open.addEventListener('click', () => openDeck(deck));

    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'heart';
    heart.innerHTML = HEART_SVG;
    heart.setAttribute('aria-pressed', String(inFocus));
    heart.setAttribute('aria-label', `${inFocus ? 'Убрать из фокуса' : 'Добавить в фокус'}: ${deck.title}`);
    heart.addEventListener('click', () => {
      if (inFocus) state.focus.delete(deck.id);
      else state.focus.add(deck.id);
      save();
      renderTopics();
    });

    const fill = el('div', 'meter-fill');
    fill.style.height = `${(known / total) * 100}%`;
    const meter = el('div', 'meter', fill);
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', `Выучено ${known} из ${total}`);

    row.append(open, heart, meter);
    return row;
  }

  function el(tag, className, ...children) {
    const node = document.createElement(tag);
    node.className = className;
    node.append(...children);
    return node;
  }

  function setTab(tab) {
    state.tab = tab;
    save();
    renderTopics();
  }

  // ——— Навигация между экранами ———

  // Карточки открываются отдельной записью в истории, чтобы работал системный жест «назад»
  function openDeck(deck) {
    history.pushState({ deck: deck.id }, '');
    showStudy(deck);
  }

  function showTopics() {
    currentDeck = null;
    $('study').hidden = true;
    $('topics').hidden = false;
    renderTopics();
  }

  function showStudy(deck) {
    currentDeck = deck;
    $('deck-title').textContent = deck.title;
    $('topics').hidden = true;
    $('study').hidden = false;
    buildQueue();
    renderDirection();
    renderCard();
  }

  function route() {
    const deckId = history.state && history.state.deck;
    const deck = DECKS.find((d) => d.id === deckId);
    if (deck) showStudy(deck);
    else showTopics();
  }

  // ——— Экран карточек ———

  function buildQueue() {
    queue = shuffle(currentDeck.words.filter(([ka]) => !state.known.has(ka)));
  }

  function renderDirection() {
    const label = state.reverse ? 'русский → грузинский' : 'грузинский → русский';
    $('direction').setAttribute('aria-label', `Сменить направление. Сейчас: ${label}`);
    $('direction').title = label;
  }

  function renderCard() {
    const total = currentDeck.words.length;
    const known = knownCount(currentDeck);
    $('bar').style.width = `${(known / total) * 100}%`;
    $('count').textContent = `${known} / ${total}`;

    const word = queue[0];
    const card = $('card');
    card.hidden = !word;
    $('actions').hidden = !word;
    $('done').hidden = Boolean(word);
    if (!word) return;

    // Возвращаем карточку лицом без анимации, иначе при смене слова мелькнёт ответ
    card.classList.add('no-anim');
    card.classList.remove('flipped', 'enter');

    const [ka, tr, ru] = word;
    const question = state.reverse ? ru : ka;
    const answer = state.reverse ? ka : ru;
    const questionLang = state.reverse ? 'ru' : 'ka';
    const answerLang = state.reverse ? 'ka' : 'ru';

    setText($('front-main'), question, questionLang);
    setText($('back-top'), question, questionLang);
    setText($('back-main'), answer, answerLang);
    $('back-sub').textContent = `[${tr}]`;

    void card.offsetWidth;
    card.classList.remove('no-anim');
    card.classList.add('enter');
  }

  function setText(node, text, lang) {
    node.textContent = text;
    node.lang = lang;
  }

  function flip() {
    $('card').classList.toggle('flipped');
  }

  function answer(isKnown) {
    const word = queue.shift();
    if (!word) return;
    if (isKnown) {
      state.known.add(word[0]);
      save();
    } else {
      queue.push(word);
    }
    renderCard();
  }

  function restartDeck() {
    for (const [ka] of currentDeck.words) state.known.delete(ka);
    save();
    buildQueue();
    renderCard();
  }

  // ——— События ———

  $('search').addEventListener('input', renderTopics);
  $('tab-all').addEventListener('click', () => setTab('all'));
  $('tab-focus').addEventListener('click', () => setTab('focus'));

  $('back').addEventListener('click', () => history.back());
  $('to-topics').addEventListener('click', () => history.back());
  window.addEventListener('popstate', route);

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
    if (!currentDeck || e.target.closest('button, input')) return;
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

  route();
})();

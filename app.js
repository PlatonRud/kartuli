(() => {
  'use strict';

  const STORE_KEY = 'kartuli.v1';
  const SCREENS = ['topics', 'dictionary', 'study'];
  const $ = (id) => document.getElementById(id);

  const allWords = DECKS.flatMap((deck) => deck.words);

  const state = load();
  let tab = 'topics'; // активная вкладка таб-бара: 'topics' | 'dictionary'
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
      filter: saved.filter === 'favorites' ? 'favorites' : 'all',
      known: new Set(saved.known || []),
      // focus — имя поля из прошлой версии
      favorites: new Set(saved.favorites || saved.focus || []),
    };
  }

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          reverse: state.reverse,
          filter: state.filter,
          known: [...state.known],
          favorites: [...state.favorites],
        })
      );
    } catch {
      // см. load()
    }
  }

  function knownCount(deck) {
    return deck.words.filter(([ka]) => state.known.has(ka)).length;
  }

  function wordsLabel(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'слово';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'слова';
    return 'слов';
  }

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function el(tag, className, ...children) {
    const node = document.createElement(tag);
    node.className = className;
    node.append(...children);
    return node;
  }

  // ——— Вкладка «Изучение» ———

  function renderTopics() {
    $('tab-all').setAttribute('aria-pressed', String(state.filter === 'all'));
    $('tab-favorites').setAttribute('aria-pressed', String(state.filter === 'favorites'));

    const decks = state.filter === 'favorites' ? DECKS.filter((d) => state.favorites.has(d.id)) : DECKS;

    const list = $('topic-list');
    list.textContent = '';
    for (const deck of decks) list.append(topicCard(deck));
    list.hidden = decks.length === 0;
    $('topics-empty').hidden = decks.length > 0;
  }

  function topicCard(deck) {
    const known = knownCount(deck);
    const total = deck.words.length;
    const count = `${total} ${wordsLabel(total)}`;

    const go = el('button', 'topic-go', 'УЧИТЬ');
    go.type = 'button';

    const image = document.createElement('img');
    image.className = 'topic-image';
    image.src = deck.image;
    image.alt = '';

    const card = el(
      'li',
      'topic',
      el('div', 'topic-body', el('h2', 'topic-title', deck.title), el('span', 'badge', known ? `${known} / ${count}` : count), go),
      image
    );
    card.addEventListener('click', () => openDeck(deck));
    return card;
  }

  function setFilter(filter) {
    state.filter = filter;
    save();
    renderTopics();
  }

  // ——— Вкладка «Словарь» ———

  function renderDictionary() {
    const query = $('search').value.trim().toLowerCase();
    const words = query ? allWords.filter((word) => word.some((part) => part.toLowerCase().includes(query))) : allWords;

    const list = $('word-list');
    list.textContent = '';
    for (const [ka, tr, ru] of words) {
      const kaNode = el('span', 'word-ka', ka);
      kaNode.lang = 'ka';
      list.append(el('li', 'word', el('div', 'word-main', kaNode, el('span', 'word-tr', tr)), el('span', 'word-ru', ru)));
    }
    list.hidden = words.length === 0;
    $('words-empty').hidden = words.length > 0;
  }

  // ——— Навигация между экранами ———

  function show(screen) {
    for (const id of SCREENS) $(id).hidden = id !== screen;
    const topLevel = screen !== 'study';
    $('tabbar').hidden = !topLevel;
    $('fade').hidden = !topLevel;
    for (const id of ['topics', 'dictionary']) {
      if (id === screen) $(`nav-${id}`).setAttribute('aria-current', 'page');
      else $(`nav-${id}`).removeAttribute('aria-current');
    }
  }

  function showTab(next) {
    tab = next;
    currentDeck = null;
    show(tab);
    if (tab === 'topics') renderTopics();
    else renderDictionary();
  }

  // Карточки открываются отдельной записью в истории, чтобы работал системный жест «назад»
  function openDeck(deck) {
    history.pushState({ deck: deck.id }, '');
    showStudy(deck);
  }

  function showStudy(deck) {
    currentDeck = deck;
    $('deck-title').textContent = deck.title;
    show('study');
    buildQueue();
    renderDirection();
    renderFavorite();
    renderCard();
  }

  function route() {
    const deckId = history.state && history.state.deck;
    const deck = DECKS.find((d) => d.id === deckId);
    if (deck) showStudy(deck);
    else showTab(tab);
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

  function renderFavorite() {
    const isFavorite = state.favorites.has(currentDeck.id);
    $('favorite').setAttribute('aria-pressed', String(isFavorite));
    $('favorite').setAttribute('aria-label', isFavorite ? 'Убрать из избранного' : 'Добавить в избранное');
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
    $('back-sub').textContent = tr;

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

  $('tab-all').addEventListener('click', () => setFilter('all'));
  $('tab-favorites').addEventListener('click', () => setFilter('favorites'));
  $('nav-topics').addEventListener('click', () => showTab('topics'));
  $('nav-dictionary').addEventListener('click', () => showTab('dictionary'));
  $('search').addEventListener('input', renderDictionary);

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
  $('favorite').addEventListener('click', () => {
    if (state.favorites.has(currentDeck.id)) state.favorites.delete(currentDeck.id);
    else state.favorites.add(currentDeck.id);
    save();
    renderFavorite();
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

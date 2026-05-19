// ========== 主题切换 ==========
const themeToggle = document.getElementById('themeToggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
let currentTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
setTheme(currentTheme);

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(currentTheme);
});

// ========== DOM 引用 ==========
const textInput = document.getElementById('textInput');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const els = {
  totalChars: document.getElementById('statTotalChars'),
  charsNoSpace: document.getElementById('statCharsNoSpace'),
  wordCount: document.getElementById('statWordCount'),
  chineseChars: document.getElementById('statChineseChars'),
  englishWords: document.getElementById('statEnglishWords'),
  punctuation: document.getElementById('statPunctuation'),
  paragraphs: document.getElementById('statParagraphs'),
  lines: document.getElementById('statLines'),
};

// ========== 计数函数 ==========
const RE_CHINESE = /[一-鿿㐀-䶿豈-﫿]/g;
const RE_ENGLISH_WORD = /[a-zA-Z]+(?:'[a-zA-Z]+)*/g;
const RE_PUNCTUATION = /[.,;:!?'"()\[\]{}\-\/\\@#$%^&*~`<>+=|_,.;:'""''。，；：！？《》「」『』（）—…、·。，；：！？《》「」『』—…‘’“”（）、]/g;

function countChineseChars(text) {
  const m = text.match(RE_CHINESE);
  return m ? m.length : 0;
}

function countEnglishWords(text) {
  const m = text.match(RE_ENGLISH_WORD);
  return m ? m.length : 0;
}

function countPunctuation(text) {
  const m = text.match(RE_PUNCTUATION);
  return m ? m.length : 0;
}

function countParagraphs(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
}

// ========== 更新统计 ==========
function updateStats() {
  const text = textInput.value;
  const chinese = countChineseChars(text);
  const english = countEnglishWords(text);

  els.totalChars.textContent = text.length;
  els.charsNoSpace.textContent = text.replace(/[ 　]/g, '').length;
  els.wordCount.textContent = chinese + english;
  els.chineseChars.textContent = chinese;
  els.englishWords.textContent = english;
  els.punctuation.textContent = countPunctuation(text);
  els.paragraphs.textContent = countParagraphs(text);
  els.lines.textContent = text.length === 0 ? 0 : text.split('\n').length;

  copyBtn.disabled = text.length === 0;
}

// ========== 事件绑定 ==========
textInput.addEventListener('input', updateStats);

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  updateStats();
  textInput.focus();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(textInput.value);
  } catch {
    textInput.select();
    document.execCommand('copy');
  }
  const label = copyBtn.querySelector('.btn-label');
  label.textContent = '已复制';
  setTimeout(() => { label.textContent = '复制'; }, 1500);
});

// 初始渲染
updateStats();

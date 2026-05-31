const DEFAULT_SECONDS = 5 * 60;
const BARKS = 4;

const timeDisplay = document.querySelector('#timeDisplay');
const timerForm = document.querySelector('#timerForm');
const minutesInput = document.querySelector('#minutesInput');
const secondsInput = document.querySelector('#secondsInput');
const startPauseButton = document.querySelector('#startPauseButton');
const resetButton = document.querySelector('#resetButton');
const statusText = document.querySelector('#statusText');
const dogFace = document.querySelector('#dogFace');
const quickButtons = document.querySelectorAll('[data-minutes]');

let durationSeconds = DEFAULT_SECONDS;
let remainingSeconds = DEFAULT_SECONDS;
let timerId = null;
let audioContext = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const render = () => {
  timeDisplay.value = formatTime(remainingSeconds);
  minutesInput.value = Math.floor(durationSeconds / 60);
  secondsInput.value = durationSeconds % 60;
  startPauseButton.textContent = timerId ? 'ポーズ' : 'スタート';
};

const setStatus = (message) => {
  statusText.textContent = message;
};

const stopTimer = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const playBark = (delay, pitch = 1) => {
  const context = getAudioContext();
  const startTime = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(360 * pitch, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(145 * pitch, startTime + 0.13);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(950, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.22);
};

const announceFinished = () => {
  stopTimer();
  remainingSeconds = 0;
  dogFace.classList.remove('is-running');
  dogFace.classList.add('is-barking');
  setStatus('ワンワンワンワン！時間だよ♡');

  for (let i = 0; i < BARKS; i += 1) {
    playBark(i * 0.32, i % 2 === 0 ? 1 : 1.18);
  }

  window.setTimeout(() => dogFace.classList.remove('is-barking'), 1800);
  render();
};

const tick = () => {
  remainingSeconds -= 1;
  if (remainingSeconds <= 0) {
    announceFinished();
    return;
  }
  render();
};

const startTimer = async () => {
  if (remainingSeconds <= 0) {
    remainingSeconds = durationSeconds;
  }

  if (remainingSeconds <= 0) {
    setStatus('1秒以上でセットしてね。');
    return;
  }

  try {
    await getAudioContext().resume();
  } catch {
    setStatus('音を鳴らす準備ができませんでした。');
  }

  timerId = window.setInterval(tick, 1000);
  dogFace.classList.add('is-running');
  setStatus('いい子でカウント中…');
  render();
};

const pauseTimer = () => {
  stopTimer();
  dogFace.classList.remove('is-running');
  setStatus('ちょっと休憩中。');
  render();
};

const setDuration = (seconds) => {
  durationSeconds = clamp(seconds, 1, 180 * 60 + 59);
  remainingSeconds = durationSeconds;
  pauseTimer();
  setStatus('タイマーをセットしたよ！');
  render();
};

timerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const minutes = clamp(Number(minutesInput.value) || 0, 0, 180);
  const seconds = clamp(Number(secondsInput.value) || 0, 0, 59);
  setDuration(minutes * 60 + seconds);
});

quickButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setDuration(Number(button.dataset.minutes) * 60);
  });
});

startPauseButton.addEventListener('click', () => {
  if (timerId) {
    pauseTimer();
    return;
  }
  startTimer();
});

resetButton.addEventListener('click', () => {
  remainingSeconds = durationSeconds;
  pauseTimer();
  setStatus('お散歩の準備OK！');
});

render();

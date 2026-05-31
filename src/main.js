const DEFAULT_SECONDS = 5 * 60;
const DEFAULT_VOLUME = 0.7;
const BARK_AUDIO_PATH = './assets/audio/dog-bark.mp3.m4a';
const FALLBACK_BARK_AUDIO_PATHS = [
  './assets/audio/dog-bark.mp3',
  './assets/audio/dog-bark.m4a',
];

const timeDisplay = document.querySelector('#timeDisplay');
const timerForm = document.querySelector('#timerForm');
const minutesInput = document.querySelector('#minutesInput');
const secondsInput = document.querySelector('#secondsInput');
const startPauseButton = document.querySelector('#startPauseButton');
const resetButton = document.querySelector('#resetButton');
const stopAlarmButton = document.querySelector('#stopAlarmButton');
const statusText = document.querySelector('#statusText');
const alarmBanner = document.querySelector('#alarmBanner');
const audioHelp = document.querySelector('#audioHelp');
const volumeInput = document.querySelector('#volumeInput');
const volumeValue = document.querySelector('#volumeValue');
const dogFace = document.querySelector('#dogFace');
const quickButtons = document.querySelectorAll('[data-minutes]');

let durationSeconds = DEFAULT_SECONDS;
let remainingSeconds = DEFAULT_SECONDS;
let timerId = null;
let audioUnlocked = false;
let alarmActive = false;
let fallbackAudioContext = null;
let fallbackOscillators = [];
let fallbackMasterGain = null;

const barkAudioPaths = [BARK_AUDIO_PATH, ...FALLBACK_BARK_AUDIO_PATHS];
let activeBarkAudioPathIndex = 0;
let activeBarkAudioPath = barkAudioPaths[activeBarkAudioPathIndex];

const barkAudio = new Audio(activeBarkAudioPath);
barkAudio.loop = true;
barkAudio.preload = 'auto';
barkAudio.volume = DEFAULT_VOLUME;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const setStatus = (message) => {
  statusText.textContent = message;
};

const setAudioHelp = (message = '') => {
  audioHelp.textContent = message;
  audioHelp.hidden = !message;
};

const renderVolume = () => {
  const percent = Math.round(Number(volumeInput.value) * 100);
  volumeValue.textContent = `${percent}%`;
};

const setBarkAudioSource = (path, index) => {
  if (activeBarkAudioPath !== path) {
    barkAudio.src = path;
  }

  activeBarkAudioPath = path;
  activeBarkAudioPathIndex = index;
};

const tryPlayBarkAudio = async ({ muted = false } = {}) => {
  barkAudio.volume = Number(volumeInput.value);

  for (let offset = 0; offset < barkAudioPaths.length; offset += 1) {
    const index = (activeBarkAudioPathIndex + offset) % barkAudioPaths.length;
    const path = barkAudioPaths[index];

    setBarkAudioSource(path, index);
    barkAudio.muted = muted;
    barkAudio.currentTime = 0;
    barkAudio.load();

    try {
      await barkAudio.play();
      return path;
    } catch {
      barkAudio.pause();
    }
  }

  barkAudio.muted = false;
  return '';
};

const render = () => {
  timeDisplay.value = formatTime(remainingSeconds);
  minutesInput.value = Math.floor(durationSeconds / 60);
  secondsInput.value = durationSeconds % 60;

  startPauseButton.textContent = alarmActive ? '鳴き声を止める' : timerId ? 'ポーズ' : 'スタート';
  startPauseButton.classList.toggle('is-stop-alarm', alarmActive);
  stopAlarmButton.hidden = !alarmActive;
  alarmBanner.hidden = !alarmActive;
  timerForm.classList.toggle('is-disabled', alarmActive);
};

const stopTimer = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const getFallbackAudioContext = () => {
  if (!fallbackAudioContext) {
    fallbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return fallbackAudioContext;
};

const stopFallbackBark = () => {
  fallbackOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Already-stopped bark nodes are safe to ignore when resetting the alarm.
    }
  });
  fallbackOscillators = [];
  if (fallbackMasterGain) {
    fallbackMasterGain.disconnect();
    fallbackMasterGain = null;
  }
};

const playFallbackBarkPattern = () => {
  stopFallbackBark();

  const context = getFallbackAudioContext();
  fallbackMasterGain = context.createGain();
  fallbackMasterGain.gain.value = Number(volumeInput.value) * 0.22;
  fallbackMasterGain.connect(context.destination);

  const playSingleBark = (startTime, pitch = 1) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(260 * pitch, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(95 * pitch, startTime + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(780, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(fallbackMasterGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.24);
    fallbackOscillators.push(oscillator);
  };

  const pattern = () => {
    if (!alarmActive) {
      return;
    }
    const startTime = context.currentTime + 0.02;
    playSingleBark(startTime, 1);
    playSingleBark(startTime + 0.32, 1.12);
    playSingleBark(startTime + 0.82, 0.94);
    playSingleBark(startTime + 1.14, 1.08);
    window.setTimeout(pattern, 1800);
  };

  pattern();
};

const unlockAudio = async () => {
  if (audioUnlocked) {
    return;
  }

  const playablePath = await tryPlayBarkAudio({ muted: true });

  if (playablePath) {
    barkAudio.pause();
    barkAudio.currentTime = 0;
    barkAudio.muted = false;
    audioUnlocked = true;
    setAudioHelp('');
  } else {
    setAudioHelp('犬の鳴き声ファイルを assets/audio/dog-bark.mp3.m4a に配置すると、本物のワンワン音で鳴ります。dog-bark.mp3 / dog-bark.m4a も代替として利用できます。');
  }

  try {
    await getFallbackAudioContext().resume();
  } catch {
    setAudioHelp('ブラウザの制限で音の準備ができませんでした。もう一度スタートを押してください。');
  }
};

const stopAlarm = (message = '鳴き声を止めたよ。') => {
  stopTimer();
  alarmActive = false;
  barkAudio.pause();
  barkAudio.currentTime = 0;
  stopFallbackBark();
  dogFace.classList.remove('is-barking', 'is-running');
  setStatus(message);
  render();
};

const playAlarm = async () => {
  const playablePath = await tryPlayBarkAudio();

  if (playablePath) {
    setAudioHelp('');
    return;
  }

  setAudioHelp('assets/audio/dog-bark.mp3.m4a、dog-bark.mp3、dog-bark.m4a が見つからないため、仮のフォールバック音でお知らせしています。READMEの手順で犬の鳴き声音声を配置してください。');
  playFallbackBarkPattern();
};

const announceFinished = () => {
  stopTimer();
  remainingSeconds = 0;
  alarmActive = true;
  dogFace.classList.remove('is-running');
  dogFace.classList.add('is-barking');
  setStatus('ワンワン！時間です！停止ボタンを押すまで鳴き続けます。');
  render();
  playAlarm();
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
  if (alarmActive) {
    stopAlarm();
    return;
  }

  await unlockAudio();

  if (remainingSeconds <= 0) {
    remainingSeconds = durationSeconds;
  }

  if (remainingSeconds <= 0) {
    setStatus('1秒以上でセットしてね。');
    return;
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
  stopAlarm('タイマーをセットしたよ！');
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
  if (alarmActive) {
    stopAlarm();
    return;
  }

  if (timerId) {
    pauseTimer();
    return;
  }
  startTimer();
});

stopAlarmButton.addEventListener('click', () => {
  stopAlarm();
});

resetButton.addEventListener('click', () => {
  remainingSeconds = durationSeconds;
  stopAlarm('お散歩の準備OK！');
});

volumeInput.addEventListener('input', () => {
  const volume = Number(volumeInput.value);
  barkAudio.volume = volume;
  if (fallbackMasterGain) {
    fallbackMasterGain.gain.value = volume * 0.22;
  }
  renderVolume();
});

renderVolume();
render();

/**
 * 수업용 학생 뽑기 룰렛 스크립트
 * 학교 칠판 테마, 10명 랜덤 배정, 빵빠레 폭죽 효과 포함
 */

// 전체 학생 예시 풀 (랜덤 10명 추출 시 활용)
const DEFAULT_STUDENT_POOL = [
  "김민준", "이서연", "박지우", "최도윤", "정하은",
  "강예준", "조수아", "윤시우", "장채원", "임은우",
  "한지민", "오서진", "서유찬", "권지아", "황태민",
  "송나은", "안승우", "류채린", "문하율", "백도현",
  "신가은", "유재민", "노하윤", "전우진", "홍길동",
  "배소율", "손시원", "곽지안", "심현우", "남예린"
];

// 룰렛 섹터 색상 팔레트 (칠판과 잘 어울리는 화사하고 선명한 색상들)
const SECTOR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#82E0AA", "#F1948A", "#85C1E9",
  "#F8C471", "#73C6B6", "#D7BDE2", "#EDBB99", "#A3E4D7"
];

// 상태 변수
let currentStudents = [];
let startAngle = 0; // 현재 회전 각도 (라디안)
let isSpinning = false;
let soundEnabled = true;
let audioCtx = null;

// DOM 요소 참조
const canvas = document.getElementById("rouletteCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const randomAssignBtn = document.getElementById("randomAssignBtn");
const openEditModalBtn = document.getElementById("openEditModalBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const pointerArrow = document.querySelector(".pointer-arrow");

// 당첨 모달 요소
const winnerModal = document.getElementById("winnerModal");
const winnerNameEl = document.getElementById("winnerName");
const closeModalBtn = document.getElementById("closeModalBtn");
const spinAgainBtn = document.getElementById("spinAgainBtn");

// 명단 편집 모달 요소
const editModal = document.getElementById("editModal");
const studentTextarea = document.getElementById("studentTextarea");
const studentCountBadge = document.getElementById("studentCountBadge");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");

// ========================================================
// 1. 오디오 합성기 (Web Audio API: 틱 사운드 & 빵빠레 팡파르)
// ========================================================
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// 룰렛이 돌면서 핀을 칠 때 나는 틱(Tick) 사운드
function playTickSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(550 + Math.random() * 150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch (e) {
    console.error("오디오 재생 오류:", e);
  }
}

// 룰렛 멈출 때 터지는 빵빠레(트럼펫 팡파르) 연주 사운드
function playFanfareSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const notes = [
      { freq: 523.25, time: 0, dur: 0.14 },    // 도 (C5)
      { freq: 659.25, time: 0.14, dur: 0.14 }, // 미 (E5)
      { freq: 783.99, time: 0.28, dur: 0.14 }, // 솔 (G5)
      { freq: 1046.50, time: 0.44, dur: 0.65 } // 높은 도 (C6, 롱톤)
    ];

    notes.forEach(note => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.freq, audioCtx.currentTime + note.time);
      gain.gain.setValueAtTime(0, audioCtx.currentTime + note.time);
      gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + note.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.time + note.dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + note.time);
      osc.stop(audioCtx.currentTime + note.time + note.dur);
    });
  } catch (e) {
    console.error("팡파르 사운드 재생 오류:", e);
  }
}

// ========================================================
// 2. 룰렛 캔버스 렌더링
// ========================================================
function drawRoulette() {
  const numItems = currentStudents.length;
  if (numItems === 0) return;

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width / 2 - 16;
  const arcSize = (2 * Math.PI) / numItems;

  ctx.clearRect(0, 0, width, height);

  // 1) 각 섹터 그리기
  for (let i = 0; i < numItems; i++) {
    const angle = startAngle + i * arcSize;
    ctx.beginPath();
    ctx.fillStyle = SECTOR_COLORS[i % SECTOR_COLORS.length];
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.lineTo(centerX, centerY);
    ctx.fill();

    // 섹터 테두리선 (분필 느낌의 흰색 선)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2) 학생 이름 텍스트 렌더링
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // 폰트 크기 계산 (인원 수에 맞춰 가독성 자동 조절)
    const fontSize = numItems > 15 ? 18 : (numItems > 10 ? 22 : 25);
    ctx.font = `bold ${fontSize}px 'Jua', 'Gowun Dodum', sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // 텍스트 회전 배치
    const textAngle = angle + arcSize / 2;
    ctx.translate(
      centerX + Math.cos(textAngle) * (radius - 28),
      centerY + Math.sin(textAngle) * (radius - 28)
    );
    ctx.rotate(textAngle + Math.PI); // 바깥쪽에서 중심을 향해 읽기 편하게 회전
    
    // 학생 이름 그리기
    const studentName = currentStudents[i];
    ctx.fillText(studentName, 0, 0);
    ctx.restore();
  }

  // 3) 외곽 금색 테두리 원 그리기
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = "#ffe57f";
  ctx.lineWidth = 8;
  ctx.stroke();

  // 외곽 장식 점(도트)들
  const dotCount = Math.max(numItems * 2, 24);
  for (let d = 0; d < dotCount; d++) {
    const dotAngle = (2 * Math.PI / dotCount) * d;
    const dotX = centerX + Math.cos(dotAngle) * (radius - 3);
    const dotY = centerY + Math.sin(dotAngle) * (radius - 3);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = d % 2 === 0 ? "#ffffff" : "#ffb703";
    ctx.fill();
  }
  ctx.restore();
}

// ========================================================
// 3. 학생 명단 관리 및 10명 랜덤 배정
// ========================================================
function assignRandomTenStudents() {
  if (isSpinning) return;
  // 전체 풀을 복사한 뒤 셔플(Fisher-Yates)
  const pool = [...DEFAULT_STUDENT_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // 10명 선택
  currentStudents = pool.slice(0, 10);
  drawRoulette();
}

// 텍스트 영역의 학생 명단 파싱
function parseStudentsFromText(text) {
  return text
    .split(/[\n,]/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

// ========================================================
// 4. 룰렛 회전 애니메이션 & 빵빠레 연출
// ========================================================
function spinRoulette() {
  if (isSpinning || currentStudents.length === 0) return;

  initAudio();
  isSpinning = true;
  spinBtn.disabled = true;
  randomAssignBtn.disabled = true;
  openEditModalBtn.disabled = true;

  // 회전 설정: 5초 동안 6~9바퀴 회전 + 랜덤 정지 각도
  const duration = 5200; // 밀리초
  const spinRotations = 6 + Math.random() * 3; // 6 ~ 9 바퀴
  const totalRotation = spinRotations * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const startAngleInitial = startAngle;
  const startTime = performance.now();

  let lastSectorIndex = -1;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 부드러운 감속을 위한 easeOutCubic 함수
    const easeOut = 1 - Math.pow(1 - progress, 3);
    startAngle = startAngleInitial + totalRotation * easeOut;

    // 현재 상단 포인터가 가리키는 섹터 인덱스 감지 (틱 소리용)
    const arcSize = (2 * Math.PI) / currentStudents.length;
    // 상단 포인터는 12시 방향 (각도 270도 = 3/2 * PI)
    const normalizedAngle = (startAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const pointerAngle = (3 * Math.PI / 2 - normalizedAngle + 2 * Math.PI) % (2 * Math.PI);
    const currentSector = Math.floor(pointerAngle / arcSize) % currentStudents.length;

    if (currentSector !== lastSectorIndex) {
      lastSectorIndex = currentSector;
      playTickSound();
      // 바늘 튕김 애니메이션
      pointerArrow.classList.add("tick");
      setTimeout(() => pointerArrow.classList.remove("tick"), 60);
    }

    drawRoulette();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // 회전 완료!
      finishSpin(currentSector);
    }
  }

  requestAnimationFrame(animate);
}

// 룰렛 정지 후 당첨자 발표 및 빵빠레 폭죽 발사
function finishSpin(winnerIndex) {
  isSpinning = false;
  spinBtn.disabled = false;
  randomAssignBtn.disabled = false;
  openEditModalBtn.disabled = false;

  const winner = currentStudents[winnerIndex];
  
  // 1) 팡파르 사운드 연주
  playFanfareSound();

  // 2) 빵빠레 컨페티 폭죽 연출 (화려한 3연타 폭죽)
  triggerFanfareConfetti();

  // 3) 당첨자 모달 띄우기 (약간의 딜레이로 기대감 극대화)
  setTimeout(() => {
    winnerNameEl.textContent = winner;
    winnerModal.classList.remove("hidden");
  }, 450);
}

// 화려한 빵빠레 폭죽 효과 함수
function triggerFanfareConfetti() {
  if (typeof confetti !== "function") return;

  // 1차: 중앙 대폭발
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.6 },
    colors: ['#ffb703', '#fb8500', '#e63946', '#4ecdc4', '#ffffff', '#ff99c8']
  });

  // 2차: 좌측 하단 대포 발사
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 65,
      origin: { x: 0.1, y: 0.75 },
      colors: ['#ffd166', '#06d6a0', '#118ab2', '#ef476f']
    });
  }, 250);

  // 3차: 우측 하단 대포 발사
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 65,
      origin: { x: 0.9, y: 0.75 },
      colors: ['#ffd166', '#06d6a0', '#118ab2', '#ef476f']
    });
  }, 450);
}

// ========================================================
// 5. 이벤트 리스너 등록
// ========================================================

// 룰렛 돌리기 버튼 및 캔버스 클릭
spinBtn.addEventListener("click", spinRoulette);
canvas.addEventListener("click", () => {
  if (!isSpinning) spinRoulette();
});

// 10명 랜덤 배정 버튼
randomAssignBtn.addEventListener("click", () => {
  assignRandomTenStudents();
});

// 소리 토글 버튼
soundToggleBtn.addEventListener("click", () => {
  initAudio();
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? "🔊 소리 ON" : "🔇 소리 OFF";
});

// 당첨 모달 닫기 및 다시 돌리기
closeModalBtn.addEventListener("click", () => {
  winnerModal.classList.add("hidden");
});

spinAgainBtn.addEventListener("click", () => {
  winnerModal.classList.add("hidden");
  setTimeout(spinRoulette, 300);
});

// 명단 편집 모달 열기
openEditModalBtn.addEventListener("click", () => {
  if (isSpinning) return;
  studentTextarea.value = currentStudents.join("\n");
  updateStudentCountBadge();
  editModal.classList.remove("hidden");
});

studentTextarea.addEventListener("input", updateStudentCountBadge);

function updateStudentCountBadge() {
  const list = parseStudentsFromText(studentTextarea.value);
  studentCountBadge.textContent = `현재 ${list.length}명`;
}

// 명단 편집 취소
cancelEditBtn.addEventListener("click", () => {
  editModal.classList.add("hidden");
});

// 명단 편집 저장 및 적용
saveEditBtn.addEventListener("click", () => {
  const list = parseStudentsFromText(studentTextarea.value);
  if (list.length < 2) {
    alert("룰렛을 돌리려면 최소 2명 이상의 학생이 필요합니다.");
    return;
  }
  currentStudents = list;
  drawRoulette();
  editModal.classList.add("hidden");
});

// 모달 바깥 클릭 시 닫기
window.addEventListener("click", (e) => {
  if (e.target === editModal) {
    editModal.classList.add("hidden");
  }
  if (e.target === winnerModal) {
    winnerModal.classList.add("hidden");
  }
});

// ========================================================
// 6. 초기 실행
// ========================================================
window.addEventListener("DOMContentLoaded", () => {
  // 최초 시작 시 랜덤 10명 배정
  assignRandomTenStudents();
});

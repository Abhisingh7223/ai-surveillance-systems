const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay-canvas');
const statusDiv = document.getElementById('status');
const ctx = canvas.getContext('2d');

// Audio alerts
const alertAudio = new Audio('alert.mp3');
const highAlertAudio = new Audio('high_alert.mp3');

// Suspicious keywords
const suspiciousKeywords = {
  "bomb": 3,
  "explosive": 3,
  "grenade": 3,
  "gun": 2,
  "rifle": 2,
  "pistol": 2,
  "knife": 2,
  "dagger": 2,
  "gunman": 2,
  "thief": 1,
  "dangerous": 1,
  "danger": 1,
  "suspicious": 1,
  "weapon": 2
};

let lastDetectedSuspiciousItem = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 10000;

// 🔥 NEW: status system (UI friendly)
function updateStatus(text, type = "loading") {
  statusDiv.innerText = text;
  statusDiv.className = "status " + type;
}

// 🎤 Voice alert
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// 📷 Camera setup
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => resolve(video);
  });
}

// 🤖 Load model
async function loadModel() {
  updateStatus("Loading AI Model...", "loading");
  const model = await mobilenet.load();
  updateStatus("AI Ready ✅ Monitoring...", "safe");
  return model;
}

// 🔍 Severity check
function getSeverity(name) {
  for (const keyword in suspiciousKeywords) {
    if (name.toLowerCase().includes(keyword)) {
      return suspiciousKeywords[keyword];
    }
  }
  return 0;
}

// 🎯 Detection loop
async function detect(model) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  async function runDetection() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const predictions = await model.classify(canvas);

    let suspiciousItem = null;
    let severity = 0;
    let confidence = 0;

    // Top predictions scan
    for (let i = 0; i < Math.min(5, predictions.length); i++) {
      const pred = predictions[i];
      const sev = getSeverity(pred.className);

      if (sev > severity) {
        severity = sev;
        suspiciousItem = pred.className;
        confidence = pred.probability;
      }
    }

    if (severity > 0) {
      const now = Date.now();
      const isNew = suspiciousItem !== lastDetectedSuspiciousItem;

      if ((now - lastAlertTime > ALERT_COOLDOWN) || isNew) {
        lastDetectedSuspiciousItem = suspiciousItem;
        lastAlertTime = now;

        const percent = (confidence * 100).toFixed(1);

        updateStatus(
          `🚨 ALERT (Level ${severity}): ${suspiciousItem} (${percent}%)`,
          "alert"
        );

        if (severity >= 3) {
          highAlertAudio.play();
          speak(`High alert! ${suspiciousItem} detected`);
        } else {
          alertAudio.play();
          speak(`Suspicious object detected: ${suspiciousItem}`);
        }
      }

      // 🔴 Draw alert text
      ctx.fillStyle = "red";
      ctx.font = "22px Inter";
      ctx.fillText(
        `${suspiciousItem} (${(confidence * 100).toFixed(1)}%)`,
        10,
        30
      );

    } else {
      const top = predictions[0];

      updateStatus(
        `✅ All Clear: ${top.className} (${(top.probability * 100).toFixed(1)}%)`,
        "safe"
      );

      lastDetectedSuspiciousItem = null;
    }

    requestAnimationFrame(runDetection);
  }

  runDetection();
}

// 🚀 Start app
(async () => {
  try {
    await setupCamera();
    const model = await loadModel();
    detect(model);
  } catch (err) {
    updateStatus("❌ Camera access denied", "alert");
    console.error(err);
  }
})();
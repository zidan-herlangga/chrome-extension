const STORAGE_KEY = "ai_solver_state_v3";
const TOGGLE_KEY = "aiva_extension_enabled";

let fabElement = null;
let bubbleElement = null;
let isExtensionEnabled = true;

// Cek Status Toggle Saat Load
chrome.storage.local.get([TOGGLE_KEY], (data) => {
  isExtensionEnabled = data[TOGGLE_KEY] !== false; // Default true

  if (isExtensionEnabled) {
    // Lanjut init normal
    chrome.storage.local.get([STORAGE_KEY], (stateData) => {
      const savedState = stateData[STORAGE_KEY];
      if (savedState && savedState.isActive) {
        initBubble();
        restoreState(savedState);
      } else {
        initBubble();
        hideBubble();
      }
    });
  } else {
    // Jika dimatikan, jangan inisialisasi apapun (atau init tapi sembunyi total)
    console.log("AIVA Disabled");
  }
});

function initBubble() {
  if (document.getElementById("stealth-bubble")) {
    bubbleElement = document.getElementById("stealth-bubble");
    fabElement = document.getElementById("solver-fab");
    return;
  }

  // 1. FAB (Toggle Button)
  const fab = document.createElement("div");
  fab.id = "solver-fab";
  fab.innerHTML = "🤖";
  fab.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    width: 50px; height: 50px;
    background: linear-gradient(135deg, #0ea5e9, #2563eb);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; cursor: pointer;
    z-index: 2147483647; 
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    transition: transform 0.2s;
    border: 2px solid rgba(255,255,255,0.2);
  `;
  fab.onmouseover = () => (fab.style.transform = "scale(1.1)");
  fab.onmouseout = () => (fab.style.transform = "scale(1)");
  fab.onclick = toggleBubble;
  document.body.appendChild(fab);
  fabElement = fab;

  // 2. Bubble Utama
  const bubble = document.createElement("div");
  bubble.id = "stealth-bubble";
  bubble.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 360px;
    max-width: 90vw;
    max-height: 85vh;
    z-index: 2147483646;
    font-family: 'Segoe UI', sans-serif;
    display: none;
    background-color: rgba(30, 41, 59, 0.95); 
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    color: #e2e8f0;
    font-size: 13px;
    overflow: hidden;
    flex-direction: column;
    transition: opacity 0.3s;
  `;

  bubble.innerHTML = `
    <div class="bubble-header" style="
      padding: 10px 15px;
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    ">
      <span style="font-weight:bold; font-size:12px; color:#38bdf8;">AI SOLVER</span>
      <span class="close-btn" style="cursor:pointer; font-size:18px; opacity:0.7;">&times;</span>
    </div>

    <div class="bubble-body" style="padding: 15px; overflow-y: auto;">
      <div style="margin-bottom:10px;">
        <label style="font-size:10px; font-weight:bold; color:#94a3b8; display:block; margin-bottom:5px;">PASTE SOAL:</label>
        <textarea id="bubble-question" placeholder="Paste soal atau klik kanan..." style="
          width: 100%; height: 90px;
          background: rgba(0,0,0,0.4); border: 1px solid #475569;
          color: #fff; padding: 10px; border-radius: 6px;
          resize: none; font-size: 13px; font-family: inherit;
        "></textarea>
      </div>

      <button id="bubble-solve-btn" style="
        width: 100%; padding: 10px;
        background: #2563eb; color: white; border:none;
        border-radius: 6px; cursor: pointer; font-weight:bold;
        margin-bottom: 15px; display:flex; align-items:center; justify-content:center; gap:5px;
      ">
        <span>⚡</span> JAWAB
      </button>

      <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top:10px;">
        <label style="font-size:10px; font-weight:bold; color:#94a3b8;">HASIL:</label>
        <div id="bubble-result-area" style="
          min-height: 60px; padding: 10px;
          background: rgba(0,0,0,0.3); border-radius: 6px;
          border: 1px solid #334155; font-size: 13px; line-height:1.5;
          white-space: pre-wrap; word-break: break-word;
        ">
          <span style="opacity:0.5; font-style:italic;">Menunggu input...</span>
        </div>
      </div>

      <div style="margin-top: 15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
        <label style="font-size:10px; font-weight:bold; color:#94a3b8; display:flex; justify-content:space-between;">
          <span>TRANSPARANSI</span>
          <span id="opacity-val">95%</span>
        </label>
        <input type="range" id="opacity-slider" min="0" max="100" value="95" style="width:100%; accent-color:#38bdf8; margin-top:5px;">
      </div>
    </div>
  `;
  document.body.appendChild(bubble);
  bubbleElement = bubble;

  // --- LOGIKA SOLVE ---
  document
    .getElementById("bubble-solve-btn")
    .addEventListener("click", async () => {
      const q = document.getElementById("bubble-question").value;
      const resultArea = document.getElementById("bubble-result-area");
      const btn = document.getElementById("bubble-solve-btn");

      if (!q.trim()) {
        resultArea.innerHTML =
          '<span style="color:#f87171;">Isi soal dulu!</span>';
        return;
      }

      resultArea.innerHTML =
        '<span style="color:#38bdf8;">🔄 Sedang berpikir...</span>';
      btn.disabled = true;
      btn.style.opacity = "0.7";

      try {
        const { apiKey, model } = await new Promise((resolve) =>
          chrome.storage.local.get(["apiKey", "model"], resolve),
        );

        if (!apiKey) throw new Error("API Key belum diisi! Buka Pengaturan.");

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": window.location.href,
              "X-Title": "AI Solver",
            },
            body: JSON.stringify({
              model: model || "arcee-ai/trinity-large-preview:free",
              messages: [
                {
                  role: "system",
                  content:
                    "Jawab soal pilihan ganda. Format: [JAWABAN]: X [ALASAN]: Penjelasan",
                },
                { role: "user", content: q },
              ],
            }),
          },
        );

        if (!response.ok) throw new Error("Gagal menghubungi AI.");

        const data = await response.json();
        const answer = data.choices[0].message.content;

        let html = answer
          .replace(
            /\[JAWABAN\]:/gi,
            '<strong style="color:#4ade80; font-size:15px;">JAWABAN:</strong>',
          )
          .replace(
            /\[ALASAN\]:/gi,
            '<div style="margin-top:5px; color:#cbd5e1;"><strong>ALASAN:</strong></div>',
          )
          .replace(/\n/g, "<br>");

        resultArea.innerHTML = html;
        addToHistory(q, answer);
      } catch (e) {
        resultArea.innerHTML =
          '<span style="color:#f87171;">Error: ' + e.message + "</span>";
      } finally {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    });

  document.querySelector(".close-btn").addEventListener("click", hideBubble);

  const slider = document.getElementById("opacity-slider");
  const opacityVal = document.getElementById("opacity-val");

  slider.addEventListener("input", (e) => {
    const val = e.target.value;
    opacityVal.textContent = val + "%";
    const alpha = val / 100;
    bubble.style.backgroundColor = `rgba(30, 41, 59, ${alpha})`;
    bubble.style.backdropFilter = alpha < 0.2 ? "none" : "blur(10px)";
    saveState({ sliderValue: val });
  });

  setupDrag(bubble);
}

// --- FULLSCREEN HANDLER ---
function ensureBubbleVisibility() {
  const fsElement =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;

  if (fsElement) {
    // Pindahkan Bubble ke elemen fullscreen
    if (fsElement !== bubbleElement && fsElement !== bubbleElement.parentNode) {
      fsElement.appendChild(bubbleElement);
      if (fabElement) fsElement.appendChild(fabElement);

      // Reset posisi
      bubbleElement.style.transform = "none";
      bubbleElement.style.top = "auto";
      bubbleElement.style.left = "auto";
      bubbleElement.style.right = "20px";
      bubbleElement.style.bottom = "80px";

      if (fabElement) {
        fabElement.style.transform = "none";
        fabElement.style.top = "auto";
        fabElement.style.left = "auto";
        fabElement.style.right = "20px";
        fabElement.style.bottom = "20px";
      }
    }
  } else {
    // Kembalikan ke body jika keluar fullscreen
    if (bubbleElement && bubbleElement.parentNode !== document.body) {
      document.body.appendChild(bubbleElement);
      if (fabElement) document.body.appendChild(fabElement);
    }
  }
}

// Cek setiap 500ms dan saat event fullscreen berubah
setInterval(ensureBubbleVisibility, 500);
document.addEventListener("fullscreenchange", ensureBubbleVisibility);
document.addEventListener("webkitfullscreenchange", ensureBubbleVisibility);
document.addEventListener("mozfullscreenchange", ensureBubbleVisibility);
document.addEventListener("MSFullscreenChange", ensureBubbleVisibility);

// --- HELPER FUNCTIONS ---

function toggleBubble() {
  const bubble = document.getElementById("stealth-bubble");
  if (!bubble) return initBubble();

  if (bubble.style.display === "none" || bubble.style.display === "") {
    showBubble();
  } else {
    hideBubble();
  }
}

function showBubble() {
  const bubble = document.getElementById("stealth-bubble");
  if (!bubble) return initBubble();
  bubble.style.display = "flex";
  saveState({ isActive: true });
}

function hideBubble() {
  const bubble = document.getElementById("stealth-bubble");
  if (!bubble) return;
  bubble.style.display = "none";
  saveState({ isActive: false });
}

function addToHistory(q, a) {
  chrome.storage.local.get(["history"], (data) => {
    const history = data.history || [];
    history.unshift({
      q,
      a,
      date: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    if (history.length > 20) history.pop();
    chrome.storage.local.set({ history });
  });
}

function saveState(extraData) {
  const bubble = document.getElementById("stealth-bubble");
  const slider = document.getElementById("opacity-slider");

  if (!bubble || !slider) return;

  const state = {
    isActive: bubble.style.display !== "none" && bubble.style.display !== "",
    sliderValue: slider.value,
    ...extraData,
  };
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function restoreState(state) {
  const bubble = document.getElementById("stealth-bubble");
  const slider = document.getElementById("opacity-slider");

  if (!bubble || !slider) return;

  if (state.isActive) {
    bubble.style.display = "flex";
  } else {
    bubble.style.display = "none";
  }

  if (state.sliderValue) {
    slider.value = state.sliderValue;
    slider.dispatchEvent(new Event("input"));
  }
}

function setupDrag(el) {
  const header = el.querySelector(".bubble-header");
  let isDragging = false,
    startX,
    startY,
    initLeft,
    initTop;

  header.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("close-btn")) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const style = window.getComputedStyle(el);
    const matrix = new WebKitCSSMatrix(style.transform);
    initLeft = matrix.m41;
    initTop = matrix.m42;
    el.style.transition = "none";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      el.style.transition = "opacity 0.3s";
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.transform = `translate(${initLeft + dx}px, ${initTop + dy}px)`;
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "SOLVE_FROM_CONTEXT") {
    const q = request.question;

    if (!document.getElementById("stealth-bubble")) initBubble();
    showBubble();

    const textArea = document.getElementById("bubble-question");
    if (textArea) textArea.value = q;

    const solveBtn = document.getElementById("bubble-solve-btn");
    if (solveBtn) solveBtn.click();
  }

  // TAMBAHKAN LISTENER TOGGLE
  if (request.action === "TOGGLE_EXTENSION") {
    if (!request.state) {
      // Nonaktifkan
      if (bubbleElement) bubbleElement.style.display = "none";
      if (fabElement) fabElement.style.display = "none";
    } else {
      // Aktifkan
      if (bubbleElement) bubbleElement.style.display = "flex"; // Atur sesuai kebutuhan show/hide
      if (fabElement) fabElement.style.display = "flex";
    }
  }
});

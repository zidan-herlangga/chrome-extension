document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");
  const saveBtn = document.getElementById("saveSettingsBtn");
  const clearBtn = document.getElementById("clearHistoryBtn");
  const historyList = document.getElementById("historyList");

  chrome.storage.local.get(["apiKey", "model"], (data) => {
    if (data.apiKey) document.getElementById("apiKeyInput").value = data.apiKey;
    if (data.model) document.getElementById("modelSelect").value = data.model;
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "history") loadHistory();
    });
  });

  saveBtn.addEventListener("click", handleSave);
  clearBtn.addEventListener("click", handleClear);

  function handleSave() {
    const apiKey = document.getElementById("apiKeyInput").value.trim();
    const model = document.getElementById("modelSelect").value;
    chrome.storage.local.set({ apiKey, model }, () => {
      saveBtn.textContent = "Tersimpan!";
      setTimeout(() => (saveBtn.textContent = "Simpan Pengaturan"), 2000);
    });
  }

  function loadHistory() {
    chrome.storage.local.get(["history"], (data) => {
      const history = data.history || [];
      historyList.innerHTML = "";
      if (history.length === 0) {
        historyList.innerHTML =
          '<div class="empty-state">Belum ada riwayat.</div>';
        return;
      }
      history.forEach((item) => {
        const match = item.a.match(/JAWABAN\]:\s*([A-E])/i);
        const letter = match ? match[1] : "?";
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
          <div class="history-badge">JAWABAN: ${letter}</div>
          <div class="history-q">${escape(item.q)}</div>
          <div class="history-a">${escape(item.a)}</div>
        `;
        historyList.appendChild(div);
      });
    });
  }

  function handleClear() {
    if (confirm("Hapus semua riwayat?")) {
      chrome.storage.local.set({ history: [] }, () => loadHistory());
    }
  }

  function escape(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // --- LOGIKA TOGGLE AKTIF/NONAKTIF ---
  const toggleBtn = document.getElementById("toggleBtn");
  const toggleStatusKey = "aiva_extension_enabled";

  // Cek status saat popup dibuka
  chrome.storage.local.get([toggleStatusKey], (data) => {
    // Default true jika belum ada settingan
    const isActive = data[toggleStatusKey] !== false;

    if (!isActive) {
      toggleBtn.textContent = "Aktifkan AI Solver";
      toggleBtn.style.backgroundColor = "#16a34a"; // Warna Hijau
    }
  });

  // Event Listener saat tombol diklik
  toggleBtn.addEventListener("click", () => {
    chrome.storage.local.get([toggleStatusKey], (data) => {
      const isActive = data[toggleStatusKey] !== false;

      if (isActive) {
        // Matikan Ekstensi
        chrome.storage.local.set({ [toggleStatusKey]: false }, () => {
          toggleBtn.textContent = "Aktifkan AI Solver";
          toggleBtn.style.backgroundColor = "#16a34a"; // Hijau

          // Kirim pesan ke semua tab untuk menyembunyikan UI
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              chrome.tabs
                .sendMessage(tab.id, {
                  action: "TOGGLE_EXTENSION",
                  state: false,
                })
                .catch(() => {});
            });
          });
        });
      } else {
        // Hidupkan Ekstensi
        chrome.storage.local.set({ [toggleStatusKey]: true }, () => {
          toggleBtn.textContent = "Nonaktifkan AI Solver";
          toggleBtn.style.backgroundColor = ""; // Reset ke default CSS (Biru)

          // Kirim pesan ke semua tab untuk memunculkan UI
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              chrome.tabs
                .sendMessage(tab.id, {
                  action: "TOGGLE_EXTENSION",
                  state: true,
                })
                .catch(() => {});
            });
          });
        });
      }
    });
  });
});

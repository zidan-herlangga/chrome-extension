chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "solve-question",
    title: "Jawab dengan AI Solver",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "solve-question") {
    const selectedText = info.selectionText;
    if (selectedText) {
      chrome.tabs
        .sendMessage(tab.id, {
          action: "SOLVE_FROM_CONTEXT",
          question: selectedText,
        })
        .catch((err) => console.log("Error:", err));
    }
  }
});

/* Amy - AI assistant chat for Sofina Johari
   Streams replies from /api/chat (Netlify function -> OpenRouter).
   Conversation history lives in memory - resets on page refresh. */

(function () {
  "use strict";

  var ENDPOINT = "/api/chat";

  var launch = document.getElementById("chatLaunch");
  var panel = document.getElementById("chatPanel");
  var closeBtn = document.getElementById("chatClose");
  var messagesEl = document.getElementById("chatMessages");
  var form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput");
  var sendBtn = document.getElementById("chatSend");
  if (!launch || !panel) return;

  var history = [];
  var streaming = false;
  var touchDevice = window.matchMedia("(pointer: coarse)").matches;

  function addBubble(role, text) {
    var el = document.createElement("div");
    el.className = "chat-msg chat-msg--" + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToEnd();
    return el;
  }

  function scrollToEnd() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  history.forEach(function (m) {
    addBubble(m.role, m.content);
  });

  /* ---------- Open / close ---------- */
  function openPanel() {
    panel.hidden = false;
    document.body.classList.add("chat-open");
    launch.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () {
      panel.classList.add("is-open");
    });
    scrollToEnd();
    // on touch devices, let the user tap the input themselves so the
    // keyboard doesn't cover the conversation the moment the chat opens
    if (!touchDevice) input.focus();
  }

  function closePanel() {
    panel.classList.remove("is-open");
    panel.style.height = "";
    panel.style.top = "";
    document.body.classList.remove("chat-open");
    launch.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      panel.hidden = true;
    }, 220);
    launch.focus();
  }

  launch.addEventListener("click", function () {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  /* ---------- Sending ---------- */
  function setBusy(busy) {
    streaming = busy;
    sendBtn.disabled = busy;
    input.disabled = busy;
  }

  function parseSSEChunk(buffer, onDelta) {
    var lines = buffer.split("\n");
    var rest = lines.pop(); // possibly incomplete last line
    lines.forEach(function (line) {
      line = line.replace(/\r$/, "");
      if (line.indexOf("data: ") !== 0) return; // skips comments/keep-alives
      var data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        var json = JSON.parse(data);
        var delta =
          json.choices &&
          json.choices[0] &&
          json.choices[0].delta &&
          json.choices[0].delta.content;
        if (delta) onDelta(delta);
      } catch (e) { /* partial frame — wait for more data */ }
    });
    return rest;
  }

  function send(text) {
    history.push({ role: "user", content: text });
    addBubble("user", text);

    var bubble = addBubble("assistant", "");
    bubble.classList.add("is-pending");
    setBusy(true);

    var reply = "";

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed");

        function onDelta(delta) {
          if (reply === "") bubble.classList.remove("is-pending");
          reply += delta;
          bubble.textContent = reply;
          scrollToEnd();
        }

        // Older mobile WebKit and in-app browsers (WhatsApp/Instagram/FB)
        // don't expose res.body as a readable stream — fall back to
        // buffering the whole SSE response and parsing it at once.
        if (!res.body || typeof res.body.getReader !== "function") {
          return res.text().then(function (text) {
            parseSSEChunk(text + "\n", onDelta);
          });
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) {
              parseSSEChunk(buffer + "\n", onDelta);
              return;
            }
            buffer += decoder.decode(result.value, { stream: true });
            buffer = parseSSEChunk(buffer, onDelta);
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        if (reply === "") throw new Error("Empty reply");
        history.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        bubble.classList.remove("is-pending");
        bubble.classList.add("chat-msg--error");
        bubble.textContent =
          reply || "Sorry, something went wrong. Please try again.";
        // drop the failed user turn so a retry resends cleanly
        if (reply === "") history.pop();
      })
      .then(function () {
        setBusy(false);
        if (!touchDevice) input.focus();
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || streaming) return;
    input.value = "";
    input.style.height = "auto";
    send(text);
  });

  // Auto-resize textarea as the user types
  input.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  // Keep panel locked to the visible area when the on-screen keyboard appears.
  // dvh handles this on modern browsers, but older Chrome/Android needs
  // explicit sizing via the visualViewport API.
  if (window.visualViewport) {
    function syncToViewport() {
      if (panel.hidden) return;
      if (window.matchMedia("(max-width: 1024px)").matches) {
        var vp = window.visualViewport;
        panel.style.top = vp.offsetTop + "px";
        panel.style.height = vp.height + "px";
      } else {
        panel.style.top = "";
        panel.style.height = "";
      }
      scrollToEnd();
    }
    window.visualViewport.addEventListener("resize", syncToViewport);
    window.visualViewport.addEventListener("scroll", syncToViewport);
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (touchDevice) {
        // Mobile/tablet: Enter inserts a new line; tap Send to submit
        return;
      }
      // Desktop: Enter sends, Shift+Enter inserts a new line
      if (!e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  });
})();

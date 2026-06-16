(function () {
  "use strict";

  /* ---- Google Form configuration ---- */
  var FORM_ID     = "1FAIpQLSdndj7iJ9gYYzYi4qv_tFy7LtqCPICpTmDAcXtC3BbSuAza4w";
  var ENTRY_NAME  = "entry.1541466959";
  var ENTRY_EMAIL = "entry.1327142487";
  var ENTRY_PHONE = "entry.1243312249";
  var ENTRY_SUBSCRIBE = "entry.1235783281";
  /* -------------------------------------- */

  var PDF_URL      = "assets/ebook/financial-planning-sofina-johari.pdf";
  var PDF_FILENAME = "financial-planning-sofina-johari.pdf";

  var modal      = document.getElementById("ebookModal");
  var backdrop   = document.getElementById("ebookModalBackdrop");
  var closeBtn   = document.getElementById("ebookModalClose");
  var form       = document.getElementById("ebookGateForm");
  var submitBtn  = document.getElementById("ebookModalSubmit");
  var errorEl    = document.getElementById("ebookModalError");
  var thanksEl   = document.getElementById("ebookModalThanks");
  var triggerBtn = document.getElementById("ebookDownloadBtn");

  function openModal() {
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    var firstInput = form.querySelector("input");
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
  }

  function closeModal() {
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    form.reset();
    hideError();
    thanksEl.setAttribute("hidden", "");
    form.removeAttribute("hidden");
    submitBtn.disabled = false;
    submitBtn.textContent = "Download now";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.removeAttribute("hidden");
  }

  function hideError() {
    errorEl.textContent = "";
    errorEl.setAttribute("hidden", "");
  }

  function triggerDownload() {
    var a = document.createElement("a");
    a.href = PDF_URL;
    a.download = PDF_FILENAME;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 1000);
  }

  function submitToGoogleForms(name, email, phone, subscribe) {
    var endpoint =
      "https://docs.google.com/forms/d/e/" + FORM_ID + "/formResponse";
    var body = new URLSearchParams();
    body.append(ENTRY_NAME, name);
    body.append(ENTRY_EMAIL, email);
    body.append(ENTRY_PHONE, phone);
    if (subscribe) {
      body.append(ENTRY_SUBSCRIBE, "Yes, subscribe to broadcast on whatsapp");
    }
    /*
      mode: 'no-cors' sends the request and returns an opaque response —
      we can't read the response body, but the data reaches Google Forms.
      The promise rejects only on a true network failure (offline, DNS, etc.).
    */
    return fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();

    var name      = document.getElementById("ebookName").value.trim();
    var email     = document.getElementById("ebookEmail").value.trim();
    var whatsapp  = document.getElementById("ebookWhatsapp").value.trim();
    var subscribe = document.querySelector("input[name='ebookSubscribe']:checked")?.value || "";

    if (!name || !email || !whatsapp) {
      showError("Please fill in all three fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    submitToGoogleForms(name, email, whatsapp, subscribe)
      .then(function () {
        triggerDownload();
        form.setAttribute("hidden", "");
        thanksEl.removeAttribute("hidden");
        setTimeout(closeModal, 2500);
      })
      .catch(function () {
        showError("Something went wrong. Please check your connection and try again.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Download now";
      });
  });

  triggerBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hasAttribute("hidden")) {
      closeModal();
    }
  });
})();

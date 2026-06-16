(function () {
  "use strict";

  /* ---- Google Form configuration ---- */
  var FORM_ID     = "1FAIpQLSfFRnvYgJo-sTMFf8FpwbL0D-wvC45C76EXq3Z62_iNov00sg";
  var ENTRY_NAME  = "entry.1122970565";
  var ENTRY_PHONE = "entry.1197699276";
  var ENTRY_SERVICES = "entry.1349107782";
  /* -------------------------------------- */

  var modal           = document.getElementById("contactModal");
  var backdrop        = document.getElementById("contactModalBackdrop");
  var closeBtn        = document.getElementById("contactModalClose");
  var form            = document.getElementById("contactForm");
  var submitBtn       = document.getElementById("contactSubmit");
  var errorEl         = document.getElementById("contactError");
  var thanksEl        = document.getElementById("contactThanks");
  var triggerBtn      = document.getElementById("contactTrigger");
  var servicesCheckboxes = document.querySelectorAll("input[name='contactServices']");

  if (!modal || !form) {
    console.warn("Contact form elements not found");
    return;
  }

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
    submitBtn.textContent = "Book a Free Consultation";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.removeAttribute("hidden");
  }

  function hideError() {
    errorEl.textContent = "";
    errorEl.setAttribute("hidden", "");
  }

  function submitToGoogleForms(name, phone, services) {
    var endpoint =
      "https://docs.google.com/forms/d/e/" + FORM_ID + "/formResponse";
    var body = new URLSearchParams();
    body.append(ENTRY_NAME, name);
    body.append(ENTRY_PHONE, phone);

    // Append each selected service
    services.forEach(function(service) {
      body.append(ENTRY_SERVICES, service);
    });

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

    var name  = document.getElementById("contactName").value.trim();
    var phone = document.getElementById("contactPhone").value.trim();
    var services = Array.from(servicesCheckboxes)
      .filter(function(cb) { return cb.checked; })
      .map(function(cb) { return cb.value; });

    if (!name || !phone) {
      showError("Please fill in your name and phone number.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Booking…";

    submitToGoogleForms(name, phone, services)
      .then(function () {
        form.setAttribute("hidden", "");
        thanksEl.removeAttribute("hidden");
        setTimeout(closeModal, 3000);
      })
      .catch(function () {
        showError("Something went wrong. Please check your connection and try again.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Book a Free Consultation";
      });
  });

  if (triggerBtn) triggerBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hasAttribute("hidden")) {
      closeModal();
    }
  });
})();

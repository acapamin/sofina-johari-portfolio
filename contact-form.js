(function () {
  "use strict";

  /* ---- Google Form configuration ---- */
  var FORM_ID = "1FAIpQLSfFRnvYgJo-sTMFf8FpwbL0D-wvC45C76EXq3Z62_iNov00sg";
  var ENTRIES = {
    name: "entry.1122970565",
    whatsapp: "entry.1197699276",
    goals: "entry.1349107782",
    family: "entry.1937778218",
    income: "entry.219916951",
    investments: "entry.177956529",
    takaful: "entry.1621889027",
    coverage: "entry.91646277",
    urgency: "entry.4456387",
    session: "entry.2090656090",
    notes: "entry.249267175"
  };
  /* -------------------------------------- */

  var modal = document.getElementById("contactModal");
  var backdrop = document.getElementById("contactModalBackdrop");
  var closeBtn = document.getElementById("contactModalClose");
  var form = document.getElementById("contactForm");
  var submitBtn = document.getElementById("contactSubmit");
  var errorEl = document.getElementById("contactError");
  var thanksEl = document.getElementById("contactThanks");
  var triggerBtn = document.getElementById("contactTrigger");
  var urgencySlider = document.getElementById("contactUrgency");
  var urgencyValue = document.getElementById("contactUrgencyValue");
  var goalsOtherCheckbox = document.getElementById("contactGoalsOther");
  var goalsOtherText = document.getElementById("contactGoalsOtherText");

  if (!modal || !form) {
    console.warn("Contact form elements not found");
    return;
  }

  // Update urgency value display
  if (urgencySlider) {
    urgencySlider.addEventListener("input", function() {
      urgencyValue.textContent = this.value;
    });
  }

  // Toggle "Other" text input visibility
  if (goalsOtherCheckbox) {
    goalsOtherCheckbox.addEventListener("change", function() {
      goalsOtherText.style.display = this.checked ? "block" : "none";
    });
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
    if (urgencySlider) urgencySlider.value = 5;
    if (urgencyValue) urgencyValue.textContent = "5";
    if (goalsOtherText) goalsOtherText.style.display = "none";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.removeAttribute("hidden");
  }

  function hideError() {
    errorEl.textContent = "";
    errorEl.setAttribute("hidden", "");
  }

  function collectFormData() {
    var name = document.getElementById("contactName").value.trim();
    var whatsapp = document.getElementById("contactWhatsapp").value.trim();

    var goals = Array.from(document.querySelectorAll("input[name='contactGoals']:checked"))
      .map(function(cb) {
        if (cb.value === "Other") {
          var otherText = document.getElementById("contactGoalsOtherText").value.trim();
          return otherText ? "Other: " + otherText : "Other";
        }
        return cb.value;
      });

    var family = Array.from(document.querySelectorAll("input[name='contactFamily']:checked"))
      .map(function(cb) { return cb.value; });

    var income = document.querySelector("input[name='contactIncome']:checked")?.value || "";
    var investments = document.querySelector("input[name='contactInvestments']:checked")?.value || "";
    var takaful = document.querySelector("input[name='contactTakaful']:checked")?.value || "";
    var coverage = document.querySelector("input[name='contactCoverage']:checked")?.value || "";
    var urgency = document.getElementById("contactUrgency").value || "5";
    var session = document.querySelector("input[name='contactSession']:checked")?.value || "";
    var notes = document.getElementById("contactNotes").value.trim();

    return {
      name: name,
      whatsapp: whatsapp,
      goals: goals,
      family: family,
      income: income,
      investments: investments,
      takaful: takaful,
      coverage: coverage,
      urgency: urgency,
      session: session,
      notes: notes
    };
  }

  function validateFormData(data) {
    if (!data.name || !data.whatsapp) {
      return "Please fill in Name and Whatsapp Number.";
    }
    if (data.goals.length === 0) {
      return "Please select at least one primary financial goal.";
    }
    if (data.family.length === 0) {
      return "Please select your family status.";
    }
    if (data.family.length > 2) {
      return "Please select at most 2 family status options.";
    }
    if (!data.income) {
      return "Please select your estimated monthly household income.";
    }
    if (!data.investments) {
      return "Please answer the investments question.";
    }
    if (!data.takaful) {
      return "Please answer the takaful question.";
    }
    if (!data.coverage) {
      return "Please answer the coverage question.";
    }
    if (!data.session) {
      return "Please answer the session readiness question.";
    }
    return null;
  }

  function submitToGoogleForms(data) {
    var endpoint = "https://docs.google.com/forms/d/e/" + FORM_ID + "/formResponse";
    var body = new URLSearchParams();

    body.append(ENTRIES.name, data.name);
    body.append(ENTRIES.whatsapp, data.whatsapp);
    body.append(ENTRIES.income, data.income);
    body.append(ENTRIES.investments, data.investments);
    body.append(ENTRIES.takaful, data.takaful);
    body.append(ENTRIES.coverage, data.coverage);
    body.append(ENTRIES.urgency, data.urgency);
    body.append(ENTRIES.session, data.session);
    if (data.notes) {
      body.append(ENTRIES.notes, data.notes);
    }

    // Multiple checkboxes (goals and family) - append each value
    data.goals.forEach(function(goal) {
      body.append(ENTRIES.goals, goal);
    });
    data.family.forEach(function(familyStatus) {
      body.append(ENTRIES.family, familyStatus);
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

    var data = collectFormData();
    var validationError = validateFormData(data);

    if (validationError) {
      showError(validationError);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Booking…";

    submitToGoogleForms(data)
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

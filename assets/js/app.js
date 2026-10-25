(function () {
  "use strict";

  var header = document.querySelector(".header");
  var nav = document.getElementById("site-nav");
  var burger = document.querySelector(".burger");

  function setMenu(open) {
    if (!nav || !burger) return;
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    document.body.classList.toggle("menu-open", open);
  }

  if (nav && burger) {
    burger.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || burger.contains(event.target)) return;
      setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1000) setMenu(false);
    });
  }

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Отправка фото (демо) ---------- */

  var form = document.getElementById("upload-form");
  if (!form) return;

  var input = document.getElementById("photos");
  var dropzone = document.getElementById("dropzone");
  var fileList = document.getElementById("file-list");
  var fileSummary = document.getElementById("file-summary");
  var fileError = document.getElementById("files-error");
  var formError = document.getElementById("form-error");
  var success = document.getElementById("upload-success");
  var successSummary = document.getElementById("success-summary");
  var formCard = document.getElementById("form-card");
  var moreButton = document.getElementById("more-files");
  var resetButton = document.getElementById("new-request");
  var orderHistory = document.getElementById("order-history");
  var orderHistoryList = document.getElementById("order-history-list");
  var clearHistoryButton = document.getElementById("clear-history");

  var MAX_FILES = 10;
  var MAX_SIZE = 20 * 1024 * 1024;
  var HISTORY_KEY = "cifra:orders:v1";
  var HISTORY_DAYS = 14;
  var HISTORY_MS = HISTORY_DAYS * 24 * 60 * 60 * 1000;
  var files = [];

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " КБ";
    return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " МБ";
  }

  function pluralFiles(n) {
    if (n % 10 === 1 && n % 100 !== 11) return "файл";
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "файла";
    return "файлов";
  }

  function formatOrderDate(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var datePart = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    var timePart = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return datePart + ", " + timePart;
  }

  function createOrderId() {
    var stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    var random = (Math.random().toString(36) + "0000").slice(2, 6).toUpperCase();
    return "CIFRA-" + stamp + "-" + random;
  }

  function readOrderHistory() {
    var orders = [];
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) orders = parsed;
    } catch (error) {
      return [];
    }

    var cutoff = Date.now() - HISTORY_MS;
    return orders.filter(function (order) {
      var time = order && Date.parse(order.createdAt);
      return order && order.id && isFinite(time) && time >= cutoff;
    }).sort(function (a, b) {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }

  function writeOrderHistory(orders) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(orders));
    } catch (error) {
      /* История не критична: форма должна работать и без localStorage. */
    }
  }

  function addOrderMeta(container, label, value) {
    var span = document.createElement("span");
    var strong = document.createElement("strong");
    strong.textContent = label + ": ";
    span.appendChild(strong);
    span.appendChild(document.createTextNode(value));
    container.appendChild(span);
  }

  function renderOrderHistory() {
    if (!orderHistory || !orderHistoryList) return;

    var orders = readOrderHistory();
    if (!orders.length) {
      orderHistory.hidden = true;
      orderHistoryList.innerHTML = "";
      return;
    }

    orderHistory.hidden = false;
    orderHistoryList.innerHTML = "";

    orders.forEach(function (order) {
      var card = document.createElement("article");
      card.className = "order-card";

      var top = document.createElement("div");
      top.className = "order-card__top";

      var title = document.createElement("div");
      title.className = "order-card__title";
      var id = document.createElement("strong");
      id.textContent = "№ " + order.id;
      var badge = document.createElement("span");
      badge.className = "order-card__badge";
      badge.textContent = "Демо";
      title.appendChild(id);
      title.appendChild(badge);

      var date = document.createElement("time");
      date.className = "order-card__date";
      date.dateTime = order.createdAt;
      date.textContent = formatOrderDate(order.createdAt);

      top.appendChild(title);
      top.appendChild(date);

      var meta = document.createElement("div");
      meta.className = "order-card__meta";
      addOrderMeta(meta, "Услуга", order.service || "—");
      addOrderMeta(meta, "Офис", order.office || "—");
      addOrderMeta(meta, "Формат", order.format || "—");
      addOrderMeta(meta, "Количество", order.quantity || "1");
      var filesCount = Number(order.filesCount) || 0;
      addOrderMeta(meta, "Файлы", filesCount + " " + pluralFiles(filesCount) + " · " + formatSize(Number(order.totalSize) || 0));

      card.appendChild(top);
      card.appendChild(meta);
      orderHistoryList.appendChild(card);
    });
  }

  function saveOrder(order) {
    var orders = readOrderHistory();
    orders.unshift(order);
    writeOrderHistory(orders);
    renderOrderHistory();
  }

  function updateFileSummary() {
    if (!fileSummary) return;
    if (!files.length) {
      fileSummary.textContent = "Файлы не выбраны";
      return;
    }
    var total = files.reduce(function (sum, file) { return sum + file.size; }, 0);
    fileSummary.textContent = files.length + " " + pluralFiles(files.length) + " · " + formatSize(total);
  }

  function clearFileError() {
    if (!fileError) return;
    fileError.hidden = true;
    fileError.textContent = "";
  }

  function showFileError(message) {
    if (!fileError) return;
    fileError.textContent = message;
    fileError.hidden = false;
  }

  function renderFiles() {
    if (!fileList) return;
    fileList.innerHTML = "";

    files.forEach(function (file, index) {
      var row = document.createElement("div");
      row.className = "file-item";

      var icon = document.createElement("span");
      icon.className = "file-item__icon";
      icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>';

      var info = document.createElement("span");
      info.className = "file-item__info";

      var name = document.createElement("span");
      name.className = "file-item__name";
      name.textContent = file.name;
      name.title = file.name;

      var size = document.createElement("span");
      size.className = "file-item__size";
      size.textContent = formatSize(file.size);

      info.appendChild(name);
      info.appendChild(size);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "file-item__remove";
      remove.setAttribute("aria-label", "Удалить файл " + file.name);
      remove.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      remove.addEventListener("click", function () {
        files.splice(index, 1);
        renderFiles();
      });

      row.appendChild(icon);
      row.appendChild(info);
      row.appendChild(remove);
      fileList.appendChild(row);
    });

    updateFileSummary();
    if (files.length) clearFileError();
  }

  function addFiles(list) {
    clearFileError();
    var incoming = Array.prototype.slice.call(list || []);
    var rejectedBig = 0;
    var rejectedType = 0;

    incoming.forEach(function (file) {
      if (files.length >= MAX_FILES) return;

      var lowerName = file.name.toLowerCase();
      var isImage = file.type.indexOf("image/") === 0 || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/.test(lowerName);
      var isPdf = file.type === "application/pdf" || /\.pdf$/.test(lowerName);
      if (!isImage && !isPdf) {
        rejectedType += 1;
        return;
      }

      if (file.size > MAX_SIZE) {
        rejectedBig += 1;
        return;
      }

      var duplicate = files.some(function (item) {
        return item.name === file.name && item.size === file.size && item.lastModified === file.lastModified;
      });
      if (!duplicate) files.push(file);
    });

    renderFiles();

    var messages = [];
    if (files.length >= MAX_FILES && incoming.length + files.length > MAX_FILES) {
      messages.push("Можно добавить не больше " + MAX_FILES + " файлов.");
    }
    if (rejectedBig) {
      messages.push("Файлы больше 20 МБ не добавлены. Для больших файлов пришлите ссылку.");
    }
    if (rejectedType) {
      messages.push("Добавлены только изображения и PDF.");
    }
    if (messages.length) showFileError(messages.join(" "));
  }

  if (input) {
    input.addEventListener("change", function () {
      addFiles(input.files);
      input.value = "";
    });
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", function (event) {
      if (event.dataTransfer && event.dataTransfer.files) addFiles(event.dataTransfer.files);
    });
  }

  if (moreButton) {
    moreButton.addEventListener("click", function () {
      input.click();
    });
  }

  if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", function () {
      if (!window.confirm("Очистить историю заявок в этом браузере?")) return;
      try {
        window.localStorage.removeItem(HISTORY_KEY);
      } catch (error) {
        /* Если localStorage недоступен, просто обновим пустой список. */
      }
      renderOrderHistory();
    });
  }

  renderOrderHistory();

  function fieldOf(el) {
    return el.closest(".field");
  }

  function errorFor(el) {
    var field = fieldOf(el);
    if (field) return field.querySelector(".field__error");
    return el.id ? document.getElementById(el.id + "-error") : null;
  }

  function setError(el, message) {
    var field = fieldOf(el);
    var error = errorFor(el);
    if (field) field.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearError(el) {
    var field = fieldOf(el);
    var error = errorFor(el);
    if (field) field.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  form.querySelectorAll("input, select, textarea").forEach(function (el) {
    el.addEventListener("input", function () {
      clearError(el);
      if (formError) formError.hidden = true;
    });
    el.addEventListener("change", function () {
      clearError(el);
      if (formError) formError.hidden = true;
    });
  });

  function validate() {
    var firstInvalid = null;

    function check(el, condition, message) {
      if (!el) return true;
      if (condition) {
        clearError(el);
        return true;
      }
      setError(el, message);
      if (!firstInvalid) firstInvalid = el;
      return false;
    }

    var name = form.elements.name;
    var phone = form.elements.phone;
    var branch = form.elements.branch;
    var service = form.elements.service;
    var consent = form.elements.consent;

    var ok = true;
    ok = check(name, name.value.trim().length >= 2, "Укажите имя") && ok;
    var digits = phone.value.replace(/\D/g, "");
    ok = check(phone, digits.length >= 10, "Укажите телефон для связи") && ok;
    ok = check(branch, branch.value !== "", "Выберите офис") && ok;
    ok = check(service, service.value !== "", "Выберите услугу") && ok;
    ok = check(consent, consent.checked, "Нужно согласие на обработку данных") && ok;

    if (!files.length) {
      showFileError("Добавьте хотя бы один файл или пришлите ссылку в комментарии.");
      if (!firstInvalid) firstInvalid = input;
      ok = false;
    }

    if (!ok && firstInvalid) {
      if (formError) {
        formError.textContent = "Проверьте выделенные поля и попробуйте снова.";
        formError.hidden = false;
      }
      firstInvalid.focus();
    }

    return ok;
  }

  function addSuccessItem(label, value) {
    var item = document.createElement("div");
    item.className = "success__item";
    var span = document.createElement("span");
    span.textContent = label;
    var strong = document.createElement("strong");
    strong.textContent = value;
    item.appendChild(span);
    item.appendChild(strong);
    successSummary.appendChild(item);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validate()) return;

    var branchText = form.elements.branch.options[form.elements.branch.selectedIndex].text;
    var serviceText = form.elements.service.options[form.elements.service.selectedIndex].text;
    var total = files.reduce(function (sum, file) { return sum + file.size; }, 0);
    var order = {
      id: createOrderId(),
      createdAt: new Date().toISOString(),
      status: "demo",
      service: serviceText,
      office: branchText,
      format: form.elements.format.value,
      quantity: form.elements.quantity.value || "1",
      filesCount: files.length,
      totalSize: total
    };
    saveOrder(order);

    successSummary.innerHTML = "";
    addSuccessItem("Номер", order.id);
    addSuccessItem("Дата", formatOrderDate(order.createdAt));
    addSuccessItem("Файлы", files.length + " " + pluralFiles(files.length) + " · " + formatSize(total));
    addSuccessItem("Услуга", serviceText);
    addSuccessItem("Офис", branchText);
    addSuccessItem("Телефон", form.elements.phone.value.trim());

    formCard.hidden = true;
    success.hidden = false;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var successTitle = document.getElementById("success-title");
    if (successTitle) successTitle.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });

  if (resetButton) {
    resetButton.addEventListener("click", function () {
      form.reset();
      files = [];
      renderFiles();
      form.querySelectorAll(".is-invalid").forEach(function (field) {
        field.classList.remove("is-invalid");
      });
      form.querySelectorAll(".field__error").forEach(function (error) {
        error.textContent = "";
        error.hidden = true;
      });
      if (formError) formError.hidden = true;
      clearFileError();
      success.hidden = true;
      formCard.hidden = false;

      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      formCard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (input) input.focus({ preventScroll: true });
    });
  }
})();

/* =========================================================
   Фотопакет 12 / 24 / 36 — загрузка, кадрирование, заказ
   Страница: foto-paket.html
   ========================================================= */
(function () {
  "use strict";

  var form = document.getElementById("pp-form");
  if (!form) return;

  var PACKAGE_SIZES = [12, 24, 36];
  var MAX_FILE_SIZE = 25 * 1024 * 1024;
  var OUTPUT_SIZE = 1200;
  var THUMB_SIZE = 480;
  var MAX_ZOOM = 4;
  var HISTORY_KEY = "cifra:photo-packages:v1";
  var HISTORY_DAYS = 14;

  var dropzone = document.getElementById("pp-dropzone");
  var input = document.getElementById("pp-photos");
  var grid = document.getElementById("pp-grid");
  var gridHint = document.getElementById("pp-grid-hint");
  var photosMeta = document.getElementById("pp-photos-meta");
  var filesError = document.getElementById("pp-files-error");
  var clearButton = document.getElementById("pp-clear");
  var formError = document.getElementById("pp-form-error");
  var submitButton = document.getElementById("pp-submit");
  var summaryThumbs = document.getElementById("pp-summary-thumbs");
  var summaryPackage = document.getElementById("pp-summary-package");
  var summaryCount = document.getElementById("pp-summary-count");
  var summaryPrice = document.getElementById("pp-summary-price");
  var summaryPer = document.getElementById("pp-summary-per");
  var progressBar = document.getElementById("pp-progress");
  var progressLabel = document.getElementById("pp-progress-label");
  var summaryCta = document.getElementById("pp-summary-cta");
  var summaryNote = document.getElementById("pp-summary-note");
  var packageField = document.getElementById("pp-package-field");
  var quantityField = document.getElementById("pp-quantity");
  var statusRegion = document.getElementById("pp-status");
  var layout = document.getElementById("pp-layout");
  var success = document.getElementById("pp-success");
  var successSummary = document.getElementById("pp-success-summary");
  var successStrip = document.getElementById("pp-success-strip");
  var successTitle = document.getElementById("pp-success-title");
  var successText = document.getElementById("pp-success-text");
  var successNote = document.getElementById("pp-success-note");
  var resetButton = document.getElementById("pp-new-order");
  var packageInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="pp-package"]'));

  var branchSelect = form.elements.branch;
  var nameInput = form.elements.name;
  var phoneInput = form.elements.phone;
  var commentInput = form.elements.comment;
  var consentInput = form.elements.consent;

  var isDemo = form.getAttribute("data-demo") === "true";
  var demoSaveMode = "none";
  if (isDemo) {
    demoSaveMode = isLocalDemoHost()
      ? "server"
      : (typeof window.showDirectoryPicker === "function" ? "folder" : "zip");

    var saveOverride = "";
    try {
      saveOverride = new URLSearchParams(window.location.search).get("demoSave") || "";
    } catch (error) {
      saveOverride = "";
    }
    if (saveOverride === "server" || saveOverride === "folder" || saveOverride === "zip") {
      demoSaveMode = saveOverride;
    }
  }
  var packagePrices = {};
  packageInputs.forEach(function (radio) {
    packagePrices[Number(radio.value)] = Number(radio.dataset.price || 0);
  });

  var state = {
    packageSize: 12,
    photos: [],
    editingId: null,
    adding: false,
    submitting: false
  };

  var seq = 0;
  var crcTable = null;
  var formStartedAt = Date.now();
  var submitLabel = submitButton ? submitButton.innerHTML : "";
  var summaryCtaLabel = summaryCta ? summaryCta.innerHTML : "";

  /* ---------- Общие утилиты ---------- */

  function formatPrice(value) {
    return Number(value).toLocaleString("ru-RU") + " ₽";
  }

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isLocalDemoHost() {
    var host = window.location.hostname;
    return host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }

  function demoDayFolder() {
    var now = new Date();
    return now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
  }

  function createOrderId() {
    var now = new Date();
    var stamp = String(now.getFullYear()).slice(2) + pad2(now.getMonth() + 1) + pad2(now.getDate());
    var random = (Math.random().toString(36) + "0000").slice(2, 6).toUpperCase();
    return "CIFRA-" + stamp + "-" + random;
  }

  function formatOrderDate(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var datePart = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    var timePart = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return datePart + ", " + timePart;
  }

  function selectedText(select) {
    if (!select || select.selectedIndex < 0) return "";
    return select.options[select.selectedIndex].text;
  }

  function showStatus(message) {
    if (!statusRegion) return;
    statusRegion.textContent = "";
    window.setTimeout(function () {
      statusRegion.textContent = message;
    }, 30);
  }

  /* ---------- Ошибки ---------- */

  function setFilesError(message) {
    if (!filesError) return;
    filesError.textContent = message;
    filesError.hidden = false;
  }

  function clearFilesError() {
    if (!filesError) return;
    filesError.textContent = "";
    filesError.hidden = true;
  }

  function setFormError(message) {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearFormError() {
    if (!formError) return;
    formError.textContent = "";
    formError.hidden = true;
  }

  function errorElementFor(element) {
    var field = element.closest(".field");
    if (field) return field.querySelector(".field__error");
    return element.id ? document.getElementById(element.id + "-error") : null;
  }

  function setFieldError(element, message) {
    var field = element.closest(".field");
    if (field) field.classList.add("is-invalid");
    element.setAttribute("aria-invalid", "true");
    var error = errorElementFor(element);
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function clearFieldError(element) {
    var field = element.closest(".field");
    if (field) field.classList.remove("is-invalid");
    element.removeAttribute("aria-invalid");
    var error = errorElementFor(element);
    if (!error) return;
    error.textContent = "";
    error.hidden = true;
  }

  /* ---------- Работа с изображениями ---------- */

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.decoding = "async";
      image.onload = function () {
        URL.revokeObjectURL(url);
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error("Не удалось прочитать изображение."));
          return;
        }
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Формат не поддерживается браузером."));
      };
      image.src = url;
    });
  }

  function releaseImage(image) {
    if (!image) return;
    image.onload = null;
    image.onerror = null;
    image.src = "";
  }

  function defaultCrop() {
    return { cx: 0.5, cy: 0.5, zoom: 1 };
  }

  function cropSide(photo) {
    return Math.min(photo.width, photo.height) / photo.crop.zoom;
  }

  function clampCrop(crop, width, height) {
    var side = Math.min(width, height) / crop.zoom;
    var halfX = side / (2 * width);
    var halfY = side / (2 * height);
    crop.cx = clamp(crop.cx, halfX, 1 - halfX);
    crop.cy = clamp(crop.cy, halfY, 1 - halfY);
    return crop;
  }

  function drawCrop(image, crop, size) {
    var width = image.naturalWidth;
    var height = image.naturalHeight;
    var side = Math.min(width, height) / crop.zoom;
    var sx = clamp(crop.cx * width - side / 2, 0, width - side);
    var sy = clamp(crop.cy * height - side / 2, 0, height - side);

    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не поддерживает canvas.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      if (!canvas.toBlob) {
        reject(new Error("Браузер не поддерживает подготовку JPEG."));
        return;
      }
      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Не удалось подготовить фото."));
        }
      }, type, quality);
    });
  }

  function isImageFile(file) {
    if (file.type === "image/svg+xml") return false;
    if (file.type && file.type.indexOf("image/") === 0) return true;
    return /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || "");
  }

  function isDuplicate(file) {
    return state.photos.some(function (photo) {
      return photo.file.name === file.name && photo.file.size === file.size;
    });
  }

  async function makePhoto(file) {
    var image = await loadImage(file);
    try {
      var crop = defaultCrop();
      var canvas = drawCrop(image, crop, THUMB_SIZE);
      var thumb = canvas.toDataURL("image/jpeg", 0.82);
      canvas.width = 0;
      canvas.height = 0;
      return {
        id: "photo-" + (++seq),
        file: file,
        name: file.name,
        width: image.naturalWidth,
        height: image.naturalHeight,
        crop: crop,
        thumb: thumb,
        edited: false
      };
    } finally {
      releaseImage(image);
    }
  }

  async function makeOutput(photo, asDataUrl) {
    var image = await loadImage(photo.file);
    var canvas = null;
    try {
      canvas = drawCrop(image, photo.crop, OUTPUT_SIZE);
      if (asDataUrl) {
        return canvas.toDataURL("image/jpeg", 0.92);
      }
      return await canvasToBlob(canvas, "image/jpeg", 0.92);
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      releaseImage(image);
    }
  }

  function makeOutputBlob(photo) {
    return makeOutput(photo, false);
  }

  function makeOutputDataUrl(photo) {
    return makeOutput(photo, true);
  }

  /* ---------- Добавление файлов ---------- */

  async function addFiles(fileList) {
    if (state.adding || state.submitting) return;
    var incoming = Array.prototype.slice.call(fileList || []);
    if (!incoming.length) return;

    state.adding = true;
    if (clearButton) clearButton.disabled = true;
    if (dropzone) {
      dropzone.classList.add("is-busy");
      dropzone.setAttribute("aria-busy", "true");
    }
    clearFilesError();
    clearFormError();
    updateSummary();

    var rejectedType = 0;
    var rejectedSize = 0;
    var duplicates = 0;
    var overflow = 0;
    var failed = [];
    var queue = [];

    incoming.forEach(function (file) {
      if (!isImageFile(file)) {
        rejectedType += 1;
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        rejectedSize += 1;
        return;
      }
      var duplicate = isDuplicate(file) || queue.some(function (item) {
        return item.name === file.name && item.size === file.size;
      });
      if (duplicate) {
        duplicates += 1;
        return;
      }
      queue.push(file);
    });

    for (var index = 0; index < queue.length; index++) {
      if (state.photos.length >= state.packageSize) {
        overflow += 1;
        continue;
      }
      var file = queue[index];
      if (gridHint) {
        gridHint.textContent = "Обрабатываем " + (index + 1) + " из " + queue.length + "…";
      }
      try {
        var photo = await makePhoto(file);
        state.photos.push(photo);
        renderGrid();
        updateSummary();
        showStatus("Добавлено фото " + state.photos.length + " из " + state.packageSize + ".");
      } catch (error) {
        failed.push(file.name);
      }
    }

    state.adding = false;
    if (dropzone) {
      dropzone.classList.remove("is-busy");
      dropzone.removeAttribute("aria-busy");
    }
    renderGrid();
    updateSummary();

    var messages = [];
    if (overflow) {
      messages.push("В пакете " + state.packageSize + " фото: лишние файлы не добавлены.");
    }
    if (rejectedType) {
      messages.push("Пропущены файлы, которые не являются изображениями.");
    }
    if (rejectedSize) {
      messages.push("Файлы больше 25 МБ не добавлены.");
    }
    if (duplicates) {
      messages.push("Повторы не добавлены.");
    }
    if (failed.length) {
      var hasHeic = failed.some(function (name) {
        return /\.(heic|heif)$/i.test(name);
      });
      messages.push("Не удалось открыть: " + failed.join(", ") + "." +
        (hasHeic ? " HEIC не поддерживается браузером — сохраните фото как JPG." : ""));
    }
    if (messages.length) setFilesError(messages.join(" "));
    if (state.photos.length >= state.packageSize) {
      showStatus("Пакет заполнен: " + state.packageSize + " фото.");
    }
  }

  /* ---------- Сетка фотографий ---------- */

  function createTile(photo, index) {
    var tile = document.createElement("div");
    tile.className = "pp-tile";
    tile.dataset.photoId = photo.id;

    var available = Math.round(cropSide(photo));
    var lowRes = available < OUTPUT_SIZE;

    var open = document.createElement("button");
    open.type = "button";
    open.className = "pp-tile__open";
    open.dataset.photoId = photo.id;
    open.setAttribute(
      "aria-label",
      "Фото " + (index + 1) + ". Изменить кадрирование." +
        (lowRes ? " Для печати 10×10 см может не хватить разрешения: " + available + " px по короткой стороне." : "")
    );
    if (lowRes) {
      open.title = "Для печати 10×10 см может не хватить разрешения: " + available + " px по короткой стороне.";
    }

    var image = document.createElement("img");
    image.src = photo.thumb;
    image.alt = "";
    image.loading = "lazy";
    open.appendChild(image);
    open.addEventListener("click", function () {
      openEditor(photo.id);
    });

    var number = document.createElement("span");
    number.className = "pp-tile__num";
    number.textContent = String(index + 1);

    var edit = document.createElement("span");
    edit.className = "pp-tile__edit";
    edit.textContent = "Кадрировать";

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "pp-tile__remove";
    remove.setAttribute("aria-label", "Удалить фото " + (index + 1));
    remove.textContent = "×";
    remove.addEventListener("click", function () {
      removePhoto(photo.id);
    });

    tile.appendChild(open);
    tile.appendChild(number);
    tile.appendChild(edit);
    tile.appendChild(remove);

    if (lowRes) {
      var warning = document.createElement("span");
      warning.className = "pp-tile__warn";
      warning.textContent = "!";
      warning.setAttribute("aria-hidden", "true");
      tile.appendChild(warning);
    }

    return tile;
  }

  function createSlot(number) {
    var slot = document.createElement("button");
    slot.type = "button";
    slot.className = "pp-slot";
    slot.setAttribute("aria-label", "Добавить фото " + number);

    var plus = document.createElement("span");
    plus.className = "pp-slot__plus";
    plus.textContent = "+";

    var label = document.createElement("span");
    label.className = "pp-slot__num";
    label.textContent = String(number);

    slot.appendChild(plus);
    slot.appendChild(label);
    slot.addEventListener("click", function () {
      if (state.adding) return;
      if (input) input.click();
    });
    return slot;
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = "";

    var count = state.photos.length;
    var size = state.packageSize;

    if (!count) {
      grid.hidden = true;
    } else {
      grid.hidden = false;
      state.photos.forEach(function (photo, index) {
        grid.appendChild(createTile(photo, index));
      });
      var remaining = size - count;
      var slots = Math.min(remaining, 6);
      for (var index = 0; index < slots; index++) {
        grid.appendChild(createSlot(count + index + 1));
      }
    }

    if (gridHint) {
      if (!count) {
        gridHint.textContent = "Можно выбрать сразу несколько фото. Каждое автоматически кадрируется в квадрат.";
      } else if (count < size) {
        gridHint.textContent = "Добавлено " + count + " из " + size + ". Осталось " + (size - count) + ". Нажмите на фото, чтобы поправить кадр.";
      } else {
        gridHint.textContent = "Готово: " + count + " из " + size + ". Нажмите на фото, чтобы поправить кадр.";
      }
    }

    if (clearButton) {
      clearButton.disabled = !count || state.submitting || state.adding;
    }
  }

  function removePhoto(id) {
    var index = -1;
    for (var i = 0; i < state.photos.length; i++) {
      if (state.photos[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    state.photos.splice(index, 1);
    renderGrid();
    updateSummary();
    showStatus("Фото удалено. В пакете " + state.photos.length + " из " + state.packageSize + ".");

    var next = state.photos[index];
    var target = next ? grid.querySelector('[data-photo-id="' + next.id + '"] .pp-tile__open') : null;
    if (target) {
      target.focus();
    } else if (dropzone) {
      dropzone.focus();
    }
  }

  /* ---------- Итог ---------- */

  function renderSummaryThumbs() {
    if (!summaryThumbs) return;
    summaryThumbs.innerHTML = "";
    for (var index = 0; index < 6; index++) {
      var cell = document.createElement("div");
      cell.className = "pp-summary__thumb";
      var photo = state.photos[index];
      if (photo) {
        var image = document.createElement("img");
        image.src = photo.thumb;
        image.alt = "";
        cell.appendChild(image);
      } else {
        cell.className += " pp-summary__thumb--empty";
      }
      summaryThumbs.appendChild(cell);
    }
  }

  function updateSummary() {
    var size = state.packageSize;
    var count = state.photos.length;
    var price = packagePrices[size] || 0;

    if (photosMeta) photosMeta.textContent = count + " из " + size;
    if (summaryPackage) summaryPackage.textContent = size + " фото";
    if (summaryCount) summaryCount.textContent = count + " из " + size;
    if (summaryPrice) summaryPrice.textContent = formatPrice(price);
    if (summaryPer) summaryPer.textContent = "≈ " + Math.round(price / size) + " ₽ за фото";

    if (progressBar) {
      progressBar.style.width = Math.round((count / size) * 100) + "%";
    }
    if (progressLabel) {
      progressLabel.textContent = count === size
        ? "Все " + size + " фото добавлены"
        : "Осталось добавить " + (size - count);
    }
    if (summaryNote) {
      summaryNote.textContent = count === size
        ? "Проверьте кадры и заполните контакты."
        : "Добавьте ещё " + (size - count) + ", чтобы оформить заказ.";
    }

    renderSummaryThumbs();

    if (summaryCta) summaryCta.disabled = state.submitting || state.adding;
    if (submitButton) submitButton.disabled = state.submitting || state.adding;
  }

  /* ---------- Выбор пакета ---------- */

  function selectPackage(size) {
    if (PACKAGE_SIZES.indexOf(size) === -1) return;

    if (state.photos.length > size) {
      var previous = state.packageSize;
      packageInputs.forEach(function (radio) {
        radio.checked = Number(radio.value) === previous;
      });
      setFilesError("Сейчас выбран пакет из " + previous + " фото, загружено " + state.photos.length +
        ". Чтобы перейти на пакет из " + size + ", удалите " + (state.photos.length - size) + " фото.");
      showStatus("Пакет не изменён: сначала удалите лишние фото.");
      return;
    }

    state.packageSize = size;
    if (packageField) packageField.value = String(size);
    if (quantityField) quantityField.value = String(size);
    clearFilesError();
    renderGrid();
    updateSummary();
    showStatus("Выбран пакет: " + size + " фото.");
  }

  /* ---------- Редактор кадра ---------- */

  var editor = {
    overlay: document.getElementById("pp-editor"),
    dialog: null,
    crop: document.getElementById("pp-crop"),
    image: document.getElementById("pp-crop-image"),
    grid: document.getElementById("pp-crop-grid"),
    loading: document.getElementById("pp-crop-loading"),
    title: document.getElementById("pp-editor-title"),
    zoom: document.getElementById("pp-zoom"),
    zoomValue: document.getElementById("pp-zoom-value"),
    apply: document.getElementById("pp-apply"),
    gridButton: document.getElementById("pp-grid-toggle"),
    center: document.getElementById("pp-center"),
    zoomIn: document.getElementById("pp-zoom-in"),
    zoomOut: document.getElementById("pp-zoom-out"),
    photo: null,
    cropState: null,
    loaded: false,
    token: 0,
    objectUrl: "",
    previousFocus: null,
    drag: null,
    pinch: null,
    pointers: {},
    pointerCount: 0
  };
  if (editor.overlay) {
    editor.dialog = editor.overlay.querySelector(".pp-dialog");
  }

  function renderEditor() {
    if (!editor.image || !editor.cropState || !editor.crop) return;
    var viewport = editor.crop.clientWidth;
    if (!viewport) return;

    var width = editor.image.naturalWidth;
    var height = editor.image.naturalHeight;
    if (!width || !height) return;

    var side = Math.min(width, height) / editor.cropState.zoom;
    var scale = viewport / side;
    var displayWidth = width * scale;
    var displayHeight = height * scale;
    var left = viewport / 2 - editor.cropState.cx * displayWidth;
    var top = viewport / 2 - editor.cropState.cy * displayHeight;

    editor.image.style.width = displayWidth + "px";
    editor.image.style.height = displayHeight + "px";
    editor.image.style.left = left + "px";
    editor.image.style.top = top + "px";
  }

  function updateZoomUi() {
    if (!editor.cropState) return;
    var percent = Math.round(editor.cropState.zoom * 100);
    if (editor.zoom) editor.zoom.value = String(percent);
    if (editor.zoomValue) editor.zoomValue.textContent = percent + "%";
  }

  function setZoom(value, clientX, clientY) {
    if (!editor.loaded || !editor.cropState || !editor.image) return;
    var next = clamp(value, 1, MAX_ZOOM);
    var current = editor.cropState.zoom;
    if (Math.abs(next - current) < 0.0001) {
      updateZoomUi();
      return;
    }

    if (typeof clientX === "number" && typeof clientY === "number" && editor.crop) {
      var rect = editor.crop.getBoundingClientRect();
      var viewport = rect.width;
      var width = editor.image.naturalWidth;
      var height = editor.image.naturalHeight;
      var oldSide = Math.min(width, height) / current;
      var newSide = Math.min(width, height) / next;
      var px = clientX - rect.left;
      var py = clientY - rect.top;
      var sourceX = editor.cropState.cx * width + (px - viewport / 2) * (oldSide / viewport);
      var sourceY = editor.cropState.cy * height + (py - viewport / 2) * (oldSide / viewport);

      editor.cropState.cx = sourceX / width - (px - viewport / 2) * (newSide / viewport) / width;
      editor.cropState.cy = sourceY / height - (py - viewport / 2) * (newSide / viewport) / height;
    }

    editor.cropState.zoom = next;
    clampCrop(editor.cropState, editor.image.naturalWidth, editor.image.naturalHeight);
    updateZoomUi();
    renderEditor();
  }

  function resetCrop() {
    if (!editor.loaded || !editor.cropState || !editor.image) return;
    editor.cropState.cx = 0.5;
    editor.cropState.cy = 0.5;
    editor.cropState.zoom = 1;
    clampCrop(editor.cropState, editor.image.naturalWidth, editor.image.naturalHeight);
    updateZoomUi();
    renderEditor();
  }

  function moveView(dx, dy) {
    if (!editor.loaded || !editor.cropState || !editor.crop || !editor.image) return;
    var viewport = editor.crop.clientWidth;
    if (!viewport) return;
    var width = editor.image.naturalWidth;
    var height = editor.image.naturalHeight;
    var side = Math.min(width, height) / editor.cropState.zoom;
    var scale = viewport / side;

    editor.cropState.cx += dx / (scale * width);
    editor.cropState.cy += dy / (scale * height);
    clampCrop(editor.cropState, width, height);
    renderEditor();
  }

  function setEditorGrid(visible) {
    if (!editor.grid || !editor.gridButton) return;
    editor.grid.hidden = !visible;
    editor.gridButton.setAttribute("aria-pressed", visible ? "true" : "false");
  }

  function openEditor(id) {
    if (!editor.overlay || !editor.overlay.hidden || !editor.image || state.submitting) return;
    var photo = null;
    for (var index = 0; index < state.photos.length; index++) {
      if (state.photos[index].id === id) {
        photo = state.photos[index];
        break;
      }
    }
    if (!photo) return;

    state.editingId = id;
    editor.photo = photo;
    editor.cropState = { cx: photo.crop.cx, cy: photo.crop.cy, zoom: photo.crop.zoom };
    editor.loaded = false;
    editor.previousFocus = document.activeElement;
    var token = ++editor.token;

    if (editor.title) {
      editor.title.textContent = "Фото " + (state.photos.indexOf(photo) + 1) + " из " + state.packageSize;
    }
    if (editor.loading) {
      editor.loading.hidden = false;
      editor.loading.textContent = "Загружаем фото…";
    }
    if (editor.apply) editor.apply.disabled = true;
    if (editor.image) {
      editor.image.style.visibility = "hidden";
      editor.image.removeAttribute("src");
    }
    setEditorGrid(true);

    editor.overlay.hidden = false;
    document.body.classList.add("pp-modal-open");
    if (editor.crop) editor.crop.focus({ preventScroll: true });

    var url = URL.createObjectURL(photo.file);
    editor.objectUrl = url;

    editor.image.onload = function () {
      if (token !== editor.token) return;
      editor.loaded = true;
      editor.image.style.visibility = "visible";
      if (editor.loading) editor.loading.hidden = true;
      if (editor.apply) editor.apply.disabled = false;
      clampCrop(editor.cropState, editor.image.naturalWidth, editor.image.naturalHeight);
      updateZoomUi();
      renderEditor();
      if (editor.crop) editor.crop.focus({ preventScroll: true });
    };
    editor.image.onerror = function () {
      if (token !== editor.token) return;
      if (editor.loading) {
        editor.loading.hidden = false;
        editor.loading.textContent = "Не удалось открыть фото. Сохраните его как JPG и попробуйте снова.";
      }
      if (editor.apply) editor.apply.disabled = true;
    };
    editor.image.src = url;
  }

  function closeEditor(restoreFocus) {
    if (!editor.overlay || editor.overlay.hidden) return;
    var focusId = state.editingId;

    editor.token += 1;
    editor.overlay.hidden = true;
    document.body.classList.remove("pp-modal-open");

    if (editor.image) {
      editor.image.onload = null;
      editor.image.onerror = null;
      editor.image.removeAttribute("src");
      editor.image.style.visibility = "hidden";
    }
    if (editor.objectUrl) {
      URL.revokeObjectURL(editor.objectUrl);
      editor.objectUrl = "";
    }

    editor.photo = null;
    editor.cropState = null;
    editor.loaded = false;
    editor.drag = null;
    editor.pinch = null;
    editor.pointers = {};
    editor.pointerCount = 0;
    if (editor.crop) editor.crop.classList.remove("is-dragging");
    state.editingId = null;

    if (restoreFocus === false) return;
    var target = focusId ? grid.querySelector('[data-photo-id="' + focusId + '"] .pp-tile__open') : null;
    if (target) {
      target.focus();
    } else if (editor.previousFocus && document.contains(editor.previousFocus)) {
      editor.previousFocus.focus();
    }
  }

  function applyCrop() {
    if (!editor.photo || !editor.loaded || !editor.cropState) return;
    var width = editor.image.naturalWidth;
    var height = editor.image.naturalHeight;
    clampCrop(editor.cropState, width, height);

    var canvas = drawCrop(editor.image, editor.cropState, THUMB_SIZE);
    var thumb = canvas.toDataURL("image/jpeg", 0.82);
    canvas.width = 0;
    canvas.height = 0;

    editor.photo.crop = {
      cx: editor.cropState.cx,
      cy: editor.cropState.cy,
      zoom: editor.cropState.zoom
    };
    editor.photo.thumb = thumb;
    editor.photo.edited = true;

    var id = editor.photo.id;
    closeEditor(false);
    renderGrid();
    updateSummary();

    var target = grid.querySelector('[data-photo-id="' + id + '"] .pp-tile__open');
    if (target) target.focus();
    showStatus("Кадр обновлён.");
  }

  function pointerList() {
    var points = [];
    for (var key in editor.pointers) {
      if (Object.prototype.hasOwnProperty.call(editor.pointers, key)) {
        points.push(editor.pointers[key]);
      }
    }
    return points;
  }

  function startDrag(point) {
    if (!editor.cropState) return;
    editor.drag = {
      startX: point.x,
      startY: point.y,
      cx: editor.cropState.cx,
      cy: editor.cropState.cy
    };
    if (editor.crop) editor.crop.classList.add("is-dragging");
  }

  function endPointer(event) {
    if (!editor.crop || !editor.pointers[event.pointerId]) return;
    delete editor.pointers[event.pointerId];
    editor.pointerCount = Math.max(0, editor.pointerCount - 1);

    try {
      if (editor.crop.hasPointerCapture(event.pointerId)) {
        editor.crop.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      /* Указатель уже отпущен браузером. */
    }

    if (editor.pointerCount < 2) editor.pinch = null;
    if (editor.pointerCount === 0) {
      editor.drag = null;
      editor.crop.classList.remove("is-dragging");
    } else if (editor.pointerCount === 1) {
      var points = pointerList();
      if (points.length) {
        startDrag(points[0]);
      } else {
        editor.drag = null;
      }
    }
  }

  if (editor.crop) {
    editor.crop.addEventListener("pointerdown", function (event) {
      if (!editor.loaded) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      editor.crop.focus({ preventScroll: true });

      try {
        editor.crop.setPointerCapture(event.pointerId);
      } catch (error) {
        /* Некоторые браузеры не поддерживают capture для этого указателя. */
      }

      editor.pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      editor.pointerCount += 1;

      if (editor.pointerCount === 1) {
        startDrag(editor.pointers[event.pointerId]);
      } else if (editor.pointerCount === 2) {
        editor.drag = null;
        editor.crop.classList.remove("is-dragging");
        var points = pointerList();
        editor.pinch = {
          distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
          zoom: editor.cropState.zoom
        };
      }
    });

    editor.crop.addEventListener("pointermove", function (event) {
      if (!editor.loaded || !editor.pointers[event.pointerId]) return;
      event.preventDefault();
      editor.pointers[event.pointerId] = { x: event.clientX, y: event.clientY };

      if (editor.pointerCount >= 2 && editor.pinch) {
        var points = pointerList();
        if (points.length >= 2 && editor.pinch.distance > 0) {
          var distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          var midX = (points[0].x + points[1].x) / 2;
          var midY = (points[0].y + points[1].y) / 2;
          setZoom(editor.pinch.zoom * (distance / editor.pinch.distance), midX, midY);
        }
        return;
      }

      if (!editor.drag) return;
      var viewport = editor.crop.clientWidth;
      var width = editor.image.naturalWidth;
      var height = editor.image.naturalHeight;
      var side = Math.min(width, height) / editor.cropState.zoom;
      var scale = viewport / side;

      editor.cropState.cx = editor.drag.cx - (event.clientX - editor.drag.startX) / (scale * width);
      editor.cropState.cy = editor.drag.cy - (event.clientY - editor.drag.startY) / (scale * height);
      clampCrop(editor.cropState, width, height);
      renderEditor();
    });

    editor.crop.addEventListener("pointerup", endPointer);
    editor.crop.addEventListener("pointercancel", endPointer);

    editor.crop.addEventListener("wheel", function (event) {
      if (!editor.loaded) return;
      event.preventDefault();
      var delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      setZoom(editor.cropState.zoom * Math.exp(-delta * 0.0015), event.clientX, event.clientY);
    }, { passive: false });

    editor.crop.addEventListener("keydown", function (event) {
      if (!editor.loaded) return;
      var step = event.shiftKey ? 40 : 10;
      var handled = true;

      if (event.key === "ArrowLeft") {
        moveView(-step, 0);
      } else if (event.key === "ArrowRight") {
        moveView(step, 0);
      } else if (event.key === "ArrowUp") {
        moveView(0, -step);
      } else if (event.key === "ArrowDown") {
        moveView(0, step);
      } else if (event.key === "+" || event.key === "=") {
        setZoom(editor.cropState.zoom + 0.1);
      } else if (event.key === "-" || event.key === "_") {
        setZoom(editor.cropState.zoom - 0.1);
      } else if (event.key === "0") {
        resetCrop();
      } else {
        handled = false;
      }

      if (handled) event.preventDefault();
    });
  }

  if (editor.zoom) {
    editor.zoom.addEventListener("input", function () {
      setZoom(Number(editor.zoom.value) / 100);
    });
  }
  if (editor.zoomIn) {
    editor.zoomIn.addEventListener("click", function () {
      setZoom(editor.cropState ? editor.cropState.zoom + 0.25 : 1);
    });
  }
  if (editor.zoomOut) {
    editor.zoomOut.addEventListener("click", function () {
      setZoom(editor.cropState ? editor.cropState.zoom - 0.25 : 1);
    });
  }
  if (editor.center) {
    editor.center.addEventListener("click", resetCrop);
  }
  if (editor.gridButton) {
    editor.gridButton.addEventListener("click", function () {
      var visible = editor.gridButton.getAttribute("aria-pressed") !== "true";
      setEditorGrid(visible);
    });
  }
  if (editor.apply) {
    editor.apply.addEventListener("click", applyCrop);
  }
  if (editor.overlay) {
    editor.overlay.querySelectorAll("[data-close]").forEach(function (element) {
      element.addEventListener("click", function () {
        closeEditor(true);
      });
    });
    editor.overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor(true);
        return;
      }
      if (event.key !== "Tab" || !editor.dialog) return;

      var focusable = editor.dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }
  window.addEventListener("resize", function () {
    if (editor.overlay && !editor.overlay.hidden) renderEditor();
  });

  /* ---------- Загрузка и выбор файлов ---------- */

  if (input) {
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = "";
      addFiles(files);
    });
  }

  if (dropzone) {
    dropzone.addEventListener("click", function () {
      if (input) input.click();
    });
    dropzone.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (input) input.click();
    });

    ["dragenter", "dragover"].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.remove("is-dragover");
      });
    });
    dropzone.addEventListener("drop", function (event) {
      var files = event.dataTransfer ? event.dataTransfer.files : null;
      if (files && files.length) addFiles(files);
    });
  }

  document.addEventListener("dragover", function (event) {
    if (event.dataTransfer && Array.prototype.indexOf.call(event.dataTransfer.types, "Files") !== -1) {
      event.preventDefault();
    }
  });
  document.addEventListener("drop", function (event) {
    if (dropzone && dropzone.contains(event.target)) return;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
      event.preventDefault();
    }
  });
  document.addEventListener("paste", function (event) {
    if (editor.overlay && !editor.overlay.hidden) return;
    if (!event.clipboardData) return;
    var target = event.target;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    var files = [];
    Array.prototype.forEach.call(event.clipboardData.items || [], function (item) {
      if (item.kind !== "file") return;
      var file = item.getAsFile();
      if (file) files.push(file);
    });
    if (files.length) {
      event.preventDefault();
      addFiles(files);
    }
  });

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (!state.photos.length) return;
      if (!window.confirm("Удалить все загруженные фото?")) return;
      state.photos = [];
      clearFilesError();
      renderGrid();
      updateSummary();
      showStatus("Все фото удалены.");
      if (dropzone) dropzone.focus();
    });
  }

  /* ---------- Форма ---------- */

  [branchSelect, nameInput, phoneInput, consentInput].forEach(function (element) {
    if (!element) return;
    element.addEventListener("input", function () {
      clearFieldError(element);
      clearFormError();
    });
    element.addEventListener("change", function () {
      clearFieldError(element);
      clearFormError();
    });
  });

  function validate() {
    var firstInvalid = null;

    function check(element, condition, message) {
      if (!element) return false;
      if (condition) {
        clearFieldError(element);
        return true;
      }
      setFieldError(element, message);
      if (!firstInvalid) firstInvalid = element;
      return false;
    }

    if (state.photos.length !== state.packageSize) {
      if (state.photos.length < state.packageSize) {
        setFilesError("В пакете " + state.packageSize + " фото. Добавьте ещё " +
          (state.packageSize - state.photos.length) + ".");
      } else {
        setFilesError("В пакете " + state.packageSize + " фото, а загружено " +
          state.photos.length + ". Удалите лишние фото.");
      }
      if (dropzone) {
        dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
        dropzone.focus({ preventScroll: true });
      }
      return false;
    }
    clearFilesError();

    var ok = true;
    ok = check(branchSelect, branchSelect && branchSelect.value !== "", "Выберите офис") && ok;
    ok = check(nameInput, nameInput && nameInput.value.trim().length >= 2, "Укажите имя") && ok;
    ok = check(phoneInput, phoneInput && phoneInput.value.replace(/\D/g, "").length >= 10, "Укажите телефон для связи") && ok;
    ok = check(consentInput, consentInput && consentInput.checked, "Нужно согласие на обработку данных") && ok;

    if (!ok) {
      if (formError) {
        formError.textContent = "Проверьте выделенные поля и попробуйте снова.";
        formError.hidden = false;
      }
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus({ preventScroll: true });
      }
      return false;
    }

    return true;
  }

  function setSubmitting(busy, label) {
    state.submitting = busy;

    if (submitButton) {
      submitButton.disabled = busy;
      if (busy) {
        submitButton.textContent = label || "Отправляем…";
      } else {
        submitButton.innerHTML = submitLabel;
      }
    }
    if (summaryCta) {
      summaryCta.disabled = busy;
      if (busy) {
        summaryCta.textContent = label || "Отправляем…";
      } else {
        summaryCta.innerHTML = summaryCtaLabel;
      }
    }
    if (clearButton) {
      clearButton.disabled = busy || state.adding || !state.photos.length;
    }
    if (dropzone) {
      dropzone.setAttribute("aria-busy", busy ? "true" : "false");
    }
  }

  function setProgressLabel(text) {
    if (!state.submitting) return;
    if (submitButton) submitButton.textContent = text;
    if (summaryCta) summaryCta.textContent = text;
  }

  function addSuccessItem(label, value) {
    if (!successSummary) return;
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

  function saveHistory(order) {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      var cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
      list = list.filter(function (item) {
        return item && item.createdAt && Date.parse(item.createdAt) >= cutoff;
      });
      list.unshift({
        id: order.id,
        createdAt: order.createdAt,
        packageSize: order.packageSize,
        price: order.price,
        branch: order.branch,
        status: order.status
      });
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (error) {
      /* История не критична: заказ должен оформляться и без localStorage. */
    }
  }

  function showSuccess(order) {
    if (!success) return;

    if (successSummary) {
      successSummary.innerHTML = "";
      addSuccessItem("Номер", order.id);
      addSuccessItem("Дата", formatOrderDate(order.createdAt));
      addSuccessItem("Пакет", order.packageSize + " фото · 10×10 см");
      addSuccessItem("Стоимость", formatPrice(order.price));
      addSuccessItem("Офис", order.branch || "—");
      addSuccessItem("Телефон", order.phone || "—");
      if (order.demoFolder) {
        addSuccessItem("Папка", order.demoFolder);
        addSuccessItem("Файлов", order.demoFiles + " JPEG");
      }
    }

    if (successStrip) {
      successStrip.innerHTML = "";
      state.photos.forEach(function (photo, index) {
        var image = document.createElement("img");
        image.src = photo.thumb;
        image.alt = "Фото " + (index + 1) + " в заказе";
        image.loading = "lazy";
        successStrip.appendChild(image);
      });
    }

    if (successTitle) {
      successTitle.textContent = isDemo
        ? (order.demoSaved ? "Демо-заказ сохранён" : "Демо-заказ оформлен")
        : "Заказ оформлен";
      successTitle.focus({ preventScroll: true });
    }
    if (successText) {
      successText.textContent = isDemo
        ? (order.demoSaved
            ? (order.demoZip
                ? "Фото не ушли оператору. ZIP с квадратными кадрами и папкой, как на проде, скачан."
                : "Фото не ушли оператору. Квадратные кадры сохранены локально в папку, как на проде.")
            : "Это демонстрация: фото не отправлены. В рабочей версии квадратные кадры ушли бы оператору.")
        : "Квадратные кадры отправлены оператору. Он проверит заказ, подтвердит цену и свяжется с вами.";
    }
    if (successNote) {
      successNote.textContent = isDemo
        ? (order.demoSaved
            ? (order.demoZip
                ? "Демо-режим · архив " + order.demoZipName + " · внутри " + order.demoFolder
                : "Демо-режим · " + order.demoFiles + " файлов в " + order.demoFolder)
            : "Демо-режим · без отправки файлов и данных")
        : "Оплата — после подтверждения заказа оператором.";
    }

    if (layout) layout.hidden = true;
    success.hidden = false;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    success.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function buildDemoOrderRecord(order, files, total, folder) {
    return {
      id: order.id,
      created_at: order.createdAt,
      source: "demo",
      branch: order.branch,
      service: "Фотопакет 10×10 см (" + order.packageSize + " фото)",
      format: "10×10 см",
      quantity: order.packageSize,
      package: order.packageSize,
      name: order.name,
      phone: order.phone,
      email: "",
      comment: commentInput ? commentInput.value.trim() : "",
      files: files.map(function (file) {
        return {
          stored: file.name,
          name: file.name,
          size: file.size,
          mime: file.mime
        };
      }),
      total_size: total,
      ip: "",
      user_agent: navigator.userAgent.slice(0, 300),
      demo_folder: folder
    };
  }

  async function saveDemoToFolder(rootHandle, order) {
    var day = demoDayFolder();
    var storageDir = await rootHandle.getDirectoryHandle("storage", { create: true });
    var ordersDir = await storageDir.getDirectoryHandle("orders", { create: true });
    var dayDir = await ordersDir.getDirectoryHandle(day, { create: true });
    var orderDir = await dayDir.getDirectoryHandle(order.id, { create: true });

    var files = [];
    var total = 0;
    for (var index = 0; index < state.photos.length; index++) {
      setProgressLabel("Сохраняем " + (index + 1) + " из " + state.photos.length + "…");
      var blob = await makeOutputBlob(state.photos[index]);
      files.push({
        name: pad2(index + 1) + ".jpg",
        blob: blob,
        size: blob.size,
        mime: "image/jpeg"
      });
      total += blob.size;
    }

    for (var fileIndex = 0; fileIndex < files.length; fileIndex++) {
      var fileHandle = await orderDir.getFileHandle(files[fileIndex].name, { create: true });
      var writable = await fileHandle.createWritable();
      await writable.write(files[fileIndex].blob);
      await writable.close();
    }

    var folder = "storage/orders/" + day + "/" + order.id;
    var record = buildDemoOrderRecord(order, files, total, folder);
    var jsonHandle = await orderDir.getFileHandle("order.json", { create: true });
    var jsonWritable = await jsonHandle.createWritable();
    await jsonWritable.write(JSON.stringify(record, null, 2));
    await jsonWritable.close();

    return { folder: folder, files: files.length };
  }

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) {
          c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        }
        crcTable[n] = c >>> 0;
      }
    }

    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeZip(entries) {
    var encoder = new TextEncoder();
    var chunks = [];
    var central = [];
    var offset = 0;
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    entries.forEach(function (entry) {
      var nameBytes = encoder.encode(entry.name);
      var data = entry.data;
      var crc = crc32(data);

      var local = new Uint8Array(30 + nameBytes.length);
      var localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      chunks.push(local, data);

      var header = new Uint8Array(46 + nameBytes.length);
      var headerView = new DataView(header.buffer);
      headerView.setUint32(0, 0x02014b50, true);
      headerView.setUint16(4, 20, true);
      headerView.setUint16(6, 20, true);
      headerView.setUint16(8, 0x0800, true);
      headerView.setUint16(10, 0, true);
      headerView.setUint16(12, dosTime, true);
      headerView.setUint16(14, dosDate, true);
      headerView.setUint32(16, crc, true);
      headerView.setUint32(20, data.length, true);
      headerView.setUint32(24, data.length, true);
      headerView.setUint16(28, nameBytes.length, true);
      headerView.setUint16(30, 0, true);
      headerView.setUint16(32, 0, true);
      headerView.setUint16(34, 0, true);
      headerView.setUint16(36, 0, true);
      headerView.setUint32(38, 0, true);
      headerView.setUint32(42, offset, true);
      header.set(nameBytes, 46);
      central.push(header);

      offset += local.length + data.length;
    });

    var centralStart = offset;
    var centralSize = 0;
    central.forEach(function (header) {
      chunks.push(header);
      centralSize += header.length;
    });

    var end = new Uint8Array(22);
    var endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, centralStart, true);
    endView.setUint16(20, 0, true);
    chunks.push(end);

    return new Blob(chunks, { type: "application/zip" });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 30000);
  }

  async function saveDemoZip(order) {
    var files = [];
    var total = 0;
    for (var index = 0; index < state.photos.length; index++) {
      setProgressLabel("Сохраняем " + (index + 1) + " из " + state.photos.length + "…");
      var blob = await makeOutputBlob(state.photos[index]);
      files.push({
        name: pad2(index + 1) + ".jpg",
        blob: blob,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        size: blob.size,
        mime: "image/jpeg"
      });
      total += blob.size;
    }

    var folder = "storage/orders/" + demoDayFolder() + "/" + order.id;
    var record = buildDemoOrderRecord(order, files, total, folder);
    var entries = files.map(function (file) {
      return { name: folder + "/" + file.name, data: file.bytes };
    });
    entries.push({
      name: folder + "/order.json",
      data: new TextEncoder().encode(JSON.stringify(record, null, 2))
    });

    var archive = makeZip(entries);
    var filename = order.id + ".zip";
    downloadBlob(archive, filename);
    return { folder: folder, files: files.length, filename: filename };
  }

  async function submitDemo() {
    if (demoSaveMode === "folder" && typeof window.showDirectoryPicker !== "function") {
      demoSaveMode = "zip";
    }
    if (demoSaveMode === "none") {
      setFormError("Этот браузер не умеет сохранять папку. Откройте демо в Chrome/Edge или запустите через node serve-v2.js.");
      return;
    }

    var folderHandle = null;
    if (demoSaveMode === "folder") {
      try {
        folderHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "cifra-demo-orders" });
      } catch (error) {
        if (error && error.name === "AbortError") {
          setFormError("Сохранение отменено — заказ не оформлен.");
        } else {
          setFormError("Не удалось открыть папку для сохранения. Попробуйте ещё раз.");
        }
        return;
      }
    }

    setSubmitting(true, "Сохраняем фото…");
    clearFormError();

    try {
      var order = {
        id: createOrderId(),
        createdAt: new Date().toISOString(),
        packageSize: state.packageSize,
        price: packagePrices[state.packageSize] || 0,
        branch: selectedText(branchSelect),
        name: nameInput ? nameInput.value.trim() : "",
        phone: phoneInput ? phoneInput.value.trim() : "",
        status: "demo"
      };

      if (demoSaveMode === "server") {
        var photos = [];
        for (var index = 0; index < state.photos.length; index++) {
          setProgressLabel("Сохраняем " + (index + 1) + " из " + state.photos.length + "…");
          photos.push({
            name: pad2(index + 1) + ".jpg",
            dataUrl: await makeOutputDataUrl(state.photos[index])
          });
        }
        setProgressLabel("Записываем в папку…");

        var response = await fetch("__demo/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            createdAt: order.createdAt,
            package: state.packageSize,
            branch: order.branch,
            name: order.name,
            phone: order.phone,
            comment: commentInput ? commentInput.value.trim() : "",
            photos: photos
          })
        });

        var result = null;
        try {
          result = await response.json();
        } catch (error) {
          result = null;
        }
        if (!response.ok || !result || !result.ok) {
          throw new Error(result && result.message ? result.message : "Не удалось сохранить файлы в локальную папку.");
        }

        order.id = result.id || order.id;
        order.demoFolder = result.folder;
        order.demoFiles = result.files;
        order.demoSaved = true;
      } else if (demoSaveMode === "folder") {
        var saved = await saveDemoToFolder(folderHandle, order);
        order.demoFolder = saved.folder;
        order.demoFiles = saved.files;
        order.demoSaved = true;
      } else {
        var archive = await saveDemoZip(order);
        order.demoFolder = archive.folder;
        order.demoFiles = archive.files;
        order.demoZip = true;
        order.demoZipName = archive.filename;
        order.demoSaved = true;
      }

      saveHistory(order);
      showSuccess(order);
      setSubmitting(false);
    } catch (error) {
      setFormError(error && error.message ? error.message : "Не удалось сохранить фотопакет. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  async function submitProduction() {
    setSubmitting(true, "Готовим фото…");
    clearFormError();

    try {
      var data = new FormData(form);
      data.delete("photos");

      for (var index = 0; index < state.photos.length; index++) {
        setProgressLabel("Готовим " + (index + 1) + " из " + state.photos.length + "…");
        var blob = await makeOutputBlob(state.photos[index]);
        data.append("photos[]", blob, pad2(index + 1) + ".jpg");
      }

      data.set("package", String(state.packageSize));
      data.set("quantity", String(state.packageSize));
      data.set("elapsed", String(Math.max(1200, Date.now() - formStartedAt)));

      setProgressLabel("Отправляем…");

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller ? window.setTimeout(function () {
        controller.abort();
      }, 180000) : null;

      var response;
      try {
        response = await fetch(form.action || "send.php", {
          method: "POST",
          body: data,
          headers: { "Accept": "application/json" },
          signal: controller ? controller.signal : undefined
        });
      } finally {
        if (timer) window.clearTimeout(timer);
      }

      var result;
      try {
        result = await response.json();
      } catch (error) {
        throw new Error("Сервер вернул неожиданный ответ. Позвоните нам: +7 926 040-74-05.");
      }

      if (!response.ok || !result || !result.ok) {
        throw new Error(result && result.message ? result.message : "Не удалось отправить заказ.");
      }

      var order = {
        id: result.id,
        createdAt: result.createdAt || new Date().toISOString(),
        packageSize: state.packageSize,
        price: packagePrices[state.packageSize] || 0,
        branch: selectedText(branchSelect),
        name: nameInput ? nameInput.value.trim() : "",
        phone: phoneInput ? phoneInput.value.trim() : "",
        status: "sent"
      };

      saveHistory(order);
      showSuccess(order);
      setSubmitting(false);
    } catch (error) {
      var message = error && error.name === "AbortError"
        ? "Отправка заняла слишком много времени. Проверьте связь и попробуйте ещё раз."
        : (error && error.message ? error.message : "Не удалось отправить заказ. Попробуйте ещё раз.");
      setFormError(message);
      setSubmitting(false);
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.submitting) return;
    if (!validate()) return;
    if (isDemo) {
      submitDemo();
    } else {
      submitProduction();
    }
  });

  function resetPage() {
    form.reset();
    formStartedAt = Date.now();
    state.photos = [];
    state.packageSize = 12;
    state.editingId = null;
    state.submitting = false;

    packageInputs.forEach(function (radio) {
      radio.checked = Number(radio.value) === 12;
    });
    if (packageField) packageField.value = "12";
    if (quantityField) quantityField.value = "12";

    form.querySelectorAll(".field.is-invalid").forEach(function (field) {
      field.classList.remove("is-invalid");
    });
    form.querySelectorAll(".field__error").forEach(function (error) {
      error.textContent = "";
      error.hidden = true;
    });

    clearFilesError();
    clearFormError();
    setSubmitting(false);
    renderGrid();
    updateSummary();

    if (success) success.hidden = true;
    if (layout) layout.hidden = false;
    if (successSummary) successSummary.innerHTML = "";
    if (successStrip) successStrip.innerHTML = "";

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (layout) layout.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

    window.setTimeout(function () {
      var firstPackage = packageInputs[0];
      if (firstPackage) firstPackage.focus({ preventScroll: true });
    }, 250);
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetPage);
  }

  /* ---------- Старт ---------- */

  var initialPackage = 12;
  packageInputs.forEach(function (radio) {
    if (radio.checked) initialPackage = Number(radio.value);
    radio.addEventListener("change", function () {
      if (radio.checked) selectPackage(Number(radio.value));
    });
  });

  state.packageSize = PACKAGE_SIZES.indexOf(initialPackage) !== -1 ? initialPackage : 12;
  if (packageField) packageField.value = String(state.packageSize);
  if (quantityField) quantityField.value = String(state.packageSize);

  renderGrid();
  updateSummary();
  setSubmitting(false);
})();

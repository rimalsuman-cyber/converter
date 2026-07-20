const categories = {
  length: {
    units: {
      meter: { label: "Meter", factor: 1 },
      kilometer: { label: "Kilometer", factor: 1000 },
      centimeter: { label: "Centimeter", factor: 0.01 },
      millimeter: { label: "Millimeter", factor: 0.001 },
      mile: { label: "Mile", factor: 1609.344 },
      yard: { label: "Yard", factor: 0.9144 },
      foot: { label: "Foot", factor: 0.3048 },
      inch: { label: "Inch", factor: 0.0254 }
    }
  },
  weight: {
    units: {
      kilogram: { label: "Kilogram", factor: 1 },
      gram: { label: "Gram", factor: 0.001 },
      milligram: { label: "Milligram", factor: 0.000001 },
      pound: { label: "Pound", factor: 0.45359237 },
      ounce: { label: "Ounce", factor: 0.028349523125 },
      stone: { label: "Stone", factor: 6.35029318 }
    }
  },
  temperature: {
    units: {
      celsius: { label: "Celsius" },
      fahrenheit: { label: "Fahrenheit" },
      kelvin: { label: "Kelvin" }
    }
  },
  volume: {
    units: {
      liter: { label: "Liter", factor: 1 },
      milliliter: { label: "Milliliter", factor: 0.001 },
      gallon: { label: "US Gallon", factor: 3.785411784 },
      quart: { label: "US Quart", factor: 0.946352946 },
      pint: { label: "US Pint", factor: 0.473176473 },
      cup: { label: "US Cup", factor: 0.2365882365 },
      tablespoon: { label: "Tablespoon", factor: 0.0147867648 },
      teaspoon: { label: "Teaspoon", factor: 0.00492892159 }
    }
  },
  area: {
    units: {
      squareMeter: { label: "Square meter", factor: 1 },
      squareKilometer: { label: "Square kilometer", factor: 1000000 },
      squareFoot: { label: "Square foot", factor: 0.09290304 },
      squareYard: { label: "Square yard", factor: 0.83612736 },
      acre: { label: "Acre", factor: 4046.8564224 },
      hectare: { label: "Hectare", factor: 10000 }
    }
  }
};

const defaults = {
  length: ["meter", "foot"],
  weight: ["kilogram", "pound"],
  temperature: ["celsius", "fahrenheit"],
  volume: ["liter", "gallon"],
  area: ["squareMeter", "squareFoot"]
};

const toolNames = {
  timezone: "Time Zone Converter",
  qr: "QR Code Generator/Scanner",
  scientific: "Scientific Calculator",
  tax: "GST/VAT Calculator",
  percentage: "Percentage Calculator",
  age: "Age Calculator"
};

let currentCategory = "length";
let currentTool = null;
let activeInput = "from";
const history = [];

const tabs = document.querySelectorAll(".tab");
const fromValue = document.querySelector("#fromValue");
const toValue = document.querySelector("#toValue");
const fromUnit = document.querySelector("#fromUnit");
const toUnit = document.querySelector("#toUnit");
const resultText = document.querySelector("#resultText");
const historyList = document.querySelector("#historyList");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const swapButton = document.querySelector("#swapButton");
const converterForm = document.querySelector("#converterForm");
const toolPanel = document.querySelector("#toolPanel");

let qrStream = null;

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 1 ? 8 : 5
  }).format(value);
}

function temperatureToCelsius(value, unit) {
  if (unit === "fahrenheit") return (value - 32) * 5 / 9;
  if (unit === "kelvin") return value - 273.15;
  return value;
}

function celsiusToTemperature(value, unit) {
  if (unit === "fahrenheit") return value * 9 / 5 + 32;
  if (unit === "kelvin") return value + 273.15;
  return value;
}

function convert(value, from, to) {
  if (currentCategory === "temperature") {
    return celsiusToTemperature(temperatureToCelsius(value, from), to);
  }

  const units = categories[currentCategory].units;
  return value * units[from].factor / units[to].factor;
}

function unitLabel(unitKey) {
  return categories[currentCategory].units[unitKey].label;
}

function populateUnits() {
  const units = categories[currentCategory].units;
  const options = Object.entries(units)
    .map(([value, unit]) => `<option value="${value}">${unit.label}</option>`)
    .join("");

  fromUnit.innerHTML = options;
  toUnit.innerHTML = options;
  [fromUnit.value, toUnit.value] = defaults[currentCategory];
}

function updateHistory(summary) {
  if (!summary || history[0] === summary) {
    return;
  }

  history.unshift(summary);
  history.splice(6);
  historyList.innerHTML = history.map((item) => `<li>${item}</li>`).join("");
}

function updateResult(shouldTrack = true) {
  if (currentTool) {
    return;
  }

  const source = activeInput === "from" ? fromValue : toValue;
  const target = activeInput === "from" ? toValue : fromValue;
  const sourceUnit = activeInput === "from" ? fromUnit.value : toUnit.value;
  const targetUnit = activeInput === "from" ? toUnit.value : fromUnit.value;
  const value = Number(source.value);

  if (source.value === "" || !Number.isFinite(value)) {
    target.value = "";
    resultText.textContent = "Enter a number to convert";
    return;
  }

  const converted = convert(value, sourceUnit, targetUnit);
  target.value = Number(converted.toPrecision(12));

  const summary = `${formatNumber(value)} ${unitLabel(sourceUnit)} = ${formatNumber(converted)} ${unitLabel(targetUnit)}`;
  resultText.textContent = summary;

  if (shouldTrack) {
    updateHistory(summary);
  }
}

function setResult(summary, shouldTrack = true) {
  resultText.textContent = summary;
  if (shouldTrack) {
    updateHistory(summary);
  }
}

function showConverter(category) {
  stopQrScanner();
  currentTool = null;
  currentCategory = category;
  activeInput = "from";
  converterForm.hidden = false;
  toolPanel.hidden = true;
  toolPanel.innerHTML = "";
  swapButton.hidden = false;
  populateUnits();
  updateResult();
}

function showTool(tool) {
  stopQrScanner();
  currentTool = tool;
  converterForm.hidden = true;
  toolPanel.hidden = false;
  swapButton.hidden = true;
  toolPanel.innerHTML = toolTemplates[tool]();
  bindTool(tool);
  setResult(`${toolNames[tool]} ready`, false);
}

function getLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function zoneTime(date, zone) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone
  }).format(date);
}

function zoneOffset(date, zone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function dateFromZoneInput(value, zone) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(utcGuess.getTime() - zoneOffset(utcGuess, zone));
}

function calculateTimezone() {
  const input = document.querySelector("#timeInput").value;
  const fromZone = document.querySelector("#fromZone").value;
  const toZone = document.querySelector("#toZone").value;

  if (!input) {
    setResult("Choose a date and time", false);
    return;
  }

  const date = dateFromZoneInput(input, fromZone);
  const summary = `${zoneTime(date, fromZone)} in ${fromZone} = ${zoneTime(date, toZone)} in ${toZone}`;
  document.querySelector("#timeOutput").textContent = summary;
  setResult(summary);
}

function qrImageUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}`;
}

function updateQr() {
  const text = document.querySelector("#qrText").value.trim();
  const image = document.querySelector("#qrImage");

  if (!text) {
    image.removeAttribute("src");
    image.alt = "";
    setResult("Enter text or a link to generate a QR code", false);
    return;
  }

  image.src = qrImageUrl(text);
  image.alt = `QR code for ${text}`;
  setResult(`QR generated for: ${text}`);
}

async function startQrScanner() {
  const video = document.querySelector("#qrVideo");
  const output = document.querySelector("#scanOutput");

  if (!("BarcodeDetector" in window)) {
    output.textContent = "Scanner needs a browser with BarcodeDetector support. QR generation still works.";
    return;
  }

  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = qrStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    const scan = async () => {
      if (!qrStream) return;
      const codes = await detector.detect(video);
      if (codes.length) {
        const value = codes[0].rawValue;
        output.textContent = value;
        setResult(`QR scanned: ${value}`);
        stopQrScanner();
        return;
      }
      requestAnimationFrame(scan);
    };

    scan();
  } catch (error) {
    output.textContent = "Camera access was not available.";
  }
}

function stopQrScanner() {
  if (qrStream) {
    qrStream.getTracks().forEach((track) => track.stop());
    qrStream = null;
  }
}

function safeCalculate(expression) {
  const allowedWords = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "log", "log10", "ln", "abs", "floor", "ceil", "round", "pi", "e"]);
  const words = expression.match(/[A-Za-z_]+/g) || [];
  if (words.some((word) => !allowedWords.has(word.toLowerCase()))) {
    throw new Error("Unsupported function");
  }

  const normalized = expression
    .replace(/\^/g, "**")
    .replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|log10|log|ln|abs|floor|ceil|round)\b/g, "Math.$1")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .replace(/Math\.ln/g, "Math.log")
    .replace(/Math\.log10/g, "Math.log10");

  if (!/^[\d+\-*/().,\s%*A-Za-z_]+$/.test(normalized)) {
    throw new Error("Unsupported characters");
  }

  return Function(`"use strict"; return (${normalized});`)();
}

function calculateScientific() {
  const expression = document.querySelector("#scientificInput").value.trim();
  if (!expression) {
    setResult("Enter an expression", false);
    return;
  }

  try {
    const value = safeCalculate(expression);
    if (!Number.isFinite(value)) throw new Error("Invalid result");
    document.querySelector("#scientificOutput").textContent = formatNumber(value);
    setResult(`${expression} = ${formatNumber(value)}`);
  } catch (error) {
    setResult("Expression could not be calculated", false);
  }
}

function calculateTax() {
  const amount = Number(document.querySelector("#taxAmount").value);
  const rate = Number(document.querySelector("#taxRate").value);
  const mode = document.querySelector("#taxMode").value;

  if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
    setResult("Enter an amount and tax rate", false);
    return;
  }

  const tax = mode === "exclusive" ? amount * rate / 100 : amount - amount / (1 + rate / 100);
  const net = mode === "exclusive" ? amount : amount - tax;
  const total = mode === "exclusive" ? amount + tax : amount;
  const summary = `Net ${formatNumber(net)} + tax ${formatNumber(tax)} = total ${formatNumber(total)}`;
  document.querySelector("#taxOutput").textContent = summary;
  setResult(summary);
}

function calculatePercentage() {
  const base = Number(document.querySelector("#percentBase").value);
  const percent = Number(document.querySelector("#percentValue").value);
  const mode = document.querySelector("#percentMode").value;

  if (!Number.isFinite(base) || !Number.isFinite(percent)) {
    setResult("Enter both percentage values", false);
    return;
  }

  let value;
  let summary;
  if (mode === "of") {
    value = base * percent / 100;
    summary = `${formatNumber(percent)}% of ${formatNumber(base)} = ${formatNumber(value)}`;
  } else if (mode === "increase") {
    value = base * (1 + percent / 100);
    summary = `${formatNumber(base)} increased by ${formatNumber(percent)}% = ${formatNumber(value)}`;
  } else {
    value = base * (1 - percent / 100);
    summary = `${formatNumber(base)} decreased by ${formatNumber(percent)}% = ${formatNumber(value)}`;
  }
  document.querySelector("#percentOutput").textContent = summary;
  setResult(summary);
}

function calculateAge() {
  const birth = new Date(document.querySelector("#birthDate").value);
  const compare = new Date(document.querySelector("#compareDate").value || new Date());

  if (Number.isNaN(birth.getTime()) || Number.isNaN(compare.getTime()) || birth > compare) {
    setResult("Choose valid dates", false);
    return;
  }

  let years = compare.getFullYear() - birth.getFullYear();
  let months = compare.getMonth() - birth.getMonth();
  let days = compare.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(compare.getFullYear(), compare.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.floor((compare - birth) / 86400000);
  const summary = `${years} years, ${months} months, ${days} days old (${formatNumber(totalDays)} days)`;
  document.querySelector("#ageOutput").textContent = summary;
  setResult(summary);
}

const toolTemplates = {
  timezone: () => `
    <div class="tool-grid">
      <label class="field"><span>Date and time</span><input id="timeInput" type="datetime-local" value="${getLocalDateTimeValue()}"></label>
      <label class="field"><span>From zone</span><select id="fromZone"><option>UTC</option><option selected>Asia/Kolkata</option><option>Europe/Zurich</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Asia/Dubai</option><option>Asia/Tokyo</option><option>Australia/Sydney</option></select></label>
      <label class="field"><span>To zone</span><select id="toZone"><option>UTC</option><option>Asia/Kolkata</option><option selected>Europe/Zurich</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Asia/Dubai</option><option>Asia/Tokyo</option><option>Australia/Sydney</option></select></label>
      <output class="tool-output" id="timeOutput"></output>
    </div>`,
  qr: () => `
    <div class="tool-grid qr-grid">
      <label class="field wide"><span>Text or URL</span><input id="qrText" type="text" value="https://rimalsuman-cyber.github.io/converter/"></label>
      <div class="qr-preview"><img id="qrImage" alt=""></div>
      <div class="scanner-box">
        <video id="qrVideo" muted playsinline></video>
        <output id="scanOutput">Camera scanner uses supported browsers only.</output>
        <button id="scanButton" type="button">Scan</button>
      </div>
    </div>`,
  scientific: () => `
    <div class="tool-grid">
      <label class="field wide"><span>Expression</span><input id="scientificInput" type="text" value="sin(pi / 2) + sqrt(144)"></label>
      <output class="tool-output" id="scientificOutput"></output>
    </div>`,
  tax: () => `
    <div class="tool-grid">
      <label class="field"><span>Amount</span><input id="taxAmount" type="number" value="1000" step="any"></label>
      <label class="field"><span>Rate %</span><input id="taxRate" type="number" value="18" step="any"></label>
      <label class="field"><span>Mode</span><select id="taxMode"><option value="exclusive">Add tax</option><option value="inclusive">Included tax</option></select></label>
      <output class="tool-output" id="taxOutput"></output>
    </div>`,
  percentage: () => `
    <div class="tool-grid">
      <label class="field"><span>Base value</span><input id="percentBase" type="number" value="250" step="any"></label>
      <label class="field"><span>Percent</span><input id="percentValue" type="number" value="12" step="any"></label>
      <label class="field"><span>Mode</span><select id="percentMode"><option value="of">Percent of</option><option value="increase">Increase by</option><option value="decrease">Decrease by</option></select></label>
      <output class="tool-output" id="percentOutput"></output>
    </div>`,
  age: () => `
    <div class="tool-grid">
      <label class="field"><span>Birth date</span><input id="birthDate" type="date" value="2000-01-01"></label>
      <label class="field"><span>Compare date</span><input id="compareDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      <output class="tool-output" id="ageOutput"></output>
    </div>`
};

function bindTool(tool) {
  const inputs = toolPanel.querySelectorAll("input, select");
  const handlers = {
    timezone: calculateTimezone,
    qr: updateQr,
    scientific: calculateScientific,
    tax: calculateTax,
    percentage: calculatePercentage,
    age: calculateAge
  };

  inputs.forEach((input) => {
    input.addEventListener("input", handlers[tool]);
    input.addEventListener("change", handlers[tool]);
  });

  if (tool === "qr") {
    document.querySelector("#scanButton").addEventListener("click", startQrScanner);
  }

  handlers[tool]();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    if (tab.dataset.tool) {
      showTool(tab.dataset.tool);
    } else {
      showConverter(tab.dataset.category);
    }
  });
});

fromValue.addEventListener("input", () => {
  activeInput = "from";
  updateResult();
});

toValue.addEventListener("input", () => {
  activeInput = "to";
  updateResult();
});

[fromUnit, toUnit].forEach((select) => {
  select.addEventListener("change", () => updateResult());
});

swapButton.addEventListener("click", () => {
  const previousFrom = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = previousFrom;
  activeInput = "from";
  updateResult();
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultText.textContent);
    copyButton.textContent = "Copied";
  } catch (error) {
    copyButton.textContent = "Copy failed";
  }

  window.setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1200);
});

clearButton.addEventListener("click", () => {
  history.splice(0);
  historyList.innerHTML = "";
});

populateUnits();
updateResult();

const STORAGE_KEY = "worktimekeeper_posts";
const SETTINGS_KEY = "worktimekeeper_settings";
const DEFAULT_HOURLY_RATE = 130;
const DEFAULT_VACATION_RATE = 0.12;
const TAX_THRESHOLD = 25042;
const TAX_RATE = 0.08;
let posts = [];
let editIndex = null;
let sortAsc = true;
let clockInTime = null;
let clockOutTime = null;
let settings = {
    hourlyRate: DEFAULT_HOURLY_RATE,
    vacationRate: DEFAULT_VACATION_RATE,
    carriedHours: 0,
    taxEnabled: true
};

function savePosts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}
function loadPosts() {
    const data = localStorage.getItem(STORAGE_KEY);
    posts = data ? JSON.parse(data) : [];
}
function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function loadSettings() {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return;
    try {
        const parsed = JSON.parse(data);
        settings = {
            hourlyRate: Number(parsed.hourlyRate) || DEFAULT_HOURLY_RATE,
            vacationRate: Number(parsed.vacationRate) >= 0 ? Number(parsed.vacationRate) : DEFAULT_VACATION_RATE,
            carriedHours: Number(parsed.carriedHours) >= 0 ? Number(parsed.carriedHours) : 0,
            taxEnabled: parsed.taxEnabled !== false
        };
    } catch (err) {
        settings = {
            hourlyRate: DEFAULT_HOURLY_RATE,
            vacationRate: DEFAULT_VACATION_RATE,
            carriedHours: 0,
            taxEnabled: true
        };
    }
}
function getCurrentYear() {
    return new Date().getFullYear();
}
function getYearPosts() {
    const year = getCurrentYear();
    return posts.filter(post => {
        const parsedDate = new Date(post.date);
        return !isNaN(parsedDate) && parsedDate.getFullYear() === year;
    });
}
function getCurrentMonthPosts() {
    const now = new Date();
    return posts.filter(post => {
        const parsedDate = new Date(post.date);
        return !isNaN(parsedDate)
            && parsedDate.getFullYear() === now.getFullYear()
            && parsedDate.getMonth() === now.getMonth();
    });
}
function formatNumber(value) {
    return Number(value || 0).toLocaleString("sv-SE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatMoney(value) {
    return Number(value || 0).toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function getIncomeTotals() {
    const yearPosts = getYearPosts();
    const loggedHours = yearPosts.reduce((sum, post) => sum + Number(post.hours || 0), 0);
    const carriedHours = Number(settings.carriedHours) || 0;
    const yearHours = loggedHours + carriedHours;
    const baseHourlyRate = Number(settings.hourlyRate) || 0;
    const vacationRate = Number(settings.vacationRate) || 0;
    const vacationPay = yearHours * baseHourlyRate * vacationRate;
    const gross = yearHours * baseHourlyRate + vacationPay;
    const taxAmount = settings.taxEnabled && gross > TAX_THRESHOLD
        ? (gross - TAX_THRESHOLD) * TAX_RATE
        : 0;
    const net = gross - taxAmount;
    const grossHourlyRate = baseHourlyRate * (1 + vacationRate);
    return { yearHours, loggedHours, carriedHours, gross, taxAmount, net, vacationPay, baseHourlyRate, vacationRate, grossHourlyRate };
}
function getMonthIncomeTotals() {
    const monthPosts = getCurrentMonthPosts();
    const monthHours = monthPosts.reduce((sum, post) => sum + Number(post.hours || 0), 0);
    const baseHourlyRate = Number(settings.hourlyRate) || 0;
    const vacationRate = Number(settings.vacationRate) || 0;
    const gross = monthHours * baseHourlyRate * (1 + vacationRate);
    return { monthHours, gross };
}
function renderIncomeSummary() {
    const totals = getIncomeTotals();
    const monthTotals = getMonthIncomeTotals();
    const hourlyRate = Number(settings.hourlyRate) || 0;
    const vacationRate = Number(settings.vacationRate) || 0;
    const taxInfo = document.getElementById("taxInfo");
    document.getElementById("hourlyRate").value = hourlyRate.toFixed(2);
    document.getElementById("vacationRate").value = (vacationRate * 100).toFixed(2).replace(/\.00$/, "");
    document.getElementById("carriedHours").value = Number(settings.carriedHours || 0).toFixed(2);
    document.getElementById("hourlyRateDisplay").textContent = `${formatMoney(hourlyRate)}/h`;
    document.getElementById("grossHourlyRateDisplay").textContent = `${formatMoney(totals.grossHourlyRate)}/h`;
    document.getElementById("taxEnabled").checked = !!settings.taxEnabled;
    document.getElementById("carriedHoursDisplay").textContent = `${formatNumber(totals.carriedHours)} h`;
    document.getElementById("loggedHoursDisplay").textContent = `${formatNumber(totals.loggedHours)} h`;
    document.getElementById("yearHours").textContent = `${formatNumber(totals.yearHours)} h`;
    document.getElementById("grossYear").textContent = formatMoney(totals.gross);
    document.getElementById("monthGross").textContent = formatMoney(monthTotals.gross);
    document.getElementById("vacationYear").textContent = formatMoney(totals.vacationPay);
    document.getElementById("taxYear").textContent = formatMoney(totals.taxAmount);
    document.getElementById("netYear").textContent = formatMoney(totals.net);
    document.getElementById("yearThreshold").textContent = formatMoney(TAX_THRESHOLD);
    if (!settings.taxEnabled) {
        taxInfo.textContent = "Skatt är avstängd. Markera rutan om du vill att skatt ska räknas med.";
    } else if (totals.gross <= TAX_THRESHOLD) {
        taxInfo.textContent = `Skatt börjar när årets brutto passerar ${formatMoney(TAX_THRESHOLD)}. Då dras ${Math.round(TAX_RATE * 100)} % på beloppet över gränsen.`;
    } else {
        taxInfo.textContent = `Skatt dras nu med ${Math.round(TAX_RATE * 100)} % på delen över ${formatMoney(TAX_THRESHOLD)}.`;
    }
}
function renderTable() {
    const tbody = document.querySelector("#workTable tbody");
    tbody.innerHTML = "";
    const hourlyRate = Number(settings.hourlyRate) || 0;
    const vacationRate = Number(settings.vacationRate) || 0;
    posts.forEach((post, idx) => {
        const formatTime = t => {
            if (!t) return "";
            const match = t.match(/^(\d{4}-\d{2}-\d{2})[ ,T]*(\d{2}:\d{2}:\d{2})/);
            if (match) {
                return `<span title="${t}">${match[1]}<br>${match[2]}</span>`;
            }
            return `<span title="${t}">${t}</span>`;
        };
        const clockIn = post.clockIn ? `<br><small><b>Clock In:</b> ${formatTime(post.clockIn)}</small>` : "";
        const clockOut = post.clockOut ? `<br><small><b>Clock Out:</b> ${formatTime(post.clockOut)}</small>` : "";
        const tr = document.createElement("tr");
        let hoursStr = typeof post.hours === "number" ? post.hours.toFixed(2) : Number(post.hours).toFixed(2);
        hoursStr = hoursStr.replace(".", ",");
        const earned = Number(post.hours || 0) * hourlyRate * (1 + vacationRate);
        tr.innerHTML = `
            <td>${post.date}${clockIn}${clockOut}</td>
            <td>${hoursStr}</td>
            <td>${formatMoney(earned)}</td>
            <td>${post.desc}</td>
            <td>
                <button class="action-btn edit" data-idx="${idx}">Redigera</button>
                <button class="action-btn delete" data-idx="${idx}">Ta bort</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    const total = posts.reduce((sum, p) => sum + Number(p.hours), 0);
    document.getElementById("totalHours").textContent = total.toFixed(2).replace(".", ",");
    renderIncomeSummary();
}
function resetForm() {
    document.getElementById("workForm").reset();
    editIndex = null;
    document.getElementById("addBtn").textContent = "Lägg till";
    clockInTime = null;
    clockOutTime = null;
    document.getElementById("clockInTime").textContent = "";
    document.getElementById("clockOutTime").textContent = "";
    document.getElementById("clockInBtn").disabled = false;
    document.getElementById("clockOutBtn").disabled = true;
}
function addOrEditPost(e) {
    e.preventDefault();
    const date = document.getElementById("date").value;
    let hoursStr = document.getElementById("hours").value.replace(",", ".");
    const hours = Number(hoursStr);
    const desc = document.getElementById("desc").value.trim();
    if (!date || isNaN(hours) || !desc) return;
    const postData = {
        date,
        hours: Number(hours.toFixed(2)),
        desc,
        clockIn: clockInTime,
        clockOut: clockOutTime
    };
    if (editIndex !== null) {
        posts[editIndex] = postData;
    } else {
        posts.push(postData);
    }
    sortPosts();
    savePosts();
    renderTable();
    resetForm();
}
function handleTableClick(e) {
    if (e.target.classList.contains("edit")) {
        editIndex = Number(e.target.dataset.idx);
        const post = posts[editIndex];
        document.getElementById("date").value = post.date;
        document.getElementById("hours").value = post.hours;
        document.getElementById("desc").value = post.desc;
        document.getElementById("addBtn").textContent = "Spara";
        clockInTime = post.clockIn || null;
        clockOutTime = post.clockOut || null;
        document.getElementById("clockInTime").textContent = clockInTime ? `⏱️ ${clockInTime.split(" ")[1]}` : "";
        document.getElementById("clockOutTime").textContent = clockOutTime ? `⏱️ ${clockOutTime.split(" ")[1]}` : "";
        document.getElementById("clockInBtn").disabled = !!clockInTime;
        document.getElementById("clockOutBtn").disabled = !clockInTime || !!clockOutTime;
    } else if (e.target.classList.contains("delete")) {
        const idx = Number(e.target.dataset.idx);
        if (confirm("Ta bort posten?")) {
            posts.splice(idx, 1);
            savePosts();
            renderTable();
            resetForm();
        }
    }
}
function escapeExcelXml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
function toExcelRow(values) {
    const cells = values.map(cell => {
        const type = cell.type || "String";
        const value = type === "Number" ? Number(cell.value || 0) : escapeExcelXml(cell.value);
        return `<Cell><Data ss:Type="${type}">${value}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
}
function exportExcel() {
    const totals = getIncomeTotals();
    const monthTotals = getMonthIncomeTotals();
    const hourlyRate = Number(settings.hourlyRate) || 0;
    const vacationRatePercent = (Number(settings.vacationRate) || 0) * 100;
    const postsRows = posts.map(post => {
        const earned = Number(post.hours || 0) * hourlyRate * (1 + (Number(settings.vacationRate) || 0));
        return toExcelRow([
            { value: post.date },
            { value: Number(post.hours || 0), type: "Number" },
            { value: post.desc },
            { value: post.clockIn || "" },
            { value: post.clockOut || "" },
            { value: earned, type: "Number" }
        ]);
    }).join("");
    const summaryRows = [
        toExcelRow([{ value: "Ar" }, { value: getCurrentYear(), type: "Number" }]),
        toExcelRow([{ value: "Timlon" }, { value: hourlyRate, type: "Number" }]),
        toExcelRow([{ value: "Semesterersattning (%)" }, { value: vacationRatePercent, type: "Number" }]),
        toExcelRow([{ value: "Redan arbetade timmar" }, { value: totals.carriedHours, type: "Number" }]),
        toExcelRow([{ value: "Inlagda timmar i ar" }, { value: totals.loggedHours, type: "Number" }]),
        toExcelRow([{ value: "Totala timmar i ar" }, { value: totals.yearHours, type: "Number" }]),
        toExcelRow([{ value: "Brutto i ar" }, { value: totals.gross, type: "Number" }]),
        toExcelRow([{ value: "Skatt i ar" }, { value: totals.taxAmount, type: "Number" }]),
        toExcelRow([{ value: "Netto i ar" }, { value: totals.net, type: "Number" }]),
        toExcelRow([{ value: "Lon denna manad" }, { value: monthTotals.gross, type: "Number" }])
    ].join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Poster">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Datum</Data></Cell>
    <Cell><Data ss:Type="String">Timmar</Data></Cell>
    <Cell><Data ss:Type="String">Beskrivning</Data></Cell>
    <Cell><Data ss:Type="String">Clock In</Data></Cell>
    <Cell><Data ss:Type="String">Clock Out</Data></Cell>
    <Cell><Data ss:Type="String">Intjanat</Data></Cell>
   </Row>
   ${postsRows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Sammanfattning">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Namn</Data></Cell>
    <Cell><Data ss:Type="String">Varde</Data></Cell>
   </Row>
   ${summaryRows}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "worktimekeeper.xls";
    a.click();
    URL.revokeObjectURL(url);
}
function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const imported = JSON.parse(ev.target.result);
            let arr = [];
            if (Array.isArray(imported)) {
                arr = imported;
            } else if (imported && Array.isArray(imported.posts)) {
                arr = imported.posts;
            } else {
                alert("Filen innehåller inte någon lista med poster.");
                return;
            }
            const valid = arr.every(p =>
                typeof p === "object" &&
                typeof p.date === "string" &&
                (typeof p.hours === "number" || typeof p.hours === "string") &&
                typeof p.desc === "string"
            );
            if (!valid) {
                alert("En eller flera poster saknar nödvändiga fält (date, hours, desc).");
                return;
            }
            posts = arr.map(p => ({
                date: p.date,
                hours: Number(p.hours),
                desc: p.desc,
                clockIn: p.clockIn || null,
                clockOut: p.clockOut || null
            }));

            sortPosts();
            savePosts();
            renderTable();
            resetForm();
        } catch (err) {
            alert("Kunde inte läsa filen. Kontrollera att det är en giltig JSON-fil.\n" + err);
        }
    };
    reader.readAsText(file);
    e.target.value = "";
}
function clearAll() {
    if (confirm("Rensa all data?")) {
        posts = [];
        savePosts();
        renderTable();
        resetForm();
    }
}
function sortPosts() {
    posts.sort((a, b) => sortAsc
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
    );
}
function toggleSort() {
    sortAsc = !sortAsc;
    sortPosts();
    renderTable();
}
function getCurrentTimestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return `${date} ${time}`;
}
function clockIn() {
    if (clockInTime) return;
    clockInTime = getCurrentTimestamp();
    document.getElementById("clockInTime").textContent = `⏱️ ${clockInTime.split(" ")[1]}`;
    document.getElementById("clockInBtn").disabled = true;
    document.getElementById("clockOutBtn").disabled = false;
    if (!document.getElementById("date").value) {
        document.getElementById("date").value = clockInTime.split(" ")[0];
    }
}
function clockOut() {
    if (!clockInTime || clockOutTime) return;
    clockOutTime = getCurrentTimestamp();
    document.getElementById("clockOutTime").textContent = `⏱️ ${clockOutTime.split(" ")[1]}`;
    document.getElementById("clockOutBtn").disabled = true;
    const dateVal = document.getElementById("date").value;
    if (dateVal && clockInTime && clockOutTime) {
        const inDate = new Date(`${dateVal}T${clockInTime.split(" ")[1]}`);
        const outDate = new Date(`${dateVal}T${clockOutTime.split(" ")[1]}`);
        let diff = (outDate - inDate) / 3600000;
        if (!isNaN(diff) && diff > 0) {
            document.getElementById("hours").value = diff.toFixed(2);
        }
    }
}

document.getElementById("workForm").addEventListener("submit", addOrEditPost);
document.getElementById("resetBtn").addEventListener("click", resetForm);
document.getElementById("workTable").addEventListener("click", handleTableClick);
document.getElementById("exportBtn").addEventListener("click", exportExcel);
document.getElementById("importInput").addEventListener("change", importJSON);
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.getElementById("sortDate").addEventListener("click", toggleSort);
document.getElementById("hourlyRate").addEventListener("input", e => {
    const value = Number(String(e.target.value).replace(",", "."));
    settings.hourlyRate = Number.isFinite(value) && value >= 0 ? value : DEFAULT_HOURLY_RATE;
    saveSettings();
    renderTable();
});
document.getElementById("vacationRate").addEventListener("input", e => {
    const value = Number(String(e.target.value).replace(",", "."));
    settings.vacationRate = Number.isFinite(value) && value >= 0 ? value / 100 : DEFAULT_VACATION_RATE;
    saveSettings();
    renderTable();
});
document.getElementById("carriedHours").addEventListener("input", e => {
    const value = Number(String(e.target.value).replace(",", "."));
    settings.carriedHours = Number.isFinite(value) && value >= 0 ? value : 0;
    saveSettings();
    renderTable();
});
document.getElementById("taxEnabled").addEventListener("change", e => {
    settings.taxEnabled = e.target.checked;
    saveSettings();
    renderTable();
});
document.getElementById("clockInBtn").addEventListener("click", clockIn);
document.getElementById("clockOutBtn").addEventListener("click", clockOut);

loadSettings();
loadPosts();
sortPosts();
renderTable();
resetForm();
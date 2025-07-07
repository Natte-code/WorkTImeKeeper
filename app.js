const STORAGE_KEY = "worktimekeeper_posts";
let posts = [];
let editIndex = null;
let sortAsc = true;
let clockInTime = null;
let clockOutTime = null;

function savePosts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}
function loadPosts() {
    const data = localStorage.getItem(STORAGE_KEY);
    posts = data ? JSON.parse(data) : [];
}
function renderTable() {
    const tbody = document.querySelector("#workTable tbody");
    tbody.innerHTML = "";
    posts.forEach((post, idx) => {
        // Formatera tider för bättre läsbarhet
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
        // Visa alltid två decimaler, utan avrundning till en decimal
        let hoursStr = typeof post.hours === "number" ? post.hours.toFixed(2) : Number(post.hours).toFixed(2);
        hoursStr = hoursStr.replace(".", ",");
        tr.innerHTML = `
            <td>${post.date}${clockIn}${clockOut}</td>
            <td>${hoursStr}</td>
            <td>${post.desc}</td>
            <td>
                <button class="action-btn edit" data-idx="${idx}">Redigera</button>
                <button class="action-btn delete" data-idx="${idx}">Ta bort</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    // Summering med komma och två decimaler
    const total = posts.reduce((sum, p) => sum + Number(p.hours), 0);
    document.getElementById("totalHours").textContent = total.toFixed(2).replace(".", ",");
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
    // Tillåt punkt eller komma som decimaltecken och konvertera till nummer
    let hoursStr = document.getElementById("hours").value.replace(",", ".");
    const hours = Number(hoursStr);
    const desc = document.getElementById("desc").value.trim();
    // clockInTime och clockOutTime kan vara null
    if (!date || isNaN(hours) || !desc) return;
    // Spara alltid två decimaler
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
function exportJSON() {
    const blob = new Blob([JSON.stringify(posts, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "worktimekeeper.json";
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

            // Tillåt import av objekt med "posts"-nyckel eller direkt array
            let arr = [];
            if (Array.isArray(imported)) {
                arr = imported;
            } else if (imported && Array.isArray(imported.posts)) {
                arr = imported.posts;
            } else {
                alert("Filen innehåller inte någon lista med poster.");
                return;
            }

            // Kontrollera att varje post har rätt struktur
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

            // Konvertera hours till nummer om det är sträng
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
    // Format: YYYY-MM-DD HH:mm:ss
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
    // Sätt dagens datum om det inte är valt
    if (!document.getElementById("date").value) {
        document.getElementById("date").value = clockInTime.split(" ")[0];
    }
}
function clockOut() {
    if (!clockInTime || clockOutTime) return;
    clockOutTime = getCurrentTimestamp();
    document.getElementById("clockOutTime").textContent = `⏱️ ${clockOutTime.split(" ")[1]}`;
    document.getElementById("clockOutBtn").disabled = true;
    // Räkna ut timmar automatiskt om clockIn och clockOut är samma dag
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
document.getElementById("exportBtn").addEventListener("click", exportJSON);
document.getElementById("importInput").addEventListener("change", importJSON);
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.getElementById("sortDate").addEventListener("click", toggleSort);

// Timer-knappar ersätts med clock in/out
document.getElementById("clockInBtn").addEventListener("click", clockIn);
document.getElementById("clockOutBtn").addEventListener("click", clockOut);

loadPosts();
sortPosts();
renderTable();
resetForm();
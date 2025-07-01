const STORAGE_KEY = "worktimekeeper_posts";
let posts = [];
let editIndex = null;
let sortAsc = true;
let timerStart = null;
let timerInterval = null;

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
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${post.date}</td>
            <td>${post.hours}</td>
            <td>${post.desc}</td>
            <td>
                <button class="action-btn edit" data-idx="${idx}">Redigera</button>
                <button class="action-btn delete" data-idx="${idx}">Ta bort</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById("totalHours").textContent = posts.reduce((sum, p) => sum + Number(p.hours), 0);
}
function resetForm() {
    document.getElementById("workForm").reset();
    editIndex = null;
    document.getElementById("addBtn").textContent = "Lägg till";
}
function addOrEditPost(e) {
    e.preventDefault();
    const date = document.getElementById("date").value;
    const hours = parseFloat(document.getElementById("hours").value);
    const desc = document.getElementById("desc").value.trim();
    if (!date || isNaN(hours) || !desc) return;
    if (editIndex !== null) {
        posts[editIndex] = { date, hours, desc };
    } else {
        posts.push({ date, hours, desc });
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
                desc: p.desc
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
function formatTimer(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}
function updateTimerDisplay() {
    const display = document.getElementById("timerDisplay");
    if (timerStart) {
        const elapsed = Date.now() - timerStart;
        display.textContent = formatTimer(elapsed);
    } else {
        display.textContent = "00:00:00";
    }
}
function startTimer() {
    if (timerStart) return;
    timerStart = Date.now();
    document.getElementById("startTimerBtn").disabled = true;
    document.getElementById("stopTimerBtn").disabled = false;
    timerInterval = setInterval(updateTimerDisplay, 500);
    updateTimerDisplay();
}
function stopTimer() {
    if (!timerStart) return;
    clearInterval(timerInterval);
    const elapsedMs = Date.now() - timerStart;
    const hours = +(elapsedMs / 3600000).toFixed(2);
    // Fyll i formuläret automatiskt
    document.getElementById("date").value = new Date().toISOString().slice(0,10);
    document.getElementById("hours").value = hours;
    document.getElementById("desc").focus();
    timerStart = null;
    updateTimerDisplay();
    document.getElementById("startTimerBtn").disabled = false;
    document.getElementById("stopTimerBtn").disabled = true;
}

document.getElementById("workForm").addEventListener("submit", addOrEditPost);
document.getElementById("resetBtn").addEventListener("click", resetForm);
document.getElementById("workTable").addEventListener("click", handleTableClick);
document.getElementById("exportBtn").addEventListener("click", exportJSON);
document.getElementById("importInput").addEventListener("change", importJSON);
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.getElementById("sortDate").addEventListener("click", toggleSort);
document.getElementById("startTimerBtn").addEventListener("click", startTimer);
document.getElementById("stopTimerBtn").addEventListener("click", stopTimer);

loadPosts();
sortPosts();
renderTable();
resetForm();
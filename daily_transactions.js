// ------------------------------
// Sheet URLs
// ------------------------------
const WD_URL = "https://opensheet.elk.sh/19eCfiWh46hQUqyAwcpx4OD_3nPFDVK1p1BYbcncMT4M/WD";
const DP_URL = "https://opensheet.elk.sh/19eCfiWh46hQUqyAwcpx4OD_3nPFDVK1p1BYbcncMT4M/DP";

const SHOP_NAME = new URLSearchParams(window.location.search).get("shopName") || "";

const dashboardBars = document.getElementById("dashboardBars");
const summaryDiv = document.getElementById("summary");
const loadingSpinner = document.getElementById("loadingSpinner");
const csvLink = document.getElementById("csvDownloadLink");

let allTransactions = [];
let filteredTransactions = [];
let dpTransactions = [];
let wdTransactions = [];

// ------------------------------
function parseNumber(v) {
    return parseFloat(String(v || "0").replace(/,/g, "")) || 0;
}

function normalizeDate(dateStr) {
    if (!dateStr) return "";
    const [m, d, y] = dateStr.split("/");
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

function normalizeShop(name) {
    return (name || "").trim().toUpperCase();
}

// ------------------------------
async function fetchSheet(url) {
    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        return data.map(r => ({
            "To Wallet Number": r["To Wallet Number"] || "",
            wallet: r.Wallet || "",
            Reference: r.Reference || "",
            amount: parseNumber(r.Amount),
            date: normalizeDate(r.Date),
            type: r.Type?.toUpperCase() === "WITHDRAWAL" ? "Withdrawal" : "Deposit",
            Type: r.Type || "", 
            shop: normalizeShop(r["Shop Name"]),
            Leader: r.Leader || "",
            "From Wallet Number": r["From Wallet Number"] || ""
        }));
    } catch(err) {
        console.error("Sheet fetch failed:", url, err);
        return [];
    }
}

// ------------------------------
async function loadData() {
    loadingSpinner.style.display = "block";

    try {
        [wdTransactions, dpTransactions] = await Promise.all([
            fetchSheet(WD_URL),
            fetchSheet(DP_URL)
        ]);

        allTransactions = [...dpTransactions, ...wdTransactions];

        const shopNormalized = normalizeShop(SHOP_NAME);
        filteredTransactions = allTransactions.filter(r => !SHOP_NAME || r.shop === shopNormalized);

        renderSummary();
        renderDashboard();
        setupCSVDownload();
    } catch(err) {
        console.error(err);
        dashboardBars.innerHTML = `<p style="color:red;">Failed to load transactions.</p>`;
    } finally {
        loadingSpinner.style.display = "none";
    }
}

// ------------------------------
function renderSummary() {
    let totalManual = 0, totalAuto = 0, totalWithdrawal = 0;

    filteredTransactions.forEach(r => {
        if(r.type === "Deposit") {
            if(r.Type?.toUpperCase() === "MANUAL") totalManual += r.amount;
            else totalAuto += r.amount;
        } else totalWithdrawal += r.amount;
    });

    summaryDiv.innerHTML = `
        <div class="summary-card">
            <h2>Total Deposit (Manual)</h2>
            <p class="deposit-text">${totalManual.toLocaleString("en-US",{minimumFractionDigits:2})}</p>
        </div>
        <div class="summary-card">
            <h2>Total Deposit (Auto)</h2>
            <p class="deposit-text">${totalAuto.toLocaleString("en-US",{minimumFractionDigits:2})}</p>
        </div>
        <div class="summary-card">
            <h2>Total Withdrawal</h2>
            <p class="withdraw-text">${totalWithdrawal.toLocaleString("en-US",{minimumFractionDigits:2})}</p>
        </div>
    `;
}

// ------------------------------
function renderDashboard() {
    dashboardBars.innerHTML = "";
    const grouped = {};

    filteredTransactions.forEach(r => {
        let displayType = r.type;
        if(r.type === "Deposit") displayType = `Deposit (${r.Type || "Manual"})`;
        grouped[displayType] ??= {};
        grouped[displayType][r.date] ??= {};
        grouped[displayType][r.date][r.wallet] ??= 0;
        grouped[displayType][r.date][r.wallet] += r.amount;
    });

    Object.entries(grouped).forEach(([type, dates]) => {
        const section = document.createElement("div");
        section.className = "section";
        section.innerHTML = `<h2>${type}</h2>`;

        Object.keys(dates).sort((a,b)=>b.localeCompare(a)).forEach(date => {
            const block = document.createElement("div");
            block.className = "date-block";
            block.innerHTML = `<h3>${date}</h3>`;

            Object.entries(dates[date]).forEach(([wallet, total]) => {
                const row = document.createElement("div");
                row.className = "wallet-row";
                row.innerHTML = `
                    <span>${wallet}</span>
                    <span class="amount ${type.includes("Deposit") ? "deposit" : "withdrawal"}">
                        ${total.toLocaleString("en-US",{minimumFractionDigits:2})}
                    </span>
                `;
                block.appendChild(row);
            });

            section.appendChild(block);
        });

        dashboardBars.appendChild(section);
    });
}

// ------------------------------
function setupCSVDownload() {
    if(!SHOP_NAME) {
        csvLink.style.display = "none";
        return;
    }

    csvLink.addEventListener("click", e => {
        e.preventDefault();
        if(!filteredTransactions.length) return alert("No data to export.");

        const headers = ["To Wallet Number","Wallet","Reference","Amount","Date","Type"];

        const dpData = dpTransactions.filter(r => !SHOP_NAME || r.shop === normalizeShop(SHOP_NAME));
        const wdData = wdTransactions.filter(r => !SHOP_NAME || r.shop === normalizeShop(SHOP_NAME));

        function mapData(arr) {
            return arr.map(r => headers.map(h => r[h] ?? r[h.toLowerCase()] ?? ""));
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...mapData(dpData)]), "DP");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...mapData(wdData)]), "WD");
        XLSX.writeFile(wb, `${SHOP_NAME}_transactions.xlsx`);
    });
}

// ------------------------------
document.getElementById("dashboardTitle").textContent =
    SHOP_NAME ? `Dashboard – ${SHOP_NAME}` : "Dashboard – All Shops";

loadData();

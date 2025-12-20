// ------------------------------
// Backup Sheet Index JSON URL
// ------------------------------
const BACKUP_INDEX_URL = "https://opensheet.elk.sh/19eCfiWh46hQUqyAwcpx4OD_3nPFDVK1p1BYbcncMT4M/Backup_Index";

const backupList = document.getElementById("backupList");

// Reuse fetchSheet from daily_transactions.js
async function fetchSheet(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        return data.map(r => ({
            "To Wallet Number": r["To Wallet Number"] || "",
            wallet: r.Wallet || "",
            Reference: r.Reference || "",
            amount: parseFloat(String(r.Amount || "0").replace(/,/g,"")) || 0,
            date: r.Date || "",
            type: r.Type?.toUpperCase() === "WITHDRAWAL" ? "Withdrawal" : "Deposit",
            Type: r.Type || "",
            shop: r["Shop Name"] || "",
            Leader: r.Leader || "",
            "From Wallet Number": r["From Wallet Number"] || ""
        }));
    } catch(err) {
        console.error("Sheet fetch failed:", url, err);
        return [];
    }
}

// ------------------------------
async function loadBackupLinks() {
    try {
        const res = await fetch(BACKUP_INDEX_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Map to {date, WD_URL, DP_URL} and sort newest first
        const backupSheets = data
            .map(r => ({ date: r.Date, WD_URL: r.WD_URL, DP_URL: r.DP_URL }))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30);

        backupList.innerHTML = "";

        backupSheets.forEach(b => {
            const link = document.createElement("a");
            link.href = "#";
            link.textContent = `⬇ Download XLSX for date ${b.date}`;
            link.style.display = "block";
            link.style.marginBottom = "6px";

            link.addEventListener("click", async (e) => {
                e.preventDefault();
                // Fetch DP & WD for this backup date
                const [dpData, wdData] = await Promise.all([
                    fetchSheet(b.DP_URL),
                    fetchSheet(b.WD_URL)
                ]);

                if (!dpData.length && !wdData.length) return alert("No data available for this backup.");

                const headers = ["To Wallet Number","Wallet","Reference","Amount","Date","Type"];

                function mapData(arr) {
                    return arr.map(r => headers.map(h => r[h] ?? r[h.toLowerCase()] ?? ""));
                }

                const wb = XLSX.utils.book_new();
                if(dpData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...mapData(dpData)]), "DP");
                if(wdData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...mapData(wdData)]), "WD");

                XLSX.writeFile(wb, `Backup_Transactions_${b.date}.xlsx`);
            });

            backupList.appendChild(link);
        });

    } catch(err) {
        console.error("Failed to load backup links:", err);
        backupList.textContent = "Failed to load backup links.";
    }
}

// ------------------------------
loadBackupLinks();

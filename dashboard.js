/* =========================================================
   DASHBOARD.JS – FINAL PRODUCTION VERSION (FIXED)
   ========================================================= */

/* -------------------------
   Configuration
------------------------- */
const SHEET_ID = "1w5PrRJ9DFTAt8UmkJKlCLwK0mbvxCtjFX7jcVFli0gA";
const BASE = `https://opensheet.elk.sh/${SHEET_ID}`;
const SHEETS = {
  SHOPS_BALANCE: `${BASE}/SHOPS%20BALANCE`,
  DEPOSIT: `${BASE}/TOTAL%20DEPOSIT`,
  WITHDRAWAL: `${BASE}/TOTAL%20WITHDRAWAL`,
  STLM: `${BASE}/STLM%2FTOPUP`,
  COMM: `${BASE}/COMM`
};

/* -------------------------
   Utilities
------------------------- */
const normalizeStr = v => (v || "").toString().trim().toUpperCase();

function normalizeRow(row) {
  const out = {};
  for (const k in row) {
    out[normalizeStr(k)] = String(row[k] || "").trim();
  }
  return out;
}

function parseNum(v) {
  if (!v) return 0;
  const s = String(v)
    .replace(/,/g, "")
    .replace(/\((.*)\)/, "-$1")
    .replace(/%/g, "")
    .trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function formatNum(v) {
  return Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* -------------------------
   Global State
------------------------- */
let cachedData = [];

/* -------------------------
   Fetch SHOPS BALANCE
------------------------- */
async function fetchShopsBalance() {
  const res = await fetch(SHEETS.SHOPS_BALANCE);
  const json = await res.json();
  return json.map(normalizeRow);
}

/* -------------------------
   Build Main Summary Table
------------------------- */
function buildSummary(rows) {
  cachedData = rows.map(r => {
    const bf = parseNum(r["BRING FORWARD BALANCE"]);
    const totalDeposit = parseNum(r["TOTAL DEPOSIT"]);
    const totalWithdrawal = parseNum(r["TOTAL WITHDRAWAL"]);
    const inTransfer = parseNum(r["INTERNAL TRANSFER IN"]);
    const outTransfer = parseNum(r["INTERNAL TRANSFER OUT"]);
    const settlement = parseNum(r["SETTLEMENT"]);
    const special = parseNum(r["SPECIAL PAYMENT"]);
    const adjustment = parseNum(r["ADJUSTMENT"]);
    const dpComm = parseNum(r["DP COMM"]);
    const wdComm = parseNum(r["WD COMM"]);
    const addComm = parseNum(r["ADD COMM"]);

    return {
      "SHOP NAME": r["SHOP"],
      "TEAM LEADER": r["TEAM LEADER"],
      "GROUP NAME": r["GROUP NAME"],
      "SECURITY DEPOSIT": parseNum(r["SECURITY DEPOSIT"]),
      "BRING FORWARD BALANCE": bf,
      "TOTAL DEPOSIT": totalDeposit,
      "TOTAL WITHDRAWAL": totalWithdrawal,
      "INTERNAL TRANSFER IN": inTransfer,
      "INTERNAL TRANSFER OUT": outTransfer,
      "SETTLEMENT": settlement,
      "SPECIAL PAYMENT": special,
      "ADJUSTMENT": adjustment,
      "DP COMM": dpComm,
      "WD COMM": wdComm,
      "ADD COMM": addComm,
      "RUNNING_BALANCE":
        bf +
        totalDeposit -
        totalWithdrawal +
        inTransfer -
        outTransfer -
        settlement -
        special +
        adjustment -
        dpComm -
        wdComm -
        addComm
    };
  });

  renderTable();
}

/* -------------------------
   Render Table
------------------------- */
function renderTable() {
  const body = document.getElementById("tableBody");
  body.innerHTML = "";

  cachedData.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="shop_dashboard.html?shopName=${encodeURIComponent(r["SHOP NAME"])}"
           target="_blank"
           style="color:#0077cc;text-decoration:underline">
           ${r["SHOP NAME"]}
        </a>
      </td>
      <td>${r["TEAM LEADER"]}</td>
      <td>${r["GROUP NAME"]}</td>
      <td>${formatNum(r["SECURITY DEPOSIT"])}</td>
      <td>${formatNum(r["BRING FORWARD BALANCE"])}</td>
      <td>${formatNum(r["TOTAL DEPOSIT"])}</td>
      <td>${formatNum(r["TOTAL WITHDRAWAL"])}</td>
      <td>${formatNum(r["DP COMM"])}</td>
      <td>${formatNum(r["WD COMM"])}</td>
      <td>${formatNum(r["ADD COMM"])}</td>
      <td>${formatNum(r["RUNNING_BALANCE"])}</td>
    `;
    body.appendChild(tr);
  });
}

/* =========================================================
   ZIP DOWNLOAD — FIXED
   ========================================================= */
async function downloadAllShops() {
  if (!cachedData.length) {
    alert("No data available");
    return;
  }

  try {
    const zip = new JSZip();

    const [
      depositRaw,
      withdrawalRaw,
      stlmRaw,
      commRaw,
      balanceRaw
    ] = await Promise.all([
      fetch(SHEETS.DEPOSIT).then(r => r.json()),
      fetch(SHEETS.WITHDRAWAL).then(r => r.json()),
      fetch(SHEETS.STLM).then(r => r.json()),
      fetch(SHEETS.COMM).then(r => r.json()),
      fetch(SHEETS.SHOPS_BALANCE).then(r => r.json())
    ]);

    const deposit = depositRaw.map(normalizeRow);
    const withdrawal = withdrawalRaw.map(normalizeRow);
    const stlm = stlmRaw.map(normalizeRow);
    const comm = commRaw.map(normalizeRow);
    const shopBalance = balanceRaw.map(normalizeRow);

    for (const shop of cachedData) {
      const shopName = shop["SHOP NAME"];
      const nShop = normalizeStr(shopName);

      const balRow = shopBalance.find(r => normalizeStr(r["SHOP"]) === nShop);
      const bfBalance = parseNum(balRow?.["BRING FORWARD BALANCE"]);
      const secDeposit = parseNum(balRow?.["SECURITY DEPOSIT"]);
      const teamLeader = balRow?.["TEAM LEADER"] || "UNKNOWN";

      const commRow = comm.find(r => normalizeStr(r["SHOP"]) === nShop);
      const dpRate = parseNum(commRow?.["DP COMM"]);
      const wdRate = parseNum(commRow?.["WD COMM"]);
      const addRate = parseNum(commRow?.["ADD COMM"]);

      const dates = new Set([
        ...deposit.filter(r => normalizeStr(r["SHOP"]) === nShop).map(r => r["DATE"]),
        ...withdrawal.filter(r => normalizeStr(r["SHOP"]) === nShop).map(r => r["DATE"]),
        ...stlm.filter(r => normalizeStr(r["SHOP"]) === nShop).map(r => r["DATE"])
      ]);

      const sortedDates = [...dates].filter(Boolean).sort(
        (a, b) => new Date(a) - new Date(b)
      );

      let runningBalance = bfBalance;
      const rows = [];

      rows.push(shopName);
      rows.push(`Shop Name: ${shopName}`);
      rows.push(`Security Deposit: ${formatNum(secDeposit)}`);
      rows.push(`Bring Forward Balance: ${formatNum(bfBalance)}`);
      rows.push(`Team Leader: ${teamLeader}`);
      rows.push(
        `"DATE","DEPOSIT","WITHDRAWAL","IN","OUT","SETTLEMENT","SPECIAL PAYMENT","ADJUSTMENT","SEC DEPOSIT","DP COMM","WD COMM","ADD COMM","BALANCE"`
      );

      // B/F row
      rows.push(
        `"B/F Balance","0","0","0","0","0","0","0","0","0","0","0","${formatNum(runningBalance)}"`
      );

      for (const date of sortedDates) {
        const dep = deposit.filter(r => normalizeStr(r["SHOP"]) === nShop && r["DATE"] === date);
        const wd = withdrawal.filter(r => normalizeStr(r["SHOP"]) === nShop && r["DATE"] === date);
        const st = stlm.filter(r => normalizeStr(r["SHOP"]) === nShop && r["DATE"] === date);

        const depTotal = dep.reduce((s, r) => s + parseNum(r["AMOUNT"]), 0);
        const wdTotal = wd.reduce((s, r) => s + parseNum(r["AMOUNT"]), 0);

        const sumMode = m =>
          st.filter(r => normalizeStr(r["MODE"]) === m)
            .reduce((s, r) => s + parseNum(r["AMOUNT"]), 0);

        const inAmt = sumMode("IN");
        const outAmt = sumMode("OUT");
        const settlement = sumMode("SETTLEMENT");
        const specialPay = sumMode("SPECIAL PAYMENT");
        const adjustment = sumMode("ADJUSTMENT");
        const secDep = sumMode("SECURITY DEPOSIT");

        const dpComm = depTotal * dpRate / 100;
        const wdComm = wdTotal * wdRate / 100;
        const addComm = depTotal * addRate / 100;

        runningBalance +=
          depTotal - wdTotal +
          inAmt - outAmt -
          settlement - specialPay +
          adjustment -
          dpComm - wdComm - addComm;

        rows.push(
          `"${date}","${formatNum(depTotal)}","${formatNum(wdTotal)}","${formatNum(inAmt)}","${formatNum(outAmt)}","${formatNum(settlement)}","${formatNum(specialPay)}","${formatNum(adjustment)}","${formatNum(secDep)}","${formatNum(dpComm)}","${formatNum(wdComm)}","${formatNum(addComm)}","${formatNum(runningBalance)}"`
        );
      }

      rows.push(`"TOTAL",${Array(12).fill('""').join(",")},"${formatNum(runningBalance)}"`);

      zip.folder(teamLeader).file(`${shopName}.csv`, rows.join("\n"));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `All_Shops_Summary_${new Date().toISOString().slice(0,10)}.zip`);

  } catch (err) {
    console.error(err);
    alert("ZIP generation failed: " + err.message);
  }
}

/* -------------------------
   Init
------------------------- */
async function initDashboard() {
  const data = await fetchShopsBalance();
  buildSummary(data);

  document
    .getElementById("downloadAllShopsBtn")
    ?.addEventListener("click", downloadAllShops);
}

initDashboard();

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR-IyIxKfV2_3PdaNJYvD7xbqdGcGAgPd1QLZPM7zO8f4cOiwdyXDPJuQNOvzgXks_wDAZW8qt6wB2/pub?gid=388611018&single=true&output=csv";

let allData = [];
let chart;

async function loadData() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    let csv = await res.text();

    // 🔑 FIX 1: Remove leading empty lines (your Row 1 is blank)
    csv = csv.replace(/^(\s*,*\s*\r?\n)+/, "");

    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim()   // 🔑 FIX 2: trim header whitespace
    });

    console.log("Headers detected:", parsed.meta.fields);
    console.log("Sample row:", parsed.data[0]);

    // 🔑 FIX 3: keep rows that have ANY meaningful data, not just SBU
    allData = parsed.data.filter(r =>
      Object.values(r).some(v => v && String(v).trim() !== "")
    );

    if (allData.length === 0) {
      throw new Error("Parsed 0 rows. Check that the sheet is published as CSV.");
    }

    populateFilters();
    renderDashboard();
    document.getElementById("lastUpdate").textContent =
      "Last refreshed: " + new Date().toLocaleString() +
      " | " + allData.length + " records loaded";
  } catch (e) {
    console.error("Failed to load sheet:", e);
    document.getElementById("lastUpdate").textContent =
      "⚠️ Error: " + e.message;
  }
}

function uniqueValues(key) {
  return [...new Set(allData.map(r => (r[key] || "").toString().trim()).filter(Boolean))].sort();
}

function populateFilters() {
  fillSelect("sbuFilter", uniqueValues("SBU"));
  fillSelect("sectionFilter", uniqueValues("Section"));
  fillSelect("roleFilter", uniqueValues("Role"));
}

function fillSelect(id, values) {
  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="All">All</option>`;
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function applyFilters() {
  const sbu = document.getElementById("sbuFilter").value;
  const section = document.getElementById("sectionFilter").value;
  const role = document.getElementById("roleFilter").value;
  return allData.filter(r =>
    (sbu === "All" || (r.SBU || "").trim() === sbu) &&
    (section === "All" || (r.Section || "").trim() === section) &&
    (role === "All" || (r.Role || "").trim() === role)
  );
}

function renderDashboard() {
  const data = applyFilters();
  const prevHC = data.reduce((s, r) => s + (parseFloat(r["Previous Head Count"]) || 0), 0);
  const justHC = data.reduce((s, r) => s + (parseFloat(r["Justified Head Count"]) || 0), 0);

  document.getElementById("totalRows").textContent = data.length;
  document.getElementById("prevHC").textContent = prevHC;
  document.getElementById("justHC").textContent = justHC;
  document.getElementById("variance").textContent = justHC - prevHC;

  renderTable(data);
  renderChart(data);
}

function renderTable(data) {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.Date || ""}</td>
      <td>${r.SBU || ""}</td>
      <td>${r.Section || ""}</td>
      <td>${r["Work Center"] || ""}</td>
      <td>${r.Role || ""}</td>
      <td>${r["Previous Head Count"] || ""}</td>
      <td>${r["Justified Head Count"] || ""}</td>
      <td>${r.Remarks || ""}</td>
    </tr>`).join("");
}

function renderChart(data) {
  const grouped = {};
  data.forEach(r => {
    const key = (r.Section || "Unknown").trim();
    if (!grouped[key]) grouped[key] = { prev: 0, just: 0 };
    grouped[key].prev += parseFloat(r["Previous Head Count"]) || 0;
    grouped[key].just += parseFloat(r["Justified Head Count"]) || 0;
  });
  const labels = Object.keys(grouped);
  const prev = labels.map(l => grouped[l].prev);
  const just = labels.map(l => grouped[l].just);

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("hcChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Previous HC", data: prev, backgroundColor: "#fbbc05" },
        { label: "Justified HC", data: just, backgroundColor: "#1a73e8" }
      ]
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Head Count by Section" } }
    }
  });
}

["sbuFilter", "sectionFilter", "roleFilter"].forEach(id =>
  document.getElementById(id).addEventListener("change", renderDashboard)
);
document.getElementById("resetBtn").addEventListener("click", () => {
  ["sbuFilter", "sectionFilter", "roleFilter"].forEach(id => {
    document.getElementById(id).value = "All";
  });
  renderDashboard();
});

loadData();

// Optional: auto-refresh every 5 minutes
setInterval(loadData, 5 * 60 * 1000);

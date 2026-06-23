const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR-IyIxKfV2_3PdaNJYvD7xbqdGcGAgPd1QLZPM7zO8f4cOiwdyXDPJuQNOvzgXks_wDAZW8qt6wB2/pub?gid=388611018&single=true&output=csv";

let allData = [];
let chart;

async function loadData() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    allData = parsed.data.filter(r => r.SBU); // skip blanks
    populateFilters();
    renderDashboard();
    document.getElementById("lastUpdate").textContent =
      "Last refreshed: " + new Date().toLocaleString();
  } catch (e) {
    console.error("Failed to load sheet:", e);
    alert("Error loading data. Make sure the sheet is published to web.");
  }
}

function uniqueValues(key) {
  return [...new Set(allData.map(r => (r[key] || "").trim()).filter(Boolean))].sort();
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
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  });
}

function applyFilters() {
  const sbu = document.getElementById("sbuFilter").value;
  const section = document.getElementById("sectionFilter").value;
  const role = document.getElementById("roleFilter").value;
  return allData.filter(r =>
    (sbu === "All" || r.SBU === sbu) &&
    (section === "All" || r.Section === section) &&
    (role === "All" || r.Role === role)
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
    const key = r.Section || "Unknown";
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

["sbuFilter","sectionFilter","roleFilter"].forEach(id =>
  document.getElementById(id).addEventListener("change", renderDashboard)
);
document.getElementById("resetBtn").addEventListener("click", () => {
  ["sbuFilter","sectionFilter","roleFilter"].forEach(id => document.getElementById(id).value = "All");
  renderDashboard();
});

loadData();

"use strict";

const SUBCLASS_COLORS = {
    "L2/3 IT CTX Glut": "#83c65b",
    "L4/5 IT CTX Glut": "#2e7ffe",
    "L5 IT CTX Glut": "#1c943e",
    "L6 IT CTX Glut": "#0c727c",
    "L2/3 IT RSP Glut": "#89288f",
    "IT AON-TT-DP Glut": "#67b9c8",
    "L4 RSP-ACA Glut": "#9ab72f",
    "L5 ET CTX Glut": "#27a99b",
    "SUB-ProS Glut": "#c76d52",
    "CA1-ProS Glut": "#e66b9e",
    "CA3 Glut": "#7e91c2",
    "CLA-EPd-CTX Car3 Glut": "#a9274e",
    "L5 NP CTX Glut": "#bd78d9",
    "L6 CT CTX Glut": "#6e4a9e",
    "DG Glut": "#e16a22",
    "OB Eomes Ms4a15 Glut": "#7b4b96",
    "OB-in Frmd7 Gaba": "#d94538",
    "OB-out Frmd7 Gaba": "#1d9c84",
    "Sncg Gaba": "#b45e9e",
    "Lamp5 Gaba": "#e76d84",
    "Pvalb Gaba": "#2c91c4",
    "Sst Gaba": "#087fad",
    "STR D1 Gaba": "#28b963",
    "ACB-BST-FS D1 Gaba": "#007347",
    "Astro-TE NN": "#56ad83",
    "Oligo NN": "#327fb7",
    "OPC NN": "#227895",
    "OEC NN": "#ddb52d",
    "Microglia NN": "#b88f55",
    "LA-BLA-BMA-PA Glut": "#b76a1f"
};

const FALLBACK_COLORS = [
    "#b64f4f", "#3f78ad", "#398a63", "#c28b2c", "#76579a",
    "#2f9188", "#a35f2c", "#596675", "#19796d", "#9e3f42"
];

const MODALITY_COLORS = {
    RNA: "#d84a5b",
    "5hmC": "#c7952d",
    "5mC": "#397eb8"
};

const state = {
    data: null,
    colorBy: "subclass",
    selectedSubclasses: new Set(),
    pointSize: 3,
    opacity: 0.7,
    subclassColors: {}
};
let chartResizeTimer;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    bindControls();
    try {
        const response = await fetch("/api/umap-data");
        if (!response.ok) {
            throw new Error(`Data request failed with status ${response.status}.`);
        }
        state.data = await response.json();
        assignSubclassColors();
        renderDatasetSummary();
        renderSubclassList();
        await renderAll();
        document.getElementById("loading").hidden = true;
    } catch (error) {
        showError(error.message);
    }
}

function bindControls() {
    document.querySelectorAll("[data-color]").forEach((button) => {
        button.addEventListener("click", async () => {
            state.colorBy = button.dataset.color;
            document.querySelectorAll("[data-color]").forEach((item) => {
                const active = item === button;
                item.classList.toggle("active", active);
                item.setAttribute("aria-pressed", String(active));
            });
            await renderUmap();
        });
    });

    const pointSize = document.getElementById("pointSize");
    pointSize.addEventListener("input", () => {
        state.pointSize = Number(pointSize.value);
        document.getElementById("pointSizeValue").value = pointSize.value;
        updateMarkerStyle();
    });

    const opacity = document.getElementById("opacity");
    opacity.addEventListener("input", () => {
        state.opacity = Number(opacity.value);
        document.getElementById("opacityValue").value = Number(opacity.value).toFixed(1);
        updateMarkerStyle();
    });

    document.getElementById("searchSubclass").addEventListener("input", (event) => {
        filterSubclassList(event.target.value);
    });
    document.getElementById("clearFilter").addEventListener("click", clearSubclassFilter);
    document.getElementById("resetView").addEventListener("click", () => {
        Plotly.relayout("umapPlot", {"xaxis.autorange": true, "yaxis.autorange": true});
    });
    window.addEventListener("resize", () => {
        clearTimeout(chartResizeTimer);
        chartResizeTimer = setTimeout(() => {
            if (state.data) {
                void renderModalityChart();
            }
        }, 180);
    });
}

function assignSubclassColors() {
    state.data.subclasses.forEach((subclass, index) => {
        state.subclassColors[subclass] = SUBCLASS_COLORS[subclass]
            || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    });
}

function renderDatasetSummary() {
    const stats = state.data.stats;
    document.getElementById("headerCells").textContent = formatNumber(stats.unique_cells);
    document.getElementById("headerPoints").textContent = formatNumber(stats.total_points);
}

function renderSubclassList() {
    const container = document.getElementById("subclassList");
    const counts = state.data.stats.subclass_counts;
    const subclasses = [...state.data.subclasses].sort((a, b) => counts[b] - counts[a]);
    const maxCount = Math.max(...subclasses.map((subclass) => counts[subclass]));
    container.replaceChildren(...subclasses.map((subclass) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "subclass-item";
        button.dataset.subclass = subclass;
        button.title = subclass;
        const dot = document.createElement("span");
        dot.className = "subclass-dot";
        dot.style.backgroundColor = state.subclassColors[subclass];
        const copy = document.createElement("span");
        copy.className = "subclass-copy";
        const name = document.createElement("span");
        name.className = "subclass-name";
        name.textContent = subclass;
        const meter = document.createElement("span");
        meter.className = "subclass-meter";
        const meterFill = document.createElement("span");
        meterFill.className = "subclass-meter-fill";
        meterFill.style.backgroundColor = state.subclassColors[subclass];
        meterFill.style.width = `${Math.max(3, counts[subclass] / maxCount * 100)}%`;
        meter.append(meterFill);
        copy.append(name, meter);
        const count = document.createElement("span");
        count.className = "subclass-count";
        count.textContent = formatNumber(counts[subclass]);
        button.append(dot, copy, count);
        button.addEventListener("click", () => toggleSubclass(subclass, button));
        return button;
    }));
}

function filterSubclassList(query) {
    const normalized = query.trim().toLowerCase();
    document.querySelectorAll(".subclass-item").forEach((item) => {
        item.hidden = !item.dataset.subclass.toLowerCase().includes(normalized);
    });
}

async function toggleSubclass(subclass, button) {
    if (state.selectedSubclasses.has(subclass)) {
        state.selectedSubclasses.delete(subclass);
        button.classList.remove("active");
    } else {
        state.selectedSubclasses.add(subclass);
        button.classList.add("active");
    }
    document.getElementById("clearFilter").disabled = state.selectedSubclasses.size === 0;
    await renderAll();
}

async function clearSubclassFilter() {
    state.selectedSubclasses.clear();
    document.querySelectorAll(".subclass-item.active").forEach((item) => item.classList.remove("active"));
    document.getElementById("clearFilter").disabled = true;
    await renderAll();
}

function filteredCells() {
    if (state.selectedSubclasses.size === 0) {
        return state.data.cells;
    }
    return state.data.cells.filter((cell) => state.selectedSubclasses.has(cell.subclass));
}

async function renderAll() {
    const cells = filteredCells();
    renderCurrentStats(cells);
    await Promise.all([renderUmap(cells), renderModalityChart(cells)]);
}

function renderCurrentStats(cells) {
    document.getElementById("visiblePoints").textContent = formatNumber(cells.length);
    document.getElementById("visibleSubclasses").textContent = formatNumber(new Set(cells.map((cell) => cell.subclass)).size);
    document.getElementById("visibleModalities").textContent = formatNumber(new Set(cells.map((cell) => cell.modality)).size);
}

async function renderUmap(cells = filteredCells()) {
    const grouped = groupBy(cells, state.colorBy);
    let names = [...grouped.keys()];
    if (state.colorBy === "subclass") {
        names = names.sort((a, b) => grouped.get(b).length - grouped.get(a).length);
    } else {
        names = state.data.meta.modalities.filter((name) => grouped.has(name));
    }

    const traces = names.map((name) => {
        const group = grouped.get(name);
        const color = state.colorBy === "subclass"
            ? state.subclassColors[name]
            : MODALITY_COLORS[name];
        return {
            type: "scattergl",
            mode: "markers",
            name,
            x: group.map((cell) => cell.x),
            y: group.map((cell) => cell.y),
            customdata: group.map((cell) => [cell.id, cell.modality, cell.subclass]),
            hovertemplate: "<b>%{customdata[0]}</b><br>%{customdata[1]}<br>%{customdata[2]}<extra></extra>",
            marker: {
                color,
                line: {width: 0},
                opacity: state.opacity,
                size: state.pointSize
            }
        };
    });

    const layout = {
        autosize: true,
        dragmode: "pan",
        hovermode: "closest",
        margin: {t: state.colorBy === "modality" ? 42 : 20, r: 28, b: 58, l: 66},
        paper_bgcolor: "#faf9fb",
        plot_bgcolor: "#f5f3f7",
        showlegend: state.colorBy === "modality",
        legend: {
            orientation: "h",
            x: 1,
            xanchor: "right",
            y: 1.03,
            yanchor: "bottom",
            borderwidth: 0,
            font: {size: 15}
        },
        xaxis: {
            title: {text: "UMAP 1", font: {size: 17}},
            gridcolor: "#dfdbe4",
            linecolor: "#bdb7c7",
            zeroline: false
        },
        yaxis: {
            title: {text: "UMAP 2", font: {size: 17}},
            gridcolor: "#dfdbe4",
            linecolor: "#bdb7c7",
            scaleanchor: "x",
            scaleratio: 1,
            zeroline: false
        },
        font: {family: "Inter, Segoe UI, Arial, sans-serif", color: "#4a4651", size: 16},
        uirevision: "hermit-umap"
    };
    const config = {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        modeBarButtonsToRemove: ["lasso2d", "select2d"]
    };
    await Plotly.react("umapPlot", traces, layout, config);
}

function updateMarkerStyle() {
    if (!state.data || !document.getElementById("umapPlot").data) {
        return;
    }
    Plotly.restyle("umapPlot", {
        "marker.size": state.pointSize,
        "marker.opacity": state.opacity
    });
}

async function renderModalityChart(cells = filteredCells()) {
    const subclasses = new Map();
    cells.forEach((cell) => {
        if (!subclasses.has(cell.subclass)) {
            subclasses.set(cell.subclass, {RNA: 0, "5hmC": 0, "5mC": 0});
        }
        subclasses.get(cell.subclass)[cell.modality] += 1;
    });
    const rows = [...subclasses.entries()]
        .map(([name, counts]) => ({name, counts, total: counts.RNA + counts["5hmC"] + counts["5mC"]}))
        .sort((a, b) => b.total - a.total);
    const names = rows.map((row) => row.name);
    const chart = document.getElementById("modalityChart");
    const chartWrap = document.getElementById("modalityChartWrap");
    const chartHeight = chartWrap.clientHeight;
    const chartWidth = Math.max(chartWrap.clientWidth, names.length * 54 + 120);
    chart.style.width = `${chartWidth}px`;

    const traces = state.data.meta.modalities.map((modality) => ({
        type: "bar",
        name: modality,
        x: names,
        y: rows.map((row) => row.counts[modality]),
        marker: {color: MODALITY_COLORS[modality]},
        hovertemplate: `<b>%{x}</b><br>${modality}: %{y:,}<extra></extra>`
    }));
    const layout = {
        autosize: false,
        width: chartWidth,
        height: chartHeight,
        barmode: "stack",
        bargap: 0.24,
        margin: {t: 44, r: 20, b: 125, l: 72},
        paper_bgcolor: "#faf9fb",
        plot_bgcolor: "#f5f3f7",
        font: {family: "Inter, Segoe UI, Arial, sans-serif", color: "#4a4651", size: 14},
        legend: {orientation: "h", x: 0.5, xanchor: "center", y: 1.12},
        xaxis: {tickangle: -40, gridcolor: "#e7e3ea"},
        yaxis: {
            title: {text: "Modality points", font: {size: 15}},
            gridcolor: "#dfdbe4",
            rangemode: "tozero"
        }
    };
    await Plotly.react("modalityChart", traces, layout, {displayModeBar: false, responsive: false});
}

function groupBy(cells, key) {
    const groups = new Map();
    cells.forEach((cell) => {
        const value = cell[key];
        if (!groups.has(value)) {
            groups.set(value, []);
        }
        groups.get(value).push(cell);
    });
    return groups;
}

function showError(message) {
    document.getElementById("loading").hidden = true;
    const error = document.getElementById("errorState");
    error.textContent = message;
    error.hidden = false;
}

function formatNumber(value) {
    return Number(value).toLocaleString("en-US");
}

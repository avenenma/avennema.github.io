let allData;
let currentYear = 2022;  // default
let currentFilter = () => true;
let currentOrigin = ["All"];
let currentDestination = ["All"];
let currentAgeGroup = "All";
let currentIncomeGroup = "All";
let focusedNode = null;

const svg = d3.select("#sankey");
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Load data
d3.json("sankey_data.json").then(data => {
  data.links.forEach(d => {
    if (!d.year) {
      d.year = 2022;  // Set to a default year if missing
    }
  });

  allData = {
    nodes: data.nodes,
    links: data.links
  };

  const groups = Array.from(new Set(data.links.map(d => d.group))).sort();
  const ageGroups = ["age_<=29", "age_30_54", "age_55+"];
  const incomeGroups = groups.filter(g => g.startsWith("inc")).sort((a, b) => {
    const getOrder = val => {
      if (val.includes("<")) return 0;
      if (val.includes("_")) return 1;
      if (val.includes(">")) return 2;
      return 3;
    };
    return getOrder(a) - getOrder(b);
  });

  // Add dropdowns
  let ageSelectizeInstance, incomeSelectizeInstance;

ageSelectizeInstance = createGroupFilter(
  "#ageFilter", 
  "Age Group", 
  ageGroups, 
  val => {
    currentAgeGroup = val;
    if (val !== "All") {
      incomeSelectizeInstance.disable();
    } else {
      incomeSelectizeInstance.enable();
    }
    renderSankey(filteredData());
  }
);

incomeSelectizeInstance = createGroupFilter(
  "#incomeFilter", 
  "Income Group", 
  incomeGroups, 
  val => {
    currentIncomeGroup = val;
    if (val !== "All") {
      ageSelectizeInstance.disable();
    } else {
      ageSelectizeInstance.enable();
    }
    renderSankey(filteredData());
  }
);

  initFilters(allData);
  setTimeout(() => {
    renderSankey(filteredData());
  }, 0);

  const observer = new ResizeObserver(() => {
    setTimeout(() => {
      renderSankey(filteredData());
    }, 0);
  });
  observer.observe(document.getElementById("sankey-container"));

});

function createGroupFilter(containerId, label, options, onChange) {
  const container = d3.select(containerId);
  container.append("label")
    .style("font-weight", "bold")
    .text(label + ": ");
  const select = container.append("select");

  select.selectAll("option")
    .data(["All", ...options])
    .join("option")
    .attr("value", d => d)
    .text(d => {
      if (d.startsWith("inc")) {
        if (d.includes("<")) return "Below $1,250";
        if (d.includes(">")) return "Above $3,333";
        const match = d.match(/(\d+)_(\d+)/);
        if (match) {
          const low = +match[1];
          const high = +match[2];
          return `$${low.toLocaleString()} to $${high.toLocaleString()}`;
        }
      } else if (d.startsWith("age")) {
        return d.replace("age_", "")
        .replace("<=29", "Below 30")
        .replace("55+", "Above 55")
        .replace("30_54", "Between 30 and 55");
      }
      return d;
    });


  // Stylize with Selectize
  setTimeout(() => {
    $(select.node()).selectize({
      create: false,
      sortField: current => current.text === "All" ? -1 : current.text,
      placeholder: `Select ${label}`
    });
  }, 0);
  
  const selInstance = $(select.node()).selectize({
    create: false,
    sortField: (item) => item.text === "All" ? -1 : item.text,
    placeholder: `Select ${label}`,
    onChange: (val) => {
      onChange(val);
      renderSankey(filteredData());
    }
  });

  return selInstance[0].selectize;

}

function formatNeighborhoodName(name) {
  const customMap = {
    "IAH / AIRPORT AREA": "IAH / Airport Area",
    "WASHINGTON AVENUE COALITION / MEMORIAL PARK": "Washington Ave / Memorial Park",
  };

  if (customMap[name]) return customMap[name];

  // Default: Title Case
  return name.toLowerCase()
             .split(" ")
             .map(word => word.charAt(0).toUpperCase() + word.slice(1))
             .join(" ");
}

function initFilters(data) {
  const filterDefs = [
    { label: "All", filter: () => true },
    { label: "No Vehicle > 5%", filter: d => d.pct_no_vehicle > 5 },
    { label: "Transit > 1%", filter: d => d.pct_transit > 1 },
    { label: "Carpool > 10%", filter: d => d.pct_carpool > 10 }
  ];

  const filters = d3.select("#filters")
    .selectAll("button")
    .data(filterDefs)
    .enter()
    .append("button")
    .attr("class", "filter-btn")
    .text(d => d.label)
    .on("click", (event, d) => {
      currentFilter = d.filter;
      d3.selectAll(".filter-btn").classed("active", false);
      d3.select(event.currentTarget).classed("active", true);
      console.log("Applied filter:", d.label);
      renderSankey(filteredData());
    });

  filters.filter(d => d.label === "All").classed("active", true);

  const origins = Array.from(new Set(data.links.map(d => d.home)))
    .filter(d => d !== "All")
    .sort();
  origins.unshift("All");

  const originSelect = d3.select("#originFilter");
  origins.forEach(origin => {
    originSelect.append("option").attr("value", origin).text(origin);
  });

  const destinations = Array.from(new Set(data.links.map(d => d.work)))
    .filter(d => d !== "All")
    .sort();
  destinations.unshift("All");

  const select = d3.select("#destinationFilter");
  destinations.forEach(dest => {
    select.append("option")
      .attr("value", dest)
      .text(formatNeighborhoodName(dest));
  });

  setTimeout(() => {
    if (window.Selectize) {
      const originSelectizeInstance = $('#originFilter').selectize({
        create: false,
        sortField: 'text',
        maxItems: null,
        plugins: ['remove_button'],
        placeholder: "Search and select origins"
      });

      const originSel = originSelectizeInstance[0].selectize;

      originSel.on('change', values => {
        if (values.includes("All")) {
          originSel.clear();
          currentOrigin = ["All"];
        } else {
          currentOrigin = values.length ? values : ["All"];
        }
        renderSankey(filteredData());
      });

      originSel.clear();

      const selectizeInstance = $('#destinationFilter').selectize({
        create: false,
        sortField: null,
        maxItems: null,
        plugins: ['remove_button'],
        placeholder: "Search and select destinations"
      });

      const sel = selectizeInstance[0].selectize;

      sel.on('change', values => {
        if (values.includes("All")) {
          sel.clear();
          currentDestination = ["All"];
        } else {
          currentDestination = values.length ? values : ["All"];
        }
        renderSankey(filteredData());
      });

      sel.clear();
    }
  }, 50);
}

function filteredData() {
  const links = allData.links
    .map(d => ({
      ...d,
      value: +d.value,
      pct_no_vehicle: +d.pct_no_vehicle || 0,
      pct_transit: +d.pct_transit || 0,
      pct_carpool: +d.pct_carpool || 0
    }))

    .filter(d => {
      const filterMatch = currentFilter(d);
      const originMatch = currentOrigin.includes("All") || currentOrigin.includes(d.home);
      const destMatch = currentDestination.includes("All") || currentDestination.includes(d.work);
      const yearMatch = +d.year === currentYear;

      const group = d.group || "";
      const isAge = group.startsWith("age");
      const isIncome = group.startsWith("inc");

      const isAllAge = currentAgeGroup === "All";
      const isAllIncome = currentIncomeGroup === "All";

      let groupMatch = false;

      if (!isAllAge && isAllIncome) {
        groupMatch = isAge && group === currentAgeGroup;
      } else if (isAllAge && !isAllIncome) {
        groupMatch = isIncome && group === currentIncomeGroup;
      } else if (isAllAge && isAllIncome) {
        groupMatch = isAge;  // Default: show all age groups
      }

      const keep = filterMatch && originMatch && destMatch && yearMatch && groupMatch;

      if (keep) {
        console.log(`KEEP: ${d.home} → ${d.work}, year: ${d.year}, group: ${group}, value: ${d.value}`);
      }

      return keep;
    });

  // Merge links with same O/D/year
  const mergedLinks = {};
  links.forEach(link => {
    const key = `${link.home}|${link.work}|${link.year}`;
    if (!mergedLinks[key]) {
      mergedLinks[key] = { ...link, value: 0 };
    }
    mergedLinks[key].value += link.value;
  });

  const combined = Object.values(mergedLinks);
  return combined
    .sort((a, b) => d3.descending(a.value, b.value))
    .slice(0, 20);
}

function renderSankey(linkData) {
  focusedNode = null;

  svg.selectAll("*").interrupt();
  svg.selectAll("*").remove();

  // Compute inflow and outflow totals
  const inflowCounts = {};
  const outflowCounts = {};

  linkData.forEach(d => {
    inflowCounts[d.work] = (inflowCounts[d.work] || 0) + d.value;
    outflowCounts[d.home] = (outflowCounts[d.home] || 0) + d.value;
  });

  // Split homes and works
  const homes = Array.from(new Set(linkData.map(d => d.home)))
    .sort((a, b) => (outflowCounts[b] || 0) - (outflowCounts[a] || 0));

  const works = Array.from(new Set(linkData.map(d => d.work)))
    .sort((a, b) => (inflowCounts[b] || 0) - (inflowCounts[a] || 0));

  // Combine into full node list
  const nodeNames = [...homes, ...works.filter(w => !homes.includes(w))];

  const nodeMap = new Map();

  const nodes = nodeNames.map((name, i) => {
    const formattedName = formatNeighborhoodName(name);
    nodeMap.set(name, i);
    return { name: formattedName, rawName: name }; 
  });

  const links = linkData.map(d => ({
    source: nodeMap.get(d.home),
    target: nodeMap.get(d.work),
    value: +d.value,
    home: d.home,
    work: d.work,
    pct_no_vehicle: d.pct_no_vehicle,
    pct_transit: d.pct_transit,
    pct_carpool: d.pct_carpool,
    year: d.year
  })).filter(d => Number.isFinite(d.value) && d.source != null && d.target != null);

  const sortedTop10 = links
    .slice()
    .sort((a, b) => d3.descending(a.value, b.value))
    .slice(0, 10);

  const top10Map = new Set(sortedTop10.map(d => `${d.home}--${d.work}`));

  // Reorder links to put top 10 first *and* sorted
  const nonTop10 = links.filter(d => !top10Map.has(`${d.home}--${d.work}`));
  const allSortedLinks = [...sortedTop10, ...nonTop10];
  const container = document.getElementById("sankey-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const marginLeft = 100;
  const marginRight = 200;

  const sankey = d3.sankey()
    .nodeWidth(15)
    .nodePadding(20)
    .extent([[marginLeft, 50], [width - marginRight, height - 50]]);


  const graph = sankey({
    nodes: nodes.map(d => ({ ...d })),
    links: allSortedLinks
  });

  graph.links.forEach(l => {
    const sourceRaw = typeof l.source === "object" ? l.source.rawName : graph.nodes[l.source].rawName;
    const targetRaw = typeof l.target === "object" ? l.target.rawName : graph.nodes[l.target].rawName;
    l.home = sourceRaw;
    l.work = targetRaw;
  });

  const inflow = new Map();
  const outflow = new Map();
  allSortedLinks.forEach(d => {
    outflow.set(d.home, (outflow.get(d.home) || 0) + d.value);
    inflow.set(d.work, (inflow.get(d.work) || 0) + d.value);
  });

  const maxFlow = d3.max(linkData, d => d.value);

  svg.selectAll("path").interrupt();

  // Draw links
  svg.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(graph.links)
    .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("class", d => top10Map.has(`${d.home}--${d.work}`) ? "link highlight" : "link")
    .classed("highlight", d => top10Map.has(`${d.home}--${d.work}`)) 
    .attr("stroke", d => top10Map.has(`${d.home}--${d.work}`) ? "#1f78b4" : "#bbb")
    .attr("stroke-width", d => {
      const width = (d.value / maxFlow) * 15;
      return Math.max(1.5, width);
    })
    .attr("opacity", 0.7)
    .on("mouseover", (event, d) => {
      //console.log("Hovered node:", d.name);
      const totalCommuters = window.totalCommuters || d3.sum(linkData, d => d.value);
      tooltip.transition().duration(100).style("opacity", 0.95);
      tooltip.html(`
        <strong>${d.source.name} → ${d.target.name}</strong><br>
        Year: ${d.year}<br>
        Total Commuters: ${d.value.toLocaleString()}<br>
        Share of Total: ${(d.value / totalCommuters * 100).toFixed(1)}%<br>
        No Vehicle Access: ${d.pct_no_vehicle.toFixed(1)}%<br>
        Use Transit: ${d.pct_transit.toFixed(1)}%<br>
        Carpool: ${d.pct_carpool.toFixed(1)}%
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

  // Draw nodes
  const nodeRects = svg.append("g")
  .selectAll("rect")
  .data(graph.nodes)
  .join("rect")
  .attr("x", d => d.x0)
  .attr("y", d => d.y0)
  .attr("height", d => Math.max(1, d.y1 - d.y0))
  .attr("width", sankey.nodeWidth())
  .attr("fill", "#7b9acc")
  .on("mouseover", function(event, d) {
    //console.log("Hovered node:", d.rawName); 
    const rawName = d.rawName;
    svg.selectAll("path.link")
      .attr("stroke-opacity", l => l.home === rawName || l.work === rawName ? 0.9 : 0.1)
      .attr("stroke", l => l.home === rawName || l.work === rawName ? "#1f78b4" : "#bbb")
      .attr("stroke-width", l => l.home === rawName || l.work === rawName ? Math.max(2.5, l.width) : Math.max(1, l.width));

  })
  .on("mouseout", function() {
    svg.selectAll("path.link")
      .attr("stroke-opacity", 0.7)
      .attr("stroke", d => top10Map.has(`${d.home}--${d.work}`) ? "#1f78b4" : "#bbb")
      .attr("stroke-width", d => Math.max(1, d.width));
  })
  .on("click", function(event, d) {
    const name = d.name;
    if (focusedNode === name) {
      // Unfocus if clicked again
      focusedNode = null;
      svg.selectAll("path.link")
        .transition().duration(200)
        .attr("stroke-opacity", 0.7)
        .attr("stroke", l => top10Map.has(`${l.home}--${l.work}`) ? "#1f78b4" : "#bbb")
        .attr("stroke-width", l => Math.max(1, l.width));
  } else {
    // Focus on the clicked node
    focusedNode = name;
    svg.selectAll("path.link")
      .transition().duration(200)
      .attr("stroke-opacity", l => (l.home === name || l.work === name) ? 0.9 : 0.05)
      .attr("stroke", l => (l.home === name || l.work === name) ? "#1f78b4" : "#bbb")
      .attr("stroke-width", l => (l.home === name || l.work === name) ? Math.max(2.5, l.width) : Math.max(1, l.width));
  }
  });


  // Labels with totals
  svg.append("g")
    .selectAll("g.label-group")
    .data(graph.nodes)
    .join("g")
    .attr("class", "label-group")
    .attr("transform", d => {
      const isSource = d.x0 < (width / 2);
      const labelOffset = 14;
      const x = isSource ? d.x0 - 80 : d.x1 + 10;
      const y = (d.y0 + d.y1) / 2;
      return `translate(${x},${y})`;
    })
    .each(function(d) {
      const group = d3.select(this);
      const isSourceNode = d.sourceLinks && d.sourceLinks.length > 0;
      const key = d.rawName;
      const total = isSourceNode ? outflow.get(key) || 0 : inflow.get(key) || 0;
      const formattedTotal = Math.round(total).toLocaleString();

      group.append("text")
        .text(d.name)
        .attr("text-anchor", "start")
        .attr("dy", "-0.4em")
        .attr("fill", "#111")
        .style("font-weight", "bold")
        .style("font-size", "12px")
        .on("mouseover", function () {
          svg.selectAll("path.link")
            .attr("stroke-opacity", l => (l.home === d.name || l.work === d.name) ? 0.9 : 0.1)
            .attr("stroke", l => (l.home === d.name || l.work === d.name) ? "#1f78b4" : "#bbb")
            .attr("stroke-width", l => (l.home === d.name || l.work === d.name) ? Math.max(2.5, l.width) : Math.max(1, l.width));
        })
        .on("mouseout", function () {
          svg.selectAll("path.link")
            .attr("stroke-opacity", 0.7)
            .attr("stroke", l => top10Map.has(`${l.home}--${l.work}`) ? "#1f78b4" : "#bbb")
            .attr("stroke-width", l => Math.max(1, l.width));
        });

    
      if (d.y1 - d.y0 > 3) {
        group.append("text")
          .text(`(${Math.round(total).toLocaleString()})`)
          .attr("text-anchor", "start")
          .attr("dy", ".75em")
          .attr("fill", "#666")
          .style("font-size", "11px");
      }
    });
}

document.getElementById("yearSlider").addEventListener("input", function () {
  currentYear = +this.value;
  document.getElementById("yearLabel").textContent = currentYear;
  renderSankey(filteredData());
});

document.getElementById("downloadCSV").addEventListener("click", () => {
  const links = allData.links
    .map(d => ({
      ...d,
      value: +d.value,
      pct_no_vehicle: +d.pct_no_vehicle,
      pct_transit: +d.pct_transit,
      pct_carpool: +d.pct_carpool
    }))
    .filter(d =>
      (+d.year === currentYear) &&
      (currentOrigin.includes("All") || currentOrigin.includes(d.home)) &&
      (currentDestination.includes("All") || currentDestination.includes(d.work))
    );

  const rows = links.map(d => [
    d.home,
    d.work,
    d.group || "N/A",
    d.year,
    d.value,
    `${d.pct_no_vehicle.toFixed(1)}%`,
    `${d.pct_transit.toFixed(1)}%`,
    `${d.pct_carpool.toFixed(1)}%`
  ]);

  const csvHeader = [
    "Origin",
    "Destination",
    "Group (Age/Income)",
    "Year",
    "Commuters",
    "No Vehicle Access (%)",
    "Transit Use (%)",
    "Carpool (%)"
  ];

  const csvContent = [csvHeader, ...rows].map(r => r.join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "commute_flows.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

const infoIcon = document.getElementById("info-icon");
const infoTooltip = document.getElementById("info-tooltip");

infoIcon.addEventListener("mouseover", (event) => {
  infoTooltip.style.display = "block";
  infoTooltip.style.left = `${event.pageX + 10}px`;
  infoTooltip.style.top = `${event.pageY + 10}px`;
});

infoIcon.addEventListener("mousemove", (event) => {
  infoTooltip.style.left = `${event.pageX + 10}px`;
  infoTooltip.style.top = `${event.pageY + 10}px`;
});

infoIcon.addEventListener("mouseout", () => {
  infoTooltip.style.display = "none";
});
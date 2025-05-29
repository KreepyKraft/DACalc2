let itemsList = [];

  
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}

async function fetchItems() {
  itemsList = Object.entries(ITEM_DATA)
    .filter(([_, data]) => data.ingredients && Object.keys(data.ingredients).length > 0)
    .map(([name, _]) => name);

  window.itemDetails = ITEM_DATA;

  addItem();
}

function addItem() {
  const container = document.getElementById('items-container');
  const div = document.createElement('div');
  div.className = 'item-row';

  const select = document.createElement('select');
  itemsList.forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.value = '1';

  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove';
  removeButton.onclick = () => container.removeChild(div);

  div.appendChild(select);
  div.appendChild(input);
  div.appendChild(removeButton);

  container.appendChild(div);
}


function calculate() {
  const selections = [];
  document.querySelectorAll('#items-container .item-row').forEach(div => {
    const [select, input] = div.children;
    selections.push({
      item: select.value,
      quantity: Number(input.value)
    });
  });

  const totalMaterials = {};
  const breakdown = {};

    function trackBreakdown(item, quantity, target) {
    const data = window.itemDetails[item];
    if (!data || !data.ingredients) return;

    for (const [ingredient, amt] of Object.entries(data.ingredients)) {
        const total = amt * quantity;

        // Track in this item's breakdown
        target[ingredient] = (target[ingredient] || 0) + total;

        // Always count toward total materials
        totalMaterials[ingredient] = (totalMaterials[ingredient] || 0) + total;

        if (window.itemDetails[ingredient]) {
        // If it's craftable, recurse deeper
        trackBreakdown(ingredient, total, target);
        }
    }
    }

  selections.forEach(({ item, quantity }) => {
    breakdown[item] = {};
    trackBreakdown(item, quantity, breakdown[item]);
  });

  renderResults(totalMaterials, breakdown);
}

function flattenIngredients(item, quantity) {
  const result = {};
  const data = window.itemDetails[item];
  if (!data || !data.ingredients) return result;

  for (const [ingredient, amt] of Object.entries(data.ingredients)) {
    const total = amt * quantity;
    if (window.itemDetails[ingredient]) {
      // it means it's crafteable = recurse
      const subIngredients = flattenIngredients(ingredient, total);
      for (const [subMat, subAmt] of Object.entries(subIngredients)) {
        result[subMat] = (result[subMat] || 0) + subAmt;
      }
    } else {
      // no need to recurse
      result[ingredient] = (result[ingredient] || 0) + total;
    }
  }

  return result;
}

function renderResults(total, breakdown) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  const isCraftable = mat =>
    window.itemDetails[mat] &&
    window.itemDetails[mat].ingredients &&
    Object.keys(window.itemDetails[mat].ingredients).length > 0;

  const isWater = mat => mat === 'Water';
  const isTime  = mat => mat === 'Time';

  // split totals
  const baseMaterials    = {};
  const craftedMaterials = {};
  const waterMaterials   = {};
  const timeMaterials    = {};

  for (const [mat, amt] of Object.entries(total)) {
    if (isTime(mat))      timeMaterials[mat]   = amt;
    else if (isWater(mat)) waterMaterials[mat]  = amt;
    else if (isCraftable(mat)) craftedMaterials[mat] = amt;
    else                   baseMaterials[mat]   = amt;
  }

  // helper to build a column
  const makeCol = (emoji, headerText, items, hideNames = false) => {
    const col = document.createElement('div');
    col.className = 'column';
    col.innerHTML = `<div class="column-header">${emoji} ${headerText}</div>`;
    for (const [mat, amt] of Object.entries(items)) {
      const d = document.createElement('div');
      d.className = 'material-item';
      d.textContent = hideNames
        ? `${amt}`
        : `${mat}: ${amt}`;
      col.appendChild(d);
    }
    return col;
  };

  // total materials section
  const totalDiv = document.createElement('div');
  totalDiv.className = 'material-list';
  totalDiv.appendChild(Object.assign(document.createElement('h3'), {
    textContent: 'Total Materials'
  }));

  const totalCols = document.createElement('div');
  totalCols.className = 'columns';
  totalCols.appendChild(makeCol('🧱', 'Non-Craftable', baseMaterials));
  totalCols.appendChild(makeCol('⚙️', 'Craftable',     craftedMaterials));
  totalCols.appendChild(makeCol('💧', 'Water in mL',         waterMaterials, true));  // hide names
  totalCols.appendChild(makeCol('⏳', 'Time in seconds',          timeMaterials,  true));  // hide names

  totalDiv.appendChild(totalCols);

  // breakdown section
  const breakdownDiv = document.createElement('div');
  breakdownDiv.className = 'breakdown';
  breakdownDiv.appendChild(Object.assign(document.createElement('h3'), {
    textContent: 'Breakdown'
  }));

  for (const [itemName, mats] of Object.entries(breakdown)) {
    // item title
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = `📦 ${itemName}`;
    breakdownDiv.appendChild(title);

    // split this item's breakdown
    const bBase    = {};
    const bCrafted = {};
    const bWater   = {};
    const bTime    = {};

    for (const [mat, amt] of Object.entries(mats)) {
      if (isTime(mat))      bTime[mat]    = amt;
      else if (isWater(mat)) bWater[mat]   = amt;
      else if (isCraftable(mat)) bCrafted[mat] = amt;
      else                   bBase[mat]    = amt;
    }

    const itemCols = document.createElement('div');
    itemCols.className = 'columns';

    itemCols.appendChild(makeCol('🧱', 'Non-Craftable',    bBase));
    itemCols.appendChild(makeCol('⚙️', 'Craftable',   bCrafted));
    itemCols.appendChild(makeCol('💧', 'Water in mL',   bWater, true)); // hide names
    itemCols.appendChild(makeCol('⏳', 'Time in seconds',    bTime,  true)); // hide names

    breakdownDiv.appendChild(itemCols);
  }

  container.appendChild(totalDiv);
  container.appendChild(breakdownDiv);
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    const root = document.documentElement;
    // load saved or default
    const current = localStorage.getItem('theme') || 'dark';
    console.log('Theme toggle script loaded, current theme:', current);
    root.classList.toggle('dark-mode', current === 'dark');
    btn.textContent = current === 'dark' ? 'Light Mode ☀️' : 'Dark Mode 🌙';

    btn.addEventListener('click', () => {
      const isDark = root.classList.toggle('dark-mode');
      btn.textContent = isDark ? 'Light Mode ☀️' : 'Dark Mode 🌙';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      console.log('Toggle clicked, isDark:', isDark);
    });
  });

fetchItems();

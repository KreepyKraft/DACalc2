let itemsList = [];

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

async function fetchItems() {
    if (typeof ITEM_DATA === 'undefined') {
        console.error("ITEM_DATA is not defined. Make sure item_data.js is loaded correctly.");
        return;
    }

    itemsList = Object.entries(ITEM_DATA)
        .filter(([_, data]) => data.ingredients && Object.keys(data.ingredients).length > 0)
        .map(([name, _]) => name);

    window.itemDetails = ITEM_DATA;

    addItem(); // add one item row by default
    renderFabricatorCheckboxes(); // render fabricator checkboxes on load
}

function addItem() {
    const container = document.getElementById('items-container');
    const div = document.createElement('div');
    div.className = 'item-row';

    const select = document.createElement('select');
    select.innerHTML = '<option value="">--Select an Item--</option>'; // Add a default option
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

function renderFabricatorCheckboxes() {
    const container = document.getElementById('fabricators-container');
    if (!container) {
        console.error("Fabricators container not found. Make sure an element with id 'fabricators-container' exists in your HTML.");
        return;
    }
    container.innerHTML = ''; // Clear previous checkboxes

    for (const category in fabricators) {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('fabricator-category');
        
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = category;
        categoryDiv.appendChild(categoryTitle);

        if (typeof fabricators[category] === 'object' && !Array.isArray(fabricators[category])) {
            // this is a sub-category for refineries
            for (const subCategory in fabricators[category]) {
                const subCategoryDiv = document.createElement('div');
                const subCategoryTitle = document.createElement('h4');
                subCategoryTitle.textContent = subCategory;
                subCategoryDiv.appendChild(subCategoryTitle);

                fabricators[category][subCategory].forEach(fab => {
                    const fabItemDiv = document.createElement('div');
                    fabItemDiv.classList.add('fabricator-item');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = fab.id;
                    checkbox.value = fab.id;
                    checkbox.name = "fabricator";
                    // option 1: To make all checkboxes selected by default, uncomment the line below:
                    // checkbox.checked = true; 
                    const label = document.createElement('label');
                    label.htmlFor = fab.id;
                    label.textContent = fab.name;
                    fabItemDiv.appendChild(checkbox);
                    fabItemDiv.appendChild(label);
                    subCategoryDiv.appendChild(fabItemDiv);
                });
                categoryDiv.appendChild(subCategoryDiv);
            }
        } else {
            // general or Specialty Fabricators (simple array)
            fabricators[category].forEach(fab => {
                const fabItemDiv = document.createElement('div');
                fabItemDiv.classList.add('fabricator-item');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = fab.id;
                checkbox.value = fab.id;
                checkbox.name = "fabricator";
                // option 1: To make all checkboxes selected by default, uncomment the line below:
                // checkbox.checked = true;
                const label = document.createElement('label');
                label.htmlFor = fab.id;
                label.textContent = fab.name;
                fabItemDiv.appendChild(checkbox);
                fabItemDiv.appendChild(label);
                categoryDiv.appendChild(fabItemDiv);
            });
        }
        container.appendChild(categoryDiv);
    }
}

function toggleAllFabricators(shouldBeChecked) {
    document.querySelectorAll('input[name="fabricator"]').forEach(checkbox => {
        checkbox.checked = shouldBeChecked;
    });
}


function getSelectedFabricators() {
    const selectedFabs = [];
    document.querySelectorAll('input[name="fabricator"]:checked').forEach(checkbox => {
        selectedFabs.push(checkbox.value);
    });
    return selectedFabs;
}

function calculate() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Clear previous results

    // get selected fabricators
    const selectedFabricators = getSelectedFabricators();
    if (selectedFabricators.length > 0) {
        const fabListDiv = document.createElement('div');
        fabListDiv.innerHTML = '<h3>Selected Fabricators/Refineries:</h3>';
        const ul = document.createElement('ul');
        selectedFabricators.forEach(fabId => {
            const readableName = fabId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            const li = document.createElement('li');
            li.textContent = readableName;
            ul.appendChild(li);
        });
        fabListDiv.appendChild(ul);
        resultsDiv.appendChild(fabListDiv);
    } else {
        const noFabMessage = document.createElement('p');
        noFabMessage.textContent = 'No fabricators or refineries selected. This calculator assumes you have the necessary fabricators to craft the items.';
        resultsDiv.appendChild(noFabMessage);
    }

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

            target[ingredient] = (target[ingredient] || 0) + total;
            totalMaterials[ingredient] = (totalMaterials[ingredient] || 0) + total;

            if (window.itemDetails[ingredient] && window.itemDetails[ingredient].ingredients) {
                trackBreakdown(ingredient, total, target);
            }
        }
    }

    selections.forEach(({ item, quantity }) => {
        if (item && quantity > 0) {
            breakdown[item] = {};
            trackBreakdown(item, quantity, breakdown[item]);
        }
    });

    renderResults(totalMaterials, breakdown);
}

function flattenIngredients(item, quantity) {
    const result = {};
    const data = window.itemDetails[item];
    if (!data || !data.ingredients) return result;

    for (const [ingredient, amt] of Object.entries(data.ingredients)) {
        const total = amt * quantity;
        if (window.itemDetails[ingredient] && window.itemDetails[ingredient].ingredients) {
            const subIngredients = flattenIngredients(ingredient, total);
            for (const [subMat, subAmt] of Object.entries(subIngredients)) {
                result[subMat] = (result[subMat] || 0) + subAmt;
            }
        } else {
            result[ingredient] = (result[ingredient] || 0) + total;
        }
    }
    return result;
}

function renderResults(total, breakdown) {
    const container = document.getElementById('results');

    const isCraftable = mat =>
        window.itemDetails[mat] &&
        window.itemDetails[mat].ingredients &&
        Object.keys(window.itemDetails[mat].ingredients).length > 0;

    const isWater = mat => mat === 'Water';
    const isTime = mat => mat === 'Time';

    const baseMaterials = {};
    const craftedMaterials = {};
    const waterMaterials = {};
    const timeMaterials = {};

    for (const [mat, amt] of Object.entries(total)) {
        if (isTime(mat)) timeMaterials[mat] = amt;
        else if (isWater(mat)) waterMaterials[mat] = amt;
        else if (isCraftable(mat)) craftedMaterials[mat] = amt;
        else baseMaterials[mat] = amt;
    }

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

    const totalDiv = document.createElement('div');
    totalDiv.className = 'material-list';
    totalDiv.appendChild(Object.assign(document.createElement('h3'), {
        textContent: 'Total Materials'
    }));

    const totalCols = document.createElement('div');
    totalCols.className = 'columns';
    totalCols.appendChild(makeCol('🧱', 'Non-Craftable', baseMaterials));
    totalCols.appendChild(makeCol('⚙️', 'Craftable', craftedMaterials));
    totalCols.appendChild(makeCol('💧', 'Water in mL', waterMaterials, true)); // hide names
    totalCols.appendChild(makeCol('⏳', 'Time in seconds', timeMaterials, true)); // hide names

    totalDiv.appendChild(totalCols);

    const breakdownDiv = document.createElement('div');
    breakdownDiv.className = 'breakdown';
    breakdownDiv.appendChild(Object.assign(document.createElement('h3'), {
        textContent: 'Breakdown'
    }));

    for (const [itemName, mats] of Object.entries(breakdown)) {
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = `📦 ${itemName}`;
        breakdownDiv.appendChild(title);

        const bBase = {};
        const bCrafted = {};
        const bWater = {};
        const bTime = {};

        for (const [mat, amt] of Object.entries(mats)) {
            if (isTime(mat)) bTime[mat] = amt;
            else if (isWater(mat)) bWater[mat] = amt;
            else if (isCraftable(mat)) bCrafted[mat] = amt;
            else bBase[mat] = amt;
        }

        const itemCols = document.createElement('div');
        itemCols.className = 'columns';

        itemCols.appendChild(makeCol('🧱', 'Non-Craftable', bBase));
        itemCols.appendChild(makeCol('⚙️', 'Craftable', bCrafted));
        itemCols.appendChild(makeCol('💧', 'Water in mL', bWater, true)); // hide names
        itemCols.appendChild(makeCol('⏳', 'Time in seconds', bTime, true)); // hide names

        breakdownDiv.appendChild(itemCols);
    }

    container.appendChild(totalDiv);
    container.appendChild(breakdownDiv);
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    const root = document.documentElement;
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

    fetchItems();
});

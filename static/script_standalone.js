let itemsList = [];


function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

async function fetchItems() {
    if (typeof ITEM_DATA === 'undefined') {
        console.error("ITEM_DATA is not defined. Make sure item_data.js is loaded correctly.");
        return;
    }

    itemsList = Object.keys(ITEM_DATA).filter(name => {
        const data = ITEM_DATA[name];
        return data.ingredients && Object.keys(data.ingredients).length > 0;
    });
    // Sort itemsList alphabetically for better usability in dropdown
    itemsList.sort();

    window.itemDetails = ITEM_DATA;

    addItem(); // Add one item row by default
    renderFabricatorCheckboxes(); // Render fabricator checkboxes on load
}

function addItem() {
    const container = document.getElementById('items-container');
    const itemRowDiv = document.createElement('div');
    itemRowDiv.classList.add('item-row');

    // --- Custom Searchable Dropdown Elements ---
    const customSelectWrapper = document.createElement('div');
    customSelectWrapper.classList.add('custom-select-wrapper');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.classList.add('custom-select-input');
    searchInput.placeholder = 'Search or select an item...';
    searchInput.setAttribute('autocomplete', 'off'); // Prevent browser autocomplete

    // Hidden input to store the actual selected value
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.classList.add('selected-item-value'); // Add a class to easily select it later

    const dropdownList = document.createElement('ul');
    dropdownList.classList.add('custom-select-dropdown');

    // Populate initial dropdown list
    function populateDropdown(filter = '') {
        dropdownList.innerHTML = ''; // Clear previous list
        const lowerFilter = filter.toLowerCase();

        // Create a "No selection" option
        const noSelectionOption = document.createElement('li');
        noSelectionOption.textContent = '--Select an Item--';
        noSelectionOption.dataset.value = ''; // Empty value for no selection
        dropdownList.appendChild(noSelectionOption);

        itemsList.forEach(item => {
            if (item.toLowerCase().includes(lowerFilter)) {
                const listItem = document.createElement('li');
                listItem.textContent = item;
                listItem.dataset.value = item; // Store the actual item value
                dropdownList.appendChild(listItem);
            }
        });
    }

    populateDropdown(); // Populate initially with all items

    // Event Listeners for the custom dropdown
    let blurTimeout; // To handle blur event delay

    searchInput.addEventListener('input', () => {
        const inputValue = searchInput.value;
        populateDropdown(inputValue);
        dropdownList.style.display = 'block'; // Show dropdown on input
        hiddenInput.value = ''; // Clear hidden input if typing or filtering
    });

    searchInput.addEventListener('focus', () => {
        clearTimeout(blurTimeout); // Clear any pending blur
        populateDropdown(searchInput.value); // Repopulate on focus to show current filter
        dropdownList.style.display = 'block';
    });

    searchInput.addEventListener('blur', () => {
        // Delay hiding to allow click event on list items to register
        blurTimeout = setTimeout(() => {
            dropdownList.style.display = 'none';
            // ONLY clear searchInput.value IF no valid selection was made
            // (i.e., hiddenInput.value is still empty)
            // If hiddenInput.value was set by a click, we should NOT clear searchInput.value
            if (hiddenInput.value === '') {
                searchInput.value = ''; // Clear display if nothing was selected
            }
        }, 150); // Small delay
    });

    dropdownList.addEventListener('mousedown', (event) => {
        // Prevent searchInput from losing focus immediately when clicking on dropdown list
        // This is crucial for allowing the click event on LI to fire before blur processes fully.
        event.preventDefault();
    });


    dropdownList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            const selectedValue = event.target.dataset.value;
            const selectedText = event.target.textContent;

            searchInput.value = selectedText; // Display selected text in input
            hiddenInput.value = selectedValue; // Store actual value
            dropdownList.style.display = 'none'; // Hide dropdown
            searchInput.focus(); // Re-focus the input after selection to clear the blur timeout
        }
    });

    // Append custom dropdown elements
    customSelectWrapper.appendChild(searchInput);
    customSelectWrapper.appendChild(hiddenInput);
    customSelectWrapper.appendChild(dropdownList);
    // --- End Custom Searchable Dropdown Elements ---

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.value = '1';

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.onclick = () => container.removeChild(itemRowDiv); // Remove the whole row

    itemRowDiv.appendChild(customSelectWrapper); // Add the custom dropdown wrapper
    itemRowDiv.appendChild(quantityInput);
    itemRowDiv.appendChild(removeButton);

    container.appendChild(itemRowDiv);
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

    // Get selected fabricators
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
    // IMPORTANT: Now we get the value from the hidden input, not a <select>
    document.querySelectorAll('#items-container .item-row').forEach(rowDiv => {
        const hiddenInput = rowDiv.querySelector('.selected-item-value');
        const quantityInput = rowDiv.querySelector('input[type="number"]');

        const itemId = hiddenInput ? hiddenInput.value : ''; // Get value from hidden input
        const quantity = parseInt(quantityInput.value, 10);

        if (itemId && !isNaN(quantity) && quantity > 0) {
            selections.push({
                item: itemId,
                quantity: quantity
            });
        }
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
        // Ensure the item exists in itemDetails before trying to process
        if (window.itemDetails[item]) {
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
    totalCols.appendChild(makeCol('💧', 'Water in mL', waterMaterials, true));
    totalCols.appendChild(makeCol('⏳', 'Time in seconds', timeMaterials, true));

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
        itemCols.appendChild(makeCol('💧', 'Water in mL', bWater, true));
        itemCols.appendChild(makeCol('⏳', 'Time in seconds', bTime, true));

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

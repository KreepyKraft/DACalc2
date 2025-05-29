// IGNORE :D
let itemsList = [];

async function fetchItems() {
  const res = await fetch('/api/items');
  itemsList = await res.json();
  addItem(); // Start with one row
}

function addItem() {
  const container = document.getElementById('items-container');

  const itemRow = document.createElement('div');
  itemRow.className = 'item-row';

  const select = document.createElement('select');
  for (const itemName in itemData) {
    const option = document.createElement('option');
    option.value = itemName;
    option.textContent = itemName;
    select.appendChild(option);
  }

  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.min = '1';
  quantityInput.value = '1';

  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove';
  removeButton.onclick = () => container.removeChild(itemRow);

  itemRow.appendChild(select);
  itemRow.appendChild(quantityInput);
  itemRow.appendChild(removeButton);

  container.appendChild(itemRow);
}

async function calculate() {
  const selections = [];
  document.querySelectorAll('#items-container .item-row').forEach(div => {
    const [select, input] = div.children;
    selections.push({
      item: select.value,
      quantity: Number(input.value)
    });
  });

  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: selections })
  });

  const data = await res.json();
  const container = document.getElementById('results');
  container.innerHTML = '';

  const totalDiv = document.createElement('div');
  totalDiv.className = 'material-list';
  totalDiv.innerHTML = '<h3>Total Materials</h3>';
  for (const [mat, amt] of Object.entries(data.total)) {
    const p = document.createElement('div');
    p.className = 'material-item';
    p.textContent = `• ${mat}:  ${amt}`;
    totalDiv.appendChild(p);
  }

  const breakdownDiv = document.createElement('div');
  breakdownDiv.className = 'breakdown';
  breakdownDiv.innerHTML = '<h3>Breakdown</h3>';
  for (const [item, mats] of Object.entries(data.breakdown)) {
    const itemTitle = document.createElement('div');
    itemTitle.className = 'item-title';
    itemTitle.textContent = item;
    breakdownDiv.appendChild(itemTitle);

    for (const [mat, amt] of Object.entries(mats)) {
      const p = document.createElement('div');
      p.className = 'breakdown-item';
      p.textContent = `  - ${mat}: ${amt}`;
      breakdownDiv.appendChild(p);
    }
  }

  container.appendChild(totalDiv);
  container.appendChild(breakdownDiv);
}

fetchItems();

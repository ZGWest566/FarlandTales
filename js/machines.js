var _mui = { key: null };

function initMachineState() {
  if (!gameState.machines) gameState.machines = {};
}

function getMachine(eqKey) {
  initMachineState();
  if (!gameState.machines[eqKey]) {
    gameState.machines[eqKey] = { contents: [], compostPoints: 0 };
  }
  return gameState.machines[eqKey];
}

// ====== 每日处理 ======
function processMachines() {
  initMachineState();
  var eqKeys = Object.keys(gameState.placedEquipment);
  for (var i = 0; i < eqKeys.length; i++) {
    var eq = gameState.placedEquipment[eqKeys[i]];
    if (!isMachine(eq.type)) continue;
    var m = gameState.machines[eqKeys[i]];
    if (!m) continue;

    if (eq.type === 'drying_rack') {
      for (var j = 0; j < m.contents.length; j++) {
        if (m.contents[j].daysRemaining > 0) m.contents[j].daysRemaining--;
      }
    }
  }
}

// ====== 打开/关闭 UI ======
function openMachineUI(eqKey) {
  initMachineState();
  _mui.key = eqKey;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq || !isMachine(eq.type)) return;
  document.getElementById('machine-title').textContent = RECIPES[eq.type].name;
  document.getElementById('modal-machine').classList.remove('hidden');
  renderMachineContent(eq, getMachine(eqKey));
}

function closeMachineUI() {
  document.getElementById('modal-machine').classList.add('hidden');
  _mui.key = null;
}

// ====== 配方机内容主渲染 ======
function renderMachineContent(eq, machine) {
  var html = '';
  switch (eq.type) {
    case 'drying_rack': html = renderDryingRack(machine); break;
    case 'stone_mill':  html = renderStoneMill(machine); break;
    case 'cooking_pot': html = renderCookingPot(machine); break;
    case 'compost_bin': html = renderCompostBin(machine); break;
  }
  document.getElementById('machine-body').innerHTML = html;
}

// ====== 风干仓 ======
function renderDryingRack(machine) {
  var rd = RECIPES.drying_rack;
  var h = '<p style="color:#a0c8e0; margin-bottom:8px;">点击空白槽位放入原材料</p>';
  h += '<div style="display:flex; flex-wrap:wrap; gap:6px; min-height:50px; padding:8px; background:#2a2218; border-radius:6px;">';
  for (var i = 0; i < rd.maxSlots; i++) {
    if (i < machine.contents.length) {
      var slot = machine.contents[i];
      var sd = ITEM_DEFS[slot.itemId];
      if (slot.daysRemaining <= 0) {
        h += '<div class="machine-slot ready" onclick="collectFromMachine(' + i + ')" title="点击取出成品">' + (sd ? sd.emoji : '📦') + '</div>';
      } else {
        h += '<div class="machine-slot working" title="风干中，剩余' + slot.daysRemaining + '天">' + (sd ? sd.emoji : '📦') + '<span class="slot-badge">' + slot.daysRemaining + 'd</span></div>';
      }
    } else {
      h += '<div class="machine-slot empty" onclick="openIngredientPicker()" title="放入原料">+</div>';
    }
  }
  h += '</div><div style="margin-top:10px;"><button class="btn" style="background:#5a8a3a;border-color:#7aaa4a;" onclick="collectAllFromMachine()">📦 取出全部成品</button></div>';
  return h;
}

// ====== 石磨 ======
function renderStoneMill(machine) {
  var rd = RECIPES.stone_mill;
  var recipe = rd.recipes[0];
  var h = '<p style="color:#a0c8e0; margin-bottom:8px;">点击空白槽位放入原材料</p>';
  h += '<div style="display:flex; flex-wrap:wrap; gap:6px; min-height:50px; padding:8px; background:#2a2218; border-radius:6px;">';
  for (var i = 0; i < rd.maxSlots; i++) {
    if (i < machine.contents.length) {
      var sd = ITEM_DEFS[machine.contents[i].itemId];
      h += '<div class="machine-slot filled" onclick="returnItemFromSlot(' + i + ')" title="退回仓库">' + (sd ? sd.emoji : '📦') + '</div>';
    } else {
      h += '<div class="machine-slot empty" onclick="openIngredientPicker()" title="放入原料">+</div>';
    }
  }
  h += '</div><div style="margin-top:10px; display:flex; gap:6px;">';
  h += '<button class="btn" onclick="clearMachineContents()">↩ 全部退回</button>';
  h += '<button class="btn primary" style="background:#d4882a;border-color:#f4c060;" onclick="grindMill()"';
  h += (machine.contents.length <= 0 || gameState.stamina.current < (recipe ? recipe.staminaCost : 5) ? ' disabled' : '');
  h += '>⚡ 研磨（-' + (recipe ? recipe.staminaCost : 5) + '体力）</button></div>';
  return h;
}

// ====== 原料选择器（风干仓/石磨共用） ======
function openIngredientPicker() {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var rd = RECIPES[eq.type];
  var machine = gameState.machines[eqKey];
  var emptySlots = rd.maxSlots - machine.contents.length;
  if (emptySlots <= 0) return;

  var validInputs = {};
  for (var r = 0; r < rd.recipes.length; r++) {
    validInputs[rd.recipes[r].input] = true;
  }

  var h = '<p style="color:#f4c060; margin-bottom:8px;">📦 从仓库选择原料（剩余空位：' + emptySlots + '）</p>';
  h += '<div style="padding:8px; background:#2a2218; border-radius:6px;">';
  var hasItems = false;
  var inputIds = Object.keys(validInputs);
  for (var i = 0; i < inputIds.length; i++) {
    var itemId = inputIds[i];
    var count = gameState.warehouse[itemId] || 0;
    if (count <= 0) continue;
    hasItems = true;
    var def = ITEM_DEFS[itemId];
    var maxFill = Math.min(count, emptySlots);
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #3a3228;">';
    h += '<span>' + (def ? def.emoji : '📦') + ' ' + (def ? def.name : itemId) + ' <small style="color:#a0a0a0;">×' + count + '</small></span>';
    h += '<div style="display:flex;gap:6px;">';
    h += '<button class="btn primary" onclick="addFromPicker(\'' + itemId + '\',' + maxFill + ')">填满(' + maxFill + ')</button>';
    h += '<button class="btn" onclick="addFromPicker(\'' + itemId + '\',1)">+1</button></div></div>';
  }
  if (!hasItems) h += '<p style="color:#806040; text-align:center; padding:16px;">仓库中没有可用原料</p>';
  h += '</div><button class="btn" style="margin-top:8px;" onclick="backToMachine()">↩ 返回</button>';
  document.getElementById('machine-body').innerHTML = h;
}

function addFromPicker(itemId, count) {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var machine = gameState.machines[eqKey];
  var rd = RECIPES[eq.type];
  var available = gameState.warehouse[itemId] || 0;
  var emptySlots = rd.maxSlots - machine.contents.length;
  var toAdd = Math.min(count, available, emptySlots);
  if (toAdd <= 0) return;
  removeFromWarehouse(itemId, toAdd);
  for (var i = 0; i < toAdd; i++) {
    machine.contents.push({ itemId: itemId, daysRemaining: (eq.type === 'drying_rack' ? 1 : 0) });
  }
  saveGame(); updateAllUI();
  notify('已放入 ' + toAdd + ' 个' + (ITEM_DEFS[itemId] ? ITEM_DEFS[itemId].name : itemId));
  backToMachine();
}

function backToMachine() {
  var eq = gameState.placedEquipment[_mui.key];
  if (eq) renderMachineContent(eq, gameState.machines[_mui.key]);
}

function returnItemFromSlot(slotIndex) {
  var eqKey = _mui.key;
  var machine = gameState.machines[eqKey];
  if (slotIndex < 0 || slotIndex >= machine.contents.length) return;
  var item = machine.contents[slotIndex];
  addToWarehouse(item.itemId, 1);
  machine.contents.splice(slotIndex, 1);
  saveGame(); updateAllUI();
  renderMachineContent(gameState.placedEquipment[eqKey], machine);
  notify('已退回 ' + (ITEM_DEFS[item.itemId] ? ITEM_DEFS[item.itemId].name : item.itemId));
}

// ====== 厨锅 ======
function renderCookingPot(machine) {
  var rd = RECIPES.cooking_pot;
  var h = '<p style="color:#a0c8e0; margin-bottom:8px;">选择配方直接烹饪，可一键烹饪全部</p>';
  h += '<div style="padding:8px; background:#2a2218; border-radius:6px;">';
  var totalBatches = 0;
  for (var r = 0; r < rd.recipes.length; r++) {
    var recipe = rd.recipes[r];
    var inputDef = ITEM_DEFS[recipe.input];
    var outputDef = ITEM_DEFS[recipe.output];
    var own = gameState.warehouse[recipe.input] || 0;
    var batches = Math.floor(own / recipe.inputCount);
    totalBatches += batches;
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid #3a3228;">';
    h += '<span>' + (inputDef ? inputDef.emoji : '?') + ' ' + (inputDef ? inputDef.name : recipe.input) + ' ×' + recipe.inputCount;
    h += ' → ' + (outputDef ? outputDef.emoji : '?') + ' ' + (outputDef ? outputDef.name : recipe.output);
    h += ' <span style="color:#e8c040;">¥' + (outputDef ? outputDef.sellPrice : 0) + '</span>';
    h += ' <small style="color:#a0a0a0;">(可做' + batches + '次)</small></span>';
    h += '<button class="btn primary" onclick="cookRecipe(' + r + ')"' + (own < recipe.inputCount ? ' disabled' : '') + '>🍳 烹饪×1</button></div>';
  }
  h += '</div>';
  h += '<div style="margin-top:10px; display:flex; gap:6px;">';
  h += '<button class="btn primary" style="background:#d4882a;border-color:#f4c060;font-size:14px;" onclick="cookAllRecipes()"' + (totalBatches <= 0 ? ' disabled' : '') + '>🔥 全部烹饪（' + totalBatches + '次）</button></div>';
  return h;
}

function cookRecipe(idx) {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var recipe = RECIPES.cooking_pot.recipes[idx];
  if (!recipe) return;
  if ((gameState.warehouse[recipe.input] || 0) < recipe.inputCount) { notify('材料不足！'); return; }
  if (!canAddToWarehouse(recipe.outputCount)) { notify('仓库已满！'); return; }
  removeFromWarehouse(recipe.input, recipe.inputCount);
  addToWarehouse(recipe.output, recipe.outputCount);
  saveGame(); updateAllUI();
  var od = ITEM_DEFS[recipe.output];
  notify('烹饪完成！获得 ' + (od ? od.emoji + ' ' + od.name : recipe.output));
  renderMachineContent(eq, gameState.machines[eqKey]);
}

function cookAllRecipes() {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var rd = RECIPES.cooking_pot;
  var results = [];
  for (var r = 0; r < rd.recipes.length; r++) {
    var recipe = rd.recipes[r];
    var own = gameState.warehouse[recipe.input] || 0;
    var batches = Math.floor(own / recipe.inputCount);
    if (batches <= 0) continue;
    var totalOutput = batches * recipe.outputCount;
    if (!canAddToWarehouse(totalOutput)) { notify('仓库空间不足！'); return; }
    removeFromWarehouse(recipe.input, batches * recipe.inputCount);
    for (var b = 0; b < totalOutput; b++) addToWarehouse(recipe.output, 1);
    var od = ITEM_DEFS[recipe.output];
    results.push((od ? od.emoji + ' ' + od.name : recipe.output) + ' ×' + totalOutput);
  }
  if (results.length <= 0) { notify('没有可烹饪的原料！'); return; }
  saveGame(); updateAllUI();
  renderMachineContent(eq, gameState.machines[eqKey]);
  notify('全部烹饪完成！获得 ' + results.join('、'));
}

// ====== 堆肥桶 ======
function renderCompostBin(machine) {
  var rd = RECIPES.compost_bin;
  var points = machine.compostPoints || 0;
  var target = rd.targetPoints;
  var pct = Math.min(100, Math.round((points / target) * 100));
  var h = '<p style="color:#a0c8e0; margin-bottom:8px;">投入种子(+1点)，满' + target + '点产出' + rd.outputCount + '份肥料</p>';
  h += '<div style="margin-bottom:8px;"><div style="background:#2a2218; border-radius:8px; height:24px; overflow:hidden;">';
  h += '<div style="background:linear-gradient(90deg,#5a8a3a,#8aaa4a); height:100%; width:' + pct + '%;"></div></div>';
  h += '<div style="text-align:center; font-size:12px; color:#c4b89a; margin-top:2px;">' + points + '/' + target + ' 点</div></div>';
  h += '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
  h += '<button class="btn primary" onclick="openCompostPicker()">📦 选择原料投入</button>';
  if (points >= target) h += '<button class="btn primary" style="background:#6b8a3a;border-color:#8aaa4a;" onclick="collectCompost()">🪴 收取肥料</button>';
  h += '</div>';
  return h;
}

function openCompostPicker() {
  var rd = RECIPES.compost_bin;
  var h = '<p style="color:#f4c060; margin-bottom:8px;">📦 从仓库选择原料投入堆肥桶</p>';
  h += '<div style="padding:8px; background:#2a2218; border-radius:6px;">';
  var hasItems = false;
  var seedIds = Object.keys(CROP_DEFS);
  for (var i = 0; i < seedIds.length; i++) {
    var seedKey = 'seed_' + seedIds[i];
    var count = gameState.warehouse[seedKey] || 0;
    if (count <= 0) continue;
    hasItems = true;
    var def = ITEM_DEFS[seedKey];
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #3a3228;">';
    h += '<span>' + (def ? def.emoji : '🌱') + ' ' + (def ? def.name : seedKey) + ' <small style="color:#a0a0a0;">×' + count + '</small> <span style="color:#5a8a3a;">(+1点)</span></span>';
    h += '<button class="btn" onclick="addCompostItem(\'' + seedKey + '\')">投入</button></div>';
  }
  if (!hasItems) h += '<p style="color:#806040; text-align:center; padding:16px;">仓库中没有可投入的原料</p>';
  h += '</div><button class="btn" style="margin-top:8px;" onclick="backToMachine()">↩ 返回</button>';
  document.getElementById('machine-body').innerHTML = h;
}

function addCompostItem(itemId) {
  var eqKey = _mui.key;
  var machine = gameState.machines[eqKey];
  var rd = RECIPES.compost_bin;
  if (!gameState.warehouse[itemId] || gameState.warehouse[itemId] <= 0) return;
  removeFromWarehouse(itemId, 1);
  machine.compostPoints = Math.min((machine.compostPoints || 0) + COMPOST_SEED_VALUE, rd.targetPoints);
  if (machine.compostPoints >= rd.targetPoints) notify('堆肥完成！可以收取肥料了');
  saveGame(); updateAllUI();
  renderMachineContent(gameState.placedEquipment[eqKey], machine);
  notify('投入 ' + (ITEM_DEFS[itemId] ? ITEM_DEFS[itemId].name : itemId) + ' +' + COMPOST_SEED_VALUE + '点');
}

// ====== 共享操作 ======
function clearMachineContents() {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var machine = gameState.machines[eqKey];
  for (var i = 0; i < machine.contents.length; i++) addToWarehouse(machine.contents[i].itemId, 1);
  machine.contents = [];
  saveGame(); updateAllUI();
  renderMachineContent(eq, machine);
  notify('已退回全部材料');
}

function collectFromMachine(slotIndex) {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var machine = gameState.machines[eqKey];
  if (slotIndex < 0 || slotIndex >= machine.contents.length) return;
  var slot = machine.contents[slotIndex];
  if (slot.daysRemaining > 0) return;
  var recipe = RECIPES[eq.type].recipes[0];
  if (!recipe) return;
  if (!canAddToWarehouse(recipe.outputCount)) { notify('仓库已满！'); return; }
  addToWarehouse(recipe.output, recipe.outputCount);
  machine.contents.splice(slotIndex, 1);
  saveGame(); updateAllUI();
  renderMachineContent(eq, machine);
  var od = ITEM_DEFS[recipe.output];
  notify('获得 ' + (od ? od.emoji + ' ' + od.name : recipe.output));
}

function collectAllFromMachine() {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var machine = gameState.machines[eqKey];
  var recipe = RECIPES[eq.type].recipes[0];
  if (!recipe) return;
  var collected = 0;
  for (var i = machine.contents.length - 1; i >= 0; i--) {
    if (machine.contents[i].daysRemaining <= 0) {
      if (!canAddToWarehouse(recipe.outputCount)) break;
      addToWarehouse(recipe.output, recipe.outputCount);
      machine.contents.splice(i, 1);
      collected++;
    }
  }
  if (collected > 0) {
    saveGame(); updateAllUI();
    renderMachineContent(eq, machine);
    var od = ITEM_DEFS[recipe.output];
    notify('获得 ' + collected + ' 个' + (od ? od.name : recipe.output));
  } else {
    notify('没有可收取的成品');
  }
}

function grindMill() {
  var eqKey = _mui.key;
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var machine = gameState.machines[eqKey];
  if (machine.contents.length <= 0) return;
  var recipe = RECIPES[eq.type].recipes[0];
  var cost = recipe ? recipe.staminaCost : 5;
  if (!consumeStamina(cost)) { notify('体力不足！需要' + cost + '点体力'); return; }
  var count = machine.contents.length;
  if (!canAddToWarehouse(count)) { gameState.stamina.current += cost; notify('仓库空间不足！'); return; }
  for (var i = 0; i < count; i++) addToWarehouse(recipe.output, recipe.outputCount);
  machine.contents = [];
  saveGame(); updateAllUI();
  renderMachineContent(eq, machine);
  var od = ITEM_DEFS[recipe.output];
  notify('研磨完成！获得 ' + count + ' 个' + (od ? od.name : recipe.output));
}

function collectCompost() {
  var eqKey = _mui.key;
  var machine = gameState.machines[eqKey];
  var eq = gameState.placedEquipment[eqKey];
  if (!eq) return;
  var rd = RECIPES.compost_bin;
  if ((machine.compostPoints || 0) < rd.targetPoints) { notify('堆肥还不够！'); return; }
  if (!canAddToWarehouse(rd.outputCount)) { notify('仓库已满！'); return; }
  for (var i = 0; i < rd.outputCount; i++) addToWarehouse(rd.output, 1);
  machine.compostPoints = 0;
  saveGame(); updateAllUI();
  renderMachineContent(eq, machine);
  var od = ITEM_DEFS[rd.output];
  notify('获得 ' + rd.outputCount + ' 份' + (od ? od.name : rd.output));
}
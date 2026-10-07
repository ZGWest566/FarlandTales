const TILE_SIZE = 48;
const COLS = 16;
const INITIAL_ROWS = 30;
const MAX_STAMINA = 100;
const DAYS_PER_SEASON = 28;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_NAMES = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const INITIAL_WAREHOUSE_CAPACITY = 20;

let gameState = {
  time: { day: 1, season: 'spring', year: 1 },
  stamina: { current: MAX_STAMINA, max: MAX_STAMINA },
  gold: 500,
  currentTool: 'hoe',
  heldItemId: null,
  tiles: [],
  warehouse: {},
  shippingBox: {},
  placedEquipment: {},
  machines: {},
  nextDayNotifications: [],
  saveVersion: 1,
};

function getWarehouseCapacity() {
  return INITIAL_WAREHOUSE_CAPACITY + Equipment.getSiloCount(gameState.placedEquipment) * SILO_CONFIG.capacityIncrease;
}

function initTiles() {
  gameState.tiles = [];
  for (var row = 0; row < INITIAL_ROWS; row++) {
    gameState.tiles[row] = [];
    for (var col = 0; col < COLS; col++) {
      gameState.tiles[row][col] = {
        state: 'unplowed',
        crop: null,
        watered: false,
        equipmentKey: null,
      };
    }
  }
}

function getWarehouseUsed() {
  var total = 0;
  var keys = Object.keys(gameState.warehouse);
  for (var i = 0; i < keys.length; i++) {
    total += gameState.warehouse[keys[i]];
  }
  return total;
}

function canAddToWarehouse(count) {
  return getWarehouseUsed() + count <= getWarehouseCapacity();
}

function addToWarehouse(itemId, count) {
  if (!canAddToWarehouse(count)) return false;
  gameState.warehouse[itemId] = (gameState.warehouse[itemId] || 0) + count;
  return true;
}

function removeFromWarehouse(itemId, count) {
  if (!gameState.warehouse[itemId] || gameState.warehouse[itemId] < count) return false;
  gameState.warehouse[itemId] -= count;
  if (gameState.warehouse[itemId] <= 0) delete gameState.warehouse[itemId];
  return true;
}

function addToShipping(itemId, count) {
  gameState.shippingBox[itemId] = (gameState.shippingBox[itemId] || 0) + count;
}

function consumeStamina(amount) {
  if (gameState.stamina.current < amount) return false;
  gameState.stamina.current -= amount;
  return true;
}

function notify(msg) {
  var el = document.getElementById('notification');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'fadeInOut 2s ease';
  setTimeout(function () { el.style.display = 'none'; }, 2000);
}

function saveGame() {
  localStorage.setItem('farland_tales_save', JSON.stringify(gameState));
}

function loadGame() {
  var data = localStorage.getItem('farland_tales_save');
  if (data) {
    try {
      var parsed = JSON.parse(data);
      gameState = parsed;
      migrateOldSave();
      return true;
    } catch (e) { /* ignore */ }
  }
  return false;
}

function migrateOldSave() {
  if (gameState.saveVersion >= 1) return;
  if (!gameState.placedEquipment) {
    gameState.placedEquipment = {};
    if (gameState.tiles) {
      for (var r = 0; r < gameState.tiles.length; r++) {
        for (var c = 0; c < COLS; c++) {
          var t = gameState.tiles[r][c];
          if (t && t.hasSprinkler) {
            var key = r + ',' + c;
            gameState.placedEquipment[key] = { type: 'sprinkler', row: r, col: c };
            t.equipmentKey = key;
          } else if (t && t.equipmentKey === undefined) {
            t.equipmentKey = null;
          }
          delete t.hasSprinkler;
        }
      }
    }
    gameState.warehouseCapacity = undefined;
    delete gameState.silosOwned;
  }
  if (!gameState.machines) {
    gameState.machines = {};
  }
  var newWarehouse = {};
  var keys = Object.keys(gameState.warehouse);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.indexOf('seed_') !== 0 && CROP_DEFS[key]) {
      newWarehouse['seed_' + key] = gameState.warehouse[key];
    } else {
      newWarehouse[key] = gameState.warehouse[key];
    }
  }
  gameState.warehouse = newWarehouse;
  gameState.saveVersion = 1;
}

function exportSave() {
  var data = JSON.stringify(gameState, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'farland_tales_save_' + gameState.time.year + '_' + SEASON_NAMES[gameState.time.season] + '_' + gameState.time.day + '.json';
  a.click();
  URL.revokeObjectURL(url);
  notify('存档已导出！');
}

function importSave(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var parsed = JSON.parse(e.target.result);
      if (parsed.time && parsed.stamina && parsed.tiles) {
        gameState = parsed;
        migrateOldSave();
        saveGame();
        updateAllUI();
        notify('存档已导入！');
      } else {
        notify('存档格式无效！');
      }
    } catch (ex) {
      notify('存档格式错误！');
    }
  };
  reader.readAsText(file);
}

function processShipping() {
  var totalEarnings = 0;
  var itemIds = Object.keys(gameState.shippingBox);
  for (var i = 0; i < itemIds.length; i++) {
    var itemId = itemIds[i];
    var count = gameState.shippingBox[itemId];
    var def = ITEM_DEFS[itemId] || FISH_DEFS[itemId];
    if (def && def.canSell) {
      totalEarnings += def.sellPrice * count;
    }
  }
  gameState.gold += totalEarnings;
  gameState.shippingBox = {};
  if (totalEarnings > 0) {
    gameState.nextDayNotifications.push('📤 出货完成！获得 ' + totalEarnings + ' 金币 💰');
  }
}

function handleSeasonChange(newSeason) {
  gameState.nextDayNotifications.push('🍂 ' + SEASON_NAMES[newSeason] + '季到来！');

  var rows = gameState.tiles.length;
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < COLS; col++) {
      var tile = gameState.tiles[row][col];
      var hasCrop = (tile.state === 'planted' || tile.state === 'mature') && tile.crop;
      if (hasCrop && tile.crop.season !== newSeason) {
        tile.state = 'plowed';
        tile.crop = null;
        tile.watered = false;
      }
    }
  }
}

function nextDay() {
  var used = getWarehouseUsed();
  var cap = getWarehouseCapacity();
  if (used > cap) {
    notify('⚠️ 仓库已超容量（' + used + '/' + cap + '）！请放置筒仓扩容后再进入下一天。');
    return;
  }
  var time = gameState.time;
  time.day++;
  if (time.day > DAYS_PER_SEASON) {
    time.day = 1;
    var seasonIdx = SEASONS.indexOf(time.season);
    if (seasonIdx < 3) {
      time.season = SEASONS[seasonIdx + 1];
    } else {
      time.season = 'spring';
      time.year++;
    }
    handleSeasonChange(time.season);
  }

  Equipment.processAll(gameState.tiles, COLS, gameState.placedEquipment);
  processMachines();

  var rows = gameState.tiles.length;
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < COLS; col++) {
      var tile = gameState.tiles[row][col];

      if (tile.state === 'watered' && !tile._sprinklerWatered) {
        tile.watered = false;
        tile.state = 'plowed';
      }
      delete tile._sprinklerWatered;

      if (tile.state === 'planted' && tile.crop) {
        if (tile.watered) {
          tile.crop.daysGrown++;
          if (tile.crop.daysGrown >= tile.crop.daysToMature) {
            tile.state = 'mature';
          }
        }
        tile.watered = false;
      }
    }
  }

  gameState.stamina.current = gameState.stamina.max;

  processShipping();

  saveGame();
  updateAllUI();
  notify('⏩ 进入 ' + SEASON_NAMES[time.season] + ' 第' + time.day + '天 · 第' + time.year + '年 · 体力已恢复！');

  if (gameState.nextDayNotifications.length > 0) {
    var msgs = gameState.nextDayNotifications;
    gameState.nextDayNotifications = [];
    msgs.forEach(function (m) {
      setTimeout(function () { notify(m); }, 100);
    });
  }
}

function useTool(row, col) {
  var tile = gameState.tiles[row][col];
  var tool = gameState.currentTool;

  switch (tool) {
    case 'hoe':
      if (tile.state === 'unplowed' && !tile.equipmentKey) {
        if (!consumeStamina(2)) { notify('体力不足！'); return; }
        tile.state = 'plowed';
        tile.crop = null;
        tile.watered = false;
      } else if (tile.equipmentKey) {
        notify('此地块有设备，无法开垦！请先拆除设备。');
      }
      break;

    case 'watercan':
      if (tile.state === 'plowed' || tile.state === 'planted') {
        if (!tile.watered) {
          if (!consumeStamina(1)) { notify('体力不足！'); return; }
          tile.watered = true;
          if (tile.state === 'plowed') tile.state = 'watered';
        }
      }
      break;

    case 'sickle':
      if (tile.state === 'mature' && tile.crop) {
        if (!consumeStamina(3)) { notify('体力不足！'); return; }
        var cropId = tile.crop.type;
        var cropDef = CROP_DEFS[cropId];
        var itemDef = ITEM_DEFS[cropId];
        var yieldCount = Math.floor(Math.random() * (cropDef.yieldMax - cropDef.yieldMin + 1)) + cropDef.yieldMin;
        if (!canAddToWarehouse(yieldCount)) {
          notify('仓库已满！请扩容或出货。');
          return;
        }
        addToWarehouse(cropId, yieldCount);
        tile.state = 'plowed';
        tile.crop = null;
        tile.watered = false;
        var msg = '收获 ' + (itemDef ? itemDef.emoji : '📦') + ' ' + (itemDef ? itemDef.name : cropId) + ' ×' + yieldCount;
        if (cropDef.yieldMax > 1) msg += ' (' + cropDef.yieldMin + '~' + cropDef.yieldMax + '个)';
        notify(msg);
      }
      break;

    case 'pickaxe':
      if (tile.state !== 'unplowed' || tile.equipmentKey) {
        if (!consumeStamina(1)) { notify('体力不足！'); return; }
        if (tile.equipmentKey) {
          Equipment.remove(row, col, gameState.warehouse, gameState.tiles, gameState.placedEquipment);
        }
        tile.state = 'unplowed';
        tile.crop = null;
        tile.watered = false;
      }
      break;
  }

  saveGame();
  updateAllUI();
}

function plantSeed(row, col, seedType) {
  var tile = gameState.tiles[row][col];
  if (tile.state !== 'plowed' && tile.state !== 'watered') {
    notify('请先开垦此地块！');
    return false;
  }
  var def = CROP_DEFS[seedType];
  if (!def) return false;
  if (def.season !== gameState.time.season) {
    notify(def.name + '只能在' + SEASON_NAMES[def.season] + '季种植！');
    return false;
  }

  if (!removeFromWarehouse('seed_' + seedType, 1)) {
    notify('种子库存不足！');
    return false;
  }
  if (!consumeStamina(1)) { notify('体力不足！'); return false; }

  var wasWatered = (tile.state === 'watered');
  tile.state = 'planted';
  tile.crop = {
    type: seedType,
    daysGrown: 0,
    daysToMature: def.days,
    season: def.season,
  };
  tile.watered = wasWatered;
  saveGame();
  updateAllUI();
  var itemDef = ITEM_DEFS[seedType] || CROP_DEFS[seedType];
  notify('播种 ' + (itemDef ? itemDef.emoji : '🌱') + ' ' + (itemDef ? itemDef.name : seedType) + (tile.watered ? '' : '（未浇水）'));
  return true;
}

function buyItem(itemId, count, price) {
  if (gameState.gold < price) { notify('金币不足！'); return; }
  var def = ITEM_DEFS[itemId];
  if (!def) return;
  if (!canAddToWarehouse(1)) { notify('仓库已满！'); return; }
  gameState.gold -= price;
  addToWarehouse(itemId, 1);
  notify('购买 ' + def.emoji + ' ' + def.name + ' ×1');

  saveGame();
  updateAllUI();
  renderShop();
}

function moveToShipping(itemId) {
  var def = ITEM_DEFS[itemId];
  if (!def || !def.canSell) {
    notify('此物品不能出货！');
    return;
  }
  if (!gameState.warehouse[itemId] || gameState.warehouse[itemId] <= 0) return;
  removeFromWarehouse(itemId, 1);
  addToShipping(itemId, 1);
  saveGame();
  updateAllUI();
  if (itemId === gameState.heldItemId && !gameState.warehouse[itemId]) {
    gameState.heldItemId = null;
  }
  if (!document.getElementById('modal-warehouse').classList.contains('hidden')) {
    renderWarehouse();
  }
  notify('已放入出货箱');
}

function shipAllItem(itemId) {
  var count = gameState.warehouse[itemId];
  if (!count || count <= 0) return;
  delete gameState.warehouse[itemId];
  addToShipping(itemId, count);
  if (itemId === gameState.heldItemId || ('seed_' + itemId) === gameState.heldItemId) {
    gameState.heldItemId = null;
  }
  saveGame();
  updateAllUI();
  renderWarehouse();
  var def = ITEM_DEFS[itemId];
  var name = def ? def.name : itemId;
  notify(name + ' ×' + count + ' 已全部放入出货箱');
}

function destroyItem(itemId) {
  if (!gameState.warehouse[itemId] || gameState.warehouse[itemId] <= 0) return;
  removeFromWarehouse(itemId, 1);
  if (itemId === gameState.heldItemId && !gameState.warehouse[itemId]) {
    gameState.heldItemId = null;
  }
  saveGame();
  updateAllUI();
  renderWarehouse();
  var def = ITEM_DEFS[itemId];
  var name = def ? def.name : itemId;
  notify('已销毁 1 个 ' + name);
}

function removeFromShipping(itemId) {
  if (!gameState.shippingBox[itemId]) return;
  gameState.shippingBox[itemId]--;
  if (gameState.shippingBox[itemId] <= 0) delete gameState.shippingBox[itemId];
  if (!canAddToWarehouse(1)) {
    gameState.shippingBox[itemId] = (gameState.shippingBox[itemId] || 0) + 1;
    notify('仓库已满，无法退回！');
    return;
  }
  addToWarehouse(itemId, 1);
  saveGame();
  updateAllUI();
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');
const tooltip = document.getElementById('tooltip');

let hoveredTile = null;
let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener('mousemove', function (e) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

function updateCanvasSize() {
  canvas.width = COLS * TILE_SIZE;
  canvas.height = gameState.tiles.length * TILE_SIZE;
}

function getTileAtPos(mx, my) {
  var rect = canvas.getBoundingClientRect();
  var x = mx - rect.left;
  var y = my - rect.top;
  var col = Math.floor(x / TILE_SIZE);
  var row = Math.floor(y / TILE_SIZE);
  if (col >= 0 && col < COLS && row >= 0 && row < gameState.tiles.length) {
    return { row: row, col: col };
  }
  return null;
}

function render() {
  var rows = gameState.tiles.length;
  updateCanvasSize();

  var scrollTop = wrapper.scrollTop;
  var viewHeight = wrapper.clientHeight;
  var startRow = Math.max(0, Math.floor(scrollTop / TILE_SIZE) - 1);
  var endRow = Math.min(rows, Math.ceil((scrollTop + viewHeight) / TILE_SIZE) + 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < COLS; col++) {
      if (row < startRow || row > endRow) continue;

      var x = col * TILE_SIZE;
      var y = row * TILE_SIZE;
      var tile = gameState.tiles[row][col];
      var fillColor, borderColor;

      switch (tile.state) {
        case 'unplowed':
        if (tile.equipmentKey) {
          var eq = gameState.placedEquipment[tile.equipmentKey];
          fillColor = '#8a5a20';
        } else {
          fillColor = '#2a2218';
        }
        break;
        case 'plowed':   fillColor = '#5a3e28'; break;
        case 'watered':  fillColor = '#4a6e58'; break;
        case 'planted':  fillColor = tile.watered ? '#6a8e48' : '#5a6e38'; break;
        case 'mature':   fillColor = '#50a040'; break;
        default:         fillColor = '#2a2218';
      }

      var isMultiEq = false;
      if (tile.equipmentKey) {
        var tileEq = gameState.placedEquipment[tile.equipmentKey];
        var tileEqDef = tileEq ? ITEM_DEFS[tileEq.type] : null;
        isMultiEq = !!(tileEqDef && tileEqDef.size > 1);
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

      if (tile.state === 'unplowed' && !tile.equipmentKey) {
        ctx.fillStyle = '#221c14';
        ctx.fillRect(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2 - 2, 4, 4);
      }

      if (tile.watered && (tile.state === 'planted' || tile.state === 'plowed' || tile.state === 'watered')) {
        ctx.fillStyle = 'rgba(100,180,255,0.3)';
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }

      if (!isMultiEq) {
        ctx.strokeStyle = '#1a1410';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }

      if (!isMultiEq && (tile.state === 'planted' || tile.state === 'mature') && tile.crop) {
        var cropDef = CROP_DEFS[tile.crop.type];
        var itemDef = ITEM_DEFS[tile.crop.type];
        var emoji = itemDef ? itemDef.emoji : (cropDef ? '🌱' : '🌱');
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emoji, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 7);

        if (tile.state === 'planted') {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(tile.crop.daysGrown + '/' + tile.crop.daysToMature + 'd', x + TILE_SIZE / 2, y + TILE_SIZE - 6);
        }
      }

      if (hoveredTile && hoveredTile.row === row && hoveredTile.col === col) {
        ctx.strokeStyle = '#f4c060';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }
  }

  var eqKeys = Object.keys(gameState.placedEquipment);
  for (var ei = 0; ei < eqKeys.length; ei++) {
    var eq = gameState.placedEquipment[eqKeys[ei]];
    var eqDef = ITEM_DEFS[eq.type];
    var eqSize = eqDef ? eqDef.size : 1;
    var ex = eq.col * TILE_SIZE;
    var ey = eq.row * TILE_SIZE;
    var ew = eqSize * TILE_SIZE;
    var eh = eqSize * TILE_SIZE;

    if (eqSize > 1) {
      ctx.fillStyle = '#8a5a20';
      ctx.fillRect(ex + 1, ey + 1, ew - 2, eh - 2);
    }

    ctx.strokeStyle = '#ff8820';
    ctx.lineWidth = 3;
    ctx.beginPath();
    var r = 6;
    ctx.moveTo(ex + r + 1, ey + 1);
    ctx.lineTo(ex + ew - r - 1, ey + 1);
    ctx.arcTo(ex + ew - 1, ey + 1, ex + ew - 1, ey + r + 1, r);
    ctx.lineTo(ex + ew - 1, ey + eh - r - 1);
    ctx.arcTo(ex + ew - 1, ey + eh - 1, ex + ew - r - 1, ey + eh - 1, r);
    ctx.lineTo(ex + r + 1, ey + eh - 1);
    ctx.arcTo(ex + 1, ey + eh - 1, ex + 1, ey + eh - r - 1, r);
    ctx.lineTo(ex + 1, ey + r + 1);
    ctx.arcTo(ex + 1, ey + 1, ex + r + 1, ey + 1, r);
    ctx.stroke();

    ctx.font = (eqSize === 1 ? '16px' : '28px') + ' sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(eqDef ? eqDef.emoji : '🔧', ex + ew / 2, ey + eh / 2 + (eqSize === 1 ? 0 : 8));
  }

  drawPlacementPreview(ctx, COLS);
}

function drawPlacementPreview(ctx, cols) {
  if (!gameState.heldItemId) return;
  var heldDef = ITEM_DEFS[gameState.heldItemId];
  if (!heldDef || heldDef.type !== 'equip') return;

  var tile = hoveredTile || getTileAtPos(lastMouseX, lastMouseY);
  if (!tile) return;

  var size = heldDef.size || 1;
  var canPlace = Equipment.canPlace(gameState.heldItemId, tile.row, tile.col, gameState.tiles, cols);

  ctx.fillStyle = canPlace ? 'rgba(0,200,0,0.35)' : 'rgba(220,0,0,0.35)';
  ctx.fillRect(tile.col * TILE_SIZE, tile.row * TILE_SIZE, size * TILE_SIZE, size * TILE_SIZE);

  ctx.strokeStyle = canPlace ? 'rgba(0,220,0,0.85)' : 'rgba(240,30,30,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(tile.col * TILE_SIZE + 1, tile.row * TILE_SIZE + 1, size * TILE_SIZE - 2, size * TILE_SIZE - 2);
}

function updateTooltip(e) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  var tile = getTileAtPos(e.clientX, e.clientY);
  if (!tile) {
    tooltip.classList.add('hidden');
    hoveredTile = null;
    render();
    return;
  }

  hoveredTile = tile;
  var t = gameState.tiles[tile.row][tile.col];
  var stateNames = { unplowed: '未开垦', plowed: '已开垦', watered: '已浇水', planted: '已播种', mature: '成熟可收割' };
  var desc = '[' + tile.row + ',' + tile.col + '] ' + stateNames[t.state];
  if (t.equipmentKey) {
    var eq = gameState.placedEquipment[t.equipmentKey];
    var eqDef = eq ? ITEM_DEFS[eq.type] : null;
    desc += ' | ' + (eqDef ? eqDef.name : '设备');
  }
  if (t.state === 'planted') {
    desc += t.watered ? ' | 已浇水' : ' | 未浇水';
  }
  if (t.watered && t.state === 'plowed') desc += ' | 已浇水';
  if ((t.state === 'planted' || t.state === 'mature') && t.crop) {
    var def = CROP_DEFS[t.crop.type];
    desc += ' | ' + (def ? def.name : t.crop.type);
    if (t.state === 'planted') desc += ' (' + t.crop.daysGrown + '/' + t.crop.daysToMature + '天)';
    else desc += ' ✅';
  }

  tooltip.textContent = desc;
  tooltip.classList.remove('hidden');
  tooltip.style.left = (e.clientX + 16) + 'px';
  tooltip.style.top = (e.clientY + 16) + 'px';
  render();
}

function openModal(id) {
  document.getElementById('modal-' + id).classList.remove('hidden');
  if (id === 'shop') renderShop();
  if (id === 'warehouse') renderWarehouse();
  if (id === 'shipping') renderShipping();
  if (id === 'plant') renderPlantSeeds();
}

function closeModal(id) {
  document.getElementById('modal-' + id).classList.add('hidden');
}

var _plantTarget = null;

function openPlantModal(row, col) {
  _plantTarget = { row: row, col: col };
  openModal('plant');
}

function renderShop() {
  document.getElementById('shop-gold').textContent = gameState.gold;
  var container = document.getElementById('shop-items');
  var html = '';

  html += '<h3 style="color:#f4c060; margin-top:4px;">🌱 种子</h3>';
  var itemIds = Object.keys(ITEM_DEFS);
  for (var i = 0; i < itemIds.length; i++) {
    var id = itemIds[i];
    var def = ITEM_DEFS[id];
    if (!def.canBuy || def.type !== 'seed') continue;
    var cropDef = CROP_DEFS[def.cropType];
    var yieldInfo = cropDef ? (cropDef.yieldMax > 1 ? ' 收' + cropDef.yieldMin + '~' + cropDef.yieldMax + '个' : ' 收' + cropDef.yieldMin + '个') : '';
    var seasonName = cropDef ? SEASON_NAMES[cropDef.season] : '?';
    var daysInfo = cropDef ? cropDef.days + '天' : '?';
    html += '<div class="shop-item">' +
      '<span><span class="seed-emoji">' + def.emoji + '</span> ' + def.name + ' <small style="color:#a0a0a0;">[' + seasonName + '季 ' + daysInfo + yieldInfo + ']</small></span>' +
      '<button class="btn primary" onclick="buyItem(\'' + id + '\', 1, ' + def.buyPrice + ')"' +
      (gameState.gold < def.buyPrice ? ' disabled' : '') + '>💰' + def.buyPrice + '</button>' +
      '</div>';
  }

  html += '<h3 style="color:#f4c060; margin-top:12px;">🔧 设备</h3>';
  var equipIds = Object.keys(ITEM_DEFS);
  for (var ei = 0; ei < equipIds.length; ei++) {
    var eId = equipIds[ei];
    var eqDef = ITEM_DEFS[eId];
    if (!eqDef.canBuy || eqDef.type !== 'equip') continue;
    html += '<div class="shop-item">' +
      '<span>' + eqDef.emoji + ' ' + eqDef.name + ' <small style="color:#a0a0a0;">[' + eqDef.description + ']</small></span>' +
      '<button class="btn primary" onclick="buyItem(\'' + eId + '\', 1, ' + eqDef.buyPrice + ')"' +
      (gameState.gold < eqDef.buyPrice ? ' disabled' : '') + '>💰' + eqDef.buyPrice + '</button>' +
      '</div>';
  }

  container.innerHTML = html;
}

function renderWarehouse() {
  document.getElementById('wh-used').textContent = getWarehouseUsed();
  document.getElementById('wh-capacity').textContent = getWarehouseCapacity();
  var container = document.getElementById('warehouse-items');
  var html = '';

  var itemIds = Object.keys(gameState.warehouse);
  if (itemIds.length === 0) {
    html += '<p style="text-align:center; color:#888; padding:20px;">仓库空空如也...</p>';
  }

  for (var i = 0; i < itemIds.length; i++) {
    var itemId = itemIds[i];
    var count = gameState.warehouse[itemId];
    var def = ITEM_DEFS[itemId] || FISH_DEFS[itemId];
    var name = def ? def.name : itemId;
    var emoji = def ? def.emoji : '📦';
    var isSeed = def && def.type === 'seed';
    var canSell = def && def.canSell;

    html += '<div class="inventory-item">' +
      '<span>' + (isSeed ? '<span class="seed-emoji">' + emoji + '</span>' : emoji) + ' ' + name + ' ×' + count + '</span>' +
      '<div style="display:flex; gap:4px;">' +
      (canSell ? '<button class="btn" onclick="moveToShipping(\'' + itemId + '\')" title="出货1个">📤</button>' : '') +
      (canSell ? '<button class="btn" onclick="shipAllItem(\'' + itemId + '\')" title="出货全部">📤📤</button>' : '') +
      '<button class="btn" onclick="destroyItem(\'' + itemId + '\')" title="销毁1个" style="color:#e04040;">🗑</button>' +
      '</div>' +
      '</div>';
  }

  container.innerHTML = html;

  var hasSellable = false;
  for (var j = 0; j < itemIds.length; j++) {
    var checkDef = ITEM_DEFS[itemIds[j]] || FISH_DEFS[itemIds[j]];
    if (checkDef && checkDef.canSell) { hasSellable = true; break; }
  }
  document.getElementById('btn-move-all').disabled = !hasSellable;
}

function moveAllToShipping() {
  var shippedCounts = {};
  var itemIds = Object.keys(gameState.warehouse);
  for (var i = 0; i < itemIds.length; i++) {
    var itemId = itemIds[i];
    var def = ITEM_DEFS[itemId];
    if (!def || !def.canSell) continue;
    var count = gameState.warehouse[itemId];
    if (count <= 0) continue;
    shippedCounts[itemId] = count;
    delete gameState.warehouse[itemId];
    gameState.shippingBox[itemId] = (gameState.shippingBox[itemId] || 0) + count;
  }
  var totalShipped = 0;
  for (var j = 0; j < Object.keys(shippedCounts).length; j++) {
    totalShipped += shippedCounts[Object.keys(shippedCounts)[j]];
  }
  if (totalShipped > 0) {
    if (gameState.heldItemId && !gameState.warehouse[gameState.heldItemId] && !gameState.warehouse['seed_' + gameState.heldItemId]) {
      gameState.heldItemId = null;
    }
    saveGame();
    updateAllUI();
    renderWarehouse();
    notify('已将所有可出货物品（' + totalShipped + '个）放入出货箱！');
  } else {
    notify('没有可出货的物品！');
  }
}

function renderShipping() {
  var container = document.getElementById('shipping-items');
  var html = '';

  var itemIds = Object.keys(gameState.shippingBox);
  if (itemIds.length === 0) {
    html += '<p style="text-align:center; color:#888; padding:20px;">出货箱是空的</p>';
  }

  var totalValue = 0;
  for (var i = 0; i < itemIds.length; i++) {
    var itemId = itemIds[i];
    var count = gameState.shippingBox[itemId];
    var def = ITEM_DEFS[itemId] || FISH_DEFS[itemId];
    var name = def ? def.name : itemId;
    var emoji = def ? def.emoji : '📦';
    var price = def ? def.sellPrice : 0;
    var subtotal = price * count;
    totalValue += subtotal;

    html += '<div class="shipping-item">' +
      '<span>' + emoji + ' ' + name + '</span>' +
      '<span>×' + count + '</span>' +
      '<span style="color:#f4c060;">💰' + subtotal + '</span>' +
      '<button class="btn danger" style="font-size:11px;padding:3px 8px;" onclick="removeFromShipping(\'' + itemId + '\')">✕</button>' +
      '</div>';
  }

  html += '<div style="text-align:right; padding:10px; font-size:16px; color:#f4c060; font-weight:bold;">总计: 💰' + totalValue + '</div>';
  container.innerHTML = html;
}

function renderPlantSeeds() {
  var container = document.getElementById('plant-seed-list');
  var html = '';
  var hasSeeds = false;

  var cropIds = Object.keys(CROP_DEFS);
  for (var i = 0; i < cropIds.length; i++) {
    var id = cropIds[i];
    var def = CROP_DEFS[id];
    if (def.season !== gameState.time.season) continue;
    var count = (gameState.warehouse['seed_' + id] || 0) + (gameState.warehouse[id] || 0);
    if (count <= 0) continue;
    hasSeeds = true;
    var itemDef = ITEM_DEFS[id];
    var emoji = itemDef ? itemDef.emoji : '🌱';
    var yieldInfo = def.yieldMax > 1 ? ' 收' + def.yieldMin + '~' + def.yieldMax + '个' : ' 收' + def.yieldMin + '个';
    html += '<div class="shop-item">' +
      '<span>' + emoji + ' ' + def.name + ' <small style="color:#a0a0a0;">[' + def.days + '天成熟' + yieldInfo + '] ×' + count + '</small></span>' +
      '<button class="btn primary" onclick="doPlant(\'' + id + '\')">播种</button>' +
      '</div>';
  }

  if (!hasSeeds) {
    html += '<p style="text-align:center; color:#888; padding:20px;">没有当季可用的种子！<br>去商店购买吧 🛒</p>';
  }

  container.innerHTML = html;
}

function doPlant(seedType) {
  if (!_plantTarget) return;
  var target = _plantTarget;
  if (plantSeed(target.row, target.col, seedType)) {
    closeModal('plant');
    _plantTarget = null;
  } else {
    renderPlantSeeds();
  }
}

function updateAllUI() {
  document.getElementById('stamina-text').textContent = gameState.stamina.current + '/' + gameState.stamina.max;
  document.getElementById('stamina-fill').style.width = ((gameState.stamina.current / gameState.stamina.max) * 100) + '%';
  document.getElementById('gold-text').textContent = gameState.gold;

  var time = gameState.time;
  document.getElementById('date-text').textContent = SEASON_NAMES[time.season] + ' 第' + time.day + '天 第' + time.year + '年';

  var seasonColors = { spring: '#80c060', summer: '#e8a040', autumn: '#e88040', winter: '#80b8e0' };
  document.getElementById('calendar-panel').style.borderColor = seasonColors[time.season];

  for (var ti = 0; ti < toolBtns.length; ti++) {
    if (toolBtns[ti].id !== 'held-item-btn') {
      toolBtns[ti].classList.toggle('active', toolBtns[ti].dataset.tool === gameState.currentTool);
    }
  }

  updateHeldItemUI();
  render();
}

function updateHeldItemUI() {
  var btn = document.getElementById('held-item-btn');
  var heldId = gameState.heldItemId;

  if (heldId) {
    var heldDef = ITEM_DEFS[heldId];
    if (heldDef && heldDef.type === 'equip') {
      var equipCount = gameState.warehouse[heldId] || 0;
      if (equipCount <= 0) {
        gameState.heldItemId = null;
        btn.textContent = '📦';
        btn.classList.remove('has-item');
        var b = btn.querySelector('.badge');
        if (b) b.remove();
        btn.title = '手持物品 - 点击选择仓库物品';
        return;
      }
      btn.innerHTML = heldDef.emoji;
      btn.classList.add('has-item');
      var existingBadge = btn.querySelector('.badge');
      if (existingBadge) existingBadge.remove();
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = equipCount;
      btn.appendChild(badge);
      btn.title = heldDef.name + ' ×' + equipCount + ' - 点击未开垦地块放置';
      return;
    }

    var seedCount = gameState.warehouse['seed_' + heldId] || 0;

    if (seedCount > 0) {
      var seedDef = ITEM_DEFS['seed_' + heldId];
      var cropDef = CROP_DEFS[heldId];
      var emoji = seedDef ? seedDef.emoji : (cropDef ? '🌱' : '📦');
      var name = seedDef ? seedDef.name : (cropDef ? cropDef.name : heldId);
      btn.innerHTML = '<span class="seed-emoji">' + emoji + '</span>';
      btn.classList.add('has-item');

      var existingBadge = btn.querySelector('.badge');
      if (existingBadge) existingBadge.remove();

      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = seedCount;
      btn.appendChild(badge);

      btn.title = name + ' ×' + seedCount + ' - 点击地块直接种植';
      return;
    }
  }

  gameState.heldItemId = null;
  btn.textContent = '📦';
  btn.classList.remove('has-item');
  var b = btn.querySelector('.badge');
  if (b) b.remove();
  btn.title = '手持物品 - 点击选择仓库物品';
}

function renderHeldItemPopup() {
  var popup = document.getElementById('held-item-popup');
  var html = '';

  var hasItems = false;

  var equipIds = ['sprinkler', 'silo', 'drying_rack', 'stone_mill', 'cooking_pot', 'compost_bin'];
  for (var ei = 0; ei < equipIds.length; ei++) {
    var eId = equipIds[ei];
    var equipCount = gameState.warehouse[eId] || 0;
    if (equipCount > 0) {
      hasItems = true;
      var eqDef = ITEM_DEFS[eId];
      var sizeLabel = eqDef.size > 1 ? ' ' + eqDef.size + '×' + eqDef.size : '';
      html += '<div class="popup-item" onclick="selectHeldItem(\'' + eId + '\')">' +
        '<span>' + eqDef.emoji + ' ' + eqDef.name + '<small style="color:#a0a0a0;">[' + sizeLabel + ']</small></span>' +
        '<span style="color:#f4c060;">×' + equipCount + '</span>' +
        '</div>';
    }
  }

  var cropIds = Object.keys(CROP_DEFS);

  for (var i = 0; i < cropIds.length; i++) {
    var id = cropIds[i];
    var seedCount = gameState.warehouse['seed_' + id] || 0;
    if (seedCount <= 0) continue;
    if (CROP_DEFS[id].season !== gameState.time.season) continue;
    hasItems = true;
    var seedDef = ITEM_DEFS['seed_' + id];
    var cropDef = CROP_DEFS[id];
    var emoji = seedDef ? seedDef.emoji : '🌱';
    var name = seedDef ? seedDef.name : (cropDef ? cropDef.name : id);
    html += '<div class="popup-item" onclick="selectHeldItem(\'' + id + '\')">' +
      '<span><span class="seed-emoji">' + emoji + '</span> ' + name + '</span>' +
      '<span style="color:#f4c060;">×' + seedCount + '</span>' +
      '</div>';
  }

  if (!hasItems) {
    html += '<div class="popup-item empty">没有可用的物品</div>';
  }

  html += '<div style="border-top:1px solid #4a3a28; margin-top:4px; padding-top:4px;">' +
    '<div class="popup-item" onclick="selectHeldItem(null)" style="' + (!gameState.heldItemId ? 'color:#888;' : '') + '">' +
    '❌ 清空手持</div></div>';

  popup.innerHTML = html;
}

function selectHeldItem(itemId) {
  gameState.heldItemId = itemId;
  var popup = document.getElementById('held-item-popup');
  popup.classList.remove('show');

  if (itemId) {
    var heldDef = ITEM_DEFS[itemId];
    if (heldDef && heldDef.type === 'equip') {
      hoveredTile = getTileAtPos(lastMouseX, lastMouseY);
    }
    gameState.currentTool = null;
  } else {
    gameState.currentTool = 'hoe';
  }

  saveGame();
  updateAllUI();
  if (itemId) {
    var heldDef = ITEM_DEFS[itemId];
    if (heldDef && heldDef.type === 'equip') {
      notify('手持 ' + heldDef.emoji + ' ' + heldDef.name + ' - 点击未开垦地块放置');
    } else {
      var seedDef = ITEM_DEFS['seed_' + itemId];
      var cropDef = CROP_DEFS[itemId];
      var emoji = seedDef ? seedDef.emoji : '🌱';
      var name = seedDef ? seedDef.name : (cropDef ? cropDef.name : itemId);
      notify('手持 ' + emoji + ' ' + name + ' - 点击地块直接种植');
    }
  } else {
    notify('已清空手持物品');
  }
}

function toggleHeldItemPopup() {
  var popup = document.getElementById('held-item-popup');
  if (popup.classList.contains('show')) {
    popup.classList.remove('show');
    return;
  }
  renderHeldItemPopup();
  popup.classList.add('show');
}

canvas.addEventListener('mousemove', updateTooltip);
canvas.addEventListener('mouseleave', function () {
  tooltip.classList.add('hidden');
  hoveredTile = null;
  render();
});

canvas.addEventListener('click', function (e) {
  var tile = getTileAtPos(e.clientX, e.clientY);
  if (!tile) return;
  var t = gameState.tiles[tile.row][tile.col];

  if (t.equipmentKey && !gameState.heldItemId && gameState.currentTool !== 'pickaxe') {
    var clickEq = gameState.placedEquipment[t.equipmentKey];
    if (clickEq && isMachine(clickEq.type)) {
      openMachineUI(t.equipmentKey);
      return;
    }
  }

  if (gameState.heldItemId) {
    var heldDef = ITEM_DEFS[gameState.heldItemId];
    if (heldDef && heldDef.type === 'equip') {
      var result = Equipment.place(gameState.heldItemId, tile.row, tile.col, gameState.warehouse, gameState.tiles, gameState.placedEquipment);
      if (result.ok) {
        if (!gameState.warehouse[gameState.heldItemId]) {
          gameState.heldItemId = null;
          gameState.currentTool = 'hoe';
        }
        saveGame();
        updateAllUI();
      }
      notify(result.msg);
      return;
    } else if (CROP_DEFS[gameState.heldItemId]) {
      if (t.state === 'plowed' || t.state === 'watered') {
        plantSeed(tile.row, tile.col, gameState.heldItemId);
        var seedLeft = gameState.warehouse['seed_' + gameState.heldItemId] || 0;
        if (seedLeft <= 0) {
          gameState.heldItemId = null;
          gameState.currentTool = 'hoe';
        }
        updateAllUI();
        return;
      } else {
        notify('请先开垦此地块再播种！');
        return;
      }
    }
  }

  if (gameState.currentTool === 'watercan') {
    if (t.state === 'planted' || t.state === 'plowed') {
      useTool(tile.row, tile.col);
      return;
    }
  }

  if (t.state === 'unplowed' && !t.equipmentKey && gameState.currentTool === 'hoe') {
    useTool(tile.row, tile.col);
    return;
  }
  if (t.state === 'mature' && gameState.currentTool === 'sickle') {
    useTool(tile.row, tile.col);
    return;
  }
  if ((t.state !== 'unplowed' || t.equipmentKey) && gameState.currentTool === 'pickaxe') {
    useTool(tile.row, tile.col);
    return;
  }
  if (t.state === 'planted' || t.state === 'watered') {
    if (gameState.currentTool === 'watercan') {
      useTool(tile.row, tile.col);
    }
    return;
  }
  if (t.state === 'mature' && gameState.currentTool !== 'sickle') {
    notify('请切换到镰刀来收割成熟作物！');
    return;
  }
});

canvas.addEventListener('contextmenu', function (e) {
  e.preventDefault();
});

wrapper.addEventListener('scroll', function () { render(); });

var toolBtns = document.querySelectorAll('.tool-btn');
for (var i = 0; i < toolBtns.length; i++) {
  toolBtns[i].addEventListener('click', function () {
    if (this.id === 'held-item-btn') return;
    for (var j = 0; j < toolBtns.length; j++) {
      if (toolBtns[j].id !== 'held-item-btn') {
        toolBtns[j].classList.remove('active');
      }
    }
    this.classList.add('active');
    gameState.currentTool = this.dataset.tool;
    gameState.heldItemId = null;
    updateAllUI();
  });
}

document.getElementById('held-item-btn').addEventListener('click', function (e) {
  e.stopPropagation();
  toggleHeldItemPopup();
});

document.addEventListener('click', function (e) {
  var popup = document.getElementById('held-item-popup');
  if (popup.classList.contains('show')) {
    var btn = document.getElementById('held-item-btn');
    if (!popup.contains(e.target) && e.target !== btn) {
      popup.classList.remove('show');
    }
  }
});

document.getElementById('next-day-btn').addEventListener('click', nextDay);
document.getElementById('btn-shop').addEventListener('click', function () { openModal('shop'); });
document.getElementById('btn-warehouse').addEventListener('click', function () { openModal('warehouse'); });
document.getElementById('btn-shipping').addEventListener('click', function () { openModal('shipping'); });
document.getElementById('btn-fishing').addEventListener('click', function () { openModal('fishing'); });
document.getElementById('btn-save').addEventListener('click', exportSave);
document.getElementById('btn-load').addEventListener('click', function () {
  document.getElementById('load-file-input').click();
});
document.getElementById('btn-reset').addEventListener('click', resetSave);
document.getElementById('load-file-input').addEventListener('change', function (e) {
  if (e.target.files[0]) importSave(e.target.files[0]);
});

window.addEventListener('resize', function () { updateAllUI(); });

document.addEventListener('keydown', function (e) {
  switch (e.key) {
    case '1': gameState.currentTool = 'hoe'; break;
    case '2': gameState.currentTool = 'watercan'; break;
    case '3': gameState.currentTool = 'sickle'; break;
    case '4': gameState.currentTool = 'pickaxe'; break;
    case 'n': case 'N': nextDay(); break;
    default: return;
  }
  gameState.heldItemId = null;
  updateAllUI();
});

function init() {
  if (!loadGame()) {
    initTiles();
    gameState.warehouse.seed_turnip = 3;
    gameState.warehouse.seed_potato = 2;
  }
  updateAllUI();
  setInterval(function () { render(); }, 1000);
}

function resetSave() {
  if (!confirm('确定要重置存档吗？所有进度将丢失！')) return;
  localStorage.removeItem('farland_tales_save');
  initTiles();
  gameState.time = { day: 1, season: 'spring', year: 1 };
  gameState.stamina = { current: MAX_STAMINA, max: MAX_STAMINA };
  gameState.gold = 500;
  gameState.currentTool = 'hoe';
  gameState.heldItemId = null;
  gameState.warehouse = {};
  gameState.shippingBox = {};
  gameState.placedEquipment = {};
  gameState.nextDayNotifications = [];
  gameState.warehouse.seed_turnip = 3;
  gameState.warehouse.seed_potato = 2;
  saveGame();
  updateAllUI();
  var popup = document.getElementById('held-item-popup');
  if (popup) popup.classList.remove('show');
  notify('存档已重置！');
}

init();
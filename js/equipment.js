var MACHINE_TYPES = ['drying_rack', 'stone_mill', 'cooking_pot', 'compost_bin'];

function isMachine(equipType) {
  for (var i = 0; i < MACHINE_TYPES.length; i++) {
    if (MACHINE_TYPES[i] === equipType) return true;
  }
  return false;
}

const Equipment = {

  canPlace(equipType, anchorRow, anchorCol, tiles, cols) {
    var def = ITEM_DEFS[equipType];
    if (!def || def.type !== 'equip') return false;
    var size = def.size || 1;
    var rows = tiles.length;
    for (var dr = 0; dr < size; dr++) {
      for (var dc = 0; dc < size; dc++) {
        var r = anchorRow + dr;
        var c = anchorCol + dc;
        if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
        var tile = tiles[r][c];
        if (tile.state !== 'unplowed' || tile.equipmentKey) return false;
      }
    }
    return true;
  },

  place(equipType, anchorRow, anchorCol, warehouse, tiles, placedEquipment) {
    var def = ITEM_DEFS[equipType];
    if (!def || def.type !== 'equip') return { ok: false, msg: '无效设备！' };
    var size = def.size || 1;

    var eqKey = anchorRow + ',' + anchorCol;
    if (placedEquipment[eqKey]) return { ok: false, msg: '此位置已有设备！' };

    if (!warehouse[equipType] || warehouse[equipType] <= 0) {
      return { ok: false, msg: '仓库中没有' + def.name + '！' };
    }

    if (!this.canPlace(equipType, anchorRow, anchorCol, tiles, COLS)) {
      return { ok: false, msg: '无法在此放置' + def.name + '！需要' + size + '×' + size + '的空地。' };
    }

    warehouse[equipType]--;
    if (warehouse[equipType] <= 0) delete warehouse[equipType];

    placedEquipment[eqKey] = { type: equipType, row: anchorRow, col: anchorCol };

    for (var dr = 0; dr < size; dr++) {
      for (var dc = 0; dc < size; dc++) {
        tiles[anchorRow + dr][anchorCol + dc].equipmentKey = eqKey;
      }
    }

    return { ok: true, msg: def.name + '已放置！' };
  },

  remove(row, col, warehouse, tiles, placedEquipment) {
    var tile = tiles[row][col];
    var eqKey = tile.equipmentKey;
    if (!eqKey) return { ok: false, msg: '此地块没有设备！' };

    var eq = placedEquipment[eqKey];
    if (!eq) return { ok: false, msg: '设备数据异常！' };

    var def = ITEM_DEFS[eq.type];
    var size = def ? def.size : 1;

    warehouse[eq.type] = (warehouse[eq.type] || 0) + 1;
    delete placedEquipment[eqKey];
    if (gameState.machines && gameState.machines[eqKey]) {
      delete gameState.machines[eqKey];
    }

    for (var dr = 0; dr < size; dr++) {
      for (var dc = 0; dc < size; dc++) {
        var r = eq.row + dr;
        var c = eq.col + dc;
        if (r < tiles.length && r >= 0 && c < COLS && c >= 0) {
          tiles[r][c].equipmentKey = null;
        }
      }
    }

    return { ok: true, msg: (def ? def.name : '设备') + '已拆卸，放回仓库' };
  },

  processAll(tiles, cols, placedEquipment) {
    var keys = Object.keys(placedEquipment);

    for (var i = 0; i < keys.length; i++) {
      var eq = placedEquipment[keys[i]];

      if (eq.type === 'sprinkler') {
        var rows = tiles.length;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var nr = eq.row + dr;
            var nc = eq.col + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

            var neighbor = tiles[nr][nc];
            if (neighbor.state === 'unplowed') continue;

            neighbor.watered = true;
            neighbor._sprinklerWatered = true;
            if (neighbor.state === 'plowed') {
              neighbor.state = 'watered';
            }
          }
        }
      }
    }
  },

  getSiloCount(placedEquipment) {
    var count = 0;
    var keys = Object.keys(placedEquipment);
    for (var i = 0; i < keys.length; i++) {
      if (placedEquipment[keys[i]].type === 'silo') count++;
    }
    return count;
  },
};
const SILO_CONFIG = { capacityIncrease: 20 };

const ITEM_DEFS = {};

// -------- 自动从 CROP_DEFS 生成种子 + 作物条目 --------
var _ck = Object.keys(CROP_DEFS);
for (var i = 0; i < _ck.length; i++) {
  var _id = _ck[i];
  var _c = CROP_DEFS[_id];
  ITEM_DEFS['seed_' + _id] = {
    name: _c.name + '种子', type: 'seed', emoji: _c.emoji,
    canSell: false, canBuy: true, buyPrice: _c.seedPrice, sellPrice: 0, cropType: _id
  };
  ITEM_DEFS[_id] = {
    name: _c.name, type: 'crop', emoji: _c.emoji,
    canSell: true, canBuy: false, buyPrice: 0, sellPrice: _c.sellPrice
  };
}

// -------- 加工品 & 设备（手动定义） --------
Object.assign(ITEM_DEFS, {
  dried_wheat:  { name: '风干小麦', type: 'product', emoji: '🌾', canSell: true,  canBuy: false, buyPrice: 0, sellPrice: 60 },
  flour:        { name: '面粉',     type: 'product', emoji: '🫓', canSell: true,  canBuy: false, buyPrice: 0, sellPrice: 120 },
  tomato_sauce: { name: '番茄酱',   type: 'product', emoji: '🥫', canSell: true,  canBuy: false, buyPrice: 0, sellPrice: 165 },
  fertilizer:   { name: '肥料',     type: 'product', emoji: '🪴', canSell: false, canBuy: false, buyPrice: 0, sellPrice: 0 },

  sprinkler:   { name: '洒水器', type: 'equip', emoji: '💦', size: 1, canSell: false, canBuy: true, buyPrice: 200, description: '每日自动浇灌周围5×5地块' },
  silo:        { name: '筒仓',   type: 'equip', emoji: '🏭', size: 3, canSell: false, canBuy: true, buyPrice: 300, description: '占地3×3，增加仓库容量 +' + SILO_CONFIG.capacityIncrease },
  drying_rack: { name: '风干仓', type: 'equip', emoji: '🏗️', size: 1, canSell: false, canBuy: true, buyPrice: 200, description: '放入原料风干加工，产出成品' },
  stone_mill:  { name: '石磨',   type: 'equip', emoji: '🪨', size: 2, canSell: false, canBuy: true, buyPrice: 500, description: '花费体力将原料研磨成加工品' },
  cooking_pot: { name: '厨锅',   type: 'equip', emoji: '🍲', size: 1, canSell: false, canBuy: true, buyPrice: 400, description: '烹饪加工食材，产出成品' },
  compost_bin: { name: '堆肥桶', type: 'equip', emoji: '🪣', size: 1, canSell: false, canBuy: true, buyPrice: 250, description: '将种子等原料堆制成肥料' },
});

const EQUIP_IDS = ['sprinkler', 'silo', 'drying_rack', 'stone_mill', 'cooking_pot', 'compost_bin'];

const FISH_DEFS = {
  carp:    { name: '鲤鱼',   season: ['spring', 'summer', 'autumn'], sellPrice: 30,  emoji: '🐟' },
  catfish: { name: '鲶鱼',   season: ['summer', 'autumn'],            sellPrice: 50,  emoji: '🐟' },
  salmon:  { name: '鲑鱼',   season: ['autumn'],                      sellPrice: 80,  emoji: '🐟' },
  tuna:    { name: '金枪鱼', season: ['winter'],                       sellPrice: 120, emoji: '🐟' },
};
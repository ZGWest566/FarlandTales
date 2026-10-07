const RECIPES = {
  drying_rack: {
    name: '风干仓',
    maxSlots: 5,
    recipes: [
      { input: 'wheat', inputCount: 1, output: 'dried_wheat', outputCount: 1, days: 1 }
    ]
  },
  stone_mill: {
    name: '石磨',
    maxSlots: 5,
    recipes: [
      { input: 'dried_wheat', maxInput: 5, output: 'flour', staminaCost: 5, instant: true }
    ]
  },
  cooking_pot: {
    name: '厨锅',
    maxSlots: 2,
    recipes: [
      { input: 'tomato', inputCount: 2, output: 'tomato_sauce', outputCount: 1, instant: true }
    ]
  },
  compost_bin: {
    name: '堆肥桶',
    targetPoints: 10,
    output: 'fertilizer',
    outputCount: 2
  }
};

const COMPOST_SEED_VALUE = 1;
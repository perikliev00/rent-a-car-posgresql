// Плоски такси за доставка/връщане за всяка поддържана локация.
const FEES = {
  office: 0,
  'sunny-beach': 25,
  'sveti-vlas': 30,
  nesebar: 30,
  burgas: 40,
  'burgas-airport': 50,
  sofia: 100,
  'sofia-airport': 120,
  varna: 80,
  'varna-airport': 90,
  plovdiv: 70,
  eleni: 35,
  ravda: 20,
};

// Връща конфигурираната такса за локация; при непозната локация – 0.
const feeFor = (loc) => FEES[loc] ?? 0;

// Експорт на raw fee map и helper accessor.
module.exports = { FEES, feeFor };

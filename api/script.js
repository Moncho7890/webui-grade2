const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const JMA_URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast';

const JMA_AREA_CODES = {
  '東京': '130000', 'TOKYO': '130000',
  '大阪': '270000', 'OSAKA': '270000',
  '名古屋': '230000', 'NAGOYA': '230000',
  '福岡': '400000', 'FUKUOKA': '400000',
  '札幌': '016000', 'SAPPORO': '016000'
};

const WMO_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️', 77:'❄️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️'
};

const WMO_DESC = {
  0:'快晴', 1:'ほぼ晴れ', 2:'一部曇り', 3:'曇り',
  45:'霧', 48:'霧氷',
  51:'霧雨（弱）', 53:'霧雨', 55:'霧雨（強）',
  61:'小雨', 63:'雨', 65:'大雨',
  71:'小雪', 73:'雪', 75:'大雪',
  80:'にわか雨', 81:'雨', 82:'激しい雨',
  95:'雷雨', 96:'雷雨（雹）', 99:'激しい雷雨'
};

function spawnSakura() {
  const container = document.getElementById('sakura');
  if (!container) return;
  const petals = ['🌸', '🌺', '🍃'];
  const spawn = () => {
    if (!document.getElementById('sakura')) return;
    const el = document.createElement('div');
    el.className = 'petal';
    el.textContent = petals[Math.floor(Math.random() * petals.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (6 + Math.random() * 8) + 's';
    el.style.animationDelay = (Math.random() * 2) + 's';
    el.style.fontSize = (14 + Math.random() * 12) + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 15000);
  };
  setInterval(spawn, 600);
}

async function fetchOpenMeteo(latitude, longitude, timezone, signal) {
  const tz = timezone || 'Asia/Tokyo';
  const url = `${WEATHER_URL}` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code` +
    `&daily=precipitation_probability_max` +
    `&timezone=${encodeURIComponent(tz)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('天気の取得に失敗しました');
  const data = await res.json();
  const cur = data.current || {};
  return {
    code: cur.weather_code,
    temp: Math.round(cur.temperature_2m ?? 0),
    humidity: cur.relative_humidity_2m ?? null,
    rainProb: data.daily?.precipitation_probability_max?.[0] ?? 0,
  };
}

async function fetchAndFortune() {
  const city = document.getElementById('cityInput').value.trim();
  const btn = document.getElementById('drawBtn');
  const errorEl = document.getElementById('error');
  if (btn.disabled) return;
  if (!city) {
    errorEl.textContent = '都市名を入力してください。';
    errorEl.classList.remove('hidden');
    return;
  }
  btn.disabled = true;
  btn.textContent = '占い中...';
  document.getElementById('weatherCard').classList.add('hidden');
  document.getElementById('slip').classList.add('hidden');
  errorEl.classList.add('hidden');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const geoRes = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=ja`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    if (!geoRes.ok) {
      const geoError = await geoRes.json().catch(() => ({}));
      throw new Error(geoError.reason || '位置情報の取得に失敗しました');
    }
    const geoData = await geoRes.json();
    if (!geoData.results?.length) throw new Error('都市が見つかりませんでした');
    const { latitude, longitude, name, country = '', admin1 = '', timezone } = geoData.results[0];
    const locationName = [name, admin1, country].filter(Boolean).join(', ');
    // Normalize: "大阪市" -> "大阪", "東京都" -> "東京", "osaka" -> "OSAKA"
    const normalized = name.replace(/[市都府県]$/, '');
    const areaCode =
      JMA_AREA_CODES[normalized] ||
      JMA_AREA_CODES[name] ||
      JMA_AREA_CODES[city.toUpperCase()] ||
      null;
    let code, temp, humidity, rainProb;
    if (areaCode) {
      try {
        const jmaRes = await fetch(`${JMA_URL}/${areaCode}.json`, { signal: controller.signal });
        if (!jmaRes.ok) throw new Error(`JMA status ${jmaRes.status}`);
        const jmaData = await jmaRes.json();
        const forecast = jmaData[0].timeSeries[0].areas[0];
        const jmaCode = forecast.weatherCodes[0];
        code = jmaCode[0] === '1' ? 0 : jmaCode[0] === '2' ? 3 : 63;
        // temps can contain "" — find the first valid number, else fall back
        const temps = jmaData[0].timeSeries[2]?.areas[0]?.temps ?? [];
        const validTemp = temps.filter(t => t !== '').map(Number).find(t => Number.isFinite(t));
        temp = validTemp ?? 20;
        humidity = null; // JMA forecast JSON has no humidity — show nothing, don't fake 50
        const pops = jmaData[0].timeSeries[1]?.areas[0]?.pops ?? [];
        rainProb = pops.filter(p => p !== '').map(Number).find(p => Number.isFinite(p)) ?? 0;
      } catch (jmaError) {
        // JMA is unofficial and can fail (CORS, structure changes) — fall back
        console.warn('JMA failed, falling back to Open-Meteo:', jmaError.message);
        ({ code, temp, humidity, rainProb } = await fetchOpenMeteo(latitude, longitude, timezone, controller.signal));
      }
    } else {
      ({ code, temp, humidity, rainProb } = await fetchOpenMeteo(latitude, longitude, timezone, controller.signal));
    }
    document.getElementById('weatherIcon').textContent = WMO_ICONS[code] ?? '🌡️';
    document.getElementById('weatherCity').textContent = locationName;
    document.getElementById('weatherTemp').textContent = `${temp}°C`;
    document.getElementById('weatherDesc').textContent = WMO_DESC[code] ?? '空模様を確認中';
    document.getElementById('weatherMeta').textContent =
      (humidity != null ? `湿度 ${humidity}%　` : '') + `降水確率 ${rainProb}%`;
    const weatherCard = document.getElementById('weatherCard');
    weatherCard.classList.remove('hidden');
    buildFortune(name, temp, code, humidity);
    weatherCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    console.error('Detailed Error:', e);
    if (e.message === 'Failed to fetch') {
      errorEl.textContent = 'ネットワークエラー：通信が遮断されました。広告ブロックをオフにするか、接続を確認してください。';
    } else if (e.name === 'AbortError') {
      errorEl.textContent = '接続がタイムアウトしました。通信環境の良い場所で再度お試しください。';
    } else {
      errorEl.textContent = e.message || 'エラーが発生しました。もう一度お試しください。';
    }
    errorEl.classList.remove('hidden');
  } finally {
    clearTimeout(timeoutId);
    btn.disabled = false;
    btn.textContent = 'もう一度';
  }
}

function buildFortune(city, temp, code, humidity) {
  const levels = ['大吉', '吉', '中吉', '小吉', '末吉', '凶'];
  const isSunny = code <= 2;
  const isRainy = code >= 51;
  const isStormy = code >= 82;
  const isCold  = temp < 10;
  const isHot   = temp >= 30;
  let idx;
  if (isSunny && !isHot && !isCold) idx = 0;
  else if (isSunny) idx = 1;
  else if (code === 3) idx = 2;
  else if (isStormy) idx = 5;
  else if (isRainy && !isCold) idx = 3;
  else if (isRainy && isCold) idx = 4;
  else idx = 2;
  const mains = [
    `${city}の空は澄み渡り、あなたの前途も明るく輝いております。今日という日を大切に、一歩一歩を踏みしめてください。`,
    `空に薄雲はあれど、光は確かに差し込んでおります。努力は必ず実を結ぶでしょう。`,
    `雲と晴れ間が交わるように、吉凶は表裏一体。心を落ち着けて判断を。`,
    `曇り空の下にも、必ず陽は存在しております。焦らず、時を待つ心持ちが大切です。`,
    `雨は大地を潤すように、今の試練もあなたを育てております。`,
    `激しい天候は試練の象徴。しかし嵐の後には必ず虹が訪れます。`
  ];
  const sections = [
    { label: '全体運', text: `${city}の${WMO_DESC[code] ?? '天気'}があなたの今日を映しております。` },
    { label: '仕事運', text: isSunny ? '積極的に動くと良い結果が生まれます。' : '慎重に、着実に進めることが吉。' },
    { label: '恋愛運', text: temp > 15 ? '温かな心で接すれば、関係が深まります。' : '相手の気持ちを丁寧に確認してみて。' },
    { label: 'アドバイス', text: isSunny ? '新しい出会いを大切にしてください。' : isRainy ? '内なる声に耳を傾けてみてください。' : '柔軟な心で変化を受け入れましょう。' }
  ];
  document.getElementById('fortuneLevel').textContent = levels[idx];
  document.getElementById('fortuneMain').textContent = mains[idx];
  document.getElementById('fortuneSections').innerHTML = sections.map(s => `
    <div class="fortune-row">
      <span class="fortune-row-label">${s.label}</span>
      <span class="fortune-row-text">${s.text}</span>
    </div>
  `).join('');
  document.getElementById('slip').classList.remove('hidden');
}

document.getElementById('cityInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchAndFortune();
});

spawnSakura();
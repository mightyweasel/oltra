// 11 Labs Default Formats https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription
// Custom format based on event transcript format provided by user
// Lang detection via ELD https://github.com/nitotm/efficient-language-detector-js/tree/main

const chart = echarts.init(document.getElementById('chart'));
const languageTimelineChart = echarts.init(document.getElementById('language-timeline'));
const speakerTimelineChart = echarts.init(document.getElementById('speaker-timeline'));

const data = [];
const add_metric = function(seconds, les, speaker, lang) { data.push([seconds, les, speaker, lang]); }
const time = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`;
const chart_grid = { left: 60,  right: 20,  top: 35,  bottom: 45 };
const is_closed_caption_text = function(text) {
   return (text.trim().slice(0,1) === "[" && ( text.trim().slice(-2) === "]." || text.trim().slice(-1) === "]"));
}

const display_chart = function() { 
  document.getElementById('chart').style.display = 'block'; 
  document.getElementById('language-timeline').style.display = 'block'; 
  document.getElementById('speaker-timeline').style.display = 'block'; 
  requestAnimationFrame(() => { chart.resize(); languageTimelineChart.resize(); speakerTimelineChart.resize(); }); 
};
const hide_chart = function() { 
  document.getElementById('chart').style.display='none'; 
  document.getElementById('language-timeline').style.display='none'; 
  document.getElementById('speaker-timeline').style.display='none'; 
};
hide_chart();
const update_chart = function(speakerChanges) {
  const displayData = data.map(([x, y, z]) => [x, Math.max(y, 0.5), z]);
  chart.setOption({
    xAxis: { max: data.length ? data.at(-1)[0].toFixed(0) : 0 },
    series: [{ 
      data: displayData,
      markLine: {
        symbol: ['none', 'none'], silent: false,
        lineStyle: { color: '#2563eb', width: 1, type: 'dashed' },
        label: { show: true, position: 'insideEndTop', formatter: params => params.name },
        data: speakerChanges.map(([x, y, speaker]) => ({
          xAxis: x //,name: speaker
        }))
      }
    }]
  });
  display_chart();
};
chart.setOption({
  tooltip: {
    trigger: 'axis', axisPointer: { type: 'line' },
    formatter: p => {
      const index = p[0].dataIndex;
      const [seconds, les, speaker, lang] = data[index];
      const status = les >= 0.85 ? 'Excellent'
                   : les >= 0.7 ? 'Acceptable'
                   : 'Imbalance';
      return `${time(seconds.toFixed(0))}<br />${speaker} (${lang})<br />LES: <b>${les}</b> — ${status}`;
    }
  },
  grid: chart_grid,//{ left: 55, right: 20, top: 35, bottom: 45 },
  xAxis: { type: 'value', min: 0, axisLabel: { formatter: time } }, //name: 'Speaking Time', nameLocation: 'middle', nameGap: 30,
  yAxis: { type: 'value', min: 0.5, max: 1, name: 'Equilibrium', nameLocation: 'middle', nameGap: 40, nameTextStyle: { fontWeight: 'bold' } },
  series: [{
    type: 'line', data, smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#2563eb' },
    markArea: {
      silent: true, itemStyle: { opacity: .12 },
      data: [
        [{ yAxis: 0.0, itemStyle: { color: '#ef4444' } }, { yAxis: 0.7 }],
        [{ yAxis: 0.7, itemStyle: { color: '#eab308' } }, { yAxis: 0.85 }],
        [{ yAxis: 0.85, itemStyle: { color: '#22c55e' } }, { yAxis: 1.0 }]
      ]
    }
  }]
});

const update_language_timeline = function(result) {
  const segments = [];
  let runningAmount = 0;

  result.forEach(item => {
    if (is_closed_caption_text(item.text) == true || (item.language !== 'en' && item.language !== 'fr') || item.start == null || item.end == null || item.end <= item.start) { return; }
    const amount = item.end - item.start;
    const startAirtime = runningAmount;
    const endAirtime = runningAmount + amount;
    segments.push({ start: startAirtime, end: endAirtime, amount: amount, language: item.language, speaker: item.speaker });
    runningAmount = endAirtime;
  });

  languageTimelineChart.setOption({
    animation: false,
    xAxis: { 
      max: data.length ? data.at(-1)[0].toFixed(0) : 0, axisLabel: { formatter: time }//,
      //name: 'Speaking Time', nameLocation: 'middle', nameGap: 30
    },
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const item = params.data;
        return `<strong>${item.language === 'en' ? 'English' : 'French'}</strong><br>Airtime: ${time(item.start.toFixed(0))} - ${time(item.end.toFixed(0))}<br>
          Duration: <strong>${format_duration(item.amount)}</strong><br>Speaker: ${item.speaker}<br>`;
      }
    },
    grid: chart_grid,//{ left: 55, right: 20, top: 20, bottom: 45 },
    yAxis: { name: 'Language', nameLocation: 'middle', nameGap: 40, type: 'category', data: ['EN', 'FR'], inverse: true, axisTick: { show: false }, nameTextStyle: { fontWeight: 'bold' } },
    series: [{
      type: 'custom',
      renderItem: function(params, api) {
        const start = api.value(0);
        const end = api.value(1);
        const category = api.value(2);
        const startCoord = api.coord([start, category]);
        const endCoord = api.coord([end, category]);
        const height = api.size([0, 1])[1] * 0.55;

        return {
          type: 'rect',
          shape: {
            x: startCoord[0], y: startCoord[1] - height / 2,
            width: Math.max(endCoord[0] - startCoord[0], 2), height: height,
            r: 0//3
          },
          style: { fill: category === 0 ? '#ef4444' : '#2563eb', opacity: 0.85 }
        };
      },
      encode: { x: [0, 1], y: 2 },
      data: segments.map(item => ({
        value: [ item.start, item.end, item.language === 'en' ? 0 : 1 ],
        language: item.language, speaker: item.speaker, start: item.start, end: item.end, amount: item.amount
      }))
    }]
  });
};

const get_initials = name => name.trim().split(/\s+/).map(part => part[0].toUpperCase()).join('');
const get_initials_twochar = name => { const parts = name.trim().split(/\s+/); return (parts[0][0] + parts.at(-1)[0]).toUpperCase(); };
const random_color_fast = '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');

const update_speaker_timeline = function(result) {
  const segments = [];
  let runningAmount = 0;

  result.forEach(item => {
    if (is_closed_caption_text(item.text) == true || (item.language !== 'en' && item.language !== 'fr') || item.start == null || item.end == null || item.end <= item.start) { return; }
    const amount = item.end - item.start;
    const startAirtime = runningAmount;
    const endAirtime = runningAmount + amount;
    segments.push({ start: startAirtime, end: endAirtime, amount: amount, language: item.language, speaker: item.speaker });
    runningAmount = endAirtime;
  });

  speakerTimelineChart.setOption({
    animation: false,
    xAxis: { 
      max: data.length ? data.at(-1)[0].toFixed(0) : 0, axisLabel: { formatter: time },
      axisLine: { show: true },
      name: 'Speaking Time', nameLocation: 'middle', nameGap: 30, nameTextStyle: { fontWeight: 'bold' } 
    },
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const item = params.data;
        return `<strong>${item.language === 'en' ? 'English' : 'French'}</strong><br>Airtime: ${time(item.start.toFixed(0))} - ${time(item.end.toFixed(0))}<br>
          Duration: <strong>${format_duration(item.amount)}</strong><br>Speaker: ${item.speaker}<br>`;
      }
    },
    grid: chart_grid,//{ left: 55, right: 20, top: 20, bottom: 45 },
    yAxis: { name: 'Speaker', nameLocation: 'middle', //nameGap: 40, 
      type: 'category', 
      inverse: true, axisTick: { show: false },
      nameTextStyle: { fontWeight: 'bold' }, 
      axisLabel: { formatter: value => get_initials_twochar(value) }
    },
    series: [{
      type: 'custom',
      renderItem: function(params, api) {
        const start = api.value(0);
        const end = api.value(1);
        const category = api.value(2);
        const startCoord = api.coord([start, category]);
        const endCoord = api.coord([end, category]);
        const height = api.size([0, 1])[1] * 0.55;

        return {
          type: 'rect',
          shape: {
            x: startCoord[0], y: startCoord[1] - height / 2,
            width: Math.max(endCoord[0] - startCoord[0], 2), height: height,
            r: 0//3
          },
          style: { fill: '#276978', opacity: 0.85 }
        };
      },
      encode: { x: [0, 1], y: 2 },
      data: segments.map(item => ({
        value: [ item.start, item.end, item.speaker],//item.language === 'en' ? 0 : 1 ],
        language: item.language, speaker: item.speaker, start: item.start, end: item.end, amount: item.amount
      }))
    }]
  });
};

addEventListener('resize', () => { chart.resize(); languageTimelineChart.resize(); speakerTimelineChart.resize(); });
window.addEventListener('beforeprint', () => { chart.resize(); languageTimelineChart.resize(); speakerTimelineChart.resize(); });

const detector = eld.newInstance();
detector.setLanguageSubset(['en', 'fr']);

const file_input = document.getElementById("json-file");
const drop_zone = document.getElementById("drop-zone");
const transcript_frame = document.getElementById("otranscript");
const cc_frame = document.getElementById("cc-items");
const analysis_frame = document.getElementById("oanalysis");
const file_frame = document.getElementById("ofile");

const display_error = function() { document.getElementById('error-alert').style.display='block'; };
const dismiss_error = function() { document.getElementById('error-alert').style.display='none'; };
const clear_analysis = function() {
  transcript_frame.innerHTML = "";
  cc_frame.innerHTML = "";
  alt_lang = {};
  analysis_frame.innerHTML = "";
  file_frame.innerHTML = "";
  data.length = 0;
  LES_calcstore.format_LES_previous_LES = 0;
};

async function load_json(file) {
  if (!file) { return; }
  try {
    const text = await file.text();
    let el_parsed = JSON.parse(text);
    if (Array.isArray(el_parsed.segments)) { process_event_transcript_custom(el_parsed); } 
    else if (Array.isArray(el_parsed.transcripts)) { process_event_transcript_default(el_parsed); }
    else { throw new Error("Invalid transcript format: Expected structures not found."); }
    
    file_frame.innerHTML = `<h2>📑 ${file.name}</h2>`;
  } catch (error) {
    console.error(error);
    display_error();
  }
};
file_input.addEventListener("change", function(event) { load_json(event.target.files[0]); });
drop_zone.addEventListener("dragover", function(event) { event.preventDefault(); drop_zone.classList.add("dragging"); });
drop_zone.addEventListener("dragleave", function() { drop_zone.classList.remove("dragging"); });
drop_zone.addEventListener("drop", function(event) { event.preventDefault(); drop_zone.classList.remove("dragging"); const file = event.dataTransfer.files[0]; load_json(file); });

const make_transcript_entry = function(item) {
  return `<hr /><p>
    <kbd>${item.language} ${ item.amount != null ? format_duration(item.amount) : "--" }</kbd>
    <em>${item.text}</em><br /> 
    <small>[${ item.start != null ? format_duration(item.start) : "--" } - ${ item.end != null ? format_duration(item.end) : "--" }]</small>
    <sub>— ${item.speaker}</sub>
    </p>`;
};

const make_analysis_entry = function(item) {
  let speakerMetricsHTML = "";
  let speaker_chart_height_multiplier = Math.ceil(Object.entries(item.speakerMetrics).length / 5);
  document.querySelector('#speaker-timeline').style.setProperty('--height-multiplier', speaker_chart_height_multiplier);

  for (const [speaker, { en, fr, total }] of Object.entries(item.speakerMetrics)) {
    speakerMetricsHTML += `<tr>
      <th scope="row"><small>${speaker}</small></th>
      <td><small>${format_percent( (en/total)*100 )} (${format_duration(en)})</small></td>
      <td><small>${format_percent( (fr/total)*100 )} (${format_duration(fr)})</small></td>
      <td><small>${format_duration(total)}</small></td>
    </tr>`;
  }
  
  return `<hgroup>
    <h3><mark>${format_percent(item.enPercent)}</mark> English vs. <mark>${format_percent(item.frPercent)}</mark> French</h3>
    ${format_LES(item)}
    <table>
      <thead>
        <tr>
          <th scope="col">Speaker</th>
          <th scope="col">English</th>
          <th scope="col">French</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row"><strong>TOTAL</strong></th>
          <td><strong>${format_duration(item.enAmount)}</strong></td>
          <td><strong>${format_duration(item.frAmount)}</strong></td>
          <td><strong>${format_duration(item.total)}</strong></td>
        </tr>
        ${speakerMetricsHTML}
      </tbody>
    </table>
    </hgroup>`;
};

let alt_lang = { "music": 0 }; 
const make_cc_metric = function(item){
  const normalizedText = item.text.toLowerCase();
  const musicChunks = ["music", "chime", "musique", "générique", "generic"];
  const containsMusic = musicChunks.some(chunk => normalizedText.includes(chunk));
  if(containsMusic == true) {
    alt_lang["music"] += item.amount;
    return;
  }
  
  const speakingMatches = normalizedText.match(/\[speaking\s+([^\]]+)\]/gi) || [];
  const languages = new Set(speakingMatches.map(match => match.replace(/^\[speaking\s+/i, "").replace(/\]$/, "").trim().toLowerCase()));

  for (const language of languages) {
    const category = `${language}`;
    alt_lang[category] = (alt_lang[category] || 0) + item.amount;
  }
};
const format_cc_summary = function() {
  let alts_html = ``; 
  let alts_html_music = ``; 
  let alts_html_lang = ``;
  if(alt_lang.music != 0) { alts_html_music = `<p><em>Music:</em> <strong>${ format_duration(alt_lang["music"]) }</strong></p>`; }
  for (const [category, amount] of Object.entries(alt_lang)) { if (category !== "music") { 
    alts_html_lang += `<p><em>${category.charAt(0).toUpperCase() + category.slice(1)}:</em> <strong>${format_duration(amount)}</strong></p>`; } 
  }
  if(alts_html_music != `` || alts_html_lang != ``) { alts_html = "<h3>Other Audio Detected</h3>" + alts_html_music + alts_html_lang; }
  return alts_html;
};

const format_duration = function(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
};

const format_percent = function(item){
  return `${item.toFixed(2)}%`;
};

const LES_calcstore = { "format_LES_previous_LES": 0 };
const formatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });
const calculate_LES = function(item){
  let LES = 1.0 - (2.0 * (Math.abs((item.enAmount/(item.enAmount + item.frAmount))-0.5)));
  return LES;
};
const get_LES_rank = function(LES) {
  let LES_ranges = {
    "Excellent": "<strong>Excellent Baseline:</strong> Highly balanced. Proves robust bilingual integration across the event agenda.",
    "Acceptable": "<strong>Acceptable Compliance:</strong> Satisfactory. One language slightly dominated, but both communities had significant, active platforms.",
    "Imbalance": "<strong>Linguistic Imbalance:</strong> Marginal compliance. Indicates that the event leaned heavily unilingual."
  };

  let LES_rank = "Imbalance";
  if(LES >= 0.85) { LES_rank = "Excellent"; } 
  else if(LES < 0.85 && LES >= 0.70) { LES_rank = "Acceptable"; } 
  else if(LES < 0.70) { LES_rank = "Imbalance"; }

  return { "rank": LES_rank, "summary": LES_ranges[LES_rank] };
};
const format_LES = function(item,mode){
  if(mode === "undefined") { mode = "default"; }

  let LES = calculate_LES(item); //1.0 - (2.0 * (Math.abs((item.enAmount/(item.enAmount + item.frAmount))-0.5)));
  let LES_delta = LES - LES_calcstore.format_LES_previous_LES;
  LES_calcstore.format_LES_previous_LES = LES;
  let LES_pkg = get_LES_rank(LES);
  let htmlReturn = "";
  if(mode == "badge") {
    htmlReturn = `<mark>⚖️∆LES ${formatter.format(LES_delta.toFixed(2))}</mark> <mark>🎯LES ${LES.toFixed(2)} ${LES_pkg.rank}</mark>`;
  } else {
    htmlReturn = `<blockquote><kbd>🎯Language Equilibrium Score ${LES.toFixed(2)}</kbd><br />${LES_pkg.summary}</blockquote>`;
  }
  return htmlReturn; 
};

const generate_metrics = function(result) {
  let enAmount = 0;
  let frAmount = 0;
  let runningAmount = 0;
  const speakerMetrics = {};
  const speakerChanges = [];
  alt_lang = { "music": 0 }; 
  
  result.forEach((item, index) => {
    const amount = (item.end != null && item.start != null) ? (item.end - item.start) : 0;

    if(is_closed_caption_text(item.text) == true) {
        make_cc_metric({
          text: item.text, language: item.language,
          start: item.start, end: item.end, amount: amount, speaker: item.speaker
        })
      return;
    }

    transcript_frame.insertAdjacentHTML("beforeend", 
      make_transcript_entry({
        text: item.text, language: item.language,
        start: item.start, end: item.end, amount: amount, speaker: item.speaker
      })
    );
    if (!speakerMetrics[item.speaker]) { speakerMetrics[item.speaker] = { en: 0, fr: 0, total: 0 }; }
    if (item.language === "en") { enAmount += amount; speakerMetrics[item.speaker].en += amount; speakerMetrics[item.speaker].total += amount; } 
    else if (item.language === "fr") { frAmount += amount; speakerMetrics[item.speaker].fr += amount; speakerMetrics[item.speaker].total += amount; }
    
    if (index > 0 && item.speaker !== result[index - 1].speaker) {
      const LES = calculate_LES({ enAmount, frAmount });
      speakerChanges.push([ runningAmount, LES, item.speaker ]);
    }
    
    runningAmount += amount;
    add_metric(runningAmount, calculate_LES({ "enAmount": enAmount, "frAmount": frAmount }).toFixed(2), item.speaker, item.language);

    transcript_frame.insertAdjacentHTML("beforeend", format_LES({ "enAmount": enAmount, "frAmount": frAmount, "total": runningAmount },"badge"));
  });

  const total = enAmount + frAmount;
  const enPercent = (enAmount / total) * 100;
  const frPercent = (frAmount / total) * 100;
  
  analysis_frame.insertAdjacentHTML("beforeend", make_analysis_entry({ enPercent, enAmount, frPercent, frAmount, total, speakerMetrics }));
  update_chart(speakerChanges);
  update_language_timeline(result);
  update_speaker_timeline(result);
  cc_frame.insertAdjacentHTML("beforeend", format_cc_summary());
};

const process_event_transcript_custom = function(el_parsed) {
  clear_analysis();
  dismiss_error();

  const result = el_parsed.segments.map(transcript => {
    return {
      text: transcript.text,
      channel: 0, language: detector.detect(transcript.text).language,
      start: transcript.start_time, end: transcript.end_time,
      speaker: transcript.speaker.name
    };
  });

  generate_metrics(result);
};

const process_event_transcript_default = function(el_parsed) {
  clear_analysis();
  dismiss_error();

  const result = el_parsed.transcripts.map(transcript => {
    const words = (transcript.words ?? []).filter(word => word.type === "word");
    return {
      text: transcript.text,
      channel: transcript.channel_index, language: transcript.language_code,
      start: words[0]?.start, end: words[words.length - 1]?.end,
      speaker: words[0]?.speaker_id
    };
  });

  generate_metrics(result);
};

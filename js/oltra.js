// 11 Labs Default Formats https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription
// Custom format based on event transcript format provided by user
// Lang detection via ELD
/* https://github.com/nitotm/efficient-language-detector-js/tree/main
  const detector = eld.newInstance() // Isolated configuration instance. (Instances introduced in v2.1.0)
  console.log( detector.detect('Hola, cómo te llamas?') )
  // { language: 'es', getScores(): {'es': 0.5, 'et': 0.2}, isReliable(): true }
  // returns { language: string, getScores(): Object, isReliable(): boolean } 
  console.log( detector.detect('Hola, cómo te llamas?').language )
  // 'es'
  alert("Custom Process");
*/

const chart = echarts.init(document.getElementById('chart'));
const data = [];
const addMetric = function(seconds, les) { data.push([seconds, les]); }
const time = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`;
const display_chart = function() { document.getElementById('chart').style.display = 'block'; requestAnimationFrame(() => chart.resize()); };
const hide_chart = function() { document.getElementById('chart').style.display='none'; };
hide_chart();
const updateChart = function() {
  const displayData = data.map(([x, y]) => [x, Math.max(y, 0.5)]);
  chart.setOption({
    xAxis: { max: data.length ? data.at(-1)[0].toFixed(0) : 0 },
    series: [{ data: displayData }]
  });
  display_chart();
};
chart.setOption({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line' },
    formatter: p => {
      const index = p[0].dataIndex;
      const [seconds, les] = data[index];
      const status = les >= 0.85 ? 'Excellent'
                   : les >= 0.7 ? 'Acceptable'
                   : 'Imbalance';
      return `${time(seconds.toFixed(0))}<br>LES: <b>${les}</b> — ${status}`;
    }
  },
  grid: { left: 55, right: 20, top: 35, bottom: 45 },
  xAxis: {
    type: 'value', min: 0,
    name: 'Speaking Time', nameLocation: 'middle', nameGap: 30,
    axisLabel: { formatter: time }
  },
  yAxis: {
    type: 'value', min: 0.5, max: 1,
    name: 'Language Equilibrium', nameLocation: 'middle', nameGap: 40
  },
  series: [{
    type: 'line',
    data,
    smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#2563eb' },
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
addEventListener('resize', () => chart.resize());

const detector = eld.newInstance();
detector.setLanguageSubset(['en', 'fr']);

const fileInput = document.getElementById("json-file");
const dropZone = document.getElementById("drop-zone");
const transcript_frame = document.getElementById("otranscript");
const analysis_frame = document.getElementById("oanalysis");
const file_frame = document.getElementById("ofile");

const display_error = function() {
  document.getElementById('error-alert').style.display='block';
};
const dismiss_error = function() {
  document.getElementById('error-alert').style.display='none';
};
const clear_analysis = function() {
  transcript_frame.innerHTML = "";
  analysis_frame.innerHTML = "";
  file_frame.innerHTML = "";
  data.length = 0;
  LES_calcstore.format_LES_previous_LES = 0;
};

async function load_json(file) {
  if (!file) { return; }
  try {
    const text = await file.text();
    const parse_format = document.querySelector('input[name="parse-format"]:checked')?.value;
    
    let el_parsed = JSON.parse(text);
    if(parse_format == "el_custom") {
      if (!Array.isArray(el_parsed.segments)) { throw new Error("Invalid transcript format: 'segments' array not found."); }
      process_event_transcript_custom(el_parsed);
    } else if(parse_format == "el_default") {
      if (!Array.isArray(el_parsed.transcripts)) { throw new Error("Invalid transcript format: 'transcripts' array not found."); }
      process_event_transcript_default(el_parsed);
    }
    file_frame.innerHTML = `<h2>📑 ${file.name}</h2>`;
  } catch (error) {
    console.error(error);
    display_error();
  }
};
fileInput.addEventListener("change", function(event) { load_json(event.target.files[0]); });
dropZone.addEventListener("dragover", function(event) { event.preventDefault(); dropZone.classList.add("dragging"); });
dropZone.addEventListener("dragleave", function() { dropZone.classList.remove("dragging"); });
dropZone.addEventListener("drop", function(event) { event.preventDefault(); dropZone.classList.remove("dragging"); const file = event.dataTransfer.files[0]; load_json(file); });

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

  result.forEach((item) => {
    const amount = (item.end != null && item.start != null) ? (item.end - item.start) : 0;
    transcript_frame.insertAdjacentHTML("beforeend", 
      make_transcript_entry({
        text: item.text, language: item.language,
        start: item.start, end: item.end, amount: amount, speaker: item.speaker
      })
    );
    if (!speakerMetrics[item.speaker]) { speakerMetrics[item.speaker] = { en: 0, fr: 0, total: 0 }; }
    if (item.language === "en") { enAmount += amount; speakerMetrics[item.speaker].en += amount; speakerMetrics[item.speaker].total += amount; } 
    else if (item.language === "fr") { frAmount += amount; speakerMetrics[item.speaker].fr += amount; speakerMetrics[item.speaker].total += amount; }
    runningAmount += amount;
    addMetric(runningAmount, calculate_LES({ "enAmount": enAmount, "frAmount": frAmount }).toFixed(2));

    transcript_frame.insertAdjacentHTML("beforeend", format_LES({ "enAmount": enAmount, "frAmount": frAmount, "total": runningAmount },"badge"));
  });

  const total = enAmount + frAmount;
  const enPercent = (enAmount / total) * 100;
  const frPercent = (frAmount / total) * 100;
  
  analysis_frame.insertAdjacentHTML("beforeend", make_analysis_entry({ enPercent, enAmount, frPercent, frAmount, total, speakerMetrics }));
  updateChart();
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
    //const words = transcript.words.filter(word => word.type === "word");
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

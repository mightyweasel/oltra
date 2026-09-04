// 11 Labs Default Formats https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription
// Custom format based on event transcript format provided by user
// Lang detection via ELD https://github.com/nitotm/efficient-language-detector-js/tree/main
const oltra = {
  init: function(){
    oltra.ui.hide_chart();
    oltra.charting.cache.chart = echarts.init(oltra.dom.chart);
    oltra.charting.cache.languageTimelineChart = echarts.init(oltra.dom.langtimeline);
    oltra.charting.cache.speakerTimelineChart = echarts.init(oltra.dom.speakertimeline);
    window.addEventListener('resize', () => { oltra.charting.cache.chart.resize(); oltra.charting.cache.languageTimelineChart.resize(); oltra.charting.cache.speakerTimelineChart.resize(); });
    window.addEventListener('beforeprint', () => { oltra.charting.cache.chart.resize(); oltra.charting.cache.languageTimelineChart.resize(); oltra.charting.cache.speakerTimelineChart.resize(); });
    oltra.tools.detector.setLanguageSubset(['en', 'fr']);
    oltra.dom.file_input.addEventListener("change", function(event) { oltra.tools.load_json(event.target.files[0]); });
    oltra.dom.drop_zone.addEventListener("dragover", function(event) { event.preventDefault(); oltra.dom.drop_zone.classList.add("dragging"); });
    oltra.dom.drop_zone.addEventListener("dragleave", function() { oltra.dom.drop_zone.classList.remove("dragging"); });
    oltra.dom.drop_zone.addEventListener("drop", function(event) { event.preventDefault(); oltra.dom.drop_zone.classList.remove("dragging"); const file = event.dataTransfer.files[0]; oltra.tools.load_json(file); });
    oltra.state.alt_lang = { "music": 0 }; 
    oltra.charting.set_les_timeline_options();
  },
  dom: {
    chart: document.getElementById('chart'),
    langtimeline: document.getElementById('language-timeline'),
    speakertimeline: document.getElementById('speaker-timeline'),
    file_input: document.getElementById("json-file"),
    drop_zone: document.getElementById("drop-zone"),
    transcript_frame: document.getElementById("otranscript"),
    cc_frame: document.getElementById("cc-items"),
    analysis_frame: document.getElementById("oanalysis"),
    file_frame: document.getElementById("ofile"),
    error_alert: document.getElementById('error-alert'),
  },
  state: {
    alt_lang: {},
    LES_calcstore: { "format_LES_previous_LES": 0 },
    data: [],
    segments_lang: [],
    segments_speaker: [],
  },
  config: {
    chart_grid: { left: 60,  right: 20,  top: 35,  bottom: 45 },
    LES_ranges: {
      "Excellent": "<strong>Excellent Baseline:</strong> Highly balanced. Proves robust bilingual integration across the event agenda.",
      "Acceptable": "<strong>Acceptable Compliance:</strong> Satisfactory. One language slightly dominated, but both communities had significant, active platforms.",
      "Imbalance": "<strong>Linguistic Imbalance:</strong> Marginal compliance. Indicates that the event leaned heavily unilingual."
    },
  },
  tools: {
    detector: eld.newInstance(),
    formatter: new Intl.NumberFormat('en-US', { signDisplay: 'always' }),
    time: s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`,
    get_initials: name => name.trim().split(/\s+/).map(part => part[0].toUpperCase()).join(''),
    get_initials_twochar: name => { const parts = name.trim().split(/\s+/); return (parts[0][0] + parts.at(-1)[0]).toUpperCase(); },
    is_closed_caption_text: function(text) { return (text.trim().slice(0,1) === "[" && ( text.trim().slice(-2) === "]." || text.trim().slice(-1) === "]")); },
    format_percent: function(item){ return `${item.toFixed(2)}%`; },
    load_json: async function(file) {
      if (!file) { return; }
      try {
        const text = await file.text();
        let el_parsed = JSON.parse(text);
        if (Array.isArray(el_parsed.segments)) { oltra.calc.process_event_transcript_custom(el_parsed); } 
        else if (Array.isArray(el_parsed.transcripts)) { oltra.calc.process_event_transcript_default(el_parsed); }
        else { throw new Error("Invalid transcript format: Expected structures not found."); }
        oltra.dom.file_frame.innerHTML = `<h2>📑 ${file.name}</h2>`;
      } catch (error) {
        console.error(error);
        oltra.ui.display_error();
      }
    },
    format_duration: function(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}m ${secs}s`;
    },
  },
  ui: {
    display_error: function() { oltra.dom.error_alert.style.display='block'; },
    dismiss_error: function() { oltra.dom.error_alert.style.display='none'; },
    display_chart: function() { 
      oltra.dom.chart.style.display = 'block'; 
      oltra.dom.langtimeline.style.display = 'block'; 
      oltra.dom.speakertimeline.style.display = 'block'; 
      requestAnimationFrame(() => { oltra.charting.cache.chart.resize(); oltra.charting.cache.languageTimelineChart.resize(); oltra.charting.cache.speakerTimelineChart.resize(); }); 
    },
    hide_chart: function() { 
      oltra.dom.chart.style.display='none'; 
      oltra.dom.langtimeline.style.display='none'; 
      oltra.dom.speakertimeline.style.display='none'; 
    },
    make_transcript_entry: function(item) {
      return `<hr /><p>
        <kbd>${item.language} ${ item.amount != null ? oltra.tools.format_duration(item.amount) : "--" }</kbd>
        <em>${item.text}</em><br /> 
        <small>[${ item.start != null ? oltra.tools.format_duration(item.start) : "--" } - ${ item.end != null ? oltra.tools.format_duration(item.end) : "--" }]</small>
        <sub>— ${item.speaker}</sub>
        </p>`;
    },
    make_cc_summary: function() {
      let alts_html = ``; 
      let alts_html_music = ``; 
      let alts_html_lang = ``;
      if(oltra.state.alt_lang.music != 0) { alts_html_music = `<p><em>Music:</em> <strong>${ oltra.tools.format_duration(oltra.state.alt_lang["music"]) }</strong></p>`; }
      for (const [category, amount] of Object.entries(oltra.state.alt_lang)) { if (category !== "music") { 
        alts_html_lang += `<p><em>${category.charAt(0).toUpperCase() + category.slice(1)}:</em> <strong>${oltra.tools.format_duration(amount)}</strong></p>`; } 
      }
      if(alts_html_music != `` || alts_html_lang != ``) { alts_html = "<h3>Other Audio Detected</h3>" + alts_html_music + alts_html_lang; }
      return alts_html;
    },
    make_LES: function(item,mode){
      if(mode === "undefined") { mode = "default"; }
      let LES = oltra.calc.calculate_LES(item); //1.0 - (2.0 * (Math.abs((item.enAmount/(item.enAmount + item.frAmount))-0.5)));
      let LES_delta = LES - oltra.state.LES_calcstore.format_LES_previous_LES;
      oltra.state.LES_calcstore.format_LES_previous_LES = LES;
      let LES_pkg = oltra.calc.get_LES_rank(LES);
      let htmlReturn = "";
      if(mode == "badge") {
        htmlReturn = `<mark>⚖️∆LES ${oltra.tools.formatter.format(LES_delta.toFixed(2))}</mark> <mark>🎯LES ${LES.toFixed(2)} ${LES_pkg.rank}</mark>`;
      } else {
        htmlReturn = `<blockquote><kbd>🎯Language Equilibrium Score ${LES.toFixed(2)}</kbd><br />${LES_pkg.summary}</blockquote>`;
      }
      return htmlReturn; 
    },
    make_analysis_entry: function(item) {
      let speakerMetricsHTML = "";
      let speaker_chart_height_multiplier = Math.ceil(Object.entries(item.speakerMetrics).length / 5);
      oltra.dom.speakertimeline.style.setProperty('--height-multiplier', speaker_chart_height_multiplier);

      for (const [speaker, { en, fr, total }] of Object.entries(item.speakerMetrics)) {
        speakerMetricsHTML += `<tr>
          <th scope="row"><small>${speaker}</small></th>
          <td><small>${oltra.tools.format_percent( (en/total)*100 )} (${oltra.tools.format_duration(en)})</small></td>
          <td><small>${oltra.tools.format_percent( (fr/total)*100 )} (${oltra.tools.format_duration(fr)})</small></td>
          <td><small>${oltra.tools.format_duration(total)}</small></td>
        </tr>`;
      }
      
      return `<hgroup>
        <h3><mark>${oltra.tools.format_percent(item.enPercent)}</mark> English vs. <mark>${oltra.tools.format_percent(item.frPercent)}</mark> French</h3>
        ${oltra.ui.make_LES(item)}
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
              <td><strong>${oltra.tools.format_duration(item.enAmount)}</strong></td>
              <td><strong>${oltra.tools.format_duration(item.frAmount)}</strong></td>
              <td><strong>${oltra.tools.format_duration(item.total)}</strong></td>
            </tr>
            ${speakerMetricsHTML}
          </tbody>
        </table>
        </hgroup>`;
    },
  },
  calc: {
    add_metric: function(seconds, les, speaker, lang) { oltra.state.data.push([seconds, les, speaker, lang]); },
    clear_analysis: function() {
      // dom
      oltra.dom.transcript_frame.innerHTML = "";
      oltra.dom.cc_frame.innerHTML = "";
      oltra.dom.analysis_frame.innerHTML = "";
      oltra.dom.file_frame.innerHTML = "";
      // vals
      oltra.state.alt_lang = {};
      oltra.state.data.length = 0;
      oltra.state.LES_calcstore.format_LES_previous_LES = 0;
      oltra.state.segments_lang.length = 0;
      oltra.state.segments_speaker.length = 0;
    },
    calc_cc_metric: function(item){
      const normalizedText = item.text.toLowerCase();
      const musicChunks = ["music", "chime", "musique", "générique", "generic", "jingle"];
      const containsMusic = musicChunks.some(chunk => normalizedText.includes(chunk));
      if(containsMusic == true) {
        oltra.state.alt_lang["music"] += item.amount;
        return;
      }
      
      const speakingMatches = normalizedText.match(/\[speaking\s+([^\]]+)\]/gi) || [];
      const languages = new Set(speakingMatches.map(match => match.replace(/^\[speaking\s+/i, "").replace(/\]$/, "").trim().toLowerCase()));

      for (const language of languages) {
        const category = `${language}`;
        oltra.state.alt_lang[category] = (oltra.state.alt_lang[category] || 0) + item.amount;
      }
    },
    calculate_LES: function(item){
      let LES = 1.0 - (2.0 * (Math.abs((item.enAmount/(item.enAmount + item.frAmount))-0.5)));
      return LES;
    },
    get_LES_rank: function(LES) {
      let LES_rank = "Imbalance";
      if(LES >= 0.85) { LES_rank = "Excellent"; } 
      else if(LES < 0.85 && LES >= 0.70) { LES_rank = "Acceptable"; } 
      else if(LES < 0.70) { LES_rank = "Imbalance"; }
      return { "rank": LES_rank, "summary": oltra.config.LES_ranges[LES_rank] };
    },
    process_event_transcript_custom: function(el_parsed) {
      oltra.calc.clear_analysis();
      oltra.ui.dismiss_error();
      const result = el_parsed.segments.map(transcript => {
        return {
          text: transcript.text,
          channel: 0, language: oltra.tools.detector.detect(transcript.text).language,
          start: transcript.start_time, end: transcript.end_time,
          speaker: transcript.speaker.name
        };
      });
      oltra.calc.generate_metrics(result);
    },
    process_event_transcript_default: function(el_parsed) {
      oltra.calc.clear_analysis();
      oltra.ui.dismiss_error();
      const result = el_parsed.transcripts.map(transcript => {
        const words = (transcript.words ?? []).filter(word => word.type === "word");
        return {
          text: transcript.text,
          channel: transcript.channel_index, language: transcript.language_code,
          start: words[0]?.start, end: words[words.length - 1]?.end,
          speaker: words[0]?.speaker_id
        };
      });
      oltra.calc.generate_metrics(result);
    },
    generate_metrics: function(result) {
      let enAmount = 0;
      let frAmount = 0;
      let runningAmount = 0;
      const speakerMetrics = {};
      const speakerChanges = [];
      oltra.state.alt_lang = { "music": 0 }; 
      
      result.forEach((item, index) => {
        const amount = (item.end != null && item.start != null) ? (item.end - item.start) : 0;
        if(oltra.tools.is_closed_caption_text(item.text) == true) {
          oltra.calc.calc_cc_metric({
            text: item.text, language: item.language,
            start: item.start, end: item.end, amount: amount, speaker: item.speaker
          });
          return;
        }
        oltra.dom.transcript_frame.insertAdjacentHTML("beforeend", 
          oltra.ui.make_transcript_entry({
            text: item.text, language: item.language,
            start: item.start, end: item.end, amount: amount, speaker: item.speaker
          })
        );
        if (!speakerMetrics[item.speaker]) { speakerMetrics[item.speaker] = { en: 0, fr: 0, total: 0 }; }
        if (item.language === "en") { enAmount += amount; speakerMetrics[item.speaker].en += amount; speakerMetrics[item.speaker].total += amount; } 
        else if (item.language === "fr") { frAmount += amount; speakerMetrics[item.speaker].fr += amount; speakerMetrics[item.speaker].total += amount; }
        
        if (index > 0 && item.speaker !== result[index - 1].speaker) {
          const LES = oltra.calc.calculate_LES({ enAmount, frAmount });
          speakerChanges.push([ runningAmount, LES, item.speaker ]);
        }
        
        runningAmount += amount;
        oltra.calc.add_metric(runningAmount, oltra.calc.calculate_LES({ "enAmount": enAmount, "frAmount": frAmount }).toFixed(2), item.speaker, item.language);

        oltra.dom.transcript_frame.insertAdjacentHTML("beforeend", oltra.ui.make_LES({ "enAmount": enAmount, "frAmount": frAmount, "total": runningAmount },"badge"));
      });

      const total = enAmount + frAmount;
      const enPercent = (enAmount / total) * 100;
      const frPercent = (frAmount / total) * 100;
      
      oltra.dom.analysis_frame.insertAdjacentHTML("beforeend", oltra.ui.make_analysis_entry({ enPercent, enAmount, frPercent, frAmount, total, speakerMetrics }));
      oltra.charting.update_chart(speakerChanges);
      oltra.charting.update_language_timeline(result);
      oltra.charting.update_speaker_timeline(result);
      oltra.dom.cc_frame.insertAdjacentHTML("beforeend", oltra.ui.make_cc_summary());
    },
  },
  charting: {
    cache: {
      chart: null, //echarts.init(oltra.dom.chart),
      languageTimelineChart: null, //echarts.init(oltra.dom.langtimeline),
      speakerTimelineChart: null, //echarts.init(oltra.dom.speakertimeline)
    },
    update_chart: function(speakerChanges) {
      const displayData = oltra.state.data.map(([x, y, z]) => [x, Math.max(y, 0.5), z]);
      oltra.charting.cache.chart.setOption({
        xAxis: { max: oltra.state.data.length ? oltra.state.data.at(-1)[0].toFixed(0) : 0 },
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
      oltra.ui.display_chart();
    },
    update_language_timeline: function(result) {
      let runningAmount = 0;
      result.forEach(item => {
        if (oltra.tools.is_closed_caption_text(item.text) == true || (item.language !== 'en' && item.language !== 'fr') || item.start == null || item.end == null || item.end <= item.start) { return; }
        const amount = item.end - item.start;
        const startAirtime = runningAmount;
        const endAirtime = runningAmount + amount;
        oltra.state.segments_lang.push({ start: startAirtime, end: endAirtime, amount: amount, language: item.language, speaker: item.speaker });
        runningAmount = endAirtime;
      });
      oltra.charting.set_language_timeline_options();
    },
    update_speaker_timeline: function(result) {
      let runningAmount = 0;
      result.forEach(item => {
        if (oltra.tools.is_closed_caption_text(item.text) == true || (item.language !== 'en' && item.language !== 'fr') || item.start == null || item.end == null || item.end <= item.start) { return; }
        const amount = item.end - item.start;
        const startAirtime = runningAmount;
        const endAirtime = runningAmount + amount;
        oltra.state.segments_speaker.push({ start: startAirtime, end: endAirtime, amount: amount, language: item.language, speaker: item.speaker });
        runningAmount = endAirtime;
      });
      oltra.charting.set_speaker_timeline_options();
    },
    set_speaker_timeline_options: function() {
      oltra.charting.cache.speakerTimelineChart.setOption({
        animation: false,
        xAxis: { 
          max: oltra.state.data.length ? oltra.state.data.at(-1)[0].toFixed(0) : 0, axisLabel: { formatter: oltra.tools.time },
          axisLine: { show: true },
          name: 'Speaking Time', nameLocation: 'middle', nameGap: 30, nameTextStyle: { fontWeight: 'bold' } 
        },
        tooltip: {
          trigger: 'item',
          formatter: params => {
            const item = params.data;
            return `<strong>${item.language === 'en' ? 'English' : 'French'}</strong><br>Airtime: ${oltra.tools.time(item.start.toFixed(0))} - ${oltra.tools.time(item.end.toFixed(0))}<br>
              Duration: <strong>${oltra.tools.format_duration(item.amount)}</strong><br>Speaker: ${item.speaker}<br>`;
          }
        },
        grid: oltra.config.chart_grid,
        yAxis: { name: 'Speaker', nameLocation: 'middle', //nameGap: 40, 
          type: 'category', 
          inverse: true, axisTick: { show: false },
          nameTextStyle: { fontWeight: 'bold' }, 
          axisLabel: { formatter: value => oltra.tools.get_initials_twochar(value) }
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
          data: oltra.state.segments_speaker.map(item => ({
            value: [ item.start, item.end, item.speaker],//item.language === 'en' ? 0 : 1 ],
            language: item.language, speaker: item.speaker, start: item.start, end: item.end, amount: item.amount
          }))
        }]
      });
    },
    set_language_timeline_options: function() {
      oltra.charting.cache.languageTimelineChart.setOption({
        animation: false,
        xAxis: { 
          max: oltra.state.data.length ? oltra.state.data.at(-1)[0].toFixed(0) : 0, axisLabel: { formatter: oltra.tools.time }//,
          //name: 'Speaking Time', nameLocation: 'middle', nameGap: 30
        },
        tooltip: {
          trigger: 'item',
          formatter: params => {
            const item = params.data;
            return `<strong>${item.language === 'en' ? 'English' : 'French'}</strong><br>Airtime: ${oltra.tools.time(item.start.toFixed(0))} - ${oltra.tools.time(item.end.toFixed(0))}<br>
              Duration: <strong>${oltra.tools.format_duration(item.amount)}</strong><br>Speaker: ${item.speaker}<br>`;
          }
        },
        grid: oltra.config.chart_grid,
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
          data: oltra.state.segments_lang.map(item => ({
            value: [ item.start, item.end, item.language === 'en' ? 0 : 1 ],
            language: item.language, speaker: item.speaker, start: item.start, end: item.end, amount: item.amount
          }))
        }]
      });
    },
    set_les_timeline_options: function() {
      oltra.charting.cache.chart.setOption({
        tooltip: {
          trigger: 'axis', axisPointer: { type: 'line' },
          formatter: p => {
            const index = p[0].dataIndex;
            const [seconds, les, speaker, lang] = oltra.state.data[index];
            const status = les >= 0.85 ? 'Excellent' : les >= 0.7 ? 'Acceptable' : 'Imbalance';
            return `${oltra.tools.time(seconds.toFixed(0))}<br />${speaker} (${lang})<br />LES: <b>${les}</b> — ${status}`;
          }
        },
        grid: oltra.config.chart_grid,
        xAxis: { type: 'value', min: 0, axisLabel: { formatter: oltra.tools.time } }, //name: 'Speaking Time', nameLocation: 'middle', nameGap: 30,
        yAxis: { type: 'value', min: 0.5, max: 1, name: 'Equilibrium', nameLocation: 'middle', nameGap: 40, nameTextStyle: { fontWeight: 'bold' } },
        series: [{
          type: 'line', data: oltra.state.data, smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#2563eb' },
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
    }
  }  
};

oltra.init();
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
    oltra.dom.lang_toggle.addEventListener('click', function(event) { event.preventDefault(); const nextLang = oltra.state.ui_lang === 'en' ? 'fr' : 'en'; oltra.ui.set_language(nextLang); });
    oltra.state.alt_lang = { "music": 0 }; 
    oltra.charting.set_les_timeline_options();
    oltra.i18n.translate_ui();
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
    lang_toggle: document.getElementById('language-toggle')
  },
  state: {
    ui_lang: 'en',
    alt_lang: {},
    LES_calcstore: { "format_LES_previous_LES": 0 },
    data: [],
    segments_lang: [],
    segments_speaker: [],
  },
  i18n: {
    t: function(key) {
      return oltra.i18n.translations[oltra.state.ui_lang]?.[key]
        ?? oltra.i18n.translations.en[key]
        ?? key;
    },
    translate_ui: function() {
      document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = oltra.i18n.t(element.dataset.i18n);
      });
    },
    translations: {
      en: {
        app_subtitle: "OL Event Transcript Analysis",
        error_title: "⛔ Error",
        error_message: "There was a problem processing your request.",
        upload_instructions: "Drag and drop files here or",
        browse: "browse",
        les_full: "Language Equilibrium Score",
        les: "LES",
        speaker: "Speaker",
        english: "English",
        french: "French",
        airtime: "Airtime",
        duration: "Duration",
        total: "Total",
        words: "Words",
        speaking_time: "Speaking Time",
        language: "Language",
        equilibrium: "Equilibrium",
        analysis: "Analysis",
        other_audio: "Other Audio Detected",
        music: "Music",
        les_excellent: "Excellent",
        les_excellent_full: "Excellent Baseline",
        les_excellent_full_desc: "Highly balanced. Proves robust bilingual integration across the event agenda.",
        les_acceptable: "Acceptable",
        les_acceptable_full: "Acceptable Balance",
        les_acceptable_full_desc: "Satisfactory. One language slightly dominated, but both communities had significant, active platforms.",
        les_imbalance: "Imbalance",
        les_imbalance_full: "Linguistic Imbalance",
        les_imbalance_full_desc: "Marginal compliance. Indicates that the event leaned heavily unilingual.",
        disclaimer: "Outputs are intended as an analytical reference to support event evaluation and informed human review. OLTRA does not independently assess equivalent information, context, engagement, or overall event experiences, nor does it constitute an assessment of compliance."
      },
      fr: {
        app_subtitle: "Analyse des transcriptions d'événements",
        error_title: "⛔ Erreur",
        error_message: "Un problème est survenu lors du traitement de votre demande.",
        upload_instructions: "Glissez-déposez vos fichiers ici ou",
        browse: "parcourir",
        les_full: "Score d'équilibre linguistique",
        les: "SEL",
        speaker: "Intervenant",
        english: "Anglais",
        french: "Français",
        airtime: "Temps d'antenne",
        duration: "Durée",
        total: "Total",
        words: "Mots",
        speaking_time: "Temps de parole",
        language: "Langue",
        analysis: "Analyse",
        equilibrium: "Équilibre",
        other_audio: "Autres éléments audio détectés",
        music: "Musique",
        les_excellent: "Excellent",
        les_excellent_full: "Excellente ligne de base",
        les_excellent_full_desc: "Très équilibré. Montre une intégration bilingue robuste dans l'agenda de l'événement.",
        les_acceptable: "Acceptable",
        les_acceptable_full: "Équilibre acceptable",
        les_acceptable_full_desc: "Satisfaisant. Une langue domine légèrement, mais les deux communautés ont eu des plateformes significatives et actives.",
        les_imbalance: "Déséquilibre",
        les_imbalance_full: "Déséquilibre linguistique",
        les_imbalance_full_desc: "Conformité marginale. Indique que l'événement était fortement unilingue.",
        disclaimer: "Les résultats sont destinés à servir de référence analytique pour soutenir l'évaluation des événements et la révision humaine éclairée. OLTRA n'évalue pas de manière indépendante les informations, le contexte, l'engagement ou les expériences globales de l'événement, et ne constitue pas une évaluation de la conformité."
      }
    },
  },
  config: {
    chart_grid: { left: 60,  right: 20,  top: 35,  bottom: 45 },
    LES_ranges: function(les_range){ 
      return `<strong>${oltra.i18n.t(les_range + "_full")}:</strong> ${oltra.i18n.t(les_range + "_full_desc")}`;
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
        // SRT Test
        const srtBlockRegex = /^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}\r?\n.+/s;
        const isValidSRT = srtBlockRegex.test(text);
        // WebVTT Test
        const vttRegex = /^WEBVTT(?:[ \t].*)?(?:\r?\n|$)[\s\S]*?\d{2}:\d{2}(?::\d{2})?\.\d{3}\s-->\s\d{2}:\d{2}(?::\d{2})?\.\d{3}/;
        const isValidVTT = vttRegex.test(text.trimStart());
        
        let el_parsed = "";
        if(isValidSRT) { el_parsed = oltra.tools.repack_srt_as_json(text); }
        else if(isValidVTT) { el_parsed = oltra.tools.repack_vtt_as_json(text); } 
        else { el_parsed = JSON.parse(text); }
        if (Array.isArray(el_parsed.segments)) { oltra.calc.process_event_transcript_custom(el_parsed); } 
        else if (Array.isArray(el_parsed.transcripts)) { oltra.calc.process_event_transcript_default(el_parsed); }
        else { throw new Error("Invalid transcript format: Expected structures not found."); }
        oltra.dom.file_frame.innerHTML = `<h2>📑 ${file.name}</h2>`;
      } catch (error) {
        console.error(error);
        oltra.ui.display_error();
      }
    },
    repack_srt_timecode_sec: function toSeconds(timestamp) {
      const [time, ms] = timestamp.split(",");
      const [hours, minutes, seconds] = time.split(":").map(Number);
      return (hours * 3600) + (minutes * 60) + seconds + (Number(ms) / 1000);
    },
    repack_vtt_timecode_sec: function(timecode) {
      const parts = timecode.split(':');
      let hours = 0, minutes = 0, seconds = 0;
      if (parts.length === 3) { hours = parseInt(parts[0], 10); minutes = parseInt(parts[1], 10); seconds = parseFloat(parts[2]); } 
      else { minutes = parseInt(parts[0], 10); seconds = parseFloat(parts[1]); }
      return hours * 3600 + minutes * 60 + seconds;
    },
    repack_srt_parse: function(srt) {
      const blocks = srt.trim().split(/\r?\n\r?\n/);
      return blocks.map(block => {
        const match = block.match(/^\d+\r?\n(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]+)$/);
        if (!match) return null;
        return {
          "start_time": oltra.tools.repack_srt_timecode_sec( match[1] ),
          "end_time": oltra.tools.repack_srt_timecode_sec( match[2] ),
          "text": match[3],
          "words": [], "speaker": { "id": "SRT-T", "name": "SRT" }
        };
      }).filter(Boolean);    
    },
    repack_vtt_parse: function(vtt) {
      const blocks = vtt.trim().replace(/^\uFEFF/, '').split(/\r?\n\r?\n/);
      const speakers = {};
      return blocks.map(block => {
        if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block)) { return null; } // Skip header and metadata blocks
        const lines = block.split(/\r?\n/);
        const timeIndex = lines.findIndex(line => /^\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->/.test(line)); // Locate timestamp line (cue identifiers are optional)
        if (timeIndex === -1 || timeIndex === lines.length - 1) { return null; }
        const match = lines[timeIndex].match(/^(\d{2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{2}:\d{2}(?::\d{2})?\.\d{3})/);
        if (!match) return null;
        let caption = lines.slice(timeIndex + 1).join('\n');
        let speakerName = null;
        // Method 1: WebVTT voice tags: <v John Smith>
        const voiceMatch = caption.match(/<v(?:\.[^ >]+)?\s+([^>]+)>/);
        if (voiceMatch) {
          speakerName = voiceMatch[1].trim();
          caption = caption.replace(/<\/?v(?:\.[^ >]+)?(?:\s+[^>]*)?>/g, '');
        }
        // Method 2: Teams-style speaker prefix: John Smith: Text
        if (!speakerName) {
          const prefixMatch = caption.match(/^([^:\n]+):\s*/);
          if (prefixMatch) {
            speakerName = prefixMatch[1].trim();
            caption = caption.replace(/^([^:\n]+):\s*/, '');
          }
        }
        // Assign consistent speaker IDs
        let speaker = { "id": "VTT-T", "name": "VTT" };
        if (speakerName) {
          if (!speakers[speakerName]) {
            speakers[speakerName] = { "id": "VTT-" + (Object.keys(speakers).length + 1), "name": speakerName };
          }
          speaker = speakers[speakerName];
        }
        // Remove remaining WebVTT formatting tags
        caption = caption.replace(/<\/?(?:b|i|u|c(?:\.[^ >]+)?|ruby|rt)(?:\s+[^>]*)?>/g, '');

        return {
          "start_time": oltra.tools.repack_vtt_timecode_sec(match[1]),
          "end_time": oltra.tools.repack_vtt_timecode_sec(match[2]),
          "text": caption.trim(),
          "words": [], "speaker": speaker
        };

      }).filter(Boolean);
    },
    repack_srt_as_json: function(srt_input){
      let srt_json = { "language_code": "eng", "segments": [] };
      srt_json.segments = oltra.tools.repack_srt_parse( srt_input );
      return srt_json;
    },
    repack_vtt_as_json: function(srt_input){
      let vtt_json = { "language_code": "eng", "segments": [] };
      vtt_json.segments = oltra.tools.repack_vtt_parse( srt_input );
      return vtt_json;
    },
    format_duration: function(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}m ${secs}s`;
    },
  },
  ui: {
    set_language: function(lang) {
      if (!oltra.i18n.translations[lang]) return;
      oltra.state.ui_lang = lang;
      oltra.i18n.translate_ui();
      document.getElementById('language-toggle').textContent = lang === 'en' ? 'Français' : 'English';
    
      oltra.charting.cache.chart.setOption({
        yAxis: { name: oltra.i18n.t('equilibrium') }
      });
      const languageChart = oltra.charting.cache.languageTimelineChart;
      if (languageChart.getOption()?.xAxis?.length && languageChart.getOption()?.yAxis?.length) {
        languageChart.setOption({
          yAxis: { name: oltra.i18n.t('language') }
        });
      }
      const speakerChart = oltra.charting.cache.speakerTimelineChart;
      if (speakerChart.getOption()?.xAxis?.length && speakerChart.getOption()?.yAxis?.length) {
        speakerChart.setOption({
          xAxis: { name: oltra.i18n.t('speaking_time') },
          yAxis: { name: oltra.i18n.t('speaker') }
        });
      }
    },
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
      if(oltra.state.alt_lang.music != 0) { alts_html_music = `<p><em>${oltra.i18n.t('music')}:</em> <strong>${ oltra.tools.format_duration(oltra.state.alt_lang["music"]) }</strong></p>`; }
      for (const [category, amount] of Object.entries(oltra.state.alt_lang)) { if (category !== "music") { 
        alts_html_lang += `<p><em>${category.charAt(0).toUpperCase() + category.slice(1)}:</em> <strong>${oltra.tools.format_duration(amount)}</strong></p>`; } 
      }
      if(alts_html_music != `` || alts_html_lang != ``) { alts_html = `<h3>${oltra.i18n.t('other_audio')}</h3>` + alts_html_music + alts_html_lang; }
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
        htmlReturn = `<mark>⚖️∆${oltra.i18n.t('les')} ${oltra.tools.formatter.format(LES_delta.toFixed(2))}</mark> <mark>🎯${oltra.i18n.t('les')} ${LES.toFixed(2)} ${LES_pkg.rank}</mark>`;
      } else {
        htmlReturn = `<blockquote><kbd>🎯${oltra.i18n.t('les_full')} ${LES.toFixed(2)}</kbd><br />${LES_pkg.summary}</blockquote>`;
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
        <h3><mark>${oltra.tools.format_percent(item.enPercent)}</mark> ${oltra.i18n.t('english')} vs. <mark>${oltra.tools.format_percent(item.frPercent)}</mark> ${oltra.i18n.t('french')}</h3>
        <small>
          <kbd>${oltra.i18n.t('words')}</kbd> 
          <strong>${item.enWords}</strong> ${oltra.i18n.t('english')} vs. <strong>${item.frWords}</strong> ${oltra.i18n.t('french')} 
          [${oltra.tools.format_percent(100*(item.enWords/(item.enWords+item.frWords)))} / ${oltra.tools.format_percent(100*(item.frWords/(item.enWords+item.frWords)))}]
        </small>
        ${oltra.ui.make_LES(item)}
        <table>
          <thead>
            <tr>
              <th scope="col">${oltra.i18n.t('speaker')}</th>
              <th scope="col">${oltra.i18n.t('english')}</th>
              <th scope="col">${oltra.i18n.t('french')}</th>
              <th scope="col">${oltra.i18n.t('total')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><strong>${oltra.i18n.t('total').toUpperCase()}</strong></th>
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
      let LES_rank = "les_imbalance";
      if(LES >= 0.85) { LES_rank = "les_excellent"; } 
      else if(LES < 0.85 && LES >= 0.70) { LES_rank = "les_acceptable"; } 
      else if(LES < 0.70) { LES_rank = "les_imbalance"; }
      return { "rank": `${oltra.i18n.t(LES_rank)}`, "summary": oltra.config.LES_ranges(LES_rank) };
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
      let enWords = 0;
      let frWords = 0;
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
        if (item.language === "en") { enWords += item.text.split(/\s+/).length; enAmount += amount; speakerMetrics[item.speaker].en += amount; speakerMetrics[item.speaker].total += amount; } 
        else if (item.language === "fr") { frWords += item.text.split(/\s+/).length; frAmount += amount; speakerMetrics[item.speaker].fr += amount; speakerMetrics[item.speaker].total += amount; }
        
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

      //console.log(`English words: ${enWords}, French words: ${frWords}`);
      
      oltra.dom.analysis_frame.insertAdjacentHTML("beforeend", oltra.ui.make_analysis_entry({ enPercent, enAmount, frPercent, frAmount, total, speakerMetrics, enWords, frWords }));
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
          name: `${oltra.i18n.t('speaking_time')}`, nameLocation: 'middle', nameGap: 30, nameTextStyle: { fontWeight: 'bold' } 
        },
        tooltip: {
          trigger: 'item',
          formatter: params => {
            const item = params.data;
            return `<strong>${item.language === 'en' ? oltra.i18n.t('english') : oltra.i18n.t('french')}</strong><br>${oltra.i18n.t('airtime')}: ${oltra.tools.time(item.start.toFixed(0))} - ${oltra.tools.time(item.end.toFixed(0))}<br>
              ${oltra.i18n.t('duration')}: <strong>${oltra.tools.format_duration(item.amount)}</strong><br>${oltra.i18n.t('speaker')}: ${item.speaker}<br>`;
          }
        },
        grid: oltra.config.chart_grid,
        yAxis: { name: `${oltra.i18n.t('speaker')}`, nameLocation: 'middle', //nameGap: 40, 
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
            return `<strong>${item.language === 'en' ? oltra.i18n.t('english') : oltra.i18n.t('french')}</strong><br>${oltra.i18n.t('airtime')}: ${oltra.tools.time(item.start.toFixed(0))} - ${oltra.tools.time(item.end.toFixed(0))}<br>
              ${oltra.i18n.t('duration')}: <strong>${oltra.tools.format_duration(item.amount)}</strong><br>${oltra.i18n.t('speaker')}: ${item.speaker}<br>`;
          }
        },
        grid: oltra.config.chart_grid,
        yAxis: { name: `${oltra.i18n.t('language')}`, nameLocation: 'middle', nameGap: 40, type: 'category', data: ['EN', 'FR'], inverse: true, axisTick: { show: false }, nameTextStyle: { fontWeight: 'bold' } },
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
            const status = les >= 0.85 ? oltra.i18n.t('les_excellent') : les >= 0.7 ? oltra.i18n.t('les_acceptable') : oltra.i18n.t('les_imbalance');
            return `${oltra.tools.time(seconds.toFixed(0))}<br />${speaker} (${lang})<br />${oltra.i18n.t('les')}: <b>${les}</b> — ${status}`;
          }
        },
        grid: oltra.config.chart_grid,
        xAxis: { type: 'value', min: 0, axisLabel: { formatter: oltra.tools.time } }, //name: 'Speaking Time', nameLocation: 'middle', nameGap: 30,
        yAxis: { type: 'value', min: 0.5, max: 1, name: `${oltra.i18n.t('equilibrium')}`, nameLocation: 'middle', nameGap: 40, nameTextStyle: { fontWeight: 'bold' } },
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
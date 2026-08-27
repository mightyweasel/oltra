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
const detector = eld.newInstance();
detector.setLanguageSubset(['en', 'fr']);

const fileInput = document.getElementById("json-file");
const dropZone = document.getElementById("drop-zone");
const transcript_frame = document.getElementById("otranscript");
const analysis_frame = document.getElementById("oanalysis");

const display_error = function() {
  document.getElementById('error-alert').style.display='block';
};
const dismiss_error = function() {
  document.getElementById('error-alert').style.display='none';
};
const clear_analysis = function() {
  transcript_frame.innerHTML = "";
  analysis_frame.innerHTML = "";
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
  return `<p>
    <kbd>${item.language} ${ item.amount != null ? format_duration(item.amount) : "--" }</kbd>
    <em>${item.text}</em> 
    <small>[${ item.start != null ? format_duration(item.start) : "--" } - ${ item.end != null ? format_duration(item.end) : "--" }]</small>
    <sub>— ${item.speaker}</sub>
    </p><hr />`;
};

const make_analysis_entry = function(item) {
  return `<hgroup>
    <h2><mark>${item.enPercent.toFixed(2)}%</mark> English vs. <mark>${item.frPercent.toFixed(2)}%</mark> French</h2>
    <p>Total: ${format_duration(item.total)} (EN: ${format_duration(item.enAmount)} vs. FR: ${format_duration(item.frAmount)})</p>
    </hgroup>`;
};

const format_duration = function(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
};

const generate_metrics = function(result) {
  let enAmount = 0;
  let frAmount = 0;
  result.forEach((item) => {
    const amount = (item.end != null && item.start != null) ? (item.end - item.start) : 0;
    transcript_frame.insertAdjacentHTML("beforeend", 
      make_transcript_entry({
        text: item.text, language: item.language,
        start: item.start, end: item.end, amount: amount, speaker: item.speaker
      })
    );
    if (item.language === "en") { enAmount += amount; } 
    else if (item.language === "fr") { frAmount += amount; }
  });

  const total = enAmount + frAmount;
  const enPercent = (enAmount / total) * 100;
  const frPercent = (frAmount / total) * 100;

  analysis_frame.insertAdjacentHTML("beforeend", make_analysis_entry({ enPercent, enAmount, frPercent, frAmount, total }));
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
    const words = transcript.words.filter(word => word.type === "word");
    return {
      text: transcript.text,
      channel: transcript.channel_index, language: transcript.language_code,
      start: words[0]?.start, end: words[words.length - 1]?.end,
      speaker: words[0]?.speaker_id
    };
  });

  generate_metrics(result);
};

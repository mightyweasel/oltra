// https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription

const fileInput = document.getElementById("json-file");
const dropZone = document.getElementById("drop-zone");
const transcript_frame = document.getElementById("otranscript");
const analysis_frame = document.getElementById("oanalysis");

async function load_json(file) {
  if (!file) { return; }
  try {
    const text = await file.text();
    let el_parsed = JSON.parse(text);
    process_event_transcript(el_parsed);
  } catch (error) {
    console.error(error);
    alert("Unable to load the JSON file.");
  }
}
fileInput.addEventListener("change", function(event) { load_json(event.target.files[0]); });
dropZone.addEventListener("dragover", function(event) { event.preventDefault(); dropZone.classList.add("dragging"); });
dropZone.addEventListener("dragleave", function() { dropZone.classList.remove("dragging"); });
dropZone.addEventListener("drop", function(event) { event.preventDefault(); dropZone.classList.remove("dragging"); const file = event.dataTransfer.files[0]; load_json(file); });
       
const process_event_transcript = function(el_parsed) {
  transcript_frame.innerHTML = "";
  analysis_frame.innerHTML = "";

  const format_duration = function(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const result = el_parsed.transcripts.map(transcript => {
    const words = transcript.words.filter(word => word.type === "word");
    return {
      text: transcript.text,
      channel: transcript.channel_index, language: transcript.language_code,
      start: words[0]?.start, end: words[words.length - 1]?.end,
      speaker: words[0]?.speaker_id
    };
  });

  const make_transcript_entry = function(item) {
    return `<p>
      <kbd>${item.language} ${ item.amount != null ? format_duration(item.amount) : "--" }</kbd>
      <em>${item.text}</em> 
      <small>[${ item.start != null ? format_duration(item.start) : "--" } - ${ item.end != null ? format_duration(item.end) : "--" }]</small>
      <sub>— ${item.speaker}</sub>
      </p><hr />`;
  };

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

  const make_analysis_entry = function(item) {
    return `<hgroup>
      <h2><mark>${item.enPercent.toFixed(2)}%</mark> English vs. <mark>${item.frPercent.toFixed(2)}%</mark> French</h2>
      <p>Total: ${format_duration(item.total)} (EN: ${format_duration(item.enAmount)} vs. FR: ${format_duration(item.frAmount)})</p>
      </hgroup>`;
  }
  analysis_frame.insertAdjacentHTML("beforeend", make_analysis_entry({ enPercent, enAmount, frPercent, frAmount, total }));
};

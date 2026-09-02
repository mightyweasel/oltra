# OLTRA - OL Transcript Analysis
A quick tool to examine the EN/FR balance of a given event transcript and explore the language equilibrium score as the event progresses.

**NOTE:** This is a proof of concept / pilot. 

> In Canada, official language minority rights and the Official Languages Act demand equal status and quality for English and French communication. Ensuring a fair linguistic balance in public and official events promotes inclusivity, respect, and compliance with national standards. This tool analyzes meeting and event transcripts to measure the exact balance between English and French spoken segments, helping organizers objectively track, evaluate, and improve bilingual representation.

## What is OLTRA?

**Try it out here:** https://mightyweasel.github.io/oltra/

Some basic JS and HTML/CSS and that's about it. When you drag or select a .json file, everything happens locally. No information is shared with the server.

For language detection when the json file doesnt have text tagged, we lean on ELD https://github.com/nitotm/efficient-language-detector-js/tree/main to determine.

## What formats work

You can use the *custom JSON* based on 11 Labs default.
```json
{
  "language_code": "eng",
  "segments": [
    {
      "text": "Good afternoon and welcome to today's event service. ",
      "start_time": 9.2,
      "end_time": 16.04,
      "speaker": {
        "id": "A-B",
        "name": "Abbie Bi"
      },
      "words": [
        {
          "text": "Good",
          "start_time": 9.2,
          "end_time": 9.3
        },
        ...
        {
          "text": "Service.",
          "start_time": 15.68,
          "end_time": 16.04
        },
        {
          "text": " ",
          "start_time": 16.04,
          "end_time": 16.04
        }
      ]
    },
    ...
  ]
}
```

You can also use the default 11 labs format described here: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription

```json
{"transcripts": [
{
  "language_code": "en",
  "language_probability": 1,
  "text": "With your projects.",
  "channel_index": 0,      
  "words": [
    {
      "text": "With",
      "start": 0.119,
      "end": 0.259,
      "type": "word",
      "speaker_id": "speaker_0"
    },
    ...
    {
      "text": "projects.",
      "start": 13.919,
      "end": 14.779,
      "type": "word",
      "speaker_id": "speaker_0"
    }
  ]
},
{
  "language_code": "fr",
  "language_probability": 1,
  "text": "Avec vos projets.",
  "channel_index": 1,
  "words": [
    {
      "text": "Avec",
      "start": 15.119,
      "end": 15.259,
      "type": "word",
      "speaker_id": "speaker_1"
    },
   ...
    {
      "text": "projects.",
      "start": 23.919,
      "end": 24.779,
      "type": "word",
      "speaker_id": "speaker_1"
    }
  ]
},
...
]}
```


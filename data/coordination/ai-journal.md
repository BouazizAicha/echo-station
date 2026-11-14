# Echo Station AI-use journal

Updated: 2026-11-14 (Africa/Tunis).
This is a retrospective record of observed work in this chat, followed by the current update. Exact times and model versions are not inferred.

| Date | Operator / tool | Work performed | Human review / limits |
|---|---|---|---|
| Before this chat; date unverified | Team / Claude (Anthropic), as declared in repository README | Initial application skeleton. | README supports this use; brainstorming, design and other team uses need team confirmation. |
| 2026-11-14 | Content contributor / OpenAI Codex | Normalized the user-provided Apollo 11 Eagle text into JSON; validated application reading and handled Git commits/pushes. | User supplied the text. This entry does not claim independent verification of every earlier Apollo fact. |
| 2026-11-14 | Content contributor / OpenAI Codex | Drafted Ingenuity, Dawn, Pioneer 10, Spirit and Opportunity narratives, Q&A and narration scripts for ages 9–15; consulted NASA/JPL/NSSDCA/HiRISE resources and the team brief; prepared credited mission photographs. | User reviewed and approved the drafts before their integration. Child-audience testing has not been observed. |
| 2026-11-14 | Content contributor / OpenAI Codex | Corrected pasted formatting; added robot index entries; validated JSON and exercised application rendering with a lightweight DOM mock, plus local HTTP loading. | These checks do not constitute a full browser, phone-sensor, accessibility or audio test. |
| 2026-11-14 | Content contributor / OpenAI Codex | Added LROC Apollo 11 JPEG M117338434R, six beat/successors fields, sourced Scientist metadata, this journal and submission drafts. Rechecked Ingenuity's last contact against a later NASA report; changed Pioneer 10's age-specific phrase. | Nulls and field notes preserve uncertainty and non-applicable data. No JS/CSS/HTML changes were authorized in this update. |

## Media and source handling

- No generative image or video tool was used for these six mission photographs. Files were downloaded from the credited mission institutions or a documented Planetary Society mirror.
- Narration files are AI-assisted scripts, not recordings. No synthetic speech or team recording has been produced or verified in this chat.
- YouTube pages did not expose usable transcripts for the supplied Ingenuity videos. Those videos were not represented as watched or independently checked; written mission sources were used.
- Technical data and prose were selected and structured with AI assistance. Sources and review notes remain necessary; do not describe the content as wholly human-authored.

## Team to complete before submission

Validation of this update: all six robot JSON files parse; required Story/Scientist fields, measurement context and reference URLs were checked; existing story rendering was exercised with a DOM mock; all six JSON files and all six JPEG paths loaded through a local HTTP server; git diff --check passed. A path audit confirmed that only data/ and assets/images/ changed. Phone sensors, new mode UI and live deployment were not tested in this update.

Record any additional AI used for design, code, translations, audio, video or submission editing, identifying the tool and human reviewer. Confirm whether the Claude use extended beyond the README's skeleton claim. Confirm which voices were recorded and by whom. Check current event disclosure requirements in the actual submission form; this journal is not a substitute for those rules.

# Echo Station — English submission drafts

Status: working drafts, 2026-11-14. Confirm the real form's character limits, official deadline, project URL and demo requirements before submitting. Nothing has been submitted or sent to another person.

## Project name

Echo Station

## High-level summary

Echo Station helps curious explorers aged 9–15 discover the stories behind hardware humanity left across the solar system. A radio-inspired interface introduces six real NASA explorers: Eagle's descent stage, Spirit, Opportunity, Ingenuity, Dawn and Pioneer 10. Each tells a short first-person story about its mission, discoveries and legacy, supported by credited mission images and traceable scientific sources. The voices are fictional; the mission histories are researched. Children can meet the machines through manual tuning, while the prototype also explores pointing a phone toward the sky.

## Detailed description

A silent machine can still have something to teach us. Echo Station turns mission histories into personal encounters with the explorers that helped people understand the Moon, Mars and the asteroid belt, and opened routes into deep space.

Our audience is ages 9–15. Each explorer answers five questions: Who am I? Why was I sent? What did I discover? Where am I now? What came next? Short English sentences, clear comparisons and optional Q&A make the science approachable. Separate narration scripts prepare the same material for an audio experience. Credited images show real hardware or its discoveries; captions distinguish orbital observations, historical photographs and images of a destination.

The six stories have distinct scientific lessons. Eagle introduces lunar samples and the hardware left at Tranquility Base. Spirit's broken wheel exposes clues to ancient hot water. Opportunity's minerals reveal changing watery environments. Ingenuity demonstrates flight in thin Martian air. Dawn links bright salts to a water-rich dwarf planet. Pioneer 10 reveals what early exploration of Jupiter taught later missions.

The prototype uses a static HTML/CSS/JavaScript application and individual robot JSON files. Manual tuning opens the stories. An antenna mode uses available phone orientation and sky-position calculations, subject to permission, calibration and device support. Story animation beats, successor lists and sourced Scientist metadata are now prepared as content; the dedicated Story and Scientist UI integration remains team work.

We aim to make source checking part of the experience. Dates distinguish mission end from last communication. Coordinates identify the site and reference convention. Mass values specify the relevant hardware. Possible habitats are never presented as proof of life. The final concept connects the silent explorers to Apollo's passive laser reflector, which can return light without a powered radio; the final interaction still needs team validation.

Next steps are phone testing, completing the non-lunar ephemerides, integrating the two presentation modes, recording narration, checking accessibility with young users, and validating the complete demo. These are next steps, not completed test claims.

## NASA data and resources

- NASA NSSDCA spacecraft records supply identifiers, mission dates and hardware descriptions: Apollo 11 LM 1969-059C, Spirit 2003-027A, Opportunity 2003-032A, Dawn 2007-043A, Pioneer 10 1972-012A, and the parent Mars 2020 record 2020-052A describing Ingenuity. Ingenuity is not assigned a fabricated separate identifier.
- NASA/JPL mission overviews, press kits, science highlights and end-of-mission accounts support the narratives, activity totals, mass context and mission timelines.
- NASA's February 2025 Mars Report supports Ingenuity's final reported rover communication on November 26, 2024.
- LRO/LROC provides the Apollo 11 site photograph; MRO/HiRISE provides the Spirit and Opportunity orbital images; Perseverance provides Ingenuity's final-airfield image; Dawn provides the Ceres image. Pioneer uses an archival photograph of its plaque. Exact credits and source pages accompany each robot.
- The PDS Orbital Data Explorer landing-site reference provides clearly labeled original landing coordinates for Spirit and Opportunity. The JPL press kit supplies approximate Jezero-region coordinates; no precise final Valinor Hills coordinates are claimed.
- NASA JPL Horizons is the planned source for additional sky-position tables. Local Ceres and Pioneer 10 ephemeris tables were not present when these drafts were prepared, so do not list that integration as complete.
- The Apollo laser-ranging resources are part of the planned final experience. The team must confirm final integration before claiming a working finale.

The definitive source URLs are in each data/robots/*.json sources and mission_data fields. Selected entry points:
https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/
https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/
https://science.nasa.gov/mission/dawn/
https://science.nasa.gov/mission/pioneer-10/
https://science.nasa.gov/mars/the-mars-report/2025-february/
https://lroc.im-ldi.com/featured_sites/apollo-11/site_images
https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm

## AI use statement

We used AI assistance in developing Echo Station. The repository README identifies Claude (Anthropic) as the generator of the initial application skeleton, later edited by the team. We used OpenAI Codex to help draft and edit mission narratives, Q&A and narration scripts, structure and validate JSON, check factual claims against mission sources, prepare data for Story and Scientist modes, organize references, and perform version-control and local validation tasks. The Apollo 11 text was supplied by a team contributor and normalized into JSON with Codex assistance. The contributor reviewed and approved subsequent mission drafts before integration.

No AI-generated mission photographs were used in this content workflow. The images are downloaded mission photographs or mission image products, with credits and source references. Narration scripts were prepared with AI assistance; this statement does not claim that voices have already been recorded. The team will add any further uses of AI for audio, video, design or code to the journal and final declaration before submission.

## Team confirmations before final wording

- Verify every claimed feature against the final deployed build; test the whole experience on a phone and with a child audience.
- Confirm whether Story/Scientist UI, audio and laser finale are complete.
- Confirm the additional sky tables and accuracy of target aiming.
- Add the final public site URL and a public demo URL; repository: https://github.com/BouazizAicha/echo-station . Branch content is not evidence of live deployment.
- Verify form field limits, deadline/timezone, media and AI-disclosure rules in the actual event form.
- Confirm each additional team tool/resource actually used before listing it (for example fonts, Figma or an ephemeris service).
- Have the team review factual sourcing and attribution. Do not state 'every fact was checked by the team' without that human review.

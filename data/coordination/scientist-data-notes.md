# Robot data additions and verification notes

Updated: 2026-11-14. Scope: data/ and mission photographs only.

## Story fields

Every robot has a short English beat and a successors array. These are data for the Story implementer; this update does not add an animation or a new UI. Successors means later missions that continue relevant exploration, not necessarily a literal replacement at the same destination. For Dawn, Lucy and Psyche continue asteroid exploration; for Ingenuity, Dragonfly is a separate Titan mission.

## Scientist contract

Each mission_data object has nssdca_id, nssdca_source_url, mass_kg, mass_scope, mass_source_url, site_coordinates, distance_traveled_km, flights and verified_on. Field-specific source URLs are also present in the robot's sources array. Null means not applicable or not verified; render it as such, never as zero.

site_coordinates uses latitude_deg and longitude_deg in degrees, north-positive and east-positive. Read scope, convention, approximate and method before displaying the values. These are not live tracking data. Original landing coordinates for Spirit and Opportunity are explicitly distinguished from their final resting places. Opportunity uses 0–360 east longitude (354.4734 E); an interface using -180–180 may convert that to -5.5266 degrees, but must label its convention.

## Mass and identifier decisions

- Eagle: 2034 kg is the descent-stage dry mass including initially stowed surface equipment from NASA NSSDCA 1969-059C. It is not the 15103 kg full lunar module or a measurement of what remains today.
- Spirit and Opportunity: 185 kg is rover-only mass. Larger cruise/EDL masses appearing in mission overviews are different assemblies.
- Ingenuity: approximately 1.8 kg is helicopter mass. No independent NSSDCA identifier was verified, so nssdca_id is null; parent_nssdca_id 2020-052A is explicitly the Mars 2020/Perseverance record that describes its carried helicopter. Do not label the parent's ID as a separately cataloged Ingenuity spacecraft.
- Dawn: 747.1 kg is the dry-spacecraft figure in NASA Dawn Quick Facts, excluding launch propellants. A different catalog figure exists; it is not silently treated as the same quantity. This is not its present-day remaining orbital mass.
- Pioneer 10: 258 kg is the NSSDCA catalog spacecraft mass, not a current weigh-in.

## Coordinate decisions

- Eagle: 0.67416 N, 23.47314 E, from NASA NSSDCA's lunar artifact table, matching the LROC featured site.
- Spirit: -14.5692, 175.4729, original landing site, cartographic triangulation from the PDS Orbital Data Explorer landing-site reference.
- Opportunity: -1.9462, 354.4734, original landing site, same published method and reference service.
- Ingenuity: about 18 N, 77 E is only the broad Jezero landing region in the JPL landing press kit. It is not a precise helicopter landing pad or its final Valinor Hills site. Exact final-site coordinates remain unverified in this update.
- Dawn and Pioneer 10: null; neither has a fixed surface landing site. An orbital or deep-space direction is not a surface coordinate.

## Activity totals

Spirit's 7.7 km is rounded; Opportunity's final reported odometry is 45.16 km. Ingenuity's 72 flights and about 17 km are cumulative flight activity, not driving. No arbitrary distance or flight count is assigned to the other three machines. None of these values is current Earth distance.

## Ingenuity last contact

Keep last_signal at 2024-11-26 and retain the date in the Q&A. NASA's February 2025 Mars Report explicitly calls November 26, 2024 the last communication with Perseverance:
https://science.nasa.gov/mars/the-mars-report/2025-february/

April 16, 2024 was the last regular team operations gathering, as described in:
https://www.nasa.gov/solar-system/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now/

This is not evidence that the grounded helicopter is still collecting data today. That uncertainty remains in the story's Q&A.

## Apollo photograph

assets/images/apollo11-lroc.jpg is the original LROC site JPEG M117338434R, downloaded without generative editing. Credit: NASA/GSFC/Arizona State University. Its direct site-image reference is in proof_image; it is one still image, not the full Dawn-to-Dusk GIF.

## Existing application limits for handoff

The current js/main.js reads the six robot objects but does not consume beat, successors or mission_data yet. UI implementation remains with the relevant developer. The existing renderer interprets a null last_signal as 'still active'; that is unsuitable for Eagle's unknown date, but changing JS is outside this update. The local data/sky directory has no Ceres/Pioneer 10 tables; do not claim their antenna positions are validated. No files outside data/ and assets/images/ were edited here. Old docs/content exports were intentionally not rewritten because of the path constraint; robot JSON is authoritative for the updated Pioneer wording.

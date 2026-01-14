Curio App UI/UX Review

Date of review: 13 Jan 2026
Test Env: Chrome on Linux
App URL: https://curio‑bay.vercel.app

1. Overview of the Curio app

Curio positions itself as a personal museum where users can build archives (collections) and catalogue memorabilia, vinyl records, sweets and other collectibles.  After logging in with the provided test account, I created a new archive called Chocolate Haven using the “Chocolate Vault” preset, downloaded a public image of a chocolate bar from Wikimedia Commons, and walked through the Add Item flow.  I also created and added a vinyl‑record item to a Vinyl Vault archive.  The app offers:
	•	Archives (collections): Each archive has preset fields (e.g., brand, date acquired, location).  Archives are listed as cards on the home page.
	•	Add item wizard: A four‑step modal guides the user through selecting the destination archive, uploading a photo, AI‑assisted extraction of details, and verifying/editing metadata.  A star‑rating control and “Add to Collection” button finalise the item.
	•	Item details: Clicking an item opens a detailed page with a large image, AI‑generated description and technical specification panel.  Icons allow printing or deleting the item.
	•	Enter Exhibition: Opens a slide‑style overlay to view all items in the collection sequentially.
	•	Language toggle: A globe icon allows switching between English and Chinese (ZH).

2. Positive aspects / strengths
	1.	Clean aesthetic and brand alignment – The UI uses a muted colour palette, large typography and plenty of white space.  The home page hero, archive cards and modal windows present content elegantly.  According to UXPin, visual consistency (uniform colours, typography and spacing) enhances usability and strengthens branding ￼.
	2.	Progressive disclosure in the add‑item flow – The four‑step modal breaks down tasks (choose archive ➔ upload photo ➔ AI assist ➔ verify details) so users are not overwhelmed.  Progressive disclosure is a user‑focused way of building engagement by introducing complexity only when needed; it helps users explore at their own pace and keeps interfaces neat ￼.  This pattern suits novices who may be cataloguing items for the first time.
	3.	AI‑assisted data extraction – After uploading a photo, the app uses an AI model to suggest a title, tasting notes and type.  This reduces manual data entry.
	4.	Exhibition mode – The “Enter Exhibition” overlay presents each item as a full‑screen slide, capturing the feel of a museum gallery.
	5.	Initial cross‑language support – A Chinese toggle indicates the intention to support multiple languages, widening the audience.

3. Issues and bugs encountered
	1.	Data persistence and language toggling – Switching from English to Chinese (ZH) and back erased all previously created items, resetting counts to 0.  After returning to English, my Vinyl Vault and Chocolate Haven archives showed “0 items” and the items disappeared.  This suggests the app stores data in local state rather than in a back‑end, or it loads separate datasets per language.  Data should persist across language changes.
	2.	Add‑item saving failure – When I tried to add a chocolate item after switching languages back to English, the process completed but the item did not appear in the archive (still “0 artifacts cataloged”).  Reliability in saving items needs improvement.
	3.	Small, hidden scroll bar in the add‑item modal – The verification step uses a narrow internal scroll bar to expose fields like Type, Batch No. and star rating.  This was easy to miss, causing confusion and accidental edits (e.g., I accidentally entered the batch number into the origin field).  Progressive disclosure should hide complexity, but navigation should remain obvious.  Multi‑step form best practices recommend clear navigation controls and grouping related fields ￼.
	4.	Search bar is non‑functional – The “Search your vast archives…” field on the home page accepts input but does not return results.  Effective wayfinding is critical for digital collections; Recollect notes that collections and their metadata need to be surfaced through search tools to support different discovery types ￼.
        - Tracking: fixed/closed in [#65](https://github.com/Akkkkkkki/curio/issues/65)
	5.	Vocal Guide inactive – The “Vocal Guide” button next to “Enter Exhibition” did nothing when clicked.  If this feature is not ready, consider hiding it or adding a tooltip.
	6.	Unclear interactions and icon meaning – Some icons (e.g., star rating, print, trash) lack tooltips; novices may be unsure of their function.  Functional consistency—ensuring similar actions yield predictable outcomes—is essential for usability ￼.
        - Tracking (tooltips/labels): [#68](https://github.com/Akkkkkkki/curio/issues/68)
        - Tracking (print icon no-op): [#95](https://github.com/Akkkkkkki/curio/issues/95)
	7.	No feedback after actions – When an item is added, there is no toast or confirmation.  Users need reassurance that their action succeeded.
	8.	No search filters or metadata browsing – Users cannot filter by categories, tags or ratings.  According to Recollect, metadata makes digital collections accessible and should allow intuitive wayfinding ￼.
	9.	Language localisation incomplete – In Chinese mode, many elements (archive names, instructions) remain in English.  Also, collections appear with separate counts, causing confusion.

4. Usability feedback and user‑journey observations

4.1 Onboarding and navigation
	•	The sign‑in flow is straightforward.  A “person” icon opens the login form; however, new users may not recognise this icon as “login”.  Consider a labelled “Sign in” button.
	•	The New Archive card invites creation but does not preview available fields until after selecting a preset.  Showing sample fields earlier could help users choose the appropriate archive type.
	•	When creating an archive, the user names the collection and then clicks “Create Collection”.  The fields that will be collected are shown on the card, which is helpful.

4.2 Add‑item process
	•	Step 1 (choose collection) shows available archives.  This step is clear, although the selection is not highlighted strongly.
	•	Step 2 (add photo) offers “Take Photo” or “Upload Photo”.  Uploading triggers the OS file picker.  After upload, AI analysis occurs.  There is a spinner but no progress indicator; a simple “Analysing photo…” message appears, but showing a progress bar or time estimate could reassure users.
	•	Step 3 (AI assist) is mostly automated.  There is an “Enter manually” link, which seems to be for skipping AI suggestions, but it was unresponsive.
	•	Step 4 (verify details) lists fields such as chocolatier, cocoa %, origin/estate, tasting notes, type, batch number and rating.  The internal scroll bar made it difficult to reach fields at the bottom.  Best‑practice multi‑step forms should have clear progress indicators and intuitive navigation controls ￼.  Optional and required fields should be marked ￼.
	•	The star‑rating control highlights stars in yellow when selected.  However, there is no text label, so users cannot tell whether they selected 3/5 or 4/5.  A numeric indicator would improve clarity.

4.3 Viewing and managing items
	•	After successful item addition (as initially observed), the collection page showed a card with the image, brand and tags.  Tapping the card opened an item page with a large photo, AI‑generated narrative and technical specifications.  The layout is attractive.
	•	The item page offered icons to update the photo, print or delete the item.  However, there is no edit button for metadata; users cannot correct typos or update fields without deleting and re‑adding the item.
	•	“Enter Exhibition” provides an immersive gallery slide show.  This is a nice touch, though the overlay lacks navigation bullets to jump to specific items when there are many.
	•	“Vocal Guide” (potential audio description) does not work.

4.4 Cross‑language experience
	•	The Chinese toggle changed interface labels but not completely.  More importantly, switching languages appeared to load a different data set, causing existing items to vanish.  This breaks the user journey; users might think their data is lost.  Always persist data across languages and keep the same back‑end.

5. Design and product recommendations
	1.	Persist data consistently across sessions and languages – The biggest blocker is the loss of items after language toggling.  Storing collection data server‑side and using a unique identifier per user will prevent resets.  Ensure both language modes reference the same data.
	2.	Implement a robust search and filter system – Recollect’s research notes that different user personas discover collections in different ways; some browse aimlessly while others perform structured searches ￼.  Add:
	•	Global search for titles, tags, categories and tasting notes.
	•	Faceted filters (e.g., by archive, category, brand, rating) and sort options.
	•	Surface metadata for serendipitous discovery ￼.
	3.	Improve multi‑step form UX – Adopt form best practices ￼:
	•	Add a visible progress bar or “Step X of Y” indicator; keep it fixed at the top ￼.
	•	Use clearly labelled navigation buttons (“Next” / “Back”).
	•	Group related fields and display required vs optional fields.
	•	Provide real‑time validation and helpful error messages; avoid scrolling to hidden fields.
	•	Allow users to review and edit previous steps before submission.
	4.	Simplify the verification step – Consider splitting metadata into collapsible sections (e.g., basic info vs. additional details) to reduce vertical scrolling.  Progressive disclosure encourages introducing complexity gradually ￼.
	5.	Add confirmation and feedback – After a user adds an item, display a toast notification (e.g., “Item added successfully”).  Provide undo or “View item” options.
	6.	Clarify icons and actions – Add tooltips on hover (e.g., “Delete item”, “Print”, “Star rating: 3/5”).  Ensure that icons use familiar metaphors and maintain functional consistency ￼.
	7.	Allow metadata editing – Provide an “Edit” button in the item view so users can correct fields without deleting the artifact.
	8.	Make Vocal Guide functional or hide it – If audio narration is planned for a future release, include a “coming soon” tooltip; otherwise remove the button to avoid confusion.
	9.	Enhance device responsiveness – The site is responsive on desktop, but mobile requires further testing.  Device‑specific UX is crucial; Recollect suggests adapting UI for different devices and considering accessibility concerns such as font size and contrast ￼.
	10.	Complete language localisation – Translate all labels, field names and preset names consistently.  Maintain a shared data model across languages.
	11.	Future roadmap ideas – When implementing personalised recommendations (as the user hinted), keep in mind the need for user privacy and transparency.  Provide clear explanations of how recommendations are generated and allow users to opt out.

6. Conclusion

Curio is an elegant concept that captures the sentimentality of preserving personal artifacts.  The minimalist design, AI‑assisted cataloguing and exhibition mode show promise.  However, several critical issues—particularly data persistence and incomplete feature implementation—currently hinder the user journey.  Aligning the product with established UX best practices, strengthening technical reliability and enhancing search and metadata capabilities will help Curio become the go‑to platform for collectors.  Investing in user research and continuous usability testing will ensure the app evolves around real user needs, ultimately delivering the engaging online museum experience the team envisions.
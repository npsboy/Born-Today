# Born-Today
Shows a list of famous people born on this day using Wikipedia API. <br>
[See this working](https://borntoday.npsboy.net)

## How the top 6 are chosen

Wikipedia's "On This Day" feed lists everyone born on a date (around 160 people), in no useful order. Each person gets a score and the six highest become the cards. Scoring runs in three passes, from cheap to expensive:

1. **Base score (everyone, feed data only).** No extra requests.
2. **Sitelinks and article length (everyone).** Fetched from Wikidata / Wikipedia in batches of 50. The list is then sorted and the **top 30** kept as a shortlist.
3. **Citation count (shortlist only).** Needs each article's full wikitext, so it is only fetched for those 30. The 30 are re-sorted and the first 6 are shown.

| Pass | Criterion | Rule | Max |
|------|-----------|------|-----|
| 1 | Linked pages | +3 per page linked in the feed entry, up to 5 pages | 15 |
| 1 | Image | +5 if any linked page has a thumbnail / image | 5 |
| 1 | Description | +2 if there is a Wikipedia short description, or text after the first comma in the feed entry | 2 |
| 1 | Nobel boost | +3 if the blurb mentions "Nobel" | 3 |
| 1 | Office boost | +3 if the blurb mentions President, Prime Minister, Premier or Chancellor (incl. Vice / Deputy). Matching both boosts gives +6 | 3 |
| 2 | Wikidata sitelinks | number of sitelinks x 0.1, capped at 200 sites | 20 |
| 2 | Article length | bytes / 80,000 | 2.5 |
| 3 | Citations | number of `<ref` tags in the wikitext / 50 | 5 |

The "blurb" is the feed text plus the Wikipedia short description.

**Why the passes are split:** linked pages alone badly underrate famous people (Mahatma Gandhi has one linked page in the feed), so sitelinks are fetched for everyone. Citations are the most expensive signal, so they are only fetched where they can change the top 6.

### Known limitations
- Citations count every `<ref` tag, including repeat uses of the same source.
- Only the top 30 after pass 2 get citation points, so anyone ranked lower can never reach the top 6.
- The Nobel and office checks are plain text matches: they can match non-state "President of ..." posts or a passing mention of "Nobel".
- The linked-page count depends on how the feed blurb was written, not on how famous the person is.

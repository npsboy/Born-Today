
const today = new Date();

// Get the current day and month as numbers
const day = today.getDate();  // Day of the month (1-31)
const month = today.getMonth() + 1;  // Month (0-11, so add 1 to get 1-12)


function getName(person) {

    if (person.text) {
        const personText = person.text;  // Extract the 'text' field
        if (!personText.includes(',')) {
            return personText.trim();  // If there's no comma, return the whole text as name
        }
        const name = personText.split(',')[0];  // Split the text by comma and get the name (first part)
        return name.trim();  // Remove any extra spaces around the name
      } else {
        return null;  // Return null if 'text' is not available
      }
    
}
function getDescription(person) {
    if (!person || !person.text) return null;
    const personText = person.text;
    const parts = personText.split(',');
    const description = parts[1] ? parts[1].trim() : null;
    return description;

}

function getWikipediaLink(person) {

    if (person.pages && person.pages.length > 0) {
        const page = person.pages[0];  // Get the first page
        const content_urls = page.content_urls;
        if (content_urls && content_urls.desktop && content_urls.desktop.page) {
            return content_urls.desktop.page;  // Return the desktop page URL
        } else {
            return null;  // Return null if the URL is not available
        }
    }
}

function getDate(person) {

    if (person.year) {
        return day + '-' + month + '-' + person.year;  // Return the date in dd-mm-yyyy format
    } else {
        return null;  // Return null if 'text' is not available
    }
    
}

// Heuristic importance scoring (fast, no extra requests)
function computeImportance(person) {
  let score = 0;

  // pages length (more linked pages -> slightly higher)
  if (Array.isArray(person.pages)) {
    score += Math.min(person.pages.length, 5) * 3;
  }

  // thumbnail or originalimage presence on any page
  const hasImage = Array.isArray(person.pages) && person.pages.some(p => p.thumbnail || p.originalimage || (p.originalimage && p.originalimage.source));
  if (hasImage) score += 5;

  // description presence
  if (getDescription(person)) score += 2;

  // extract length (longer extract -> likely more notable)
  const extract = (person.pages && person.pages[0] && person.pages[0].extract) || '';
  score += Math.min(4, Math.floor(extract.length / 200));

  return score;
}

function fetchPersonImage(person) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(person)}`;
    
    return fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.thumbnail) {
          return data.thumbnail.source;  // Return the image URL
        } else {
          return 'https://wallpapers.com/images/hd/anonymous-profile-silhouette-b714qekh29tu1anb.jpg';  // Return a default image URL if no thumbnail is available
        }
      })
      .catch(error => {
        console.error(`Error fetching data for ${person}:`, error);
        return null;  // Return null in case of error
      });
  }



const date_for_fetch = month.toString().padStart(2, '0') + '/' + day.toString().padStart(2, '0');

// The target URL you want to access (Wikipedia API in this case)
const targetUrl = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/' + date_for_fetch;


// Fetch the data from the API using the proxy
fetch(targetUrl)
  .then(response => response.json())  // Convert the response to JSON
  .then(async data => {
    // Extract the births data (assuming the structure based on the API)
    const births = data.births;

    // Sort the births array by heuristic importance in descending order
    const scored = births.map(p => ({ person: p, score: computeImportance(p) }));
    scored.sort((a, b) => b.score - a.score);

    // Async refinement: fetch Wikidata sitelinks counts for ALL births, batched.
    // The pages-based heuristic can badly underrate famous people (e.g., Mahatma Gandhi has
    // only one linked page in the feed), so the sitelinks boost must apply to everyone.
    // wbgetentities accepts up to 50 ids per request; origin=* enables CORS.
    async function fetchWikidataSitelinksCounts(qids) {
      const counts = {};
      const batches = [];
      for (let i = 0; i < qids.length; i += 50) batches.push(qids.slice(i, i + 50));
      await Promise.all(batches.map(async batch => {
        try {
          const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=sitelinks&format=json&origin=*`;
          const resp = await fetch(url);
          if (!resp.ok) return;
          const data = await resp.json();
          for (const qid in (data.entities || {})) {
            const sitelinks = data.entities[qid].sitelinks;
            if (sitelinks) counts[qid] = Object.keys(sitelinks).length;
          }
        } catch (e) {
          // Ignore failed batch; those people just get no boost
        }
      }));
      return counts;
    }

    function getQid(person) {
      return (person.pages && person.pages[0] && person.pages[0].wikibase_item) || person.wikibase_item || null;
    }

    function getTitle(person) {
      return (person.pages && person.pages[0] && person.pages[0].title) || null;
    }

    // Fetch Wikipedia article length (bytes) for each title, up to 50 titles per request.
    // Returns a map keyed by the title as it appears in the feed (underscores).
    async function fetchPageLengths(titles) {
      const lengths = {};
      const batches = [];
      for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
      await Promise.all(batches.map(async batch => {
        try {
          const spaced = batch.map(t => t.replace(/_/g, ' '));
          const url = `https://en.wikipedia.org/w/api.php?action=query&prop=info&titles=${encodeURIComponent(spaced.join('|'))}&format=json&origin=*`;
          const resp = await fetch(url);
          if (!resp.ok) return;
          const data = await resp.json();
          const pages = (data.query && data.query.pages) || {};
          for (const id in pages) {
            if (pages[id].length) lengths[pages[id].title.replace(/ /g, '_')] = pages[id].length;
          }
        } catch (e) {
          // Ignore failed batch; those people just get no length boost
        }
      }));
      return lengths;
    }

    const REFERENCE_CANDIDATES = 30;

    // Count <ref> tags in each article's wikitext, up to 50 titles per request.
    // Returns a map keyed by the title as it appears in the feed (underscores).
    async function fetchReferenceCounts(titles) {
      const counts = {};
      const batches = [];
      for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
      await Promise.all(batches.map(async batch => {
        try {
          const spaced = batch.map(t => t.replace(/_/g, ' '));
          const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(spaced.join('|'))}&format=json&formatversion=2&origin=*`;
          const resp = await fetch(url);
          if (!resp.ok) return;
          const data = await resp.json();
          const pages = (data.query && data.query.pages) || [];
          pages.forEach(page => {
            const wikitext = page.revisions && page.revisions[0].slots.main.content;
            if (wikitext) counts[page.title.replace(/ /g, '_')] = (wikitext.match(/<ref[\s>\/]/g) || []).length;
          });
        } catch (e) {
          // Ignore failed batch; those people just get no reference boost
        }
      }));
      return counts;
    }

    async function refineCandidates(scoredList) {
      const qids = [...new Set(scoredList.map(e => getQid(e.person)).filter(Boolean))];
      const titles = [...new Set(scoredList.map(e => getTitle(e.person)).filter(Boolean))];
      const [counts, lengths] = await Promise.all([
        fetchWikidataSitelinksCounts(qids),
        fetchPageLengths(titles)
      ]);
      scoredList.forEach(entry => {
        const sitelinks = counts[getQid(entry.person)] || 0;
        // Add a boost based on sitelinks (cap influence)
        entry.score += Math.min(200, sitelinks) * 0.1; // each 10 sitelinks -> +1 point, max +20
        const length = lengths[getTitle(entry.person)] || 0;
        // Longer article -> more notable (weaker signal than sitelinks, so lower cap)
        entry.score += Math.min(2.5, length / 80000); // each 80 KB -> +1 point, max +2.5
      });
      scoredList.sort((a, b) => b.score - a.score);

      // Reference counts need the full article wikitext (~35 KB each), so only fetch them
      // for the strongest candidates instead of all births.
      const shortlist = scoredList.slice(0, REFERENCE_CANDIDATES);
      const refCounts = await fetchReferenceCounts(shortlist.map(e => getTitle(e.person)).filter(Boolean));
      shortlist.forEach(entry => {
        const refs = refCounts[getTitle(entry.person)] || 0;
        // More citations -> better documented, more notable (between sitelinks and length)
        entry.score += Math.min(5, refs / 50); // each 50 references -> +1 point, max +5
      });
      shortlist.sort((a, b) => b.score - a.score);
      return shortlist;
    }

    // Run refinement and pick final top 6
    const refined = await refineCandidates(scored);
    const top6 = refined.slice(0, 6).map(s => s.person);

    // Display the top 6 most viewed in the console
    console.log('Top 6 Most Viewed Births Today:', top6);

    // Optionally, display the top 6 in the webpage
    top6.forEach(person => {
        console.log(person.pages);

        const container = document.getElementById('cardsContainer');

        // Create a card container
        const card = document.createElement('div');
        card.classList.add('card');

        // Add the person's image
        const img = document.createElement('img');
        person_name= getName(person);
        fetchPersonImage(person_name).then(imageUrl => {
            img.src = imageUrl // Logs the image URL or default image
          });

        img.alt = getName(person); // Use the name as the alt text

        // Add name and occupation (or description after the comma)
        const name = document.createElement('h2');
        name.textContent = getName(person);

        // Extract the occupation or description (if available)
        const description = getDescription(person) || 'No description available';
        const descriptionText = document.createElement('p');
        descriptionText.textContent = description;

        // Add birthday in dd-mm-yyyy format
        const birthdayText = document.createElement('p');
        birthdayText.textContent = `Birthday:` + getDate(person);

        const wikipediaLink = getWikipediaLink(person);

        // Append everything to the card
        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(descriptionText);
        card.appendChild(birthdayText);

        card.addEventListener('click', () => {
            if (wikipediaLink) {
                window.open(wikipediaLink, '_blank'); // Open the Wikipedia page in a new tab
            }
        });
        // Append the card to the container
        container.appendChild(card);

    });

  })
  .catch(error => {
    console.error('Error fetching data:', error);  // Handle any errors
  });


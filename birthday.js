
const today = new Date();

// Get the current day and month as numbers
const day = today.getDate();  // Day of the month (1-31)
const month = today.getMonth() + 1;  // Month (0-11, so add 1 to get 1-12)

document.getElementById('todayDate').textContent =
    today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// Scroll through everyone born today (thumbnails come with the feed) while rankings are computed
function startFlash(births) {
    const loader = document.getElementById('loader');
    const items = births
        .map(p => ({ name: getName(p), src: p.pages && p.pages[0] && p.pages[0].thumbnail && p.pages[0].thumbnail.source }))
        .filter(x => x.src && x.name);
    if (!loader || items.length === 0) return;

    for (let i = items.length - 1; i > 0; i--) {  // shuffle
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    const shown = items.slice(0, 40);

    // Repeat the set until one half of the track is wider than the viewport,
    // then duplicate it so the -50% translate loops seamlessly
    const half = [];
    while (half.length < 14) half.push(...shown);

    const buildFigure = item => {
        const fig = document.createElement('figure');
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = '';
        const caption = document.createElement('figcaption');
        caption.textContent = item.name;
        fig.appendChild(img);
        fig.appendChild(caption);
        return fig;
    };

    const track = document.createElement('div');
    track.classList.add('marquee-track');
    track.style.animationDuration = (half.length * 1.1) + 's';
    [...half, ...half].forEach(item => track.appendChild(buildFigure(item)));

    const marquee = document.createElement('div');
    marquee.classList.add('marquee');
    marquee.appendChild(track);
    loader.prepend(marquee);
}

function hideLoader() {
    const loader = document.getElementById('loader');
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 500);
}


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
const OFFICE_REGEX = /\b((?:Deputy |Vice[- ])?(?:Prime Minister|President|Premier|Chancellor)\b[^,]*)/i;

const NOBEL_REGEX = /\bNobel\b/i;
const ACHIEVEMENT_BOOST = 3;

function wordCount(str) {
    return str ? str.split(/\s+/).filter(Boolean).length : 0;
}

// Wikipedia short description with trailing "(born 1991)" / "(1944–2024)" removed
function getWikiDescription(person) {
    const page = person.pages && person.pages[0];
    if (!page || !page.description) return null;
    const cleaned = page.description.replace(/\s*\([^)]*\d{4}[^)]*\)\s*$/, '').trim();
    return cleaned || null;
}

// Everything after the name in the On This Day text, minus "(died ...)" and trailing period
function getTextDescription(person) {
    if (!person || !person.text) return null;
    const idx = person.text.indexOf(',');
    if (idx === -1) return null;
    const cleaned = person.text.slice(idx + 1)
        .replace(/\s*\(\s*died[^)]*\)\s*$/i, '')
        .replace(/\.\s*$/, '')
        .trim();
    return cleaned || null;
}

function getDescription(person) {
    const wiki = getWikiDescription(person);
    const text = getTextDescription(person);

    let description = wiki || text;

    // Vague wiki description ("Musical artist", "American singer"): prefer the fuller text if it says more
    if (wiki && text) {
        const genericArtist = /\bartist$/i.test(wiki);
        const tooShort = wordCount(wiki) < 3 && wordCount(text) > wordCount(wiki);
        if (genericArtist || tooShort) description = text;
    }

    // Surface a top office (e.g. Prime Minister of Estonia) if the chosen description lacks it
    if (description && text) {
        const office = text.match(OFFICE_REGEX);
        if (office && !OFFICE_REGEX.test(description)) {
            description += ', ' + office[1].trim();
        }
    }

    return description || null;
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

  // achievement boost: Nobel laureates and heads of state/government
  const blurb = (person.text || '') + ' ' + (getWikiDescription(person) || '');
  if (NOBEL_REGEX.test(blurb)) score += ACHIEVEMENT_BOOST;
  if (OFFICE_REGEX.test(blurb)) score += ACHIEVEMENT_BOOST;

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
    startFlash(births);

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
    const container = document.getElementById('cardsContainer');

    top6.forEach((person, i) => {
        console.log(person.pages);

        // Create a card container
        const card = document.createElement('div');
        card.classList.add('card');
        card.style.setProperty('--i', i);
        card.tabIndex = 0;

        // Add the person's image
        const photo = document.createElement('div');
        photo.classList.add('photo');
        const img = document.createElement('img');
        const person_name = getName(person);
        img.addEventListener('load', () => img.classList.add('loaded'));
        fetchPersonImage(person_name).then(imageUrl => {
            img.src = imageUrl // Logs the image URL or default image
          });

        img.alt = person_name; // Use the name as the alt text
        photo.appendChild(img);

        // Editorial numbering
        const index = document.createElement('span');
        index.classList.add('index');
        index.textContent = 'No. ' + (i + 1);

        // Add name and occupation (or description after the comma)
        const name = document.createElement('h2');
        name.textContent = person_name;

        // Extract the occupation or description (if available)
        const description = getDescription(person) || 'No description available';
        const descriptionText = document.createElement('p');
        descriptionText.classList.add('desc');
        descriptionText.textContent = description;

        // Add birthday in dd-mm-yyyy format
        const birthdayText = document.createElement('p');
        birthdayText.classList.add('born');
        birthdayText.textContent = `Born ` + getDate(person);

        const wikipediaLink = getWikipediaLink(person);

        // Append everything to the card
        card.appendChild(photo);
        card.appendChild(index);
        card.appendChild(name);
        card.appendChild(descriptionText);
        card.appendChild(birthdayText);

        const openPage = () => {
            if (wikipediaLink) {
                window.open(wikipediaLink, '_blank'); // Open the Wikipedia page in a new tab
            }
        };
        card.addEventListener('click', openPage);
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter') openPage();
        });
        // Append the card to the container
        container.appendChild(card);

    });

    hideLoader();

  })
  .catch(error => {
    console.error('Error fetching data:', error);  // Handle any errors
    const marquee = document.querySelector('.marquee');
    if (marquee) marquee.remove();
    const loader = document.getElementById('loader');
    loader.classList.add('error');
    loader.querySelector('.loader-text').textContent = 'Could not load today’s births. Please try again.';
  });


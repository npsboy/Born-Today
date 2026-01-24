
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

    // Async refinement: fetch Wikidata sitelinks count for top candidates
    // This boosts globally notable figures (many language sitelinks), e.g., Mahatma Gandhi.
    async function fetchWikidataSitelinksCount(qid) {
      if (!qid) return 0;
      try {
        const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
        const resp = await fetch(url);
        if (!resp.ok) return 0;
        const data = await resp.json();
        const entity = data.entities && data.entities[qid];
        if (!entity || !entity.sitelinks) return 0;
        return Object.keys(entity.sitelinks).length;
      } catch (e) {
        return 0;
      }
    }

    async function refineTopCandidates(scoredList, candidateCount = 20) {
      const candidates = scoredList.slice(0, candidateCount);
      await Promise.all(candidates.map(async entry => {
        const person = entry.person;
        // Try to find a wikibase_item on the first page
        const qid = (person.pages && person.pages[0] && person.pages[0].wikibase_item) || person.wikibase_item || null;
        const sitelinks = await fetchWikidataSitelinksCount(qid);
        if (sitelinks > 0) {
          // Add a boost based on sitelinks (cap influence)
          entry.score += Math.min(200, sitelinks) * 0.05; // each 20 sitelinks -> +1 point
        }
      }));
      candidates.sort((a, b) => b.score - a.score);
      return candidates;
    }

    // Run refinement and pick final top 6
    const refined = await refineTopCandidates(scored, 20);
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

        // Append everything to the card
        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(descriptionText);
        card.appendChild(birthdayText);

        // Append the card to the container
        container.appendChild(card);

    });

  })
  .catch(error => {
    console.error('Error fetching data:', error);  // Handle any errors
  });


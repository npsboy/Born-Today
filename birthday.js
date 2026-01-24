
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

    if (person.text) {
        const personText = person.text;  // Extract the 'text' field
        const description = personText.split(',')[1];  // Split the text by comma and get the name (first part)
        if (!description) {
            return null;  // If there's no description part, return null
        }
        return description.trim();  // Remove any extra spaces around the description
      } else {
        return null;  // Return null if 'text' is not available
      }
    
}

function getDate(person) {

    if (person.year) {
        return day + '-' + month + '-' + person.year;  // Return the date in dd-mm-yyyy format
    } else {
        return null;  // Return null if 'text' is not available
    }
    
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
  .then(data => {
    // Extract the births data (assuming the structure based on the API)
    const births = data.births;

    // Sort the births array by view_count in descending order
    const top6 = births.sort((a, b) => b.view_count - a.view_count).slice(0, 6);

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


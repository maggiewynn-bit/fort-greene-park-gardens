# Fort Greene Park Gardens

A record of the gardens in Fort Greene Park, Brooklyn: which plants grow where, what there is to see in each garden month by month, where the gaps are, and notes for whoever looks after them next.

It is a plain website (HTML, CSS and JavaScript, no build step), hosted free on GitHub Pages.

## Where the information comes from

| What | Where it lives | How to change it |
|---|---|---|
| Plants, and which gardens they are in | The **Fort Greene Park Flora - MASTER LIST** Google Sheet | Edit the sheet. The site reads it each time it opens (once it is published, see below). |
| Notes on each garden | The sheet's **Notes** tab (Date, Garden, Note, Author) | Add a row, or use the box on a garden's page if notes are switched on. |
| Soil, light, moisture, risk for each garden (optional) | A **Gardens** tab in the sheet with columns Name, Type, Soil, Light, Moisture, Risk | Add the tab; the columns and map layers appear automatically. |
| Bloom times, berries, fall colour, light, native range | `data/plant-profiles.js`, from the NC State Extension Plant Toolbox and Wikipedia | Edit the line for that plant. |
| Which plants are NYC natives | `data/nyc-native.js`, from the NYC Parks Native Species Planting Guide | Edit the list. |
| The park map and garden outlines | `data/park-map.js`, traced from the park map | Ask a developer, or edit the outline paths. |
| A fallback copy of the sheet | `data/sheet-snapshot.js` | Replace it occasionally so the site still works if Google is unreachable. |
| Site settings | `config.js` | See the comments in the file. |

Garden names must match exactly between the sheet's Location column, the Notes tab and the map. "Poet's Garden" in one place and "Poets Garden" in another will be treated as two gardens.

## Putting it online (GitHub Pages)

1. In the repository, go to **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and **Save**.
3. After a minute or two the site is at `https://<your-github-name>.github.io/<repository-name>/`.

## Turning on live data

1. Open the Google Sheet. **File > Share > Publish to web**.
2. Choose **Entire document** and **Microsoft Excel (.xlsx)**, then **Publish**. Copy the link.
3. In this repository, open `config.js`, click the pencil, paste the link into `publishedXlsxUrl`, and commit.

Google refreshes the published copy within about five minutes of an edit, so changes to the sheet show up on the site after that.

## Turning on notes from the site (optional)

Follow the steps at the top of `apps-script/notes.gs`. Give the passcode only to the people who should add notes. Everyone else can still read them.

## Changing the site

Edit files directly on GitHub (pencil icon) or clone the repository and open `index.html` in a browser. Most changes are in `app.js` (screens and logic) and `styles.css` (look). Each push to `main` republishes the site.

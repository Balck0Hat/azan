const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'cities500.txt');
const outputFile = path.join(__dirname, 'cities.json');

console.log("📥 Reading cities500.txt ...");

const raw = fs.readFileSync(inputFile, 'utf8');
const lines = raw.split('\n');

let result = [];

for (let line of lines) {
    if (!line.trim()) continue;

    const cols = line.split('\t');

    result.push({
        name: cols[1] ? cols[1].trim() : "",          // name
        ascii: cols[2] ? cols[2].trim() : "",         // asciiname
        lat: parseFloat(cols[4]),                     // latitude
        lng: parseFloat(cols[5]),                     // longitude
        country: cols[8] ? cols[8].trim() : "",       // country code
        timezone: cols[17] ? cols[17].trim() : ""     // timezone
    });
}

console.log("📦 Parsed:", result.length, "cities");

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

console.log("🎉 DONE! Saved to cities.json");

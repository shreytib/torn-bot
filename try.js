const fs = require("fs");


//let listings = require('./listings.json');

const axios = require('axios');
let factions = require('./factions_list.json');
let temp = [];

async function fetchFactions() {
        let count = 0;

        for (let fac_id of factions){
                let currDate = Date.now();
                const url = `https://api.torn.com/v2/faction/${fac_id}?selections=members&key=ircvQNWi6Hu0YGYW`;
                try {
                        //console.log(`Checking ${url}`);
                        const response = await axios.get(url, { timeout: 15000 });
                        //console.log(`Received API response`);

                        if (!response.data) {
                                console.log(`\n\nError: ${url}\n\n`);
                                continue;
                        }

                        if (response.data.error) {
                                console.log(`\n\nError: ${url}\n${response.data}\n\n`);
                                continue;
                        }
                        let valid_member = 0;

                        for (let member of response.data.members) {
                                if (member.status.state === 'Federal') {
                                        continue;
                                }
                                //console.log(currDate, member.last_action.timestamp);
                                if(currDate/1000 - member.last_action.timestamp > 24*60*60){
                                        continue;
                                }
                                valid_member++;
                        }
                        if(valid_member >= 10){
                                //console.log(`Valid Faction ${fac_id}`);
                                temp.push(fac_id);
                        }
                        // Add a delay to avoid rate-limiting issues
                        await new Promise(resolve => setTimeout(resolve, 500));

                        if(++count % 10 === 0){
                                console.log(`Checked ${count}/${factions.length} factions @ ${new Date(currDate).toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}.`)
                        }
                } catch (error) {
                        console.error(`Request failed: ${url}\n`, error.message);
                }
        }

        console.log(temp.length);
        console.log('Done');
        fs.writeFileSync('factions_list.json', JSON.stringify(temp));
}

// Run the function
fetchFactions();


//let listings = require('./listings.json');
//let RW = require('./RW.json');

//let amount = 0;
//let rw = [];
/*

for(let listingID in users['3062918'].items){
        console.log(users['3062918'].items[listingID]['name'], users['3062918'].items[listingID]['price']);
}
*/

//console.log(Object.keys(keys).length);
/*
for (let index in listings){
        for (let i in listings[index]){
                console.log(i);
        }
}
*/

//console.log(rw[0]);

//console.log(Object.keys(users).length);

//console.log(Object.keys(users['1441750']));
//console.log(Object.keys(users).length);
//const items = require('./itemsApi.json');

/*
console.log(Object.keys(users).length);
let factions = {};
factions['0'] = ['null'];
let count = 0;
let count2 = 0;
for(let i in users){
        if(users[i].factionID){
                if(factions.hasOwnProperty(users[i].factionID)){
                        factions[users[i].factionID].push(i);
                }
                else{
                        factions[users[i].factionID] = [users[i].factionName, i];
                }
        }
        else{
                console.log('No faction : ', users[i].name, i);
                factions['0'].push(i);
        }
}

for(let i in factions){
        if(factions[i].length === 2){
                count++;
        }
        else if(factions[i].length < 4){
                count2++;
        }
        console.log(factions[i][0], factions[i].length -1);
}
console.log(Object.keys(factions).length, 'Total Factions');
console.log(count, 'Factions with only 1 user');
console.log(count2, 'Factions with upto 3 users');
*/

//fs.writeFileSync('users.json', JSON.stringify(users));
//console.log('Done');

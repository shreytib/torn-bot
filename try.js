const fs = require("fs");


let items = require('./items.json');
//console.log(Object.keys(items).length);

//const axios = require('axios');



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

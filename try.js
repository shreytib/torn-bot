const fs = require("fs");


//let listings = require('./listings.json');

const axios = require('axios');
let items = require('./items.json');

let index = "656";
currdate = parseInt(Date.now()/1000);

let data = {};
let offset = false;
let error2 = false;

let url = `https://api.torn.com/v2/market/${index}/itemmarket?&bonus=Any&from=${currdate}&key=1sAC1HakJor6P16m`;

async function fetchAPI() {
        do {
                let temp = {};
                temp['error'] = 0;
                temp['data'] = {};
                console.log("Fetching: ", url);
                const response = await axios.get(url, { timeout: 15000 });
                //console.log(response.data);
                temp.data = response.data;
                if(temp['error'] === 0 && Object.keys(temp['data']).length){
                        if(temp.data.itemmarket.listings.length === 0 && (listings.hasOwnProperty(index) && Object.keys(listings[index]).length !== 0)){
                                //client.channels.cache.get(bot.channel_logs).send({ content:`${RW[index]} [${index}] returned 0 listings. Skipping check.` });
                                //return;
                        }
                        if(Object.keys(data).length === 0){
                                data = {...temp.data};
                                //console.log("Data: ", data);
                        }
                        else{
                                data.itemmarket.listings.push(...temp.data.itemmarket.listings);
                                //console.log("Data 2: ", data);
                        }
                        if(temp.data._metadata.next){
                                offset = true;
                                url = `https://api.torn.com/v2/market/${index}/itemmarket?&bonus=Any&offset=${Object.keys(data.itemmarket.listings).length - 5}&from=${currdate}&key=1sAC1HakJor6P16m`;
                                //console.log(index, data.itemmarket.item.name, url);
                        }
                        else{
                                offset = false;
                        }
                }
                else{
                        error2 = true;
                        offset = false;
                }
        } while(offset);
        
        data = data.itemmarket;

        console.log(data);
        
        if(data && Object.keys(data).length > 0 && !error2){
                //checkCheapRW(index, data);
                console.log(items[index]?.minimum);
                console.log(data.listings[0]?.price);
                /*
                if(((items[index]?.minimum * 0.75) - data.listings[0]?.price) >= 0){
                        let payload = {
                                message: 'Cheap Listing RW',
                                itemID: index,
                                UID: data.listings[0].itemDetails.uid || 0,
                                itemName: data.itemmarket.item.name,
                                price: data.listings[0].price
                        };
                        broadcast(payload);
                }
                */
        
                for (let itm of data.listings){
                        console.log(itm);
                }
        }

        console.log("DONE");
}

// Run the function
fetchAPI();



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

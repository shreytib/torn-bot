
const fs = require("fs");
const axios = require('axios');
const WebSocket = require('ws');
const https = require('https');

const { Client, GatewayIntentBits , REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

require('dotenv').config({ path: '../.env' });
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	],
});

const bot_token = process.env.DISCORD_TOKEN;

// SSL certificates (use your own certificate files)
const serverOptions = {
    cert: fs.readFileSync('./certificate.pem'),
    key: fs.readFileSync('./private-key.pem'),
	passphrase: 'I dont know what I am doing'
};

// Create HTTPS server
const server = https.createServer(serverOptions);

// Attach WebSocket server to the HTTPS server
const wss = new WebSocket.Server({ server });


// Start WebSocket server
/*
const server = new WebSocket.Server({ host: '0.0.0.0', port: 8080 }, () => {
    console.log('WebSocket server running on ws://18.194.249.101:8080');
});
*/
async function HandleWebsocketCheck(data_whole){
	for (let i in data_whole){
		let temp = data_whole[i]['data'][0];
		temp['UID'] = data_whole[i]['armouryID'];
		temp['itemID'] = data_whole[i]['itemID'];
		new_listing(temp);
	}
	fs.writeFileSync('users.json', JSON.stringify(users));
	fs.writeFileSync('listings.json', JSON.stringify(listings));
}

async function new_listing(data){
	let userID = data.user?.ID;
	let listingID = data.UID;
	let itemID = data.itemID;

	if(listings[itemID]?.hasOwnProperty(listingID)){
		if(userID && listings[itemID].userName === 'anon'){
			//was anon but not anymore
		}
		else{
			console.log(`Already added item listing. Skipping`);
			return;
		}
	}

	let itemName = null;

	if(items.hasOwnProperty(itemID)){
		itemName = items[itemID].name;
	}
	else if(RW.hasOwnProperty(itemID)){
		itemName = RW[itemID];
	}
	else{
		console.log(`**Not adding** ${itemName}[${itemID}] Listed By: ${data.user.name}[${userID}]. Qty ${data.available} @ $${data.price}. Item not being tracked.`);
		client.channels.cache.get(bot.channel_logs).send({ content: `**Not adding** ${itemName}[${itemID}] Listed By: ${data.user.name}[${userID}]. Qty ${data.available} @ $${data.price}. Item not being tracked.` });
		return;
	}

	let iObj = {
		name: itemName,
		itemID: itemID,
		UID: data.UID,
		price: data.price,
		amount: data.available,
		userID: userID ?? '0',
		userName: userID? data.user.name : 'anon',
	}
	if(!listings.hasOwnProperty(itemID)){
		listings[itemID] = {};
	}
	listings[itemID][listingID] = iObj;

	if(!userID){
		//anon listing
		console.log(`**Not adding** ${itemName}[${itemID}] Anon Listing. Qty ${data.available} @ $${data.price}.`);
		client.channels.cache.get(bot.channel_logs).send({ content: `Added ${iObj.name}[${itemID}] Anon Listing. Qty ${iObj.amount} @ $${iObj.price}` });
		return;
	}

	let keys_list = Object.keys(keys);
    let randomIndex = Math.floor(Math.random() * keys_list.length);
    let key_id = keys_list[randomIndex];
    let url = `https://api.torn.com/v2/user/${userID}?selections=profile,personalstats&cat=all&key=${keys[key_id].key}`;

    let data2 = await APICall(url, key_id);

	if(data2["error"] === 1){
		return;
	}

	data2 = data2.data;

	
	let uObj = {};

	if(users.hasOwnProperty(userID)){
		if(!users[userID].items.hasOwnProperty(listingID)){
			users[userID].items[listingID] = iObj;
		}
	}
	else{
		uObj = {
			name: data.user.name,
			id: userID,
			factionID: data.faction?.ID,
			factionName: data.faction?.name,
			items: {},
			state: data2.status.state,
			description: data2.status.description,
			status: data2.last_action.status,
			lastAction: data2.last_action.timestamp,
			soldValue: 0,
			soldItems: [],
			job: data2.job?.company_type,
			lastAPICall: data2,
		};
		
		uObj.items[listingID] = iObj;
		users[userID] = uObj;
		
	}
	console.log(`Added ${iObj.name}[${itemID}] Listed By: ${users[userID].name}[${userID}]. Qty ${iObj.amount} @ $${iObj.price}`);
	client.channels.cache.get(bot.channel_logs).send({ content: `Added ${iObj.name}[${itemID}] Listed By: ${users[userID].name}[${userID}]. Qty ${iObj.amount} @ $${iObj.price}` });
}

wss.on('connection', (socket) => {
    console.log('New client connected');
	welcome_msg = {
		message : 'Hello, client',
		payload : 'TESTING'
	};
	socket.send(JSON.stringify(welcome_msg));

    // Handle incoming messages
    socket.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());

            const { comment, data_whole } = parsedMessage;

			if(comment === 'Listings'){
				HandleWebsocketCheck(data_whole);
			}
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    });

	// Handle client disconnection
    socket.on('close', () => {
        console.log('Client disconnected');
    });
});

server.listen(8080, '0.0.0.0', () => {
    console.log('WebSocket server running on wss://18.194.249.101:8080');
});

// Function to broadcast messages to connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}





let bot = require("./token.json");

let keys = require("./keys.json");
let players = require('./players.json'); // stakeout
let protections = require('./protections.json'); // protections
let items = require('./items.json'); // cheap market
let listings = require('./listings.json'); // user listings
let users = require('./users.json'); // users list
let RW = require('./RW.json'); // RW list
let pingedUser = require('./pingedUser.json'); // "1441750" : [value, time];

let bot_pause = 0;
let count_calls = 0;
let temp_keys = {};
let pinged = {};

let BBValue = 5500000;
const smalls = ["16", "24", "25", "108", "233", "241", "248", "483", "484", "485", "486", "487", "488"];
const rifles = ["26", "28", "30", "219", "223", "225", "398", "399", "612"];
const HA = ["1152", "1153", "1154", "1155", "1156", "1157"];

let callsStakeout = 0;
let callsProtection = 0;
let callsUser = 0;
let callsRW = 0;
let lastCallsStakeout = 0;
let lastCallsProtection = 0;
let lastCallsUser = 0;
let lastCallsRW = 0;
let minTimeStakeout = 10 * 1000;
let minTimeProtection = 31 * 1000;
let minTimeUser = 30 * 1000;
let minTimeRW = 30 * 1000;

function shortenNumber(num) {
	let prefix = '';
	if(num < 0) prefix = '-';

    num = num.toString().replace(/[^0-9.]/g, '');
    if (num < 1000) {
        return num;
    }
    let si = [
      {v: 1E3, s: "K"},
      {v: 1E6, s: "M"},
      {v: 1E9, s: "B"},
      {v: 1E12, s: "T"},
      {v: 1E15, s: "Q"},
      {v: 1E18, s: "E"}
      ];
    let index;
    for (index = si.length - 1; index > 0; index--) {
        if (num >= si[index].v) {
            break;
        }
    }
    return prefix+(num / si[index].v).toFixed(2).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + si[index].s;
}

async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function predictStat(data){
	//
	let age = data.age;
	let activity = data.personalstats.other.activity.time;

	let attacksstalemated = data.personalstats.attacking.attacks.stalemate;
	let attacksassisted = data.personalstats.attacking.attacks.assist;
	let attackswon = data.personalstats.attacking.attacks.won;
	let attackslost = data.personalstats.attacking.attacks.lost;

	let revives = data.personalstats.hospital.reviving.revives;

	let statenhancersused = data.personalstats.items.used.stat_enhancers;

	///

	let xantaken = data.personalstats.drugs.xanax;
	let refills = data.personalstats.other.refills.energy;
	let energydrinkused = data.personalstats.items.used.energy_drinks;
	let boostersused = data.personalstats.items.used.boosters;
	let dumpE = data.personalstats.items.found.dump * 5;
	let lsdE = data.personalstats.drugs.lsd * 50;
	let donatordays = data.personalstats.other.donator_days;

	boostersused = boostersused - statenhancersused;

	///

	let attackE = (attackswon + attackslost + attacksstalemated + attacksassisted) * 25;
	let reviveE = revives * 25;
	//let bountyE = data.personalstats.bountiescollected ? data.personalstats.bountiescollected * 25 : 0;
	//let huntingE = (data.personalstats.soutravel) ? data.personalstats.soutravel * 2250 : 0;
	//let totalExpenditure = attackE + reviveE + dumpE + bountyE;
	let totalExpenditure = attackE + reviveE + dumpE;

	let energyDrinksE = energydrinkused * 25;
	let xanE = xantaken * 250;
	let naturalE, naturalE2;

	if(donatordays > 10 && ((activity / (age * 86400)) * 100) >= 0.5){ // donator and more than 50% activity
		naturalE = donatordays * 400; //500??
		naturalE2 = donatordays * 460; // 575??
	} // else if ??
	else { // non donator or less than 50% activity
		naturalE = (activity/5000)*(Math.log2(age)/2.5) * 175;
		naturalE2 = (activity/5000)*(Math.log2(age)/2.5) * 225;
	}

	
	//if(boostersused >= 100) estimatedFHC = boostersused * 0.3 * 100;
	let estimatedFHC = boostersused * 0.9; // 90% of non SE boosters assumed FHCs
	let FHCe = donatordays > 10?  estimatedFHC * 150: estimatedFHC * 100;
	let refillE = donatordays > 10?  refills * 150: refills * 100;

	let totalEGain = energyDrinksE + lsdE + xanE + refillE + naturalE + FHCe;
	let totalEGain2 = energyDrinksE + lsdE + xanE + refillE + naturalE2 + FHCe;

	let eToSpend = totalEGain - totalExpenditure;
	let eToSpend2 = totalEGain2 - totalExpenditure;

	let eToNextGym = [
		['Premier Fitness', 200, 2.0, 5],
		['Average Joes', 500, 2.5, 5],
		['Woody\'s Workout', 1000, 2.95, 5],
		['Beach Bods', 2000, 3.2, 5],
		['Silver Gym', 2750, 3.4, 5],
		['Pour Femme', 3000, 3.6, 5],
		['Davies Den', 3500, 3.7, 5],
		['Global Gym', 4000, 4.0, 5],
		['Knuckle Heads', 6000, 4.35, 10],
		['Pioneer Fitness', 7000, 4.55, 10],
		['Anabolic Anomalies', 8000, 4.85, 10],
		['Core', 11000, 5.05, 10],
		['Racing Fitness', 12420, 5.1, 10],
		['Complete Cardio', 18000, 5.5, 10],
		['Legs, Bums and Tums', 18100, 5.67, 10],
		['Deep Burn', 24140, 6.0, 10],
		['Apollo Gym', 31260, 6.2, 10],
		['Gun Shop', 36610, 6.35, 10],
		['Force Training', 46640, 6.55, 10],
		['Cha Cha\'s', 56520, 6.65, 10],
		['Atlas', 67775, 6.6, 10],
		['Last Round', 84535, 6.75, 10],
		['The Edge', 106305, 6.9, 10]
	];
	//console.log(eToSpend);
	//
	// let eScore = Math.round((eInGym / 100) + (boostersused) + (statenhancersused * 100)).toLocaleString();
	//console.log( (Math.round((eInGym / 100) + (boostersused) + (statenhancersused * 100)) * 1000).toLocaleString() );

	let stats = 1;
	let stats2 = 1;
	let bonus = 1.15; // 1.11
	let happy = 4225;
	let gain;

	function softCapStatsCalculation(eToSpend){
		stats += 2075 * eToSpend + (0.01 * boostersused * eToSpend);
	}

	function softCapStatsCalculation2(eToSpend2){
		stats2 += 6000 * eToSpend2;
	}

	for(var i = 0; i < eToNextGym.length; i++){
		if(eToSpend <= 0) break;
		if(stats >= 50000000){
			softCapStatsCalculation(eToSpend);
			break;
		}

		if(eToSpend >= eToNextGym[i][1]){
			gain = ((eToNextGym[i][2] * 4) * ((0.00019106 * stats) + (0.00226263 * happy) + 0.55)) * (bonus) / 150 * eToNextGym[i][1];
			eToSpend -= eToNextGym[i][1];
		} else {
			gain = ((eToNextGym[i][2] * 4) * ((0.00019106 * stats) + (0.00226263 * happy) + 0.55)) * (bonus) / 150 * eToSpend;
			eToSpend = 0;
		}

		stats += gain;
	}

	for(i = 0; i < eToNextGym.length; i++){
		if(eToSpend2 <= 0) break;
		if(stats2 >= 50000000){
			softCapStatsCalculation2(eToSpend2);
			break;
		}

		if(eToSpend2 >= eToNextGym[i][1]){
			gain = ((eToNextGym[i][2] * 4) * ((0.00019106 * stats2) + (0.00226263 * happy) + 0.55)) * (bonus) / 150 * eToNextGym[i][1];
			eToSpend2 -= eToNextGym[i][1];
		} else {
			gain = ((eToNextGym[i][2] * 4) * ((0.00019106 * stats2) + (0.00226263 * happy) + 0.55)) * (bonus) / 150 * eToSpend2;
			eToSpend2 = 0;
		}

		stats2 += gain;
	}

	if(boostersused < 100) stats += boostersused/5 * 5000;
	if(boostersused < 100) stats2 += boostersused/5 * 20000;

	stats = Math.ceil(Math.min(stats,stats2));
	stats2 = Math.ceil(Math.max(stats,stats2) / Math.log(Math.max(stats,stats2)) * 12);

	//console.log(`Pre SE stats:  ~ [${shortenNumber(Math.min(stats,stats2))}] - [${shortenNumber(Math.max(stats,stats2))}]`);
	let starting_stat = 2500000000;

	if(statenhancersused <= 250){
		starting_stat = 2500000000;
		for (i = 0; i < statenhancersused; i++){
			stats += starting_stat * 0.01;
			stats2 += starting_stat * 0.01;
			starting_stat *= 1.01;
		}
	}
	else if(statenhancersused <= 1000){
		starting_stat = 2500000000;
		for (i = 0; i < statenhancersused/2; i++){ // 50% SEs in each stat
			stats += starting_stat * 0.01 * 2;
			stats2 += starting_stat * 0.01 * 2;
			starting_stat *= 1.01;
		}
	}
	else{
		starting_stat = 2500000000;
		for (i = 0; i < statenhancersused*0.4; i++){ // 40% SEs in 1st and 2nd stat
			stats += starting_stat * 0.01 * 2;
			stats2 += starting_stat * 0.01 * 2;
			starting_stat *= 1.01;
		}
		starting_stat = 2500000000;
		for (i = 0; i < statenhancersused*0.2; i++){ // 20% SEs in 3rd stat
			stats += starting_stat * 0.01;
			stats2 += starting_stat * 0.01;
			starting_stat *= 1.01;
		}
	}

	stats = Math.ceil(Math.min(stats,stats2));
	stats2 = Math.ceil(Math.max(stats,stats2) / Math.log(Math.max(stats,stats2)) * 12);

	let text = `~ ${shortenNumber(Math.min(stats,stats2))} - ${shortenNumber(Math.max(stats,stats2))}`;

	return text;
}

async function sendPingStakeout(text, data){
    let color;
    switch(data.last_action.status){
        case "Online": color = "#0ca60c"; break;
        case "Idle": color = "#e37d10"; break;
        default: color = "#ccc8c8"; break;
    }

    let status = new EmbedBuilder();

    let index = data.player_id;
	
	status.setTitle(data.name + " [" + index + "]")
		.setColor(color)
		.setURL('https://www.torn.com/profiles.php?XID=' + index)
		.setDescription(`
			${data.faction.faction_name} [${data.faction.faction_id}]
			**${data.last_action.status} ${data.status.state}**
			${data.status.state === 'Hospital' ? `Is leaving hospital <t:${data.status.until}:R>\n` : ``}
			**${text}**

			Last action: ${data.last_action.relative}`
		)
		.addFields(
			{ name: 'Xanax', value: `${data.personalstats.drugs.xanax}`, inline: true },
			{ name: ' ', value: ` `, inline: true },
			{ name: 'LSD', value: `${data.personalstats.drugs.lsd}`, inline: true },
			{ name: 'SEs', value: `${data.personalstats.items.used.stat_enhancers}`, inline: true },
			{ name: ' ', value: ` `, inline: true },
			{ name: 'ELO', value: `${data.personalstats.attacking.elo}`, inline: true }
		)
		.addFields(
			{ name: 'STAT ESTIMATE', value: `${await predictStat(data)}`, inline: true }
		)
		.setFooter({ text: `Pinged at ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}` });
	
    let pings = ``;
    for(let i in players[index].tracking){
        pings += `\n<@${i}> Target ${players[index].name} [${index}] update! Comment: ${players[index].tracking[i].comment}`
    }
    client.channels.cache.get(bot.channel_stakeout).send({ content: pings, embeds: [status] });
}




async function stakeoutChecking(index, key_id) {
	currdate = parseInt(Date.now()/1000);

	let data = {};
	data['error'] = 1;
	data['data'] = {};

    let url = `https://api.torn.com/v2/user/${index}?selections=profile,personalstats&cat=all&from=${currdate}&key=${keys[key_id].key}`;

    data = await APICall(url, key_id);
	callsStakeout++;

    if(data && data.error === 0){
        data = data.data;
        try{
            if(data.status.state === "Federal"){
                delete players[index];
                console.log(`Removed ${data.name}[${index}] from stakeout since in federal jail.`);
                client.channels.cache.get(bot.channel_logs).send({ content: `Removed ${data.name}[${index}] from stakeout since in federal jail at: ${new Date()}` });
                client.channels.cache.get(bot.channel_stakeout).send({ content: `${data.name}[${index}] is in Federal Jail. Removed from stakeout.` });
                return;
            }
            
            if(data.status && ['Traveling', 'Hospital', 'Jail', 'Abroad', 'Okay'].includes(data.status.state)){

                if(data.last_action.status !== players[index].last_action_status){
                    // handle ping
                    let text = `Status change for ${data.name}[${index}]: ${players[index].last_action_status} -> ${data.last_action.status}`;
                    console.log(text);
                    sendPingStakeout(text, data);

                    players[index].last_action_status = data.last_action.status;
                }

                if(data.status.state !== players[index].state){
                    // Went to Hosp
                    if(data.status.state === "Hospital"){
                        // handle ping
                        let text = `User ${data.name}[${index}] is in the hospital. ${data.status.description}`;
                        console.log(text);
                        sendPingStakeout(text, data);
                    }
                    
                    // Started Travelling
                    if(data.status.description.includes("Traveling")){
                        // handle ping
                        let text = `User ${data.name}[${index}] started travelling. ${data.status.description}`;
                        console.log(text);
                        sendPingStakeout(text, data);
                    }

                    // Landed Abroad
                    if(data.status.state === "Abroad"){
                        // handle ping
                        let text = `User ${data.name}[${index}] landed abroad. ${data.status.description}`;
                        console.log(text);
                        sendPingStakeout(text, data);
                    }

                    // Started Returning
                    if(data.status.description.includes("Returning")){
                        // handle ping
                        let text = `User ${data.name}[${index}] started returning. ${data.status.description}`;
                        console.log(text);
                        sendPingStakeout(text, data);
                    }

                    // Is Okay
                    if(data.status.state === "Okay"){
                        // handle ping
                        let text = `User ${data.name}[${index}] is now Okay.`;
                        console.log(text);
                        sendPingStakeout(text, data);
                    }


                    players[index].state = data.status.state;
                }
                
                /*
                if(data.status.state === 'Hospital'){
                    if((data.status.until - currdate) < 120){
                        // console.log(`${data.name} skipped, too long in hospital ${Math.ceil((data.status.until - currdate)/60)} minutes`);
                        return;
                    }
                }
                */
        
            } else{
                console.error('Unexpected response structure:', data.status);
                return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected response structure: ${data.status}` });
            }
        } catch(error){
            console.log(`Unexpected error: ${error}`);
            return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in stakeoutChecking: ${error.message}\n${error.stack}` });
        }
    }
    else{
        return;
    }
	
	
}

async function userChecking(index, key_id){
	currdate = parseInt(Date.now()/1000);

	data = {};
	data['error'] = 1;
	data['data'] = {};

	let url = `https://api.torn.com/v2/user/${index}?selections=profile,personalstats&cat=all&from=${currdate}&key=${keys[key_id].key}`;

	data = await APICall(url, key_id);
	callsUser++;

    if(data && data.error === 0){
        data = data.data;
        try{
            if(data.status.state === "Federal"){
                delete users[index];
                console.log(`Removed ${data.name}[${index}] from users since in federal jail.`);
                client.channels.cache.get(bot.channel_logs).send({ content: `Removed ${data.name}[${index}] from users since in federal jail at: ${new Date()}` });
                client.channels.cache.get(bot.channel_sales).send({ content: `${data.name}[${index}] is in Federal Jail. Removed from tracking.` });
                return;
            }
            
            if(data.status && ['Traveling', 'Hospital', 'Jail', 'Abroad', 'Okay'].includes(data.status.state)){
				try{
					if(['Traveling', 'Abroad'].includes(data.status.state) || (data.status.state === 'Hospital' && data.status.description.includes('In a') && !data.status.details.includes('Mugged'))){
						// pass
					}
					else if(users[index].lastAction !== data.last_action.timestamp){
						users[index].lastAction = data.last_action.timestamp;
						users[index].soldValue = 0;
						users[index].soldItems = [];
						if(pingedUser.hasOwnProperty(index)){
							delete pingedUser[index];
						}
					}
				}
				catch(error){
					client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in UserChecking: userID: ${index}\n${error.message}\n${error.stack}\n${JSON.stringify(users[index])}` });
				}
				if(data.status.state === 'Hospital' && (!users[index].lastAPICall.status.details.includes('Mugged')) && data.status.details.includes('Mugged')){
					client.channels.cache.get(bot.channel_RWLogs).send({ content: `Player ${users[index].name} [${index}]: ${data.status.details.replace(/<a href = "(.*?)">(.*?)<\/a>/g, '[$2]($1)')} at: ${new Date()}\n${JSON.stringify(users[index].soldItems)}` });
					users[index].soldValue = 0;
					users[index].soldItems = [];
					if(pingedUser.hasOwnProperty(index)){
						delete pingedUser[index];
					}
				}

				users[index].state = data.status.state;
				users[index].description = data.status.description;
				users[index].status = data.last_action.status;
				users[index].job = data.job.company_type;
				users[index].factionID = data.faction.faction_id;
				users[index].factionName = data.faction.faction_name;
				users[index].lastAPICall = data;
            } else{
                console.error('Unexpected response structure:', data.status);
                return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected response structure: ${data.status}` });
            }
        } catch(error){
            console.log(`Unexpected error: ${error}`);
            return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in stakeoutChecking: index: ${index}\n${error.message}\n${error.stack}` });
        }
    }
    else{
        return;
    }
}

async function userChecking2(data){
	currdate = parseInt(Date.now()/1000);

    if(data && data.error === 0){
        data = data.data;
		const index = data.player_id.toString();
        try{
            if(data.status.state === "Federal"){
                delete users[index];
                console.log(`Removed ${data.name}[${index}] from users since in federal jail.`);
                client.channels.cache.get(bot.channel_logs).send({ content: `Removed ${data.name}[${index}] from users since in federal jail at: ${new Date()}` });
                client.channels.cache.get(bot.channel_sales).send({ content: `${data.name}[${index}] is in Federal Jail. Removed from tracking.` });
                return;
            }
            
            if(data.status && ['Traveling', 'Hospital', 'Jail', 'Abroad', 'Okay'].includes(data.status.state)){
				try{
					if(['Traveling', 'Abroad'].includes(data.status.state) || (data.status.state === 'Hospital' && data.status.description.includes('In a') && !data.status.details.includes('Mugged'))){
						// pass
					}
					else if(users[index].lastAction !== data.last_action.timestamp){
						users[index].lastAction = data.last_action.timestamp;
						users[index].soldValue = 0;
						users[index].soldItems = [];
						if(pingedUser.hasOwnProperty(index)){
							delete pingedUser[index];
						}
					}
				}
				catch(error){
					client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in UserChecking: userID: ${index}\n${error.message}\n${error.stack}\n${JSON.stringify(users[index])}` });
				}
				if(data.status.state === 'Hospital' && (!users[index].lastAPICall.status.details.includes('Mugged')) && data.status.details.includes('Mugged')){
					client.channels.cache.get(bot.channel_RWLogs).send({ content: `Player ${users[index].name} [${index}]: ${data.status.details.replace(/<a href = "(.*?)">(.*?)<\/a>/g, '[$2]($1)')} at: ${new Date()}\n${JSON.stringify(users[index].soldItems)}` });
					users[index].soldValue = 0;
					users[index].soldItems = [];
					if(pingedUser.hasOwnProperty(index)){
						delete pingedUser[index];
					}
				}

				users[index].state = data.status.state;
				users[index].description = data.status.description;
				users[index].status = data.last_action.status;
				users[index].job = data.job.company_type;
				users[index].factionID = data.faction.faction_id;
				users[index].factionName = data.faction.faction_name;
				users[index].lastAPICall = data;
            } else{
                console.error('Unexpected response structure:', data.status);
                return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected response structure: ${data.status}` });
            }
        } catch(error){
            console.log(`Unexpected error: ${error}`);
            return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in stakeoutChecking: index: ${index}\n${error.message}\n${error.stack}` });
        }
    }
    else{
        return;
    }
}

async function handleSold(index, i, userID, currdate){
	let keys_list = Object.keys(keys);
	let randomIndex = Math.floor(Math.random() * keys_list.length);
	let key_id = keys_list[randomIndex];

	let data = {};
	data['error'] = 1;
	data['data'] = {};

	let url = `https://api.torn.com/v2/user/${userID}?selections=profile,personalstats&cat=all&from=${currdate}&key=${keys[key_id].key}`;

	data = await APICall(url, key_id);
	callsUser++;
	if(data && data.error === 0){
		let soldQty = listings[index][i].amount;
		let soldPrice = listings[index][i].price;
		let soldValue = soldQty * soldPrice;

		let itemName = listings[index][i].name;
		let temp_listing = listings[index][i];
		if(!users.hasOwnProperty(userID)){
			return;
		}

		delete users[userID].items[i];
		delete listings[index][i];
		
		if(data.data.last_action.status === 'Online' && !data.data.status.state.includes('Travelling')){
			client.channels.cache.get(bot.channel_RWLogs).send({ content: `${users[userID].name} [${userID}] sold $${shortenNumber(soldValue)} worth, **${data.data.last_action.status} | ${data.data.status.state}**, @ ${new Date(currdate*1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}\n${i}: \`${JSON.stringify(temp_listing)}\`` });
			soldValue = 0;
			users[userID].soldItems = [];
		}
		else{
			client.channels.cache.get(bot.channel_RWLogs).send({ content: `${users[userID].name} [${userID}] sold $${shortenNumber(soldValue)} worth, **${data.data.last_action.status} | ${data.data.status.state}**, @ ${new Date(currdate*1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}\n${i}: \`${JSON.stringify(temp_listing)}\`` });
			if(users[userID].job === 5){
				soldValue *= 0.25;
			}
			users[userID].soldValue += soldValue;
			users[userID].soldItems.push(`${itemName} [${i}] x ${soldQty} @ $${shortenNumber(soldPrice)}`);
			moneyChecking(userID, data.data);
			userChecking2(data);
		}
	}
}

async function RWChecking(index, key_id) {
	currdate = parseInt(Date.now()/1000);

	let data = {};
	let offset = false;
	let error2 = false;

	let patch = false;

    let url = `https://api.torn.com/v2/market/${index}/itemmarket?&bonus=Any&from=${currdate}&key=${keys[key_id].key}`;

	try{
		do {
			let temp = {};
			temp['error'] = 1;
			temp['data'] = {};
			temp = await APICall(url, key_id);
			callsRW++;
			if(temp['error'] === 0 && Object.keys(temp['data']).length){
				if(Object.keys(data).length === 0){
					data = {...temp['data']};
				}
				else{
					data.itemmarket.listings.push(...temp.data.itemmarket.listings);
				}
				if(temp.data._metadata.next && patch === false){
					offset = true;
					url = `https://api.torn.com/v2/market/${index}/itemmarket?&bonus=Any&offset=${Object.keys(data.itemmarket.listings).length - 5}&from=${currdate}&key=${keys[key_id].key}`;
					//console.log(index, data.itemmarket.item.name, url);

					if(Object.keys(data.itemmarket.listings).length !== 100 && patch === false){
						offset = false;
						patch = true;
					}
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
	} catch(error){
		console.log(`Unexpected error: ${error}`);
		client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in RWChecking: ${error.message}\n${error.stack}` });
	}

	if(data && Object.keys(data).length > 0 && !error2){
		try{
			checkCheapRW(index, data);
			const dictionary = data['listings'].reduce((acc, item) => {
				acc[item.itemDetails.uid] = item;
				return acc;
			}, {});

			if(Object.keys(dictionary).length === 0 && ![680, 681, '680', '681'].includes(index)){
				client.channels.cache.get(bot.channel_error).send({ content:`0 itemmarket listings returned for ${RW[index]} [${index}]` });
				return;
			}

			for (let i in dictionary){
				try{
					if(!listings.hasOwnProperty(index) || !listings[index]?.hasOwnProperty(i)){
						// new listing - not found.
						let payload = {
							message: 'New Listing',
							itemID: index,
							UID: dictionary[i].itemDetails.uid,
							itemName: RW[index],
						};
						broadcast(payload);
					}
				}
				catch(error){
					client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in RWChecking: itemID: ${index}, listingID: ${i}\n${error.message}\n${error.stack}\n${JSON.stringify(listings[index])}` });
				}
			}
			
			for (let i in listings[index]){
				let userID = listings[index][i].userID;
				if(userID === '0'){
					// anon listing
					continue;
				}
				
				if(dictionary.hasOwnProperty(i)) {
					if(listings[index][i].price !== dictionary[i].price){
						listings[index][i].price = dictionary[i].price;
						users[userID].items[i].price = dictionary[i].price;
					}
				}
				else {
					//client.channels.cache.get(bot.channel_error).send({ content:`Listing ID: ${i} not in itemmarket listings:\n${JSON.stringify(dictionary)}` });
					//console.log(`Listing ID: ${i} not in itemmarket listings.`);
					//console.log(dictionary);
					// Listing sold
					handleSold(index, i, userID, currdate);
				}
			}

			if(!items.hasOwnProperty(index)){ // skip weapons
				return;
			}

			if ((data.listings.length === 0)) {
				return;
			}

			const minCost = data.listings[0].price;
			const qty = data.listings[0].amount;

			if(items[index].lastCheapestValue === minCost && items[index].qty === qty){
				//console.log(`${items[index].name} no change in listing.`)
				return;
			}

			items[index].lastCheapestValue = minCost;
			items[index].qty = qty;

			let diff = (items[index].minimum - minCost) * qty;
			let diff2 = ( (items[index].minimum * 0.6) - minCost) * qty;

			let color = "#0ca60c";

			if(diff2 >= 0){
				let payload = {
					message: 'Cheap Listing RW',
					itemID: index,
					UID: dictionary[listing_id]?.itemDetails.uid || 0,
					itemName: RW[index],
				};
				broadcast(payload);
			}
			
			if(diff >= 0){
				let status = new EmbedBuilder();
				status.setTitle(`${items[index].qty}x ${items[index].name} [${items[index].id}]`)
					.setColor(color)
					.setURL('https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=' + items[index].id)
					.setDescription("NEW LISTING")
					.addFields(
						{ name: 'Price', value: `$${shortenNumber(minCost)}`, inline: true },
						{ name: ' ', value: " ", inline: true },
						{ name: 'Quantity', value: `${qty}`, inline: true },
						{ name: 'Profit', value: `$${shortenNumber(diff)}`, inline: true },
						{ name: ' ', value: " ", inline: true },
						{ name: 'Tracking under', value: `$${shortenNumber(items[index].minimum)}`, inline: true }
					)
					.setFooter({ text: `Pinged at ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}` });

				if(diff >= 5000000){
					client.channels.cache.get(bot.channel_cheapbuys).send({ content: `<@&${bot.role_buy}>`, embeds: [status] });
				}
				else if(diff >= 1000000){
					client.channels.cache.get(bot.channel_cheapbuys).send({ embeds: [status] });
				}
				return console.log(`${items[index].name} has a new listing with potential profit: $${diff}, sending message`);
			}
		} catch(error){
			console.log(`Unexpected error: ${error}`);
			client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in weaponChecking: ${error.message}\n${error.stack}` });
		}
	}
    else{
        return;
    }
}

async function protectionChecking(index) {
	currdate = parseInt(Date.now()/1000);
	if(pinged.hasOwnProperty(index)){
		if(currdate - pinged[index] >= 300){
			delete pinged[index];
		}
		else{
			return;
		}
	}

	let data = {};
	data['error'] = 1;
	data['data'] = {};

    let url = `https://api.torn.com/v2/user/?selections=profile,money,battlestats&from=${currdate}&key=${protections[index].key}`;

    data = await APICallProtection(url, index);
	callsProtection++;

    if(data && data.error === 0){
        data = data.data;
        try{
            if(data.status.state === "Federal"){
                delete protections[index];
                console.log(`Removed ${data.name}[${index}] from protection since in federal jail.`);
                client.channels.cache.get(bot.channel_logs).send({ content: `Removed ${data.name}[${index}] from protection since in federal jail at: ${new Date()}` });
                client.channels.cache.get(bot.channel_helphosp).send({ content: `${data.name}[${index}] is in Federal Jail. <@${protections[index].discord}> Removed from protection.` });
                return;
            }
            
			if(data.money_onhand >= protections[index].minimum && (data.last_action.status === "Offline" || (data.last_action.status === "Idle" && currdate - data.last_action.timestamp > 15*60))){
				if(data.status.state === "Okay" || (data.status.state == "Hospital" && 180 > data.status.until - currdate)){
					let status = new EmbedBuilder();
					let color = "#0ca60c";

					status.setTitle(data.name + " [" + index + "]")
						.setColor(color)
						.setURL('https://www.torn.com/loader.php?sid=attack&user2ID=' + index)
						.setDescription(`
							${data.faction.faction_name} [${data.faction.faction_id}]
							**${data.last_action.status}** and ${data.status.state === 'Hospital' ?
								`Is leaving hospital <t:${data.status.until}:R>`
								: `Is ${data.status.state}`}
							**And has $${shortenNumber(data.money_onhand)} on hand.**
							Last action: ${data.last_action.relative}`
						)
						.addFields(
							{ name: 'Strength', value: `${shortenNumber(data.strength)}`, inline: true },
							{ name: ' ', value: ` `, inline: true },
							{ name: 'Defense', value: `${shortenNumber(data.defense)}`, inline: true },
							{ name: 'Speed', value: `${shortenNumber(data.speed)}`, inline: true },
							{ name: ' ', value: ` `, inline: true },
							{ name: 'Dexterity', value: `${shortenNumber(data.dexterity)}`, inline: true }
						)
						.addFields(
							{ name: 'TOTAL STATS', value: `${shortenNumber(data.total)}`, inline: true }
						)
						.setFooter({ text: `Pinged at ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}` });
					
					client.channels.cache.get(bot.channel_helphosp).send({ content: `<@&${bot.role_hosp}> <@${protections[index].discord}>`, embeds: [status] });
					pinged[index] = currdate;
					//console.log(`${items[index].name} has a new listing with potential profit: $${diff}, sending message`);
				}
			}
            
        } catch(error){
            console.log(`Unexpected error: ${error}`);
            return client.channels.cache.get(bot.channel_error).send({ content:`Unexpected error in protectionChecking: ${error.message}\n${error.stack}` });
        }
    }
    else{
        return;
    }
	
	
}

async function checkCheapRW(index, data) {
	let checkCheapRWcount = 0;
	let bucks = 0;
	if(data.item.type === 'Defensive'){
		bucks = 12;
	}
	else if(data.item.type === 'Melee'){
		bucks = 6;
	}
	else if(data.item.type === 'Primary' || data.item.type === 'Secondary'){
		if(smalls.includes(data.item.name)){
			bucks = 4;
		}
		else if(rifles.includes(data.item.name)){
			bucks = 10;
		}
		else if(HA.includes(data.item.name)){
			bucks = 14;
		}
	}
	for (let listing of data.listings){
		let bucks2 = bucks;
		if(listing.itemDetails.rarity === 'orange'){
			bucks2 *= 3;
		}
		else if(listing.itemDetails.rarity === 'red'){
			bucks2 *= 9;
		}
		if(listing.itemDetails.bonuses.length === 2){
			bucks2 *= 1.5;
		}
		let diff = (bucks2 * BBValue) - listing.price;
		if(diff >= 0){
			let status = new EmbedBuilder();
			status.setTitle(`${listing.amount}x ${data.item.name} [${data.item.id}]`)
				.setColor("#0ca60c")
				.setURL(`https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${data.item.id}`)
				.setDescription("CHEAPER THAN BUNKER")
				.addFields(
					{ name: 'Price', value: `$${shortenNumber(listing.price)}`, inline: true },
					{ name: 'BB Val', value: `$${shortenNumber(bucks2 * BBValue)}`, inline: true },
					{ name: 'Quantity', value: `${listing.amount}`, inline: true }
				)
				.setFooter({ text: `Pinged at ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')}` });
			
			client.channels.cache.get(bot.channel_cheapbuys).send({ content: bot.role_buy, embeds: [status] });
		}
		checkCheapRWcount++;
		if(checkCheapRWcount >= 3){
			return;
		}
	}
}




async function APICall(url, key_id){
	++count_calls;

	let data = {}
    data["data"] = {};
    data["error"] = 0;

	try {
        
		let key = keys[key_id].key;
		let keyname = keys[key_id].holder;

		const response = await axios.get(url, { timeout: 15000 });

		if(!response.data){
            data["error"] = 1;
            return data;
        }

		if (response.data.error) {
            data["error"] = 1;
			const errorCode = response.data.error.code;

			if ([2, 5, 10, 13, 18].includes(errorCode)) {
				if ([5].includes(errorCode)) {
					if (keys.hasOwnProperty(key_id)) {
						delete keys[key_id];
						if (temp_keys.hasOwnProperty(key_id)) {
							temp_keys[key_id]["count"] += 1;
						} else{
							temp_keys[key_id] = {};
							temp_keys[key_id]["key"] = key;
							temp_keys[key_id]["count"] = 1;
						}
					}

					fs.writeFileSync('keys.json', JSON.stringify(keys));
					console.log(`${keyname}'s key is making too many requests! Removing it. Add it back later. Skipping request.`);
                    client.channels.cache.get(bot.channel_logs).send({ content:`${keyname}, your key is making too many requests! Removing it temporarily.` });
                    return data;
				} else{
					if (keys.hasOwnProperty(key_id)) {
						delete keys[key_id];
					}
					fs.writeFileSync('keys.json', JSON.stringify(keys));
					console.log(`${keyname}'s key is invalid, removing and skipping`);
					client.channels.cache.get(bot.channel_logs).send({ content:`${keyname}, your key is invalid! Removing it.` });
                    return data;
				}
			} else if ([8, 9, 14, 17].includes(errorCode)) {
                // Handle other specific errors if needed
                bot_pause += 1;

                //console.log(`${keyname}'s key is giving error: ${errorCode}, skipping`);
				//return client.channels.cache.get(bot.channel_logs).send({ content:`${keyname}, Error Code: ${errorCode} ${response.data.error.error}` });
                return data;
            }
            else {
                console.error(`Unhandled error code: ${errorCode}`);
                client.channels.cache.get(bot.channel_logs).send({ content:`Unhandled API error code: ${errorCode} ${response.data.error.error}.\nAPI Key Holder: ${keyname}\nURL: ${url}` });
                return data;
            }
		}

        if (temp_keys.hasOwnProperty(key_id)) {
            delete temp_keys[key_id];
        }

        data["data"] = response.data;
		return data;

		
	} catch(error){
		let data = {};
		data['data'] = {};
        data["error"] = 1;
        let temp = {};
		if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                console.error('Request timed out');
                
                temp["info"] = "Request timed out";
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;

				//client.channels.cache.get(bot.channel_error).send({ content:`${temp["info"]} at ${temp["time"]}\n${temp["message"]}\n${temp["stack"]}` });
				return data;

            } else if (error.response) {
				// Handle specific HTTP error codes if needed
                if (error.response.status === 502 || error.response.status === 503 || error.response.status === 504) {
                    bot_pause += 1; // Adjust as per your logic
                    return;
                }
                // The request was made and the server responded with a status code
                console.log('Error status:', error.response.status);
                console.log('Error data:', error.response.data);
                
                temp["info"] = `HTTP error ${error.response.status}`;
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;
                
            } else if (error.request) {
                // The request was made but no response was received
                console.log('Error request:', error.request);
                
                temp["info"] = "No Response";
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;
            } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error message:', error.message);
                
                temp["info"] = "Unknown Axios error";
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;
            }
        } else {
            console.error('Non-Axios error occurred:', error.message);
            
            temp["info"] = "Unknown non-axios error";
            temp["time"] = new Date();
            temp["message"] = error.message;
            temp["stack"] = error.stack;
        }
        client.channels.cache.get(bot.channel_error).send({ content:`${temp["info"]} at ${temp["time"]}\n${temp["message"]}\n${temp["stack"]}` });
        return data;
    }
}

async function APICallProtection(url, id){
	++count_calls;
	let data = {}
    data["data"] = {};
    data["error"] = 0;

	try {
		const response = await axios.get(url, { timeout: 15000 });

		if(!response.data){
            data["error"] = 2;
            return data;
        }

		if (response.data.error) {
			const errorCode = response.data.error.code;
			data["error"] = `1.${errorCode}`;

			if ([2, 5, 10, 13, 18].includes(errorCode)) {
				if ([5].includes(errorCode)) {
					console.log(`${protections[id].name}'s key is making too many requests! Skipping request.`);
                    client.channels.cache.get(bot.channel_logs).send({ content:`${protections[id].name}, your key is making too many requests! Skipping request.` });
                    return data;
				} else{
					let p_name = '';
					let p_discord = 0;
					if(protections.hasOwnProperty(id)){
						p_name = protections[id].name;
						p_discord = protections[id].discord;
						delete protections[id];
					}
					console.log(`${p_name}'s key is invalid, removing protection.`);
					client.channels.cache.get(bot.channel_logs).send({ content:`${p_name}'s key is invalid! Removing from protection.` });
                    client.channels.cache.get(bot.channel_helphosp).send({ content:`<@${p_discord}>, Your key is invalid! Removing from protection. Please re-add with new key.` });
                    return data;
				}
			} else if ([8, 9, 14, 17].includes(errorCode)) {
                // Handle other specific errors if needed
                bot_pause += 1;

                //console.log(`${keyname}'s key is giving error: ${errorCode}, skipping`);
				//return client.channels.cache.get(bot.channel_logs).send({ content:`${keyname}, Error Code: ${errorCode} ${response.data.error.error}` });
                return data;
            }
            else {
                console.error(`Unhandled error code: ${errorCode}`);
                client.channels.cache.get(bot.channel_logs).send({ content:`Unhandled API error code: ${errorCode} ${response.data.error.error}.\nAPI Key Holder: ${keyname}\nURL: ${url}` });
                return data;
            }
		}

        data["data"] = response.data;
		return data;

		
	} catch(error){
        data["error"] = 1;
        let temp = {};
		if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                console.error('Request timed out');
                
                temp["info"] = "Request timed out";
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;

				//client.channels.cache.get(bot.channel_error).send({ content:`${temp["info"]} at ${temp["time"]}\n${temp["message"]}\n${temp["stack"]}` });
				return data;

            } else if (error.response) {
				// Handle specific HTTP error codes if needed
                if (error.response.status === 502 || error.response.status === 503 || error.response.status === 504) {
                    bot_pause += 1; // Adjust as per your logic
                    return;
                }
                // The request was made and the server responded with a status code
                console.log('Error status:', error.response.status);
                console.log('Error data:', error.response.data);
                
                temp["info"] = `HTTP error ${error.response.status}`;
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;
                
            } else if (error.request) {
                // The request was made but no response was received
                console.log('Error request:', error.request);
                
                temp["info"] = "No Response";
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;
            } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error message:', error.message);
                
                temp["info"] = "Unknown Axios error";
                temp["time"] = new Date();
                temp["message"] = error.message;
                temp["stack"] = error.stack;
            }
        } else {
            console.error('Non-Axios error occurred:', error.message);
            
            temp["info"] = "Unknown non-axios error";
            temp["time"] = new Date();
            temp["message"] = error.message;
            temp["stack"] = error.stack;
        }
        client.channels.cache.get(bot.channel_error).send({ content:`${temp["info"]} at ${temp["time"]}\n${temp["message"]}\n${temp["stack"]}` });
        return data;
    }
}

async function addPlayer(id){
	let pObj = {};
    
    let keys_list = Object.keys(keys);
    let randomIndex = Math.floor(Math.random() * keys_list.length);
    let key_id = keys_list[randomIndex];
    let url = `https://api.torn.com/v2/user/${id}?selections=profile&key=${keys[key_id].key}`;

    let data = await APICall(url, key_id);

    if(data["error"] === 0){
        pObj["name"] = data.data.name;
        pObj["id"] = id;
        pObj["life"] = data.data.life.current;
        pObj["state"] = data.data.status.state;
        pObj["description"] = data.data.status.description;
        pObj["last_action_status"] = data.data.last_action.status;
        pObj["last_action_timestamp"] = data.data.last_action.timestamp;
        pObj["track_start"] = performance.now();
        pObj["travel_start"] = 0;
        pObj["travel_land"] = 0;
        pObj["travel_end"] = 0;

        data.data = pObj;
    }
    
	return data;
}

async function addItem(id, value){
	let pObj = {};
    
    let keys_list = Object.keys(keys);
    let randomIndex = Math.floor(Math.random() * keys_list.length);
    let key_id = keys_list[randomIndex];
    let url = `https://api.torn.com/v2/torn/${id}?selections=items&key=${keys[key_id].key}`;

    let data = await APICall(url, key_id);

    if(data["error"] === 0){
        pObj["name"] = data.data.items[id].name;
        pObj["id"] = id;
        pObj["lastCheapestValue"] = Infinity;
        pObj["minimum"] = value;
        pObj["qty"] = 0;

        data.data = pObj;
    }
    
	return data;
}

async function addProtection(id, value, key){
    let url = `https://api.torn.com/v2/user/?selections=profile,money&key=${key}`;

	let data = {}
    data["data"] = {};
    data["error"] = 0;

	try{
		++count_calls;
		const response = await axios.get(url, { timeout: 15000 });

		if(!response.data){
            data["error"] = 1;
			return data;
        }
		else{
			if (response.data.error) {
				data["error"] = 2;
				return data;
			}

			let pObj = {};
			pObj["name"] = response.data.name;
			pObj["id"] = id;
			pObj["key"] = key;
			pObj["minimum"] = value;
		
			data.data = pObj;
			
			return data;
		}		
	} catch(error){
		data["error"] = 1;
		return data;
	}
}



async function moneyChecking(i, data = null){
	if(!data){
		data = users[i].lastAPICall;
	}
	let timestamp = parseInt(Date.now()/1000);
	let onHand = users[i].soldValue;
	if(onHand < 35000000){
		// not enough for ping
		if(Object.keys(users[i].items).length === 0){
			console.log(`\nUser ${users[i].name} [${i}] has no items for sale. Deleting.\n`)
			delete users[i];
		}
		return;
	}
	if(pingedUser.hasOwnProperty(i) && (pingedUser[i][0] >= onHand || timestamp - 180 <= pingedUser[i][1])){
		// already pinged
		return;
	}

	if(['Okay', 'Traveling', 'Abroad'].includes(data.status.state) || (data.status.state === 'Hospital' && data.status.until - 180 <= timestamp)){
		//handlePing
		let payload = {
			message: 'RW Sale',
			userID: i,
			money: onHand,
		};
		broadcast(payload);
		
		let color;
		switch(data.last_action.status){
			case "Online": color = "#0ca60c"; break;
			case "Idle": color = "#e37d10"; break;
			default: color = "#ccc8c8"; break;
		}
	
		let status = new EmbedBuilder();

		let text = `
				${users[i].factionName} [${users[i].factionID}]
				**${data.last_action.status} & ${data.status.state === 'Hospital' ? `Is leaving hospital <t:${data.status.until}:R>\n` : `${data.status.state}`}**
				
				**CASH ON HAND = ${shortenNumber(onHand)}**

				ITEMS SOLD:`;
		
		for(let j in users[i].soldItems){
			text = `${text}\n${JSON.stringify(users[i].soldItems[j])}`;
		}

		text = `${text}\n\nLast action: ${data.last_action.relative}`;
		
		status.setTitle(users[i].name + " [" + i + "]")
			.setColor(color)
			.setURL('https://www.torn.com/loader.php?sid=attack&user2ID=' + i)
			.setDescription(text)
			.addFields(
				{ name: 'Xanax', value: `${data.personalstats.drugs.xanax}`, inline: true },
				{ name: ' ', value: ` `, inline: true },
				{ name: 'LSD', value: `${data.personalstats.drugs.lsd}`, inline: true },
				{ name: 'SEs', value: `${data.personalstats.items.used.stat_enhancers}`, inline: true },
				{ name: ' ', value: ` `, inline: true },
				{ name: 'ELO', value: `${data.personalstats.attacking.elo}`, inline: true }
			)
			.addFields(
				{ name: 'STAT ESTIMATE', value: `${await predictStat(data)}`, inline: true }
			)
			.setFooter({ text: `Pinged at ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '')} TCT` });
		
		if(data.faction.faction_id === 16628){
			if([1441750, 179208].includes(data.player_id)){
				// skip
			}
			else{
				client.channels.cache.get(bot.channel_helphosp).send({ content: `<@&${bot.role_sales}>`, embeds: [status] });
			}
		}
		else{
			client.channels.cache.get(bot.channel_sales).send({ content: `<@&${bot.role_sales}>`, embeds: [status] });
		}
		
		//client.channels.cache.get(bot.channel_logs).send({ content: `${users[i].name}[${i}] has ${onHand} on hand. ${users[i].status} & ${users[i].state}. Last action: ${users[i].lastAPICall.last_action.relative}`});

		pingedUser[i] = [onHand, timestamp];
		if(Object.keys(users[i].items).length === 0){
			console.log(`\nUser ${users[i].name} [${i}] has no items for sale. Deleting.\n`)
			delete users[i];
		}
	}
}




async function runStakeoutChecking(count){
	callsStakeout = 0;
	let elapsedTime = 0.0;
	let start = performance.now();
	
	let promises = [];
	//console.log(`i, count, pos, key, holder`);
	let key_pos = count;
	let keys_list = Object.keys(keys);

	let key_id = '';

	for (let i in players){
		if (key_pos >= keys_list.length) { key_pos = 0; }
		key_id = keys_list[key_pos].toString();
		promises.push(stakeoutChecking(i, key_id));
		++key_pos;
	}

	await Promise.all(promises);

	minTimeStakeout = Math.max(2, 60/ (100/ Math.max(1, callsStakeout))) * 1000; // either every 2 seconds, or upto 100 calls per minute
	lastCallsStakeout = callsStakeout;
	
	let end = performance.now(); // Record end time
    elapsedTime = Math.round(end - start); // Calculate elapsed time
    console.log(`[ Stakeouts ] x${Object.keys(players).length} Wait Time: ${minTimeStakeout}, Last Run Calls: ${lastCallsStakeout} at:`, new Date(), `in ${elapsedTime} miliseconds.`);

	fs.writeFileSync('players.json', JSON.stringify(players));
}

async function runProtectionChecking(){
	callsProtection = 0;
	let elapsedTimemarket = 0.0;
	let startmarket = performance.now();
	
	const promises = [];

	for (let i in protections) {
		promises.push(protectionChecking(i));
	}
	
	await Promise.all(promises);

	minTimeProtection = Math.max(31, 60/ (10/ Math.max(1, callsProtection))) * 1000; // either every 31 seconds, or upto 10 calls per minute
	lastCallsProtection = callsProtection;
	
	let endmarket = performance.now(); // Record end time
    elapsedTimemarket = Math.round(endmarket - startmarket); // Calculate elapsed time
    console.log(`[Protections] x${Object.keys(protections).length} Wait Time: ${minTimeProtection}, Last Run Calls: ${lastCallsProtection} at:`, new Date(), `in ${elapsedTimemarket} miliseconds.`);
}

async function runUserChecking(count){
	callsUser = 0;
	let elapsedTime = 0.0;
	let start = performance.now();
	
	let promises = [];
	let key_pos = count;
	let keys_list = Object.keys(keys);

	let key_id = '';

	for (let i in users){
		if(users[i].soldValue === 0){
			continue;
		}
		//console.log('Checking user: ', users[i].name, users[i].soldValue);
		if (key_pos >= keys_list.length) { key_pos = 0; }
		key_id = keys_list[key_pos].toString();
		promises.push(userChecking(i, key_id));
		++key_pos;
	}

	await Promise.all(promises);

	let promisesMoney = [];

	for(let i in users){
		promisesMoney.push(moneyChecking(i));
	}
	await Promise.all(promisesMoney);

	minTimeUser = Math.max(30, 60/ (250/ Math.max(1, callsUser))) * 1000; // either every 60 seconds, or upto 150 calls per minute
	minTimeUser = Math.round(minTimeUser);
	lastCallsUser = callsUser;
	
	let end = performance.now(); // Record end time
    elapsedTime = Math.round(end - start); // Calculate elapsed time
    console.log(`[   Users   ] x${Object.keys(users).length} Wait Time: ${minTimeUser}, Last Run Calls: ${lastCallsUser} at:`, new Date(), `in ${elapsedTime} miliseconds.`);

	fs.writeFileSync('users.json', JSON.stringify(users));
}

async function runRWChecking(count){
	callsRW = 0;
	let elapsedTimeRW = 0.0;
	let startRW = performance.now();
	
	const promises = [];

	let keys_list = Object.keys(keys);
	let key_pos = count;

	let key_id = '';

	for (let i in RW) {
		if (key_pos >= keys_list.length - 1) { key_pos = 0; }
		key_id = keys_list[key_pos].toString();
		promises.push(RWChecking(i, key_id));	
		key_pos += 1;
	}
	
	await Promise.all(promises);
	
	let endRW = performance.now(); // Record end time
    elapsedTimeRW = Math.round(endRW - startRW); // Calculate elapsed time
    console.log(`[    RW     ] x${Object.keys(RW).length} Wait Time: ${minTimeRW}, Last Run Calls: ${lastCallsRW} at:`, new Date(), `in ${elapsedTimeRW} miliseconds.`);

	//minTimeRW = Math.max(10, 60/ ((500 - callsRW)/ Math.max(1, callsRW))) * 1000; // either every 10 seconds, or upto 500 calls per minute
	minTimeRW = Math.max(4, 60/ (Math.max(((1000) - (Math.ceil(lastCallsStakeout * (60/minTimeStakeout)) + Math.ceil(lastCallsProtection * (60/minTimeProtection)) + Math.ceil(lastCallsUser * (60/minTimeUser)))), 1) / Math.max(1, callsRW))) * 1000; // either every 6 seconds, or upto 180 calls per minute
	minTimeRW = Math.round(minTimeRW);
	lastCallsRW = callsRW;

	fs.writeFileSync('users.json', JSON.stringify(users));
	fs.writeFileSync('listings.json', JSON.stringify(listings));
	fs.writeFileSync('pingedUser.json', JSON.stringify(pingedUser));
}




const StartLoop = async () => {

	const manageCheckStakeout = async () => {
		try{
			let runloop = 0;
            async function GetDatStakeout() {
				try {
					if(count_calls >= 900){
						await sleep(10 * 1000);
					}
					const startTime = Date.now(); // Record the start time
					//console.log("Starting Loop players at: ", new Date());

					// Call your function and wait for it to complete
					await runStakeoutChecking(runloop);
		
					if(bot_pause >= 100){
						console.log(`API disabled. Stakeouts paused for 1 minute at:`, new Date());
						await sleep(60 * 1000);
						bot_pause = 0;
					}
					
					const endTime = Date.now(); // Record the end time
					const elapsedTime = endTime - startTime; // Calculate elapsed time
		
					// Update runloop
					runloop = (runloop >= Object.keys(keys).length - 1) ? 0 : runloop + 1;
					
					const waitTime = Math.max(minTimeStakeout - elapsedTime, 0);
		
					// Recur to the next iteration of GetDatStakeout
					setTimeout(() => {
						GetDatStakeout();
					}, waitTime);
				} catch (error) {
					console.error(`An error occurred: ${error.message}\n${error.stack}`);
					client.channels.cache.get(bot.channel_error).send({ content:`An error occurred in PLAYERS LOOP (1): ${error.message}\n${error.stack}` });
					// Optionally, handle the error (e.g., retry the function or exit the loop)
				}
			}
			
			// Start the loop
			await GetDatStakeout();
		}
		catch(error){
			console.log(`ERROR IN PLAYERS LOOP: ${error.message}\n${error.stack}`);
			client.channels.cache.get(bot.channel_error).send({ content: `ERROR IN PLAYERS LOOP: ${error.message}\n${error.stack}` });
			await sleep(60 * 1000);
			manageCheckStakeout();
		}
	};

	const manageCheckProtection = async () => {
		try{
            async function GetDatProtection() {
				try {
					if(count_calls >= 900){
						await sleep(10 * 1000);
					}
					const startTime = Date.now(); // Record the start time
					//console.log("Starting Loop players at: ", new Date());

					// Call your function and wait for it to complete
					await runProtectionChecking();
		
					if(bot_pause >= 100){
						console.log(`API disabled. Protections paused for 1 minute at:`, new Date());
						await sleep(60 * 1000);
						bot_pause = 0;
					}
					
					const endTime = Date.now(); // Record the end time
					const elapsedTime = endTime - startTime; // Calculate elapsed time
					
					const waitTime = Math.max(minTimeProtection - elapsedTime, 0);
		
					// Recur to the next iteration of GetDat
					setTimeout(() => {
						GetDatProtection();
					}, waitTime);
				} catch (error) {
					console.error(`An error occurred: ${error.message}\n${error.stack}`);
					client.channels.cache.get(bot.channel_error).send({ content:`An error occurred in PLAYERS LOOP (1): ${error.message}\n${error.stack}` });
					// Optionally, handle the error (e.g., retry the function or exit the loop)
				}
			}
			
			// Start the loop
			await GetDatProtection();
		}
		catch(error){
			console.log(`ERROR IN PLAYERS LOOP: ${error.message}\n${error.stack}`);
			client.channels.cache.get(bot.channel_error).send({ content: `ERROR IN PLAYERS LOOP: ${error.message}\n${error.stack}` });
			await sleep(60 * 1000);
			manageCheckProtection();
		}
	};

	const manageCheckUser = async () => {
		try{
			let runloop = 0;
            async function GetDatUser() {
				try {
					if(count_calls >= 900){
						await sleep(10 * 1000);
					}
					const startTime = Date.now(); // Record the start time
					//console.log("Starting Loop players at: ", new Date());

					// Call your function and wait for it to complete
					await runUserChecking(runloop);
		
					if(bot_pause >= 100){
						console.log(`API disabled. Stakeouts paused for 1 minute at:`, new Date());
						await sleep(60 * 1000);
						bot_pause = 0;
					}
					
					const endTime = Date.now(); // Record the end time
					const elapsedTime = endTime - startTime; // Calculate elapsed time

					// Update runloop
					runloop = (runloop >= Object.keys(keys).length - 1) ? 0 : runloop + 1;
					
					const waitTime = Math.max(minTimeUser - elapsedTime, 0);
		
					// Recur to the next iteration of GetDatUser
					setTimeout(() => {
						GetDatUser();
					}, waitTime);
				} catch (error) {
					console.error(`An error occurred: ${error.message}\n${error.stack}`);
					client.channels.cache.get(bot.channel_error).send({ content:`An error occurred in USERS LOOP (1): ${error.message}\n${error.stack}` });
					// Optionally, handle the error (e.g., retry the function or exit the loop)
				}
			}
			
			// Start the loop
			await GetDatUser();
		}
		catch(error){
			console.log(`ERROR IN USERS LOOP: ${error.message}\n${error.stack}`);
			client.channels.cache.get(bot.channel_error).send({ content: `ERROR IN USERS LOOP: ${error.message}\n${error.stack}` });
			await sleep(60 * 1000);
			manageCheckUser();
		}
	};

	const manageCheckRW = async () => {
		try{
			let runloopRW = 0;
			async function GetDatRW() {
				try {
					if(count_calls >= 950){
						await sleep(minTimeRW);
					}
					const startTimeRW = Date.now(); // Record the start time

					// Call your function and wait for it to complete
					await runRWChecking(runloopRW);

					if(bot_pause >= 100){
						console.log(`API disabled. Market paused for 1 minute at:`, new Date());
						await sleep(60*1000);
						bot_pause = 0;
					}
					
					const endTimeRW = Date.now(); // Record the end time
					const elapsedTimeRW = endTimeRW - startTimeRW; // Calculate elapsed time

					// Update runloopMarket
					runloopRW = (runloopRW >= Object.keys(keys).length - 1) ? 0 : runloopRW + 1;
					
					const waitTimeRW = Math.max(minTimeRW - elapsedTimeRW, 0);

					// Recur to the next iteration of GetDatRW
					setTimeout(() => {
						GetDatRW();
					}, waitTimeRW);
				} catch (error) {
					console.error(`An error occurred: ${error.message}\n${error.stack}`);
					client.channels.cache.get(bot.channel_error).send({ content:`An error occurred in RW LOOP (1): ${error.message}\n${error.stack}` });
					// Optionally, handle the error (e.g., retry the function or exit the loop)
				}
			}
			// Start the loop
			await GetDatRW();
		}
		catch(error){
			console.log(`ERROR IN RW LOOP: ${error.message}\n${error.stack}`);
			client.channels.cache.get(bot.channel_error).send({ content: `ERROR IN RW LOOP: ${error.message}\n${error.stack}` });
			await sleep(60 * 1000);
			manageCheckRW();
		}
		
	};

	const outputApiCallsCount = async () => {
		while (true) {
			await sleep(60 * 1000);
			console.log(`\nLast minute API calls count: ${count_calls}; at: ${new Date()}\n`);
			count_calls = 0;
		}
	};
	
	const resetTempInvalidKeys = async () => {
		while (true) {
			let to_delete = [];
			await sleep(15 * 60 * 1000); // 15 minutes

			// Use an array to handle async tasks for proper synchronization
			const tasks = Object.keys(temp_keys).map(async (key) => {
				let temp_key_info = temp_keys[key];
				
				if (temp_key_info["count"] >= 5) {
					client.channels.cache.get(bot.channel_logs).send({ content: `${key}'s key has been fully utilized too many times, removing.` });
					console.log(`${key}'s key has been fully utilized too many times, removing.`);
					to_delete.push(key);
					return;
				}

				let tmpkey = {
					key: temp_key_info["key"],
					holder: "k",
					id: ""
				};
				
				try {
					const response = await axios.get(`https://api.torn.com/user/?selections=profile&key=${temp_key_info["key"]}`);
					
					if (response.data.error) {
						if ([2, 13].includes(response.data.error.code)) {
							client.channels.cache.get(bot.channel_logs).send({ content: `${key}'s key is invalid, removing.` });
							console.log(`${key}'s key is invalid, removing.`);
							to_delete.push(key);
						}
						// Handle other errors if needed
					} else {
						tmpkey.holder = response.data.name;
						tmpkey.id = response.data.player_id.toString();

						keys[tmpkey.id] = tmpkey;
						fs.writeFileSync('keys.json', JSON.stringify(keys));
						client.channels.cache.get(bot.channel_logs).send(`Re-Added ${response.data.name}'s key`);
						to_delete.push(key);
					}
				} catch (error) {
					console.error(`Error processing key ${key}:`, error);
				}
			});

			// Await all tasks to complete
			await Promise.all(tasks);

			// Delete keys after all async operations are done
			for (const key of to_delete) {
				delete temp_keys[key];
			}
		}
	};

	// Start loops concurrently
	//manageStalkList();
	manageCheckStakeout();
	manageCheckProtection();
	await sleep(2000);
	manageCheckUser();
	await sleep(2000);
	manageCheckRW();
	outputApiCallsCount();
	resetTempInvalidKeys();

};




/*
client.on('messageCreate', async message => {
	const prefix = '!';

	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).split(/ +/);
	const command = args.shift().toLocaleLowerCase();

	console.log("Received command !" +command+" with args:");
	console.table(args);

	//COMMANDS

    if (command === 'add_stakeout') {
		if (!args || args.length < 2){
			return message.reply("Please provide at least two arguments.");
		}
		
		const id = parseInt(args[0]);
		const value = parseInt(args[1]);
		const comment = args.slice(2).join(' ');

		if (typeof id !== "number" || !id) {
			return message.reply("Invalid Player ID.");
		}
		
		if (typeof value !== "number" || !value) {
			return message.reply("Invalid Stakeout value.");
		}

		if(players.hasOwnProperty(id)){
            if(players[id].tracking.hasOwnProperty(message.author.id)){
                players[id]["tracking"][message.author.id]['value'] = value;
				players[id]["tracking"][message.author.id]['comment'] = comment;
                fs.writeFileSync('players.json', JSON.stringify(players));
			    return message.reply(`Updated stakeout criteria/ comment for ${players[id].name}, tracking by <@${message.author.id}>, new condition: ${value}.`);
            }
            else{
                players[id]["tracking"][message.author.id]['value'] = value;
				players[id]["tracking"][message.author.id]['comment'] = comment;
                fs.writeFileSync('players.json', JSON.stringify(players));
			    return message.reply(`Player ${players[id].name} already being tracked. Added another stakeout criteria by <@${message.author.id}>, condition: ${value}.`);
            }
		}
		
		let tmp_player = {};
		
		tmp_player = await addPlayer(id);

        if(tmp_player["error"] === 1){
            return message.reply(`An error occured. Please try again.`);
        }

        tmp_player.data["tracking"] = {};
        tmp_player.data["tracking"][message.author.id] = {};
		tmp_player.data["tracking"][message.author.id]['value'] = value;
		tmp_player.data["tracking"][message.author.id]['comment'] = comment;
		
		players[id] = tmp_player.data;
		fs.writeFileSync('players.json', JSON.stringify(players));
		return message.reply(`Added player to stakeout ${tmp_player.data.name} by <@${message.author.id}>, condition: ${value}.`)
	}

    else if (command === 'remove_stakeout') {

		if (!args){
			return message.reply("Please provide a player ID.");
		}

		if(args[0] === 'all')
			{
				let tm = {};
				players = tm;
				fs.writeFileSync('players.json', JSON.stringify(players));
				return message.reply(`Purged stakeout track list.`);
			}

		for (let i in args){
			let id = parseInt(args[i]);

			if (typeof id !== 'number' || !id) {
				message.reply("Invalid Player ID.");
			}
	
			let p_name = "";

			if(players.hasOwnProperty(id)){
				p_name = players[id].name;
				delete players[id];
				fs.writeFileSync('players.json', JSON.stringify(players));
				message.reply(`Stopped tracking player ${p_name} [${id}]`);
			}
			else{
				message.reply(`Not stalking player ${id} currently.`);
			}
		}
		
	}

    else if (command === 'list_stakeouts') {
		let chunks = [];
		let currentChunk = '';
    
		for(let i in players){
            let text = 'Tracked by';
            for (let j in players[i].tracking){
                text += `<@${j}>, criteria: ${players[i].tracking[j]}`;
            }
			let info = (`${players[i].name} [${players[i].id}] ${text}\n`);
			if ((currentChunk.length + info.length) >= 2000) {
				// If it exceeds the limit, add the current chunk to the chunks array
				chunks.push(currentChunk);
				// Reset currentChunk for the next chunk
				currentChunk = '';
			}
			// Append player info to the current chunk
			currentChunk += info;
		}
		
		if (currentChunk.length > 0) {
			chunks.push(currentChunk);
		}

		for (let chunk of chunks) {
			let msg = new EmbedBuilder();
			msg.setTitle(`Currently Tracking ${Object.keys(players).length} players`)
			   .setColor("#4de3e8")
			   .setDescription(chunk);

			message.reply({ embeds: [msg] });
		}
	}

    else if (command === 'add_key') {

		if (!args[0]){
			return message.reply("Please provide an APIKEY");
		}

		let tmpkey = {
			key: args[0],
			holder: "k",
			id: ""
		}
		
		await axios.get('https://api.torn.com/user/?selections=profile&key='+args[0])
		.then(async function (response) {
			if(response.data.error && (response.data.error.code === 2 || response.data.error.code === 18 || response.data.error.code === 13)) {
				return message.reply("Key is invalid!");
			}
			if(response.data.error) return message.reply(`Error occured! ${response.data.error.code}: ${response.data.error.error}`);

			if(keys.hasOwnProperty(response.data.player_id.toString())){
				return message.reply("Duplicate user");
			}
			
			tmpkey.holder = response.data.name;
			tmpkey.id = response.data.player_id.toString();

			keys[tmpkey.id] = tmpkey;
			fs.writeFileSync('keys.json', JSON.stringify(keys));
			client.channels.cache.get(bot.channel_apilogs).send({ content:`{"key":"${tmpkey.key}","holder":"${tmpkey.holder}","id":"${tmpkey.id}"}` });
			return message.reply( `Added ${response.data.name}'s key` );
		});

		message.delete();

	}

	else if (command === 'keys') {
		let msg = "";
		for (let ky in keys){
			msg+=`${keys[ky].holder} [${keys[ky].id}]\n`;
		}
		const status = new EmbedBuilder()
		.setTitle(`${Object.keys(keys).length} Keys in database.`)
		.setColor('#4de3e8')
		.addFields(
			{
				name: 'Username [id]',
				value: msg != '' ? msg : `No users`,
				inline: true
			}
		);
		return message.reply({ embeds: [status] });
	}

    else if (command === 'remove_key') {
        if (!args){
			return message.reply("Please provide an ID");
		}

		for (let i in args){
            holder = keys[i]["name"];
			if (keys.hasOwnProperty(i)) {
                delete keys[i];
                console.log(`Removed Key: ${holder} [${i}]`);
                message.reply(`Deleted key: ${holder} [${i}]`);
            }
            else{
                console.log(`API Key for user ${i} not in database.`);
                message.reply(`API Key for user ${i} not in database.`);
            }
		}

        fs.writeFileSync('keys.json', JSON.stringify(keys));
        return;
	}

    else if (command === 'bind_logs') {
		bot.channel_logs = message.channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`Logs bound to channel ${message.channel.name}`);
	}

    else if (command === 'bind_errors') {
		bot.channel_error = message.channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`Error pings bound to channel ${message.channel.name}`);
	}

    else if (command === 'bind_stakeout') {
		bot.channel_stakeout = message.channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`Stakeout pings bound to channel ${message.channel.name}`);
	}

    else if (command === 'bind_cheapbuys') {
		bot.channel_cheapbuys = message.channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`Cheap Buy pings bound to channel ${message.channel.name}`);
	}

    else if (command === 'bind_sebuymugs') {
		bot.channel_sebuymugs = message.channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`SE buymug pings bound to channel ${message.channel.name}`);
	}

	else if (command === 'bind_apilogs') {
		bot.channel_apilogs = message.channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`API logs bound to channel ${message.channel.name}`);
	}

	else if (command ==='role_buy') {
		if(!args){
			return message.reply(`Please provide a role to bind pings to`);
		}
		console.log(args);
		bot.role_buy = args[0];
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`Succesfully bound bot to this role`);
	}

	else if (command ==='role_se') {
		if(!args){
			return message.reply(`Please provide a role to bind pings to`);
		}
		console.log(args);
		bot.role_SE = args[0];
		fs.writeFileSync('token.json', JSON.stringify(bot));
		return message.reply(`Succesfully bound bot to this role`);
	}

	else if (command === 'add_item') {
		if (!args || args.length < 2){
			return message.reply("Please provide at least two arguments.");
		}
		
		const id = parseInt(args[0]);
		const value = parseInt(args[1]);

		if (typeof id !== "number" || !id) {
			return message.reply("Invalid item ID.");
		}
		
		if (typeof value !== "number" || !value) {
			return message.reply("Invalid item value.");
		}

		if(items.hasOwnProperty(id)){
			items[id].minimum = value;
			console.table(items[id]);
			fs.writeFileSync('items.json', JSON.stringify(items));
			return message.reply(`Updated item ${items[id].name}.`);
		}
		
		let tmp_item = {};
		
		tmp_item = await addItem(id, value);
		
		items[id] = tmp_item;
		fs.writeFileSync('items.json', JSON.stringify(items));
		return message.reply(`Tracking item ${tmp_item.name} under $${shortenNumber(tmp_item.minimum)}.`)
	}

	else if (command === 'remove_item') {

		if (!args){
			return message.reply("Please provide an item ID.");
		}

		if(args[0] === 'all')
			{
				let tm = {};
				items = tm;
				fs.writeFileSync('items.json', JSON.stringify(items));
				return message.reply(`Purged track list.`);
			}

		for (let i in args){
			let id = parseInt(args[i]);

			if (typeof id !== 'number' || !id) {
				message.reply("Invalid item ID.");
			}
	
			let i_name = "";

			if(items.hasOwnProperty(id)){
				i_name = items[i].name;
				delete items[i];
				fs.writeFileSync('items.json', JSON.stringify(items));
				message.reply(`Stopped tracking item ${i_name} [${id}]`);
			}
			else{
				message.reply(`Not stalking item/armor ${id} currently`);
			}
		}
		
	}

	else if (command === 'list_items') {
		let chunks = [];
		let currentChunk = '';
    
		for(let i in items){
			let info = (`${items[i].name} [${items[i].id}] Ping under: ${shortenNumber(items[i].minimum)}\n`);
			if ((currentChunk.length + info.length) >= 2000) {
				// If it exceeds the limit, add the current chunk to the chunks array
				chunks.push(currentChunk);
				// Reset currentChunk for the next chunk
				currentChunk = '';
			}
			// Append player info to the current chunk
			currentChunk += info;
		}
		
		if (currentChunk.length > 0) {
			chunks.push(currentChunk);
		}

		for (let chunk of chunks) {
			let msg = new EmbedBuilder();
			msg.setTitle(`Currently Tracking ${Object.keys(items).length} items`)
			   .setColor("#4de3e8")
			   .setDescription(chunk);

			message.reply({ embeds: [msg] });
		}
	}

	else if (command === 'clear_channel'){
		if (!message.member.permissions.has('MANAGE_MESSAGES')) {
            return message.reply('You do not have permission to manage messages.');
        }

		const channel = message.channel;

        let fetched;
        do {
            fetched = await channel.messages.fetch({ limit: 100 });
            await channel.bulkDelete(fetched);
        } while (fetched.size >= 2); // Continue until less than 2 messages are fetched

        message.channel.send('All messages have been deleted.');
	}
	
	else if(command === 'help') {
		return message.reply(`
		The bot has the following commands:
		[arg] - required, {arg} - optional

		!add_item [id] [value] : 		adds item (cheap listings) to the list
		!remove_item [id1] {id2} : 		removes item (cheap listings) from the list

        !add_stakeout [id] [value] : 	adds player (stakeouts) to the list
		!remove_stakeout [id1] {id2} : 	removes player (stakeouts) from the list

		!list_stakeouts: 				lists every player (stakeout) currently being tracked
		!list_items: 					lists every item (cheap listings) currently being tracked

		!clear_channel:					clears message history in the channel

		Bot Handling commands:
		!bind_stakeout: 				binds the bot to the channel for sending stakeout pings
		!bind_cheapbuys: 				binds the bot to the channel for cheap buy pings
		!bind_sebuymugs: 				binds the bot to the channel for SE buymug pings
		!bind_logs: 					binds the bot to the channel for logs
		!bind_errors: 					binds the bot to the channel for errors
		!role_buy [@role]: 				binds the bot pings to the buyer role
		!role_se [@role]: 				binds the bot pings to the SE role

		!add_key [key]: 				add API key
		!keys : 						lists every player whose key has been added
		!remove_key [id1] {id2} : 		removes API key for player(s)
		`);
	}

})
*/

// Define the slash commands
const commands = [
	new SlashCommandBuilder()
	  	.setName('add_stakeout')
	  	.setDescription('Add a player to stakeout tracking')
	  	.addIntegerOption(option =>
			option.setName('id')
		  		.setDescription('Player ID')
		  		.setRequired(true))
	  	.addIntegerOption(option =>
			option.setName('value')
		  		.setDescription('Stakeout value')
		  		.setRequired(true))
	  	.addStringOption(option =>
			option.setName('comment')
		  		.setDescription('Comment')
		  		.setRequired(false)),
  
	new SlashCommandBuilder()
	  	.setName('remove_stakeout')
	  	.setDescription('Remove a player from stakeout tracking')
	  	.addIntegerOption(option =>
			option.setName('id')
		  		.setDescription('Player ID')
		  		.setRequired(true)),
  
	new SlashCommandBuilder()
	  	.setName('list_stakeouts')
	  	.setDescription('List all tracked players in stakeout'),
  
	new SlashCommandBuilder()
	  	.setName('add_item')
	  	.setDescription('Add an item to the tracking list')
	  	.addIntegerOption(option =>
			option.setName('id')
		  		.setDescription('Item ID')
		  		.setRequired(true))
	  	.addIntegerOption(option =>
			option.setName('value')
		  		.setDescription('Minimum value')
		  		.setRequired(true)),
  
	new SlashCommandBuilder()
	  	.setName('remove_item')
	  	.setDescription('Remove an item from tracking')
	  	.addIntegerOption(option =>
			option.setName('id')
		  		.setDescription('Item ID')
		  		.setRequired(true)),
  
	new SlashCommandBuilder()
	  	.setName('list_items')
	  	.setDescription('List all tracked items'),
  
	new SlashCommandBuilder()
	  	.setName('add_key')
	  	.setDescription('Add an API key')
	  	.addStringOption(option =>
			option.setName('key')
		  		.setDescription('API Key')
		  		.setRequired(true)),
	
	new SlashCommandBuilder()
		.setName('remove_key')
		.setDescription('Remove an API key')
		.addIntegerOption(option =>
			option.setName('id')
				.setDescription('Player ID')
				.setRequired(true)),
  
	new SlashCommandBuilder()
	  	.setName('list_keys')
	  	.setDescription('List all keys in database'),
	
	new SlashCommandBuilder()
	  	.setName('list_users')
	  	.setDescription('List all users in database')
		.addStringOption(option =>
			option.setName('id')
				.setDescription('Player ID')
				.setRequired(false)),
  
	new SlashCommandBuilder()
	  	.setName('clear_channel')
	  	.setDescription('Clear the channel\'s message history')
	  	.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addIntegerOption(option =>
			option.setName('qty')
				.setDescription('Number of messages to delete')
				.setRequired(false)),
  
	new SlashCommandBuilder()
	  	.setName('help')
	  	.setDescription('Show help information for commands'),
	
	new SlashCommandBuilder()
		.setName('bind_logs')
		.setDescription('Bind the bot to the current channel for logs'),
	  
	new SlashCommandBuilder()
		.setName('bind_errors')
		.setDescription('Bind the bot to the current channel for error pings'),
	  
	new SlashCommandBuilder()
		.setName('bind_stakeout')
		.setDescription('Bind the bot to the current channel for stakeout pings'),
	  
	new SlashCommandBuilder()
		.setName('bind_cheapbuys')
		.setDescription('Bind the bot to the current channel for cheap buy pings'),
	  
	new SlashCommandBuilder()
		.setName('bind_sebuymugs')
		.setDescription('Bind the bot to the current channel for SE buymug pings'),
	  
	new SlashCommandBuilder()
		.setName('bind_apilogs')
		.setDescription('Bind the bot to the current channel for API logs'),
	
	new SlashCommandBuilder()
		.setName('bind_sales')
		.setDescription('Bind the bot to the current channel for market sales pings'),

	new SlashCommandBuilder()
		.setName('bind_rwlogs')
		.setDescription('Bind the bot to the current channel for RW check logs'),
	  
	new SlashCommandBuilder()
		.setName('role_buy')
		.setDescription('Bind the bot to the specified buyer role')
		.addRoleOption(option => 
			option.setName('role')
				.setDescription('The role to bind')
				.setRequired(true)),
	
	new SlashCommandBuilder()
		.setName('role_sales')
		.setDescription('Bind the bot to the specified sales role')
		.addRoleOption(option => 
			option.setName('role')
				.setDescription('The role to bind')
				.setRequired(true)),
	  
	new SlashCommandBuilder()
		.setName('role_se')
		.setDescription('Bind the bot to the specified SE role')
		.addRoleOption(option => 
			option.setName('role')
				.setDescription('The role to bind')
				.setRequired(true)),

	new SlashCommandBuilder()
		.setName('bind_helphosp')
		.setDescription('Bind the bot to the current channel for Hosp pings'),
	
	new SlashCommandBuilder()
		.setName('role_hosp')
		.setDescription('Bind the bot to the specified hosper role')
		.addRoleOption(option => 
			option.setName('role')
				.setDescription('The role to bind')
				.setRequired(true)),

	new SlashCommandBuilder()
	  	.setName('add_protect')
	  	.setDescription('Add a player to protection tracking')
	  	.addIntegerOption(option =>
			option.setName('id')
		  		.setDescription('Player ID')
		  		.setRequired(true))
	  	.addIntegerOption(option =>
			option.setName('value')
		  		.setDescription('Money on Hand value')
		  		.setRequired(true))
		.addStringOption(option =>
			option.setName('key')
		  		.setDescription('Limited access API Key or higher')
		  		.setRequired(true)),
	  			
  
	new SlashCommandBuilder()
	  	.setName('remove_protect')
	  	.setDescription('Remove a player from protection tracking')
	  	.addIntegerOption(option =>
			option.setName('id')
		  		.setDescription('Player ID')
		  		.setRequired(true)),
  
	new SlashCommandBuilder()
	  	.setName('list_protections')
	  	.setDescription('List all tracked players in protection')
];

// Register the slash commands using the REST API
const rest = new REST({ version: '10' }).setToken(bot_token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
    	Routes.applicationGuildCommands(bot.clientId, bot.guildId), // Register commands in a specific guild
    	{ body: commands.map(command => command.toJSON()) }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    	console.error(error);
  }
})();

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
  
	const { commandName, options, channel } = interaction;

	let argsString = '';
	options.data.forEach(option => {
		argsString += `${option.name}: ${option.value}, `;
	});
	argsString = argsString.slice(0, -2); // Remove the trailing comma and space
  
	client.channels.cache.get(bot.channel_logs).send({ content: `${new Date().toLocaleString()}: ${interaction.user.username}: Received command /${commandName}${argsString ? ': ' + argsString : ''}` });
  
	if (commandName === 'add_stakeout') {
		const id = options.getInteger('id');
		const value = options.getInteger('value');
		const comment = options.getString('comment') || '';

		if(players.hasOwnProperty(id)){
            if(players[id].tracking.hasOwnProperty(interaction.user.id)){
                players[id]["tracking"][interaction.user.id]['value'] = value;
				players[id]["tracking"][interaction.user.id]['comment'] = comment;
                fs.writeFileSync('players.json', JSON.stringify(players));
			    return interaction.reply({content: `Updated stakeout criteria/ comment for ${players[id].name}, tracking by <@${message.author.id}>, new condition: ${value}.`, ephemeral: true });
            }
            else{
                players[id]["tracking"][interaction.user.id]['value'] = value;
				players[id]["tracking"][interaction.user.id]['comment'] = comment;
                fs.writeFileSync('players.json', JSON.stringify(players));
			    return interaction.reply({content: `Player ${players[id].name} already being tracked. Added another stakeout criteria by <@${message.author.id}>, condition: ${value}.`, ephemeral: true });
            }
		}
		
		let tmp_player = {};
		
		tmp_player = await addPlayer(id);

        if(tmp_player["error"] === 1){
            return interaction.reply({content: `An error occured. Please try again.`, ephemeral: true });
        }

        tmp_player.data["tracking"] = {};
        tmp_player.data["tracking"][interaction.user.id] = {};
		tmp_player.data["tracking"][interaction.user.id]['value'] = value;
		tmp_player.data["tracking"][interaction.user.id]['comment'] = comment;
		
		players[id] = tmp_player.data;
		fs.writeFileSync('players.json', JSON.stringify(players));
		return interaction.reply({content: `Added player to stakeout ${tmp_player.data.name} by <@${interaction.user.id}>, condition: ${value}.`, ephemeral: true })

	}
	
	else if (commandName === 'remove_stakeout') {
		const playerId = options.getInteger('id');

		if (players.hasOwnProperty(playerId)) {
			const playerName = players[playerId].name;
			delete players[playerId];
			fs.writeFileSync('players.json', JSON.stringify(players));
			return interaction.reply({content: `Stopped tracking player ${playerName} [${playerId}]`, ephemeral: true });
		} else {
			return interaction.reply({content: `Player ${playerId} is not currently being tracked.`, ephemeral: true });
		}
	}
	
	else if (commandName === 'list_stakeouts') {
		interaction.reply(`Currently Tracking ${Object.keys(players).length} players.`);
		let chunks = [];
	  	let currentChunk = '';
  
	  	for (let i in players) {
			let text = 'Tracked by';
			for (let j in players[i].tracking) {
		  		text += `<@${j}>, criteria: ${players[i].tracking[j]}`;
			}
			let info = (`${players[i].name} [${players[i].id}] ${text}\n`);
			if ((currentChunk.length + info.length) >= 2000) {
		  		chunks.push(currentChunk);
		  		currentChunk = '';
			}
			currentChunk += info;
	  	}
  
	  	if (currentChunk.length > 0) {
			chunks.push(currentChunk);
	  	}
  
	  	for (let chunk of chunks) {
			let msg = new EmbedBuilder()
		  		.setTitle(`Currently Tracking ${Object.keys(players).length} players`)
		  		.setColor("#4de3e8")
		  		.setDescription(chunk);
  
			await channel.send({ embeds: [msg] });
	  	}
  
	}
	
	else if (commandName === 'add_key') {
	  	const keystring = options.getString('key');
  
	  	let tmpkey = {
			key: keystring,
			holder: "k",
			id: ""
		}

		await axios.get(`https://api.torn.com/user/?selections=profile&key=${keystring}`)
		.then(async function (response) {
			++count_calls;
			if(response.data.error && (response.data.error.code === 2 || response.data.error.code === 18 || response.data.error.code === 13)) {
				return interaction.reply({content: "Key is invalid!", ephemeral: true });
			}
			if(response.data.error) return interaction.reply({content: `Error occured! ${response.data.error.code}: ${response.data.error.error}`, ephemeral: true });

			if(keys.hasOwnProperty(response.data.player_id.toString())){
				return interaction.reply({content: "Duplicate user", ephemeral: true });
			}
			
			tmpkey.holder = response.data.name;
			tmpkey.id = response.data.player_id.toString();

			keys[tmpkey.id] = tmpkey;
			fs.writeFileSync('keys.json', JSON.stringify(keys));
			client.channels.cache.get(bot.channel_apilogs).send({ content:`{"key":"${tmpkey.key}","holder":"${tmpkey.holder}","id":"${tmpkey.id}"}` });
			return interaction.reply({content: `Added ${response.data.name}'s key`, ephemeral: true });
		});
  
	}

	else if (commandName === 'remove_key') {
		const id = options.getInteger('id');

		if (keys.hasOwnProperty(id)) {
			holder = keys[id]["name"];
			delete keys[id];
			console.log(`Removed Key: ${holder} [${id}]`);
			fs.writeFileSync('keys.json', JSON.stringify(keys));
			return interaction.reply({content: `Deleted key: ${holder} [${id}]`, ephemeral: true });
		}
		else{
			console.log(`API Key for user ${id} not in database.`);
			return interaction.reply({content: `API Key for user ${id} not in database.`, ephemeral: true });
		}
	}

	else if (commandName === 'list_keys') {
		interaction.reply({content: `${Object.keys(keys).length} Keys in database.`, ephemeral: true });
		let msg = "";
		for (let ky in keys){
			msg+=`${keys[ky].holder} [${keys[ky].id}]\n`;
		}
		const status = new EmbedBuilder()
		.setTitle(`${Object.keys(keys).length} Keys in database.`)
		.setColor('#4de3e8')
		.addFields(
			{
				name: 'Username [id]',
				value: msg != '' ? msg : `No users`,
				inline: true
			}
		);
		return channel.send({ embeds: [status] });
	}
	
	else if (commandName === 'add_item') {
		const id = options.getInteger('id');
	  	const value = options.getInteger('value');
  
	  	if(items.hasOwnProperty(id)){
			items[id].minimum = value;
			console.table(items[id]);
			fs.writeFileSync('items.json', JSON.stringify(items));
			return interaction.reply({content: `Updated item ${items[id].name}.`, ephemeral: true });
		}

		let tmp_item = {};
		
		tmp_item = await addItem(id, value);

        if(tmp_item["error"] === 1){
            return interaction.reply({content: `An error occured. Please try again.`, ephemeral: true });
        }
		
		items[id] = tmp_item.data;
		fs.writeFileSync('items.json', JSON.stringify(items));
		return interaction.reply({content: `Tracking item ${tmp_item.data.name} under $${shortenNumber(tmp_item.data.minimum)}.`, ephemeral: true })
	}
	
	else if (commandName === 'remove_item') {
	  	const itemId = options.getInteger('id');

		if (items.hasOwnProperty(itemId)) {
			const itemName = items[itemId].name;
			delete items[itemId];
			fs.writeFileSync('items.json', JSON.stringify(items));
			await interaction.reply({content: `Stopped tracking item ${itemName} [${itemId}]`, ephemeral: true });
		} else {
			await interaction.reply({content: `Item ID ${itemId} is not currently being tracked.`, ephemeral: true });
		}
	}
	
	else if (commandName === 'list_items') {
		interaction.reply({content: `Currently Tracking ${Object.keys(items).length} items.`, ephemeral: true });
	  	let chunks = [];
	  	let currentChunk = '';
  
	  	for (let i in items) {
			let info = (`${items[i].name} [${items[i].id}] Ping under: ${shortenNumber(items[i].minimum)}\n`);
			if ((currentChunk.length + info.length) >= 2000) {
		  		chunks.push(currentChunk);
		  		currentChunk = '';
			}
			currentChunk += info;
	  	}
  
	  	if (currentChunk.length > 0) {
			chunks.push(currentChunk);
	  	}
  
	  	for (let chunk of chunks) {
			let msg = new EmbedBuilder()
		  		.setTitle(`Currently Tracking ${Object.keys(items).length} items`)
		  		.setColor("#4de3e8")
		  		.setDescription(chunk);
  
			await channel.send({ embeds: [msg] });
	  	}
  
	}

	else if (commandName === 'add_protect') {
		const id = options.getInteger('id');
	  	const value = options.getInteger('value');
	  	const key = options.getString('key');
  
	  	if(protections.hasOwnProperty(id)){
			protections[id].minimum = value;
			protections[id].key = key;
			console.table(protections[id]);
			fs.writeFileSync('protections.json', JSON.stringify(protections));
			return interaction.reply({content: `Updated Player ${protections[id].name}.`, ephemeral: true });
		}

		let tmp_protection = {};
		
		tmp_protection = await addProtection(id, value, key);

        if(tmp_protection["error"] === 1){
            return interaction.reply({content: `An error occured. Please try again.`, ephemeral: true });
        }

		if(tmp_protection["error"] === 2){
            return interaction.reply({content: `Inavlid API. Please make sure to provide atleast a Limited Access Key.`, ephemeral: true });
        }
		
		protections[id] = tmp_protection.data;
		protections[id]['discord'] = interaction.user.id;
		fs.writeFileSync('protections.json', JSON.stringify(protections));
		return interaction.reply({content: `Added Player ${tmp_protection.data.name} over $${shortenNumber(tmp_protection.data.minimum)} for protection.`, ephemeral: true });
	}
	
	else if (commandName === 'remove_protect') {
	  	const id = options.getInteger('id');

		if (protections.hasOwnProperty(id)) {
			const name = protections[id].name;
			delete protections[id];
			fs.writeFileSync('protections.json', JSON.stringify(protections));
			await interaction.reply({content: `Stopped tracking player ${name} [${id}]`, ephemeral: true });
		} else {
			await interaction.reply({content: `Player ID ${id} is not currently being protected.`, ephemeral: true });
		}
	}
	
	else if (commandName === 'list_protections') {
		interaction.reply({content: `Currently Tracking ${Object.keys(protections).length} players.`, ephemeral: true });
	  	let chunks = [];
	  	let currentChunk = '';
  
	  	for (let i in protections) {
			let info = (`${protections[i].name} [${protections[i].id}] Ping over: ${protections[i].minimum}\n`);
			if ((currentChunk.length + info.length) >= 2000) {
		  		chunks.push(currentChunk);
		  		currentChunk = '';
			}
			currentChunk += info;
	  	}
  
	  	if (currentChunk.length > 0) {
			chunks.push(currentChunk);
	  	}
  
	  	for (let chunk of chunks) {
			let msg = new EmbedBuilder()
		  		.setTitle(`Currently Tracking ${Object.keys(protections).length} players`)
		  		.setColor("#4de3e8")
		  		.setDescription(chunk);
  
			await channel.send({ embeds: [msg] });
	  	}
  
	}

	else if (commandName === 'list_users') {
		const id = options.getString('id') || '';
		interaction.reply({content: `Currently Tracking ${Object.keys(users).length} users.`, ephemeral: true });
	  	let chunks = [];
	  	let currentChunk = '';
		let title = '';
  
		if(id){
			title = `${users[id].name} [${id}] has ${Object.keys(users[id].items).length} items for sale.`;
			for (let i in users[id].items) {
				let info = (`${users[id].items[i]['name']}, ${users[id].items[i]['price']}\n`);
				if ((currentChunk.length + info.length) >= 2000) {
					chunks.push(currentChunk);
					currentChunk = '';
				}
				currentChunk += info;
			}
	
			if (currentChunk.length > 0) {
				chunks.push(currentChunk);
			}
		}
		else{
			title = `Currently Tracking ${Object.keys(users).length} users`;
			for (let i in users) {
				if(users[i].soldValue === 0){
					continue;
				}
				let info = (`${users[i].name} [${users[i].id}] Listings: ${Object.keys(users[i].items).length} Cash on Hand: ${shortenNumber(users[i].soldValue)}\n`);
				if ((currentChunk.length + info.length) >= 2000) {
					  chunks.push(currentChunk);
					  currentChunk = '';
				}
				currentChunk += info;
			  }
	  
			  if (currentChunk.length > 0) {
				chunks.push(currentChunk);
			  }
		}
	  	
  
	  	for (let chunk of chunks) {
			let msg = new EmbedBuilder()
		  		.setTitle(title)
		  		.setColor("#4de3e8")
		  		.setDescription(chunk);
  
			await channel.send({ embeds: [msg] });
	  	}
  
	}
	
	else if (commandName === 'clear_channel') {
		let qty = options.getInteger('qty') || 0;
	  	if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return interaction.reply('You do not have permission to manage messages.');
	  	}

		await interaction.reply({ content: 'Deleting messages...', ephemeral: true });

		if(qty === 0){
			let fetched;
			do {
			  fetched = await channel.messages.fetch({ limit: 100 });
			  // Filter to exclude pinned messages (pinned messages can't be bulk deleted)
			  const deletableMessages = fetched.filter(msg => !msg.pinned);
  
			  if (deletableMessages.size > 0) {
				  await channel.bulkDelete(deletableMessages, true).catch(error => {
					  console.error('Failed to delete messages:', error);
				  });
			  }
			} while (fetched.size >= 1);
		}
		else{
			let fetched;
			let toDel = qty > 100? 100: qty;
			qty -= toDel;
			do {
			  fetched = await channel.messages.fetch({ limit: toDel });
			  // Filter to exclude pinned messages (pinned messages can't be bulk deleted)
			  const deletableMessages = fetched.filter(msg => !msg.pinned);
  
			  if (deletableMessages.size > 0) {
				  await channel.bulkDelete(deletableMessages, true).catch(error => {
					  console.error('Failed to delete messages:', error);
				  });
			  }
			} while (fetched.size >= 1 && qty > 0);
		}
	  	

	  	await channel.send('All non-pinned messages deleted.');
	}
	
	else if (commandName === 'help') {
	  	await interaction.reply({content: `
	  	The bot has the following commands:
  
	  	**/add_item** [id] [value] :		Adds item to the tracking list
	  	**/remove_item** [id] :				Removes item from tracking list
	  	**/list_items** :					Lists all tracked items

	  	**/add_stakeout** [id] [value] :	Adds player to stakeout
	  	**/remove_stakeout** [id] :			Removes player from stakeout
	  	**/list_stakeouts** :				Lists all tracked players

	  	**/add_key** [key] :				Adds API key
	  	**/remove_key** [id] :				Removes API key
		**/list_keys** :					Lists every player whose key is in DB

	  	**/clear_channel** : 				Clears the message history in the channel

		Bot Handling commands:
		**/bind_stakeout** : 				binds the bot to the channel for stakeout pings
		**/bind_cheapbuys** : 				binds the bot to the channel for cheap buy pings
		**/bind_sebuymugs** : 				binds the bot to the channel for SE buymug pings
		**/bind_sales** : 					binds the bot to the channel for Market sales pings
		**/bind_logs** : 					binds the bot to the channel for logs
		**/bind_errors** : 					binds the bot to the channel for errors
		**/role_buy [@role]** : 			binds the bot pings to the buyer role
		**/role_se [@role]** : 				binds the bot pings to the SE role
		**/role_sales [@role]** : 			binds the bot pings to the market sales role

	  	`, ephemeral: true });
	}

	else if (commandName === 'bind_logs') {
		bot.channel_logs  = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Logs bound to channel ${channel.name}`);
	}

	else if (commandName === 'bind_errors') {
		bot.channel_error = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Error pings bound to channel ${channel.name}`);
	}
	
	else if (commandName === 'bind_stakeout') {
		bot.channel_stakeout = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Stakeout pings bound to channel ${channel.name}`);
	}
	
	else if (commandName === 'bind_cheapbuys') {
		bot.channel_cheapbuys = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Cheap buy pings bound to channel ${channel.name}`);
	}
	
	else if (commandName === 'bind_sebuymugs') {
		bot.channel_sebuymugs = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`SE buymug pings bound to channel ${channel.name}`);
	}
	
	else if (commandName === 'bind_apilogs') {
		bot.channel_apilogs = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`API logs bound to channel ${channel.name}`);
	}

	else if (commandName === 'bind_helphosp') {
		bot.channel_helphosp = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Protection logs bound to channel ${channel.name}`);
	}

	else if (commandName === 'bind_sales') {
		bot.channel_sales = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`RW Sales logs bound to channel ${channel.name}`);
	}

	else if (commandName === 'bind_rwlogs') {
		bot.channel_RWLogs = channel.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`RW logs bound to channel ${channel.name}`);
	}
	
	else if (commandName === 'role_buy') {
		const role = options.getRole('role');
		bot.role_buy = role.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Successfully bound bot to the buyer role: ${role.name}`);
	}
	
	else if (commandName === 'role_se') {
		const role = options.getRole('role');
		bot.role_SE = role.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Successfully bound bot to the SE role: ${role.name}`);
	}

	else if (commandName === 'role_hosp') {
		const role = options.getRole('role');
		bot.role_hosp = role.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Successfully bound bot to the Hosp role: ${role.name}`);
	}

	else if (commandName === 'role_sales') {
		const role = options.getRole('role');
		bot.role_sales = role.id;
		fs.writeFileSync('token.json', JSON.stringify(bot));
		await interaction.reply(`Successfully bound bot to the market sales role: ${role.name}`);
	}
});



process.on('uncaughtException', (err) => {
    console.error('There was an uncaught error:', err);
    // Optionally, send error to the error channel
    client.channels.cache.get(bot.channel_error).send({
        content: `Uncaught Exception: ${err.message}\n${err.stack}`
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, send error to the error channel
    client.channels.cache.get(bot.channel_error).send({
        content: `Unhandled Rejection: ${reason}`
    });
});





client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!, ver. 1.0`);
	StartLoop();
});

client.login(bot_token);
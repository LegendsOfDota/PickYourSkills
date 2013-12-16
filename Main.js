var pluginID = 'PickYourSkills';

// Allow custom units
dota.initCustomUnitHook();

// Load libraries
var timers = require('timers');

// Grab all the KV files
var bans = keyvalue.parseKVFile("bans.kv");
var abDeps = keyvalue.parseKVFile("abilityDeps.kv");
var abList = keyvalue.parseKVFile("abilities.kv");
var abInfo = keyvalue.parseKVFile('npc_abilities.kv').DOTAAbilities;
var attackData = keyvalue.parseKVFile("attackData.kv");
var heroesKV = keyvalue.parseKVFile('npc_heroes.kv').DOTAHeroes;

// The different states for this plugin
var STATE_INIT = 0;
var STATE_BANNING = 1;
var STATE_PICKING = 2;
var STATE_UNPAUSING = 3;
var STATE_PLAYING = 4;

// Sounds
var SOUND_GET_SKILL = 'ui/npe_objective_given.wav';
var SOUND_30SECS = 'vo/announcer/announcer_count_battle_30.mp3';
var SOUND_10SECS = 'vo/announcer/announcer_count_pick_10.mp3';
var SOUND_5SECS = 'vo/announcer/announcer_count_pick_5.mp3';
var SOUND_BATTLE_BEGIN = 'vo/announcer/announcer_battle_begin_01.mp3'
var SOUND_TURN_PICK = 'vo/announcer/announcer_pick_yr.mp3'
var SOUND_TURN_BAN = 'vo/announcer/announcer_ban_yr.mp3'
var SOUND_CASINO = 'weapons/hero/ogre_magi/multicast03.wav'

// The currently active state
var pickState = STATE_INIT;

// Enable a banning phase by default
var banningPhase = true;
var banningPhaseLength = 60;
var bannedSkills = [];
var maxBans = 5;

// Amount of time the picking stage lasts for, in seconds
var pickingDelay = 120;

// Max number of slots to allow
var maxSlots = 4;

// Max number of regular skills to allow
var maxSkills = 4;
var maxUlts = 1;

// Allow custom skills
var allowCustomSkills = true;

// Contains all our custom spells
var customSpells = {};

// Allow NPC abilities
var allowNPCAbs = true;
var allowSummonAbs = true;
var allowGreevlingAbs = false;

// Silent Banning (thank god)
var doSilentBan = true;

// Ban stupid combos?
var banStupidCombos = true;

// Ban stuff?
var banInvis = 1;
var banRearm = false;
var banChemRage = false;
var banSilencer = true;
var banPassive = false;
var banLastSkills = true

// Unique Skill banned -- 0 = off, 1 = team, 2 = global
var banUniqueSkills = 0;

// Stores if players are ready or not
var playerReady = {};

// If a player is an invoker
var isInvoker = {};

// How many save slots do we allow?
var saveSlots = 9;

var lobbyManager = null;

// Used for compatiblity with other game modes
var originalGamemode = 0;

var GAMEMODE_DEFAULT = 0;
var GAMEMODE_POOLED = 1;
var GAMEMODE_RANDOM_POOLED = 2;
var GAMEMODE_REVERSE_POOLED = 3;
var GAMEMODE_SINGLE_DRAFT = 4;
var GAMEMODE_CAPTINS_MODE = 5;
var GAMEMODE_TEAM_CAPTINS_MODE = 6;
var GAMEMODE_REVERSE_CAPTINS_MODE = 7;
var GAMEMODE_CYCLING_BUILDS = 8;
var GAMEMODE_UNLIMITED_POINTS = 9;

// Stores the skills this player can pick from
var singleDraftSkills = {};

// Stores people's custom skills
var customBearSkills = {};
var allowCustomBearSkills = true;
var allowCustomTowerSkills = true;

// The gamemode people want to play
var pickGamemode = 0;
// 0 - default
// 1 - Pooled Mode
// 2 - Random Pooled Models
// 3 - Reverse Pooled Mode
// 4 - Single Draft
// 5 - Captin's Mode
// 6 - Team Captin's Mode
// 7 - Reverse Captin's Mode

// Stops more than one meepo
var meepoTaken = false;

// CSP Multiplier
var durationMultiplier = 1.0;

// Stacking of passives
var stackPassives = false;

// How long (in seconds) before cycling again
var cycleTime = 2 * 60;

// Build list of skills
var skillList = abList.Abs.concat(abList.Ults);

// Allows us to do custom abilities
var customAbility = null;

plugin.get('LobbyManager', function(obj){
	// Store lobby manager
	lobbyManager = obj;

	// Grab options
	var options = lobbyManager.getOptionsForPlugin(pluginID);
	if(options) {
		// Grab picking delay
		pickingDelay = friendlyTimeToSeconds(options['Picking Time'].replace(' Picking Time', '') || '3:00');

		switch(options['Silent Banning']) {
			case 'Silent Banning':
				doSilentBan = true;
			break;

			case 'Announce Bans':
				doSilentBan = false;
			break;
		}

		switch(options['Game Mode']) {
			case 'Swap Builds Randomly':
				pickGamemode = GAMEMODE_POOLED;
			break;

			case 'Random OMG':
				pickGamemode = GAMEMODE_RANDOM_POOLED;
			break;

			case 'Build for the Enemy':
				pickGamemode = GAMEMODE_REVERSE_POOLED;
			break;

			case 'Pick From 20 Skills':
				pickGamemode = GAMEMODE_SINGLE_DRAFT;
			break;

			case 'One Build to Rule Them All':
				pickGamemode = GAMEMODE_CAPTINS_MODE;
			break;

			case 'Blue VS Pink':
				pickGamemode = GAMEMODE_TEAM_CAPTINS_MODE;
			break;

			case 'Blue VS Pink Swapped':
				pickGamemode = GAMEMODE_REVERSE_CAPTINS_MODE;
			break;

            case 'Cycling Builds':
                pickGamemode = GAMEMODE_CYCLING_BUILDS;
            break;

            case 'Unlimited Points':
                pickGamemode = GAMEMODE_UNLIMITED_POINTS;
            break;

			default:
				pickGamemode = GAMEMODE_DEFAULT;
			break;
		}

        switch(options['Unique Skills']) {
            case 'Don\'t Force Unique Skills':
                banUniqueSkills = 0;
            break;

            case 'Unique Team Skills':
                banUniqueSkills = 1;
            break;

            case 'Unique Global Skills':
                banUniqueSkills = 2;
            break;
        }

		switch(options['Banning Time'] || '3:00') {
			case 'No Banning Phase':
				// Disable banning phase
				banningPhase = false;
			break;

			default:
				// enable banning phase, load time
				banningPhase = true;
				banningPhaseLength = friendlyTimeToSeconds(options['Banning Time'].replace(' Banning Phase') || '3:00');
			break;
		}

		// Grab how many slots to use
		switch(options['Number of Slots']) {
            case 'Use 1 Slot':
                maxSlots = 1;

                fixHeroPool();
            break;

            case 'Use 2 Slots':
                maxSlots = 2;

                fixHeroPool();
            break;

            case 'Use 3 Slots':
                maxSlots = 3;

                fixHeroPool();
            break;

            case 'Use 4 Slots':
                maxSlots = 4;

                fixHeroPool();
            break;

			case 'Use 5 Slots':
				maxSlots = 5;

				fixHeroPool();
			break;

			case 'Use 6 Slots':
				maxSlots = 6;

				fixHeroPool();
			break;
		}

		// Grab how many regular skills
		switch(options['Max Number of Regular Skills']) {
			case 'Allow Upto 6 Regular Skills':
				maxSkills = 6;
			break;

			case 'Allow Upto 5 Regular Skills':
				maxSkills = 5;
			break;

			case 'Allow Upto 4 Regular Skills':
				maxSkills = 4;
			break;

			case 'Allow Upto 3 Regular Skills':
				maxSkills = 3;
			break;

			case 'Allow Upto 2 Regular Skills':
				maxSkills = 2;
			break;

			case 'Allow Upto 1 Regular Skill':
				maxSkills = 1;
			break;

			case 'Don\'t Allow Regular Skills':
				maxSkills = 0;
			break;
		}

		// Grab how many ults
		switch(options['Max Number of Ults']) {
			case 'Allow Upto 6 Ults':
				maxUlts = 6;
			break;

			case 'Allow Upto 5 Ults':
				maxUlts = 5;
			break;

			case 'Allow Upto 4 Ults':
				maxUlts = 4;
			break;

			case 'Allow Upto 3 Ults':
				maxUlts = 3;
			break;

			case 'Allow Upto 2 Ults':
				maxUlts = 2;
			break;

			case 'Allow Upto 1 Ult':
				maxUlts = 1;
			break;

			case 'Don\'t Allow Ults':
				maxUlts = 0;
			break;
		}

		// Ban Last Skills?
		switch(options['Allow Skills Twice in a Row']) {
			case 'Disallow Skills Twice in a Row':
				banLastSkills = true
			break;

			case 'Allow Skills Twice in a Row':
				banLastSkills = false
			break;
		}

		// Custom bear skills
		switch(options['Allow Custom Bear Skills']) {
			case 'Allow Custom Bear Skills':
				allowCustomBearSkills = true
			break;

			case 'Disallow Custom Bear Skills':
				allowCustomBearSkills = false
			break;
		}

		// Custom tower skills
		switch(options['Allow Custom Tower Skills']) {
			case 'Allow Custom Tower Skills':
				allowCustomTowerSkills = true
			break;

			case 'Disallow Custom Tower Skills':
				allowCustomTowerSkills = false
			break;
		}

		// Should we allow custom skills?
		switch(options['Allow Custom Skills']) {
			case 'Allow Custom Skills':
				allowCustomSkills = true;
			break;

			case 'Disallow Custom Skills':
				allowCustomSkills = false;
			break;
		}

		// Should we allow passive skills?
		switch(options['Allow Passive Skills']) {
			case 'Allow Passive Skills':
				banPassive = false;
			break;

			case 'Ban Passive Skills':
				banPassive = true;
			break;
		}

		// Should we allow neutral abilities?
		switch(options['Allow Neutral Abilities']) {
			case 'Allow Neutral Abilities':
				allowNPCAbs = true;
				skillList = skillList.concat(abList.NPC);
			break;

			case 'Ban Neutral Abilities':
				allowNPCAbs = false;
			break;
		}

		// Should we allow summon abilities?
		switch(options['Allow Summon Abilities']) {
			case 'Allow Summon Abilities':
				allowSummonAbs = true;
				skillList = skillList.concat(abList.Summon);
			break;

			case 'Ban Summon Abilities':
				allowSummonAbs = false;
			break;
		}

		// Should we allow Greevling abilities?
		switch(options['Allow Greevling Abilities']) {
			case 'Allow Greevling Abilities':
				allowGreevlingAbs = true;
				skillList = skillList.concat(abList.Greevling);
			break;

			case 'Ban Greevling Abilities':
				allowGreevlingAbs = false;
			break;
		}

		// Should we ban trolling combos?
		switch(options['Ban Troll Combos']) {
			case 'Ban Troll Combos':
				banStupidCombos = true;
			break;

			case 'Allow Trolls':
				banStupidCombos = false;
			break;
		}

		// Should we ban Silencer?
		switch(options['Ban Silencer']) {
			case 'Ban Silencer':
				banSilencer = true;

				fixHeroPool();
			break;

			case 'Allow Silencer':
				banSilencer = false;

				fixHeroPool();
			break;
		}

		// Should we ban tinker's rearm?
		switch(options['Ban Tinker Rearm']) {
			case 'Ban Tinker Rearm':
				banRearm = true;
			break;

			case 'Allow Tinker Rearm':
				banRearm = false;
			break;
		}

		// Should we ban chemical rage?
		/*switch(options['Ban Chemical Rage']) {
			case 'Ban Chemical Rage':
				banChemRage = true;
			break;

			case 'Allow Chemical Rage':
				banChemRage = false;
			break;
		}*/

		// Should we ban invisiblity?
		switch(options['Ban Invisibility']) {
			case 'Ban Perma Invisibility':
				banInvis = 1;
			break;

			case 'Ban All Invisibility Abilities':
				banInvis = 2;
			break;

			case 'Allow Invisibility':
				banInvis = 0;
			break;
		}

	}

	// Load all dependencies (stop lag later on)
	for(var i=0; i<skillList.length; i++) {
		loadDeps(skillList[i]);
	}

    // Fix fucking custom spell power SHIT
    var csp = obj.getOptionsForPlugin('CustomSpellPower');
    if(csp) {
        // Try to grab multiplier
        var mult = csp['Multiplier'];
        if(mult) {
            // Try to change the duration modifier
            durationMultiplier = parseFloat(mult.substr(1, mult.length)) || 1;
        }
    }
});

// Load save data
var saveData = {};		// Actual save data
var saveVersion = 1;	// Current Version of save data
var cantSave = {};		// If a user cant save
game.hook("OnClientPutInServer", function(client){
	// Grab steamID
	var sID = client.getAuthString();

	// Load this player's save data
	saveData[sID] = lobbyManager.getPlayerData(client);

	if(!saveData[sID] || saveData[sID] == '' || saveData[sID].length <= 0) {
		// Create an empty build
		var emptyBuild = '{1}{1}{1}{1}{1}{1}'.format(encodeNumber(0));

		// Version 1 save data
		saveData[sID] = '{1}{2}{2}{2}{2}{2}{2}{2}{2}{2}{2}'.format(encodeNumber(saveVersion), emptyBuild);
	}

	// Patch version stuff here

});

// Build list of ID --> Skills and Skills --> ID
var abIDs = {};
var abSkillIDs = {};

for(key in abInfo) {
	// Grab an ability section
	var ab = abInfo[key];

	// Validate it, make sure it has an ID
	if(ab && ab.ID) {
		// Grab the ID, make it more user friendly
		var id = parseInt(ab.ID) - 5000;

		// Make sure it was valid
		if(id >= 3) {
			// Store it
			abIDs[id] = key;
			abSkillIDs[key] = id;
		}
	}
}

game.hook("OnMapStart", function() {
	// Fixup the hero pool
	fixHeroPool();

	// Load neutral shit
	dota.loadParticleFile('particles/neutral_fx.pcf');
	dota.loadParticleFile('particles/world_creature_fx.pcf');

	// Fix greevling crash
	game.precacheModel('models/creeps/mega_greevil/mega_greevil.mdl', true);
});

game.hook("Dota_OnHeroPicked", function(client, heroName){
	if(!client || !client.isInGame()) return;

	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Check if they picked invoker
	if(heroName == 'npc_dota_hero_invoker') {
		// Allow this player to use -invoker
		isInvoker[playerID] = 1;

		// Tell this player about -invoker
		client.print('Type {red}-invoker {lgreen}to use your regular skills, if you do this, you wont be able to change them.');
	}

	// Only one meepo
	if(heroName == 'npc_dota_hero_meepo') {
		if(meepoTaken) return null;
		meepoTaken = true;
	}
});

console.addClientCommand('testload', function(client, args) {
    console.findConVar('dota_wait_for_players_to_load').setInt(0);
});

console.addClientCommand('invoker', function(client, args) {
	if(!client || !client.isInGame()) return;

	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	if(isInvoker[playerID] == 2) {
		client.print('You will already spawn with invoker\'s skills.');
		return;
	}

	if(isInvoker[playerID] != 1) {
		client.print('You can\'t use {red}-invoker');
		return;
	}

	var hero = client.netprops.m_hAssignedHero;
	if(hero && hero.isValid()) {
		client.print('It is too late to use {red}-invoker');
		return;
	}

	// Make this player spawn
	isInvoker[playerID] = 2;

	// Tell the client it worked
	client.print('You will now spawn with your regular skills.');
});

function fixHeroPool() {
	for(var i=0;i<128;i++) {
		// Grab the name of this hero
		var heroName = dota.heroIdToClassname(i);

		// Check if this hero has enough slots
		if(findHeroSlotCount(heroName) >= maxSlots) {
			// Yes
			dota.setHeroAvailable(i, true);
		} else {
			// no
			dota.setHeroAvailable(i, false);
			//print(heroName)
		}
	}

	// Meepo is out
	//dota.setHeroAvailable(82, false);

	// Should we ban silencer?
	if(banSilencer) {
		dota.setHeroAvailable(75, false);
	}
}

function isHeroMelee(heroName) {
	// Grab the hero map for this hero, validate it
	var map = heroesKV[heroName];
	if(!map) return true;

	return (map['AttackCapabilities'] == 'DOTA_UNIT_CAP_MELEE_ATTACK');
}

function findHeroSlotCount(heroName) {
	// Grab the hero map for this hero, validate it
	var map = heroesKV[heroName];
	if(!map) return 0;

	// Heroes with wrong slot counts (for out purposes)
	if(heroName == 'npc_dota_hero_lone_druid') return 4;

	// Return how many slots this hero has (default to 4)
	return map['AbilityLayout'] || 4;
}

// Compute the edit distance between the two given strings
function editDistance(a, b){
	if(a.length == 0) return b.length;
	if(b.length == 0) return a.length;

	var matrix = [];

	// increment along the first column of each row
	var i;
	for(i = 0; i <= b.length; i++){
		matrix[i] = [i];
	}

	// increment each column in the first row
	var j;
	for(j = 0; j <= a.length; j++){
	matrix[0][j] = j;
	}

	// Fill in the rest of the matrix
	for(i = 1; i <= b.length; i++){
		for(j = 1; j <= a.length; j++){
			if(b.charAt(i-1) == a.charAt(j-1)){
				matrix[i][j] = matrix[i-1][j-1];
			} else {
				matrix[i][j] = 	Math.min(matrix[i-1][j-1] + 1, // substitution
								Math.min(matrix[i][j-1] + 1, // insertion
										 matrix[i-1][j]) + 1); // deletion
			}
		}
	}

	return matrix[b.length][a.length];
};

function quickDist(a, b) {
	// If they are exact matches, give a negative
	if(a == b) {
		return -1;
	}

	// Make a less long
	if(a.length > b.length) {
		var tmp = a;
		a = b;
		b = tmp;
	}

	var minDist = 1000;

	var dif = b.length-a.length;
	for(var i=0; i<dif+1; i++) {
		var dist = editDistance(a, b.substring(i, i+a.length));

		if(dist < minDist) {
			minDist = dist;
		}
	}

	return minDist;
}

// Sorts a skills array
function sortSkills(arr, query) {
	// Ensure query is in lowercase
	for(var i=0; i<query.length; i++) {
		query[i] = query[i].toLowerCase();
	}

	arr.sort(function(a, b) {
		var ta = 0;
		var tb = 0;

		for(i=0; i<query.length; i++) {
			var key = query[i];

			if(a.indexOf(key) != -1) ta++;
			if(b.indexOf(key) != -1) tb++;
		}

		if(ta == tb) {
			// Do a quick distance checker

			var total = 0;

			for(i=0; i<query.length; i++) {
				var key = query[i];
				total += (quickDist(key, a) - quickDist(key, b));
			}

			// Check if one weighs more
			if(total != 0) return total;

			// Sort alphabetically
			if(a < b) return -1;
			if(a > b) return 1;
			return 0;
		}

		// Pick the one with MORE sub strings
		return (ta > tb ? -1: 1);
	});
}

function cleanupModifier(hero, name) {
	if(dota.hasModifier(hero, name)) {
		dota.removeModifier(hero, name);
	}

	if(dota.hasModifier(hero, 'modifier_'+name)) {
		dota.removeModifier(hero, 'modifier_'+name);
	}
}

function cleanupAbility(hero, ab) {
	if(!ab || !ab.isValid()) return;

	// Grab info on the skill
	var name = ab.getClassname();

	// Cleanup modifiers
	cleanupModifier(hero, name);

	// Remove the ability
	dota.remove(ab);
}

// This cleans stuff up, but will also refund any skill points
function cleanupAbilitySafe(hero, ab) {
    if(!ab || !ab.isValid()) return;

    // Grab info on the skill
    var name = ab.getClassname();
    var info = abInfo[name];

    // Refund ability points
    var abLvl = ab.netprops.m_iLevel;
    if(abLvl && abLvl > 0 && name != 'forged_spirit_melting_strike') {
        hero.netprops.m_iAbilityPoints += abLvl;
    }

    // If we are stacking passives (why people want this, idk) just dont remove the ability / skill >_>
    if(stackPassives) return;

    // Cleanup spirit bear
    if(name == 'lone_druid_spirit_bear') {
        var conIndex = 1 << hero.netprops.m_iPlayerID;

        // Remove bears owned by this hero
        var bears = game.findEntitiesByClassname('npc_dota_lone_druid_bear*');
        for(i=0; i<bears.length; i++) {
            var bear = bears[i];
            if(!bear || !bear.isValid()) continue;

            // Check if the bear is owned by this player
            if(bear.netprops.m_iIsControllableByPlayer == conIndex) {
                // Remove it
                dota.remove(bear);
            }
        }

        // Remove stuff
        dota.remove(ab);
        cleanupModifier(hero, name);
        return;
    }

    // Cleanup familiars
    if(name == 'visage_summon_familiars') {
        var conIndex = 1 << hero.netprops.m_iPlayerID;

        // Remove bears owned by this hero
        var bears = game.findEntitiesByClassname('npc_dota_visage_familiar*');
        for(i=0; i<bears.length; i++) {
            var bear = bears[i];
            if(!bear || !bear.isValid()) continue;

            // Check if the bear is owned by this player
            if(bear.netprops.m_iIsControllableByPlayer == conIndex) {
                // Remove it
                dota.remove(bear);
            }
        }

        // Remove stuff
        dota.remove(ab);
        cleanupModifier(hero, name);
        return;
    }

    // Cleanup webs
    if(name == 'broodmother_spin_web') {
        var conIndex = 1 << hero.netprops.m_iPlayerID;

        // Remove bears owned by this hero
        var bears = game.findEntitiesByClassname('npc_dota_broodmother_web*');
        for(i=0; i<bears.length; i++) {
            var bear = bears[i];
            if(!bear || !bear.isValid()) continue;

            // Check if the bear is owned by this player
            if(bear.netprops.m_hOwnerEntity == hero) {
                // Remove it
                dota.remove(bear);
            }
        }

        // Remove stuff
        dota.remove(ab);
        cleanupModifier(hero, name);
        return;
    }

    // Cleanup restoration
    if(name == 'witch_doctor_voodoo_restoration') {
        cleanupModifier(hero, 'modifier_voodoo_restoration_aura');
        cleanupModifier(hero, 'modifier_voodoo_restoration_heal');
    }

    // Cleanup templar refraction
    if(name == 'templar_assassin_refraction') {
        cleanupModifier(hero, 'modifier_templar_assassin_refraction_damage');
        cleanupModifier(hero, 'modifier_templar_assassin_refraction_absorb');
    }

    // Cleanup modifiers
    cleanupModifier(hero, name);

    var duration = -1;

    if(info) {
        for(key in info) {
            if( key.indexOf('duration') != -1 ||
                key.indexOf('ChannelTime') != -1) {

                // Grab all durations
                var durs = info[key].split(' ');

                // Update duration
                var newDuration = parseFloat(durs[durs.length-1]);

                // Take largest
                if(newDuration > duration) {
                    duration = newDuration;
                }
            }
        }

        // Check for duration
        var spec = info.AbilitySpecial;
        if(spec) {
            for(key in spec) {
                for(key2 in spec[key]) {
                    if( key2.indexOf('duration') != -1 ||
                        key2.indexOf('channel_time') != -1) {

                        // Grab all durations
                        var durs = spec[key][key2].split(' ');

                        // Update duration
                        var newDuration = parseFloat(durs[durs.length-1]);

                        // Take largest
                        if(newDuration > duration) {
                            duration = newDuration;
                        }
                    }
                }
            }
        }

        // Check if this ability has behavior (probably does)
        var b = info['AbilityBehavior'];
        if(b != null) {
            // If it's a passive, we can simply remove it
            if(b.indexOf('DOTA_ABILITY_BEHAVIOR_PASSIVE') != -1) {
                dota.remove(ab);
                return;
            }
        }
    }

    // Failed to find duration, default to 300
    if(duration == -1) {
        duration = 300;
    }

    // Remvoe after duration is up (add a buffer of 10 seconds since cleanup doesnt matter too much anyways)
    timers.setTimeout(function() {
        if(ab && ab.isValid()) {
            dota.remove(ab);
        }
    }, (duration) * 1000 * durationMultiplier + 1000);
    // durationMultiplier is for CSP support
    // Add an extra second just to be sure
}

function loadDeps(skill) {
	// Load the base deps if this is a custom spell
	if(customSpells[skill]) skill = customSpells[skill].base;

	var dependencies = abDeps[skill];
	if(dependencies){
		if(dependencies.Particles){
			for(var k=0;k<dependencies.Particles.length;++k){
				dota.loadParticleFile(dependencies.Particles[k]);
			}
		}

		if(dependencies.Models){
			for(var k=0;k<dependencies.Models.length;++k){
				game.precacheModel(dependencies.Models[k], true);
			}
		}
	}else{
		print("Couldn't find dependencies for ability: " + skill);
	}
}

// A list of everyone (indexed by playerID) that has had their skills replaced on spawn already
var replacedSkills = {};

game.hook("Dota_OnHeroSpawn", function(hero) {
	// Validate hero
	if(!hero || !hero.isValid()) return;

	// Grab playerID
	var playerID = hero.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	timers.setTimeout(function() {
		if(!hero || !hero.isValid()) return;

		var client = dota.findClientByPlayerID(playerID);
		if(client && client.isInGame()) {
			var realHero = client.netprops.m_hAssignedHero;
			if(!realHero || !realHero.isValid() || (hero == realHero)) return;

			for(var i=0; i<16; i++) {
				// Grab real ability
				var realab = realHero.netprops.m_hAbilities[i];

				if(realab != null) {
					var abName = realab.getClassname();

					var ab = hero.netprops.m_hAbilities[i];
					if(ab != null) {
						if(ab.getClassname() != abName) {
							// Cleanup this ability
							cleanupAbility(hero, ab);

							// Put the new skill in
							skillIntoSlot(hero, abName, i, realab.netprops.m_iLevel);
						} else {
							// Make sure the level is correct
							while(ab.netprops.m_iLevel < realab.netprops.m_iLevel) {
								dota.upgradeAbility(ab);
							}
						}
					} else {
						// Just give the skill
						skillIntoSlot(hero, abName, i, realab.netprops.m_iLevel);
					}
				}
			}
		}
	}, 1);

	// Check if our skills have already been replaced
	if(replacedSkills[playerID]) return;
	replacedSkills[playerID] = true;

	// Check if they are an invoker
	if(isInvoker[playerID] == 2 && hero.getClassname() == 'npc_dota_hero_invoker') return;

	// Give random skills to this hero
	randomSkills(hero);
});

function randomSkills(hero) {
	// Validate hero
	if(!hero || !hero.isValid()) return;

	for(var i=0; i<16; i++) {
		// Grab ability
		var ab = hero.netprops.m_hAbilities[i];
		if(ab && ab.isValid()) {
			// Clean it up
			cleanupAbility(hero, ab);
		}
	}

	// Give 4 random skills
	var totalSkills = 0;
	var totalUlts = 0;

	var totalAbs = 0;

	// Give skills
	while(totalSkills < maxSkills) {
		var name = abList.Abs.random();

		// Check if we are allowed to use this skill
		if(allowedToUse(null, hero, name, totalAbs+1)) {
			// Load dependencies
			loadDeps(name);

			// Give the new ability
			skillIntoSlot(hero, name, totalAbs);

			// Increase totals
			totalAbs++;
			totalSkills++

			if(totalAbs >= maxSlots) return;
		}
	}

	// Give ults
	while(totalUlts < maxUlts) {
		var name = abList.Ults.random();

		// Check if we are allowed to use this skill
		if(allowedToUse(null, hero, name, totalAbs+1)) {
			// Load dependencies
			loadDeps(name);

			// Give the new ability
			skillIntoSlot(hero, name, totalAbs);

			// Increase totals
			totalAbs++;
			totalUlts++

			if(totalAbs >= maxSlots) return;
		}
	}
}

console.addClientCommand('random', function(client, args) {
	if(pickState != STATE_PICKING) {
		client.print('You can only use this during the picking phase.');
		return;
	}

	// Grab the hero
	var hero = client.netprops.m_hAssignedHero;
	if(!hero || !hero.isValid()) {
		client.print('You have no valid heroes. You must spawn first!');
		return;
	}

	// Randomise this heroes skills
	randomSkills(hero);
});

// Gives helpful commands
function printHelp(client) {
	if(!client || !client.isInGame()) return;

	client.print('Type {red}-skill {pink} [Skill_name_OR_skill_ID] [slot] {lgreen} to select your skills.');
	client.print('Type {red}-find {pink}[search argument(s) seperated by spaces] {lgreen} to find skills.');
	client.print('Try {red}-random{lgreen}, {red}-last {lgreen}and {red}-tower');
	client.print('Type {red}-save {pink}[1-9] {lgreen} and {red}-load {pink}[1-9] {lgreen}to save and load skill sets.');
	client.print('Type {red}-help {lgreen} for help, and {red}-ready {lgreen}when you\'re done picking skills.');
}

function printBanHelp(client) {
	if(!client || !client.isInGame()) return;

	client.print('Type {red}-ban {pink} [Skill_name_OR_skill_ID] {lgreen} to ban a skill.');
	client.print('Type {red}-find {pink}[search argument(s) seperated by spaces] {lgreen} to find skills.');
	client.print('Type {red}-banhelp {lgreen} for help.');
}

// Bind it to a console command
console.addClientCommand('help', printHelp);
console.addClientCommand('banhelp', printHelp);

// The time the picking stage started
var startTime = 0;

// The time the unpausing started
var unpauseStart = 0;

// Last time we alerted everyone of the time
var lastAlert = 0;

function alertTime(time, sound) {
	// Workout how long is left
	var timeLeft = startTime+pickingDelay - game.getTime();

	if(lastAlert > time) {
		if(timeLeft <= time) {
			// Stop the alert from going off again
			lastAlert = time;

			// Tell everyone
			server.printToChatAll('{1}You have {red}{2}{lgreen} seconds left to pick your skills!'.format(getPrefix(), time));

			// Check if there is a sound to go with this
			if(sound) {
				playSoundToall(sound);
			}
		}
	}
}

function alertTimeBan(time, sound) {
	// Workout how long is left
	var timeLeft = startTime+banningPhaseLength - game.getTime();

	if(lastAlert > time) {
		if(timeLeft <= time) {
			// Stop the alert from going off again
			lastAlert = time;

			// Tell everyone
			server.printToChatAll('{1}You have {red}{2}{lgreen} seconds left to ban skills!'.format(getPrefix(), time));

			// Check if there is a sound to go with this
			if(sound) {
				playSoundToall(sound);
			}
		}
	}
}

function playSoundToall(sound) {
	for(var i=0; i<server.clients.length; i++) {
		var client = server.clients[i];
		if(!client || !client.isValid()) continue;

		dota.sendAudio(client, false, sound);
	}
}

var connectedCount = 0;
var minPlayers = 10;
var doneBanPhase = false;
var givenBanningHint = false;
game.hook("OnClientPutInServer", function(client) {
	connectedCount++;

	if(connectedCount >= minPlayers) {
		if(banningPhase && pickState == STATE_INIT && !doneBanPhase) {
			// Begin the banning phase
			doneBanPhase = true;
			beginBanning();

			// Pause the game
			dota.setGamePaused(true);
		}
	}
});

game.hook("OnClientDisconnect", function(client) {
	connectedCount--;
});

var midTimer = 0;
var setToMidOnly = true;
game.hook("OnGameFrame", function() {
	if(pickState == STATE_INIT) {
		// Don't pause the game
		dota.setGamePaused(false);

		// Check if it's time to set mid only
		if(game.rules.props.m_nGameState >= dota.STATE_HERO_SELECTION) {
			// Change gamemode to mid only after 5 seconds
			if(midTimer == 0) {
				// Store the game mode we're in
				originalGamemode = game.rules.props.m_iGameMode;

				midTimer = 1;

				timers.setTimeout(function() {
					midTimer = 2;
				}, 3000);

				timers.setTimeout(function() {
					// Force randoms
					for(var i=0; i<server.clients.length; i++) {
						var client = server.clients[i];
						if(client && client.isInGame()) {
							client.fakeCommand('dota_select_hero random');
						}
					}

					// Reset to original game mode
					setToMidOnly = false;
					game.rules.props.m_iGameMode = originalGamemode;
				}, 59000);
			} else if(midTimer == 2) {
				// If we should be setting to mid only or not
				if(setToMidOnly) {
					// Mid Only
					game.rules.props.m_iGameMode = 11;
				}
			}
		}

		// Check if the game has started
		if(game.rules.props.m_nGameState >= dota.STATE_PRE_GAME) {
			// Pause the game
			dota.setGamePaused(true);

			// Check if there is a banning phase
			if(banningPhase && !doneBanPhase) {
				// Begin the banning phase
				beginBanning();
			} else {
				// Begin the picking phase
				beginPicking();
			}
		}
	} else if(pickState == STATE_BANNING) {
		// Alert users at key poitns in time
		alertTimeBan(270);
		alertTimeBan(240);
		alertTimeBan(210);
		alertTimeBan(180);
		alertTimeBan(150);
		alertTimeBan(120);
		alertTimeBan(90);
		alertTimeBan(60);
		alertTimeBan(30);
		alertTimeBan(15);
		alertTimeBan(10, SOUND_10SECS);
		alertTimeBan(5, SOUND_5SECS);
		alertTimeBan(3);

		if(doneBanPhase && !givenBanningHint && game.getTime() >= startTime+10) {
			// We've given the hint
			givenBanningHint = true;

			// Tell them it's picking time
			playSoundToall(SOUND_TURN_BAN);

			// Give everyone help
			for(var i=0; i<server.clients.length; i++) {
				var client = server.clients[i];
				if(!client || !client.isInGame()) continue;

				client.print('You have {red}{1}{lgreen} seconds to ban skills.'.format(banningPhaseLength-10));
				printBanHelp(client);
			}
		}

		// Check if the time is up
		if(game.getTime() >= startTime+banningPhaseLength) {
			// Randomise skills to avoid people randoming banned skills

			if(!doneBanPhase) {
				// Grab all heroes
				var heroes = game.findEntitiesByClassname('npc_dota_hero_*');

				// Loop over heroes
				for(var hh=0; hh<heroes.length; hh++) {
					// Grab a hero
					var hero = heroes[hh];

					// Validate hero
					if(!hero || !hero.isValid()) continue;

					// No illusions
					if(dota.hasModifier(hero, 'modifier_illusion')) continue;

					// Give random skills to this hero
					randomSkills(hero);
				}

				// Begin picking phase
				beginPicking();
			} else {
				// Unpause, continue into the hero picking
				dota.setGamePaused(false);

				// Move onto the hero picking phase
				pickState = STATE_INIT;
			}
		} else {
			// Pause the game
			dota.setGamePaused(true);
		}
	} else if(pickState == STATE_PICKING) {
		// Alert users at key poitns in time
		alertTime(270);
		alertTime(240);
		alertTime(210);
		alertTime(180);
		alertTime(150);
		alertTime(120);
		alertTime(90);
		alertTime(60);
		alertTime(30, SOUND_30SECS);
		alertTime(15);
		alertTime(10, SOUND_10SECS);
		alertTime(5, SOUND_5SECS);
		alertTime(3);

		// Check if the time is up
		if(game.getTime() >= startTime+pickingDelay) {
			beginGame();
		} else {
			// Pause the game
			dota.setGamePaused(true);
		}
	} else if(pickState == STATE_UNPAUSING){
		// Check if the game time has changed
		if(unpauseStart == game.rules.props.m_fGameTime) {
			// Unpause the game
			dota.setGamePaused(false);
		} else {
			// Game can go on like normal
			pickState = STATE_PLAYING;
		}
	}
});

function beginBanning() {
	// Begin the picking state
	pickState = STATE_BANNING;

	// If the banning phase hasn't happened, just do it the old way
	if(!doneBanPhase) {
		// Tell them it's picking time
		playSoundToall(SOUND_TURN_BAN);

		// Give everyone help
		for(var i=0; i<server.clients.length; i++) {
			var client = server.clients[i];
			if(!client || !client.isInGame()) continue;

			client.print('You have {red}{1}{lgreen} seconds to ban skills.'.format(banningPhaseLength));
			printBanHelp(client);
		}

		// We alerted at the start
		lastAlert = banningPhaseLength;
	} else {
		// Add 10 second to the banning phase
		banningPhaseLength += 10;

		// We alerted at the start
		lastAlert = banningPhaseLength - 10;
	}

	// Set the start time of this phase
	startTime = game.getTime();
}

function beginPicking() {
	// Tell them it's picking time
	playSoundToall(SOUND_TURN_PICK);

	// Begin the banning state
	pickState = STATE_PICKING;

	// Give everyone help
	for(var i=0; i<server.clients.length; i++) {
		var client = server.clients[i];
		if(!client || !client.isInGame()) continue;

		client.print('You have {red}{1}{lgreen} seconds to pick your skills.'.format(pickingDelay));
		printHelp(client);
	}

	// Set the start time of this phase
	startTime = game.getTime();

	// We alerted at the start
	lastAlert = pickingDelay;
}

// Finds all heroes, then loops over them, calls: callback(hero)
function loopOverHeroes(callback) {
	// Give all the missing skills
	var heroes = game.findEntitiesByClassname('npc_dota_hero_*');

	// Loop over heroes
	for(var hh=0; hh<heroes.length; hh++) {
		// Grab a hero
		var hero = heroes[hh];

		// Validate hero
		if(!hero || !hero.isValid()) continue;

		// No illusions
		if(dota.hasModifier(hero, 'modifier_illusion')) continue;

		if(!hero.netprops || !hero.netprops.m_hAbilities) continue;

		var name = hero.getClassname();
		if(name.indexOf('npc_dota_hero_announcer') != -1) continue;

		// Run this function
		callback(hero);
	}
}

// Loops over a heroes abilties, calls: callback(ab)
function loopOverSkills(hero, callback) {
	for(var i=0; i<16; i++) {
		// Grab ability
		var ab = hero.netprops.m_hAbilities[i];

		// Validate ability
		if(ab && ab.isValid()) {
			callback(ab);
		}
	}
}

// Cycles to the next build
var allBuilds = {};
function cycleBuilds() {
    // Grab build
    var n = ~~(Math.random() * allBuilds.length);
    var b = allBuilds[n]
    var build = b.skills;

    // Assign a build to each hero
    loopOverHeroes(function(hero) {
        // Apply Build
        for(var i=0; i<build.length; i++) {
            cleanupAbilitySafe(hero, hero.netprops.m_hAbilities[i]);
            skillIntoSlot(hero, build[i], i);
        }
    });

    // Tell everyone who's build was chosen
    server.printToChatAll('{pink}{1}{lgreen}\'s build has been applied!'.format(b.name));

    playSoundToall(SOUND_CASINO);
}

function buildPool() {
	var pool = [];

	loopOverHeroes(function(hero) {
		var playerName = '???';

		var playerID = hero.netprops.m_iPlayerID;
		var client = dota.findClientByPlayerID(playerID);
		if(client && client.isInGame()) playerName = client.getName();

		// Build list of skills for this  hero
		loopOverSkills(hero, function(ab) {
			pool.push({
				skill: ab.getClassname(),
				name: playerName
			});
		});
	});

	// Give the pool back
	return pool;
}

function buildPools() {
	var pools = [];

	// Build list of pools
	loopOverHeroes(function(hero) {
		var skills = [];

		// Build list of skills for this  hero
		loopOverSkills(hero, function(ab) {
			skills.push(ab.getClassname());
		});

		var playerName = '???';

		var playerID = hero.netprops.m_iPlayerID;
		var client = dota.findClientByPlayerID(playerID);
		if(client && client.isInGame()) playerName = client.getName();

		// Store pool
		pools.push({
			skills: skills,
			name: playerName,
			playerID: playerID
		});
	});

	// Give pools back
	return pools;
}

function buildTeamPools(team) {
	var pools = [];

	// Build list of pools
	loopOverHeroes(function(hero) {
		// Make sure they are on the correct team
		if(hero.netprops.m_iTeamNum != team) return;

		var skills = [];

		// Build list of skills for this  hero
		loopOverSkills(hero, function(ab) {
			skills.push(ab.getClassname());
		});

		var playerName = '???';

		var playerID = hero.netprops.m_iPlayerID;
		var client = dota.findClientByPlayerID(playerID);
		if(client && client.isInGame()) playerName = client.getName();

		// Store pool
		pools.push({
			skills: skills,
			name: playerName,
			playerID: playerID
		});
	});

	// Give pools back
	return pools;
}

// Starts the game
function beginGame() {
	// Stop this from being call if we are in the wrong state
	if(pickState != STATE_PICKING) return;

	// Play the battle begins
	playSoundToall(SOUND_BATTLE_BEGIN);

	// Store that the game has started
	pickState = STATE_UNPAUSING;

	// Unpause the game
	dota.setGamePaused(false);

	// Store when first unpaused the game
	unpauseStart = game.rules.props.m_fGameTime;

	if(pickGamemode == GAMEMODE_POOLED) {
		var pools = buildPools();

		// Assign a build to each hero
		loopOverHeroes(function(hero) {
			// Grab build
			var n = ~~(Math.random() * pools.length);
			var b = pools[n]
			var build = b.skills;

			// Tell them who got whos
			var to = dota.findClientByPlayerID(hero.netprops.m_iPlayerID);
			if(to && to.isInGame()) {
				var from = dota.findClientByPlayerID(b.playerID);
				if(from && from.isInGame()) {
					from.print('{pink}{1} {lgreen}got your build.'.format(to.getName()));
				}

				to.print('You got {pink}{1}{lgreen}\'s build.'.format(b.name));
			}

			// Apply Build
			for(var i=0; i<build.length; i++) {
				cleanupAbility(hero, hero.netprops.m_hAbilities[i]);
				skillIntoSlot(hero, build[i], i);
			}

			// Remove build from the pool
			pools.splice(n, 1);
		});

		playSoundToall(SOUND_CASINO);
	}

	if(pickGamemode == GAMEMODE_RANDOM_POOLED) {
		var pool = buildPool();

		// Assign a build to each hero
		loopOverHeroes(function(hero) {
			var client = dota.findClientByPlayerID(hero.netprops.m_iPlayerID);;

			// Apply Build
			for(var i=0; i<maxSlots; i++) {
				// Grab a random skill
				var name = '';
				var set;
				var count = 0;
				while(!allowedToUse(null, hero, name, i+1) && count < 15) {
					set = pool.random();
					name = set.skill;
					count++;
				}

				cleanupAbility(hero, hero.netprops.m_hAbilities[i]);
				skillIntoSlot(hero, name, i);

				if(client && client.isInGame()) {
					client.print('{pink}{1} {lgreen}from {pink}{2}'.format(name, set.name))
				}
			}
		});

		playSoundToall(SOUND_CASINO);
	}

	if(pickGamemode == GAMEMODE_REVERSE_POOLED) {
		var pools = {};

		// Build the pools for each team
		pools[dota.TEAM_RADIANT] = buildTeamPools(dota.TEAM_DIRE);
		pools[dota.TEAM_DIRE] = buildTeamPools(dota.TEAM_RADIANT);

		// Assign a build to each hero
		loopOverHeroes(function(hero) {
			var pool = pools[hero.netprops.m_iTeamNum];
			if(!pool || pool.length <= 0) return;

			// Grab build
			var n = ~~(Math.random() * pool.length);
			var b = pool[n]
			var build = b.skills;

			// Tell them who got whos
			var to = dota.findClientByPlayerID(hero.netprops.m_iPlayerID);
			if(to && to.isInGame()) {
				var from = dota.findClientByPlayerID(b.playerID);
				if(from && from.isInGame()) {
					from.print('{pink}{1} {lgreen}got your build.'.format(to.getName()));
				}

				to.print('You got {pink}{1}{lgreen}\'s build.'.format(b.name));
			}

			// Apply Build
			for(var i=0; i<build.length; i++) {
				cleanupAbility(hero, hero.netprops.m_hAbilities[i]);
				skillIntoSlot(hero, build[i], i);
			}

			// Remove build from the pool
			pool.splice(n, 1);
		});

		playSoundToall(SOUND_CASINO);
	}

	if(pickGamemode == GAMEMODE_CAPTINS_MODE) {
		var pools = buildPools();

		// Grab build
		var n = ~~(Math.random() * pools.length);
		var b = pools[n]
		var build = b.skills;

		// Assign a build to each hero
		loopOverHeroes(function(hero) {
			// Apply Build
			for(var i=0; i<build.length; i++) {
				cleanupAbility(hero, hero.netprops.m_hAbilities[i]);
				skillIntoSlot(hero, build[i], i);
			}
		});

		// Tell everyone who's build was chosen
		server.printToChatAll('{pink}{1}{lgreen}\'s build was chosen.'.format(b.name));

		playSoundToall(SOUND_CASINO);
	}

    if(pickGamemode == GAMEMODE_CYCLING_BUILDS) {
        // Store all the builds
        allBuilds = buildPools();

        // Cycle over all the builds
        cycleBuilds();

        // Cycle builds every so often
        timers.setInterval(function() {
            cycleBuilds();
        }, 1000 * cycleTime);
    }

    if(pickGamemode == GAMEMODE_UNLIMITED_POINTS) {
        // Give extra skill points
        loopOverHeroes(function(hero) {
            hero.netprops.m_iAbilityPoints += 25;
        });
    }

	if(pickGamemode == GAMEMODE_TEAM_CAPTINS_MODE) {
		var pools = {};

		// Build the pools for each team
		pools[dota.TEAM_RADIANT] = buildTeamPools(dota.TEAM_RADIANT);
		pools[dota.TEAM_DIRE] = buildTeamPools(dota.TEAM_DIRE);

		// Grab build
		var builds = {};

		if(pools[dota.TEAM_RADIANT].length > 0) {
			var n = ~~(Math.random() * pools[dota.TEAM_RADIANT].length);
			var b = pools[dota.TEAM_RADIANT][n];
			builds[dota.TEAM_RADIANT] = b.skills;

			server.printToChatAll('{pink}{1}{lgreen}\'s build was chosen for the radiant.'.format(b.name));
		}

		if(pools[dota.TEAM_DIRE].length > 0) {
			var n = ~~(Math.random() * pools[dota.TEAM_DIRE].length);
			var b = pools[dota.TEAM_DIRE][n];
			builds[dota.TEAM_DIRE] = b.skills;

			server.printToChatAll('{pink}{1}{lgreen}\'s build was chosen for the dire.'.format(b.name));
		}

		// Assign a build to each hero
		loopOverHeroes(function(hero) {
			// Grab this heroes build
			var build = builds[hero.netprops.m_iTeamNum];

			// Apply Build
			for(var i=0; i<build.length; i++) {
				cleanupAbility(hero, hero.netprops.m_hAbilities[i]);
				skillIntoSlot(hero, build[i], i);
			}
		});

		playSoundToall(SOUND_CASINO);
	}

	if(pickGamemode == GAMEMODE_REVERSE_CAPTINS_MODE) {
		var pools = {};

		// Build the pools for each team
		pools[dota.TEAM_RADIANT] = buildTeamPools(dota.TEAM_DIRE);
		pools[dota.TEAM_DIRE] = buildTeamPools(dota.TEAM_RADIANT);

		// Grab build
		var builds = {};

		if(pools[dota.TEAM_RADIANT].length > 0) {
			var n = ~~(Math.random() * pools[dota.TEAM_RADIANT].length);
			var b = pools[dota.TEAM_RADIANT][n];
			builds[dota.TEAM_RADIANT] = b.skills;

			server.printToChatAll('{pink}{1}{lgreen}\'s build was chosen for the radiant.'.format(b.name));
		}

		if(pools[dota.TEAM_DIRE].length > 0) {
			var n = ~~(Math.random() * pools[dota.TEAM_DIRE].length);
			var b = pools[dota.TEAM_DIRE][n];
			builds[dota.TEAM_DIRE] = b.skills;

			server.printToChatAll('{pink}{1}{lgreen}\'s build was chosen for the dire.'.format(b.name));
		}

		// Assign a build to each hero
		loopOverHeroes(function(hero) {
			// Grab this heroes build
			var build = builds[hero.netprops.m_iTeamNum];

			// Apply Build
			for(var i=0; i<build.length; i++) {
				cleanupAbility(hero, hero.netprops.m_hAbilities[i]);
				skillIntoSlot(hero, build[i], i);
			}
		});

		playSoundToall(SOUND_CASINO);
	}

	loopOverHeroes(function(hero) {
		// Don't touch invokers
		if(checkInvoker(hero)) return;

		// Give attribute_bonus
		for(var i=0; i<16; i++) {
			if(hero.netprops.m_hAbilities[i] == null) {
				skillIntoSlot(hero, 'attribute_bonus', i);
				break;
			}
		}

		// Find skills that depend on other skills
		for(var i=0; i<16; i++) {
			// Check if there is a skill in this slot
			var ab = hero.netprops.m_hAbilities[i];
			if(!ab || !ab.isValid()) continue;

			// Grab the name of the skill
			var name = ab.getClassname();

			// Check if it has any sub abiltiies
			var deps = abDeps[name];
			if(!deps || !deps.SubAbilities) continue;

			// Load extra skills
			for(var j=0; j<deps.SubAbilities.length; j++) {
				// Find a slot for it
				for(var k=i+1; k<16; k++) {
					// Check if slot is empty
					if(hero.netprops.m_hAbilities[k] == null) {
						skillIntoSlot(hero, deps.SubAbilities[j], k);
						break;
					}
				}
			}
		}

		// Grab client
		var client = dota.findClientByPlayerID(hero.netprops.m_iPlayerID);
		if(client && client.isInGame()) {
			// Save the build into slot 0 (last build slot)
			saveBuild(client, hero, 0);
		}
	});
}

// Attempt to put a skill into a slot
function cmdSkill(client, args) {
	if(pickState != STATE_PICKING) {
		client.print('You can only pick skills during the picking phase. Try {red}-find');
		return;
	}

	var slot;

	if(args.length == 2) {
		// Check if they parsed a slot number
		var slotTest = args[args.length-1];

		if(!isNaN(slotTest)) {
			// They did, store it
			slot = parseInt(slotTest);

			// Remove last argument
			args = args.slice(0, args.length-1);
		}
	}

	for(var i=0; i<args.length; i++) {
		// Need to find skills with ONLY this sub text
		var needle = args[i];

		// Check if we're searching by name, or index
		if(isNaN(needle)) {
			// Name

			// Sort the skills list
			sortSkills(skillList, [needle]);

			var a0 = quickDist(skillList[0], needle);
			var a1 = quickDist(skillList[1], needle);

			if(a0 < a1) {
				// Select the skill

				if(args.length > 1) {
					selectSkill(client, skillList[0], i+1);
				} else {
					selectSkill(client, skillList[0], slot);
				}
			} else {
				// List some generic options
				var str = '{pink}{1}{lgreen} is too generic: '.format(needle);
				client.print('{1}{2}'.format(str, genericList(skillList, needle, str.length+getPrefix().length)));
			}
		} else {
			// Index

			// Check if we know of this skillID
			if(abIDs[needle]) {
				// Yes
				selectSkill(client, abIDs[needle], slot);
			} else {
				// Dont know it
				client.print('Failed to find skill with ID {pink}{1}'.format(needle));
			}
		}
	}
}

// Add alias for skills
console.addClientCommand('skill', cmdSkill);
console.addClientCommand('skills', cmdSkill);
console.addClientCommand('pick', cmdSkill);
console.addClientCommand('select', cmdSkill);

// Attempt to put a skill into a slot
function cmdSkillTower(client, args) {
	// Check if custom bear skills are allowed
	if(!allowCustomTowerSkills) {
		client.print('Custom tower skills are banned.');
		return;
	}

	if(pickState != STATE_PICKING) {
		client.print('You can only pick skills during the picking phase. Try {red}-find');
		return;
	}

	if(args.length == 0) {
		client.print('{red}-tower {pink} [skill_name] [slot] {lgreen} to pick skills for your towers.');
		return;
	}

	var slot;

	if(args.length == 2) {
		// Check if they parsed a slot number
		var slotTest = args[args.length-1];

		if(!isNaN(slotTest)) {
			// They did, store it
			slot = parseInt(slotTest);

			// Remove last argument
			args = args.slice(0, args.length-1);
		}
	}

	if(slot == null) {
		client.print('You need to parse a slot number to use {red}-tower');
		return;
	}

	for(var i=0; i<args.length; i++) {
		// Need to find skills with ONLY this sub text
		var needle = args[i];

		// Check if we're searching by name, or index
		if(isNaN(needle)) {
			// Name

			// Sort the skills list
			sortSkills(skillList, [needle]);

			var a0 = quickDist(skillList[0], needle);
			var a1 = quickDist(skillList[1], needle);

			if(a0 < a1) {
				// Select the skill

				if(args.length > 1) {
					selectTowerSkill(client, skillList[0], i+1);
				} else {
					selectTowerSkill(client, skillList[0], slot);
				}
			} else {
				// List some generic options
				var str = '{pink}{1}{lgreen} is too generic: '.format(needle);
				client.print('{1}{2}'.format(str, genericList(skillList, needle, str.length+getPrefix().length)));
			}
		} else {
			// Index

			// Check if we know of this skillID
			if(abIDs[needle]) {
				// Yes
				selectTowerSkill(client, abIDs[needle], slot);
			} else {
				// Dont know it
				client.print('Failed to find skill with ID {pink}{1}'.format(needle));
			}
		}
	}
}

// Tower skill selector
console.addClientCommand('tower', cmdSkillTower);

// Attempt to put a skill into a slot
function cmdSkillBear(client, args) {
	// Check if custom bear skills are allowed
	if(!allowCustomBearSkills) {
		client.print('Custom bear skills are banned.');
		return;
	}

	// Printing of bear skills
	if(args.length == 0) {
		var playerID = client.netprops.m_iPlayerID;

		if(customBearSkills[playerID]) {
			for(var i=0; i<customBearSkills[playerID].length; i++) {
				var skill = customBearSkills[playerID][i];

				if(skill != '') {
					client.print('{red}[{1}] {pink}{2}'.format(i+1, skill));
				}
			}
		} else {
			client.print('You haven\'t selected any bear skills yet.');
		}

		return;
	}

	if(pickState != STATE_PICKING) {
		client.print('You can only pick skills during the picking phase. Try {red}-find');
		return;
	}

	var slot;

	if(args.length == 2) {
		// Check if they parsed a slot number
		var slotTest = args[args.length-1];

		if(!isNaN(slotTest)) {
			// They did, store it
			slot = parseInt(slotTest);

			// Remove last argument
			args = args.slice(0, args.length-1);
		}
	}

	if(slot == null) {
		client.print('You need to parse a slot number to use {red}-bear');
		return;
	}

	for(var i=0; i<args.length; i++) {
		// Need to find skills with ONLY this sub text
		var needle = args[i];

		// Check if we're searching by name, or index
		if(isNaN(needle)) {
			// Name

			// Sort the skills list
			sortSkills(skillList, [needle]);

			var a0 = quickDist(skillList[0], needle);
			var a1 = quickDist(skillList[1], needle);

			if(a0 < a1) {
				// Select the skill

				if(args.length > 1) {
					selectBearSkill(client, skillList[0], i+1);
				} else {
					selectBearSkill(client, skillList[0], slot);
				}
			} else {
				// List some generic options
				var str = '{pink}{1}{lgreen} is too generic: '.format(needle);
				client.print('{1}{2}'.format(str, genericList(skillList, needle, str.length+getPrefix().length)));
			}
		} else {
			// Index

			// Check if we know of this skillID
			if(abIDs[needle]) {
				// Yes
				selectBearSkill(client, abIDs[needle], slot);
			} else {
				// Dont know it
				client.print('Failed to find skill with ID {pink}{1}'.format(needle));
			}
		}
	}
}

// Bear skill selector
console.addClientCommand('bear', cmdSkillBear);

// Store the total numbers of bans made by a user
var totalBans = {};

// Attempt to ban a skill
function cmdBan(client, args) {
	if(pickState != STATE_BANNING) {
		client.print('You can only ban skills during the banning phase. Try {red}-find');
		return;
	}

	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Grab the client's name
	var clientName = client.getName();

	// Make sure this user has a record of their bans
	if(totalBans[playerID] == null) totalBans[playerID] = 0;

	for(var i=0; i<args.length; i++) {
		// Check the ban limit
		if(totalBans[playerID] >= maxBans) {
			client.print('You\'ve already banned the max number of skills {red}{1}/{1}'.format(maxBans));
			return;
		}

		// Need to find skills with ONLY this sub text
		var needle = args[i];

		// Check if we're searching by name, or index
		if(isNaN(needle)) {
			// Name

			// Sort the skills list
			sortSkills(skillList, [needle]);

			var a0 = quickDist(skillList[0], needle);
			var a1 = quickDist(skillList[1], needle);

			if(a0 < a1) {
				// Ban the skill
				var name = skillList[0];
				if(banSkill(client, name)) {
					totalBans[playerID]++;

					// Check if it should be a silent ban
					if(doSilentBan) {
						client.print('{pink}{1} {lgreen}was banned. You\'ve banned {red}{2}/{3} {lgreen}skills.'.format(name, totalBans[playerID], maxBans));
					} else {
						server.printToChatAll('{pink}{1} {lgreen}was banned by {pink}{2}{lgreen}.'.format(name, clientName));
						client.print('You\'ve banned {red}{1}/{2} {lgreen}skills.'.format(totalBans[playerID], maxBans));
					}
				} else {
					client.print('{pink}{1} {lgreen}is already banned.'.format(name));
				}
			} else {
				// List some generic options
				var str = '{pink}{1}{lgreen} is too generic: '.format(needle);
				client.print('{1}{2}'.format(str, genericList(skillList, needle, str.length+getPrefix().length)));
			}
		} else {
			// Index

			// Check if we know of this skillID
			if(abIDs[needle]) {
				// Yes
				var name = abIDs[needle];
				if(banSkill(client, name)) {
					totalBans[playerID]++;

					// Check if it should be a silent ban
					if(doSilentBan) {
						client.print('{pink}{1} {lgreen}was banned. You\'ve banned {red}{2}/{3} {lgreen}skills.'.format(name, totalBans[playerID], maxBans));
					} else {
						server.printToChatAll('{pink}{1} {lgreen}was banned by {pink}{2}{lgreen}.'.format(name, clientName));
						client.print('You\'ve banned {red}{1}/{2} {lgreen}skills.'.format(totalBans[playerID], maxBans));
					}
				} else {
					client.print('{pink}{1} {lgreen}is already banned.'.format(name));
				}
			} else {
				// Dont know it
				client.print('Failed to find skill with ID {pink}{1}'.format(needle));
			}
		}
	}
}

console.addClientCommand('banskill', cmdBan);
console.addClientCommand('ban', cmdBan);
console.addClientCommand('bans', cmdBan);
console.addClientCommand('block', cmdBan);

console.addClientCommand('swap', function(client, args) {
	if(pickState != STATE_PICKING) {
		client.print('You can only swap skills during the picking phase. Try {red}-find');
		return;
	}

	if(!client || !client.isInGame()) return;

	var from = parseInt(args[0] || 0);
	var to = parseInt(args[1] || 0);

	if(from < 1 || from > maxSlots || to < 1 || to > maxSlots) {
		client.print('You need to enter two slot numbers, from 1 - {1}'.format(maxSlots));
		return;
	}

	// Grab the hero
	var hero = client.netprops.m_hAssignedHero;
	if(!hero || !hero.isValid()) {
		client.print('You have no valid heroes. You must spawn first!');
		return;
	}

	var ab1 = hero.netprops.m_hAbilities[from-1];
	var ab2 = hero.netprops.m_hAbilities[to-1];

	if(!ab1 || !ab2) {
		client.print('Both slots must have at least one skill in them.');
		return;
	}

	var n1 = ab1.getClassname();
	var n2 = ab2.getClassname();

	// Cleanup
	cleanupAbility(hero, ab1);
	cleanupAbility(hero, ab2);

	// Give the abilities
	skillIntoSlot(hero, n1, to-1);
	skillIntoSlot(hero, n2, from-1);

	// Tell the client
	client.print('Slots {pink}{1}{lgreen} and {pink}{2}{lgreen} were swapped.'.format(from, to));
	dota.sendAudio(client, false, SOUND_GET_SKILL);
});

// Makes a generic list of skills
function genericList(arr, needle, usedLen) {
	var lenLeft = 128 - usedLen;
	var similarList = [];
	var compLen = quickDist(arr[0], needle);

	var str = '{red}[{1}] {pink}{2}'.format(abSkillIDs[arr[0]], arr[0]);

	for(i=1; i<arr.length; i++) {
		if(compLen == quickDist(arr[i], needle)) {
			var newStr = '{lgreen}, {red}[{1}] {pink}{2}'.format(abSkillIDs[arr[i]], arr[i]);

			if(lenLeft-str.length-newStr.length > 0) {
				str += newStr;
			} else {
				str += ('{lgreen}...'.format());
				break;
			}
		}
	}

	return str;
}

// Stores what this client last sorted by
var lastSort = {};

// Finds skills based on args
function cmdFindSkills(client, args) {
	// Grab playerID
	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Sort the skills list
	sortSkills(skillList, args);

	// Store the sort
	lastSort[playerID] = args;

	// Print the first page
	printPage(client, 1);
}

// Prints a page based on skillList
function printPage(client, page) {
	// Grab playerID
	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Grab the query they used to get these pages
	var query = lastSort[playerID];
	var str = '{red}{1}'.format(query.join(', '));

	// Add page number
	if(query.length > 0) {
		str += '{red} - Page {1}'.format(page);
	} else {
		str += '{red} Page {1}'.format(page);
	}

	// Build an amount of dashs
	var n = (70-str.length)/2;
	var dashes = '';
	if(n > 0) {
		dashes = new Array(Math.floor(n)).join('-');
	}

	// Print to client
	client.printc('{lgreen}{1} {2}{lgreen} {1}'.format(dashes, str));

	// The skill we are currently looking at
	var currentSkill = 0;

	// Build stuff, page by page
	outerLoop:
	for(var currentPage=1; currentPage<=page; currentPage++) {
		// 4 sections for this page
		for(var i=0; i<4; i++) {
			var skill = skillList[currentSkill];
			if(!skill) break outerLoop;

			// Move onto next skill
			currentSkill++;

			var str;

			// Check if this skill is banned
			if(checkBans(null, null, skill, -1)) {
				str = '{red} [{1}] {red}{2}'.format(abSkillIDs[skill], skill);
			} else {
				str = '{red} [{1}] {pink}{2}'.format(abSkillIDs[skill], skill);
			}

			while(true) {
				var skill = skillList[currentSkill];
				if(!skill) break outerLoop;

				// Build the next skill in this string
				var newStr;

				// Check if this skill is banned
				if(checkBans(null, null, skill, -1)) {
					newStr = '{lgreen}, {red}[{1}] {red}{2}'.format(abSkillIDs[skill], skill);
				} else {
					newStr = '{lgreen}, {red}[{1}] {pink}{2}'.format(abSkillIDs[skill], skill);
				}

				if(str.length+newStr.length > 70) {
					break;
				}

				// Append the string
				str += newStr;

				// Move onto next skill
				currentSkill++;
			}

			// Check if this is the page we want
			if(currentPage == page) {
				// Finally print something
				client.printc(str);
			}
		}
	}

	client.printc('{lgreen}Type {red}-page {pink}[page number] {lgreen}to view more results.');
}

// Add alias for searching
console.addClientCommand('find', cmdFindSkills);
console.addClientCommand('search', cmdFindSkills);

console.addClientCommand('save', function(client, args) {
	if(!client || !client.isInGame()) return;

	// Grab the hero
	var hero = client.netprops.m_hAssignedHero;
	if(!hero || !hero.isValid()) {
		client.print('You have no valid heroes. You must spawn first!');
		return;
	}

	if(args.length <= 0 || isNaN(args[0])) {
		client.print('You have to enter a slot number {pink}1 - {1}'.format(saveSlots));
		return;
	}

	var slotNumber = parseInt(args[0]);
	if(slotNumber < 1 || slotNumber > saveSlots) {
		client.print('Only the slots {pink}1 - {1} {lgreen} are valid'.format(saveSlots));
		return;
	}

	// Save the build
	if(saveBuild(client, hero, slotNumber)) {
		// Tell the client
		client.print('Build was saved into slot {pink}{1}'.format(slotNumber));
	}
});

function saveBuild(client, hero, slot) {
	// Validate slot
	if(slot < 0 || slot > 9) return false;

	// Grab steamID
	var sID = client.getAuthString();

	if(!saveData[sID] || saveData[sID] == '' || saveData[sID].length <= 0) {
		client.print('You have no save data! (A)');
		return false;
	}

	// Encode the current build
	var build = encodeBuild(hero);

	var left = saveData[sID].substring(0, 2+12*slot);
	var right = saveData[sID].substring(2+12*(slot+1), saveData[sID].length);

	// Update the save data
	saveData[sID] = '{1}{2}{3}'.format(left, build, right);

	// Save the data
	doSave(client);

	return true;
}

function loadBuild(client, hero, slot) {
	// Validate slot
	if(slot < 0 || slot > 9) return false;

	// Grab steamID
	var sID = client.getAuthString();

	if(!saveData[sID] || saveData[sID] == '' || saveData[sID].length <= 0) {
		client.print('You have no save data! (B)');
		return false;
	}

	// Grab the specified build
	var build = saveData[sID].substring(12*slot+2, 12*(slot+1)+2);

	// Grab the skill in their first slot
	var firstSlot = decodeNumber(build.substring(0, 2));

	// Check if there is a skill in this slot
	if(firstSlot == 0) {
		if(slot > 0) {
			client.print('There isn\'t a valid build in slot {pink}{1}'.format(slot));
		} else {
			client.print('We couldn\'t find the last build you used.');
		}
		return false;
	} else {
		// Cleanup old skills
		for(var i=0; i<16; i++) {
			// Grab ability
			var ab = hero.netprops.m_hAbilities[i];
			if(ab && ab.isValid()) {
				// Clean it up
				cleanupAbility(hero, ab);
			}
		}

		// Load the build
		for(var i=0; i<maxSlots; i++) {
			// Grab the skill number
			var skillNum = decodeNumber(build.substring(i*2, i*2+2));

			// Grab the name of the skill
			var name = abIDs[skillNum];

			// Check if we are allowed to use this skill
			if(allowedToUse(client, hero, name, i+1)) {
				// Load dependencies
				loadDeps(name);

				// Give the new ability
				skillIntoSlot(hero, name, i);
			}
		}
	}

	return true;
}

console.addClientCommand('last', function(client, args) {
	// Make sure it's in the picking state
	if(pickState != STATE_PICKING) {
		client.print('You can only pick skills during the picking phase. Try {red}-find');
		return;
	}

	// Validate client
	if(!client || !client.isInGame()) return;

	// Grab the hero
	var hero = client.netprops.m_hAssignedHero;
	if(!hero || !hero.isValid()) {
		client.print('You have no valid heroes. You must spawn first!');
		return;
	}

	// Attempt to load the build in the last slot
	if(loadBuild(client, hero, 0)) {
		client.print('Your last build was loaded.');
	}
});

console.addClientCommand('ready', function(client, args) {
	// Make sure we are in the picking phase
	if(pickState != STATE_PICKING) {
		client.print('You can only {red}-ready {lgreen}during the picking phase.');
		return;
	}

	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Should we tell all players?
	var tellAll = false;
	if(!playerReady[playerID]) {
		tellAll = true;
	}

	// Set this player to ready
	playerReady[playerID] = true;

	// Check how many people are ready

	var totalClients = 0;
	var totalReady = 0;

	for(var i=0; i<server.clients.length; i++) {
		var c = server.clients[i];
		if(!c || !c.isInGame()) continue;

		var pID = c.netprops.m_iPlayerID;
		if(pID < 0 || pID > 9) continue;

		// Found a valid client
		totalClients++;

		if(playerReady[pID]) {
			totalReady++;
		}
	}

	// Check if everyone is ready
	if(totalReady >= totalClients) {
		// Make the game start
		beginGame();

		// Tell everyone the game will now start
		for(var i=0; i<server.clients.length; i++) {
			var c = server.clients[i];
			if(!c || !c.isInGame()) continue;

			c.print('Everyone is now {red}-ready{lgreen}, the game is now starting...');
		}
	} else {
		// Check if we should tell everyone
		if(tellAll) {
			// Build the message we are going to print
			var toPrint = '{pink}{1} {lgreen}is now {red}-ready{lgreen}, {pink}{2}/{3}{lgreen} players are {red}-ready'.format(client.getName(), totalReady, totalClients);

			// Send it to everyone except our client
			for(var i=0; i<server.clients.length; i++) {
				var c = server.clients[i];
				if(!c || !c.isInGame() || client == c) continue;

				c.print(toPrint);
			}
		}

		// Tell our client the stats
		client.printToChat('{pink}{1}/{2}{lgreen} players are {red}-ready'.format(totalReady, totalClients));
	}
});

console.addClientCommand('load', function(client, args) {
	// Make sure it's in the picking state
	if(pickState != STATE_PICKING) {
		client.print('You can only pick skills during the picking phase. Try {red}-find');
		return;
	}

	// Validate client
	if(!client || !client.isInGame()) return;

	// Grab the hero
	var hero = client.netprops.m_hAssignedHero;
	if(!hero || !hero.isValid()) {
		client.print('You have no valid heroes. You must spawn first!');
		return;
	}

	// Validate input
	if(args.length <= 0 || isNaN(args[0])) {
		client.print('You have to enter a slot number {pink}1 - {1}'.format(saveSlots));
		return;
	}

	// Grab slot number
	var slotNumber = parseInt(args[0]);
	if(slotNumber < 1 || slotNumber > saveSlots) {
		client.print('Only the slots {pink}1 - {1} {lgreen} are valid'.format(saveSlots));
		return;
	}

	// Load the build
	if(loadBuild(client, hero, slotNumber)) {
		// Tell the client
		client.print('Done loading build from slot {pink}{1}'.format(slotNumber));
	}
});

// View other pages of the search
console.addClientCommand('page', function(client, args) {
	// Grab playerID
	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Grab page number
	var page = parseInt(args[0] || 0);
	if(page <= 0 || isNaN(page)) page = 1;

	// Default to blank search if none exists so far
	if(!lastSort[playerID]) lastSort[playerID] = [];

	// Sort the skills list
	sortSkills(skillList, lastSort[playerID]);

	// Print the first page
	printPage(client, page);
});


// Stores the skill a client has in their -slot
var skillStore = {};

console.addClientCommand('slot', function(client, args) {
	// Grab playerID
	var playerID = client.netprops.m_iPlayerID;
	if(playerID < 0 || playerID > 9) return;

	// Make sure they have something stored
	if(!skillStore[playerID]) {
		client.print('You can\'t use this yet.');
		return;
	}

	// Attempt to select the skill
	selectSkill(client, skillStore[playerID], parseInt(args[0]));
});

function allowedToUse(client, hero, name, slot) {
	var ult = false;

	if(abList.Ults.indexOf(name) != -1) {
		ult = true;
	} else if(abList.Abs.indexOf(name) == -1) {
		if(abList.NPC.indexOf(name) == -1 || !allowNPCAbs) {
			if(abList.Summon.indexOf(name) == -1 || !allowSummonAbs) {
				if(abList.Greevling.indexOf(name) == -1 || !allowGreevlingAbs) {
					if(client) client.print('You are not allowed to use {pink}{1}'.format(name));
					return false;
				}
			}
		}
	}

	if(!slot || isNaN(slot) || slot < 1 || slot > maxSlots) {
		// Grab playerID
		var playerID = hero.netprops.m_iPlayerID;
		if(playerID < 0 || playerID > 9) {
			if(client) client.print('You don\'t have a valid playerID.');
			return false;
		}

		// Store the skill
		skillStore[playerID] = name;

		// Tell the client how to put it into a slot
		if(client) client.print('Type {red}-slot {pink}[1-{1}]{lgreen} to pick a slot for {pink}{2}'.format(maxSlots, name));

		// Stop
		return false;
	}

	// Make a logical slot, instead of friendly slot
	var dotaSlot = slot-1;

	// Check if they already have this skill
	for(var i=0; i<16; i++) {
		// Grab the ability in this slot
		var ab = hero.netprops.m_hAbilities[i];
		if(!ab || !ab.isValid()) continue;

		// Check if they already have this skill
		if(ab.getClassname() == name) {
			if(client) client.print('You already have {pink}{1}{lgreen}, try {red}-swap {pink} [slot from] [slot to]'.format(name));
			return false;
		}
	}

	// Check if we should stop stupid combos
	if(checkBans(client, hero, name, dotaSlot)) return false;

	// Check if it's an ult or regular skill
	if(ult) {
		var totalUlts = 0;

		for(var i=0; i<maxSlots; i++) {
			// No need to consider the skill we are replacing
			if(dotaSlot == i) continue;

			// Grab the ability in this slot
			var ab = hero.netprops.m_hAbilities[i];
			if(!ab || !ab.isValid()) continue;

			// Check if it's an ult
			if(abList.Ults.indexOf(ab.getClassname()) != -1) {
				totalUlts += 1;
			}
		}

		// Check if we've hit the ult limit
		if(totalUlts >= maxUlts) {
			if(client) client.print('You already have {red}{1}/{2}{lgreen} ults, you can\'t add {pink}{3}'.format(totalUlts, maxUlts, name));
			return false;
		}
	} else {
		var totalSkills = 0;

		for(var i=0; i<maxSlots; i++) {
			// No need to consider the skill we are replacing
			if(dotaSlot == i) continue;

			// Grab the ability in this slot
			var ab = hero.netprops.m_hAbilities[i];
			if(!ab || !ab.isValid()) continue;

			// Check if it's an ult
			if(abList.Ults.indexOf(ab.getClassname()) == -1) {
				totalSkills += 1;
			}
		}

		// Check if we've hit the ult limit
		if(totalSkills >= maxSkills) {
			if(client) client.print('You already have {red}{1}/{2}{lgreen} regular skills, you can\'t add {pink}{3}'.format(totalSkills, maxSkills, name));
			return false;
		}
	}

	return true;
}

function selectSkill(client, name, slot) {
	// Grab the hero
	var hero = client.netprops.m_hAssignedHero;
	if(!hero || !hero.isValid()) {
		client.print('You have no valid heroes. You must spawn first!');
		return;
	}

	// Make sure something was parsed
	if(!name) return;

	// Check if we are allowed to use this skill
	if(!allowedToUse(client, hero, name, slot)) return;

	// Skill warnings
	if(name == 'life_stealer_infest') {
		client.print('You need {pink}life_stealer_rage {lgreen}or you will get stuck when you infest.');
	}

	if(name == 'lone_druid_spirit_bear') {
		client.print('Try {red}-bear {pink}[skill_name] [slot] {lgreen} to pick skills for your bear.');
	}

	// Make a logical slot, instead of friendly slot
	var dotaSlot = slot-1;

	// Cleanup the slot
	cleanupAbility(hero, hero.netprops.m_hAbilities[dotaSlot]);

	// Load dependencies
	loadDeps(name);

	// Put a skill into a slot
	skillIntoSlot(hero, name, dotaSlot);

	// Tell the client
	client.print('{pink}{1}{lgreen} was added to slot {pink}{2}'.format(name, slot));
	dota.sendAudio(client, false, SOUND_GET_SKILL);
}

function selectBearSkill(client, name, slot) {
	var playerID = client.netprops.m_iPlayerID;
	if(playerID == null || playerID == -1) return;

	// Make sure something was parsed
	if(!name) return;

	// Validate slots
	if(slot < 1 || slot > 4) {
		client.print('Only the slots 1 - 4 are valid.');
		return;
	}

	// Bear isn't allowed this skill
	if(name == 'troll_warlord_berserkers_rage') {
		client.print('You can\'t use {pink}{1} {lgreen}on the bear'.format(name));
		return;
	}

	// Bear can't use ults
	if(abList.Ults.indexOf(name) != -1) {
		client.print('You can\'t use {pink}{1} {lgreen}on the bear (no ults)'.format(name));
		return;
	}

	// Make a logical slot, instead of friendly slot
	var dotaSlot = slot-1;

	// Check if we are allowed to use this skill
	if(checkBans(client, null, name, dotaSlot)) return;

	// Make sure they have an index for bear skills
	if(!customBearSkills[playerID]) {
		customBearSkills[playerID] = [];

		for(var i=0; i<4; i++) {
			customBearSkills[playerID].push('');
		}
	}

	// Should we ban stupid combos?
	if(banStupidCombos) {

		// Banned combinations of skills
		for (var i=0; i<bans.BannedCombinations.length; i++) {
			if (bans.BannedCombinations[i].indexOf(name) != -1) {
				for (var j=0; j<customBearSkills[playerID].length; j++) {
					// If we are replacing it, ignore it
					if(j == dotaSlot) continue;

					var searchName = customBearSkills[playerID][j];
					if(bans.BannedCombinations[i].indexOf(searchName) != -1) {
						if(client) client.print('You can\'t use {pink}{1}{lgreen} and {pink}{2}{lgreen} together.'.format(name, searchName));
						return;
					}
				}
			}
		}
	}

	// Skill warnings
	if(name == 'life_stealer_infest') {
		client.print('You need {pink}life_stealer_rage {lgreen}or you will get stuck when you infest.');
	}

	// Store the bear skill
	customBearSkills[playerID][dotaSlot] = name;

	// Load dependencies
	loadDeps(name);

	// Tell the client
	client.print('{pink}{1}{lgreen} was added to bear slot {pink}{2}'.format(name, slot));
	dota.sendAudio(client, false, SOUND_GET_SKILL);
}

function selectTowerSkill(client, name, slot) {
	// Make sure something was parsed
	if(!name) return;

	// Validate slots
	if(slot < 1 || slot > 4) {
		client.print('Only the slots 1 - 4 are valid.');
		return;
	}

	// Check if we are allowed to use this skill
	if(checkBans(client, null, name, slot)) return;

	// Skill warnings
	if(name == 'life_stealer_infest') {
		client.print('You need {pink}life_stealer_rage {lgreen}or you will get stuck when you infest.');
	}

	// Grab client team
	var team = client.netprops.m_iTeamNum;

	// Workout control index
	var control = 0;
	for(var i=0; i<server.clients.length; i++) {
		// Grab a client
		var c = server.clients[i];
		if(!c || !c.isInGame()) continue;

		var playerID = c.netprops.m_iPlayerID;
		if(playerID == null || playerID == -1) continue;

		// Check if they are on the same team
		if(team == c.netprops.m_iTeamNum) {
			// Allow this client to controle it
			control += 1 << playerID;

			// Tell the other clients
			if(client != c) {
				c.print('{pink}{1}{lgreen} was added to tower slot {pink}{2} {lgreen}by {pink}{3}{lgreen}. Use {red}-tower {pink}[skill_name] [slot] {lgreen}to select skills for your towers.'.format(name, slot, client.getName()));
			}
		}
	}

	// Load dependencies
	loadDeps(name);

	var towers = game.findEntitiesByClassname('npc_dota_tower');
	for(var i=0;i<towers.length;++i) {
		var tower = towers[i];

		if(team == tower.netprops.m_iTeamNum) {
			var ab = tower.netprops.m_hAbilities[slot-1];
			if(ab) {
				cleanupAbility(tower, ab);
			}

			// Give the skill
			var skill = dota.createAbility(tower, name);

			var lvl = 4;
			if(abList.Ults.indexOf(name) != -1) lvl = 3;

			for(var l=0; l<lvl; l++) {
				dota.upgradeAbility(skill);
			}

			// Skill into slot
			dota.setAbilityByIndex(tower, skill, slot-1);

			// Give unit control
			tower.netprops.m_iIsControllableByPlayer = control;
		}
	}

	// Tell the client
	client.print('{pink}{1}{lgreen} was added to tower slot {pink}{2}'.format(name, slot));
	dota.sendAudio(client, false, SOUND_GET_SKILL);
}

function banSkill(client, name) {
	// Check if skill is already in there
	if(!checkBans(null, null, name, null)) {
		// Nope, push it in
		bannedSkills.push(name);

		// Success
		return true;
	}

	// Failure
	return doSilentBan;
}

function skillIntoSlot(hero, name, slot, level) {
	// Check if this is a custom skill
	var cs = customSpells[name];
	if(cs) {
		// Give the new ability
		var skill = dota.createAbility(hero, cs.base);
		dota.setAbilityByIndex(hero, skill, slot);

		// Store custom values function if it exists
		if(cs.customValues) skill.customValues = cs.customValues;

		// Stop it from being stealable
		game.hookEnt(skill, dota.ENT_HOOK_IS_STEALABLE, function() {
			return false;
		});

		// Add the callback
		var callback = cs.callback;
		game.hookEnt(skill, dota.ENT_HOOK_ON_SPELL_START, function(ab) {
			// Run the callback if it exists
			if(callback) callback(ab);

			// Stop normal spell
			return false;
		});

		// Hook the skill's cooldown
		var cooldown = cs.cooldown || [0, 0, 0, 0];
		game.hookEnt(skill, dota.ENT_HOOK_GET_COOLDOWN, function(ab) {
			// Grab cooldown
			var cd = cooldown[ab.netprops.m_iLevel-1];

			// Validate cooldown
			if(cd == null) return 0;

			// It's ok, return it
			return cd;
		});

		// Hook the skill's mana cost
		var manacosts = cs.manacost || [0, 0, 0, 0];
		game.hookEnt(skill, dota.ENT_HOOK_GET_MANA_COST , function(ab) {
			// Grab manacost
			var mc = manacosts[ab.netprops.m_iLevel-1];

			// Validate cooldown
			if(mc == null) return 0;

			// It's ok, return it
			return mc;
		});

		if(cs.range) {
			var range = cs.range;
			game.hookEnt(skill, dota.ENT_HOOK_GET_CAST_RANGE, function(ab) {
				// Grab manacost
				var r = range[ab.netprops.m_iLevel-1];

				// Validate cooldown
				if(r == null) return 0;

				// It's ok, return it
				return r;
			});
		}

		// Check if a level was parsed
		if(level) {
			// Level it up
			for(var i=0; i<level; i++) {
				dota.upgradeAbility(skill);
			}
		}

		// Store that it is a custom spell
		skill.customSpellName = name;

		// Store which slot it's in
		skill.slot = slot;

		// Return the skill, so we can do stuff with it
		return skill;
	} else {
		// Give the new ability
		var skill = dota.createAbility(hero, name);
		dota.setAbilityByIndex(hero, skill, slot);

		// Some abilities need custom tags
		if(name == 'troll_warlord_berserkers_rage') {
			// Attempt to grab range of the hero
			var heroName = hero.getClassname()
			var map = heroesKV[heroName];
			if(map) {
				skill.attackRange = parseInt(map['AttackRange'] || 600);
			}
		}

		// Auto skill forged spirit melting strike
		if(name == 'forged_spirit_melting_strike' && !level) level = 1;

		// Check if a level was parsed
		if(level) {
			// Level it up
			for(var i=0; i<level; i++) {
				dota.upgradeAbility(skill);
			}
		}
	}
}

// Checks if a given player is invokered (and cant change skills)
function checkInvoker(hero) {
	// Stop invoker for getting other skills
	var playerID = hero.netprops.m_iPlayerID;
	if(playerID != null) {
		// Check if they are an invoker
		if(isInvoker[playerID] == 2 && hero.getClassname() == 'npc_dota_hero_invoker') return true;
	}

	return false;
}

function buildSingleDraftList(playerID) {
	// Create new array for this player
	singleDraftSkills[playerID] = [];

	var count = 0;
	while(count < 20) {
		var skill = skillList.random();

		// Check if they are allowed the skill AND don't already have it
		if(singleDraftSkills[playerID].indexOf(skill) == -1 && !checkBans(null, null, skill, -1)) {
			singleDraftSkills[playerID].push(skill);
			count++;
		}
	}
}

function singleDraftList(client, args) {
	if(pickGamemode == GAMEMODE_SINGLE_DRAFT) {
		var playerID = client.netprops.m_iPlayerID;

		if(!singleDraftSkills[playerID]) {
			buildSingleDraftList(playerID);
		}

		client.print('You are allowed to use:'.format());
		for(var i=0; i<singleDraftSkills[playerID].length; i++) {
			var skill = singleDraftSkills[playerID][i];
			client.print('{red}{1} {pink}{2}'.format(abSkillIDs[skill], skill));
		}
	} else {
		client.print('You can only use this in single draft mode.'.format());
	}
}

// Add command to cycle easily
console.addClientCommand('singledraft', singleDraftList);
console.addClientCommand('single', singleDraftList);
console.addClientCommand('draft', singleDraftList);

function checkBans(client, hero, name, slot) {
	if(name == '') return true;

	if(hero && checkInvoker(hero)) {
		if(client) client.print('You have used {red}-invoker {lgreen}and can\'t change your skills.');
		return true;
	}

	if(bannedSkills.indexOf(name) != -1) {
		if(client) client.print('{pink}{1}{lgreen} was banned during the banning phase.'.format(name));
		return true;
	}

	// Single Draft Stuff
	if(pickGamemode == GAMEMODE_SINGLE_DRAFT && hero) {
		var playerID = hero.netprops.m_iPlayerID;

		if(!singleDraftSkills[playerID]) {
			buildSingleDraftList(playerID);
		}

		if(singleDraftSkills[playerID].indexOf(name) == -1) {
			if(client) client.print('{pink}{1}{lgreen} is not in your single draft list. Type {red}-singledraft {lgreen}to view all the skills you are allowed to use.'.format(name));
			return true;
		}
	}

	if(banLastSkills && client && client.isInGame()) {
		// Grab steamID
		var sID = client.getAuthString();

		if(saveData[sID] && saveData[sID] != '' && saveData[sID].length > 0) {
			// Grab the specified build
			var build = saveData[sID].substring(2, 14);

			// Grab the skill in their first slot
			var firstSlot = decodeNumber(build.substring(0, 2));

			if(firstSlot != 0) {
				// Load the build
				for(var i=0; i<6; i++) {
					// Grab the skill number
					var skillNum = decodeNumber(build.substring(i*2, i*2+2));

					// Grab the name of the skill
					var skillName = abIDs[skillNum];

					if(name == skillName) {
						if(client) client.print('{pink}{1}{lgreen} is banned because you used it last round.'.format(name));
						return true;
					}
				}
			}
		}
	}

	if(!allowCustomSkills && customSpells[name]) {
		if(client) client.print('{pink}{1}{lgreen} is banned. (Custom Skills are Banned)'.format(name));
		return true;
	}

	if(banPassive && isSkillType(name, 'DOTA_ABILITY_BEHAVIOR_PASSIVE')) {
		if(client) client.print('{pink}{1}{lgreen} is banned. (All passives are Banned)'.format(name));
		return true;
	}

	if(banRearm && name == 'tinker_rearm') {
		if(client) client.print('{pink}{1}{lgreen} is banned.'.format(name));
		return true;
	}

	if(banChemRage && name == 'alchemist_chemical_rage') {
		if(client) client.print('{pink}{1}{lgreen} is banned.'.format(name));
		return true;
	}

	if(banInvis > 1 && bans.Invis.indexOf(name) != -1) {
		if(client) client.print('{pink}{1}{lgreen} is banned.'.format(name));
		return true;
	}

	if(banInvis > 0 && bans.PermaInvis.indexOf(name) != -1) {
		if(client) client.print('{pink}{1}{lgreen} is banned.'.format(name));
		return true;
	}

	// These skills are banned no matter what
	if(bans.AlwaysBanned.indexOf(name) != -1) {
		if(client) client.print('{pink}{1}{lgreen} is banned.'.format(name));
		return true;
	}

	// Unqiue Skill List
	if(banUniqueSkills > 0) {
		// Grab all heroes
		var heroes = game.findEntitiesByClassname('npc_dota_hero_*');

		// Loop over heroes
		for(var hh=0; hh<heroes.length; hh++) {
			// Grab a hero
			var heroSub = heroes[hh];

			// Validate hero
			if(!heroSub || !heroSub.isValid()) continue;

			// No illusions
			if(dota.hasModifier(heroSub, 'modifier_illusion')) continue;

			// Make sure they have skills
			if(!heroSub.netprops || !heroSub.netprops.m_hAbilities) continue;

			// Team Unique Skills
			if(banUniqueSkills == 1 && hero && hero.netprops.m_iTeamNum != heroSub.netprops.m_iTeamNum) continue;

			// Check all skills
			for(var i=0; i<16; i++) {
				// Grab ability
				var ab = heroSub.netprops.m_hAbilities[i];

				// Validate ability
				if(ab && ab.isValid()) {
					if(name == ab.getClassname()) {
						if(client) client.print('{pink}{1}{lgreen} has been taken!'.format(name));
						return true;
					}
				}
			}
		}
	}

	// Should we ban stupid combos?
	if(banStupidCombos) {
		// Only check combos if a hero was parsed
		if(hero) {
			// Banned combinations of skills
			for (var i=0; i<bans.BannedCombinations.length; i++) {
				if (bans.BannedCombinations[i].indexOf(name) != -1) {
					for (var j=0; j<16; j++) {
						// If we are replacing it, ignore it
						if(j == slot) continue;

						var ab = hero.netprops.m_hAbilities[j];
						if(!ab || !ab.isValid()) continue;

						var searchName = ab.getClassname();
						if(bans.BannedCombinations[i].indexOf(searchName) != -1) {
							if(client) client.print('You can\'t use {pink}{1}{lgreen} and {pink}{2}{lgreen} together.'.format(name, searchName));
							return true;
						}
					}
				}
			}
		}

		// Trolly skills that are banned
		if(bans.Bans.indexOf(name) != -1) {
			if(client) client.print('{pink}{1}{lgreen} is banned.'.format(name));
			return true;
		}
	}

	if(hero) {
		// Grab attack data
		var attackType = attackData[hero.getClassname()];

		// Banned ranged/melee skills
		if(attackType) {
			// Split it into two fields
			attackType = attackType.split(' ');

			if(attackType.length == 2) {
				for (var i = 0; i<bans.AttackBans.length; i++) {
					if (name === bans.AttackBans[i][0]) {
						if (bans.AttackBans[i][1] !== attackType[0]) {
							if(bans.AttackBans[i][1] == 0) {
								if(client) client.print('{pink}{1}{lgreen} can only be used on melee heroes.'.format(name));
								return true;
							} else {
								if(client) client.print('{pink}{1}{lgreen} can only be used on ranged heroes.'.format(name));
								return true;
							}
						}
						if (bans.AttackBans[i][2] < attackType[1]) {
							if(client) client.print('Only heroes with at least {red}{1}{lgreen} range can use {pink}{2}'.format(bans.AttackBans[i][2], name));
							return true;
						}
					}
				}
			}
		}

		// Lock certain skills to certain heroes
		for(var i=0; i<bans.LockToHero.length; i++) {
			if(bans.LockToHero[i][0] == name && bans.LockToHero[i][1] != hero.getClassname()) {
				if(client) client.print('{pink}{1}{lgreen} can only be used on {pink}{2}'.format(name, bans.LockToHero[i][1]));
				return true;
			}
		}
	}

	// Slot based bans
	if(maxSlots > 4 && name == 'doom_bringer_devour') {
		if(client) client.print('{pink}{1}{lgreen} can only be used in 4 slot mode.'.format(name));
		return true;
	}

	return false;
}

// Check's if a skill is a certain type
function isSkillType(name, type) {
	// If it's a custom spell, grab it's base
	if(customSpells[name]) {
		name = customSpells[name].base;
	}

	var info = abInfo[name];
	if(!info) return true;

	// Check if it matches the type, or has no types
	if(!info.AbilityBehavior || info.AbilityBehavior.indexOf(type) != -1) return true;

	// Failure
	return false;
}

function friendlyTimeToSeconds(input) {
	// Split into two parts
    var parts = input.split(':');

	// Grab minutes and seconds
    var minutes = parseInt(parts[0]);
    var seconds = parseInt(parts[1]);

	// Return seconds
    return (minutes * 60 + seconds);
}

// Print a nicely formatted message to a client
Client.prototype.print = function(msg) {
	// Have to stack twice otherwise it wont work properly >_>
	this.printToChat('{1}{2}'.format(getPrefix(), msg).format());
}

// Print a nicely formatted message to a client
Client.prototype.printc = function(msg) {
	// Have to stack twice otherwise it wont work properly >_>
	this.printToChat(msg.format().format());
}

// The prefix to attach onto messages
var prefix = '{red}[PYS]{lgreen} '.format();
function getPrefix() {
	return prefix;
}

var codeAnder = (1+2+4+8+16+32);
function encodeNumber(num) {
	// Workout the bits we want to store
	var lower = ((num & codeAnder) << 1) + 1;
	var upper = (((num >> 6) & codeAnder) << 1) + 1;

	// Ensure we only have 8 bits of data in each
	lower &= 0xFF;
	upper &= 0xFF;

	return '{1}{2}'.format(String.fromCharCode(upper), String.fromCharCode(lower));
}

function decodeNumber(str) {
	var nUpper = (str.charCodeAt(0)-1) << 5;
	var nLower = (str.charCodeAt(1)-1) >> 1;

	return nUpper + nLower;
}

function encodeBuild(hero) {
	var str = '';

	// Encode all 6 skills
	for(var i=0; i<6; i++) {
		var skillNumber = 0;

		var ab = hero.netprops.m_hAbilities[i];
		if(ab && ab.isValid() && abSkillIDs[ab.getClassname()]) {
			var skillNumber = abSkillIDs[ab.getClassname()];
		}

		// Att to the string
		str = '{1}{2}'.format(str, encodeNumber(skillNumber));
	}

	return str;
}

// Prints a hex map of a string -- Useful for inspecting save data
function printHexMap(str) {
	var arr = [];

	for(var i=0; i<str.length; i++) {
		arr.push(str.charCodeAt(i));
	}

	server.print(arr.map(function(i){return "\\x" + ( i.toString(16).length < 2 ?  "0" + i.toString(16) : i.toString(16) )}).join(""));
}

function doSave(client) {
	// Validate client
	if(!client || !client.isInGame()) return;

	// Grab steamID
	var sID = client.getAuthString();

	// Make sure they have some save data
	if(!saveData[sID] || saveData[sID] == '' || saveData[sID].length <= 0) {
		client.print('You have no save data! (C)');
		return;
	}

	// Check if we've recently saved, if so, store that we need to save again
	if(cantSave[sID]) {
		cantSave[sID]++;
		return;
	}

	// Store that we recently saved
	cantSave[sID] = 1;

	// Do the save
	lobbyManager.setPlayerData(client, saveData[sID]);

	// Set timeout to allow save again
	timers.setTimeout(function(){
		// Check if we need to save again
		if(cantSave[sID] > 1) {
			// Allow us to save again
			cantSave[sID] = 0;

			// Try to save again
			doSave(client);
		} else {
			// Allow us to save again
			cantSave[sID] = 0;
		}
	}, 60 * 1000);
}

var mineFadeDelay = 1;
var maxMines = 20;
var mineInnerRadius = 200;
var mineOuterRadius = 500;
var halfDamage = [150, 200, 250, 300];
var fullDamage = [300, 400, 500, 600];
customSpells['custom_techies_land_mines'] = {
	base: 'venomancer_plague_ward',
	cooldown: [25, 20, 15, 10],
	manacost: [125, 150, 175, 205],
	range: [100, 100, 100, 100],
	callback: function(ab) {
		var pos = dota.getCursorLocation(ab);
		if(!pos) return;

		// Load required stuff
		dota.loadParticleFile('particles/units/heroes/hero_gyrocopter.pcf');
		game.precacheModel('models/heroes/gyro/gyro_missile.mdl');

		// Set total mines to 0
		if(!ab.totalMines) ab.totalMines = 0;
		if(!ab.mineArray) ab.mineArray = [];

		// Add 1 to the total mines
		ab.totalMines++;

		// Grab the owner
		var owner = dota.getAbilityCaster(ab);

		// Play place on ground sound
		var client = dota.findClientByPlayerID(owner.netprops.m_iPlayerID);
		if(client && client.isValid()) {
			dota.sendAudio(client, false, 'ui/inventory/stone_drop_01.wav');
		}

		// Create the ward
		var unit = dota.createCustomUnit('npc_dota_venomancer_plague_ward_1', dota.TEAM_RADIANT, {//owner.netprops.m_iTeamNum, {
			'AttackCapabilities': 'DOTA_UNIT_CAP_NO_ATTACK',
			'BountyGoldMin': '0',
			'BountyGoldMax': '0',
			'model': 'models/heroes/gyro/gyro_missile.mdl',
			'StatusHealth': '1',
			'VisionDaytimeRange': mineOuterRadius,
			'VisionNighttimeRange': mineOuterRadius,
			'BoundsHullName': 'DOTA_HULL_SIZE_SMALL'
		});

		// Move it into position
		unit.teleport(pos);
		unit.setRotation(owner.netprops.m_angRotation);

		// Store it
		ab.mineArray.push(unit);

		// Update pos
		pos = unit.netprops.m_vecOrigin;

		// Mark that is is a bomb
		unit.isExposiveMine = true;
		unit.hasExploded = false;
		unit.shouldClean = true;
		unit.clean = function() {
			if(!unit || !unit.isValid() || !unit.shouldClean) return;
			unit.shouldClean = false;
			unit.hasExploded = true;

			// Remove invis
			dota.removeModifier(unit, 'modifier_bounty_hunter_wind_walk');

			// Set HP to 0
			unit.netprops.m_iHealth = 0;

			// Remove mine after a short delay
			timers.setTimeout(function() {
				if(!unit || !unit.isValid()) return;
				dota.remove(unit);
			}, 10);

			// Lower total mines
			ab.totalMines--;
		}

		// Store stuff
		unit.ab = ab;
		unit.owner = owner;

		// Run the think function
		unit.thinkFunction = function(u) {
			if(!u || !u.isValid()) return;

			// Only think once every second
			u.nextThink = game.rules.props.m_fGameTime+0.1;

			// Make sure the ability is still valid
			if(!ab || !ab.isValid()) {
				u.clean();
				return;
			}

			// Check if we are armed yet
			if(!u.isArmed) return;

			// Find all ents in close area
			var ents = dota.findUnitsInRadius(u, u.netprops.m_iTeamNum, mineInnerRadius,pos.x, pos.y, dota.UNIT_TARGET_TEAM_ENEMY, dota.UNIT_TARGET_TYPE_HERO+dota.UNIT_TARGET_TYPE_CREEP, 0);
			if(ents.length > 0) {
				// Someone entered our blow zone
				explodeMine(u);
			}
		}

		// Make it invisible
		timers.setTimeout(function() {
			if(unit && unit.isValid()) {
				unit.isArmed = true;

				// Apply Invis
				var invis = dota.createAbility(unit, 'bounty_hunter_wind_walk');
				dota.addNewModifier(unit, invis, 'modifier_bounty_hunter_wind_walk', 'bounty_hunter_wind_walk', {}, unit);
			}
		}, mineFadeDelay * 1000);

		// check if we've hit the limit
		if(ab.totalMines > maxMines) {
			// Find and destroy a mine
			for(var i=0; i<ab.mineArray.length; i++) {
				var mine = ab.mineArray[i];
				if(mine && mine.isValid() && !mine.hasExploded) {
					explodeMine(mine);
					break;
				}
			}
		}
	}
}

/*
meandraco CUSTOM SPELLS
*/
var gungnir_slow = 0.4;
var gungnir_damage = [120, 180, 260, 340];
var gungnir_burn_damage = [30, 40, 50, 60];
var gungnir_radius = [100, 200, 320, 500];
var gungnir_move_speed = [300, 500, 700, 1000];
var gungnir_return_speed = [300, 500, 700, 1000];
var gungnir_move_speed_fast = [2000, 2000, 2000, 2000];
var gungnir_return_range = 100;
customSpells['custom_meandraco_gungnir'] = {
	base: 'pudge_meat_hook',
	cooldown: [30, 25, 20, 15],
	manacost: [130, 160, 200, 240],
	range: [1000, 1350, 1650, 2000],
	callback: function(ab) {
		var pos = dota.getCursorLocation(ab);
		if(!pos) return;

		// Load required stuff
		dota.loadParticleFile('particles/units/heroes/hero_gyrocopter.pcf');
		game.precacheModel('models/projectiles/mirana_arrow.mdl');

		// Grab the owner
		var owner = dota.getAbilityCaster(ab);

		// Grab the level of this arrow
		var level = ab.netprops.m_iLevel;

		var radius = gungnir_radius[level-1];
		var moveSpeed = gungnir_move_speed_fast[level-1];
		var damage = gungnir_damage[level-1];

		// Create the arrow
		var unit = dota.createCustomUnit('npc_dota_venomancer_plague_ward_1', owner.netprops.m_iTeamNum, {
			'AttackCapabilities': 'DOTA_UNIT_CAP_NO_ATTACK',
			'BountyGoldMin': '0',
			'BountyGoldMax': '0',
			'model': 'models/projectiles/mirana_arrow.mdl',
			'StatusHealth': '1',
			'VisionDaytimeRange': radius,
			'VisionNighttimeRange': radius,
			'BoundsHullName': 'DOTA_HULL_SIZE_SMALL',
			'MovementCapabilities': 'DOTA_UNIT_CAP_MOVE_FLY',
			'MovementSpeed': moveSpeed,
			'MovementTurnRate': '1.0'
		});

		// Remove moving speed limmit
		dota.attachMasterModifier(unit, {
			getMoveSpeedLimit: function() {
				return moveSpeed;
			}
		});

		// Give the owner control of it
		unit.netprops.m_iIsControllableByPlayer = 1 << 23;

		// Cover it in fire
		customAbility = {
			aura_radius: [radius, 0, 0],
			aura_damage: [gungnir_burn_damage[level-1], 0, 0]
		}

		var fire = dota.createAbility(unit, 'warlock_golem_permanent_immolation');
		fire.customAbility = customAbility;
		dota.setAbilityByIndex(unit, fire, 0);
		dota.upgradeAbility(fire);
		customAbility = null;

		var spawnPos = owner.netprops.m_vecOrigin;

		// Move it into position
		dota.findClearSpaceForUnit(unit, spawnPos);

		// Tell it to 'walk' into position
		dota.executeOrders(23, dota.ORDER_TYPE_MOVE_TO_LOCATION, [unit], null, null, true, pos);

		// Put return gungnir in
		var ret = skillIntoSlot(owner, 'custom_meandraco_gungnir_return', ab.slot, level);
		dota.endCooldown(ret);

		// Store shit
		ret.arrow = unit;

		// Run the think function
		unit.thinkFunction = function(u) {
			if(!u || !u.isValid()) return;

			// Only think once so often
			u.nextThink = game.rules.props.m_fGameTime+0.1;

			var myPos = u.netprops.m_vecOrigin;

			// Destroy all trees around us
			dota.destroyTreesAroundPoint(myPos, radius, true);

			if(!u.exploded) {
				// Check distance to our goal
				if(vecDist(myPos, pos) > 10) return;

				// Explode
				u.exploded = true;
				var index = dota.createParticleEffect(unit, "gyro_calldown_explosion", 0);

				for(var i=0; i<server.clients.length; i++) {
					var client = server.clients[i];
					if(!client || !client.isInGame()) continue;

					// Send particle to this client
					dota.setParticleControl(client, index, 3, myPos);
					dota.releaseParticle(client, index);
				}

				var units = dota.findUnitsInRadius(u, u.netprops.m_iTeamNum, radius, myPos.x, myPos.y, dota.UNIT_TARGET_TEAM_ENEMY, dota.UNIT_TARGET_TYPE_HERO+dota.UNIT_TARGET_TYPE_CREEP, 0);
				for(var i=0; i<units.length; i++) {
					// Grab an ent
					var ent = units[i];
					if(!ent || !ent.isValid()) continue;

					dota.applyDamage(owner, ent, ret, damage, dota.DAMAGE_TYPE_COMPOSITE);
				}
			}
		}
	}
}

customSpells['custom_meandraco_gungnir_return'] = {
	base: 'bristleback_quill_spray',
	cooldown: [9999, 9999, 9999, 9999],
	manacost: [0, 0, 0, 0],
	callback: function(ab) {
		// Check if we can't use this
		if(ab.disabled) return;
		ab.disabled = true;

		// Grab the owner
		var owner = dota.getAbilityCaster(ab);

		if(!ab.arrow || !ab.arrow.isValid()) {
			server.print('WARNING: Arrow was not found!!!');
			var skill = skillIntoSlot(owner, 'custom_meandraco_gungnir', ab.slot, ab.netprops.m_iLevel);
			return;
		}

		// Load required stuff
		game.precacheModel('models/projectiles/mirana_arrow.mdl');

		// Grab the level of this arrow
		var level = ab.netprops.m_iLevel;

		var radius = gungnir_radius[level-1];
		var moveSpeed = gungnir_move_speed[level-1];

		// Create the arrow
		var unit = dota.createCustomUnit('npc_dota_venomancer_plague_ward_1', owner.netprops.m_iTeamNum, {
			'AttackCapabilities': 'DOTA_UNIT_CAP_NO_ATTACK',
			'BountyGoldMin': '0',
			'BountyGoldMax': '0',
			'model': 'models/projectiles/mirana_arrow.mdl',
			'StatusHealth': '1',
			'VisionDaytimeRange': radius,
			'VisionNighttimeRange': radius,
			'BoundsHullName': 'DOTA_HULL_SIZE_SMALL',
			'MovementCapabilities': 'DOTA_UNIT_CAP_MOVE_FLY',
			'MovementSpeed': moveSpeed,
			'MovementTurnRate': '1.0',
			'FollowRange': 0
		});

		// Give the owner control of it
		unit.netprops.m_iIsControllableByPlayer = 1 << 23;

		// Cover it in fire
		customAbility = {
			aura_radius: [radius, 0, 0],
			aura_damage: [gungnir_burn_damage[level-1], 0, 0]
		}

		var fire = dota.createAbility(unit, 'warlock_golem_permanent_immolation');
		fire.customAbility = customAbility;
		dota.setAbilityByIndex(unit, fire, 0);
		dota.upgradeAbility(fire);
		customAbility = null;

		var spawnPos = ab.arrow.netprops.m_vecOrigin;

		// Move it into position
		dota.findClearSpaceForUnit(unit, spawnPos);

		// Tell it to 'walk' into position
		dota.executeOrders(23, dota.ORDER_TYPE_MOVE_TO_UNIT, [unit], owner, null, true, spawnPos);

		// Run the think function
		unit.thinkFunction = function(u) {
			if(!u || !u.isValid()) return;

			// Only think once so often
			u.nextThink = game.rules.props.m_fGameTime+0.1;

			// Make sure the ability is still valid
			if(!ab || !ab.isValid()) {
				dota.remove(u);
				return;
			}

			// Destroy all trees around us
			dota.destroyTreesAroundPoint(u.netprops.m_vecOrigin, radius, true);

			// Check if we are in range of the player
			if(vecDist(u.netprops.m_vecOrigin, owner.netprops.m_vecOrigin) <= gungnir_return_range) {
				var skill = skillIntoSlot(owner, 'custom_meandraco_gungnir', ab.slot, ab.netprops.m_iLevel);
				dota.remove(u);
			}
		}

		// Remove the old arrow
		dota.remove(ab.arrow);
	}
}

function explodeMine(unit) {
	// Validate unit
	if(!unit || !unit.isValid()) return;

	// Only explode once
	if(unit.hasExploded) return;
	unit.hasExploded = true;

	// Validate ability
	if(!unit.ab || !unit.ab.isValid()) return;
	if(!unit.owner || !unit.owner.isValid()) return;

	// Remove invis
	dota.removeModifier(unit, 'modifier_bounty_hunter_wind_walk');

	// Grab vars
	var pos = unit.netprops.m_vecOrigin;
	var xpos = pos.x;
	var ypos = pos.y;
	var teamNum = unit.netprops.m_iTeamNum;

	var otherTeam = dota.TEAM_RADIANT;
	if(teamNum == dota.TEAM_RADIANT) otherTeam = dota.TEAM_DIRE;

	var canSee = false;
	// Check if the other team can see it
	if(dota.canEntityBeSeenByTeam(unit, otherTeam)) {
		canSee = true;
	}

	var index = dota.createParticleEffect(unit, "gyro_calldown_explosion", 0);
	for(var i=0; i<server.clients.length; i++) {
		var client = server.clients[i];
		if(!client || !client.isInGame()) continue;

		// Send particle to this client
		dota.setParticleControl(client, index, 3, pos);
		dota.releaseParticle(client, index);

		// Check if they can hear it
		if(client.netprops.m_iTeamNum == teamNum || canSee) {
			dota.sendAudio(client, false, 'weapons/hero/gyrocopter/homing_missile_destroy.wav');
		}
	}

	// Find all ents in close area
	var innerEnts = dota.findUnitsInRadius(unit, teamNum, mineInnerRadius,xpos, ypos, dota.UNIT_TARGET_TEAM_ENEMY, dota.UNIT_TARGET_TYPE_HERO+dota.UNIT_TARGET_TYPE_CREEP, 0);
	if(innerEnts.length > 0) {
		// Someone entered our blow zone

		// Find all entities in our outer area
		var outerEnts = dota.findUnitsInRadius(unit, teamNum, mineOuterRadius,xpos, ypos, dota.UNIT_TARGET_TEAM_ENEMY, dota.UNIT_TARGET_TYPE_HERO+dota.UNIT_TARGET_TYPE_CREEP, 0);

		// Load in our damage values
		var lowDamage = halfDamage[unit.ab.netprops.m_iLevel-1];
		var highDamage = fullDamage[unit.ab.netprops.m_iLevel-1];

		for(var i=0; i<outerEnts.length; i++) {
			// Grab an ent
			var ent = outerEnts[i];
			if(!ent || !ent.isValid()) continue;

			// Grab lesser damage
			var damage = lowDamage;

			// Check if the ent was in our inner circle
			if(innerEnts.indexOf(ent) != -1) {
				// Yes, increase damage
				damage = highDamage;
			}

			// Apply the damage
			dota.applyDamage(unit.owner, ent, unit.ab, damage, dota.DAMAGE_TYPE_COMPOSITE);
		}
	}

	// Cleanup mine
	unit.clean();
}

game.hook("Dota_OnUnitThink", function(unit) {
	// Check if this unit has a think function
	if(unit.thinkFunction && (!unit.nextThink || unit.nextThink >= game.rules.props.m_fGameTime)) unit.thinkFunction(unit);
	if(unit.shouldClean && unit.netprops.m_iHealth <= 0) unit.clean();
});

game.hook("Dota_OnGetAbilityValue", function(ability, abilityName, field, values) {
	if(abilityName == 'troll_warlord_berserkers_rage' && field == 'bonus_range' && ability.attackRange) {
		return [ability.attackRange-128];
	}

	if(customAbility != null) {
		if(customAbility[field]) {
			server.print('YES!');
			return customAbility[field];
		}
	}
	if(ability.customAbility != null) {
		if(ability.customAbility[field]) {
			server.print('YES!');
			return ability.customAbility[field];
		}
	}
});


game.hook("Dota_OnUnitParsed", function(unit, keyvalues) {
	if(!unit || !unit.isValid()) return;

	var name = unit.getClassname();

	// Hero stat related stuff
	if(unit.isHero()) {
		if(!keyvalues['ProjectileSpeed']) {
			keyvalues['ProjectileSpeed'] = '900';
		}
	}

	// Lone droid bear patch
	if(name.indexOf('npc_dota_lone_druid_bear') != -1) {
		// Give projectile speed
		keyvalues['ProjectileSpeed'] = '900';

		timers.setTimeout(function() {
			var owner = unit.netprops.m_hOwnerEntity;
			if(!owner) return;

			// Grab the playerID of the owner of this bear
			var playerID = owner.netprops.m_iPlayerID;

			if(customBearSkills[playerID]) {
				var lvl = 1;

				// Remove all old skills
				loopOverSkills(unit, function(ab) {
					cleanupAbility(unit, ab);
				});

				// Allow the use of summon again
				loopOverSkills(owner, function(ab) {
					var abName = ab.getClassname();

					if(abName == 'lone_druid_spirit_bear') {
						// Store the level of it
						lvl = ab.netprops.m_iLevel;
					}
				});

				for(var i=0; i<customBearSkills[playerID].length; i++) {
					// Grab the name of this ability
					var skillName = customBearSkills[playerID][i];

					// Validate bans
					if(!checkBans(null, unit, skillName, i)) {
						// Give the skill
						var skill = dota.createAbility(unit, skillName);
						dota.setAbilityByIndex(unit, skill, i);

						var actualLevel = lvl;
						if(abList.Ults.indexOf(skillName) != -1) {
							actualLevel--;
						}

						for(var l=0; l<actualLevel; l++) {
							dota.upgradeAbility(skill);
						}
					}
				}
			}
		}, 1);

	}
});

// Calculates the distance between two vectors (not taking into account for z)
function vecDist(vec1, vec2) {
	if(!vec1 || !vec2) return 1000000;

	var xx = (vec1.x - vec2.x);
	var yy = (vec1.y - vec2.y);

	return Math.sqrt(xx*xx + yy*yy);
}
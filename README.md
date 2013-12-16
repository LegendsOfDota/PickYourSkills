PickYourSkills
==============

The Pick Your Skills (Legends of Dota) plugin on D2Ware.Net

###What does this do?###
 - It lets you pick your skills

###How do I pick my skills?###
 - You type -skill name_of_the_skill [slot number]
 - You can also type -skill [skill ID]
  - You can find the skill IDs in the red boxes when using -find
 - The picking stage starts when everyone spawns, you CAN NOT pick your skills in the menu, you can however use -find to find skills
 - Once you're done, type - ready so the game can begin

###How do I find skills?###
 - You can use -find [query terms]
  - If you put more than one query term, it will try to match both of them
  - It has spelling error detection, so as long as you get it close to the real word, it will find what you are looking for
  - It will list EVERY skill in the game, you can use -page [page number] to  view more results

###Entering skills is hard!###
 - We have a saving and loading feature
 - Use -save [1-9] to save your builds.
 - Use -load [1-9] to load your builds.
 - Use -last to load the build you used last round.
  - If you've never played, you wont have any builds to load.
  - Depending on how much you type -save, it can take up to 1 minute to save, please allow time for it to save before disconnecting.

###What do the options do?###
 - Game Mode
  - Changes how skills are allocated, or what skills are available to pick, see below for details
 - Unique Skills
  - If the picking of skills should be unique
 - Picking Time
  - Changes how long the initial picking phase lasts
 - Banning Time
  - Allows you to have a banning phase, to once and for all allow people to ban everything they dislike
 - Silent Banning
  - Silent banning won't announce the bans, and will let people ban the same skill more than once
 - Number of Slots
  - The amount of slots to use
  - Using >4 will remove heroes without 4 slots from the hero pool
  - People can always pick the same hero
 - Max Number of Regular Skills
  - Change the max number of regular skills someone is allowed to pick.
 - Max Number of Ults
  - Changes the max number of ults someone is allowed to pick
 - Allow Skills Twice in a Row
  - This option stops people using the same skills twice in a row
  - If you enable this, it will stop you from picking firefly two games in a row (for example)
 - Allow Custom Bear Skills
  - Pick custom skills for their spirit bear
  - -bear [skill_name] [slot]
 - Allow Custom Tower Skills
  - Pick skills for your team's towers
  - -tower [skill_name] [slot]
 - Allow XXX Abilities
  - These do what they say
 - Ban Troll Combos
  - You can optionally ban troll builds that wreck the game (IMO)
 - Ban Silencer
  - Silencer steals INT from heroes when he kills them, so there is the option to ban him
 - Ban Invisibility
  - You can either ban perma invisibility, or all invisibility abilities

###What Game Modes are there?###
 - Classic
  - The regular plugin, all skills (besides bans) are fair game
 - Swap Builds Ran
  - All builds are put into a pool, each person receives a random build
 - Random OMG
  - All skills are put into a pool, and each person gets a random subset (not locked to being builds, can be dups across players)
 - Build for the Enemy
  - Teams get builds from the opposite teams
 - Pick From 20 Skills
  - You are allocated 24-26 skills which you can choose from, you may only select these skills
 - One Build to Rule...
  - A player's build is selected, and everyone gets it
 - Blue VS Pink
  - A player's build from each team is chosen and everyone on that team gets that build
 - Blue VS Pink Swapped
  - Teams get opposite teams builds
 - Cycling Builds
  - A random build will be chosen every so often
 - Unlimited Points
  - You get seemingly unlimited amount of skill points

###Known Bugs###
 - Cycling Builds is crashy, depending on the skills chosen
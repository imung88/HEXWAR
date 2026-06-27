### Overview
**Hexwar** is a singleplayer hex based RTS built with **PixiJS**. The player shapes the battlefield by **building on hexes**, managing two resources **gold** and **oil**, and selecting up to **three priority hexes** set to **Attack** or **Defend**. Units spawn automatically from buildings or faction spawn points and move autonomously. Unit AI prioritizes defending empty friendly hexes before attacking. Graphics should be simple and visually distinctive between unit types, buildings, and resource nodes.

---

### Map and Hex Rules
- **Map size**: roughly **15 hex wide** by **10 hex tall** arranged in a diamond layout.  
- **Starting control**: both factions start controlling an equal number of hexes with several neutral hexes between them.  
- **River**: a river runs roughly diagonally across the map. Any hex containing river terrain grants a **defense bonus** to its owner.  
- **Hex control states**: **Friendly**, **Neutral**, **Enemy**. Neutral hexes exist at match start and reappear when a command center is destroyed and not rebuilt.  
- **Resource node placement**: resource nodes are randomly generated at match start using seeded RNG for reproducibility.  
- **Movement and combat**:
  - Units move and attack within and across hexes.  
  - Crossing an enemy controlled hex imposes a **temporary movement penalty** on the moving unit.  
- **Border pressure mechanic**:
  - If a friendly hex is bordered by enemy hexes on **three sides**, that hex’s **spawn and resource gain is reduced by 20%**.  
  - If bordered on **four sides**, spawn and resource gain is reduced by **30%**.  
  - If bordered on **five sides**, spawn and resource gain is reduced by **50%**.

---

### Command Centers, Buildings, and Units
#### Command Center
- **Purpose**: controls a hex and is required before placing spawn buildings on that hex.  
- **Cost and build time**: small gold cost deducted immediately and **5 seconds build time** when built on a neutral hex.  
- **Rebuild cooldown**: a faction that just lost a command center cannot rebuild it for **15 seconds**.  
- **Placement and HP**: always located at the center of the hex and has **significant HP**. Scale example: **one tank firing continuously for 20 seconds** destroys it.  
- **Regeneration**: regenerates HP while no enemy unit is present on the hex.  
- **Counting**: command center does **not** count toward the one building per hex limit.

#### Player Buildings
- **Requirement**: a friendly command center must exist on a hex before placing a spawn building there.  
- **One building per hex** enforced for spawn buildings. A hex may host one resource node and one spawn building plus a command center.  
- **Starting buildings**: both factions start with **3 Infantry Barracks** and **1 Tank Division** placed randomly on their controlled hexes.  
- **Victory point hex**: each faction has one victory point hex placed randomly but never on the front line. The victory point hex contains a **special command center** with very large HP, automatically spawns infantry at a slower speed, and generates a very low amount of gold and oil. The match objective is to **destroy the enemy victory point**.

#### Building types and example stats

| **Building** | **Immediate Cost** | **Maintenance Low** | **Maintenance High** | **Spawn Cadence Low High** |
|---|---:|---:|---:|---:|
| Infantry Barracks | 100 gold; 10 oil | 2 gold/tick | 4 gold/tick | 20s; 10s |
| Tank Division | 300 gold; 60 oil | 6 gold; 6 oil/tick | 12 gold; 12 oil/tick | 40s; 20s |
| Artillery Division | 250 gold; 30 oil | 5 gold/tick | 10 gold/tick | 50s; 25s |
| Victory Command Center | small gold; small oil | very low | very low | auto infantry slow |

*(Numbers are examples and must be tuned in a config file.)*

#### Units
- **Types**: **Infantry**, **Tank**, **Artillery**.  
- **Attributes**: HP, Attack, Defense, Movement, Vision. All values are tunable in config.  
- **Artillery rules**:
  - **Range**: can attack targets **two hexes away**.  
  - **Damage**: single target only, no area damage.  
  - **Defense interaction**: artillery attacks **ignore defense bonuses** from river, city, or town.  
- **Spawn behavior**: units spawn at buildings or faction spawn hexes and act autonomously.  
- **Movement penalty**: crossing enemy hexes applies temporary movement slowdown that AI accounts for when pathfinding.

---

### Economy and Maintenance
- **Currencies**: **Gold** and **Oil**.  
- **Income sources**:
  - Controlled resource nodes produce per tick. Towns produce small gold, cities produce large gold, oil fields produce medium oil.  
  - Victory point hex generates a very low amount of gold and oil.  
- **Costs**:
  - **Immediate build cost**: deducted on placement for command centers and buildings.  
  - **Maintenance cost**: recurring per tick while a building exists and scales with spawn speed.  
  - **Unit spawn cost**: amortized into maintenance.  
- **Spawn speed settings**:
  - **Off**: no spawning; minimal maintenance.  
  - **Low**: slow spawn cadence; low maintenance.  
  - **High**: fast spawn cadence; high maintenance.  
- **Spawn and resource reduction**: border pressure reductions apply to spawn cadence and resource gain for hexes surrounded by enemy hexes as specified in the Border pressure mechanic.

---

### AI Priority System and Behavior
- **Player controls**:
  - Place buildings and command centers on eligible hexes.  
  - Toggle per building spawn speed Off/Low/High.  
  - Select up to **three priority hexes** and set each to **Attack** or **Defend**. Priorities are visually marked and weighted by distance and selection order.
- **Unit AI rules**:
  1. **Spawn and assignment**: units spawn and receive objectives based on front lines and player priorities.  
  2. **Priority weighting**: units bias assignments toward the three player priorities; nearer and higher order priorities receive stronger weighting.  
  3. **Defend empty hex preference**: units prefer to move into and garrison empty friendly hexes before attacking enemy held hexes.  
  4. **Engagement**: units engage enemy units encountered if engagement is favorable; otherwise they may retreat or wait for reinforcements.  
  5. **Movement penalty handling**: AI accounts for movement penalties when planning routes that cross enemy hexes.  
  6. **Artillery targeting**: artillery can attack at range two and ignores defense bonuses when calculating damage.  
  7. **Fallback and regeneration**: low HP units retreat toward friendly hexes; command centers regenerate when hex is free of enemy units.
- **AI state machine**:
  - **Spawn → AssignObjective → Pathfind → MoveToObjective → Occupy/Defend → Engage → Fallback/Regroup**.

---

### Technical Architecture UI and Win Conditions
- **Core modules**:
  - **GameController**: tick loop, resource accounting, maintenance deduction, win/lose checks.  
  - **HexGrid**: axial coordinates, neighbor queries, pathfinding A* adapted for hexes, tile state including river flag and command center presence.  
  - **BuildManager**: placement validation, immediate cost deduction, maintenance registration, spawn speed toggles, command center rules and rebuild cooldown enforcement.  
  - **SpawnManager**: per building spawn queues, cadence timers, global caps.  
  - **AIController**: objective assignment, defend first enforcement, artillery targeting rules, movement penalty awareness, border pressure adjustments.  
  - **Renderer**: PixiJS stage, simple distinctive sprites, river visuals, priority markers, command center visuals, UI overlays.
- **UI elements**:
  - **Top bar**: Gold and Oil counters, income per minute, maintenance drain.  
  - **Build panel**: building icons, immediate cost, maintenance preview, spawn speed toggles.  
  - **Priority panel**: shows up to three selected hexes with mode toggles Attack or Defend and reorder/clear controls.  
  - **Hex tooltip**: owner, building, resource node, production, defense bonus, command center HP and rebuild cooldown.  
  - **Per building control**: spawn speed and maintenance indicator.  
  - **Notifications**: low resources, unpaid maintenance warnings, command center destroyed, rebuild cooldown active, artillery strikes.
- **Performance and tuning**:
  - Target 60 FPS on desktop. Use sprite pooling, cap active units, cache group paths, and limit path recalculation frequency. Keep numeric knobs in a single config file. Use seeded RNG for resource node placement for reproducible testing. Create automated scenarios to validate defend first AI, artillery ignore defense, spawn speed vs maintenance tradeoffs, command center rebuild cooldown, movement penalty effects, and border pressure reductions.
- **Win condition**: destroy the enemy victory point hex.  
- **Lose condition**: enemy destroys the player victory point hex or player cannot produce units and has no remaining units.

---
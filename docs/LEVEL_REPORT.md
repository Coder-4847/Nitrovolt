# Level Report

Built by `npx tsx scripts/make-levels.mts` from the definitions in `scripts/levels/`. Every level was driven start to
finish by the validation bot (`src/tracks/Validate.ts`) with **no respawn**; that run is the **author ghost** and the
**target time**, and each ghost was re-simulated to confirm it reproduces the run exactly.

Levels: **25**. Build time 19 s.

| # | World | Id | Name | Cars | Length | Target | Class | Top / avg km/h | Air (jumps) | Wall hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Summer | `c01` | Green Valley | Stadium > Rally | 1703 m | 0:39.503 | Sprint | 240 / 152 | 4.1 s (3) | 0 |
| 2 | Summer | `c02` | Lakeside Rally | Rally > Stadium | 2108 m | 1:04.681 | Standard | 198 / 115 | 7.2 s (9) | 3 |
| 3 | Summer | `c03` | Hill Climb | Stadium > Rally > Stadium | 2621 m | 1:12.332 | Standard | 224 / 128 | 5.0 s (7) | 2 |
| 4 | Summer | `c04` | Canopy Run | Rally > Stadium | 2468 m | 1:07.295 | Standard | 220 / 132 | 5.9 s (6) | 4 |
| 5 | Summer | `c05` | Grand Valley | Stadium > Rally > Desert | 3929 m | 1:39.634 | Marathon | 223 / 141 | 12.9 s (13) | 1 |
| 6 | Autumn | `c06` | Falling Leaves | Rally > Stadium | 1281 m | 0:41.699 | Sprint | 194 / 107 | 7.6 s (7) | 2 |
| 7 | Autumn | `c07` | Harvest Run | Rally > Desert > Rally | 2260 m | 1:13.350 | Standard | 160 / 109 | 4.3 s (6) | 0 |
| 8 | Autumn | `c08` | Misty Gorge | Stadium > Rally | 2487 m | 1:05.038 | Standard | 203 / 136 | 7.2 s (18) | 4 |
| 9 | Autumn | `c09` | Switchback Pass | Rally > Stadium > Rally | 2166 m | 1:03.002 | Standard | 225 / 121 | 3.2 s (5) | 0 |
| 10 | Autumn | `c10` | Amber Endurance | Rally > Stadium > Snow | 3372 m | 1:37.474 | Marathon | 222 / 125 | 7.6 s (11) | 1 |
| 11 | Winter | `c11` | Powder Sprint | Snow > Rally | 1324 m | 0:43.203 | Sprint | 177 / 108 | 1.9 s (5) | 0 |
| 12 | Winter | `c12` | Frozen Lake | Snow > Stadium | 2223 m | 1:15.494 | Standard | 247 / 107 | 4.2 s (5) | 2 |
| 13 | Winter | `c13` | Avalanche Alley | Stadium > Snow > Stadium | 2269 m | 1:01.619 | Standard | 249 / 133 | 9.1 s (11) | 2 |
| 14 | Winter | `c14` | Glacier Run | Snow > Rally > Snow | 1978 m | 1:02.743 | Standard | 177 / 112 | 3.1 s (4) | 1 |
| 15 | Winter | `c15` | Blizzard Marathon | Stadium > Snow > Rally | 3423 m | 1:41.448 | Marathon | 222 / 121 | 4.8 s (6) | 0 |
| 16 | Desert | `c16` | Dune Dash | Desert > Stadium | 1227 m | 0:32.200 | Sprint | 194 / 132 | 4.7 s (6) | 2 |
| 17 | Desert | `c17` | Canyon Run | Desert > Rally > Desert | 2424 m | 1:04.628 | Standard | 222 / 133 | 6.1 s (5) | 0 |
| 18 | Desert | `c18` | Mesa Jumps | Rally > Desert | 2644 m | 1:05.639 | Standard | 223 / 144 | 11.0 s (8) | 0 |
| 19 | Desert | `c19` | Oasis Highway | Stadium > Desert > Stadium | 2707 m | 1:03.224 | Standard | 256 / 152 | 6.7 s (10) | 0 |
| 20 | Desert | `c20` | Sahara Marathon | Desert > Rally > Stadium > Desert | 3786 m | 1:35.013 | Marathon | 224 / 143 | 11.7 s (11) | 0 |
| 21 | Night | `c21` | Neon Sprint | Stadium > Rally | 1513 m | 0:34.567 | Sprint | 263 / 152 | 0.0 s (0) | 0 |
| 22 | Night | `c22` | Downtown Drift | Rally > Stadium | 1871 m | 1:00.024 | Standard | 250 / 111 | 3.3 s (6) | 0 |
| 23 | Night | `c23` | Skyline Stunts | Stadium > Desert > Stadium | 2751 m | 1:06.758 | Standard | 258 / 146 | 3.5 s (4) | 0 |
| 24 | Night | `c24` | Midnight Mountain | Snow > Stadium > Snow | 2079 m | 1:09.985 | Standard | 223 / 110 | 6.8 s (9) | 5 |
| 25 | Night | `c25` | Grand Final | Stadium > Rally > Snow > Desert > Stadium | 3930 m | 1:37.003 | Marathon | 257 / 146 | 10.8 s (16) | 3 |

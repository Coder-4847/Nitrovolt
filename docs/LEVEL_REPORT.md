# Level Report

Built by `npx tsx scripts/make-levels.mts` from the definitions in `scripts/levels/`. Every level was driven start to
finish by the validation bot (`src/tracks/Validate.ts`) with **no respawn**; that run is the **author ghost** and the
**Author** time, and each ghost was re-simulated to confirm it reproduces the run exactly.

Levels: **33**. Build time 30 s.

| Tier | Id | Name | Environment | Cars | Length | Author | Gold | Silver | Bronze | Top / avg km/h | Air (jumps) | Wall hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| White | `c01` | Opening Lap | forest | Stadium | 1438 m | 0:30.104 | 0:32.512 | 0:37.630 | 0:46.661 | 279 / 166 | 3.8 s (5) | 0 |
| White | `c02` | Pine Run | snow | Snow | 1264 m | 0:40.833 | 0:44.100 | 0:51.041 | 1:03.291 | 153 / 109 | 1.5 s (8) | 0 |
| White | `c03` | Red Dust | desert | Desert | 1463 m | 0:35.356 | 0:38.184 | 0:44.195 | 0:54.802 | 223 / 145 | 6.5 s (6) | 0 |
| White | `c04` | Golden Hour | sunset | Stadium | 1355 m | 0:32.068 | 0:34.633 | 0:40.085 | 0:49.705 | 237 / 146 | 1.1 s (2) | 0 |
| White | `c05` | Rally Woods | forest | Rally | 1225 m | 0:34.917 | 0:37.710 | 0:43.646 | 0:54.121 | 204 / 121 | 1.0 s (1) | 0 |
| Green | `c06` | Loop Lane | night | Stadium | 1669 m | 0:33.264 | 0:35.592 | 0:40.582 | 0:49.896 | 273 / 176 | 1.1 s (1) | 0 |
| Green | `c07` | Two Faces | forest | Stadium > Rally > Stadium | 1563 m | 0:39.098 | 0:41.835 | 0:47.700 | 0:58.647 | 230 / 140 | 1.8 s (4) | 0 |
| Green | `c08` | Ice Lake | snow | Snow | 1175 m | 0:51.036 | 0:54.609 | 1:02.264 | 1:16.554 | 142 / 82 | 0.6 s (1) | 0 |
| Green | `c09` | Mesa Hop | desert | Desert | 1640 m | 0:37.183 | 0:39.786 | 0:45.363 | 0:55.775 | 225 / 155 | 11.7 s (10) | 0 |
| Green | `c10` | Halfpipe | sunset | Stadium | 1469 m | 0:33.231 | 0:35.557 | 0:40.542 | 0:49.847 | 337 / 155 | 4.5 s (7) | 4 |
| Blue | `c11` | Snow Patrol | snow | Stadium > Snow > Stadium | 1435 m | 0:44.358 | 0:47.019 | 0:53.230 | 1:04.319 | 220 / 114 | 1.8 s (2) | 1 |
| Blue | `c12` | Spiral | forest | Stadium | 1658 m | 0:44.994 | 0:47.694 | 0:53.993 | 1:05.241 | 197 / 130 | 5.5 s (4) | 0 |
| Blue | `c13` | Sand Rally | desert | Desert > Rally > Desert | 1473 m | 0:36.224 | 0:38.397 | 0:43.469 | 0:52.525 | 228 / 141 | 4.6 s (3) | 0 |
| Blue | `c14` | Night Shift | night | Stadium | 1559 m | 0:32.371 | 0:34.313 | 0:38.845 | 0:46.938 | 256 / 167 | 1.4 s (1) | 0 |
| Blue | `c15` | Four Seasons | sunset | Stadium > Rally > Snow > Desert > Stadium | 1718 m | 0:44.590 | 0:47.265 | 0:53.508 | 1:04.656 | 185 / 136 | 1.3 s (2) | 0 |
| Red | `c16` | Skyline | night | Stadium | 1587 m | 0:35.255 | 0:37.018 | 0:41.601 | 0:49.357 | 228 / 157 | 5.6 s (7) | 0 |
| Red | `c17` | Avalanche | snow | Snow > Rally > Snow | 1562 m | 0:56.687 | 0:59.521 | 1:06.891 | 1:19.362 | 184 / 97 | 2.9 s (4) | 0 |
| Red | `c18` | Mirage | desert | Desert > Stadium | 1779 m | 0:37.753 | 0:39.641 | 0:44.549 | 0:52.854 | 287 / 166 | 7.5 s (9) | 2 |
| Red | `c19` | Corkscrew | forest | Stadium | 1669 m | 0:34.935 | 0:36.682 | 0:41.223 | 0:48.909 | 276 / 179 | 1.4 s (1) | 1 |
| Red | `c20` | Endurance | sunset | Stadium > Rally > Stadium | 1084 m | 0:53.126 | 0:55.782 | 1:02.689 | 1:14.376 | 199 / 148 | 6.6 s (12) | 0 |
| Black | `c21` | Gauntlet | night | Stadium | 1817 m | 0:34.804 | 0:36.370 | 0:40.025 | 0:46.985 | 264 / 183 | 2.8 s (2) | 0 |
| Black | `c22` | Whiteout | snow | Snow > Rally > Snow | 1719 m | 1:05.528 | 1:08.477 | 1:15.357 | 1:28.463 | 182 / 92 | 1.6 s (4) | 0 |
| Black | `c23` | Sandstorm | desert | Desert > Stadium | 2043 m | 0:46.183 | 0:48.261 | 0:53.110 | 1:02.347 | 227 / 156 | 9.4 s (9) | 0 |
| Black | `c24` | Vortex | sunset | Stadium | 1939 m | 0:44.167 | 0:46.155 | 0:50.792 | 0:59.625 | 275 / 159 | 4.0 s (4) | 2 |
| Black | `c25` | Grand Final | forest | Stadium > Rally > Snow > Desert > Stadium | 2563 m | 1:04.291 | 1:07.184 | 1:13.935 | 1:26.793 | 223 / 142 | 5.6 s (7) | 0 |
| Training | `t01` | Basics | forest | Stadium | 1099 m | 0:27.765 | 0:30.542 | 0:36.095 | 0:44.424 | 218 / 135 | 0.0 s (0) | 0 |
| Training | `t02` | Air Time | forest | Stadium | 1701 m | 0:32.299 | 0:35.529 | 0:41.989 | 0:51.678 | 267 / 184 | 5.8 s (4) | 0 |
| Training | `t03` | Wall Ride | sunset | Stadium | 1275 m | 0:28.678 | 0:31.546 | 0:37.281 | 0:45.885 | 207 / 155 | 2.9 s (2) | 2 |
| Training | `t04` | Loop | night | Stadium | 1426 m | 0:27.542 | 0:30.296 | 0:35.805 | 0:44.067 | 273 / 180 | 0.0 s (0) | 0 |
| Training | `t05` | Dirt Road | forest | Rally | 1225 m | 0:35.226 | 0:38.749 | 0:45.794 | 0:56.362 | 200 / 120 | 1.4 s (2) | 0 |
| Training | `t06` | Snowfield | snow | Snow | 1254 m | 0:47.532 | 0:52.285 | 1:01.792 | 1:16.051 | 154 / 93 | 1.7 s (3) | 0 |
| Training | `t07` | Dunes | desert | Desert | 1232 m | 0:29.790 | 0:32.769 | 0:38.727 | 0:47.664 | 226 / 143 | 5.3 s (5) | 0 |
| Training | `t08` | Car Switch | sunset | Stadium > Rally > Snow > Stadium | 1284 m | 0:31.615 | 0:34.777 | 0:41.100 | 0:50.584 | 205 / 140 | 0.0 s (0) | 0 |

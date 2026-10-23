# Level Report

Built by `npx tsx scripts/make-levels.mts` from the definitions in `scripts/levels/`. Every level was driven start to
finish by the validation bot (`src/tracks/Validate.ts`) with **no respawn**; that run is the **author ghost** and the
**Author** time, and each ghost was re-simulated to confirm it reproduces the run exactly.

Levels: **33**. Build time 30 s.

| Tier | Id | Name | Environment | Cars | Length | Author | Gold | Silver | Bronze | Top / avg km/h | Air (jumps) | Wall hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| White | `c01` | Opening Lap | forest | Volt | 1438 m | 0:30.104 | 0:32.512 | 0:37.630 | 0:46.661 | 279 / 166 | 3.8 s (5) | 0 |
| White | `c02` | Pine Run | snow | Frost | 1264 m | 0:44.418 | 0:47.971 | 0:55.523 | 1:08.848 | 153 / 99 | 1.9 s (10) | 1 |
| White | `c03` | Red Dust | desert | Dune | 1463 m | 0:35.356 | 0:38.184 | 0:44.195 | 0:54.802 | 223 / 145 | 6.5 s (6) | 0 |
| White | `c04` | Golden Hour | sunset | Volt | 1355 m | 0:39.166 | 0:42.299 | 0:48.958 | 1:00.707 | 194 / 120 | 1.4 s (2) | 1 |
| White | `c05` | Rally Woods | forest | Gravel | 1225 m | 0:34.917 | 0:37.710 | 0:43.646 | 0:54.121 | 204 / 121 | 1.0 s (1) | 0 |
| Green | `c06` | Loop Lane | night | Volt | 1669 m | 0:33.264 | 0:35.592 | 0:40.582 | 0:49.896 | 273 / 176 | 1.1 s (1) | 0 |
| Green | `c07` | Two Faces | forest | Volt > Gravel > Volt | 1563 m | 0:43.611 | 0:46.664 | 0:53.205 | 1:05.417 | 229 / 126 | 2.5 s (4) | 1 |
| Green | `c08` | Ice Lake | snow | Frost | 1175 m | 0:51.798 | 0:55.424 | 1:03.194 | 1:17.697 | 142 / 81 | 0.7 s (1) | 2 |
| Green | `c09` | Mesa Hop | desert | Dune | 1640 m | 0:37.183 | 0:39.786 | 0:45.363 | 0:55.775 | 225 / 155 | 11.7 s (10) | 0 |
| Green | `c10` | Halfpipe | sunset | Volt | 1469 m | 0:33.231 | 0:35.557 | 0:40.542 | 0:49.847 | 337 / 155 | 4.5 s (7) | 4 |
| Blue | `c11` | Snow Patrol | snow | Volt > Frost > Volt | 1435 m | 0:44.358 | 0:47.019 | 0:53.230 | 1:04.319 | 220 / 114 | 1.8 s (2) | 1 |
| Blue | `c12` | Spiral | forest | Volt | 1658 m | 0:44.994 | 0:47.694 | 0:53.993 | 1:05.241 | 197 / 130 | 5.5 s (4) | 0 |
| Blue | `c13` | Sand Rally | desert | Dune > Gravel > Dune | 1473 m | 0:36.224 | 0:38.397 | 0:43.469 | 0:52.525 | 228 / 141 | 4.6 s (3) | 0 |
| Blue | `c14` | Night Shift | night | Volt | 1559 m | 0:32.371 | 0:34.313 | 0:38.845 | 0:46.938 | 256 / 167 | 1.4 s (1) | 0 |
| Blue | `c15` | Four Seasons | sunset | Volt > Gravel > Frost > Dune > Volt | 1718 m | 0:44.590 | 0:47.265 | 0:53.508 | 1:04.656 | 185 / 136 | 1.3 s (2) | 0 |
| Red | `c16` | Skyline | night | Volt | 1587 m | 0:35.463 | 0:37.236 | 0:41.846 | 0:49.648 | 228 / 156 | 5.8 s (8) | 0 |
| Red | `c17` | Avalanche | snow | Frost > Gravel > Frost | 1562 m | 0:58.476 | 1:01.400 | 1:09.002 | 1:21.866 | 184 / 94 | 3.7 s (3) | 2 |
| Red | `c18` | Mirage | desert | Dune > Volt | 1779 m | 0:37.753 | 0:39.641 | 0:44.549 | 0:52.854 | 287 / 166 | 7.5 s (9) | 2 |
| Red | `c19` | Corkscrew | forest | Volt | 1669 m | 0:34.935 | 0:36.682 | 0:41.223 | 0:48.909 | 276 / 179 | 1.4 s (1) | 1 |
| Red | `c20` | Endurance | sunset | Volt > Gravel > Volt | 1084 m | 0:59.442 | 1:02.414 | 1:10.142 | 1:23.219 | 199 / 133 | 7.6 s (12) | 2 |
| Black | `c21` | Gauntlet | night | Volt | 1817 m | 0:34.804 | 0:36.370 | 0:40.025 | 0:46.985 | 264 / 183 | 2.8 s (2) | 0 |
| Black | `c22` | Whiteout | snow | Frost > Gravel > Frost | 1719 m | 1:07.078 | 1:10.097 | 1:17.140 | 1:30.555 | 182 / 90 | 2.4 s (3) | 2 |
| Black | `c23` | Sandstorm | desert | Dune > Volt | 2043 m | 0:46.183 | 0:48.261 | 0:53.110 | 1:02.347 | 227 / 156 | 9.4 s (9) | 0 |
| Black | `c24` | Vortex | sunset | Volt | 1939 m | 0:44.167 | 0:46.155 | 0:50.792 | 0:59.625 | 275 / 159 | 4.0 s (4) | 2 |
| Black | `c25` | Grand Final | forest | Volt > Gravel > Frost > Dune > Volt | 2563 m | 1:04.291 | 1:07.184 | 1:13.935 | 1:26.793 | 223 / 142 | 5.6 s (7) | 0 |
| Training | `t01` | Basics | forest | Volt | 1099 m | 0:27.765 | 0:30.542 | 0:36.095 | 0:44.424 | 218 / 135 | 0.0 s (0) | 0 |
| Training | `t02` | Air Time | forest | Volt | 1701 m | 0:32.299 | 0:35.529 | 0:41.989 | 0:51.678 | 267 / 184 | 5.8 s (4) | 0 |
| Training | `t03` | Wall Ride | sunset | Volt | 1275 m | 0:28.678 | 0:31.546 | 0:37.281 | 0:45.885 | 207 / 155 | 2.9 s (2) | 2 |
| Training | `t04` | Loop | night | Volt | 1426 m | 0:27.542 | 0:30.296 | 0:35.805 | 0:44.067 | 273 / 180 | 0.0 s (0) | 0 |
| Training | `t05` | Dirt Road | forest | Gravel | 1225 m | 0:35.226 | 0:38.749 | 0:45.794 | 0:56.362 | 200 / 120 | 1.4 s (2) | 0 |
| Training | `t06` | Snowfield | snow | Frost | 1254 m | 0:47.532 | 0:52.285 | 1:01.792 | 1:16.051 | 154 / 93 | 1.7 s (3) | 0 |
| Training | `t07` | Dunes | desert | Dune | 1232 m | 0:29.790 | 0:32.769 | 0:38.727 | 0:47.664 | 226 / 143 | 5.3 s (5) | 0 |
| Training | `t08` | Car Switch | sunset | Volt > Gravel > Frost > Volt | 1284 m | 0:31.615 | 0:34.777 | 0:41.100 | 0:50.584 | 205 / 140 | 0.0 s (0) | 0 |

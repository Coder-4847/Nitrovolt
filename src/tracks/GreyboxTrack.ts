import { Vector3 } from 'three';
import { TrackBuilder } from './TrackBuilder';
import { TrackData } from './TrackTypes';

/**
 * Phase-1 grey-box test course. Starts on a huge flat skidpad (free driving / tuning), then a
 * proper course that exercises every part of the physics: a banked curve, a gap jump, dirt + ice
 * patches, a chicane, a vertical loop and a mega jump.
 */
export function buildGreyboxTrack(): TrackData {
  const t = new TrackBuilder();

  // --- skidpad: 200 x 200 m slab. Start sits near the south edge facing north. ---
  t.place(new Vector3(0, 0, 40), 0);
  const startPose = (() => {
    const p = new Vector3(0, 0, 0);
    const probe = new TrackBuilder();
    probe.place(p, 0);
    return probe.pose();
  })();
  t.straight(200, { width: 200, step: 50, thickness: 1.5 });

  // --- course leaves the north edge of the pad ---
  t.setDefaults({ width: 16, walls: 'none' });
  t.straight(120);
  t.trigger('checkpoint', 16);

  // banked left 180
  t.arc(70, 180, 28, { walls: 'both' });
  t.straight(50);
  t.trigger('checkpoint', 16);

  // gap jump: ramp up, fly, land on a down-slope that flattens out
  t.pitch(16, 55);
  t.straight(4);
  t.gap(30, 7, -16);
  t.pitch(16, 60);
  t.straight(40);
  t.trigger('checkpoint', 16);

  // surfaces: dirt then ice, then back to tarmac
  t.straight(55, { surface: 'dirt', walls: 'both' });
  t.straight(55, { surface: 'ice', walls: 'both' });
  t.straight(30);
  t.trigger('checkpoint', 16);

  // chicane (S-bends)
  t.arc(48, 40, 0);
  t.arc(48, -80, 0);
  t.arc(48, 40, 0);
  t.straight(30);
  t.trigger('checkpoint', 16);

  // run-up and loop
  t.straight(150);
  t.loop(30, 19, { width: 14, walls: 'both', wallHeight: 1.0 });
  t.straight(90);
  t.trigger('checkpoint', 16);

  // mega jump
  t.pitch(20, 60);
  t.straight(6);
  t.gap(60, 12, -20);
  t.pitch(20, 70);
  t.straight(60);
  t.trigger('finish', 16);
  t.gantry(16, 0xff3a14);

  return t.finish('greybox', 'Grey-box Test Course', startPose, -45);
}

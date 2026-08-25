// NBA 2K badge requirement thresholds.
// Generated data, kept out of index.html so it can be diffed and regenerated
// independently of the app. Thresholds are per game version: 2K's badge
// requirements change year to year, so anything derived from this file should
// report the version it used.
//
// tiers: [Bronze, Silver, Gold, HoF, Legend] -- null means that tier is
// unreachable through that attribute.
// any:true -> alternative requirements (best qualifying attribute counts);
// otherwise every listed attribute must clear the tier (weakest link).
"use strict";
function ft(s) { const [f, i] = s.split("'").map(Number); return f * 12 + i; }
const BADGES_DATA = {
  gameVersion: "NBA 2K25",
  badges: [
  // Shooting
  { name: "Deadeye", any: true, cat: "Shooting", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Midrange Shot", t: [73, 85, 92, 95, 99] }, { stat: "Threepoint Shot", t: [73, 85, 92, 95, 99] }] },
  { name: "Limitless Range", cat: "Shooting", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Threepoint Shot", t: [83, 89, 93, 96, 99] }] },
  { name: "Mini Marksman", any: true, cat: "Shooting", h: [ft("5'9"), ft("6'3")], attrs: [
    { stat: "Midrange Shot", t: [71, 82, 94, 97, 99] }, { stat: "Threepoint Shot", t: [71, 82, 94, 97, 99] }] },
  { name: "Set Shot Specialist", any: true, cat: "Shooting", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Midrange Shot", t: [65, 78, 89, 93, 98] }, { stat: "Threepoint Shot", t: [65, 78, 89, 95, 98] }] },
  { name: "Shifty Shooter", any: true, cat: "Shooting", h: [ft("5'9"), ft("6'11")], attrs: [
    { stat: "Midrange Shot", t: [76, 87, 91, 96, 99] }, { stat: "Threepoint Shot", t: [76, 87, 91, 96, 99] }] },
  // Playmaking
  { name: "Ankle Assassin", cat: "Playmaking", h: [ft("5'9"), ft("6'10")], attrs: [
    { stat: "Ball Handle", t: [75, 86, 93, 95, 98] }] },
  { name: "Bail Out", cat: "Playmaking", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Pass Accuracy", t: [85, 91, 94, 96, 99] }] },
  { name: "Break Starter", cat: "Playmaking", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Pass Accuracy", t: [65, 75, 87, 93, 98] }] },
  { name: "Dimer", cat: "Playmaking", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Pass Accuracy", t: [55, 71, 82, 92, 98] }] },
  { name: "Handles For Days", cat: "Playmaking", h: [ft("5'9"), ft("7'0")], attrs: [
    { stat: "Ball Handle", t: [71, 81, 90, 94, 97] }] },
  { name: "Lightning Launch", cat: "Playmaking", h: [ft("5'9"), ft("6'11")], attrs: [
    { stat: "Speed With Ball", t: [68, 75, 86, 91, 94] }] },
  { name: "Strong Handle", cat: "Playmaking", h: [ft("5'9"), ft("6'11")], attrs: [
    { stat: "Ball Handle", t: [60, 67, 73, 77, 80] }, { stat: "Strength", t: [60, 65, 73, 84, 93] }] },
  { name: "Unpluckable", any: true, cat: "Playmaking", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Ball Handle", t: [70, 80, 92, 96, 99] }, { stat: "Post Control", t: [75, 86, 96, null, null] }] },
  { name: "Versatile Visionary", cat: "Playmaking", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Pass Accuracy", t: [70, 76, 84, 95, 99] }] },
  // Finishing
  { name: "Aerial Wizard", any: true, cat: "Finishing", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Driving Dunk", t: [64, 70, 80, 89, 97] }, { stat: "Standing Dunk", t: [60, 75, 84, 92, 98] }] },
  { name: "Float Game", any: true, cat: "Finishing", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Close Shot", t: [68, 78, 86, 92, 98] }, { stat: "Driving Layup", t: [65, 78, 88, 95, 98] }] },
  { name: "Hook Specialist", cat: "Finishing", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Close Shot", t: [60, 75, 87, 94, 99] }, { stat: "Post Control", t: [61, 65, 80, 90, 97] }] },
  { name: "Layup Mixmaster", cat: "Finishing", h: [ft("5'9"), ft("6'11")], attrs: [
    { stat: "Driving Layup", t: [75, 85, 93, 97, 99] }] },
  { name: "Paint Prodigy", cat: "Finishing", h: [ft("6'3"), ft("7'4")], attrs: [
    { stat: "Close Shot", t: [73, 84, 92, 96, 99] }] },
  { name: "Physical Finisher", cat: "Finishing", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Strength", t: [60, 67, 75, 83, 97] }, { stat: "Driving Layup", t: [70, 80, 90, 96, 97] }] },
  { name: "Post Fade Phenom", cat: "Finishing", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Post Control", t: [60, 70, 79, 84, 90] }, { stat: "Midrange Shot", t: [61, 71, 80, 90, 94] }] },
  { name: "Post Powerhouse", cat: "Finishing", h: [ft("6'4"), ft("7'4")], attrs: [
    { stat: "Post Control", t: [64, 75, 85, 93, 98] }, { stat: "Strength", t: [70, 79, 86, 95, 96] }] },
  { name: "Post-Up Poet", cat: "Finishing", h: [ft("6'0"), ft("7'4")], attrs: [
    { stat: "Post Control", t: [67, 77, 87, 95, 99] }] },
  { name: "Posterizer", cat: "Finishing", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Driving Dunk", t: [73, 87, 93, 96, 99] }, { stat: "Vertical", t: [65, 75, 80, 85, 90] }] },
  { name: "Rise Up", cat: "Finishing", h: [ft("6'6"), ft("7'4")], attrs: [
    { stat: "Standing Dunk", t: [72, 81, 90, 95, 99] }, { stat: "Vertical", t: [60, 62, 66, 69, 71] }] },
  // Defense
  { name: "Challenger", cat: "Defense", h: [ft("5'9"), ft("6'11")], attrs: [
    { stat: "Perimeter Defense", t: [71, 82, 92, 95, 99] }] },
  { name: "Glove", cat: "Defense", h: [ft("5'9"), ft("7'0")], attrs: [
    { stat: "Steal", t: [67, 79, 91, 96, 99] }] },
  { name: "High-Flying Denier", cat: "Defense", h: [ft("6'3"), ft("7'4")], attrs: [
    { stat: "Block", t: [68, 78, 88, 92, 99] }, { stat: "Vertical", t: [60, 74, 80, 83, 85] }] },
  { name: "Immovable Enforcer", cat: "Defense", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Perimeter Defense", t: [62, 72, 84, 89, 94] }, { stat: "Strength", t: [71, 82, 85, 91, 92] }] },
  { name: "Interceptor", cat: "Defense", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Steal", t: [60, 73, 85, 94, 98] }] },
  { name: "Off-Ball Pest", cat: "Defense", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Interior Defense", t: [69, 76, 85, 94, 97] }, { stat: "Perimeter Defense", t: [58, 68, 80, 87, 98] }] },
  { name: "On-Ball Menace", cat: "Defense", h: [ft("5'9"), ft("6'9")], attrs: [
    { stat: "Perimeter Defense", t: [74, 85, 91, 96, 99] }, { stat: "Agility", t: [70, 76, 80, 84, 86] }] },
  { name: "Paint Patroller", cat: "Defense", h: [ft("6'6"), ft("7'4")], attrs: [
    { stat: "Interior Defense", t: [60, 70, 77, 84, 89] }, { stat: "Block", t: [74, 84, 93, 97, 99] }] },
  { name: "Pick Dodger", cat: "Defense", h: [ft("5'9"), ft("6'10")], attrs: [
    { stat: "Perimeter Defense", t: [73, 83, 90, 97, 99] }, { stat: "Agility", t: [71, 75, 79, 85, 92] }] },
  { name: "Post Lockdown", cat: "Defense", h: [ft("6'5"), ft("7'4")], attrs: [
    { stat: "Interior Defense", t: [74, 82, 88, 93, 99] }, { stat: "Strength", t: [70, 78, 84, 92, 97] }] },
  // Rebounding
  { name: "Boxout Beast", any: true, cat: "Rebounding", h: [ft("6'3"), ft("7'4")], attrs: [
    { stat: "Offensive Rebound", t: [55, 70, 85, 94, 98] }, { stat: "Defensive Rebound", t: [55, 70, 85, 94, 98] }] },
  { name: "Rebound Chaser", any: true, cat: "Rebounding", h: [ft("5'9"), ft("7'4")], attrs: [
    { stat: "Offensive Rebound", t: [60, 80, 92, 96, 99] }, { stat: "Defensive Rebound", t: [60, 80, 92, 96, 99] }] },
  // General / Athleticism
  { name: "Brick Wall", cat: "General", h: [ft("6'5"), ft("7'4")], attrs: [
    { stat: "Strength", t: [72, 83, 91, 95, 99] }] },
  { name: "Slippery Off-Ball", cat: "General", h: [ft("5'9"), ft("6'9")], attrs: [
    { stat: "Speed", t: [57, 73, 85, 92, 99] }, { stat: "Agility", t: [57, 65, 77, 88, 96] }] },
  { name: "Pogo Stick", cat: "General", h: [ft("6'4"), ft("7'4")], attrs: [
    { stat: "Vertical", t: [63, 70, 77, 83, 88] }] },
],
};
if (typeof module !== "undefined" && module.exports) module.exports = BADGES_DATA;

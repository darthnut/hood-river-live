// Live sky data from outside sources (ISS and Starlink orbits, bright comets). Until a feed is loaded
// its eggs only play their demo when triggered; everything else in the sky is computed locally.
export const feeds = {
  iss: null,      // { visible(ms) -> [az, el] | null }
  starlink: null, // { visible(ms) -> [[az, el], ...] }
  comets: null,   // { bright(ms) -> [[name, mag, az, el, tailAngle], ...] }
};
export const issVisible = ms => (feeds.iss ? feeds.iss.visible(ms) : null);
export const starlinkVisible = ms => (feeds.starlink ? feeds.starlink.visible(ms) : []);
export const cometsBright = ms => (feeds.comets ? feeds.comets.bright(ms) : []);

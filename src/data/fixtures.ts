export type EditorialEpisode = {
  id: string;
  number: number;
  title: string;
  synopsis: string;
  duration: string;
  image: string;
};

export type EditorialSeason = {
  number: number;
  episodes: EditorialEpisode[];
};

export type EditorialTitle = {
  id: string;
  title: string;
  kind: 'movie' | 'series';
  year: number;
  rating: string;
  maturity: string;
  match: number;
  genres: string[];
  synopsis: string;
  cast: string[];
  creators: string[];
  poster: string;
  backdrop: string;
  badge?: string;
  rank?: number;
  releaseDate?: string;
  seasons: EditorialSeason[];
};

const art = {
  night: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800&q=80',
  city: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
  sea: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
  desert: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80',
  forest: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
  mountain: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  stars: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80',
  road: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80',
  rain: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800&q=80',
};

const episodeArt = [
  'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800&q=80',
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
];

function episode(id: string, number: number, title: string, synopsis: string, duration: string, image: string): EditorialEpisode {
  return { id: `${id}-s1-e${number}`, number, title, synopsis, duration, image };
}

const nightShiftEpisodes = [
  episode('night-shift', 1, 'The Vault', 'A routine handoff reveals a second ledger and a crew that was never meant to exist.', '48 min', episodeArt[0]),
  episode('night-shift', 2, 'Dead Frequency', 'A silent alarm sends the team into a city-wide search for one missing signal.', '51 min', episodeArt[1]),
  episode('night-shift', 3, 'The Long Way Down', 'Mara follows a clue beneath the financial district while trust inside the crew begins to fracture.', '46 min', episodeArt[2]),
];

const upcomingDates: Record<string, string> = {
  'open-water': 'Nov 14, 2026', 'red-weather': 'Nov 21, 2026', 'hollow-crown': 'Nov 28, 2026',
  'far-country': 'Dec 05, 2026', 'soft-focus': 'Dec 12, 2026', 'daybreak-club': 'Dec 19, 2026',
};

function title(
  id: string,
  name: string,
  kind: EditorialTitle['kind'],
  poster: string,
  backdrop: string,
  genres: string[],
  synopsis: string,
  rank?: number,
): EditorialTitle {
  const series = kind === 'series';
  return {
    id, title: name, kind, year: 2025, rating: '8.4', maturity: 'TV-MA', match: 98,
    genres, synopsis,
    cast: ['Ari Vale', 'Mina Sol', 'Theo Park'],
    creators: ['Rhea Morgan', 'Jonas Reed'],
    poster, backdrop, rank, releaseDate: upcomingDates[id],
    badge: rank ? `#${rank} in ${series ? 'TV Shows' : 'Movies'} Today` : undefined,
    seasons: series ? [{ number: 1, episodes: id === 'night-shift' ? nightShiftEpisodes : [
      episode(id, 1, 'First Light', 'An unexpected discovery changes the shape of the story.', '44 min', poster),
      episode(id, 2, 'Crossing Lines', 'A new ally arrives with a dangerous condition.', '47 min', backdrop),
    ] }] : [],
  };
}

export const editorialTitles: EditorialTitle[] = [
  title('night-shift', 'Night Shift', 'series', art.night, art.city, ['Gritty', 'Heist', 'Thriller'], 'At 2:17 a.m., a night auditor discovers that the city’s most secure vault has been opened from the inside. One quiet decision pulls her into a heist that has been running for twelve years.', 2),
  title('blue-hour', 'Blue Hour', 'series', art.sea, art.night, ['Mystery', 'Drama'], 'On a remote island, the tide returns objects that disappeared decades ago — and one family knows why.', 1),
  title('the-last-signal', 'The Last Signal', 'movie', art.mountain, art.stars, ['Sci-Fi', 'Adventure'], 'A radio astronomer receives a message that appears to have been sent from Earth fifty years in the future.', 3),
  title('paper-kingdom', 'Paper Kingdom', 'series', art.forest, art.road, ['Fantasy', 'Drama'], 'A cartographer maps a kingdom that changes shape whenever its ruler falls asleep.'),
  title('redline', 'Redline', 'movie', art.city, art.road, ['Action', 'Crime'], 'A getaway driver has one night to return a stolen car before its hidden passenger wakes up.'),
  title('quiet-earth', 'Quiet Earth', 'series', art.desert, art.mountain, ['Post-apocalyptic', 'Drama'], 'After the world goes silent, a small-town mechanic follows a trail of lights across the empty plains.'),
  title('glass-harbor', 'Glass Harbor', 'movie', art.sea, art.city, ['Noir', 'Mystery'], 'A marine salvage diver finds a camera that contains tomorrow’s missing-person report.'),
  title('second-sun', 'Second Sun', 'series', art.stars, art.desert, ['Sci-Fi', 'Mystery'], 'A second sun appears over the Pacific, and only one observatory can see what is orbiting it.'),
  title('wild-meridian', 'Wild Meridian', 'movie', art.forest, art.mountain, ['Adventure', 'Drama'], 'Two estranged sisters inherit a wilderness lodge with a map to something neither remembers.'),
  title('borrowed-time', 'Borrowed Time', 'series', art.road, art.night, ['Thriller', 'Drama'], 'A paramedic begins receiving calls from patients hours before their accidents happen.'),
  title('velvet-static', 'Velvet Static', 'movie', art.city, art.night, ['Music', 'Drama'], 'A late-night radio host tries to reunite a band whose final song was never recorded.'),
  title('north-of-nowhere', 'North of Nowhere', 'series', art.mountain, art.forest, ['Survival', 'Mystery'], 'A rescue team finds a village missing from every map and every satellite image.'),
  title('small-hours', 'Small Hours', 'movie', art.night, art.city, ['Romance', 'Drama'], 'Two strangers share the last train across a city that refuses to sleep.'),
  title('orbit-house', 'Orbit House', 'series', art.stars, art.mountain, ['Sci-Fi', 'Comedy'], 'Six unlikely housemates discover their apartment is drifting through a forgotten corner of space.'),
  title('salt-and-cinder', 'Salt & Cinder', 'movie', art.desert, art.sea, ['Historical', 'Drama'], 'A lighthouse keeper and a glassmaker rebuild a coastal town after a storm erases its harbour.'),
  title('the-green-room', 'The Green Room', 'series', art.forest, art.city, ['Comedy', 'Workplace'], 'A struggling theatre company gets one final season to save its century-old stage.'),
  title('after-the-flood', 'After the Flood', 'movie', art.sea, art.road, ['Drama', 'Mystery'], 'A town returns to the surface and discovers that one street has not aged a single day.'),
  title('black-ice', 'Black Ice', 'series', art.mountain, art.night, ['Crime', 'Thriller'], 'A winter-road inspector finds evidence that every crash on her route was carefully arranged.'),
  title('daybreak-club', 'Daybreak Club', 'movie', art.city, art.stars, ['Comedy', 'Coming-of-age'], 'Four friends meet at sunrise to finish the promises they made as teenagers.'),
  title('far-country', 'Far Country', 'series', art.road, art.desert, ['Western', 'Drama'], 'A travelling doctor crosses a border town where every resident is hiding the same secret.'),
  title('hollow-crown', 'Hollow Crown', 'movie', art.forest, art.night, ['Fantasy', 'Adventure'], 'A young archivist finds a crown that grants its wearer the memories of a vanished kingdom.'),
  title('soft-focus', 'Soft Focus', 'series', art.sea, art.city, ['Romance', 'Comedy'], 'A wedding photographer starts seeing the futures of couples through her camera lens.'),
  title('red-weather', 'Red Weather', 'movie', art.desert, art.stars, ['Disaster', 'Thriller'], 'A meteorologist has six hours to convince a city that the storm on the horizon is not a storm.'),
  title('open-water', 'Open Water', 'series', art.sea, art.mountain, ['Adventure', 'Mystery'], 'A research vessel follows a distress beacon that moves faster than the ship can sail.'),
];

export const editorialCollections = [
  { id: 'trending', title: 'Trending on panda.fun', eyebrow: 'The conversation starts here', items: editorialTitles.slice(0, 10) },
  { id: 'top-ten', title: 'Top 10 Shows Today', eyebrow: 'Ranked by the Panda crowd', items: editorialTitles.filter(item => item.kind === 'series').slice(0, 10) },
  { id: 'originals', title: 'Only on panda.fun', eyebrow: 'Stories from our world', items: editorialTitles.slice(10, 18) },
  { id: 'drama', title: 'Award-winning Dramas', eyebrow: 'Stay for the story', items: editorialTitles.filter(item => item.genres.includes('Drama')).slice(0, 8) },
  { id: 'new-releases', title: 'New Releases', eyebrow: 'Freshly added', items: editorialTitles.slice(18) },
];

export function getEditorialTitle(id: string): EditorialTitle | undefined {
  return editorialTitles.find(item => item.id === id);
}

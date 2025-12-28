import React, { useState, useEffect } from 'react';
import { Search, Music, User, Globe, X, Play, ExternalLink, Copy, Heart } from 'lucide-react';
import { ArtistPayment } from './ArtistPayment';
import type { ArtistProfile, DecentralizedTrack, Track } from '../types';

interface BrowseMusicProps {
  onClose: () => void;
  onPlayTrack: (track: Track) => void;
  addToast: (message: string) => void;
}

interface CatalogArtist {
  id: string;
  name: string;
  genres: string[];
  avatar?: string;
  wallets?: {
    lightning?: string;
    monero?: string;
    bitcoin?: string;
    ethereum?: string;
  };
  releases: {
    id: string;
    title: string;
    coverArt?: string;
    tracks: DecentralizedTrack[];
  }[];
}

export const BrowseMusic: React.FC<BrowseMusicProps> = ({ onClose, onPlayTrack, addToast }) => {
  const [artists, setArtists] = useState<CatalogArtist[]>([]);
  const [genres, setGenres] = useState<{ id: string; name: string; trackCount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<CatalogArtist | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Load catalog from GitHub
  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);

      // Fetch artists catalog
      const artistsResponse = await fetch('/catalog/artists.json');
      const artistsData = await artistsResponse.json();

      // Fetch genres
      const genresResponse = await fetch('/catalog/genres.json');
      const genresData = await genresResponse.json();

      setArtists(artistsData.artists || []);
      setGenres(genresData.genres || []);

      if (artistsData.artists?.length === 0) {
        addToast('No artists yet - be the first to upload!');
      }
    } catch (error) {
      console.error('Failed to load catalog:', error);
      addToast('Failed to load music catalog');
      setArtists([]);
      setGenres([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter artists by search and genre
  const filteredArtists = artists.filter(artist => {
    const matchesSearch = searchQuery === '' ||
      artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.releases.some(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre = !selectedGenre ||
      artist.genres.some(g => g.toLowerCase() === selectedGenre.toLowerCase());

    return matchesSearch && matchesGenre;
  });

  const handlePlayTrack = (track: DecentralizedTrack) => {
    // Convert DecentralizedTrack to Track for the player
    const playableTrack: Track = {
      id: track.id,
      name: track.name,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      url: track.url,
      coverArtUrl: track.coverArtUrl,
      type: 'stream'
    };

    onPlayTrack(playableTrack);
    addToast(`Playing: ${track.name}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="text-cyan-400" size={24} />
            <h2 className="text-2xl font-bold text-white">Browse Music</h2>
            {artists.length > 0 && (
              <span className="text-sm text-zinc-500">
                {artists.length} {artists.length === 1 ? 'artist' : 'artists'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-6 border-b border-zinc-800 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artists, tracks, albums..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Genre Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGenre(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedGenre === null
                  ? 'bg-cyan-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              All Genres
            </button>
            {genres.map(genre => (
              <button
                key={genre.id}
                onClick={() => setSelectedGenre(genre.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedGenre === genre.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                }`}
              >
                {genre.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                <p className="text-zinc-400">Loading music catalog...</p>
              </div>
            </div>
          ) : selectedArtist ? (
            /* Artist Detail View */
            <div>
              <button
                onClick={() => setSelectedArtist(null)}
                className="mb-6 text-cyan-400 hover:text-cyan-300 flex items-center gap-2"
              >
                ← Back to artists
              </button>

              <div className="mb-8">
                <div className="flex items-start gap-6">
                  {selectedArtist.avatar ? (
                    <img
                      src={selectedArtist.avatar}
                      alt={selectedArtist.name}
                      className="w-32 h-32 rounded-full object-cover border-2 border-zinc-700"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700">
                      <User size={48} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-white mb-2">{selectedArtist.name}</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedArtist.genres.map(genre => (
                        <span key={genre} className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Releases */}
              <div className="space-y-6">
                {selectedArtist.releases.map(release => (
                  <div key={release.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                    <div className="flex items-start gap-4 mb-4">
                      {release.coverArt ? (
                        <img
                          src={release.coverArt}
                          alt={release.title}
                          className="w-20 h-20 rounded object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded bg-zinc-700 flex items-center justify-center">
                          <Music size={32} className="text-zinc-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-white mb-1">{release.title}</h4>
                        <p className="text-sm text-zinc-400">{release.tracks.length} {release.tracks.length === 1 ? 'track' : 'tracks'}</p>
                      </div>
                    </div>

                    {/* Track List */}
                    <div className="space-y-2">
                      {release.tracks.map((track, index) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-700/50 transition-colors group"
                        >
                          <span className="text-zinc-500 text-sm w-6">{index + 1}</span>
                          <div className="flex-1">
                            <p className="text-white font-medium">{track.name}</p>
                            {track.duration && (
                              <p className="text-sm text-zinc-400">
                                {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handlePlayTrack(track)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-cyan-500 rounded-full text-white"
                            title="Play track"
                          >
                            <Play size={20} fill="currentColor" />
                          </button>
                          {track.ipfsHash && (
                            <a
                              href={`https://ipfs.io/ipfs/${track.ipfsHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-zinc-600 rounded-full text-zinc-400 hover:text-white"
                              title="View on IPFS"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                          {selectedArtist.wallets && Object.keys(selectedArtist.wallets).length > 0 && (
                            <button
                              onClick={() => setShowPayment(true)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-pink-500 rounded-full text-pink-400 hover:text-white"
                              title="Support Artist"
                            >
                              <Heart size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredArtists.length === 0 ? (
            /* Empty State */
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <Music className="mx-auto mb-4 text-zinc-600" size={64} />
                <h3 className="text-xl font-bold text-white mb-2">
                  {searchQuery || selectedGenre ? 'No results found' : 'No music yet'}
                </h3>
                <p className="text-zinc-400 mb-6">
                  {searchQuery || selectedGenre
                    ? 'Try adjusting your search or filters'
                    : 'Be the first artist to upload music to Penko-tune!'}
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                >
                  {searchQuery || selectedGenre ? 'Clear Filters' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            /* Artist Grid */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredArtists.map(artist => (
                <div
                  key={artist.id}
                  onClick={() => setSelectedArtist(artist)}
                  className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-cyan-500 transition-colors cursor-pointer group"
                >
                  {artist.avatar ? (
                    <img
                      src={artist.avatar}
                      alt={artist.name}
                      className="w-full aspect-square rounded-lg object-cover mb-3 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-zinc-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <User size={48} className="text-zinc-500" />
                    </div>
                  )}
                  <h3 className="text-white font-semibold mb-1 truncate">{artist.name}</h3>
                  <p className="text-sm text-zinc-400">
                    {artist.releases.reduce((sum, r) => sum + r.tracks.length, 0)} {' '}
                    {artist.releases.reduce((sum, r) => sum + r.tracks.length, 0) === 1 ? 'track' : 'tracks'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {artist.genres.slice(0, 2).map(genre => (
                      <span key={genre} className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Artist Payment Modal */}
      {showPayment && selectedArtist && (
        <ArtistPayment
          artistName={selectedArtist.name}
          wallets={selectedArtist.wallets}
          suggestedPrice={0} // Can be set per-track if needed
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Upload, User, Music, DollarSign, Info, Check, Loader, Link as LinkIcon, QrCode, HelpCircle, ExternalLink } from 'lucide-react';
// TODO: IPFS/WebTorrent integration coming soon - needs server-side upload endpoint
// import { uploadToIPFS, uploadJSONToIPFS, getIPFSGateways } from '../utils/ipfs';
// import { seedFile, getWebTorrentClient } from '../utils/webtorrent';
import type { ArtistProfile, DecentralizedTrack } from '../types';

interface ArtistPortalProps {
  onClose: () => void;
  addToast: (message: string) => void;
}

type UploadStep = 'profile' | 'track-select' | 'track-metadata' | 'uploading' | 'complete';

export const ArtistPortal: React.FC<ArtistPortalProps> = ({ onClose, addToast }) => {
  const [currentStep, setCurrentStep] = useState<UploadStep>('profile');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Artist Profile State
  const [profile, setProfile] = useState<Partial<ArtistProfile>>({
    name: '',
    bio: '',
    genres: [],
    socialLinks: {},
    wallets: {},
  });

  // Track Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
  const [trackMetadata, setTrackMetadata] = useState<Partial<DecentralizedTrack>>({
    name: '',
    artist: '',
    album: '',
    price: 0,
    license: 'all-rights-reserved',
    type: 'stream',
  });

  // Upload Results
  const [uploadedTrack, setUploadedTrack] = useState<{
    ipfsHash: string;
    magnetLink: string;
    gateways: string[];
  } | null>(null);

  const handleProfileChange = (field: keyof ArtistProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [platform]: value },
    }));
  };

  const handleWalletChange = (crypto: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      wallets: { ...prev.wallets, [crypto]: value },
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(mp3|flac|wav|ogg|m4a)$/i)) {
        addToast('Please select a valid audio file (MP3, FLAC, WAV, OGG, M4A)');
        return;
      }
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        addToast('File too large. Maximum size is 100MB.');
        return;
      }
      setSelectedFile(file);
      setTrackMetadata(prev => ({
        ...prev,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        artist: profile.name || '',
      }));
      setCurrentStep('track-metadata');
    }
  };

  const handleCoverArtSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
        addToast('Please select a valid image file (JPG, PNG, WEBP)');
        return;
      }
      setCoverArtFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      addToast('No file selected');
      return;
    }

    // For now, show coming soon message with Web3.Storage instructions
    setCurrentStep('complete');
    setUploadedTrack({
      ipfsHash: 'Coming soon - Web3.Storage integration in progress',
      magnetLink: 'magnet:?xt=urn:btih:COMING_SOON',
      gateways: [
        'https://web3.storage - Free IPFS uploads',
        'https://ipfs.io/ipfs/YOUR_HASH',
        'https://cloudflare-ipfs.com/ipfs/YOUR_HASH',
      ],
    });
    addToast('Profile saved! Upload functionality coming soon.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="text-cyan-400" size={24} />
            <h2 className="text-2xl font-bold text-white">Artist Portal</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress Steps */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'track-select', label: 'Select Track', icon: Upload },
              { id: 'track-metadata', label: 'Metadata', icon: Music },
              { id: 'uploading', label: 'Upload', icon: Loader },
              { id: 'complete', label: 'Share', icon: Check },
            ].map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const stepIndex = ['profile', 'track-select', 'track-metadata', 'uploading', 'complete'].indexOf(currentStep);
              const isCompleted = index < stepIndex;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      isActive
                        ? 'border-cyan-400 bg-cyan-400/20 text-cyan-400'
                        : isCompleted
                        ? 'border-green-500 bg-green-500/20 text-green-500'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <span className={`ml-2 text-sm ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                    {step.label}
                  </span>
                  {index < 4 && <div className="w-12 h-0.5 bg-zinc-800 mx-2" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Artist Profile */}
          {currentStep === 'profile' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
                <Info className="text-cyan-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-cyan-200">
                  <p className="font-medium mb-1">First time here?</p>
                  <p>Create your artist profile to start uploading music. You'll need at least one crypto wallet to receive payments. See the <a href="/ARTIST_MANUAL.md" target="_blank" className="underline">Artist Manual</a> for full details.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Artist Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Your artist or band name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Bio</label>
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400 h-24 resize-none"
                  placeholder="Tell fans about yourself..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Genres (comma-separated)</label>
                <input
                  type="text"
                  value={profile.genres?.join(', ') || ''}
                  onChange={(e) => handleProfileChange('genres', e.target.value.split(',').map(g => g.trim()))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Rock, Electronic, Jazz"
                />
              </div>

              <div className="border-t border-zinc-800 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={20} className="text-green-400" />
                  Payment Wallets (at least one required)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                      Lightning Network Address
                      <HelpCircle size={14} className="text-zinc-500" title="Format: yourname@wallet.com or LNURL" />
                    </label>
                    <input
                      type="text"
                      value={profile.wallets?.lightning || ''}
                      onChange={(e) => handleWalletChange('lightning', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="you@getalby.com or LNURL..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Monero (XMR) Address</label>
                    <input
                      type="text"
                      value={profile.wallets?.monero || ''}
                      onChange={(e) => handleWalletChange('monero', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="4A... (starts with 4)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Bitcoin (BTC) Address</label>
                    <input
                      type="text"
                      value={profile.wallets?.bitcoin || ''}
                      onChange={(e) => handleWalletChange('bitcoin', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="bc1... or 1... or 3..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Ethereum Address</label>
                    <input
                      type="text"
                      value={profile.wallets?.ethereum || ''}
                      onChange={(e) => handleWalletChange('ethereum', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="0x..."
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!profile.name) {
                    addToast('Please enter your artist name');
                    return;
                  }
                  const hasWallet = Object.values(profile.wallets || {}).some(w => w);
                  if (!hasWallet) {
                    addToast('Please add at least one payment wallet');
                    return;
                  }
                  setProfile({ ...profile, id: crypto.randomUUID(), createdAt: Date.now() });
                  setCurrentStep('track-select');
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Continue to Upload Track
              </button>
            </div>
          )}

          {/* Step 2: Track Selection */}
          {currentStep === 'track-select' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
                <Info className="text-cyan-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-cyan-200">
                  <p className="font-medium mb-1">Important: Keep browser open for 15-30 minutes</p>
                  <p>After uploading, your song will be stored permanently on IPFS. To enable fast WebTorrent streaming, keep this tab open for 15-30 minutes so other fans can connect and start seeding.</p>
                </div>
              </div>

              <label className="block border-2 border-dashed border-zinc-700 hover:border-cyan-400 rounded-lg p-12 text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="audio/mpeg,audio/flac,audio/wav,audio/ogg,audio/m4a"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="mx-auto mb-4 text-zinc-500" size={48} />
                <p className="text-white font-medium mb-1">Click to select audio file</p>
                <p className="text-zinc-400 text-sm">MP3, FLAC, WAV, OGG, M4A (max 100MB)</p>
              </label>

              <button
                onClick={() => setCurrentStep('profile')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Back to Profile
              </button>
            </div>
          )}

          {/* Step 3: Track Metadata */}
          {currentStep === 'track-metadata' && selectedFile && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-400 mb-1">Selected File:</p>
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-sm text-zinc-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Track Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={trackMetadata.name || ''}
                  onChange={(e) => setTrackMetadata({ ...trackMetadata, name: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Song title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Album (optional)</label>
                <input
                  type="text"
                  value={trackMetadata.album || ''}
                  onChange={(e) => setTrackMetadata({ ...trackMetadata, album: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Album or EP name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Cover Art (optional)</label>
                <label className="block border-2 border-dashed border-zinc-700 hover:border-cyan-400 rounded-lg p-6 text-center cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleCoverArtSelect}
                    className="hidden"
                  />
                  {coverArtFile ? (
                    <p className="text-green-400 text-sm">{coverArtFile.name}</p>
                  ) : (
                    <>
                      <Upload className="mx-auto mb-2 text-zinc-500" size={32} />
                      <p className="text-zinc-400 text-sm">Click to select cover art (JPG, PNG, WEBP)</p>
                    </>
                  )}
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">License</label>
                <select
                  value={trackMetadata.license || 'all-rights-reserved'}
                  onChange={(e) => setTrackMetadata({ ...trackMetadata, license: e.target.value as any })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="all-rights-reserved">All Rights Reserved</option>
                  <option value="cc0">CC0 (Public Domain)</option>
                  <option value="cc-by">CC BY (Attribution)</option>
                  <option value="cc-by-sa">CC BY-SA (Attribution ShareAlike)</option>
                  <option value="cc-by-nc">CC BY-NC (Attribution NonCommercial)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                  Price (USD)
                  <HelpCircle size={14} className="text-zinc-500" title="Set to 0 for free, or any amount for Pay What You Want" />
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={trackMetadata.price || 0}
                  onChange={(e) => setTrackMetadata({ ...trackMetadata, price: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="0.00"
                />
                <p className="text-sm text-zinc-500 mt-1">Suggested: $1 for single, $5-10 for album. Set to $0 for free.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('track-select')}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Upload to IPFS + WebTorrent
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Uploading */}
          {currentStep === 'uploading' && (
            <div className="space-y-6 max-w-2xl mx-auto text-center py-12">
              <Loader className="mx-auto text-cyan-400 animate-spin" size={64} />
              <div>
                <p className="text-white font-medium text-lg mb-2">{uploadStatus}</p>
                <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress * 100}%` }}
                  />
                </div>
                <p className="text-zinc-400 text-sm mt-2">{Math.round(uploadProgress * 100)}%</p>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 'complete' && uploadedTrack && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center py-6">
                <Info className="mx-auto text-cyan-400 mb-4" size={64} />
                <h3 className="text-2xl font-bold text-white mb-2">Profile Created!</h3>
                <p className="text-zinc-400">Upload functionality coming soon via Web3.Storage</p>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
                <Info className="text-cyan-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-cyan-200">
                  <p className="font-medium mb-2">Next Steps - Submit Your Music via GitHub</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Upload your music to <a href="https://web3.storage" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-100">web3.storage</a> (free IPFS storage)</li>
                    <li>Copy the IPFS CID hash they provide</li>
                    <li>Create a GitHub Pull Request with your metadata</li>
                    <li>Our automated system validates and publishes your music</li>
                  </ol>
                  <p className="mt-3 font-medium">
                    📖 <a href="/catalog/HOW_TO_SUBMIT.md" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-100">
                      Read the full submission guide
                    </a> for step-by-step instructions!
                  </p>
                  <p className="mt-2 text-xs text-cyan-300">
                    ⚡ Fully automated - your music goes live within 5 minutes after PR approval!
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">IPFS Hash (Permanent Storage)</label>
                  <div className="bg-zinc-800 rounded-lg p-3 flex items-center gap-2">
                    <code className="text-cyan-400 text-sm flex-1 break-all">{uploadedTrack.ipfsHash}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(uploadedTrack.ipfsHash);
                        addToast('IPFS hash copied!');
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">WebTorrent Magnet Link</label>
                  <div className="bg-zinc-800 rounded-lg p-3 flex items-center gap-2">
                    <code className="text-green-400 text-sm flex-1 break-all line-clamp-2">{uploadedTrack.magnetLink}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(uploadedTrack.magnetLink);
                        addToast('Magnet link copied!');
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Share Links (IPFS Gateways)</label>
                  <div className="space-y-2">
                    {uploadedTrack.gateways.map((gateway, index) => (
                      <div key={index} className="bg-zinc-800 rounded-lg p-3 flex items-center gap-2">
                        <code className="text-blue-400 text-sm flex-1 break-all">{gateway}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(gateway);
                            addToast('Gateway link copied!');
                          }}
                          className="text-zinc-400 hover:text-white"
                        >
                          📋
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCurrentStep('track-select');
                    setSelectedFile(null);
                    setCoverArtFile(null);
                    setUploadedTrack(null);
                  }}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Upload Another Track
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

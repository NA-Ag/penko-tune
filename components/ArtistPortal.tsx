import React, { useState, useRef } from 'react';
import { X, Upload, Music, Image as ImageIcon, Loader2, Check, Copy, Share2 } from 'lucide-react';
import { uploadToIPFS, uploadJSONToIPFS } from '../utils/ipfs';
import { seedFile } from '../utils/webtorrent';
import { DecentralizedTrack, Release } from '../types';

interface ArtistPortalProps {
  onClose: () => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
}

export function ArtistPortal({ onClose, addToast }: ArtistPortalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Details, 2: Uploading, 3: Success
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form State
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  
  // Result State
  const [result, setResult] = useState<{
    ipfsHash?: string;
    magnetLink?: string;
    metadataCid?: string;
  } | null>(null);

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setAudioFile(e.target.files[0]);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCoverFile(e.target.files[0]);
  };

  const handlePublish = async () => {
    if (!audioFile || !title || !artist) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setIsUploading(true);
    setStep(2);
    setUploadProgress(0);

    try {
      // 1. Upload Audio to IPFS
      addToast("Uploading audio to IPFS...");
      const audioCid = await uploadToIPFS(audioFile, (prog) => setUploadProgress(prog * 0.4));
      
      // 2. Upload Cover to IPFS (if exists)
      let coverCid = '';
      if (coverFile) {
        addToast("Uploading cover art...");
        coverCid = await uploadToIPFS(coverFile, (prog) => setUploadProgress(0.4 + (prog * 0.2)));
      }

      // 3. Start Seeding via WebTorrent (Hybrid approach)
      addToast("Generating P2P Magnet Link...");
      let magnetLink = '';
      try {
        const torrent = await seedFile(audioFile, (magnet) => {
            console.log('Seeding:', magnet);
        });
        if (torrent) magnetLink = torrent.magnetURI;
      } catch (e) {
        console.warn("WebTorrent seeding failed, falling back to IPFS only", e);
      }
      setUploadProgress(0.8);

      // 4. Create Metadata Object
      const trackMetadata: DecentralizedTrack = {
        id: crypto.randomUUID(),
        name: title,
        artist: artist,
        url: `ipfs://${audioCid}`, // Canonical IPFS URL
        coverArtUrl: coverCid ? `https://ipfs.io/ipfs/${coverCid}` : undefined,
        type: 'stream',
        ipfsHash: audioCid,
        torrentMagnetLink: magnetLink,
        duration: 0, // TODO: Extract duration
        createdAt: Date.now()
      } as any; // Cast to avoid strict type checking on optional fields for now

      // 5. Upload Metadata
      addToast("Publishing metadata...");
      const metadataCid = await uploadJSONToIPFS(trackMetadata);
      setUploadProgress(1);

      setResult({
        ipfsHash: audioCid,
        magnetLink,
        metadataCid
      });
      setStep(3);
      addToast("Published successfully!");

    } catch (error) {
      console.error(error);
      addToast("Upload failed. See console for details.", "error");
      setStep(1);
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Artist Portal</h2>
              <p className="text-xs text-zinc-400">Publish to the Decentralized Web</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Audio Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Audio File *</label>
                  <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${audioFile ? 'border-purple-500/50 bg-purple-500/5' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'}`}>
                    <input type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" id="audio-upload" />
                    <label htmlFor="audio-upload" className="cursor-pointer w-full h-full flex flex-col items-center">
                      {audioFile ? (
                        <>
                          <Music size={48} className="text-purple-400 mb-4" />
                          <p className="text-sm font-medium text-white break-all">{audioFile.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">{(audioFile.size / (1024*1024)).toFixed(2)} MB</p>
                        </>
                      ) : (
                        <>
                          <Upload size={48} className="text-zinc-600 mb-4" />
                          <p className="text-sm font-medium text-zinc-300">Click to upload audio</p>
                          <p className="text-xs text-zinc-500 mt-1">MP3, FLAC, WAV, OGG</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Cover Art Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Cover Art</label>
                  <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${coverFile ? 'border-purple-500/50 bg-purple-500/5' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'}`}>
                    <input type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" id="cover-upload" />
                    <label htmlFor="cover-upload" className="cursor-pointer w-full h-full flex flex-col items-center">
                      {coverFile ? (
                        <>
                          <img src={URL.createObjectURL(coverFile)} alt="Preview" className="w-24 h-24 object-cover rounded-lg mb-4 shadow-lg" />
                          <p className="text-sm font-medium text-white break-all">{coverFile.name}</p>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={48} className="text-zinc-600 mb-4" />
                          <p className="text-sm font-medium text-zinc-300">Click to upload cover</p>
                          <p className="text-xs text-zinc-500 mt-1">JPG, PNG, WEBP</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Track Title *</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Midnight City"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Artist Name *</label>
                  <input 
                    type="text" 
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="e.g. M83"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center h-64 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-zinc-800 flex items-center justify-center">
                  <Loader2 size={48} className="text-purple-500 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">Publishing to Network...</h3>
                <p className="text-zinc-400">Encrypting, Hashing, and Seeding</p>
              </div>
              <div className="w-full max-w-md bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-purple-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === 3 && result && (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-2">
                <Check size={40} />
              </div>
              <h3 className="text-2xl font-bold text-white">Published Successfully!</h3>
              <p className="text-zinc-400 text-center max-w-md">
                Your track is now live on the decentralized web. It is being seeded via WebTorrent and pinned to IPFS.
              </p>

              <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Shareable Metadata CID</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-zinc-900 p-3 rounded-lg text-xs font-mono text-purple-300 break-all">
                      {result.metadataCid}
                    </code>
                    <button onClick={() => copyToClipboard(result.metadataCid || '')} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                {result.magnetLink && (
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Magnet Link</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={result.magnetLink} 
                        className="flex-1 bg-zinc-900 p-3 rounded-lg text-xs font-mono text-zinc-400 focus:outline-none"
                      />
                      <button onClick={() => copyToClipboard(result.magnetLink || '')} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
          {step === 1 && (
            <>
              <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors">
                Cancel
              </button>
              <button 
                onClick={handlePublish}
                disabled={!audioFile || !title || !artist}
                className="px-6 py-3 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload size={18} />
                Publish Track
              </button>
            </>
          )}
          {step === 3 && (
            <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold bg-zinc-100 hover:bg-white text-zinc-900 transition-colors">
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
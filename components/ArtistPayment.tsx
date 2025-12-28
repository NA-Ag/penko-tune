import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Heart, Copy, Check, Zap, Shield, Bitcoin, Wallet, X } from 'lucide-react';

interface ArtistPaymentProps {
  artistName: string;
  wallets?: {
    lightning?: string;
    monero?: string;
    bitcoin?: string;
    ethereum?: string;
  };
  suggestedPrice?: number;
  onClose: () => void;
}

export const ArtistPayment: React.FC<ArtistPaymentProps> = ({
  artistName,
  wallets,
  suggestedPrice,
  onClose
}) => {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  if (!wallets || Object.keys(wallets).length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Support Artist</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <p className="text-zinc-400 text-center py-8">
            This artist hasn't configured payment options yet.
          </p>
        </div>
      </div>
    );
  }

  const handleCopy = async (address: string, type: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(type);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const walletOptions = [
    {
      id: 'lightning',
      name: 'Lightning Network',
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      address: wallets.lightning,
      description: 'Instant, low fees (~$0.001)',
      prefix: 'lightning:'
    },
    {
      id: 'monero',
      name: 'Monero (XMR)',
      icon: Shield,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      address: wallets.monero,
      description: 'Private, low fees (~$0.02)',
      prefix: 'monero:'
    },
    {
      id: 'bitcoin',
      name: 'Bitcoin (BTC)',
      icon: Bitcoin,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      address: wallets.bitcoin,
      description: 'Most established, higher fees',
      prefix: 'bitcoin:'
    },
    {
      id: 'ethereum',
      name: 'Ethereum / L2',
      icon: Wallet,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      address: wallets.ethereum,
      description: 'Supports tokens, moderate fees',
      prefix: 'ethereum:'
    }
  ].filter(option => option.address);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="text-pink-500" size={24} />
            <div>
              <h3 className="text-xl font-bold text-white">Support {artistName}</h3>
              {suggestedPrice && suggestedPrice > 0 && (
                <p className="text-sm text-zinc-400">Suggested: ${suggestedPrice.toFixed(2)}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedWallet ? (
            /* Wallet Selection */
            <div className="space-y-4">
              <p className="text-zinc-300 mb-6">
                Choose your payment method. Your payment goes <strong>directly to the artist</strong> - we never touch it!
              </p>

              {walletOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedWallet(option.id)}
                    className={`w-full p-4 rounded-lg border ${option.border} ${option.bg} hover:bg-opacity-20 transition-all text-left group`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full ${option.bg}`}>
                        <Icon className={option.color} size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold flex items-center gap-2">
                          {option.name}
                          <span className="text-xs text-zinc-500 font-normal">→</span>
                        </h4>
                        <p className="text-sm text-zinc-400">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-200">
                  <strong>100% goes to the artist.</strong> We take zero fees. Penko-tune is free forever.
                </p>
              </div>
            </div>
          ) : (
            /* QR Code Display */
            (() => {
              const selected = walletOptions.find(w => w.id === selectedWallet);
              if (!selected) return null;

              const Icon = selected.icon;
              const qrValue = selected.prefix + selected.address;

              return (
                <div className="space-y-6">
                  <button
                    onClick={() => setSelectedWallet(null)}
                    className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                  >
                    ← Back to payment methods
                  </button>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Icon className={selected.color} size={32} />
                      <h4 className="text-2xl font-bold text-white">{selected.name}</h4>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-6 rounded-lg inline-block mb-6">
                      <QRCodeSVG
                        value={qrValue}
                        size={256}
                        level="H"
                        includeMargin={true}
                      />
                    </div>

                    {/* Address */}
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 mb-4">
                      <label className="block text-sm text-zinc-400 mb-2">
                        {selected.name} Address
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="text-cyan-400 text-sm break-all flex-1 text-left">
                          {selected.address}
                        </code>
                        <button
                          onClick={() => handleCopy(selected.address!, selected.id)}
                          className="p-2 hover:bg-zinc-700 rounded transition-colors flex-shrink-0"
                          title="Copy address"
                        >
                          {copiedAddress === selected.id ? (
                            <Check className="text-green-400" size={20} />
                          ) : (
                            <Copy className="text-zinc-400" size={20} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="text-left bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-zinc-300 font-medium">How to pay:</p>
                      <ol className="text-sm text-zinc-400 space-y-1 list-decimal list-inside">
                        <li>Open your {selected.name} wallet app</li>
                        <li>Scan the QR code or paste the address</li>
                        <li>Enter the amount you want to send</li>
                        <li>Confirm the transaction</li>
                      </ol>
                      {suggestedPrice && suggestedPrice > 0 && (
                        <p className="text-sm text-cyan-400 mt-3">
                          💡 Suggested amount: ${suggestedPrice.toFixed(2)} (but pay what feels right!)
                        </p>
                      )}
                    </div>

                    {/* Popular Wallets */}
                    <div className="mt-6 text-left">
                      <p className="text-xs text-zinc-500 mb-2">Popular wallets:</p>
                      <div className="flex flex-wrap gap-2">
                        {selected.id === 'lightning' && (
                          <>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Wallet of Satoshi</span>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Phoenix</span>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Breez</span>
                          </>
                        )}
                        {selected.id === 'monero' && (
                          <>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Cake Wallet</span>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Monerujo</span>
                          </>
                        )}
                        {selected.id === 'bitcoin' && (
                          <>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">BlueWallet</span>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Electrum</span>
                          </>
                        )}
                        {selected.id === 'ethereum' && (
                          <>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">MetaMask</span>
                            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded">Rainbow</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

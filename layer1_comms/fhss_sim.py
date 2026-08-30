"""
FHSS Simulator
==============
Pseudo-random frequency-hopping spread spectrum sequence generator.
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class FHSSSimulator:
    """
    Models a Frequency-Hopping Spread Spectrum (FHSS) communications link.

    Parameters
    ----------
    n_channels : int
        Number of available hop channels (default 50).
    base_freq_mhz : float
        Base frequency in MHz (default 2400 — 2.4 GHz ISM band).
    channel_spacing_mhz : float
        Spacing between adjacent channels in MHz (default 1).
    hop_rate : float
        Hops per second (default 100).
    seed : int or None
        Seed for the pseudo-random hop sequence.
    """

    n_channels: int = 50
    base_freq_mhz: float = 2400.0
    channel_spacing_mhz: float = 1.0
    hop_rate: float = 100.0
    seed: Optional[int] = 42

    def __post_init__(self):
        self._rng = np.random.default_rng(self.seed)
        # Pre-generate a long hop sequence (can be extended if needed)
        self._sequence_len = 100_000
        self._hop_sequence = self._rng.integers(
            0, self.n_channels, size=self._sequence_len
        )

    @property
    def frequencies_mhz(self) -> np.ndarray:
        """Array of all channel center frequencies in MHz."""
        return self.base_freq_mhz + np.arange(self.n_channels) * self.channel_spacing_mhz

    def get_channel(self, t: float) -> int:
        """Return the active channel index at time *t* (seconds)."""
        hop_index = int(t * self.hop_rate) % self._sequence_len
        return int(self._hop_sequence[hop_index])

    def get_frequency(self, t: float) -> float:
        """Return the active frequency (MHz) at time *t*."""
        ch = self.get_channel(t)
        return self.base_freq_mhz + ch * self.channel_spacing_mhz

    def get_hop_series(self, times: np.ndarray) -> np.ndarray:
        """
        Vectorized: return channel indices for an array of timestamps.

        Parameters
        ----------
        times : np.ndarray, shape (N,)

        Returns
        -------
        channels : np.ndarray, shape (N,), dtype int
        """
        hop_indices = (times * self.hop_rate).astype(int) % self._sequence_len
        return self._hop_sequence[hop_indices]

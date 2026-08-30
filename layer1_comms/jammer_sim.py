"""
Jammer Models & Link-Quality Calculator
========================================
Three jammer archetypes (barrage, sweep, reactive) and a link-quality
calculator that maps SNR to packet success probability.
"""

import numpy as np
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


# ═══════════════════════════════════════════════════════════════════════
#  Jammer base class
# ═══════════════════════════════════════════════════════════════════════

class JammerModel(ABC):
    """
    Abstract base for jammer models.

    Every subclass must implement ``jsr_on_channel(t, active_channel)``
    which returns the Jammer-to-Signal Ratio *on the drone's current
    channel* in dB at time *t*.
    """

    @abstractmethod
    def jsr_on_channel(self, t: float, active_channel: int) -> float:
        """Return JSR (dB) on the drone's active channel at time *t*."""
        ...

    @abstractmethod
    def is_jammed(self, t: float, active_channel: int) -> bool:
        """Return True if the drone's channel is being jammed at time *t*."""
        ...


# ═══════════════════════════════════════════════════════════════════════
#  Barrage Jammer
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class BarrageJammer(JammerModel):
    """
    Spreads total jamming power uniformly across **all** N channels.

    Parameters
    ----------
    total_power_dBm : float
        Total jammer transmit power (dBm).  Default 30 dBm (1 W).
    n_channels : int
        Number of channels (must match FHSS config).
    """

    total_power_dBm: float = 30.0
    n_channels: int = 50

    @property
    def per_channel_power_dBm(self) -> float:
        return self.total_power_dBm - 10 * np.log10(self.n_channels)

    def jsr_on_channel(self, t: float, active_channel: int) -> float:
        # Constant JSR on every channel
        return self.per_channel_power_dBm

    def is_jammed(self, t: float, active_channel: int) -> bool:
        # Barrage always jams every channel (though weakly)
        return True


# ═══════════════════════════════════════════════════════════════════════
#  Sweep Jammer
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class SweepJammer(JammerModel):
    """
    Cycles through channels sequentially.  Only the currently-swept
    channel receives full jammer power.

    Parameters
    ----------
    total_power_dBm : float
        All power concentrated on the swept channel.
    n_channels : int
        Number of channels.
    sweep_rate : float
        Channels swept per second (default 200 ch/s).
    """

    total_power_dBm: float = 30.0
    n_channels: int = 50
    sweep_rate: float = 200.0

    def _swept_channel(self, t: float) -> int:
        return int(t * self.sweep_rate) % self.n_channels

    def jsr_on_channel(self, t: float, active_channel: int) -> float:
        if self._swept_channel(t) == active_channel:
            return self.total_power_dBm   # Full power hit
        return -np.inf                     # No jamming

    def is_jammed(self, t: float, active_channel: int) -> bool:
        return self._swept_channel(t) == active_channel


# ═══════════════════════════════════════════════════════════════════════
#  Reactive Jammer
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class ReactiveJammer(JammerModel):
    """
    Detects the drone's current channel (with delay + probability) and
    concentrates power on that channel.

    Parameters
    ----------
    total_power_dBm : float
        Full power on detected channel.
    detection_prob : float
        Probability [0,1] of successfully detecting the drone's channel
        each hop.
    reaction_delay : float
        Seconds of delay before the jammer can react (default 0.005 s).
    hop_rate : float
        The drone's hop rate (needed to decide if the jammer reacts
        within the current hop dwell).
    seed : int or None
        RNG seed for detection probability draws.
    """

    total_power_dBm: float = 30.0
    detection_prob: float = 0.6
    reaction_delay: float = 0.005
    hop_rate: float = 100.0
    seed: Optional[int] = 99

    def __post_init__(self):
        self._rng = np.random.default_rng(self.seed)
        # Pre-draw detection outcomes for speed
        self._draws = self._rng.random(200_000)

    def _hop_index(self, t: float) -> int:
        return int(t * self.hop_rate)

    def is_jammed(self, t: float, active_channel: int) -> bool:
        hi = self._hop_index(t) % len(self._draws)
        dwell = 1.0 / self.hop_rate
        time_in_hop = t - (hi / self.hop_rate)
        # Jammer reacts only if: detected AND enough dwell time remains
        detected = self._draws[hi] < self.detection_prob
        reacted = time_in_hop >= self.reaction_delay
        return detected and reacted

    def jsr_on_channel(self, t: float, active_channel: int) -> float:
        if self.is_jammed(t, active_channel):
            return self.total_power_dBm
        return -np.inf


# ═══════════════════════════════════════════════════════════════════════
#  No-Jammer (clean baseline)
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class NoJammer(JammerModel):
    """No jamming — clean link baseline."""

    def jsr_on_channel(self, t: float, active_channel: int) -> float:
        return -np.inf

    def is_jammed(self, t: float, active_channel: int) -> bool:
        return False


# ═══════════════════════════════════════════════════════════════════════
#  Link Quality Calculator
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class LinkQualityCalculator:
    """
    Computes per-hop SNR and maps it to a packet-success probability
    via a sigmoid threshold model.

    Parameters
    ----------
    signal_power_dBm : float
        Received signal power at the drone's receiver (dBm). Default 20.
    noise_floor_dBm : float
        Receiver thermal noise floor (dBm). Default -90.
    snr_threshold_dB : float
        SNR value at which packet success = 50 %. Default 10.
    sigmoid_steepness : float
        Controls sharpness of the success curve. Default 0.5.
    """

    signal_power_dBm: float = -50.0
    noise_floor_dBm: float = -90.0
    snr_threshold_dB: float = 10.0
    sigmoid_steepness: float = 0.5

    def compute_snr(self, jsr_dB: float) -> float:
        """
        SNR = P_signal - (P_noise + P_jammer)  [all dB/dBm].

        If jsr_dB is -inf (no jammer), effective interference is just noise.
        """
        if np.isinf(jsr_dB) and jsr_dB < 0:
            interference_dBm = self.noise_floor_dBm
        else:
            # Sum noise + jammer in linear then back to dB
            noise_lin = 10 ** (self.noise_floor_dBm / 10)
            jam_lin = 10 ** (jsr_dB / 10)
            interference_dBm = 10 * np.log10(noise_lin + jam_lin)

        return self.signal_power_dBm - interference_dBm

    def packet_success_probability(self, snr_dB: float) -> float:
        """Sigmoid mapping of SNR → P(success) ∈ [0, 1]."""
        exponent = -self.sigmoid_steepness * (snr_dB - self.snr_threshold_dB)
        # Clamp to avoid overflow
        exponent = np.clip(exponent, -500, 500)
        return float(1.0 / (1.0 + np.exp(exponent)))

    def link_quality(self, jsr_dB: float) -> tuple:
        """
        Convenience: returns (snr_dB, link_quality).

        link_quality = packet_success_probability.
        """
        snr = self.compute_snr(jsr_dB)
        lq = self.packet_success_probability(snr)
        return snr, lq


# ═══════════════════════════════════════════════════════════════════════
#  Jammer factory
# ═══════════════════════════════════════════════════════════════════════

JAMMER_TYPES = {
    "none": NoJammer,
    "barrage": BarrageJammer,
    "sweep": SweepJammer,
    "reactive": ReactiveJammer,
}


def create_jammer(jammer_type: str, **kwargs) -> JammerModel:
    """Factory function to create a jammer by name."""
    cls = JAMMER_TYPES.get(jammer_type.lower())
    if cls is None:
        raise ValueError(
            f"Unknown jammer type '{jammer_type}'. "
            f"Choose from: {list(JAMMER_TYPES.keys())}"
        )
    return cls(**kwargs)

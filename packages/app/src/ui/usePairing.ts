/**
 * Pairing, as state: check a scanned or pasted link, prove it with a real
 * handshake, then hand the pairing over. The screen only draws it.
 *
 * Shape is not proof: a retired token parses exactly like a live one, so a
 * link is stored only after `verifyPairing` completes a handshake (a 401 from
 * the daemon or 409 from the relay both happen below the WebSocket).
 */
import { useState } from "react";
import { haptics } from "./haptics";
import { parsePairing, type Pairing } from "../pairingLink";
import { deviceId } from "../pairing";
import { verifyPairing } from "../verifyPairing";
import type { HandshakePhase } from "./Handshake";

/** How long the green wire is held after a pairing lands, so it is seen. */
const PAIRED_HOLD_MS = 900;

export function usePairing(onPaired: (pairing: Pairing) => void) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<HandshakePhase>("waiting");
  const [machine, setMachine] = useState<string | null>(null);

  const accept = async (value: string): Promise<string | null> => {
    setPhase("pairing");
    const result = parsePairing(value, await deviceId());
    if (!result.ok) {
      setPhase("failed");
      return result.error;
    }
    const verified = await verifyPairing(result.pairing);
    if (!verified.ok) {
      setPhase("failed");
      return verified.message;
    }
    setMachine(result.pairing.label);
    setPhase("paired");
    const pairing = result.pairing;
    setTimeout(() => onPaired(pairing), PAIRED_HOLD_MS);
    return null;
  };

  /** The pasted link. */
  const submit = async (): Promise<boolean> => {
    setBusy(true);
    haptics.sent();
    const failure = await accept(draft);
    if (failure) haptics.failed();
    else haptics.finished();
    setError(failure);
    if (failure) setBusy(false);
    return failure === null;
  };

  /** A scanned code: stays on the camera with the reason if it fails. */
  const scanned = async (value: string) => {
    setBusy(true);
    const failure = await accept(value);
    setBusy(false);
    if (!failure) {
      setScanning(false);
      haptics.finished();
      return;
    }
    haptics.failed();
    setScanError(failure);
    setDraft(value);
  };

  const editDraft = (next: string) => {
    setDraft(next);
    if (error) setError(null);
    if (phase === "failed") setPhase("waiting");
  };

  const openScanner = () => {
    setScanError(null);
    setScanning(true);
  };

  const closeScanner = () => {
    setScanning(false);
    if (scanError) setError(scanError);
    setScanError(null);
  };

  return { draft, editDraft, error, scanError, scanning, busy, phase, machine, submit, scanned, openScanner, closeScanner };
}

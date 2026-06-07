"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface GuestInfo {
  name: string;
  phone: string;
  roomInfo: string;
  checkinId: number;
  guestType: "hostel" | "walkin";
}

interface LookupGuest {
  checkinId: number;
  name: string;
  phone: string;
  roomInfo: string;
}

interface PhoneEntryProps {
  onIdentified: (guest: GuestInfo) => void;
  onWalkin: (phone: string) => void;
  savedPhone?: string;
}

function formatPhone(digits: string): string {
  if (digits.length <= 5) return digits;
  return digits.slice(0, 5) + " " + digits.slice(5);
}

function stripNonDigits(val: string): string {
  return val.replace(/\D/g, "").slice(0, 10);
}

export function PhoneEntry({ onIdentified, onWalkin, savedPhone }: PhoneEntryProps) {
  const [phone, setPhone] = useState(savedPhone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guests, setGuests] = useState<LookupGuest[]>([]);
  const [autoLookedUp, setAutoLookedUp] = useState(false);

  const doLookup = useCallback(async (phoneDigits: string) => {
    setLoading(true);
    setError("");
    setGuests([]);

    try {
      const res = await fetch(`/api/food/lookup?phone=${encodeURIComponent(phoneDigits)}`);
      const data = await res.json();

      if (data.found && data.guests.length === 1) {
        const g = data.guests[0];
        localStorage.setItem("gokoFoodPhone", phoneDigits);
        onIdentified({
          name: g.name,
          phone: g.phone,
          roomInfo: g.roomInfo,
          checkinId: g.checkinId,
          guestType: "hostel",
        });
      } else if (data.found && data.guests.length > 1) {
        setGuests(data.guests);
      } else {
        const digits = stripNonDigits(phoneDigits);
        localStorage.setItem("gokoFoodPhone", digits);
        onWalkin(digits);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [onIdentified]);

  useEffect(() => {
    if (savedPhone && !autoLookedUp) {
      setAutoLookedUp(true);
      doLookup(savedPhone);
    }
  }, [savedPhone, autoLookedUp, doLookup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = stripNonDigits(phone);
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit number");
      return;
    }
    doLookup(digits);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = stripNonDigits(e.target.value);
    setPhone(raw);
    setError("");
    setGuests([]);
  };

  const handleSelectGuest = (guest: LookupGuest) => {
    localStorage.setItem("gokoFoodPhone", guest.phone);
    onIdentified({
      name: guest.name,
      phone: guest.phone,
      roomInfo: guest.roomInfo,
      checkinId: guest.checkinId,
      guestType: "hostel",
    });
  };

  const handleChangeNumber = () => {
    setPhone("");
    setError("");
    setGuests([]);
    setAutoLookedUp(false);
    localStorage.removeItem("gokoFoodPhone");
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-md px-4"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <span className="text-3xl">🏖️</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Goko Hostel</h1>
        <p className="mt-1 text-sm text-blue-100">Beach-side dining</p>
      </div>

      <div className="rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">Enter your phone number</h2>
        <p className="mb-5 text-sm text-gray-500">We&apos;ll find your booking details</p>

        <form onSubmit={handleSubmit}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={formatPhone(phone)}
              onChange={handlePhoneChange}
              placeholder="98765 43210"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-lg font-medium tracking-wide text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              autoFocus
              disabled={loading}
            />
          </div>

          {savedPhone && guests.length === 0 && (
            <button
              type="button"
              onClick={handleChangeNumber}
              className="mt-2 text-sm text-blue-500 hover:text-blue-700"
            >
              Not you? Change number
            </button>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-sm text-red-500"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || stripNonDigits(phone).length < 10}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Looking up…
              </span>
            ) : (
              "Continue"
            )}
          </button>
        </form>

        <AnimatePresence mode="wait">
          {guests.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-5"
            >
              <p className="mb-3 text-sm font-medium text-gray-600">Multiple bookings found — select yours:</p>
              <div className="space-y-2">
                {guests.map((g) => (
                  <button
                    key={g.checkinId}
                    onClick={() => handleSelectGuest(g)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">{g.name}</p>
                      {g.roomInfo && (
                        <p className="text-xs text-gray-500">{g.roomInfo}</p>
                      )}
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}

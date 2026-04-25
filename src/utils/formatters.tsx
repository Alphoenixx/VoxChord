import React from "react";

export const formatChordDisplay = (chordStr: string) => {
  if (!chordStr) return null;
  
  // If it contains a flat or sharp symbol, split and style it
  if (chordStr.includes("♭")) {
    const parts = chordStr.split("♭");
    return (
      <span className="inline-flex items-center">
        {parts[0]}
        <span className="text-[0.65em] inline-block align-middle mx-[0.05em] -translate-y-[0.05em]">♭</span>
        {parts[1]}
      </span>
    );
  }
  if (chordStr.includes("♯")) {
    const parts = chordStr.split("♯");
    return (
      <span className="inline-flex items-center">
        {parts[0]}
        <span className="text-[0.65em] inline-block align-middle mx-[0.05em] -translate-y-[0.05em]">♯</span>
        {parts[1]}
      </span>
    );
  }
  
  return <>{chordStr}</>;
};

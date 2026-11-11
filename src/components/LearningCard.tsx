import React from 'react';
import { LearningPrompt } from '../game/learning';

/** A learning question near the top of the screen; counting questions get big number buttons. */
export const LearningCard: React.FC<{
  prompt: LearningPrompt;
  onAnswer: (option: string) => void;
}> = ({ prompt, onAnswer }) => (
  <div className="absolute top-[8.75rem] md:top-24 left-0 right-0 z-20 flex justify-center px-3 pointer-events-none">
    <div className="pointer-events-auto max-w-sm w-full px-4 py-3 rounded-3xl bg-white/95 border-4 border-amber-300 shadow-2xl text-center animate-pop">
      <div className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">{prompt.text}</div>
      {prompt.options.length > 0 && (
        <div className="mt-3 flex justify-center gap-3">
          {prompt.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onAnswer(opt)}
              aria-label={opt}
              className="w-16 h-16 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-600 border-4 border-white text-white text-3xl font-black shadow-lg transition active:scale-90 cursor-pointer"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

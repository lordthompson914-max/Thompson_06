/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Trophy, 
  Timer, 
  Play, 
  RotateCcw, 
  Zap,
  Smartphone,
  Target,
  Volume2,
  VolumeX,
  ChevronRight,
  X,
  Info,
  Maximize,
  Minimize,
  BarChart3,
  MousePointer2,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameOver'>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targetPos, setTargetPos] = useState({ top: '50%', left: '50%' });
  const [isMuted, setIsMuted] = useState(false);
  const [combo, setCombo] = useState(1);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Lifetime Stats
  const [stats, setStats] = useState({
    totalGames: 0,
    totalScore: 0,
    maxCombo: 0,
    totalTaps: 0,
    successfulTaps: 0
  });

  // Session Stats
  const [sessionTaps, setSessionTaps] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);

  const playSFX = useCallback((type: 'tap' | 'gameOver' | 'start' | 'combo') => {
    if (isMuted) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'combo') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'gameOver') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.5);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }, [isMuted]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load high score, tutorial status, and stats
  useEffect(() => {
    const savedHighScore = localStorage.getItem('quicktap_highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));

    const savedStats = localStorage.getItem('quicktap_stats');
    if (savedStats) setStats(JSON.parse(savedStats));

    const hasSeenTutorial = localStorage.getItem('quicktap_tutorial_seen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // Update high score and lifetime stats
  useEffect(() => {
    if (gameState === 'gameOver') {
      // Update High Score
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('quicktap_highscore', score.toString());
      }

      // Update Lifetime Stats
      const newStats = {
        totalGames: stats.totalGames + 1,
        totalScore: stats.totalScore + score,
        maxCombo: Math.max(stats.maxCombo, combo),
        totalTaps: stats.totalTaps + sessionTaps,
        successfulTaps: stats.successfulTaps + score // In this game, score is derived from taps (though with combo)
        // Actually, successfulTaps should be raw count of hits. 
        // Let's adjust handleTap to track raw hits.
      };
      // Wait, score is not raw hits because of combo. 
      // I need a separate rawHits counter for accuracy.
    }
  }, [gameState]);
  
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const moveTarget = useCallback(() => {
    if (!gameContainerRef.current) return;
    
    const container = gameContainerRef.current;
    const padding = 40; // Avoid edges
    const targetSize = 80;
    
    const maxX = container.clientWidth - targetSize - padding;
    const maxY = container.clientHeight - targetSize - padding;
    
    const randomX = Math.max(padding, Math.floor(Math.random() * maxX));
    const randomY = Math.max(padding, Math.floor(Math.random() * maxY));
    
    setTargetPos({
      top: `${randomY}px`,
      left: `${randomX}px`
    });
  }, []);

  const [sessionHits, setSessionHits] = useState(0);

  const startGame = () => {
    playSFX('start');
    setScore(0);
    setCombo(1);
    setLastTapTime(0);
    setTimeLeft(30);
    setSessionTaps(0);
    setSessionHits(0);
    setGameState('playing');
    setShowRestartConfirm(false);
    moveTarget();
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    
    setSessionHits(prev => prev + 1);
    setSessionTaps(prev => prev + 1);

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;
    
    let newCombo = 1;
    if (lastTapTime > 0 && timeSinceLastTap < 600) {
      newCombo = Math.min(combo + 1, 10);
      if (newCombo > combo) playSFX('combo');
    }
    
    setCombo(newCombo);
    setLastTapTime(now);
    playSFX('tap');
    setScore(prev => prev + newCombo);
    moveTarget();
  };

  const handleMiss = () => {
    if (gameState !== 'playing') return;
    setSessionTaps(prev => prev + 1);
    setCombo(1); // Reset combo on miss
  };

  useEffect(() => {
    if (gameState === 'gameOver') {
      setStats(prev => {
        const updated = {
          totalGames: prev.totalGames + 1,
          totalScore: prev.totalScore + score,
          maxCombo: Math.max(prev.maxCombo, combo),
          totalTaps: prev.totalTaps + sessionTaps,
          successfulTaps: prev.successfulTaps + sessionHits
        };
        localStorage.setItem('quicktap_stats', JSON.stringify(updated));
        return updated;
      });
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('gameOver');
            playSFX('gameOver');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  return (
    <div className="fixed inset-0 bg-slate-50 text-slate-900 font-sans overflow-hidden flex flex-col select-none touch-none">
      {/* HUD */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Trophy className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Score</span>
              <motion.span 
                key={score}
                initial={{ scale: 1.2, color: '#4f46e5' }}
                animate={{ scale: 1, color: '#0f172a' }}
                className="font-bold text-lg tabular-nums leading-none"
              >
                {score}
              </motion.span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Combo</span>
              <motion.span 
                key={combo}
                animate={combo > 1 ? { scale: [1, 1.2, 1] } : {}}
                className={`font-bold text-lg tabular-nums leading-none ${combo > 1 ? 'text-amber-500' : 'text-slate-400'}`}
              >
                x{combo}
              </motion.span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Best</span>
              <span className="font-bold text-lg tabular-nums leading-none text-indigo-600">{highScore}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {gameState === 'playing' && (
            <button 
              onClick={() => setShowRestartConfirm(true)}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
              title="Restart Game"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={toggleFullscreen}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => setShowTutorial(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            title="Tutorial"
          >
            <Info className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl transition-all duration-300 ${timeLeft <= 5 ? 'bg-red-100 scale-110 shadow-lg shadow-red-200' : 'bg-slate-100'}`}>
              <Timer className={`w-5 h-5 ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Time Left</span>
              <motion.span 
                key={timeLeft}
                animate={timeLeft <= 5 ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.2 }}
                className={`font-black text-xl tabular-nums leading-none ${timeLeft <= 5 ? 'text-red-600' : 'text-slate-900'}`}
              >
                {timeLeft}s
              </motion.span>
            </div>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main 
        ref={gameContainerRef}
        onClick={handleMiss}
        className="flex-1 relative bg-slate-100/50 cursor-crosshair"
      >
        {/* Visual Progress Bar */}
        {gameState === 'playing' && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-200/50 z-20">
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / 30) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className={`h-full shadow-[0_0_10px_rgba(0,0,0,0.1)] ${timeLeft <= 5 ? 'bg-red-500' : 'bg-indigo-600'}`}
            />
          </div>
        )}

        {/* Large Countdown Warning */}
        <AnimatePresence>
          {gameState === 'playing' && timeLeft <= 5 && timeLeft > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.1, scale: 1.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
            >
              <span className="text-[20rem] font-black text-red-600 tabular-nums">
                {timeLeft}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {gameState === 'playing' && (
            <motion.button
              key={`target-${score}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.8 }}
              transition={{ 
                type: "spring", 
                stiffness: 500, 
                damping: 30,
                opacity: { duration: 0.1 }
              }}
              onMouseDown={handleTap}
              onTouchStart={handleTap}
              style={{
                position: 'absolute',
                top: targetPos.top,
                left: targetPos.left,
                width: '80px',
                height: '80px',
              }}
              className="bg-indigo-600 rounded-full shadow-xl shadow-indigo-600/30 flex items-center justify-center text-white font-black text-xs uppercase tracking-tighter"
            >
              <Zap className="w-8 h-8 fill-white" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Overlays */}
        <AnimatePresence>
          {showStats && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md z-[70] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
              >
                <div className="p-6 flex justify-between items-center border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Lifetime Stats</h3>
                  </div>
                  <button 
                    onClick={() => setShowStats(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="p-8 grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Games</span>
                    <span className="text-2xl font-black text-slate-900 tabular-nums">{stats.totalGames}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Avg Score</span>
                    <span className="text-2xl font-black text-slate-900 tabular-nums">
                      {stats.totalGames > 0 ? Math.round(stats.totalScore / stats.totalGames) : 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Max Combo</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                      <span className="text-2xl font-black text-slate-900 tabular-nums">x{stats.maxCombo}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Accuracy</span>
                    <div className="flex items-center gap-2">
                      <MousePointer2 className="w-4 h-4 text-indigo-500" />
                      <span className="text-2xl font-black text-slate-900 tabular-nums">
                        {stats.totalTaps > 0 ? Math.round((stats.successfulTaps / stats.totalTaps) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-8">
                  <button 
                    onClick={() => setShowStats(false)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                  >
                    CLOSE
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showRestartConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <RotateCcw className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Restart Game?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  Your current progress will be lost. Are you sure you want to start over?
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={startGame}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-600/20"
                  >
                    YES, RESTART
                  </button>
                  <button 
                    onClick={() => setShowRestartConfirm(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all active:scale-95"
                  >
                    CANCEL
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showTutorial && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
              >
                <div className="p-6 flex justify-between items-start">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-indigo-600" />
                  </div>
                  <button 
                    onClick={() => {
                      setShowTutorial(false);
                      localStorage.setItem('quicktap_tutorial_seen', 'true');
                    }}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="px-8 pb-8">
                  <AnimatePresence mode="wait">
                    {tutorialStep === 0 && (
                      <motion.div 
                        key="step0"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <h3 className="text-xl font-black text-slate-900 mb-2">How to Play</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                          Tap the target as many times as you can before the 30-second timer runs out.
                        </p>
                      </motion.div>
                    )}
                    {tutorialStep === 1 && (
                      <motion.div 
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <h3 className="text-xl font-black text-slate-900 mb-2">Combo Multiplier</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                          Tap quickly (within 0.6s) to build a combo! Higher combos give you more points per tap, up to <span className="text-amber-600 font-bold">10x</span>.
                        </p>
                      </motion.div>
                    )}
                    {tutorialStep === 2 && (
                      <motion.div 
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <h3 className="text-xl font-black text-slate-900 mb-2">High Scores</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                          Your best score is saved automatically. Challenge yourself to beat your personal record!
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div 
                          key={i} 
                          className={`h-1.5 rounded-full transition-all duration-300 ${tutorialStep === i ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200'}`} 
                        />
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (tutorialStep < 2) {
                          setTutorialStep(tutorialStep + 1);
                        } else {
                          setShowTutorial(false);
                          localStorage.setItem('quicktap_tutorial_seen', 'true');
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      {tutorialStep === 2 ? 'GOT IT!' : 'NEXT'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'start' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-600/20">
                <Target className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight italic">QUICK TAP!</h1>
              <p className="text-slate-500 mb-8 max-w-xs">
                How many times can you tap the target in 30 seconds?
              </p>
              <div className="flex flex-col gap-3 w-full max-w-[240px]">
                <button 
                  onClick={startGame}
                  className="group relative bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-10 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"
                >
                  <Play className="w-5 h-5 fill-white" />
                  START GAME
                </button>
                <button 
                  onClick={() => setShowStats(true)}
                  className="bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-600 font-bold py-4 px-10 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <BarChart3 className="w-5 h-5" />
                  VIEW STATS
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'gameOver' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center"
            >
              <h2 className="text-2xl font-bold text-slate-500 uppercase tracking-widest mb-2">Game Over</h2>
              
              <div className="flex flex-col items-center mb-8">
                <div className="text-7xl font-black text-indigo-600 tabular-nums leading-none">
                  {score}
                </div>
                {score >= highScore && score > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-2 bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest"
                  >
                    New Personal Best!
                  </motion.div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full max-w-[200px] mb-8">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">High Score</span>
                <span className="text-2xl font-black text-slate-900">{highScore}</span>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-[240px]">
                <button 
                  onClick={() => setShowRestartConfirm(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-10 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20"
                >
                  <RotateCcw className="w-5 h-5" />
                  RESTART
                </button>
                <button 
                  onClick={() => setShowStats(true)}
                  className="bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-600 font-bold py-4 px-10 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <BarChart3 className="w-5 h-5" />
                  STATS
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <footer className="p-4 bg-white border-t border-slate-200 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 opacity-30">
          <Smartphone className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Mobile Optimized</span>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Created by <span className="text-indigo-600">@Thompson_06</span>
        </div>
      </footer>
    </div>
  );
}

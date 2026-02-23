/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pause, 
  Play, 
  RotateCcw, 
  Globe, 
  Shield, 
  Target, 
  Zap,
  Trophy,
  Skull
} from 'lucide-react';
import { 
  GameState, 
  Language, 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  MISSILE_SPEED_BASE,
  TARGET_SCORE,
  SHIELD_DURATION,
  BossPhase
} from './types';
import { TRANSLATIONS } from './constants';
import { createInitialState, updateGame } from './gameLogic';
import { drawGame } from './renderer';

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [isShieldKeyHeld, setIsShieldKeyHeld] = useState(false);
  const stateRef = useRef<GameState>(createInitialState());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  const t = TRANSLATIONS[state.language];

  // Sync ref with state for UI updates
  useEffect(() => {
    stateRef.current.language = state.language;
    stateRef.current.status = state.status;
  }, [state.language, state.status]);

  const handleResize = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || window.innerHeight;
    
    const scale = Math.min(containerWidth / GAME_WIDTH, containerHeight / GAME_HEIGHT) || 1;
    
    canvas.style.width = `${GAME_WIDTH * scale}px`;
    canvas.style.height = `${GAME_HEIGHT * scale}px`;
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    // Initial resize with a small delay to ensure container is ready
    const timer = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [handleResize]);

  const animate = useCallback((time: number) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Update game logic using Ref for performance
    const nextState = updateGame(stateRef.current, deltaTime);
    stateRef.current = nextState;

    // Draw to canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) drawGame(ctx, nextState);
    }

    // Sync important UI state back to React (throttled or on change)
    if (nextState.score !== state.score || 
        nextState.status !== state.status || 
        nextState.gravityWellUsageCount !== state.gravityWellUsageCount ||
        Math.floor(nextState.gravityWell.energy) !== Math.floor(state.gravityWell.energy) ||
        nextState.gravityWell.active !== state.gravityWell.active ||
        nextState.shieldCharges !== state.shieldCharges ||
        (nextState.shieldCharges < nextState.shieldMaxCharges && Math.floor(nextState.shieldCooldown / 200) !== Math.floor(state.shieldCooldown / 200))) {
      setState(prev => ({
        ...prev,
        score: nextState.score,
        status: nextState.status,
        wave: nextState.wave,
        gravityWell: nextState.gravityWell,
        gravityWellUsageCount: nextState.gravityWellUsageCount,
        shieldCharges: nextState.shieldCharges,
        shieldCooldown: nextState.shieldCooldown,
        boss: nextState.boss
      }));
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [state.score, state.status, state.gravityWell.energy, state.gravityWell.active, state.shieldCharges, state.shieldCooldown, state.boss.phase, state.boss.health]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 's') setIsShieldKeyHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 's') setIsShieldKeyHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (state.status !== 'PLAYING') return;
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Shield logic
    if (isShieldKeyHeld) {
      // Find nearest building
      const buildings = [
        ...stateRef.current.batteries.filter(b => !b.isDestroyed),
        ...stateRef.current.cities.filter(c => !c.isDestroyed)
      ];
      
      let targetBuilding = null;
      let minBuildingDist = 80; // Snap radius

      for (const b of buildings) {
        const dx = x - b.x;
        const dy = y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minBuildingDist) {
          minBuildingDist = dist;
          targetBuilding = b;
        }
      }

      if (targetBuilding && stateRef.current.shieldCharges > 0) {
        setState(prev => {
          const newState = { ...prev };
          newState.shieldCharges--;
          newState.batteries = prev.batteries.map(b => 
            b.id === targetBuilding?.id ? { ...b, hasShield: true, shieldTimeLeft: SHIELD_DURATION } : b
          );
          newState.cities = prev.cities.map(c => 
            c.id === targetBuilding?.id ? { ...c, hasShield: true, shieldTimeLeft: SHIELD_DURATION } : c
          );
          
          stateRef.current.shieldCharges = newState.shieldCharges;
          stateRef.current.batteries = newState.batteries;
          stateRef.current.cities = newState.cities;
          
          return newState;
        });
      }
      return; // Always return if S is held to prevent accidental missile fire
    }

    // Find nearest battery with ammo
    const availableBatteries = state.batteries.filter(b => !b.isDestroyed && b.ammo > 0);
    if (availableBatteries.length === 0) return;

    let nearest = availableBatteries[0];
    let minDist = Math.sqrt((x - nearest.x) ** 2 + (y - nearest.y) ** 2);

    for (let i = 1; i < availableBatteries.length; i++) {
      const b = availableBatteries[i];
      const dist = Math.sqrt((x - b.x) ** 2 + (y - b.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = b;
      }
    }

    setState(prev => {
      // Use stateRef.current as the source of truth to avoid stale state issues
      const currentMissiles = stateRef.current.missiles;
      const currentBatteries = stateRef.current.batteries;

      const updatedBatteries = currentBatteries.map(b => 
        b.id === nearest.id ? { ...b, ammo: b.ammo - 1, angle: Math.atan2(y - (b.y - 55), x - b.x) } : b
      );
      
      const missilesToAdd = [];
      const timestamp = Date.now();
      
      // Base missile
      missilesToAdd.push({
        id: `m-${timestamp}-0-${Math.random()}`,
        startX: nearest.x,
        startY: nearest.y - 55,
        targetX: x,
        targetY: y,
        x: nearest.x,
        y: nearest.y - 55,
        speed: MISSILE_SPEED_BASE,
        progress: 0
      });

      // Middle battery scatter shot
      if (nearest.id === 'b-mid') {
        const offset = 60;
        missilesToAdd.push({
          id: `m-${timestamp}-1-${Math.random()}`,
          startX: nearest.x,
          startY: nearest.y - 55,
          targetX: x - offset,
          targetY: y,
          x: nearest.x,
          y: nearest.y - 55,
          speed: MISSILE_SPEED_BASE,
          progress: 0
        });
        missilesToAdd.push({
          id: `m-${timestamp}-2-${Math.random()}`,
          startX: nearest.x,
          startY: nearest.y - 55,
          targetX: x + offset,
          targetY: y,
          x: nearest.x,
          y: nearest.y - 55,
          speed: MISSILE_SPEED_BASE,
          progress: 0
        });
      }

      const updatedMissiles = [...currentMissiles, ...missilesToAdd];
      
      // Also update ref immediately
      stateRef.current.batteries = updatedBatteries;
      stateRef.current.missiles = updatedMissiles;

      return {
        ...prev,
        batteries: updatedBatteries,
        missiles: updatedMissiles
      };
    });
  };

  const handleGravityWell = (e: React.MouseEvent | React.TouchEvent, active: boolean) => {
    if (state.status !== 'PLAYING') return;
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0 && !active) {
        // For touch end, we don't have touches
        stateRef.current.gravityWell.active = false;
        return;
      }
      clientX = e.touches[0]?.clientX || 0;
      clientY = e.touches[0]?.clientY || 0;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const wasActive = stateRef.current.gravityWell.active;
    const nowActive = active && stateRef.current.gravityWell.energy > 0;
    
    if (nowActive && !wasActive) {
      stateRef.current.gravityWellUsageCount++;
    }

    stateRef.current.gravityWell.active = nowActive;
    stateRef.current.gravityWell.x = x;
    stateRef.current.gravityWell.y = y;
  };

  const startGame = () => {
    stateRef.current.status = 'PLAYING';
    setState(prev => ({ ...prev, status: 'PLAYING' }));
  };

  const resetGame = () => {
    const newState = createInitialState(state.language);
    stateRef.current = newState;
    setState(newState);
  };

  const toggleLanguage = () => {
    const nextLang = state.language === Language.EN ? Language.CN : Language.EN;
    stateRef.current.language = nextLang;
    setState(prev => ({ 
      ...prev, 
      language: nextLang 
    }));
  };

  const togglePause = () => {
    const nextStatus = state.status === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    stateRef.current.status = nextStatus;
    setState(prev => ({
      ...prev,
      status: nextStatus
    }));
  };

  const quitGame = () => {
    resetGame();
  };

  const closeTutorial = () => {
    stateRef.current.showTutorial = false;
    setState(prev => ({ ...prev, showTutorial: false }));
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-[#05070A] flex items-center justify-center overflow-hidden font-sans text-white select-none"
    >
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        onMouseDown={(e) => {
          if (e.button === 2) handleGravityWell(e, true);
          else handleCanvasClick(e);
        }}
        onMouseUp={(e) => {
          if (e.button === 2) handleGravityWell(e, false);
        }}
        onMouseMove={(e) => {
          if (stateRef.current.gravityWell.active) handleGravityWell(e, true);
          
          // Hover logic for shields
          if (isShieldKeyHeld && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = GAME_WIDTH / rect.width;
            const scaleY = GAME_HEIGHT / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            const buildings = [
              ...stateRef.current.batteries.filter(b => !b.isDestroyed),
              ...stateRef.current.cities.filter(c => !c.isDestroyed)
            ];
            
            let targetId = null;
            let minBuildingDist = 80;

            for (const b of buildings) {
              const dx = x - b.x;
              const dy = y - b.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minBuildingDist) {
                minBuildingDist = dist;
                targetId = b.id;
              }
            }
            stateRef.current.hoveredBuildingId = targetId;
          } else {
            stateRef.current.hoveredBuildingId = null;
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={(e) => {
          if (e.touches.length > 1) handleGravityWell(e, true);
          else handleCanvasClick(e);
        }}
        onTouchEnd={(e) => handleGravityWell(e, false)}
        onTouchMove={(e) => {
          if (stateRef.current.gravityWell.active) handleGravityWell(e, true);
        }}
        className="cursor-crosshair shadow-2xl shadow-cyan-500/20"
      />

      {/* HUD Layer */}
      {state.status !== 'START' && (
        <>
          {/* Boss Health Bar - Top Center */}
          {state.boss.phase !== BossPhase.NONE && state.boss.phase !== BossPhase.DESTROYED && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-20">
              <motion.div 
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                className="distressed-panel p-3 border-2 border-red-900/50 bg-red-950/40 w-[450px] pointer-events-auto"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-red-500 font-stencil tracking-widest text-xs uppercase">Dreadnought Detected</span>
                  <span className="text-red-500 font-mono text-xs">{state.boss.health} / {state.boss.maxHealth}</span>
                </div>
                <div className="h-2 bg-black/60 border border-red-900/30 overflow-hidden">
                  <motion.div 
                    className="h-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(state.boss.health / state.boss.maxHealth) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-[9px] text-red-400/80 font-mono uppercase text-center tracking-tight">
                  {state.boss.phase === BossPhase.LASER && "Charging Superlaser - Deploy Shields"}
                  {state.boss.phase === BossPhase.VULNERABLE && "Weak Point Exposed - Use Gravity Well"}
                  {state.boss.phase === BossPhase.DAMAGED && "Core Exposed - Fire All Batteries"}
                </div>
              </motion.div>
            </div>
          )}

          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 pointer-events-auto distressed-panel p-4 rounded-sm border-2 border-[#4a443f] text-[#d4d4d4]">
            <div className="flex items-center gap-2 text-[#ff6a00]">
              <Trophy size={18} />
              <span className="text-lg font-stencil tracking-wider">{t.score}: {state.score}</span>
            </div>
            <div className="flex items-center gap-2 text-white/40">
              <Target size={16} />
              <span className="text-xs font-mono">{t.target}: {TARGET_SCORE}</span>
            </div>
            <div className="w-full bg-black/40 h-2 border border-[#4a443f] mt-1">
              <motion.div 
                className="bg-[#ff6a00] h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(state.score / TARGET_SCORE) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto distressed-panel p-2 rounded-sm border-2 border-[#4a443f] text-[#d4d4d4] min-w-[140px]">
            <div className="flex items-center gap-2 text-purple-400">
              <Zap size={14} />
              <span className="text-sm font-stencil tracking-wider uppercase">Gravity</span>
            </div>
            <div className="w-full bg-black/40 h-1.5 border border-[#4a443f] mt-0.5">
              <motion.div 
                className="bg-purple-500 h-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                initial={{ width: '100%' }}
                animate={{ width: `${state.gravityWell.energy}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pointer-events-auto distressed-panel p-2 rounded-sm border-2 border-[#4a443f] text-[#d4d4d4] min-w-[140px]">
            <div className="flex items-center gap-2 text-blue-400">
              <Shield size={14} />
              <span className="text-sm font-stencil tracking-wider uppercase">Shield</span>
            </div>
            <div className="flex gap-1.5 mt-0.5">
              {Array.from({ length: state.shieldMaxCharges }).map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 h-1.5 border border-[#4a443f] overflow-hidden ${i < state.shieldCharges ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-black/40'}`}
                >
                  {i === state.shieldCharges && (
                    <motion.div 
                      className="bg-blue-500/50 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(state.shieldCooldown / 7000) * 100}%` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pointer-events-auto">
            <button 
              onClick={togglePause}
              className="p-3 bg-[#2d241e] border-2 border-[#4a443f] text-[#d4d4d4] hover:bg-[#3d322a] transition-colors"
            >
              {state.status === 'PAUSED' ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <button 
              onClick={toggleLanguage}
              className="px-4 py-2 bg-[#2d241e] border-2 border-[#4a443f] text-[#d4d4d4] hover:bg-[#3d322a] transition-colors text-sm font-stencil"
            >
              {state.language}
            </button>
          </div>
        </div>
        </>
      )}

      {/* Ammo HUD */}
      {state.status === 'PLAYING' && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-around pointer-events-none px-20">
          {state.batteries.map((b, i) => (
            <div key={b.id} className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {Array.from({ length: Math.ceil(b.ammo / 4) }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-2 h-5 border border-black/40 ${b.isDestroyed ? 'bg-red-900/40' : 'bg-[#5a5a40] shadow-inner'}`}
                  />
                ))}
              </div>
              <span className={`text-[10px] font-stencil tracking-widest ${b.isDestroyed ? 'text-red-600' : 'text-[#d4d4d4]'}`}>
                {b.isDestroyed ? 'DESTROYED' : `${b.ammo} ${t.ammo}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Overlays */}
      {state.showTutorial && state.status === 'PLAYING' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-[60]">
          <div className="distressed-panel p-8 max-w-md w-full border-2 border-[#ff6a00]/50 shadow-[0_0_30px_rgba(255,106,0,0.2)]">
            <h2 className="text-3xl font-stencil font-black text-[#ff6a00] mb-6 uppercase tracking-widest border-b border-[#ff6a00]/30 pb-2">
              {t.tutorialTitle}
            </h2>
            <div className="flex flex-col gap-4 text-left mb-8">
              <p className="text-[#d4d4d4] font-sans flex items-start gap-3">
                <span className="text-[#ff6a00] font-stencil">01</span>
                {t.tutorialStep1}
              </p>
              <p className="text-[#d4d4d4] font-sans flex items-start gap-3">
                <span className="text-[#ff6a00] font-stencil">02</span>
                {t.tutorialStep2}
              </p>
              <p className="text-[#d4d4d4] font-sans flex items-start gap-3">
                <span className="text-[#ff6a00] font-stencil">03</span>
                {t.tutorialStep3}
              </p>
              <p className="text-[#d4d4d4] font-sans flex items-start gap-3">
                <span className="text-[#ff6a00] font-stencil">04</span>
                {t.tutorialStep4}
              </p>
              <p className="text-[#d4d4d4] font-sans flex items-start gap-3">
                <span className="text-[#ff6a00] font-stencil">05</span>
                {t.tutorialStep5}
              </p>
              <p className="text-[#d4d4d4] font-sans flex items-start gap-3">
                <span className="text-[#ff6a00] font-stencil">06</span>
                {t.tutorialStep6}
              </p>
            </div>
            <button 
              onClick={closeTutorial}
              className="w-full py-4 bg-[#ff6a00] text-black font-stencil font-black text-xl uppercase hover:bg-[#ff8a30] transition-all active:scale-95"
            >
              {t.tutorialGotIt}
            </button>
          </div>
        </div>
      )}

      {state.status === 'START' && (
        <div className="absolute inset-0 bg-[#1a1614]/95 flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="mb-12 relative">
            <h1 className="text-6xl md:text-8xl font-stencil font-black tracking-tighter text-[#d4d4d4] mb-2 uppercase drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
              {t.title}
            </h1>
            <div className="h-1 w-full bg-[#4a443f] shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
            <div className="absolute -top-10 -left-10 w-20 h-20 border-t-4 border-l-4 border-[#ff6a00] opacity-50" />
            <div className="absolute -bottom-10 -right-10 w-20 h-20 border-b-4 border-r-4 border-[#ff6a00] opacity-50" />
          </div>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              onClick={startGame}
              className="group relative px-8 py-4 bg-[#5a5a40] border-4 border-[#3d3d2a] text-[#d4d4d4] font-stencil font-black text-2xl uppercase overflow-hidden shadow-2xl hover:bg-[#6a6a50] transition-all hover:scale-105 active:scale-95"
            >
              <span className="relative flex items-center justify-center gap-2">
                <Play fill="currentColor" size={24} />
                {t.start}
              </span>
            </button>

            <div className="text-[10px] text-[#d4d4d4]/40 font-mono uppercase tracking-widest mt-2">
              {t.controlsHint}
            </div>

            <button 
              onClick={toggleLanguage}
              className="flex items-center justify-center gap-2 text-[#d4d4d4]/40 hover:text-[#d4d4d4] transition-colors py-2 font-stencil tracking-widest"
            >
              <Globe size={16} />
              <span className="text-sm uppercase">
                {state.language === Language.EN ? '简体中文' : 'ENGLISH'}
              </span>
            </button>
          </div>

          <div className="mt-20 grid grid-cols-3 gap-12 text-[#d4d4d4]/30">
            <div className="flex flex-col items-center gap-2">
              <Shield size={28} />
              <span className="text-[10px] uppercase font-stencil tracking-[0.2em]">Hold the Line</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Zap size={28} />
              <span className="text-[10px] uppercase font-stencil tracking-[0.2em]">Intercept</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Target size={28} />
              <span className="text-[10px] uppercase font-stencil tracking-[0.2em]">Retaliate</span>
            </div>
          </div>
        </div>
      )}

      {state.status === 'PAUSED' && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="distressed-panel p-12 rounded-sm flex flex-col items-center gap-8 border-4 border-[#4a443f]">
            <h2 className="text-5xl font-stencil font-black text-[#ff6a00] tracking-widest uppercase">{t.paused}</h2>
            <div className="flex flex-col gap-4 w-full">
              <button 
                onClick={togglePause}
                className="px-16 py-4 bg-[#5a5a40] border-2 border-[#3d3d2a] text-[#d4d4d4] font-stencil font-black text-xl uppercase hover:bg-[#6a6a50] transition-all"
              >
                {t.resume}
              </button>
              <button 
                onClick={quitGame}
                className="px-16 py-4 bg-red-900/40 border-2 border-red-900 text-[#d4d4d4] font-stencil font-black text-xl uppercase hover:bg-red-900/60 transition-all"
              >
                {t.quit}
              </button>
            </div>
          </div>
        </div>
      )}

      {(state.status === 'WON' || state.status === 'LOST') && (
        <div className="absolute inset-0 bg-[#0a0805] flex flex-col items-center justify-center p-6 z-50">
          <div className="flex flex-col items-center text-center max-w-md">
            {state.status === 'WON' ? (
              <Trophy size={100} className="text-[#ff6a00] mb-6 drop-shadow-[0_0_30px_rgba(255,106,0,0.3)]" />
            ) : (
              <Skull size={100} className="text-red-800 mb-6 drop-shadow-[0_0_30px_rgba(153,0,0,0.3)]" />
            )}
            
            <h2 className={`text-7xl font-stencil font-black mb-4 tracking-tighter uppercase ${state.status === 'WON' ? 'text-[#ff6a00]' : 'text-red-800'}`}>
              {state.status === 'WON' ? t.victory : t.gameOver}
            </h2>
            <p className="text-[#d4d4d4]/60 mb-10 font-sans italic text-lg">
              {state.status === 'WON' ? t.winMsg : t.lostMsg}
            </p>

            <div className="bg-black/40 border-2 border-[#4a443f] p-8 mb-10 w-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#ff6a00]/20" />
              <div className="text-xs text-[#d4d4d4]/40 uppercase font-stencil tracking-[0.3em] mb-2">{t.score}</div>
              <div className="text-6xl font-stencil font-black text-[#d4d4d4]">{state.score}</div>
            </div>

            <button 
              onClick={resetGame}
              className="flex items-center gap-3 px-16 py-5 bg-[#d4d4d4] text-black font-stencil font-black text-xl uppercase hover:bg-white transition-all shadow-2xl active:scale-95"
            >
              <RotateCcw size={24} />
              {t.restart}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

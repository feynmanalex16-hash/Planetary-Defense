import { 
  GameState, 
  Battery, 
  City, 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  EXPLOSION_MAX_RADIUS, 
  EXPLOSION_DURATION,
  ROCKET_SPEED_BASE,
  MISSILE_SPEED_BASE,
  TARGET_SCORE,
  GRAVITY_STRENGTH
} from './types';

export const createInitialState = (lang = 'EN'): GameState => {
  const batteries: Battery[] = [
    { id: 'b-left', x: 50, y: GAME_HEIGHT - 20, ammo: 20, maxAmmo: 20, isDestroyed: false },
    { id: 'b-mid', x: 500, y: GAME_HEIGHT - 20, ammo: 40, maxAmmo: 40, isDestroyed: false },
    { id: 'b-right', x: 950, y: GAME_HEIGHT - 20, ammo: 20, maxAmmo: 20, isDestroyed: false },
  ];

  const cities: City[] = [
    { id: 'c1', x: 180, y: GAME_HEIGHT - 20, isDestroyed: false },
    { id: 'c2', x: 280, y: GAME_HEIGHT - 20, isDestroyed: false },
    { id: 'c3', x: 380, y: GAME_HEIGHT - 20, isDestroyed: false },
    { id: 'c4', x: 620, y: GAME_HEIGHT - 20, isDestroyed: false },
    { id: 'c5', x: 720, y: GAME_HEIGHT - 20, isDestroyed: false },
    { id: 'c6', x: 820, y: GAME_HEIGHT - 20, isDestroyed: false },
  ];

  const backgroundElements = Array.from({ length: 10 }).map((_, i) => {
    const w = 40 + Math.random() * 60;
    const h = 50 + Math.random() * 100;
    const x = i * 100 + Math.random() * 20;
    return {
      x,
      w,
      h,
      brokenX: x + Math.random() * w,
      brokenW: Math.random() * 20
    };
  });

  return {
    score: 0,
    status: 'START',
    language: lang as any,
    batteries,
    cities,
    missiles: [],
    enemyRockets: [],
    explosions: [],
    shakeIntensity: 0,
    wave: 1,
    backgroundElements,
    showTutorial: true,
    gravityWell: {
      active: false,
      x: 0,
      y: 0,
      radius: 200,
      energy: 100,
      maxEnergy: 100
    }
  };
};

export const updateGame = (state: GameState, deltaTime: number): GameState => {
  if (state.status !== 'PLAYING') return state;

  const newState = { ...state };
  
  // Update gravity well energy
  if (newState.gravityWell.active) {
    newState.gravityWell.energy = Math.max(0, newState.gravityWell.energy - deltaTime * 0.05);
    if (newState.gravityWell.energy <= 0) newState.gravityWell.active = false;
  } else {
    newState.gravityWell.energy = Math.min(newState.gravityWell.maxEnergy, newState.gravityWell.energy + deltaTime * 0.02);
  }

  // Update screen shake
  if (newState.shakeIntensity > 0) {
    newState.shakeIntensity = Math.max(0, newState.shakeIntensity - deltaTime * 0.05);
  }

  // Update missiles
  newState.missiles = state.missiles.map(m => ({
    ...m,
    progress: m.progress + m.speed * (deltaTime / 16.67),
    x: m.startX + (m.targetX - m.startX) * (m.progress + m.speed * (deltaTime / 16.67)),
    y: m.startY + (m.targetY - m.startY) * (m.progress + m.speed * (deltaTime / 16.67)),
  })).filter(m => {
    if (m.progress >= 1) {
      // Trigger explosion
      newState.explosions.push({
        id: `exp-${Date.now()}-${Math.random()}`,
        x: m.targetX,
        y: m.targetY,
        radius: 0,
        maxRadius: EXPLOSION_MAX_RADIUS,
        duration: EXPLOSION_DURATION,
        elapsed: 0
      });
      return false;
    }
    return true;
  });

  // Update enemy rockets
  newState.enemyRockets = state.enemyRockets.map(r => {
    let { x, y, vx, vy } = r;
    
    if (newState.gravityWell.active) {
      const dx = newState.gravityWell.x - x;
      const dy = newState.gravityWell.y - y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      if (dist < newState.gravityWell.radius) {
        // Inverse square law: a = G / r^2
        const force = (GRAVITY_STRENGTH / Math.max(1000, distSq)) * (deltaTime / 16.67);
        vx += (dx / dist) * force;
        vy += (dy / dist) * force;
      }
    }
    
    x += vx * (deltaTime / 16.67);
    y += vy * (deltaTime / 16.67);
    
    return { ...r, x, y, vx, vy };
  }).filter(r => {
    if (r.y >= GAME_HEIGHT - 20) {
      // Hit target
      newState.shakeIntensity = 15;
      // Check what was hit
      const battery = newState.batteries.find(b => Math.abs(b.x - r.x) < 30 && !b.isDestroyed);
      if (battery) battery.isDestroyed = true;
      
      const city = newState.cities.find(c => Math.abs(c.x - r.x) < 30 && !c.isDestroyed);
      if (city) city.isDestroyed = true;

      return false;
    }
    return true;
  });

  // Collision detection: Enemy Rocket vs Enemy Rocket (Gravity collisions)
  const rocketsToRemove = new Set<string>();
  for (let i = 0; i < newState.enemyRockets.length; i++) {
    for (let j = i + 1; j < newState.enemyRockets.length; j++) {
      const r1 = newState.enemyRockets[i];
      const r2 = newState.enemyRockets[j];
      const dist = Math.sqrt((r1.x - r2.x) ** 2 + (r1.y - r2.y) ** 2);
      if (dist < 15) {
        rocketsToRemove.add(r1.id);
        rocketsToRemove.add(r2.id);
        
        newState.explosions.push({
          id: `col-${Date.now()}-${Math.random()}`,
          x: (r1.x + r2.x) / 2,
          y: (r1.y + r2.y) / 2,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS * 2.5,
          duration: EXPLOSION_DURATION * 1.2,
          elapsed: 0
        });
        
        newState.score += 100; // High reward for collision
        newState.shakeIntensity = 10;
      }
    }
  }
  if (rocketsToRemove.size > 0) {
    newState.enemyRockets = newState.enemyRockets.filter(r => !rocketsToRemove.has(r.id));
  }

  // Update explosions
  newState.explosions = state.explosions.map(e => {
    const elapsed = e.elapsed + deltaTime;
    const t = elapsed / e.duration;
    // Radius grows then shrinks
    const radius = t < 0.5 
      ? (t / 0.5) * e.maxRadius 
      : (1 - (t - 0.5) / 0.5) * e.maxRadius;
    
    return { ...e, elapsed, radius };
  }).filter(e => e.elapsed < e.duration);

  // Collision detection: Explosions vs Enemy Rockets
  newState.enemyRockets = newState.enemyRockets.filter(r => {
    const hit = newState.explosions.some(e => {
      const dist = Math.sqrt((r.x - e.x) ** 2 + (r.y - e.y) ** 2);
      return dist < e.radius;
    });
    if (hit) {
      newState.score += 20;
    }
    return !hit;
  });

  // Spawn enemy rockets
  if (newState.enemyRockets.length < 3 + Math.floor(newState.wave / 2) && Math.random() < 0.02) {
    const targets = [...newState.batteries.filter(b => !b.isDestroyed), ...newState.cities.filter(c => !c.isDestroyed)];
    if (targets.length > 0) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const startX = Math.random() * GAME_WIDTH;
      const startY = -20;
      const angle = Math.atan2(target.y - startY, target.x - startX);
      const speed = ROCKET_SPEED_BASE * (1 + newState.wave * 0.1);
      
      newState.enemyRockets.push({
        id: `rocket-${Date.now()}-${Math.random()}`,
        startX,
        startY,
        targetX: target.x,
        targetY: target.y,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed
      });
    }
  }

  // Win/Loss conditions
  if (newState.score >= TARGET_SCORE) {
    newState.status = 'WON';
  } else if (newState.batteries.every(b => b.isDestroyed) || newState.cities.every(c => c.isDestroyed)) {
    newState.status = 'LOST';
  }

  return newState;
};

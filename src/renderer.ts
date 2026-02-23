import { GameState, GAME_WIDTH, GAME_HEIGHT } from './types';

export const drawGame = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Apply screen shake
  if (state.shakeIntensity > 0) {
    const dx = (Math.random() - 0.5) * state.shakeIntensity;
    const dy = (Math.random() - 0.5) * state.shakeIntensity;
    ctx.save();
    ctx.translate(dx, dy);
  }

  // Draw Background - Smoky sky
  const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  skyGradient.addColorStop(0, '#1a1614');
  skyGradient.addColorStop(0.7, '#2d241e');
  skyGradient.addColorStop(1, '#3d322a');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Draw some distant ruined silhouettes
  ctx.fillStyle = 'rgba(10, 8, 5, 0.5)';
  state.backgroundElements.forEach(el => {
    ctx.fillRect(el.x, GAME_HEIGHT - 20 - el.h, el.w, el.h);
    // Add some "broken" tops
    ctx.clearRect(el.brokenX, GAME_HEIGHT - 20 - el.h, el.brokenW, 10);
  });

  // Draw Ground - Ash and dirt
  ctx.fillStyle = '#14110f';
  ctx.beginPath();
  ctx.moveTo(0, GAME_HEIGHT);
  ctx.lineTo(0, GAME_HEIGHT - 20);
  ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 20);
  ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
  ctx.fill();

  // Draw Gravity Well
  if (state.gravityWell.active) {
    const g = state.gravityWell;
    const pulse = Math.sin(Date.now() / 100) * 0.1 + 0.9;
    
    ctx.save();
    // Outer distorted field
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
    grad.addColorStop(0, 'rgba(138, 43, 226, 0.3)');
    grad.addColorStop(0.6, 'rgba(75, 0, 130, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#8a2be2';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    
    // Swirl effect
    ctx.rotate(Date.now() / 200);
    ctx.restore();
  }

  // Draw Cities - Ruined buildings
  state.cities.forEach(city => {
    if (city.isDestroyed) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(city.x - 20, city.y - 10, 40, 10);
      // Smoke from ruins
      if (Math.random() < 0.1) {
          ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
          ctx.beginPath();
          ctx.arc(city.x + (Math.random() - 0.5) * 20, city.y - 15 - Math.random() * 20, 5 + Math.random() * 5, 0, Math.PI * 2);
          ctx.fill();
      }
    } else {
      ctx.fillStyle = '#4a3f35';
      ctx.strokeStyle = '#5d4d40';
      ctx.lineWidth = 1;
      // Draw a "broken" skyscraper
      ctx.fillRect(city.x - 15, city.y - 40, 30, 40);
      ctx.strokeRect(city.x - 15, city.y - 40, 30, 40);
      
      // Windows
      ctx.fillStyle = 'rgba(255, 220, 150, 0.3)';
      for(let row=0; row<4; row++) {
          for(let col=0; col<2; col++) {
              if (Math.random() > 0.3) {
                  ctx.fillRect(city.x - 10 + col * 12, city.y - 35 + row * 8, 6, 4);
              }
          }
      }
    }
  });

  // Draw Batteries - Military Bunkers
  state.batteries.forEach(battery => {
    if (battery.isDestroyed) {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(battery.x, battery.y, 25, Math.PI, 0);
      ctx.fill();
      
      // Debris
      ctx.fillStyle = '#2d2d1e';
      ctx.fillRect(battery.x - 15, battery.y - 5, 10, 5);
      ctx.fillRect(battery.x + 5, battery.y - 8, 12, 4);
    } else {
      // Bunker base
      ctx.fillStyle = '#5a5a3d'; // Brighter olive drab
      ctx.strokeStyle = '#2d2d1e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(battery.x, battery.y, 25, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      
      // Camouflage pattern
      ctx.fillStyle = 'rgba(40, 50, 20, 0.4)';
      ctx.beginPath();
      ctx.arc(battery.x - 10, battery.y - 15, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(battery.x + 12, battery.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();

      // Rivets
      ctx.fillStyle = '#2d2d1e';
      for(let a = Math.PI + 0.3; a < Math.PI * 2 - 0.3; a += 0.5) {
          ctx.beginPath();
          ctx.arc(battery.x + Math.cos(a) * 22, battery.y + Math.sin(a) * 22, 1.5, 0, Math.PI * 2);
          ctx.fill();
      }
      
      // Turret base
      ctx.fillStyle = '#3d3d2a';
      ctx.fillRect(battery.x - 12, battery.y - 30, 24, 8);
      ctx.strokeRect(battery.x - 12, battery.y - 30, 24, 8);

      // Draw turret - heavy cannon
      ctx.fillStyle = '#3d3d2a';
      ctx.fillRect(battery.x - 5, battery.y - 50, 10, 20);
      ctx.strokeRect(battery.x - 5, battery.y - 50, 10, 20);
      
      // Muzzle brake
      ctx.fillRect(battery.x - 7, battery.y - 55, 14, 5);
      
      // Antenna
      ctx.strokeStyle = '#1a1a0a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(battery.x + 15, battery.y - 20);
      ctx.lineTo(battery.x + 20, battery.y - 40);
      ctx.stroke();
      ctx.fillStyle = '#ff3131';
      ctx.beginPath();
      ctx.arc(battery.x + 20, battery.y - 40, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw Enemy Rockets - Nuclear Missiles
  state.enemyRockets.forEach(rocket => {
    // Smoke trail
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rocket.startX, rocket.startY);
    ctx.lineTo(rocket.x, rocket.y);
    ctx.stroke();

    // Missile body
    ctx.save();
    ctx.translate(rocket.x, rocket.y);
    const angle = Math.atan2(rocket.vy, rocket.vx);
    ctx.rotate(angle);
    
    ctx.fillStyle = '#d4d4d4';
    ctx.fillRect(-8, -2, 16, 4);
    ctx.fillStyle = '#FF3131'; // Warhead
    ctx.fillRect(4, -2, 4, 4);
    
    // Engine glow
    const engineGlow = ctx.createRadialGradient(-8, 0, 0, -8, 0, 8);
    engineGlow.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
    engineGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.arc(-8, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });

  // Draw Player Missiles - Interceptors
  state.missiles.forEach(missile => {
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(missile.startX, missile.startY);
    ctx.lineTo(missile.x, missile.y);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(missile.x, missile.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Explosions - Fire and Smoke
  state.explosions.forEach(exp => {
    const t = exp.elapsed / exp.duration;
    
    // Outer smoke
    ctx.fillStyle = `rgba(50, 50, 50, ${0.4 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.radius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Inner fire
    const fireGradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
    fireGradient.addColorStop(0, `rgba(255, 255, 200, ${1 - t})`);
    fireGradient.addColorStop(0.2, `rgba(255, 200, 50, ${1 - t})`);
    fireGradient.addColorStop(0.5, `rgba(255, 100, 0, ${0.8 * (1 - t)})`);
    fireGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.fillStyle = fireGradient;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  if (state.shakeIntensity > 0) {
    ctx.restore();
  }
};

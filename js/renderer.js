// Enhanced Renderer - High-tech tactical HUD, radar sweep, energy tethers, and combat fx
import { CONFIG, TEAMS } from './config.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.time = 0;
        this.radarAngle = 0;
        this.floatingTexts = [];
        this.shockwaveRings = [];
        this.vignetteGradient = null;
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.vignetteGradient = null;
    }

    addFloatingText(text, x, y, color = '#00ffff', size = 14) {
        this.floatingTexts.push({
            text,
            x,
            y,
            vy: -35,
            color,
            size,
            alpha: 1.0,
            life: 1.0
        });
    }

    addShockwave(x, y, maxRadius = 220, color = '#00ffff') {
        this.shockwaveRings.push({
            x,
            y,
            radius: 10,
            maxRadius,
            color,
            alpha: 0.9,
            lineWidth: 4
        });
    }
    
    clear(screenShake = 0) {
        this.ctx.save();
        
        if (screenShake > 0 && CONFIG.screenShakeEnabled && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const shakeX = (Math.random() - 0.5) * screenShake * 14;
            const shakeY = (Math.random() - 0.5) * screenShake * 14;
            this.ctx.translate(shakeX, shakeY);
        }
        
        this.ctx.clearRect(-20, -20, this.canvas.width + 40, this.canvas.height + 40);
    }
    
    drawTacticalGrid() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Faint tactical grid
        const step = 80;
        ctx.strokeStyle = 'rgba(0, 247, 255, 0.035)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        for (let x = 0; x < w; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();


    }
    
    // Draw Tactical Command Beacon & Influence Radius
    drawTacticalBeacon(mousePos, beaconActive, playerTeam, shockwaveCooldown, maxCooldown, rallyCoolOffTimer = 0, rallyCoolOffDuration = 1.0) {
        const ctx = this.ctx;
        const teamData = TEAMS[playerTeam] || TEAMS.dragon;
        const color = teamData.color;
        const colorRgb = teamData.colorRgb;
        const x = mousePos.x;
        const y = mousePos.y;
        
        ctx.save();
        
        // Beacon Range Ring
        const radius = CONFIG.beaconRadius;
        const pulse = Math.sin(this.time * 4) * 5;
        
        const isDisarmed = beaconActive || (rallyCoolOffTimer > 0);
        const ringColor = beaconActive ? '255, 170, 0' : (rallyCoolOffTimer > 0 ? '255, 68, 68' : colorRgb);
        
        ctx.beginPath();
        ctx.arc(x, y, radius + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = beaconActive ? `rgba(${ringColor}, 0.5)` : (rallyCoolOffTimer > 0 ? `rgba(${ringColor}, 0.35)` : 'rgba(255, 255, 255, 0.08)');
        ctx.lineWidth = beaconActive ? 2.5 : 1.5;
        ctx.setLineDash(beaconActive ? [6, 4] : (rallyCoolOffTimer > 0 ? [3, 3] : [2, 8]));
        ctx.stroke();
        ctx.setLineDash([]);
        
        if (beaconActive) {
            // Glow gradient when actively ordering fleet (amber alert: transit disarm)
            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0, `rgba(${ringColor}, 0.22)`);
            grad.addColorStop(0.5, `rgba(${ringColor}, 0.08)`);
            grad.addColorStop(1, 'transparent');
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Inward converging energy ring
            const inwards = ((this.time * 2) % 1);
            const inRadius = radius * (1 - inwards);
            ctx.beginPath();
            ctx.arc(x, y, inRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${ringColor}, ${inwards * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        // Reticle Center
        const reticleAngle = this.time * (beaconActive ? 3.5 : 1.5);
        ctx.translate(x, y);
        ctx.rotate(reticleAngle);
        
        ctx.strokeStyle = beaconActive ? '#ffaa00' : (rallyCoolOffTimer > 0 ? '#ff4444' : color);
        ctx.lineWidth = 1.5;
        
        // Rotating brackets
        const bSize = 16;
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(bSize, -4);
            ctx.lineTo(bSize, 4);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Center core
        ctx.beginPath();
        ctx.arc(x, y, beaconActive ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = beaconActive ? '#ffaa00' : (rallyCoolOffTimer > 0 ? '#ff4444' : color);
        ctx.fill();

        // Beacon state text with high visual clarity
        ctx.font = "bold 10px 'Orbitron', sans-serif";
        ctx.textAlign = 'center';
        if (beaconActive) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('GATHERING · RELEASE TO CONVERT', x, y + 26);
            ctx.font = "9px 'Rajdhani', sans-serif";
            ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
            ctx.fillText('', x, y + 38);
        } else if (rallyCoolOffTimer > 0) {
            ctx.fillStyle = '#ff5555';
            ctx.fillText(`SPREADING · ${rallyCoolOffTimer.toFixed(1)}s`, x, y + 26);
        }
    }

    // Draw Peer Pressure Conversion Tethers (makes conversion visually intuitive!)
    drawConversionTethers(boids, playerTeam, isPlayerDisarmed = false) {
        const ctx = this.ctx;
        
        for (let i = 0; i < boids.length; i++) {
            const victim = boids[i];
            if (victim.conversionPressure > 8 && victim.conversionSource) {
                // If the player is disarmed and would be the source, don't draw tether
                if (isPlayerDisarmed && victim.conversionSource.team === playerTeam) {
                    continue;
                }
                
                const teamData = TEAMS[victim.conversionSource.team] || TEAMS[playerTeam];
                const ratio = Math.min(1, victim.conversionPressure / CONFIG.peerPressureTime);
                
                ctx.beginPath();
                ctx.moveTo(victim.conversionSource.pos.x, victim.conversionSource.pos.y);
                ctx.lineTo(victim.pos.x, victim.pos.y);
                ctx.strokeStyle = `rgba(${teamData.colorRgb}, ${ratio * 0.75})`;
                ctx.lineWidth = 1.2 + ratio * 1.5;
                ctx.stroke();
            }
        }
    }

    // Shockwave Rings animation
    drawShockwaves(deltaTime) {
        const ctx = this.ctx;
        for (let i = this.shockwaveRings.length - 1; i >= 0; i--) {
            const sw = this.shockwaveRings[i];
            sw.radius += (sw.maxRadius - sw.radius) * deltaTime * 12 + 10;
            sw.alpha -= deltaTime * 2.2;
            
            if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
                this.shockwaveRings.splice(i, 1);
                continue;
            }
            
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = sw.lineWidth * sw.alpha;
            ctx.shadowColor = sw.color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    // Floating text updates and rendering - clamped so text is never cut off by screen borders
    drawFloatingTexts(deltaTime) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy * deltaTime;
            ft.life -= deltaTime;
            ft.alpha = Math.max(0, ft.life);
            
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }
            
            // Prevent clipping at borders
            const drawX = Math.max(70, Math.min(w - 70, ft.x));
            const drawY = Math.max(40, Math.min(h - 30, ft.y));
            
            ctx.save();
            ctx.font = `bold ${ft.size}px 'Orbitron', sans-serif`;
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = ft.alpha;
            ctx.textAlign = 'center';
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 8;
            ctx.fillText(ft.text, drawX, drawY);
            ctx.restore();
        }
    }
    
    drawBoids(boids, powerupManager, playerTeam) {
        const hasShield = powerupManager && powerupManager.isShielded(playerTeam);
        
        for (let i = 0; i < boids.length; i++) {
            const boid = boids[i];
            
            if (hasShield && boid.team === playerTeam) {
                this.ctx.beginPath();
                this.ctx.arc(boid.pos.x, boid.pos.y, 14, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(68, 136, 255, 0.4)';
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }
            
            boid.draw(this.ctx);
        }
    }
    
    drawParticles(particles) {
        const ctx = this.ctx;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const alpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1, p.size * alpha), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.colorRgb}, ${alpha})`;
            ctx.fill();
        }
    }
    
    drawPowerups(powerupManager) {
        if (powerupManager) {
            powerupManager.draw(this.ctx);
        }
    }
    
    drawObstacles(obstacleManager) {
        if (obstacleManager) {
            obstacleManager.draw(this.ctx);
        }
    }
    
    drawVignette() {
        if (!this.vignetteGradient) {
            this.vignetteGradient = this.ctx.createRadialGradient(
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.35,
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.95
            );
            this.vignetteGradient.addColorStop(0, 'transparent');
            this.vignetteGradient.addColorStop(1, 'rgba(2, 4, 10, 0.65)');
        }
        
        this.ctx.fillStyle = this.vignetteGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    render(
        boids, 
        mousePos, 
        beaconActive, 
        gameState, 
        powerupManager, 
        particles, 
        screenShake, 
        shockwaveCooldown, 
        maxCooldown, 
        playerTeam, 
        obstacleManager,
        deltaTime = 0.016,
        rallyCoolOffTimer = 0,
        rallyCoolOffDuration = 1.0
    ) {
        this.time += deltaTime;
        this.clear(screenShake);
        
        this.drawTacticalGrid();
        
        if (gameState === 'playing') {
            const isPlayerDisarmed = beaconActive || (rallyCoolOffTimer > 0);
            this.drawObstacles(obstacleManager);
            this.drawConversionTethers(boids, playerTeam, isPlayerDisarmed);
            this.drawPowerups(powerupManager);
            this.drawParticles(particles || []);
            this.drawShockwaves(deltaTime);
            this.drawTacticalBeacon(mousePos, beaconActive, playerTeam, shockwaveCooldown, maxCooldown, rallyCoolOffTimer, rallyCoolOffDuration);
        }
        
        this.drawBoids(boids, powerupManager, playerTeam);
        
        if (gameState === 'playing') {
            this.drawFloatingTexts(deltaTime);
        }
        
        this.drawVignette();
        this.ctx.restore();
    }
}

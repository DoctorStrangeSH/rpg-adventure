// Экран карты
import { gameState } from '../core/state.js';
import { LOCATIONS, getLocation } from '../data/locations.js';
import { CLASSES } from '../data/classes.js';

let mapState = {
    canvas: null,
    ctx: null,
    selectedLocation: null,
    playerX: 100,
    playerY: 100,
    isAnimating: false
};

export function initMap() {
    mapState.canvas = document.getElementById('map-canvas');
    mapState.ctx = mapState.canvas.getContext('2d');
    
    resizeMap();
    window.addEventListener('resize', resizeMap);
    
    mapState.canvas.addEventListener('click', handleMapClick);
}

function resizeMap() {
    if (!mapState.canvas) return;
    
    const container = mapState.canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    mapState.canvas.width = width;
    mapState.canvas.height = height;
    
    scaleLocations(width, height);
    drawMap();
}

function scaleLocations(width, height) {
    const originalWidth = 400;
    const originalHeight = 450;
    
    LOCATIONS.forEach(location => {
        location.scaledX = (location.x / originalWidth) * width;
        location.scaledY = (location.y / originalHeight) * height;
    });
    
    if (mapState.playerX === 100 && mapState.playerY === 100) {
        mapState.playerX = (100 / originalWidth) * width;
        mapState.playerY = (100 / originalHeight) * height;
    }
}

function drawMap() {
    const ctx = mapState.ctx;
    const canvas = mapState.canvas;
    
    if (!ctx || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a5c1a');
    gradient.addColorStop(0.5, '#2d7d2d');
    gradient.addColorStop(1, '#1a4c1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    drawRoads(ctx);
    
    LOCATIONS.forEach(location => {
        drawLocation(ctx, location);
    });
    
    drawPlayer(ctx);
}

function drawRoads(ctx) {
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const roads = [
        [4, 0], // Деревня - Лес
        [0, 1], // Лес - Горы
        [0, 2], // Лес - Руины
        [1, 3], // Горы - Логово дракона
        [2, 3]  // Руины - Логово дракона
    ];
    
    roads.forEach(road => {
        const from = LOCATIONS[road[0]];
        const to = LOCATIONS[road[1]];
        
        if (!from || !to) return;
        
        ctx.beginPath();
        ctx.moveTo(from.scaledX || from.x, from.scaledY || from.y);
        ctx.lineTo(to.scaledX || to.x, to.scaledY || to.y);
        ctx.stroke();
    });
}

function drawLocation(ctx, location) {
    const x = location.scaledX || location.x;
    const y = location.scaledY || location.y;
    const isSelected = mapState.selectedLocation === location.id;
    const player = gameState.player;
    const isAccessible = location.unlocked !== false && player.level >= location.minLevel;
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    
    ctx.fillStyle = location.color;
    ctx.beginPath();
    ctx.arc(x, y, isSelected ? 30 : 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
    
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(location.icon, x, y);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(location.name, x, y - 35);
    
    if (location.minLevel > 1) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Arial';
        ctx.fillText(`Ур. ${location.minLevel}+`, x, y + 35);
    }
    
    if (location.totalStages) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px Arial';
        ctx.fillText(`${location.totalStages} этапов`, x, y + 47);
    }
    
    if (!isAccessible) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 25, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff4444';
        ctx.font = '20px Arial';
        ctx.fillText('🔒', x, y);
    }
}

function drawPlayer(ctx) {
    const classData = CLASSES[gameState.player.class];
    const x = mapState.playerX;
    const y = mapState.playerY;
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    
    ctx.fillStyle = '#4a90e2';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.font = '15px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(classData.icon, x, y);
}

function handleMapClick(event) {
    const rect = mapState.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    let closestLocation = null;
    let minDistance = 40;
    
    LOCATIONS.forEach(location => {
        const locX = location.scaledX || location.x;
        const locY = location.scaledY || location.y;
        const distance = Math.sqrt((x - locX) ** 2 + (y - locY) ** 2);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestLocation = location;
        }
    });
    
    if (closestLocation) {
        selectLocation(closestLocation);
    }
}

function selectLocation(location) {
    const player = gameState.player;
    
    mapState.selectedLocation = location.id;
    drawMap();
    
    const overlay = document.getElementById('map-overlay');
    const isAccessible = location.unlocked !== false && player.level >= location.minLevel;
    
    const canvasHeight = mapState.canvas?.height || 400;
    const locationY = location.scaledY || location.y;
    const isBottom = locationY > canvasHeight * 0.6;
    
    overlay.className = 'map-overlay active ' + (isBottom ? 'top' : 'bottom');
    
    let buttonText = 'Войти';
    if (location.type === 'safe') {
        buttonText = 'Отдохнуть';
    } else if (location.unlocked === false) {
        buttonText = 'Закрыто';
    } else if (player.level < location.minLevel) {
        buttonText = `Нужен ${location.minLevel} уровень`;
    }
    
    overlay.innerHTML = `
        <div class="location-info">
            <div class="location-name">${location.name}</div>
            <div class="location-description">${location.description}</div>
            ${location.totalStages ? `<div class="location-level">Этапов: ${location.totalStages}</div>` : ''}
            <div class="location-level">Уровень: ${location.minLevel}+</div>
        </div>
        <button class="map-btn" 
                onclick="window.enterLocation('${location.id}')"
                ${!isAccessible ? 'disabled' : ''}>
            ${buttonText}
        </button>
    `;
    
    overlay.classList.add('active');
}

export function enterLocation(locationId) {
    const location = getLocation(locationId);
    if (!location) return;
    
    const player = gameState.player;
    
    if (location.type === 'safe') {
        window.heal(player.maxHealth);
        window.restoreMana(player.maxMana);
        window.showNotification('Вы отдохнули в деревне!', 'success');
        return;
    }
    
    if (location.unlocked === false) {
        window.showNotification('Локация закрыта! Пройдите предыдущую.', 'error');
        return;
    }
    
    if (player.level < location.minLevel) {
        window.showNotification(`Требуется ${location.minLevel} уровень!`, 'error');
        return;
    }
    
    window.startLocation(location.id);
}

export function updateMapScreen() {
    if (!mapState.canvas) {
        initMap();
    } else {
        resizeMap();
    }
    drawMap();
}
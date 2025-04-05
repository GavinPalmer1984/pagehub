const ball = document.getElementById('ball');

// Ball properties
let posX = window.innerWidth / 2; // Initial X position (center)
let posY = window.innerHeight / 2; // Initial Y position (center)
let speedX = 5; // Speed in X direction
let speedY = 5; // Speed in Y direction
const ballSize = 50; // Must match CSS width/height

// Dark theme color palette (example)
const colors = [
    '#BB86FC', // Purple
    '#03DAC6', // Teal
    '#CF6679', // Error Red
    '#3700B3', // Deep Purple
    '#1F1F1F', // Darker Gray
    '#F2F2F2', // Light Gray (for contrast)
    '#FF0266'  // Bright Pink
];
let colorIndex = 0;

function getRandomColor() {
    const newIndex = Math.floor(Math.random() * colors.length);
    // Ensure the new color is different from the current one
    return newIndex === colorIndex ? getRandomColor() : colors[newIndex];
}

function update() {
    // Move ball
    posX += speedX;
    posY += speedY;

    // Wall collision detection
    let collided = false;
    if (posX + ballSize > window.innerWidth || posX < 0) {
        speedX = -speedX;
        posX = Math.max(0, Math.min(posX, window.innerWidth - ballSize)); // Prevent sticking
        collided = true;
    }
    if (posY + ballSize > window.innerHeight || posY < 0) {
        speedY = -speedY;
        posY = Math.max(0, Math.min(posY, window.innerHeight - ballSize)); // Prevent sticking
        collided = true;
    }

    // Change color on collision
    if (collided) {
        const newColor = getRandomColor();
        ball.style.backgroundColor = newColor;
        colorIndex = colors.indexOf(newColor);
    }

    // Update ball position
    ball.style.left = posX + 'px';
    ball.style.top = posY + 'px';

    // Request next frame
    requestAnimationFrame(update);
}

// Initial positioning
ball.style.left = posX + 'px';
ball.style.top = posY + 'px';

// Start the animation
requestAnimationFrame(update);

// Adjust ball position and boundaries on window resize
window.addEventListener('resize', () => {
    // Optional: Recenter or adjust logic if needed
    // For now, just ensure it doesn't get stuck outside new bounds
    posX = Math.max(0, Math.min(posX, window.innerWidth - ballSize));
    posY = Math.max(0, Math.min(posY, window.innerHeight - ballSize));
}); 
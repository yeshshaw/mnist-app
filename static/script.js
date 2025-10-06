const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const predictBtn = document.getElementById('predictBtn');
const clearBtn = document.getElementById('clearBtn');
const thickness = document.getElementById('thickness');
const result = document.getElementById('result');

// Fixed brush width
const BRUSH_SIZE = 5;

// Initialize canvas
ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.strokeStyle = "white";
ctx.lineWidth = BRUSH_SIZE;
ctx.lineCap = "round";

let drawing = false;

// Drawing events
canvas.addEventListener('mousedown', () => drawing = true);
canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mouseleave', () => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mousemove', draw);

// Brush size change
thickness.addEventListener('input', () => ctx.lineWidth = BRUSH_SIZE);

// Clear canvas
clearBtn.addEventListener('click', () => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    result.innerText = "";
});

// Draw function
function draw(e) {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

// Helper: get bounding box
function getBoundingBox(imgData) {
    let minX = 28, minY = 28, maxX = 0, maxY = 0;
    for (let y = 0; y < 28; y++) {
        for (let x = 0; x < 28; x++) {
            let i = (y * 28 + x) * 4;
            let avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
            if (avg > 10) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    return {minX, minY, maxX, maxY};
}

// Helper: deskew canvas (simple method)
function deskewCanvas(ctx, imgData) {
    // Compute center of mass
    let cx = 0, cy = 0, m = 0;
    for (let y = 0; y < 28; y++) {
        for (let x = 0; x < 28; x++) {
            let i = (y * 28 + x) * 4;
            let val = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3 / 255;
            cx += x * val;
            cy += y * val;
            m += val;
        }
    }
    if (m === 0) return ctx; // empty
    cx /= m;
    cy /= m;
    // Translate to center
    const dx = 14 - cx;
    const dy = 14 - cy;
    const temp = ctx.getImageData(0, 0, 28, 28);
    ctx.clearRect(0, 0, 28, 28);
    ctx.putImageData(temp, dx, dy);
    return ctx;
}

// Optional: simple blur using canvas filter
function blurCanvas(ctx) {
    ctx.filter = 'blur(0.5px)'; // slight blur
    const img = ctx.getImageData(0,0,28,28);
    ctx.clearRect(0,0,28,28);
    ctx.putImageData(img,0,0);
    ctx.filter = 'none';
    return ctx;
}

// Predict function
predictBtn.addEventListener('click', () => {
    // 1. Draw user canvas to 28x28 temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = "black";
    tempCtx.fillRect(0, 0, 28, 28);
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.drawImage(canvas, 0, 0, 28, 28);

    // 2. Get image data
    let imgData = tempCtx.getImageData(0,0,28,28);

    // 3. Bounding box
    const box = getBoundingBox(imgData);
    const boxWidth = box.maxX - box.minX + 1;
    const boxHeight = box.maxY - box.minY + 1;

    if(boxWidth <= 0 || boxHeight <=0) return; // nothing drawn

    // 4. Scale proportionally to 20x20 box
    let scale = 20 / Math.max(boxWidth, boxHeight);
    const digitWidth = boxWidth * scale;
    const digitHeight = boxHeight * scale;

    // 5. Create 28x28 final canvas
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 28;
    finalCanvas.height = 28;
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.fillStyle = "black";
    finalCtx.fillRect(0,0,28,28);
    finalCtx.imageSmoothingEnabled = true;

    // Center digit
    const offsetX = Math.floor((28 - digitWidth) / 2);
    const offsetY = Math.floor((28 - digitHeight) / 2);

    finalCtx.drawImage(
        tempCanvas,
        box.minX, box.minY, boxWidth, boxHeight, // source
        offsetX, offsetY, digitWidth, digitHeight // destination
    );

    // 6. Deskew + blur
    let finalImgData = finalCtx.getImageData(0,0,28,28);
    deskewCanvas(finalCtx, finalImgData);
    blurCanvas(finalCtx);

    // 7. Convert to grayscale 0-1
    finalImgData = finalCtx.getImageData(0,0,28,28);
    const pixels = [];
    for (let i = 0; i < finalImgData.data.length; i += 4) {
        let avg = (finalImgData.data[i] + finalImgData.data[i+1] + finalImgData.data[i+2]) / 3;
        pixels.push(avg/255); // black=0, white=1
    }

    // ✅ Backend URL fixed to port 8000
   const BASE_URL = window.location.origin;

fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ pixels: pixels })
})
.then(res => res.json())
.then(data => {
    result.innerText = data.error ? data.error : "Prediction: " + data.prediction;
})
.catch(err => {
    result.innerText = "Error connecting to backend!";
    console.error(err);
});
});
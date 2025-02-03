// This module would interface with your webcam and ML model

// Import OpenCV.js
import cv from '@techstark/opencv-js';
import { loadOpenCv } from './opencvLoader'; // We'll create this

let videoStream = null;
let cardDetectionStream = null; // New stream for card detection camera
let isOpenCvLoaded = false;

const COLOR_MAP = {
    'red': [7, 55, 187],
    'green': [9, 95, 52],
    'blue': [131, 89, 22],
    'yellow': [34, 169, 214],
    'orange': [12, 104, 199],
    'purple': [75, 36, 100]
};

// Function to list available cameras
export const listCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
};

export const initializeDetection = async (mainCameraId, cardCameraId) => {
    if (!isOpenCvLoaded) {
        await loadOpenCv();
        isOpenCvLoaded = true;
    }

    try {
        // Setup main webcam
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                deviceId: mainCameraId ? { exact: mainCameraId } : undefined,
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });

        // Setup card detection webcam
        cardDetectionStream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: cardCameraId ? { exact: cardCameraId } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });

        console.log('Both cameras initialized successfully');
    } catch (error) {
        console.error('Error initializing cameras:', error);
        throw error;
    }
};

const getDominantColor = (image, k = 3) => {
    // Resize image to speed up processing
    const resized = new cv.Mat();
    cv.resize(image, resized, new cv.Size(64, 64));
    
    // Reshape image to a list of pixels
    const pixels = resized.reshape(1, resized.rows * resized.cols);
    
    // Convert to float32
    const samples = new cv.Mat(pixels.rows, pixels.cols, cv.CV_32F);
    pixels.convertTo(samples, cv.CV_32F);
    
    // Perform k-means clustering
    const labels = new cv.Mat();
    const centers = new cv.Mat();
    const criteria = new cv.TermCriteria(
        cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER,
        100,
        0.2
    );
    
    cv.kmeans(
        samples,
        k,
        labels,
        criteria,
        10,
        cv.KMEANS_RANDOM_CENTERS,
        centers
    );
    
    // Get the most frequent color
    const labelCounts = new Map();
    for (let i = 0; i < labels.rows; i++) {
        const label = labels.data32S[i];
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
    
    let maxCount = 0;
    let dominantLabel = 0;
    labelCounts.forEach((count, label) => {
        if (count > maxCount) {
            maxCount = count;
            dominantLabel = label;
        }
    });
    
    // Get the RGB values of the dominant color
    const dominantColor = [
        centers.data32F[dominantLabel * 3],
        centers.data32F[dominantLabel * 3 + 1],
        centers.data32F[dominantLabel * 3 + 2]
    ];
    
    // Clean up
    resized.delete();
    pixels.delete();
    samples.delete();
    labels.delete();
    centers.delete();
    
    return dominantColor;
};

const classifyColor = (color) => {
    let minDist = Infinity;
    let colorName = 'unknown';
    
    Object.entries(COLOR_MAP).forEach(([name, rgb]) => {
        const dist = Math.sqrt(
            Math.pow(rgb[0] - color[0], 2) +
            Math.pow(rgb[1] - color[1], 2) +
            Math.pow(rgb[2] - color[2], 2)
        );
        
        if (dist < minDist) {
            minDist = dist;
            colorName = name;
        }
    });
    
    return colorName;
};

export const detectCard = async () => {
    try {
        if (!cardDetectionStream) {
            throw new Error('Card detection camera not initialized');
        }

        // Capture frame from card detection camera
        const frame = await captureFrame(cardDetectionStream);
        
        // Convert to OpenCV format
        const src = cv.matFromImageData(frame);
        
        // Get center crop
        const height = src.rows;
        const width = src.cols;
        const centerRect = new cv.Rect(
            Math.floor(width * 0.45),
            Math.floor(height * 0.45),
            Math.floor(width * 0.1),
            Math.floor(height * 0.1)
        );
        const centerCrop = src.roi(centerRect);
        
        // Get dominant color
        const dominantColor = getDominantColor(centerCrop);
        console.log("Dominant color:", dominantColor);
        
        // Classify color
        const colorName = classifyColor(dominantColor);
        console.log("Classified color:", colorName);
        
        // Clean up
        src.delete();
        centerCrop.delete();
        
        // Return card info
        return {
            name: `${colorName} card`,
            color: colorName,
            confidence: 1.0 // You might want to calculate actual confidence
        };
        
    } catch (error) {
        console.error('Error detecting card:', error);
        throw error;
    }
};

const captureFrame = async (stream) => {
    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    await videoElement.play();
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}; 
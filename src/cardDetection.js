// This module would interface with your webcam and ML model

// Import OpenCV.js
import cv from '@techstark/opencv-js';
import { loadOpenCv } from './opencvLoader'; // We'll create this

let videoStream = null;
let cardDetectionStream = null; // New stream for card detection camera
let isOpenCvLoaded = false;

let debugData = {
    originalImage: null,
    colorMasks: {},
    detectedColors: [],
    dominantColor: null,
    numBoxes: 0,
    detectionTime: 0,
    allResults: {}
};

const COLOR_MAP = {
    'red': [7, 55, 187],
    'green': [9, 95, 52],
    'blue': [131, 89, 22],
    'yellow': [34, 169, 214],
    'orange': [12, 104, 199],
    'purple': [75, 36, 100]
};

// Constants for color detection
const COLOR_THRESHOLDS = {
    yellow: {
        hue: [20, 35],  // HSV hue range for yellow
        saturation: [100, 255],
        value: [100, 255],
        rgb: [200, 200, 0]  // Reference yellow color
    }
};

// Define color ranges in HSV with more lenient thresholds
const COLOR_RANGES = {
    yellow: {
        lower: [20, 50, 50],
        upper: [35, 255, 255],
        name: 'yellow'
    },
    blue: {
        lower: [95, 50, 50],
        upper: [130, 255, 255],
        name: 'blue'
    },
    orange: {
        lower: [0, 50, 50],      // Start from 0 to catch all orange
        upper: [30, 255, 255],   // Wider range for orange
        name: 'orange'
    },
    purple: {
        lower: [140, 50, 50],
        upper: [165, 255, 255],
        name: 'purple'
    },
    red: {
        lower: [170, 50, 50],
        upper: [180, 255, 255],
        name: 'red',
        lower2: [0, 50, 50],
        upper2: [5, 255, 255]
    },
    green: {
        lower: [35, 50, 50],
        upper: [95, 255, 255],
        name: 'green'
    }
};

// Function to list available cameras
export const listCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
};

export const initializeDetection = async (mainCameraId, cardCameraId) => {
    try {
        // Load OpenCV if not already loaded
        if (!isOpenCvLoaded) {
            await loadOpenCv();
            isOpenCvLoaded = true;
            console.log('OpenCV initialized successfully');
        }

        // Setup cameras
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
    } catch (error) {
        console.error('Error in initializeDetection:', error);
        throw error;
    }
};

const getDominantColor = (image, k = 3) => {
    try {
        // Ensure image is a valid Mat object
        if (!(image instanceof cv.Mat)) {
            throw new Error('Input must be a valid OpenCV Mat object');
        }

        // Resize image to speed up processing
        const resized = new cv.Mat();
        const size = new cv.Size(64, 64);
        cv.resize(image, resized, size);
        
        // Convert to RGB if necessary
        let rgbImage = new cv.Mat();
        if (resized.channels() === 4) {
            cv.cvtColor(resized, rgbImage, cv.COLOR_RGBA2RGB);
        } else {
            resized.copyTo(rgbImage);
        }
        
        // Convert the image to a matrix of pixels
        const numPixels = rgbImage.rows * rgbImage.cols;
        const pixels = new cv.Mat(numPixels, 3, cv.CV_32F);
        
        // Copy pixel values
        for (let i = 0; i < rgbImage.rows; i++) {
            for (let j = 0; j < rgbImage.cols; j++) {
                const pixel = rgbImage.ucharPtr(i, j);
                const pixelIndex = i * rgbImage.cols + j;
                pixels.floatPtr(pixelIndex)[0] = pixel[0];
                pixels.floatPtr(pixelIndex)[1] = pixel[1];
                pixels.floatPtr(pixelIndex)[2] = pixel[2];
            }
        }
        
        // Perform k-means clustering
        const labels = new cv.Mat();
        const centers = new cv.Mat();
        const criteria = new cv.TermCriteria(
            cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER,
            100,
            0.2
        );
        
        cv.kmeans(
            pixels,
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
            Math.round(centers.floatAt(dominantLabel, 0)),
            Math.round(centers.floatAt(dominantLabel, 1)),
            Math.round(centers.floatAt(dominantLabel, 2))
        ];
        
        // Clean up
        resized.delete();
        rgbImage.delete();
        pixels.delete();
        labels.delete();
        centers.delete();
        
        return dominantColor;
        
    } catch (error) {
        console.error('Error in getDominantColor:', error);
        throw new Error('Failed to process image: ' + error.message);
    }
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

// Function to convert RGB to HSV
const rgbToHsv = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff === 0) h = 0;
    else if (max === r) h = 60 * ((g - b) / diff % 6);
    else if (max === g) h = 60 * ((b - r) / diff + 2);
    else if (max === b) h = 60 * ((r - g) / diff + 4);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : diff / max * 255;
    const v = max * 255;

    return [h, s, v];
};

export const detectCard = async () => {
    const startTime = performance.now();
    
    try {
        const frame = await captureFrame(cardDetectionStream);
        const src = cv.matFromImageData(frame);
        
        // Create smaller ROI (30% of image)
        const centerWidth = Math.floor(src.cols * 0.3);
        const centerHeight = Math.floor(src.rows * 0.3);
        const x = Math.floor((src.cols - centerWidth) / 2);
        const y = Math.floor((src.rows - centerHeight) / 2);
        
        const roi = src.roi(new cv.Rect(x, y, centerWidth, centerHeight));

        // Enhanced preprocessing for better color detection
        const processed = new cv.Mat();
        const temp = new cv.Mat();
        
        // Color enhancement
        cv.cvtColor(roi, temp, cv.COLOR_BGR2Lab);
        cv.convertScaleAbs(temp, temp, 1.2, 0);  // Increase saturation
        cv.cvtColor(temp, processed, cv.COLOR_Lab2BGR);
        
        // Denoise and convert to HSV
        cv.GaussianBlur(processed, processed, new cv.Size(5, 5), 0);
        cv.cvtColor(processed, processed, cv.COLOR_BGR2HSV);

        const results = {};
        const debugMasks = {};
        const debugCanvas = document.createElement('canvas');
        debugCanvas.width = roi.cols;
        debugCanvas.height = roi.rows;

        // Process each color
        for (const [colorName, range] of Object.entries(COLOR_RANGES)) {
            const mask = new cv.Mat();
            
            if (colorName === 'red') {
                // Special handling for red (wraps around in HSV)
                const mask1 = new cv.Mat();
                const mask2 = new cv.Mat();
                
                cv.inRange(processed, 
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.lower)),
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.upper)),
                    mask1
                );
                cv.inRange(processed, 
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.lower2)),
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.upper2)),
                    mask2
                );
                cv.add(mask1, mask2, mask);
                mask1.delete();
                mask2.delete();
            } else if (colorName === 'orange') {
                // Special handling for orange to avoid red overlap
                cv.inRange(processed, 
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.lower)),
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.upper)),
                    mask
                );
                
                // Enhance orange detection
                const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
                cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 2);
                cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);
                kernel.delete();
            } else {
                cv.inRange(processed, 
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.lower)),
                    new cv.Mat(1, 1, cv.CV_8UC3, new cv.Scalar(...range.upper)),
                    mask
                );
            }

            // Clean up mask
            const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
            cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
            cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

            // Find components
            const labels = new cv.Mat();
            const stats = new cv.Mat();
            const centroids = new cv.Mat();
            
            const numLabels = cv.connectedComponentsWithStats(
                mask, labels, stats, centroids, 8, cv.CV_32S
            );

            let boxes = [];
            for (let i = 1; i < numLabels; i++) {
                const area = stats.intAt(i, cv.CC_STAT_AREA);
                const width = stats.intAt(i, cv.CC_STAT_WIDTH);
                const height = stats.intAt(i, cv.CC_STAT_HEIGHT);
                
                // Adjusted area constraints
                if (area > 100 && area < 15000 && width/height > 0.3 && width/height < 3.0) {
                    boxes.push(area);
                    console.log(`${colorName}: Found box with area ${area}, ratio ${width/height}`);
                }
            }

            // Keep only 1 or 2 largest boxes
            if (boxes.length > 0) {
                boxes.sort((a, b) => b - a);
                boxes = boxes.slice(0, Math.min(2, boxes.length));
                
                results[colorName] = {
                    numBoxes: boxes.length,
                    areas: boxes
                };

                // Save debug mask
                cv.imshow(debugCanvas, mask);
                debugMasks[colorName] = debugCanvas.toDataURL();
            }

            // Clean up
            kernel.delete();
            mask.delete();
            labels.delete();
            stats.delete();
            centroids.delete();
        }

        // Find dominant color (color with most boxes, or largest area if tie)
        let dominantColor = null;
        let maxBoxes = 0;
        let maxArea = 0;

        Object.entries(results).forEach(([color, data]) => {
            const totalArea = data.areas.reduce((a, b) => a + b, 0);
            if (data.numBoxes > maxBoxes || 
                (data.numBoxes === maxBoxes && totalArea > maxArea)) {
                maxBoxes = data.numBoxes;
                maxArea = totalArea;
                dominantColor = color;
            }
        });

        // Update debug visualization
        cv.imshow(debugCanvas, roi);  // Show original ROI
        debugData.originalImage = debugCanvas.toDataURL();

        // Update the module-level debugData
        debugData = {
            originalImage: debugCanvas.toDataURL(),
            colorMasks: debugMasks,
            detectedColors: Object.entries(results).map(([color, data]) => ({
                color,
                numBoxes: data.numBoxes,
                areas: data.areas
            })),
            dominantColor,
            numBoxes: maxBoxes,
            detectionTime: performance.now() - startTime,
            allResults: results
        };

        // Clean up
        processed.delete();
        temp.delete();
        roi.delete();
        src.delete();

        return {
            name: dominantColor ? `${dominantColor} card with ${maxBoxes} box(es)` : 'No card detected',
            color: dominantColor,
            boxes: maxBoxes,
            confidence: dominantColor ? 1.0 : 0
        };

    } catch (error) {
        console.error('Error in detectCard:', error);
        debugData.error = error.message;
        debugData.detectionTime = performance.now() - startTime;
        throw error;
    }
};

export const getDebugData = () => debugData;

const captureFrame = async (stream) => {
    try {
        if (!stream) {
            throw new Error('No video stream available');
        }

        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.width = 1280;  // Set explicit dimensions
        videoElement.height = 720;

        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play().then(resolve);
            };
        });

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 1280;
        canvas.height = videoElement.videoHeight || 720;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Clean up
        videoElement.srcObject = null;
        
        return imageData;
    } catch (error) {
        console.error('Error in captureFrame:', error);
        throw new Error('Failed to capture frame: ' + error.message);
    }
}; 
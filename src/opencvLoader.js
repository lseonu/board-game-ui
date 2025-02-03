export const loadOpenCv = () => {
    return new Promise((resolve, reject) => {
        // Check if OpenCV is already loaded
        if (window.cv) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.5.4/opencv.js';
        script.async = true;
        script.type = 'text/javascript';

        script.onload = () => {
            // Wait for OpenCV to be fully initialized
            if (window.cv) {
                cv['onRuntimeInitialized'] = () => {
                    console.log('OpenCV loaded successfully');
                    resolve();
                };
            } else {
                reject(new Error('OpenCV load failed: cv not found in window'));
            }
        };

        script.onerror = () => {
            reject(new Error('Failed to load OpenCV script'));
        };

        // Add script to document
        document.body.appendChild(script);
    });
};

// Optional: Add a helper function to check if OpenCV is loaded
export const isOpenCvLoaded = () => {
    return !!window.cv;
}; 
import { useState, useCallback, useRef, useEffect } from "react";
import { FaCog, FaTimes } from "react-icons/fa";
import Webcam from "react-webcam";
import {
  Container,
  Heading,
  Button,
  Dialog,
  Flex,
  Box,
  Text,
  Card,
  Switch,
  Slider,
} from "@radix-ui/themes";
import { detectCard, initializeDetection, listCameras } from './cardDetection';
import { controlCardReader } from './cardReader';

const App = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    talkback: false,
    extraDim: false,
    darkTheme: false,
    fontSize: 80,  // Changed default to 80%
    colorblindMode: 'none' // none, protanopia, deuteranopia, tritanopia
  });
  
  const webcamRef = useRef(null);
  const [isWebcamActive, setIsWebcamActive] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [detectedCard, setDetectedCard] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedMainCamera, setSelectedMainCamera] = useState(null);
  const [selectedCardCamera, setSelectedCardCamera] = useState(null);
  const [isCameraSetupComplete, setIsCameraSetupComplete] = useState(false);

  const handleNotification = useCallback((message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 10000);
  }, []);

  const handleDrawCard = async () => {
    try {
      setIsReading(true);
      
      // 1. Activate card reader
      await controlCardReader.drawCard();
      
      // 2. Wait briefly for card to be positioned
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 3. Capture and analyze image from webcam
      const cardInfo = await detectCard();
      
      // 4. Update notification with detected card
      setDetectedCard(cardInfo);
      setNotificationMessage(`Drew card: ${cardInfo.name}`);
      setShowNotification(true);
      
      // 5. Send to server
      await fetch('/api/game/drawCard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ card: cardInfo })
      });

    } catch (error) {
      console.error('Error drawing card:', error);
      setNotificationMessage('Error drawing card. Please try again.');
      setShowNotification(true);
    } finally {
      setIsReading(false);
    }
  };

  const handleMove = useCallback(() => {
    handleNotification("Piece moved!");
  }, [handleNotification]);

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "environment" // This will prefer the back camera if available
  };

  // Initialize cameras on component mount
  useEffect(() => {
    const setupCameras = async () => {
      try {
        const availableCameras = await listCameras();
        setCameras(availableCameras);
        
        // If we have at least two cameras, auto-select them
        if (availableCameras.length >= 2) {
          setSelectedMainCamera(availableCameras[0].deviceId);
          setSelectedCardCamera(availableCameras[1].deviceId);
        }
      } catch (error) {
        console.error('Error listing cameras:', error);
        setNotificationMessage('Error setting up cameras');
        setShowNotification(true);
      }
    };

    setupCameras();
  }, []);

  // Initialize detection when cameras are selected
  useEffect(() => {
    const initDetection = async () => {
      if (selectedMainCamera && selectedCardCamera) {
        try {
          await initializeDetection(selectedMainCamera, selectedCardCamera);
          setIsCameraSetupComplete(true);
        } catch (error) {
          console.error('Error initializing detection:', error);
          setNotificationMessage('Error initializing cameras');
          setShowNotification(true);
        }
      }
    };

    initDetection();
  }, [selectedMainCamera, selectedCardCamera]);

  // Apply dark theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkTheme) {
      root.classList.add('dark-theme');
      document.body.style.backgroundColor = '#1a1a1a';
      document.body.style.color = '#ffffff';
    } else {
      root.classList.remove('dark-theme');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    }
  }, [settings.darkTheme]);

  // Apply extra dim
  useEffect(() => {
    const overlay = document.createElement('div');
    overlay.id = 'dim-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    overlay.style.transition = 'opacity 0.3s';

    if (settings.extraDim) {
      document.body.appendChild(overlay);
    } else {
      const existingOverlay = document.getElementById('dim-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
    }

    return () => {
      const existingOverlay = document.getElementById('dim-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
    };
  }, [settings.extraDim]);

  // Apply font size - Updated implementation
  useEffect(() => {
    const applyFontSize = (size) => {
      // Apply to specific text elements instead of root
      const elements = {
        heading: document.querySelector('h1'),
        buttons: document.querySelectorAll('button'),
        texts: document.querySelectorAll('p, span, div'),
        dialogTexts: document.querySelectorAll('div[role="dialog"] *')
      };

      const scale = size / 100; // Convert percentage to scale factor

      if (elements.heading) {
        elements.heading.style.fontSize = `${2.25 * scale}rem`; // Base size for h1 is 2.25rem
      }

      elements.buttons.forEach(button => {
        if (button.classList.contains('text-3xl')) {
          button.style.fontSize = `${1.875 * scale}rem`; // Base size for text-3xl is 1.875rem
        }
      });

      elements.texts.forEach(text => {
        const currentSize = window.getComputedStyle(text).fontSize;
        const baseSize = parseFloat(currentSize);
        if (baseSize) {
          text.style.fontSize = `${baseSize * scale}px`;
        }
      });

      elements.dialogTexts.forEach(text => {
        if (text.tagName !== 'BUTTON') {
          text.style.fontSize = `${1 * scale}rem`; // Base size for dialog text
        }
      });
    };

    applyFontSize(settings.fontSize);

    // Cleanup function
    return () => {
      applyFontSize(100); // Reset to default size when component unmounts
    };
  }, [settings.fontSize]);

  // Apply colorblind mode
  useEffect(() => {
    const root = document.documentElement;
    const filters = {
      protanopia: 'grayscale(0%) sepia(20%) saturate(80%) hue-rotate(320deg)',
      deuteranopia: 'grayscale(0%) sepia(20%) saturate(90%) hue-rotate(350deg)',
      tritanopia: 'grayscale(0%) sepia(20%) saturate(80%) hue-rotate(180deg)',
      none: 'none'
    };
    
    root.style.filter = filters[settings.colorblindMode];
  }, [settings.colorblindMode]);

  // TalkBack functionality
  useEffect(() => {
    if (settings.talkback) {
      // Initialize speech synthesis
      const speak = (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      };

      // Add event listeners for interactive elements
      const elements = document.querySelectorAll('button, [role="button"], a, input, select');
      elements.forEach(element => {
        element.addEventListener('focus', () => {
          const text = element.getAttribute('aria-label') || element.textContent;
          speak(text);
        });
      });

      return () => {
        elements.forEach(element => {
          element.removeEventListener('focus', () => {});
        });
        window.speechSynthesis.cancel();
      };
    }
  }, [settings.talkback]);

  // Apply all settings to the main app styles
  const getAppStyles = () => {
    return {
      backgroundColor: settings.darkTheme ? '#1a1a1a' : '#ffffff',
      color: settings.darkTheme ? '#ffffff' : '#000000',
      transition: 'background-color 0.3s, color 0.3s',
    };
  };

  const getButtonStyles = (baseColor) => {
    return {
      backgroundColor: settings.darkTheme ? `${baseColor}88` : baseColor,
      color: '#ffffff',  // Always white text for normal vision
    };
  };

  // Add camera selector to the main render
  const renderCameraSelector = () => {
    if (cameras.length < 2) {
      return (
        <div style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          backgroundColor: settings.darkTheme ? '#2d2d2d' : '#ffffff',
          padding: '32px 48px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          textAlign: 'center',
          maxWidth: '80%',
          width: '400px'
        }}>
          <Text size="8" style={{ // Increased from size="5" to size="8"
            color: '#be185d',
            fontWeight: '500',
            lineHeight: '1.5',
            fontSize: '2rem' // Added explicit font size
          }}>
            Please connect at least two cameras to use the card detection feature.
          </Text>
        </div>
      );
    }

    return (
      <Dialog.Root>
        <Dialog.Trigger>
          <Button 
            variant="soft" 
            color="gray"
            style={{ position: 'fixed', bottom: '20px', right: '20px' }}
          >
            Configure Cameras
          </Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Camera Configuration</Dialog.Title>
          
          <Flex direction="column" gap="4">
            <Box>
              <Text size="4">Main Camera</Text>
              <select 
                value={selectedMainCamera || ''} 
                onChange={(e) => setSelectedMainCamera(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '8px'
                }}
              >
                <option value="">Select main camera</option>
                {cameras.map(camera => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </Box>

            <Box>
              <Text size="4">Card Detection Camera</Text>
              <select 
                value={selectedCardCamera || ''} 
                onChange={(e) => setSelectedCardCamera(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '8px'
                }}
              >
                <option value="">Select card detection camera</option>
                {cameras.map(camera => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </Box>
          </Flex>

          <Dialog.Close>
            <Button variant="soft" color="gray" style={{ marginTop: '20px' }}>
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Root>
    );
  };

  return (
    <Box className="h-screen flex flex-col overflow-hidden" style={getAppStyles()}>
      {/* Removed the top margin div */}
      
      <Box 
        className="py-1" 
        style={{ 
          backgroundColor: settings.darkTheme ? '#2d1a1a' : '#fce7f3',
          height: '48px',
          marginBottom: '24px'
        }}
      />

      <Container size="4">
        <Flex justify="between" align="center">
          <Heading 
            as="h1" 
            size="6" 
            className="text-3xl"
            style={{ 
              color: settings.darkTheme ? '#ffffff' : '#1a1a1a',
              marginLeft: '24px'
            }}
          >
            Current Board Game Status
          </Heading>
          <div style={{ marginRight: '24px' }}>
            <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
              <Dialog.Trigger>
                <Button 
                  variant="ghost"
                  className="hover:opacity-70"
                  aria-label="Settings"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px',
                    color: '#be185d'
                  }}
                >
                  <FaCog size={32} />
                </Button>
              </Dialog.Trigger>
              <Dialog.Content style={{ maxWidth: '500px', padding: '32px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <Dialog.Title className="text-2xl">Accessibility Settings</Dialog.Title>
                </div>
                
                {/* TalkBack Setting */}
                <div style={{ marginBottom: '14px' }}>
                  <Flex direction="row" justify="between" align="center">
                    <Text size="4">TalkBack (Screen Reader)</Text>
                    <Switch 
                      checked={settings.talkback}
                      onCheckedChange={(checked) => handleSettingChange('talkback', checked)}
                      aria-label="Toggle TalkBack"
                    />
                  </Flex>
                </div>

                {/* Extra Dim Setting */}
                <div style={{ marginBottom: '14px' }}>
                  <Flex direction="row" justify="between" align="center">
                    <Text size="4">Extra Dim</Text>
                    <Switch 
                      checked={settings.extraDim}
                      onCheckedChange={(checked) => handleSettingChange('extraDim', checked)}
                      aria-label="Toggle Extra Dim"
                    />
                  </Flex>
                </div>

                {/* Dark Theme Setting */}
                <div style={{ marginBottom: '14px' }}>
                  <Flex direction="row" justify="between" align="center">
                    <Text size="4">Dark Theme</Text>
                    <Switch 
                      checked={settings.darkTheme}
                      onCheckedChange={(checked) => handleSettingChange('darkTheme', checked)}
                      aria-label="Toggle Dark Theme"
                    />
                  </Flex>
                </div>

                {/* Font Size Setting */}
                <div style={{ marginBottom: '14px' }}>
                  <Box>
                    <Text size="4" style={{ marginBottom: '16px' }}>
                      Font Size
                    </Text>
                    <Slider 
                      value={[settings.fontSize]}
                      onValueChange={(value) => handleSettingChange('fontSize', value[0])}
                      min={75}
                      max={150}
                      step={5}
                      aria-label="Adjust Font Size"
                    />
                    <Text size="2" style={{ marginTop: '8px' }} className="text-gray-500">
                      {settings.fontSize}%
                    </Text>
                  </Box>
                </div>

                {/* Colorblind Mode Setting - Updated Styling */}
                <div style={{ marginBottom: '14px' }}>
                  <Flex direction="row" justify="between" align="center">
                    <Text size="4">Color Vision Setting</Text>
                    <select
                      value={settings.colorblindMode}
                      onChange={(e) => handleSettingChange('colorblindMode', e.target.value)}
                      style={{
                        width: '200px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: settings.darkTheme ? '#2d2d2d' : '#f8fafc',
                        color: settings.darkTheme ? '#ffffff' : '#1a1a1a',
                        fontSize: '14px',
                        cursor: 'pointer',
                        outline: 'none',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.2s ease-in-out',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                        backgroundSize: '16px',
                        paddingRight: '32px'
                      }}
                      aria-label="Select Color Vision Setting"
                    >
                      <option value="none">Normal Vision</option>
                      <option value="protanopia">Protanopia</option>
                      <option value="deuteranopia">Deuteranopia</option>
                      <option value="tritanopia">Tritanopia</option>
                    </select>
                  </Flex>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <Flex gap="3" justify="end">
                    <Dialog.Close>
                      <Button variant="soft" color="gray">
                        Close
                      </Button>
                    </Dialog.Close>
                  </Flex>
                </div>
              </Dialog.Content>
            </Dialog.Root>
          </div>
        </Flex>
      </Container>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow">
        {/* Container with padding */}
        <div style={{ 
          paddingTop: '40px',
          paddingBottom: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Live Stream Section */}
          <Box 
            className="rounded-lg"
            style={{
              width: '600px',
              height: '450px',
              backgroundColor: settings.darkTheme ? '#2d2d2d' : '#1a1a1a',
              border: settings.darkTheme ? '2px solid #444' : 'none'
            }}
          >
            {isWebcamActive ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                videoConstraints={{
                  width: 600,
                  height: 450,
                  facingMode: "environment"
                }}
                width={600}
                height={450}
                className="rounded-lg"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <Text 
                size="5" 
                className={settings.darkTheme ? 'text-gray-300' : 'text-white'}
              >
                Webcam is disabled
              </Text>
            )}
          </Box>
        </div>

        {/* Game Controls with larger buttons */}
        <div className="mb-16">
          <Flex gap="8" justify="center" className="h-36" style={{ marginBottom: '24px' }}>
            <Button 
              size="4"
              variant="solid"
              className="px-14 h-full text-3xl font-bold w-60"
              onClick={handleDrawCard}
              style={getButtonStyles('#f472b6')}
            >
              Draw Card
            </Button>
            <Button 
              size="4"
              variant="solid"
              className="px-14 h-full text-3xl font-bold w-60"
              onClick={handleMove}
              style={getButtonStyles('#be185d')}
            >
              Move
            </Button>
          </Flex>
        </div>
      </div>

      {/* Centered Popup Notification using Flex */}
      {showNotification && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          }}
        >
          <Box 
            role="alert"
            aria-live="polite"
            style={{
              backgroundColor: settings.darkTheme ? '#2d2d2d' : '#ffffff',
              color: settings.darkTheme ? '#ffffff' : '#000000',
              fontSize: '2rem',
              padding: '20px 40px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              animation: 'fadeInScale 0.3s ease-out',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setShowNotification(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '5px',
                color: settings.darkTheme ? '#ffffff80' : '#00000080',
                transition: 'color 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = settings.darkTheme ? '#ffffff' : '#000000'}
              onMouseOut={(e) => e.currentTarget.style.color = settings.darkTheme ? '#ffffff80' : '#00000080'}
              aria-label="Close notification"
            >
              <FaTimes size={24} />
            </button>

            <div style={{
              minWidth: '300px',
              textAlign: 'center'
            }}>
              <Text style={{ 
                fontSize: '2rem',
                fontWeight: '500'
              }}>
                {notificationMessage}
              </Text>
            </div>
          </Box>
        </div>
      )}

      {renderCameraSelector()}

      <style jsx global>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </Box>
  );
};

export default App;
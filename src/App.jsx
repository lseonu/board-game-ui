import { useState, useCallback, useRef, useEffect } from "react";
import { FaCog, FaTimes } from "react-icons/fa";
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
import { useWebSocket } from './hooks/useWebSocket';
import GameBoard from './components/GameBoard';

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

  const {
    isConnected,
    gameState,
    isAligning,
    alignmentFrame,
    drawnCard,
    pathToTarget,
    movePrompt
  } = useWebSocket();

  const handleNotification = useCallback((message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 10000);
  }, []);

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

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

        {/* Game Status */}
        {gameState && (
          <Box mb="4">
            <Text size="5" weight="bold">
              Turn {gameState.turn_number + 1} - {gameState.current_piece}'s Turn
            </Text>
          </Box>
        )}

        {/* Alignment View */}
        {isAligning && (
          <Box className="relative">
            <Text size="4" mb="2">Aligning corners of game board...</Text>
            {alignmentFrame ? (
              <img 
                src={alignmentFrame} 
                alt="Board alignment" 
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  border: '2px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: '#f0f0f0'
                }}
                onError={(e) => {
                  console.error('Error loading image:', e);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <Box 
                style={{ 
                  width: '100%',
                  height: '50vh',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px'
                }}
              >
                <Text>Waiting for camera feed...</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Game Board View */}
        {!isAligning && gameState && (
          <Box className="relative">
            <GameBoard 
              gameState={gameState}
              pathToTarget={pathToTarget}
            />
          </Box>
        )}

        {/* Card and Move Prompts */}
        {drawnCard && (
          <Box mt="4">
            <Text size="4">Drew card: {drawnCard}</Text>
          </Box>
        )}

        {movePrompt && (
          <Box mt="4">
            <Text size="4">{movePrompt}</Text>
          </Box>
        )}

        {/* Game Controls */}
        <div className="mb-16">
          <Flex gap="8" justify="center" className="h-36" style={{ marginBottom: '24px' }}>
            <Button 
              size="4"
              variant="solid"
              className="px-14 h-full text-3xl font-bold w-60"
              onClick={() => {
                // Send draw card command to server via websocket
                if (ws && isConnected) {
                  ws.send(JSON.stringify({ command: 'draw_card' }));
                }
              }}
              style={getButtonStyles('#f472b6')}
            >
              Draw Card
            </Button>
            <Button 
              size="4"
              variant="solid"
              className="px-14 h-full text-3xl font-bold w-60"
              onClick={() => {
                // Send move command to server via websocket
                if (ws && isConnected) {
                  ws.send(JSON.stringify({ command: 'move' }));
                }
              }}
              style={getButtonStyles('#be185d')}
            >
              Move
            </Button>
          </Flex>
        </div>
      </Container>

      {/* Centered Popup Notification */}
      {showNotification && (
        <div style={{
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
        }}>
          <Box 
              role="alert"
              aria-live="polite"
              style={{
                  backgroundColor: settings.darkTheme ? '#2d2d2d' : '#ffffff',
                  color: settings.darkTheme ? '#ffffff' : '#000000',
                  padding: '30px 50px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  animation: 'fadeInScale 0.3s ease-out',
                  position: 'relative',
                  minWidth: '400px'
              }}
          >
              <button
                  onClick={() => setShowNotification(false)}
                  style={{
                      position: 'absolute',
                      top: '15px',
                      right: '15px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '5px',
                      color: settings.darkTheme ? '#ffffff80' : '#00000080'
                  }}
              >
                  <FaTimes size={24} />
              </button>

              <Text style={{ 
                  fontSize: '2.5rem',  // Increased from 2rem
                  fontWeight: '600',   // Increased from 500
                  textAlign: 'center'
              }}>
                  {notificationMessage}
              </Text>
          </Box>
        </div>
      )}

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

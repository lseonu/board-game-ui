import { useState, useEffect, useCallback, useRef } from 'react';

export const useWebSocket = () => {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [isAligning, setIsAligning] = useState(false);
  const [alignmentFrame, setAlignmentFrame] = useState(null);
  const [drawnCard, setDrawnCard] = useState(null);
  // const [targetSquare, setTargetSquare] = useState(null);
  const [pathToTarget, setPathToTarget] = useState(null);
  const [movePrompt, setMovePrompt] = useState(null);
  
  // Use ref to track alignment state immediately
  const isAligningRef = useRef(false);
  
  useEffect(() => {
    // Update ref when state changes
    isAligningRef.current = isAligning;
  }, [isAligning]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8089');

    socket.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received message type:', message.type, "data:", message.data);

        switch (message.type) {
          case 'game_state_update_start':
            isAligningRef.current = true;
            setIsAligning(true);
            console.log('Starting alignment...');
            break;

          case 'game_board_frame':
            if (isAligningRef.current) {  // Use ref instead of state
              const imageData = message.data.image;
              if (imageData?.length > 0) {
                setAlignmentFrame(`data:image/jpeg;base64,${imageData}`);
              }
            }
            break;

          case 'game_state_update_success':
            isAligningRef.current = false;
            setIsAligning(false);
            setAlignmentFrame(null);
            break;

          case 'game_state':
            setGameState(message.data);
            break;

          case 'card_drawn':
            setDrawnCard(message.data);
            break;

          case 'path_to_target':
            setPathToTarget(message.data);
            setMovePrompt("Waiting for player to hit move button...");
            console.log("pathToTarget:", pathToTarget);
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing websocket message:', error);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  // Add this effect to see state changes
  useEffect(() => {
    console.log("pathToTarget updated:", pathToTarget);
  }, [pathToTarget]);

  return {
    isConnected,
    gameState,
    isAligning,
    alignmentFrame,
    drawnCard,
    pathToTarget,
    movePrompt
  };
}; 
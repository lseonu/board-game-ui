import { useEffect, useRef } from 'react';
import boardImage from '../assets/ReferenceMap.png';

const GameBoard = ({ gameState, pathToTarget }) => {
  const canvasRef = useRef(null);
  
  // Add debugging log
  useEffect(() => {
    console.log("GameBoard received pathToTarget:", pathToTarget);
  }, [pathToTarget]);
  
  // Draw game pieces on the board
  useEffect(() => {
    if (!gameState || !canvasRef.current) return;
    console.log("Drawing board with gameState:", gameState);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = new Image();

    image.onload = () => {
      console.log("Image loaded, starting to draw", pathToTarget);
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the board image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Draw pieces
      gameState.pieces.forEach(piece => {
        const square = piece.current_square;
        // Draw piece marker at square center
        ctx.beginPath();
        ctx.arc(square.center[0], square.center[1], 25, 0, 2 * Math.PI);
        ctx.fillStyle = piece.piece_name.split('_')[0].toLowerCase();
        ctx.fill();
      });

      // Draw path if present
      // if (pathToTarget && pathToTarget.length > 0) {
      //   console.log("Drawing path with points:", pathToTarget);
        
      //   // Draw the path
      //   // ctx.beginPath();
      //   console.log("Moving to point 0:", pathToTarget[0]);
      //   ctx.moveTo(pathToTarget[0][0], pathToTarget[0][1]);
        
      //   for (let i = 1; i < pathToTarget.length; i++) {
      //     console.log(`Drawing line to point ${i}:`, pathToTarget[i]);
      //     ctx.lineTo(pathToTarget[i][0], pathToTarget[i][1]);
      //   }
        
      //   ctx.strokeStyle = 'yellow';
      //   ctx.lineWidth = 10; // Make it thicker
      //   ctx.stroke();
        
      //   // // Draw points
      //   // pathToTarget.forEach((point, index) => {
      //   //   ctx.beginPath();
      //   //   ctx.arc(point[0], point[1], 8, 0, 2 * Math.PI);
      //   //   ctx.fillStyle = index === 0 ? 'green' : (index === pathToTarget.length - 1 ? 'red' : 'yellow');
      //   //   ctx.fill();
      //   // });
      // }
    };

    image.src = boardImage;
  }, [gameState, pathToTarget]);

  return (
    <canvas
      ref={canvasRef}
      width={2883}
      height={2550}
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '70vh',
        objectFit: 'contain'
      }}
    />
  );
};

export default GameBoard; 
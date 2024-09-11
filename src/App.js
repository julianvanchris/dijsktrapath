import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Circle, Line, Text, Image } from 'react-konva';
import axios from 'axios';
import './App.css';

function App() {
  const [nodes, setNodes] = useState([]);  
  const [paths, setPaths] = useState([]);  
  const [isPathMode, setIsPathMode] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false); // New state for eraser mode
  const [selectedNode, setSelectedNode] = useState(null);
  const [isSelectingStart, setIsSelectingStart] = useState(false);
  const [isSelectingStop, setIsSelectingStop] = useState(false); // Updated to allow multiple stops
  const [startNode, setStartNode] = useState(null);
  const [stopNodes, setStopNodes] = useState([]); // Store multiple stop nodes with labels
  const [shortestPath, setShortestPath] = useState([]); // To store the path from the backend
  const [animationStep, setAnimationStep] = useState(0); // Step for animation
  const [image, setImage] = useState(null); // To store the background image
  const [imageURL, setImageURL] = useState(null); // To store the image URL
  const [imageWidth, setImageWidth] = useState(0); // Image width
  const [imageHeight, setImageHeight] = useState(0); // Image height
  const [imageX, setImageX] = useState(0); // Image X position
  const [imageY, setImageY] = useState(0); // Image Y position
  const [gridSize, setGridSize] = useState(0); // Grid size input
  const [scale, setScale] = useState(1); // Scaling factor

  const imageRef = useRef(null);

  const handleStageClick = (e) => {
    if (isEraserMode) {
      const { x, y } = e.target.getStage().getPointerPosition();
      // Check if the click is on a node
      const clickedNode = nodes.find(node => Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2) < 10);
      if (clickedNode) {
        handleRemoveNode(clickedNode);
      } else {
        // Check if the click is on a path
        const clickedPathIndex = paths.findIndex((path) => {
          const fromNode = nodes.find(node => node.id === path.from);
          const toNode = nodes.find(node => node.id === path.to);
          if (fromNode && toNode) {
            // Check if click is within 10 pixels of the path
            const distance = pointToLineDistance(x, y, fromNode, toNode);
            return distance < 10;
          }
          return false;
        });

        if (clickedPathIndex !== -1) {
          handleRemovePath(clickedPathIndex);
        }
      }
    } else if (!isPathMode && !isSelectingStart && !isSelectingStop) {
      const { x, y } = e.target.getStage().getPointerPosition();
      setNodes([...nodes, { x, y, id: nodes.length }]);
    }
  };

  const handleNodeClick = (node) => {
    if (isEraserMode) {
      handleRemoveNode(node);
    } else if (isPathMode && selectedNode !== null) {
      setPaths([...paths, { from: selectedNode.id, to: node.id }]);
      setSelectedNode(null);
    } else if (isSelectingStart) {
      setStartNode(node);
      setIsSelectingStart(false);
    } else if (isSelectingStop) {
      // Add node to stopNodes with a sequential label
      if (!stopNodes.some(stop => stop.id === node.id)) {
        setStopNodes([...stopNodes, { ...node, label: stopNodes.length + 1 }]);
      }
    } else {
      setSelectedNode(node);
    }
  };

  const handleRemoveNode = (nodeToRemove) => {
    setNodes(nodes.filter(node => node.id !== nodeToRemove.id));
    setPaths(paths.filter(path => path.from !== nodeToRemove.id && path.to !== nodeToRemove.id));
    if (startNode?.id === nodeToRemove.id) setStartNode(null);
    setStopNodes(stopNodes.filter(stop => stop.id !== nodeToRemove.id));
  };

  const handleRemovePath = (pathIndex) => {
    setPaths(paths.filter((_, index) => index !== pathIndex));
  };

  const pointToLineDistance = (x, y, fromNode, toNode) => {
    const lineLength = Math.sqrt((toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2);
    if (lineLength === 0) return Math.sqrt((x - fromNode.x) ** 2 + (y - fromNode.y) ** 2);
    const t = Math.max(0, Math.min(1, ((x - fromNode.x) * (toNode.x - fromNode.x) + (y - fromNode.y) * (toNode.y - fromNode.y)) / (lineLength ** 2)));
    const projectionX = fromNode.x + t * (toNode.x - fromNode.x);
    const projectionY = fromNode.y + t * (toNode.y - fromNode.y);
    return Math.sqrt((x - projectionX) ** 2 + (y - projectionY) ** 2);
  };

  const handleSubmit = () => {
    if (!startNode || stopNodes.length === 0) {
      alert('Please select both a start node and at least one stop node!');
      return;
    }

    const data = {
      nodes: nodes.map((node) => ({ id: node.id, x: (node.x - imageX) / scale, y: (node.y - imageY) / scale })),
      paths: paths.map((path) => ({ from: path.from, to: path.to })),
      startNode: startNode.id,
      stopNodes: stopNodes.map(stop => stop.id), // Send stop nodes to backend
    };

    axios.post('http://localhost:5000/calculate-path', data)
      .then((response) => {
        setShortestPath(response.data.path);  // Set the shortest path from backend
        setAnimationStep(0);  // Reset animation step
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  };

  useEffect(() => {
    if (shortestPath.length > 0 && animationStep < shortestPath.length - 1) {
      const timeout = setTimeout(() => {
        setAnimationStep(animationStep + 1); // Move to the next step in the path
      }, 500); // Adjust the delay between steps here (500ms)

      return () => clearTimeout(timeout); // Cleanup the timeout
    }
  }, [shortestPath, animationStep]);

  const drawAnimatedPath = () => {
    const pathSegments = [];
    for (let i = 0; i < animationStep; i++) {
      const fromNode = nodes.find(node => node.id === shortestPath[i]);
      const toNode = nodes.find(node => node.id === shortestPath[i + 1]);
      if (fromNode && toNode) {
        pathSegments.push(
          <Line
            key={`animated-path-${i}`}
            points={[fromNode.x, fromNode.y, toNode.x, toNode.y]}
            stroke="red"
            strokeWidth={3}
          />
        );
      }
    }
    return pathSegments;
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      const img = new window.Image();
      img.src = reader.result;
      img.onload = () => {
        const imgWidth = img.width;
        const imgHeight = img.height;

        const scaleX = window.innerWidth / imgWidth;
        const scaleY = window.innerHeight / imgHeight;
        const newScale = Math.min(scaleX, scaleY);

        setImage(img);
        setImageURL(reader.result);
        setImageWidth(imgWidth * newScale);
        setImageHeight(imgHeight * newScale);
        setImageX((window.innerWidth - imgWidth * newScale) / 2);
        setImageY((window.innerHeight - imgHeight * newScale) / 2);
        setScale(newScale);
      };
    };

    if (file) {
      reader.readAsDataURL(file);
    }
  };

  const generateGridNodes = (n) => {
    const newNodes = [];
    if (image) {
      const spacingX = imageWidth / (n + 1);
      const spacingY = imageHeight / (n + 1);
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          newNodes.push({
            x: imageX + i * spacingX,
            y: imageY + j * spacingY,
            id: nodes.length + newNodes.length
          });
        }
      }
    } else {
      const spacing = Math.min(window.innerWidth, window.innerHeight) / (n + 1);
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          newNodes.push({
            x: i * spacing,
            y: j * spacing,
            id: nodes.length + newNodes.length
          });
        }
      }
    }
    setNodes(newNodes);
    setPaths([]); // Clear existing paths
  };

  const connectAllNodesInGrid = () => {
    const newPaths = [];
    for (let i = 0; i < nodes.length; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      if (col < gridSize - 1) {
        newPaths.push({ from: nodes[i].id, to: nodes[i + 1].id });
      }

      if (row < gridSize - 1) {
        newPaths.push({ from: nodes[i].id, to: nodes[i + gridSize].id });
      }
    }
    setPaths(newPaths); // Set new paths
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <button onClick={() => setIsPathMode(false)}>Node Mode</button>
      <button onClick={() => setIsPathMode(true)}>Path Mode</button>
      <button onClick={() => setIsEraserMode(!isEraserMode)}>
        {isEraserMode ? 'Edit Mode' : 'Eraser Mode'}
      </button>
      <button onClick={() => setIsSelectingStart(true)}>Select Start Node</button>
      <button onClick={() => setIsSelectingStop(true)}>Select Stop Nodes</button>
      <button onClick={() => setStartNode(null)}>Clear Start Node</button>
      <button onClick={() => setStopNodes([])}>Clear Stop Nodes</button>
      <button onClick={() => {
          setShortestPath([]); // Clear the Dijkstra path
          setAnimationStep(0);
        }}>Clear Dijkstra Path</button>
      <button onClick={handleSubmit}>Submit</button>
      <input
        type="number"
        value={gridSize}
        onChange={(e) => setGridSize(parseInt(e.target.value, 10) || 0)}
        placeholder="Grid size (n)"
      />
      <button onClick={() => generateGridNodes(gridSize)}>Generate Grid</button>
      <button onClick={connectAllNodesInGrid}>All Paths</button>
      <button onClick={() => {
        setNodes([]);
        setPaths([]);
        setStopNodes([]); // Clear stop nodes
        setShortestPath([]); // Clear the Dijkstra path
        setAnimationStep(0); // Reset animation step
      }}>Clear All</button>

      <Stage width={window.innerWidth} height={window.innerHeight} onClick={handleStageClick}>
        <Layer>
          {image && (
            <Image
              image={image}
              width={imageWidth}
              height={imageHeight}
              x={imageX}
              y={imageY}
              ref={imageRef}
            />
          )}

          {nodes.map((node) => (
            <React.Fragment key={node.id}>
              <Circle
                x={node.x}
                y={node.y}
                radius={8}
                fill={
                  node === startNode ? 'green' :
                  stopNodes.find(stop => stop.id === node.id) ? 'red' :  // Color stop nodes red
                  selectedNode === node ? 'orange' : 'blue'
                }
                onClick={() => handleNodeClick(node)}
              />
              {/* Render labels for stop nodes */}
              {stopNodes.find(stop => stop.id === node.id) && (
                <Text
                  x={node.x + 8}
                  y={node.y - 8}
                  text={stopNodes.find(stop => stop.id === node.id).label.toString()}
                  fontSize={20}
                  fill="black"
                />
              )}
            </React.Fragment>
          ))}

          {paths.map((path, index) => (
            <Line
              key={index}
              points={[
                nodes.find(node => node.id === path.from).x, nodes.find(node => node.id === path.from).y,
                nodes.find(node => node.id === path.to).x, nodes.find(node => node.id === path.to).y
              ]}
              stroke="black"
              strokeWidth={2}
              onClick={(e) => e.cancelBubble = true}
            />
          ))}

          {/* Render the animated shortest path */}
          {drawAnimatedPath()}
        </Layer>
      </Stage>
    </div>
  );
}

export default App;

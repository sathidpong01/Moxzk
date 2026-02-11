import { useRef, useState, useEffect } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Text,
  Group,
  Transformer,
} from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import { useAppStore } from "@/stores/useAppStore";

// Helper function to download URI
function downloadURI(uri: string, name: string) {
  const link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper to calculate scale based on window width
const useWindowSize = () => {
  const [size, setSize] = useState([0, 0]);
  useEffect(() => {
    const updateSize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);
  return size;
};

// Separate component to handle transformer attachment side-effect
const TransformerHandler = ({
  selectedId,
  transformerRef,
}: {
  selectedId: string | null;
  transformerRef: React.RefObject<Konva.Transformer | null>;
}) => {
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = transformerRef.current.getStage();
      if (!stage) return;

      const selectedNode = stage.findOne("#" + selectedId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, transformerRef]);
  return null;
};

export function WorkBench() {
  const { previewUrl, result, viewMode, downloadTrigger, setResult } =
    useAppStore();
  const [image] = useImage(previewUrl || "", "anonymous");
  const [width] = useWindowSize();
  const stageRef = useRef<import("konva/lib/Stage").Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Handle Download Trigger
  useEffect(() => {
    if (downloadTrigger > 0 && stageRef.current) {
      // Temporarily deselect to hide transformer (async to avoid effect warning)
      setTimeout(() => {
        setSelectedId(null);
        setTimeout(() => {
          if (stageRef.current) {
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            downloadURI(uri, "manga-translated.png");
          }
        }, 100);
      }, 0);
    }
  }, [downloadTrigger]);

  if (!image) return null;

  // Calculate Responsive Scale
  const containerWidth = Math.min(width - 40, 1200);
  const scale = containerWidth / image.width;
  const stageHeight = image.height * scale;

  const isTranslated = viewMode === "translated";

  // Update bubble position after drag
  const handleDragEnd = (
    index: number,
    e: Konva.KonvaEventObject<DragEvent>,
  ) => {
    if (!result) return;
    const newBubbles = [...result.bubbles];
    const node = e.target;

    // Convert stage coords back to normalized 1000x1000
    const xmin = (node.x() / image.width) * 1000;
    const ymin = (node.y() / image.height) * 1000;

    const currentBox = newBubbles[index].box_2d;
    const w = currentBox[3] - currentBox[1];
    const h = currentBox[2] - currentBox[0];

    newBubbles[index].box_2d = [ymin, xmin, ymin + h, xmin + w];

    setResult({ ...result, bubbles: newBubbles });
  };

  // Handle Resize
  const handleTransformEnd = (
    index: number,
    e: Konva.KonvaEventObject<Event>,
  ) => {
    if (!result) return;
    const newBubbles = [...result.bubbles];
    const node = e.target;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to 1 and adjust width/height
    node.scaleX(1);
    node.scaleY(1);

    const currentBox = newBubbles[index].box_2d;
    const currentW = currentBox[3] - currentBox[1];
    const currentH = currentBox[2] - currentBox[0];

    const newW = currentW * scaleX;
    const newH = currentH * scaleY;

    // Also position might change if rotated
    const xmin = (node.x() / image.width) * 1000;
    const ymin = (node.y() / image.height) * 1000;

    newBubbles[index].box_2d = [ymin, xmin, ymin + newH, xmin + newW];

    setResult({ ...result, bubbles: newBubbles });
  };

  // Handle Text Edit
  const handleTextEdit = (index: number) => {
    if (!result) return;
    const currentText = result.bubbles[index].translation;
    const newText = prompt("Edit translation:", currentText);

    if (newText !== null && newText !== currentText) {
      const newBubbles = [...result.bubbles];
      newBubbles[index].translation = newText;
      setResult({ ...result, bubbles: newBubbles });
    }
  };

  return (
    <div className="flex justify-center bg-base-300 py-8 min-h-screen overflow-auto">
      <div className="shadow-2xl border-4 border-base-100">
        <Stage
          width={containerWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          ref={stageRef}
          onMouseDown={(e) => {
            // Deselect on click empty area
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) setSelectedId(null);
          }}
        >
          <Layer>
            <KonvaImage image={image} />

            {result?.bubbles && isTranslated && (
              <Group>
                {result.bubbles.map((bubble, i) => {
                  const [ymin, xmin, ymax, xmax] = bubble.box_2d;
                  const x = (xmin / 1000) * image.width;
                  const y = (ymin / 1000) * image.height;
                  const w = ((xmax - xmin) / 1000) * image.width;
                  const h = ((ymax - ymin) / 1000) * image.height;

                  const id = `bubble-${i}`;
                  const isSelected = selectedId === id;

                  return (
                    <Group
                      key={i}
                      id={id}
                      x={x}
                      y={y}
                      draggable
                      onClick={() => setSelectedId(id)}
                      onTap={() => setSelectedId(id)}
                      onDblClick={() => handleTextEdit(i)} // Double Click to Edit
                      onDragEnd={(e) => handleDragEnd(i, e)}
                      onTransformEnd={(e) => handleTransformEnd(i, e)}
                    >
                      <Rect
                        width={w}
                        height={h}
                        fill="white"
                        stroke={isSelected ? "#00a96e" : "black"} // Highlight active
                        strokeWidth={isSelected ? 4 / scale : 2 / scale}
                        cornerRadius={5}
                      />
                      <Text
                        text={bubble.translation}
                        width={w}
                        height={h}
                        fontSize={Math.max(12, h / 5)}
                        fontFamily="Sarabun"
                        fill="black"
                        align="center"
                        verticalAlign="middle"
                        padding={5}
                        wrap="word"
                      />
                    </Group>
                  );
                })}
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Limit resize
                    if (newBox.width < 20 || newBox.height < 20) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Group>
            )}
          </Layer>
        </Stage>
        {/* Helper Effect to attach transformer to selected node */}
        <TransformerHandler
          selectedId={selectedId}
          transformerRef={transformerRef}
        />
      </div>
    </div>
  );
}

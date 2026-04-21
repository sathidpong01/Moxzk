interface KonvaInteractionTarget {
  getClassName: () => string
  findAncestor: (selector: string, includeSelf?: boolean) => unknown
}

interface KonvaStageDragTarget {
  getStage: () => unknown
}

export function isTransformerInteractionTarget(target: KonvaInteractionTarget): boolean {
  return target.getClassName() === 'Transformer' || Boolean(target.findAncestor('Transformer', true))
}

export function shouldStartBrushStroke(target: KonvaInteractionTarget): boolean {
  return !isTransformerInteractionTarget(target)
}

export function shouldClearTextSelectionOnStagePointer(target: KonvaInteractionTarget): boolean {
  return target.getClassName() !== 'Text' && !isTransformerInteractionTarget(target)
}

export function shouldSyncStagePositionOnDragEnd(target: KonvaStageDragTarget): boolean {
  return target === target.getStage()
}

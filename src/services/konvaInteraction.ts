interface KonvaInteractionTarget {
  getClassName: () => string
  findAncestor: (selector: string, includeSelf?: boolean) => unknown
}

export function isTransformerInteractionTarget(target: KonvaInteractionTarget): boolean {
  return target.getClassName() === 'Transformer' || Boolean(target.findAncestor('Transformer', true))
}

export function shouldStartBrushStroke(target: KonvaInteractionTarget): boolean {
  return !isTransformerInteractionTarget(target)
}

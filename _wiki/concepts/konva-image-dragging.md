# Konva Image Dragging

## Summary

Konva image dragging is enabled at the shape level with `draggable: true` or `draggable()`.

In Moxzk, this matters because image dragging is part of the editor interaction model, but the source pattern should be adapted through the repo's existing state and viewport layers.

## Practical Rules

- Do not add isolated drag state if an existing editor store already owns the interaction
- Keep image movement aware of zoom, viewport transforms, and artboard coordinates
- Use cursor feedback for clearly draggable objects
- Verify behavior in the browser after changing canvas interactions

## Source Pattern

The clipped Konva example creates an image after `imageObj.onload`, then adds it to a layer with:

```ts
const yoda = new Konva.Image({
  x: 50,
  y: 50,
  image: imageObj,
  width: 106,
  height: 118,
  draggable: true,
});
```

## Links

- [[_wiki/sources/2026-04-25-konva-drag-image|Konva Drag Image]]

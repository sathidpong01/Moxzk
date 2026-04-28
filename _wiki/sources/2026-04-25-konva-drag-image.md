# Konva Drag Image

## Summary

Konva images can be made draggable by setting `draggable: true` when creating a `Konva.Image`, or by calling the `draggable()` method later.

This is a small source, but it is directly relevant to Moxzk because the editor uses Konva for image and artboard interaction.

## Key Points

- `Konva.Image` supports `draggable: true`
- Konva's drag handling works for both desktop and mobile input
- cursor feedback can be attached with `mouseover` and `mouseout` handlers
- image loading should happen before creating the `Konva.Image`
- source image dimensions can be passed through `width` and `height`

## Moxzk Notes

For this repo, this pattern should be treated as a baseline reference, not copied directly everywhere.

- Use existing editor state and selection flows before adding standalone Konva drag state
- Keep drag behavior consistent with `CanvasEditor` and workspace viewport logic
- Prefer repo services/utilities for coordinates, zoom, and artboard state when available
- Add browser verification when changing visible drag interactions

## Links

- [[_wiki/concepts/konva-image-dragging|Konva Image Dragging]]

## Sources

- Clipping: `D:\Moxzk\Clippings\HTML5 Canvas Drag and Drop an Image  Konva - JavaScript Canvas 2d Library.md`
- Original: <https://konvajs.org/docs/drag_and_drop/Drag_an_Image.html>

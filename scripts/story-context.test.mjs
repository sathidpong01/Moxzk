import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStoryContextBlock,
  collectPreviousTranslationLines,
  DEFAULT_TRANSLATION_STYLE_GUIDE,
} from '../src/services/story-context.ts'

test('buildStoryContextBlock carries generic relationship continuity rules', () => {
  const block = buildStoryContextBlock({
    enabled: true,
    pageNumber: 2,
    totalPages: 6,
    styleGuide: 'teacher/student = ครู/ลูกศิษย์',
    previousLines: [
      { pageNumber: 1, original: 'Good morning, teacher.', translated: 'สวัสดีครับอาจารย์' },
    ],
  })

  assert.match(block, /family/)
  assert.match(block, /teacher\/student/)
  assert.match(block, /senior\/junior/)
  assert.match(block, /ครู\/ลูกศิษย์/)
  assert.match(block, /Previous translated lines/)
  assert.match(block, /p1:/)
})

test('default translation style guide supports broad relationships', () => {
  assert.match(DEFAULT_TRANSLATION_STYLE_GUIDE, /ครอบครัว/)
  assert.match(DEFAULT_TRANSLATION_STYLE_GUIDE, /พี่น้อง/)
  assert.match(DEFAULT_TRANSLATION_STYLE_GUIDE, /คู่รัก/)
  assert.match(DEFAULT_TRANSLATION_STYLE_GUIDE, /เจ้านาย\/ลูกน้อง/)
  assert.match(DEFAULT_TRANSLATION_STYLE_GUIDE, /ครู\/ศิษย์/)
})

test('collectPreviousTranslationLines only includes pages before the current entry', () => {
  const entries = [
    {
      id: 'p1',
      pageNumber: 1,
      regions: [
        { originalText: 'Dad', translatedText: 'พ่อ' },
      ],
    },
    {
      id: 'p2',
      pageNumber: 2,
      regions: [
        { originalText: 'Brother', translatedText: 'พี่' },
      ],
    },
  ]

  const lines = collectPreviousTranslationLines(entries, 'p2')
  assert.deepEqual(lines, [
    { pageNumber: 1, original: 'Dad', translated: 'พ่อ' },
  ])
})

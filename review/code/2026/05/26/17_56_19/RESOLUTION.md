# RESOLUTION — 17_56_19

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드 (테스트 명세) | 3da88671 | 테스트 이름 "rapid double-toggle" → "single click calls onChange exactly once with toggled value" |
| W-2 | 코드 (유지보수성) | 3da88671 | `resolveWidgetOptions()` 헬퍼 `utils.ts` 에 추출, `SelectWidget` + `MultiSelectWidget` 공유 |
| W-3 | 코드 (테스트 유지보수성) | 3da88671 | `renderDefault(overrides?)` 헬퍼 추가, `'value' in overrides` 센티넬로 undefined/null 명시 허용 |
| W-4 | 코드 (방어) | 3da88671 | 옵션 empty 시 dev-mode `console.warn` + `noOptions` placeholder (i18n key `nodeConfigs.autoForm.noOptions`) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4944 passed)
- e2e   : 통과 (123/123)

## 보류·후속 항목

- INFO 항목 I-1: `afterEach` locale 복구 — 향후 test randomize 도입 시 검토
- INFO 항목 I-2: `within` import 미사용 제거 — 추적만 (lint 는 통과 중, 실제 경고 없음)
- INFO 항목 I-3: value 원소 타입 검증 `filter(v => typeof v === 'string')` — 향후 개선
- INFO 항목 I-4: `_retry_state.json` gitignore 추가 — 별도 PR 고려
- INFO 항목 I-5~I-15: 기록만, 자동 수정 대상 아님

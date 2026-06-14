# RESOLUTION — impl-execution-editor-gaps ai-review 후속

대상 SUMMARY: `review/code/2026/06/14/03_31_25/SUMMARY.md` (RISK MEDIUM, Critical 0, Warning 9)

## 조치 내역

### Testing (W1–W4) — MEDIUM 위험 해소 [FIXED]
- **W1** `handleLoadFromHistory` 오류 경로: `getById` reject → `toast.error` 호출 + 피커 유지 검증 테스트 추가 (`editor-toolbar-run-input.test.tsx`).
- **W2** 빈 히스토리 렌더: `getByWorkflow → data:[]` → "No past executions" 텍스트 검증 테스트 추가.
- **W3** 실행 중 진입 차단: `status="running"` 시 Run options 드롭다운(다이얼로그 유일 진입점) disabled 검증 추가. (다이얼로그 자체는 running 중 열 수 없는 구조라 진입 가드를 검증.)
- **W4** `drawerExpanded` 기본값: `useExecutionStore.getInitialState().drawerExpanded` 로 **실제 store 초기값**을 검증하도록 수정 (beforeEach seed 순환 제거).
- (INFO 13) `contenteditable=""` 빈 문자열 분기 테스트 추가.
- (INFO 14) `setDrawerExpanded(true)` 멱등 케이스 추가.
- (INFO 15) `editor-toolbar-run-input.test.tsx` 파일 수준 커버리지 주석 추가.

### Requirement / Side Effect (W5–W7) — 의도 명확화 [FIXED]
- **W5** null `inputData` → `{}` fallback: 입력 없이 트리거된 실행(스케줄/웹훅)의 의도임을 `handleLoadFromHistory` 에 주석.
- **W6** `drawerExpanded` localStorage 미지속: 인터페이스 JSDoc 정정 — `panelHeight`/`timelineWidth`(localStorage 지속)와 달리 **세션 한정 메모리 상태**(새로고침 시 `true` 복귀)임을 명시. 오해 소지 비교 제거.
- **W7** `reset()` 제외: 워크플로 이동/재실행 시 펼침 상태 유지가 의도임을 JSDoc 에 명시.
- (INFO 11) `handleRunWithInput` 의 `SyntaxError` catch 가 실시간 검증과 중복이나 검증 우회 대비 방어 코드임을 주석.

### Documentation (INFO 18) [FIXED]
- spec §2.1 ASCII 다이어그램에 "Load from History" + 실시간 검증(✓ Valid JSON / 오류) 반영 + 설명 2줄 추가.

## 범위 외 (중기 리팩토링 — 별도 추적)
- **W8 (Architecture)** `EditorToolbar` SRP 누적 → `RunWithInputDialog` 컴포넌트 + `useRunInputHistory` 훅 분리. 본 PR 의 갭 구현과 무관한 구조 개선이라 별도 과제로 둔다.
- **W9 (Architecture)** `handleLoadFromHistory` 명령형 `getById` → `useQuery`/`fetchQuery` 선언적 전환. 단발 적재(반복 선택 드묾)라 캐시 이점이 작아 우선순위 낮음. 별도 추적.
- (INFO 7) `isEditableTarget` 를 `/lib/utils/keyboard.ts` 로 이동 — 장기 정리. (INFO 10) `drawerExpanded` 를 별도 UI store 분리 — 장기.
- 위 항목은 LOW 아키텍처 위험이며 동작 변경 없음. 범위 노이즈를 피하기 위해 본 PR 에서 손대지 않음.

## 검증
- frontend tests: `editor-toolbar-run-input`(7) · `execution-store`(drawerExpanded 4) · `workflow-editor-shortcuts`(4) · `editor-toolbar-rbac/stop` · i18n parity — 154 통과 / 1 skip.
- `tsc --noEmit` 0 errors. eslint 0.

## ESCALATE
- 없음 (no). Critical 0, 모든 actionable warning 해소, 결정 필요 사항 없음(§1.3·§7·§2.2-저장은 plan 에서 로드맵/결정대기로 이미 분리).

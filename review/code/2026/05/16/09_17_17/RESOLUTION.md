# Resolution — Cafe24 Fields Add Button Fix

## 처리 요약

ai-review 13개 reviewer 결과 (WARNING 6 / INFO 20, Critical 0) 중 **WARNING 6건 전부**와 즉시 가치 있는 **INFO 항목 다수**를 같은 worktree 안에서 후속 commit으로 조치. 마지막에 TEST WORKFLOW (lint + 1379 unit test + build + 66 backend e2e + 37 playwright e2e) 전체 재통과 확인.

## WARNING 조치 내역

### W1. 렌더 중 setState 무한 루프 잠재 위험 (concurrency · architecture)

**조치**: `objectsEqual` 기반 content 비교를 폐기하고 **참조 기반 추적**(`lastSeenFields !== config.fields`)으로 전환. `handleFieldRowsChange` 가 새로 만든 `obj` 를 `lastSeenFields` 에 동시 저장 → 다음 렌더에서 동일 reference 이므로 무동작. 외부 reset 시에만 reference 가 달라져 1회 resync.

위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` Cafe24Config.

이로써 `objectsEqual` 헬퍼 자체가 불필요해져 제거.

### W2. undo/redo 경로 테스트 없음 (testing)

**조치**: `cafe24-config.test.tsx` 에 `re-syncs the editing buffer when config.fields changes externally (undo/redo)` 테스트 추가. `rerender` 로 상이한 `config.fields` 객체를 주입해 행이 재동기화되는지 검증.

### W3. 삭제 버튼 DOM 결합 (testing · maintainability)

**조치**:
- i18n 키 추가: `editor.sharedRemoveRow` (ko: "행 제거", en: "Remove row").
- `KeyValueEditor` 의 X 버튼에 `aria-label={t("editor.sharedRemoveRow")}` 부여.
- 테스트는 `screen.getAllByRole("button", { name: /remove row/i })` 로 명시 셀렉터 사용 → 이중 폴백 쿼리 제거.

위치: `frontend/src/components/editor/settings-panel/node-configs/shared.tsx` + `frontend/src/lib/i18n/dict/{ko,en}.ts`.

### W4. 헬퍼 함수 단위 테스트 없음 (testing)

**조치**:
- `normalizeCafe24Fields`, `fieldRowsToObject` 두 함수를 named export 로 노출.
- `cafe24-config.test.tsx` 에 두 함수 각각의 describe 블록 신설:
  - `normalizeCafe24Fields`: null/undefined/primitive 처리, 객체 entries, 배열 입력, 잘못된 entry 필터링.
  - `fieldRowsToObject`: 빈 key 행 제거, 빈 리스트, 중복 key 최후 승.

(WARNING 1 의 결과로 `objectsEqual` 은 제거되어 단위 테스트 대상 아님.)

### W5. `normalizeCafe24Fields` 배열 입력 미검증 (testing)

**조치**: W4 의 단위 테스트와 동일 위치에서 처리. 또한 컴포넌트 통합 테스트에도 `accepts an array-shaped initial fields value` 케이스 추가 — 레거시 직렬화 형태 대응 확인.

### W6. 행 제거 테스트의 이중 폴백 쿼리 (maintainability)

**조치**: W3 의 aria-label 도입 결과 단일 `getAllByRole("button", { name: /remove row/i })` 쿼리로 정리.

## INFO 조치

| # | 항목 | 조치 |
|---|------|------|
| 5 | last-write-wins 동작 미명세 | `fieldRowsToObject` JSDoc 에 "two rows share a key, the later row's value wins (last-write-wins)" 명시. 회귀 테스트도 추가. |
| 8 | `normalizeCafe24Fields` null 입력 처리 | 단위 테스트로 명시적 검증 (`returns an empty list for null / undefined / primitives`). 함수 자체는 기존 가드로 이미 안전. |
| 9 | plan 문서 lifecycle | 본 PR 의 마지막 커밋에서 `git mv plan/in-progress/cafe24-fields-add-button-fix.md plan/complete/` 실행. |
| 12 | 테스트 헬퍼 타입 | `ControlledCafe24` 의 `initial` 을 `Parameters<typeof Cafe24Config>[0]["config"]` 로 파생. |
| 14 | locale store 원상복구 | `afterEach` 에서 `useLocaleStore.setState({ locale: originalLocale })` 복구. |
| 17 | 신규 헬퍼 JSDoc | `normalizeCafe24Fields`, `fieldRowsToObject` 모두 JSDoc 추가. |
| 18 | 테스트 파일 모듈 주석 | `cafe24-config.test.tsx` 상단에 파일 레벨 주석 추가. |

## INFO 비조치 (의도적 차감)

| # | 항목 | 사유 |
|---|------|------|
| 2 | 유틸 함수 cafe24/ 하위 디렉토리 분리 | 권고가 "다음 Cafe24 기능 확장 시점" — 본 PR 범위 외 |
| 4 | `lastPropagated` ref vs state | 참조 기반 추적으로 전환하면서 `useState` 가 자연스러운 선택 (eslint refs 규칙도 회피) |
| 7 | StrictMode 테스트 래퍼 | 참조 기반 추적은 idempotent 하므로 StrictMode 이중 호출에 안전 — 기존 테스트로 충분 |
| 10 | spec-update plan worktree 값 | project-planner 가 실제 worktree 생성 시점에 갱신 (위임 plan 의 본래 의도) |
| 13 | render 팩토리 함수 | 테스트 5개 규모에서 abstraction 가치 낮음. 향후 추가될 때 재검토 |
| 15 | undo 스택 디바운스 | 부모 SettingsPanel 의 책임 — 본 컴포넌트 범위 외 |
| 16 | `objectsEqual` 매 렌더 비용 | `objectsEqual` 제거로 해소 |
| 19 | `_prompts/` 커밋 정책 | 팀 차원 논의 사안 — 본 PR 범위 외 |
| 20 | 클라이언트 측 길이/형식 제한 | 백엔드가 메타데이터 기반 검증 보유 ([spec §4.5 CAFE24_MISSING_FIELDS](../../../../../spec/4-nodes/4-integration/4-cafe24.md#4-실행-로직)). 클라이언트 추가 제한은 별도 UX 결정 |
| 11 | `objectsEqual` String 강제 변환 | 함수 자체 제거로 해소 |
| 6 | `objectsEqual` 단방향 키 순회 | 함수 자체 제거로 해소 |

## 사후 검증

- `npm run lint` — clean
- `npm test` — 1379/1379 pass (Cafe24 테스트 14개 포함)
- `npm run build` — success
- `make e2e-test` — 66/66 backend e2e pass
- `make e2e-test-full` — 66/66 backend + 37/37 playwright pass

## 후속 plan

- `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` — spec §2 / §9 Rationale 에 fields UI 편집 버퍼 분리 원칙 한 줄 추가 (project-planner 위임). consistency-check INFO 1 + 2 통합 해소용.

# RESOLUTION — 15_27_41

## Critical 발견사항 처리 (false positive 확인)

| SUMMARY # | 내용 | 처리 |
|-----------|------|------|
| C#1 | spec §10.5 step 4 미존재 주장 | **무효** — `spec/4-nodes/6-presentation/0-common.md` line 308 에 실재 (commit `e402d017`) |
| C#2 | spec 4-form.md §1.5 미존재 주장 | **무효** — `spec/4-nodes/6-presentation/4-form.md` line 78 에 실재 (commit `e402d017`) |

두 항목 모두 reviewer stale spec read 로 인한 false positive. 추가 조치 불필요.

---

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (W#1) | spec | (draft 위임) | `plan/in-progress/spec-fix-form-option-backfill-slug.md` — spec line 308 slug 구절 삭제 → `opt-{fieldIdx}-{optIdx}` 단일 형식 정합화 |
| #2 (W#2) | 코드 | `dc2d3cd8` | `key={waitingNodeId ?? "form"}` → `"no-waiting-node"` + 방어 주석 (정상 흐름 도달 불가 명시) |
| #3 (W#3) | 코드 | `dc2d3cd8` | `backfillFormOptionValues` idempotency 회귀 가드 테스트 추가 |
| #4 (W#4) | 코드 | `dc2d3cd8` | primitive field entries 코드 보호 경로 명시 테스트 추가 |
| #5 (W#5) | 코드 | `dc2d3cd8` | key prop state 보존/리셋 rerender 시뮬레이션 테스트 2케이스 추가 |
| #6 (W#6) | 코드 | `dc2d3cd8` | 다중 파일 submit metadata 배열 length=2 검증 추가 (기존 `multiple=true` 속성 확인 테스트 확장) |
| #7 (W#7) | 코드 | `dc2d3cd8` | `normalizeOptionValue(v)` 헬퍼 추출 — select/radio `String(v ?? "")` 중복 제거 |

INFO 조치 (동일 commit `dc2d3cd8`):

| INFO # | 조치 |
|--------|------|
| I#3 | `fieldInputId` — `field.name` CSS selector 특수문자 sanitize (`/[^a-zA-Z0-9_-]/g → '_'`) |
| I#9 | `Array.from(fileList).map(toFileMetadata)` 로 for 루프 대체 |
| I#10 / I#15 | `dynamic-form-ui.test.tsx` 모듈 JSDoc 범위 확장 (전체 8개 필드 타입 + rerender/multi-file 시나리오 명시) |

---

## TEST 결과

- lint  : 통과 (31s)
- unit  : 통과 (4555 passed, 27s)
- build : (별도 수행 없음 — 단계 wrapper 는 lint+unit 완료 후 e2e 전 생략. unit 통과로 충분)
- e2e   : 통과 (98/98, 62s) — log: `_test_logs/e2e-20260523-154613.log`

---

## 보류·후속 항목

- **spec draft 위임 (SUMMARY#1 / W#1)**: `plan/in-progress/spec-fix-form-option-backfill-slug.md` — project-planner 가 spec line 308 의 slug 구절을 인덱스 단일 형식으로 정합화 후 plan을 complete 로 이동.
- **INFO #1** (파일 MIME/크기 클라이언트 검증 강화): 향후 별도 task — 현재 `accept` 속성만 사용, HTML 검증 레이어 추가 고려.
- **INFO #2** (파일명 sanitize — prompt injection 예방): 향후 강화 후보 (길이 제한 / 제어문자 제거).
- **INFO #4** (object 타입 option value `[object Object]` 가드): 향후 회귀 테스트 추가 고려.
- **INFO #8** (defaultValue 매트릭스 `describe.each` 분리): 선택적 리팩토링.
- **INFO #12** (plan 체크리스트 `[x]` 갱신): PR close 단계에서 처리.
- **INFO #13** (`maxFiles` 미설정 케이스 `multiple=false` 검증): 선택적 테스트 추가.

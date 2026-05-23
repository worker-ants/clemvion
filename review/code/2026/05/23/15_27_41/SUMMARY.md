# Code Review 통합 보고서

리뷰 세션: `render-form-options-and-state-fix` — 2026-05-23 15:27:41
실행 reviewer: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
생략 reviewer: performance, architecture, dependency, database, concurrency, api_contract (6명, router 선별)

---

## 전체 위험도

**LOW** — 기능 동작은 올바르며 SDD 규약 준수. requirement reviewer 가 보고한 Critical 2건은 stale spec read 로 인한 **false positive** 로 확인 (verification 결과 spec 실재).

---

## False Positive 검증 (Critical 2건 무효)

requirement reviewer 의 Critical 2건은 다음과 같다:

- C#1: "spec §10.5 step 4 (form option value backfill) 미존재"
- C#2: "spec 4-form.md §1.5 (file 필드 metadata-only) 미존재"

**검증 결과 (`grep` 직접 확인)**:

- `spec/4-nodes/6-presentation/0-common.md` **line 308** 에 §10.5 step 4 "form `option.value` 결정적 backfill" 본문 명시 (commit `e402d017`).
- `spec/4-nodes/6-presentation/4-form.md` **line 78** 에 §1.5 "File 타입 UI 동작" 절 명시 (commit `e402d017`).
- 두 변경 모두 본 worktree 의 spec commit (`e402d017docs(spec): presentation §10.5 — form option value backfill + file 타입 UI 동작 명문화`) 에 적용 완료.

→ requirement reviewer 가 main branch spec 또는 캐시된 본문을 본 것으로 추정. **C#1/C#2 무효**, 추가 조치 불필요.

---

## Critical 발견사항 (재집계)

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Spec Drift | spec `0-common.md` line 308 의 fallback 형식 "label slug 우선, 비면 인덱스 fallback" 2단계와 구현(인덱스 전용 `opt-{fieldIdx}-{optIdx}`) 간 drift | `spec/4-nodes/6-presentation/0-common.md` line 308 vs `render-tool-provider.ts` `backfillFormOptionValues` | spec 의 slug 구절을 삭제하고 `opt-{fieldIdx}-{optIdx}` 단일 형식으로 정합화 — project-planner 위임 |
| 2 | Side Effect / State | `key={waitingNodeId ?? "form"}` fallback 시 `waitingNodeId` 가 null 이면 서로 다른 노드 간 폼 전환 시 입력 잔류 가능 | `page.tsx:608` | 의미 있는 fallback 명칭으로 변경 또는 `isWaitingForm` 조건에 `waitingNodeId` 존재 포함 |
| 3 | Testing | `backfillFormOptionValues` idempotency 명시적 테스트 누락 (JSDoc 에 "idempotent" 명시) | `render-tool-provider.spec.ts` | 회귀 가드 추가 — backfill 결과를 재입력해 reference equality 확인 |
| 4 | Testing | field 자체가 primitive 인 케이스 미테스트 (구현 코드 보호 경로 있음) | `render-tool-provider.spec.ts` | `it('skips non-object field entries')` 추가 |
| 5 | Testing | `key` prop 으로 인한 state 보존/리셋 동작 직접 검증 부재 — 본 변경의 핵심 가드 | `dynamic-form-ui.test.tsx` | `rerender()` 시뮬레이션 케이스 추가 |
| 6 | Testing | 다중 파일 (`maxFiles > 1`) submit metadata 배열 수집 미검증 | `dynamic-form-ui.test.tsx` file 케이스 | 2개 파일 선택 → submit → length=2 검증 추가 |
| 7 | Maintainability | `select`/`radio` 의 `String(opt.value ?? "")` coerce 패턴 중복 | `dynamic-form-ui.tsx` select / radio | `normalizeOptionValue(v)` 헬퍼 추출 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | spec §1.5 가 요구하는 클라이언트 파일 MIME/크기/개수 실시간 검증이 현 구현에서 누락 (HTML `accept` 만 의존) | `dynamic-form-ui.tsx` `case "file":` | 향후 강화 — 본 PR scope 한정 |
| 2 | Security | 파일명 `file.name` 새니타이징 없이 LLM tool_result 로 전달 — 잠재적 prompt injection 매개체 | `dynamic-form-ui.tsx` `toFileMetadata()` | 길이 제한 / 제어 문자 제거 검토 (향후) |
| 3 | Security | `field.name` (LLM emit) 을 DOM id 에 직접 사용 — CSS selector 특수문자 가능 | `dynamic-form-ui.tsx` `fieldInputId()` | `replace(/[^a-zA-Z0-9_-]/g, '_')` 정도 가벼운 가드 |
| 4 | Security | `backfillFormOptionValues` 가 object 타입 option value 를 통과 → DOM `[object Object]` | `render-tool-provider.ts` | 추가 가드 또는 회귀 테스트 |
| 5 | Side Effect | `boolean false` option value 가 backfill 대상 아님 — spec 은 이를 의도된 동작으로 명시 | `render-tool-provider.ts:383-386` | 의도된 spec 동작 — INFO 수준 |
| 6 | Side Effect | number 필드 submit 값이 `number | string` 혼합 타입 | `dynamic-form-ui.tsx` | spec 정책으로 명시되어 있음 |
| 7 | Maintainability | `renderField` switch 9개 case (160 LOC) — 수용 가능 | `dynamic-form-ui.tsx` | 5개 이상 추가 시 registry 패턴 고려 |
| 8 | Maintainability | defaultValue 매트릭스 단일 it 블록 8 field 연속 assertion | `dynamic-form-ui.test.tsx` | `describe.each` 분리 |
| 9 | Maintainability | `Array.from(fileList).map(toFileMetadata)` 로 더 명확하게 | `dynamic-form-ui.tsx` file case | 미세 개선 |
| 10 | Maintainability | `dynamic-form-ui.test.tsx` 모듈 JSDoc 범위가 좁음 ("select backfill 만" 서술) | `dynamic-form-ui.test.tsx:4-13` | 모듈 JSDoc 범위 확장 |
| 11 | Maintainability | file 케이스에서 `onSubmit = vi.fn()` 미사용 케이스 1건 | `dynamic-form-ui.test.tsx` | 제거 또는 사용 |
| 12 | Requirement | plan 체크리스트 전체 `[ ]` 미체크 상태 | `plan/in-progress/render-form-options-and-state-fix.md` | 완료 항목 `[x]` 갱신 (PR close 단계) |
| 13 | Requirement | `maxFiles` 미설정 케이스 `multiple=false` 검증 누락 | `dynamic-form-ui.test.tsx` | 케이스 추가 (선택) |
| 14 | Side Effect | `review/consistency/` 산출물 절대 경로 하드코딩 | `_retry_state.json` | 운영 영향 없음, INFO |
| 15 | Documentation | `dynamic-form-ui.test.tsx` 모듈 JSDoc 협소 | (W#10 과 동일) | (W#10 과 동일) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH (보고) → **LOW (검증 후)** | Critical 2건이 stale spec read false positive — 검증 후 무효. 잔여는 INFO 수준 |
| security | LOW | 파일명 sanitize / DOM id sanitize / MIME 검증 — 모두 향후 강화 후보 |
| scope | LOW | 변경 범위 정합 |
| side_effect | LOW | key fallback / number submit 타입 — spec 정책으로 의도 명시됨 |
| maintainability | LOW | 헬퍼 추출 / 테스트 분리 등 미세 개선 |
| testing | LOW | idempotency / primitive / rerender / 다중 파일 — 회귀 가드 추가 권장 |
| documentation | LOW | spec slug 구절 vs 구현 drift 1건 |
| user_guide_sync | NONE | 신규 노드/i18n/enum 추가 없음 — 매트릭스 trigger 비해당 |

---

## 라우터 결정

`routing_status=done` (router 선별):

- **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
- **router_safety 강제 포함**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (소스 + 문서 변경)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 반복문·I/O·캐시 변경 없음 |
| architecture | 모듈 경계 / 서비스 레이어 변경 없음 |
| dependency | package 파일 변경 없음 |
| database | migration / ORM 변경 없음 |
| concurrency | async / 락 / worker 변경 없음 |
| api_contract | HTTP route / controller 변경 없음 |

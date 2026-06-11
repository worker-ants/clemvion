# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 차단 사유 없음.

## 전체 위험도
**MEDIUM** — `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 화이트리스트에 미등재되어 채팅 채널 어댑터 경로에서 unknown fallback 처리됨. spec/plan 불일치 다수(WARNING) 있으나 모두 문서·추적 정리 수준이며 구현 차단은 아님.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Naming Collision | `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` TIMEOUT_CODES / THIRD_PARTY_CODES / INTERNAL_CODES 어디에도 미등재 → unknown fallback 처리 | `error-codes.ts` + `spec/4-nodes/5-data/2-code.md §5.3.3` | `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` + `spec/conventions/chat-channel-adapter.md §3.1` | `TIMEOUT_CODES` 또는 신규 버킷에 `CODE_MEMORY_LIMIT` 추가; `chat-channel-adapter.md §3.1` 분류 표에도 등재 |
| W2 | Naming Collision | `classifyError` 가 module-level export 로 추가됐으나 두 provider 파일에 동일명 private 메서드 존재 → 전역 검색·import 경로 혼동 리스크 | `code.handler.ts` export `classifyError` | `cafe24-mcp-tool-provider.ts` L726 / `makeshop-mcp-tool-provider.ts` L714 (모두 private) | 함수명을 `classifyCodeNodeError` 로 변경하거나 JSDoc 에 "Code 노드 isolate 전용" 명시 |
| W3 | Cross-Spec | `spec/5-system/3-error-handling.md §1.4` 엔진 수준 에러 표에 `EXECUTION_TIMEOUT` 이 engine-level(`execution → failed`) 항목으로 잔존 → `error` 포트 라우팅(node-level runtime 에러)과 계층 혼동 | `spec/4-nodes/5-data/2-code.md §5.3.2` — `CODE_TIMEOUT` public 코드, `EXECUTION_TIMEOUT` 은 `details.legacyCode` 내부 전용 | `spec/5-system/3-error-handling.md §1.4` 엔진 수준 표 | 해당 행을 "내부 legacy 코드 — public surface 는 `CODE_TIMEOUT`(`output.error.code`), `error` 포트 라우팅" 으로 보강하거나 노드 수준 표로 이동 |
| W4 | Convention Compliance | §5.3.1 JSON 예시에 `details.stack` 이 항상 포함되어 있으나 동일 문서 §5.3 표는 "비프로덕션에서만 노출" 로 명시 | `spec/4-nodes/5-data/2-code.md §5.3.1 JSON 예시` | `spec/conventions/node-output.md` Principle 11 (선택적 필드 표기) + §5.3 공통 필드 표 | JSON 예시 직전에 `// 비프로덕션 환경에서만 stack 포함` 주석 또는 "이 예시는 비프로덕션 환경 기준" 보조 노트 추가 |
| W5 | Plan Coherence | `plan/in-progress/refactor/04-security.md` C-2 체크박스가 `- [ ]` 미완 상태이나 isolated-vm 전환 결정·구현·spec Rationale 모두 완료됨 | `spec/4-nodes/5-data/2-code.md §Rationale "격리 방식 isolated-vm 전환"` + `code.handler.ts` 전면 재작성 | `plan/in-progress/refactor/04-security.md` C-2 (라인 41) | C-2 를 `- [x] ✅ 완료 (2026-06-11, worktree code-node-isolated-vm, 옵션 A isolated-vm 전환)` 로 갱신; M-2 도 함께 완료 처리 |
| W6 | Plan Coherence | `plan/in-progress/node-output-redesign/code.md` 의 `CODE_MEMORY_LIMIT` "로드맵 미구현" 기술이 현재 완전 구현과 역전 | `spec/4-nodes/5-data/2-code.md §5.3.3` + `classifyError` + `error-codes.ts` | `plan/in-progress/node-output-redesign/code.md` 라인 82·132 | 해당 항목을 "구현 완료 (isolated-vm 전환 PR)" 로 갱신하거나 `plan/complete/` 이동 시 반영 |
| W7 | Plan Coherence | `spec/4-nodes/0-overview.md §5` 샌드박싱 표가 `node:vm` 기술과 메모리 제한 "미구현(Planned)" 으로 남아 target 구현과 불일치 | `spec/4-nodes/5-data/2-code.md §7` isolated-vm 전환 완료; `code.handler.ts` 에서 `node:vm` 완전 제거 | `spec/4-nodes/0-overview.md §5` 라인 298 "실행 격리" 행 + "메모리 제한" 행 | target PR 범위에 `spec/4-nodes/0-overview.md §5` 의 "실행 격리" 행(→ `isolated-vm (V8 Isolate)`) 및 "메모리 제한" 행(`미구현` → `구현됨 128MB`) 갱신 포함 (planner 위임 필요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/5-system/14-external-interaction-api.md §547` 에 내부 코드 `EXECUTION_TIMEOUT` 이 열거되고 public `CODE_TIMEOUT` 은 미포함 | `spec/5-system/14-external-interaction-api.md:547` | `EXECUTION_TIMEOUT` 을 `CODE_TIMEOUT` 으로 교체하거나 `"(internal → CODE_TIMEOUT)"` 주석 처리 |
| I2 | Cross-Spec | `spec/5-system/3-error-handling.md §1.4:62` 파일 경로 주석이 handler 내 `EXECUTION_TIMEOUT` 역할 변화를 미반영 | `spec/5-system/3-error-handling.md §1.4` | 주석에 "내부 legacy 코드; `output.error.code` = `CODE_TIMEOUT`" 보강 |
| I3 | Cross-Spec | `spec/conventions/node-output.md` Principle 7 / 8.2 / 2 — target 과 완전 일치, 모순 없음 | `spec/4-nodes/5-data/2-code.md §5.1 / §Rationale / §5.3` | 없음 |
| I4 | Rationale Continuity | spec §4 step 2 코드 래핑 형식(`(async () => { "use strict"; <code> })()`) 이 실제 구현(`wrapUserCode`, isolate 경계 직렬화) 과 불일치 | `spec/4-nodes/5-data/2-code.md §4 step 2` | spec §4 step 2 를 "isolate `compileScript` 로 컴파일 (내부적으로 async IIFE 래핑 — 상세는 구현 참조)" 수준으로 추상화 |
| I5 | Rationale Continuity | spec §4 step 6 "`varsClone` 전체 덮어쓰기" 기술이 실제 sync-back(`jail.get('$vars', { copy: true })` 읽기 → `varsClone` 은 fallback) 과 방향 역전 | `spec/4-nodes/5-data/2-code.md §4 step 6` | "정상 종료 시 격리 환경의 최종 `$vars` 를 읽어 원자적으로 전체 교체; copy-out 실패 시 `varsClone` 폴백" 으로 수정 |
| I6 | Convention Compliance | `0-common.md` §4 `meta` 행의 "Phase 1 (D) 에서 폐기" 미래형 표현이 현재 구현 완료 상태와 불일치 | `spec/4-nodes/5-data/0-common.md §4` | "폐기됨 (CONVENTIONS Principle 2 Code 행 참조)" 으로 과거형 정리 |
| I7 | Convention Compliance | `1-transform.md §1` blockquote 가 코드 파일을 "source of truth" 로 명시 → spec 단일 진실 원칙과 혼동 | `spec/4-nodes/5-data/1-transform.md §1` | `> 구현 레퍼런스:` 또는 `> 스키마 구현:` 으로 표현 변경 |
| I8 | Convention Compliance | `2-code.md §5.3.3` 메모리 초과 JSON 예시에서 `meta.durationMs` 누락 (Principle 2 공통 필수 필드) | `spec/4-nodes/5-data/2-code.md §5.3.3 JSON 예시` | 측정 방법(경과 ms 또는 `0` fallback)을 spec 에 기술하고 JSON 예시에 `durationMs` 추가; 핸들러 구현도 확인 |
| I9 | Convention Compliance | `2-code.md §5.3.2` 타임아웃 케이스 `"stack": "..."` 플레이스홀더가 §5.3.1 의 구체 예시 대비 일관성 부재 | `spec/4-nodes/5-data/2-code.md §5.3.2 JSON 예시` | 타임아웃 대표 stack 예시로 교체 |
| I10 | Convention Compliance | `0-common.md` / `1-transform.md` 에 Overview·Rationale 섹션 없음 | `spec/4-nodes/5-data/0-common.md`, `1-transform.md` | `1-transform.md` 에 `## Rationale` 섹션 추가 권장 |
| I11 | Plan Coherence | `plan/in-progress/refactor/04-security.md` M-2 `- [ ]` 도 C-2 와 함께 target 에서 해소됨 | `spec/4-nodes/5-data/2-code.md §7.3` + handler bootstrap | M-2 를 `- [x] ✅ C-2 와 함께 완료 (isolated-vm 전환으로 흡수, 2026-06-11)` 로 갱신 |
| I12 | Plan Coherence | `plan/in-progress/marketplace-and-plugin-sdk.md` 샌드박싱 항목이 "spec §로드맵에 isolated-vm 언급" 전제인데 target 이 이미 도입 완료 | `spec/4-nodes/5-data/2-code.md §7.1` | 해당 항목 주석을 "code 노드에 isolated-vm 이미 도입 — code 노드 레이어 재사용 여부 검토" 로 갱신 |
| I13 | Naming Collision | `EXECUTION_MEMORY_EXCEEDED` 가 `error-codes.ts` 미등재 문자열 리터럴로만 존재 (`EXECUTION_TIMEOUT` 과 동일 패턴) | `code.handler.ts` `classifyError()` + `LEGACY_TO_NORMALIZED` | spec §5.3 에러 코드 정규화 매핑 표에 "내부 legacy 코드, `error-codes.ts` 미등재" 명시 |
| I14 | Naming Collision | 프론트엔드 docs `data.mdx` / `data.en.mdx` 에서 구버전 코드(`CODE_SYNTAX_ERROR` 포함) 제거 + 신규 코드 교체 완료. 타 워크트리(`fix-model-configs-kind-400-88c8b4`, `fix-embedding-test-dimension-a3d42a`) 에는 구버전 잔존 → 머지 시 충돌 가능 | `codebase/frontend/src/content/docs/02-nodes/data.mdx` / `data.en.mdx` | 머지 시 위 두 워크트리의 동일 파일을 신규 코드로 동기화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `3-error-handling.md §1.4` 엔진 수준 표에 `EXECUTION_TIMEOUT` 계층 혼동(WARNING 1건). 나머지 모두 일치 |
| Rationale Continuity | LOW | spec §4 step 2/6 기술 정확도 문제(INFO 2건). Rationale 원칙·합의 invariant 번복 없음 |
| Convention Compliance | LOW | §5.3.1 `details.stack` 비프로덕션 한정 미명시(WARNING 1건), §5.3.3 `meta.durationMs` 누락(INFO 1건). 에러 코드 네이밍·필드 규약 전반 준수 |
| Plan Coherence | LOW | C-2/M-2 체크박스 미갱신, `CODE_MEMORY_LIMIT` "미구현" 역전, `0-overview.md §5` node:vm 잔존(WARNING 3건). 구현 방향 자체는 plan 과 일치 |
| Naming Collision | MEDIUM | `CODE_MEMORY_LIMIT` execution-failure-classifier 미등재(WARNING). `classifyError` 동명 private 메서드 혼동 리스크(WARNING). 직접 충돌 없음 |

## 권장 조치사항

1. **(W1 — 구현 수정 필요)** `execution-failure-classifier.ts` 에 `CODE_MEMORY_LIMIT` 를 적절한 버킷(`TIMEOUT_CODES` 또는 신규 버킷)에 추가하고, `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에도 등재. 채팅 채널 사용자 노출 영향 있음.
2. **(W7 — PR 머지 전 처리 권장)** `spec/4-nodes/0-overview.md §5` 샌드박싱 표를 `isolated-vm` 전환 완료 상태로 갱신 (planner 위임). target PR 과 함께 또는 직후 처리.
3. **(W5+W6 — plan 정리)** `plan/in-progress/refactor/04-security.md` C-2·M-2 체크박스 완료 처리; `node-output-redesign/code.md` `CODE_MEMORY_LIMIT` 기술 갱신.
4. **(W2 — 선택적 리팩터)** `classifyError` 함수명을 `classifyCodeNodeError` 로 변경하거나 JSDoc 보강. namespace 충돌은 없으나 유지보수 명확성 향상.
5. **(W3 — spec 편집)** `spec/5-system/3-error-handling.md §1.4` 엔진 수준 표 `EXECUTION_TIMEOUT` 항목에 계층 구분 주석 추가 또는 노드 수준 표로 이동.
6. **(W4 — spec 편집)** `spec/4-nodes/5-data/2-code.md §5.3.1` JSON 예시에 "비프로덕션 환경 기준" 주석 추가.
7. **(I8 — 구현 확인)** 메모리 초과 시 `meta.durationMs` 측정·fallback 로직 핸들러에서 확인 후 spec 예시 보완.
8. **(I4/I5 — spec 편집 저우선)** spec §4 step 2/6 내부 구현 기술을 추상화 또는 현행 구현 반영으로 수정.
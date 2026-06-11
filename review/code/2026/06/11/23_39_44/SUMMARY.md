# Code Review 통합 보고서

**브랜치**: `http-ssrf-all-auth`
**리뷰 일시**: 2026-06-11
**리뷰어**: requirement, scope, side_effect, documentation

---

## 전체 위험도

**MEDIUM** — 기능 완전성은 충족하나 spec 내부 불일치(HTTP_BLOCKED 누락, HTTP_TIMEOUT dead path, 에러 코드 레지스트리 미등재) 3건이 문서 정합성을 저하시킴. 런타임 breaking change 없음.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Spec 내부 불일치 | `spec/5-system/3-error-handling.md` §3.2 "대표 에러 코드" 표에 `HTTP_BLOCKED` 누락 — §1.4 표에는 포함됨 | `3-error-handling.md` line 222 | §3.2 HTTP 행에 `HTTP_BLOCKED` (SSRF 차단) 추가해 §1.4 와 일치 |
| 2 | Spec Dead Path | `HTTP_TIMEOUT` 이 `3-error-handling.md §1.4·§3.2`, `chat-channel-adapter.md §3.1` 에 등재되어 있으나 HTTP Request 핸들러는 모든 fetch reject 를 `HTTP_TRANSPORT_FAILED` 로 통합 처리 — `HTTP_TIMEOUT` 을 실제 발행하는 핸들러가 없음 | `3-error-handling.md` line 222, `chat-channel-adapter.md` line 381 | §1.4·§3.2 의 `HTTP_TIMEOUT` 을 제거하거나 "(미발행 — `HTTP_TRANSPORT_FAILED` 로 통합)" 주석 추가; `chat-channel-adapter.md §3.1` 동일 처리 |
| 3 | Spec Deprecation 미선언 | `spec/4-nodes/4-integration/1-http-request.md §5.3.2` 의 `output.response: { error }` 필드가 P3 에서 제거 예정이나 spec 본문에 deprecation 의도 미선언 — 소비자 코드가 이 필드에 의존 시 P3 에서 breaking change | `1-http-request.md §5.3.2` | JSON 예시에 `// legacy — 제거 예정 (P3)` footnote 추가; 소비자에게 `output.error` 사용 권고 |
| 4 | Spec 문서 구 파일명 참조 잔존 가능성 | `spec/data-flow/7-llm-usage.md` 에서 두 줄(`llm-config.service.ts` → `model-config.service.ts`)은 갱신됐으나 문서 내 다른 절에 `llm-config` 잔존 여부 미확인 | `spec/data-flow/7-llm-usage.md` L45-46 | 전체 파일에서 `llm-config` 키워드 잔존 여부 점검 후 일괄 갱신 |
| 5 | Spec Frontmatter 커버리지 불완전 | `spec/2-navigation/6-config.md` `code:` frontmatter 에서 구 7개 경로 제거 후 PR4 이후 신규 frontend model config 경로 미추가 — spec 커버리지 공백 | `spec/2-navigation/6-config.md` frontmatter | PR4 이후 신규 frontend/backend 경로를 `code:` frontmatter 에 보완 |
| 6 | 에러 코드 레지스트리 미등재 | `spec/4-nodes/5-data/2-code.md` 에서 `EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `EXECUTION_MEMORY_EXCEEDED` 를 `legacyCode` 로 격하했으나 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 매핑 미등재 | `spec/conventions/error-codes.md §3` | `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED`, `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 세 매핑 등재 |
| 7 | Spec↔구현 갭 | `spec/conventions/chat-channel-adapter.md §3.1` 에 `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 가 spec 에만 추가됐고, `execution-failure-classifier.ts` 화이트리스트에 반영 여부 불확실 — 미반영 시 두 코드가 unknown fallback 으로 처리됨 | `spec/conventions/chat-channel-adapter.md §3.1`, `execution-failure-classifier.ts` | `execution-failure-classifier.ts` 에 두 코드 추가 여부 확인; 미포함 시 이 PR 또는 직후 PR 에 포함 |
| 8 | Spec 링크 경로 변경 | `spec/5-system/1-auth.md §4.1` 링크가 루트 상대(`codebase/backend/...`) → 파일 위치 기준 상대(`../../codebase/backend/...`)로 수정됨 — 경로 정확성 확인 필요 | `spec/5-system/1-auth.md §4.1` | `spec/5-system/` 에서 `../../codebase/...` 가 올바른 상대경로인지 최종 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `1-http-request.md §4 step 8` SSRF 가드 적용 범위가 `integration` 한정 → 전 인증 방식(`none`/`integration`/`custom`) 공통으로 확장됨. 구현(`http-request.handler.ts`)도 동일. `refactor/04-security.md C-3` 사용자 결정을 정식 반영한 의도적 변경으로 spec 이 올바르게 갱신됐고 §3.2 의 `HTTP_BLOCKED` 누락만 별도 처리 필요 | `1-http-request.md §4 step 8`, `§4.2` | 코드 유지. §3.2 `HTTP_BLOCKED` 누락은 WARNING 1번으로 별도 처리 |
| 2 | Spec §3.2 헤딩 불명확 | §3.2 "대표 에러 코드" 가 비완전 목록임을 암시하나 §1.4("정식 목록은 `error-codes.ts`")와 의도 차이 미명시 | `3-error-handling.md` line 218 | §3.2 헤딩에 "전체 목록은 §1.4 참조" 또는 "§1.4 의 요약" 명시 |
| 3 | Spec 갱신 정확 | `spec/1-data-model.md` `embedding_llm_config_id`/`embedding_model` 제거 타임라인이 `V092` → `PR4b` 로 정정됨. 근거(데이터 마이그레이션 선행 필요) 명시로 의도 명확 | `spec/1-data-model.md` lines 2027-2028 | 없음 |
| 4 | Spec 갱신 정확 | `spec/data-flow/1-audit.md` §1.1 call site 9 → 13, Rationale "4개 모듈 9개 call site" 도 두 곳 모두 갱신됨. SoT와 Rationale 일치 | `spec/data-flow/1-audit.md` | 향후 call site 변경 시 두 곳 동시 갱신 필요 — Rationale 을 단방향 참조로 대체하면 유지보수 부담 감소 |
| 5 | 계획 식별자 참조 불명확 | "PR4b" 첫 등장 시 plan 파일 링크 또는 작업 설명 없음 | `spec/1-data-model.md` L334-337 | `PR4b` 첫 등장 위치에 plan 파일 링크 또는 한 줄 설명 추가 |
| 6 | 에러 코드 등록부 보완 | `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND` 가 `3-error-handling.md §1.1` 에는 추가됐으나 `spec/conventions/error-codes.md` 등재 여부 미확인 | `spec/5-system/3-error-handling.md` L45-47 | `spec/conventions/error-codes.md` 에 두 코드 등재 여부 확인 후 보완 |
| 7 | 분류 근거 미명시 | `HTTP_BLOCKED` 가 `executionFailedInternal`, `EMAIL_HOST_BLOCKED` 가 `executionFailedThirdParty` 에 분류되는 이유 설명 없음 | `chat-channel-adapter.md §3.1` | 표 note 에 분류 근거 한 줄 추가 |
| 8 | 구 함수명 잔존 확인 필요 | `spec/4-nodes/0-overview.md §5` 에서 `buildSandbox` 참조를 `isolated-vm` 으로 교체했으나 파일 내 다른 절에 `buildSandbox` 잔존 여부 미확인 | `spec/4-nodes/0-overview.md` | 전체 파일에서 `buildSandbox` 잔존 검색 후 제거 |
| 9 | 상태 파일 불일치 | 4개 consistency review 세션의 `_retry_state.json` 이 `agents_success: [], agents_pending: [all]` 초기 상태로 커밋됨. 실행 결과물은 정상 생성됐으나 상태 파일이 완료 후 갱신되지 않아 추후 재시도 로직이 이 파일을 읽으면 완료된 checker 를 재실행할 잠재 위험 | `review/consistency/**/_retry_state.json` 4건 | 세션 완료 시 `_retry_state.json` 최종 상태 갱신. 리뷰 하네스 설계 사항이므로 즉각 조치 불필요 |
| 10 | V092 마이그레이션 실제 내용 확인 | `embedding_llm_config_id` DROP 이 V092 에서 제외됐다면 실제 마이그레이션 파일에서도 해당 항목이 제거됐는지 코드 레벨 검증 필요 | V092 마이그레이션 파일 | V092 마이그레이션 파일에서 `embedding_llm_config_id` DROP 제거 여부 확인 |
| 11 | auth_config audit 구현 검증 | `auth_config.create/update/delete/regenerate` 4종이 "Planned" → "구현됨"으로 이동됐으므로 `auth-configs.service.ts` 에 실제 `AuditLogsService.record` 호출이 4종 모두 존재하는지 코드 레벨 확인 | `spec/5-system/1-auth.md`, `auth-configs.service.ts` | 코드 diff 에서 4종 호출 존재 여부 검증 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `HTTP_BLOCKED` §3.2 누락, `HTTP_TIMEOUT` dead path, `output.response.error` deprecation 미선언 (WARNING 3건) |
| scope | NONE | 범위 내 변경 확인. origin/main 머지 커밋 및 부수 수정 모두 plan 에 명시됨 |
| side_effect | LOW | `execution-failure-classifier.ts` spec↔구현 갭, `_retry_state.json` 초기 상태 커밋, auth_config audit 계약 변경 확인 필요 |
| documentation | MEDIUM | 에러 코드 레지스트리 미등재(WARNING), 구 파일명 잔존 가능성(WARNING 2건), frontmatter 커버리지 불완전(WARNING) |

---

## 발견 없는 에이전트

- **scope**: Critical/Warning 발견 없음. 범위 이탈 없이 의도된 변경 범위 준수.

---

## 권장 조치사항

1. **[즉시]** `spec/5-system/3-error-handling.md §3.2` HTTP 행에 `HTTP_BLOCKED` 추가 (WARNING 1)
2. **[즉시]** `spec/conventions/error-codes.md §3` 에 `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED`, `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 세 historical-artifact 매핑 등재 (WARNING 6)
3. **[이 PR 또는 직후]** `execution-failure-classifier.ts` 에 `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` 추가 — spec 에만 선행 등재된 상태로 구현 갭 존재 (WARNING 7)
4. **[이 PR 또는 직후]** `3-error-handling.md §1.4·§3.2` 및 `chat-channel-adapter.md §3.1` 에서 `HTTP_TIMEOUT` 을 제거하거나 "(미발행 — `HTTP_TRANSPORT_FAILED` 로 통합)" 주석 추가 (WARNING 2)
5. **[이 PR]** `1-http-request.md §5.3.2` JSON 예시에 `output.response.error` 필드 deprecation 주석 추가 (WARNING 3)
6. **[PR 설명에]** origin/main 머지 커밋 역할 및 Database Query 선재 drift 수정 사유 명시
7. **[후속]** `spec/data-flow/7-llm-usage.md` 전체에서 `llm-config` 잔존 여부 점검 (WARNING 4)
8. **[후속]** `spec/2-navigation/6-config.md` frontmatter 에 PR4 이후 신규 frontend model config 경로 보완 (WARNING 5)
9. **[후속]** `spec/5-system/1-auth.md §4.1` 링크 경로(`../../codebase/backend/...`) 정확성 최종 확인 (WARNING 8)
10. **[후속]** `spec/conventions/error-codes.md` 에 `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND` 등재 확인 (INFO 6)

---

## 라우터 결정

라우터가 선별 (`routing_status=done`):

- **실행**: `requirement`, `scope`, `side_effect`, `documentation` (4명)
- **제외**: 1명

| 제외된 reviewer | 이유 |
|------------------|------|
| `security` | 라우터에 의해 제외 (이유 미기록 — 주요 보안 변경 사항인 SSRF 가드 확장에 대해 security 리뷰가 생략됐음. `requirement` 리뷰어가 SSRF 관련 spec 불일치를 부분 커버했으나, 구현 레벨 보안 검증은 수행되지 않음) |

- **강제 포함(router_safety)**: `documentation`, `requirement` (2명)
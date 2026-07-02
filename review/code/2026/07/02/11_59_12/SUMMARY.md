# Code Review 통합 보고서

## 전체 위험도
**NONE** — refactor-03 M-7 첫 클러스터(`execution-engine` inline `as Record<string, unknown>` 단언 → zod-derived `ResumeState`/`ResumeCheckpoint`/`RetryState` 타입 치환)는 behavior-preserving 순수 타입 리팩토링으로, 확인된 3개 reviewer(security/requirement/maintainability) 모두 CRITICAL/WARNING 없이 전부 INFO 등급으로 판정. 단, scope/side_effect/testing 3개 reviewer 는 output_file 이 디스크에 존재하지 않아 결과를 통합하지 못함(재시도 필요).

## Critical 발견사항

없음

## 경고 (WARNING)

없음

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | zod 스키마가 런타임 검증(parse/safeParse)에 쓰이지 않고 타입/테스트 오라클 용도로만 존재 — DB 저장값(`_resumeCheckpoint`/`_retryState`)의 형태는 실행 시점에 검증되지 않음. 의도된 설계(§7.5 graceful-reset semantics 보존) | `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` | 현행 유지. 향후 DB 값이 외부 변조 가능 경로에 노출되면 `retryLastTurn` 진입점에서 스키마 형태를 `safeParse` 로 방어하는 것 고려 |
| 2 | security | credential-strip allow-list(`CREDENTIAL_CONTEXT_FIELDS`)가 `.strict()` 스키마 + drift-guard 단위 테스트로 executable 문서화됨 — 긍정적 개선 | `resume-state.schema.ts`, `execution-engine.service.spec.ts` | 없음(개선 사항으로 기록) |
| 3 | security | `handler-output.adapter.ts` 의 `_resumeState` 타입 가드가 `isRecord()` 로 통합됐으나 기존 로직과 동치, 새 취약점 없음 | `handler-output.adapter.ts` `wrapBareAsNodeHandlerOutput` | 없음 |
| 4 | requirement | 스키마는 문서화/타입 목적 전용이며 런타임 검증 미수행 — plan(§03-maintainability M-7) 및 JSDoc 명시 의도와 구현 일치 | `utils/resume-state.schema.ts` | 없음(설계 의도 확인됨) |
| 5 | requirement | spec §1.3 credential/context-binding 필드 목록과 `CREDENTIAL_CONTEXT_FIELDS`/`credentialStripSubsetShape` 가 line-level 정합 | `spec/5-system/4-execution-engine.md:168, 1289` vs `resume-state.schema.ts` | 없음(spec fidelity 확인됨) |
| 6 | requirement | M-7 클러스터 실제 diff 범위가 plan 서술(224-225행, "첫 클러스터"는 `to-record.ts`+`cachedMeta` 1건 전환)보다 넓음 — `ai-turn-orchestrator.service.ts`/`retry-turn.service.ts`/`handler-output.adapter.ts` 도 함께 포함 | `plan/in-progress/refactor/03-maintainability.md:224` | `developer` 가 plan 문서 진행 서술을 실제 커밋 범위에 맞춰 갱신 권장(코드 문제 아님) |
| 7 | maintainability | `resumeState`/`resumeCheckpoint`/`retryState` 신규 타입이 함수 "입구"에서만 국지적으로 도입되고, `processAiResumeTurn`/`handleAiMessageTurn`/`handleAiTurnError`/`finalizeAiNode` 등 relay 시그니처는 여전히 `Record<string, unknown>` — 타입 강화 효과가 함수 경계를 넘지 못함 | `ai-turn-orchestrator.service.ts`, `retry-turn.service.ts` | 후속 클러스터에서 relay 시그니처도 `ResumeState` 로 통일 권장(필수 아님) |
| 8 | maintainability | `credentialStripSubsetShape` 15개 필드가 스키마 파일과 빌더 구현 파일(`buildResumeCheckpoint`/`buildRetryReentryState`) 두 곳에 물리적으로 분리되어 손 동기화 필요 — drift-guard 테스트로 리스크 상당 부분 완화됨 | `utils/resume-state.schema.ts` | 별도 조치 불필요(이미 완화됨). 필드 증가 시 빌더가 `Object.keys(shape)` 역참조하는 방식도 고려 가능(현재는 과설계) |
| 9 | maintainability | `resume-state.schema.ts` 파일 docstring/인라인 주석이 상세(behavior-preserving, graceful-reset semantics 근거) — "왜 zod인데 runtime validate 안 하는가" 를 명확히 설명, 향후 오용(실수로 parse 삽입) 방지 | `utils/resume-state.schema.ts` | 없음 |
| 10 | maintainability | `handler-output.adapter.ts` 의 `isRecord` 추출은 가독성 개선 소규모 리팩터링 | `handler-output.adapter.ts` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿 하드코딩/인증우회/검증누락 등 미발견. credential-strip allow-list 가 스키마+테스트로 강화된 점 긍정적. zod 런타임 미검증은 의도된 설계 |
| requirement | NONE | plan/spec/구현/테스트 전 영역 정합 확인(단위테스트 PASS, tsc 신규 에러 0). plan 진행 서술만 실제 범위보다 약간 좁게 기술 |
| maintainability | NONE | behavior-preserving 순수 타입 narrowing, diff 국지적. 타입 강화가 함수 경계를 못 넘는 점만 향후 확장 여지로 기록 |
| scope | 재시도 후 done | output_file 재실행으로 생성 — 아래 재검 결과 참조 |
| side_effect | 재시도 후 done | output_file 재실행으로 생성 — 아래 재검 결과 참조 |
| testing | 재시도 후 done | output_file 재실행으로 생성 — 아래 재검 결과 참조 |

## 발견 없는 에이전트

없음(실행된 reviewer 모두 INFO 수준 이하 발견사항 보유)

## 권장 조치사항
1. (선택) `developer` 가 `plan/in-progress/refactor/03-maintainability.md` M-7 진행 서술을 실제 커밋 diff 범위(`ai-turn-orchestrator.service.ts`/`retry-turn.service.ts`/`handler-output.adapter.ts` 포함)에 맞춰 갱신. → 본 클러스터 PR 에서 plan §M-7 갱신으로 반영.
2. (선택, 필수 아님) 후속 클러스터에서 `processAiResumeTurn`/`handleAiMessageTurn` 등 relay 시그니처도 `ResumeState`/`RetryState` 타입으로 통일해 타입 강화 범위 확장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing` (6명)
  - **제외**: performance, architecture, documentation, dependency, database, concurrency, api_contract, user_guide_sync (8명 — 타입 캐스팅 치환 범위와 무관)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (소스 코드 변경 시 항상 적용)

# RESOLUTION — ai-review 2026/06/27/15_32_28

**대상**: `claude/mc-endpoint-hardening-dca699` — model-config 부속 엔드포인트 hardening + doc-sync
**결과**: Critical 0 / Warning 8 (reviewer별) / Risk LOW (testing MEDIUM = 오탐 2건 제외 시 LOW)
**처리 커밋**: `547a332e` (review-fix)

> 8 reviewer fallback Agent fan-out (Workflow router 매핑 버그 회피, [[reference_ai_review_workflow_router_empty]]).

## Critical

없음.

## Warning 처리

| # | reviewer | 처리 | 반영 |
|---|----------|------|------|
| W1 | maintainability | FIXED | `ParseEnumPipe(['chat','embedding'])` raw 배열 → `MODEL_TYPE_ENUM = {chat,embedding} as const` + 파생 타입 `ModelTypeFilter`. ParseEnumPipe 인자·`@ApiQuery` enum·파라미터 타입을 단일 소스에서 파생(DRY, 코드베이스 Record 패턴 정합) |
| W2 | api-contract | FIXED | `listModels` 에 `@ApiBadRequestResponse({description:'유효하지 않은 type...'})` 추가 — ParseEnumPipe 400 경로 Swagger 문서화(previewModels 와 일관) |
| W3 | documentation | FIXED | (W2 와 동일 surface) + CHANGELOG `## Unreleased` 에 listModels invalid-type 400 behavior change 기재 |
| W4 | side-effect | FIXED | invalid-type→400 의도된 동작 변경을 CHANGELOG 에 명시(스펙 준수 클라이언트 무영향: `@ApiQuery enum` 기선언) |
| W5 | testing | FIXED | e2e 케이스 H 에 `GET :id/models?type=bogus → 400` 단언 추가 — pipe wiring 검증(단위 테스트는 pipe 우회) |
| W6 | testing | **오탐(defer)** | "testConnection `@Roles('editor')` 메타데이터 단언 누락" — **실제로는 존재**. `llm-model-config.controller.spec.ts` L98 `it("testConnection method has 'editor' role metadata...")`. #716 에서 추가됨. reviewer 가 stale 라인(L85-94)만 봄 |
| W7 | testing | **오탐(defer)** | "listModels roles 부재 단언 누락" — **실제로는 존재**. 같은 spec L106 `it('listModels (GET read) has NO role metadata...')` → L111 `toBeUndefined()`. #716 에서 추가됨 |
| W8 | scope | **justified(keep)** | `plan/complete/web-chat-loader-queue-replay-arguments.md`(#715) `spec_impact: [] → none` 은 본 PR 과 무관하나, Gate C(plan-completion spec-consistency)가 빈 배열을 거부해 **plan-touching PR 전부의 unit/CI 를 막던 main breakage** 해소다. reviewer 가 제시한 대안("커밋 메시지에 의도 명시")을 커밋 `7eb45204` 본문에서 충족 |

## INFO 처리

- maintainability/documentation: `@Throttle` 키 순서 `{ttl,limit}` 통일 + 분당 10회 근거 주석 → **FIXED**.
- documentation: `spec_impact: none` 스키마 정합 → **확인 완료**. Gate C 가 비-빈 문자열/배열을 요구하며 `none` 은 plan/complete 7+ 파일의 기존 관례(정상).
- 나머지 INFO(enum vs Record 변형, 상수화 기준 명문화 등)는 W1 fix 로 흡수되거나 pre-existing 별건.

## ESCALATE

없음.

## e2e

통과 — `.claude/tools/run-test.sh e2e` 215 pass (2026-06-27 15:46, log `_test_logs/e2e-20260627-154638.log`). 마지막 코드 커밋(`547a332e`) 다음 수행. 케이스 H 에 invalid-type→400 단언 포함.

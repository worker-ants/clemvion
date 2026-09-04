# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 21행) — Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (128~198행) — Read 완료.

## 변경 파일 인벤토리 (34개, orchestrator payload 기준)

- `CHANGELOG.md`
- `codebase/backend/src/common/__test-utils__/{source-scan.ts, temp-fixture.ts, temp-fixture.spec.ts}` (신규 공유 테스트 헬퍼)
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
- `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/{nullable-type-lie-cast-guard.ts, nullable-type-lie-cast.spec.ts, swagger-dto-contract-guard.ts(신규), swagger-dto-contract.spec.ts(신규)}`
- `plan/in-progress/{execution-engine-residual-gaps.md, spec-draft-nullable-notation-followups.md}`
- `review/code/2026/09/04/11_02_30/**` (직전 코드 리뷰 산출물, 8개 파일)
- `review/consistency/2026/09/04/11_33_21/**` (직전 consistency 리뷰 산출물, 8개 파일)

`git status --short` 로 보강 확인 — 워크트리는 clean(이 리뷰 세션 자신의 산출물만 untracked), 위 목록과 정합.

## trigger 매칭 결과

1. **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일 중 `nodes/**` 하위는 0건.
2. **신규 UI 문자열 (TSX)** — 매칭 없음. `.tsx` 변경 0건.
3. **통합/제공자 변경** — 매칭 없음.
4. **유저 가이드 신규 섹션 디렉토리** — 매칭 없음. `content/docs/**` 변경 0건.
5. **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 매칭 없음.
6. **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 없음.
7. **실행·디버깅 흐름 변경** — 매칭 없음(execution-engine 관련 plan 문서 갱신은 있으나 backend 실행 엔진 코드 자체 변경 아님, plan 서술 정정일 뿐).
8. **신규 warningCode/errorCode 발행** — 매칭 없음. `warningRules`·`error-codes.ts` 변경 0건.
9. **백엔드 API 추가·변경** (`codebase/backend/src/**/dto/**`, match: semantic) — **매칭됨**. `background-run-response.dto.ts`, `create-assistant-session.dto.ts` 가 glob 에 해당.

## 발견사항

### backend-api-change 트리거 — 갭 없음 (INFO, 경계 사례로 기록)

- 변경 파일: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`, `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- 매트릭스 항목: `backend-api-change` — targets: "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 분석:
  - target (a) 는 이 diff 자체가 그 target 이다 — `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 로 swagger jsdoc 을 정정하는 커밋이므로 이미 충족.
  - target (b) 는 조건부("영향이 있으면")다. 이번 변경은 필드 추가/제거/개명이 아니라 **기존에 항상 존재하던 필드의 OpenAPI `required` 선언을 실제 런타임 동작에 맞게 정정**한 것 — CHANGELOG.md 자체가 "동작 변경은 없다" 라고 명시한다. `grep -rl "background-run\|nextCursor\|durationMs" codebase/frontend/src/content/docs/` 로 확인한 결과 히트는 `logic.mdx`/`triggers.mdx`/`integrations.mdx` 등에서 나왔으나 전부 무관한 문맥(다른 노드의 "실행 소요 시간" 같은 일반 서술)이고, 이 DTO 의 `finishedAt`/`durationMs`/`inputData`/`outputData`/`error`/`nextCursor`/`completedAt` 필드의 optional/nullable 여부를 사용자 가이드가 직접 서술하는 자리는 찾지 못했다. `llmConfigId` 도 마찬가지로 `ai.mdx`/`ai-assistant.mdx` 는 UI 상의 LLM 설정 선택 흐름을 서술할 뿐, 요청 바디의 optional+nullable 계약을 언급하지 않는다.
  - 결론: 이 API 계약 정정은 OpenAPI 스펙 생성기를 쓰는 외부 클라이언트에는 영향이 있지만(§CHANGELOG 명시), 운영 콘솔의 사용자 가이드(02-nodes/05-run-and-debug 등)가 서술하는 층위보다 아래(스키마 메타데이터)라서 target (b) 의 "사용자 안내 페이지" 동반 갱신 대상이 없다고 판단한다.
- 위험도: 갭 없음(target (a) 충족, target (b) 비해당) — CRITICAL/WARNING 승격 없이 판단 근거만 INFO 로 남긴다.

### 그 외 변경 — 매트릭스 무관

- 공유 테스트 헬퍼(`temp-fixture.ts`/`.spec.ts`), repo-guard AST 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`, `nullable-type-lie-cast-guard.ts` 정규화), `source-scan.ts` JSDoc 갱신 — 전부 `codebase/backend/src/{common/__test-utils__,repo-guards}/**` 아래이며 매트릭스 어떤 trigger glob 에도 해당하지 않는다(노드·auth·expression-engine·frontend 无).
- `plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 문서 자체 정정(실측 재검증·수치 정정)이며 코드 trigger 가 아니다.
- `review/code/2026/09/04/11_02_30/**`, `review/consistency/2026/09/04/11_33_21/**` — 직전 리뷰 세션의 산출물(RESOLUTION/SUMMARY/각 카테고리 리포트). 문서 산출물이지 매트릭스가 가리키는 "유저 가이드" 대상이 아니다.
- `CHANGELOG.md` — 매트릭스 target 목록에 없는 별도 관례(변경 이력 기록)로, 이번 변경분은 오히려 이 배치가 준수해야 할 "같은 turn 문서화"를 스스로 충족하고 있다(9곳 계약 정정을 CHANGELOG 에 상세 기록).

## 요약

매트릭스 21개 trigger 중 이번 변경 set 이 매칭한 것은 `backend-api-change`(DTO glob, semantic) 1건뿐이며, target (a) swagger jsdoc 은 diff 자체로 충족되고 target (b) user-guide 페이지 동반 갱신은 실제 사용자 가이드 참조점을 찾지 못해 비해당으로 판단했다. 나머지 33건 trigger(신규 노드, 노드 schema, TSX 신규 문자열, 통합/제공자, 신규 섹션 디렉토리, 인증/세션 흐름, 표현식 언어, 실행/디버깅 흐름, warning/error code 등)는 이번 변경 set 에 해당 파일이 전혀 없어 매칭되지 않았다. 이번 diff 는 nullable 컬럼/DTO 계약 정정 축(backend-only)과 그 재발방지 가드(repo-guards, AST 기반) + plan/review 문서 정리로 구성되며, 유저 가이드 동반 갱신 관점에서 누락은 발견되지 않았다.

## 위험도

NONE

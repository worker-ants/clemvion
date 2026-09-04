# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 21행) — Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (128~198행) — Read 완료.

## 변경 파일 인벤토리 (prompt 기준, 68개 — 실질 소스 변경 18개 + 리뷰/consistency 산출물 50개)

실질 코드/plan 변경(파일 1~18):

- `CHANGELOG.md`
- `codebase/backend/src/common/__test-utils__/{source-scan.ts, source-scan.spec.ts, temp-fixture.ts(신규), temp-fixture.spec.ts(신규)}`
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
- `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/{audit-action-binding.spec.ts, engine-error-code-anchor-guard.ts, masked-reject-callers-guard.ts, nullable-type-lie-cast-guard.ts, nullable-type-lie-cast.spec.ts, production-build-devdep-guard.ts, production-build-devdep.spec.ts, swagger-dto-contract-guard.ts(신규), swagger-dto-contract.spec.ts(신규)}`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`

나머지 파일 19~68 은 직전 회차(11:02:30, 11:44:16, 12:17:50)의 code-review / consistency-review 산출물(`RESOLUTION.md`/`SUMMARY.md`/`*.json`/카테고리별 `.md`) — 이 reviewer 자신을 포함한 리뷰 파이프라인의 메타 산출물이며, 매트릭스가 가리키는 "유저 가이드" 자산이 아니다.

## trigger 매칭 결과

1. **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일 중 `nodes/**` 하위 0건.
2. **신규 UI 문자열 (TSX)** — 매칭 없음. `.tsx` 변경 0건.
3. **통합/제공자 변경** — 매칭 없음.
4. **유저 가이드 신규 섹션 디렉토리** — 매칭 없음. `content/docs/**` 변경 0건.
5. **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 매칭 없음. `audit-action-binding.spec.ts` 는 감사 helper 의 action-리소스 바인딩을 검사하는 repo-guard 테스트일 뿐, 실제 auth/권한/세션 로직 변경이 아니다(경로 정규화 함수 교체만).
6. **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 없음.
7. **실행·디버깅 흐름 변경** — 매칭 없음. `background-run-response.dto.ts` 가 Background 실행 결과 API DTO 라 후보로 검토했으나, 변경은 실행 엔진의 동작·로깅 흐름이 아니라 OpenAPI 데코레이터(문서 메타데이터)만 교정한 것 — diff 헤더가 "동작 변경은 없다" 로 명시.
8. **신규 warningCode/errorCode 발행** — 매칭 없음. `warningRules`·`error-codes.ts` 변경 0건.
9. **백엔드 API 추가·변경** (`codebase/backend/src/**/dto/**`, match: semantic) — **매칭됨**. `background-run-response.dto.ts`, `create-assistant-session.dto.ts` 가 `dto/**` glob 에 해당.

## 발견사항

### [INFO] backend-api-change 트리거 매칭 — 갭 없음으로 판단 (경계 사례로 기록)

- 변경 파일: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`, `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- 매트릭스 항목: `backend-api-change` — targets: "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 상세:
  - target (a) 는 이 diff 자체가 그 target 이다 — `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환은 swagger jsdoc(`description`)을 그대로 보존한 채 `required`/`nullable` 선언만 실제 타입(`T | null`, 항상 존재)에 맞춘 정정이므로 이미 충족.
  - target (b) 는 조건부("영향이 있으면")다. `grep -rl "background-run\|nextCursor\|durationMs\|finishedAt" codebase/frontend/src/content/docs/` 로 확인 시 필드 단위 optional/nullable 계약을 서술하는 유저 가이드 자리는 없다. 유일한 관련 문서는 `codebase/frontend/src/content/docs/02-nodes/logic.mdx` §Background(라인 398~434 부근, `GET /api/executions/{executionId}/background-runs/{backgroundRunId}` 언급)인데, 이 절은 "응답에는 `status`, `startedAt`, `completedAt`, 본문 노드 목록, 관련 알림이 포함돼요" 정도의 존재 서술이지 각 필드의 required/nullable 여부를 명시하지 않는다 — 이번 diff 가 바로잡은 축(문서상 "선택적"이라던 필드가 실은 "항상 존재 + null 가능")과 이 mdx 서술이 애초에 충돌하지 않는다.
  - `create-assistant-session.dto.ts` 의 `llmConfigId?: string` → `string | null` 도 마찬가지 — `@ApiPropertyOptional({ nullable: true })` 데코레이터는 diff 이전부터 그 값이었고(OpenAPI 스펙 자체는 무변화), 서비스 레이어(`workflow-assistant-session.service.ts` `dto.llmConfigId ?? null`)가 이미 그 타입을 전제로 짜여 있었다. AI 어시스턴트 관련 유저 가이드(`ai.mdx`/`ai-assistant.mdx` 등)는 UI 상의 LLM 설정 선택 흐름만 서술하고 요청 바디의 optional+nullable 계약을 언급하지 않는다.
  - 결론: 이 계약 정정은 OpenAPI 코드제너레이터를 쓰는 외부 클라이언트에는 영향이 있지만(컴파일 타임 타입만), 운영 콘솔 유저 가이드가 서술하는 추상화 층위보다 아래(스키마 메타데이터)라서 target (b) 의 "사용자 안내 페이지" 동반 갱신 대상이 없다.
- 위험도: 갭 없음 — CRITICAL/WARNING 승격 없이 판단 근거만 INFO 로 기록.
- 참고: 앞선 두 회차(`review/code/2026/09/04/11_44_16/user_guide_sync.md`, `review/code/2026/09/04/12_17_50/user_guide_sync.md`)의 동일 reviewer 도 같은 파일 쌍에 대해 동일한 결론(target (b) 비해당, 위험도 NONE)을 냈다 — 이번 회차의 변경 set(테스트 유틸 리팩터·repo-guard 정규화·경로 정정)이 그 판단에 영향을 줄 실질 차이를 만들지 않는다.

### 그 외 변경 — 매트릭스 무관

- 공유 테스트 헬퍼(`temp-fixture.ts`/`.spec.ts`), repo-guard 경로 정규화(`toPosixRelative` 도입 — `engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·`nullable-type-lie-cast-guard.ts`·`production-build-devdep-guard.ts`·해당 spec 들·`websocket-events.types.spec.ts`·`audit-action-binding.spec.ts`), 신규 `swagger-dto-contract-guard.ts`/`.spec.ts` — 전부 `codebase/backend/src/{common/__test-utils__,repo-guards,modules/websocket}/**` 아래의 backend 내부 정적 가드·테스트 인프라이며, 매트릭스 어떤 trigger glob/semantic 조건에도 해당하지 않는다(노드·auth·expression-engine·frontend·docs 무관).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 문서 자체 정정(완료 이력 경로 갱신, 다음 배치 추적처 정정)이며 코드 trigger 가 아니다.
- `CHANGELOG.md` — 매트릭스 target 목록에 없는 별도 관례(변경 이력 기록)이고, 이번 diff 는 오히려 9곳 계약 정정을 상세히 CHANGELOG 에 남겼다. (`documentation` reviewer 가 별도로 "CHANGELOG 항목 누락" WARNING 을 이미 이전 회차에 제기·조치했던 이력이 있으나, 이는 매트릭스 trigger 범위 밖이라 본 reviewer 의 CRITICAL/WARNING 판정 대상이 아니다.)
- `review/code/**`, `review/consistency/**` 하위 50개 파일 — 리뷰 파이프라인 자신의 산출물(RESOLUTION/SUMMARY/각 카테고리 리포트/state json). 문서 산출물이지 매트릭스가 가리키는 유저 가이드 대상이 아니다.

## 요약

매트릭스 21개 trigger 중 이번 변경 set 이 매칭한 것은 `backend-api-change`(DTO glob, semantic) 1건뿐이며, target (a) swagger jsdoc 은 diff 자체로 충족되고 target (b) user-guide 페이지 동반 갱신은 실제 서술 자리를 찾지 못해 비해당으로 판단했다(직전 두 회차와 동일 결론). 나머지 20건 trigger(신규 노드, 노드 schema, TSX 신규 문자열, 통합/제공자, 신규 섹션 디렉토리, 인증/세션 흐름, 표현식 언어, 실행/디버깅 흐름, warning/error code, cross-cutting enum 등)는 이번 변경 set 에 해당 파일이 전혀 없어 매칭되지 않았다. 이번 diff 는 Swagger DTO nullable/presence 계약 정정(backend-only) + 그 축을 잡는 신규 AST repo-guard + 공유 테스트 픽스처 추출 + repo-guard 경로 정규화(`toPosixRelative`)로 구성되며, 유저 가이드 동반 갱신 관점에서 누락은 발견되지 않았다.

## 위험도

NONE

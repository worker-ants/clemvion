# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(L128-197) 을 함께 Read 했다.

## 변경 파일 식별

`git diff --name-only origin/main...HEAD` 로 확인한 변경 set (총 22개 코드/문서/plan/review 파일):

- `CHANGELOG.md`
- `codebase/backend/src/common/__test-utils__/{source-scan,temp-fixture}.{ts,spec.ts}` (신규 2 + 갱신 2)
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
- `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/{masked-reject-callers-guard,nullable-type-lie-cast-guard,nullable-type-lie-cast.spec,production-build-devdep-guard,production-build-devdep.spec,swagger-dto-contract-guard,swagger-dto-contract.spec}.ts`
- `plan/in-progress/{execution-engine-residual-gaps,spec-draft-nullable-notation-followups}.md`
- `review/code/2026/09/04/11_02_30/**`, `review/code/2026/09/04/11_44_16/**`, `review/consistency/2026/09/04/11_33_21/**` (이전 라운드 산출물/RESOLUTION)

## 매칭

- `codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/backend/src/nodes/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**`, `spec/**` — **매칭 0**. 즉 new-node / node-schema-change / new-ui-string / new-widget-chrome-string / integration-provider-change / new-userguide-section-dir / auth-session-flow-change / expression-language-change / new-warning-code / new-error-code / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field / spec-major-change / userguide-gui-flow-section 행은 전부 trigger 불성립.
- `backend-api-change` 행 (`trigger.globs: ["codebase/backend/src/**/*.controller.ts", "codebase/backend/src/**/dto/**"]`, semantic) — **매칭**: `background-run-response.dto.ts`, `create-assistant-session.dto.ts` 두 파일이 glob 에 해당.

## backend-api-change 매칭 상세 검토

두 DTO 파일 변경 내용은 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환(응답 8필드) 및 `llmConfigId?: string` → `string | null` 타입 확장(요청 1필드)이다. target (a) "controller·DTO 의 swagger jsdoc" 은 **diff 자체가 그 jsdoc(데코레이터) 수정**이므로 이미 같은 커밋에서 충족된다. CHANGELOG.md 도 같은 changeset 안에서 이 9곳을 동일 포맷("종전/지금" 표)으로 기록했다(직전 라운드 `documentation.md` WARNING #1 → `RESOLUTION.md` W2 → 커밋 `90db4b0f4` 로 이미 해소, 이번 changeset 의 `CHANGELOG.md` diff 에서 확인됨).

target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" 는 조건부다. 다음을 확인했다:

- `codebase/frontend/src/content/docs/02-nodes/logic.mdx` (Background 노드 절, L398-435) 가 `GET /api/executions/{executionId}/background-runs/{backgroundRunId}` 응답을 프로즈로 설명하지만 `status`/`startedAt`/`completedAt` 등 **필드 존재 여부만 언급**하고 OpenAPI `required`/`nullable` 세부(즉 "이 필드가 optional 인가")는 서술하지 않는다 — FieldTable 도 이 API 응답용으로는 없다.
- `create-assistant-session.dto.ts` 의 `llmConfigId` 는 워크플로우 어시스턴트 세션 생성 요청 DTO 필드다. `codebase/frontend/src/content/docs/02-nodes/ai.mdx` 의 `llmConfigId` 는 **다른 대상**(AI 노드 필드)이라 이 DTO 와 무관함을 확인했다.
- 두 변경 모두 CHANGELOG 상 "동작 변경은 없다"/"영향 없음"으로 명시돼 있고, 신설 가드(`swagger-dto-contract.spec.ts`)가 이 축을 앞으로 강제한다.

따라서 target (b) 는 이번 changeset 에 실질 staleness 를 남기지 않는다 — user-guide MDX 가 required/optional 세부를 서술하지 않으므로 갱신 대상 문구가 없다.

## 발견사항

- **[INFO]** `backend-api-change` 행이 두 DTO 파일에 glob 매칭되지만 실질 staleness 없음 — 확인 완료, 조치 불필요
  - 변경 파일: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`, `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
  - 매트릭스 항목: `backend-api-change` — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 누락된 동반 갱신: 없음 (a 는 diff 자체가 충족, b 는 대상 문구 부재로 비적용 — `02-nodes/logic.mdx` 는 required/optional 세부를 서술하지 않음)
  - 상세: PROJECT.md 의 "회색지대는 보수적으로 갱신 필요로 분류" 원칙에 따라 직접 관련 MDX(`02-nodes/logic.mdx`, `ai.mdx`)를 열어 대조했다. 두 문서 모두 이번 변경이 건드리는 required/nullable 세부를 서술하지 않아 실제로 stale 해질 문장이 없다. 순수 OpenAPI 메타데이터 정합화("동작 변경은 없다")이고 CHANGELOG 에도 그렇게 기록돼 있다.
  - 제안: 조치 불필요. 향후 이 DTO 필드가 실제 응답 shape 변경(필드 추가/제거)을 겸하게 되면 그때 `02-nodes/logic.mdx` 대조를 다시 수행할 것.

이 외 매칭된 trigger 없음. 나머지 변경 파일 — `codebase/backend/src/common/__test-utils__/*`(신규 tmpdir 픽스처/경로 정규화 공유 헬퍼), `codebase/backend/src/repo-guards/__tests__/*`(가드 로직·spec 리팩터), `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` — 전부 내부 테스트 인프라·저장소 가드·plan 추적·리뷰 산출물이며 유저 가이드 매트릭스의 어떤 trigger (신규 노드 / schema 변경 / TSX UI 문자열 / 통합·제공자 / 신규 섹션 디렉토리 / auth 흐름 / 표현식 언어 / 실행·디버깅 흐름 / warningCode·errorCode) 에도 해당하지 않는다. `codebase/frontend/**` 파일이 changeset 에 전혀 없으므로 i18n dict/`backend-labels.ts`/`locale.ts` parity 위반 가능성 자체가 없다.

## 요약

매트릭스 21행 중 glob 매칭 1건(`backend-api-change`, DTO 2파일) 뿐이며 실사 결과 실질 staleness 없음(target (a) 는 diff 자체가 충족, target (b) 는 대상 MDX 서술 부재로 비적용) — INFO 1건. CRITICAL/WARNING 0건. 나머지 20행은 trigger 불성립(frontend/nodes/expression-engine/auth/spec 파일이 changeset 에 전혀 없음).

## 위험도

NONE

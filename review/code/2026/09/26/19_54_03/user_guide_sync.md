# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 사전 확인

`.claude/config/doc-sync-matrix.json` (rows 22개, id 목록: new-node, node-schema-change, new-ui-string, new-widget-chrome-string, integration-provider-change, new-userguide-section-dir, backend-api-change, new-bullmq-queue, new-warning-code, new-error-code, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-session-flow-change, auth-config-type-enum-change, expression-language-change, run-debug-flow-change, env-runtime-change, spec-major-change, userguide-gui-flow-section, spec-defect-found) 를 Read 했고, PROJECT.md §변경 유형 → 갱신 위치 매핑 표를 보조로 확인했다.

변경 파일 전체 집합(`git diff --stat origin/main...HEAD -- codebase/ spec/`로 재확인):

- `codebase/backend/src/common/pipes/validation.pipe.ts` / `.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts` (신규)
- `codebase/backend/src/shared/testing/swagger-probe.ts` / `.spec.ts`
- `spec/conventions/swagger.md`
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` (산출물)

## 매칭 판정

각 trigger 를 대조했다.

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 매칭 없음. `nodes/` 하위 파일 변경 0건.
- **new-ui-string / new-widget-chrome-string** (`*.tsx`) — 매칭 없음. frontend·channel-web-chat 의 `.tsx` 변경 0건. 전 변경이 backend + spec + plan/review 문서뿐이다.
- **integration-provider-change** — 매칭 없음. provider 관련 코드 변경 없음.
- **new-userguide-section-dir** (`content/docs/*/`) — 매칭 없음.
- **backend-api-change** (`*.controller.ts`, `**/dto/**`) — 매칭 없음. `validation.pipe.ts` 는 파이프이지 컨트롤러·DTO 가 아니고, 신규 가드 2파일은 `repo-guards/__tests__/`(정적 검사 테스트) 소속이라 실제 API 엔드포인트 변경이 아니다. 이번 PR 은 런타임 동작을 바꾸지 않는 순수 리팩터(지역 배열 → export 상수)라는 점을 코드 리뷰 산출물(`api_contract.md`)도 diff 대조로 확인했다.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매칭 없음. `common/pipes/validation.pipe.ts` 는 전역 검증 파이프로 auth 모듈 소속이 아니고, 인증·권한·세션 로직을 건드리지 않는다.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **run-debug-flow-change** — 매칭 없음.
- **new-warning-code / new-error-code** — 매칭 없음. `warningRules`, `codebase/backend/src/nodes/core/error-codes.ts` 변경 0건.
- **env-runtime-change** — 매칭 없음. README.md 변경 없음.
- **spec-major-change** (`spec/conventions/**`) — **glob 상으로는 매칭**: `spec/conventions/swagger.md` §5-4 에 신규 체크리스트 항목 + Rationale 절이 추가됐다. 다만 이 행의 target 은 "frontmatter `code:`/`status:`/`pending_plans:` 정합" 이며, 이는 이번 changeset 안의 두 차례 consistency-check(`review/consistency/2026/09/26/{18_59_58,19_09_17}/`, 둘 다 BLOCK: NO)가 이미 검증한 영역이다. 또한 이 행은 "유저 가이드"(최종사용자용 `content/docs/**` MDX)가 아니라 개발자용 규약 문서를 대상으로 하므로, 본 reviewer 가 담당하는 "사용자에게 보이는 문서/문자열" 갭과는 별개다. 새로운 누락은 없다.
- **userguide-gui-flow-section** (`content/docs/02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) — 매칭 없음.
- 나머지 semantic 행(new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-config-type-enum-change, new-bullmq-queue, spec-defect-found) — 전부 매칭 없음.

## 발견사항

없음 — 매칭된 동반 갱신 대상(target) 중 누락된 것이 없다.

## 요약

이번 변경 집합(22개 trigger 행 전수 대조)은 백엔드 내부 정적 가드(`request-body-advertised`, OpenAPI 요청 본문 스키마 광고 여부를 reflection 으로 검사하는 저장소 테스트) 신설과 `CustomValidationPipe` 의 순수 리팩터(비검증 설계 타입 목록을 지역 배열에서 export 상수로 승격), 그리고 그 규칙을 성문화한 `spec/conventions/swagger.md` §5-4 갱신으로 구성된다. `codebase/backend/src/nodes/**`, frontend `.tsx`, `channel-web-chat`, `content/docs/**`, i18n dict, `backend-labels.ts`, `locale.ts`, auth 모듈, expression-engine, error-codes/warningRules 등 doc-sync-matrix 가 감시하는 22개 trigger 어느 것도 이번 changeset 의 실제 코드 변경과 겹치지 않는다 — 유일하게 glob 매칭되는 `spec-major-change`(spec/conventions/**) 행도 이미 같은 changeset 내 consistency-check 두 회차(BLOCK: NO)로 커버됐고, 그 target 은 "유저 가이드"가 아니라 개발자 규약 frontmatter 정합이라 본 리뷰의 관심사 밖이다. 결론적으로 유저 가이드 동반 갱신 관점에서 동반 갱신 누락은 없다 — 해당 없음.

## 위험도

NONE

## 관측된 이상 상태 (본 리뷰 범위 밖, 보고 의무)

리뷰 시작 시점 `git status --short` 에서 `codebase/backend/src/common/pipes/validation.pipe.ts` 가 **미커밋 상태로 수정되어 있음**을 관측했다(`UNVALIDATED_METATYPES` 배열에서 `Number` 원소 한 줄이 빠진 상태 — 본 changeset 의 커밋된 버전에는 `Number` 가 포함되어 있다). 이 저장소 트리는 병렬 fan-out 리뷰가 동시에 읽고 있어, 다른 reviewer 가 뮤테이션 검증 중인 임시 상태일 가능성이 높다. 본 리뷰(User Guide Sync)는 이 파일을 뮤테이션 대상으로 다루지 않았고, `git checkout`/`git restore`/`cp` 등 어떤 방식으로도 건드리거나 원복을 시도하지 않았다 — 규약상 저장소 파일에 아무것도 쓰지 않기로 했으므로 그대로 둔다. 통합 SUMMARY 작성자는 이 잔여 상태가 최종 커밋에 반영되지 않도록 확인이 필요하다.

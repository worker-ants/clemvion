STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]` 20건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read 함.

## 변경 파일 식별
`git diff --name-only a3c9b3578~1 c4356b367` (두 커밋 — `feat(security): nodeOutput 을 fail-open deny-list 에서 fail-closed allowlist 로 (EIA §R17)` + `test(backend): 리터럴 대조 캐너리`) 로 전체 changeset 확인, prompt 의 파일 15개와 1:1 일치:

- `codebase/backend/src/modules/external-interaction/interaction.service.ts` / `.spec.ts`
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` / `.spec.ts`
- `plan/in-progress/nodeoutput-allowlist.md`
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- `review/consistency/2026/08/23/18_30_40/*` (SUMMARY, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- `spec/5-system/14-external-interaction-api.md`

## trigger 매칭 결과
변경 내용은 EIA(External Interaction API) `getStatus` 의 `nodeOutput` 최상위 키를 deny-list(`llmCalls` 한 칸)에서 fail-closed allowlist(`NodeHandlerOutput` 공개 키 + wire 전용 키)로 전환하는 백엔드 보안 하드닝이다. 매트릭스 20개 행을 전수 대조:

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 불일치. 변경 파일 어디에도 `src/nodes/<cat>/<name>/` 신규 파일 없음 (`interaction.service.ts` 는 `src/modules/external-interaction/`, `strip-external-only-fields.ts` 는 `src/shared/utils/`).
- **new-ui-string / new-userguide-section-dir / integration-provider-change / auth-config-type-enum-change** — 불일치. changeset 에 `codebase/frontend/**` 파일이 **0개**.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 불일치. 변경 모듈은 `external-interaction` 이지 `auth` 가 아님. 인증·세션 미들웨어 변경 없음.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 불일치.
- **run-debug-flow-change** — 불일치. 실행 엔진 자체(재시도·디버그 로깅)가 아니라 REST 응답 조립 단계의 필드 필터링.
- **new-warning-code / new-error-code** — 불일치. `interaction.service.ts` 가 기존 `ErrorCode` 를 import 하지만 `error-codes.ts` 자체는 changeset 밖(변경 없음), warningRules 도 미변경.
- **backend-api-change** (`*.controller.ts` / `dto/**`) — 불일치. `interaction.controller.ts`, 응답 DTO(`execution-status-response.dto.ts` 등) 모두 changeset 밖. 변경은 `interaction.service.ts`(orchestration) + 공유 유틸(`strip-external-only-fields.ts`) 뿐이며, 기존에 이미 내려주던 필드 집합에서 엔진 내부 전용 키(`_retryState`/`_resumeState`/미지 키)를 **제거**하는 것이라 신규 공개 API surface 가 아니다 — 오히려 의도치 않게 새던 것을 막는 fix.
- **spec-major-change** (`spec/5-*/**`) — glob 매치(`spec/5-system/14-external-interaction-api.md`)하지만 이 항목의 target 은 frontmatter code:/status:/pending_plans: 정합이라 본 reviewer(유저 가이드/i18n) 영역 밖. 참고로 실제로 §R17 표가 "미구현·잔여" → "해소(2026-08-23), 단 getStatus 한 출구에 한정" 으로 정확히 갱신됐고 SSE/terminal result·error 는 의도적 미적용으로 명시돼 있어 spec 자체는 정합.

## i18n / docs 부가 확인
- `codebase/frontend/src/content/docs/**` 에서 `nodeOutput` 필드 상세(키 목록)를 서술하는 본문은 없음 — `triggers.mdx`/`web-chat-sdk.mdx` 는 EIA 를 frontmatter `spec:` 참조로만 걸어둘 뿐, `_retryState` 류 내부 필드를 사용자 안내에 노출한 적이 없다. 따라서 이번 fail-closed 전환으로 사용자 가이드가 stale 해지는 지점이 없음.
- `codebase/frontend/src/lib/i18n/backend-labels.ts` / `dict/{ko,en}/**` / `locale.ts` — changeset 에 해당 없음, 매핑 누락 대상 자체가 없음.

## 판정
매트릭스 20개 trigger 중 glob 로 1건(`spec-major-change`, 이미 정합 확인) 매치, 나머지 semantic trigger 19건은 전부 불일치. 본 리뷰어 영역(docs MDX·i18n dict·backend-labels·locale.ts)에 해당하는 trigger 는 0건 매치 — **동반 갱신 누락 없음**.

### 발견사항
없음.

### 요약
`nodeOutput` allowlist 보안 하드닝 changeset(15개 파일: backend 서비스/유틸 2쌍 + plan 2건 + consistency 리뷰 아티팩트 8건 + spec 1건)을 doc-sync-matrix 20개 행 전수 대조한 결과, `codebase/backend/src/nodes/**`(노드)·`codebase/frontend/**`(UI/문자열/섹션/통합)·`codebase/backend/src/modules/auth/**`(인증)·expression-engine·warning/error code·controller/dto 어느 trigger 에도 매칭되지 않았다(0/20 semantic·1/20 glob 은 spec 정합 확인 완료로 영역 밖). 유저 가이드 동반 갱신 관점에서 해당 없음.

### 위험도
NONE

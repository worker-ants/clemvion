# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT/보조로 Read 했다.

## 변경 파일 인벤토리 (prompt 기준)

이번 라운드(`00_39_57`, "머지했어" — 머지된 전체 changeset 재검토)의 실질 변경 파일:

- `CHANGELOG.md`
- `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.{ts,spec.ts}`
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.{ts,spec.ts}`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `plan/in-progress/{spec-draft-nullable-notation-followups.md, workflow-version-creator.md}`
- `review/code/2026/09/27/00_20_58/*` (직전 1R 리뷰 산출물 — 이번 changeset 에 실린 과거 리뷰 기록, 신규 코드 아님)
- `review/consistency/2026/09/26/23_55_27/*` (impl-prep consistency-check 산출물)

`codebase/frontend/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/channel-web-chat/**`, `spec/**`, `codebase/frontend/src/content/docs/**` 경로는 이번 changeset 에 전혀 없다 (plan `spec_impact: none` 도 이를 확인).

## trigger 매칭 검토

- **new-node / node-schema-change** — `codebase/backend/src/nodes/**` 무매치. 해당 없음.
- **new-ui-string / new-widget-chrome-string** — `*.tsx` 변경 없음. 해당 없음.
- **integration-provider-change** — provider 변경 없음. 해당 없음.
- **new-userguide-section-dir** — `content/docs/*/` 신규 디렉토리 없음. 해당 없음.
- **auth-session-flow-change** — `modules/auth/**` 무매치. 해당 없음.
- **expression-language-change / run-debug-flow-change** — 표현식 엔진·실행 엔진 변경 없음 (버전 이력 API 응답 스키마 정정일 뿐, 실행/디버깅 흐름과 무관). 해당 없음.
- **new-warning-code / new-error-code** — `error-codes.ts` / warningRules 무변경. 해당 없음.
- **spec-major-change / userguide-gui-flow-section** — `spec/**`, `content/docs/**` 무매치. 해당 없음.
- **backend-api-change** (`trigger.match=="semantic"`, glob `codebase/backend/src/**/dto/**`) — **매치**. `workflow-version-response.dto.ts` 가 이 glob 에 해당. 아래 상세 검토.

## backend-api-change 상세 검토 (유일한 매치)

매트릭스 middle column (`targets`): "(a) controller·DTO 의 swagger jsdoc" / "(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지".

**(a) swagger jsdoc** — 충족. `WorkflowVersionDto`/`WorkflowVersionListItemDto` 의 `creator`·`changeSummary` 필드에 JSDoc 주석과 근거 주석이 같은 diff 안에서 갱신됐다 (`workflow-version-response.dto.ts` 36~50행, 70~88행). `CHANGELOG.md` 에도 API 소비자용 Unreleased 항목이 같은 변경 set 에 추가됐다.

**(b) user-guide 페이지 영향 여부** — 이 변경은 **wire 상 응답 값이 바뀌는 변경이 아니다**. diff 주석("응답 자체는 그대로다 — 생성 클라이언트의 타입이 실제에 맞게 좁아진다")과 plan 의 실측(`created_by` NOT NULL FK, `ON DELETE` 없음)이 일치한다 — `creator`/`changeSummary` 는 이전부터 런타임에 항상 이 형태로 채워지고 있었고, 이번 변경은 OpenAPI 선언(optional+nullable → §5.4 기본형)만 실제에 맞게 좁힌 것이다. 사용자에게 보이는 UI 동작·데이터는 변경되지 않는다.

관련 user-guide 페이지 `codebase/frontend/src/content/docs/05-run-and-debug/version-history.mdx` 를 직접 열어 확인했다 — 이미 실제 동작과 일치하는 서술을 담고 있다:
- "각 항목에는 버전 번호, **작성자**, 생성 시각, 변경 요약(있을 때만)이 표시되고" — `creator` 는 항상 표시, `changeSummary` 는 조건부 표시라는 이번 스키마 정정의 의미와 이미 부합.
- "변경 요약이 비어 있어요" / "`Restored from vN` 형식으로 표시" — `changeSummary` nullable 서술과 일치.

즉 이번 PR 은 **문서가 이미 맞았던 실제 동작**에 대해 OpenAPI 선언만 뒤늦게 맞춘 것이라, user-guide 페이지 갱신 대상이 없다. 직전 라운드(`00_20_58`)의 user_guide_sync 리뷰도 동일 결론(NONE)이었고, 이번 라운드에서 추가된 커밋(`69bf1afca0` — e2e `changeSummary` null 값 wire 대조 보강, `ea3130bc0` — RESOLUTION 문서)은 테스트/문서(plan, RESOLUTION) 범주라 새 trigger 를 유발하지 않는다.

## 발견사항

없음. (유일한 매치 trigger `backend-api-change` 는 middle column (a)(b) 모두 이미 충족되어 있다.)

## 요약

매트릭스 20개 trigger 중 `backend-api-change` 1개만 매칭됐고(변경 set 이 `codebase/backend/src/**/dto/**` 를 건드림), 그 middle column 의 (a) swagger jsdoc 은 같은 diff 안에서 이미 갱신됐으며 (b) user-guide 페이지 영향은 이 변경이 OpenAPI 선언만 실제 런타임 동작에 맞춰 좁히는 것이라(응답 wire 형태·UI 동작 불변) 대상이 없다 — 관련 페이지(`05-run-and-debug/version-history.mdx`)도 이미 정확한 서술을 담고 있어 갱신할 것이 없음을 직접 확인했다. 그 외 노드·i18n·통합·섹션 디렉토리·인증·표현식·실행/디버깅·warning/error code trigger 는 변경 set 에 매칭 파일이 전혀 없다. 동반 갱신 누락 0건.

## 위험도

NONE

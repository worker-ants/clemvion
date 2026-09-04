# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger) 를 SSOT 로 적재했다. 이번 changeset (`CHANGELOG.md`, `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`, `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, 그리고 `review/code/**`·`review/consistency/**` 아래의 과거 리뷰 세션 산출물 다수) 를 매트릭스 20개 행에 전수 대조했다.

## 매칭 결과

- **`new-node` / `node-schema-change`** (trigger glob `codebase/backend/src/nodes/**`) — 변경된 백엔드 파일은 `codebase/backend/src/modules/alerts/**` 와 `codebase/backend/src/repo-guards/**` 뿐이며 `codebase/backend/src/nodes/**` 아래에는 아무 파일도 없다. **미매칭.**
- **`new-ui-string`** (trigger glob `codebase/frontend/src/**/*.tsx`, semantic) — 이번 changeset 에 `.tsx` 파일이 0건이다. **미매칭.**
- **`new-userguide-section-dir`** (trigger glob `codebase/frontend/src/content/docs/*/`) — `codebase/frontend/src/content/docs/` 아래 변경 없음. **미매칭.**
- **`integration-provider-change`**, **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**`), **`expression-language-change`** (`codebase/packages/expression-engine/**`), **`run-debug-flow-change`**, **`new-warning-code`**, **`new-error-code`** (`codebase/backend/src/nodes/core/error-codes.ts`) — 전부 해당 경로/의미 영역에 변경 없음. **미매칭.**
- **`backend-api-change`** (trigger glob `codebase/backend/src/**/dto/**`, semantic) — `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 가 이 glob 에 정확히 매칭된다(`AlertRuleDto.threshold: number → string`). **매칭됨 — 아래 상세.**

## `backend-api-change` 매칭에 대한 동반 갱신 점검

target 은 두 가지다: (1) controller·DTO 의 swagger jsdoc, (2) API 노출 변경이 사용자 안내에 영향을 준다면 관련 user-guide 페이지.

- **(1) swagger jsdoc**: 같은 diff 안에서 `threshold` 필드 JSDoc 이 "문자열로 내려간다 — 컬럼이 numeric(12,4)…" 로 갱신됐고 `@ApiProperty({ type: String, example: '10.0000' })` 로 데코레이터도 함께 바뀌었다 — **충족됨.**
- **(2) user-guide 페이지**: `codebase/frontend/src/content/docs/` 전체를 `grep -rl "threshold"` / `grep -rl "alerts"` 로 훑었다. `threshold` 를 언급하는 유저 가이드 페이지는 없고(`ai.en.mdx`·`knowledge-base.{mdx,en.mdx}` 는 무관한 문맥의 동음이의), `alerts` 를 언급하는 페이지는 `07-workspace-and-team/system-status.{mdx,en.mdx}` 뿐인데 이마저 "alerts-evaluator" BullMQ 큐 이름 언급일 뿐 `AlertRuleDto` 응답 스키마의 타입을 서술하지 않는다. 알림 규칙 생성/조회 UI 문자열(`codebase/frontend/src/lib/i18n/dict/{ko,en}/profile.ts` 의 `alerts.threshold*`)은 **쓰기 폼**(숫자 입력, `CreateAlertRuleDto`)에 대응하고 이번 diff 가 건드리지 않은 그대로다 — 응답 DTO 의 표시 타입 변경과는 무관.
  - 결론: 이 변경은 **wire 바이트가 불변**(엔티티·프런트 소비자 모두 이미 문자열로 취급)인 순수 Swagger 문서 정합화이며, 사용자에게 보이는 UI 동작·유저 가이드 서술 어디에도 대응하는 타입 노출이 없다. **동반 갱신 target (2) 는 이번 changeset 범위에서 적용 대상이 아니다** — 누락이 아니라 애초에 target 이 없다.

## Plan 문서 갱신에 대한 참고

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `spec/conventions/swagger.md` numeric 불변식 성문화, `spec/1-data-model.md:873` `threshold` `Float` 라벨 오기 항목이 신규로 등재됐다. 두 항목 모두 `spec/` (planner 트랙) 대상이며, 본 리뷰어가 관할하는 `codebase/frontend/src/content/docs` / i18n dict / `backend-labels.ts` 범위 밖이라 매트릭스 어느 행에도 걸리지 않는다.

## 발견사항

없음 — 매칭된 유일한 행(`backend-api-change`)의 두 target 중 하나는 diff 안에서 충족됐고, 나머지 하나는 이번 변경 성격(순수 문서 타입 정합화, 대응하는 유저 가이드 서술 부재)상 적용 대상이 아님을 코드/문서 grep 으로 확인했다.

## 요약

매트릭스 20개 trigger 행 중 glob/semantic 매칭이 성립한 것은 `backend-api-change` 1건(`alert-rule-response.dto.ts` 가 `codebase/backend/src/**/dto/**` 에 매칭)뿐이며, 그 target 2개는 각각 "충족" · "적용 대상 아님(대응 유저 가이드 서술 부재, grep 으로 확인)"으로 판정되어 동반 갱신 누락은 0건이다. 나머지 changeset(`CHANGELOG.md`, repo-guard 테스트, e2e 테스트, plan 문서, `review/**` 산출물)은 노드·i18n·docs·auth·표현식언어·실행/디버깅·warning/error code 어느 trigger 영역도 건드리지 않는다.

## 위험도

NONE

# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 점검 절차 요약

- `.claude/config/doc-sync-matrix.json` (rows 20개) 을 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인.
- 변경 file 목록: `git diff --name-only HEAD~6` + `git status --short` 로 보강. 실제 코드 변경은 `codebase/backend/src/modules/integrations/integrations.service.ts` (+ `.spec.ts`, e2e 신규) 뿐이고, 나머지는 `CHANGELOG.md` · `plan/**` · `review/**` 문서 산출물.
- `codebase/backend/src/modules/integrations/integrations.service.ts` 의 실제 diff(`git diff HEAD~6 -- ...`) 를 직접 열어 확인: `rotate()` 를 `assertCanRotate()` / `mergeAndValidateCredentials()` private 헬퍼로 리팩터링하고, 락 안에서 행을 재읽어 그 위에 재검증·재머지하도록 바꾼 동시성(lost-update) 버그 수정. 새 필드·새 에러코드·새 controller/DTO 엔드포인트는 없음.

## 매트릭스 매칭 결과

변경 파일을 20개 trigger row 에 전수 매칭한 결과:

| trigger | 매칭 여부 | 근거 |
|---|---|---|
| new-node / node-schema-change (`codebase/backend/src/nodes/**`) | 불일치 | 변경 파일은 `src/modules/integrations/`, `nodes/**` 아님 |
| new-ui-string / new-widget-chrome-string (`*.tsx`) | 불일치 | frontend/channel-web-chat 변경 0건 |
| integration-provider-change (semantic) | 불일치(gray, 아래 상세) | provider 고유 변경이 아니라 전 provider 공통 `rotate()` 내부 락 로직 수정. 외부 계약(성공 200 · 실패 시 기존 값 유지) 불변 |
| new-userguide-section-dir | 불일치 | 신규 docs 디렉토리 없음 |
| backend-api-change (`*.controller.ts`, `dto/**`) | 불일치 | controller/DTO 미변경 (service 내부 리팩터링) |
| new-bullmq-queue | 불일치 | 무관 |
| new-warning-code / new-error-code | 불일치 | 새 에러코드 미도입 — 오히려 `INTEGRATION_ROTATE_CONFLICT` (409) 신설안을 `plan/complete/spec-draft-rotate-conflict.md` 에서 명시적으로 **철회**(`/consistency-check --spec` BLOCK:YES 반증). 기존 코드(`INTEGRATION_ROTATE_UNSUPPORTED`, `INTEGRATION_INVALID_CREDENTIALS`, `FORBIDDEN`)는 그대로 재사용 |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | 불일치 | 무관 |
| auth-session-flow-change (`codebase/backend/src/modules/auth/**`) | 불일치(gray, 아래 상세) | glob 이 가리키는 모듈 경계(`modules/auth/**`) 밖. `assertCanRotate()` 는 기존 org-scope admin 규칙을 락 안에서 한 번 더 검사하도록 강화한 것뿐, 규칙 자체(권한 요구사항)는 불변 |
| auth-config-type-enum-change | 불일치 | AuthConfig type enum 무변경 |
| expression-language-change / run-debug-flow-change / env-runtime-change | 불일치 | 무관 |
| spec-major-change (`spec/2-*/**` 등) | 불일치 | `spec/` 변경 0건 (git diff 로 확인) |
| userguide-gui-flow-section | 불일치 | docs MDX 변경 0건 |
| spec-defect-found | 불일치 | 해당 없음 |

## 상세 검증 (gray-zone 두 항목)

1. **integration-provider-change 관련**: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` 를 직접 확인 — "비OAuth 연동의 `Rotate credentials` 는 새 값의 테스트가 통과해야 기존 값을 덮어써요. 실패하면 기존 자격 증명은 그대로 유지돼요." 라는 문장이 이미 있고, 이번 수정 후에도 이 사용자 관측 가능한 계약은 **그대로**다(CHANGELOG·plan 문서가 "외부 계약은 바뀌지 않는다, 성공은 그대로 200" 이라고 명시). 내부적으로 "무엇 위에 머지하는가"만 바뀌었으므로 이 문서는 stale 하지 않다.
2. **auth-session-flow-change 관련**: `assertCanRotate()` 는 `entity.scope === 'organization' && !isAdmin(userRole)` 규칙을 두 지점(락 전/락 후)에서 동일하게 적용하도록 통일한 것이며, 규칙 자체는 리팩터링 전부터 존재했다(기존 코드에도 동일 조건문이 있었음, diff 확인). `codebase/backend/src/modules/auth/**` 글롭에도 해당하지 않고, 사용자에게 노출되는 정책 문구(누가 rotate 할 수 있는가)도 변하지 않아 `07-workspace-and-team/` 갱신 대상이 아니다.

## 발견사항

없음 — 매트릭스의 20개 trigger 중 어느 것도 이번 변경 set 에 확정적으로 매칭되지 않았다. 코드 변경은 `codebase/backend/src/modules/integrations/integrations.service.ts` 의 동시성(lost-update) 버그 수정이며, 명시적으로 `spec_impact: none` 로 설계됐고(`plan/in-progress/rotate-lost-update.md` §C, `/consistency-check --spec` BLOCK:YES 로 새 계약 도입안을 반증 후 철회), 외부 API 계약·에러코드·신규 필드·신규 노드·신규 docs 섹션·i18n 문자열 중 어느 것도 추가/변경되지 않았다.

## 요약

매트릭스 trigger 20개 중 이번 변경 set(`codebase/backend/src/modules/integrations/integrations.service.ts` 동시성 수정 + 테스트 + CHANGELOG/plan 문서)에 확정 매칭된 trigger 는 0건, gray-zone 판단 대상 2건(provider 변경·auth 흐름 변경)도 실측 확인 결과 불일치로 판정했다. `spec/`·`codebase/frontend/`·`codebase/channel-web-chat/` 변경이 전혀 없고, 팀 스스로 `spec_impact: none` 을 실측 근거(consistency-check BLOCK:YES 반증 → 계약 신설 철회)와 함께 명시했으므로 유저 가이드 동반 갱신 관점에서 누락 없음. 해당 없음.

## 위험도

NONE

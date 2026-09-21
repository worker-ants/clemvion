# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 점검 절차

1. `.claude/config/doc-sync-matrix.json` (SSOT, rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(줄 155-225) 을 Read 해 매트릭스를 적재했다.
2. 변경 file 목록은 orchestrator 프롬프트의 5개 리뷰 대상(`파일 1~5`) + `git show --stat 707e89dec`(HEAD, 이 세션의 유일한 커밋)로 대조 확인했다. 실제 변경 set 은 13개 파일:
   - `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (수정)
   - `codebase/backend/src/modules/integrations/integrations.service.ts` (수정)
   - `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (신규)
   - `plan/in-progress/integration-dup-delete.md` (신규)
   - `plan/in-progress/spec-draft-nullable-notation-followups.md` (수정, 트래커 항목 추가)
   - `review/consistency/2026/09/21/10_27_27/*.md`·`*.json` 8개 (`--impl-prep` 자동 산출물)
3. 위 파일들을 매트릭스 `rows[].trigger` 21개 전항과 대조했다.

## 매칭 결과

- **glob 매칭**: `codebase/backend/src/nodes/**`(new-node/node-schema-change), `*.tsx`(new-ui-string), `channel-web-chat/**/*.tsx`, `system-status.constants.ts`, `error-codes.ts`, `content/docs/*/`(new-userguide-section-dir), `spec/{2,3,4,5}-*/**`·`spec/conventions/**`(spec-major-change) — **전부 미매칭**. 변경 파일이 `codebase/backend/src/modules/integrations/`·`codebase/backend/test/`·`plan/`·`review/consistency/` 뿐이라 이 어떤 glob 도 건드리지 않는다.
- **semantic 매칭 검토**:
  - `integration-provider-change`(통합 신규/제공자 변경) — 이 변경은 provider 종류·설정 스키마·인증 방식을 바꾸지 않는다. `IntegrationsService.remove()` 의 동시 DELETE 경합만 고치는 내부 구현 변경이라 provider 표면과 무관. **미매칭**.
  - `backend-api-change`(백엔드 API 추가·변경, trigger glob: `*.controller.ts`/`dto/**`) — `integrations.controller.ts` 는 이번 diff 에 없다(직접 Read 로 확인: `@Delete(':id')` 핸들러는 그대로이고 `@ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })` 가 **이미 사전에 선언돼 있다**). 즉 이 커밋은 새 응답 코드를 노출하지 않는다 — 동시 삭제의 진 쪽이 기존에 문서화된 404 를 (버그 없이) 정확히 받게 됐을 뿐, swagger 계약 자체는 변경 전과 동일하다. **미매칭** (controller/DTO 미변경 + 계약 자체가 이미 404 를 선언).
  - `new-error-code`(신규 errorCode) — `RESOURCE_NOT_FOUND` 는 `integrations.service.ts` 안에 이미 7곳(line 604·733·767·807·1200·1233·1499, 이 커밋 이전부터)에서 쓰이던 기존 코드이고, 형제 PR #1369~#1371(workflows/triggers/schedules) 도 같은 코드를 재사용했다. `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 자체도 변경되지 않았다(diff 에 해당 파일 없음). **신규 코드 아님 — 미매칭**.
  - `new-warning-code` — `warningRules` 변경 없음. **미매칭**.
  - `auth-session-flow-change`(인증·권한·세션 흐름) — `codebase/backend/src/modules/auth/**` 미변경, 세션/권한 미들웨어와 무관한 리소스 CRUD 동시성 수정. **미매칭**.
  - `expression-language-change`, `run-debug-flow-change`, `env-runtime-change` — 전혀 무관한 영역. **미매칭**.
  - `spec-defect-found`(spec 자체 결함 발견) — 이 항목만 부분적으로 관련: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 새로 등재된 항목이 "`4-integration.md` §9 에 「동시 삭제 → 두 번째 404」 서술이 없다" 는 **spec 문서**(`spec/4-integration.md`) 갱신 필요성을 이미 스스로 인지하고 planner 트래커에 정확히 등재했다(줄 4813-4820, `--impl-prep review/consistency/2026/09/21/10_27_27` W3 을 근거로 인용). 이것은 본 리뷰어의 스코프(`codebase/frontend/src/content/docs/**` 유저 가이드 MDX·i18n dict·backend-labels)가 아니라 **spec/ 문서**이므로 이 매트릭스의 대상이 아니다 — 이미 올바른 절차(developer 가 spec 을 직접 못 고치니 planner 위임 트래커 등재)를 밟았다.

## 발견사항

없음. 매칭된 trigger 가 하나도 없어 동반 갱신 누락을 평가할 대상 자체가 없다.

## 요약

매트릭스 21개 행 전부를 이번 변경 set(13개 파일: backend service/spec 2·신규 e2e 1·plan md 2·consistency 산출물 8)과 대조했으나 매칭되는 trigger 가 없다. 이 변경은 `IntegrationsService.remove()` 의 동시 DELETE 경합(이중 감사 로그) 을 원자적 `delete().affected` 판정으로 고치는 순수 백엔드 동시성 버그 수정이며, 새 노드·새 UI 문자열·새 provider·새 문서 섹션·인증 흐름·표현식 언어·실행/디버깅 흐름·신규 warning/error 코드 어느 것도 도입하지 않는다. 재사용한 `RESOURCE_NOT_FOUND` 코드와 그 404 응답은 컨트롤러 swagger 에 이미 선언돼 있어 API 계약도 바뀌지 않았다. 관련 spec 문서(`spec/4-integration.md` §9) 갱신 필요성은 developer 가 이미 인지해 planner 트래커에 정확히 등재했으며, 이는 본 리뷰어 스코프(frontend user-guide) 밖이다. "해당 없음" 판정.

## 위험도

NONE

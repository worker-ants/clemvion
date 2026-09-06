# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §128-198 (표 + "자주 누락되는 항목") 을 SoT 로 적재했다.

## 변경 파일 식별
`git diff --name-only HEAD~1 HEAD` 로 확인한 changeset (25개, prompt 목록과 일치):

- `CHANGELOG.md`
- `codebase/backend/src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/responses/*.dto.ts` (DTO 필드 선언 추가)
- `codebase/backend/src/modules/schedules/schedules.controller.ts` (응답 경계 narrowing)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeChatChannelForResponse` → `sanitizeForResponse`, 엔티티 컬럼 strip 추가)
- `codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}` (검증자 자체: `allowMissing` 옵션, `contractForDto` 메모이즈)
- `codebase/backend/test/*.e2e-spec.ts` × 14 (기존 e2e 에 `assertMatchesContract` 배선 추가)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 갱신)

**frontend 쪽 파일은 changeset 에 0건이다** — `codebase/frontend/**` 전체가 diff 밖.

## trigger 매칭 판단

매트릭스에서 이 changeset 이 형태상 닿는 유일한 행은 `backend-api-change` (컨트롤러/DTO 변경, semantic match) 다. 나머지 행은 명백히 불일치:

- **new-node / node-schema-change**: glob 대상이 `codebase/backend/src/nodes/**` 인데, 변경된 DTO 들은 전부 `src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/**` 아래 — nodes 디렉터리 밖. 불일치.
- **auth-session-flow-change**: glob 대상 `codebase/backend/src/modules/auth/**`. 변경 파일 중 `test/session-revocation.e2e-spec.ts` 가 `src/modules/auth/dto/responses/{session,login-history}.dto` 를 **import** 하지만, 그 소스 파일 자체는 changeset 에 없다(기존 DTO 를 그대로 참조해 계약 단언을 추가했을 뿐). 실제 auth 흐름 코드 변경 없음 — 불일치.
- **new-warning-code / new-error-code**: 신규 warningRule·ErrorCode 없음.
- **integration-provider-change**: `IntegrationDto` 필드 추가는 provider 범용 관측 필드(appUrl/mallId/lastRotatedAt/lastUsedAt/tokenExpiresAt/consecutiveNetworkFailures)이지 신규/변경 provider 가 아님 — 불일치.
- 그 외 (new-ui-string, new-userguide-section-dir, expression-language-change, run-debug-flow-change, spec-major-change 등): 해당 파일 없음.

## `backend-api-change` 판정 — 실질적으로 매칭되지 않음

이 행의 두 target 은 (a) swagger jsdoc, (b) "API 노출 변경이 사용자 안내에 영향을 미치면" 관련 user-guide 페이지다.

- **(a) swagger jsdoc**: 이미 diff 안에서 충족됨 — 5개 DTO 의 신규 필드 전부 `@ApiProperty`/`@ApiPropertyOptional` + JSDoc 주석을 동반한다(예: `createdBy`, `lastTriggeredAt`, `appUrl`, `rerankMode` 등). 별도 지적 없음.
- **(b) user-guide 페이지**: 판단 기준은 "API 노출 변경"이 실재하는가다. CHANGELOG·코드 주석이 명시하듯 이 PR 의 성격은 **"이미 응답에 실려 나가고 있던" 필드의 선언을 실제에 맞추는 것**(wire 변경 없음)과, 반대로 **트리거의 두 비밀 컬럼(`notificationSecretV2`, `chatChannelTokenV2`)을 응답에서 제거하는 보안 수정**이다. 두 경우 모두 **최종 사용자가 관찰 가능한 API 응답 shape 은 (시크릿 제거를 빼면) 바뀌지 않는다** — 프런트엔드가 그 필드들을 이미 소비하고 있었다는 것 자체가 그 증거다.

  직접 확인:
  - `chatChannelHealth`/`notificationHealth`/`chatChannelLastError` 등은 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `.en.mdx` 에 이미 문서화돼 있고, `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 에도 이미 키가 있다. `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx` 가 이미 그 필드들을 렌더링 중이다.
  - `rerankMode`/`rerankCandidateK` 등은 `codebase/frontend/src/lib/i18n/dict/{ko,en}/knowledgeBases.ts` 에 이미 키가 있다.
  - `IntegrationDto` 의 `lastRotatedAt`/`lastUsedAt`/`tokenExpiresAt`/`appUrl` 은 이미 `integrations/[id]/page.tsx`·`cafe24-app-url-card.tsx`·`status-badge.tsx` 등에서 소비 중이다.
  - `AlertRuleDto.createdBy`/`lastTriggeredAt` 은 이미 `triggers/page.tsx`(알림 규칙 UI)에서 소비 중이다.

  즉 두 시크릿 필드를 제거한 것을 제외하면 이 PR 은 "선언 vs 실제" 의 **선언 쪽**만 뒤늦게 따라잡았을 뿐, 사용자에게 보이는 어떤 화면·문구·동작도 바뀌지 않았다. 매트릭스가 요구하는 "user-guide 페이지 갱신"은 이미 과거 시점(그 기능이 실제로 shipping 됐을 때)에 끝나 있었고, 이번 changeset 은 그 갱신을 다시 요구할 사용자 가시 변화를 만들지 않는다.

  제거된 두 시크릿 필드(`notificationSecretV2`, `chatChannelTokenV2`)에 대해서도 문서·dict 에 해당 키가 등장하는지 확인했으나(당연히) 없다 — 원래 노출되면 안 됐던 내부/시크릿 값이라 문서화 대상이었던 적이 없다. 따라서 제거에 따른 문서 갱신도 불필요.

## 결론

이 changeset 은 응답-계약 검증자(§5.4) 확장 + 그 검증자가 찾아낸 DTO 선언 지연(24필드) 정정 + 시크릿 컬럼 유출 보안 수정으로 구성되며, **frontend 파일이 changeset 에 전혀 포함되지 않았고**, 매트릭스 어떤 trigger 도 실질적으로 동반 갱신을 요구하지 않는다 (유일한 형태 일치 후보였던 `backend-api-change` 의 user-guide target 도 위 근거로 불필요). "해당 없음" 으로 판정한다.

## 발견사항

없음.

## 요약

매트릭스 trigger 21개 중 형태상 검토한 후보는 `backend-api-change`(DTO/controller glob) 1개뿐이었고, 실측 결과(FE 가 이미 해당 필드를 소비 중 + 문서/dict 에 이미 등재됨)로 볼 때 이번 changeset 은 사용자 가시 API 노출 변경이 아니라 DTO 선언을 실제 응답에 맞추는 정정 + 시크릿 컬럼 유출 수정이다. frontend 파일이 diff 에 전혀 없고 누락된 동반 갱신은 0건이다. 영역 무관("해당 없음") 판정.

## 위험도

NONE

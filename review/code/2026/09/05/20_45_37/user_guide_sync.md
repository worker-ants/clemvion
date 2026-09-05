# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SoT 로 Read 했다. PROJECT.md 의 §변경 유형 → 갱신 위치 매핑 본문은 보조로 참고했다(표 자체는 JSON 과 1:1로 묶여 있음).

## 변경 파일 식별
`git diff --name-only origin/main...HEAD` 로 74개 파일 확인 — prompt 목록(파일 1~74)과 정확히 일치. **`codebase/frontend/**` 매치 0건** (grep 실측).

changeset 구성:
- `CHANGELOG.md` (1)
- `codebase/backend/src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/responses/*.dto.ts` — 5개 응답 DTO 에 24필드(§5.4 스윕이 검출한 선언-실제 drift) 선언 추가 + `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 신설
- `codebase/backend/src/modules/schedules/{schedules.controller.ts,schedules.service.ts}` — 응답 경계 trigger narrowing(보안 수정, secret 컬럼 유출 차단)
- `codebase/backend/src/modules/triggers/{triggers.service.ts(생략됨),triggers.service.spec.ts}` — `sanitizeChatChannelForResponse` → `sanitizeForResponse` 개명 + 엔티티 컬럼 스트립 확대
- `codebase/backend/src/repo-guards/__tests__/**` — §5.4 정적 가드 3번째 축(`findOptionalNullableResponseFields`) + fixture 신설
- `codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}` — 검증자 자체(`allowMissing` 옵션, `contractForDto` 메모이제이션)
- `codebase/backend/test/*.e2e-spec.ts` × 14 — 기존 e2e 에 `assertMatchesContract` 배선 추가
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커 갱신
- `review/code/2026/09/05/{18_23_02,19_08_18}/**`, `review/consistency/2026/09/05/{18_23_03,19_08_19}/**` — 이전 라운드들의 리뷰 산출물 자체 (RESOLUTION/SUMMARY/개별 리뷰어 md/meta.json 등, 43개 파일)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, `spec/2-*|3-*|4-*|5-*|conventions/**` 전부 diff 밖.

## trigger 매칭 판단

매트릭스 21행 중 형태상 검토 대상이 되는 후보만 아래에 적는다(나머지는 glob/semantic 자체가 명백히 불일치):

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`): 변경된 DTO 는 전부 `src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/**` 아래 — `nodes/` 디렉터리 밖. 불일치.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`, semantic): `session-revocation.e2e-spec.ts`/`webhook-trigger.e2e-spec.ts` 가 `src/modules/auth/dto/responses/{session,login-history}.dto.ts` 및 `src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` 를 **import** 하지만, 그 소스 파일 자체는 changeset 에 없다(기존 DTO 를 그대로 참조해 `assertMatchesContract` 단언만 추가). `auth-configs` 모듈은 `auth` 모듈과 별개 디렉터리라 glob 자체도 안 닿는다. 실제 인증·권한·세션 흐름 코드 변경 없음 — 불일치.
- **integration-provider-change** (semantic): `IntegrationDto` 필드 추가(`appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/`consecutiveNetworkFailures`)는 provider 범용 관측 필드이지 신규/변경 provider 도입이 아님 — 불일치.
- **backend-api-change** (`*.controller.ts` + `dto/**`, semantic) — **유일하게 형태가 닿는 행**. 아래 별도 판정.
- **run-debug-flow-change**: `schedules.service.ts`(트리거 생성 시 `saved.trigger` 대입 조건 이동)는 실행·디버깅 흐름이 아니라 응답 직렬화 시점의 trigger 참조 배선 문제 — 불일치.
- **new-warning-code / new-error-code / spec-major-change / new-ui-string / new-userguide-section-dir / expression-language-change** 등: 해당 파일·패턴 없음.

## `backend-api-change` 판정 — 실질 매칭 안 됨

이 행의 target 은 (a) controller·DTO 의 swagger jsdoc, (b) "API 노출 변경이 사용자 안내에 영향을 미치면" 관련 user-guide 페이지다.

- **(a)**: diff 안에서 이미 충족 — 신규 필드 전부 `@ApiProperty`/`@ApiPropertyOptional` + JSDoc 동반(`documentation.md`/`maintainability.md` 리뷰가 enum 누락 등 세부는 별도로 WARNING 처리·조치완료 확인).
- **(b)**: 판단 기준은 "사용자에게 관찰 가능한 API 응답 shape 변경"의 실재 여부다. CHANGELOG·DTO 주석·`api_contract.md`(18_23_02 라운드)가 일관되게 명시하듯, 이 changeset 의 성격은 두 갈래뿐이다.
  1. **"이미 응답에 실려 나가고 있던" 필드의 선언을 실제에 맞춤** (wire 불변). `chatChannelHealth`/`notificationHealth`/`chatChannelLastError` 등은 이미 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`(+`.en.mdx`) 와 `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 에 등재되어 있고 `triggers/page.tsx` 가 이미 렌더링 중 — 이전 라운드(`review/code/.../18_23_02/user_guide_sync.md`)가 직접 파일을 열어 확인한 실측이다. `rerankMode`/`rerankCandidateK` 도 `dict/{ko,en}/knowledgeBases.ts` 에 이미 키가 있음. `IntegrationDto`/`AlertRuleDto` 신규 필드도 동일 패턴(이미 소비 중인 화면에 이미 반영됨).
  2. **트리거 회전 secret 두 컬럼(`notificationSecretV2`/`chatChannelTokenV2`) 응답 제거** — 보안 수정. 원래 노출되면 안 됐던 내부 값이라 문서·dict 에 등장한 적이 없고, 제거에 따른 문서 갱신 대상도 없음.
  3. **`GET/POST/PATCH /api/schedules` 의 `trigger` 필드가 엔티티 전체 → 4필드 참조로 좁혀짐** — 이 역시 FE 소비처가 실측(`grep 'schedule.trigger' codebase/frontend`)으로 정확히 그 4필드(`id`/`name`/`workflowId`/`workflow.name`)뿐임이 확인된 상태라, 사용자가 화면에서 관찰하는 내용은 그대로다. 스케줄 관련 user-guide 문서(`spec/2-navigation/3-schedule.md` 는 spec 이지 `codebase/frontend/src/content/docs/` 아래 유저 가이드가 아니며, 해당 트리거 참조 필드는 애초에 문서화된 적이 없다)에 갱신할 대상이 없다.

즉 **사용자가 관찰 가능한 신규 기능·화면·문구는 이번 changeset 에 없다** — DTO 선언을 뒤늦게 실제에 맞춘 정정 + 이미 새고 있던 시크릿을 막은 보안 수정이다. 이 판정은 이미 같은 changeset 의 이전 라운드(`review/code/2026/09/05/18_23_02/user_guide_sync.md`)가 동일한 파일들(당시 diff 는 이번 라운드의 부분집합)을 대상으로 직접 파일을 열어 확인한 결과와 일치하며, 그 이후 라운드(19_08_18, 19_08_19)가 추가한 변경분(e2e 배선 확대, `allowMissing`, `contractForDto` 메모이제이션, 정적 가드 3번째 축, plan 트래커 갱신, review 산출물 자체)도 전부 `codebase/backend/**` + `plan/**` + `review/**` 안에서만 일어나 이 판정을 뒤집지 않는다.

## 발견사항

없음.

## 요약

매트릭스 21개 trigger 행 중 형태상 후보였던 것은 `backend-api-change`(controller/dto glob, semantic) 1개뿐이었고, 실측(FE 가 신규 선언 필드를 이미 소비 중 + docs/dict 에 이미 등재됨, 제거된 두 secret 필드는 애초 문서화 대상 아님)으로 사용자 가시 API 노출 변경이 아님을 확인했다. `codebase/frontend/**`가 전체 74개 변경 파일 중 0건이라 i18n parity·docs MDX·backend-labels·locale.ts 등 나머지 모든 trigger 도 형태 자체가 성립하지 않는다. 누락된 동반 갱신은 0건. 영역 무관("해당 없음") 판정.

## 위험도

NONE

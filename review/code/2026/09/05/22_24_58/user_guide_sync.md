# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SoT 로 Read 했다. `PROJECT.md` §변경
유형 → 갱신 위치 매핑(128~198행)을 보조로 Read 해 nuance(자주 누락 패턴 목록)까지 확인했다.

## 변경 파일 식별

`git diff --stat origin/main...HEAD` 로 120개 파일 확인 — prompt 목록(파일 1~120)과 정확히
일치. **`codebase/frontend/**` / `codebase/channel-web-chat/**` 매치 0건**(`git diff --name-only
origin/main...HEAD | grep -c "^codebase/frontend"` = 0, 실측).

changeset 구성:

- `CHANGELOG.md` — 트리거 회전 secret 유출 + 23필드 선언 catch-up 을 상세 기록 (문서 자산 아님, 매트릭스 target 밖)
- `codebase/backend/src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/responses/*.dto.ts` — 5개 응답 DTO 에 필드 선언 추가(§5.4 스윕이 검출한 선언-실제 drift) + `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto` 신설
- `codebase/backend/src/modules/schedules/{schedules.controller.ts,schedules.service.ts,schedules.controller.spec.ts}` — 응답 경계 trigger narrowing(보안 수정, secret 컬럼 유출 차단) + 양성 단언 보강
- `codebase/backend/src/modules/triggers/{triggers.service.ts(생략됨),triggers.service.spec.ts}` — `sanitizeChatChannelForResponse` → `sanitizeForResponse` 개명 + 엔티티 컬럼/`notification.signing` 스트립 확대
- `codebase/backend/src/repo-guards/__tests__/**` — §5.4 정적 가드 3번째 축 + fixture
- `codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}` — 검증자 자체(`allowMissing` 옵션, `contractForDto` 메모이제이션)
- `codebase/backend/test/*.e2e-spec.ts` × 14 — 기존 e2e 에 `assertMatchesContract` 배선 추가/확장(`findAll`·`PATCH` 경로 포함)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커 갱신
- `review/code/2026/09/05/{18_23_02,19_08_18,20_45_37,21_40_37}/**`, `review/consistency/2026/09/05/{18_23_03,19_08_19,20_45_39,21_40_38}/**` — 이전 라운드들의 리뷰 산출물 자체(RESOLUTION/SUMMARY/개별 리뷰어 md/meta.json 등, 84개 파일)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`,
`codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`,
`spec/{2,3,4,5}-*/**|conventions/**` 전부 diff 밖.

## trigger 매칭 판단

형태상 후보가 되는 행만 적는다(나머지는 glob/semantic 자체가 불일치):

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 DTO 는 전부
  `src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/**` 아래이고
  `nodes/` 디렉터리 밖. 불일치.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`, semantic) —
  `session-revocation.e2e-spec.ts`/`webhook-trigger.e2e-spec.ts` 가 `src/modules/auth/dto/...`,
  `src/modules/auth-configs/dto/...` 를 **import** 하지만 그 소스 파일 자체는 changeset 에
  없다(기존 DTO 를 그대로 참조해 `assertMatchesContract` 단언만 추가). `auth-configs` 는
  `auth` 와 별개 모듈이라 glob 도 안 닿는다. 실제 인증·세션 흐름 코드 변경 없음 — 불일치.
- **integration-provider-change** (semantic) — `IntegrationDto` 필드 추가(`appUrl`/`mallId`/
  `tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/`consecutiveNetworkFailures`)는 provider 범용
  관측 필드이지 신규/변경 provider 도입이 아님. 불일치.
- **backend-api-change** (`*.controller.ts` + `dto/**`, semantic) — **유일하게 형태가 닿는
  행**. 아래 별도 판정.
- **run-debug-flow-change** — `schedules.service.ts`(`saved.trigger` 대입 위치 이동)는 실행·
  디버깅 흐름이 아니라 응답 직렬화 시점 배선 문제. 불일치.
- **new-warning-code / new-error-code / new-cross-cutting-enum / new-backend-ui-zod-value /
  new-handler-output-field / spec-major-change / new-ui-string / new-userguide-section-dir /
  expression-language-change / new-bullmq-queue / auth-config-type-enum-change** — 해당
  파일·패턴 changeset 안에 없음.

## `backend-api-change` 판정 — 실질 매칭 안 됨 (실측 완료)

target: (a) controller·DTO 의 swagger jsdoc, (b) API 노출 변경이 사용자 안내에 영향이면 관련
user-guide 페이지.

- **(a)**: diff 안에서 이미 충족 — 신규 필드 전부 `@ApiProperty`/`@ApiPropertyOptional` +
  JSDoc 동반.
- **(b)**: "사용자가 관찰 가능한 API 응답 shape 변경"이 실재하는지 frontend 코드를 직접 열어
  확인했다.
  - `chatChannelHealth`/`notificationHealth`/`chatChannelLastError` 등 — 이미
    `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx` (line 78, 229, 689-699),
    `codebase/frontend/src/components/triggers/cards/{chat-channel-card,external-interaction-card}.tsx`,
    `codebase/frontend/src/lib/api/triggers.ts` 가 소비 중이고, `02-nodes/triggers.mdx`
    (+`.en.mdx`)·`06-integrations-and-config/telegram.mdx`(+`.en.mdx`) 에 이미 등재돼 있다
    (실측: `grep chatChannelHealth\|notificationHealth codebase/frontend/src`).
  - `TriggerDto.workflow`(신규 `TriggerWorkflowRefDto`) — `triggers/page.tsx:221-222`
    (`t.workflowId ?? t.workflow?.id`, `t.workflow?.name`)가 이미 그 형태로 읽는다.
  - `ScheduleDto.trigger`(신규 `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto`) —
    `schedules/page.tsx:507-514` (`s.trigger?.name`, `s.trigger?.id`, `s.trigger?.workflowId`,
    `s.trigger?.workflow?.name`)가 이미 그 형태로 읽는다. CHANGELOG 가 명시하는 "소비처는
    네 필드뿐"과 실측이 일치.
  - `rerankMode`/`rerankCandidateK`/`rerankScoreThreshold`/`rerankConfigId`/
    `rerankLlmConfigId`/`embeddingModelConfigId`/`documentCount` — 전부
    `knowledge-bases/[id]/page.tsx` 가 이미 읽고 쓰는 필드.
  - `AlertRuleDto.lastTriggeredAt` — `lib/api/alerts.ts` 의 `AlertRule` 인터페이스에 이미
    존재(다만 `profile/alerts/page.tsx` 는 현재 렌더링하지 않음 — 표시 안 함은 이 PR 과 무관한
    기존 상태).
  - `AlertRuleDto.createdBy`, `IntegrationDto.consecutiveNetworkFailures` — frontend 참조
    0곳(실측 grep). CHANGELOG 도 `consecutiveNetworkFailures` 를 "프런트엔드 참조가
    0곳"이라 명시. 사용자에게 새로 노출되는 화면·문구가 없다.
  - 두 secret 컬럼(`notificationSecretV2`/`chatChannelTokenV2`) **제거** — 원래 노출되면 안
    됐던 내부 값이라 문서·dict 에 등장한 적이 없고, 제거에 따른 문서 갱신 대상도 없다.

즉 이번 changeset 이 사용자에게 노출하는 API 응답 shape 는 **DTO 선언 이전부터 이미 그
모양이었다** — 컨트롤러가 엔티티를 그대로 반환해 왔고, frontend 는 그 실제 wire 형태를 이미
소비/렌더링하고 있었으며, 해당 문서(`02-nodes/triggers.mdx`, `06-integrations-and-config/
telegram.mdx`, dict 키)도 이미 그 상태를 반영하고 있었다. 이 PR 은 (1) swagger 선언을 실제에
맞추는 정정 + (2) 새고 있던 두 secret 컬럼을 응답에서 제거하는 보안 수정이다. 신규 사용자
가시 기능·화면·문구가 없으므로 (b) 는 적용 대상이 아니다.

이 판정은 같은 changeset 의 이전 라운드(`review/code/2026/09/05/{18_23_02,20_45_37}/
user_guide_sync.md`)가 동일 결론(NONE)에 도달한 것과 일치한다. 이번 라운드에서 새로 추가된
코드(`ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto`, `findAll`/`PATCH` 경로로의 계약
대조 확장, `allowMissing` 옵션, `contractForDto` 메모이제이션, 정적 가드 3번째 축)도 전부
`codebase/backend/**` + `plan/**` + `review/**` 안에서만 일어났고, 위에서 직접 확인한 대로
frontend 소비 실측과 어긋나지 않는다.

## 발견사항

없음.

## 요약

매트릭스 21개 trigger 행 중 형태상 후보였던 것은 `backend-api-change`(controller/dto glob,
semantic) 1개뿐이었고, frontend 소스를 직접 열어 실측한 결과(신규 선언 필드 전부 기존
frontend 코드·docs·dict 에 이미 반영돼 있거나 frontend 참조 0곳, 제거된 두 secret 필드는
애초 문서화 대상 아님) 사용자 가시 API 노출 변경이 아님을 확인했다.
`codebase/frontend/**`/`codebase/channel-web-chat/**` 가 120개 변경 파일 중 0건이라 i18n
parity·docs MDX·backend-labels·locale.ts 등 나머지 trigger 도 형태 자체가 성립하지 않는다.
누락된 동반 갱신은 0건. 영역 무관("해당 없음") 판정.

## 위험도

NONE

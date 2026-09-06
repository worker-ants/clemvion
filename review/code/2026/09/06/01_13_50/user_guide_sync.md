# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 21건) Read 완료
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(L134-156) + "자주 누락되는 항목"(L169-186) Read 완료

## 변경 파일 식별
`git diff --stat origin/main...HEAD -- codebase/` 로 실측 (prompt 의 truncated diff 를 `git diff` 로 보강). 이번 changeset 의 `codebase/` 변경은 **32개 파일 전부 `codebase/backend/`** 이며 `codebase/frontend/`·`codebase/channel-web-chat/`·`codebase/packages/expression-engine/` 변경은 **0건**이다:

- `src/modules/{alerts,integrations,knowledge-base,schedules,triggers}/dto/responses/*.dto.ts` — 응답 DTO 필드 선언 추가
- `src/modules/schedules/{schedules.controller.ts,schedules.service.ts}`, `src/modules/triggers/triggers.service.ts` — 응답 경계 정화/좁히기 로직
- `src/repo-guards/__tests__/*`, `src/shared/testing/*` — 신규 계약 검증 유틸/가드
- `test/*.e2e-spec.ts` — 기존 e2e 에 `assertMatchesContract` 단언 추가

## 매칭된 trigger

### `backend-api-change` (백엔드 API 추가·변경)
- Trigger: `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**` (semantic)
- Targets: (a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지
- 매칭 파일: `schedules.controller.ts`, `{alert-rule,integration,knowledge-base,schedule,trigger}-response.dto.ts` 등

**판정 — 동반 갱신 누락 아님 (그레이존 → 해당 없음으로 수렴)**

이 PR 은 CHANGELOG.md 서두("함께 — 선언이 현실에 뒤처져 있던 23필드를 선언했다", "**wire 변경 없음**")와 각 DTO 파일의 신규 필드 주석("이미 응답에 실려 나가고 있었다 — 컨트롤러가 엔티티를 그대로 반환하기 때문")이 명시하듯, **§5.4 응답-계약 스윕**이 이미 wire 로 나가고 있던(그리고 프런트엔드가 이미 소비하고 있던) 필드를 Swagger DTO 선언에 뒤늦게 반영한 것이다. 즉:

- (a) swagger jsdoc — 신규 필드마다 JSDoc + `@ApiProperty`/`@ApiPropertyOptional` 이 같은 diff 안에 이미 포함됨 (예: `alert-rule-response.dto.ts` L64-69, `integration-response.dto.ts` L133-167, `knowledge-base-response.dto.ts` L101-130). 충족.
- (b) 사용자 안내 영향 — 실측으로 세 개 대표 필드군을 프런트엔드에서 확인:
  - `IntegrationDto.appUrl` 계열 → 이미 소비 중이던 필드(주석이 명시), `consecutiveNetworkFailures` 는 "**프런트엔드 참조 0곳**"이라고 스스로 명시.
  - `KnowledgeBaseDto.rerankMode/rerankCandidateK/...` → `grep` 결과 `codebase/frontend/src/components/knowledge-base/kb-form-body.tsx`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/knowledgeBases.ts` 에 이미 존재 (기존 기능, 이번 PR 이 신설한 UI 아님).
  - `TriggerDto.chatChannelHealth/notificationHealth/...` → `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`, `components/triggers/cards/*.tsx`, `content/docs/02-nodes/triggers.{mdx,en.mdx}` 에 이미 존재.
  - `ScheduleDto.trigger`/`TriggerDto.workflow` 참조 좁히기(`ScheduleTriggerRefDto`/`TriggerWorkflowRefDto`) → 소비처는 기존 `schedules/page.tsx`·`triggers/page.tsx` 뿐이라고 diff 주석이 명시하며, 오히려 **노출을 줄이는** 방향(트리거 회전 secret 두 컬럼 `notificationSecretV2`/`chatChannelTokenV2` 를 응답에서 제거)이다.

  즉 이번 PR 은 (i) 이미 존재하던 wire 동작을 문서화(swagger)만 정합화했거나, (ii) 보안 상 오히려 노출을 줄인 변경이다. 신규 사용자 가시 기능·API 노출 확대가 없으므로 `02-nodes/`·`06-integrations-and-config/` 등 user-guide MDX 갱신 대상이 아니다.

### 다른 trigger 매칭 여부
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매칭 없음. `triggers.service.ts`/`schedules.controller.ts` 의 비밀 스트립 로직은 secret 유출 방어(§5.4) 목적이며 인증·권한·세션 미들웨어 변경이 아님.
- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 매칭 없음(변경 파일 없음).
- **integration-provider-change** — 매칭 없음. 신규/변경 provider 없음(기존 통합의 응답 필드 선언 보완일 뿐).
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **new-warning-code / new-error-code** — 매칭 없음. `error-codes.ts` 변경 없음, `INTERNAL_ERROR` 는 기존에 이미 여러 모듈에서 쓰이는 코드(`schedules.controller.ts` 신규 사용은 이미 등록된 코드의 재사용).
- **new-ui-string (TSX)** — 매칭 없음(`codebase/frontend/**/*.tsx` 변경 0건).
- **new-userguide-section-dir** — 매칭 없음(`content/docs/` 변경 0건).

## 부수 관찰 (INFO, 참고용 — user-guide 동반 갱신 결함 아님)
- **[INFO]** `AlertRuleDto.lastTriggeredAt` 의 신규 swagger JSDoc 문구가 어색하다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (diff 게이트 68행, `/** 마지막 발화 시각 (없으면 \`null\`) */`)
  - 매트릭스 항목: `backend-api-change` target (a) "controller·DTO 의 swagger jsdoc"
  - 상세: "발화"(utterance/발언)는 채팅·에이전트 문맥의 어휘이고, `AlertRuleDto` 의 `lastTriggeredAt` 은 "알림 규칙이 마지막으로 발동(trigger)된 시각"을 뜻한다. 같은 PR 의 다른 신규 필드들(`integration-response.dto.ts`, `knowledge-base-response.dto.ts`)은 유사 boilerplate 주석에서 필드별로 정확한 한국어 설명을 붙였는데 이 필드만 문맥이 어긋난 낱말이 붙었다 — 다른 DTO(chat/agent 계열)의 문구를 복붙하다 남은 것으로 보인다.
  - 영향: 이 JSDoc 은 `@nestjs/swagger` 플러그인이 OpenAPI `description` 으로 그대로 내보내므로(같은 PR 의 `threshold` 필드 주석이 명시하는 관례), 공개 API 문서를 읽는 소비자에게 그대로 노출된다. 사용자 가이드 MDX 대상은 아니지만 swagger jsdoc target (a) 의 정확성 문제.
  - 제안: `/** 마지막 발동 시각 (없으면 \`null\`) */` 등으로 정정. (동반 갱신 누락은 아니므로 CRITICAL/WARNING 이 아닌 INFO.)

## 요약
매트릭스 21개 행 중 glob/semantic 으로 실제 매칭된 것은 `backend-api-change`(DTO/controller 변경) 1건뿐이며, 실측(diff 주석 + CHANGELOG + frontend grep 3종)으로 이 변경이 "wire 변경 없음"·"이미 소비 중인 필드의 선언 catch-up"·"오히려 노출 축소(secret strip)"임을 확인해 target (b) user-guide 동반 갱신 의무는 발생하지 않는다고 판단했다. target (a) swagger jsdoc 은 이미 같은 diff 안에서 충족됐고, 한 곳(AlertRuleDto.lastTriggeredAt)의 문구 오기만 INFO 로 남긴다. 나머지 20개 행(노드/i18n/통합/섹션/auth/표현식언어/run-debug/warning·error 코드)은 트리거 조건 자체가 이 changeset 에 없다 — `codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**` 변경이 전혀 없다.

## 위험도
NONE

# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-prep)

## 검토 범위 및 방법

`spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 는 번들에 전문이
포함되어 전량 검토했다. `4-integration.md`·`5-knowledge-base.md`·`6-config.md`·`8-marketplace.md`·
`9-user-profile.md`·`_product-overview.md`·`0-dashboard.md`·`7-statistics.md`·`10-auth-flow.md`·
`11-error-empty-states.md`·`13-user-guide.md`·`14-execution-history.md`·`15-system-status.md`·
`16-agent-memory.md`·`_layout.md` 15개 파일은 컨텍스트 예산 초과로 프롬프트에 본문이 없어 **검토
대상에서 제외**했다 — 이 15개 파일에 대해서는 "위반 없음" 을 주장하지 않는다.

대조한 정식 규약: `spec/conventions/error-codes.md` · `spec-impl-evidence.md` ·
`review-citations.md` · `secret-store.md` · `chat-channel-adapter.md` · `swagger.md` ·
`i18n-userguide.md` · `audit-actions.md`, 그리고 규약 SoT 로 참조되는
`spec/5-system/2-api-convention.md`(§2 URL 구조·§5.4 부재 표현) · `spec/5-system/3-error-handling.md`.

## 발견사항

전량 검토한 3개 파일에서 **CRITICAL/WARNING 급 위반은 발견하지 못했다.** 아래는 INFO 수준의
관찰이다.

- **[INFO]** 컬렉션 수준 RPC 액션(`id` 세그먼트 없음)이 URL 명명 규칙 표에 명시되지 않음
  - target 위치: `1-workflow-list.md` §3 `POST /api/workflows/import`, `3-schedule.md` §4
    `POST /api/schedules/preview`
  - 위반 규약: `spec/5-system/2-api-convention.md` §2.2 명명 규칙
  - 상세: §2.2 의 "자원 액션" 규칙과 "RPC-style sub-channel action" 예외는 모두
    `/api/{resource}/{id}/{action}` (id 세그먼트 필수) 형태만 명시적으로 다룬다. 위 두
    endpoint 는 특정 리소스 id 에 묶이지 않는 **컬렉션 수준 액션**(파일 import·임의 cron 미리보기
    계산)이라 이 표의 어느 행에도 정확히 대응하지 않는다. 다만 이는 신규 도입이 아니라 기존
    확립된 패턴이고, REST 관행상 합리적인 형태라 CRITICAL/WARNING 으로 보지 않는다.
  - 제안: 규약(§2.2)에 "id 를 요구하지 않는 컬렉션 수준 액션" 행을 추가해 두 endpoint 를
    명시적 예외로 등재하면, 향후 유사 패턴에 대한 판단 기준이 생긴다. spec 쪽 수정은 불필요.

- **[INFO]** `pending_plans` 에 이미 `plan/complete/` 로 이동한 항목이 남아 있음
  - target 위치: `1-workflow-list.md` frontmatter `pending_plans`
    (`plan/complete/workflow-duplicate-nodes-edges.md`)
  - 위반 규약: 없음 — `spec-impl-evidence.md` §2.1 은 `pending_plans` 항목이
    `plan/in-progress/` 또는 `plan/complete/`(치환) 어느 쪽에 있어도 실존만 요구하므로 스키마
    위반은 아니다.
  - 상세: 다만 같은 문서에 `marketplace-and-plugin-sdk.md`(in-progress)가 함께 남아 있어
    `status: partial` 이 유지되는 근거는 그 항목이지, 이미 완료된 `workflow-duplicate-nodes-edges`
    쪽은 아니다. R-11(공유 트래커 승격 판정) 의 취지대로 완료된 개별 plan 은 목록에서 정리하는
    편이 "이 문서가 아직 책임지는 미구현 surface" 를 더 명확히 드러낸다.
  - 제안: 다음에 이 frontmatter 를 건드릴 때 완료된 항목을 제거 (지금 당장 강제할 사안은 아님).

## 정합성이 확인된 항목 (참고)

다음은 위반이 아니라, 교차 인용의 정확성을 별도로 검증했다는 기록이다 (자기-검증 성격의 문서라
인용이 실제로 착지하는지가 신뢰도의 핵심이기 때문):

- `2-trigger-list.md` 의 `TriggerDto.workflow` 키 생략 선언과 그 근거 인용
  (`spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략` 기준 (b)) — 앵커·조건
  서술이 실제 §5.4 본문과 일치.
- `botToken` write-only 필드의 마스킹 미차용 근거 인용
  (`secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다`) — §1.1 실제로 "ref/plaintext
  는 응답 바디에 실려서도 안 된다" 를 규정해 인용 취지와 부합.
- `uiMapping.formMode`/`visualNode`/`buttonLayout` enum 값·기본값이
  `chat-channel-adapter.md §2.3 ChatChannelConfig` 의 타입 선언과 정확히 일치.
- `BOT_TOKEN_INVALID`·`TRIGGER_ENDPOINT_PATH_CONFLICT`·`INVALID_FIELD` 등 에러 코드가
  `error-codes.md`·`error-handling.md` 카탈로그와 일치하는 `UPPER_SNAKE_CASE`, 도메인 prefix
  관례를 따름.
- `trigger.notification_secret_rotated`/`chat_channel_bot_token_rotated`/
  `interaction_token_revoked` 감사 액션명이 `audit-actions.md` §3 레지스트리(2026-08-11 구현
  행)와 정확히 일치.
- `id: workflow-list`/`trigger-list`/`schedule` frontmatter — basename 기반 kebab-case 규칙 준수,
  저장소 내 `id` 충돌 없음(grep 확인). `status: partial` 두 문서 모두 `pending_plans:` 보유,
  `status: implemented` 문서(`3-schedule.md`)는 `pending_plans` 미보유 — §3 라이프사이클 규칙과
  일치.
- 세 파일 모두 `review-citations.md` §2 가 금지하는 bare `hh_mm_ss` 인용이 없음 (grep 0건).

## 요약

전량 검토 대상 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)은 명명·에러
코드·frontmatter 스키마·부재 표현(§5.4)·secret 노출 정책 등 다수의 정식 규약 항목을 정확한
섹션 앵커까지 대조해 인용하고 있으며, 검토 과정에서 CRITICAL·WARNING 급 위반을 찾지 못했다.
발견한 두 건은 모두 INFO 수준(URL 명명 규칙의 사각지대·완료된 pending_plans 잔존)으로, 즉시
차단할 사안이 아니다. 다만 컨텍스트 예산으로 생략된 15개 파일(`4-integration.md` 등)은 이번
검토에 포함되지 않았으므로 그 파일들의 정식 규약 준수는 **미확인 상태**로 남는다 — 별도 라운드
(파일을 직접 `Read` 하는 방식)로 보강이 필요하다.

## 위험도

LOW

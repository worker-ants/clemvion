# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없다. forced 화이트리스트(documentation, scope, testing) 전원 결과를
확보했고 router 는 이번 라운드에서 사용되지 않아(routing=skipped) 4명 전체가 실행됐다. 실질
WARNING 3건 — (1) `triggers.mdx`/`.en.mdx` 사용자 가이드가 이번 diff 가 새로 여는 두 가지 400
사유("chatChannel 최초 설정 전용", "provider PATCH 불변")를 아직 반영하지 않음, (2) 리뷰 2라운드의
테스트 분리 과정에서 생긴 orphaned JSDoc, (3) 같은 PR 이 이미 고친 것과 같은 클래스의 stale DTO
주석(`details.field` flat 표기 잔존). 셋 다 UI 도달 불가(API 직접 통합 담당자 한정) 또는 소스
내부 주석 범위라 CRITICAL 은 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유저가이드 동기화 | PATCH 신규 400 사유 중 "chatChannel 최초 설정 시도"·"provider 전환 시도" 두 가지가 `02-nodes/triggers.mdx`(및 `.en.mdx`) 어디에도 반영되지 않음. 직전 라운드가 지적한 slack/discord signing-secret 갭은 커밋 `5976587c7` 로 닫혔으나, 같은 diff 가 새로 연 이 두 400 사유는 여전히 미문서화. UI 폼은 `provider`/신규-attach 를 PATCH 바디에 싣지 않아 영향은 API 직접 통합 담당자로 한정(그래서 CRITICAL 아닌 WARNING) | `codebase/backend/src/modules/triggers/triggers.controller.ts:117-131`, `chat-channel-config.dto.ts`, `triggers.service.ts:722-747`(`assertChatChannelAlreadySetUp`) / 문서: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`,`.en.mdx` | "Chat Channel 연결" 절에 "chatChannel 은 생성 시에만 설정 가능 — PATCH 로 새로 붙이거나 provider 를 바꾸면 400(`details.field='chatChannel'`/`'provider'`). provider 변경은 트리거 삭제·재생성 필요" 문장 추가. 최소한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 명시 등재 |
| 2 | 테스트/문서 위생 | 리뷰 2라운드(`83d5f3f94`, RESOLUTION #3 "테스트를 두 갈래로 분리")가 원 JSDoc 과 원 테스트 사이에 새 JSDoc+새 테스트를 끼워 넣으면서, 5필드 실측 결론을 설명하는 JSDoc(816-828)이 엉뚱하게 null/빈 문자열 테스트(835) 바로 위에 남고, 정작 그 JSDoc 이 가리키는 진짜 5필드 테스트(846)는 설명 없이 남음(orphaned JSDoc) | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:816-846` | JSDoc 블록(816-828)을 846 테스트(`[실측] 차단 5필드의 details.field...`) 바로 위로 이동. 829-834 JSDoc 은 현재 위치 유지 |
| 3 | 문서 정합성 | `chat-channel-config.dto.ts` 의 `botTokenRef` 필드 JSDoc 이 이 PR 자신의 실측 테스트가 반증한 flat `details.field='botTokenRef'` 표기를 그대로 유지 — 같은 PR 이 같은 파일에서 컨트롤러 Swagger 설명·4개 사용자가이드는 이미 `chatChannel.botTokenRef`(비어있지 않은 값 갈래, nested)로 정정했음에도 이 소스 주석만 누락. 형제 필드(`inboundSigningRef`/`inboundSigning`)는 애초에 형식을 명시하지 않아 해당 없음 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:190-193` | `details.field='botTokenRef'` → `details.field='chatChannel.botTokenRef'`(비어있지 않은 값 갈래 caveat 포함)로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 | 신규 slack/discord 가이드 섹션("Bot Token · Signing Secret/Public Key 변경")이 `details.field` 형식의 "비어있지 않은 값"(nested) 갈래만 설명하고, PR 자신의 테스트가 확인한 `null`/빈 문자열 갈래(flat `details.field='botToken'`)는 다루지 않음. 흔한 사용 경로만 문서화한 합리적 단순화로 결함은 아님 | `discord.en.mdx:109-122`, `slack.en.mdx:134-147`(+ko 대응) | 우선순위 낮음. 필요 시 "빈 값 명시 전송 시 접두어 없는 `botToken` 형태" 각주 고려 |
| 2 | 테스트(조치 확인) | "setup 안 된 트리거에 PATCH 로 chatChannel 최초 부착 시 400" 테스트가 `code` 만 보던 데서 `details.field='chatChannel'` 까지 단언하도록 강화됨 — 직전 라운드가 지적한 vacuous 케이스(인접 가드가 다른 이유로 거부해도 GREEN)가 뮤테이션 검증(해당 분기 제거 → RED)으로 판별력 확인됨 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (R-CC-21 describe 블록) | 추가 조치 불요 — 조치 완료 확인 |
| 3 | 테스트(조치 확인) | 신규 slack/discord 가이드 서술이 테스트가 고정한 실제 동작(`details.field` 정확한 값, "표시 옵션/rate limit 만 바꾸는 PATCH 는 영향 없음")과 전부 정합 | `docs/06-integrations-and-config/{slack,discord}{,.en}.mdx`, `trigger-dto-validation.spec.ts`, `triggers.service.spec.ts` | 추가 조치 불요 |
| 4 | 테스트(carry-over, 비차단) | `inboundSigningRef` 보존이 unit 레벨에서만 검증되고 실제 웹훅 서명 검증까지 잇는 e2e 가 없음 | `triggers.service.spec.ts`(`persistedChannel()`) vs `trigger-workflow-ref.e2e-spec.ts` case E | 낮은 우선순위, e2e 보강 고려 |
| 5 | 테스트(carry-over, 비차단) | `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy 분기 미검증(HTTP 경로에서 DTO 가 `provider` 필수라 실질 도달 불가하나, 방어적 이중 검증이라는 주석 주장 자체는 미테스트) | `triggers.service.ts`(`assertChatChannelAlreadySetUp`) | 낮은 우선순위, 단위테스트 추가 고려 |
| 6 | 테스트(carry-over, 비차단) | `cardBody` fixture 리터럴이 `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 두 곳에 중복 — 프론트 카드 바디 변경 시 한쪽만 갱신되고 다른 쪽은 stale 채로 계속 통과할 drift 위험 | 위 두 spec 파일 | 공유 fixture 헬퍼로 추출 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | orphaned JSDoc(816-846) + stale flat `details.field='botTokenRef'` 주석(190-193). 핵심 코드·신규 가이드 문서화 수준은 예외적으로 높음 |
| user_guide_sync | WARNING | chatChannel 최초설정 전용·provider PATCH 불변 두 400 사유가 `02-nodes/triggers.mdx`(en 포함)에 미반영. 직전 라운드 slack/discord 시크릿 갭은 완전히 닫힘 확인 |
| testing | NONE | 이번 델타(테스트 단언 강화 8줄 + 가이드 mdx 4파일 신설)는 뮤테이션 검증으로 판별력 확인, 전체 181/182 GREEN. carry-over INFO 3건은 비차단 |
| scope | NONE | 델타(`5976587c7`)는 직전 WARNING 2건 + INFO 1건에 정확히 1:1 대응하는 최소 수정. 신규 기능·무관 리팩토링·설정 변경 없음. `spec/` 변경 없음 |

## 발견 없는 에이전트

- scope — 신규 스코프 이탈 없음(위험도 NONE)

## 권장 조치사항

1. `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`(및 `.en.mdx`)에 "chatChannel 은 생성 시에만 설정 가능, PATCH 로 새로 붙이거나 provider 를 바꾸면 400" 안내 추가 (WARNING #1)
2. `chat-channel-config.dto.ts:190-193` 의 stale flat `details.field='botTokenRef'` 주석을 `chatChannel.botTokenRef`(비어있지 않은 값 갈래)로 정정 (WARNING #3)
3. `trigger-dto-validation.spec.ts` 의 orphaned JSDoc(816-828)을 846 테스트 바로 위로 재배치 (WARNING #2)
4. (낮은 우선순위) 신규 slack/discord 가이드 섹션에 `null`/빈 문자열 전송 시 `details.field` 형태(flat)가 다름을 각주로 보강 (INFO #1)
5. (낮은 우선순위, carry-over) `inboundSigningRef` e2e 서명검증 보강 / `provider` falsy 분기 단위테스트 / `cardBody` fixture 중복 제거 고려 (INFO #4-6)

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(documentation, user_guide_sync, testing, scope) 실행됨.
  - **강제 포함(router_safety)**: `documentation, scope, testing` — 전원 결과 확보됨(누락 없음).
  - `user_guide_sync` 는 forced 목록에 없었으나 routing 자체가 skipped 되어 함께 실행됨.

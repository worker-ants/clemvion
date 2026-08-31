# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `notification.new` WS 이벤트의 SoT 절 번호(§4.4→§4.5) 정정이 같은 함수/같은 테스트 블록 안에서마저 불완전 — 이 PR 이 고치던 결함 클래스(썩은 절 번호 인용)가 diff 로 직접 손댄 파일 안에서 재발
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:567`(diff 로 §4.4→§4.5 수정됨) vs 같은 `emitNotificationEvent` 메서드 본문의 `websocket.service.ts:583-585`("payload shape 은 WS spec §4.4 의 { id, type, title, message, resourceType, resourceId } 정확히 그대로 … §4.4 가 권위 shape") — **미수정, 여전히 §4.4**
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1268`(diff 로 "spec §4.5 shape" 로 수정됨) vs 15줄 아래 같은 테스트 안의 `websocket.service.spec.ts:1283`("WS spec §4.4 정확 shape") — **미수정, 여전히 §4.4**
  - 상세: `spec/5-system/6-websocket-protocol.md` 재배치로 알림 이벤트(`notification.new`)는 이제 §4.5 다(§4.4 는 "사용자 입력 대기 이벤트 상세"로 다른 주제). 이번 diff 는 두 파일에서 각 1곳(JSDoc 헤더 / 테스트 제목)만 §4.4→§4.5 로 고쳤지만, **바로 옆의 bare-prose 인용(주석·인라인 코멘트)은 그대로 두었다** — 정확히 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 "마크다운 링크만 세고 bare 프로즈 인용은 놓쳤다"고 자인한 결함 클래스와 같은 패턴이며, 그 plan 문서가 주장하는 "정정 후 재전수 — 실질 잔존 오인용 0건" 범위 밖에 남은 인스턴스다(그 재전수는 `spec/`·`plan/in-progress/`·일부 `codebase/` 만 훑었고 이 두 지점은 포함되지 않았다). 런타임 동작·응답 바디·이벤트 이름·payload 필드에는 영향이 없으나(주석/테스트-설명 전용), `websocket.service.spec.ts:1268`↔`:1283`은 **같은 assertion 블록 안에서 §4.5 와 §4.4 가 서로 다른 절을 "정확한 shape"라고 동시에 주장**하는 자기모순이라 이 계약의 권위 문서 위치를 찾는 다음 사람을 오도할 수 있다.
  - 제안: `websocket.service.ts:583,585` 와 `websocket.service.spec.ts:1283` 의 `§4.4`→`§4.5` 로 정정. 이 참조 형태(주석·테스트-설명 bare 프로즈)를 훑는 절차가 위 plan 문서가 이미 제안한 `grep -rn '§<구번호>' spec/ codebase/ plan/in-progress/ .claude/` 전수 스윕에 실제로 포함되도록 재확인할 것.

- **[INFO]** (PR 범위 밖, 부수 관찰) `notifications-channel-authorizer.ts:12` 의 주석이 "emit 은 미구현(spec §4.4 Planned)" 이라고 적고 있는데, `notification.new` emit 은 이미 구현·배선 완료 상태다(`WebsocketService.emitNotificationEvent`, `spec-sync-data-flow-8-notifications-gaps.md` PR1 완료 기록 참조). 이 파일은 이번 diff 에 포함되지 않아 이 PR 이 만든 결함은 아니지만, 위 §4.4→§4.5 스윕이 "훑었다"고 주장하는 범위(`codebase/`)에서 이 인스턴스는 여전히 놓쳐 있다 — "미구현" 이라는 잘못된 캡션이 emit 이 실재 라이브 계약인지 판단하려는 다음 독자를 오도할 수 있다.
  - 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` (파일 상단 주석, 12번째 줄 — 직접 `Read` 로 확인)
  - 제안: 별도 후속(이 PR 블로킹 아님)으로 "미구현" 캡션을 "구현됨" 으로 갱신 + §4.4→§4.5.

- **[INFO]** `WorkflowAssistantController` 6개 라우트에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 신규 부착 — 순수 additive 문서화, breaking change 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:59,80,98,112,126,142,165`(`list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage`)
  - 상세: 클래스 레벨에 이미 `@ApiBearerAuth('access-token')`(파일 42번째 줄)이 걸려 전 라우트가 인증을 요구하는데도 401 OpenAPI 문서가 0건이었다(`swagger.md §2-4` 위반, 신설 테스트 파일 docstring 이 근거). 이 diff 는 데코레이터만 추가했을 뿐 가드·컨트롤러 시그니처·응답 바디·URL·상태 코드 어느 것도 바꾸지 않는다. 설명 문구(`'인증 실패 또는 토큰 만료'`)는 저장소 내 기존 27개 컨트롤러가 이미 쓰는 지배적 문구와 정확히 일치해(`grep` 확인, 총 221곳 `@ApiUnauthorizedResponse` 사용 중 다수), 신규 값을 발명하지 않고 기존 규약을 그대로 따랐다. 배치 순서(401 직후 403)도 `swagger.md §2-4` 표 오름차순과 저장소 선례(`nodes.controller.ts`)에 부합한다.
  - 신설 회귀 테스트 `workflow-assistant.controller.swagger.spec.ts` 가 `buildSwaggerDocument` 프로브로 라우트 7개 전수 + 401 description 문구를 고정한다. import 경로(`../../shared/testing/swagger-probe`)는 실제 파일 위치와 일치함을 `Read`/`ls` 로 확인.
  - 제안: 없음 — 조치 불요, 계약 관점 정상 개선.

- **[INFO]** `spec/5-system/14-external-interaction-api.md §8.2` 의 HMAC 알고리즘 화이트리스트 정정 — `hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512` 두 값
  - 위치: `spec/5-system/14-external-interaction-api.md` §8.2 (diff 게이트 기준, "algorithm whitelist" 항목)
  - 상세: 코드 동작 변경이 아니다. `notification-signature.util.ts` 의 `SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512'` 와 `notification-config.dto.ts` 의 `@IsIn(['hmac-sha256', 'hmac-sha512'])` 를 직접 확인했고, 둘 다 이미 두 알고리즘을 화이트리스트하고 있다 — 즉 실제 outbound webhook 서명 검증 표면은 이번 diff 전후로 동일하며, spec 문구가 뒤늦게 구현을 따라잡은 것이다. `v1=`/`v2=` 서명 스킴 버전 표기(별개 축)도 "현재 발행은 v1 뿐" 이라고 명확히 하여 과다 약속을 만들지 않는다. 클라이언트(웹훅 발신자/수신자) 관점 영향 없음.
  - 제안: 없음.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` §4.3~§4.7 절 재배치(KB 이벤트를 앞으로 이동, 알림/시스템/외부 표면 절번호 순연) — 이벤트 이름·채널 키·payload 필드·엔드포인트 경로에 변경 없음. 순수 문서 내부 참조 정합화. `chat-channel.dispatcher.ts`/`types.ts`/`chat-channel.dispatcher.spec.ts` 3파일 변경도 JSDoc/주석에서 썩은 줄 번호(`line 536`, `line 89`)만 제거한 것으로 `EiaAiMessageEvent.presentations` 필드 타입·추출 로직·응답 바디에 영향 없음.
  - 위치: 해당 없음(문서/주석 전수, 코드 로직 변경 없음)

- **[INFO]** `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 신설 `_scope_delta_census`/`_count_diff_files` 및 `plan/**` 다수 파일 변경은 harness 내부 도구·작업 추적 문서로 API 표면과 무관.

## 요약

이번 changeset 에서 실제 REST/WS API 표면 코드에 손을 댄 것은 `WorkflowAssistantController` 의 `@ApiUnauthorizedResponse` 6건 추가뿐이며, 이는 이미 인증이 강제되던 라우트의 OpenAPI 문서 누락(`swagger.md §2-4` 위반)을 메우는 순수 additive 변경으로 하위 호환성·응답 스키마·에러 코드·URL 설계·인가 로직 어느 것도 깨지 않는다(신규 회귀 테스트로 고정). `14-external-interaction-api.md` 의 HMAC 화이트리스트 정정도 이미 구현된 동작을 spec 이 뒤늦게 반영한 문서 전용 변경이다. 다만 이 PR 은 "썩은 줄 번호/절 번호 인용" 결함 클래스를 스윕해서 고치던 중, 그 스윕이 자기 자신이 수정한 파일 안에서마저 불완전했다 — `websocket.service.ts` 의 `emitNotificationEvent`(JSDoc 은 §4.5 로 고쳤지만 5줄 아래 인라인 주석은 §4.4 그대로)와 `websocket.service.spec.ts` 의 동일 테스트(제목은 §4.5, 15줄 아래 주석은 §4.4)에서 자기모순이 남아 있다. 런타임 계약(이벤트명·채널·payload 필드)에는 영향이 없어 WARNING 으로 낮췄으나, 이 PR 이 명시적으로 "재전수 — 실질 잔존 오인용 0건" 이라 주장한 범위 밖에 남은 인스턴스이므로 정정을 권고한다.

## 위험도

LOW

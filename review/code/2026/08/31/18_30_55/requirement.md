# 요구사항(Requirement) Review

## 발견사항

- **[WARNING]** `§4.4→§4.5` 절 번호 이동 스윕이 같은 문단 안에서조차 불완전했다 — 인접 문장은 고쳤는데 다음 문장은 안 고쳤다.
  - 위치: `spec/data-flow/8-notifications.md:192` (`이벤트 이름은 §4.4 기존 \`notification.new\` prefix 와 일관성을 유지한다.`)
  - 상세: 이번 diff 는 `6-websocket-protocol.md` 의 "알림 이벤트" 절을 §4.4 → §4.5 로 옮기고, `8-notifications.md` 내 4곳의 인용을 §4.5 로 갱신했다(plan `spec-sync-external-interaction-api-gaps.md` 가 "동반 정정 7건: 8-notifications.md 4건" 으로 스스로 집계). 그런데 바로 190번째 줄에서 링크 텍스트를 `§4.4`→`§4.5` 로 고친 **같은 문단의 다음 문장(192번째 줄)**은 `§4.4 기존` 그대로 남아 있다. 실측(현재 저장소, 이 diff 반영 후): `grep -n '§4\.4\|§4\.5' spec/data-flow/8-notifications.md` → 192번째 줄만 `§4.4` 로 남고 나머지(25/97/190/347)는 전부 `§4.5` 로 갱신됨을 직접 확인. `§4.4` 는 지금 "사용자 입력 대기 이벤트 상세"(`execution.waiting_for_input`) 절이라, 이 문장을 따라가는 독자는 `notification.new` 와 무관한 절로 안내된다.
  - 제안: 192번째 줄의 `§4.4` 를 `§4.5` 로 정정(가능하면 markdown 링크로도 통일). 이 PR 이 이미 4건을 고친 스윕 작업의 잔여 1건이므로 developer 권한 안에서 바로 고칠 수 있는 사실 정정이다(제품 결정 아님).

- **[WARNING]** 같은 절 번호 이동이 `spec/` 밖 backend 코드 주석에는 전혀 전파되지 않았다 — PR 이 주장하는 "96건 앵커 전수 대조" 검증 범위 밖의 사각지대.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:211`, `:232`, `codebase/backend/src/modules/websocket/websocket.service.ts:567` (모두 이번 diff 미포함 파일 — 실측으로 직접 확인)
  - 상세: 세 곳 모두 `notification.new` 의 권위 정의를 `spec/5-system/6-websocket-protocol.md §4.4` 로 인용하는데, 이번 diff 로 그 절은 §4.5 로 이동했다. plan(`spec-sync-external-interaction-api-gaps.md`)이 명시한 검증 방식 — "WS 문서를 가리키는 앵커 링크 96건 전수를 헤딩 slug 와 대조" — 은 markdown `[text](path#anchor)` 형태의 **링크**만 잡는다. 위 세 곳은 코드 주석 안의 순수 텍스트 인용(링크 아님)이라 그 대조망 밖에 있다. `spec/` 안의 4곳은 고쳤지만 `spec/` 밖으로 전파된 동일 참조는 스윕 대상에서 빠졌다.
  - 제안: 세 위치의 `§4.4`→`§4.5` 로 정정. 코드 변경 없는 주석 수정이라 developer 가 바로 처리 가능. 향후 유사 재발을 막으려면 spec 절 번호 이동 시 `grep -rn '<구-절-번호>' codebase/` 까지 스윕 범위에 포함하는 것을 권고(spec 자체 반영 사항은 아니므로 CRITICAL 아님, 문서 최신성 갭으로 WARNING).

- **[정보/방법론 — 코드 결함 아님]** 리뷰 중 `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` 를 처음 `Read` 했을 때 `list()` 라우트에 `@ApiUnauthorizedResponse` 데코레이터가 없었고, 그 상태로 신규 테스트(`workflow-assistant.controller.swagger.spec.ts`)를 돌리니 `missing = ["GET /workflow-assistant/sessions"]` 로 1건 RED 였다. 그런데 **직후 재확인**(같은 파일 `sed -n`/`grep -n`, `git status --short` 클린 확인)에서는 7개 라우트 전부 데코레이터가 존재했고, 테스트도 **2/2 통과**로 재현됐다. 프롬프트가 경고한 "병렬 fan-out 중 다른 reviewer 가 같은 워크트리를 동시에 뮤테이션" 상황과 부합하는 관측이라, 결함으로 취급하지 않고 사실만 기록한다 — **현재 저장소 상태·git status는 clean, 테스트는 재현 가능하게 GREEN**(`npx jest workflow-assistant.controller.swagger.spec.ts` → `Tests: 2 passed, 2 total`).

- **[INFO]** `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — 7개 라우트 전부에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 부착 확인. `spec/conventions/swagger.md §2-4` 원문("보호된 엔드포인트는 기본적으로 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })`를 포함합니다") 과 문구까지 정확히 일치. 클래스 레벨 `@ApiBearerAuth('access-token')` + `@Public` 미부착 확인 — 401 문서화가 필요한 대상이 맞다는 전제도 유효. 신규 테스트(`workflow-assistant.controller.swagger.spec.ts`)는 (a) 라우트 수 7개 고정(공허 방지 전제) (b) 401 부재 라우트 목록 (c) 문구 일치 세 축을 모두 검증하며 실측 GREEN.

- **[INFO]** `spec/5-system/14-external-interaction-api.md §8.2` HMAC whitelist 정정(`hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512`)이 실제 코드(`notification-signature.util.ts:11` `SupportedHmacAlgorithm` union, `notification-webhook.processor.ts:297-300` `resolveAlgorithm`)와 정확히 일치함을 확인. `v1=`/`v2=` 서술 분리도 §6.1 헤더 서술과 부합.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` §4.1~§4.7 절 번호 재배치 후 순차성 확인(`### 4.1`~`### 4.7`, 중복·결번 없음 — 과거 "`### 4.4` 헤딩 중복" 결함이 실제로 해소됨). §4.3(KB 이벤트)은 번호·내용 변경 없이 위치만 §4.4 앞으로 이동했고, `KbEventType` union 11종(embedding 6 + graph 5)도 코드와 일치.

- **[INFO]** `chat-channel.dispatcher.ts`/`chat-channel.dispatcher.spec.ts`/`types.ts` 의 주석 정정(하드코딩 `line NNN` 제거, 앵커·절 번호만 유지)은 plan(`spec-draft-eia-notification-payload-contract.md`)의 실측 표(EIA §6.5 실제 위치 827, `chat-channel-adapter §1.2` 실제 위치 138)와 정확히 일치하며, 앵커(`#65-페이로드--...`, `#12-eiaevent-입력`, `#710-presentation-payload-render_-운반`)도 실제 헤딩과 정확히 매칭. `chat-channel.dispatcher.spec.ts` 43 tests 재실행 통과(주석 전용 변경이므로 당연하나 실측으로 재확인).

- **[INFO]** `plan/in-progress/cafe24-backlog-residual.md`, `spec-sync-user-profile-gaps.md`, `spec-sync-websocket-protocol-gaps.md` 등에 새로 실린 "착수 전 실측" 블록(ThrottlerModule 설정·Redis storage 미설치, `notifications.service.ts:422` 2갈래 채널 계산, WS gateway 의 `jwtService.verify` 단일 호출부 등)을 코드에서 직접 대조해 전부 사실과 일치함을 확인. 이 문서들은 구현 자체가 아니라 "구현 전 제품 결정 필요"를 기록하는 성격이라 기능 완전성 판단 대상이 아니다.

## 요약

이번 변경은 대부분 (1) `spec/` 절 번호 재배치(WS 프로토콜 §4.4 알림 이벤트 → §4.5 및 연쇄 이동)와 그 크로스 레퍼런스 동기화, (2) 하드코딩 줄 번호 인용을 절 번호/앵커로 교체하는 주석 정정, (3) `workflow-assistant` 컨트롤러 7개 라우트에 `@ApiUnauthorizedResponse` 부착 + 회귀 방지 테스트 신설, (4) 다수 plan 문서의 "착수 전 실측 재검증" 기록으로 구성된다. 코드 변경분(controller 데코레이터 부착, 신규 swagger 테스트, 주석 정정)은 spec 원문·실제 코드와 line-level 로 정확히 일치함을 직접 실행·grep 으로 검증했다(스웨거 테스트 2/2, dispatcher 스펙 43/43 통과). 유일한 실질 갭은 이번 PR 이 수행한 §4.4→§4.5 절 번호 스윕이 **불완전**하다는 점이다 — `spec/data-flow/8-notifications.md` 내부 1곳(같은 문단, 바로 다음 문장)과 `spec/` 밖 backend 코드 주석 3곳이 구 절 번호를 그대로 인용한다. 두 건 모두 문서/주석 성격이라 런타임 동작에는 영향이 없고, developer 권한 안에서 바로 정정 가능한 사실 오류다. 그 외 CRITICAL 급 기능 결함·엣지 케이스 누락·TODO/FIXME·spec 위반은 발견되지 않았다.

## 위험도

LOW

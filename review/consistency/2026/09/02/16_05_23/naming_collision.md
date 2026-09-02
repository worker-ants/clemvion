# 신규 식별자 충돌 검토 — `spec-draft-ws-wontdo-maintenance-appping`

## 검토 범위 확인

target draft 는 `spec/5-system/6-websocket-protocol.md` 의 **기존 항목 2종**(`system.maintenance` 이벤트,
서버발신 app ping)의 상태 배지를 `계획·미구현(Planned)` → `비채택(won't-do)` 로 바꾸는 문서다. 두 이벤트
이름 자체는 **새로 도입되는 것이 아니라 §4.6/§5.2 에 이미 존재하는 식별자를 그대로 재사용**한다. 실제로
target 이 새로 만들어 내는 식별자는 다음 1개뿐이다:

- Rationale 앵커 ID `R-wontdo-maintenance-appping` (변경안 #8, 신설 Rationale 본문 첫 줄)

나머지 5개 관점(요구사항 ID·엔티티/DTO·API endpoint·환경변수/설정키·파일 경로)에는 target 이 새로 도입하는
식별자가 **없다** — 아래 각 관점별로 실측을 기록한다.

## 관점별 실측

### 1. 요구사항 ID 충돌 — 해당 없음
`spec/5-system/6-websocket-protocol.md` 전체에서 `WS-[A-Z]+-[0-9]+` 형태의 요구사항 ID 패턴이 **0건**
(grep 실측). 이 문서는 애초에 번호 매김 요구사항 ID 체계를 쓰지 않으므로 target 이 새 ID 를 발급할 자리가
없고, 실제로 발급하지도 않는다.

### 2. 엔티티/타입명 충돌 — 해당 없음
target 은 새 DTO·인터페이스·엔티티명을 도입하지 않는다. payload 형태(`{ message, scheduledAt }`,
Socket.IO 내장 `pingInterval`/`pingTimeout`)는 모두 기존 §4.6/§5.1 본문을 그대로 인용할 뿐이다.

### 3. API endpoint 충돌 — 해당 없음
target 은 REST/WS endpoint 를 신설하지 않는다.

### 4. 이벤트/메시지명 충돌 — 충돌 없음 (기존 식별자 재사용 확인)
- `system.maintenance` — repo 전체에서 `codebase/` 내 등장 **0건** (backend/frontend grep 실측),
  `spec/` 내 등장은 target 자신을 포함해 5개 문서(`spec/5-system/6-websocket-protocol.md`,
  `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md`,
  `plan/in-progress/spec-sync-websocket-protocol-gaps.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, 리뷰 산출물)뿐이며 전부 **같은 의미**
  (서버가 예정된 유지보수를 알리는 WS 시스템 이벤트)로 쓰인다. 다른 의미의 `system.maintenance` 사용처는
  없다.
- `spec/5-system/6-websocket-protocol.md:1024` (§8, 이미 `_비채택 (won't-do)_` 로 종결된 표)에
  "1001 | 서버 종료/**유지보수** | 함" 이라는 텍스트가 있으나, 이는 close code 1001 의 **설명 문구**(plain
  단어 "유지보수")이지 `system.maintenance` 라는 식별자가 아니다. 식별자 레벨 충돌 아님 — 참고용으로만
  기록.
- 서버발신 app ping — 새 이벤트명을 만들지 않는다. §5.1 이 확정한 Socket.IO 내장
  `pingInterval`/`pingTimeout` 및 §5.2 의 기존 client→server `ping`/`pong` 식별자를 그대로 인용한다.

### 5. 환경변수·설정키 충돌 — 해당 없음
`codebase/` 전체에서 `MAINTENANCE` 문자열 등장 **0건** (grep 실측). target 은 유지보수 선언 주체(관리자
API/설정/스케줄)를 **의도적으로 만들지 않기로** 하는 결정이므로 애초에 신규 설정키가 없다 — Rationale
본문도 "그 표면을 만드는 것은 spec-impl 갭 메우기가 아니라 신규 제품 기능" 이라며 신설을 명시적으로
보류한다.

### 6. 파일 경로 충돌 — 충돌 없음, 컨벤션 부합
`plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` 는:
- 기존에 동일 경로 파일 없음 (target 자신 외 매치 0건).
- `spec-draft-<영역>-<설명>.md` 명명 패턴이 기존 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
  `spec-draft-eia-notification-payload-contract.md` 와 일관된다.

## 신설 Rationale ID `R-wontdo-maintenance-appping` — 상세 검증

- **충돌 없음**: repo 전체 grep 결과 이 문자열은 target 문서 자신과 그 프롬프트 사본에만 등장한다. 기존
  spec Rationale 목록(전수 열거, 약 120개 `### R-*` 헤더 확인) 어디에도 동일/유사 슬러그 없음.
- **명명 규약 부합**: 같은 파일의 선례 `R-wontdo-rawws-rest`(`:1093`) 와 동일한 `R-wontdo-<slug>` 패턴을
  따른다. 타 spec 의 `R-wontdo-cached-capabilities`(`11-mcp-client.md`),
  `R-wontdo-async-fanin`(`4-nodes/1-logic/11-merge.md`) 도 같은 패턴 — 저장소 전체에서 "비채택 결정"
  Rationale 에 `R-wontdo-*` 를 쓰는 것이 이미 확립된 관례이며 target 이 이를 정확히 따른다.
- **참고 (INFO)**: `6-websocket-protocol.md` 자체에는 `chat-channel.md`/`chat-channel-adapter.md` 같은
  명시적 "Rationale ID 컨벤션" 절이 없다 — 기존 Rationale 헤더가 `R-N` / `R-wontdo-*` / 순수 서술형 제목이
  혼재한다. target 은 기존 관례(슬러그형 `R-wontdo-*`)를 그대로 따랐으므로 문제는 없으나, 이 파일에 향후
  Rationale 이 더 늘어나면 (chat-channel 계열처럼) 명시적 ID 컨벤션 절을 두는 편이 다음 신설 시 충돌
  방지에 도움이 될 것 — 강제 사항 아님.

## 발견사항

없음 — target 이 새로 도입하는 유일한 식별자(`R-wontdo-maintenance-appping`)는 repo 전체 grep 으로
충돌 부재를 확인했고 기존 명명 관례에 정확히 부합한다. 그 외 5개 점검 관점(요구사항 ID·엔티티/DTO·API
endpoint·이벤트명·환경변수·설정키)에는 target 이 신규 식별자를 아예 도입하지 않는다 — `system.maintenance`
· app ping 은 기존 spec 식별자를 상태만 재분류할 뿐 재정의하지 않는다.

## 요약

target 문서는 새 식별자를 사실상 하나(`R-wontdo-maintenance-appping`)만 도입하며, 그 ID 는 repo 전체
grep 으로 충돌 부재가 확인됐고 같은 파일의 선례(`R-wontdo-rawws-rest`) 및 타 spec 의 `R-wontdo-*` 관례와
정확히 일치한다. `system.maintenance` 이벤트명·app ping 관련 서술은 신규 도입이 아니라 §4.6/§5 에 이미
존재하는 식별자의 상태 재분류이며, backend 코드·타 spec 어디에도 다른 의미로 쓰이는 곳이 없다(전수 grep
0건). 요구사항 ID·엔티티/DTO·API endpoint·환경변수/설정키 관점은 target 이 아무것도 신설하지 않아 애초에
충돌 표면이 없고, 신설 plan 파일 경로도 기존 `spec-draft-*` 명명 컨벤션에 부합한다. 신규 식별자 충돌
관점에서 이 target 은 사실상 무해하다.

## 위험도
NONE

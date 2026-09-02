# 신규 식별자 충돌 검토 — `spec-draft-ws-badge-flip-tracker-close.md`

## 검토 요약

target 문서를 실측한 결과, 이 draft 는 **새 식별자를 도입하지 않는다.** 내용 전체가 이미
존재하는 식별자(이벤트명 `auth.token_expired`, Rationale ID `R-ws-socket-lifetime-binds-token`,
spec 파일 `6-websocket-protocol.md`/`2-api-convention.md`)의 **상태 배지 전이·트래커 종결·
plan 파일 이동**에 국한된다. 신규 요구사항 ID·엔티티·DTO·API endpoint·이벤트명·ENV var 는
단 하나도 새로 만들지 않는다. 아래는 점검 관점별 실측 근거다.

### 발견사항

관점별로 확인했으나 **CRITICAL/WARNING 급 충돌 없음.**

- **[INFO]** Rationale ID `R-ws-socket-lifetime-binds-token` 재사용 확인 — 신규 발급 아님
  - target 신규 식별자: 없음 (target 이 이 ID 를 새로 만드는 것이 아니라, 이미
    `spec/5-system/6-websocket-protocol.md:1135` 에 존재하는 ID 에 "구현 완료" 한 줄을
    보태는 것)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:52,1100,1133,1135` (선언),
    `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md:139`,
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:11,58`,
    `plan/in-progress/spec-sync-websocket-protocol-gaps.md:52,106`
  - 상세: `grep -rn "R-ws-socket-lifetime-binds-token" spec/ plan/` 로 전수 확인. 정의는
    `6-websocket-protocol.md:1135` 단 한 곳이고 나머지는 전부 참조. target 의 item 9(변경안
    표)는 이 기존 정의에 문구를 추가할 뿐 새 ID 를 발급하지 않는다. 충돌 없음.
  - 제안: 없음 (문제 없음, 확인용 기록).

- **[INFO]** 이벤트명 `auth.token_expired` 는 target 이전에 이미 spec 에 정의된 식별자
  - target 신규 식별자: 없음 — target 은 이 이벤트의 `_(계획·미구현)_` 배지만 제거한다
    (§4.6 표, `6-websocket-protocol.md:876` 부근)
  - 기존 사용처/잠재 혼동원: `spec/1-data-model.md:300` 의 `Integration.status_reason`
    값 `token_expired` (DB 컬럼 값, snake_case) 와 `spec/data-flow/8-notifications.md:347`
    의 점표기 예시 나열
  - 상세: 두 곳 모두 이미 **"별개 네임스페이스"** 임을 spec 본문이 명시적으로 각주 처리하고
    있다 (`data-model.md:300` — *"JWT 만료 REST 에러 `TOKEN_EXPIRED`·WebSocket 이벤트
    `auth.token_expired` 와 표기가 유사하나 별개 네임스페이스"*). `6-websocket-protocol.md`
    §4.6 표 자체도 *"`TOKEN_EXPIRED` 는 REST/JWT 검증 에러 코드일 뿐 이 WS 이벤트와 다르다"*
    라고 이미 명문화했다. target 의 변경표는 이 두 자리를 **"변경 없음"** 으로 명시적으로
    판정해 두었고, 실측 결과도 그와 일치한다 — 이름 유사 혼동은 실재하지만 **target 이 새로
    만든 충돌이 아니라 선행 planner 턴(`spec-draft-ws-socket-lifetime-binds-token.md`)이 이미
    발견·문서화·처분한 것**이다.
  - 제안: 없음 (이미 처분됨, 재조치 불요).

- **[INFO]** `2-api-convention.md §10.4` 위임 한 줄 — 신규 섹션/앵커 아님
  - target 신규 식별자: 없음 — target 은 기존 `### 10.4 재연결` (spec/5-system/2-api-convention.md:313)
    에 한 줄만 추가한다
  - 기존 사용처: 해당 절 번호(`10.4`)는 파일 내 유일하게 한 번만 등장 (`grep -n "10\.4"` 확인).
    번호 충돌 없음.
  - 상세: target 은 "복제 대신 위임"을 명시적으로 선택해 §6.1/§9.2 를 정본으로 유지한다.
    새 식별자·새 필드명을 만들지 않으므로 충돌 표면 자체가 생기지 않는다.
  - 제안: 없음.

- **[INFO]** plan 파일 3건의 `complete/` 이동 — 경로 충돌 없음
  - target 신규 식별자: 없음 — 새 파일을 만드는 게 아니라 기존 3개
    (`spec-sync-websocket-protocol-gaps.md`, `spec-draft-ws-wontdo-maintenance-appping.md`,
    `spec-draft-ws-socket-lifetime-binds-token.md`)를 `plan/in-progress/` → `plan/complete/`
    로 옮긴다
  - 기존 사용처: `find plan/complete -iname "*websocket-protocol-gaps*" -o -iname
    "*ws-wontdo-maintenance-appping*" -o -iname "*ws-socket-lifetime-binds-token*"` 실행
    결과 **0건** — 동일 파일명이 `complete/`(또는 `complete/archive/`)에 이미 존재하지
    않음을 확인
  - 상세: 파일 경로 충돌(점검 관점 6) 없음. 명명 컨벤션(`spec-sync-*-gaps.md`,
    `spec-draft-*.md`)도 기존 패턴 그대로 유지한다.
  - 제안: 없음.

### 요약

target(`spec-draft-ws-badge-flip-tracker-close.md`)은 신규 요구사항 ID·엔티티/DTO·API
endpoint·이벤트명·ENV var·config key 를 **전혀 도입하지 않는 순수 상태-전이/트래커-종결
문서**다. 유일하게 참조하는 식별자 `R-ws-socket-lifetime-binds-token`·`auth.token_expired`
는 모두 선행 planner 턴에서 이미 등재·처분된 것이며, `grep -rn` 전수 확인 결과 각 식별자는
정의처가 단일하고 이름-유사 혼동 지점(REST `TOKEN_EXPIRED`·DB `status_reason='token_expired'`)
은 이미 spec 본문이 "별개 네임스페이스"로 명시적으로 갈라 두었다. plan 파일 이동 3건도
`plan/complete/`에 동명 파일이 없어 경로 충돌이 없다. 신규 식별자 충돌 관점에서 이 draft 는
위험이 없다.

### 위험도

NONE

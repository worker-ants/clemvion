# 신규 식별자 충돌 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 검토 범위 요약

target 문서가 실제로 새로 도입하는 식별자는 다음 세 가지뿐이다 (나머지는 기존 식별자의
서술/상태 변경):

1. `auth.token_expired` 이벤트의 payload 필드 `expiresAt` (기존 `{ message }` → `{ message, expiresAt }`)
2. Rationale 헤딩 ID `R-ws-socket-lifetime-binds-token`
3. `6-websocket-protocol.md` §6.1 의 "서버발신 disconnect 는 자동 재연결 대상이 아니다" 예외 서술 (신규 식별자는 아니고 기존 규칙에 대한 예외 텍스트)

`auth.token_expired` 이벤트 이름 자체는 신규가 아니다 — `6-websocket-protocol.md:871`에
이미 `_(계획·미구현)_` 상태로 존재한다. target 은 그 payload 만 확장한다.

## 발견사항

- **[WARNING]** `expiresAt` 필드명이 같은 문서 안에서 이미 두 가지 다른 의미로 쓰이고 있는데, target 은 세 번째 의미를 더한다
  - target 신규 식별자: `auth.token_expired` payload 의 `expiresAt` (의미: **이 소켓이 끊기는 시각**)
  - 기존 사용처:
    - `spec/5-system/6-websocket-protocol.md:448` `_retryState.expiresAt` — **살아있는 프로덕션 필드**. AI Agent retry-state 의 TTL(`AI_RETRY_STATE_TTL_MINUTES`)을 의미하며 `RETRY_STATE_NOT_FOUND` 판정에 쓰인다. §4.2, ISO 8601 문자열.
    - `spec/5-system/6-websocket-protocol.md:64` `auth.refreshed.expiresAt` — target 이 스스로 인용하는 비교 대상이지만, 이 이벤트 자체가 §1.3 에서 **비채택(won't-do)** 으로 확정된 죽은 참고 예시다(실제 emit/handler 0건). "새 토큰의 만료 시각"을 의미한다.
  - 상세: target 은 새 필드의 이름 재사용 위험을 스스로 인지하고 있다 ("`auth.refreshed.expiresAt`… 과 이름은 같지만 가리키는 대상이 다르므로 §4.6 표에 그 뜻을 명시한다", target 문서 §"payload 를 `{ message }` → `{ message, expiresAt }` 로"). 다만 인용한 비교 대상이 **이미 won't-do 로 죽은 이벤트**라서 실제 충돌 위험의 크기를 과소평가하게 만든다. 진짜 위험은 오히려 **살아있는** `_retryState.expiresAt` 쪽이다 — 같은 문서, 같은 타입(ISO 8601 문자열), 이름이 완전히 같고 의미(TTL 만료 vs 소켓 disconnect 시각)만 다르다. `auth.token_expired`(§4.6)와 `RETRY_STATE_NOT_FOUND`(§4.2)는 섹션이 멀어 직접 인접 비교는 안 되지만, 문서 전체를 `expiresAt` 로 검색하면 세 가지 뜻이 나온다는 사실은 변하지 않는다.
  - 제안: target 이 이미 약속한 "§4.6 표에 그 뜻을 명시한다"를 실제 spec 반영 시 **`auth.refreshed.expiresAt` 뿐 아니라 `_retryState.expiresAt`와도 구분되는 문구**로 채워 넣을 것. 예: "`expiresAt`: 이 소켓이 강제 종료되는 시각(ISO 8601) — `_retryState.expiresAt`(AI retry TTL)·`auth.refreshed.expiresAt`(비채택, 새 토큰 만료 시각)와는 별개 필드다." 이름 자체를 `socketExpiresAt`/`disconnectAt` 등으로 바꾸는 대안도 있으나, 문서가 이미 "동일 문서 내 같은 시각 필드는 `expiresAt` 표기로 통일" 관례를 두 곳(§1.3 예시·§4.2)에서 쓰고 있어 이름 재사용 자체는 이 문서의 기존 관례에 부합한다 — 따라서 리네임보다는 **명시적 disambiguation 문구 보강**이 더 관례 정합적인 해법이다.

- **[INFO]** `auth.token_expired` 문자열이 이미 별개 도메인(Cafe24/Makeshop 연동)의 `Integration.statusReason` 값으로 존재 — 이미 명시적으로 분리돼 있어 조치 불요
  - target 신규 식별자: 해당 없음 (target 이 새로 만드는 이름이 아니라 기존 이벤트 이름의 payload 확장)
  - 기존 사용처: `codebase/backend/src/modules/integrations/integration-status-reason.ts:18-20` — `'token_expired'` 문자열이 `Integration.statusReason` enum 값으로 존재하며, 주석이 *"DB-only 슬러그 — JWT REST 에러 코드 `TOKEN_EXPIRED` · WS 이벤트 `auth.token_expired` 와 별개 네임스페이스"* 라고 명시적으로 선언한다.
  - 상세: target 문서 §배경 표에서도 FE grep 결과로 "유일 히트는 integration `statusReason` — 별개 네임스페이스"라고 정확히 인용하고 있다. 실측 확인 결과 그 인용은 정확하다 — 코드 주석이 이미 두 네임스페이스를 명시적으로 분리해 두었고, target 은 이를 새로 충돌시키지 않는다.
  - 제안: 조치 불필요. target 의 배경 조사가 정확했음을 확인하는 차원의 기록.

- **[INFO]** 신규 Rationale ID `R-ws-socket-lifetime-binds-token` — 저장소 전체에서 유일하며, 기존 명명 관례(`R-<slug>` 형식)를 따른다
  - target 신규 식별자: `R-ws-socket-lifetime-binds-token` (`6-websocket-protocol.md` `## Rationale` 신설 항목)
  - 기존 사용처: 없음. 저장소 전체 `grep -rn "R-ws-socket-lifetime-binds-token"` 결과 target 자기 자신 외 0건.
  - 상세: 같은 문서의 `R-wontdo-rawws-rest`·`R-wontdo-maintenance-appping`, 그리고 `14-external-interaction-api.md`의 `R-outbound-flood`·`R-replay-unavailable`, `11-mcp-client.md`의 `R-wontdo-cached-capabilities` 등과 동일한 `### R-<kebab-slug>. <제목> (결정 <날짜>)` 패턴이다. won't-do 가 아닌 결정에도 `R-` 접두 ID를 붙이는 선례(`R-outbound-flood`, `R-replay-unavailable`)가 이미 있어 형식 자체는 관례에 부합한다. 다만 슬러그 길이가 선례(2단어)보다 길다(5단어) — 순수 스타일 차이이며 충돌 아님.
  - 제안: 조치 불필요.

## 파일 경로 · API endpoint · 환경변수 검토

- **파일 경로**: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` — 동일 디렉터리 내 `spec-draft-ws-wontdo-maintenance-appping.md`와 같은 `spec-draft-ws-<slug>.md` 명명 패턴을 따르며, 기존 파일과 이름이 겹치지 않는다. 문제 없음.
- **API endpoint**: target 은 기존 REST `/auth/refresh` (이미 §1.3 에 정의됨)를 그대로 재사용할 뿐 신규 endpoint 를 추가하지 않는다. 문제 없음.
- **환경변수·설정키**: target 은 lead time "60초"를 spec 본문에 상수로 박아 두기로 결정했고 (Rationale: "구현 자유도로 두면 클라이언트가 최악값을 가정"), 신규 ENV var/config key 이름을 도입하지 않는다. 따라서 충돌 대상 자체가 없다. `AI_RETRY_STATE_TTL_MINUTES`처럼 향후 env var 화될 경우 이름 선정 시 `_retryState` 계열과 구분되는 이름을 쓰라는 점만 참고할 만하나, 지금은 도입되지 않으므로 발견사항으로 등재하지 않는다.
- **엔티티/타입/요구사항 ID**: 신규 DTO·인터페이스·형식 요구사항 ID(`REQ-*` 류) 도입 없음.

## 요약

target 이 실제로 도입하는 새 식별자는 `auth.token_expired.expiresAt` 필드와 Rationale ID
`R-ws-socket-lifetime-binds-token` 둘뿐이며, 둘 다 CRITICAL 급 충돌(동일 식별자가 이미 다른
의미로 실사용 중)은 없다. 다만 `expiresAt` 필드명은 같은 문서 안에서 이미 두 가지(하나는
살아있는 `_retryState.expiresAt`, 하나는 target 이 인용했지만 실은 죽은 `auth.refreshed.expiresAt`)
의미로 쓰이고 있어, target 이 세 번째 의미를 얹는 것은 WARNING 수준의 명명 혼동 위험이다.
target 스스로 disambiguation 을 §4.6 반영 시 넣겠다고 이미 계획했으므로 조치 자체는 이미
경로 위에 있지만, 인용 대상을 살아있는 `_retryState.expiresAt`까지 넓혀야 완전하다. 그 외
API endpoint·ENV var·파일 경로·엔티티명 축에서는 신규 도입이 없거나 기존 관례에 정합해
충돌이 없다.

## 위험도

LOW

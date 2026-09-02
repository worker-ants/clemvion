# 신규 식별자 충돌 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 검토 대상

target: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` (spec draft, `--spec` 모드)
적용 대상: `spec/5-system/6-websocket-protocol.md` §1.2 · §1.3 · §4.6 · Rationale

target 이 실제로 새로 도입하는 식별자는 3종뿐이다:
1. WS 이벤트 payload 필드 `expiresAt` (`auth.token_expired` 에 추가)
2. Rationale ID `R-ws-socket-lifetime-binds-token`
3. (구현 메모, spec 범위 밖) `handleDisconnect` 에서의 타이머 해제 — 새 식별자 아님, 기존 NestJS 훅 재사용

이벤트 이름 `auth.token_expired` 자체는 **신규가 아니다** — `spec/5-system/6-websocket-protocol.md:871`, `spec-sync-websocket-protocol-gaps.md:23`, `spec/1-data-model.md:300` 에 이미 Planned 이벤트로 등재되어 있고, target 은 그 기존 이벤트의 동작(사전 통지 + disconnect)과 payload 를 정의할 뿐 새 이름을 붙이지 않는다.

## 발견사항

- **[INFO]** `expiresAt` 필드명 재사용 — 기존 convention 과 정합
  - target 신규 식별자: `auth.token_expired` payload 필드 `expiresAt` (`{ message, expiresAt }`)
  - 기존 사용처: 동일 파일 `spec/5-system/6-websocket-protocol.md:64` (`auth.refreshed` payload `{ expiresAt }`), `:448`(`_retryState.expiresAt`) 외 `spec/5-system/1-auth.md:240,243`(초대 토큰) · `spec/5-system/14-external-interaction-api.md:269,539,693`(interaction token) · `spec/5-system/12-webhook.md:82,195` · `spec/5-system/17-agent-memory.md:125` · `spec/4-nodes/3-ai/1-ai-agent.md:967,979` · `spec/conventions/node-output.md:257` 등 최소 10곳 이상.
  - 상세: 이 저장소는 "ISO 8601 만료 시각" 을 나타내는 필드에 항상 `expiresAt` 을 쓰는 확립된 명명 관례가 있다(토큰·retryState TTL·agent memory TTL 등 도메인이 전부 다름). target 이 같은 이름을 같은 의미(만료 시각)로 재사용하는 것은 **충돌이 아니라 관례 준수**다. 다만 같은 파일 안에서 `auth.refreshed.expiresAt`(새로 발급된 토큰의 만료 시각)과 `auth.token_expired.expiresAt`(현재 연결이 끊길 시각)은 **의미가 미묘하게 다른 두 이벤트**이므로, 두 이벤트를 동시에 다루는 클라이언트 코드에서 "이 `expiresAt` 이 어느 토큰의 것인가" 를 이벤트 `type` 없이 재사용하면 혼동 여지가 있다.
  - 제안: 별도 조치 불필요 (이름 충돌 아님). 클라이언트 구현 시 이벤트 `type` 으로 분기하는 것을 자명하게 하기 위해 §4.6 표의 `expiresAt` 설명에 "이 소켓이 끊기는 시각" 임을 한 번 더 못박아 두면(target 초안이 이미 "사전 통지 + disconnect" 로 설명을 교체하므로 충분) 충분하다.

- **[INFO]** Rationale ID `R-ws-socket-lifetime-binds-token` — 충돌 없음, 명명 규약과도 정합
  - target 신규 식별자: `R-ws-socket-lifetime-binds-token`
  - 기존 사용처: 전체 `spec/` 에서 `grep -rn "^### R-"` 전수 확인 결과 동일/유사 ID 없음(`R-wontdo-rawws-rest`, `R-wontdo-maintenance-appping`, `R-outbound-flood`, `R-replay-unavailable`, `R-CC-*`, `R-D-*`, `R-S-*`, `R-K`, 파일별 `R-0`/`R-1`/`R-2`… 등 전수 스캔, 겹치는 slug 없음).
  - 상세: `6-websocket-protocol.md` 는 이미 서술형 slug 방식의 Rationale ID(`R-wontdo-rawws-rest`, `R-wontdo-maintenance-appping`)를 쓰고 있어 순번(`R-0`/`R-1`) 대신 서술형 slug 를 쓰는 target 의 선택은 그 파일의 기존 로컬 관례와 일치한다.
  - 제안: 없음 — 그대로 사용 가능.

- **[INFO]** 동일 target 파일에 동시에 걸린 자매 draft 와의 라인 충돌 없음 (신규 식별자 충돌 범주는 아니나 인접 리스크로 기록)
  - target 신규 식별자: 해당 없음 (좌표만 겹칠 위험 점검)
  - 기존 사용처: 같은 배치에서 병행 검토 중인 `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` 도 동일 파일 `spec/5-system/6-websocket-protocol.md` 를 수정 대상으로 한다.
  - 상세: 두 draft 가 건드리는 §4.6 표 행은 서로 다르다 — target 은 `:871`(`auth.token_expired` 행), 자매 draft 는 `:872`(`system.maintenance` 행). 실측(`sed -n '868,873p'`)으로 두 줄이 인접하지만 별개 행임을 확인했고, 두 draft 모두 상대방이 "잔여 1종"/"Planned 로 남는다" 로 서로의 범위를 명시적으로 인정하고 있어 **이벤트 이름·Rationale ID 수준에서 충돌은 없다**. 단, 두 draft 가 같은 세션에서 순차 적용되면 후속 적용 시 라인 번호가 밀릴 수 있으므로 이는 identifier 충돌이 아니라 병합 순서 문제로, 이 checker 의 점검 관점(요구사항 ID·엔티티·endpoint·이벤트명·env var·파일 경로) 밖이다.
  - 제안: 없음 (참고용 기록).

## 요약

target 이 새로 도입하는 식별자는 WS payload 필드 `expiresAt` 과 Rationale ID `R-ws-socket-lifetime-binds-token` 두 가지뿐이며, 이벤트 이름 `auth.token_expired` 자체는 기존에 Planned 로 이미 등재된 것을 재사용(의미 확장)하는 것이라 신규 식별자가 아니다. `expiresAt` 은 이 저장소 전역에서 "만료 시각" 을 뜻하는 확립된 필드명 관례를 그대로 따르므로 충돌이 아니라 오히려 일관성 준수 사례이며, Rationale ID 도 `spec/` 전수 검색상 중복이 없고 해당 파일의 기존 slug 관례와 정합한다. 요구사항 ID·엔티티/타입명·API endpoint·환경변수·spec 파일 경로 관점에서는 target 이 아무것도 신규로 만들지 않아 검토 대상 자체가 없다. 신규 식별자 충돌 관점에서 우려할 사항은 발견되지 않았다.

## 위험도

NONE

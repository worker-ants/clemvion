# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

이 세션의 `--impl-done` 번들은 `spec/5-system/` 전체(94개 파일)를 적재하려다 컨텍스트 예산을
초과해 실제 diff(`## 구현 변경 사항`)가 프롬프트에 전혀 포함되지 않았고, 번들 파일도
`1-auth.md` · `2-api-convention.md` · `1-data-model.md` 세 개만 전문이 실리고 나머지는
헤더만 남았다. 프롬프트만으로는 판정이 불가능해 워킹트리를 절대경로로 직접 열어 실제
diff(`git -C <worktree> diff origin/main...HEAD`)와 관련 spec 원문을 재구성했다.

- **spec/5-system/ 델타**: 0개 파일 (이 브랜치는 spec 을 바꾸지 않았다 — 정상)
- **구현 diff**: `codebase/backend/src/modules/websocket/{websocket.gateway.ts, websocket-events.types.ts}`
  (+테스트) · `codebase/frontend/src/lib/websocket/ws-client.ts`(+테스트) · 사용자 가이드
  `password-and-sessions.{mdx,en.mdx}` · `CHANGELOG.md` · `plan/in-progress/*` 2건.
  내용: **WS 소켓 수명을 access token 수명(15분)에 종속** — 서버가 만료 60초 전
  `auth.token_expired` 를 emit 하고 `exp` 도달 시 `disconnect()`, 클라이언트는 REST 재발급 +
  명시적 재연결로 대응. 이 결정 자체(§1.2/§4.6/§9.2/Rationale `R-ws-socket-lifetime-binds-token`)는
  이 diff 이전에 이미 `spec/5-system/6-websocket-protocol.md` 에 반영돼 있었고(커밋
  `6ffadb1f4`, `#1265`), 이번 diff 는 그 spec 이 "Planned" 로 남겨둔 부분을 구현만 한다.

## 발견사항

- **[WARNING]** `2-api-convention.md §10.4` 의 "지수 백오프 자동 재연결 + 마지막 이벤트 ID
  재전송" 서술이 실제(그리고 이 PR 로 상시 발생하게 된) WS 재연결 모델과 어긋난다
  - target 위치: 이번 diff (`websocket.gateway.ts` `armExpiryTimers`/`handleDisconnect`,
    `ws-client.ts` `refreshAndReconnect`/`socket.on("disconnect", …)`) — 서버발신
    `disconnect()`(토큰 자연 만료, §1.2)마다 발동하는 경로
  - 충돌 대상: `spec/5-system/2-api-convention.md` §10.4 (라인 313-317)
  - 상세: `2-api-convention.md` §10.4 는 "연결 끊김 시 지수 백오프로 재연결(1s→30s)"·"재연결
    시 마지막 수신 이벤트 ID 전달 → 놓친 이벤트 재전송" 이라고 **무조건** 서술한다. 그러나
    `6-websocket-protocol.md` §6.1/§1.2 는 **서버발신 `disconnect()`(reason
    `"io server disconnect"`)에는 Socket.IO 자동 재연결이 발화하지 않는다**고 명시하고,
    이 diff 가 구현한 토큰 만료 종료가 정확히 그 경로다 — 자동 백오프가 아니라 클라이언트가
    `auth.token_expired`/`disconnect` 이벤트를 받아 **명시적으로** `socket.connect()` 를
    호출해야 한다. 복구 메커니즘도 "마지막 이벤트 ID 재전송"이 아니라 재구독 시
    `execution.snapshot`(현재 전체 상태 1회 발행) 방식이다 — "seq 기반 정밀 재전송"은 내부
    WS 가 아니라 별도 전송인 EIA SSE(`Last-Event-Id`, 5분 버퍼)의 몫이라고
    `6-websocket-protocol.md §6.2`·Rationale("재연결 복구 — native WS 는 snapshot, seq
    버퍼-replay 는 SSE 전송")이 이미 정정해 두었다. 즉 `2-api-convention.md §10.4` 는 그
    정정 이전의 서술이 그대로 남아 있다. 이 gap 자체는 이번 diff 가 만든 것은 아니지만(spec
    델타 0), 종전에는 `auth.token_expired` 서버 emit 이 미구현이라 이 예외 경로가 실제로
    발동한 적이 없었고, 이번 구현으로 **접속 중인 모든 사용자에게 15분 주기로 상시
    발생하는 경로**가 됐다 — 잠재 문서 불일치가 운영상 유의미해졌다
  - 제안: `2-api-convention.md §10.4` 에 "단, 서버발신 `disconnect()`(§1.2 토큰 만료)는
    자동 재연결 대상이 아니며 명시적 재연결이 필요하다"는 예외 한 줄과, "마지막 이벤트 ID
    재전송"은 EIA(SSE) 전용이고 native WS 는 `execution.snapshot` 방식임을 반영. 이 문서는
    `spec/5-system/` 안이라 developer 자기-반증형 소정정 대상은 아니다(요구사항·계약
    표라기보다 안내문에 가까우나, §10.4 예시 원저자가 아니므로) — planner 턴으로 처리 권장.

- **[INFO]** target 파일(`spec/5-system/6-websocket-protocol.md`) 자체가 이번 구현을
  아직 "계획·미구현"으로 표기 중
  - target 위치: `spec/5-system/6-websocket-protocol.md` §1.2(라인 52) · §4.6 이벤트 표
    (라인 876) · Rationale (라인 1100, 1133) — `auth.token_expired` 서버 emit을
    `_(계획·미구현)_`/"Planned" 로 표기
  - 충돌 대상: 이번 diff 의 실제 구현 (`websocket.gateway.ts` `AuthEventType.AUTH_TOKEN_EXPIRED` emit 완성)
  - 상세: 이건 다른 영역과의 충돌이 아니라 target 문서 자신의 상태 배지가 이번 diff 로
    stale 해진 것이다 — 엄밀히는 cross-spec 범위 밖이지만 target 이 spec/5-system/ 전체라
    기록해 둔다. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 이미
    "머지 후 planner 턴 — spec 배지 flip 은 developer 권한 밖(자기-반증형 소정정 예외
    비대상)"으로 정확히 스코프를 갈라 체크리스트에 남겨 두었으므로 새로운 결함이 아니라
    이미 트래킹된 잔여 작업이다
  - 제안: 없음(추가 조치 불요) — 다음 planner 턴에서 배지만 flip

## 확인했으나 충돌 없음 (정합 확인)

- **Access token TTL**: 코드 주석의 "900초의 6.7%(=60초)"·docs 의 "최대 15분"이
  `spec/5-system/1-auth.md §2.1`(Access Token 15분)과 정확히 일치
- **Revoke 카브아웃**: "명시적 revoke(비번 변경·family revoke)는 이미 발급된 access token 을
  무효화하지 않는다"는 이번 구현의 전제가 `1-auth.md §2.3`(강제 종료·비밀번호 변경 시
  refresh family 만 revoke, access token 블록리스트 없음)과 모순 없이 정합
- **네임스페이스 3중 구분**: `auth.token_expired`(WS 이벤트) vs `token_expired`
  (`Integration.status_reason` DB 슬러그) vs `TOKEN_EXPIRED`(REST/JWT 에러 코드) — 새
  JSDoc 의 구분 서술이 `spec/1-data-model.md`(라인 300)의 기존 구분 문구·
  `integration-status-reason.ts` 의 기존 코드 주석과 정확히 일치, 새로운 명명 충돌 없음
- **EIA(External Interaction API) SSE 와의 경계**: `14-external-interaction-api.md` 는
  이미 native WS(snapshot 모델)와 SSE(`Last-Event-Id` 5분 버퍼)가 별개 전송·별개 복구
  메커니즘임을 명시하고 있어 이번 변경과 상충하지 않음(EIA 의 별도 토큰 체계 — `iext_`/`itk_`
  — 도 사용자 JWT 와 무관해 겹치지 않음)
- **RBAC/계층 책임**: 타이머 로직이 기존에도 connection 생명주기(`handleConnection`/
  `handleDisconnect`)를 소유하던 `websocket.gateway.ts` 안에 머무르고, 재발급·재연결
  로직은 기존에도 REST 세션 갱신을 담당하던 프런트 `ws-client.ts` 에 머묾 — 계층 경계 이동 없음
- **데이터 모델**: 신규 엔티티·DB 컬럼 없음(순수 in-memory 타이머 + WS 이벤트)이라
  `spec/1-data-model.md` 와 충돌 없음

## 요약

이번 diff 는 `spec/5-system/6-websocket-protocol.md` 가 이미 확정해 둔 결정
(`R-ws-socket-lifetime-binds-token`)의 구현일 뿐이라 spec 델타가 0 이며, 실제로 검토해 보니
관련된 다른 spec 영역(`1-auth.md` 의 토큰 TTL·revoke 의미, `1-data-model.md` 의 네임스페이스
구분, EIA 의 별도 SSE 전송 모델)과 값·문구가 정확히 일치해 CRITICAL 급 모순은 없다. 다만
`2-api-convention.md §10.4` 의 일반화된 재연결 서술("자동 백오프 + 마지막 이벤트 ID 재전송")이
`6-websocket-protocol.md` 가 이미 문서화한 예외(서버발신 disconnect 는 자동 재연결 대상 아님,
복구는 snapshot 방식)를 반영하지 못한 채로 남아 있고, 이번 구현으로 그 예외가 상시
발동 경로가 되면서 그 gap 의 실질적 영향이 커졌다 — WARNING 으로 등재해 다음 planner 턴에서
§10.4 를 정정할 것을 권한다. target 문서 자신의 "Planned" 배지 잔존은 이미 plan 에 올바르게
트래킹돼 있어 추가 조치가 필요 없다.

## 위험도

LOW

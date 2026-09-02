# Plan 정합성 검토 — `spec/5-system/` (`--impl-prep`)

## 검토 범위 요약

번들에는 `spec/5-system/1-auth.md` 전문만 실렸고 나머지 16개 파일(`6-websocket-protocol.md`
포함)은 예산 초과로 생략됐다. 이번 리뷰의 실질 대상은 착수 대기 중인
`plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(`auth.token_expired` 구현)이고,
그 plan 의 근거 문서가 `spec/5-system/6-websocket-protocol.md` §1.2·§1.3·§4.6·§6.1·§9.2 +
Rationale `R-ws-socket-lifetime-binds-token` 이라 생략 지시("판정에 관련되면 Read 로 직접
열어라")에 따라 해당 spec 파일을 직접 열어 대조했다.

## 발견사항

- **[WARNING]** `spec-draft-ws-socket-lifetime-binds-token.md` 의 체크리스트가 실제 완료 상태를
  반영하지 못한다
  - target 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (착수 대기 plan) —
    이 plan 의 전제("`R-ws-socket-lifetime-binds-token`(`#1265`)로 spec 확정됨")가 실제로
    맞는지 확인하는 과정에서 발견
  - 관련 plan: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` 체크리스트
    (`:190`~`:192`)
  - 상세: 이 draft plan 은 커밋 `6ffadb1f4`(`#1265`, 2026-09-02)에서 **신설**되었고, **같은
    커밋**이 `spec/5-system/6-websocket-protocol.md`(+35줄)와
    `spec-sync-websocket-protocol-gaps.md`(+33줄)를 함께 갱신했다. 직접 `Read` 로 확인한 결과
    §1.2(`:52`)·§1.3(`:59-72`)·§4.6(`:876`)·§6.1 예외(`:969`)·§9.2(`:1060-1062`)·Rationale
    `R-ws-socket-lifetime-binds-token`(`:1135-1148`) 이 **전부 이미 반영되어 있다** — draft 의
    "변경안 8곳" 표가 약속한 자리와 실제 spec 본문이 1:1로 일치한다. `spec-sync-websocket-protocol-gaps.md`
    도 "결정 완료 (2026-09-02 사용자 결정) — 구현 착수 가능"으로 이미 갱신돼 있다(draft 변경안
    #9·#10 도 반영 확인). 그런데도 draft plan 체크리스트는 여전히
    `- [ ] spec 반영 (…)`·`- [ ] tracker plan 갱신 (…)` 로 미체크 상태다.
  - 제안: `spec-draft-ws-socket-lifetime-binds-token.md` 의 두 체크박스를 `[x]`로 갱신한다(둘 다
    같은 커밋에서 이미 완료). 세 번째 항목 `- [ ] 구현 — developer 트랙, 별 PR`은 지우지 말고,
    그 구현이 **`plan/in-progress/ws-token-expired-socket-lifetime-impl.md`로 이관되었다는
    포인터**를 추가할 것 — 현재 두 plan 파일이 같은 미해결 항목("구현")을 서로 링크 없이 각자
    들고 있어, 다음 사람이 두 plan 을 별개 작업으로 오인하거나 어느 쪽이 정본인지 헷갈릴 수
    있다. (참고: 이 mismatch 는 이번 구현 착수를 막는 결함은 아니다 — 실제 spec 상태는 정확하고
    구현 전제는 충족돼 있다. 순수 plan 위생 이슈다.)

## 확인했으나 문제 없음 (참고)

- **결정 정합성**: `ws-token-expired-socket-lifetime-impl.md` 가 전제하는 "소켓 수명이 토큰
  수명에 종속되는가"·"사전 통지 60초" 결정은 `spec-sync-websocket-protocol-gaps.md`·
  `spec-draft-ws-socket-lifetime-binds-token.md`·`spec/5-system/6-websocket-protocol.md`
  Rationale 세 곳 모두 2026-09-02 확정으로 일치한다. "결정 필요" 로 남겨둔 항목을 developer
  plan 이 일방적으로 결정하는 충돌은 없다.
- **선행 조건**: developer plan 이 명시한 착수 전 실측(access token 900초·`jwtService.verify`
  1곳·gateway `exp`/타이머 0건·FE 구독 0건)은 spec Rationale 의 동일 실측과 값이 일치한다.
  선행 plan(`spec-sync-websocket-protocol-gaps.md`)의 "구현 대기" 표기와도 어긋나지 않는다.
- **`spec/5-system/1-auth.md` — `spec-sync-auth-gaps.md` 대조**: 트래커에 남은 미해결 항목
  (LDAP/SAML §1.3, `workflow.executed` 보존정책 유예, `record()` 호출식 가드 확장 미결,
  `login_history` 관측 축 미결 등)은 모두 spec 본문의 _(미구현·Planned)_ 표기와 정합하며, 이번
  target(`1-auth.md`)이 그 미해결 항목을 우회하거나 번복하는 서술은 없다.
  `auth-guard-reflection-hardening.md` 의 잔여 두 조건부 항목(메모이제이션·`__test-utils__`
  tsconfig exclude)도 auth 스펙 본문과 무관한 코드 레벨 유예이며 충돌 없다.
- **WS won't-do 결정**: `system.maintenance`·서버발신 app ping 비채택(`R-wontdo-maintenance-appping`,
  2026-09-02)도 spec 본문(§4.6·§5, `_(비채택 won't-do)_` 표기)·tracker(`spec-sync-websocket-protocol-gaps.md`
  §비채택 2026-09-02 추가 종결 2종) 양쪽에 이미 반영돼 있어 별도 조치 불필요.

## 요약

이번 `--impl-prep spec/5-system/` 검토의 실질 target 인 `auth.token_expired` WS 구현 착수
(`ws-token-expired-socket-lifetime-impl.md`)는 선행 제품 결정이 확정되어 있고 spec 본문
(`6-websocket-protocol.md`)·tracker(`spec-sync-websocket-protocol-gaps.md`) 양쪽에 정합하게
반영돼 있어 구현 착수를 막는 미해결 결정 충돌이나 선행 plan 미해소는 없다. `spec/5-system/1-auth.md`
쪽도 `spec-sync-auth-gaps.md`·`auth-guard-reflection-hardening.md` 와 어긋나는 서술이 없다.
다만 이 결정을 만든 `spec-draft-ws-socket-lifetime-binds-token.md`의 체크리스트가 같은 커밋에서
이미 완료된 두 항목(spec 반영·tracker 갱신)을 미체크로 남겨 두었고, 남은 "구현" 항목이 방금
신설된 `ws-token-expired-socket-lifetime-impl.md`와 상호 링크 없이 중복 추적되고 있다 —
plan 위생 문제이며 구현을 막지는 않으므로 WARNING 으로 등급한다.

## 위험도

LOW

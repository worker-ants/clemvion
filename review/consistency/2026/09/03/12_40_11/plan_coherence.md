# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위 확인

- 스코프(`spec/5-system/`) 델타: 0개 파일 — 이 브랜치(`claude/ws-carried-info-cleanup`, origin/main 대비 ahead 3)는 spec 을 바꾸지 않았다. 정상.
- 실제 구현 diff(3커밋: `69aad5d5d`·`b75e6a76b`·`80ac92668`)를 워킹트리에서 직접 `git diff origin/main...HEAD`로 재확인:
  - `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 승격
  - `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `expiryTimers` non-optional화, `clearExpiryTimers()` 추출 + `armExpiryTimers` 진입부 선제 해제, `.unref()` 추가
  - `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경을 잠그는 신규 단위 테스트 5건
  - `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 체크리스트 갱신(이월 INFO 5건 종결 + 신규 watch 항목 1건 추가)
- 이 diff 는 `spec/5-system/6-websocket-protocol.md` 가 이미 `implemented` 로 승격·확정한 계약(§1.2·§Rationale `R-ws-socket-lifetime-binds-token`)의 **내부 하드닝**(non-optional 타입·상수 승격·unref·해제 순서)이며, wire 계약·클라이언트 관측 표면을 바꾸지 않는다. `MSG_AUTH_TOKEN_EXPIRING` 값은 종전 리터럴과 동일 문자열이고, spec 은 통지 문구를 verbatim 으로 고정하지 않는다(§1.2 는 "60초 전 1회 emit" 이라는 동작만 계약).

## 발견사항

- **[INFO]** "배포 런북" 참조가 3건 누적됐지만 그런 문서가 저장소에 없다
  - target 위치: (target 은 spec/5-system 이나, 실질 관련 문서는) `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(`만료 타이머 지터`·`셧다운 중 만료 콜백 미실행`·`배포 전환 창 리스크` 3개 항목)
  - 관련 plan: 동일 파일. 세 항목 모두 "배포 런북에 적는다" 를 처방으로 남긴다. 이번 diff 가 세 번째 항목(셧다운 중 만료 콜백 미실행)을 새로 추가했다.
  - 상세: 저장소 전수 검색(`find -iname '*runbook*'`, `.claude/docs/**`, `.claude/skills/**`) 결과 "배포 런북" 이라는 실체 문서·컨벤션이 어디에도 정의돼 있지 않다. 커밋 `80ac92668` 메시지는 "런북 항목을 실제로 만들었다" 고 적지만 그 커밋의 diff 는 gateway 코드·테스트·이 plan 파일만 건드릴 뿐 별도 런북 파일을 만들지 않았다 — 만든 것은 이 plan 안의 체크박스 항목이다. 다만 `.claude/docs/plan-lifecycle.md` §3("미완 항목이 하나라도 남으면 `complete/` 로 옮기지 않는다")에 따라 이 plan 은 5개 미완 항목(e2e 유예 포함) 때문에 `in-progress/` 에 계속 남으므로, 세 위험 항목이 당장 유실될 위험은 낮다 — 추적 SoT 는 사실상 이 plan 자체다.
  - 제안: 차단 사유는 아니다. 다음에 이 패턴이 재발하면(운영 위험 deferral 이 또 늘면) 실제 위치(예: `codebase/backend/docs/` 또는 별도 ops 문서)를 하나 만들어 "배포 런북" 참조를 그리로 수렴시키는 것을 고려. 지금은 plan 자체가 트래커 역할을 하므로 갱신 불요.

## 요약

이번 델타는 이미 `implemented` 로 확정된 `auth.token_expired`/소켓-토큰 수명 종속 계약(spec §1.2, Rationale `R-ws-socket-lifetime-binds-token`)의 내부 견고화(non-optional 타입·상수화·선제 해제 순서·`unref`)로, wire 계약이나 클라이언트 관측 표면을 바꾸지 않아 spec 과 충돌하지 않는다. 남은 5개 미해결 항목(지터·셧다운 중 미통지·배포 전환 창·e2e 유예·flaky 관측)은 모두 "결정 필요/planner 턴 필요" 로 명시적으로 못박혀 있고, 이번 diff 가 그중 어느 것도 일방적으로 선점하거나 건너뛰지 않았다 — 오히려 unref 추가로 새로 생긴 트레이드오프(셧다운 중 통지 누락)를 스스로 찾아 새 watch 항목으로 등재했다. spec Rationale §"타이머의 내성 범위"·§9.2 fallback 경로가 이미 이 트레이드오프의 안전망(프로세스 재기동 시 클라이언트가 새 핸드셰이크로 재동기화, `disconnect` reason fallback)을 제공하므로 실질적 계약 위반도 아니다. lifecycle 규칙상 미완 항목이 남아있는 한 plan 은 `in-progress/` 에 남으므로 후속 항목이 조용히 유실될 경로도 없다. 다른 `plan/in-progress/**` 문서 중 이 diff 가 건드린 식별자(`expiryTimers`·`armExpiryTimers`·`MSG_AUTH_TOKEN_EXPIRING`·`token_expired`)를 참조하는 곳은 `spec-sync-external-interaction-api-gaps.md` 뿐이며, 그 참조는 섹션 번호 앵커 정합성(§4.5→§4.6 개명) 관련 완전히 별개 사안이라 이 diff 로 무효화되지 않는다.

## 위험도

LOW

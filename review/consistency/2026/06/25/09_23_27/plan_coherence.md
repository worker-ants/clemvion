# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상: refactor 03 C-4 — WebsocketGateway 5개 명령 핸들러 인증+소유권 보일러플레이트 behavior-preserving 추출

---

## 발견사항

### 발견사항 없음 (NONE)

plan/in-progress 전체를 검토한 결과, 아래 세 관점 어디에도 해당하는 항목이 없다.

**1. 미해결 결정과의 충돌 — 없음**

`plan/in-progress/refactor/03-maintainability.md` C-4 항목(lines 102–125)은 target 이 구현하려는 내용을 정확히 기술하고 있다:

- `requireAuthenticated(client)` + `requireOwnership(executionId, workspaceId)` private helper (Guard 보다 helper 권장)
- `as Socket & {...}` 단언 → `AuthenticatedSocket` 타입 alias 1곳
- 에러 메시지 문자열 상수화

해당 항목에 "결정 필요" 또는 "사용자 결정 대기" 표기가 없고, 옵션 비교에서 옵션 A(private helper)가 권장안으로 확정됐다. target 이 채택한 설계(`getCommandAuthContext`/`verifyExecutionOwnership` helper + `AuthenticatedSocket` alias + 상수화)는 이 권장안과 완전히 정합한다.

C-4 는 README `의도된 설계지만 문제 — 사용자 결정 현황` 표에 없다(결정대기 대상이 아님). 결정대기 항목은 03 C-3/M-4, 05 m-5, 06 C-2 세 건뿐이며 모두 C-4 와 무관하다.

**2. 선행 plan 미해소 — 없음**

target 이 전제하는 사전 조건:
- `spec/5-system/6-websocket-protocol.md §7.2` ack wire shape 명세 — 기존재, 변경 불요
- `§7.1` UNAUTHENTICATED/NOT_FOUND 통일 정책 — 기존재, behavior-preserving 보존
- `§3.3` 구독 평문 error 포맷 — 기존재, 미변경 약속

`plan/in-progress/spec-sync-websocket-protocol-gaps.md` 에 미구현 surface 가 존재하지만(in-band 토큰 갱신, `execution.start` WS 명령 등), 이들 중 어느 것도 C-4 의 보일러플레이트 추출 작업의 선행 조건이 아니다. C-4 는 기존 5개 핸들러의 내부 구조만 리팩터링하며 spec 신규 구현은 없다.

`plan/in-progress/refactor-auth-reverify-unify.md` 는 `webauthn.controller.ts` / `sessions.service.ts` bcrypt 단일화 작업이며, `websocket.gateway.ts` 와 파일/도메인이 분리되어 있다. 체크리스트가 모두 완료([x])된 상태이고 이 plan 이 C-4 의 선행 조건이 아니다.

**3. 후속 항목 누락 — 없음**

target 의 변경 범위(private helper 추출, 타입 alias, 상수화)는 순수 internal 리팩터링이다:
- spec 변경 없음
- wire shape 불변 — 다른 plan 의 websocket 관련 후속 항목(`spec-sync-websocket-protocol-gaps.md` 미구현 surface)을 무효화하지 않음
- `AuthenticatedSocket` 타입 alias 와 helper 는 gateway 파일 내부에만 존재 — 외부 서비스 계약/인터페이스 무영향
- `spec-sync-websocket-protocol-gaps.md` 의 미구현 항목(rate-limit, 에러 코드 `RATE_LIMITED`/`INVALID_MESSAGE`/`UNKNOWN_TYPE` 등)은 C-4 이후에도 독립적으로 착수 가능

---

## 요약

`refactor 03 C-4` target 은 `plan/in-progress/refactor/03-maintainability.md` C-4 항목이 권장안(옵션 A — private helper + 타입 alias + 상수화)으로 명시한 설계를 그대로 따른다. 미해결 결정을 우회하지 않고, 선행 plan 미해소 조건이 없으며, 다른 plan 의 후속 항목을 무효화하거나 새 추적 항목을 만들지 않는다. behavior-preserving + spec 변경 없음 선언이 plan 기록과 일치한다.

---

## 위험도

NONE

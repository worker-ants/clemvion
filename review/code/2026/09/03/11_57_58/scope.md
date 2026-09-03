# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 기존 JSDoc 두 곳이 새 코드 삽입으로 원래 대상 선언에서 분리되어 오귀속(misattribution) 상태가 됐다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:147-156` (`expiryTimers` 필드) 및 `codebase/backend/src/modules/websocket/websocket.gateway.ts:162-190` (`clearExpiryTimers`/`armExpiryTimers` 경계)
  - 상세:
    1. `expiryTimers` 필드 위에 있던 기존 JSDoc(147-149, "소켓별 만료 타이머 (사전 통지 · 강제 종료). `handleDisconnect` 에서 **둘 다** 해제한다")이 그대로 남은 채, 그 바로 아래·필드 바로 위에 새 JSDoc(150-155, "**쌍**...optional 이 아니다")이 끼워 넣어졌다. JSDoc 파서/IDE hover 는 선언 바로 위의 "가장 가까운" 주석 블록만 그 선언에 귀속시키므로, 이제 필드에 공식 귀속되는 것은 새 블록(150-155)뿐이고 옛 블록(147-149)은 그 사이에 낀 채 어느 선언에도 형식적으로 붙지 않는 고아 주석이 된다.
    2. 더 심각한 사례: `armExpiryTimers` 를 설명하던 기존 JSDoc(162-176, "소켓 수명을 토큰 수명에 종속시킨다... `exp` 가 없으면 타이머를 걸지 않는다" 등 `armExpiryTimers` 고유의 정책 근거)이, 이번 diff 가 그 바로 뒤·`armExpiryTimers` 선언 바로 앞에 신규 `clearExpiryTimers` 메서드와 그 자신의 JSDoc(177-181)을 통째로 끼워 넣으면서 `armExpiryTimers`(190행)로부터 완전히 분리됐다. 결과적으로 `armExpiryTimers` 는 이제 그 선언 바로 위에 **주석이 전혀 없는** 상태이고(177-188 이 `clearExpiryTimers` 를 위해 그 자리를 차지), 162-176 의 "자연 만료만 닫는다 / exp 없으면 타이머 안 건다" 같은 `armExpiryTimers` 고유 정책 설명은 시각적으로 `clearExpiryTimers` 바로 위에 붙어 있어 그 함수의 설명처럼 읽힌다 — 그러나 `clearExpiryTimers` 는 단순 해제 헬퍼라 그 내용과 무관하다.
  - 제안: 신규 코드(필드의 non-optional 사유, `clearExpiryTimers` 메서드)는 각각 **기존 JSDoc 뒤(그 선언과 붙여서)** 배치하거나, 기존 JSDoc 을 새 선언 위치로 함께 이동시켜 각 주석이 실제로 설명하는 선언 바로 위에 오도록 재배열할 것. 특히 `armExpiryTimers` 의 162-176 블록은 `clearExpiryTimers` 삽입 지점 뒤(즉 `armExpiryTimers` 선언 바로 위)로 이동해야 원래 귀속이 복원된다.

## 요약

이번 변경은 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 명시적으로 "이월 INFO 5건 — 한 번에 닫는다"고 선언한 항목(① `cutoff` clamp 근거 주석, ② `expiryTimers` 타이머 쌍 non-optional 화, ③ `MSG_AUTH_TOKEN_EXPIRING` 상수 승격 + 테스트, ④ `armExpiryTimers` 진입부 선제 `clearTimeout`, ⑤ `setTimeout.unref()`)와 4개 파일의 diff 가 1:1로 정확히 대응한다. `websocket-events.types.ts`(상수 추가), `websocket.gateway.ts`(구현 5건 + 공용 헬퍼 `clearExpiryTimers` 추출), `websocket.gateway.spec.ts`(각 항목당 회귀 테스트 3개 + import 1줄), plan md(체크리스트 반영) 모두 선언된 범위를 벗어나지 않으며, 임포트·포맷팅·무관 파일 수정·기능 확장 등의 이탈 징후는 없다. `clearExpiryTimers` 추출은 무장(`armExpiryTimers`)과 해제(`handleDisconnect`) 두 지점이 같은 절차를 공유해야 하는 ④번 항목의 직접적 필요에서 나온 것이라 불필요한 리팩터링으로 보기 어렵다. 유일한 흠은 새 코드/주석을 기존 JSDoc **뒤가 아니라 앞**에 끼워 넣어 두 군데에서 기존 주석이 원래 선언으로부터 분리·오귀속된 것으로, 기능에는 영향 없지만 문서 정합성 측면의 부수 결함이다.

## 위험도

LOW

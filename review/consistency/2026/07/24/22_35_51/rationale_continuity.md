STATUS=success rationale-continuity review complete (0 CRITICAL, 0 WARNING, 1 INFO)

### 발견사항

- **[INFO]** 세션 `apiBase` 발급-origin 바인딩 — 결정 근거가 본문(§3.1)에만 있고 `## Rationale` 로 승격돼 있지 않음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 "재로드 복원 시퀀스" 1번 항목 (`저장 세션은 발급된 apiBase(origin)에 묶인다...`) + 코드 `session-store.ts`/`use-widget.ts` (diff 의 `apiBase` 필드 추가·`loadSession(triggerEndpointPath, expectedApiBase)` 시그니처 변경)
  - 과거 결정 출처: 없음 — `3-auth-session.md ## Rationale`(R3 per_execution 단일, R4 재로드 401 낙관적 refresh, R5 `{data}` 언랩, R6 sessionStorage 선택)의 어느 항목도 "세션-origin 바인딩 불필요/생략" 을 명시적으로 결정한 적이 없음. 즉 이번 변경은 기존 Rationale 을 **번복하는 것이 아니라** 문서화되지 않았던 결함을 메우는 것으로 보임(diff 주석도 "선행 결함(이 diff 가 만든 게 아니다)" 로 스스로 인정).
  - 상세: PROJECT 관례(`CLAUDE.md` "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`")상, `apiBase` 를 `PersistedSession` 필수 필드로 승격하고 (a) 불일치 시 폐기, (b) **미기록(레거시) 세션도 fail-safe 로 폐기**, (c) 후행 슬래시만 정규화하고 경로는 보존하는 3가지 비trivial 한 설계 선택이 새로 확정됐다. 이 "왜"는 현재 spec 본문 산문(§3.1 1번 항목)과 코드 주석에는 잘 설명돼 있으나 `## Rationale` 절(R3~R6)에는 대응 항목이 없다. 다음에 누군가 "레거시 세션도 폐기하는 건 과하다 — optional 로 완화하자" 는 식으로 재번복을 시도할 때, 근거가 Rationale 에 없으면 이번 검토자 같은 후속 rationale-continuity 검사가 "과거 결정 위반" 을 판정할 근거 자체가 사라진다(현재는 근거가 diff 주석에만 있어 spec 만 보면 소실).
  - 제안: `3-auth-session.md` 에 `R7. 세션 발급-origin 바인딩 (apiBase) — 재전송 시 옛 origin 토큰 유출 방지` 항목을 신설해 (1) 트리거(재전송이 `clientRef`/`apiBase` 를 무조건 교체하는 기존 동작과의 충돌), (2) 레거시 세션(필드 부재) 을 "아마 같겠지" 로 통과시키지 않고 폐기하는 fail-safe 선택, (3) 정규화 범위(슬래시만, 경로는 보존)의 근거를 명문화할 것을 권장. R6(sessionStorage 선택)에서 상호 참조를 추가하면 연속성이 더 명확해진다. 이는 기능 변경을 요구하지 않는 문서 정합 보완이라 INFO.

### 요약
diff(`session-store.ts`/`use-widget.ts` 등)가 도입한 "세션은 발급된 apiBase 에 묶인다" 바인딩은 `spec/7-channel-web-chat/3-auth-session.md` §3.1 본문에 이미 동일하게 기술돼 있고, 관련 영역(0-architecture 의 EIA 클라이언트 한정 원칙·R2, 4-security 의 CORS/토큰 노출 정책·R1/R6, 1-widget-app 의 single-flight coalesce·R9, 5-admin-console 의 `wc:boot` 재전송·boot config 재전송 메커니즘)의 어떤 `## Rationale` 항목과도 정면 충돌하지 않는다. 과거에 "apiBase 를 세션에 안 묶는다" 는 명시적 결정이 존재한 적이 없으므로 이는 결정의 번복이 아니라 미문서화 결함의 보강이다. 유일한 아쉬움은 이 새 invariant 의 근거가 spec 본문 산문과 코드 주석에만 있고 해당 문서의 `## Rationale` 절에는 아직 승격되지 않았다는 점(프로젝트 컨벤션상 근거는 `## Rationale` 이 SoT)이며, 이는 향후 연속성 추적을 위한 INFO 성 보완 제안에 그친다.

### 위험도
LOW

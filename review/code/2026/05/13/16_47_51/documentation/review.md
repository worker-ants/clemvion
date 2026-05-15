### 발견사항

- **[WARNING]** Plan 문서의 라이프사이클 불일치
  - 위치: `plan/in-progress/fix-login-history-race.md`
  - 상세: 모든 체크박스가 `[x]`로 완료 표시되어 있으며 마지막 항목이 `plan/complete/ 로 git mv`임에도 파일이 여전히 `in-progress/`에 존재한다. CLAUDE.md 규약상 "모든 항목 완료된 순간에 complete/ 로 이동"이 원칙이다.
  - 제안: `git mv plan/in-progress/fix-login-history-race.md plan/complete/fix-login-history-race.md` 실행

- **[INFO]** 호출부 주석 미반영 — plan에서 약속한 call-site 보강이 실제 diff에 없음
  - 위치: `auth.service.ts` 전체 13곳, `sessions.service.ts` 2곳의 `await this.loginHistory.record(...)` 호출
  - 상세: plan 문서에 `record() 호출 위치 주석 보강 — "응답 전에 durability 보장이 필요한 audit row" 컨텍스트 명시` 항목이 `[x]` 완료로 표기되어 있으나, 실제 diff에서 call-site에 추가된 주석은 없다. `login-history.service.ts`의 JSDoc만 갱신되었다.
  - 제안: `record()` JSDoc만으로도 계약은 충분히 설명된다. plan 항목 설명이 "call-site 주석"이 아니라 "JSDoc 보강"을 의미했다면 plan 문구를 소급 수정하거나 그대로 두어도 무방. 단, plan 항목과 실제 구현 간 괴리가 리뷰어를 혼란스럽게 할 수 있으므로 plan 설명을 `login-history.service.ts JSDoc 보강`으로 명확히 하는 것이 좋다.

- **[INFO]** `toDto` 메서드 주석이 구현과 불일치
  - 위치: `login-history.service.ts` — `private toDto(...)` 직전 주석
  - 상세: `// Backwards-compatible alias for callers that still expect to receive raw rows. Used by spec when asserting persisted shape.` — 이 메서드는 `private`이고 외부 호출자가 없으며 raw row가 아닌 `LoginHistoryItemDto`를 반환한다. "alias", "backwards-compatible"이라는 표현이 구현 의도와 맞지 않는다.
  - 제안: 주석 삭제 또는 `// Maps a LoginHistory row to the public DTO shape.` 수준으로 단순화

- **[INFO]** `record()` JSDoc의 신규 **호출 규약** 블록은 충분히 명확하나, 오해 가능한 표현 하나가 있음
  - 위치: `login-history.service.ts` — `record()` JSDoc 두 번째 단락 첫 문장
  - 상세: `"호출부는 반드시 await 한다"` 표현은 올바르지만 바로 위 첫 문단의 `"예외는 삼킨다 (호출부에서 await 해도 throw 하지 않음)"` 괄호 설명과 결합 시 "await 해도 안전하다"와 "반드시 await 해야 한다" 두 메시지가 같은 JSDoc에 혼재해 읽는 방향이 분산된다. 사소한 수준이라 수정 필수는 아님.

---

### 요약

문서화 관점의 핵심 변경은 `login-history.service.ts`의 `record()` JSDoc 갱신으로, race condition 원인(TypeORM connection pool에서 INSERT와 SELECT가 다른 connection을 쓸 수 있음)과 호출 규약(`await` 필수)을 명확히 설명하여 품질이 높다. `auth.service.ts`와 `sessions.service.ts`의 기존 JSDoc 및 인라인 주석도 변경과 일관성을 유지한다. 다만 plan 문서가 모든 항목 완료 후에도 `in-progress/`에 머물러 있는 점이 프로젝트 규약 위반이며 즉시 `git mv`가 필요하다. `toDto` 주석의 오탐 문구도 소거를 권장한다.

### 위험도

**LOW**
### 발견사항

- **[WARNING]** 구현이 자신의 근거 문서(plan)가 아직 "미착수·미결정"으로 표시한 항목을 이미 구현했고, 그 문서가 명시한 선호안과 반대되는 방식을 채택했는데 문서·체크리스트가 갱신되지 않았다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:339`(`return stripDeep(envelope) as Record<string, unknown>;`) ↔ `plan/in-progress/spec-draft-eia-62-waiting-payload.md:130-137`(`### 다음 (별건)`)
  - 상세: `plan/in-progress/spec-draft-eia-62-waiting-payload.md`는 이 diff 안에서 **새로 작성된** 문서로, `## 🔴 조사 중 발견` 절에서 `turnDebug.llmCalls` 중첩 누출을 "이 draft 의 범위를 넘고 심각도가 높아 별건으로 분리한다"고 명시하고, `### 다음 (별건)`에 처방 후보 (a)/(b)/(c) 를 나열하며 **"(a) 는 비용이 크고 (c) 는 이름 충돌을 고착시키므로 (b) 가 유력"**이라고 스스로 결론까지 냈다. 그 아래 체크리스트도 `[ ] /consistency-check --spec BLOCK: NO`, `[ ] spec 반영 (6항목)`, `[ ] eia-terminal-payload.md 차단 해제 후 --impl-prep 재실행`이 전부 미완료(`[ ]`)로, "아직 실행에 옮기지 않은 조사 결과"임을 문서 자체가 밝히고 있다. 그런데 같은 diff 의 `websocket.service.ts:339`는 정확히 문서가 "비용이 크다"며 후순위로 판단한 **(a) 안**(`stripExternalOnlyFields` 를 깊이 우선/재귀로 전환)을 그대로 구현했고, `websocket.service.spec.ts`에도 이를 검증하는 테스트 2건이 추가돼 이미 작동 중이다. 즉 같은 커밋 안에서 "이 결정은 아직 안 났다"는 문서와 "이미 결정해서 구현·테스트까지 끝냈다"는 코드가 동시에 존재하며, 문서 어디에도 왜 자신이 도출한 (b) 선호안 대신 (a) 를 택했는지에 대한 근거 정정이 없다.
  - 제안: `spec-draft-eia-62-waiting-payload.md`의 `### 다음 (별건)` 체크리스트 3항을 실제 구현 상태(테스트 완료, 처방 (a) 채택)로 갱신하고, "(b) 가 유력"이라던 원 결론을 (a) 로 바꾼 이유(필드명 기반 방어가 위치 나열보다 강건하다는 코드 주석의 논거)를 문서에도 반영해 코드와 plan 이 같은 결정을 가리키도록 동기화할 것. 이 프로젝트 메모리에 "plan 서술은 철회로 거짓이 될 수 있다"·"체크리스트 두 군데 동기화" 교훈이 반복 기록돼 있으므로 재발 방지 차원에서도 필요.

- **[INFO]** 이번 diff 의 실제 코드 변경(`websocket.service.ts`/`websocket.service.spec.ts`)은 브랜치·plan 제목이 가리키는 "종결(terminal) payload 정리"(`error` 객체화·`durationMs`·`result.outputs`, `plan/in-progress/eia-terminal-payload.md`)와 무관하다
  - 위치: `plan/in-progress/eia-terminal-payload.md:95-106`(`## 범위`) — `error`/`durationMs`/`result.outputs`/dispatcher back-compat wrap/유령 타입 필드만 나열, `websocket.service.ts`/`stripExternalOnlyFields` 언급 없음
  - 상세: `eia-terminal-payload.md`는 `🚫 구현 차단 — --impl-prep BLOCK: YES`로 명시적으로 착수가 막혀 있고, 이번 diff 는 그 문서가 다루는 필드(`error`/`durationMs`/`result.outputs`) 어느 것도 건드리지 않는다. 대신 구현된 것은 조사 과정에서 별도로 발견된 `waiting_for_input` 이벤트의 `turnDebug.llmCalls` 중첩 누출 수정이다. 개별 항목으로는 위 WARNING 에서 다뤘듯 타당한 판단(보안 결함은 지연시키지 않는 편이 낫다)이나, 이 커밋의 "표면적 스코프"(브랜치명·정본 plan 제목)만 보면 실제 작업 내용과 불일치해 보일 수 있다.
  - 제안: 별도 조치 불필요 — 위 WARNING 의 plan 동기화만 이뤄지면 이 항목은 "타당한 범위 밖 긴급 수정이 문서화됨"으로 해소된다. 참고로만 기록.

- **[INFO]** `websocket.service.ts`/`websocket.service.spec.ts` 자체의 diff 는 좁게 잘 스코프됐다 — 확인했으나 문제 없음
  - JSDoc 재작성(gate 303-320)·`stripExternalOnlyFields`(324-340)·신규 `stripDeep`(342-374)만 변경, 무관한 리팩토링·포맷팅·임포트·설정 변경 없음. 테스트 파일도 두 개 `it()` 블록 순수 추가(gate 656-708, 710-735)뿐이고 기존 테스트 수정·삭제 없음. 주석이 서사적으로 길지만(`SANITIZE_CACHE`/`registerExecutionRouting` 등 기존 코드베이스 관례와 동일한 스타일이라 이례적이지 않음.

### 요약
코드 diff(`websocket.service.ts`/`.spec.ts`) 자체는 `turnDebug.llmCalls` 외부 누출이라는 실제 보안 결함 하나에 정확히 좁게 스코프돼 있고 무관한 리팩토링·포맷팅·임포트 변경이 없다. 다만 같은 커밋 안에 새로 작성된 근거 문서(`plan/in-progress/spec-draft-eia-62-waiting-payload.md`)는 이 수정을 "아직 미착수·미결정 별건"으로 명시하고, 자신이 도출한 선호안(옵션 b)과 다른 방식(옵션 a, 실제 구현)을 언급하면서도 그 반전을 기록하지 않았으며 관련 체크리스트 3항도 전부 미완료로 남아 있다 — 즉 "구현 완료" 코드와 "미결정" 문서가 같은 diff 안에서 서로 모순된다. 이는 스코프 자체의 위반이라기보다 계획-구현 동기화 누락이며, push 전 plan 문서를 실제 구현 상태·채택 결정으로 갱신하는 것을 권고한다. `eia-terminal-payload.md`(정본 종결 payload 작업)는 이번 diff 에서 전혀 진전되지 않았다(BLOCK: YES 유지, 별도 코드 변경 없음) — 이 점은 스코프 이탈이 아니라 계획대로 보류된 상태다.

### 위험도
MEDIUM

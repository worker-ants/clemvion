### 발견사항

- **[INFO]** `plan/in-progress/HANDOFF-eia-terminal-payload.md` 가 HEAD 기준 이미 해소된 두 차단 사항을 여전히 "🚫 차단"(미해결)으로 서술한다
  - 위치: `plan/in-progress/HANDOFF-eia-terminal-payload.md:21-27`(게이트 현황 표), `:30`(`## 🚫 차단 1 — waitingNodeType SoT 상충`), `:54`(`## ⚠️ 차단 2 — REST 경로 이중 순회 미실측`)
  - 상세: `git log --follow`로 확인한 결과 이 파일은 커밋 `85511cafc`(17:00:57)에서 한 번만 작성됐다. 그런데 그 뒤 커밋 `462455a52`(21:53:47, 현재 HEAD)가 정확히 "차단 1"(`waitingNodeType` §6.2 blockquote 철회)을 해소했고, `review/code/2026/08/14/16_44_37/RESOLUTION.md`에도 두 항목 모두 "조치 완료"로 이미 기록돼 있다. `git diff 85511cafc..462455a52 --stat`로 대조하면 `462455a52`가 손댄 파일 목록에 이 HANDOFF 파일은 없다 — 즉 근거 문서가 코드/스펙 상태를 따라가지 못한 채 남아 있다. 이 문서만 보고 세션을 재개하는 다음 작업자(다른 에이전트 포함)는 "두 게이트가 아직 막혀 있다"고 오판할 수 있다.
  - 제안: HANDOFF 파일 상단이나 각 차단 항목에 "해소됨 (`462455a52`)" 한 줄을 추가하거나, 목적을 다했다면 이 파일을 정리(plan lifecycle 규약에 따라 archive 또는 삭제)할 것. 이 프로젝트 메모리에 "plan 서술은 철회로 거짓이 될 수 있다"·"인계 문서의 '건드리지 마라'는 특히 실측"이 반복 교훈으로 기록돼 있어, 인계 문서 staleness 자체가 재발 패턴이다.

- **[INFO]** 프로덕션 코드 JSDoc/주석이 임시 리뷰 라운드 타임스탬프(`14_55_29`, `12_06_21` 등)를 근거 인용으로 다수 사용한다 — 외부 컨텍스트 의존적 각주
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:18,35,42,56,67,83`, `codebase/backend/src/modules/external-interaction/interaction.service.ts:85,92,102,104,382,442`, `codebase/backend/src/modules/websocket/websocket.service.ts:300`
  - 상세: 각주가 가리키는 `review/code/2026/08/14/{14_55_29,12_06_21,...}/` 폴더는 실제로 저장소에 존재해 지금은 추적 가능하다(확인함). 다만 이 프로젝트의 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 형태로 계속 누적되는 append-only 로그이고, 코드 주석에는 날짜 없이 `hh_mm_ss` 6자리만 박혀 있어 반년 뒤 신규 합류자가 grep 없이는 무슨 근거인지 알 수 없다. 저장소 히스토리·리뷰 폴더 보존을 전제로 하는 인용 방식이라, 만약 이 폴더들이 훗날 archive·정리 대상이 되면(현재 규약상 `review/`는 in-progress/complete 축과 분리된 append-only 라 당장 위험은 낮음) 각주가 허상 참조가 된다.
  - 제안: 핵심 계약(경계 연산자·순서 무관성·비용 트레이드오프)은 이미 본문에 온전히 서술돼 있어 각주 없이도 읽힌다 — 현재도 문제는 없다. 다만 새로 이런 각주를 추가할 때는 가능하면 커밋 SHA(`git log -S`로 항상 추적 가능)를 병기하는 편이 라운드 폴더보다 수명이 길다.

- **[INFO]** `emitExecutionEvent`/`emitNodeEvent` 두 메서드에서 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` + `attachRoutingContext` 호출 블록이 거의 동일하게 반복된다 — 기존 중복 패턴 위에 이번 diff가 두-인자 시그니처를 얹음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:450-457`(`emitExecutionEvent`), `:524-531`(`emitNodeEvent`)
  - 상세: envelope 조립 자체는 이전부터 두 메서드에 각각 구현돼 있던 기존 중복이고 이번 diff가 새로 만든 구조는 아니다. 다만 이번 diff로 `stripExternalOnlyFields` 가 `maxDepth` 인자를 받게 되면서, "자매 sanitizer와 같은 `MAX_SANITIZE_DEPTH` 를 넘긴다"는 계약이 호출부 2곳에 각각 중복 서술된다 — 세 번째 fanout 호출부가 생기면 그 계약을 또 한 번 손으로 맞춰야 한다.
  - 제안: 시급하지 않음(현재 2곳뿐). 세 번째 호출부가 생기는 시점에 `private stripForFanout(envelope)` 같은 헬퍼로 묶어 `MAX_SANITIZE_DEPTH` 전달을 한 곳으로 모으는 것을 고려.

- **[INFO]** (positive) `strip-external-only-fields.ts`의 `stripDeep`/`stripExternalOnlyFields` 자체는 단일 책임·낮은 중첩·매직넘버 없음(전부 named export 상수) — 확인했으나 문제 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:101-146`
  - 상세: 함수 본문은 약 45줄로 재귀 깊이 제한(`depth > maxDepth`)·배열/객체 분기·lazy clone-on-write가 명확히 분리돼 있고 중첩은 최대 2단계(반복문 안 조건문)로 순환복잡도가 낮다. `Object.defineProperty` 로 `__proto__` bracket 대입을 피한 방어도 인접 주석에 "왜"가 붙어 있어 다음 사람이 되돌릴 위험이 낮다. `interaction.service.ts`의 `stripAndRedact` 도 초판 이름(`redactAndStrip`, 실행 순서와 반대로 읽히던 이름)에서 실제 실행 순서와 일치하는 이름으로 이미 정정돼 있다.
  - 제안: 없음.

- **[INFO]** (positive) 이전 라운드가 지적한 매직넘버·경계 연산자 불일치·`it.each` 튜플-타이틀 어긋남이 현재 diff에서 실제로 해소돼 있음을 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` `it.each([0, MAX_SANITIZE_DEPTH - 5, ...])` 블록(신규 깊이 경계 테스트), `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` `it.each([['completed','result',ExecutionStatus.COMPLETED], ...])` 블록(null 분기 테스트)
  - 상세: 깊이 경계 테스트는 리터럴 대신 `MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH` 상대값을 쓰고 있고(상수가 바뀌어도 판별력 유지), null 분기 `it.each` 튜플은 `[label, field, status]` 순서로 타이틀 `%s`(label)·`%s`(field) 두 자리와 정확히 대응한다(직전 커밋 `9482cc0c0`이 고친 상태). `strip-external-only-fields.ts`의 경계 연산자(`>`)가 자매 함수(`sanitizePayloadForWs`의 `>`, `deepRedactSecrets`의 `>=`)와 다른 점도 JSDoc에 "왜 달라도 안전한가"가 표로 정리돼 있어, 단순 불일치가 아니라 근거가 명시된 의도된 차이다.
  - 제안: 없음.

### 요약

핵심 코드 변경(`strip-external-only-fields.ts` 신규 유틸 + `websocket.service.ts`/`interaction.service.ts`의 소비처 배선)은 단일 책임 함수로 잘 분리돼 있고, 이전 여러 라운드에서 지적된 매직넘버·경계 연산자·`it.each` 타이틀 결함이 실제로 해소된 상태로 확인된다. 이번 라운드에서 새로 발견한 것은 코드 자체의 결함이 아니라 (1) 이미 해소된 두 차단 사항을 여전히 미해결로 서술하는 `HANDOFF-eia-terminal-payload.md`의 staleness, (2) 프로덕션 주석이 리뷰 라운드 타임스탬프를 근거로 인용해 장기적으로 외부 컨텍스트에 의존하는 점, (3) fanout 두 메서드 간의 경미한 사전-존재 중복이다. 셋 다 차단 사유는 아니며 INFO 수준이다.

### 위험도

LOW

# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `admitExecutionOrDefer` 의 `'deferred'` 반환 의미를 설명하는 주석 3곳이 이번 diff 로
  새로 생긴 두 번째 `deferred` 경로(방어적 fail-closed)를 반영하지 못해 stale 해졌다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    - 함수 docstring (`admitExecutionOrDefer` 바로 위, 약 2852~2869행) — `'deferred': ws/wf cap
      초과 → delayed 재큐 → 호출자 return.` 로만 서술.
    - `(d)` 분기 인라인 주석 (약 2949~2950행) — `// (d) cap 초과 → delayed 재큐. ...`
    - 호출부 주석 (약 3662~3664행, `runExecutionFromQueue` 부근) — `// ... cap 초과 → delayed
      재큐(...), 큐 대기 5분 초과 → cancelled.`
  - 상세: 이번 diff 가 추가한 `if (!Array.isArray(rows)) { ...; return false; }` (약 2926~2932행)는
    `admitted=false` → 동일하게 `'deferred'` 로 귀결되지만, cap 초과가 아니라 `UPDATE ... RETURNING`
    결과가 배열이 아닌 방어적 예외 케이스다. 가드 자체의 인라인 주석(2922~2925행)은 이 케이스를 잘
    설명하지만, 그 설명이 함수 docstring·`(d)` 분기 주석·호출부 주석 세 곳에는 전파되지 않았다.
    운영 중 "cap 이 여유 있는데도 execution 이 deferred 로 반복 재큐된다" 를 디버깅하는 사람은 세
    문서 지점 중 어디를 봐도 원인을 찾지 못하고, 가드 코드 자체(2922행)까지 내려가야만 알 수 있다.
    (참고: 새 스펙 테스트 `execution-engine.service.spec.ts` 의 신규 `it` 블록은 이 케이스를 정확히
    검증하고 있어 테스트 자체는 정확함 — 문제는 함수/호출부 레벨 주석의 커버리지 누락뿐.)
  - 제안: 세 지점의 `'deferred'` 서술에 "ws/wf cap 초과 **또는** admission UPDATE 결과가 예상과
    다른(배열 아님) 방어적 fail-closed" 를 짧게 추가한다. 특히 함수 docstring 의 반환값 목록은
    한 곳에서 전체 분기를 요약하는 자리이므로 여기만 고쳐도 대부분의 혼란은 줄어든다.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `export` 로 바꾸면서, 같은 파일의 자매 상수
  `MAX_EXECUTION_PATH_ROWS` 가 갖고 있는 "왜 export 됐는지" 설명이 빠졌다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:63`
    (`export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;` 바로 위 JSDoc, 51~62행)
  - 상세: `MAX_EXECUTION_PATH_ROWS` (39~43행) 는 `// 테스트에서도 동일 상수를 참조하도록 export.`
    라는 한 줄로 export 이유를 명시한다. `SNAPSHOT_CACHE_MAX_ENTRIES` 의 JSDoc 블록(51~62행)은
    캐시 설계(제외 상태·인스턴스 캐시 성격)는 상세히 설명하지만, 이번에 `const` → `export const`
    로 바뀐 이유(테스트가 상한 값을 직접 참조)는 적혀 있지 않다. 기능상 문제는 없으나, 같은 파일 안
    두 export 상수의 문서화 패턴이 갈린다.
  - 제안: JSDoc 끝에 `테스트에서 상한 값(256)·LRU 경계 회귀를 고정하기 위해 export.` 한 줄 추가.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 두 번째 "완료" 주석 삽입부에
  빈 줄이 2줄 연속으로 들어가 있어, 같은 파일 내 동일 패턴(첫 번째 "완료" 주석)의 빈 줄 1줄 관례와
  다르다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` — `execution-engine.service.ts`
    admission 가드 완료 기록 바로 앞 (diff 상 `@@ -1079,3 +1095,17 @@` 훅, 새로 추가된 두 빈 줄).
  - 상세: 순수 서식 문제로 기능에 영향은 없다. 다만 plan 문서가 이 저장소에서 이력 추적 SoT 로
    쓰이는 만큼 사소한 비일관성이라도 지적해 둔다.
  - 제안: 빈 줄 1개로 정리(선택 사항).

- **[INFO]** `Array.isArray(rows)` fail-closed 가드는 크래시(TypeError 전파)를 명시적 defer 로
  바꾸는 동작 변경이지만 `CHANGELOG.md` 에는 항목이 없다.
  - 위치: `CHANGELOG.md` (신규 항목 없음), 대응 코드: `execution-engine.service.ts:2926-2932`.
  - 상세: 이 저장소 CHANGELOG 관례상 "defense-in-depth" 류 변경도 항목화된 선례가 있다
    (`## Unreleased — AI Agent LLM chat 호출 app-level 타임아웃 (defense-in-depth, §12.16)`).
    다만 이번 가드는 실제 운영에서 관측된 결함이 아니라 TypeORM `EntityManager.query` 반환 타입이
    `Promise<any>` 라 생기는 순수 방어적 케이스(정상 postgres 드라이버는 항상 배열 반환)이고,
    spec 참조도 없어 CHANGELOG 등재가 필수는 아니라고 본다. 다만 판단 근거를 남겨 둔다 —
    필요하면 짧은 "admission 가드가 배열 아닌 응답을 defer 로 fail-closed 처리" 한 줄 추가를
    고려할 수 있다.
  - 제안: 선택 사항 — 굳이 추가하지 않아도 문서화 관점에서 치명적이지 않음.

## 확인된 양호 사항 (참고)

- 신규 테스트 3건(`chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`,
  `executions.service.spec.ts`) 모두 "왜 이 테스트가 필요한가"(선행 커버리지 부재 실측 근거 포함)를
  설명하는 JSDoc 을 갖추고 있고, 인용된 실제 식별자(`isSubFilterNull`, `EntityManager.query`
  `Promise<any>`, `rows.length === 1`)가 실제 프로덕션 코드와 대조해 정확함을 확인했다.
- `execution-engine.service.ts` 의 신규 가드 자체(2922~2932행)에 붙은 인라인 주석은 "왜"(타입
  단언은 검증이 아님) 와 "무엇"(fail-closed, cap 우회 아님)을 모두 명확히 설명한다.
- 두 파일(`executions.service.ts`, `chat-channel.dispatcher.ts`) 모두 이번 diff 범위에서 공개
  API·엔드포인트 변경이 없어 API 문서·README 갱신 필요성은 없다.
- 신규 env 변수·설정 옵션 추가 없음 — 설정 문서 갱신 불필요.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 체크박스 갱신은 실제 완료된 작업과
  일치하며(코드 diff 로 대조 가능), 완료 근거(뮤테이션 결과 등)를 함께 남겨 이력 추적성이 좋다.

## 요약

이번 변경은 테스트 커버리지 보강 3건과 방어적 admission 가드 1건으로 구성된 소규모 diff이며,
새로 추가된 코드·테스트 자체의 지역적(local) 문서화 품질은 높다 — JSDoc 이 배경·근거·"왜 이 형태인가"
를 충실히 설명하고, 실제 코드 식별자와 대조해도 정확하다. 다만 딱 하나의 실질적인 결함이 있다:
`admitExecutionOrDefer` 의 `'deferred'` 반환값을 설명하는 함수 docstring·인라인 주석·호출부 주석
세 곳이 이번에 추가된 두 번째 `deferred` 경로(배열 아님 방어 케이스)를 반영하지 못해 "오래된 주석"이
됐다. 그 외에는 export 상수 문서화 패턴 비일관성, plan 문서 서식 nit, CHANGELOG 등재 여부 판단 근거
정도의 경미한 사항뿐이다. README·API 문서·설정 문서·예제 코드는 이번 diff 범위에서 해당 사항 없음.

## 위험도

LOW

# 테스트(Testing) 리뷰 — trigger-canary-hardening (라운드 4)

## 검토 범위 및 맥락

이 배치는 이미 3라운드의 `/ai-review` + fix 를 거쳤다(`11_27_40`→`11_52_13`→`12_17_14`, 커밋
`4c1a49b30`·`3f5e451b3`·`1a99f07a4`). 각 라운드가 "약속한 항 vs 실제로 잠근 항" 불일치를
뮤테이션으로 반증하고 대조군을 추가하는 방식으로 수렴해 왔다(`existsSync` 방어 분기,
`.toThrow()` vacuous 문제, 괄호 언랩 분기 등). 실질 코드 변경은 여전히 6개 파일이다:

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (신규 guard)
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (신규, 11 `it()`)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (주석/표기 정리만, 로직 무변경)
- `codebase/backend/test/{chat-channel-trigger-create,trigger-workflow-ref}.e2e-spec.ts` (JSDoc 정정만)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`expectTriggerWorkflowRef` 신규 호출 3곳)

이 라운드에서는 앞선 3라운드가 이미 찾아 고친 항목(existsSync·vacuous 삼항식·괄호 언랩·중첩
템플릿 리터럴 등)을 재-flag 하지 않고, **아직 다뤄지지 않은 분기**를 뮤테이션으로 찾는 데
집중했다.

## 발견사항

- **[WARNING]** `readStringArrayConst` — "선언은 찾았지만 초기값이 배열 리터럴이 아닌" 분기가
  단위 테스트로 한 번도 실행되지 않는다. 뮤테이션으로 확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:89-100`
    (`visit()` 내부 `if (ts.isArrayLiteralExpression(inner)) { ... } return;` 블록)
  - 상세: 이름이 일치하는 `VariableDeclaration` 을 찾았고 `initializer` 도 있지만, `unwrap()`
    이후의 `inner` 가 배열 리터럴이 **아닌** 경우(예: `const X = { a: 1 };`, `const X = 'nope';`,
    `const X = 5;`) 코드는 `if (ts.isArrayLiteralExpression(inner))` 블록을 통째로 건너뛰고
    바로 아래 무조건 `return;` 으로 빠져 `found` 를 `null` 인 채로 둔다 — 즉 "선언을 못 찾음"과
    구별되는 **또 다른 코드 경로**를 거쳐 같은 `null` 을 낸다. 현재 spec 의 8개 격리 케이스
    (주석-안전·`satisfies`·bare·괄호·"선언 없음"·빈 배열·파일 없음·spread 비-문자열)는 전부
    (a) 이름이 아예 다르거나(선언 없음 케이스), (b) 초기값이 배열 리터럴인 상태에서 원소만
    다르거나(spread 케이스) 둘 중 하나이고, "이름은 맞는데 초기값 자체가 배열이 아닌" 조합은
    없다.
    뮤테이션으로 실측: 이 분기를 `if (!ts.isArrayLiteralExpression(inner)) { found = []; return; }`
    로 바꿔(초기값이 배열이 아니면 "못 읽음"(`null`) 대신 "빈 배열"(`[]`)을 내도록) 저장소
    파일에 직접 적용(`cp` 백업 후 `cp` 로 원복, `git status --short` 로 원복 확인)하고
    `npx jest src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 재실행 →
    **11/11 GREEN 유지** — 이 분기가 실제로 규약을 어겨도(`null`↔`[]`는 JSDoc 이 명시적으로
    "가른다" 고 선언한 값인데도) 어떤 테스트도 감지하지 못한다. 참고로 대조 실험으로
    `unwrap()` 을 루프에서 단일 패스로 바꾸는 뮤테이션은 같은 방식으로 **5/11 즉시 RED**
    였다(괄호+`as`/`satisfies` 복합 언랩은 기존 "괄호로 감싼 선언도 벗긴다" 케이스가 이미
    묶고 있음을 확인) — 그래서 이 WARNING 은 "뮤테이션을 안 해봤다" 가 아니라 **이 특정 분기만
    비어 있다**는 뜻이다.
  - 이 저장소가 같은 파일에서 이미 세 번 반복한 패턴(“JSDoc 이 N 개를 약속하고 대조군은
    N−1 개만 잠근다”)과 같은 형태다 — `null`/`[]` 를 가르는 것이 "이 가드의 존재 이유 절반"
    이라고 스스로 적어 놓았는데(파일 헤더 `@returns` 문서), 그 경계의 한쪽 진입로가 열려 있다.
  - 제안: `beforeAll`/`afterAll` 임시 디렉터리 블록에 케이스 하나 추가 —
    `const rel = write('non-array.ts', "const X = { a: 1 };\nexport default X;");`
    `expect(readStringArrayConst(tmp, rel, 'X')).toBeNull();`

- **[INFO]** `readAllTriggerSecretColumnLists` (합성 함수) 자체를 대상으로 한 전용 단위 테스트는
  없다 — 정본·사본이 실제로 다를 때의 동작은 실제 저장소 파일에 대해서만(현재 값이 우연히
  일치하는 상태) 간접 검증된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:109-123`
  - 상세: 이 함수는 `readStringArrayConst` 를 3번 호출해 맵으로 묶는 순수 배선 로직이라
    분기가 없고 뮤테이션 위험도 낮다(맵 키 오타 정도). 다만 "정본과 사본이 실제로 달라지면
    이 가드가 잡는다"는 이 PR 의 핵심 동기(JSDoc `## 왜 필요한가`)를 직접 검증하는 유일한
    자리는 실제 3파일이 우연히 일치하는 현재 데이터에 의존하는 `toEqual` 비교뿐이고, 합성
    함수 수준에서 "값이 다르면 실제로 다른 결과를 낸다"를 별도 fixture 로 고정하는 테스트는
    없다. 위험은 낮지만(각 원자 함수는 이미 격리 테스트됨), `readAllTriggerSecretColumnLists`
    가 단순 배선이 아니게 되는 향후 변경(예: 키 정규화·필터링 추가) 시 회귀를 못 잡을 수 있다.
  - 제안: 필수는 아님. 조치 없이도 무방 — 참고용 기록.

## 확인한 사항 (문제 없음)

- `trigger-secret-columns.spec.ts` 의 11개 `it()` 은 3라운드에 걸쳐 뮤테이션으로 검증된
  대조군을 갖췄다: 주석 안전성(정규식 오탐 방지), `as const satisfies`/괄호 복합 언랩(위에서
  직접 재확인, 5/11 RED), spread 비-문자열 원소, 파일 부재 시 메시지 매칭(`.toThrow(/정규식/)`
  로 raw `ENOENT` 와 구별 — `.toThrow()` 단독의 vacuity 함정을 이미 피함), 빈 배열과 `null`
  의 구분. `beforeAll`/`afterAll` 로 `os.tmpdir()` 격리 + 확실한 정리, 병렬 리뷰어와 충돌
  없음.
- `expectTriggerWorkflowRef` 신규 호출 3곳(`schedule-trigger.e2e-spec.ts` C-2·G·H)은 기존에
  12/12 self-spec 으로 검증된 헬퍼를 그대로 재사용하며, `assertMatchesContract` 다음에 배치돼
  계약 검증(§5.4 키-생략형)이 못 잡는 "관계가 통째로 안 실리는" 회귀를 보완한다는 근거가
  타당함을 확인. `present:true`/`expectedWorkflowId` 조합은 self-spec 에 이미 12개 케이스로
  커버된 경로다.
- `trigger-workflow-ref.spec.ts` 변경은 표기(원문자→아라비아 숫자) 및 리뷰 이력 산문 정리뿐이고
  `it()` 본문은 무편집임을 diff 로 직접 확인 — 회귀 위험 없음.
- `chat-channel-trigger-create.e2e-spec.ts`·`trigger-workflow-ref.e2e-spec.ts` 는 `afterAll`
  JSDoc 만 갱신되고 정리 로직(`for (const id of createdTriggerIds) ...`)은 무편집 — 새 테스트
  대상 없음, 회귀 없음.
- 이미 다른 라운드에서 다루고 등재/유예 처리된 항목(단건 조회 schedule `workflow` 커버리지
  부재, 동명 비-최상위 선언 미구분 등)은 이 라운드에서 재-flag 하지 않음 — RESOLUTION 문서에
  처분이 기록돼 있고 대상 3파일에 해당 없음이 이미 확인됨.

## 뮤테이션 검증 로그 (이 리뷰에서 직접 수행)

| 뮤턴트 | 대상 | 예측 | 실측 |
|---|---|---|---|
| 비-배열 초기값 → `null` 대신 `[]` | `readStringArrayConst` 89-100행 | 어떤 테스트가 감지할 것 | **11/11 GREEN — 미감지** |
| `unwrap()` 루프 → 단일 패스 | `readStringArrayConst` 68-79행 | 괄호+`as`/`satisfies` 복합 케이스가 감지 | **5/11 RED — 감지됨(대조 실험)** |

두 뮤테이션 모두 `cp` 로 원본을 스크래치 디렉터리(`mktemp` 상당 경로)에 백업한 뒤 저장소
파일에 직접 적용, 재실행 후 `cp` 로 즉시 원복했다. `git checkout`/`restore`/`stash` 는
사용하지 않았고, 최종 `git status --short` 로 코드 트리가 깨끗함(리뷰 산출물 디렉터리만
untracked)을 확인했다.

## 요약

3라운드에 걸친 하드닝으로 이 신규 guard/spec 은 이미 상당히 촘촘하다 — 이번 라운드에서 뮤테이션으로
직접 재검증한 대조군(복합 언랩, 메시지 판별 `.toThrow`)은 모두 실제로 판별력을 가짐을 확인했다.
다만 아직 한 군데, "이름이 일치하는 선언을 찾았는데 초기값이 배열 리터럴이 아닌" 분기가
여전히 비어 있다 — 이 가드 자신이 문서화한 `null`/`[]` 구분(가드 존재 이유의 절반)의 한쪽
진입로이고, 뮤테이션으로 미감지가 직접 확인됐으므로 WARNING 으로 등재한다. 그 외 e2e 신규
단언 3곳과 self-spec/주석 변경은 회귀 위험이 없고 기존에 검증된 헬퍼를 올바른 위치(계약
검증 다음)에 재사용한다.

## 위험도

LOW

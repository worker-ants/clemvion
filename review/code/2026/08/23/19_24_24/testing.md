# 테스트(Testing) 리뷰 — `nodeOutput` fail-closed allowlist 재검토 (`19_00_23` 후속)

## 검토 방법

이번 diff 는 직전 라운드(`19_00_23`)의 `testing.md` INFO 3·4·5·7 을 반영한 결과물이다.
`interaction.service.spec.ts`(파일 2) 신규 3건, `node-output-allowlist.ts`/`.spec.ts`
(파일 4·5, `strip-external-only-fields.ts` 에서 분리된 신규 파일) 를 `Read` 로 직접 열어
게이트 줄 번호와 실제 소스를 대조했고, 자매 파일 `strip-external-only-fields.spec.ts`/`.ts`
에 `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 잔재가 없는지 grep 으로 분리가
완전한지 확인했다(잔재 0건). `interaction.service.ts` 의 `getStatus` 세 출구(waiting/terminal
result/terminal error) 를 원문으로 대조해 `result`/`error` 가 정확히 같은 코드 형태
(`stripAndRedact(execution.outputData)` 만, allowlist 없음)임을 확인했다.

## 발견사항

- **[INFO]** terminal `error` 출구는 `result` 와 코드가 완전히 대칭인데, 새로 추가된
  "allowlist 를 받지 않는다(의도)" 캐너리는 `result` 에만 있고 `error` 에는 없다 — 여전히
  기존 무관 테스트의 부수 효과로만 커버된다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:643`
    (신규 `[캐너리] terminal \`result\` 는 nodeOutput allowlist 를 받지 **않는다** (의도)`) 대
    `:567`(`failed status 면 outputData 가 error 필드로` — 기존 테스트, 의도 명시 없음).
    구현은 `codebase/backend/src/modules/external-interaction/interaction.service.ts:459-466`
    (`result: ... stripAndRedact(...) : null` / `error: ... stripAndRedact(...) : null` — 두
    삼항식이 각각 독립적으로 `stripAndRedact` 만 통과하고 `allowlistNodeOutputKeys` 는 어느
    쪽에도 없다).
  - 상세: 이번 라운드는 직전 리뷰(`19_00_23` testing INFO 5)가 지적한 "terminal 출구가
    allowlist 를 받지 않는다는 설계 경계가 의도 명시 캐너리가 아니라 부수 효과로만 커버된다"
    문제를 `result` 에 대해서만 고쳤다. `error` 도 `result` 와 완전히 같은 한 줄짜리 코드
    패턴(`stripAndRedact` 단독)이라 같은 위험을 그대로 안고 있다 — 기존 `:567` 테스트는
    `outputData: { code: 'NODE_FAILED', message: 'x' }` 를 쓰는데, `code`/`message` 가
    우연히 `NODE_OUTPUT_ALLOWED_KEYS` 밖의 키라서 "만약 `error` 조립에도 실수로
    `allowlistNodeOutputKeys` 가 걸리면 이 테스트가 깨져 실제로 회귀를 잡는다"는 점에서는
    `result` 의 원래 상태(리뷰 전)와 정확히 같은 형태다. 이 PR 이 이미 "두 출구가 대칭이어야
    한다"(코드 주석 `interaction.service.ts:450-458` "**waiting 분기와 대칭으로** 건다")는
    원칙을 스스로 명시하고 있는 만큼, 캐너리도 비대칭으로 두면 향후 두 출구를 통합
    리팩터링하는 변경이 `result` 캐너리만 통과시키고 `error` 회귀는 놓칠 수 있다.
  - 제안: `interaction.service.spec.ts:643` 근처에 `error` 버전을 하나 더 추가 —
    `outputData: { 작성자가정한임의키: 'keep', total: 42 }` + `status: FAILED` 로 같은
    형태의 `[캐너리] terminal \`error\` 는 nodeOutput allowlist 를 받지 **않는다** (의도)`
    를 두면 `result`/`error` 커버리지가 대칭이 된다.

## 강점 (참고 — 직전 라운드 지적사항 반영 확인)

- **`19_00_23` INFO 3 (`__proto__` 회귀 부재) 해소 확인**: `node-output-allowlist.spec.ts:101`
  이 `JSON.parse('{"output":{},"__proto__":{"polluted":true}}')` 로 own-property
  `__proto__` 케이스를 고정한다. `{...obj}` 스프레드가 `CreateDataProperty` 의미론이라
  애초에 이 벡터에 안전하지만(어떤 재구현이든 `delete`→`Object.assign` 류로 바뀌는 미래
  리팩터링을 겨냥한 회귀 테스트로 유효), 자매 스위트 관례와 일치시킨 것은 정당하다.
- **`19_00_23` INFO 4 (buttons 분기 직접 캐너리 부재) 해소 확인**: `interaction.service.spec.ts:617`
  이 `buttonConfig: {...}` (flat legacy) + 최상위 `_retryState` 조합으로,
  `buttonConfig.nodeOutput` 이 실제로 필터링된 `out` 전체(단순 `structured.buttonConfig` 재파생이
  아니라)를 감싼다는 것까지 함께 실증한다 — 주석대로 "지금은 안전"의 근거를 코드로 고정했다.
- **`19_00_23` INFO 7 (`delete` 안전 근거 미기재) 해소 확인**: `node-output-allowlist.ts:105-107`
  주석이 `stripDeep` 의 `defineProperty` 필요성(대입이 상속 setter 를 탈 수 있음)과 `delete`
  가 그 경로가 없는 이유(own-property `[[Delete]]`)를 정확히 구분해 적었다.
- **뮤테이션 기반 판별력 검증이 실제로 vacuous 테스트를 찾아냈다** — plan
  (`plan/complete/nodeoutput-allowlist.md` §뮤테이션)에 M2b(`formConfig` 제거 → 91→90건
  전부 GREEN)를 예측/실측 두 칸으로 기록하고, 리터럴 대조 캐너리
  (`node-output-allowlist.spec.ts:58-80`)로 보강한 뒤 같은 뮤턴트를 재실행해 RED 를
  확인했다는 서술이 코드(리터럴 배열이 `it.each` 파생 fixture 앞에 위치)와 정합한다. 이
  저장소가 반복 겪은 "생성 입력 vs 큐레이션 코퍼스" 패턴을 스스로 재현·수정한 사례.
- **배선 캐너리와 유틸 캐너리의 분리가 의도대로 동작**: `interaction.service.spec.ts:661`
  (배선)과 `node-output-allowlist.spec.ts:13`(유틸)이 같은 `_retryState` 누출을 서로 다른
  층위에서 고정하고, plan 의 M1 뮤테이션 관찰(호출부 배선 제거 시 배선 캐너리만 RED)과
  코드 구조가 일치한다.
- **테스트 격리·가독성**: 모든 신규 테스트가 `makeMocks()` 로 독립 인스턴스를 만들고
  (`interaction.service.spec.ts:42`), `[캐너리]`/`[리터럴]` 접두사로 각 테스트가 "지금 무엇을
  지키는가"를 명시한다. `node-output-allowlist.ts`/`.spec.ts` 분리(WARNING #2 대응)로
  `strip-external-only-fields.spec.ts` 에 도메인 결속 테스트가 섞이지 않게 됐다(grep 대조
  결과 잔재 0건) — 테스트 파일의 응집도가 소스 분리와 함께 개선됐다.
- **엣지 케이스 커버리지**: null/원시값/배열 통과, 참조 동일성(copy-on-change), 원본
  비변형, 미지 키 fail-closed, wire 전용 키 4종 개별 보존, 깊은 곳(최상위 아래)은 필터링
  대상이 아님 — 이 함수의 계약 표면을 빠짐없이 단위 테스트로 고정했다.

## 요약

직전 라운드 테스트 리뷰가 지적한 INFO 4건 중 3건(`__proto__` 회귀, buttons 분기 캐너리,
`delete` 안전 근거 주석)은 정확히 해소됐고, 남은 1건(terminal 경계의 "부수 효과 커버리지"
문제)은 `result` 출구만 고쳐 `error` 출구에는 여전히 같은 형태로 남아 있다 — `result`/`error`
가 코드 레벨에서 완전히 대칭인 만큼 저비용으로 마저 닫을 수 있는 잔여 갭이다. 그 외에는
뮤테이션 예측/실측 기록, 배선-유틸 캐너리 분리, 격리·가독성 모두 이 저장소의 기존 모범
관례를 그대로 따르고 있어 구조적 결함은 없다.

## 위험도

LOW

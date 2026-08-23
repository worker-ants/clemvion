# 테스트(Testing) 리뷰 — `nodeOutput` fail-closed allowlist (3라운드 후속, `19_00_23`→`19_24_24`→본 라운드)

## 검토 방법

이 diff 는 4개 커밋(`a3c9b3578`→`c4356b367`→`265c25134`→`09a788fdc`)의 누적분이며, 앞선 두
리뷰 라운드(`19_00_23`, `19_24_24`)의 testing INFO 5건이 모두 이번 커밋들로 이미 반영된
상태다. 각 항목을 실제 소스(`Read`/`grep`)로 재대조했고, `jest` 를 직접 실행해
`interaction.service.spec.ts` + `node-output-allowlist.spec.ts` **80/80 GREEN** 을 재확인했다.
추가로 이번 라운드에서 새로 들어온 코드(`Object.freeze`, terminal `error` 캐너리, JSDoc 링크
정정)에 대해 **뮤테이션 검증**을 직접 수행했다 — `Object.freeze(...)` 를 제거하고 동일
스위트를 재실행(`node-output-allowlist.spec.ts` 21/21 GREEN 유지, 변경 후 즉시 원복·`git diff`
clean 확인).

## 기존 지적사항 반영 확인 (재론하지 않음)

- `19_00_23` INFO 3(`__proto__` 회귀) / INFO 4(buttons 분기 캐너리) / INFO 5(terminal 경계 의도
  명시) — `node-output-allowlist.spec.ts:101-111`, `interaction.service.spec.ts:617-637`,
  `:643-656` 로 각각 확인.
- `19_24_24` INFO 3(terminal `error` 캐너리 비대칭) — `interaction.service.spec.ts:659-673` 로
  확인. 이 캐너리는 첫 작성 시 `execution.error` 필드에 fixture 를 넣어 **실제로 한 번
  실패**했고(원인은 코드가 아니라 fixture), `outputData` 로 정정된 뒤 통과했다는 이력이
  RESOLUTION 에 남아 있다 — 이 실패-후-통과 이력 자체가 이 캐너리가 vacuous 하지 않다는
  직접 증거다(첫 실행이 진짜 RED 를 냈다).

## 발견사항

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 의 `Object.freeze` 런타임 불변 주장에 대한 회귀 테스트가
  없다 — 뮤테이션으로 직접 실증(freeze 제거 후 21/21 GREEN 유지)
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:55`
    (`export const NODE_OUTPUT_ALLOWED_KEYS = Object.freeze([`), 테스트는
    `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts` 전체(`freeze`/`isFrozen`/
    `push`/`splice` 매치 0건, `grep` 확인).
  - 상세: 이 `Object.freeze` 는 이번 라운드에 직전 security 리뷰의 INFO 2(`"이 상수는 보안
    경계라고 JSDoc 이 주장하는데 런타임 불변이 없다"`)에 대한 응답으로 새로 추가됐다. 그런데
    "런타임에도 참으로 만들었다"는 그 주장을 검증하는 테스트가 없다 — 직접
    `Object.freeze([` → `([` 로 되돌리는 뮤테이션을 적용해 같은 스위트를 재실행한 결과
    `node-output-allowlist.spec.ts` 21건 **전부 GREEN** 을 유지했다(변경 즉시 원복·`git diff`
    clean 확인). 즉 이 파일의 시니어 방어선("보안 경계는 런타임에도 불변이어야 한다") 이
    코드에는 있지만 테스트에는 없어서, 향후 누군가 이 배열을 다른 방식(예: 새 파일로 재추출,
    `Object.freeze` 제거하고 `readonly` 타입 애너테이션만 남기는 리팩터링)으로 바꿔도 조용히
    통과한다. 이 저장소가 이미 겪은 "문서한 보장이 구현보다 넓으면 안 된다" 류 문제의 반대
    형태 — 여기선 구현이 문서 주장만큼 강한데(실제로 freeze 됨) 그 강도를 지키는 캐너리가
    없다.
  - 제안: `it('[캐너리] NODE_OUTPUT_ALLOWED_KEYS 는 런타임에도 불변이다 — 보안 경계 주장을
    테스트가 지킨다', () => { expect(Object.isFrozen(NODE_OUTPUT_ALLOWED_KEYS)).toBe(true); })`
    한 줄이면 충분하다. `.push`/`.splice` 가 strict mode(TS 컴파일 출력)에서 `TypeError` 를
    던지는지까지 보고 싶다면 `expect(() => (NODE_OUTPUT_ALLOWED_KEYS as unknown as
    string[]).push('x')).toThrow()` 도 고려할 수 있으나 `isFrozen` 단언만으로도 회귀는 잡힌다.

- **[INFO]** 테스트 픽스처 헬퍼 `makeExecution` 의 타입 시그니처가 `Pick` 목록 밖 override 키를
  조용히 버린다 — 바로 이 함정이 직전 라운드에서 실제로 한 번 발생했다(RESOLUTION 기재)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:77-103`
    (`function makeExecution(overrides: Partial<Execution> = {}): Pick<Execution, 'id' |
    'status' | 'workflowId' | 'outputData' | 'startedAt' | 'finishedAt' | 'durationMs'>`).
    `Execution.error`(`codebase/backend/src/modules/executions/entities/execution.entity.ts:81`)는
    이 `Pick` 목록에 없다.
  - 상세: `overrides` 파라미터 타입은 `Partial<Execution>`(전체 엔티티의 부분집합)이라
    `error` 같은 `Pick` 밖 필드도 타입 에러 없이 넘길 수 있는데, 함수 반환 타입은 좁은 `Pick`
    이고 스프레드 결과를 `as never` 로 캐스트해 반환하므로 초과 프로퍼티 검사가 전혀 걸리지
    않는다. 결과적으로 `makeExecution({ error: {...} })` 처럼 `Pick` 밖 키를 override 해도
    컴파일은 통과하고, 그 값은 반환 객체에 조용히 섞여 들어가되 `getStatus` 구현
    (`grep` 확인: `interaction.service.ts` 는 `execution.error` 를 전혀 읽지 않고
    `execution.outputData` 만 두 terminal 분기 모두에서 읽는다)이 그 필드를 아예 소비하지
    않으니 사실상 무시된다. RESOLUTION(`19_24_24`)에 정확히 이 함정이 기록돼 있다 —
    terminal `error` 캐너리 초안이 `execution.error` 에 값을 넣었다가 어서션이
    `undefined` 를 받아 실패했고, 원인 규명 후 `outputData` 로 정정했다. 이번엔 실패한
    어서션이 즉시 잡아냈지만, 어서션이 우연히 관대했다면(예: `toBeUndefined()` 류 negative
    assertion) 같은 실수가 조용히 통과했을 수 있다 — 이 저장소가 반복 지적한 "제3상태에서
    참인 부정 단언" 패턴과 결이 같은 잠재 함정이다.
  - 제안: 필수 아님(이미 한 번 자기교정됐고 재발해도 대개 어서션이 즉시 실패로 잡는다).
    다만 재발을 원천 차단하려면 `overrides` 파라미터 타입을 반환 타입과 동일한 `Pick<...>`
    으로 좁혀(`Partial<Pick<Execution, ...>>`) `error` 같은 무관 키를 넘기면 그 자리에서
    컴파일 에러가 나게 할 수 있다.

## 강점 (참고)

- 이번 라운드가 새로 추가한 유일한 프로덕션 코드 변경(`Object.freeze` 적용, JSDoc `{@link}`
  깨진 참조 정정)은 모두 기존 캐너리 스위트를 깨지 않았고(80/80 GREEN, 직접 재실행), 정정
  자체도 산문 참조로 결합을 늘리지 않는 선택을 했다 — 이 부분은 코드 품질 문제이지 테스트
  갭은 아니다.
- terminal `error` 캐너리의 "실패 후 정정" 이력이 RESOLUTION 에 그대로 남아 있는 것은 이
  캐너리가 실제로 판별력을 가진다는 가장 강한 증거다(뮤테이션 시뮬레이션이 아니라 **진짜
  최초 실행에서 RED** 를 낸 사례).
- `node-output-allowlist.spec.ts` 의 리터럴 대조 캐너리(`it('[리터럴] wire 전용 키가 목록에서
  사라지면 여기서 잡힌다', ...)`{`:58-80`})는 "생성 입력 vs 큐레이션 코퍼스" 함정을 저자
  스스로 재현·수정한 모범 사례로 이미 여러 라운드에서 확인됐다 — 본 라운드에서도 재확인.
- 신규 테스트 전부가 `makeMocks()`/`makeExecution()` 기반 독립 인스턴스이고 실행 순서
  의존성이 없다(각 `it` 가 자체 mock 설정 완결). 격리 문제 없음.

## 요약

`nodeOutput` fail-closed allowlist 의 테스트 커버리지는 3라운드에 걸쳐 CRITICAL/WARNING 급
갭이 모두 해소된 성숙한 상태다 — `__proto__` 방어, buttons 분기, terminal result/error 경계
의도, 배선-유틸 캐너리 분리가 전부 실제 소스와 대조 확인됐고 80/80 GREEN 이다. 본 라운드에서
새로 유입된 코드(`Object.freeze`, JSDoc 링크 정정)에 대해서만 뮤테이션 검증을 수행한 결과,
`Object.freeze` 가 지키려는 "런타임 불변" 주장 자체를 검증하는 테스트가 없다는 새 INFO 1건과,
이미 한 번 실제로 발생했던 테스트 픽스처 함정(`makeExecution` 의 `Pick` 밖 override 조용한
무시)이 재발 방지책 없이 남아 있다는 INFO 1건을 확인했다. 둘 다 CRITICAL/WARNING 수준은
아니며 저비용으로 닫을 수 있는 잔여 갭이다.

## 위험도

LOW

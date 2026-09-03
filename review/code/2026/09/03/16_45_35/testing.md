# 테스트(Testing) 리뷰 — entity-nullable-column-type-mismatch 배치 2

## 스코프 요약

리뷰 대상 11개 파일 중 9개는 TypeORM 엔티티의 TS 타입을 `nullable: true` DB 컬럼 실제 상태에
맞춰 `| null` 로 넓히는 순수 타입 변경, 1개(`redact-stored-error.ts`)는 그 파급으로 시그니처가
넓어진 소비 측 유틸리티, 1개는 plan 문서 갱신이다. **이 배치 자체는 테스트 파일을 추가/수정하지
않는다** — 배치 1(`63d9e87b8`의 부모 커밋 `255aa8597`)에서 만든 구조적 회귀 가드
(`nullable-type-lie-cast.spec.ts`)가 모든 엔티티 파일을 스캔해 이 배치도 자동으로 검증한다.

## 검증 재현 (제출된 수치를 직접 재실행)

- `npx tsc --noEmit -p tsconfig.json` 직접 실행 → **비-spec(프로덕션) 소스 오류 0건** 확인
  (spec 오류 37파일은 기존 ratchet baseline 과 일치, 이 배치가 새로 늘린 오류 없음).
- `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` → **12/12 PASS**
  (커밋 메시지의 "가드 12/12"와 일치).
- `npx jest src/shared/utils/redact-stored-error.spec.ts` → **34/34 PASS**.
- 커밋 메시지가 주장하는 `e2e(292, 부팅 확인)` PASS 는 본 세션에서 직접 재실행하지 않았다
  (비용상 생략) — 다만 위 두 항목의 재현이 일치하므로 나머지 수치도 신뢰도가 높다고 판단.

이 세 가지 재현 결과는 모두 리포지토리를 수정하지 않고 얻었다(`git status --short` 확인 시
`review/code/**` 산출물 외 변경 없음).

## 발견사항

- **[WARNING]** `redact-stored-error.spec.ts`의 부재-보존 테스트 주석이, 이 diff가 정정한
  전제를 여전히 참으로 서술한다 — 캐스트가 이미 불필요해졌는데 방치됨
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:294`
    (주석) 및 `:305` (해당 캐스트) — 이 파일은 이번 diff에 포함되지 않은 **미변경** 파일이라
    프롬프트에 게이트가 없음. `Read`로 실제 파일을 열어 확인한 실제 소스 라인 번호.
  - 상세: 이번 diff는 `redact-stored-error.ts`의 JSDoc에서 *"시그니처가 `| null`을 안 적는
    것은 의도다 — 엔티티가 두 컬럼을 non-null로 선언하므로 정적으로는 null이 올 수 없고"*라는
    전제를 취소선으로 남기고 *"이 전제가 무너졌다 — 이제 정적으로도 null이 온다"*로 정정했다
    (`redact-stored-error.ts:128-135`, `NodeExecution.inputData/outputData/error`가
    `| null`로 넓혀지고 `redactNodeExecutionRowForResponse`의 제네릭 제약도
    `Record<string, unknown> | null`로 넓어졌기 때문). 그런데 같은 함수를 겨눈
    `redact-stored-error.spec.ts:294`의 `//` 주석은 여전히 *"타입상 두 컬럼은 non-null이라
    **정적으로는** 도달 불가다. 캐스트로 TypeORM이 런타임에 줄 수 있는 형태를 재현한다"*라고
    — 방금 프로덕션 코드가 반증한 바로 그 문장을 — 그대로 서술한다. 실측: scratch 백업 후
    `:305`의 `{ [column]: absent } as unknown as Record<string, unknown>` 캐스트를
    완전히 제거하고 `tsc --noEmit`을 재실행해도 **오류 0건**이었다(원본으로 즉시 `cp` 복원,
    `git status --short` clean 확인). 즉 이 캐스트는 배치 2 이후 **완전히 불필요**해졌고,
    주석의 "정적으로는 도달 불가" 서술은 이제 거짓이다. 기능적으로 테스트는 여전히 통과하므로
    버그는 아니지만, 이 프로젝트가 반복적으로 지적해 온 "정정된 전제가 형제 파일에 미러링되지
    않아 다음 사람을 오도한다" 패턴 그 자체다 — 정정 대상 파일(`redact-stored-error.ts`)의
    작성자가 같은 세션에서 이미 이 패턴을 인지하고 프로덕션 JSDoc은 고쳤으면서, 테스트 파일의
    같은 서술은 놓쳤다.
  - 제안: `:294-295` 주석을 "이제 정적으로도 null이 도달하므로 캐스트가 더 이상 필요 없다"로
    정정하고, `:305`의 이중 캐스트를 제거(또는 최소 `as Record<string, unknown>` 단일 캐스트로
    축소)해 실제 타입 계약을 테스트가 그대로 반영하도록 한다. `undefined` 케이스(같은
    `describe.each`의 다른 분기)는 여전히 캐스트가 필요할 수 있으니 두 분기를 분리해 확인할 것.

## 위 외 관점별 소견

1. **테스트 존재 여부** — 이 배치는 순수 타입 확장(런타임 로직 무변경)이라 신규 유닛 테스트를
   추가하지 않은 것이 합리적이다. 배치 1이 이 정확한 회귀 클래스(타입만 넓히면 TypeORM
   `design:type`이 `Object`로 방출돼 부팅이 깨지는 문제)를 위해 만든 구조적 가드
   (`findUntypedNullableColumns`)가 이 배치의 모든 `type:` 추가/누락을 자동으로 재검증한다.
   개별 필드마다 커밋별 테스트를 새로 쓰는 대신 "다음에도 같은 결함 클래스가 재발하면
   가드가 잡는다"는 설계로, 유닛 테스트보다 이 클래스의 결함에 더 적합한 선택이다.
2. **커버리지 갭** — 각 엔티티 파일에서 `type:` 추가가 필요한 자리(FK가 아닌 컬럼)와 면제되는
   자리(같은 `@JoinColumn` 이름과 일치하는 FK 컬럼: `execution.entity.ts`의 `triggerId`/
   `executedBy`/`parentExecutionId` 등)를 diff 전체에 대해 직접 대조했고, 9개 엔티티 파일
   전부 가드 규칙과 일치했다(누락 0건). `findUntypedNullableColumns([...전체 src...])`를
   가드 스펙이 실제 소스 트리에 대해 실행해 `toEqual([])`로 단언하므로, 이 배치가 놓친 자리가
   있었다면 로컬 재실행에서 RED가 됐을 것 — 12/12 PASS로 이 경로는 실측 커버됐다.
3. **엣지 케이스 테스트** — `redact-stored-error.spec.ts`는 `null`/`undefined` 두 부재 형태를
   각각 3개 컬럼에 대해 개별 단언하는 `describe.each`/`it.each` 조합을 이미 갖추고 있어(WARNING
   찾은 자리 제외하면) 엣지 케이스 커버리지 자체는 충실하다.
4. **Mock 적절성** — 이 배치에서 새 mock/stub이 도입되지 않았다. 가드 테스트
   (`nullable-type-lie-cast.spec.ts`)는 실제 소스 파일 스캔(대조군)과 `mkdtempSync` 합성
   fixture(단위 동작 검증)를 분리해 사용하는데, 이는 형제 가드(`masked-reject-callers.spec.ts`)
   관례를 따른 것이고 과거 "실제 서비스 파일을 `writeFileSync`로 변형했다 복원 실패" 사고를
   피하기 위해 의도적으로 합성 fixture로 옮긴 이력이 주석에 남아 있다 — 적절하다.
5. **테스트 격리** — 가드 스펙의 합성 fixture 헬퍼(`withFixture`)가 `mkdtempSync`로 격리된
   임시 디렉터리를 만들고 `finally`에서 `rmSync({recursive:true, force:true})`로 정리한다.
   테스트 간 상태 공유나 정리 실패로 인한 오염 가능성이 낮다.
6. **테스트 가독성** — 두 스펙 파일 모두 "왜 이 테스트가 존재하는가"를 리뷰 라운드 ID까지
   인용하며 문서화해(`14_46_46 testing W2` 등) 의도가 명확하다. 다만 WARNING 항목처럼 그
   서술이 실제 코드 변경을 못 따라가면 가독성이 오히려 오도로 바뀔 수 있다는 점이 이번에
   드러났다.
7. **회귀 테스트** — `redact-stored-error.spec.ts` 34/34, `nullable-type-lie-cast.spec.ts`
   12/12 모두 배치 2 반영 후 그대로 통과해 기존 테스트가 유효하다. WARNING 항목은 "테스트가
   깨졌다"가 아니라 "테스트의 서술된 근거가 낡았다"는 점에서 회귀는 아니다.
8. **테스트 용이성** — 엔티티 타입을 실제 nullable 여부에 맞추는 이번 변경은 오히려 테스트
   용이성을 개선한다: 이전에는 `null`을 다루는 fixture가 `null as unknown as X` 이중 캐스트
   없이는 타입체크를 통과하지 못했는데(배치 1이 그 캐스트 8건을 제거), 이번 배치도 같은
   방향으로 `redactNodeExecutionRowForResponse`의 제네릭 제약을 넓혀 이제 캐스트 없이 `null`을
   직접 대입할 수 있음을 실측으로 확인했다(WARNING 항목의 근거이기도 하다) — 테스트가 실제
   런타임 계약을 더 적은 억지 캐스트로 표현할 수 있게 됐다.

## 요약

배치 2는 런타임 로직을 바꾸지 않는 TS 타입 정합화이며, 개별 신규 테스트 대신 배치 1이 구축한
구조적 가드(`nullable-type-lie-cast.spec.ts`)와 `tsc`/e2e 부팅 확인으로 검증하는 전략을
택했다 — 이 전략은 실제로 값을 냈다(`type:` 누락 7건을 커밋 전에 자동으로 잡음, 배치 1의 e2e
전용 발견보다 개선). 본 세션에서 `tsc` 비-spec 오류 0건, 가드 12/12, `redact-stored-error`
34/34를 직접 재현해 제출된 검증 수치를 확인했고, 리포지토리에 잔여 변경 없음을 확인했다.
유일한 실질 발견은 `redact-stored-error.spec.ts`(이번 diff에 포함되지 않은 인접 파일)의 주석
하나가 이번 diff가 프로덕션 JSDoc에서 정정한 것과 동일한 전제를 여전히 참으로 서술하고, 그
근거였던 이중 캐스트가 실측상 완전히 불필요해졌다는 점이다 — 기능적 결함은 아니지만 다음
독자를 오도할 수 있는 문서 부채다.

## 위험도

LOW

# 테스트(Testing) 리뷰 — swagger DTO 계약 가드 + 경로 정규화 배치 (4R)

## 발견사항

- **[WARNING]** `toPosixRelative` 신규 호출 3개 지점 — 인자 순서가 뒤바뀌어도 어떤 테스트도 실패하지 않는다 (뮤테이션으로 실측 확인)
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts:64`
    (`toPosixRelative(REPO_ROOT, f)`) · `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:312`
    (`toPosixRelative(SRC_ROOT, file)`) · `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:52,125,258`
    (`toPosixRelative(SRC_ROOT, file)` × 3)
  - 상세: 이번 배치(3R 커밋 `fd5697f92`)가 정확히 "정규화 누락 자리를 못 찾은 grep 패턴" 문제를
    스스로 지적하고 고쳤다 — 그런데 그 수정이 **호출부에서 인자 순서를 지킨다는 것**은
    어떤 테스트도 확인하지 않는다. 세 파일 모두 결과를 `expect(...).toEqual([])` 로만
    단언하고, `file`/`.file` 값 자체를 관찰하는 자리는 그 배열이 **비어 있는** happy-path
    뿐이다 — 즉 `toPosixRelative(root, file)` 을 `toPosixRelative(file, root)` 로 뒤집어도
    관측되는 문자열이 아예 생성되지 않으니(위반 0건이므로) 통과한다.
    실측(원본 `cp` 로 백업 후 저장소 파일을 직접 편집 → 테스트 실행 → `cp` 로 원복,
    `git status --short` 로 잔여물 없음 확인 완료):
    | 대상 | 뮤테이션 | 실측 |
    |---|---|---|
    | `audit-action-binding.spec.ts:65` | `toPosixRelative(REPO_ROOT, f)` → `toPosixRelative(f, REPO_ROOT)` | **18/18 GREEN** |
    | `websocket-events.types.spec.ts:312` | `toPosixRelative(SRC_ROOT, file)` → `toPosixRelative(file, SRC_ROOT)` | **12/12 GREEN** |
    | `nullable-type-lie-cast-guard.ts:52,125,258` (3곳 동시) | 동일 스왑 | **31/31 GREEN** |

    세 경우 다 원복 후 diff 없음 확인. 형제 파일 `engine-error-code-anchor-guard.ts` 는
    같은 클래스의 콜사이트지만 `engine-error-code-anchor.spec.ts` 에 이미 `[positive path]`
    fixture 테스트(`hits[0].file` 를 `toContain` 으로 직접 단언)가 있어 이 스왑이 걸린다 —
    이 저장소가 이미 그 방어 패턴을 알고 있다는 뜻이다. 이번 diff 가 `toPosixRelative` 를
    새로 배선한 나머지 세 자리는 그 패턴을 안 따랐다.
  - 제안: `swagger-dto-contract.spec.ts`(이 배치 자신이 세운 "[대조군] 실패 위치(line/file)
    보고" 절, 리뷰 W5 대응)와 같은 방식으로, 각 가드에 인위적 위반 1건을 발생시켜
    `.file` 값을 `toContain`/`toMatchObject` 로 직접 단언하는 캐너리를 최소 1개씩 추가한다.
    `audit-action-binding-guard.ts`/`nullable-type-lie-cast-guard.ts` 는 이미 fixture 상수
    (`ARROW_FIELD_BARE_SOURCE` 등, `FIXTURE_OBJECT_FORM` 등)를 갖추고 있어 그 인프라를
    재사용하면 된다.

- **[INFO]** `hasTopLevelNull` 이 `ParenthesizedTypeNode` 를 언랩하지 않는다 — 이전 라운드부터 이어지는 잔여 갭, 이번에도 미조치
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:83-90` (`hasTopLevelNull`)
  - 상세: `field: (string | null);` 처럼 최상위가 괄호로 감싸인 유니온이면
    `ts.isUnionTypeNode(type)` 가 거짓이 되어 `null` 항을 놓친다(위음성). 2026-09-04 기준
    저장소에 이 형태 0건이라 당장 실사례는 없다 — 2R·3R 리뷰가 이미 INFO 로 반복 지적했고
    이번 라운드도 그대로 남아 있다. 급하지 않음을 유지하되, 이 배치가 "괄호로 감싼 유니온"
    형태를 스스로 만들어내는 것은 아니므로 회귀 위험이 늘지는 않았다.
  - 제안: 여유가 있을 때 `ts.isParenthesizedTypeNode` 언랩 + 캐너리 테스트 1개 추가. 급하지 않음.

- **[INFO]** `readBooleanOption` 이 boolean 리터럴만 인식한다 — 상수 참조로 쓰이면 조용히 미탐지
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74`
  - 상세: `nullable: SOME_CONST` 처럼 식별자로 주어지면 `TrueKeyword`/`FalseKeyword` 매칭에
    걸리지 않아 `undefined` 로 처리된다. 저장소 전수 실측(1,096개 필드)에서는 현재 전부
    리터럴이라 오탐/누락이 없다 — 1R api_contract 리뷰가 이미 지적했고 이번 라운드도 미조치.
    새 결함은 아니다.
  - 제안: 급하지 않음. 리터럴이 아닌 인자를 만나면 판정을 건너뛰는 대신 별도 카테고리로
    표시하는 방어를 고려할 수 있다.

## 회귀·격리·가독성·Mock 평가 (양호 — 발견사항 아님)

- `swagger-dto-contract-guard.ts`/`.spec.ts` 는 mock 없이 실제 `typescript` AST 파서 +
  실제 `@nestjs/swagger` 데코레이터(캐너리, `Reflect.getMetadata`)를 쓴다 — 판정 로직과
  실제 라이브러리 동작 사이의 괴리 위험이 낮다.
- `temp-fixture.spec.ts` 의 "async 콜백이 실제로 reject" 테스트(3R W3 수정)는 이번 라운드
  기준으로 검증됐다 — `result.then(undefined, () => {})` 핸들러를 제거하는 뮤테이션이
  RESOLUTION(`12_17_50`)에 예측/실측 두 칸으로 기록돼 있고(RED 1건 → 원복 GREEN 6건),
  콜백이 `return 1`(resolve)이 아니라 실제로 `throw` 하도록 바뀌어 이름과 실제 검사 경로가
  일치한다. `process.on/off('unhandledRejection', ...)` 를 `try/finally` 로 감싸 리스너
  누수 없이 격리됐다.
- `source-scan.spec.ts` 의 `toPosixPath`/`toPosixRelative` 유닛 테스트는 윈도우 구분자
  뮤테이션(`join('/')` → `join('WRONG')`)에 대해 회귀 이력(예측/실측)이 RESOLUTION 문서에
  남아 있고, 단일 세그먼트/중첩 케이스를 구분해 "구분자가 실제로 나타나는" 픽스처를
  갖춰 vacuous 하지 않다.
- `nullable-type-lie-cast.spec.ts` 의 로컬 `withFixture` 는 이제 `sharedWithFixture` 로
  위임한다(2R W1 수정) — JSDoc "얇은 래퍼" 서술과 구현이 일치한다.
- 각 신규/변경 테스트가 `withFixture`/`withFiles` 로 독립된 `mkdtempSync` 디렉터리를 받고
  `finally` 에서 지우므로 테스트 간 격리가 유지된다.
- DTO 변경 2건(`background-run-response.dto.ts`, `create-assistant-session.dto.ts`)은
  저장소 전수 가드(`OpenAPI 선언과 TS 타입이 어긋난 필드가 없다`)가 회귀 테스트 역할을
  대신하며, presence/null 두 축 모두 대조군이 촘촘하다(정규식이 세 번 틀렸던 구체적 형태
  각각에 대응하는 케이스 포함).

## 요약

이번 배치(누적 4라운드)는 이 저장소가 반복해서 스스로 발견해 온 "vacuous positive-only 테스트" 결함 클래스를 `swagger-dto-contract.spec.ts` 자신(`line`/`file` 대조군, W5)과 `temp-fixture.spec.ts`(async reject, W3)에서는 성공적으로 닫았다. 그런데 같은 라운드가 새로 배선한 `toPosixRelative` 호출 3개 지점(`audit-action-binding.spec.ts`, `websocket-events.types.spec.ts`, `nullable-type-lie-cast-guard.ts` 3곳)은 정확히 같은 결함 클래스를 새로 남겼다 — `.file` 필드가 "위반이 있을 때만" 관측되는데 각 가드의 happy-path 는 위반 0건이라 그 문자열이 한 번도 실행되지 않는다. 실제로 인자 순서를 뒤집는 뮤테이션을 저장소 밖 백업 후 3개 파일에 적용해 확인한 결과 관련 스위트가 각각 18/18·12/12·31/31 전부 GREEN 이었다(뮤테이션은 즉시 원복, 잔여물 없음 확인). 형제 파일 `engine-error-code-anchor-guard.ts` 는 이미 `[positive path]` fixture 로 이 클래스를 방어하고 있어 저장소 자체는 그 패턴을 알고 있다 — 이번 세 자리만 그 관례를 안 따랐다. 나머지 두 잔여 항목(`hasTopLevelNull` 괄호-유니온 미언랩, `readBooleanOption` non-literal)은 이전 라운드부터 이어지는 INFO 로 실사례 0건이며 이번 라운드가 새로 만든 위험은 아니다.

## 위험도

MEDIUM

# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** `$sourceItem.`/`$dataSource.` getSample 이 null 가능 필드를 타입 단언으로 비-null 처리
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts` `NESTED_DRILL_SOURCES` 내 `getSample: (d) => d.sourceItemSample as Record<string, unknown>` (두 곳)
  - 상세: `ExpressionData.sourceItemSample` 의 타입은 `Record<string, unknown> | null` (`use-expression-context.ts:56`). 원래 코드는 `if (... && expressionData.sourceItemSample)` 형태로 TS 가 블록 내부에서 null 을 좁혀 캐스트가 불필요했다. 리팩터 후에는 `getSample` 이 테이블에 독립 함수로 분리되면서 컴파일러가 더 이상 좁힐 수 없어 `as` 로 우회했다. 현재는 디스패치 루프가 `available` 게이트(`!!d.sourceItemSample`)를 `getSample` 호출 전에 항상 먼저 평가하므로 런타임 동작은 원본과 동일하다 — 기능적 결함은 아니다. 다만 이 불변식은 "같은 루프 안에서 항상 이 순서로 호출된다"는 암묵적 계약에 의존하며, 타입 시스템이 더는 이를 강제하지 않는다.
  - 제안: 강한 요구는 아니지만, 향후 유지보수 안전성을 위해 `getSample: (d) => d.sourceItemSample ?? {}` 처럼 널 병합으로 방어적으로 작성하면 `available` 게이트 없이 `getSample` 을 단독 호출해도 안전해진다. 기능 변경 없는 선택적 개선.

- **[INFO]** `$sourceItem.`/`$dataSource.` 자동완성 트리거가 spec §7.1/§8.4.2 표에 미기재 (기존 갭, 본 diff 이전부터 존재)
  - 위치: `spec/5-system/5-expression-language.md:399-403` (§7.1 트리거 조건 표), `:516-521` (§8.4.2 자동완성 표) vs 구현의 `NESTED_DRILL_SOURCES` 4개 항목
  - 상세: 두 표 모두 `{{`, `$input.`, `$params.`, `$node["`, `$var.` 만 나열하고 `$sourceItem.`/`$dataSource.` 필드 드릴은 언급이 없다. 반면 `> Table 노드 한정 컨텍스트` 콜아웃(줄 185)은 `$sourceItem`/`$sourceItemIndex`/`$dataSource` 변수 자체의 존재는 언급하지만, 그 값에 대한 `.` 드릴 자동완성 동작은 두 표 어디에도 없다. 단, 이 갭은 리팩터 대상 diff 가 만든 것이 아니라 — 리팩터 이전에도 `$sourceItem.`/`$dataSource.` 는 별도 if-block 으로 이미 존재했고 spec 표는 그때도 이를 담지 않았다. 즉 이번 PR 이 유발한 회귀가 아니라 선재하는 spec 커버리지 갭이다. plan 문서도 "spec·런타임·백엔드·사용자 가시 동작 무변경" 을 명시하고 있어 본 PR 범위 밖.
  - 제안: 코드 수정 불필요(본 PR 스코프 아님). 별도 spec 갱신이 필요하면 `project-planner` 가 §7.1/§8.4.2 표에 `$sourceItem.`/`$dataSource.` 행을 추가하는 것을 백로그로 남길 만하다 (SPEC-DRIFT 태그는 이번 diff 로 인한 것이 아니므로 미부여).

## 리팩터 정합성 검증 (behavior-preserving 확인)

`use-expression-suggestions.ts` 변경은 `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` 4개 if-block을 `NESTED_DRILL_SOURCES` 테이블 + 단일 for-loop 로 추출한 순수 리팩터다. 각 항목을 원본과 line-level 대조한 결과:

- `$input.`: `getSample=d.inputSample`, `getSchema=d.inputSchema` — 원본과 동일.
- `$params.`: guard 로직(`typeof === "object" && !Array.isArray` → `{}` fallback), `getSchema=d.inputSchema?.properties?.parameters` — 원본과 완전히 동일한 표현식.
- `$sourceItem.`: `available: !!d.sourceItemSample` 게이트가 원본의 `&& expressionData.sourceItemSample` 조건을 정확히 재현. `getSchema` 미정의 → 원본도 세 번째 인자 생략(undefined) — 일치. `prefix.length`(12) 로 slice — 원본의 `slice(12)` 와 일치.
- `$dataSource.`: `$sourceItem.` 과 동일 소스(`sourceItemSample`)·동일 게이트 — 원본과 일치.
- fall-through: 게이트 실패 시 `continue` 로 다음 테이블 항목으로 넘어가고, 최종적으로 루프를 빠져나와 `$var.` → root-variable 목록으로 떨어진다. 원본에서 `if` 조건이 거짓일 때 다음 코드 블록으로 자연히 흘러가던 것과 동일한 효과 — 테이블-컨텍스트 가드(`$sourceItem`/`$dataSource` 미가용 시 빈 배열이 아니라 root 목록 표시) 보존 확인.
- prefix 문자열들(`$input.`, `$params.`, `$sourceItem.`, `$dataSource.`, `$var.`)은 서로 겹치지 않는 리터럴이라 순서 재배치(원본에서 `$var.` 가 `$params.`와 `$sourceItem.` 사이에 있었을 것으로 추정되나 diff 미표시 구간 — 현재는 루프 뒤로 이동)가 매칭 결과에 영향 없음.
- 기존 단위테스트 `use-expression-suggestions.test.ts` 는 4개 prefix 각각의 top-level/중첩/prefix-filter/게이트-미가용 케이스를 모두 커버 (`$params.` non-object/empty parameters fallback, `$sourceItem.`/`$dataSource.` null-sample fallback 포함) — 실행 결과 56/56 통과, 리팩터 전후 동작 불변 실측 확인.
- lint(`eslint`)·`tsc --noEmit` 모두 해당 파일에 대해 에러 없음.
- TODO/FIXME/HACK/XXX 주석 없음.

`plan/in-progress/suggestions-prefix-dry.md` 의 설계 체크리스트(테이블 스키마, 4-block→loop, fall-through 보존, 위치를 기존 `$input.` 자리로)와 실제 구현이 1:1 대응한다. 체크박스 자체는 아직 미체크(`- [ ]`) 상태이나 이는 워크플로 진행 상태 표기 문제로 코드 결함이 아니다.

## 요약

`use-expression-suggestions.ts` 의 `NESTED_DRILL_SOURCES` 추출 리팩터는 4개 중복 if-block 을 데이터 테이블 + 단일 dispatcher loop 으로 대체하되, 각 prefix 의 sample/schema 소스·availability 게이트·slice 길이·fall-through 순서를 원본과 line-level 로 정확히 재현했다. 기존 56개 단위테스트가 전부 통과하고 lint/tsc 도 클린해 "behavior-preserving" 목표를 실측으로 뒷받침한다. 발견된 사항은 모두 INFO 수준(getSample 의 null 단언 방어성 저하, `$sourceItem.`/`$dataSource.` 가 spec 자동완성 표에 선재하던 미기재 갭)이며 어느 것도 이번 diff 가 유발한 기능 결함이 아니다. TODO/FIXME 없음, 반환값 누락 경로 없음, 에러 시나리오(게이트 미충족)도 원본과 동일하게 처리된다.

## 위험도

LOW

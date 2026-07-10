# 문서화(Documentation) 리뷰 결과

대상: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts` (4개 if-block → `NESTED_DRILL_SOURCES` 테이블+dispatcher DRY 리팩터), `plan/in-progress/suggestions-prefix-dry.md` (신규 plan)

## 발견사항

- **[INFO]** `NESTED_DRILL_SOURCES` 테이블 JSDoc 품질 우수 — 특기사항 없음
  - 위치: `use-expression-suggestions.ts:35-43` (신규 상수 상단 블록 주석)
  - 상세: 신규 도입된 모듈 레벨 테이블에 목적("`<prefix>.` 드릴이 nested-field suggestion 으로 해석"), `{@link buildNestedSuggestions}` 참조, `available` 게이트의 fall-through 의미(`$sourceItem`/`$dataSource` table-context guard 보존), 적용 범위 밖 항목(`$var.`, `$node[...]` 는 별도 핸들러) 및 확장 방법("Adding a nested-drill root = one entry here")까지 명시. 제거된 4개 if-block 각각에 붙어 있던 개별 설명(`$input.`/`$params.`/`$sourceItem.`/`$dataSource.`)도 테이블 각 entry 옆 인라인 주석으로 정확히 이관되었고 내용 누락·왜곡이 없음(예: `$params.` 항목의 enricher §7.2 참조, resolver `paramsFromInput` 언급 등 원문 그대로 보존).
  - 제안: 없음(참고 사항).

- **[INFO]** 오래된 주석(stale comment) 없음 — 검증 완료
  - 위치: `use-expression-suggestions.ts` 전체 diff
  - 상세: 개별 if-block 제거와 동시에 해당 주석도 함께 제거되고 테이블/loop 쪽으로 정확히 재배치됨. dispatcher loop 위(`use-expression-suggestions.ts:472-475`) 주석도 4개 root(`$input`/`$params`/`$sourceItem`/`$dataSource`)와 fall-through 동작을 정확히 기술하며 실제 loop 로직(`available` 게이트 → `continue`)과 일치. 코드와 주석 간 불일치 없음.
  - 제안: 없음.

- **[INFO]** README/API 문서/CHANGELOG 업데이트 불필요 — 순수 내부 리팩터
  - 위치: 리뷰 대상 diff 전체 + `plan/in-progress/suggestions-prefix-dry.md` "비고" 섹션
  - 상세: 4개 if-block을 테이블+dispatcher로 합친 것은 동일 입력에 대해 동일 출력을 내는 behavior-preserving 리팩터이며(신규 prefix·신규 UX 없음), 공개 API·라우트·환경변수·설정도 변경되지 않았다. 이 저장소의 `CHANGELOG.md` 는 사용자 가시 동작 변경/버그 수정에 대해서만 엔트리를 기록하는 관례를 따르고 있는데(예: 최근 엔트리들이 전부 "자동완성이 ~한다"/"버그를 고쳤다" 류의 동작 변화), 본 변경은 그 범주에 해당하지 않으므로 CHANGELOG 미기재가 관례와 일치한다. plan 문서도 이를 "순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경. 기존 테스트가 회귀 게이트"로 명시적으로 스코핑해 두어 리뷰어/후속 작업자가 오해할 여지가 없다.
  - 제안: 없음. (다만 PR 본문에도 동일하게 "behavior-preserving, no CHANGELOG entry" 를 한 줄로 남겨두면 리뷰어 확인 비용이 줄어든다 — optional.)

- **[INFO]** `plan/in-progress/suggestions-prefix-dry.md` 자체 문서 품질 — plan-lifecycle 규약 준수
  - 위치: 신규 파일 전체
  - 상세: frontmatter(`title`/`worktree`/`started`/`owner`/`spec_area`) 완비, 배경(#878 W3 유래)·설계(테이블 스키마 + 4-entry 매핑 + loop 배치 위치)·테스트(기존 테스트 = behavior 보증)·워크플로 체크리스트가 모두 갖춰져 있다. 설계 섹션에서 서술한 4개 entry(`$input`/`$params`/`$sourceItem`/`$dataSource`)의 `getSample`/`getSchema`/`available` 매핑과 loop 삽입 위치("기존 `$input.` 자리")가 실제 diff와 정확히 일치함을 확인했다 — 계획과 구현의 drift 없음.
  - 제안: 없음.

- **[INFO]** (선택적 개선) 테이블 엔트리 필드별 인라인 타입 주석 부재
  - 위치: `use-expression-suggestions.ts:44-49` (`NESTED_DRILL_SOURCES` 타입 정의: `ReadonlyArray<{ prefix, getSample, getSchema?, available? }>`)
  - 상세: 테이블 상단 블록 JSDoc이 각 필드의 의미(prefix/getSample/getSchema/available)를 산문으로 이미 설명하고 있어 실질적 문서 공백은 아니다. 다만 필드 자체에는 개별 JSDoc이 없어, 타입만 보고(블록 주석을 스크롤해서 안 읽고) 진입하는 경우 `available` 의 "false 시 fall-through, 미정의 시 항상 available" 의미를 즉시 파악하기 어려울 수 있다. `NESTED_DRILL_SOURCES` 는 export 되지 않는 module-private 상수라 우선순위는 낮음.
  - 제안: (optional) `available?: (d: ExpressionData) => boolean; // false → root-변수 목록으로 fall-through (undefined 는 항상 true)` 처럼 필드 옆에 한 줄 보강. 필수는 아님.

## 요약

이번 diff는 `use-expression-suggestions.ts`의 4개 반복되던 nested-field drill if-block(`$input.`/`$params.`/`$sourceItem.`/`$dataSource.`)을 `NESTED_DRILL_SOURCES` 매핑 테이블 + 단일 dispatcher loop으로 통합한 behavior-preserving 리팩터로, 문서화 관점에서는 모범적인 수준이다. 신규 도입된 모듈 레벨 테이블에 목적·게이트 의미·확장 지점을 설명하는 JSDoc이 충실히 달려 있고, 제거된 개별 if-block의 기존 주석(설계 근거, resolver 연동, enricher §7.2 참조 등)이 정보 손실 없이 테이블 엔트리로 정확히 이관되었으며 코드-주석 간 불일치(stale comment)도 발견되지 않았다. 순수 내부 리팩터이므로 README/API 문서/CHANGELOG 갱신이 필요 없다는 판단도 타당하고, 신규 plan 문서(`plan/in-progress/suggestions-prefix-dry.md`) 역시 plan-lifecycle 규약에 맞춰 배경·설계·테스트·워크플로를 명확히 기록했으며 설계 섹션 내용이 실제 diff와 정확히 일치해 계획-구현 drift가 없다. 유일하게 남는 항목은 module-private 테이블의 필드별 인라인 주석 보강이라는 선택적 개선 제안뿐이며, 이는 이미 존재하는 상단 블록 JSDoc으로 충분히 커버되는 수준이라 실질적 문서 공백으로 보기 어렵다.

## 위험도

NONE

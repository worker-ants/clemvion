# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `collectCodeStringLiterals`와 `treeContainsJsx`의 AST 순회 보일러플레이트 중복
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:96-113`(기존), `:123-144`(신규)
  - 상세: 두 함수 모두 `ts.createSourceFile` → `let 누산 변수 선언` → `const visit = (node) => { 조건부 누산; ts.forEachChild(node, visit); }` → `ts.forEachChild(sourceFile, visit)` → `return 누산` 구조를 반복한다. 콜백 내부 조건(문자열 리터럴 수집 vs JSX 노드 존재 판정)만 다르고 순회 골격은 동일하다.
  - 제안: 현재는 2회 반복이라 즉시 추출을 요구할 임계치는 아니지만, 세 번째 유사 순회가 추가되면 `function walkAst(sourceFile: ts.SourceFile, visitor: (node: ts.Node) => void): void` 같은 공용 헬퍼로 추출을 고려. 지금 단계에서는 실제 결함이 아니므로 INFO.

- **[INFO]** `treeContainsJsx`가 `kind` 인자와 무관하게 파일명을 항상 `"probe.tsx"`로 고정
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:124-130`
  - 상세: `ts.createSourceFile`에 명시적 `scriptKind`를 넘기면 파일명 확장자는 파싱 결과에 영향을 주지 않으므로 동작상 문제는 없다. 다만 호출부에서 `ts.ScriptKind.TS`를 직접 넘겨 "구버전 하드코드 시뮬레이션"을 검증하는 테스트(L262)를 처음 읽는 사람은 `.tsx`라는 파일명과 `TS` kind 조합이 모순처럼 보여 잠시 헷갈릴 수 있다.
  - 제안: 함수 상단 JSDoc에 "파일명은 진단용 라벨일 뿐이며 실제 파싱 종류는 `kind` 인자가 전적으로 결정한다"는 한 줄을 추가하면 향후 독자의 오해를 예방할 수 있다. 현재도 문서화 수준이 충분히 높아 강제하지 않음.

- **[INFO]** 가드 테스트 파일이 지속적으로 성장 중 (현재 337줄, 서술형 주석 비중 높음)
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 전체
  - 상세: 이번 PR로 self-test가 2건에서 4건으로, 헬퍼 함수가 2개에서 4개로 늘었다. 각 테스트에 mutation 실측 근거를 담은 장문 주석이 붙어 있어 파일이 무겁다.
  - 제안: 현재는 실제 회귀 이력(PR #968)에 기반한 방어적 문서화로서 정당화되며, 각 주석이 "왜 이 형태가 필요한가"를 구체적으로 설명해 독해 부담보다 이득이 크다. 다만 향후 헬퍼가 더 늘어나면 `scriptKindForFile`/`collectCodeStringLiterals`/`treeContainsJsx`를 별도 유틸 모듈(`__tests__/ast-guard-helpers.ts`)로 분리해 self-test describe 블록과 분리하는 것을 고려할 만하다. 지금 규모에서는 분리를 요구하지 않음.

## 요약

이번 diff는 `.tsx` 등록 사이트 확장에 대비한 `ScriptKind` 파생 로직(`scriptKindForFile`)과 그 정합성을 검증하는 self-test(`treeContainsJsx` 포함), 그리고 `interaction-type-registry.ts`의 "grep 가드" 잔여 표현을 "AST 가드"로 정정하는 문서 수정으로 구성된다. 새로 추가된 함수들은 모두 단일 책임·짧은 길이·명확한 네이밍(`scriptKindForFile`, `treeContainsJsx`)을 유지하고, 각 함수와 테스트 케이스에 "왜 이렇게 작성했는가"를 설명하는 JSDoc/인라인 주석이 충실히 동반되어 있어 가독성이 높다. 매직 넘버·과도한 중첩·높은 순환 복잡도는 없으며, 기존 파일의 스타일(재귀 `visit` 클로저 패턴, `SoT` 주석 관례)과도 일관된다. 유일한 관찰 포인트는 두 AST 순회 함수 간 보일러플레이트가 소폭 중복된다는 점인데, 발생 횟수가 2회에 그치고 각 콜백의 의미가 명확히 달라 즉각적인 추출을 요구할 수준은 아니다. `interaction-type-registry.ts`의 문서 정정도 3곳 전부 일관되게 반영되어 잔여 "grep" 표현이 남아 있지 않음을 확인했다.

## 위험도
LOW

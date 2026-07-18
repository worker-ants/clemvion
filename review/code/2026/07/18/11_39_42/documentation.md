# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `scriptKindForFile` JSDoc 의 역방향(reverse) 주장이 테스트로 고정돼 있지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:274-284` (`scriptKindForFile` 독스트링)
  - 상세: 독스트링은 "the reverse drops literals outright (a `<Config>{ … }` cast parsed as TSX loses its object)" 라고 단언한다. 직접 재현해 사실임을 확인했다 (`ts.createSourceFile("probe.tsx", 'const cfg = <Config>{ foo: 1, bar: "baz" };', ..., ts.ScriptKind.TSX)` → 문자열 리터럴이 0개 수집됨, JSX 트리로 오파싱). 다만 정방향(`.tsx` 를 `ScriptKind.TS` 로 강제 파싱해 JSX 미인식) 은 새로 추가된 `"parses a .tsx site's JSX as JSX so its branch literals stay sound"` 테스트가 `treeContainsJsx` 로 실제 단언하는 반면, 이 역방향 주장은 실행 가능한 단언 없이 독스트링 서술로만 존재한다. 같은 파일의 다른 self-test 들("Self-test for the guard's own mechanism" 주석)이 지키는 "주장은 실행 가능한 property 로 고정한다" 원칙과 비대칭이다.
  - 제안: `REGISTRY_SITES` 가 아직 `.tsx` 를 포함하지 않아 당장 리스크는 낮지만, 대칭성을 위해 `treeContainsJsx` 류 헬퍼로 역방향(TS 캐스트를 TSX 로 파싱 시 리터럴 소실)도 한 줄짜리 테스트로 잠가두면 향후 `scriptKindForFile` 리팩터 시 회귀를 잡을 수 있다.

- **[INFO]** `treeContainsJsx` 의 고정 파일명(`"probe.tsx"`)이 `kind` 매개변수와 무관한 이유가 문서화되지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:338-345`
  - 상세: `treeContainsJsx(source, kind)` 는 항상 파일명을 `"probe.tsx"` 로 고정한 채 `ts.createSourceFile` 을 호출한다. `ts.ScriptKind` 를 명시적으로 넘기면 파일명 확장자는 파싱 방식에 영향을 주지 않으므로 동작은 정확하지만, 독스트링에는 이 사실이 적혀 있지 않아 읽는 사람이 "왜 `kind` 에 맞춰 파일명을 바꾸지 않는가" 를 스스로 재검증해야 한다.
  - 제안: 독스트링에 "`fileName` is irrelevant here — `kind` is passed explicitly and overrides extension-based inference" 한 줄을 추가하면 향후 리더의 재검증 비용을 줄인다.

- **[INFO]** spec 문서의 "grep" 잔여 표현은 이번 diff 범위 밖으로 이미 추적 중 — 문제 없음, 확인만
  - 위치: `spec/conventions/interaction-type-registry.md` L56, L77, L78, L143 (`grep 대상 파일` / `grep 검증 대상` / `코드 grep 결과` / `grep 가드`)
  - 상세: `interaction-type-registry.ts` 의 "grep 가드" → "AST 가드" 정정은 developer 가 접근 가능한 3곳(L14, L63, L64) 모두 반영됐음을 직접 확인했다. 그러나 spec 본문에는 동일 계열의 오래된 "grep" 표현이 4곳 남아 있다. 이는 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 미해결 체크리스트 항목("[project-planner] spec … 잔여 표현 … 다듬기")으로 이미 명시적으로 이월돼 있고, developer 가 `spec/` read-only 라는 프로젝트 규약과 일치하므로 이번 변경의 결함이 아니다.
  - 제안: 없음 (참고용 확인 — 별도 조치 불요, 후속 project-planner 작업으로 이미 추적됨).

## 요약

이번 변경은 코드 자체보다 문서·주석 품질을 개선하는 것이 주 목적인 diff로, 그 목적을 잘 달성하고 있다. `interaction-type-registry.ts` 의 "grep 가드" 표현은 실제 구현(TS AST 파서 기반)과 불일치하던 오래된 주석이었는데, 해당 파일 내 3곳 모두 "AST 가드" 로 정확히 정정되었다(직접 grep 으로 확인). 새로 추가된 `scriptKindForFile` / `treeContainsJsx` 헬퍼와 3개의 self-test 케이스는 "왜 이렇게 파싱해야 하는가" 를 구체적 반례(정규식 리터럴 오탐, `.tsx` 오파싱)와 함께 설명하는 JSDoc 을 갖추고 있으며, 각 주석이 서술하는 위협 모델은 실제 mutation 실측(plan 문서에 기록)과 일치한다. 유일하게 발견한 것은 `scriptKindForFile` 독스트링의 역방향 주장(TS 캐스트를 TSX 로 파싱하면 리터럴이 소실된다)이 사실이지만(직접 재현 검증 완료) 파일의 다른 주장들과 달리 실행 가능한 테스트로 고정돼 있지 않다는 점과, `treeContainsJsx` 의 고정 파일명 선택 이유가 문서화되지 않았다는 점으로, 둘 다 INFO 수준이며 즉시 조치가 필요한 결함은 아니다. spec 문서에 남은 "grep" 잔여 표현은 이미 별도 후속 항목(project-planner)으로 추적 중이라 이번 변경의 갭이 아니다. README·CHANGELOG·API 문서 업데이트는 이 변경이 내부 테스트 인프라 전용(사용자 가시 동작·공개 API·설정 변경 없음)이라 불필요하며, 실제로 직전 원 PR(#972, 정규식→AST 전환)도 같은 기준으로 CHANGELOG 항목을 추가하지 않아 일관성이 있다.

## 위험도
LOW

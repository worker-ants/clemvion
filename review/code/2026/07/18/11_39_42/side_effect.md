### 발견사항

- **[INFO]** 신규 헬퍼(`scriptKindForFile`, `treeContainsJsx`)는 순수 함수, 전역/공유 상태 불변
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` L44-46(`scriptKindForFile`), L338-359(`treeContainsJsx`)
  - 상세: 둘 다 입력만으로 결정되는 순수 함수다. `treeContainsJsx` 는 `ts.createSourceFile`로 AST 를 만들 뿐 파일시스템·네트워크·전역 변수에 접근하지 않는다. `grep -rn "collectCodeStringLiterals|scriptKindForFile|treeContainsJsx"` 로 확인한 결과 이 테스트 파일 밖에는 참조가 없어 공개 API 표면도 아니다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `collectCodeStringLiterals` 내부 `ts.ScriptKind` 결정 로직 변경 — 함수 시그니처는 불변
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` L317 (`scriptKindForFile(fileName)`로 교체, 이전 `ts.ScriptKind.TS` 하드코딩)
  - 상세: 함수 시그니처(`(source: string, fileName: string): Set<string>`)는 diff 컨텍스트상 이미 존재하던 것으로 이번 변경으로 바뀌지 않았다. 동작 변화는 `fileName`이 `.tsx`로 끝날 때만 발생하며, 현재 `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES`는 전부 `.ts` 파일이라 실제 프로덕션 가드 판정 결과에는 변화가 없다(방어적 보강, 회귀 없음). 새 `describe("scriptKindForFile", ...)` 테스트가 `.ts`/`.tsx` 양쪽 분기를 별도로 단언해 이 사실을 검증한다.
  - 제안: 없음.

- **[INFO]** `interaction-type-registry.ts` 변경은 JSDoc 텍스트("grep 가드" → "AST 가드")만 — 런타임 동작·export 표면 무변경
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` L14, L63-64 부근
  - 상세: `INTERACTION_TYPE_VALUES`, `CONVERSATION_SOURCE_VALUES`, `IS_MULTI_TURN_INTERACTION`, `MULTI_TURN_INTERACTION_TYPES` 등 export 값·로직은 diff에 포함되지 않아 불변. 순수 주석 정정이므로 호출자 영향 없음.
  - 제안: 없음.

- **[INFO]** `plan/*.md` 변경은 체크리스트/서술 갱신뿐 — 코드 실행 경로와 무관
  - 위치: `plan/in-progress/interaction-type-guard-comment-false-negative.md`
  - 상세: 문서(추적 파일) 갱신으로 부작용 분석 대상 밖. mutation 실측을 "되돌렸다(`git checkout --`, working tree clean 확인)"고 명시해 테스트 코드 자체에 잔존 오염이 없음을 스스로 검증한 기록도 포함.
  - 제안: 없음.

### 요약

세 파일 모두 부작용 관점에서 위험이 없다. 테스트 파일에 추가된 `scriptKindForFile`/`treeContainsJsx`는 순수 함수로 전역 상태·파일시스템·네트워크·환경 변수에 관여하지 않으며, 이들을 참조하는 곳도 해당 테스트 파일 내부뿐이라 공개 인터페이스 변경도 아니다. `collectCodeStringLiterals`의 내부 `ScriptKind` 결정 로직 변경은 함수 시그니처를 바꾸지 않고, 현재 등록된 사이트가 전부 `.ts`이므로 기존 가드의 실제 판정 결과에는 영향이 없다(향후 `.tsx` 사이트가 추가될 때를 대비한 방어적 보강). `interaction-type-registry.ts`와 plan 문서 변경은 각각 주석 정정과 문서 갱신으로 실행 코드 경로와 무관하다.

### 위험도
NONE

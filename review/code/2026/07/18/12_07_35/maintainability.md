# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 두 `*Type exhaustiveness across registry sites` `describe` 블록의 구조적 중복
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:357-378`(`WaitingInteractionType`) 및 `:396-417`(`ConversationTurnSource`)
  - 상세: 두 블록 모두 "sites × values 이중 루프로 `literals.has(value)` 미존재분 수집 → 비어있지 않으면 정형화된 메시지로 throw" 로직이 사이트 목록·값 목록·에러 라벨·spec 섹션 번호만 다르고 완전히 동일한 형태로 반복된다(약 20줄씩 총 42줄).
  - 제안: `assertExhaustiveLiterals(sites: string[], values: readonly string[], enumLabel: string, specAnchor: string)` 같은 공용 헬퍼로 추출하면 세 번째 registry(예: 향후 새 enum)가 추가될 때 복붙 없이 확장 가능. 현재 2회 반복이라 즉시 강제할 임계치는 아니며, 실제 로직 오류 위험은 없음.

- **[INFO]** `interaction-type-registry.ts` 의 컴파일타임 exhaustiveness 단언 쌍(`_noMissingInteractionType`/`_noMissingSource`) 이 동일 패턴 반복
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:34-38`, `:53-55`
  - 상세: `type Missing… = Exclude<T, (typeof VALUES)[number]>` → `const _noMissing…: [Missing…] extends [never] ? true : never = true` → `void _noMissing…` 3줄 관용구가 두 enum(`WaitingInteractionType`, `ConversationTurnSource`)에 대해 이름만 바꿔 그대로 반복된다.
  - 제안: 제네릭 헬퍼 타입(`type AssertNoMissing<Missing> = […]`)으로 추출할 수는 있으나, TS 타입 레벨 단언은 각 사이트에서 구체 타입을 직접 바인딩해야 컴파일러가 실제로 검사하므로 추출 이득이 크지 않다. 이 idiom 자체가 흔치 않아 처음 읽는 사람에게는 설명 주석(이미 존재)이 필수적임을 참고만.

- **[INFO]** `readRepoFile` 의 저장소 루트 상대경로가 세그먼트 구분 없는 단일 문자열
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:79-82`
  - 상세: `join(__dirname, "../../../../../", relPath)` 처럼 `"../../../../../"` 를 하나의 문자열로 이어 쓰고 있다. 동일 저장소의 다른 `__dirname` 기반 경로 유틸(`href-guard-utils.ts:13`, `locale.test.ts:101`)은 `path.join(__dirname, "..", "..", "..")` 형태로 세그먼트를 분리해, 깊이(레벨 수)를 인자 개수로 눈으로 셀 수 있게 한다. 현재 형태는 깊이가 맞는지 슬래시 개수를 직접 세야 확인 가능하고, 파일이 디렉터리 트리에서 이동하면 조용히 깨질 수 있다.
  - 제안: `join(__dirname, "..", "..", "..", "..", "..", relPath)` 형태로 통일하면 기존 코드베이스 관례와 일관되고 깊이 검증이 쉬워진다. 동작상 문제는 없어 INFO.

- **[INFO]** `describe("collectCodeStringLiterals", …)` 블록에 성격이 다른 self-test 가 함께 배치됨
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:198-344`
  - 상세: 이 블록에는 `collectCodeStringLiterals` 자체를 검증하는 케이스(코멘트 제외, union/property 형태, regex 제외)와, 주로 `parseGuardSource`/`treeContainsJsx` 의 파스-경로 정합성을 검증하는 두 self-test(`.tsx` JSX 인식, `.ts` 캐스트 보존)가 섞여 있다. 뒤의 두 케이스는 `describe` 이름이 가리키는 대상과 결이 다르다.
  - 제안: 파스-체크포인트 관련 두 케이스를 `describe("parseGuardSource / treeContainsJsx")` 로 분리하면 실패 시 어느 계약이 깨졌는지 테스트 이름만으로 더 빠르게 파악할 수 있다. 현재도 각 `it` 이름 자체가 충분히 설명적이라 시급하지 않음.

## 요약

두 파일 모두 함수가 짧고 단일 책임을 유지하며, 이름(`scriptKindForFile`, `parseGuardSource`, `collectStringLiteralsFrom`, `treeContainsJsx`)이 역할을 명확히 드러내고, 매직 넘버·과도한 중첩·높은 순환 복잡도는 없다. 각 함수·테스트 케이스에 "왜 이 형태가 필요한가"를 PR 이력(#968, #972)과 함께 명시한 JSDoc/인라인 주석이 충실히 동반돼 있어, 회귀 배경을 모르는 신규 독자도 의도를 추적할 수 있다. `interaction-type-registry.ts` 의 `as const satisfies` + `Exclude` 컴파일타임 단언과 `Record<WaitingInteractionType, …>` exhaustive 분류 패턴은 기존 코드베이스에서 드물게 쓰이는 idiom 이지만 그 자체로 목적에 부합하고 주석이 왜 AST 가드 대신 이 방식을 택했는지 근거를 남겨 정당화된다. 발견된 항목은 전부 INFO 수준의 경미한 중복(두 exhaustiveness `describe` 블록, 컴파일타임 단언 쌍)과 스타일 불일치(`readRepoFile` 상대경로 세그먼트 미분리, self-test 그룹 배치) 로, 실제 결함이나 즉각적 리팩토링 필요성은 없다. 파일 규모(테스트 391줄)는 방어적 문서화로 이미 직전 라운드(11_39_42)에서 정당성이 확인됐고 이번 diff(`2765ed767`) 는 그 라운드 WARNING #1·#2 를 해소하는 성격이라 새로운 유지보수성 리스크를 추가하지 않는다.

## 위험도
LOW

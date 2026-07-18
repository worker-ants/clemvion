# 유지보수성(Maintainability) 리뷰

대상:
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (신규 `scriptKindForFile` 추출 + self-test 3건 + `describe("scriptKindForFile")` 추가)
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (주석 문구만 "grep 가드" → "AST 가드" 로 정정, 로직 변경 없음)

## 발견사항

- **[INFO]** 두 enum(`WaitingInteractionType` / `ConversationTurnSource`) 의 exhaustiveness `describe` 블록이 구조적으로 거의 동일한 코드를 반복
  - 위치: `interaction-type-exhaustiveness.test.ts:285-306` (`WaitingInteractionType`) 와 `:324-345` (`ConversationTurnSource`)
  - 상세: `missing` 배열 수집 → 이중 `for` 루프 → 동일한 형태의 `Error` throw 메시지 조립까지 두 블록이 거의 1:1 로 중복된다(달라지는 부분은 site 목록·value 목록·enum 이름·spec 섹션 번호뿐). 이번 diff 가 직접 건드린 부분은 아니지만(순수 신규 파일 컨텍스트로 함께 제시됨), 세 번째 등록형 enum(예: 향후 새 `WaitingInteractionType` 유사 개념)이 추가되면 이 ~20줄 블록이 또 한 번 복붙될 가능성이 높다.
  - 제안: `assertExhaustiveLiterals(sites: string[], values: readonly string[], enumLabel: string, specSection: string)` 같은 공용 헬퍼로 추출해 두 `it()` 이 호출만 하도록 정리하면 세 번째 enum 추가 시 복붙 없이 확장 가능. 다만 현재 diff 범위 밖이므로 별도 후속 정리로 미뤄도 무방.

- **[INFO]** `collectCodeStringLiterals` 함수 본문(약 15줄) 대비 JSDoc 주석이 약 40줄로 코드보다 훨씬 김
  - 위치: `interaction-type-exhaustiveness.test.ts:100-131` 부근
  - 상세: PR #968/#972/#977 회귀 이력을 전부 함수 docstring 에 녹여 넣어, 최초 진입 시 "무엇을 하는 함수인지" 파악 전에 회귀 이력부터 읽어야 하는 진입 장벽이 있다. 다만 이 파일이 가드 우회를 반복적으로 겪은 이력이 있는 안전 장치 코드라는 점을 고려하면, 회귀 재발 방지를 위한 의도적 트레이드오프로 보인다(레포 컨벤션상 근거 기록을 중시하는 기존 스타일과도 일치).
  - 제안: 현행 유지 가능. 다만 향후 더 늘어날 경우 "왜(Why)" 설명은 별도 마크다운(spec/conventions 등)으로 옮기고 함수 docstring 은 "무엇(What)" 위주 요약 + 링크로 축약하는 것을 고려.

- **[INFO]** 최상단 상수 네이밍이 두 enum 사이에서 비대칭
  - 위치: `interaction-type-exhaustiveness.test.ts:69`(`REGISTRY_SITES`), `:80`(`ENUM_VALUES`) vs `:318`(`SOURCE_REGISTRY_SITES`), `:322`(`SOURCE_ENUM_VALUES`)
  - 상세: `WaitingInteractionType` 쪽은 접두어 없이 `REGISTRY_SITES`/`ENUM_VALUES`, `ConversationTurnSource` 쪽은 `SOURCE_` 접두어를 붙였다. 파일 전체를 훑을 때 `ENUM_VALUES` 만 보면 어떤 enum 인지 이름만으로는 알기 어렵고, 뒤에 나오는 `SOURCE_ENUM_VALUES` 와 짝을 맞춰야 비로소 구분된다. 이번 diff 로 새로 생긴 이름은 아니고 기존 패턴이다.
  - 제안: `INTERACTION_TYPE_REGISTRY_SITES`/`INTERACTION_TYPE_ENUM_VALUES` 로 대칭 리네이밍하면 파일을 부분적으로만 읽어도 즉시 구분 가능. 우선순위 낮음(로컬 스코프 상수라 실질 혼동 리스크는 작음).

- **[INFO]** 새로 추가된 `scriptKindForFile` 함수는 단일 책임·명확한 네이밍·짧은 본문(3줄)으로 가독성이 좋고, 신규 `describe("scriptKindForFile")` 블록과 self-test(`"parses angle-bracket syntax by extension, through the guard's own entrypoint"`)가 각각 단위 동작과 종단 배선을 분리해서 검증하는 구조도 명확하다. 특별한 개선 제안 없음.

- **[INFO]** `interaction-type-registry.ts` 변경분은 주석 문구 정정("grep 가드" → "AST 가드")뿐으로 로직·구조 변경이 없어 유지보수성 관점에서 리스크 없음.

## 요약

이번 diff 의 핵심 신규 코드(`scriptKindForFile` 추출, `.tsx`/regex/union-type self-test 3건, `describe("scriptKindForFile")`)는 함수 길이·중첩·네이밍 모두 양호하고 각 테스트가 "왜 이 케이스가 필요한가"를 주석으로 명확히 남겨 회귀 방지 관점의 자기 문서화가 잘 되어 있다. 지적된 항목은 모두 이번 diff 이전부터 존재하던 패턴(두 enum 의 exhaustiveness 블록 중복, 상수 네이밍 비대칭)이거나 의도적 트레이드오프(주석 밀도)로, 즉시 수정이 필요한 결함은 없다. 세 번째 registry-site enum 이 추가되는 시점에는 중복 블록 추출을 권장한다.

## 위험도

LOW

# 변경 범위(Scope) 리뷰 — interaction-type 가드 주석 false-negative 차단 (정규식 grep → TS AST 리터럴)

## 검토 대상 재확인

의도된 작업(plan `interaction-type-guard-comment-false-negative.md` §설계 결정)은
`interaction-type-exhaustiveness.test.ts` 의 가드가 정규식(`new RegExp(['"\`]value['"\`])`)으로
문자열을 매칭해 **주석 안의 인용까지 false-positive(green)** 로 처리하던 결함을, TypeScript
컴파일러 API 기반 실제 AST 파싱으로 교체해 차단하는 것이다. 리뷰 대상 10개 파일 중 실제 코드
변경은 파일 1개(`interaction-type-exhaustiveness.test.ts`)뿐이며, 나머지는 이 작업의 plan
문서와 선행 의무 절차인 `/consistency-check --impl-prep` 산출물(SUMMARY + 5개 checker + 메타
파일)이다.

## 발견사항

- **[INFO]** 가드 메커니즘 자체를 검증하는 self-test(`describe("collectCodeStringLiterals", ...)`)가
  신규 추가됨 — 지시된 작업(주석 false-negative 차단)의 직접 산출물은 아니나 회귀 방지 목적에
  부합
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` L122-149
    (전체 컨텍스트 기준 L296-323), 신규 함수 `collectCodeStringLiterals` JSDoc 포함
  - 상세: 원 지시는 "정규식 → TS AST 리터럴 전환"이었는데, 그 전환된 헬퍼 함수 자체가 향후
    다시 정규식/텍스트 매칭으로 리팩터되어도 조용히 green 을 유지하지 않도록 막는 fixture 기반
    self-test(ghost 6개 vs real 2개)가 함께 추가됐다. 이는 새 기능이 아니라 "이번에 고친 결함이
    조용히 재발하지 않는지" 를 검증하는 메타-테스트이며, plan 문서 자체가 이 근거("Without this,
    a future refactor back to a raw-text match would silently restore the comment
    false-negative... Encodes the PR #968 finding as an executable property.")를 명시하고
    있어 임의의 over-engineering 이 아니라 이번 fix 의 자연스러운 연장으로 판단된다.
  - 제안: 조치 불요(수용 가능). 다만 "지시된 변경 외 추가"로 분류될 여지가 있어 투명성 차원에서
    기록.

- **[INFO]** JSDoc/주석 문구를 "AST/grep guard" → "AST guard" 등으로 정정한 것은 실질 변경에
  종속된 필수 동반 갱신이며 무관한 주석 변경이 아님
  - 위치: 두 곳의 JSDoc 헤더(`WaitingInteractionType`/`ConversationTurnSource` 섹션),
    `ENUM_VALUES` 위 인라인 주석("Known limitation" 블록 삭제 포함)
  - 상세: 로직이 실제로 regex 매칭에서 AST 파싱으로 바뀌었으므로 "grep" 을 명명하던 주석과
    "grep 이 백틱/홑따옴표까지 매칭하는 known limitation" 주석은 그 자체로 이제 사실이 아니게
    된다. 이 갱신은 `review/consistency/.../convention_compliance.md` INFO #2 가 "코드 변경 시
    함께 갱신 권장"으로 명시적으로 짚은 항목이기도 하다 — 별건 리팩터링이 아니라 코드 변경에
    수반되는 필수 동기화.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/interaction-type-guard-comment-false-negative.md` 신규 및
  `review/consistency/2026/07/17/19_54_00/**` 8개 파일 동반은 무관한 파일 수정이 아니라 프로젝트
  규약이 요구하는 필수 프로세스 산출물
  - 위치: 두 경로
  - 상세: CLAUDE.md 규약상 진행 중 작업은 `plan/in-progress/<name>.md` 에 추적하고, `developer`
    는 구현 착수 직전 `/consistency-check --impl-prep` 이 의무다. 두 산출물 모두 이번 코드
    변경의 배경·근거·선행 게이트 결과를 기록하는 것으로 "의도 이상의 변경"이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 두 개 검증 대상(WaitingInteractionType·ConversationTurnSource) 모두 동일 헬퍼로
  전환 — 범위 확장이 아니라 동일 결함 클래스의 완전 차단
  - 위치: `REGISTRY_SITES` 루프(L328-335)와 `SOURCE_REGISTRY_SITES` 루프(L367-374) 양쪽
  - 상세: 두 가드 모두 동일한 정규식 패턴(`new RegExp('[\'"\`]'+value+'[\'"\`]')`)을 썼고, plan
    의 mutation 실측 표가 두 가드 모두에서 동일 결함(주석 인용에 의한 false-negative)이 실측됨을
    확인했다. 하나만 고치고 다른 하나를 남겨두면 미완결 fix 가 되므로, 두 곳 모두 변경한 것은
    의도 이상이 아니라 지시된 결함의 완전한 해소.
  - 제안: 조치 불요.

## 발견되지 않은 것 (점검했으나 이상 없음)

- 임포트: `expect`(self-test 에서 사용)·`ts`(AST 파싱에 사용) 모두 실제로 사용되며 미사용 임포트
  없음.
- 포맷팅: diff 는 실질 로직/주석 변경에 집중돼 있고 의미 없는 공백·줄바꿈 변경은 관찰되지 않음.
- 설정 변경: `package.json`/`tsconfig`/CI 설정 등 변경 없음(`typescript` 는 이미 frontend
  devDependency).
- 무관한 파일: 리뷰 대상 10개 파일 모두 이번 작업(plan·consistency 산출물 포함)과 직접 관련.
  `spec/conventions/**` 문서 자체는 변경되지 않음(project-planner 위임 없이 진행 가능하다는
  consistency 판정과 일치).

## 요약

핵심 코드 변경은 정확히 지시된 범위(주석 false-negative 를 유발하던 정규식 매칭을 TS 컴파일러
AST 파싱으로 교체)에 집중돼 있으며, 두 검증 대상 모두를 일관되게 전환한 것과 JSDoc 문구
정정은 그 전환에 직접 종속된 필수 동반 변경이다. 유일하게 "지시 이상"으로 볼 여지가 있는 것은
가드 메커니즘 자체를 검증하는 신규 self-test 인데, plan 문서가 그 필요성(회귀 방지)을 명시적으로
근거 지었고 fixture 도 좁게 스코핑돼 있어 over-engineering 으로 보기 어렵다. plan 문서·
consistency-check 산출물 동반은 프로젝트 규약상 필수 프로세스 파일이라 무관한 수정이 아니다.
설정 변경, 무관한 리팩터링, 불필요한 임포트, 무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE

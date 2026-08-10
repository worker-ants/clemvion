# 테스트(Testing) 리뷰

## 검증 수행

프롬프트 분석에 더해 실제로 재현·실행해 확인했다:

- `codebase/backend`: `uuid.spec.ts` + 3개 소비 스위트(`workspace.decorator.spec.ts`,
  `workspace-context.util.spec.ts`, `roles.guard.spec.ts`) — 전부 GREEN (67 tests, 4 suites).
- `workspace-id-fixtures.ts` 뮤테이션 재현: `OTHER_WS` 값을 `VICTIM_WS` 와 동일하게 바꾼 뒤
  `workspace.decorator.spec.ts` 실행 → **"Test suite failed to run"** +
  `워크스페이스-id-fixtures: 값이 중복됐다 — 고유 6 / 전체 7.` 메시지로 정확히 throw 됨을 확인.
  원복 후 `git status --short` clean, 13 tests 재통과 확인. plan(`auth-guard-reflection-hardening.md`)
  의 "뮤테이션으로 관측 확인: RED" 서술과 일치한다.
- `uuid.spec.ts` diff 는 docstring(주석)만 축약됐고 `expect(...)` 단언·테스트 케이스는 1바이트도
  바뀌지 않았음을 unified diff 로 확인. 회귀 위험 없음.

## 발견사항

- **[INFO]** 신설 값 유일성 가드(`ALL_WS` + `Set` 크기 비교)는 그 자체를 검증하는 자동화 테스트가 없다
  — 로드 시점 런타임 검사이며 "값이 겹치면 throw" 라는 계약 자체의 정합성은 plan 문서에 기록된
  **1회성 수동 뮤테이션**으로만 실증돼 있다(본 리뷰에서도 재현해 확인했지만, 그 재현은 사람이 손으로
  한 것이지 CI 가 매번 재확인하는 것이 아니다).
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:73-78` (게이트 기준)
  - 상세: 가드 로직 자체(예: `!==` 를 `===` 로 오타 낸다거나, 조건을 반대로 뒤집는 등)에 미래에
    누군가 손을 대 깨뜨려도, 값 자체가 우연히 서로 다른 한 아무 실패도 나지 않는다 — 로직 회귀를
    잡아줄 별도 단위 테스트가 없다. 파일이 "jest 타입 비의존"이어야 하는 제약(주석에 명시된 build tsc
    관례) 때문에 같은 파일 안에 `.spec.ts` 를 못 둔 것은 이해되지만, 별도 `.spec.ts` 파일에서
    `jest.isolateModules`(또는 동적 `require` + 값 monkey-patch)로 중복 배열을 만들어 throw 를
    단언하는 것은 이 제약과 무관하게 가능하다.
  - 제안: 우선순위는 낮다(가드 자체가 실제로 실패를 낸 이력이 없고, "값이 우연히 겹치면서 동시에
    가드 로직도 깨지는" 이중 결함 확률은 낮다). 다음에 이 파일을 만질 기회가 있을 때, 가드 로직을
    작은 순수 함수(`assertAllUnique(values: readonly string[]): void`)로 추출해 별도 `.spec.ts` 에서
    "중복 입력 시 throw", "고유 입력 시 통과" 두 케이스를 단위 테스트로 고정하는 것을 고려.

- **[INFO]** 가드가 던지는 시점의 관측성 — 3개 소비 스위트 중 어느 것이 먼저 `require` 하느냐에 따라
  Jest 가 "Test suite failed to run" 을 3개 스위트 각각(혹은 실행 순서상 일부)에 대해 동시다발적으로
  띄운다. 메시지 자체는 원인(고유 개수 vs 전체 개수)을 명확히 말하므로 실무상 디버깅 비용은 낮지만,
  "어느 상수 쌍이 겹쳤는지"까지는 메시지가 특정하지 않는다(개수만 말한다). 소비 스위트가 늘어날수록
  겹친 값이 배열 어디인지 찾는 수고가 커질 수 있다.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:74-77`
  - 상세/제안: 우선순위 낮음(현재 7개 상수 규모에서는 assign 목록 대조로 충분). 상수가 더 늘어나면
    `ALL_WS` 를 이름과 함께 순회해 중복 인덱스/이름을 메시지에 포함하는 개선을 고려할 수 있다.

- **[INFO]** `uuid.spec.ts` / `workspace-id-fixtures.ts` 의 주석 축약(SoT 를 `uuid.ts` 로 단일화)은
  테스트 자체의 동작·커버리지에 영향이 없음을 diff 와 실행으로 확인했다 — 좋은 정리다. 다만 SoT 단일화
  전략이 "주석 문서의 정합성"에만 의존하므로, `uuid.ts` 의 `isUuidShaped` docstring 이 다음에 옮겨지거나
  삭제되면 세 파일(픽스처·spec·plan)의 포인터가 조용히 죽은 링크가 된다 — 코드가 아니라 문서이므로
  자동으로 잡아주는 게이트가 없다. 이 저장소가 이미 "앵커가 소스 3곳+plan 1곳에 복제"되던 문제를
  겪었던 것과 같은 클래스이나, 이번 PR 은 정확히 그 문제를 줄이는 방향(포인터 축약)이라 방향은 맞다.
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:50-51`,
    `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:50`
  - 제안: 조치 불필요(정보성). 코드 리뷰 관점 조치 항목 아님.

## 요약

이번 changeset 은 실질적으로 테스트 동작을 바꾸지 않는다 — `uuid.spec.ts` 는 주석만 축약됐고
`expect` 단언은 그대로이며(실행 확인), plan 문서는 서술 갱신뿐이다. 유일한 실질 코드 변경인
`workspace-id-fixtures.ts` 의 값 유일성 가드는 세 소비 스위트를 조용한 무의미화로부터 지키는
로드 시점 invariant 로, 뮤테이션 재현으로 정상 동작(정확한 메시지 + 3 스위트 동시 실패)을 직접
확인했다. 유일한 갭은 그 가드 자체의 로직을 지키는 자동화된 회귀 테스트가 없고 정합성이 1회성
수동 검증에만 의존한다는 점인데, 파일의 "jest 타입 비의존" 제약과 현재 규모(상수 7개, 정적 배열)를
고려하면 위험도는 낮다. Critical/Warning 급 결함은 없다.

## 위험도

LOW

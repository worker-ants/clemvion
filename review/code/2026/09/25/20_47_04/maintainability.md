# 유지보수성(Maintainability) 리뷰

## 리뷰 범위에 대한 메모

리뷰 대상 26개 파일 중 실제 애플리케이션/테스트 코드는 2개(`codebase/backend/README.md`, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`)뿐이다. 나머지는 `plan/**` 트래커 문서와 이전 라운드의 `review/code/2026/09/25/20_20_00/**` · `review/consistency/2026/09/25/20_01_21/**` 산출물(이미 생성·소비된 리뷰 리포트)이다. 이들은 코드가 아니라 프로세스 산출물이므로 "가독성/네이밍/함수 길이/복잡도" 같은 코드 유지보수성 기준을 적용할 대상이 아니다 — 프로젝트 컨벤션(`review/` 는 gitignore 대상이 아니며 산출물을 그대로 보존)에 부합하는 형태로 보이고, 별도 발견사항으로 기재하지 않았다.

## 발견사항

- **[INFO]** 신규 `it.each` 테스트의 mock 구현이 같은 `describe` 블록 상단의 `setupOwnerLookup` 헬퍼와 거의 동일한 골격(요청자 조회 → 대상 멤버 조회 → 그 외 null)을 인라인으로 재구현한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 신규 `it.each(...)` 블록 (`setupOwnerLookup` 정의는 같은 파일 `transferOwnership` describe 상단, 신규 mock 은 그 바로 아래 추가된 `it.each` 콜백 내부)
  - 상세: `setupOwnerLookup(currentRole)` 는 이미 "요청자 role, 대상 멤버는 항상 editor" 패턴을 캡슐화하고 있다. 신규 테스트는 여기에 "락 유무에 따라 요청자 role 이 달라진다"는 축 하나만 추가하면 되는데, 헬�퍼를 확장하는 대신 findOne mock 전체를 다시 작성했다. 두 구현이 갈라져 있으면 향후 `transferOwnership` 의 조회 순서·조건이 바뀔 때 한쪽만 갱신되고 다른 쪽은 stale 해질 위험이 있다.
  - 제안: `setupOwnerLookup` 에 선택적 `lockedRole`(또는 `onRelock`) 파라미터를 추가해 재검사 시나리오도 같은 헬퍼로 표현하거나, 최소한 두 구현이 같은 필드 셋(`id: 'mem-owner'`, `workspaceId: 'ws-uuid-1'` 등)을 만들어낸다는 점을 주석으로 명시. 다만 이번 테스트가 유일한 재검사 테스트이고 의도를 설명하는 JSDoc 이 충실해 즉시 수정이 필요한 수준은 아니다(INFO).

- **[INFO]** 동일한 인라인 타입 어노테이션 `{ where?: Record<string, unknown>; lock?: unknown }` 이 같은 `it.each` 콜백 안에서 두 번(mock 구현부와 `mock.calls.map` 단언부) 반복된다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 신규 `it.each(...)` 콜백 내부, `memberRepo.findOne.mockImplementation(...)` 캐스트와 `memberRepo.findOne.mock.calls.map(...)` 캐스트
  - 상세: 파일 전반에 이미 이런 인라인 캐스트 패턴이 여러 번 등장하므로(기존 스타일과 일관됨) 새로운 문제는 아니지만, 이번 diff 에서 같은 콜백 내부에 두 번 중복되어 로컬 스코프 안에서라도 타입 별칭으로 뽑아낼 여지가 보인다.
  - 제안: `type FindOneOpts = { where?: Record<string, unknown>; lock?: unknown }` 를 파일 상단 또는 `describe('transferOwnership', ...)` 스코프에 한 번 선언해 재사용. 급하지 않은 가독성 개선.

## 요약

이번 diff 는 README 문서 정정(캐너리가 두 판별을 합산해서 본다는 사실을 반영)과, `transferOwnership` 트랜잭션 내부 재검사 분기를 고정하는 `it.each` 단위 테스트 하나를 추가하는 작은 변경이다. 새 테스트는 목적을 설명하는 JSDoc 주석이 충실하고, 파라미터화(`it.each`)로 두 재검사 조건(강등·멤버십 소멸)을 간결하게 한 테스트에 담아 중복 테스트 작성을 피했으며, 네이밍·서술형 테스트 타이틀·검증 방식 모두 파일의 기존 컨벤션과 일관된다. 유일한 개선 여지는 기존 `setupOwnerLookup` 헬퍼와의 약한 중복이며, 코드 복잡도·중첩·매직 넘버·함수 길이 측면에서 문제될 부분은 없다. README 변경 역시 기존 문서의 톤·구조(굵게 강조, 불릿 나열)를 그대로 따른다.

## 위험도

LOW

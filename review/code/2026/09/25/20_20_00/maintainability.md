# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** README 캐너리 절 설명이 하나의 초장문 문장에 두 데코레이터·두 실패 양상을 모두 욱여넣어 가독성이 낮다
  - 위치: `codebase/backend/README.md:52`
  - 상세: `@WorkspaceId()`(헤더·토큰)와 `@WorkspaceParam(...)`(경로)의 정의, "합쳐 하나도 인식 못하면" 부팅 거부 조건, `@Roles()` 없는 라우트의 조용한 스킵, 경로 라우트의 역할 오판정, cross-tenant 노출까지 — 서로 다른 다섯 개 개념이 쉼표·대시로만 이어진 한 문장(원문 기준 약 400자)에 담겨 있다. 바로 위(라인 45~48)와 아래(라인 56~58)는 같은 정보를 불릿으로 나눠 한눈에 훑을 수 있게 했는데, 이 문장만 밀도가 급격히 높아져 국지적으로 일관성이 떨어진다.
  - 제안: 데코레이터별 실패 양상을 불릿 2개로 분리한다. 예: "- `@WorkspaceId()`(헤더·토큰) 인식 실패 → `@Roles()` 없는 라우트가 멤버십 검증을 조용히 건너뜀" / "- `@WorkspaceParam(...)`(경로) 인식 실패 → 역할 요구가 경로가 아니라 헤더·토큰의 워크스페이스로 오판정" 처럼 원인→결과를 짧게 짝지으면 두 판별의 차이가 즉시 대비된다.

- **[INFO]** 부팅 로그 설명 불릿이 두 판별의 로그 포맷·부분 파손 조건을 한 불릿에 압축해 스캔하기 어렵다
  - 위치: `codebase/backend/README.md:57`
  - 상세: `@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건 인식`라는 두 로그 줄과 "합계 0건만 잡음", "한쪽만 깨진 부분 파손" 설명이 한 문장에 이어져 있다. WARNING 항목만큼 심각하지는 않지만 같은 절 안에서 "깨지는 계기"(라인 56)는 가운뎃점으로 항목을 나열해 스캔이 쉬운 것과 대비된다.
  - 제안: 급하지 않음. 다음에 이 절을 다시 만질 기회가 있으면 두 로그 줄 예시를 별도 코드 스팬이나 하위 불릿으로 나누는 것을 고려.

- **[INFO]** 신규 재검사 분기 테스트가 기존 `setupOwnerLookup` 헬퍼와 거의 동일한 요청자 조회 골격을 인라인으로 다시 작성해 소규모 중복이 생겼다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 신규 `it('인가 선행은 owner 였지만 락 재검사에서 강등이 보이면 OWNER_REQUIRED — 멤버를 바꾸지 않는다', ...)` 블록 중 `memberRepo.findOne.mockImplementation(...)` (라인 1151~1165), 비교 대상은 같은 `describe('transferOwnership', ...)` 안의 `setupOwnerLookup` 함수(라인 1068~1094)
  - 상세: 두 구현 모두 `where.userId === requesterId` 분기에서 `{ id: 'mem-owner', role: ..., userId: requesterId, workspaceId: 'ws-uuid-1' }`를 반환하는 동일한 골격을 쓴다. 차이는 `role` 이 고정 문자열(`setupOwnerLookup`)이냐 `opts.lock ? 'admin' : 'owner'`(신규 테스트)냐 뿐이다. `role` 이 함수가 아니라 값이라 완전한 재사용은 안 되지만, 골격 자체(where 매칭·객체 shape)는 그대로 반복된다. 이런 소규모 중복은 나중에 `mem-owner`/`workspaceId` 같은 필드가 바뀔 때 두 곳을 따로 고쳐야 하는 drift 위험을 만든다.
  - 제안: 필수는 아니지만, `setupOwnerLookup(roleOrResolver: string | ((opts) => string))` 형태로 확장하면 이 테스트도 헬퍼를 재사용할 수 있다. 다만 `newOwnerMemberId` 분기가 이 테스트엔 필요 없어(재검사에서 바로 던지므로 두 번째 조회가 없음) 헬퍼를 억지로 맞추면 오히려 읽기 어려워질 수 있어, 현재의 인라인 선택도 수용 가능한 트레이드오프다.

- **[INFO]** `memberRepo.findOne` 호출 인자의 타입 shape `{ where?: Record<string, unknown>; lock?: unknown }` 가 파일 전체에 걸쳐 인라인으로 반복 정의된다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 신규 테스트 내 두 곳(`mockImplementation` 인자, `requesterReads` 매핑의 `as` 캐스트), 기존 `setupOwnerLookup`(`{ where?: Record<string, unknown> }`), 기존 `locks workspace and members...` 테스트(`{ lock?: unknown }`)
  - 상세: 같은 개념(`memberRepo.findOne` 호출 인자)에 대한 타입 주석이 파일 곳곳에서 부분집합·전체집합으로 조금씩 다르게 반복 선언되어 있다. 지금은 문제없지만, 실제 호출 시그니처가 바뀌면(예: `where` 에 필드 추가) 여러 지점을 찾아 고쳐야 한다.
  - 제안: 필요할 때 `type MemberFindOneOpts = { where?: Record<string, unknown>; lock?: unknown }` 를 파일 상단에 한 번 선언해 재사용하는 정도로 충분하다. 지금 당장 리팩터링을 요구할 정도는 아니다.

- 파일 3(`plan/in-progress/canary-readme-recheck-test.md`)과 파일 4~9(`review/consistency/2026/09/25/20_01_21/*.md`)는 작업 추적·자동 검토 산출물이며 애플리케이션 코드가 아니다. 함수 길이·중첩·매직 넘버 등 통상의 유지보수성 기준이 적용되지 않아 별도 발견사항 없음.

## 요약

이번 변경은 (1) backend README 의 워크스페이스 reflection 캐너리 절을 `@WorkspaceParam` 도입 이후 실제 동작에 맞춰 정정하고, (2) `transferOwnership` 의 트랜잭션 내 재검사 분기(무락 선행에서는 owner 였지만 락을 잡은 재검사에서 강등이 드러나는 경우)를 고정하는 unit 테스트 1건을 추가한 것이다. 코드 자체의 구조적 위험(과도한 함수 길이·깊은 중첩·순환 복잡도)은 없고, 신규 테스트는 파일의 기존 스타일(Korean 문장형 설명, `mock.calls` 를 매핑해 호출 순서를 검증하는 패턴)을 그대로 따라 일관성이 좋다. 다만 README 의 핵심 정정 문장 하나가 여러 개념을 한 문장에 압축해 이 문서의 다른 불릿들과 비교했을 때 눈에 띄게 읽기 어렵고, 신규 테스트는 기존 `setupOwnerLookup` 헬퍼와 소규모 중복을 갖는다 — 둘 다 차단 사유는 아니며 후속 정리 대상 수준이다.

## 위험도
LOW

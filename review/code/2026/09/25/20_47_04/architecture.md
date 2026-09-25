# 아키텍처 리뷰 — README 캐너리 절 정정 · `transferOwnership` 재검사 분기 테스트(it.each 확장)

## 스코프 확인

이 fan-out 세션의 프롬프트에 실린 26개 파일 중 실제로 아키텍처 판단 대상이 되는 것은 2개뿐이다. 나머지는 다음과 같이 이번 changeset 의 프로세스 산출물이다(전부 `new file mode` — 신규 첨부, 프로덕션 코드 아님):

- `plan/in-progress/canary-readme-recheck-test.md` (신규 plan), `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커에 항목 2건 추가) — 작업 추적 문서
- `review/code/2026/09/25/20_20_00/**`(RESOLUTION·SUMMARY·10개 관점 리포트), `review/consistency/2026/09/25/20_01_21/**`(SUMMARY·5개 관점 리포트) — 선행 라운드의 리뷰/일관성 검토 산출물이 이번 diff 에 신규 파일로 포함됨

**프로덕션 `.ts` 구현 파일은 이번 diff 에 전혀 포함되지 않는다.** 실질 변경은:

- `codebase/backend/README.md` — 워크스페이스 reflection 캐너리 절을, `@WorkspaceId()`/`@WorkspaceParam()` 두 판별을 합산하는 기존 코드 동작에 맞춰 판별별 불릿으로 재서술 (문서만, 코드 변경 없음)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership()` 트랜잭션 내 재검사 분기(무락 선행은 owner, 락 재검사에서 `role !== 'owner'` 또는 `!requesterMembership`)를 `it.each` 로 두 갈래(admin 으로 강등 / 멤버십 소멸) 모두 고정하는 신규 테스트. `workspaces.service.ts` 의 해당 분기 자체는 이번 diff 이전부터 존재하는 코드(커버리지 갭을 메우는 것뿐).

즉 이번 변경은 **새 아키텍처 표면을 만들지 않는다** — 기존 동작에 대한 문서 정합화 + 테스트 커버리지 보강.

## 발견사항

- **[INFO]** 재검사 분기 테스트가 mock 반환값을 TypeORM `lock` 옵션 유무로 가르는 방식은 서비스의 락 전달 방식에 결합된다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `it.each` 콜백 내부, `const role = opts.lock ? lockedRole : 'owner';` (신규 블록, gate 기준 1162행 부근)
  - 상세: `memberRepo.findOne` 목이 호출 인자에 `lock` 필드가 있는지로 선행(무락)/재검사(pessimistic_write) 응답을 가른다. "몇 번째 호출인가"가 아니라 "그 호출이 락을 요구했는가"라는 의미 있는 축이라 합리적이나, 서비스가 향후 낙관적 락이나 advisory lock 으로 전환되면 이 관용구를 쓰는 테스트가 함께 갱신되어야 한다. 다만 이는 같은 파일의 `deleteWorkspace` 계열 테스트가 이미 쓰고 있는 기존 관용구를 그대로 재사용한 것이며, 이번 추가로 새 결합 지점이 생긴 것은 아니다.
  - 제안: 조치 불요. 락 전략을 바꾸는 리팩터링이 있을 때 이 관용구를 쓰는 테스트들(최소 3곳 이상)을 한 번에 갱신해야 한다는 점만 인지하면 충분.

- **[INFO]** `it.each` 파라미터화로 OR 조건의 두 분기(강등/멤버십 소멸)를 하나의 테스트 바디로 통합한 것은 적절한 패턴
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `it.each([...])('인가 선행은 owner 였지만 락 재검사에서 %s OWNER_REQUIRED...', ...)` (신규 블록)
  - 상세: 재검사 조건이 `role !== 'owner'` 또는 `!requesterMembership` 두 가지 독립 원인으로 같은 `OWNER_REQUIRED` 결과에 도달하는데, 이를 별개의 `it()` 로 복붙하지 않고 `it.each` 로 묶어 테스트 바디 중복을 피했다. 선행(무락)/재검사(락)의 호출 순서까지 `mock.calls` 로 단언해 "분기를 실제로 탔는지"를 검증하는 점도 화이트박스 테스트로서 적절하다. 레이어 경계 위반이나 안티패턴 없음.
  - 제안: 조치 불요.

- **[INFO]** README 가 서술하는 "두 판별을 합산하는 단일 캐너리" 설계는 이번 diff 의 산물이 아니라 기존 설계를 문서에 반영한 것
  - 위치: `codebase/backend/README.md` — §"2. 워크스페이스 reflection 캐너리" (gate 51~57행)
  - 상세: `RolesGuard` 가 `@WorkspaceId()`/`@WorkspaceParam(...)` 두 개의 독립된 실패 모드를 하나의 합계 카운터(부팅 거부는 합계 0 일 때만)로 묶는 설계는, 한쪽 판별만 깨진 부분 파손을 부팅 단계에서 즉시 드러내지 못하고 배포 후 로그의 두 개수 급락으로만 관측 가능하게 만든다. 이는 코드(`workspace.decorator.ts`)의 기존 설계이고 이번 diff 는 그 설계를 정확히 서술하도록 문서만 고쳤다. 두 판별을 분리된 캐너리로 나눌지는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 계열 트래커에 별도 논의 항목으로 등재되어 있어 이번 리뷰의 조치 대상이 아니다.
  - 제안: 조치 불요(트래커 항목으로 이미 추적 중).

## 레이어/결합도/패턴/순환 의존성 평가

- **레이어 책임**: `*.spec.ts` 가 서비스 레이어의 트랜잭션 내부 재검사 로직을 화이트박스로 검증하는 것은 이 파일의 기존 테스트 스타일과 일치하며, 레이어 경계를 넘는 문제는 없다.
- **디자인 패턴**: "무락 선행 판정 → 트랜잭션 내 pessimistic lock 재검사" 는 TOCTOU 방지를 위한 표준적인 double-checked locking 변형이며, 같은 모듈의 삭제 경로와 동일한 잠금 순서(워크스페이스 → 멤버십)를 공유해 데드락을 구조적으로 예방한다. 안티패턴 없음. (해당 프로덕션 로직 자체는 이번 diff 대상이 아니라 기존 코드.)
- **순환 의존성**: 해당 없음 — 문서·테스트·plan/review 산출물 변경만이며 모듈 임포트 그래프에 변화가 없다.
- **모듈 경계**: `workspaces.service.spec.ts` 는 동일 모듈(`workspaces`) 내부 테스트이며 새로운 모듈 간 경계나 의존 방향 변화는 없다.
- **확장성**: 재검사 분기의 두 원인(역할 강등/멤버십 소멸)이 모두 회귀 테스트로 고정되어, 향후 동시성 관련 리팩터링(낙관적 락 전환, advisory lock 도입 등) 시 회귀를 조기에 잡을 수 있는 안전망이 늘었다 — 확장성/유지보수성에 긍정적.
- **프로세스 산출물 커밋 (`review/**`, `plan/**`)**: 리포지토리 컨벤션(`CLAUDE.md` "정보 저장 위치")상 예정된 위치에 예정된 형식으로 기록되는 것이며, 아키텍처 관점에서 별도 우려 사항이 아니다.

## 요약

이번 changeset 은 프로덕션 코드를 전혀 건드리지 않는 문서 정정(백엔드 README 의 워크스페이스 reflection 캐너리 절을 기존 코드 동작에 맞춤)과, 기존에 존재하던 `transferOwnership` 트랜잭션 내 재검사 분기(OR 조건의 두 원인 모두)에 대한 단위 테스트 커버리지 보강으로 구성된다. 테스트는 같은 파일의 기존 관용구(락 유무로 mock 응답을 가르는 방식)를 `it.each` 로 일관되게 재사용해 중복 없이 두 분기를 모두 고정했고, 검증 대상 로직은 같은 모듈의 다른 삭제 경로와 동일한 잠금 순서 규약을 따르는 표준적인 double-checked locking 패턴이다. 새로운 모듈 경계, 결합, 순환 의존성, 레이어 책임 위반, 안티패턴은 발견되지 않았으며, README 가 짚은 "단일 캐너리가 두 독립 실패 모드를 합산" 하는 기존 설계 트레이드오프는 이미 트래커에 별도 항목으로 등재되어 있어 이번 리뷰의 추가 조치 대상이 아니다.

## 위험도

NONE

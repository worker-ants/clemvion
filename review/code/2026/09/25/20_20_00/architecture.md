# 아키텍처 리뷰 — README 캐너리 절 정정 · transferOwnership 재검사 분기 테스트

## 스코프 확인

`git diff --stat origin/main...HEAD` 로 확인한 실제 변경 범위:

- `codebase/backend/README.md` — 문서 정정 (워크스페이스 reflection 캐너리 절)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 신규 `it()` 1건 추가
- `plan/in-progress/canary-readme-recheck-test.md` — 신규 plan
- `review/consistency/2026/09/25/20_01_21/**` — 선행 `--impl-prep` consistency-check 산출물

**프로덕션 소스(`.ts` 구현 파일)는 이 diff 에 포함되지 않는다.** `workspaces.service.ts` 의
`transferOwnership()` 을 직접 열어 대조한 결과, 테스트가 고정하는 트랜잭션 내 재검사 분기
(`requesterMembership.role !== 'owner'` → `OWNER_REQUIRED`, 774번째 줄대 부근)는 이번 diff 이전부터
존재하던 코드다 — 즉 이번 변경은 새 아키텍처 표면을 만들지 않고 기존 동작에 대한 커버리지 갭을
메우는 것과 문서를 실제 코드에 맞추는 것뿐이다.

## 발견사항

- **[INFO]** 재검사 분기 테스트가 mock 구현 세부(TypeORM `lock` 옵션 유무)로 분기하는 방식은 테스트를
  구현 세부에 결합시킨다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1152` (`opts.lock ? 'admin' : 'owner'`)
  - 상세: `memberRepo.findOne` mock 이 호출 인자의 `lock` 필드 유무로 반환값을 가른다. 이는
    "몇 번째 호출인가"가 아니라 "그 호출이 락을 요구했는가"라는 의미 있는 축으로 가른 것이라
    합리적이지만, 서비스가 재검사 시 `lock` 옵션을 넘기는 방식이 바뀌면(예: 낙관적 락으로 전환)
    테스트가 무의미해질 수 있다. 다만 같은 파일의 `deleteWorkspace` 테스트(예: `잠금 순서는
    워크스페이스 → 멤버십이다`, `owner — 외부 해제 → …`)가 이미 동일한 관례(`opts.lock` 분기)를
    쓰고 있어, 이번 추가는 **기존 테스트 관용구를 일관되게 재사용**한 것이지 새로운 결합을
    도입한 것이 아니다.
  - 제안: 조치 불요. 향후 락 전략이 바뀌는 리팩터링이 있다면 이 관용구를 쓰는 테스트들(적어도 3곳)을
    한 번에 갱신해야 한다는 점만 인지하고 있으면 된다.

- **[INFO]** README 정정이 서술하는 이중 판별(`@WorkspaceId()` / `@WorkspaceParam()`) 구조와 실제
  가드 로직의 일치 여부는 이번 diff 범위 밖(코드 변경 없음)
  - 위치: `codebase/backend/README.md:52,57-58`
  - 상세: README 는 `RolesGuard` 가 두 데코레이터의 판별 결과를 **합쳐** 소비 라우트 인식에 쓰고,
    캐너리가 "합계 0건"만 잡는다고 설명한다. 이는 `src/common/decorators/workspace.decorator.ts` 의
    `handlerConsumesWorkspaceId` / `workspaceParamNamesOf` 두 함수가 "같은 조회 골격을 공유한다"는
    서술과 함께 문서화 레이어의 일관성 문제(단일 캐너리가 두 개의 독립적 실패 모드를 하나의 카운터로
    합산하는 설계)를 드러낸다. 다만 이 설계 자체는 이번 diff 이전부터 존재했고(코드 변경 없음),
    README 는 그 기존 설계를 정확히 반영하도록 정정된 것뿐이다.
  - 제안: 조치 불요(문서 정합성 개선). 다만 향후 두 판별을 분리된 캐너리로 나눌지(부분 파손을 부팅
    단계에서 바로 드러낼지) 여부는 별도 설계 논의 대상으로 plan 에 이미 트래커 항목으로 등재되어
    있음(`spec-draft-nullable-notation-followups.md` 계열) — 이번 리뷰에서 추가 조치 불요.

## 레이어/결합도/패턴 평가

- **레이어 책임**: 테스트(`*.spec.ts`)는 서비스 레이어의 트랜잭션 내부 재검사 로직을 화이트박스로
  검증한다. 이는 이 파일의 기존 테스트 스타일과 일치하며(예: `deleteWorkspace` 의 락 순서 검증),
  레이어 경계를 넘는 문제는 없다.
- **디자인 패턴**: `transferOwnership` 이 구현하는 "무락 선행 판정 → 트랜잭션 내 pessimistic lock
  재검사" 패턴은 TOCTOU 방지를 위한 표준적인 double-checked locking 변형이며, 같은 모듈의
  `deleteWorkspace`/`assertWorkspaceDeletable` 과 같은 잠금 순서(워크스페이스 → 멤버십)를 공유하도록
  주석에 명시되어 데드락을 구조적으로 예방한다. 안티패턴 없음.
- **중복/응집도**: `assertWorkspaceDeletable` 은 워크스페이스+멤버십 재검사를 헬퍼로 추출했지만
  `transferOwnership` 은 인라인으로 3단계 조회(워크스페이스·요청자·대상 멤버)를 수행한다. 이는
  이번 diff 의 변경 대상이 아니며, 로직이 대상 멤버 존재/역할 검사까지 포함해 완전히 동형은 아니므로
  강제 추출을 요구할 근거는 약하다 — 기존부터 있던 설계이고 이번 리뷰의 스코프 밖.
- **순환 의존성**: 해당 없음(테스트/문서 변경만).
- **확장성**: 재검사 분기에 대한 회귀 테스트가 생겨, 향후 동시성 관련 리팩터링(예: 낙관적 락 전환,
  advisory lock 도입) 시 회귀를 조기에 잡을 수 있는 안전망이 하나 늘었다 — 확장성/유지보수성에
  긍정적.

## 요약

이번 변경은 프로덕션 코드를 건드리지 않는 문서 정정(README 캐너리 절을 `#1399` 이후 실제 동작에
맞춤)과 기존 동시성 재검사 분기에 대한 단위 테스트 커버리지 추가로 구성된다. 테스트는 같은 파일 내
기존 관용구(락 유무로 mock 응답을 가르는 방식)를 일관되게 재사용했고, 검증 대상인 double-checked
locking 패턴은 같은 모듈의 다른 삭제 경로와 동일한 잠금 순서 규약을 따르고 있어 구조적 일관성이
있다. 새로운 모듈 경계, 결합, 순환 의존성, 레이어 책임 위반은 발견되지 않았다.

## 위험도

NONE

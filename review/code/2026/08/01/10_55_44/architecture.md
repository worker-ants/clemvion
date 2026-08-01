# 아키텍처(Architecture) 리뷰 — TypeScript 7 → 5.x 롤백 + 회귀 가드

## 발견사항

- **[INFO]** 신규 가드 모듈이 관심사가 다른 형제 가드 모듈에 비대칭적으로 결합
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:14`(import), `:6-9`(재사용 근거 주석)
  - 상세: `typescript-toolchain-guard.ts`가 실제로 필요로 하는 것은 `ROOT`와 `listAtPath` 두 심볼뿐인데, 이를 위해 완전히 다른 책임(내부 공유 패키지 등록 목록 drift 검사)을 가진 `internal-package-registration-guard.ts` 모듈 전체(`PACKAGES_DIR`·`TEST_STAGES`·`PACKAGES_CHECKS`·`collectPackages`·`discoverPackages`·`workflowDepsOf`·`staleEntries` 등)에 의존한다. 주석은 "같은 파서 두 벌을 두면 드리프트가 생긴다"는 DRY 근거를 명확히 밝히고 있어 의도 자체는 합리적이지만, 결과적으로 "TS 툴체인 계약"이라는 관심사가 "내부 패키지 등록 목록"이라는 무관한 관심사의 export 표면에 매이는 형태가 된다 — ISP 관점에서 필요보다 넓은 인터페이스에 의존한다. `internal-package-registration-guard.ts`가 나중에 리팩터링(예: `ROOT` 계산 방식 변경, export 재구성)되면 의미상 무관한 `typescript-toolchain-guard.ts`가 덩달아 깨질 수 있는 은닉 결합이다.
  - 제안: `ROOT`/`repoRoot()`/`listAtPath`처럼 두 가드가 공유하는 범용 프리미티브를 중립적인 공유 모듈(예: `repo-guards/__tests__/_shared.ts`)로 분리하고, 양쪽 가드가 그 공유 모듈을 대칭적으로 import 하도록 하면 "가드 A가 가드 B의 구현에 의존"하는 비대칭 결합이 사라진다.

- **[INFO]** monorepo 전역 가드가 특정 워크스페이스(frontend)에 물리적으로 귀속되는 패턴이 반복됨
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:101-117`(`discoverWorkspaceDirs` — backend·frontend·channel-web-chat·packages/* 전체를 스캔), `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:35-40`(배치 근거 주석)
  - 상세: 이 가드는 backend/channel-web-chat/packages/* 를 포함한 전체 모노레포 워크스페이스의 typescript 선언을 검사하지만, 물리적으로는 `codebase/frontend` 안에 있다. 배치 근거(repo 레벨에서 GitHub Actions가 꺼져 있어 실제로 도는 유일한 게이트가 `pnpm --filter frontend test`)는 타당하고, 기존 `internal-package-registration-guard.ts`(#968 대응)와 동일한 선례를 그대로 따른 것이라 이번 diff가 새로 만든 문제는 아니다. 다만 같은 자리에 이런 성격의 가드가 벌써 두 번째로 추가되면서 "frontend 워크스페이스의 테스트 스위트가 사실상 monorepo 전역 CI 허브" 라는 암묵적 역할이 굳어지고 있다 — 소유권 경계가 물리적 코드 위치와 어긋나는 형태다.
  - 제안: 당장 조치는 불필요(구조상 정상 동작). 세 번째 유사 가드가 추가되기 전에 전용 위치(예: 루트 레벨 스크립트 디렉터리)로 승격할지 검토할 시점으로 기록해 둘 만하다.

- **[INFO]** 사고의 구조적 원인(버전 선언 10중 복제)은 탐지로만 방어되고 제거되지는 않음
  - 위치: `.github/dependabot.yml:72-73`(ignore 규칙), `codebase/backend/package.json:129` 외 9개 workspace `package.json`의 `typescript` 필드(본 diff 전체 — 파일 2·3·4·7~13)
  - 상세: 이번 PR은 `typescript` 버전을 10개 `package.json`에 개별적으로 되돌리고, dependabot ignore(예방)와 lockstep 가드(탐지, `typescript-toolchain-guard.ts`의 `majorSpread`)로 재발을 이중 방어한다. 그러나 "같은 버전 선언이 10곳에 중복돼 있어 일부만 올라가는 drift가 애초에 가능한 구조" 자체는 남아 있다. 루트 `package.json`의 `packageManager: pnpm@10.23.0` 확인 결과 이 저장소는 `catalog:` 프로토콜(pnpm 9.5+)을 쓸 수 있다 — 공유 devDependency 버전을 워크스페이스 루트 한 곳에서 선언하고 각 패키지가 참조만 하게 하면 "일부 워크스페이스만 상향된 상태" 자체가 구조적으로 불가능해져, 지금의 lockstep 테스트가 사후 탐지할 필요조차 없어진다. P0 핫픽스 스코프를 벗어나는 더 큰 변경이라 이번 PR에 요구할 사항은 아니지만, 후속 개선 후보로 남길 만하다.
  - 제안: 후속 plan 항목으로 "공유 devDependency `catalog:` 마이그레이션 검토"를 등록하는 것을 고려.

## 요약

이번 변경은 Jenkins 빌드를 깨뜨린 TypeScript 7 major 상향을 10개 워크스페이스에서 일괄 롤백하고, dependabot major-ignore(예방)와 신규 회귀 가드(탐지 — 능력 검사 + lockstep)로 이중 방어선을 세운 인프라/툴체인 성격의 PR이다. 신규 가드 모듈(`typescript-toolchain-guard.ts` + `typescript-toolchain.test.ts`)은 fs 부수효과와 순수 판정 로직을 분리한 functional-core/imperative-shell 구조, fail-loud 파싱(지원하지 않는 워크스페이스 글롭·빈 발견 결과에서 조용히 통과하지 않고 throw), 그리고 "버전 숫자가 아니라 compiler API 계약을 검사"하는 능력 기반 설계(구체적 버전이 아닌 추상 계약에 의존 — DIP 정신에 부합, TS8이 API를 되살리면 재작업 없이 통과)를 갖추고 있어 아키텍처적으로 견고하다. 기존 형제 가드(`internal-package-registration-guard.ts`)와 동일한 파일 배치·"가드 로직/테스트 분리" 규약을 그대로 따라 일관성도 유지한다. 순환 의존성은 없으며(`typescript-toolchain-guard.ts` → `internal-package-registration-guard.ts` 단방향), 레이어 책임 분리 문제도 해당 없음(애플리케이션 레이어가 아닌 툴체인/CI 설정 변경). 발견된 사항은 전부 INFO 수준으로 (1) 서로 다른 관심사를 가진 두 가드 모듈 간 비대칭 재사용 결합, (2) monorepo 전역 가드가 frontend 워크스페이스에 물리적으로 귀속되는 패턴의 반복(선례 상속, 이번 diff가 새로 만든 문제 아님), (3) 공유 버전 선언이 10곳에 중복되는 구조적 원인이 탐지로만 방어되고 제거되지는 않은 점(pnpm `catalog:` 로 근본 해소 가능)이며, 어느 것도 이번 PR의 목적(빌드 복구)을 저해하지 않는다.

## 위험도
LOW

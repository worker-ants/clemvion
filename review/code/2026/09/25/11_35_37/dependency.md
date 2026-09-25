# 의존성(Dependency) 리뷰 — pnpm 핀 10.23.0 → 10.34.5

## 발견사항

- **[INFO]** 새 외부 의존성 추가 없음 — 툴체인 버전 핀만 상향
  - 위치: `package.json:6`, `codebase/frontend/Dockerfile.playwright-e2e:21`
  - 상세: 변경은 `packageManager` 필드(`pnpm@10.23.0` → `pnpm@10.34.5`)와 그 사본인 Dockerfile corepack 폴백 버전뿐이다. `pnpm-lock.yaml` 자체는 이 커밋에서 변경되지 않았다(`git show --stat b846e2aa4`, `40bdb69b7`로 확인 — `package.json` 1파일만 diff). 런타임/빌드 의존성 목록에는 아무 항목도 추가·제거되지 않았다.
  - 제안: 없음 (해당 없음).

- **[INFO]** 버전 고정(pinning) — exact pin 유지, 오히려 강화됨
  - 위치: `package.json:6`
  - 상세: `packageManager` 필드는 원래도 caret/range 없이 정확한 버전(`10.23.0`)이었고 지금도 `10.34.5`로 exact pin 이다. `.github/actions/pnpm-workspace/action.yml`(`pnpm/action-setup@v6.0.9`, 버전 인자 없음)과 `codebase/backend/Dockerfile`(`corepack enable`만, 버전 하드코딩 없음)은 모두 이 `packageManager` 필드를 따라가도록 설계돼 있어(주석으로 명시) 별도 동기화 지점이 없다. `Dockerfile.playwright-e2e`의 corepack 폴백만 예외적으로 버전을 중복 하드코딩하는데, 이번 diff 에서 두 자리(`package.json`·Dockerfile) 모두 함께 갱신됐고 plan(`plan/in-progress/lockfile-libc-pin.md` §B)에 "핀을 올릴 때 함께 올린다"는 코멘트로 그 의존관계가 명시돼 있다.
  - 제안: 없음 — 현재 설계(단일 SoT + 명시 주석)가 적절하다.

- **[INFO]** 취약점 — 알려진 CVE 스캔은 이 리뷰 범위 밖, 버전 방향은 안전측
  - 위치: `package.json:6`
  - 상세: `10.23.0` → `10.34.5`는 pnpm major 10 내의 patch/minor 전진이며 다운그레이드나 EOL 버전으로의 이동이 아니다. 이 저장소에는 `.github/workflows/deps-security-checks.yml`가 별도로 존재해 정기적으로 의존성 취약점을 스캔하는 것으로 보이므로(파일명 확인만, 본 리뷰에서 실행하지 않음) pnpm 자체의 CVE 유무는 그 채널이 담당할 사안이다.
  - 제안: 별도 조치 불필요.

- **[INFO]** 불필요한 의존성/대체 가능성 — 해당 없음
  - 상세: 새 패키지가 아니라 기존 필수 툴체인의 버전 조정이라 대체 논의 대상이 아니다.

- **[INFO]** 의존성 크기 — 빌드 시간/번들 크기 영향 없음
  - 상세: pnpm 은 devDependency 가 아니라 패키지 매니저 자체이며 애플리케이션 번들에 포함되지 않는다. plan 의 로컬 검증에 따르면 `pnpm install --frozen-lockfile`이 lockfile 을 바꾸지 않아(no-op) 실제 설치되는 패키지 집합·버전은 이전과 동일하다 — 빌드가 차단되는 네이티브 패키지 목록(6개: `@google/genai`·`@parcel/watcher`·`@scarf/scarf`·`msgpackr-extract`·`protobufjs`·`unrs-resolver`)도 10.23.0 과 같다고 plan 에 기록돼 있다.
  - 제안: 없음.

- **[INFO]** 호환성 — 두 경로(사람 vs dependabot)의 lockfile 직렬화 정합을 실측으로 확인
  - 위치: `plan/in-progress/lockfile-libc-pin.md` §A-3
  - 상세: plan 문서가 `install --lockfile-only`(사람 경로)와 `--config.minimumReleaseAge` 게이트 경로(dependabot 경로)를 10.34.5 에서 나란히 실행해 0줄 차이임을 실측했다고 기록한다. 이 리뷰에서 저장소 전체를 grep 해 다른 pnpm 버전 하드코딩 자리가 남아있지 않은지 별도로 확인했다 — `codebase/backend/Dockerfile`(corepack 전용, 하드코딩 없음), `.github/actions/pnpm-workspace/action.yml`(`pnpm/action-setup@v6.0.9`, 버전 인자 없이 `packageManager` 를 따름), `.github/workflows/deps-peer-observe.yml`·`deps-security-checks.yml`(같은 action 재사용) 모두 이번 핀 변경과 충돌하지 않는다. `codebase/frontend/Dockerfile.playwright-e2e` 만 명시적으로 갱신됐고 그것이 유일하게 필요한 자리였다.
  - 제안: 없음 — 커버리지 확인 완료.

- **[INFO]** 내부 의존성(모노레포 모듈 간) — 이번 diff 범위 밖
  - 상세: `package.json`·Dockerfile 변경은 workspace 루트 툴체인 설정이며 `codebase/*` 내부 모듈 간 의존 그래프에는 영향이 없다.

## 요약

이번 변경은 새 외부 패키지 추가가 아니라 기존 필수 툴체인(pnpm)의 `packageManager` exact-pin 버전을 `10.23.0`에서 `10.34.5`로 올리는 순수 버전 관리 변경이며, `pnpm-lock.yaml` 자체는 diff 에 포함되지 않았다(frozen install 무변경으로 실측 확인됨). plan 문서에 사람 범프 경로와 dependabot 경로의 lockfile 직렬화를 여러 버전에 걸쳐 비교한 실측 표가 실려 있어 "libc: 필드 진동" 근본 원인(버전 차이가 아니라 `minimumReleaseAge` 메타데이터 모드 차이)과 10.34.5 채택 근거(두 경로 바이트 동일)가 검증 가능한 형태로 뒷받침된다. 버전 하드코딩 지점이 `package.json`과 `Dockerfile.playwright-e2e` 단 두 곳뿐이고 둘 다 이번 diff 에서 함께 갱신됐으며, CI action(`pnpm/action-setup`)과 backend Dockerfile은 `packageManager` 필드를 따라가므로 별도 동기화가 필요 없다는 점을 저장소 전수 grep 으로 재확인했다. 의존성 관점에서 새 라이선스·새 취약점·불필요한 의존성·크기 증가 우려는 없다.

## 위험도

NONE

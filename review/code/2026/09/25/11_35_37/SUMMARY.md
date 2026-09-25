# Code Review 통합 보고서

## 전체 위험도
**NONE** — pnpm 패키지 매니저 버전 핀을 10.23.0 → 10.34.5 로 올리는 순수 툴체인 변경(+ 대응 CHANGELOG/plan 문서)이며, 3개 reviewer(security/documentation/dependency) 모두 Critical/Warning 없이 INFO 만 보고했다. forced 화이트리스트(dependency, documentation, security) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | corepack 폴백(`corepack enable || npm i -g pnpm@10.34.5`)이 무결성 검증 없이 npm 레지스트리에서 pnpm 을 설치한다. 기존부터 있던 패턴이며 이번 diff 가 새로 만든 리스크는 아니고, corepack 경로가 성공하는 한 실행되지 않는다 | `codebase/frontend/Dockerfile.playwright-e2e:21` | 이번 PR 범위 밖. 별도로 다룰 경우 무결성 검증(`--integrity=<sha>`) 또는 corepack 서명 검증 강화 고려 |
| 2 | Documentation | pnpm 버전 동기화가 사람이 읽는 주석에만 의존하고 자동 가드가 없다. `Dockerfile.playwright-e2e` 는 `package.json` 의 `packageManager` 값을 손으로 미러링해야 하는 유일한 자리라, 이번 PR 이 고친 결함(lockfile 진동)과 같은 "한쪽만 갱신하고 잊는" 계열의 drift 가 재발할 수 있다 | `codebase/frontend/Dockerfile.playwright-e2e:20`(신규 주석), 대조: `codebase/backend/Dockerfile:6` | 즉시 조치 불요(이번 PR 은 두 값을 함께 올렸음). 재발 방지용으로 `scripts/check-e2e-playwright-config.py` 류 가드에 "fallback pnpm 버전 == packageManager 버전" 단언 추가를 백로그로 고려 |
| 3 | Dependency | 새 외부 의존성 추가 없음 — `pnpm-lock.yaml` 자체는 diff 에 없고, frozen-lockfile 재설치로 무변경 실측됨. 버전 하드코딩 지점은 `package.json`·`Dockerfile.playwright-e2e` 두 곳뿐이며 이번 diff 에서 함께 갱신됨(CI action·backend Dockerfile 은 `packageManager` 필드를 따라가므로 별도 동기화 불요, 저장소 전수 grep 으로 확인) | `package.json:6`, `codebase/frontend/Dockerfile.playwright-e2e:21` | 없음 — 현재 설계(단일 SoT + 명시 주석)가 적절 |
| 4 | Dependency | 버전 상향 방향은 안전 측(major 10 내 patch/minor 전진, 다운그레이드·EOL 이동 아님). CVE 스캔은 별도 워크플로(`deps-security-checks.yml`) 담당 영역으로 이 리뷰 범위 밖 | `package.json:6` | 별도 조치 불필요 |
| 5 | Dependency | plan 문서(§A-3)가 사람 범프 경로와 dependabot 경로(`minimumReleaseAge` 게이트)의 lockfile 직렬화가 10.34.5 에서 바이트 동일함을 실측 — "libc: 필드 진동" 근본 원인(버전 차이가 아니라 메타데이터 모드 차이) 진단을 뒷받침 | `plan/in-progress/lockfile-libc-pin.md` §A-3 | 없음 — 커버리지 확인 완료 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | corepack 폴백 무결성 검증 부재(기존 패턴, 회귀 아님); 버전 상향은 안전 방향 |
| documentation | NONE | CHANGELOG/plan 서술 밀도 적절; pnpm 버전 동기화가 주석 의존·자동 가드 부재(백로그성) |
| dependency | NONE | 신규 의존성 없음, lockfile 무변경 실측, 버전 하드코딩 지점 2곳 모두 동기화 확인, 인간/dependabot 경로 직렬화 동일 실측 |

## 발견 없는 에이전트

없음 (실행된 3개 에이전트 모두 INFO 이상 발견사항을 1건 이상 보고했으나, 모두 NONE 위험도이며 Critical/Warning 은 전무).

## 권장 조치사항

1. (선택, 백로그) `scripts/check-e2e-playwright-config.py` 류 정적 가드에 "`Dockerfile.playwright-e2e` 의 corepack 폴백 pnpm 버전 == `package.json` 의 `packageManager` 버전" 단언을 추가해, 이번 PR 이 고친 것과 같은 계열의 수동 동기화 drift 재발을 구조적으로 막는 것을 고려한다. 이번 diff 를 막을 사유는 아니다.
2. (선택, 이번 범위 밖) corepack 폴백 설치 경로(`npm i -g pnpm@<ver>`)에 무결성 검증을 추가하는 것은 별도 트랙에서 검토한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, documentation, dependency (3명)
  - **제외**: 아래 표 (11명)
  - **강제 포함(router_safety)**: dependency, documentation, security — 3명 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(버전 핀 상향)과 무관 |
  | architecture | router 판단상 이번 변경과 무관 |
  | requirement | router 판단상 이번 변경과 무관 |
  | scope | router 판단상 이번 변경과 무관 |
  | side_effect | router 판단상 이번 변경과 무관 |
  | maintainability | router 판단상 이번 변경과 무관 |
  | testing | router 판단상 이번 변경과 무관 |
  | database | router 판단상 이번 변경과 무관 |
  | concurrency | router 판단상 이번 변경과 무관 |
  | api_contract | router 판단상 이번 변경과 무관 |
  | user_guide_sync | router 판단상 이번 변경과 무관 |

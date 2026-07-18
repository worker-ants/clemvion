# Code Review 통합 보고서

## 전체 위험도
**LOW** — 개발 하네스 영역의 순수 read-only drift 가드 테스트(신규 489줄) + 관련 파일 2곳의 주석 추가뿐. CRITICAL 없음, WARNING 1건(가드 자신의 파서 로직 일부 커버리지 공백). forced whitelist(6개 reviewer) 전원 전문 확보 완료 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `discoverPackages()`/`backendWorkflowDeps()` 두 함수만 다른 파서 함수들(`internalPackages`/`fnBody`/`explicitFilterCalls`/`listAtPath`/`packageDirsInPaths`/`missingFromStage`)과 달리 합성 fixture 로 고정되지 않고 인자 주입도 안 돼 있어, "package.json 부재 디렉터리 → null 필터" 분기와 "devDependencies 전용 내부 패키지 병합" 분기가 실측(현재 저장소 상태)으로도 합성 테스트로도 전혀 검증되지 않음(현재 `@workflow/*` 는 전부 `dependencies` 에만 존재하고 전 패키지가 `package.json` 보유) | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:877-899` | 두 함수의 순수 파싱 부분(디렉터리 엔트리 배열→`{dir,name}[]`, dependency map→`string[]`)을 인자 주입 가능한 헬퍼로 분리하고, "package.json 없는 디렉터리 skip", "devDependencies 전용 패키지도 병합" 두 케이스에 대한 합성 fixture 각 1개 이상 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 정규식 기반 bash/YAML 파싱(`new RegExp` 동적 구성 포함)에 이론적 ReDoS/인젝션 표면이 있으나, 입력이 전부 저장소 내 고정 파일이고 보간값도 하드코딩 상수뿐이라 공격 경로 없음 | `internal-package-registration.test.ts:410,921-924,956` | 조치 불필요 |
| 2 | Security | `.github/workflows/packages-checks.yml` 의 `actions/checkout@v7` 등 major-version 태그 고정은 diff 스코프 밖이며 Actions 자체가 repo 레벨에서 비활성(inert) | `.github/workflows/packages-checks.yml` | 조치 불필요(향후 Actions 재활성화 시 SHA pinning 별도 검토) |
| 3 | Requirement/Testing | heredoc 조기-닫힘 감지 정규식(`/(?<!<)<<-?(?!<)/`)이 bash 산술 컨텍스트의 `<<`(left-shift)를 heredoc 으로 오인해 throw 할 수 있는 알려진 사각지대. 현재 `test-stages.sh` 세 함수엔 해당 패턴이 없어 실제 오탐 없음(30/30 PASS 확인). 또한 `<<-EOF`(tab-strip) 변형을 직접 증명하는 합성 fixture 는 없음 | `internal-package-registration.test.ts:940-945`(정규식), `:1208-1211`(fixture 공백) | 조치 불필요, 추후 리팩터 시 재검토. `<<-EOF` fixture 1건 추가 권장 |
| 4 | Requirement | `packages-checks.yml` 자체는 Actions 비활성으로 미실행이지만, 그 목록 정합성(2~4번 대상)은 frontend vitest(로컬 unit)에서 검증되므로 drift 방지 목적은 여전히 유효 | `packages-checks.yml:220-221` | 조치 불필요 |
| 5 | Requirement | 관련 `spec/` 문서 부재는 이 영역이 제품 spec 이 아닌 개발 하네스/CI 도구 체인이라 정상(SPEC-DRIFT 아님) | `spec/` 전체 | 조치 불필요 |
| 6 | Scope | 신규 가드 파일이 489줄로 크지만 bash 함수 파서·YAML 부분 파서·합성 fixture 전량이 "내부 패키지 등록 목록 drift 가드"라는 단일 목적에 수렴, 손파싱 선택 근거(js-yaml 미의존)도 주석·커밋에 명시 | `internal-package-registration.test.ts` 전체 | 조치 불필요 |
| 7 | Scope/Side Effect | `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml` 변경은 양쪽 모두 헤더/설명 주석 추가뿐이며 `INTERNAL_PACKAGES` 배열·`cmd_lint/unit/build`·workflow trigger·`matrix.pkg` 등 실행 로직은 무변경 | 두 파일 diff hunk 전체 | 조치 불필요 |
| 8 | Scope | 두 번째 커밋은 직전 `/ai-review` WARNING 2건(순수 함수 분리, heredoc fail-loud)에 대한 정상 fix 반영이며 범위 이탈 아님 | 커밋 `86de33a32` | 조치 불필요 |
| 9 | Side Effect | 테스트는 `readFileSync`/`readdirSync`/`existsSync` 만 사용하는 순수 read-only 정적 분석이며 쓰기/네트워크/전역상태 변경 없음 | 파일 전체 | 조치 불필요 |
| 10 | Side Effect | `repoRoot()` 가 모듈 스코프에서 즉시 실행되어 `pnpm-workspace.yaml` 미발견 시 describe 콜백(테스트 수집 단계) 자체를 throw 로 실패시킴 — 의도된 fail-loud 설계, 파일 스코프에 격리되어 타 테스트/런타임 영향 없음 | `internal-package-registration.test.ts:377` | 조치 불필요 |
| 11 | Side Effect | 신규 테스트가 `cmd_unit` 게이트의 실효 통과 조건을 확장(이 테스트 실패 시 `run-test.sh unit` 전체가 비제로 종료) — PR 의도(#968 재발 방지)와 정확히 일치하는 의도된 게이트 강화 | `.claude/test-stages.sh` (`cmd_unit` 체인 편입) | 조치 불필요 |
| 12 | Maintainability | 순수 파서 유틸리티 10개와 테스트 단언이 한 파일에 혼재 — vitest glob 자동 발견을 활용해 손 유지 목록을 피하려는 의도적 설계지만 재사용성은 낮음 | `internal-package-registration.test.ts:362-555` | 필요 시 `internal-package-registration.helpers.ts` 로 파서 분리 고려(현행 유지도 수용 가능) |
| 13 | Maintainability | `fnBody` 의 라인 기반 휴리스틱("여는 줄 vs 첫 라인 시작 `}`")은 `cmd_*` 본문에 중첩 `{ }`/heredoc 이 들어오면 throw 로 깨짐 — 이미 fail-loud + 상세 주석으로 방어됨 | `internal-package-registration.test.ts:426-452` | `test-stages.sh` 상단 주석에 "cmd_* 본문에 중첩 `{ }`/heredoc 추가 금지" 한 줄 보강 고려 |
| 14 | Maintainability | `packages-checks.yml` 의 `on.pull_request.paths`/`on.push.paths` 는 `it.each` 로 묶였으나 `strategy.matrix.pkg` 는 케이스 형태 차이로 별도 단일 `it` — 자연스러운 분리, 결함 아님 | `internal-package-registration.test.ts:1142-1163` | 조치 불필요 |
| 15 | Testing | 파일 헤더 주석이 tsconfig exclude 패턴을 `src/**/__tests__/**` 라고 서술하나 실제 패턴은 `src/**/*.test.ts` — 결과(컴파일 제외)는 동일해 동작 영향 없는 문서 정확도 이슈 | `internal-package-registration.test.ts:47` | 주석을 실제 tsconfig 패턴에 맞게 수정 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정적 read-only 분석, 인젝션/시크릿/자격증명 노출 없음. ReDoS·Actions 태그 고정은 이론적/스코프 밖 |
| requirement | NONE | 3파일 diff 정확 확인, vitest 30/30 실행 재현, Node 로 실측 재계산해 기대값 전부 일치. spec 문서 부재는 정상(하네스 영역) |
| scope | NONE | payload=diff 전체 일치, 두 기존 파일은 주석뿐, 신규 파일·2차 커밋 모두 단일 목적에 수렴 |
| side_effect | NONE | 순수 read-only fs 접근, 전역상태/네트워크/쓰기 없음. fail-loud 설계는 의도적 |
| maintainability | LOW | 함수 분리·네이밍·근거 주석 양호. 파서+단언 혼재, `fnBody` 라인 휴리스틱 취약성은 트레이드오프로 이미 방어됨 |
| testing | LOW | 30/30 실행 확인, 핵심 파서 합성 fixture 충실. `discoverPackages`/`backendWorkflowDeps` 커버리지 비대칭 1건 WARNING |

## 발견 없는 에이전트

없음 (전 6개 forced reviewer 모두 최소 INFO 이상 발견 보고, security/requirement/scope/side_effect 는 실질 결함 없이 NONE 판정).

## 권장 조치사항
1. (WARNING) `discoverPackages()`/`backendWorkflowDeps()` 의 순수 파싱 로직을 인자 주입 가능하게 분리하고, "package.json 부재 디렉터리 skip", "devDependencies 전용 내부 패키지 병합" 두 분기에 대한 합성 fixture 를 추가해 이 가드 자신의 파서 회귀도 다른 파서 함수와 동일한 수준으로 고정한다.
2. (INFO, 선택) heredoc `<<-EOF`(tab-strip) 변형에 대한 합성 fixture 1건 추가로 회귀 방어 폭을 넓힌다.
3. (INFO, 선택) 파일 헤더 주석의 tsconfig exclude 패턴 서술(`src/**/__tests__/**` → `src/**/*.test.ts`)을 실제와 일치하도록 수정한다.
4. 그 외 항목은 모두 의도된 설계(fail-loud, 단일 파일 배치, 게이트 강화)로 확인되어 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명)
  - **제외**: 아래 표 (8명)
  - **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced whitelist 전원 = 실행된 6명과 동일, 전원 전문 확보 완료 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(정적 read-only 테스트, CI 주석)과 무관 |
  | architecture | router 판단상 아키텍처 영향 없음 |
  | documentation | router 판단상 사용자 대면 문서 변경 없음 |
  | dependency | router 판단상 신규 의존성 추가 없음 |
  | database | router 판단상 DB 접근 없음 |
  | concurrency | router 판단상 동시성 로직 없음 |
  | api_contract | router 판단상 API 계약 변경 없음 |
  | user_guide_sync | router 판단상 사용자 가이드 대상 아님 |
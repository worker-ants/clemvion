# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 2건은 모두 "현재는 미발현이나 향후 회귀를 못 잡을 수 있는" 테스트/파서 견고성 갭이며, 프로덕션 런타임·보안·spec 정합성에는 실질 영향 없음. forced(router_safety) 6개 reviewer(security/requirement/scope/side_effect/maintainability/testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 파서 견고성 (requirement) | `explicitFilterCalls` 의 명령 분절 로직이 quote-불인식이라, 인용부호 **안**에 `;`/`|` 가 포함된 `pnpm --filter` 텍스트(예: `echo "abc; pnpm --filter @workflow/ghost lint"`)를 실제 실행 커버로 오인식할 수 있다. 현재 `.claude/test-stages.sh` 실제 파일엔 이 패턴이 없어 지금 당장 실패를 유발하진 않지만, 이 가드 자신이 막으려는 "조용한 무검증 통과"(#968급)를 재현하는 사각지대다. | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:170-180` (`explicitFilterCalls`, `line.split(/&&\|\|\|\|[;\|]/)` 분절) | 분절 전 따옴표 내부 구분자를 마스킹하거나 quote-depth 추적 토크나이저로 교체. 최소한 "따옴표 안 세미콜론 포함 echo 문자열" 합성 fixture 를 회귀 테스트에 추가해 사각지대를 명시적으로 고정. |
| 2 | 테스트 커버리지 (testing) | `packages-checks.yml` 대조용 `expectedDirs()`(backend-공유 패키지 이름→dir 매핑·필터·정렬) 계산 로직이 이 파일의 다른 순수 로직(`missingFromStage`/`fnBody`/`explicitFilterCalls`/`listAtPath`)과 달리 pure 함수로 추출되지 않고 인라인이며, 합성 fixture 회귀 테스트가 없다. 오직 "현재 저장소가 우연히 정렬 상태" 라는 사실에 의존해 통과하므로, `filter` 조건 반전이나 `.map(p => p.dir)`↔`.map(p => p.name)` 혼동 같은 뮤테이션이 들어와도 잡지 못할 수 있다. | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:1373-1379` | `expectedBackendSharedDirs(packages, backendShared)` 형태로 가드 모듈에 pure 함수로 옮기고, `missingFromStage` 수준의 합성 fixture(backend-비공유 패키지 혼입, dir≠name 케이스 등)로 true-positive 고정. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (security) | 프로덕션 런타임·사용자 입력·네트워크 경계 전무. 파싱 대상은 저장소 자신의 신뢰된 파일뿐이라 경로탐색·ReDoS·커맨드 인젝션·시크릿 노출·의존성 위험이 전부 이론적 표면조차 실질적이지 않음. | 신규 파일 전체 | 조치 불요. |
| 2 | 스코프 (scope) | 가드 구현이 원 목표("4곳 drift 체크") 대비 커스텀 mini bash/YAML 파서(~640줄, heredoc/here-string 감지, 명령위치 판정 등 현재 존재하지 않는 문법까지 방어)로 확장됨. 다만 각 확장은 직전 `/ai-review` WARNING 을 정확히 인용하는 review-driven hardening 이며 자발적 스코프 확장이 아님. | `internal-package-registration-guard.ts` `fnBody()`, `explicitFilterCalls()` | 조치 불요. 향후 더 확장 필요 시 범용 bash 파서 라이브러리 이관 검토. |
| 3 | 부작용 (side_effect) | 모듈 top-level `export const ROOT = repoRoot()` 가 import 시점에 즉시 실행되어 디스크 탐색 + throw 가능(import-time side effect). 현재는 형제 테스트 파일 하나만 import 해 blast radius 작음. | `internal-package-registration-guard.ts:632` | 재사용 확산 시 주석 명시 또는 lazy getter 로 전환 검토. 현재 diff 는 조치 불요. |
| 4 | 부작용 (side_effect) | frontend vitest 스위트가 `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/backend/package.json`, `codebase/packages/*` 등 저장소 밖 파일을 읽는 교차 결합. 전부 읽기 전용(`writeFileSync`/`process.env`/네트워크 호출 0건 확인)이나, harness 구조 변경 시 관련자가 인지 못한 채 frontend 테스트가 깨질 수 있음. | `internal-package-registration.test.ts`, `internal-package-registration-guard.ts`(`discoverPackages`/`backendWorkflowDeps`) | 가드의 존재 목적 자체(#968 재발 방지)이므로 의도된 설계. 조치 불요. |
| 5 | 유지보수성 (maintainability) | 신규 `repo-guards/` 최상위 디렉터리가 기존 "자기참조형 저장소 가드" 배치 관례(`src/lib/__tests__/eslint-layering-guard.test.ts` 등 flat 배치)와 다른 위치 패턴을 만듦. | `codebase/frontend/src/lib/repo-guards/__tests__/*` (신규 디렉터리) | 의도된 선택이라면 향후 유사 가드의 표준 위치로 삼을지 짧게 문서화(파일 헤더 또는 `spec/conventions/`) 권장. 급하지 않음. |
| 6 | 유지보수성 (maintainability) | `describe` 블록 간 변수명 `internal` 재사용 — 최상위 실측 파싱 결과와 `missingFromStage` 합성 fixture 섹션의 가짜 데이터가 같은 이름이라 리뷰어가 혼동할 여지(런타임 충돌은 없음, 각각 다른 클로저). | `internal-package-registration.test.ts:933` vs `:1197` | 합성 fixture 쪽을 `fixtureInternal` 등으로 rename 권장. 우선순위 낮음. |
| 7 | 유지보수성/테스트 (maintainability, testing) | 정규식 기반 bash 함수본문 추출(`fnBody`)·YAML 서브셋 파서가 구조적으로 향후 `test-stages.sh`/`packages-checks.yml` 문법 변화(중첩 블록 등)에 취약할 수 있음. 현재는 각 알려진 사각지대를 fail-loud 로 명시적으로 차단하는 설계로 리스크를 상쇄. | `internal-package-registration-guard.ts:442-495` (`fnBody`, `explicitFilterCalls`) | 향후 `cmd_*` 함수가 더 복잡해지면 실제 bash 파서(shellcheck AST 등)로 교체 검토. |
| 8 | 테스트 (testing) | `INTERNAL_PACKAGES` stale 항목(실재하지 않는 패키지) 탐지 로직도 합성 fixture 없이 실측 데이터로만 검증됨 — `!known.has(n)`→`known.has(n)` 같은 부호 반전 뮤테이션이 들어와도 현재 저장소엔 stale 항목이 없어 계속 green. | `internal-package-registration.test.ts:1362-1369` | `staleEntries(internal, known)` pure 헬퍼로 추출 후 합성 케이스로 true-positive 고정. |
| 9 | 테스트 (testing) | 가드 핵심 로직 파일이 `__tests__/` 배치로 tsc exclude 대상이고 type-aware ESLint 도 아님 — 타입 오류 검증 공백. 다만 40개 vitest assertion 이 거의 모든 브랜치를 런타임 구동해 실제 위험도는 완화됨(과거 PR #912 의 "no-op 타입가드"와는 다른 케이스). | `internal-package-registration-guard.ts` 전체, `tsconfig.json:23-30` | 급하지 않음. 향후 유사 파일 클래스 전반에 재사용 가능한 부분 `tsc --noEmit` 보조 스텝 고려. |
| 10 | 테스트 (testing) | `repoRoot()` 의 `MAX_DEPTH` 초과 실패 경로와 `internalPackages` 의 배열-누락 외 변형(빈 배열, 항목 내 주석)이 미검증. 둘 다 방어적 코드 경로라 위험 낮음. | `internal-package-registration-guard.ts:343-356`(`repoRoot`), `:425-429`(`internalPackages`) | 낮은 우선순위. `repoRoot(startDir)` 처럼 인자화하면 저비용으로 fixture 고정 가능. |
| 11 | 문서화 (documentation) | `repoRoot()`/`internalPackages()` 함수에 JSDoc 누락 — 같은 파일의 다른 export 함수는 모두 JSDoc 을 갖춰 스타일 비일관. | `internal-package-registration-guard.ts` (해당 두 함수 상단) | 기존 인라인 주석 내용을 JSDoc 으로 끌어올리는 정도로 충분. |
| 12 | 문서화 (documentation) | 파일 헤더/커밋 메시지의 "#968 은 리뷰어 9명이 못 봤고" 서술이 재현 불가능하며(GitHub PR 리뷰 0건 확인), `/ai-review` sub-agent 9종을 가리키는 것으로 추정되나 "사람 리뷰어"로 오독될 여지. | `internal-package-registration.test.ts` 파일 헤더, 커밋 `f583856bc`/`7a4c69959` | "sub-agent 리뷰(`/ai-review`) 9종" 처럼 대상을 명확히 하면 오독 위험 감소. |
| 13 | 문서화 (documentation) | CHANGELOG/README 미갱신 — 과거 harness-only 커밋들(#966·#963·#960·#951·#939·#913 등) 전부 CHANGELOG 비갱신 관례와 일치하며, README 도 테스트 디렉터리 컨벤션을 상세 다루지 않아 정합성 문제 없음. | `CHANGELOG.md`, `codebase/frontend/README.md` | 조치 불요(정책과 일치, 확인 완료). |
| 14 | 요구사항 (requirement) | 관련 `spec/` 문서 없음 — 본 변경은 제품 spec 이 아니라 저장소 CI/테스트 하니스 컨벤션이라 spec 대상이 아님(정상). `test-stages.sh`/`packages-checks.yml` 자체 변경은 헤더 주석 추가뿐이고 실행 로직 무변경. | N/A | 조치 불요. 선택적으로 `.claude/docs/test-wrapper.md` 에 한 줄 링크 추가하면 발견성 개선(비차단). |
| 15 | 유저가이드 동기화 (user_guide_sync) | `doc-sync-matrix.json` 21개 trigger(glob 8 + semantic 13) 전수 대조 결과 매칭 0건 — 노드·UI(.tsx 아님)·통합·인증·표현식·실행/디버깅·spec·README 런타임 등 어떤 유저가이드 동반 갱신 대상 경로도 건드리지 않음. | N/A | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 위험 없음, 전부 INFO(경로탐색/ReDoS/시크릿/의존성 모두 이론적 표면조차 실질적이지 않음) |
| requirement | LOW | `explicitFilterCalls` quote-불인식 분절 WARNING 1건(현재 미발현이나 사각지대) |
| scope | LOW | 가드가 원 목표 대비 확장됐으나 review-driven hardening 으로 추적 가능, 무관 파일 혼입 없음 |
| side_effect | NONE | import-time 부작용·교차 디렉터리 결합 모두 INFO, fs 쓰기·env·네트워크 부작용 전무 |
| maintainability | LOW | 신규 디렉터리 배치 관례 차이, 변수명 재사용, 정규식 파서 구조적 한계(모두 비차단) |
| testing | LOW | `expectedDirs()`/stale entry 탐지 로직의 합성 fixture 커버리지 누락 WARNING 1건, 실행 검증(40/40 PASS) 자체는 견고 |
| documentation | LOW | JSDoc 누락 2건, "리뷰어 9명" 서술 모호성 — 문서화 전반은 평균 이상(사실관계 실측 대조 전부 정확) |
| user_guide_sync | NONE | 21개 trigger 전원 미매칭, 유저가이드 동반 갱신 대상 없음 |

## 발견 없는 에이전트

user_guide_sync (매칭 trigger 0건, 명시적으로 "해당 없음"으로 결론)

## 권장 조치사항

1. `expectedDirs()` 필터/매핑/정렬 로직을 pure 함수로 추출하고 합성 fixture 회귀 테스트를 추가한다(testing WARNING #2) — 이 파일이 스스로 표방하는 "인라인 비교는 뮤테이션을 못 잡는다"는 원칙의 유일한 예외를 닫는다.
2. `explicitFilterCalls` 의 명령 분절 로직을 quote-인식 토크나이저로 교체하거나, 최소한 "따옴표 안 세미콜론 포함 echo/로그 문자열" 합성 fixture 를 추가해 이 파서 자신이 막으려는 실패 모드의 사각지대를 문서화·고정한다(requirement WARNING #1).
3. (낮은 우선순위) `INTERNAL_PACKAGES` stale 탐지 로직도 pure 헬퍼 + 합성 fixture 로 전환, `repoRoot()`/`internalPackages()` 에 JSDoc 추가, `repo-guards/` 디렉터리 배치 컨벤션을 짧게 문서화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (6명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 6명 (아래 표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 순수 테스트/CI 하니스 가드 변경으로 런타임 성능 영향 없음(구체 사유는 prompt 미포함, diff 특성상 추정) |
  | architecture | 라우터 판단 — 아키텍처 경계 변경 없음(신규 테스트 유틸 추가뿐) |
  | dependency | 라우터 판단 — package.json/lockfile 의존성 변경 없음(주석 추가만) |
  | database | 라우터 판단 — DB 스키마/쿼리 관련 변경 없음 |
  | concurrency | 라우터 판단 — 비동기/동시성 로직 변경 없음 |
  | api_contract | 라우터 판단 — API 계약(엔드포인트/DTO) 변경 없음 |
# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. `eslint-plugin-unicorn` peer 불일치(dependabot #1049 오적용)를 원래 pin `^56.0.1` 로 되돌리고, 직전 리뷰 라운드(12_27_15) 의 Warning 3건(PROJECT.md 카운트 drift·회귀 가드 부재·registry 표 3중 중복)이 이번 커밋에서 실제로 해소됐음을 8개 reviewer 가 모두 독립 재현/재검증했다. 유일한 LOW 판정은 testing reviewer 로, 신규 회귀 가드 자체에 대한 경미한 커버리지 개선 여지(경계값·malformed 입력 미커버)만 지적했으며 차단 사유는 아니다. **강제(router_safety) reviewer 8명 전원 결과 확보됨 — 누락 없음.**

## Critical 발견사항

없음

## 경고 (WARNING)

없음

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency/Security | `eslint-plugin-unicorn` 을 dependabot 이 잘못 올린 `^72.0.0`(eslint peer `>=10.4`, 설치본 9.39.4 와 unmet)에서 원래 pin `^56.0.1`(peer `>=8.56.0`)로 되돌리는 순수 devDependency revert. 런타임 공격 표면·번들에 미포함, 라이선스(MIT) 호환 | `codebase/backend/package.json:119` | 조치 불요 |
| 2 | Dependency/Security | 다운그레이드로 재유입되는 ~15개 구식 transitive devDependency(`hosted-git-info@2.8.9` 등)는 `eslint-plugin-unicorn@56.0.1` 서브트리에만 격리, 알려진 활성 CVE 없음(`hosted-git-info` 는 ReDoS 패치 버전) | `pnpm-lock.yaml` snapshots 섹션 | 조치 불요, 필요시 `pnpm audit` 참고 |
| 3 | Dependency | `eslint-plugin-unicorn` 은 caret range(`^56.0.1`)로 복원 — exact pin 아니라 56.x 대역 minor/patch 자동 갱신은 여전히 허용. 이미 문서에 명시적으로 정정됨 | `codebase/backend/package.json:119`, `eslint.config.mjs` 주석 | 조치 불요 |
| 4 | Dependency/Requirement | registry 실측 floor 표(56.x=`>=8.56.0`/57=`>=9.20.0`/60~61=`>=9.29.0`/62~65=`>=9.38.0`/66+=`>=10.4`)를 `npm view` 로 독립 재조회 — 문서 서술과 전부 일치. 신규 회귀 가드도 표준 라이브러리·기존 devDependency 만 사용해 신규 외부 의존성 없음 | `codebase/backend/eslint.config.mjs:16-34` | 조치 불요 |
| 5 | Documentation/Maintainability | 직전 라운드 Warning #1(PROJECT.md `typescript` 1건→구식 카운트)이 `typescript`·`eslint-plugin-unicorn` 2건으로 갱신되고 `.github/dependabot.yml` ignore 항목 수와의 2-place 결속 문구까지 추가돼 실측(2건)과 일치 | `PROJECT.md:49-51`, `.github/dependabot.yml` | 조치 불요 |
| 6 | Testing/Requirement | 직전 라운드 Warning(자동 회귀 가드 부재)이 신규 `eslint-unicorn-peer.spec.ts`(+`-guard.ts`+`-fixture.ts`) 로 해소됨. 이번 세션에서 `npx jest eslint-unicorn-peer.spec.ts` 직접 실행 → **28/28 PASS** 재현, `unicorn/catch-error-name` 룰을 `off` 로 끄는 뮤테이션으로 RED 전환까지 독립 확인(non-vacuous) | `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`, `eslint-unicorn-peer-guard.ts` | 조치 불요 |
| 7 | Maintainability | 직전 라운드 Warning(registry 표 3곳 중복)이 `eslint.config.mjs` 를 단일 SoT 로 삼고 `dependabot.yml`/`PROJECT.md`/plan 문서는 참조만 하도록 정리돼 해소됨 | `codebase/backend/eslint.config.mjs:22-24` 외 | 조치 불요 |
| 8 | Side Effect | 신규 jest spec 이 로컬 `eslint` CLI 를 서브프로세스로 스폰(디스크 쓰기·네트워크 없음, `--stdin` 모드). Jest VM 이 flat config 의 동적 `import()` 를 못 하는 실측 제약 회피를 위한 의도된 설계 | `eslint-unicorn-peer.spec.ts:73-97` (`lintFixtureText`) | 조치 불요 |
| 9 | Scope | diff 에 결함 수정 외에 plan 문서 신설·직전 라운드 Warning 3건 조치·리뷰 세션 아티팩트 14개 커밋이 섞여 있으나, 이는 프로젝트가 강제하는 "결함 수정→plan 기록→강제 review→Warning 조치" 표준 1-사이클 산출물로 스코프 이탈 아님 | `plan/in-progress/eslint-unicorn-peer-restore.md`, `review/code/2026/08/01/12_27_15/RESOLUTION.md` | 조치 불요 |
| 10 | Scope | `pnpm-lock.yaml` 에 unicorn 과 무관한 `eslint-config-next` peer 키 표기 단순화가 소량 섞여 있음 — 손 편집 아닌 `pnpm install` 재계산의 부수 효과로 판단 | `pnpm-lock.yaml` 게이트 15996-16082 | 조치 불요(기계적 재생성) |
| 11 | Maintainability | 신규 `eslint-unicorn-peer-guard.ts` 의 `parseGteFloor`/`parseCaretFloor`/`parseVersion` 3개 함수가 거의 동일 구조 반복(경미한 DRY 여지), 함수당 3~4줄로 실질 부담 낮음 | `eslint-unicorn-peer-guard.ts:14-29` | 4번째 포맷 추가 시 공통 헬퍼 고려(선택) |
| 12 | Maintainability | `eslint.config.mjs` 신규 주석 블록의 문단 구분(빈 `//` 줄)이 파일 내 다른 주석 블록과 스타일 불일치 — 직전 라운드에서 이미 인지, 낮은 우선순위로 의도적 보류 | `codebase/backend/eslint.config.mjs:16-34` | 다음 편집 기회에 스타일 통일 고려(선택) |
| 13 | Testing | `satisfiesFloor` 의 경계값(설치 버전 == floor일 때 `true`)이 직접 단위 테스트로 단언되지 않음(1-line 위임이라 실위험 낮음) | `eslint-unicorn-peer-guard.ts:39-45`, `eslint-unicorn-peer.spec.ts:264-271` | `expect(satisfiesFloor([9,18,0],[9,18,0])).toBe(true)` 추가 고려(선택) |
| 14 | Testing | 파서 3종의 `it.each` 거부 케이스에 registry 가 실제로 낼 수 없는 malformed 입력(leading zero, 음수 등) 미포함 — 입력원이 신뢰 가능한 registry 메타데이터로 한정돼 실위험 낮음 | `eslint-unicorn-peer.spec.ts:217-262` | 조치 불요(선택 시 1~2 케이스 추가) |
| 15 | Testing | 실발화 3케이스가 매번 실제 `eslint` CLI 서브프로세스를 기동(콜드 스타트 포함, 파일 전체 12.3s) — backend jest 스위트가 이미 400+ suites 규모라 서브프로세스형 가드 증가 시 누적 시간 영향 가능. 정확성 우선의 의도된 트레이드오프 | `eslint-unicorn-peer.spec.ts:73-97, 105-152` | 조치 불요, 향후 늘어나면 별도 jest project 분리 고려 |
| 16 | Testing | (범위 밖, 이미 추적) 신규 가드가 상시 게이트로 작동하려면 실제 test 실행 경로 필요 — `pnpm install` 자체는 unmet peer 를 경고로만 처리. plan 문서 "후속 검토" 절에 이미 기록된 defer 항목(기존 `nunjucks→chokidar` 선결 필요) | `plan/in-progress/eslint-unicorn-peer-restore.md` | 조치 불요(이미 추적됨) |
| 17 | Documentation | plan 문서가 인용한 `eslint.config.mjs` 구주석("v56 고정" 등)이 이번 PR 자체의 주석 재작성으로 stale — 의도된 역사적 서술(과거형 설명)이라 오도 의도 없음 | `plan/in-progress/eslint-unicorn-peer-restore.md` | 시점 명시 문구 한 줄 추가 고려(선택) |
| 18 | Dependency | 영향 범위가 `codebase/backend` 워크스페이스 단일로 국한, 워크스페이스 간 eslint 선언 floor 차이(`^9.18` vs `^9`)를 고려해 65.0.1 대신 56.0.1 을 선택한 근거가 plan 문서에 명시됨 | `pnpm-lock.yaml` importers 섹션 | 조치 불요 |
| 19 | Security | dependabot ignore 확장이 일반 major-bump PR 생성만 억제(별도 "Dependabot security updates" 토글엔 원칙상 무영향이나, 보안 패치가 major 에서만 제공되는 경우 억제될 수 있음) — 이미 문서화된 트레이드오프 | `.github/dependabot.yml:75-93` | 조치 불요, CVE 공지 시 수동 해제 인지 필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | devDependency-only revert, 하드코딩 시크릿/인젝션 벡터 없음, transitive 재유입 패키지에 알려진 CVE 없음 |
| requirement | NONE | 요구사항 불일치 없음. registry 실측·git 이력 독립 재검증, 신규 회귀 가드 28/28 실행 + mutation RED 재확인 |
| scope | NONE | 표준 "fix→plan→review→resolve" 1-사이클 산출물로 스코프 이탈 아님. lockfile 부수 표기 단순화만 정보성 관찰 |
| side_effect | NONE | 순수 함수/문서 편집 위주, 유일한 실행-시점 부작용(서브프로세스 eslint 스폰)은 디스크/네트워크 무영향의 의도된 설계 |
| maintainability | NONE | 직전 라운드 Warning(registry 표 3중 중복) 해소 확인. 경미한 DRY/스타일 여지만 잔존(INFO) |
| testing | LOW | 회귀 가드 신설·실행 검증 완료(28/28, mutation-tested). 경계값·malformed 입력 커버리지 등 경미한 개선 여지 |
| documentation | NONE | 직전 라운드 Warning 3건(PROJECT.md drift/회귀가드 부재/registry 표 중복) 전부 해소 확인. plan 문서 stale 인용 1건은 의도된 역사적 서술 |
| dependency | NONE | 신규 외부 의존성 없음, registry 실측 전부 일치, transitive 재유입은 backend 서브트리 격리 확인 |

## 발견 없는 에이전트

없음 — 8개 reviewer 모두 최소 1건 이상의 INFO 를 보고했으나, Critical/Warning 급 발견은 8개 reviewer 전원 0건.

## 권장 조치사항

1. (선택, 낮은 우선순위) `satisfiesFloor` 경계값(`==` floor)에 대한 직접 단위 테스트 1줄 추가 고려 — `eslint-unicorn-peer-guard.ts:39-45`.
2. (선택, 낮은 우선순위) `eslint.config.mjs` 신규 주석 블록의 문단 구분 스타일을 파일 내 기존 스타일에 맞추는 것 고려 — 직전 라운드부터 의도적으로 보류된 항목.
3. (선택, 낮은 우선순위) `eslint-unicorn-peer-guard.ts` 의 3개 파서 함수 간 경미한 구조 중복은 4번째 포맷 추가 시점에 공통 헬퍼 추출 고려.
4. 차단 사유 없음 — 현재 diff 는 push/merge 관점에서 추가 조치 없이 진행 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (8명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명 전원 — forced 전원 결과 확보됨, 누락 없음)
  - **제외**: 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(devDependency 버전 revert + CI 설정 + 테스트 추가) 와 관련성 낮음 |
  | architecture | 아키텍처 구조 변경 없음(설정/버전 revert) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자向 기능/문서 변경 없음 |
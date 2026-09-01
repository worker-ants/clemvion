# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. 실질 코드 표면은 8개 파일(harness `plan_guard.py` 정규식 확장 + 회귀 테스트, 신규 `stray-tool-tags.test.ts` 가드, `spec-links.test.ts` fixture 보강, `error-codes.ts` JSDoc, `error-codes.md`/`plan-lifecycle.md` 문서)로 좁고, 이미 3라운드의 코드 리뷰 + 6라운드의 consistency 검토를 거친 4번째 라운드다. 신규로 남는 실질 조치 대상은 WARNING 2건(타입 불일치·plan 줄번호 stale)뿐이고, 나머지 WARNING 1건은 이미 사유·재개 신호와 함께 유예 등재된 상태다. forced reviewer 7명 전원(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Maintainability / 타입안전성 | `stray-tool-tags.test.ts`의 `collectScanTargets`가 `readonly string[]`(`SCAN_ROOTS`, `as const`)을 `walkTree`의 `string[]` 매개변수로 그대로 전달 — 실제로는 `TS2345` 컴파일 오류가 나는 코드지만, 저장소 `tsconfig.json`이 `__tests__/**`/`*.test.ts`를 exclude해 `tsc --noEmit`/`next build` 어디에서도 잡히지 않는다(격리 재현으로 실측: 동일 시그니처를 별도 파일에서 `tsc --noEmit --strict` 실행 시 재현됨). | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:97-98`(정의), `:52`(`SCAN_ROOTS as const`) | `walkTree`의 `bases` 매개변수를 `readonly string[]`로 넓히거나(다른 호출부 전부와 호환), 호출부에서 `[...SCAN_ROOTS]` 얕은 복사로 전달 |
| W2 | Documentation / 정확성 | 아직 열려 있는(`status: in-progress`) plan 문서의 후속작업 줄번호 인용이 이 PR 자신의 편집(같은 파일 최상단 JSDoc 6줄 추가)으로 stale해짐 — 문서는 `:114-115`(현재 `VALIDATION_ERROR`/`INVALID_FIELD` 상수 정의부)을 가리키지만, 실제 "엔진 레이어" JSDoc은 `:121-131`로 밀려 있다. 다음 developer 턴이 엉뚱한 줄을 찾아갈 위험. | `plan/in-progress/spec-conventions-engine-error-code-surface.md:58` → 실제 대상 `codebase/backend/src/nodes/core/error-codes.ts:121-131` | 줄번호 인용을 `:121-131`로 갱신, 향후 유사 인용은 줄번호 대신 앵커 문자열(고유 구절) 병기 권장 |
| W3 | Requirement / SoT 미등재 (유예됨) | 신규 build-blocking 가드 `stray-tool-tags.test.ts`가 자신이 속한 family의 규약 SoT(`spec/conventions/spec-impl-evidence.md §4.2` "build 차단 4건" 표 + frontmatter `code:` 리스트)에 미등재 — 실제로는 5번째 build-blocking 가드. | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(전체) / `spec/conventions/spec-impl-evidence.md:4-18,126-134` | 이미 `plan/in-progress/harness-review-gate-followups.md:174-181`에 사유(spec 축 과다 번들 상충)·재개 신호와 함께 유예 등재됨 — 이번 라운드 즉시 조치 불요, 다음 harness 가드 추가 시 §4.2 표를 함께 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Performance | 신규 가드 테스트가 동일 디렉터리 트리(`plan/`, `spec/`)를 테스트 케이스별로 3회 재순회 | `stray-tool-tags.test.ts` 135행/151행 부근 | 조치 불요(1회성 테스트 비용) — 필요시 `describe` 상단에서 1회 수집해 재사용 |
| I2 | Performance | `findStrayTags`가 파일 전체를 `readFileSync` + `split("\n")`으로 배열 적재(스트리밍 아님) | `stray-tool-tags.test.ts:106` 부근 | 조치 불요 — 문서 파일 규모에서 무해 |
| I3 | Scope | 단일 PR이 developer 축(harness 위생)과 project-planner 축(`error-codes.md` 두 surface 병기 spec 결정)을 함께 담음 — 3라운드 연속 재확인, 새 이탈 아님. `--spec` 게이트 6라운드를 통과시킨 절차적 산물이지 우회가 아님 | 전체 구성(harness 파일 1~6/15, spec 축 파일 50~112, 결정 문서 `plan/in-progress/spec-conventions-engine-error-code-surface.md`) | 새 조치 불요 — 이 브랜치에 아직 열린 PR 없음(`gh pr view` 확인), PR 생성 시 본문에 harness축/spec축 분리 서술 포함 여부 최종 확인 |
| I4 | Testing | `stray-tool-tags.test.ts`의 `archive/` 제외가 경로가 아니라 basename 단독 매칭이라, fixture(`plan/complete/archive/from-x/`)가 검증하는 범위보다 실제 스코프가 넓음(이름만 같으면 어디든 제외). 현재 저장소엔 오탐 없음 | `stray-tool-tags.test.ts:101`(`skipDir`), fixture `:173-189` | 다른 위치의 `archive/` fixture 추가로 실제 폭을 명시적으로 고정하거나, 주석에 "경로가 아니라 이름만 본다" 한 줄 추가. 차단 사유 아님 |
| I5 | Maintainability / SoT drift (기등재) | `.claude/tools/plan-stale-audit.sh:123-125`의 독립 체크박스 정규식 사본이 `plan_guard.py`의 이번 비대칭 확장을 받지 않아 두 "완료판정"이 어긋남 — informational 출력에만 영향, 하드 게이트(`push_blocks`)는 무관 | `.claude/tools/plan-stale-audit.sh:123-125` | 이미 `plan/in-progress/harness-review-gate-followups.md`에 "세 번째 재발"로 등재됨 — 신규 조치 불요, 다음 정리 시 동기화 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 프로덕션 인증/DB/API 경로 변경 0건, 시크릿 스캔 0건 |
| performance | NONE | INFO 2건(재순회 비용, 비스트리밍 읽기) — 조치 불요, 프로덕션 런타임 무영향 |
| requirement | LOW | WARNING 1건(W3, SoT 미등재 — 이미 유예 등재됨). pytest 39건/vitest 37건 실행 검증 GREEN |
| scope | LOW | INFO 1건(I3, axis 번들 — 3라운드째 재확인, 새 이탈 없음) |
| side_effect | NONE | 발견 없음 — `push_blocks` 하드 블록 무영향 직접 추적 확인, 신규 테스트 파일 쓰기는 tmpdir 격리+정리 |
| maintainability | LOW | WARNING 1건(W1, readonly→string[] 타입 불일치, tsconfig exclude로 미검출) |
| testing | LOW | INFO 1건(I4, archive/ 제외 범위가 fixture보다 넓음). 독립 뮤테이션 재검증(예측대로 1건 RED) |
| documentation | LOW | WARNING 1건(W2, plan 문서 줄번호 인용 stale) |

## 발견 없는 에이전트

security, side_effect (CRITICAL/WARNING/INFO 어느 등급도 없음)

## 권장 조치사항

1. **[W1]** `stray-tool-tags.test.ts`의 `collectScanTargets` 타입 불일치 해소 — `walkTree`의 `bases` 매개변수를 `readonly string[]`로 넓히거나 호출부에서 얕은 복사(`[...SCAN_ROOTS]`)로 전달.
2. **[W2]** `plan/in-progress/spec-conventions-engine-error-code-surface.md:58`의 줄번호 인용을 `error-codes.ts:121-131`로 갱신하고, 앵커 문자열을 함께 병기해 재드리프트 방지.
3. **[W3]** 즉시 조치 불요(이미 유예 등재됨) — 다음 harness 가드 추가 시 `spec/conventions/spec-impl-evidence.md §4.2` 표·frontmatter를 이번 항목과 함께 반영.
4. **[I3]** PR 생성 시점에 본문에 harness축/spec축 분리 서술이 실제로 들어갔는지 최종 확인(현재 열린 PR 없음).
5. **[I4]** 여력이 되면 `archive/` 제외 범위(basename 단독 매칭)를 명시하는 fixture 또는 주석 한 줄 추가 — 차단 사유는 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단 — 이번 changeset에 아키텍처 표면(모듈 경계·의존성 구조) 변경 없음 |
  | dependency | router 판단 — `package.json`/lockfile 변경 없음 |
  | database | router 판단 — DB 스키마·쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성/락/트랜잭션 코드 변경 없음 |
  | api_contract | router 판단 — API 엔드포인트/DTO 계약 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 대상 변경 없음 |

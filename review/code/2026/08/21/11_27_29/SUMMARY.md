# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 유일한 WARNING 급 핵심 발견은 architecture 리뷰가 지적한 "신규 미러 소멸 캐너리가 frontend-checks 전용 pathspec 에 갇혀 backend-only PR 에서는 트리거되지 않는다"는 구조적 갭이며, 이 PR 자체의 목적(크로스스택 drift 재발 방지)을 부분적으로 무력화할 수 있어 병합 전 확인이 필요하다. 그 외에는 testing 리뷰의 SoT 패키지 자체 리터럴 pin 부재(WARNING), requirement 리뷰의 spec R17 SPEC-DRIFT(이미 인지·이월됨) 정도이고 나머지는 전부 INFO/NONE 수준이다. 강제 화이트리스트(router_safety forced: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 8명 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 신규 "미러 소멸 캐너리" 가드(`findMirrorRedeclarations`)가 `frontend-checks.yml` pathspec(`codebase/frontend/**`/`codebase/packages/**`)에서만 트리거되는 vitest 스위트 안에 배치되어, backend-only PR 이 마커 심볼을 재선언해도 CI 상 이 가드가 아예 실행되지 않는다. 이는 이 PR 이 없애려는 것과 동일한 형태의 CI 경로 게이팅 사각지대를 재도입한다 — `backend-checks.yml`(codebase/backend/**, codebase/packages/** 만 relevant)은 이 vitest 파일을 커버하지 않고, `packages-checks.yml`도 이 가드를 실행하지 않는다. 유일한 백스톱은 push 전 로컬 테스트 실행 관행뿐이며 이를 강제하는 pre-push 훅은 없음(확인됨) | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:32-36`(SCAN_DIRS), `masked-marker-mirror.test.ts:30-33`; CI: `.github/workflows/frontend-checks.yml:43-44`, `backend-checks.yml:61-62` | 캐너리를 pathspec 게이팅 밖으로 이동 — (a) `packages-checks.yml`의 항상-실행 스텝으로 옮기거나, (b) `deps-security-checks.yml` 선례처럼 `paths:` 필터 없는 별도 job으로 분리해 모든 PR에서 무조건 실행. 최소안으로는 이 vitest 파일(또는 디렉터리)을 `frontend-checks.yml`/`backend-checks.yml` 양쪽 pathspec에 명시 추가하고 이유를 주석으로 남긴다 |
| 2 | testing | 신규 SoT 패키지(`@workflow/masked-markers`) 자신의 스펙(`index.spec.ts`)이 마커 상수끼리의 내부 정합성만 검사할 뿐 리터럴 값(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`) 자체를 직접 pin 하지 않는다 — 리터럴이 실수로 바뀌어도 이 자기참조적 비교는 GREEN 을 유지한다. 현재는 backend/frontend 소비처(재export shim)의 우연한 리터럴 하드코딩 테스트에만 방어가 의존한다 | `codebase/packages/masked-markers/src/__tests__/index.spec.ts` | `index.spec.ts`에 `expect(VALUE_MASK_MARKER).toBe('***')` 등 리터럴 pin 3줄 추가(README 표 그대로 옮기면 됨) |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/14-external-interaction-api.md` R17의 "backend SoT / 프런트 미러" 서술이 이관 후 사실과 어긋난다 — 실제 SoT는 `@workflow/masked-markers`로 이동했고 backend/frontend는 재export shim이 됐으나 spec 본문과 frontmatter `code:` 목록은 아직 갱신되지 않음. 이는 코드 결함이 아니라 developer 권한(`spec/` read-only) 밖이라 `plan/in-progress/masked-marker-shared-package.md` 체크리스트에 "spec R17 정정 (planner 턴 필요)"로 이미 명시적으로 이월된 항목 | `spec/5-system/14-external-interaction-api.md:1624`(R17 서술), frontmatter `code:` 목록(6-20행) | 코드는 유지. 다음 `project-planner` 턴에서 R17 문장을 "SoT는 `@workflow/masked-markers`"로 갱신하고 frontmatter `code:` 목록에 패키지 경로 추가(plan 문서에 텍스트 앵커까지 명시돼 있어 그대로 집행 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 프런트 `MASKED_MARKERS`가 이번 변경으로 런타임 불변성을 실제 획득(개선) — 기존 `Set`은 타입 레벨 readonly만 있고 `Object.freeze` 없어 런타임 변형 가능했으나, 신규 패키지는 `Object.freeze([...])` 배열 사용 + 캐너리 테스트로 `Object.freeze(new Set())`의 플라시보성을 규명 | `codebase/packages/masked-markers/src/index.ts:43-47`, `codebase/frontend/src/lib/utils/masked-markers.ts:22-26` | 조치 불요 |
| 2 | security | 마커 SoT 이관으로 "깊이 상한 크로스스택 drift"라는 fail-open 실패 모드가 구조적으로 닫힘 — 값(10)·비교 연산자(`>=`) 이관 전후 동일 확인 | `codebase/packages/masked-markers/src/index.ts:81` | 조치 불요 |
| 3 | security | `isMaskedMarker` 정확-일치 판정 의미 이관 전후 동일 유지(부분 포함 미탐은 의도된 트레이드오프) | `codebase/packages/masked-markers/src/index.ts:55-57` | 조치 불요 |
| 4 | security | 신규 devDependency는 전부 devDependency이며 CVE 자동 스캔 미수행(오프라인 리뷰 한계) | `codebase/packages/masked-markers/package.json:13-22` | 정기 `pnpm audit`/Dependabot에 맡김 |
| 5 | architecture | 공유 패키지가 "마커 리터럴 집합"과 "재귀 깊이 상한" 두 불변식을 한 이름 아래 묶어, 향후 `MAX_MASK_DEPTH`를 별도 상수로 오인해 재복제할 여지가 약간 있음(미러 가드가 이미 이 상수도 감시해 리스크 낮음) | `codebase/packages/masked-markers/src/index.ts` | 조치 불요, 참고용 |
| 6 | requirement | `findMirrorRedeclarations`의 SoT 자기 제외 분기(`SOT_DIR` 체크)가 현재 `SCAN_DIRS` 범위에서 도달 불가능한 dead code(기능 결함 아님, 오탐/미탐 없음) | `masked-marker-mirror-guard.ts` (`findMirrorRedeclarations` 내 `if (relPath.startsWith(...)) continue;`) | 주석을 "방어적 no-op"으로 명확화하거나 분기 제거 — 급하지 않음 |
| 7 | scope | `pnpm-lock.yaml`에 PR 목표와 무관한 `eslint-config-next` peer-dependency 해석 트리 재정렬 동반(버전 불변, `pnpm install` 부산물로 판단) | `pnpm-lock.yaml:396`, `:16256-16324` | PR 설명에 "무관한 pnpm 재해석" 한 줄 남기면 좋음. 블로킹 아님 |
| 8 | scope | 리뷰 산출물 `rationale_continuity.md`(별도 세션)에 sub-agent 중간 추론 텍스트 잔존 — target 코드와 무관 | `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1-3` | 스코프 판단에 영향 없음. 다음 실행 시 정리되면 충분 |
| 9 | side_effect | `MASKED_MARKERS` 타입이 `ReadonlySet<string>`→`readonly string[]`로 변경(전수 grep 확인 결과 현재 소비처는 전부 스프레드 사용이라 파손 없음) | `codebase/frontend/src/lib/utils/masked-markers.ts:56` | 조치 불요. (선택) JSDoc에 "이제 배열" 한 줄 추가 고려 |
| 10 | side_effect | 신규 캐너리 테스트가 `os.tmpdir()`에 임시 디렉터리 생성 — `finally`로 정상 정리됨, 저장소 트리 밖이라 부작용 없음(정상 패턴 확인 기록) | `masked-marker-mirror.test.ts` | 없음 |
| 11 | maintainability | `SOT_DIR` 정규화 계산이 파일 순회 루프 안에서 매 반복 재계산됨(비용 미미, 가독성 미세 흠) | `masked-marker-mirror-guard.ts:122` | 루프 진입 전 `const sotPrefix = ...`로 1회만 계산 |
| 12 | maintainability | `prepare` 스크립트가 8개 패키지에 걸쳐 동일 인라인 JS로 복제(이번 PR로 9번째 사본 추가) — 기존 저장소 관행을 그대로 따른 것이라 이 PR이 새로 만든 결함 아님 | `codebase/packages/masked-markers/package.json` (`scripts.prepare`) | 이번 PR 범위 아님. 9번째 이상 패키지 추가 전 공유 스크립트 추출 검토 가치 있음 |
| 13 | testing | `findRedeclaredSymbols`의 "정확 식별자 일치" 경계(부분 문자열 오탐 방지)가 테스트로 고정돼 있지 않음(구현은 정확함을 실측 확인, 회귀 방어만 부재) | `masked-marker-mirror-guard.ts` (`findRedeclaredSymbols`), 소비 스펙 `masked-marker-mirror.test.ts` | `it.each`에 "부분 문자열 포함 식별자"(`MAX_MASK_DEPTH_OLD` 등) 케이스 1줄 추가 |
| 14 | testing | backend `deepRedactSecrets` 깊이 상한 테스트가 "안 던진다"만 확인, 정확한 경계(depth 10 vs 11)는 미검사(이번 PR 이전부터 있던 갭이나 상한 값이 이제 크로스패키지 배선을 거쳐 중요도 소폭 상승) | `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (`caps recursion depth` 테스트) | 프런트 `masked-markers.test.ts`의 depth 10/11 경계 테스트 패턴을 backend에도 대칭 추가(범위 밖으로 미뤄도 무방) |
| 15 | documentation | spec 본문 SoT 서술·frontmatter `code:` 목록이 이관 미반영(의도적 이월, WARNING #3과 동일 사안) | `spec/5-system/14-external-interaction-api.md:1624`, frontmatter | 조치 불요(이미 추적됨) — WARNING #3 참조 |
| 16 | documentation | 재export 지점(backend)마다 개별 JSDoc이 패키지 원본과 별도 유지되어 "값의 미러는 없앴지만 설명의 미러는 남음" — 기능적 문제 없음, 텍스트 드리프트 가능성만 존재 | `codebase/backend/src/shared/utils/sanitize-error-message.ts` (130-137행, 167행, 176행 JSDoc) | 조치 불요. 값 의미 변경 시 재export 지점 JSDoc도 함께 훑을 것 |
| 17 | documentation | frontend `masked-markers.ts`에서 `MASKED_MARKERS`가 `isMaskedMarker` 전용 JSDoc 블록에 얹혀 export되어 자체 설명 없음(backend는 별도 export문+전용 JSDoc으로 분리) | `codebase/frontend/src/lib/utils/masked-markers.ts:56` | (선택) `export {}` 문을 둘로 나누고 `MASKED_MARKERS` 전용 한 줄 JSDoc 추가 |
| 18 | dependency | 신규 workspace 패키지 `@workflow/masked-markers`의 package.json/eslint.config.mjs/tsconfig.json이 형제 패키지(`@workflow/ai-end-reason`)와 헤더 주석 한 줄 제외 완전 동일(devDependency 버전까지 일치) | `codebase/packages/masked-markers/package.json` 등 | 없음(승인 가능한 형태) |
| 19 | dependency | `pnpm-lock.yaml`에 무관해 보이는 `eslint-config-next` peer-dep 재해석 diff 동반(INFO #7과 동일 사안, 기능 변경 없음으로 판단) | `pnpm-lock.yaml` | PR 설명에 한 줄 남기고 `pnpm install --frozen-lockfile` 재확인 권장 |
| 20 | dependency | 내부 등록 표면 8곳 중 자동 가드는 `.claude/test-stages.sh`/`packages-checks.yml` 2곳뿐, 나머지는 수동 대조(구조적 갭이나 다른 7개 내부 패키지에도 동일 적용되는 기존 패턴 — 이 PR이 신규로 만든 결함 아님) | 8개 등록 표면 전체 | 이번 PR 범위 밖, plan 문서에 이미 인지됨 |
| 21 | user_guide_sync | doc-sync-matrix 20개 trigger 행 전수 대조 결과 매칭 없음(신규 노드/스키마/UI 문자열/통합/섹션 디렉토리/인증 흐름/표현식 언어/실행-디버깅/warning-error code 전부 불일치) — 값 이관만 있고 사용자 가시 문자열·동작 변경 없음 | 전체 36개 변경 파일 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. 이관이 오히려 두 가지 보안 관련 실패 모드(런타임 미동결 Set, 크로스스택 깊이 상한 drift)를 구조적으로 닫음 |
| architecture | MEDIUM | 신규 미러 소멸 캐너리가 frontend-checks pathspec에 갇혀 backend-only PR에서 트리거 안 됨(이 PR의 존재 이유와 동일한 형태의 갭 재도입) |
| requirement | LOW | 기능 요구사항 충족 확인(전 테스트 GREEN, 등록 표면 8곳 대조). spec R17 SPEC-DRIFT 1건(이미 이월 계획됨) |
| scope | LOW | 목표에 타이트하게 수렴. INFO 2건(무관 lockfile 재해석, 리뷰 산출물 잔여 텍스트)만 스코프 외 |
| side_effect | LOW | 실제 파손 없음 확인(타입 변경 소비처 영향 없음, lockfile 재정렬 기능 무변경, 임시 디렉터리 정상 정리) |
| maintainability | NONE | 순수 리팩터로 복잡도·중복·가독성 문제 없음. INFO 2건(루프 재계산, prepare 스크립트 복제 확대)만 경미 |
| testing | LOW | 신규 테스트 전부 GREEN, vacuous 방지 3축 설계 확인. WARNING 1건(SoT 패키지 자체 리터럴 pin 부재) |
| documentation | NONE | 문서화 충실(README/JSDoc/plan 정합). INFO 3건(spec 이월, JSDoc 분산)만 경미 |
| dependency | NONE | 신규 외부 패키지 0개, 템플릿 완전 일치, 취약점/라이선스 리스크 없음 |
| user_guide_sync | NONE | 20개 trigger 매칭 0건, 사용자 가시 변경 없음 |

## 발견 없는 에이전트

없음 (전체 10개 reviewer 모두 최소 INFO 이상 기록).

## 권장 조치사항

1. (아키텍처 WARNING) 미러 소멸 캐너리(`masked-marker-mirror-guard.ts`/`.test.ts`)를 pathspec 게이팅 밖으로 옮겨 backend-only PR에서도 실행되도록 한다 — `packages-checks.yml`의 항상-실행 스텝 또는 `deps-security-checks.yml`처럼 `paths:` 필터 없는 별도 job으로 분리. 이 PR의 핵심 목적(크로스스택 drift 재발 방지)을 실제로 완결하는 데 필요.
2. (테스트 WARNING) `codebase/packages/masked-markers/src/__tests__/index.spec.ts`에 마커 리터럴 값(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`) 직접 pin 3줄 추가 — SoT 패키지 자신이 값 드리프트를 잡도록.
3. (SPEC-DRIFT) 다음 `project-planner` 턴에서 `spec/5-system/14-external-interaction-api.md` R17의 SoT 서술과 frontmatter `code:` 목록을 이관 사실에 맞게 갱신(plan 체크리스트에 이미 항목 존재, 그대로 집행).
4. (선택, INFO) `findRedeclaredSymbols`의 부분 문자열 오탐 방지 경계에 회귀 캐너리 1건 추가, backend 깊이 상한 테스트에 정확한 경계(10/11) 단언 추가 — 급하지 않음.
5. (선택, INFO) PR 설명에 "`pnpm-lock.yaml`의 `eslint-config-next` peer-dep 재해석은 `pnpm install` 부산물로 이 PR 목표와 무관" 한 줄 남겨 리뷰 혼란 방지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, user_guide_sync (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명, 전원 결과 확보 확인됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(값 이관 리팩터, DB/런타임 핫패스 무변경)와 낮은 관련성 |
  | database | 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 외부 API 계약 변경 없음(내부 재export만) |
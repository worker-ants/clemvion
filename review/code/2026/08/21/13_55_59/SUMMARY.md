# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, 신규 값·로직 회귀 없음(6~7라운드 누적 검증). 남은 WARNING 3건은 전부 이번 라운드가 검토 대상으로 삼은 직전 처분 커밋(`0e7b6fd4c`, backend spec JSDoc 문단 이식) 및 이전 라운드에서 이미 반복 검토·수용된 사안이며 기능 동작에는 영향이 없다. **forced reviewer 8명(`dependency, documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Requirement / Architecture | 직전 라운드(`13_34_34`) WARNING을 고친 커밋(`0e7b6fd4c`)이 backend spec JSDoc 헤더에 "규칙" 문단을 삽입하는 과정에서 기존 문장을 완전히 옮기지 못해, 새 문단 끝에 원본 문장 뒷부분이 그대로 눌어붙었다. 결과: (a) blockquote(`>`) 접두가 다음 줄에서 끊겨 마크업이 깨짐, (b) "탐지 로직 중복은 조건부로만 안전하다"고 명시한 직후 같은 인용 블록 안에서 조건 없는 절대형 "무력화하지 않는다"를 재진술하는 자기모순 문장, (c) 파일 내 최장 줄(약 241자, 두번째로 긴 줄의 약 1.9배). frontend 쌍둥이(`masked-marker-mirror.test.ts:39-40`)는 이 문제가 없음 — backend 사본에만 있는 편집 잔존물. 기능적 영향 없음(JSDoc 주석, 테스트 동작 무관) | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:36-37` | frontend `masked-marker-mirror.test.ts:39-40,47` 구조와 동일하게 재정렬 — "값의 미러와 달리…" 문장을 blockquote **앞**의 독립 평서문으로 옮기고, `> **규칙**: …넣는다.` 로 blockquote를 깔끔하게 끝맺는다. "고쳤다"고 쓰기 전에 `git diff`로 blockquote `>` 줄이 전부 연속인지 직접 확인할 것 |
| 2 | Architecture | 개발자가 라운드6 커밋 메시지에서 동의한 아키텍처 부채("탐지 로직(`resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations`) 자체도 공유 test-utility 패키지로 재추출해야 한다" — 이 중복이 라운드3·6 두 차례 backend/frontend 비대칭 결함의 근원)가 `review/**`(비-SoT, PR 종료 시 유실)에만 기록되고 `plan/` 후속 절에는 등재되지 않았다. 같은 plan 파일이 바로 옆 항목(`backend deepRedactSecrets 깊이 경계 테스트`)에는 이 규율("review/** 는 SoT 아니라 사라진다")을 정확히 지키고 있다 | `plan/in-progress/masked-marker-shared-package.md` `## 후속 (이 PR 밖)` 절(163-172행) | "탐지 로직 공유 패키지 재추출 — 라운드3·6 비대칭 결함의 근원, `0e7b6fd4c` 커밋 메시지에서 별건으로 미룸" 항목을 `## 후속 (이 PR 밖)` 절에 추가 |
| 3 | Scope | `spec/5-system/14-external-interaction-api.md` R17 SoT 서술 정정이 developer/RESOLUTION 턴에서 직접 커밋(`bf0618a7d`)돼, CLAUDE.md 의 "`developer`는 `spec/` read-only, 구현 중 spec 변경 필요 시 `project-planner` 위임" 역할 경계를 벗어났다. **이미 3라운드(`11_27_29`/`12_50_37`/`13_14_29`)에 걸쳐 반복 검토·자인됐고, 내용 자체는 구현과 정확히 일치하며 SPEC-DRIFT 아님을 확인, "되돌리지 않되 governance 결정은 이 PR 과 무관한 별건"으로 이미 확정된 상태** — 새로 발견된 문제 아님 | `spec/5-system/14-external-interaction-api.md:1625` | 이 PR 안에서 추가 조치 불요(3라운드 연속 재확인된 기존 처분 유지). "developer 예외 조건" CLAUDE.md 규정 여부는 별도 governance 턴 사안으로 기록만 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | 미러 소멸 가드 spec 파일 안에서 `resolveScanDirs`/`listSourceFiles`(재귀 `fs` 순회)가 서로 다른 `it` 블록(캐너리 포함)에 의해 메모이제이션 없이 최대 3회 반복 호출된다 — CI 전용 순수 낭비 | `codebase/backend/.../masked-marker-mirror.spec.ts:43,51-55,84`, `codebase/frontend/.../masked-marker-mirror.test.ts:52,60-64,96` | `beforeAll` 훅에서 한 번만 계산해 `it` 블록들이 공유하도록 리팩터 |
| 2 | Maintainability | frontend `masked-marker-mirror.test.ts`에만 이중 빈 줄이 두 곳 남아 backend 쌍둥이와 포맷이 어긋남(기능 영향 없음) | `codebase/frontend/.../masked-marker-mirror.test.ts:69-70, 86-87` | 빈 줄 하나씩 제거해 backend 쌍둥이와 형태 통일(선택 사항) |
| 3 | Testing | 직전 라운드 INFO 3건 상태 불변 재확인: backend 깊이 상한 테스트가 `not.toThrow()`만 확인(경계값 미고정), frontend 깊이 경계 테스트가 `MAX_MASK_DEPTH` import 없이 리터럴 10/11 사용, backend 미러 가드 spec 의 `repoRoot`가 고정 상대경로(`__dirname` 기준) | `sanitize-error-message.spec.ts`, `masked-markers.test.ts`, backend `masked-marker-mirror-guard.ts` | 저위험(vacuity 캐너리 백스톱 존재), 조치 불요 — 추적만 유지 |
| 4 | Performance / Architecture | 미러 가드 스캔 범위가 1단계→2단계(`+ codebase/packages/<pkg>/src`)로 확장돼 cross-stack 중복 스캔의 절대 비용이 커졌음(의도된 트레이드오프, 이전 라운드 수용 확인) | `masked-marker-mirror-guard.ts` (양쪽) `resolveScanDirs` | 조치 불요(재확인) |
| 5 | Side Effect | repo-guard 가 매 테스트 실행마다 `codebase/` 전체를 읽기 전용 스캔(쓰기 아님), `os.tmpdir()` 캐너리는 `try/finally`로 정상 정리, `_shared.ts`의 기존 import-time 부작용을 새 파일이 상속(신규 표면 아님), `MASKED_MARKERS` 타입이 `Set`→배열로 변경됐으나 `.has()` 소비처 없음 확인(무해), `frontend-checks.yml` 트리거 확장은 의도 명시됨 | 각 해당 파일 | 조치 불요(전부 재확인, 신규 위험 없음) |
| 6 | Scope | `pnpm-lock.yaml`에 목표와 무관한 `eslint-config-next` peer-dependency 재해석 노이즈(버전 불변, 6라운드 연속 동일 판정) | `pnpm-lock.yaml` | 조치 불요 |
| 7 | Scope | consistency-check 산출물(`rationale_continuity.md`)에 sub-agent 중간 추론 텍스트 잔존(target 코드 무관, 6라운드 미정리) | `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1,3` | 조치 불요(차단 사유 아님) |
| 8 | Dependency | 신규 워크스페이스 패키지 `@workflow/masked-markers`는 런타임 외부 의존 zero, devDependencies 는 선례(`@workflow/ai-end-reason`)와 버전까지 완전 동일, `license` 필드 부재는 저장소 전역 관행과 일치 | `codebase/packages/masked-markers/package.json` | 조치 불요 |
| 9 | Documentation | plan 체크박스·spec R17 서술·CI/Docker 주석·README/JSDoc 전부 실제 상태와 정합(재확인) | 각 해당 파일 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 정규식·깊이 상한·판정 로직 이관 전후 완전 동일, 마커-미러 가드의 경로 접두 경계 비대칭(이전 WARNING)도 backend/frontend 양쪽 수정 확인됨. 신규 표면 전부 빌드/테스트 전용, 사용자 입력 미개입 |
| performance | NONE | 런타임 hot path 무변경. CI 전용 가드 테스트 내 미러 소멸 스캔 중복 호출 1건 INFO |
| architecture | LOW | SOLID·결합도 신규 결함 없음. backend spec JSDoc 병합 흠(WARNING) + 아키텍처 부채 plan 미등재(WARNING) |
| requirement | LOW | 값·시그니처·spec fidelity 전부 재확인 정합. backend spec JSDoc 자기모순 문장(WARNING) |
| scope | LOW | 실질 변경 24개 파일이 단일 목표에 수렴. spec/ role-boundary(이미 3라운드 수용, WARNING 유지), pnpm-lock/consistency 잔여 텍스트는 INFO |
| side_effect | LOW | 전역 상태·시그니처 파괴·네트워크/환경변수 신규 위험 없음. 전부 재확인 INFO |
| maintainability | LOW | 핵심 로직 함수 분리 양호. JSDoc 줄바꿈/블록쿼트 흠, frontend 이중 빈 줄 포맷 드리프트(INFO) |
| testing | NONE | vacuity/오탐/격리/경계값 커버 성숙. 이전 INFO 3건 상태 불변 재확인 |
| documentation | LOW | plan/spec/CI 주석 정합. backend spec JSDoc 자기모순+깨진 blockquote(WARNING) |
| dependency | NONE | 신규 외부 의존 0건, devDeps 선례와 완전 동일, pnpm-lock 노이즈는 PR 무관 |

## 발견 없는 에이전트

- security (Critical/Warning 0, INFO 0)

## 권장 조치사항

1. `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:36-37`의 JSDoc을 frontend `masked-marker-mirror.test.ts:39-40,47` 구조와 동일하게 재정렬 — 블록쿼트 접두 복원 + 자기모순 문장 제거(WARNING #1, 3개 리뷰어 공통 지적).
2. `plan/in-progress/masked-marker-shared-package.md` `## 후속 (이 PR 밖)` 절에 "탐지 로직 공유 패키지 재추출" 항목 추가 — 개발자가 이미 동의한 부채가 `review/**`에만 남아 PR 종료 시 유실되지 않도록(WARNING #2).
3. WARNING #3(spec/ role-boundary)은 이번 PR 범위 내 추가 조치 불요 — 3라운드 연속 재확인된 기존 처분(되돌리지 않음, governance 결정은 별건) 유지.
4. INFO 항목(가드 spec 파일 내 스캔 중복 호출, frontend 이중 빈 줄)은 비차단이며 여유 있을 때 정리 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (10명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — **forced 전원 결과 확보됨, 미이행 없음**
  - **제외**: 표 (4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | router 판단상 이번 diff 와 무관(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(동시성 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff 와 무관(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 문서 변경 없음) |
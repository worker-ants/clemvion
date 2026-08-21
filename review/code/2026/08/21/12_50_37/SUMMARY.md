# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 9개 reviewer 중 7개(security/architecture/requirement/side_effect/maintainability/testing/documentation)가 독립적으로 동일한 실질 결함을 지적했다: 이 PR 자신이 신설한 "미러 소멸 가드"의 SoT 자기제외 경계 판정이 backend/frontend 두 사본 간 비대칭이며, 직전 라운드(`811a40f48`, "라운드3 처분")가 "양쪽 다 경계를 명시했다"고 커밋 메시지·RESOLUTION.md 에 서술했음에도 실제로는 backend 사본만 고쳐지고 frontend 사본은 옛 무경계 형태 그대로 남아 있다. 현재 이름이 겹치는 형제 패키지가 없어 라이브 결함은 아니지만(잠복), "탐지 로직 중복은 안전하다"는 이 PR 의 핵심 안전망 전제가 실제로 깨진 사례이고 재발을 막을 캐너리도 없다. **forced 화이트리스트 8개 전원(dependency/documentation/maintainability/requirement/scope/security/side_effect/testing) 결과가 정상 확보**돼 위 발견을 놓친 reviewer는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/아키텍처/요구사항/부작용/유지보수성/테스트/문서화 (7개 reviewer 중복 지적) | 미러 소멸 가드의 SoT 자기제외 경계 판정이 backend/frontend 간 비대칭 — frontend 는 `/` 경계 없는 `startsWith(SOT_DIR)` 비교라, `SOT_DIR`("codebase/packages/masked-markers")를 접두사로만 공유하는 형제 디렉터리(예: 가상의 `masked-markers-extra`)도 "SoT 자신"으로 오인해 재선언 탐지에서 조용히 제외한다(silent false negative). backend 는 이미 `=== SOT_DIR || startsWith(SOT_DIR + '/')`로 정확히 수정됨. 커밋 `811a40f48`(직전 라운드 처분)의 메시지·`RESOLUTION.md` 는 "양쪽 다 경계를 명시했다"고 서술하지만 실제 diff 대조 결과 backend 파일만 수정되고 frontend `findMirrorRedeclarations` 는 손대지 않은 채 그대로다. 두 스펙 파일의 캐너리(`it.each` "접두가 겹치는 다른 식별자")는 **심볼 이름** 접두 겹침(`MAX_MASK_DEPTH_OLD`)만 다루고 **디렉터리 경로** 접두 겹침은 어디도 검증하지 않아 이 비대칭 자체가 테스트로 가려지지 않는다. `codebase/packages/**` 변경이 backend/frontend CI 워크플로 양쪽 모두를 트리거하는 현재 pathspec 설정 덕에 실사용 위험은 완화되나, 이는 가드 자체의 불변식이 아니라 우연한 CI 설정 일치에 기댄 것이다. | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:143` (`findMirrorRedeclarations`) vs `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:141` (정상 구현) | frontend 143행을 `relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)` 형태로 backend 와 동일하게 맞춘다. 두 테스트 스위트에 `codebase/packages/masked-markers-extra/src/foo.ts` 형태의 합성 fixture로 "SoT 와 접두가 겹치는 형제 디렉터리는 재선언 탐지 대상에 포함된다"를 직접 단언하는 캐너리를 추가해 이 경계 클래스의 재발을 기계로 고정한다. 근본적으로는 이 탐지 로직 자체를 공유 헬퍼로 재추출하는 것을 검토(architecture INFO 참고). |
| 2 | 요구사항 | `developer`/code-review RESOLUTION 세션이 CLAUDE.md 의 "developer 는 spec/ read-only, 구현 중 spec 변경 필요 시 project-planner 위임" 역할 경계를 우회해 `spec/5-system/14-external-interaction-api.md` 를 직접 수정했다(커밋 `bf0618a7d`, "spec R17 정정"). 내용 자체(SoT 가 공유 패키지로 이관됐다는 서술)는 실제 구현과 정확히 일치해 SPEC-DRIFT 는 아니며, plan 문서도 이 이탈을 스스로 명시 기록했으나, `code-review-agents` 의 쓰기 권한도 `review/code/**` 뿐 `spec/` 가 아니므로 프로세스 관점의 역할 분리 위반이다. | `spec/5-system/14-external-interaction-api.md:16`, `:1625` (커밋 `bf0618a7d`) | 이번 편집은 되돌릴 필요 없음(내용 정확). 향후 유사 상황엔 실제 `project-planner` 턴을 거치거나, CLAUDE.md 에 "code-review RESOLUTION 이 사소한 spec 텍스트 오류를 직접 정정할 수 있는 예외 조건"을 명시적으로 추가해 이 경계가 반복 침식되지 않게 한다. |
| 3 | 테스트 | `findRedeclaredSymbols` 의 함수/클래스 선언(`ts.isFunctionDeclaration`/`ts.isClassDeclaration`) 재선언 탐지 분기가 어떤 테스트로도 행사되지 않는다 — `it.each(SOT_SYMBOLS...)` 캐너리는 모든 심볼에 대해 `const X = 1;`(변수 선언) 픽스처만 쓴다. `isMaskedMarker` 는 이관 전 실제로 `export function isMaskedMarker(...) {...}` 형태였으므로 "함수 선언으로 재선언"은 이 가드가 막아야 할 가장 현실적인 회귀 형태인데, 그 분기가 깨져도 현재 스위트는 GREEN 을 유지한다. | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:110-115`, `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:125-130` (대상 로직: 양쪽 `masked-marker-mirror-guard.ts` 의 `visit` 함수) | 두 파일의 `it.each` 픽스처에 `function isMaskedMarker() { return true; }` 형태(함수 선언) 케이스를 최소 1건 추가해 해당 분기를 실제로 행사시킨다. 클래스 선언 분기는 현재 어떤 SoT 심볼도 클래스가 아니므로 우선순위 낮음(INFO). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프/의존성 (중복 지적) | `pnpm-lock.yaml` 에 PR 목표와 무관한 `eslint-config-next` peer-dependency 해석 그래프 재구성이 동반됐다 — 버전 번호는 전부 불변, 신규 workspace 패키지 추가로 인한 `pnpm install` 재해석 부산물. 3라운드 연속 동일 판정. | `pnpm-lock.yaml` (`eslint-config-next@16.3.0` 등 snapshot 키 재구성 구간) | 조치 불요. PR 설명에 "masked-markers 와 무관한 lockfile 재해석 포함" 한 줄 남기면 리뷰 노이즈 감소. |
| 2 | 스코프 | 리뷰 산출물 `rationale_continuity.md`(10_58_25 세션) 최상단에 sub-agent 의 중간 추론 문장(`"Confirmed accurate..."` 등)이 그대로 남아 있다. target 코드 변경과 무관. 3라운드 연속 미조치. | `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1-3` | 이 PR 스코프 판단엔 영향 없음. 다음 consistency-check 산출물 생성 시 정리. |
| 3 | 아키텍처 | 탐지 로직(~150줄)이 backend/frontend 에 문자 그대로 복제돼 있고, 이번 WARNING(#1)이 "중복은 안전하다"는 트레이드오프의 실제 비용을 처음 실증했다 — 두 사본이 드리프트할 수 있음이 이번에 확인됨. | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전체 vs frontend 대응 파일 | 즉시 조치 불요(WARNING #1 을 해소하면 당장의 불일치는 사라짐). 다만 재추출(`@workflow/repo-guards` devDependency-only export 등)을 진지하게 검토할 시점 — 이번 사건이 그 조건을 충족했다. |
| 4 | 의존성 | 신규 패키지 `codebase/packages/masked-markers/package.json` 에 `license` 필드 없음 — 다만 형제 패키지 대다수(`ai-end-reason`, `graph-warning-rules`)도 마찬가지라 이번 PR 이 만든 신규 결함은 아니다. | `codebase/packages/masked-markers/package.json` | 조치 불요(기존 컨벤션 답습). 저장소 전체 `license`/`private` 표기 정책 정리는 이 PR 범위 밖. |
| 5 | 테스트 | backend 깊이-경계 테스트가 정확한 상한(10/11)을 못박지 않는다(25단 중첩 `not.toThrow()` 만 확인, frontend 는 `[경계]` 정확 테스트 보유). 이미 plan 후속 항목으로 2라운드 연속 등재됨 — 신규 발견 아님. | `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:239` | plan 트래커 등재 유지, 이 PR 범위 밖 후속 작업. |
| 6 | 테스트 | diff 밖 기존 테스트 주석(`masked-markers.test.ts`)이 이번 추출 완료로 stale 해졌다 — "공유 패키지 추출이 선행돼야 값싸다" 서술이 이미 닫힌 트래커를 열려 있는 것처럼 묘사. | `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` (diff 파일 목록 밖) | 다음 drive-by 편집에서 JSDoc 을 "SoT 는 `@workflow/masked-markers`"로 갱신. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 미러 가드 SoT 경계 비대칭(WARNING #1) — CI pathspec 대칭 덕에 실전 위험 완화 판단 |
| architecture | MEDIUM | 동일 비대칭(WARNING #1) + "탐지 로직 중복은 안전" 전제가 실제로 깨졌다는 아키텍처적 함의(INFO #3) |
| requirement | MEDIUM | 동일 비대칭(WARNING #1) + spec 직접 수정 역할 경계 우회(WARNING #2) |
| scope | LOW | PR 목표(단일 리팩터)에 4라운드 내내 타이트하게 수렴 확인. pnpm-lock/review 잔존 텍스트만 INFO |
| side_effect | LOW | 동일 비대칭(WARNING #1, "쌍둥이 가드 판정 로직 불일치"로 프레이밍) — 나머지 전 축 재확인 clean |
| maintainability | MEDIUM | 동일 비대칭(WARNING #1) — 직전 라운드 "고쳤다" 처분이 실제로는 미완료임을 지적 |
| testing | MEDIUM | 동일 비대칭(WARNING #1) + 함수/클래스 선언 탐지 분기 미검증(WARNING #3) |
| documentation | LOW | 동일 비대칭(WARNING #1) — RESOLUTION.md/커밋 메시지의 완료형 서술과 실제 코드 상태 불일치로 프레이밍 |
| dependency | NONE | 신규 외부 npm 의존성 없음, devDependencies 형제 패키지와 완전 일치, 등록 표면 8곳 정합 확인 |

## 발견 없는 에이전트

없음 — 전 reviewer 가 최소 INFO 이상을 보고했다.

## 권장 조치사항

1. `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:143` 을 backend(`:141`)와 동일하게 `relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)` 형태로 맞춘다 — 7개 reviewer 가 독립적으로 지적한 최우선 항목.
2. 두 미러 가드 테스트 스위트에 "SoT 와 경로 접두가 겹치는 형제 디렉터리는 재선언 탐지 대상에 포함된다" 캐너리를 추가해 이 경계 클래스의 재발을 기계로 고정한다.
3. `findRedeclaredSymbols` 의 함수 선언 재선언 케이스(`function isMaskedMarker() {...}`)를 두 스위트의 `it.each` 픽스처에 추가한다.
4. (선택, 저비용) CLAUDE.md 에 "code-review RESOLUTION 이 사소한 spec 텍스트 오류를 직접 정정할 수 있는 예외 조건"을 명시하거나, 향후 유사 상황에서 실제 `project-planner` 턴을 거치도록 한다.
5. INFO 항목(pnpm-lock 잔여, 리뷰 산출물 잔여 텍스트, license 필드, depth 경계 정확값, stale 주석)은 이번 PR 범위 밖 후속 작업으로 plan 트래커에 유지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(사유 미제공 — prompt 에 근거 텍스트 없음) |
  | database | router 판단(사유 미제공) |
  | concurrency | router 판단(사유 미제공) |
  | api_contract | router 판단(사유 미제공) |
  | user_guide_sync | router 판단(사유 미제공) |
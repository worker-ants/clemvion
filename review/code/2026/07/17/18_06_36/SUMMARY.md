# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 6개 reviewer 모두 대상 diff(`eslint.config.mjs` 정규식 상수화 + `eslint-layering-guard.test.ts` flat-config 병합 재현/bare 케이스 추가) 자체는 건전하다고 판정했으나(NONE×4, LOW×1), testing-reviewer 가 mutation testing 으로 **규칙 severity 강등(`"error"`→`"warn"`)이 신규 테스트에도 CI lint 스크립트에도 걸리지 않는 잔여 갭**을 재현 확인해 WARNING 1건이 존재한다.

> **참고(상태 정합)**: `_retry_state.json` 은 6개 forced reviewer 전원을 `agents_pending` 으로 기록하고 `agents_success`/`agents_fatal` 은 비어 있으나, 해당 6개 출력 파일(`security.md`/`requirement.md`/`scope.md`/`side_effect.md`/`maintainability.md`/`testing.md`)은 모두 존재하며 `## 위험도` 섹션까지 포함한 완결된 보고서다. 상태 파일 미반영(known reconcile 지연)으로 판단해 6건 전원을 정상 완료로 취급했다 — "재시도 필요" 항목 없음. (main 실측: `--verify-coverage` → `forced coverage OK — 6/6 on disk`.)

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 규칙 severity 를 `"error"`→`"warn"` 으로 낮추는 mutation 을 `layeringErrors()` 가 탐지 못함(`severity` 미검사, `ruleId` 만 필터링) — 실제 mutation 재현 결과 **20/20 그대로 통과**. 게다가 frontend `package.json` 의 `lint` 스크립트에 `--max-warnings` 제한이 없어(default 무제한) `pnpm --filter frontend lint` CLI 도 종료 코드 0 으로 통과 — unit test 와 CI lint 게이트 양쪽 모두 뚫리는 실재 사각지대 | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:49-53` (`layeringErrors`), `codebase/frontend/eslint.config.mjs` (두 규칙의 `"error"` 리터럴) | `layeringErrors` 반환 메시지의 `severity` 를 함께 검증(`expect(msg.severity).toBe(2)`) 하거나, `mergedRules["no-restricted-imports"][0]`/`mergedRules["no-restricted-syntax"][0]` 이 `"error"`(또는 `2`)인지 별도 assertion 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security, side_effect, requirement, scope | `COMPONENTS_PATH_RE` 상수화는 순수 동등 치환 — 리팩터 전/후 selector 문자열이 JS 파싱 후 바이트 단위로 동일함을 직접 대조, `npx eslint` 재실행으로 `0 errors / 12 warnings` 재확인. 동작 회귀 없음, 신규 공격 표면(정규식 인젝션/ReDoS) 없음(고정 상수, 사용자 입력 무관) | `codebase/frontend/eslint.config.mjs:5-7,55,61` | 조치 불요 |
| 2 | requirement, scope, testing | 선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md`) WARNING #1(flat config "나중 블록 우선" 병합 미검증)·#2(bare 형태 사각지대)·#3(정규식 중복) 3건 모두 실제 mutation testing(override 무력화 재현 14/20·bare 제거 4/20 실패 등)으로 완전 해소 확인 | `eslint.config.mjs`; `test.ts` | 조치 불요 |
| 3 | maintainability | `no-restricted-syntax` 의 정규식(`COMPONENTS_PATH_RE`)과 `no-restricted-imports` 의 glob(`group` 4-엔트리)이 "components 경로 매칭"이라는 동일 개념을 여전히 이중 문법으로 표현 — 향후 매칭 대상 추가 시 한쪽만 갱신되고 다른 쪽이 누락될 drift 위험 잔존 | `eslint.config.mjs` 상수 vs `group` | 파일 상단에 "이 파일에서 `@/components` 매칭 지점은 총 2곳, 함께 갱신 필요" 크로스레퍼런스 주석 추가 권장(이번 diff 범위 밖, 필수 아님) |
| 4 | testing | 동적 `import()`/`require()` 정규식의 경계 정밀도(`@/components-legacy` 등 근접 오탐)를 검증하는 negative fixture 부재 — 앵커를 느슨하게 바꾸는 mutation 이 탐지되지 않음(false-positive 방향이라 영향은 상대적으로 작음) | `eslint.config.mjs` 상수; `test.ts` negative 목록 | `it.each` negative 목록에 `'import("@/components-legacy/x")'` 류 근접 오탐 케이스 1~2개 추가 |
| 5 | testing | `files: ["src/lib/**"]` 리터럴 문자열 정확 일치에 의존한 블록 탐색 — glob 표현을 기능적으로 동등한 다른 문자열로 바꾸면 fail-open 가드가 `throw` 하며 fail-loud 되지만(안전한 방향), 에러 메시지가 "정상적인 glob 리팩터링"과 "진짜 규칙 약화"를 구분 못해 원인 진단이 어려움 | `test.ts` 블록 탐색부 | 향후 `files` 표현 변경 시 이 리터럴도 함께 갱신해야 함을 주석 1줄로 명시 |
| 6 | maintainability | fail-open 가드 에러 메시지가 조건 확장(블록 미발견 + 병합 결과 빈 rules 두 경우 모두 포함)을 정확히 반영하지 못하고 "가드 블록을 찾지 못했습니다"로만 고정 | `test.ts` throw 메시지 | 메시지를 "가드 블록을 찾지 못했거나 규칙이 비어 있습니다" 등으로 미세 조정(우선순위 낮음) |
| 7 | maintainability | selector 문자열에 정규식 상수를 템플릿 리터럴로 보간해 간접 계층이 한 단계 증가 — DRY 트레이드오프로 타당하나 selector 전체를 한눈에 읽으려면 상수 정의를 별도로 찾아야 함 | `eslint.config.mjs:55,61` | 상수 선언 옆에 매칭/비매칭 예시 1~2개 주석 추가(선택) |
| 8 | requirement | `src/lib → components` 레이어 경계 규약을 다루는 전용 `spec/conventions/*.md` 문서가 여전히 부재 — 선행 리뷰 WARNING#4 로 이미 별도 트래킹 중이며 이번 diff 의 명시 범위(W#1~#3) 밖. 이번 변경이 spec 과 충돌하지는 않음 | N/A (spec 문서 부재) | `project-planner` 위임(선행 리뷰 권장사항 유효) — 이번 diff 범위 아님 |
| 9 | requirement, testing | `mergedRules` 병합(`Object.assign` 배열 순서 기반)은 flat config 의 "나중 블록 우선" 규칙을 rule-key 단위로는 정확히 재현하지만, 실제 ESLint 병합기의 `files`/`ignores` 매처 정밀도(하위 glob 만 override 하는 시나리오)까지는 재현하지 않음 — 현재 config 구조(단일 `files:["src/lib/**"]` 블록)에서는 문제 없음 | `test.ts` 병합 헬퍼 | 향후 `src/lib/**` 를 세분화하는 override 블록이 추가되면 이 헬퍼도 함께 재검토 |
| 10 | side_effect, testing (환경 아티팩트 — 코드 결함 아님) | 로컬 단독 실행 중 신규 bare-path 케이스가 간헐적으로 실패(side_effect: 1회 4건, testing: 첫 실행 14/20)했다가 캐시 삭제/재실행 후 안정적으로 20/20 통과(side_effect 11회, testing 캐시 삭제 후 5회 반복 재현). **stale vite transform 캐시 / 공유 워크트리 동시 편집(리뷰어들이 같은 워크트리에서 mutation 실험 수행)에서 기인한 측정 아티팩트로 자가 진단됨** — diff 코드 자체의 결함이 아니므로 승격하지 않음 | `eslint-layering-guard.test.ts` (bare 케이스) | 조치 불요. CI 에서 유사 패턴(최초 1회만 실패, 재실행 시 통과) 재발 시 vite 캐시 클리어부터 의심 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정규식 상수화는 순수 동등 치환, 사용자 입력·네트워크·DB·인증 접점 없음, 공격 표면 없음 |
| requirement | NONE | 선행 리뷰 WARNING #1/#2/#3 mutation testing 으로 완전 해소 확인, spec 문서 부재는 범위 밖 트래킹 항목 |
| scope | NONE | 3건 WARNING 에 1:1 대응, 범위 이탈·불필요한 리팩터·무관 파일 수정 없음 |
| side_effect | NONE | 프로덕션 config mutate 없음, 전역 변수/FS/네트워크/env 부작용 없음, 동작 회귀 없음(실측 확인) |
| maintainability | LOW | glob/regex 이중 표현 잔존, 간접성 소폭 증가, 에러 메시지 미세 조정 — 전부 INFO, 즉시 조치 불요 |
| testing | MEDIUM | severity 강등(`"error"`→`"warn"`) mutation 이 unit test 와 CI lint(max-warnings 무제한) 양쪽 모두 통과시킴(WARNING) + negative fixture 경계값 갭(INFO) |

## 발견 없는 에이전트

scope (발견사항 "없음" 명시, 위험도 NONE).

## 권장 조치사항

1. **(최우선)** `eslint-layering-guard.test.ts` 의 `layeringErrors`/관련 검증에 규칙 `severity` assertion 추가 — `"error"`→`"warn"` 강등이 unit test 와 `pnpm --filter frontend lint`(현재 `--max-warnings` 무제한) 양쪽 모두 통과하는 잔여 갭을 닫는다. 이 가드 테스트가 명시적으로 방어하고자 한 "규칙 옵션 약화" 시나리오와 정확히 일치하는 미탐지 케이스이므로 후속 보강 권고.
2. **(선택, 낮은 우선순위)** negative fixture 에 `@/components-legacy` 류 근접 오탐 경계값 케이스 1~2개 추가해 정규식 앵커 약화 mutation 탐지력 보강.
3. **(선택)** glob(`no-restricted-imports`)/regex(`COMPONENTS_PATH_RE`) 이중 표현에 대한 크로스레퍼런스 주석, fail-open 가드 에러 메시지 미세 조정 — 필수 아님, 유지보수 마찰 완화 목적.
4. **(트래킹 유지, 이번 diff 범위 아님)** `src/lib → components` 레이어 경계 규약을 위한 `spec/conventions/frontend-layering.md` 신설은 선행 리뷰 WARNING#4 로 이미 별도 트래킹 중 — `project-planner` 위임 유효.

## 라우터 결정

- `routing_status=done` (router 가 선별, `_routing_decision.json` 기준):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing` (6명) — 전원 `agents_forced (router_safety)`: 대상 diff 가 `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 소스 코드 변경이라 항상 강제 적용됨.
  - **제외**: 8명 (아래 표)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (선택된 6명과 동일 — router 자체 판단 선별분 0명, 전원 safety-forced)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 상수 추출·테스트 로직 수정은 성능 중립적 |
  | architecture | 레이어 가드 구조 변경 없음, 테스트 정확성 개선만 |
  | documentation | 내부 주석만, public API 변경 없음 |
  | dependency | package.json/의존성 변경 없음 |
  | database | DB 변경 없음 |
  | concurrency | async/lock/queue 코드 변경 없음 |
  | api_contract | API route/controller 변경 없음 |
  | user_guide_sync | trigger 디렉토리 매칭 안 됨 |

---

**관련 파일 경로**:
- `review/code/2026/07/17/18_06_36/security.md`
- `review/code/2026/07/17/18_06_36/requirement.md`
- `review/code/2026/07/17/18_06_36/scope.md`
- `review/code/2026/07/17/18_06_36/side_effect.md`
- `review/code/2026/07/17/18_06_36/maintainability.md`
- `review/code/2026/07/17/18_06_36/testing.md`
- `review/code/2026/07/17/18_06_36/_routing_decision.json`

# Code Review 통합 보고서

## 전체 위험도
**LOW** — 7개 reviewer 전원(requirement/testing/documentation/scope/security/side_effect/maintainability) 실행 완료, CRITICAL 0건·WARNING 0건. 발견사항은 전부 INFO 이며 대부분 직전 3라운드(`20_21_06`→`20_46_48`→`21_12_21`)가 이미 지적·처분한 항목의 재확인이다. 강제 화이트리스트(forced) 7명 전원 결과가 인라인 전문으로 확보됐다 — 미이행·결측 없음.

**참고(위험도 판정에 영향 없음, 투명성 목적 기록)**: `requirement`·`side_effect` 두 reviewer 가 각각 독립적으로, **이 리뷰 세션 자체를 기동한 호출 프롬프트가 이번 diff 가 고치는 바로 그 구버전 `REPORT_RETURN_CONTRACT` 문구**(파일/반환 메시지 sink 분리 이전 3줄)로 실행되고 있음을 관측했다. 이는 harness 세션 캐싱 문제(코드 결함 아님)이며, 소스(`_lib/agent-return.mjs` + 3개 워크플로 미러)는 이미 올바르게 수정돼 있음을 두 reviewer 모두 직접 확인했다. `plan/in-progress/backend-lint-gate-broken-on-main.md:317-335` 가 이미 이 사실을 추적 중이며 "같은 세션의 리뷰 라운드를 더 돌려도 같은 스냅샷을 볼 뿐이므로 이 체크박스를 이 세션 안에서 닫으려 하지 말 것 — 새로운 top-level 세션에서 재확인 필요"라고 명시해 두었다. 이번 관측은 그 예측과 정확히 일치하는 4번째 독립 재현이며 새로운 결함이 아니다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 하네스-캐싱 | 이 리뷰 세션 자체가 이번 diff 가 제거하는 구버전 계약 문구(파일/반환 분리 이전)로 기동됨 — requirement·side_effect 독립 관측(4번째 재현). 소스는 이미 정정돼 있음 | 세션 프롬프트 자체(저장소 파일 아님); `plan/in-progress/backend-lint-gate-broken-on-main.md:317-335` | 조치 불요 — plan 지시대로 새로운 top-level 세션에서 재확인 필요, 같은 세션 리뷰 라운드로 체크박스 닫지 말 것 |
| 2 | self-deadlock 감사 | 호출 스택 축 수치(`.transaction(` 36=모듈내9+모듈외27, 호출부 20=직접11+EngineDriver경유9)를 독립 재계산해 JSDoc 서술과 완전 일치 확인 | `codebase/backend/.../execution-engine.service.ts:8571-8583` | 조치 불요(검증 완료) |
| 3 | self-deadlock 감사 | 이 불변식은 여전히 자동 정적 가드 없이 JSDoc+수동 grep/카운트에만 의존 — AST 없이는 유한화 불가하다는 근거로 의식 유예됨 | `execution-engine.service.ts` `updateExecutionStatus` JSDoc | 조치 불요(유예 근거 타당). 향후 TS AST 유틸이 저렴해지면 `.transaction(` 블록 안 `this.updateExecutionStatus` 리터럴 호출만 잡는 좁은 스모크 체크 재검토 |
| 4 | 유지보수성 | self-deadlock 수치(36/9/27)가 JSDoc 요약과 plan 이력 두 곳에 중복 기재 — SoT 분산, 한쪽만 갱신될 위험 | `execution-engine.service.ts:8571-8572`; `plan/in-progress/backend-lint-gate-broken-on-main.md:291-293` | 지금 병합 불요(역할 분리가 타당). 다음에 수치를 다시 대조할 때 JSDoc·plan 동시 갱신을 편집 체크리스트에 명시 |
| 5 | 테스트 견고성 | 신규 회귀 테스트 2건이 `indexOf('1)')`/`indexOf('2)')` 문자열 슬라이스로 계약 문구를 탐색 — 문구 결합에 다소 취약(이전 라운드 유예 항목, 재확인) | `.claude/tests/test_agent_return.mjs:113-114,129-130` | 조치 불요. 다음 계약 편집 시 배열 인덱스/named 상수로 리팩터 고려 |
| 6 | 테스트 견고성 | `test_guard_filename_references_point_at_this_file` 정규식이 `.claude/tests/` 접두어 붙은 참조만 포착, 접두어 없는 파일명 언급은 사각지대 | `.claude/tests/test_workflow_scripts.py:127` | 조치 불요(현재 실질 사각지대 없음, 넓히면 다른 오탐 위험) |
| 7 | 문서화 | JSDoc "세는 방법" 경고에서 제네릭 누락 시 수치(35)는 명시하지만 주석 줄 포함 시 "부풀린 수"로만 서술해 비대칭 | `execution-engine.service.ts` `updateExecutionStatus` JSDoc | 급하지 않음. 다음 편집 기회에 원인 한 구절만 추가 |
| 8 | scope | 원 커밋(`7d6854cb9`)이 무관한 두 주제(계약 sink 분리·self-deadlock 감사)를 한 커밋에 담음 — 3라운드 전 WARNING 으로 지적·plan 에 판단 기록되며 처분 완료, 이번이 4번째 재확인 | `execution-engine.service.ts` JSDoc; `plan/in-progress/backend-lint-gate-broken-on-main.md` 판단 기록 단락 | 조치 불요(5번째 재-revert 요구 안 함) |
| 9 | scope / 부작용 | `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/**` 산출물 커밋은 CLAUDE.md 저장 위치 규약에 정확히 부합, drive-by 무관 파일 추가 아님 | `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/*` | 조치 불요 |
| 10 | requirement | `output_file` 첫 줄이 `#` 제목으로 시작해야 한다는 계약이 sub-agent 산출물 형태를 강제하는 별도 가드 없이 관례에 의존 | `.claude/workflows/_lib/agent-return.mjs:61` | 조치 불요(회색지대, spec 아님). 후속으로 `^#\s` 확인 가벼운 산출물 가드 고려 가능(이번 PR 범위 밖) |
| 11 | 부작용 | `REPORT_RETURN_CONTRACT` 재정의는 3개 워크플로가 여는 모든 향후 fan-out sub-agent 호출 프롬프트 형태를 바꾸는 저장소 전역 변경 — 의도됨, 4곳 byte-identical 확인 | `.claude/workflows/_lib/agent-return.mjs:48-69` + 3개 워크플로 미러 | 조치 불요(의도된 변경, 영향 범위 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | self-deadlock 수치 독립 재계산 일치, 세션 자체가 구버전 계약으로 기동(하네스 캐싱, plan 추적 중), `#` 제목 가드 부재(관례 의존) — 전부 INFO |
| testing | LOW | 13/13·6/6(17 subtests) GREEN, 뮤테이션 2건으로 non-vacuous 확인, self-deadlock 자동 가드 부재(의식 유예), 신규 테스트 문자열 슬라이스 취약점(참고) |
| documentation | NONE | 3라운드 지적 사항(가드 파일명·미래 날짜·JSDoc "9" 혼동·plan 세션 스코프) 전부 실측 재확인으로 해소, 신규 회귀 없음 |
| scope | LOW | 신규분(`2ca5244ae`,`8602c93e5`) 전부 직전 라운드 처분·plan_guard 요구 반영, 원 커밋 주제 혼합은 4번째 기결 재확인 |
| security | NONE | 실행 코드 변경 없음(JSDoc 주석뿐) + harness 프롬프트 텍스트만 — 인젝션/시크릿/인증/암호화 전 관점 발견사항 없음 |
| side_effect | LOW | `REPORT_RETURN_CONTRACT` 4곳 byte-identical, JSDoc-only 변경 확인, 세션 자체 구버전 계약 기동 재관측(4번째 독립 재현, plan 추적 중) |
| maintainability | LOW | 3라운드 지적 사항 전부 재확인 해소, self-deadlock 수치 JSDoc+plan 이중 기재(SoT 분산) 및 테스트 문자열 슬라이스 취약점 신규 INFO 2건 |

## 발견 없는 에이전트

- security — CRITICAL/WARNING/INFO 전부 없음(위험도 NONE)

## 권장 조치사항

1. (당장 조치 불요) 이 세션이 구버전 `REPORT_RETURN_CONTRACT` 문구로 기동됐다는 관측을, 새로운 top-level Claude Code 세션에서 실제로 신 계약이 로드되는지 확인하는 데 활용할 것 — `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 해당 체크박스는 같은 세션의 리뷰 라운드로 닫지 말 것(plan 명시 지시).
2. (다음 편집 기회) self-deadlock 감사 수치(36/9/27)를 다시 대조할 때 JSDoc 요약과 plan 이력 문서를 동시 갱신하도록 체크리스트에 명시 — 현재는 액션 불요.
3. (다음 편집 기회) `REPORT_RETURN_CONTRACT` 문구를 다시 만질 때, 신규 회귀 테스트(`test_agent_return.mjs`)의 `indexOf('1)')`/`indexOf('2)')` 슬라이스를 배열 인덱스/named 상수 기반으로 리팩터하면 문구 변경에 덜 취약해진다 — 현재는 급하지 않음.
4. 그 외 모든 발견사항은 조치 불요(참고/기록용) — 이 diff 는 3라운드(WARNING 4→5→1)를 거쳐 이번 4라운드에서 WARNING 0·CRITICAL 0 으로 완전히 수렴했다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, testing, documentation, scope, security, side_effect, maintainability` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원 — 강제 화이트리스트 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |
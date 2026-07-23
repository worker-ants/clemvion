# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 신규 e2e 테스트(`test_guard_review_before_push_main.py`, 20건)는 실제 훅을 subprocess 로 구동해 게이트 순서·BYPASS 격리·3중 fail-open·stdin 파싱을 견고하게 커버하지만, 같은 diff 에 포함된 **모듈 docstring 이 이미 철회된 과거 구현("두텁게 테스트됨")을 근거로 사실과 다른 안도감을 심는 점**, 그리고 **plan 문서 본문(D 완료)과 하단 요약 체크리스트(D 미완료)가 같은 파일 안에서 즉시 모순**되는 점이 documentation/requirement 리뷰어 공통 WARNING 으로 지적됐다. router_safety 가 강제 포함한 7개 reviewer 전원이 정상적으로 결과를 반환했으므로(누락 없음) 이 MEDIUM 은 "리뷰 커버리지 공백"이 아니라 **실제 지적사항 기반**이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 신규 테스트 모듈 docstring 첫 문단이 "`_is_git_push` 는 이미 두텁게 테스트됨"이라는 이제는 거짓인 전제를 심는다. 그 근거였던 44-케이스 스위트(`test_push_detection.py`)와 서브커맨드 재작성은 커밋 `3c6547b4d`("reaper 앵커 --keep 완료 / push 가드 재작성은 3라운드 회귀로 철회")로 완전히 철회되어 저장소에 없음. 현재 `_is_git_push` 는 단순 정규식 구현이며 전용 단위 테스트가 전혀 없다(backlog 항목 ②가 이 갭을 다루도록 미착수 상태) | `.claude/tests/test_guard_review_before_push_main.py:35-36` | 첫 문단을 "`_is_git_push` 자체는 전용 단위 테스트 없음(구 스위트는 철회됨), 이 파일은 `main()` 의 오케스트레이션만 검증"으로 정정 |
| 2 | Documentation | 인라인 주석이 실제로 미사용인 심볼(`REPO_ROOT`)을 "used below" 라 서술 — `_harness` import 는 실제로 `HOOKS_DIR` 속성 접근에만 쓰이고 `REPO_ROOT` 는 파일 전체에서 미사용 | `.claude/tests/test_guard_review_before_push_main.py:66` | 주석을 `HOOKS_DIR used below` 로 정정하거나 `# noqa: F401` 자체를 제거 |
| 3 | Requirement / Documentation | `plan/in-progress/harness-guard-followups.md` 본문 D 섹션(완료 `[x]` + 상세 서술로 갱신)과 파일 하단 "## 체크리스트" 요약(`- [ ] D — push 훅 \`main()\` 테스트`, 미체크)이 같은 diff/파일 안에서 서로 모순. A·F 항목은 본문·요약 둘 다 `[x]` 로 정확히 동기화된 것과 대비 | `plan/in-progress/harness-guard-followups.md` (본문 D 섹션 vs 하단 체크리스트) | 같은 diff 또는 즉시 후속 커밋에서 하단 체크리스트의 D 항목도 `[x]` 로 동기화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 게이트 평가 중 예외 발생 시 stderr 에 전체 traceback 을 노출하는 기존 fail-open 동작을 신규 테스트가 그대로 고정(pin). 신규 위험은 아니며 같은 plan 문서 §E("REVIEW/PLAN 게이트 fail-open 정책")로 이미 추적 중 | `test_guard_review_before_push_main.py:228-234, 241-244` | §E 정책이 확정(fail-closed 또는 관측 가능한 fail-open)되면 관련 테스트도 함께 갱신 |
| 2 | Requirement | import 실패 시 진단 출력의 게이트 간 비대칭(review 는 traceback 출력, plan 은 무출력)이 테스트로 고정되지 않음. 대상 파일의 기존 특성이며 이번 diff 가 만든 것은 아님 | `guard_review_before_push.py:39-48` vs import-failure 테스트 3종 | 선택적으로 `assertIn`/`assertNotIn("Traceback", ...)` 추가해 비대칭을 명시적으로 pin |
| 3 | Testing | valid JSON 이지만 top-level 이 dict 가 아닌 stdin(`"[]"`, `"null"`, `"5"`) 케이스 미검증 — `_read_payload()` 가 그대로 반환해 `payload.get()` 에서 `AttributeError` 크래시 가능(0/2 어느 exit code 도 아님) | `test_malformed_stdin_json_allows` 인근 | `raw_stdin="[]"`/`"null"` 케이스를 추가해 크래시 동작(및 exit code)을 명시적으로 pin |
| 4 | Testing | 두 게이트(review+plan)가 동시에 예외를 던지는 조합(`review="raise", plan="raise"`) 미검증. import-fail 조합은 전용 테스트가 있는데 대칭이 안 맞음 | `test_review_evaluate_exception_...`, `test_plan_evaluate_exception_...` 인근 | `test_both_gates_raise_allows_the_push` 1건 추가(선택, 대칭성 목적) |
| 5 | Testing | `tool_input`/`input` 두 키가 동시 존재할 때 우선순위, `tool_input` 이 빈 dict(falsy)일 때 `input` 으로 폴백하는 경로 미검증 | `main()` 의 `or` 체인 소비 테스트 | `payload={"tool_input": {}, "input": {"command": _PUSH}}` 케이스 1건 추가(선택) |
| 6 | Maintainability / Testing | stub `_Plan` 이 실제 `PlanDecision` 의 부분집합만 미러링(`complete_but_in_progress` 필드 누락). 현재 `main()` 이 그 필드를 읽지 않아 무해하나, 향후 계약 확장 시 놓치기 쉽다(다만 실패 시 `AttributeError` 로 fail-loud 하므로 실질 리스크는 낮음) | `test_guard_review_before_push_main.py:96-118` vs `_lib/plan_guard.py:77-84` | 스텁 근처 주석에 "narrower than the real dataclass; `main()` currently reads only these fields" 한 줄 보강 |
| 7 | Documentation | `.claude/tests/README.md` "What's covered" 카탈로그에 신규 테스트 파일 행 누락. 기존에도 6개 파일이 등재 누락 상태라(기존 drift 답습) 이번 diff 만의 신규 회귀는 아님 | `.claude/tests/README.md` | 선택적으로 이번 파일 1행 추가; 근본 해결은 README-vs-실제 파일 목록 drift 를 잡는 자동 가드 도입(별건) |

### 문제 없음으로 확인된 사항 (긍정 소견)
- subprocess 실행이 리스트 인자·비-shell 방식이라 커맨드 인젝션 표면 없음(security).
- `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 가 서로 다른 게이트로 누출되지 않음을 명시적으로 검증, 부모 셸의 우회 설정이 새어 들어오지 않도록 `env.pop()` 처리(security/side_effect).
- 임시 디렉토리는 `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree, ...)` 로 항상 회수되며, 원본 훅 파일은 읽기만 하고 복사본만 수정(side_effect).
- stdin payload 에 `"git push origin HEAD"` 문자열을 주입해도 실제 훅은 판정만 수행하고 명령을 실행하지 않으므로 실제 네트워크/git 부작용 없음(side_effect).
- `import _harness` 의 `sys.path` 전역 변경은 기존 확립된 패턴이며, 훅이 별도 subprocess 에서 실행되므로 `sys.modules` 캐시 충돌 우려 없음(side_effect).
- 하드코딩된 시크릿/자격증명 없음(security).
- 리뷰어가 직접 뮤테이션(게이트 순서 스왑, BYPASS 누출, 예외 미포착)을 재현해 테스트가 실제로 회귀를 포착함을 확인 — plan 문서의 뮤테이션 검증 주장은 사실로 확인됨(requirement, testing).
- 두 파일 모두 plan 항목 D 가 정의한 범위와 정확히 일치하며 불필요한 리팩토링·무관 파일 변경·포맷팅 혼입 없음(scope).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿 없음, BYPASS 격리·fail-open traceback 확인(모두 기존 동작 pin) |
| requirement | LOW | plan 체크리스트 불일치(WARNING #3), import 진단 비대칭 미고정(INFO #2), 뮤테이션 검증 주장 직접 재현·사실 확인 |
| scope | NONE | 범위 이탈 없음(plan 항목 D 와 정확히 일치); plan 체크리스트 불일치를 INFO 로 관찰(WARNING #3 과 동일 사안) |
| side_effect | NONE | 부작용 없음, env/temp/subprocess 격리 확인, 실제 git push 미실행 확인 |
| maintainability | NONE | stub 부분집합 미러링(INFO #6) 외 우려 없음, 기존 컨벤션과 일관 |
| testing | LOW | 핵심 로직(게이트 순서·BYPASS 격리·fail-open) 뮤테이션 검증 통과, 엣지케이스 커버리지 갭 다수(INFO #3~#6) |
| documentation | MEDIUM | 거짓 전제 docstring, 미사용 심볼 주석, plan 체크리스트 모순 — WARNING 3건 |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상 발견(INFO 포함).

## 권장 조치사항

1. `plan/in-progress/harness-guard-followups.md` 하단 "## 체크리스트"의 D 항목을 `[x]` 로 즉시 동기화(requirement·documentation·scope 공통 지적, WARNING #3).
2. `test_guard_review_before_push_main.py` 모듈 docstring 첫 문단을 정정 — `_is_git_push` 자체는 전용 단위 테스트가 없음(구 44-케이스 스위트는 철회됨)을 명시해 backlog ② 의 실제 갭이 은폐되지 않도록(WARNING #1).
3. 66행 인라인 주석(`REPO_ROOT used below`)을 실제 사용 심볼(`HOOKS_DIR`)로 정정하거나 불필요한 `# noqa: F401` 제거(WARNING #2).
4. (선택, 여유 시) testing/maintainability INFO 갭 반영 — non-dict top-level JSON stdin, 두 게이트 동시 raise 조합, `tool_input`/`input` 우선순위, stub 주석 보강.
5. (선택, 별건) `.claude/tests/README.md` "What's covered" 카탈로그와 실제 `test_*.py` 목록의 drift 를 잡는 자동 가드 도입 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **실행된 7명 전원이 router_safety 화이트리스트에 의한 강제 포함**(router 자체 선별 스코어링으로 추가 선택된 reviewer 없음). forced 전원 결과 확보됨 — 누락·미이행 없음.
  - **제외**: 7명 (아래 표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(diff 특성상 성능 영향 낮음으로 스킵, 구체적 사유 미상세) |
  | architecture | 라우터 판단(아키텍처 영향 없음으로 스킵, 구체적 사유 미상세) |
  | dependency | 라우터 판단(의존성 변경 없음으로 스킵, 구체적 사유 미상세) |
  | database | 라우터 판단(DB 변경 없음으로 스킵, 구체적 사유 미상세) |
  | concurrency | 라우터 판단(동시성 영향 없음으로 스킵, 구체적 사유 미상세) |
  | api_contract | 라우터 판단(API 계약 변경 없음으로 스킵, 구체적 사유 미상세) |
  | user_guide_sync | 라우터 판단(사용자 가이드 영향 없음으로 스킵, 구체적 사유 미상세) |
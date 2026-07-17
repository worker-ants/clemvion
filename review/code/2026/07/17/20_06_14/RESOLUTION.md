# RESOLUTION — review/code/2026/07/17/20_06_14

대상: branch `claude/isconversationoutput-branch-tests-97f9a8` (base `origin/main`), 코드 커밋 `5600ca245`
(`test(frontend): isConversationOutput OR-체인 3분기 mutation 고립 테스트 (#968 이월)`).

SUMMARY 판정: **RISK=LOW / CRITICAL=0 / WARNING=1 / INFO=8**.

## 조치 항목

| SUMMARY # | 분류 | 내용 | 조치 | commit |
|---|---|---|---|---|
| WARNING 1 | maintainability | 주석 내 하드코딩 라인 번호 참조 drift — `hydration-coverage.test.ts` 가 `result-timeline.tsx:168` 을 가리키나 실제 `buildConvConfigFromStructured` 호출은 180번 라인. 린터가 검증하지 않는 매직 라인 번호라 편집 시 조용히 더 어긋남 | **반영** — 라인 번호를 제거하고 함수명 기반 참조("`buildConvConfigFromStructured` call site in result-timeline.tsx")로 교체. 이 PR 이 고치려는 "출처 참조가 코드보다 stale 해지는" 패턴을 스스로 새로 도입하지 않도록 | 본 커밋 |
| INFO 1 | requirement | 신규 테스트 제목의 "alone" 표현이 느슨함 | **미조치 (의도)** — 리뷰어 자신이 "선택 사항, 수정 불필요"로 분류. 테스트 바디 주석이 고립 조건을 정확히 열거하고 있고, mutation 실측으로 격리가 이미 증명됨 | — |
| INFO 2 | requirement | OR-체인 분기 목록이 spec 에는 요약만, 상세는 코드 JSDoc 에만 존재 | **미조치 (의도)** — 리뷰어가 "불일치 아님 / 조치 없음"으로 분류. 내부 헬퍼의 분기 enumeration 은 코드 JSDoc 이 SoT 여도 무방 | — |
| INFO 3·4 | scope | 3번째 파일이 다른 하위 디렉터리 / JSDoc 12줄 확장 | **미조치 (의도)** — 둘 다 "조치 불필요". 근거는 커밋 메시지에 이미 명시 | — |
| INFO 5·6·7 | maintainability | 테스트 주석의 내부 변수명 결합 / JSDoc↔테스트 이중 설명 SoT / JSDoc 내 영어→한국어 전환 | **미조치 (의도, 후속 고려)** — 셋 다 차단 사유 아님. 변수명 결합·이중 SoT 는 다음에 `isConversationOutput` 분기를 편집할 때 함께 정리 (아래 §보류·후속 항목) | — |
| INFO 8 | side_effect | 신규 테스트가 순수 함수 호출 + 로컬 fixture 만 사용 | **미조치 (참고용)** — 발견이 아니라 확인 | — |

### WARNING 1 관련 사실 정정 (리뷰어 기재 오류)

maintainability 리뷰어가 위치를 `hydration-coverage.test.ts:1362` 로 기재했으나 **해당 파일은 99줄**이라 존재하지 않는 라인이다. 실제 위치는 `:54-61`. 지적의 실질(라인 번호 참조는 rot 한다)은 타당하므로 반영했고, 위치만 실측으로 바로잡았다. — 라인 번호 오기가 리뷰어 자신에게서도 발생했다는 점이 지적의 타당성을 오히려 뒷받침한다.

## TEST 결과

`.claude/tools/run-test.sh` wrapper 로 4단계 전부 재수행 (cross-stack backend+frontend).

| 단계 | 결과 | 근거 |
|---|---|---|
| lint | **PASS** (57s) | `_test_logs/lint-20260717-225853.log` |
| unit | **PASS** (81s) | `_test_logs/unit-20260717-230204.log` — frontend vitest **280 files / 5551 passed | 1 skipped**, backend jest 포함. 요약줄 `tests=14` 는 wrapper 의 jest-only 카운트 정규식 artifact (PROJECT.md §빌드·린트·테스트 명령 주석) — 로그에서 frontend vitest 실행·신규 3건 포함을 직접 확인 |
| build | **PASS** (121s) | `_test_logs/build-20260717-230528.log` |
| e2e | **통과** (266s) | `_test_logs/e2e-20260717-230754.log` — backend supertest `tests=256 passed` **+ frontend playwright `51 passed (58.3s)`**. PROJECT.md §38 지시대로 요약줄 숫자가 아니라 로그의 `N passed (…s)` 줄로 playwright 실행을 실측 확인 (`Running 51 tests using 2 workers` → `51 passed`) |

e2e 면제 미적용 사유: 변경 set 에 `.ts` 파일(`output-shape.ts`)이 포함되고, PROJECT.md §e2e 면제 화이트리스트 는 "회색 지대(예: `*.test.ts` 만 변경 …) 도 화이트리스트가 아니므로 e2e 수행" 이라고 명시한다. "주석만이라 런타임 영향 없음" 은 §63 이 금지한 자가 영향 추정이므로 면제 근거로 쓰지 않고 **정규 수행**했다.

### mutation 실측 (본 PR 의 핵심 주장 — 재확인)

통과 자체는 검증이 아니므로, 분기별 제거 → red 전환을 직접 실측했다. 원복 후 OR-체인 로직 잔여 diff 0 확인.

| mutation | 결과 |
|---|---|
| (전제 재현) 원본 테스트만 + 첫 OR-분기 통째 제거 | **32/32 green** — 갭이 실재했음을 증명 |
| M1 `outputInteraction` 제거 | 1 failed / 34 passed |
| M2 `hasConvConfig` 제거 | 1 failed / 34 passed |
| M3 `metaInteraction` 제거 | 1 failed / 34 passed |
| M4 첫 OR-분기 통째 제거 | 2 failed / 33 passed |

각 mutant 가 **오직 대응 테스트 하나에만** 잡히므로 격리가 성립한다.

## 보류·후속 항목

1. **`testing` 리뷰어 판정 미확보 (harness 장애 — 리뷰 발견 아님)**
   - 1차 시도: `API Error: Server error mid-response` (attempt 1, 12 tool calls 후 중단, `STATUS=no_status`, output_file 미생성).
   - 재시도 시도했으나 세션 내내 `claude-opus-4-8 (safety classifier) temporarily unavailable` 로 **Agent/Workflow tool 자체가 게이트**됨 (Bash·Read 는 정상 동작하는 부분 장애). 6회 재시도 모두 동일 사유로 차단.
   - **완화**: (a) `requirement` 리뷰어가 독립적으로 mutation 실측(소스 임시 훼손 후 재실행)을 수행해 3개 테스트의 격리 주장과 "no known producer" JSDoc 근거를 모두 검증했다 — 전담 testing 리뷰를 대체하지는 못하나 핵심 주장은 교차 확인됨. (b) main Claude 가 위 §mutation 실측 표를 직접 수행해 기록했다.
   - **잔여 리스크**: LOW. 변경이 테스트 추가 + 주석 정정뿐이고 런타임 로직 diff 가 0 이며, 4단계 TEST WORKFLOW 가 전부 PASS. 그럼에도 SUMMARY 상단 경고대로 "testing 리뷰어 미확인 영역이 있는 판정"임을 명시해 둔다.
   - **후속**: classifier 복구 후 `Agent(subagent_type="testing-reviewer", prompt_file=<session_dir>/_prompts/testing.md)` 1회 재실행으로 종결 가능. 세션 디렉터리·프롬프트는 그대로 보존돼 있다.
2. **INFO 5·6 (테스트 주석의 내부 변수명 결합 / JSDoc↔테스트 이중 설명 SoT)** — 차단 사유 아님. 다음에 `isConversationOutput` 분기를 손대는 작업에서 함께 정리 고려.
3. **별건 (기존 추적 중)** — `isConversationOutput` 의 heuristic OR-체인을 discriminated union 으로 재설계하는 안. 입력이 `unknown` 이라 타입만으로 근본 차단은 불가. 본 작업은 그 재설계가 아니라 현 구조의 커버리지 보강이다.

# RESOLUTION — report-paths-shared 리뷰 Warning 8건 처리

대상 SUMMARY: `./SUMMARY.md` (**MEDIUM**, Critical 0, Warning 8, INFO 9)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `e499ef216` | `review_guard.py` "Fail loudly" 주석을 실제 예외 전파 경로(두 호출자의 broad `try/except` 로 결국 fail-open)에 맞게 정정. 4개 리뷰어 독립 지적 |
| #2 | 코드 | `e499ef216` | **유일한 기능 회귀(실행 검증됨)** — `has_report()` 에 `os.path.isfile()` 복원, `report_path()` 에 basename 안전 폴백(`""`/`"."`/`".."`) 추가. `output_file` 이 `/` 로 끝나거나 `..` 면 디렉터리를 "리포트 있음" 으로 오판하던 결함(reviewer 실측 64~96 bytes) 해소. trailing `/`·`..`·directory-isfile 회귀 테스트 6건 + `report_paths()` happy-path 테스트 1건 추가 |
| #3 | 코드 | `e499ef216` | `.github/workflows/harness-checks.yml` `paths:` 에 `.claude/_shared/**` 추가 — 신규 SoT 모듈이 CI 트리거에서 빠져 있던 gap 해소 |
| #4 | 코드 | `e499ef216` | 호출부 0건(grep 확인)인 죽은 `_report_paths()` wrapper 2개(`code_review_orchestrator.py`, `consistency_orchestrator.py`) 제거 + `report_paths()`(복수형) 정상 입력 happy-path 테스트 추가 |
| #5 | 코드 | `e499ef216` | `consistency_orchestrator.py` 에 "빈 리포트는 success 로 승격 안 됨" 테스트(`test_an_empty_checker_report_is_not_promoted_to_success`) 추가 — `code_review_orchestrator` 의 `AgreementTest.test_agree_on_an_empty_report` 와 대칭 |
| #6 | 코드 | `e499ef216` | `plan/complete/harness-report-contract-followups.md` frontmatter `spec_impact: none` 근거 문장 정정 — `components/layout/**` 가 `spec/2-navigation/_layout.md` `code:` glob 에 실제 매칭됨을 인정하되, 순수 mock/setup 추출 리팩터(assertion·동작 변경 없음, vitest 11/11 동일 통과)라 spec 갱신 불필요임을 명시 |
| #7 | 코드 | `e499ef216` | `.claude/tests/README.md` "What's covered" 표에 신규 테스트 파일 2개(`test_report_paths_shared.py`, `test_forced_coverage_selection.py`) 행 추가, 각 핵심 논지 요약 |
| #8 | 코드 | `e499ef216` | `code-review-agents/SKILL.md`·`consistency-checker/SKILL.md` 에 CLI 소급 재분류 안내 추가 — "이 변경 이후 과거 세션에 상태-조회 커맨드 실행 시 0바이트 placeholder 리포트가 있던 세션은 판정이 바뀌고 `_retry_state.json` 이 갱신될 수 있다" |

spec 관련(spec 결함·SPEC-DRIFT) 항목 없음 — 8건 전부 코드/테스트/문서(`.claude/**`·`.github/**`·`plan/complete/**`) 범위로 developer 쓰기 권한 내 처리, spec 위임 불필요.

## TEST 결과

- lint  : 통과 (63s)
- unit  : 통과 (backend·frontend·web-chat·channel-web-chat·internal 5 packages, 97s) — 별도로 하네스 python 272 tests(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 전수 통과 확인(W#2/W#4/W#5 신규 테스트 포함), workflow 계약 `node --test test_agent_return.mjs` 11 tests 통과
- build : 통과 (165s, backend/frontend Dockerfile 이미지 빌드 + 프로덕션 이미지 위생 스모크 포함)
- e2e   : 통과 (backend 256/256 + playwright 51/51, 428s, log=`_test_logs/e2e-20260717-165502.log`) — 진행 중 docker 빌드캐시 압박으로 postgres 에 일시적 "No space left on device" 3줄이 찍혔으나 BuildKit 자동 GC 로 즉시 회복(1.1G→21.5G 여유), 최종 테스트 결과에는 영향 없음(재시도 없이 45/45 suite 클린 통과)

## 보류·후속 항목

- INFO 1~9: 전원 리뷰어가 "조치 불요" 로 명시했거나 낮은 우선순위 참고용 — 자동 조치 대상 아님(O(n²) 트레이드오프·부트스트랩 패턴·타입힌트 누락·문서 간 수치 불일치·subagent-call-contract.md §7 링크·malformed manifest 방어성 개선·이중 모듈 로드·단수형 가드 간접 커버·중복 name 처리 실무 경로 없음)
- 민감 변경 가드: 해당 없음 — DB 마이그레이션·외부 API 계약·인증 흐름·의존성 메이저 버전 변경 전무
- 부수 발견(이번 SUMMARY 대상 아님, 조치하지 않음 — 참고용): `consistency-checker/SKILL.md` 기존 96행이 `code_review_orchestrator.py --sync-from-disk` 를 인용하나 `consistency_orchestrator.py` 에는 `--sync-from-disk` 커맨드 자체가 없음(`--summary-state`/`--resume`/`--update` 만 존재) — 별개의 pre-existing 문서 부정확. 이번 W#8 수정은 그 옆에 새 안내만 추가했고 기존 오기는 스코프 밖이라 미수정

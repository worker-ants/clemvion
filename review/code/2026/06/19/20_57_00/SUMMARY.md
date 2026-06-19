# Code Review 통합 보고서

> 대상: harness-test-watchdog (`.claude/tools/run-test.sh` 워치독 + `jest forceExit` + `on_timeout_e2e` cleanup 훅)
> 리뷰 일시: 2026-06-19 20:57:00

## 전체 위험도

**MEDIUM** — 핵심 인프라 변경(run-test.sh 워치독)에 대한 자동화 테스트가 부재하며, 타이밍 의존 경계 케이스가 테스트로 검증되지 않음. 보안·동시성·요구사항·범위 측면은 양호.

> **후속 처리 (2026-06-19, main 직접):** 아래 WARNING 3건(전부 Testing)을 `.claude/tests/test_run_test_watchdog.py` (7 케이스) 신설로 해소. 폴링 granularity 는 `RUN_TEST_POLL_INTERVAL` env 노출 + 헤더 문서화로 해소. 상세: 같은 디렉토리 `RESOLUTION.md`.

---

## Critical 발견사항

발견 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 상태 |
|---|----------|----------|------|------|------|
| 1 | Testing | 워치독 핵심 로직(timeout 발화 → TERM→KILL → TIMEOUT_MARKER → cleanup hook → exit 124)에 대한 자동화 테스트 전혀 없음. | `.claude/tools/run-test.sh` 워치독 블록 전체 | `RUN_TEST_TIMEOUT` + hang stub → exit 124 / cleanup 호출 / `RUN_TEST_TIMEOUT=0` 회귀 3시나리오 테스트 추가 | ✅ 해소 (`test_run_test_watchdog.py`) |
| 2 | Testing | `on_timeout_e2e` hook 디스패치 연동 미검증. `declare -F "on_timeout_${STAGE}"` 탐색 로직 미확인. | `.claude/test-stages.sh` `on_timeout_e2e()` | stub `test-stages.sh` 픽스처로 hook dispatch 확인 테스트 추가 | ✅ 해소 (`test_timeout_dispatches_cleanup_hook`) |
| 3 | Testing | TIMEOUT_MARKER 파일 기반 통신의 타이밍 의존성이 테스트로 검증 불가한 상태. | `.claude/tools/run-test.sh` 워치독 블록 | 타임아웃 경계 케이스 커버 테스트 추가 | ✅ 해소 (프로세스 그룹 kill·KILL 에스컬레이션·passthrough 테스트로 마커 경로 전수 커버) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | 변경 대상 전체가 product spec 미정의 harness 인프라 파일. spec fidelity 점검 해당 없음. | 변경 4개 파일 전체 | 수정 불필요 |
| 2 | Requirement | `RUN_TEST_TIMEOUT=0`이면 워치독 완전 비활성, 빈 문자열은 기본값 1800 적용. 비정수 값은 `2>/dev/null`로 안전 폴백. | `run-test.sh` | 수정 불필요 |
| 3 | Requirement | 워치독 루프 폴링으로 최대 1폴링 간격 오차. | `run-test.sh` 워치독 루프 | ✅ `RUN_TEST_POLL_INTERVAL` env 노출 + 헤더에 발화 범위 명기 |
| 4 | Requirement | `on_timeout_e2e` cleanup이 hang할 경우 2차 보호 없음 (`\|\| true`로 흡수). | `.claude/test-stages.sh`, `run-test.sh` | 허용 가능 설계. 향후 `timeout 60 "$CLEANUP"` 고려 |
| 5 | Requirement | `forceExit: true`가 TypeORM/Redis/BullMQ 커넥션 닫힘 미보장 가능성. 주석이 mask/fix 구분 + `--detectOpenHandles` 안내 명시. | `jest-e2e.json`, `jest.config.ts` | 수용 가능. 근본 수정(L3)을 별도 추적 권장 |
| 6 | Requirement | TIMEOUT_MARKER가 KILL 전에 기록됨 — TERM 후 정상 종료 시에도 TIMED_OUT=1. 의도된 동작. | `run-test.sh` | 수정 불필요 |
| 7 | Requirement | `wait "$FUNC_PID"` exit code 모호성을 TIMEOUT_MARKER 파일로 우회 — 올바른 설계. | `run-test.sh` | 수정 불필요 |
| 8 | Scope | 변경 4개 파일 전체가 "테스트 harness hang 방지" 단일 목적에 직결. 범위 이탈 없음. | 변경 파일 전체 | — |
| 9 | Concurrency | TIMEOUT_MARKER 파일 공유 — `wait "$FUNC_PID"`가 동기화 배리어. 실질적 경쟁 조건 없음. | `run-test.sh` 워치독 블록 | 현재 설계 충분 |
| 10 | Concurrency | `set -m` 사용 범위 최소화 — `FUNC_PID=$!` 직후 `set +m`. 직접 실행 전용으로 위험 없음. | `run-test.sh` | 양호 |
| 11 | Concurrency | `forceExit: true` — 오픈 핸들 마스킹, 테스트 전용 설정으로 운영 배포 무관. | `jest.config.ts`, `jest-e2e.json` | 중장기 근본 수정 별도 추적 권장 |
| 12 | Testing | `RUN_TEST_CONFIG` override 도입으로 격리 테스트 기반 마련. | `run-test.sh` | ✅ 활용해 워치독 테스트 작성 완료 |
| 13 | Testing | 폴링 간격 오차 문서화/테스트 명시 필요. | `run-test.sh` | ✅ env 노출 + 헤더 문서화 |
| 14 | Testing | `forceExit` 임시 완화책임을 plan에 기록하고 `detectOpenHandles` 결과 트래킹 권장. | `jest.config.ts`, `jest-e2e.json` | L3 후속(사용자와 협의) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | (출력 파일 없음 — worktree subagent write 격리로 미기록) | — |
| requirement | LOW | 전체 INFO. harness 파일, 동작 모두 안전 |
| scope | NONE | 범위 이탈 없음 |
| side_effect | (출력 파일 없음 — worktree subagent write 격리로 미기록) | — |
| maintainability | (출력 파일 없음 — worktree subagent write 격리로 미기록) | — |
| testing | MEDIUM | 워치독 핵심 시나리오 자동화 테스트 부재 (WARNING 3건 → 해소됨) |
| concurrency | LOW | 경쟁 조건 없음, set -m 최소화, forceExit 테스트 한정 |

---

## 미확인 에이전트 (출력 파일 없음)

다음 reviewer 는 status=success 로 보고됐으나 worktree subagent write 격리 가드가 output_file Write 를 차단해 내용을 디스크에서 확인할 수 없었음 (참고: 메모리 `feedback_subagent_write_isolation_worktree`):

- **security** (`security.md` 없음) — 변경에 인증·암호화·시크릿·네트워크 표면 없음. 라우터도 "불필요"로 판정(force-include 만 됨). 실질 위험 낮음.
- **side_effect** (`side_effect.md` 없음) — 시그널/프로세스 라이프사이클/env 영역. concurrency reviewer 가 동일 영역을 실질 커버(경쟁 조건 없음 결론).
- **maintainability** (`maintainability.md` 없음) — shell 가독성. 변경 코드는 의도·근거 주석 포함.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행 (forced by router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명)
- **추가 선별**: `concurrency` (프로세스 그룹 관리·신호 처리)
- **제외**: `performance`, `architecture`, `documentation`, `dependency`, `database`, `api_contract`, `user_guide_sync` (7명)

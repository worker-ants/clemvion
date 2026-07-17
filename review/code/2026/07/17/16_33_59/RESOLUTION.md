# RESOLUTION — review/code/2026/07/17/16_33_59

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `e0e2123d4` | `no-restricted-syntax` 로 동적 `import("@/components/**")` / `require("@/components/**")` (alias·상대경로 우회 포함) 를 추가 차단. `codebase/frontend/eslint.config.mjs` |
| #2 | 코드 | `e0e2123d4` | `src/lib/__tests__/eslint-layering-guard.test.ts` 신설 — `eslint.config.mjs` 의 실제 `src/lib/**` rules 객체를 ESLint `Linter#verify` 에 그대로 먹여 위반 8건 + 무관 케이스 5건 회귀 고정 |

두 항목 모두 동일 파일(`eslint.config.mjs`)·상호 검증 관계라 단일 커밋으로 함께 처리(commit message 에 `SUMMARY#1 SUMMARY#2` 병기).

## TEST 결과

- lint  : 통과 (`run-test.sh lint`, 68s) — `npx eslint .` 0 errors / 12 warnings (변경 전 baseline 과 동일, 증가 없음)
- unit  : 통과 (`run-test.sh unit`, 113s) — 신규 `eslint-layering-guard.test.ts` 16/16 포함
- build : 미실행 — resolution-applier 표준 게이트는 lint+unit → e2e (§2.4). e2e 파이프라인(`make e2e-test-full`) 자체가 필요한 docker 이미지를 빌드하므로 별도 `build` 스테이지는 이번 변경(순수 ESLint config + vitest 테스트, 런타임 코드 무변경)에서 생략
- e2e   : **통과** (`run-test.sh e2e`, 363s) — backend jest `256 passed, 256 total` + frontend playwright `51 passed (1.5m)`. 로그: `_test_logs/e2e-20260717-171800.log`
  - 최초 1회차는 docker 디스크 부족으로 차단됐으나(아래 이력), 사용자 승인 후 `docker builder prune -f` 로 **20.87GB 회수**(Build Cache 24.14GB → 3.29GB) 후 재실행해 통과. 차단은 해소됐다.
  - ⚠ wrapper 요약줄 `tests=256` 은 backend jest 수만 센다 — playwright 실행 여부는 로그의 `51 passed (1.5m)` 줄로 확인함 (PROJECT.md §e2e 주의 참고).

### (이력) 1회차 e2e 차단 — docker VM 디스크 부족 (코드와 무관, 현재 해소됨)

`run-test.sh e2e` 1회 시도, `postgres` 컨테이너가 `exited (1)` 로 의존성 실패:

```
2026-07-17 07:58:13.311 UTC [44] FATAL:  could not extend file "base/1/2600_vm": No space left on device
2026-07-17 07:58:13.311 UTC [44] PANIC:  could not write to file "pg_logical/replorigin_checkpoint.tmp": No space left on device
```

- 실측 근거: `docker system df` → Build Cache 42.92GB (39.84GB reclaimable). Docker VM(`Docker.raw`, 할당 `diskSizeMiB=61035`≈59.6GB) 내부 `df` → `58.4G` 중 `54.3G` 사용, 가용 **1.1G (98%)**.
- 시도한 안전 복구: `docker image prune -f` (dangling only, 허용 범위) 실행 — 이미지 105개(25.25GB)→15개(6.864GB)로 감소했으나 `Total reclaimed space: 0B` (동일 blob 을 42.92GB build cache 가 여전히 보유) → VM 내부 가용 공간 변화 없음(1.1G 그대로).
- 이 worktree 소유의 실패한 잔여 compose 스택만 `make e2e-down` 으로 정리(다른 스택은 건드리지 않음) — 공간 회복 미미.
- **차단 사유**: 실제 공간을 되찾으려면 `docker builder prune -f`(build cache 전체) 또는 `docker volume prune -af` 가 필요한데, `docker ps -a` 로 확인한 결과 **다른 작업의 e2e 스택이 현재 실행 중**(`clemvion-e2e-report-paths-shared-0edbf0-*`, `Up ... (healthy)`) — 공유 인프라 대량 삭제는 auto-mode 가드가 차단하는 영역(PROJECT.md + 팀 메모리 `reference_e2e_docker_disk_full` 동일 사례)이라 본 sub-agent 가 임의 실행하지 않음.
- 로그: `_test_logs/e2e-20260717-165810.log`

**이 변경 자체는 e2e 실패의 원인이 아니다** — 코드 변경은 `codebase/frontend/eslint.config.mjs`(순수 lint 설정) + 신규 vitest 파일뿐이며, 백엔드/DB 관련 코드는 무변경. lint·unit 은 정상 통과했고, postgres 는 애플리케이션 코드 실행 전 initdb 단계에서 디스크 부족으로 죽었다.

### 처분 (완료)

main 이 사용자에게 escalate → **옵션 1 승인**(`docker builder prune -f`) → 20.87GB 회수 후 e2e 재실행 → **통과**. 위 "TEST 결과" 의 e2e 줄이 최종 상태다.

## 보류·후속 항목

- e2e 3회 재시도는 수행하지 않음 — 1회차에서 시작 단계(초기화 이전)의 명백한 환경 오류로 원인이 확정돼(`docker logs` 의 "No space left on device") 반복 재시도가 무의미하다고 판단 (§4 "인프라 차단" 경로 적용, "e2e-fail-3x" 아님).
- INFO #1 (Requirement): `src/lib` → `@/components` 레이어 규약의 공식 spec 문서 부재 — `project-planner` 협의 대상, 자동 fix 범위 밖 (SUMMARY.md INFO #1 참고).
- INFO #2, #3 (Maintainability): 주석 하드코딩 경로 참조·glob 가독성 — "필수 아님"으로 명시된 선택 사항, 이번 자동 흐름에서 미적용.
- 민감 변경 가드 해당 없음 — DB 마이그레이션·외부 API 계약·인증/결제 변경 없음.
- spec 관련 항목 없음 (SPEC-DRIFT·spec 결함 0건) — Critical 0, Warning 2 모두 코드 분류.

# Code Review 통합 보고서 (eia-context 내부 패키지 eslint/harness/CI)

## 전체 위험도
**LOW** — 실질 프로덕션 변경은 dead-code 제거 2건(실측 검증). harness/CI 구조 WARNING 3건(비차단). documentation disk-write gap.

## Critical
없음.

## 경고 (WARNING) — 처리
| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | Maintainability | 패키지 목록이 cmd_lint/test/build 3곳 하드코딩(15줄 중복, drift 위험) | ✅ `INTERNAL_PACKAGES` 배열 추출 + 3함수 loop 공유 |
| 2 | Testing | orphaned-package 재발 가드 부재 + packages-checks.yml 이 test-stages.sh 미호출(pnpm 명령 재선언) | 후속 등재 — 신규 infra(workspace 커버리지 테스트). test-stages.sh 를 harness-checks trigger 등재도 별도 |
| 3 | Testing/Maint | packages-checks.yml 단일 job 멀티라인 run → set -e 로 첫 실패만 보고(다중 실패 은폐), web-chat-checks 패턴 불일치 | ✅ `strategy.matrix` per-package job 분리 |
| 4 | Doc (disk-write gap) | documentation reviewer 출력 부재 — README/CHANGELOG 필요 여부 미확인 | tooling/CI 배선은 관례상 README/CHANGELOG 불요(선행 npm→pnpm 도 없음) — fresh 라운드 재확인 |

## 참고 (INFO) — 판정
- I1 (action SHA pin·permissions): 리포 전역 기존 패턴 — 별도 백로그
- I2 (eslint config 보일러플레이트 5중복): rule-of-three, 6번째 패키지 시 base config 추출 → tracked
- I3 (package.json 배열 재포맷 노이즈): 생성 스크립트 JSON.stringify 부산물, low risk — 수용
- I4 (dead-import 제거 스코프): lint 활성화 직접 결과, grep 검증 — 조치 불요
- I5 (harness 상단 주석 stale): ✅ 5개 내부 패키지 반영 갱신
- I6 (devDeps 정렬 불일치 vs web-chat-sdk): 강제 규약 없음 — 수용
- I7/I8/I9 (plan 3건 동시 종결·push paths 비대칭·lockfile paths): 조치 불요(기존 패턴/의도)

## 에이전트별 위험도
security NONE · requirement NONE · scope LOW · side_effect NONE · maintainability LOW(→W1) · testing LOW(→W2/W3) · dependency LOW · documentation disk-write gap

## 권장 조치 → 처리
1. documentation 재실행 → fresh 라운드(tooling README/CHANGELOG 불요 판정)
2. ✅ W3 matrix
3. ✅ W1 배열 추출
4. W2 harness 커버리지 가드 → 후속 등재
5. ✅ I5 주석 갱신

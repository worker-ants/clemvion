# RESOLUTION — fix-embedding-test-dimension-a3d42a / 21_48_12

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 | Architecture (backlog) | (없음) | forwardRef 순환 — 런타임 위험 없음, `plan/in-progress/unified-model-management.md §7 W4` 백로그 추적 (caller 지시) |
| WARNING #2 | Architecture (backlog) | (없음) | OCP 위반 가능성 — kind 분기 3개 미만, W4 백로그와 동일 추적 (caller 지시) |
| WARNING #3 | Testing (fix) | `e6f9dac5` | `kind=rerank` testConnection 경로 — `client.testConnection()` 호출 검증 케이스 추가 |
| INFO #1 | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-embedding-testconnection.md` |
| INFO #2 | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-embedding-testconnection.md` |
| INFO #3 | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-embedding-testconnection.md` |
| INFO #4 | false positive | (무시) | model-config-manager.test.tsx 중복 describe — 실제 파일 확인 결과 중복 없음 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4253 passed, 1 skipped — spec-link-integrity 실패 1건 pre-existing, audit-action.const.ts 경로 이슈, 본 변경과 무관)
- e2e   : 통과 (188/188) — `/Volumes/project/private/clemvion/_test_logs/e2e-20260611-220425.log`

## 보류·후속 항목

- WARNING #1 Architecture: `plan/in-progress/unified-model-management.md §7 W4` — forwardRef 순환 의존 해소 중기 리팩터링
- WARNING #2 Architecture: 동일 W4 백로그 — kind 분기 3개 이상이 되면 `LLMClient` 인터페이스에 `probeConnection()` 추가
- SPEC-DRIFT #1·#2·#3 draft 위임: `plan/in-progress/spec-update-embedding-testconnection.md` — project-planner 가 `consistency-check --spec` 후 `spec/5-system/7-llm-client.md` 및 `spec/2-navigation/6-config.md §B.3·§B.5` 반영
- INFO #5·#6 Maintainability: 픽스처 공유 상수 추출 + 매직 리터럴 named 상수화 — 낮은 우선순위, 추후 자연스럽게 정리
- INFO #7–#13 Testing/Architecture: 컨트롤러 스펙, 엣지케이스, 사이드이펙트 캡슐화 — medium priority, 후속 turn 에서 처리 가능
- INFO #14·#15 Documentation: JSDoc + Swagger description 영문화 — 낮은 우선순위

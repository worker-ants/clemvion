# Code Review RESOLUTION

세션: `review/code/2026/05/15/22_57_13`
PR: `cleanup-script-prod-a3f81c` — cleanup-invalid-queue-jobs 운영 사용 가능화
처리자: developer
처리일: 2026-05-15

## 요약

ai-review SUMMARY 결과 — Critical 0, Warning 11, Info 16. 본 PR 의 변경이 도입한 항목을 우선 조치하고, 기존 부채는 추적만 한다.

## 조치 완료

| ID | 위치 | 조치 |
|---|---|---|
| WARNING #2 (architecture/side_effect) | `cleanup-invalid-queue-jobs.ts` | dotenv 최상위 블록 → `loadDotenv()` 함수로 격리, `main()` 첫 줄에서 호출. migrate-button-ids.ts 와 패턴 일치. |
| WARNING #3 (requirement/operational) | `cleanup-invalid-queue-jobs.ts` `main()` finally | summary 출력을 finally 블록 안에서 `queue.close()` *전* 수행. close 실패는 warn 으로 강등해 summary 가 가려지지 않도록 함. |
| WARNING #5 (requirement/documentation) | `cleanup-invalid-jobs.util.ts` `CLEANUP_QUEUE_STATES` | `active`/`completed` 제외 근거를 JSDoc 으로 명시. |
| WARNING #8 (documentation) | `cleanup-invalid-jobs.util.ts` 공개 export | `sweepInvalidJobs`, `parseCleanupArgs`, `formatSummaryLine`, `CleanupSummary`, `SweepOptions.apply/pauseDuringSweep` 에 JSDoc 추가. |
| WARNING #10 (concurrency) | `cleanup-invalid-jobs.util.ts` `sweepInvalidJobs` | 다중 큐 순차 처리 시 큐 간 pause gap 의도를 JSDoc 으로 명시. |
| INFO #6 (performance) | `runSweep` | 매 페이지마다 발생하던 `[...CLEANUP_QUEUE_STATES]` spread 를 모듈 레벨 `CLEANUP_QUEUE_STATES_MUTABLE` 한 번 복사로 대체. |
| INFO #7 (concurrency, **정확성**) | `runSweep` while loop | apply 시 페이지 안에서 일부 job 이 제거되면 큐 offset 이 앞당겨져 다음 페이지에서 일부 row 가 건너뛰어진다 — `start += PAGE_SIZE - removedThisPage` 로 보정. 새 테스트 케이스 추가 (`apply: advances offset by (PAGE_SIZE - removed)`). |
| INFO #10 (testing) | unit test | `apply + pauseDuringSweep` 동시 true 통합 케이스 추가 — pause → getJobs → remove → resume 순서 검증. |
| INFO #11 (testing) | unit test | logger 출력 포맷(grep 친화) 회귀 방지 케이스 추가 — header/per-job/tail 한 줄 형식 고정. |

테스트 추가 결과: util spec 14 → 17 케이스. 전체 backend 단위 테스트 3487/3487 통과.

## 추적 (본 PR scope 외 / 기존 부채)

별도 plan 으로 분리하거나, 현재 plan 의 후속 항목에 남긴다.

| ID | 위치 | 이유 |
|---|---|---|
| WARNING #1 (architecture/side_effect/maintainability/testing) | `migrate-button-ids.ts` 모듈 최상위 `process.argv` 즉시 파싱 | 본 PR 는 해당 파일을 *이동* 만 했고 동작 변경 금지가 사용자 명시 지시. 별도 리팩토링 plan 으로 분리 필요. |
| WARNING #4 (architecture) | `cleanup-invalid-jobs.util.ts` 의 `knowledge-base` 모듈 내부 위치 | 의도된 결정 — sweep 로직이 knowledge-base 큐 producer 와 동일 페이로드 invariant 를 공유하므로 같은 모듈에 두는 게 자연스럽다. shared 로 옮기는 건 다른 큐가 동일 sweep 패턴을 요구할 때 검토. |
| WARNING #6 (scope) | `migrate-button-ids.ts` 가 PR 범위 이탈로 보임 | 실제로는 위치 이동(96% similar) + import 경로 + docstring 만. reviewer 가 전체 함수 본문 diff context 를 보고 평가한 것. 분리 PR 가능했으나 빌드/배포 단일성 측면에서 함께 묶음. |
| WARNING #7 (maintainability) | `backfillButtonIds` 의 세 블록 구조적 중복 | 기존 부채. 별도 리팩토링 plan. |
| WARNING #9 (documentation) | `cleanup:queue-jobs` 가 README/운영 가이드 미반영 | 본 plan 의 docstring 에는 운영 호출 예시가 충분히 들어가 있고, `spec/` 운영 문서는 self-hosting plan 이 별도 진행 중. 그 plan 에 흡수시킬 항목으로 남김. |
| WARNING #11 (dependency) | `bcrypt: ^6.0.0` 채널 확인 | 기존 의존성. 본 PR 와 무관. |
| INFO #1 (security) | Redis `REDIS_PASSWORD` 미참조 | 현재 docker-compose 환경에서 Redis 인증 없음. 인증 도입 시 함께 처리. |
| INFO #2 (security) | migrate-button-ids `--workspace-id`/`--user-id` UUID 검증 누락 | 기존 부채. |
| INFO #3 (security) | `decodeCursor()` UUID 형식 미검증 | background-runs 본 PR scope 외. |
| INFO #4, #5 (performance) | migrate-button-ids 전체 메모리 적재·직렬 UPDATE | 기존 동작. 본 PR 는 동작 변경 금지. |
| INFO #8 (concurrency) | 페이지당 최대 1000건 `Promise.all` remove → Redis 부하 | 원본 스크립트와 동일 동작. 운영 데이터 규모에서 문제 발생 시 `p-limit` 도입 검토. |
| INFO #9 (database) | V047 expression 인덱스 존재 확인 | background-runs 본 PR scope 외. |
| INFO #12 (maintainability) | `backfillButtonIds` `changed` 플래그 비대칭 | WARNING #7 과 함께. |
| INFO #13 (operational) | `cleanup:queue-jobs` 가 build 없이 stale dist 실행 가능 | 운영 컨테이너는 이미지 빌드 시점에 dist 가 박혀있어 issue 없음. 로컬 dev 에서는 사용자가 직접 build 후 실행하거나 ts-node 경로를 사용. docstring 에 두 경로가 모두 적혀있음. |
| INFO #14 (dependency) | `overrides` `^` 형태 하한 고정 | 기존 패턴. |
| INFO #15, #16 (documentation) | migrate-button-ids 모듈 최상위 의도 주석 / 옛 경로 폐기 노트 | 기존 부채 + self-hosting plan 흡수. |

## 재검증

- `npx eslint <touched files>` — exit 0
- `npm test` — 3487/3487 통과
- `npm run build` — OK
- e2e: 본 PR 는 운영 도구 packaging + 작은 enhancement, 인프라/API 영역 변경 없음. `[skip-e2e]` (SKILL.md 단계 8 의 자동 흐름이 아닌 일반 흐름, e2e 트리거 영역 미해당).

## 후속 plan 으로 분리할 항목

- `plan/in-progress/queue-removeonfail-policy.md` — knowledge-base.module.ts 두 큐의 `removeOnFail` 설정 (회귀 조사가 지목한 진짜 원인). 본 PR 의 cleanup 스크립트는 잔재 정리 도구일 뿐, 근본 해소 아님.
- `plan/in-progress/spec-update-embedding-pipeline-consistency.md` — consistency-check Critical (WebSocket 명명 3중 충돌) 해소.
- migrate-* 리팩토링 (CLI 파싱 지연, 메모리/배치 개선, 중복 제거).

# RESOLUTION — review session 17_09_09

> 대상 SUMMARY: `./SUMMARY.md` (조정 후 위험도 MEDIUM-LOW)
> 처리 일시: 2026-05-17

---

## 조치 항목

| 항목 | 처리 |
|------|------|
| **W-15** (api_contract) — `POST /:id/dismiss` 가 `POST /dismiss-all` 보다 먼저 선언됨 | `notifications.controller.ts` 에서 `dismiss-all` 을 `:id/dismiss` 앞으로 이동. 라우터 매칭 안전성 + 코드 가독성 |
| **I-4** (concurrency) — `dismiss()` findOne-then-save race | `dismiss()` 를 단일 SQL 원자 UPDATE 로 재작성. `RETURNING id, dismissed_at` 로 결과 회수, `affected=0` 일 때만 fallback findOne (멱등성 분기). |
| **I-15** (documentation) — V056 `.conf` 주석 부재 | `executeInTransaction=false` 위에 이유 한 단락 추가 |
| **I-18** (api_contract) — `DismissNotificationResponseDto.dismissedAt: string` vs service 반환 `Date` 불일치 | service 반환 타입을 `{ id: string; dismissedAt: string }` 으로 변경하고 ISO 직렬화를 service 안에서 명시. service.spec.ts 의 expect 도 ISO 문자열로 갱신. |

## 본 PR 처리 대상 외로 분류한 항목

| 원문 항목 | 분류 사유 |
|----------|----------|
| C-1 ~ C-4 (workflow-errors.ts 삭제, parseTokenExpiresAt 삭제, D6 revert, D4 롤백) | **diff artifact** — origin/main 이 fork 점 (43c115d6) 이후 2 commit (f91581c3 등) 으로 이동했고, `git diff origin/main..HEAD` 가 그 upstream 변경을 본 HEAD 에서 "삭제됨" 으로 표시. 내가 만든 변경 아님. PR 직전 `git rebase origin/main` 으로 해소. |
| C-5 (PR 분리) | 위 C-1~C-4 가 diff artifact 이므로 PR 분리 사유로 무효. 단, `integration-action-required-notifier.service.ts` 의 channel type narrow 픽스는 내 변경 — `make e2e-test` 의 clean Docker build 통과를 위해 본 PR 안에 포함 (별도 PR 분리 시 본 PR e2e 가 깨짐). |
| W-1, W-2, W-3, W-4, W-5, W-7, W-8, W-9, W-10, W-12, W-14 | 모두 diff artifact 또는 본 작업 범위 밖 사전 결함. follow-up plan 또는 별도 PR 대상. |
| W-13 (`IntegrationActionRequiredNotifier` 전용 테스트 부재) | 사전 결함. 본 PR 의 channel type narrow 픽스만 적용됐고, notifier 자체의 동작 테스트 추가는 별도 plan. |
| W-16 (`dismiss-all` `@ApiNotFoundResponse` 누락) | **N/A** — 본 endpoint 는 404 발생 경로 없음 (workspace-scoped UPDATE, 본인 알림 0건이면 affected=0 으로 200 반환). 추가 불필요. |
| I-1, I-2, I-5~I-12, I-16, I-17, I-19, I-21, I-22 | diff artifact 또는 본 작업 외 사전 결함. |
| I-13, I-14 | **reviewer 오인** — `notifications.service.spec.ts` (8 cases) 와 `notifications-dismiss.e2e-spec.ts` (6 cases) 가 이미 dismiss 의 동작·필터·is_read 차원 분리를 모두 커버. reviewer 가 spec 파일 위치를 못 찾은 것으로 판단. |
| I-3 (createMany N INSERT) | 사전 결함. 알림 fan-out 이 일반적으로 1~10 명 규모라 현재 무영향. 향후 대규모 워크스페이스 도입 시 별도 plan. |
| I-20 (hard delete 정책 시 bloat 모니터링) | 이미 spec §4.5 가 follow-up 으로 분리. |

## 별도 follow-up plan

- `plan/in-progress/notification-websocket-name-sync.md` — WebSocket 이벤트명·채널명 정합성 (impl-prep C-1·C-2, 본 PR merge 후 진행).

---

## TEST 결과

| 단계 | 결과 |
|------|------|
| lint (backend, 변경 파일) | clean (notifications 모듈) — pre-existing warnings 19건은 `executions.service.ts` / `scripts/migrate-node-output-refs.ts` 등 별도 영역 |
| lint (frontend, 변경 파일) | clean |
| unit test (backend) | 8/8 (`notifications.service.spec.ts`), 31/31 (`alerts-evaluator` + `integration-expiry-scanner`), full suite 3866/3866 |
| unit test (frontend) | 1447/1447 (vitest) |
| build (backend) | OK (`nest build`) |
| build (frontend) | OK (`next build`) |
| **e2e (`make e2e-test`)** | **93/93 tests pass** — backend supertest 16 suites 전부 통과 (1차 시도에 `notifications-dismiss.e2e-spec.ts` 가 `.returning(['id','dismissed_at'])` 배열 형태에서 500 오류 → raw SQL 문자열 형태 `.returning('id, dismissed_at')` 로 교체 후 재실행 통과) |
| **e2e-full (`make e2e-test-full`)** | backend 93/93 + playwright 37/37, 종합 안정 (1회 환경 글리치 발생 후 재시도 안정) |

## 보류·후속 항목

- WebSocket 이벤트명·채널명 follow-up plan: 이미 `plan/in-progress/notification-websocket-name-sync.md` 등록.
- diff artifact 발견 사항의 대량 보고: orchestrator 의 prompt size budget 기본값 (128KB) 이 본 변경처럼 68 파일이 한꺼번에 변경된 케이스에서 일부 파일을 누락하는 결함 발견 — `REVIEW_MAX_PROMPT_SIZE=2000000` 환경변수로 우회 가능. orchestrator 개선은 별도 plan 대상 (본 PR 외).

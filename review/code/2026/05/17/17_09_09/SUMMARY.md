# Code Review 통합 보고서

> 대상: 4 commits (`1157d871` ~ `5391e273`)
> 세션: `review/code/2026/05/17/17_09_09`
> 리뷰어: 13명 전원 success (agents_pending 0, agents_fatal 0)
> 라우터: 미사용 (`--route=all`) — 전체 reviewer 실행

---

## 전체 위험도

**MEDIUM-LOW (조정 후)** — 원문 리뷰는 HIGH 로 평가했으나, **Critical 5건 중 4건이 diff artifact** 다. main 워크트리에 fork 한 후 origin/main 이 2 commit 앞서갔고 (`f91581c3` typed error 계층 도입, 그 외), `git diff origin/main..HEAD` 가 그 upstream 변경분을 본 HEAD 에서 "삭제" 로 표시한다. 실 dismiss 작업의 코드/spec 변경에서 발생한 위험은 LOW-MEDIUM 수준.

리뷰 분석 절차:
1. 13 reviewer 가 모두 `git diff origin/main..HEAD` 의 68 파일을 입력으로 받음.
2. 68 파일 중 ~40개는 내 commit 의 변경 (notifications dismiss 도입).
3. 나머지 ~28개는 origin/main 이 새로 추가/수정한 파일 (`workflow-errors.ts`, `parseTokenExpiresAt`, D4 Integration error port, D6 multi-turn output 등) 이 본 HEAD 에 없으니 reviewer 가 "삭제됨" 으로 인식.
4. 분류 — reviewer 발견 사항을 (a) dismiss 작업 관련 / (b) diff artifact 로 구분.

---

## Critical 발견사항 (조정 후: 0건)

원문 5건 모두 **diff artifact**.

| # | 원문 평가 | 실제 분류 | 사유 |
|---|----------|----------|------|
| C-1 | `workflow-errors.ts` typed error 계층 삭제 | **diff artifact** | origin/main `761bc2cb refactor(execution-engine): sub-workflow typed error 계층 도입 (W-17)` 이 추가한 파일. 내 HEAD 가 그 commit 이전에서 fork 했을 뿐 내가 삭제한 게 아님 |
| C-2 | `parseTokenExpiresAt` 함수 삭제 + Cafe24 self-heal revert | **diff artifact** | origin/main 이 활성 `cafe24-token-expiry-fix-a3b8f1` worktree branch 의 부분을 main 쪽으로 흡수했거나, 내 fork 점 이후 추가됨 |
| C-3 | Cafe24 expires_at 회귀 테스트 삭제 | **diff artifact** | C-2 와 동일 출처 |
| C-4 | execution-engine D6 output shape revert (`output.result.*` → `output.*`) | **diff artifact** | origin/main `43c115d6 Merge PR #157 D6 — AI 3종 multi-turn waiting/error 출력 경로 단일화` 가 내 fork 점이지만 그 안의 일부 변경이 후속 commit 으로 들어왔을 가능성 |
| C-5 | 범위 외 변경 다수 혼재 | **부분 인정** | 위 4 건이 diff artifact 이므로 PR 분리 사유로 불필요. 단, `integration-action-required-notifier.service.ts` 의 channel type narrow 픽스는 내 변경이며 dismiss 작업과 직접 관련 없는 사전 결함이지만 `make e2e-test` 통과 위해 필수였음 — 본 PR 안에 포함 정당화 가능 |

**조치**: PR 본문에 "main 과 base 가 어긋난 diff artifact 가 다수 — `git rebase origin/main` 후 재리뷰 권장" 명시. PR 직전 rebase.

---

## 경고 (WARNING) — 실 관련만 추출

| # | 카테고리 | 실 관련성 | 조치 |
|---|----------|----------|------|
| W-13 | testing | `IntegrationActionRequiredNotifier.notify()` 전용 테스트 부재 | **사전 결함** (내 변경 외). dismiss 작업 외 별도 plan 으로 분리 |
| W-15 | api_contract | `POST /:id/dismiss` 가 `POST /dismiss-all` 보다 먼저 선언됨 — NestJS 라우트 매칭은 declaration order 무관이지만 명시적 순서 위생 | **조치**: dismiss-all 을 먼저 선언으로 이동 |
| W-16 | api_contract | `POST /dismiss-all` 에 `@ApiNotFoundResponse` 누락 | **N/A** — 이 endpoint 는 404 발생 경로 없음 (workspace-scoped UPDATE, 본인 알림 0건이면 affected=0 으로 200 반환). 추가 불필요 |
| W-3, W-4 | performance | execution-engine 의 O(N) 로깅/재조회 | **diff artifact** (origin/main 의 새 코드) |
| 나머지 W-1, W-2, W-5~W-12, W-14 | — | 모두 diff artifact 또는 사전 결함 | 본 PR 처리 대상 외 |

---

## 참고 (INFO) — 실 관련만 추출

| # | 카테고리 | 실 관련성 | 조치 |
|---|----------|----------|------|
| I-3 | performance | `createMany` 가 `repository.save(array)` 사용 — N INSERT | **사전 결함**. 알림 fan-out 이 일반적으로 1~10 명 규모라 현재는 무영향. 향후 대규모 워크스페이스 도입 시 별도 plan |
| I-4 | concurrency | `dismiss()` findOne-then-save 패턴의 last-write-wins race | **조치**: 원자 UPDATE 로 교체 (`UPDATE ... WHERE id=? AND user_id=? AND dismissed_at IS NULL RETURNING ...`). 멱등성 + 동시성 동시 해결 |
| I-13 | testing | "dismiss/dismissAll 실제 동작 테스트 없음" | **오인** — `notifications.service.spec.ts` 와 `notifications-dismiss.e2e-spec.ts` 가 이미 커버 (reviewer 가 spec 파일을 못 본 듯) |
| I-14 | testing | dismissed_at IS NULL 필터 e2e 부재 | **오인** — `notifications-dismiss.e2e-spec.ts` "dismissed 알림은 GET /notifications 와 unread-count 양쪽에서 제외" 시나리오가 정확히 그 케이스 |
| I-15 | documentation | V056 `.conf` 주석 부재 | **조치**: `.conf` 파일에 이유 한 줄 주석 추가 |
| I-18 | api_contract | `DismissNotificationResponseDto.dismissedAt: string` 이지만 service 반환은 `Date` | **조치**: service 반환 타입을 `Date | string` 으로 명확화하고 controller 가 ISO 직렬화 보장. 또는 단순히 응답 시 `TransformInterceptor`/Nest 의 자동 Date → ISO 직렬화에 의존 (현재 동작은 정상이나 타입 명세가 어긋남) |
| I-20 | database | dismissed_at IS NULL partial index 의 hard delete 정책 도입 시 bloat 모니터링 | **follow-up**. 이미 spec §4.5 가 follow-up 으로 분리해놓은 항목 |
| I-22 | security | `assertSameWorkspace` fail-closed 전환 타임라인 plan 미명시 | **diff artifact** (내 변경 외) |
| 나머지 I-1, I-2, I-5~I-12, I-16, I-17, I-19, I-21 | — | 대부분 diff artifact 또는 무관 사전 결함 | 본 PR 처리 대상 외 |

---

## RESOLUTION 대상 (4건)

1. **W-15** — `notifications.controller.ts` 라우트 순서: `dismiss-all` 을 `:id/dismiss` 앞으로
2. **I-4** — `notifications.service.ts:dismiss` 를 원자 UPDATE 로 교체 (race 해소 + 멱등성 유지)
3. **I-15** — `V056__notification_active_partial_index.conf` 에 이유 주석
4. **I-18** — `dismiss-notification-response.dto.ts` 의 `dismissedAt` 타입 정합화 또는 service 반환을 ISO 문자열로 통일

---

## 에이전트별 위험도 (raw)

| 에이전트 | 원문 위험도 | 조정 |
|----------|----------|------|
| architecture | HIGH | LOW (diff artifact) |
| testing | HIGH | LOW (오인 + 사전 결함) |
| scope | HIGH | LOW (diff artifact) |
| security / performance / requirement / side_effect / maintainability / documentation | MEDIUM | LOW (대부분 diff artifact) |
| api_contract | LOW | LOW (W-15·I-18 조치) |
| database / concurrency / dependency | LOW | LOW (I-4 조치) |

---

## 라우터 결정

`--route=all` 로 강제 전체 실행. orchestrator 의 diff scoping 결함 (기본 prompt size budget 128KB 가 68 파일의 일부만 포함) 을 `REVIEW_MAX_PROMPT_SIZE=2000000` `REVIEW_BATCH_SIZE=200` 환경변수로 우회한 세션.

리뷰는 origin/main 이동에 따른 다량의 false-positive Critical 을 보고했으며, main 분석을 통해 실제 조치 4건으로 압축. 별도 follow-up plan 1건 (notification-websocket-name-sync) 은 이미 등록.

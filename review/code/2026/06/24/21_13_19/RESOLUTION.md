# Review Resolution — 06-concurrency C-1+M-7 (publish fail-fast 통일)

리뷰 SUMMARY: `review/code/2026/06/24/21_13_19/SUMMARY.md`
**위험도 LOW · Critical 0 · Warning 2 · INFO 15.** 9 reviewer 전원 success, unfinished 없음.

## 반영 (Addressed)

| # | 카테고리 | 조치 |
| --- | --- | --- |
| W-1 | Maintainability | `executions.service.ts` stop() 503 throw 의 `code: '문자열'` → `code: ErrorCode.EXECUTION_ENQUEUE_FAILED` (enum 상수 참조 + `ErrorCode` import). 타입안전성·향후 리네임 누락 방지. 기존 단위 테스트는 enum 값과 동일 문자열을 assert 하므로 그대로 통과. |
| I-7 | Testing | `continuation-bus.service.spec.ts` M-7 테스트에 `expect(queueAdd).toHaveBeenCalledTimes(1)` 추가 — INCR 실패 시 enqueue 시도 생략을 명시 검증. |
| I-8 | Testing | `execution-engine.service.spec.ts` 에 `cancelWaitingExecution` publish null → `{queued:false, jobId:null}` 단위 케이스 추가 (C-1 fail 경로). |

## 보류 (Deferred — 근거 명시)

### sibling planner spec-sync 로 이관 (impl-first, merge-gate: 동행 머지 권장)
| # | 카테고리 | 사유 |
| --- | --- | --- |
| W-2 / I-1 | API 계약 / SPEC-DRIFT | REST `stop()` WAITING 503 동작이 `2-api-convention.md §6` 상태코드 표·spec 본문 미기술. **developer 는 spec read-only** — commit 메시지에 선언한 sibling planner spec-sync PR 이 §6 에 503 추가. C-1 spec 대조 = B(spec-silent)라 코드가 spec 을 위반하지 않음(누락 보강). |
| I-2 | SPEC-DRIFT | `EXECUTION_ENQUEUE_FAILED` 가 `3-error-handling.md §1` 카탈로그 미등재 (ErrorCode enum 등재는 코드로 완료). 카탈로그 narrative 는 planner. |
| I-3 | SPEC-DRIFT | `§7.5.2` "4종 continuation 핸들러" 목록에 cancel 미반영 — planner 가 "5종"/일반화. |
| I-4 | SPEC-DRIFT | M-7 INCR throw→null(queued:false) 인과가 `§7.4/§9.2` 미기술 — planner 1줄. |

### 무조치 (현행 유지 — 근거)
| # | 카테고리 | 사유 |
| --- | --- | --- |
| I-5 | Side-effect | `websocket.gateway.ts` 가 `cancelWaitingExecution` 을 **호출하지 않음**을 grep 으로 확인 (cancel 의 유일 경로 = REST `stop()`). 따라서 gateway 측 await/queued 처리 불필요. `websocket.gateway.spec.ts` 의 mock 은 미사용 stub 이나 타입 일관성 위해 `mockResolvedValue` 로 갱신함. |
| I-6 | Side-effect | INCR 실패 로그 레벨 warn→error 상향은 **의도된 변경** — 옛 random fallback 은 "복구됨"이라 warn 이 맞았으나, 이제 enqueue 가 실제 실패(null 반환)하므로 publish outer catch 의 error 가 정합. PR/RESOLUTION 에 명시(운영 알람 임계값 인지). |
| I-11 | Concurrency | INCR+EXPIRE 비원자성(EXPIRE 실패 시 키 영구 잔류 가능)은 **본 변경 범위 밖**의 기존 설계 — §9.2 가 sliding-window swallow 를 의도로 명시. Lua 원자화는 별도 선택사항. |
| I-12 | Concurrency | Redis Cluster 페일오버 시 seq 초기화 → 중복 seq 위험은 단일 인스턴스 전제 아키텍처에서 허용 범위(§9.2). 본 변경 무관. |
| I-13 | Security | 503 메시지 "continuation bus unavailable" 는 재시도 유도용 운영 힌트로, 시크릿·스택 미포함 — 리뷰도 "허용 범위 내" 판정. 일반화는 선택. |
| I-14 / I-15 | Maintainability | `nextSeq`/`stop()` 주석이 로직 대비 길다는 지적 — 본 변경은 **spec-coupled 계약 변경**(idempotency·503 surface)이라 rationale 주석의 정보가치가 높다고 판단해 유지. drift 시 주석도 함께 갱신 의무(이미 spec §참조 명시). |
| I-9 / I-10 | Testing | `stop()` findOne null 폴백·`acquireLock` Redis 장애 케이스 — 전자는 기존 `?? execution` 폴백(본 변경 무관), 후자는 `acquireLock`(본 변경 무관)이라 scope 밖. 별도 테스트 보강 백로그. |

## 재검증

review-fix(W-1 enum ref + I-7/I-8 테스트) 후 TEST: lint·build·unit 재수행 PASS (결과 커밋 반영).
e2e 는 W-1 이 값-동일 enum 참조 교체(동작 불변)이고 추가분은 unit 테스트라 런타임 동작 변화 없음 — 직전 e2e PASS(214) 유효.

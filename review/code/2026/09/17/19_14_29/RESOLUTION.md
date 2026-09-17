# RESOLUTION — `/ai-review` 2라운드 (MEDIUM · Critical 0 · Warning 7)

정지 규칙(1라운드 처분 때 plan 에 선언): Warning 만이면 동작 결함은 고치고, 동작 결함이 아니면서 고치면
라운드가 늘 형태는 developer SKILL §수렴 예외(a~d)를 인용해 `plan/` 등재로 갈음한다.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 `trigger.workflow_id` 인덱스 부재 | **등재(수렴 예외)** — 실측: `trigger` 인덱스는 `(workspace_id, type)` · `(workspace_id, endpoint_path)` UNIQUE · `notification_health` 부분 셋뿐이라 지적이 맞다. 다만 워크플로 삭제의 **FK CASCADE 가 이 PR 전부터 같은 컬럼으로 스캔**했다 — 요청당 스캔이 몇 번 늘 뿐 복잡도 계열은 그대로다. 잠금을 쥔 스캔의 대기는 W2 로 상한이 걸렸다. 인덱스는 마이그레이션과 `spec/1-data-model.md` 인덱스 표 행이 **함께** 가야 해 planner 몫이 섞인다 → 트래커 후속(성능)으로. (a) 동작 결함 아님 (b) 고치면 라운드 추가 (c) 이 표 (d) plan 체크리스트 | — |
| W2 부모 행 잠금에 `lock_timeout` 없음 | **수정** — 동작 결함(되돌릴 수 없는 외부 해제 뒤 무한 대기). `lockParentAndListTriggerIds` 를 트랜잭션 첫 호출로 계약하고 잠그기 전에 5초 상한. 워크스페이스는 열거를 재검사 앞으로. 뮤턴트 M21·M22 RED | `d2184dcf2` |
| W3 비밀 삭제 트리거당 순차 | **등재(수렴 예외)** — 성능. 트리거마다 실패를 개별 로그하려고 순차를 택했다. 부모 하나의 트리거 수가 작다는 가정은 실측이 아니므로 «가정» 으로 적어 성능 후속에 함께 넣는다 | — |
| W4 teardown·job 해제 순차 | **유지 + 등재** — provider 에 요청이 몰리지 않게 한 의도된 선택(JSDoc). 대량 삭제 지연이 트리거 수에 선형인 것은 사실이라 성능 후속에 함께 적는다 | — |
| W5 «잠금 → 삭제 → 실패 로그 → 재던짐» 안무가 4곳 | **등재(수렴 예외)** — 트래커 항목 1(`deleteTriggerRowLocked` 추출, «세 번째 호출부가 생길 때 뽑는다»)의 **조건이 이 PR 로 충족됐다**. 네 자리의 상태·메시지가 달라(트리거 5초 락 · 스케줄 BullMQ · 부모 트랜잭션) 공용 헬퍼는 설계가 필요하다 — 그 항목을 갱신한다 | — |
| W6 스냅샷 ↔ 잠금 열거 시차(1라운드 #3 재확인) | 처분 유지 — sweeper 재판단 항목에 시나리오로(plan 체크리스트, 종결 때 트래커로) | — |
| W7 SPEC-DRIFT | planner 후속(plan 체크리스트에 1라운드부터 예약) | — |
| INFO 1 워크스페이스 역할 변경 창 | 1라운드 처분 유지(가시화·테스트) | — |
| INFO 2 ModuleRef 로케이터 | planner 후속(`4-execution-engine.md §4.4` 표) | — |
| INFO 3 plan 안 단위 건수 9,746 vs 9,747 | plan 에 측정 시점을 붙여 정정 | (docs 커밋) |
| INFO 4 다중 실패 메시지 · `releaseExternal` 직접 테스트 | 다중 실패 테스트 **추가**. `releaseExternal` 은 `releaseExternalMany` 한 줄 위임이고 `TriggersService.remove` 순서 테스트가 통과 경로로 문다 — 유지 | `d2184dcf2` |
| INFO 5 테스트 provider 복제 · binder 클로저 수 · 파일명 유사 · if/else | 유지 — 1라운드와 같은 판단 | — |
| INFO 6 부모 부재 미확인 · 이중 잠금 | 1라운드 처분 유지 | — |
| INFO 7 `releaseExternalForParent` 전체 컬럼 적재 | 성능 후속에 함께 | — |
| INFO 8 로그 접두 변경이 외부 로그 규칙을 끊을 수 있음 | PR 본문에 명시 | — |

## TEST 결과

- lint: 통과
- unit: 통과 — backend jest 9,756
- build: 통과 + 타입 ratchet baseline 일치(197건 / 36파일)
- e2e: 통과 — backend 321(`trigger-deletion-releases-resources.e2e-spec.ts` 포함) + playwright 51

## 보류·후속 항목

plan 체크리스트 «트래커 반영» 으로 종결 때 옮긴다: **성능 후속**(`trigger.workflow_id` 인덱스 + 인덱스 표 행 ·
비밀 삭제 순차 · teardown 순차 · 전체 컬럼 적재) · **트래커 항목 1 갱신**(안무 4곳, 추출 조건 충족).

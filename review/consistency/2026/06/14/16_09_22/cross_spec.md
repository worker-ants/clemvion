# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
Target scope: `spec/2-navigation/6-config.md` (§A.3 호출 이력 — 소스 IP·응답 코드·기간별 호출 수)
Diff base: `origin/main`

---

## 발견사항

### [WARNING] webhook spec §7 flow step 8b — execute() 3번째 인자가 구버전 서명
- **target 위치**: 구현 변경 (`hooks.service.ts`) — execute() 호출 시 `{ triggerId, sourceIp, responseCode }` 전달
- **충돌 대상**: `spec/5-system/12-webhook.md` §7 수신 흐름 step 8b (line 352)
  ```
  ExecutionEngineService.execute(trigger.workflowId, ..., { triggerId: trigger.id })
  ```
  해당 spec 라인은 `sourceIp`·`responseCode` 없는 구버전 인자 형태를 기술하고 있다.
  Chat Channel 분기(step 7)도 동일하게 `sourceIp`/`responseCode` 가 누락된 상태.
- **상세**: 코드는 `{ triggerId, sourceIp, responseCode }` 를 전달하도록 변경됐고 테스트도 이 서명을 검증하지만, webhook spec 의 흐름 기술은 `{ triggerId: trigger.id }` 만 기록한다. 새로 spec 을 읽는 개발자가 3번째 인자의 실제 형태를 spec 에서 파악할 수 없다.
- **제안**: `spec/5-system/12-webhook.md` §7 step 8b·7e 의 execute() 인자를 `{ triggerId: trigger.id, sourceIp, responseCode }` 로 갱신. §A.3 구현 참조(R-6)를 footnote 로 추가.

---

### [INFO] data-model §3 인덱스 목록에 `idx_execution_trigger_started` 미등록
- **target 위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` — `CREATE INDEX idx_execution_trigger_started ON execution (trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL`
- **충돌 대상**: `spec/1-data-model.md` §3 인덱스 목록 (lines 795–833)
  해당 표에는 `Execution` 엔티티에 대해 `(workflow_id, started_at DESC)` / `(status)` / `(re_run_of)` / `(chain_id, started_at)` 4건만 등록되어 있다. V096 이 추가한 `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` 인덱스는 미기재.
- **상세**: 인덱스 표의 누락이 기능 작동을 막지는 않지만, spec 인덱스 목록이 불완전한 상태가 된다. 향후 DB 스키마 변경 시 해당 인덱스를 중복 추가하거나 최적화 기회를 놓칠 수 있다.
- **제안**: `spec/1-data-model.md` §3 인덱스 표 `Execution` 행에 아래 항목 추가.
  ```
  | Execution | (trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL | §A.3 getUsage 기간 집계·recentCalls 쿼리 지원 — trigger_id NULL(schedule/manual) 제외 부분 인덱스. idx_execution_trigger_started. V096 |
  ```

---

## 요약

구현 변경은 `spec/2-navigation/6-config.md §A.3`(R-6), `spec/1-data-model.md §2.13`(V096 컬럼·AuthConfig 호출 집계 SoT callout)과 **일관된다**. 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 충돌은 발견되지 않았다. 다만 `spec/5-system/12-webhook.md` §7 수신 흐름이 execute() 의 3번째 인자 형태를 구버전(`{ triggerId }` 전용)으로 기술하고 있어 spec 과 코드 사이 동기화 갭이 존재(WARNING). 아울러 V096 이 생성한 `idx_execution_trigger_started` 인덱스가 data model §3 인덱스 목록에 미등록된 사소한 누락(INFO)이 있다. 두 항목 모두 spec 갱신으로 해소 가능하며, 구현 자체가 동작 불가한 모순은 없다.

---

## 위험도

LOW

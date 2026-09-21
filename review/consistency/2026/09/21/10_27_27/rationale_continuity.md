# Rationale 연속성 검토 — spec/2-navigation (--impl-prep)

## 대상 요약

이번 검토는 `plan/in-progress/integration-dup-delete.md` (developer, `IntegrationsService.remove()` 의
동시 DELETE 감사 행 중복 수정 — `spec_impact: none`) 착수 전 `spec/2-navigation` 스코프 impl-prep 이다.
번들에는 `1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 전문과, `4-integration.md` 는
컨텍스트 예산 초과로 본문이 생략되어 있어 관련 절(§7 사용처 추적·삭제 차단, §9.1 CRUD, Rationale
"BullMQ `cafe24-token-refresh` 큐" 등)은 저장소에서 직접 `Read`/`grep` 으로 확인했다.

## 발견사항

### [INFO] 계획된 구현이 참조하는 "기각된 advisory lock" 은 범위가 다른 결정 — 재도입 아님

- target 위치: `plan/in-progress/integration-dup-delete.md` §B (`IntegrationsService.remove()` 처방 —
  "락을 새로 들이지 않고 단일 원자적 `DELETE` 의 `affected` 를 판별자로 쓴다")
- 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ `cafe24-token-refresh`
  큐 — 멀티 인스턴스 race 해소" 절의 "검토 후 배제한 대안 — PostgreSQL advisory lock
  (`pg_advisory_xact_lock(hashtext(integrationId))`)" (기각 사유: *"lock 보유 중 HTTP 요청(Cafe24
  endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고..."*)
- 상세: 이미 병합된 `ae4fbc374`(rotate 동시성 수정) 커밋 메시지가 스스로 "`4-integration.md` Rationale
  이 기각한 advisory lock 의 재도입이 아니다" 라고 명시했을 만큼, 이 기각 조항은 이 코드베이스에서
  재확인 대상이 되어 왔다. 확인 결과 이번 plan 은 advisory lock 을 아예 들이지 않는 방향(원자적
  `DELETE` 문 자체의 단일 행 보장)이라 그 기각된 대안을 다시 채택하는 것이 아니다. 또한 그 기각의
  근거("lock 보유 중 외부 HTTP 호출을 트랜잭션에 묶는 비용")는 `cafe24-token-refresh` 큐의 refresh
  호출처럼 **외부 HTTP 왕복이 개입하는 경로**에 국한된 것이고, `remove()` 는 사용처 검사(DB 쿼리)만
  하고 외부 호출이 없으므로 애초에 그 트레이드오프가 적용되는 상황도 아니다.
- 제안: 조치 불요. 다만 구현 커밋 메시지에 "advisory lock 미도입은 4-integration.md 기각 사유(HTTP
  in-lock)의 재확인이 아니라 그 사유가 애초에 적용되지 않는 경로라서" 정도의 한 줄을 남기면, 이후
  이 모듈을 만지는 사람이 "형제 셋(workflow/trigger/schedule)은 lock 을 쓰는데 왜 integration 만
  안 쓰나" 를 다시 묻는 것을 예방할 수 있다(§B 자체에 이미 이유가 있으나 4-integration.md 쪽 기각
  조항과의 연결은 plan 문서에 없다).

### [INFO] `affected === 0` 명시 비교 판정은 형제 PR·트래커가 이미 못박은 패턴 — 계획대로면 이탈 없음

- target 위치: `plan/in-progress/integration-dup-delete.md` §B "판정은 `affected === 0` **명시 비교**다"
- 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` L4793-4801 (해당 항목이
  이미 이 처방—"원자적 `delete({ id, workspaceId })` 의 `affected` 를 판정자로 쓰면 락 없이 닫힌다",
  "TOCTOU 는 별개 사안이라 함께 닫으려 하지 말 것"—을 정확히 등재해 두었다), `fc5ea6b76`(schedules
  수정 커밋 메시지: "`null`·`undefined`(드라이버 미보고)를 «없다» 로 읽지 않는다")
- 상세: 이번 plan 은 트래커에 이미 등재된 처방과 문구까지 거의 동일하다 — 새 결정이 아니라 기존
  합의를 그대로 실행하는 턴이다. TOCTOU 를 별도 사안으로 미룬 것도 트래커 원문과 일치한다.
  Rationale 연속성 관점에서 이탈 없음.
- 제안: 없음(정보 제공용 확인).

### [INFO] Integration.credentials 는 `secret://` ref 구조가 아니므로 트리거식 "외부 정리 후 커밋 후 비밀 삭제" 순서가 적용 대상이 아님

- target 위치: `plan/in-progress/integration-dup-delete.md` §B (외부 자원 정리 순서를 다루지 않음)
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.3 "트리거 행을 없애는 모든 경로는 그
  트리거의 자원을 정리한다" (2026-09-17 결정 — `secret://triggers/<id>/` 비밀은 행 삭제 커밋 **뒤**
  삭제) vs `spec/1-data-model.md` §710 "`AuthConfig.config` 는 §2.10 `Integration.credentials` 와
  동일한 `ENCRYPTION_KEY`·AES-256-GCM transformer 를 공유한다. `secret://` URI scheme 은 trigger ref
  슬롯 전용이며 AuthConfig 는 자체 테이블 컬럼 transformer 라 본 scheme 을 사용하지 않는다"
- 상세: 트리거 삭제 Rationale 이 요구하는 "행 삭제 전 외부 해제 / 커밋 후 비밀 삭제"라는 정교한 2단계
  순서는 `secret_store` ref 슬롯이 행과 분리된 자원이기 때문에 필요했다. `Integration.credentials`
  는 컬럼 자체가 암호화되어 행에 인라인 저장되므로, 행이 원자적으로 지워지면 credentials 도 함께
  사라진다 — 트리거식 순서를 이번 fix 에 요구하는 것은 **잘못된 유추(암묵적 가정 오적용)** 가 된다.
  plan 이 이 순서를 다루지 않은 것은 결함이 아니라 두 자원 모델의 차이를 올바르게 반영한 것으로
  보인다.
- 제안: 조치 불요. 검토자에게 남기는 확인 메모.

### [INFO] "동시 삭제 → 두 번째 요청 404" 서술 공백은 이미 별도로 추적 중 — 이번 PR 로 새로 생기는 갭 아님

- target 위치: `spec/2-navigation/4-integration.md` §9.1 DELETE 행(현재 동시성 결과 코드에 대한
  서술 없음)
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.4 "동시 삭제: 두 클라이언트가 동시에 같은
  트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" / `plan/in-progress/
  spec-draft-nullable-notation-followups.md` L4813-4818 (이미 "`1-workflow-list.md` §2.6 ·
  `data-flow/12-workspace.md` §1.10 · `3-schedule.md` §4 에 «동시 삭제 → 두 번째 404» 서술이 없다"
  를 planner 낮음-우선순위 항목으로 등재, "`--impl-prep` 부터 세 라운드 연속 비차단으로 처분")
- 상세: 이 plan 이 구현되면 `4-integration.md` §9.1 DELETE 행도 트리거와 동일하게 "두 번째 요청은
  404" 로 동작이 바뀐다(현재는 `[204, 204]`). 이는 이미 알려진 문서 공백 패턴(§2.6/§1.10/§4 계열)에
  통합 축이 하나 더 늘어나는 것뿐이며, 이번 plan 이 새로 만드는 위반은 아니다. 다만 tracker L4813
  항목 갱신 시 통합 축도 함께 나열해 두면 나중에 일괄 정비할 때 누락을 막을 수 있다.
- 제안: 이번 developer PR 자체의 blocking 사유는 아님(spec_impact: none 과 정합). 완료 후 트래커
  L4813 항목(또는 새 항목)에 `4-integration.md §9.1 DELETE` 를 목록에 추가하는 것을 권고.

## 요약

`plan/in-progress/integration-dup-delete.md` 가 제시한 처방(advisory lock 미도입 + 원자적 `DELETE`
의 `affected === 0` 명시 판정 + TOCTOU 분리 유보)은 `spec/2-navigation/4-integration.md` 의
`## Rationale` 이 기각한 대안(HTTP 호출을 트랜잭션에 묶는 advisory lock)을 재도입하지 않으며, 오히려
그 기각의 적용 범위(외부 HTTP 왕복이 있는 경로)를 정확히 존중해 다른 경로(단순 DB 삭제)에는 다른
처방을 쓰는 결정이다. 이 처방은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
가 사전에 등재해 둔 내용과 문구 수준까지 일치하고, 형제 PR(workflow #1369 · trigger #1370 ·
schedule #1371)이 확립한 "명시적 discriminator 비교" 원칙도 그대로 따른다. Integration.credentials
가 트리거의 `secret://` ref 구조와 다른 인라인 암호화 컬럼이라는 점도 트리거식 2단계 정리 순서를
요구하지 않는 이유를 뒷받침한다. 유일하게 남는 것은 "동시 삭제 → 두 번째 404" 계약을 스펙 문서에
명시하는 문제인데, 이는 이미 별도로 추적 중인 낮은 우선순위 문서 공백이며 이번 PR 이 새로 만든
문제가 아니다. Rationale 연속성 관점에서 차단 사유를 발견하지 못했다.

## 위험도

NONE

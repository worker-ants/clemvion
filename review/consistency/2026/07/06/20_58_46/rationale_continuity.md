# Rationale 연속성 검토 — spec/data-flow/8-notifications.md (알림 파이프라인 후속 하드닝 3건)

검토 모드: --impl-prep (구현 착수 전)
Target: `spec/data-flow/8-notifications.md` 계획된 구현 3건 (background_failed 딥링크 resource_id 분리, execution_failed e2e 추가, dispatchEmails decouple 검토 보류)

## 발견사항

- **[INFO]** 항목 1 은 "선존 결함(pre-existing bug)" 정정이지 과거 Rationale 의 번복이 아님 — 근거 명시 보강 제안
  - target 위치: target 문서 "항목 1 — background_failed 딥링크 resource_id 미스매치 수정"
  - 과거 결정 출처: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:169-174` 의 `resourceType = hasRunId ? 'background_run' : 'execution'` (도입 커밋 `a4588e90a`, 2026-05-15) — 당시 목적은 오직 Background 모니터링 API (`background-runs.service.ts:395-414`, `GET .../background-runs/:id`) 의 `findByResource('background_run', backgroundRunId)` 정확 매칭이었고, 딥링크 라우팅(`href.ts`/`_layout.md §3.1`)과의 상호작용은 그 시점 spec/커밋 diff 에 전혀 언급되지 않음.
  - 상세: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md:20` (2026-07-06, developer 작성, PR3 완료 커밋 `7eabf1d73`) 이 이미 "background_failed 는 §5.1 표 밖이라 in_app 유지, resource_id=backgroundRunId 딥링크 미스매치는 **선존 결함** — 본 PR 범위 밖"이라고 명시적으로 스코프 아웃했다. target 의 항목 1 은 그 스코프 아웃된 결함을 다음 슬라이스에서 해소하는 것으로, "기각된 대안의 재도입"이 아니라 오히려 "이미 인지된 미해결 결함의 정식 후속 조치"다. `execution_failed`/`schedule_failed` 가 이미 `resource_type='workflow'`로 정정된 전례(같은 plan 파일, "impl-done cross_spec CRITICAL 로 해소됨")와 정확히 같은 패턴을 `background_failed` 에도 적용하는 것이라 원칙과도 정합적이다.
  - 제안: target 의 항목 1 텍스트에 "이 결함은 `spec-sync-data-flow-8-notifications-gaps.md`(PR3)에서 이미 스코프 아웃 기록된 선존 결함의 후속 해소"라는 출처 한 줄을 명시하면, 이후 리뷰어가 "왜 이제 와서 이 결함을 건드리는가"를 재추적할 필요 없이 계보가 바로 확인된다. (Critical/Warning 아님 — 이미 실질적으로 정합적인 정정이므로 문서 상 출처 명시만 보강하면 충분.)

- **[WARNING]** legacy `execution` resource_type fallback 제거가 새 Rationale 없이 계획됨
  - target 위치: target 문서 "항목 1" 세 번째 sub-bullet "legacy `execution` fallback 제거"
  - 과거 결정 출처: `background-execution.processor.ts:169-171` 주석 — "backgroundRunId 가 빈 문자열이면 (옛 NodeExecution) execution 로 fallback — **옛 데이터 호환**." 이는 명시적으로 하위호환을 의도한 설계 결정이다 (도입 커밋 `a4588e90a` 커밋 메시지에도 "옛 NodeExecution 대비 빈 문자열 fallback (관측 attribution 만 영향)"로 재확인됨).
  - 상세: target 은 이 legacy fallback 을 "제거"한다고만 적었을 뿐, (a) 제거해도 안전한 이유(예: 해당 옛 NodeExecution 이 더 이상 존재하지 않거나 접근 경로가 없다는 근거), (b) 제거 시 옛 데이터에 대한 attribution 이 어떻게 되는지(조용히 attribution 실패? 여전히 execution fallback 유지하되 딥링크만 workflow 로 분리?)에 대한 새 Rationale 을 계획하고 있지 않다. §Rationale 연속성 관점 3 ("결정의 무근거 번복")에 해당 — 과거에 의도적으로 도입한 하위호환 분기를 뒤집으면서 그 사유를 새로 기록하지 않으면, 이후 "왜 옛 데이터 호환을 포기했는가"를 추적할 수 없다.
  - 제안: 항목 1 의 spec-update 위임 범위에 "legacy `execution` fallback 제거 근거"를 Rationale 항목으로 명시적으로 추가하도록 planner 위임 문구를 보강한다. 예: "이 fallback 은 V047 인덱스 도입(2026-05-15) 이전 데이터만 대상이었고, 현재 그 시점 이전 미해결 `background_failed` 알림은 없다/보존 정책상 만료되었다" 같은 근거, 또는 fallback 자체는 유지하되 fallback 경로에서도 `resource_type='workflow'`(딥링크용)로 통일하는 대안 검토.

- **[INFO]** 항목 3 (dispatchEmails await 인라인 decouple) 은 기존 Rationale 미비 상태의 최초 명문화 — 번복 아님
  - target 위치: target 문서 "항목 3 — dispatchEmails await 인라인 decouple 검토"
  - 과거 결정 출처: 없음. `spec/data-flow/8-notifications.md` 현재 Rationale 절(§206-327)에는 `dispatchEmails` 의 호출 방식(await inline vs decoupled)에 대한 기존 결정이 존재하지 않는다 — `notifications.service.ts:290,331` 의 `await this.dispatchEmails(...)` 호출부에도 이를 설명하는 근거 문서가 없다.
  - 상세: target 이 스스로 "결정을 spec Rationale 로 문서화(planner 위임)"이라고 명시하고 있어, 이는 §3 "결정의 무근거 번복" 리스크를 이미 인지하고 새 Rationale 작성을 계획에 포함한 바람직한 패턴이다. 문제 없음 — 참고로 기록.
  - 제안: 없음 (모범 사례로 유지).

- **[INFO]** 새 컬럼 `background_run_id` 도입은 기존 스키마 원칙(§Rationale "가상 필터값" 등에서 보인 "영속 상태 오염 없이 필드 분리" 원칙)과 정합
  - target 위치: target 문서 "항목 1" 두 번째 sub-bullet "신규 nullable 컬럼 `notification.background_run_id`"
  - 과거 결정 출처: `spec/1-data-model.md §2.19` (Notification 엔티티) — `resource_type`/`resource_id` 를 범용 다형 FK 로 사용하는 기존 패턴. 유사 원칙은 `spec/2-navigation/4-integration.md` Rationale "Attention 가상 필터값" 의 "DB 엔티티 비확장 — 영속 상태와 화면 필터링용 술어를 분리" 원칙과도 정신적으로 유사(다만 그건 필터 값 얘기고 본 건은 컬럼 분리라 직접 적용 대상은 아님).
  - 상세: target 의 "딥링크 요구(workflow id)와 attribution 요구(backgroundRunId)를 별도 컬럼으로 분리"하는 설계는 기존 `resource_type`/`resource_id` 다형 컬럼의 의미(관련 리소스 식별)를 유지하면서 attribution 전용 관심사를 분리하는 것으로, 기존 데이터 모델 원칙과 충돌하지 않는다. `1-data-model.md §2.19`, `notification.entity.ts` 갱신 계획도 target 에 명시되어 있어 절차상 누락이 없다.
  - 제안: 없음. 다만 §2.1 Schema 매핑 표의 인덱스 설계(`WHERE background_run_id IS NOT NULL` 부분 인덱스)가 기존 `(user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL` 부분 인덱스 패턴과 명명·근거 스타일을 맞추도록 spec-update 시 유의.

## 요약

target 문서(알림 파이프라인 후속 하드닝 3건)는 과거 spec Rationale 이 명시적으로 기각한 대안을 재도입하거나 합의된 설계 원칙을 위반하는 지점은 발견되지 않았다. 항목 1(resource_id 분리)은 오히려 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 에 이미 "선존 결함·범위 밖"으로 명시적으로 기록되어 있던 것을 정식으로 해소하는 후속 조치이며, `execution_failed`/`schedule_failed` 에 이미 적용된 "resource_type=workflow" 패턴을 `background_failed` 에도 일관 적용하는 것이라 기존 원칙과 정합적이다. 유일한 주의 지점은 legacy `execution` fallback(옛 데이터 호환 목적으로 명시적으로 도입됐던 분기) 제거가 그 근거를 새 Rationale 로 남기지 않은 채 계획되어 있다는 점 — 결정 번복 자체는 합리적으로 보이나 "무근거 번복" 리스크를 줄이기 위해 제거 근거를 spec-update 위임 범위에 명시적으로 포함시킬 것을 권고한다. 항목 2(e2e 추가)·항목 3(dispatchEmails Rationale 신설)은 연속성 문제가 없다.

## 위험도

LOW

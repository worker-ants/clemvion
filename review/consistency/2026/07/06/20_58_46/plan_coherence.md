### 발견사항

- **[INFO]** `background_failed` §1.1 행의 resource_type/id 서술 갱신 여부 미명시
  - target 위치: target payload "항목 1" (background_failed 딥링크 resource_id 미스매치 수정)
  - 관련 plan: `plan/in-progress/notif-hardening-followups.md` 항목 1
  - 상세: target/plan 모두 §2.1(Schema 매핑)·§2.19(데이터 모델)에 신규 컬럼(`background_run_id`) 문서화를 planner 위임한다고 명시했으나, `spec/data-flow/8-notifications.md` §1.1 표의 `background_failed` 행(현재 resource_type/id 방식을 서술하지 않고 "수신자" 정보만 기재, line 67) 갱신 여부는 명시돼 있지 않다. `execution_failed`/`schedule_failed` 행(line 71-72)은 이미 `resource_type='workflow' / resource_id=workflow.id` 를 명문화한 선례가 있어, `background_failed` 행도 정합성을 위해 유사하게 attribution 방식(신규 `background_run_id` 컬럼 사용)을 명시하는 편이 대칭적이다. 다만 코드 동작 자체에는 영향 없는 문서 서술 갭이라 낮은 등급.
  - 제안: spec-update 위임 시 planner 가 §1.1 `background_failed` 행에도 attribution 방식(신규 컬럼) 한 줄 추가하는 것을 작업 범위에 포함시키면 완전.

- **[INFO]** `team_invite` 미해결 결정과의 경계 확인 (충돌 없음, 참고용)
  - target 위치: target payload에는 미언급 (항목 1/2/3 범위 밖)
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md` "team_invite 이메일 2통" OPEN 항목
  - 상세: target 은 항목 1(background_failed)·항목 2(execution_failed e2e)·항목 3(dispatchEmails decouple 보류)만 다루며 `team_invite` 채널 정책에는 손대지 않는다. `spec-update-notifications-firing.md` 의 미해결 결정(2통 이메일 UX)과 target 사이에 충돌 없음 — 서로 다른 관심사로 명확히 분리돼 있다.

## 정합성 확인 결과 (문제 없음)

- target 의 "항목 1" 은 `plan/in-progress/notif-hardening-followups.md` §항목 1 과 문구·설계(별도 컬럼 분리, option b 기각 사유, 마이그레이션 신설, `execution`/`executionId` fallback 제거)가 정확히 일치한다. 코드 실측(`background-execution.processor.ts` line 169-185)도 target 이 "현행" 으로 서술한 `resource_type='background_run'`/`resource_id=backgroundRunId`(fallback `execution`/`executionId`) 로직과 일치 — target 의 문제 진단이 정확하다.
- target 의 "항목 2"(execution_failed 통합 e2e)·"항목 3"(dispatchEmails decouple 보류)도 `notif-hardening-followups.md` 의 동일 항목과 완전히 일치하며 새로운 결정을 추가하지 않는다.
- 선행 plan `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` (PR1~3 tracker) 는 이미 `execution_failed`/`schedule_failed`/`team_invite`/WS emit/이메일 발송 모두 완료(`[x]`) 상태이며, `background_failed` resource_id 미스매치는 "선존 결함 — 범위 밖" 으로 명시적으로 이월해 두었다 — target 이 정확히 그 이월 항목을 이어받아 처리하는 구조로, 선행 plan 미해소 문제 없음.
- `plan/in-progress/spec-update-notifications-firing.md` 의 결정 사항(resource_type='workflow' 정정, 채널 both 정합)은 이미 spec §1.1 execution_failed/schedule_failed 행에 반영 완료된 상태이며 target 과 충돌하지 않는다. 유일한 OPEN 항목(team_invite 2통)은 target 범위 밖으로 명확히 분리.
- 미해결 결정을 target 이 일방적으로 우회하는 사례는 발견되지 않음. background_run_id 마이그레이션과 `spec-sync-user-profile-gaps.md` 의 별도 notification-settings 마이그레이션 계획은 서로 다른 목적/테이블이라 실질 충돌 없음.

### 요약
target(`spec/data-flow/8-notifications.md` 대상 알림 파이프라인 후속 하드닝 3건)은 이를 낳은 근거 plan `plan/in-progress/notif-hardening-followups.md` 와 완전히 정합하며, PR1~3 tracker(`spec-sync-data-flow-8-notifications-gaps.md`)가 명시적으로 이월한 "선존 결함"을 정확히 이어받아 처리하는 구조다. `spec-update-notifications-firing.md` 의 기존 결정(resource_type='workflow' 정정)과도 모순 없이 일관되며, 유일한 미해결 항목(team_invite 이메일 2통)은 target 범위 밖으로 명확히 분리돼 있어 우회 문제가 없다. 발견된 유일한 갭은 §1.1 `background_failed` 행의 attribution 방식 문서화 여부가 명시적으로 언급되지 않은 INFO 수준 누락이며, 구현 착수를 막을 사유는 아니다.

### 위험도
LOW

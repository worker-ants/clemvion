# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`, scope=`spec/`, diff-base=`origin/main`
검토 대상: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`
검토 기준: 다른 `spec/**` 영역과의 직접 모순·잠재 충돌·명명 비일관성

---

## 발견사항

### 1. **[WARNING]** NAV-WF-02 — PRD 와 상세 spec 간 표시 필드 불일치

- **target 위치**: `spec/2-navigation/1-workflow-list.md §2.1`
- **충돌 대상**: `spec/2-navigation/_product-overview.md §3.1 NAV-WF-02`
- **상세**: PRD(`_product-overview.md`)의 NAV-WF-02는 "워크플로우 이름, 상태(활성/비활성), **마지막 실행 시간**, 생성일 표시"를 필수 요구사항으로 명시하고 `✅`(구현 완료)로 마킹되어 있다. 그러나 상세 spec(`1-workflow-list.md §2.1`)은 "마지막 *수정*(`updatedAt`) 기준"이라고 명시하고, "미구현(Planned): 마지막 *실행* 시각 컬럼은 아직 없다"고 적어 PRD의 `✅` 와 충돌한다. PRD 는 구현 완료로 표시되어 있으나 실제로는 `updatedAt`(수정 시각)이 구현되어 있고 `lastRunAt`(마지막 실행 시각)는 구현되어 있지 않다.
- **제안**: `_product-overview.md` NAV-WF-02 를 실제 구현(수정 시각 열 + 마지막 실행 시각 미구현)에 맞게 상태를 `🚧`로 수정하거나, 요구사항 원문에서 "마지막 실행 시간"을 "마지막 수정 시간"으로 정정하고 마지막 실행 시각을 별도 NAV-WF 항목으로 분리한다.

---

### 2. **[WARNING]** 알림 유형 목록 — data model vs user-profile spec 불일치

- **target 위치**: `spec/1-data-model.md §2.19 Notification.type`
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §5.1`
- **상세**: `1-data-model.md`의 `Notification.type` enum은 `execution_failed / background_failed / schedule_failed / integration_expired / integration_action_required / marketplace_update / team_invite` 7종을 정의한다. 반면 `9-user-profile.md §5.1`의 알림 유형별 채널 표는 "워크플로우 실행 실패 / 스케줄 실행 실패 / Integration 만료 / 마켓플레이스 업데이트 / 팀 초대" 5종만 나열하며 `background_failed`(Background 실행 실패)와 `integration_action_required`(통합 장애 능동 알림) 두 유형이 빠져 있다. 사용자 설정 UI 설계 기반으로서 데이터 모델의 전체 enum 을 반영하지 못한다.
- **제안**: `9-user-profile.md §5.1` 표에 `background_failed`(Background 실행 실패)와 `integration_action_required`(통합 장애 알림) 행을 추가하여 data model SoT 와 동기화한다.

---

### 3. **[INFO]** dashboard spec의 recent-executions trigger 출처 분류 — 참조 방향만 있고 chat_channel 케이스 미언급

- **target 위치**: `spec/2-navigation/0-dashboard.md §5`
- **충돌 대상**: `spec/2-navigation/14-execution-history.md §2.4 Trigger 출처 분류`
- **상세**: `0-dashboard.md §5`는 트리거 출처를 `subworkflow/manual/schedule/webhook/unknown` 5종으로 열거하고, 분류 규칙은 `14-execution-history.md` 를 참조하도록 위임한다. `14-execution-history.md §2.4`의 출처 분류 표도 동일한 5종이다. `spec/1-data-model.md §2.8`에서 chat_channel 은 `webhook` 트리거의 `config.chatChannel` 변형으로 정의되어 있고 별도 Trigger.type 이 아니므로, 현행 5종 분류 안에서 `webhook` 에 포함되어 처리된다. 명시적 불일치는 없으나, chat_channel 케이스가 execution history / dashboard 의 트리거 라벨에서 어떻게 표시되는지(단순 "Webhook"인지, "Chat Channel"인지)는 어느 spec 에서도 기술되어 있지 않다.
- **제안**: `14-execution-history.md §2.4` 출처 분류 표에 chat_channel 변형의 라벨 처리 방침(예: `Trigger.config.chatChannel` 존재 시 보조 라벨에 채널명 표시 여부)을 INFO 수준으로 명시하여 향후 구현 혼선을 예방한다.

---

### 4. **[INFO]** 0-overview.md §6.1 구현 완료 표 — "채널 웹채팅 위젯 + SDK" 미포함

- **target 위치**: `spec/0-overview.md §6.1 (구현 완료 ✅)` — 해당 행 부재
- **충돌 대상**: `spec/0-overview.md §6.2 (백엔드만 존재 / 부분 구현 🚧)` 임베드형 웹채팅 위젯 행
- **상세**: `0-overview.md §6.2`는 "임베드형 웹채팅 위젯 + SDK" 를 `🚧`(부분 구현, 인증/세션·보안 후속 항목 잔존)로 분류한다. 직접 충돌이 아닌 내부 일관성 문제이므로 INFO 수준이나, `spec/7-channel-web-chat/_product-overview.md`의 현재 `status` 필드와 §6.2 분류가 서로 참조-동기화될 필요가 있다.
- **제안**: `spec/7-channel-web-chat/_product-overview.md` 의 `status` 값이 `partial` 로 되어 있다면 §6.2 와 일치하므로 현재 상태를 유지. 향후 보안 후속 항목이 완료되면 §6.1 로 이동 시 두 위치를 동시에 갱신한다.

---

## 요약

target 문서(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`)의 cross-spec 충돌은 대부분 낮은 위험도다. 가장 명확한 문제는 PRD(`_product-overview.md` NAV-WF-02)가 "마지막 실행 시간"을 구현 완료(`✅`)로 표시하지만 상세 spec(`1-workflow-list.md`)은 미구현(`Planned`)으로 선언하는 직접 모순이며(WARNING), 데이터 모델의 Notification.type 7종 중 2종(`background_failed`, `integration_action_required`)이 user-profile 알림 설정 표에 누락된 것도 함께 동기화가 필요하다(WARNING). 데이터 모델·API 계약·상태 머신·RBAC 차원에서의 직접 충돌은 발견되지 않았다.

---

## 위험도

**LOW**

STATUS: OK

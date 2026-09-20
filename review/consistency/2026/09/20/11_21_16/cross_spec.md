# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep)

## 검토 범위 및 제약

target 은 `spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (전문) +
`0-overview.md` (전문) 이 프롬프트 예산 안에 포함됐고, 같은 영역의 나머지 15개 문서
(`4-integration.md` ~ `_layout.md`)와 `1-data-model.md` · `3-workflow-editor/**` · `4-nodes/**` ·
`5-system/**` · `7-channel-web-chat/**` · `data-flow/**` 는 컨텍스트 예산 초과로 프롬프트에서
절단됐다. 이를 보완하기 위해 target 이 명시적으로 참조하는 앵커를 다음 파일에서 직접 `Read`/`grep`
했다: `spec/1-data-model.md` (§2.4 Workflow · §2.5 Folder · §2.8 Trigger · §2.8.1
WebhookEndpointReservation · §2.9 Schedule · §2.9.1 동기화 규칙 · §2.17.2 마스킹), `spec/5-system/1-auth.md`
(§3.1~3.3 RBAC · §4.1 감사 액션 카탈로그), `spec/5-system/2-api-convention.md` (§5.2 목록 응답 · §5.3
에러 응답 · §5.4 부재 표현 · §6 상태 코드), `spec/data-flow/10-triggers.md` (전문), `spec/5-system/12-webhook.md`
(WH-EP-02/WH-SC-01/WH-MG-02/WH-MG-09), `spec/4-nodes/7-trigger/providers/_overview.md` §1,
`spec/2-navigation/_product-overview.md` §3.1~3.3(NAV-WF/TR/SC), `spec/2-navigation/9-user-profile.md`
§4.2. 절단된 나머지(특히 `5-system/14-external-interaction-api.md` · `15-chat-channel.md` 의
R-CC-* 전문, `4-integration.md`, `6-config.md`)는 전수 대조하지 못했다 — 아래 목록에 없다고 해서
그 영역에 충돌이 없다는 뜻은 아니다.

## 발견사항

- **[WARNING] `NAV-WF-02` 요구사항 카탈로그가 ✅(구현 완료)로 표시하지만, 상세 spec 은 그 두 항목이 없다고 명시한다**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.1 "워크플로우 목록 테이블" (컬럼 표 + "미구현 (Planned)" 각주)
  - 충돌 대상: `spec/2-navigation/_product-overview.md` §3.1 표, `NAV-WF-02` 행
  - 상세: `_product-overview.md` 의 `NAV-WF-02` 는 "워크플로우 이름, 상태(활성/비활성), **마지막 실행 시간**, **생성일** 표시"를 필수 요구사항으로 선언하고 상태를 `✅`(구현 완료)로 표기한다. 그런데 같은 검토 범위 안의 `1-workflow-list.md` §2.1 은 현재 구현된 컬럼을 Status/Name/Tags/**Last Updated(`updatedAt`, 마지막 *수정*)**/Actions 5개로 명시하고, 바로 아래 각주에서 "**미구현 (Planned)**: … 그리고 '마지막 *실행*' 시각 컬럼은 아직 없다. 현재 시각 컬럼은 마지막 *수정*(`updatedAt`) 기준이다"라고 스스로 반증한다. "생성일" 컬럼은 표에도 각주에도 전혀 등장하지 않아 더 이르다(계획조차 없음). 즉 요구사항 카탈로그의 `✅` 와, 그 요구사항을 이행해야 할 상세 spec 의 자기 서술이 정면으로 어긋난다 — 두 항목(마지막 실행 시간·생성일) 중 어느 것도 지금 화면에 없다.
  - 부수 — 같은 표의 `NAV-WF-06`("폴더/태그 기반 워크플로우 정리", 권장, `✅`)도 같은 패턴이다: `1-workflow-list.md` §3.1 은 "폴더 **관리** UI(생성·수정·삭제)는 아직 없다 — 필터 옵션 조회 전용"이라고 명시한다. 필터로 "정리 결과를 보는 것"은 가능하나 사용자가 UI 로 폴더를 만들어 "정리"할 수단 자체가 없다 — `NAV-WF-06` 의 "권장" 등급을 감안하면 WF-02 보다는 약한 근거지만 같은 종류의 상태 불일치다.
  - 제안: `_product-overview.md` `NAV-WF-02` 를 실제 구현(마지막 *수정* 시각만 표시)에 맞게 문구를 정정하거나 상태를 `🚧`/조건부로 낮추고, "마지막 실행 시간"·"생성일" 컬럼을 별도 요구사항(Planned)으로 분리한다. `NAV-WF-06` 은 "필터"와 "관리"를 구분해 상태 문구를 다듬는다. 두 표 중 하나가 stale 인지 `project-planner` 턴에서 확정.

- **[INFO] Folder 리소스가 중앙 RBAC 매트릭스에 없다**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 (`POST/PATCH/DELETE /api/folders` — 모두 `editor`+)
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스"
  - 상세: §3.2 표는 Workspace/멤버/Workflow/Trigger/Schedule/Integration/Knowledge Base/Auth Config/Model Config/Statistics/System Status/Marketplace/Audit Log 를 나열하지만 `Folder` 행이 없다. target 의 `editor`+ 게이트는 Workflow 행("Workflow | CRUD | CRUD | CRUD | R")과 정합적이라 실제 모순은 아니지만, 이 문서가 "권한 매트릭스"를 자처하며 워크플로우의 하위 리소스인 Folder 를 누락한 것은 향후 리소스별 권한이 갈라질 때(예: Folder 만 admin+ 로 강화) 추적 근거가 없다는 갭이다.
  - 제안: 굳이 지금 막을 필요는 없음(모순 아님) — `5-system/1-auth.md` §3.2 각주에 "Folder 는 Workflow 권한을 상속" 한 줄만 추가하면 향후 drift 를 예방.

## 검증했으나 충돌 없음 (참고)

다음은 target 이 강하게 의존하는 cross-reference를 직접 대조했고 전부 정합했다 — 재검토 불필요:

- `Trigger`/`Schedule`/`Workflow`/`Folder`/`WebhookEndpointReservation` 엔티티 필드·FK CASCADE·UNIQUE 제약 (`1-data-model.md` §2.4/§2.5/§2.8/§2.8.1/§2.9/§2.9.1) — target 의 삭제 cascade 표(§4.3 of `2-trigger-list.md`), 폴더 깊이 5·순환 검증(§3.1 of `1-workflow-list.md`), endpoint_path 전역 UNIQUE 서술과 전부 일치.
- RBAC: Workflow/Trigger/Schedule = Editor CRUD, Auth Config = Editor R / Admin+ CRUD (`5-system/1-auth.md` §3.2) — target 의 "Add Config는 Admin+ 전용, binding(`authConfigId`)은 editor+" 구분과 일치.
- 감사 로그 액션 카탈로그(`5-system/1-auth.md` §4.1)의 `trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked`/`trigger.deleted`/`trigger.updated` — target §3·§4.1 of `2-trigger-list.md` 표기와 정확히 일치.
- 목록 응답 포맷(`{data, pagination}`, §5.2 of `2-api-convention.md`)과 부재 표현 `null` vs 키 생략 원칙(§5.4) — target 의 `TriggerDto.workflow`/`ScheduleDto.trigger.workflow` 키 생략 서술(R-17, §4 of `3-schedule.md`)이 §5.4 (b) 기준과 정합.
- Webhook 관련 WH-EP-02(URL 포맷)·WH-SC-01(무인증 옵션+UUID 비밀성)·WH-MG-02(v4 UUID 강제)·WH-MG-09(chatChannelHealth 표시) — target의 §2.4/§2.1 서술과 일치.
- Chat Channel provider 카탈로그(`4-nodes/7-trigger/providers/_overview.md` §1: telegram/slack/discord v1) — target §2.3.1/R-12 서술과 일치.
- `data-flow/10-triggers.md` §1.4/§3.1/§3.2 (Schedule↔Trigger 양방향 동기화, `next_run_at` 정보성 컬럼, cron 파싱 실패 시 NULL) — target §3/§4 of `3-schedule.md` 서술과 일치. (이 부분은 진행 중인 작업 `schedule-cron-flake`(e2e 비교식 수정)이 건드리는 영역과 인접하지만, 그 작업은 서비스 코드가 아니라 테스트 비교식만 바꾸는 것으로 명시돼 있어 spec 계약과 무관하다.)

## 요약

검토 대상 3개 화면 spec(`1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md`)은 데이터 모델·API 계약·RBAC·감사 로그·부재 표현 규약 등 직접 대조 가능한 모든 축에서 나머지 spec 과 강하게 정합했다 — 특히 트리거 삭제 cascade, endpoint_path 예약, PATCH 동시성 락, Chat Channel provider 정책 등은 근거 문서를 정확히 인용하며 어긋남이 없었다. 유일하게 실질적인 문제는 spec 내부(§3.1 요구사항 카탈로그 vs 상세 spec)의 상태 불일치다 — `NAV-WF-02`(및 약하게 `NAV-WF-06`)가 `✅`로 표시하는 내용을 상세 spec 스스로 "미구현"이라고 반증하고 있어, 신뢰할 수 있는 진입점 카탈로그로서의 역할이 훼손돼 있다. 다만 이번 workflow 가 실제로 건드리는 대상(스케줄 cron e2e 비교식, `spec_impact: none`)과는 무관한 pre-existing 갭이라 이 작업 자체를 막을 사유는 아니다. 프롬프트 예산으로 절단된 EIA/Chat Channel/Integration/Config 문서 전문은 이번 라운드에서 전수 대조하지 못했으므로, 그 영역을 건드리는 후속 작업에서는 별도 재검토가 필요하다.

## 위험도

LOW

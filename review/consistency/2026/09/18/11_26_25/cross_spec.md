# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep)

## 검토 범위 및 방법

target 은 `spec/2-navigation/` 전체 번들이며, 프롬프트 컨텍스트 예산 초과로 `1-workflow-list.md` ·
`2-trigger-list.md` · `3-schedule.md` 세 파일만 본문이 실렸고 나머지 15개 파일은 절단되었다.
절단된 파일은 이번 검토 대상에서 "충돌 없음" 으로 단정하지 않고, 실린 세 파일(특히 최근
"트리거 행을 없애는 모든 경로가 자원을 정리한다" 결정이 반영된 `2-trigger-list.md §4.3`)이
참조하는 타 영역 spec 을 직접 `Read`/`grep` 으로 열어 대조했다.

대조한 타 영역 문서: `spec/1-data-model.md`(§2.5 Folder·§2.8 Trigger·§2.9 Schedule),
`spec/data-flow/10-triggers.md`, `spec/data-flow/11-workflow.md`, `spec/data-flow/12-workspace.md`,
`spec/5-system/1-auth.md`(§3.2 권한 매트릭스·§4.1 감사 액션), `spec/5-system/2-api-convention.md`(§5.2·§5.4),
`spec/5-system/3-error-handling.md`(에러 코드 레지스트리), `spec/5-system/12-webhook.md`,
`spec/5-system/14-external-interaction-api.md`(§4·§7.1·§7.3), `spec/5-system/15-chat-channel.md`(§5.4·R-CC-10·R-CC-21),
`spec/4-nodes/7-trigger/providers/_overview.md`, `spec/conventions/redis-keys.md`,
`spec/2-navigation/4-integration.md`(cafe24-token-refresh Rationale), `spec/2-navigation/6-config.md`(§A 권한),
`codebase/backend/migrations/V001__initial_schema.sql`(FK 원본).

## 발견사항

이번 대조에서 CRITICAL·WARNING 급 충돌은 발견하지 못했다. 아래는 실측으로 **정합이 확인된**
교차점을 근거로 남긴다(발견 없음의 근거를 적어 두라는 관례에 따름).

- **[INFO]** 절단된 15개 파일은 이번 라운드에서 직접 열어보지 않았다
  - target 위치: `spec/2-navigation/4-integration.md`, `5-knowledge-base.md`, `6-config.md`(§A 권한 부분만 확인), `8-marketplace.md`, `9-user-profile.md`, `_product-overview.md`(NAV-WF-07 항목만 확인), `0-dashboard.md`, `7-statistics.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md`
  - 충돌 대상: 없음 (미확인)
  - 상세: 컨텍스트 예산 절단으로 프롬프트에 본문이 없었다. `6-config.md`§A 권한과 `_product-overview.md`의 NAV-WF-07 항목은 target 이 직접 참조하길래 별도로 `Read`/`grep` 해 대조했고 정합을 확인했다. 나머지 파일은 이번 세 파일(`1-workflow-list` · `2-trigger-list` · `3-schedule`)의 개정 내용과 직접 상호 참조되지 않아 대조 대상에서 제외했다.
  - 제안: 이 영역의 전체 cross-spec 검토가 필요하면 예산을 나눠 별도 라운드로 절단된 파일을 마저 확인할 것.

## 확인된 정합 (참고용 — 위험 아님)

- `2-trigger-list.md §4.3` 의 FK CASCADE 서술(`trigger.workflow_id`/`trigger.workspace_id` ON DELETE CASCADE, `schedule.trigger_id` CASCADE, `execution.trigger_id` SET NULL)은 `V001__initial_schema.sql` 원본과 정확히 일치.
- 같은 §4.3 "네 경로가 자원을 정리한다" 결정은 `data-flow/10-triggers.md`(트리거·스케줄 삭제 행), `data-flow/11-workflow.md`(워크플로 삭제 행), `data-flow/12-workspace.md`(워크스페이스 삭제 행) 세 data-flow 문서 모두에 이미 동일한 순서·시점(비밀은 커밋 **뒤**, 외부 자원은 트랜잭션 **전**)으로 미러링되어 있음 — 트리거 목록 §4.3 을 SoT 로 역참조.
- `pg_advisory_xact_lock(hashtext('trigger-config:<triggerId>'))` 신규 advisory lock 키는 `spec/conventions/redis-keys.md §4` 인벤토리에 이미 등재되어 있고, 같은 절이 "advisory lock 키는 계열이 달라도 한 hashtext 공간을 공유하며 충돌해도 과직렬화일 뿐 정합성은 안 깨진다"는 근거로 `exec-cap:<workspaceId>`·`hashtext(integrationId)`(cafe24) 등 기존 계열과의 공존을 명시적으로 정당화함.
- §3 Rationale 이 인용하는 "Cafe24 토큰 갱신이 advisory lock 을 기각한 사유(HTTP 요청을 트랜잭션 안에 묶으면 DB 커넥션 점유가 늘어난다)"는 `2-navigation/4-integration.md` Rationale 원문과 문구 수준까지 일치.
- 감사 로그 액션명(`trigger.deleted`, `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked`)과 에러 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`, `AUTH_CONFIG_NOT_FOUND`, `BOT_TOKEN_INVALID`)는 각각 `5-system/1-auth.md §4.1`, `5-system/3-error-handling.md` 레지스트리에 동일한 의미로 등재되어 있고 다른 의미로 재사용된 자리는 없음.
- RBAC: `2-trigger-list.md §4.1`(viewer 불가/editor 가능/admin·owner 가능)과 "Auth Config 새로 만들기는 Admin+ 전용" 서술은 `5-system/1-auth.md §3.2`(Trigger: Owner/Admin/Editor=CRUD, Viewer=R; Auth Config: Owner/Admin=CRUD, Editor/Viewer=R)와 `2-navigation/6-config.md §A 권한`(Add Config 포함 모든 변경 버튼 Admin+)에 정확히 부합.
- Folder 폴더 계층 제약(§3.1: 워크스페이스 내 UNIQUE, 깊이 5, 비순환)은 `1-data-model.md §2.5`와 문구까지 일치.
- Chat Channel provider 목록(telegram/slack/discord)은 `4-nodes/7-trigger/providers/_overview.md §1 Supported providers (v1)`와 정확히 일치, 요구사항 ID(NAV-WF-07, R-CC-10, R-CC-21 등)는 다른 영역에서 재사용되지 않음.
- `2-api-convention.md §5.4`의 "키 생략은 (a)/(b) 사유가 있을 때만" 규칙과, target `2-trigger-list.md §3` 註 + R-17("이 축의 캐너리가 고정하는 것은 계약이 아니라 구현")의 프레이밍이 서로 모순되지 않음 — §5.4 는 "어느 경로에서 생략되는가"를 규정하지 않는다고 명시하므로 R-17 의 구분은 §5.4 를 정확히 반영한 것.

## 요약

실린 세 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`) 범위에서, 최근 병합된 "트리거 삭제 자원 정리" 관련 서술(§4.3 및 §3 동시 쓰기 직렬화 註)은 data-model·data-flow(트리거/워크플로/워크스페이스 세 문서)·auth·error-handling·EIA·chat-channel·redis-keys 컨벤션·cafe24 통합 Rationale 전반과 이미 상호 참조가 동기화되어 있으며, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 직접적인 모순을 찾지 못했다. 다만 컨텍스트 예산으로 15개 파일 본문이 절단되어 전체 영역에 대한 검토는 부분적이라는 점을 위험도에 반영한다.

## 위험도

NONE

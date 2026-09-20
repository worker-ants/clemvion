### 발견사항

- **[INFO]** `pending_plans`에 이미 완료된 항목이 남아있음
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 / §3.1 (`pending_plans`는 "미구현 surface를 책임지는 plan")
  - 상세: `pending_plans`에 `plan/complete/workflow-duplicate-nodes-edges.md`(이미 `complete/`로 이동 완료)와 `plan/in-progress/marketplace-and-plugin-sdk.md`(진행 중) 두 항목이 함께 있다. 가드(`spec-pending-plan-existence.test.ts`)는 경로 실존만 검증하므로 빌드는 통과하지만, 이미 완료된 항목을 계속 나열하는 것은 §5.1~5.3 예시(전부 `in-progress/` 또는 빈 배열)와 결이 다르고 "이 문서가 아직 책임지는 미구현 surface가 무엇인가"를 흐릴 수 있다.
  - 제안: `workflow-duplicate-nodes-edges.md` 관련 surface가 이미 구현 완료라면 그 항목을 `pending_plans`에서 제거(남은 `marketplace-and-plugin-sdk.md`만 유지)하거나, 의도적으로 이력 보존용이라면 그 취지를 문서에 한 줄 남긴다. 규약 자체의 결함은 아니므로 규약 갱신은 불필요.

- **[INFO]** 검토 범위의 구조적 한계 (파일·규약 다수 미검토)
  - target 위치: `spec/2-navigation/` 전체 (19개 파일 중 3개만 본문 확인)
  - 위반 규약: 해당 없음 — 방법론적 한계 고지
  - 상세: prompt 번들이 컨텍스트 예산 초과로 `4-integration.md`·`6-config.md`·`9-user-profile.md`·`_layout.md` 등 15개 파일과 `error-codes.md`/`swagger.md`/`spec-impl-evidence.md`/`secret-store.md`/`redis-keys.md`/`review-citations.md`/`chat-channel-adapter.md`/`audit-actions.md`를 제외한 대다수 `spec/conventions/**` 원문을 절단했다. 위 8개 규약 파일은 리포지토리에서 직접 읽어 `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 세 문서와 대조했고 (frontmatter 스키마, `code:`/`pending_plans:` 실존, 감사 액션 명명, 에러 코드 명명, Swagger DTO 명명, secret-store 노출 정책, Redis/advisory-lock 키 인벤토리, chat-channel `uiMapping` enum) 모두 일치했다 — CRITICAL/WARNING급 위반은 발견하지 못했다. 그러나 절단된 15개 spec 파일과 `error-codes` 카탈로그 SoT(`5-system/3-error-handling.md`) 등은 검증하지 못했으므로 "위반 없음"을 그 파일들에까지 일반화할 수 없다.
  - 제안: 이번 판정은 확인된 3개 문서(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`) + 대조한 8개 규약 한정으로 읽을 것. 나머지 파일이 변경 대상에 포함되면 별도 스코프로 재검토 필요.

### 검토 상세 (참고)

확인 항목과 결과 요약:
- **frontmatter 스키마** (`spec-impl-evidence.md`): `id`(kebab-case, basename 기반), `status`(partial/implemented), `code:` 글롭 전량 실존, `pending_plans:` 경로 전량 실존 — 모두 규약 일치. `nav-agent-memory` 처럼 규약이 스스로 인용한 id-충돌 회피 선례도 실제로 그대로 적용돼 있음(`spec/2-navigation/16-agent-memory.md`).
- **감사 액션 명명** (`audit-actions.md`): `trigger.created/updated/deleted`, `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked`, `schedule.created/updated/deleted` 모두 §3 레지스트리와 정확히 일치(언더스코어 토큰 구분자 포함).
- **에러 코드 명명** (`error-codes.md`): `VALIDATION_ERROR`/`RESOURCE_CONFLICT`(prefix-less 시스템 공용) + `TRIGGER_ENDPOINT_PATH_CONFLICT`/`AUTH_CONFIG_NOT_FOUND`/`DUPLICATE_NODE_LABEL`/`BOT_TOKEN_INVALID` 등 도메인 접두 코드 모두 UPPER_SNAKE_CASE + 의미 기반 명명 원칙 준수. 워크플로우 목록 §Rationale 3은 "폴더 전용 순환 코드를 신설하지 않고 `VALIDATION_ERROR` 재사용" — 코드 증식 억제라는 규약 취지에 부합.
- **Swagger/DTO 규약** (`swagger.md`): `UpdateWorkflowDto`/`UpdateTriggerDto`(top-level 요청 바디 Update 접두), `WorkflowSettingsDto`/`ChatChannelConfigDto`(nested `<Domain><Role>Dto` 패턴), `TriggerDto.workflow`/`ScheduleDto.trigger.workflow`의 키-생략형 vs 상시-존재 구분 서술이 §1-4/§1-7 규약과 일치. `botToken`/`inboundSigningPlaintext` write-only 서술도 §1-5 의무와 일치.
- **secret-store 노출 정책** (`secret-store.md` §1.1): `botTokenRef`/`inboundSigningRef`가 응답에 노출되지 않는다는 서술이 trigger-list.md 전반과 일치. 위반 사례 없음.
- **Redis/advisory-lock 키** (`redis-keys.md` §4): `trigger-config:<triggerId>` advisory lock 키가 정확히 2-trigger-list.md §3을 SoT로 상호 인용하며 일치.
- **chat-channel-adapter enum** (`chat-channel-adapter.md` §2.3): `uiMapping.formMode`/`visualNode`/`buttonLayout`의 값 집합·기본값이 trigger-list.md §2.3.1 표와 1:1 일치.

### 요약

확보 가능했던 범위(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 및 이들과 직접 관련된 8개 `spec/conventions/**` 문서) 내에서는 명명·에러 코드·DTO·감사 액션·secret-store·Redis 키 등 정식 규약 위반이 발견되지 않았다. 이 저장소는 각 규약 문서가 Rationale에 실측·기각 대안을 상세히 남기는 성숙한 관행을 갖고 있고, 대상 spec 문서들도 그 규약을 참조·인용하며 정합적으로 작성돼 있다. 유일하게 짚을 만한 것은 `1-workflow-list.md`의 `pending_plans`에 이미 완료된 plan 항목이 정리되지 않고 남아 있다는 INFO 수준 관찰뿐이며, 이는 가드를 통과하고 규약을 명시적으로 위반하지도 않는다. 다만 컨텍스트 예산 때문에 `spec/2-navigation/`의 15개 파일과 다수 `spec/conventions/**` 원문을 이번 패스에서 직접 대조하지 못했으므로, 그 부분에 대한 "위반 없음" 결론은 유보한다.

### 위험도

LOW

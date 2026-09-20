# 정식 규약 준수 검토 — spec/2-navigation (impl-prep)

대상: `spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (전문 조회) — 나머지 15개 파일은 예산 초과로 프롬프트에 미포함되어 판정 대상에서 제외했다(부재를 "위반 없음" 의 근거로 쓰지 않음).

비교 대상 정식 규약(`spec/conventions/**`, 직접 `Read`): `error-codes.md` · `swagger.md` · `secret-store.md` · `chat-channel-adapter.md` · `audit-actions.md` · `spec-impl-evidence.md` · `i18n-userguide.md`. (`cafe24-*`/`makeshop-*` 카탈로그는 target 과 무관해 제외.)

## 발견사항

- **[WARNING]** `1-workflow-list.md` frontmatter `pending_plans` 가 이미 `plan/complete/` 로 이동한 plan 을 계속 가리킨다
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter — `pending_plans: [plan/in-progress/marketplace-and-plugin-sdk.md, plan/complete/workflow-duplicate-nodes-edges.md]`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1(`pending_plans` = "미구현 surface 를 책임지는 plan 경로") · §3 라이프사이클(`partial` → `implemented` 승격 판단은 "그 문서 몫의 미구현 surface 가 0 인가"로 함, R-11)
  - 상세: `spec-pending-plan-existence.test.ts` 가드는 경로가 `plan/in-progress/` 또는 `plan/complete/` 어디에 있든 "실존"만 확인하므로 build 는 통과하지만, 규약의 취지("이 문서가 아직 책임져야 할 미구현 surface")와는 어긋난다 — `workflow-duplicate-nodes-edges.md` 는 이미 완료돼 이 문서가 그것으로 더 이상 책임질 미구현 항목이 없다. `status: partial` 유지 자체는 `marketplace-and-plugin-sdk.md`(진행 중) 가 있어 정당하지만, 완료된 항목을 안 지운 채 남겨 두는 것은 §2.1 의 의미를 흐린다.
  - 이미 추적됨 — 새 결함 아님: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 오픈 항목(2026-09-20 등재, `--impl-prep review/consistency/2026/09/20/00_34_58` convention WARNING 로 최초 지적)이 정확히 이 사실("완료된 `plan/complete/workflow-duplicate-nodes-edges.md` 를 가리킨다 — 빼면 된다, 남은 미구현 surface 가 따로 있는지 먼저 확인")을 이미 등재하고 있다. 중복 백로그 항목을 새로 만들지 말 것.
  - 제안: 이번 --impl-prep 스코프(schedule dup-delete)와 직접 관련 없으므로 새로 처리하지 않고, 위 followups plan 항목의 처리를 기다린다. 처리 시 (a) §2.1 의 나머지 미구현 surface(§2.1/§2.7/§3.2 의 "미구현 (Planned)" 항목들)를 각각 어떤 plan 이 책임지는지 재확인하고 (b) `workflow-duplicate-nodes-edges.md` 항목은 제거한다.

- **[WARNING]** 목록 API 두 곳이 응답 형태(shape)를 표에 적지 않는다
  - target 위치: `1-workflow-list.md` §3.1 `GET /api/folders` 행 · `2-trigger-list.md` §3 `GET /api/triggers/:id/history` 행
  - 위반 규약: `spec/conventions/swagger.md` §5(응답 DTO 규약) / §2-5(응답 wrapping 규칙) — 이 문서군의 다른 모든 목록/조회 API 행은 응답 wrapping 형태(`{ data }`, 페이지네이션 등)를 명시하거나 [API 규약 §5.2] 를 인용하는데 이 두 행만 형태 서술이 비어 있어, 같은 표 안에서 서술 밀도가 비대칭이다.
  - 상세: `GET /api/folders` 는 실제로 `{ data: FolderDto[] }` (페이지네이션 없음, `@ApiOkWrappedArrayResponse`) 이고, `GET /api/triggers/:id/history` 는 배열 wrap + 최근 10건 상한(`.limit(10)`)인데 target 본문 어디에도 이 사실이 없다.
  - 이미 추적됨: 위와 동일한 followups plan 오픈 항목이 이 두 행의 정정도 함께 등재하고 있다(`--impl-prep review/consistency/2026/09/20/00_34_58` convention WARNING).
  - 제안: 마찬가지로 새 항목화 불필요 — 기존 followups 항목이 처리될 때 함께 닫힌다.

## 그 외 확인 사항 (위반 없음 — 근거 명시)

아래는 conventions 규약과의 정합을 직접 대조해 **위반이 없음을 확인**한 항목이다 (다른 세션이 같은 대조를 반복하지 않도록 남긴다):

- **에러 코드 명명** (`error-codes.md`): `VALIDATION_ERROR`/`RESOURCE_CONFLICT` 는 규약이 인정하는 prefix-less 공용 코드, `DUPLICATE_NODE_LABEL`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/`AUTH_CONFIG_NOT_FOUND`/`BOT_TOKEN_INVALID` 는 의미 기반 + 도메인 prefix 원칙(§1)을 따른다. `3-schedule.md` Rationale §3 은 폴더 순환 에러에 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 를 재사용하지 않고 `VALIDATION_ERROR` 를 쓰는 이유를 명시적으로 논증하는데, 이는 오히려 §1 "의미 기반 명명" 원칙을 모범적으로 따른 사례다.
- **Secret Store ref 규약** (`secret-store.md`): `2-trigger-list.md` 가 인용하는 `secret://triggers/{id}/bot-token` 형식·`botTokenRef`/`inboundSigningRef` 를 응답에 노출하지 않는다는 서술(§2.3.1 "내부 ref … 사용자에게 노출하지 않음")이 §1 URI scheme·§1.1(응답 비노출)과 정확히 일치.
- **Chat Channel Adapter 계약** (`chat-channel-adapter.md`): `uiMapping.formMode`/`visualNode`/`buttonLayout` enum 값·default 가 컨벤션 §2.3 타입 선언과 1:1 일치. telegram 의 `setupChannel` 재호출마다 `inboundSigningRef` 가 재발급되는 것이 "정상" 이라는 target 서술은 컨벤션 §1.1.1 의 "멱등은 등록 안전성이지 값 불변이 아니다" 각주와 정확히 부합.
- **Swagger DTO 명명** (`swagger.md` §1-7): target 이 언급하는 DTO 들(`UpdateTriggerDto`/`UpdateWorkflowDto` 는 top-level 요청 바디라 `Update` 접두, `WorkflowSettingsDto`/`ExportWorkflowDto` 는 nested/response 라 접두 없음)이 규약의 "접두는 top-level 요청 바디에만" 원칙과 어긋나지 않는다. `writeOnly` 대상 필드(`botToken`/`inboundSigningPlaintext`) 노출 정책도 §1-5 와 일치.
- **감사 액션 명명** (`audit-actions.md`): `2-trigger-list.md` §3 API 표가 인용하는 `trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked` 세 액션명 및 "폐기(revoked)는 회전과 다른 동사" 라는 서술이 §3 레지스트리·본문 각주와 정확히 일치.
- **frontmatter 스키마** (`spec-impl-evidence.md`): `id:` 가 파일명 번호 접두를 뗀 kebab-case(`workflow-list`/`trigger-list`/`schedule`) 인 것, `status: partial` 문서에 `pending_plans` 가 있고 `status: implemented`(3-schedule.md) 에는 없는 것 모두 §2/§3 스키마를 따른다.

## 요약

target 세 문서(workflow-list·trigger-list·schedule)는 명명 규약·출력 포맷·secret/chat-channel 계약·감사 액션 명명·frontmatter 스키마 전 영역에서 `spec/conventions/**` 와의 정합도가 높다 — 특히 에러 코드 재사용 회피, secret ref 비노출, chat-channel 계약 값 집합 일치는 규약을 문자 그대로 따르는 것을 넘어 그 근거(Rationale)까지 인용하며 정합을 명시적으로 논증하고 있다. 발견된 두 건(WARNING)은 모두 `spec-impl-evidence.md` 관련 frontmatter/문서 완결성 문제이며, 둘 다 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 오픈 항목으로 등재되어 있어 **새로 만들 백로그가 아니라 기존 항목의 처리를 기다리면 되는 상태**다. CRITICAL 은 없다.

## 위험도

LOW

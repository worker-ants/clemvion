# Cross-Spec 일관성 검토 — `spec/2-navigation` (--impl-prep)

## 검토 범위 및 방법

`_prompts/cross_spec.md` 의 번들은 `spec/2-navigation/2-trigger-list.md` (전문) ·
`1-workflow-list.md` (전문) · `3-schedule.md` (부분) 만 담고 있고, 나머지 `2-navigation/*`
15개 파일과 `1-data-model.md` · `0-overview.md` 하위 대다수 관련 spec 은 "컨텍스트 예산 초과"로
본문이 생략되어 있었다(기존에 알려진 `--spec`/번들 예산 갭과 같은 현상). 이 검토는 생략된 부분을
프롬프트에 의존하지 않고 리포지토리의 실제 파일(`Read`/`grep`)을 직접 열어 대조했다:
`spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`,
`spec/5-system/15-chat-channel.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/2-navigation/6-config.md`, `spec/2-navigation/4-integration.md`,
`spec/data-flow/1-audit.md`, `spec/data-flow/10-triggers.md`, `spec/data-flow/11-workflow.md`,
`spec/data-flow/12-workspace.md`.

이번 developer plan(`plan/in-progress/trigger-dup-delete.md`)의 target 은 `TriggersService.remove()`
의 동시 DELETE 중복 감사 행 버그 수정이며 `spec_impact: none` — spec 본문 변경은 계획되어 있지
않다. 따라서 본 검토는 "이 draft 가 다른 영역과 새로 충돌하는가" 보다 "구현 착수 전 이 spec 영역이
이미 다른 영역과 모순되어 구현을 잘못된 방향으로 이끌 여지가 있는가" 에 초점을 맞췄다.

## 대조 결과 (충돌 없음 확인된 항목)

다음은 `2-trigger-list.md` 가 다른 spec 영역을 인용하는 구체적 사실 주장들이며, 모두 인용 대상
원문과 정확히 일치함을 확인했다:

- **RBAC**: §4.1 "viewer 불가 / editor 가능(자신의 워크스페이스) / admin·owner 가능" ↔
  `5-system/1-auth.md` §3.2 `Trigger | CRUD | CRUD | CRUD | R` (Owner/Admin/Editor/Viewer 순) 일치.
- **Auth Config 발급 vs binding 분리**: §2.3.1 "authConfigId binding 은 editor+, '+ 새 인증 설정
  만들기' 는 Admin+" ↔ `5-system/1-auth.md` §3.2 `Auth Config | CRUD | CRUD | R | R`(Editor 는
  binding 이라는 Trigger CRUD 행위이지 AuthConfig CRUD 가 아니므로 모순 아님) + `6-config.md`
  `#### 권한`(Add Config 는 Admin+ UI 노출) 일치.
- **데이터 모델**: `endpoint_path` 전역 UNIQUE + `WebhookEndpointReservation`(§2.8.1) ·
  `trigger.workflow_id`/`workspace_id` CASCADE · `schedule.trigger_id` CASCADE ·
  `execution.trigger_id` SET NULL — 전부 `1-data-model.md` §2.8/§2.8.1/§2.9/§2.9.1/§2.13 원문과
  1:1 일치.
- **API 관행**: `isActive` PATCH-body 단일 경로(`/toggle` 미채택, R-4) ↔
  `5-system/2-api-convention.md` §12.1 "상태 토글 패턴"(전용 endpoint 금지) 및 §12.2
  (`endpoint_path` 전역 유니크) 와 일치. `TriggerDto.workflow` 키 생략형 근거(§5.4 판정 기준 (b))도
  `2-api-convention.md` §5.4 원문 기준과 부합.
- **감사 액션 목록**: `trigger.deleted` / `trigger.notification_secret_rotated` /
  `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked` ↔
  `data-flow/1-audit.md` §해당 표 및 `5-system/1-auth.md` §4.1 과 정확히 일치.
- **Chat Channel PATCH 차단 계약**: `provider` 불변성(400/`INVALID_FIELD`), `botTokenRef`/`botToken`
  PATCH 차단, `chatChannel` 사후 부착 차단(400/`chatChannel`) — 전부
  `5-system/15-chat-channel.md` §5.4.1/§5.4.1.1/§5.4.1.2/R-CC-10/R-CC-21 원문과 세부 에러 코드까지
  일치.
- **동시성 설계 근거의 교차 인용**: "외부 provider 호출을 advisory lock 안에 두지 않는 이유"로 든
  cafe24 사례(`lock 보유 중 HTTP 요청이 DB 커넥션 점유를 늘린다`)는 `2-navigation/4-integration.md`
  의 실제 Rationale 문장과 일치.
- **EIA 앵커**: §7.1 Trigger 엔티티 확장, §7.3 InteractionToken 앵커 모두 `14-external-interaction-api.md`
  에 실재.

이 정도로 촘촘하게 상호 참조를 실측·교차 검증해 둔 spec 은 흔치 않다 — 각 인용마다 대상 문서의
정확한 절 번호·필드명·에러 코드까지 맞춰 놓아, 이번 검토에서 새로 발견된 데이터 모델/API
계약/RBAC/상태 전이 모순은 없었다.

## 발견사항

- **[INFO]** target 문서의 §4.4 "동시 삭제" 서술은 현재 구현과 다르다 — spec 대 spec 충돌 아님
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.4 "동시 삭제: 두 클라이언트가 동시에
    같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 충돌 대상: 없음 (다른 spec 파일이 다르게 서술하지 않음) — `plan/in-progress/trigger-dup-delete.md`
    자체가 "현재는 advisory lock 을 잡은 뒤 행 존재를 재확인하지 않아 `[204, 204]` + 중복 감사 행이
    나온다"고 명시하며, 이 developer plan 이 그 갭을 메워 §4.4 를 사실로 만드는 작업이다.
  - 상세: Cross-spec 검토 관점(spec 영역 간 모순)에서는 문제가 아니다 — 다른 어떤 spec 파일도
    "트리거 동시 삭제 시 [204, 204]" 라거나 다른 결과를 주장하지 않는다. 다만 spec-coverage(spec
    vs 구현) 관점의 갭이 여기 존재한다는 점은 이미 plan 문서 자체가 알고 있고, 처방(§B)도 명시돼
    있다. 참고로 이 문서는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 를
    `pending_plans` 로 등재해 이 종류의 "spec 이 선언한 것과 구현의 괴리"를 추적 중이다.
  - 제안: 이번 developer PR 이 완료되면(§4.4 를 사실로 만들면) 별도 spec 수정은 불필요 — plan 자체가
    "§4.4 의 캐비엇은 planner 몫" 이라고 이미 명시했으므로, 트래커 항목에 "§4.4 구현 검증 완료" 를
    반영하는 후속 planner 턴만 있으면 된다. 이는 이번 --impl-prep 게이트를 막을 사유가 아니다.

- **[INFO]** 15-chat-channel.md 의 미확정 각주가 이번 target 의 인접 주장과 접점을 가진다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 "Chat Channel" 행 및 §3 PATCH 계약
    (`isActive: true` 활성화 시 `setupChannel()` 재호출 전제를 깔고 있는 서술은 없으나, `botTokenRef`
    재유도·재조회 로직 전제를 공유)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1 표 2행 및 §5.4.1.1 표 2행의
    "(2026-09-10 — 이 재호출이 실제로 일어나는지 미확정)" 각주
  - 상세: 직접적인 모순은 아니다 — target 문서는 이 미확정 지점(활성화 토글 시 `setupChannel` 재호출
    여부)에 대해 별도 주장을 하지 않으므로 두 문서가 서로 다른 사실을 말하고 있지는 않다. 다만 이번
    developer 작업이 `TriggersService.remove()` 내부의 삭제 순서(외부 자원 해제 → advisory lock →
    재조회)를 건드리므로, 인접한 `update()`/활성화 경로의 미확정 사실과 코드 위치가 가깝다는 점만
    기록해 둔다 — 이번 PR 범위(remove 경로) 밖이라 조치 불요.
  - 제안: 조치 불요. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 그 미확정
    항목을 추적 중이므로 중복 등재하지 않는다.

## 요약

Cross-Spec 일관성 관점에서, target 문서(`spec/2-navigation` 번들, 사실상 `2-trigger-list.md`
중심)가 다른 spec 영역(데이터 모델·API 계약·RBAC·감사 액션·Chat Channel·Integration)과 새로
충돌하는 지점은 발견되지 않았다. 프롬프트 번들 자체는 컨텍스트 예산 초과로 `1-data-model.md` 를
포함한 다수 관련 spec 의 본문이 생략돼 있었으나, 해당 파일들을 리포지토리에서 직접 열어 대조한
결과 target 문서의 모든 구체적 상호 참조(절 번호·필드명·에러 코드·RBAC 등급)가 원문과 정확히
일치했다. 이번 developer plan 은 `spec_impact: none` 으로 spec 변경을 계획하지 않고 있으며, 유일한
관찰 사항(§4.4 "동시 삭제" 서술이 아직 구현과 다르다)은 spec 간 모순이 아니라 이번 PR 이 직접 해소할
spec-vs-구현 갭으로, 이미 plan 문서가 인지하고 처방까지 갖추고 있다. Cross-Spec 관점에서 이번
구현 착수를 막을 사유는 없다.

## 위험도

NONE

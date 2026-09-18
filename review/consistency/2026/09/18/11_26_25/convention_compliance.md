# 정식 규약 준수 검토 — spec/2-navigation/ (--impl-prep)

검토 대상: `spec/2-navigation/1-workflow-list.md` · `spec/2-navigation/2-trigger-list.md` ·
`spec/2-navigation/3-schedule.md` (프롬프트 번들에 전문 포함) + `spec/2-navigation/` 전역
(bundle 예산 초과로 elided 된 15개 파일은 grep 으로 보조 확인). 대조군: `spec/conventions/**`
(swagger.md · error-codes.md · secret-store.md · audit-actions.md · review-citations.md ·
egress-masking.md · chat-channel-adapter.md · spec-impl-evidence.md 를 직접 열어 대조).

배경: 최근 머지된 `e63a5bc5d`(#1347)가 `2-trigger-list.md` §4.3/§4.4·`1-workflow-list.md`
frontmatter 를 정리했고, 이번 `--impl-prep` 는 그 뒤 이어질 `codebase/**` 전용 stale-comment
정리 작업(`plan/in-progress/trigger-release-stale-comments.md`, `spec_impact: none`) 착수 전
게이트다.

## 발견사항

- **[INFO]** secret ref 플레이스홀더 표기 불일치
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.3, "`secret_store` 의
    `secret://triggers/<id>/` 비밀" 행
  - 위반 규약: `spec/conventions/secret-store.md` §1 URI Scheme (예시가 전부
    `secret://triggers/{triggerId}/bot-token` 형태로 `{...}` 를 씀)
  - 상세: URI 의 `scope`(`triggers`)·`resourceId` 구조 자체는 규약과 일치하지만, resourceId
    자리의 플레이스홀더 표기가 이 문서 안에서도 `{triggerId}`(§2.1 등 다른 자리에 준하는
    표기)가 아니라 `<id>` 로 다르다. 규약 위반은 아니고(스킴 구조는 지켜짐) 문서 내 표기
    일관성만의 문제.
  - 제안: `secret://triggers/{triggerId}/` 로 통일하거나, 이 문장을 다음에 손댈 때 맞춘다
    (기계적 일괄 치환 대상은 아님).

- **[INFO]** `spec/2-navigation/14-execution-history.md` 의 bare 리뷰 인용 (target scope 안이지만 이번 diff 밖)
  - target 위치: `spec/2-navigation/14-execution-history.md:479` — `` `10_53_52` security/architecture W2·W3 ``
  - 위반 규약: `spec/conventions/review-citations.md` §2 (bare `hh_mm_ss` 금지, `spec/**` 는 §3 표에서 "적용" 대상)
  - 상세: 날짜 없는 시각만 있어 해당 세션을 이력으로도 특정할 수 없다. 다만 이 파일은 이번
    diff(1/2/3-*.md)에 포함되지 않고, `review-citations.md` §4 는 "기존 bare 인용은 소급
    일괄 정리 대상이 아니며 다음에 그 자리를 건드릴 때 맞춘다" 고 명시한다 — 이번
    `--impl-prep` 스코프(`spec/2-navigation/`) 안에서 우연히 걸렸을 뿐 새로 생긴 위반이
    아니다.
  - 제안: 지금 고칠 필요 없음(정책상 opportunistic-fix 대상). 이 파일을 다음에 편집할 일이
    생기면 날짜를 특정해 정정. 차단 사유 아님.

- **[INFO]** `GET /api/folders` 응답 포맷 표기 생략
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 API 표, `GET /api/folders` 행
  - 관련 규약: `spec/conventions/swagger.md` §2-5 (성공 응답 `{ data: ... }` wrap, 비-페이징
    고정 컬렉션의 pass-through 형태)
  - 상세: 같은 §3/§3.1 표의 형제 목록 엔드포인트(`GET /api/workflows`, 그리고 자매 문서의
    `GET /api/triggers`, `GET /api/schedules`)는 전부 "페이지네이션 응답 형식은 API 규약
    §5.2 준수" 를 명시하는데, `GET /api/folders` 는 페이지네이션 파라미터가 없는(전체
    계층 반환) 엔드포인트라 그 인용이 애초에 불필요하지만, 응답이 `{ data: [...] }` 배열인지
    swagger.md §2-5 가 말하는 "비-페이징 고정 컬렉션"(`{ data: { items } }`) 형태인지가
    본문에 적혀 있지 않다. 규약 위반은 아니고(default wrap 을 벗어났다는 증거 없음), 형제
    엔드포인트들이 형식을 명시하는 관행과 대비되는 생략.
  - 제안: 여유가 있으면 한 문장으로 응답 shape(`{ data: [...] }` 평면 배열인지 여부)를 명시.
    차단 사유는 아님.

## 비대상 확인 (검토했으나 위반 없음)

- **DTO 명명(`swagger.md` §1-7 `Update` 접두)**: `UpdateWorkflowDto`·`UpdateTriggerDto` 는
  top-level 요청 바디로 접두 사용, `WorkflowSettingsDto`(nested)는 로컬 패턴 유지 — 규약과
  일치.
- **에러 코드 명명(`error-codes.md` §1)**: `VALIDATION_ERROR`·`RESOURCE_CONFLICT`·
  `RESOURCE_NOT_FOUND`·`AUTH_CONFIG_NOT_FOUND`·`BOT_TOKEN_INVALID`·도메인 세부코드
  `TRIGGER_ENDPOINT_PATH_CONFLICT`·`INVALID_FIELD` 모두 `UPPER_SNAKE_CASE` + (해당 시)
  도메인 prefix 패턴 준수.
- **감사 액션 명명(`audit-actions.md` §1~§3)**: `trigger.deleted`·
  `trigger.chat_channel_bot_token_rotated`·`trigger.notification_secret_rotated`·
  `trigger.interaction_token_revoked` 가 레지스트리(§3 `trigger` 행, 2026-08-11 구현)와
  토큰까지 정확히 일치.
- **Secret Store 스킴(`secret-store.md` §1)**: `secret://triggers/<id>/` 비밀 정리 서술 —
  scope `triggers` 사용, 응답 노출 금지(§1.1)를 위반하는 서술 없음 (오히려 §1.1 "비대상
  필드도 응답 바디에는 안 나간다" 를 정확히 인용하는 방향으로 `botToken`/`hasBotToken`
  writeOnly/readOnly 서술과 정합).
- **Swagger writeOnly/readOnly(§1-5)**: `botToken`(edit, write-only) / `hasBotToken`(응답
  전용, derived) / `inboundSigningPlaintext`(write-only) 서술이 규약 예시와 표현까지
  일치.
- **enum 값(`chat-channel-adapter.md`)**: `uiMapping.formMode`(`multi_step`/`native_modal`/
  `auto`) · `visualNode`(`text`/`photo`/`auto`) · `buttonLayout`(`auto`/`vertical`/
  `horizontal`) 가 정본 타입 선언과 1:1 일치.
- **frontmatter 스키마(`spec-impl-evidence.md` §2~§3)**: `id`/`status`/`code`/`pending_plans`
  형식·`status: partial` 시 `pending_plans` 의무·경로 실존 모두 충족(`plan/in-progress/
  spec-draft-nullable-notation-followups.md`, `marketplace-and-plugin-sdk.md`,
  `plan/complete/workflow-duplicate-nodes-edges.md` 전부 실존 확인).
- **금지 패턴**: `Patch*Dto` 접두, `{ data: { data, pagination } }` 이중 래핑 등
  swagger.md §6 레거시 패턴이 `spec/2-navigation/` 전역에 grep 0건.
- **문서 구조(3섹션 권장)**: 세 파일 모두 상단 관련 문서 링크(Overview 역할) → 화면
  구조/기능 상세/API 본문 → 말미 `## Rationale` 구성을 따름.

## 요약

`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`(이번
`--impl-prep` 게이트가 실질적으로 관련되는 변경분)는 `spec/conventions/` 의 명명(DTO
Update 접두·에러 코드·감사 액션·secret URI 스킴)·출력 포맷(writeOnly/readOnly, 응답 wrap)·
문서 구조·API 문서 규약을 CRITICAL/WARNING 없이 준수한다. 발견된 세 항목은 모두 INFO
등급의 표기 일관성·생략 이슈이며, 그중 하나(`14-execution-history.md` bare 인용)는 이번
diff 밖의 기존 부채로 `review-citations.md` §4 가 명시적으로 소급 정리 대상에서 제외한다.
이 게이트를 이유로 `codebase/**` stale-comment 정리 작업 착수를 막을 사유는 없다.

## 위험도

LOW

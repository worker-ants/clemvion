# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위 및 방법

번들에는 컨텍스트 예산으로 인해 `spec/2-navigation/*.md` 16개 중 3개
(`2-trigger-list.md`·`1-workflow-list.md`·`3-schedule.md`)만 전문이 포함되고 나머지 13개
파일(`4-integration.md`·`_product-overview.md`·`_layout.md` 등)과 `spec/conventions/**`
상당수(`error-codes.md`·`swagger.md`·`secret-store.md`·`chat-channel-adapter.md`·
`audit-actions.md` 등 다수)는 "본문 생략됨" 절단 상태였다. 절단을 "위반 없음"의 근거로
쓰지 않기 위해, 대상 spec 이 실제로 인용하는 정식 규약 파일들
(`spec/conventions/error-codes.md`, `swagger.md`, `secret-store.md`,
`chat-channel-adapter.md`, `audit-actions.md`, `review-citations.md`,
`spec-impl-evidence.md`)과 `.claude/skills/project-planner/SKILL.md` 를 저장소에서 직접
`Read` 하여 대조했다. 나머지 13개 미전문 파일은 이번 라운드의 작업 대상(`trigger-save-partial-patch`
plan, 트리거 PATCH/락 계약)과 직접 연관이 없어 전문 로드는 생략했다 — 필요 시 별도 라운드에서
직접 열어 대조할 것을 권한다.

## 발견사항

### [INFO] `pending_plans` 가 `plan/in-progress/` 대신 `plan/complete/` 경로를 직접 기재
- target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 두 번째 항목
  (`plan/complete/workflow-duplicate-nodes-edges.md`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 (Frontmatter 스키마 예시) · §2.1
  `pending_plans` 필드 정의
- 상세: 스키마 예시와 필드 정의는 `pending_plans` 항목을 `plan/in-progress/<name>.md` 형태로
  기재하고, 가드(`spec-pending-plan-existence.test.ts`)가 "`plan/in-progress/` 또는
  (in-progress→complete 치환한) `plan/complete/`" 양쪽에서 실존을 확인하는 구조로 설계되어
  있다. 그런데 이 파일은 이미 `plan/complete/`로 끝난 항목의 경로를 프런트매터에 **직접**
  `plan/complete/...`로 적어 두었다. 가드 관점에서는 리터럴 경로가 실제로 존재하므로
  통과하지만(치환 로직이 아니라 리터럴 매치로 우연히 통과), 문서 관점에서는 "아직 pending
  한 작업"이라는 필드 의미와 어긋나 보인다. 같은 패턴이 `spec/3-workflow-editor/0-canvas.md`
  에도 있어 이번 target 만의 고립된 사례는 아니다(기존 관행).
- 제안: 기능적 위반은 아니므로(가드 통과·CRITICAL 아님) 급히 고칠 필요는 없다. 다음에 이
  frontmatter 를 만질 일이 생기면, 완료된 항목은 `pending_plans` 목록에서 제거하거나(다른
  pending 항목이 남아 있으므로 `status: partial` 자체는 그대로 유지 가능) 스키마 예시가
  보여주는 `plan/in-progress/` 표기로 되돌리는 것이 필드 의미와 더 잘 맞는다. 급하지 않으면
  이 INFO 는 `1-workflow-list.md`/`0-canvas.md` 두 곳을 한 번에 정리하는 별도 정리 작업으로
  미뤄도 무방하다.

## 검증했으나 위반 없음 (참고용 — 실제로 대조한 항목)

- **에러 코드 명명** (`error-codes.md`): `2-trigger-list.md`/`1-workflow-list.md` 가 쓰는
  `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/`VALIDATION_ERROR`/`INVALID_FIELD`/
  `AUTH_CONFIG_NOT_FOUND`/`BOT_TOKEN_INVALID`/`DUPLICATE_NODE_LABEL`/`RESOURCE_NOT_FOUND` 모두
  `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙(§1)을 따르고, §3 historical exception 목록에 걸리는
  lowercase 코드를 신규로 흉내 내지 않았다.
- **감사 액션 명명** (`audit-actions.md`): `trigger.deleted`(§2.1 과거분사, 레지스트리 일치),
  `trigger.updated`(R-4, isActive 토글도 `trigger.updated` 로 기록 — "toggle 별도 동사 없음"
  규칙과 일치), `trigger.chat_channel_bot_token_rotated`/`trigger.notification_secret_rotated`/
  `trigger.interaction_token_revoked` 세 sub-channel 액션이 §3 레지스트리 행과 문자열까지
  정확히 일치.
- **Secret Store 규약** (`secret-store.md` §1.1): `botToken`/`inboundSigning` write-only 필드가
  AuthConfig 의 `***<last4>` 마스킹과 다른 이유("Reveal 가능 자격증명 전용, write-only 엔
  차용 안 함")로 §1.1 "비대상 필드도 응답 바디에는 나가지 않는다"를 정확히 인용, 앵커
  (`#11-비대상-필드도-응답-바디에는-나가지-않는다`)도 실재.
- **Chat Channel 어댑터 타입 계약** (`chat-channel-adapter.md` §2.3): `2-trigger-list.md`
  §2.3.1 매트릭스의 `uiMapping.formMode`(`multi_step`/`native_modal`/`auto`) ·
  `visualNode`(`text`/`photo`/`auto`) · `buttonLayout`(`auto`/`vertical`/`horizontal`) enum
  값 집합이 컨벤션의 TypeScript 인터페이스 선언과 완전히 일치.
- **Swagger/DTO 명명** (`swagger.md` §1-7, §5-1): PATCH 바디 DTO는 `update-trigger.dto.ts`
  (`UpdateTriggerDto` 패턴)로 top-level 요청 바디 명명 규칙과 일치. 응답 DTO
  `TriggerDto`(`codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`)
  는 §5-1 이 요구하는 `dto/responses/*-response.dto.ts` 파일 위치를 만족.
- **인용 형식** (`review-citations.md` §2·§4): `2-trigger-list.md` 본문 전체에서 날짜 없는
  bare `hh_mm_ss` 인용이 검출되지 않음(grep 0건) — 모든 시점 인용이 `YYYY-MM-DD` 를 동반.
- **문서 3섹션 구조** (`.claude/skills/project-planner/SKILL.md` §Spec 문서 구조): 개별 화면
  spec 파일에 `## Overview` 헤더가 없는 것은 위반이 아니다 — 해당 SKILL.md 가 "다중 spec
  파일을 가진 영역은 `_product-overview.md` 별도 파일"로 Overview 를 분리하도록 **명시적으로
  허용**하며, `2-trigger-list.md`/`1-workflow-list.md`/`3-schedule.md` 모두 문서 상단 blockquote
  로 `_product-overview.md` 의 해당 절을 가리키고 본문 뒤에 `## Rationale` 을 두는 동일 패턴을
  따른다. 오탐으로 등재하지 않는다.
- **frontmatter 스키마 자체** (`spec-impl-evidence.md` §2·§3): `id`(kebab-case) · `status`
  (enum) · `code:`(글롭, `partial`/`implemented` 상태에 대해 ≥1 항목) · `pending_plans`
  (`status: partial` 의무) 모두 3개 파일에서 스키마를 충족. `code:` 리스트 안의 인라인 `#`
  YAML 주석(예: 트리거 lock 시행 코드 설명)도 2026-09-06 파서 수정 이후 안전하다고 규약이
  명시한 패턴 그대로 사용됨.

## 요약

번들에 전문이 포함된 세 spec(`2-trigger-list.md`·`1-workflow-list.md`·`3-schedule.md`)을
그것들이 실제로 인용하는 정식 규약 원문(error-codes/swagger/secret-store/chat-channel-adapter/
audit-actions/review-citations/spec-impl-evidence, 그리고 project-planner SKILL.md)과 대조한
결과 CRITICAL·WARNING 급 위반은 발견되지 않았다. 에러 코드·감사 액션·DTO/파일 명명·secret 노출
정책·chat-channel enum·인용 날짜 표기 등 다섯 검토 관점 전반에서 인용 앵커가 실재하고 값이
정확히 일치했다. 유일한 지적은 INFO 등급으로, `pending_plans` frontmatter 필드에 이미 완료된
plan 을 `plan/complete/` 리터럴 경로로 남겨 둔 관행(1-workflow-list.md, 기존에도 0-canvas.md
에 선례)이 스키마 예시가 보여주는 형태와 다르다는 점뿐이며 가드 실패나 기능적 문제는 없다.
나머지 13개 spec 파일과 다수 conventions 파일은 컨텍스트 예산으로 절단되어 이번 라운드에서
전문 대조하지 못했다 — 그 파일들의 부재를 "위반 없음"의 근거로 삼지 않는다.

## 위험도
NONE

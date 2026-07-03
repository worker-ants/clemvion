# 정식 규약 준수 검토 — spec/5-system/ (1-auth.md · 10-graph-rag.md)

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 미발견).

## 검토 근거 (교차검증 상세)

- **에러 코드 명명 (`spec/conventions/error-codes.md`)**: `1-auth.md` 전역 에러 코드(`REAUTH_NOT_AVAILABLE`·`VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`WEBAUTHN_DISABLED`·`WEBAUTHN_VERIFY_FAILED`·`INVALID_OPTIONS_TOKEN`·`CHALLENGE_INVALID`·`WEBAUTHN_INVALID`·`WEBAUTHN_COUNTER_REGRESSION`·`RECOVERY_CODE_INVALID`·`INVALID_PASSWORD` 등)는 모두 `UPPER_SNAKE_CASE` 로 §1 원칙을 준수한다. §1.5.4 의 초대 흐름 lowercase 코드(`invitation_not_found` 등, `forbidden`·`rate_limited` 포함)는 `error-codes.md §3` historical-artifact 레지스트리에 정확히 등재돼 있고, 두 문서가 서로를 앵커 링크로 상호 참조한다 (`1-auth.md §1.5.4` → `error-codes.md#3-historical-artifact-예외-레지스트리`, `error-codes.md` 행 → `1-auth.md#154-에러-응답`). 예외 등재 사유(v1 출하 시 정착·rename=breaking·"초대 API 한정")도 규약 §2 rename 정책과 정합적으로 서술됨.
- **감사 액션 명명 (`spec/conventions/audit-actions.md`)**: `1-auth.md §4.1` 의 구현/Planned 액션 카탈로그가 `audit-actions.md §3` 도메인별 분류 레지스트리와 **행 단위로 완전히 일치**한다 (integration/user/auth_config/execution/workspace 구현 목록, workspace/member/workflow/trigger/schedule/model_config Planned 목록 모두 동일). `<resource>.<verb>` dot-prefix, 언더스코어 토큰 구분자, 3분류(과거분사 기본/§2.2 현재형 예외/§2.3 도메인 고유 동사) 적용도 두 문서에서 정합적이다. `workspace.transfer_ownership` 의 §2.3 분류·`model_config.set_default` 의 §2.2 예외 사유도 양쪽에서 동일하게 설명됨. 책임 분리(카탈로그=1-auth.md, taxonomy=audit-actions.md)도 SoT 원칙에 부합.
- **spec 문서 구조 (Overview/본문/Rationale)**: `1-auth.md`·`10-graph-rag.md` 모두 `## Overview` → 번호 섹션 본문 → `## Rationale` 3섹션 구성을 따른다. frontmatter(`id`/`status`/`code:`/필요 시 `pending_plans:`)도 `spec-impl-evidence.md §1~2` 스키마(kebab-case id, 5값 status enum, code 경로 배열)와 일치.
- **API 문서/카탈로그 규약**: `cafe24-api-catalog/application.md`(top-level index, frontmatter `id`/`status` 보유) 와 `cafe24-api-catalog/application/apps.md`(field-level, frontmatter `resource`/`entity`/`cafe24_docs`/`source`, `id`/`status` 없음)의 frontmatter 차이는 `spec-impl-evidence.md §1` 이 명시한 예외("카탈로그 디렉토리 뒤 세그먼트 1개 이상인 모든 `.md`" 는 lifecycle frontmatter 면제)와 정확히 일치한다. `_overview.md` 의 표 컬럼 정의·status enum·동기 정책(§4)도 `application.md` 표 실제 사용과 부합.
- **WebSocket 이벤트 명명**: `10-graph-rag.md §6` 의 `document:graph_started/_progress/_completed/_retry/_failed` 는 형제 문서 `8-embedding-pipeline.md` 의 `document:embedding_started/_progress/_completed/_retry/_failed` 와 동일한 `document:<domain>_<verb>` 패턴을 따르며, 채널 명명(`kb:{documentId}`)도 동일하다 — 두 spec 영역 간 사실상 표준 관례가 일관되게 유지된다. `document:graph_error` 가 타입 union 에는 선언되었으나 실제 emit 되지 않는다는 사실도 문서에 정직하게 명시되어 있어 spec-코드 불일치를 은폐하지 않는다(오히려 §Spec-coverage 관점에서 모범적).
- **RBAC/권한 매트릭스 등 표 형식**: `1-auth.md §3.2` 표·Auth Config Reveal 권한 분리 등 별도 명명 규약과 충돌 없음.

## 요약

`spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 및 이번 검토에 함께 번들된 `spec/conventions/audit-actions.md`·`spec/conventions/error-codes.md`·`spec/conventions/cafe24-api-catalog/**` 사이에서 명명 규약(에러 코드 UPPER_SNAKE_CASE + 등재된 historical exception, 감사 액션 `<resource>.<verb>` + 3분류 taxonomy), 문서 구조 규약(Overview/본문/Rationale, frontmatter 스키마), API 카탈로그 규약(top-level index vs field-level 파일의 frontmatter 면제 규칙) 이 모두 정합적으로 교차 확인됐다. 두 spec 파일과 정식 규약 문서 간 상호 앵커 링크가 양방향으로 정확히 걸려 있고, 표에 등재된 값(에러 코드·감사 액션)도 행 단위로 완전히 일치한다. 정식 규약 위반으로 판단할 CRITICAL/WARNING/INFO 항목을 발견하지 못했다.

## 위험도

NONE

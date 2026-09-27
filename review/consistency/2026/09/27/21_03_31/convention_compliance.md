# 정식 규약 준수 검토 — spec/2-navigation/ (--impl-prep)

## 검토 범위 및 방법

- target: `spec/2-navigation/` (프롬프트 번들에 포함된 `1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 전문 + 나머지 15개 파일은 컨텍스트 예산 초과로 생략됨 — 생략분은 Read 로 직접 열지 않았으므로 판정에서 제외).
- 이번 PR 의 실제 diff 는 `git diff origin/main -- spec/2-navigation/` 기준 **`1-workflow-list.md` 한 파일**(폴더/워크플로 `folderId`·`parentId` cross-workspace 소속 검사 추가)뿐이라, 여기에 집중 검토하고 나머지 두 파일(`2-trigger-list.md`·`3-schedule.md`)은 배경 대조군으로 확인했다.
- `spec/conventions/**` 중 프롬프트 번들에 본문이 포함되지 않은 핵심 문서(`error-codes.md`·`swagger.md`·`secret-store.md`·`spec-impl-evidence.md`·`chat-channel-adapter.md`·`audit-actions.md`)는 실제 저장소 경로에서 직접 Read 로 열어 대조했다.
- 명명·출력 포맷의 실제 SoT 판정을 위해 `spec/1-data-model.md §1.1`(참조의 소속) · `spec/5-system/2-api-convention.md §5.3`(details 형태) · `spec/5-system/3-error-handling.md §1.10~1.11` 도 함께 열어 대조했다(정식 규약 문서는 아니지만 conventions 문서들이 명시적으로 SoT 로 위임하는 자리라 인용 정합성 확인에 필요).

## 발견사항

### [INFO] `details[]` 필드 단위 어노테이션이 비대칭 — cycle/depth 위반에는 `details.field` 미표기

- target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 `PATCH /api/folders/:id` 행
- 위반 규약: 직접적인 규약 위반은 아님 — `spec/5-system/2-api-convention.md §5.3` "field 를 실으면 code 도 싣는다(2026-09-11 규약화)" 취지의 완전성 측면
- 상세: 이번 PR 이 추가한 문구는 "새 부모가 같은 워크스페이스에 없거나(`details[].field='parentId'` — 생성과 같은 형태), 자기 자신·자손이거나(순환), 이동 결과 서브트리 깊이가 5 초과면 400 `VALIDATION_ERROR`" 로, **세 위반 중 워크스페이스 불일치 사유에만** `details[].field` 를 붙였다. 같은 문서 Rationale §3 은 "세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR` 를 재사용한다" 고 명시해 셋을 대칭으로 다루고 있어, 필드 단위 상세 표기가 한 사유에만 있는 것이 의도적 차별인지 단순 누락인지 spec 본문만으로는 판별되지 않는다.
- 제안: 순환·깊이 초과 사유도 같은 표기(`details[].field='parentId'`, 필요 시 도메인 코드)를 붙이거나, "왜 이 사유만 필드를 명시하는가"를 한 줄로 밝힌다. CRITICAL/WARNING 은 아니며 --impl-prep 단계에서 완성도를 높이는 수준의 제안.

### [INFO] `AUTH_CONFIG_NOT_FOUND` 관련 서술의 HTTP status 생략 (기존 문구, 이번 diff 밖)

- target 위치: `spec/2-navigation/2-trigger-list.md` §3 `PATCH /api/triggers/:id` 註 — "미스매치 시 400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`"
- 위반 규약: 없음(문체상 생략) — 참고로 `spec/5-system/3-error-handling.md §1.11` 은 `AUTH_CONFIG_NOT_FOUND` 가 이름과 달리 **400**(404 아님)임을 강조해 명시한다
- 상세: 인용문이 "400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`" 로 끊어져, 두 번째 코드의 HTTP status 가 이 문장만 읽으면 불명확하다(실제로는 둘 다 400). git 이력상 이 문구는 이번 PR 의 diff 밖(기존 문구)이라 이번 검토의 핵심 대상은 아니다.
- 제안: "400 `VALIDATION_ERROR` 또는 400 `AUTH_CONFIG_NOT_FOUND`" 로 status 를 반복 명시하면 §1.11 의 "이름은 `_NOT_FOUND` 지만 404 가 아니다" 라는 예외적 사실이 이 문서만 읽어도 드러난다.

## 확인했지만 위반이 아닌 것 (근거 남김 — 재검토 방지용)

- **`details[].field='folderId'` / `details[].field='parentId'` (배열 표기)**: 처음엔 같은 spec 영역의 `2-trigger-list.md` 가 동일 계열 검사(`authConfigId` 소속 검증)에 객체 표기(`details.field='authConfigId'`)를 쓰는 것과 형태가 달라 규약 위반으로 의심했으나, 실제 SoT 인 `spec/1-data-model.md §1.1 참조의 소속`이 "거부 응답: 400 `VALIDATION_ERROR` + `details: [{ field, message, code: 'INVALID_FIELD' }]` — **배열**이다" 라고 명시적으로 선언하고, `authConfigId` 는 그 문단이 **예외로 별도 등재**한 케이스(기존 `assertAuthConfigInWorkspace` 검증기 재사용 → 객체 표기)다. 즉 `folderId`/`parentId` 는 예외 목록에 없는 **일반 규칙 적용 대상**이라 배열 표기가 정확히 맞다. `spec/5-system/2-api-convention.md §5.3` 의 "details 형태는 둘 다 유효 — 배열은 여러 항목이 각각 실패할 수 있을 때" 기준과도 일치한다.
- **DTO/Swagger 명명** (`UpdateWorkflowDto`·`UpdateTriggerDto`·`WorkflowSettingsDto`·`ExportWorkflowDto`): `spec/conventions/swagger.md §1-7` (`Update` 접두는 top-level 요청 바디 한정, nested 변형은 로컬 패턴)과 정확히 일치.
- **`writeOnly`/`readOnly` 필드 서술** (`botToken`, `inboundSigningPlaintext`, `hasBotToken`): `swagger.md §1-5` 와 일치.
- **`uiMapping.formMode`/`visualNode`/`buttonLayout` enum 값·default**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 의 리터럴·의미와 1:1 일치.
- **감사 액션 명명** (`trigger.notification_secret_rotated` 등 §4.1 참조): `audit-actions.md` 의 `<resource>.<verb>` + 과거분사 규칙과 일치, `_v2`/구분자 위반 없음.
- **에러 코드 명명** (`VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`RESOURCE_NOT_FOUND`·`DUPLICATE_NODE_LABEL`·`BOT_TOKEN_INVALID`·`TRIGGER_ENDPOINT_PATH_CONFLICT`·`AUTH_CONFIG_NOT_FOUND`·`INVALID_FIELD`): 전부 `error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 따름. 도메인 prefix 가 없는 코드(`VALIDATION_ERROR`·`RESOURCE_CONFLICT`)는 §1 이 명시한 "시스템 전역 공용 코드" 예외 범주에 해당해 위반이 아님.
- **비밀 마스킹 서술** (`***<last4>`, write-only 필드는 마스킹 패턴 미차용): `secret-store.md §1.1`("비대상 필드도 응답 바디에는 나가지 않는다") 인용이 실제로 해당 앵커·내용과 일치하며, secret-store.md 자체가 `AuthConfig` 마스킹 정책은 자신의 SoT 가 아니라 `1-data-model.md §2.17.2` 라고 명시한 carve-out 과도 target 서술이 정합.
- **문서 구조 (Overview/본문/Rationale)**: 세 파일 모두 별도 `## Overview` 헤더 없이 "> 관련 문서: [PRD 내비게이션](./_product-overview.md#...)" 로 시작하는데, `project-planner/SKILL.md` §명명 컨벤션이 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"로 Overview 책임을 위임하는 것을 정확히 허용하는 패턴이다. 세 파일 모두 말미에 `## Rationale` 보유. 파일명도 `N-name.md` 정렬 규칙 준수.
- **frontmatter 라이프사이클** (`status: partial` + `pending_plans:`): `spec-impl-evidence.md §2~3` 대조 결과 `1-workflow-list.md` 의 `pending_plans` 3건(완료 1 + 진행 2)은 §3.1 R-11 이 허용하는 "공유 트래커/부분 종결" 패턴과 일치하며, 이번 PR 이 추가한 `plan/in-progress/cross-workspace-refs.md` 는 실제로 그 경로에 존재하고 `spec_impact` 에 본 spec 파일을 정확히 등재해 Gate C 요건도 충족한다. `3-schedule.md` 는 `status: implemented` + `pending_plans` 없음으로 §3 표와 일치.

## 요약

이번 PR 의 실질 diff(`1-workflow-list.md` 의 workspace 소속 검사 추가)는 `spec/1-data-model.md §1.1`·`spec/5-system/2-api-convention.md §5.3` 등 실제 SoT 와 `details` 배열 표기·에러 코드·필드명(`folderId`/`parentId`) 모두 정확히 일치하며, 처음에 의심했던 "배열 vs 객체 표기 불일치"는 대조 결과 오히려 규약을 정확히 따른 것으로 확인됐다. `spec/conventions/**` 전반(에러 코드 명명, Swagger DTO/데코레이터 패턴, chat-channel enum, 감사 액션 명명, secret 마스킹, frontmatter 라이프사이클)과도 위반 없이 정합한다. 발견된 두 건은 모두 INFO 수준(비대칭 상세 어노테이션 1건은 diff 안, HTTP status 생략 표현 1건은 diff 밖의 기존 문구)으로, 어느 쪽도 구현 착수를 막을 사유가 아니다.

## 위험도

NONE

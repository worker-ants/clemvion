# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 대상: `0-dashboard.md` · `1-workflow-list.md` · `10-auth-flow.md` · `11-error-empty-states.md` ·
`13-user-guide.md` · `14-execution-history.md` · `15-system-status.md` · `16-agent-memory.md`
(모드: `--impl-prep`)

## 발견사항

- **[WARNING]** 실행 목록 API 경로가 URL 중첩 규약과 어긋남 (`resource/literal/:id` 패턴)
  - target 위치: `14-execution-history.md` §5 API 엔드포인트 표 — `GET /api/executions/workflow/:workflowId`
  - 위반 규약: `spec/5-system/2-api-convention.md` §2.2 (명명 규칙) — `{base_url}/api/{resource}/{id}/{sub-resource}` 패턴, "리소스는 복수형 명사", "중첩은 2단계까지"의 명시적 예시(`/api/knowledge-bases/:id/documents`, RPC sub-channel 예외 목록)에 이 형태(`resource/literal-segment/:id`, 부모-자식 순서가 뒤바뀐 `workflows/:id/executions` 대신 `executions/workflow/:workflowId`)는 포함되지 않음.
  - 상세: 이 경로는 신규 도입이 아니라 이미 구현된 기존 API(`executions.controller.ts`)이며, `api-convention.md` §8.2 자신도 이 경로를 각주로 인용하면서도 §2.2 URL 명명 규칙에는 예외로 등재하지 않았다. `3-workflow-editor/3-execution.md` 등 다른 spec 문서도 동일 경로를 재사용해 광범위하게 굳어진 패턴이라, 이번 target 문서가 새로 만든 드리프트는 아니다. 다만 "API endpoint 명명이 conventions 규칙과 일치하는가" 관점에서는 여전히 §2.2 표준 형태(`/api/workflows/:workflowId/executions` 또는 쿼리 필터 `/api/executions?workflowId=`)와 다르다.
  - 제안: (a) `api-convention.md` §2.2 예외 목록에 "부모 자원 미확정 조회 경로" 류로 이 형태를 공식 등재하거나, (b) 기술부채로 `plan/` 백로그에 남겨 추후 라우트 정리 시 표준 nesting 으로 이관한다. target 문서 자체를 지금 고칠 필요는 없음 — 실제 구현·다른 spec과의 정합이 우선.

- **[INFO]** `ExportWorkflowDto` 가 Swagger 응답 DTO 위치 규약과 다른 파일에 위치
  - target 위치: `1-workflow-list.md` §3.2 "Export/Import JSON 포맷" — "SoT: `import-workflow.dto.ts` / `ExportWorkflowDto`"
  - 위반 규약: `spec/conventions/swagger.md` §5-1 — "응답 DTO 위치: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`"
  - 상세: export 엔드포인트(`GET /api/workflows/:id/export`)의 응답 DTO인 `ExportWorkflowDto`가 `dto/responses/` 가 아니라 import 전용 파일(`import-workflow.dto.ts`)에 함께 선언돼 있다고 spec 이 정확히 서술하고 있다. spec 자체는 코드 현실을 사실대로 반영하고 있어 문서 오류는 아니지만, 그 근거가 되는 코드 배치가 swagger.md §5-1 위치 규약과 어긋난다.
  - 제안: 코드 리팩터링 시 `dto/responses/export-workflow-response.dto.ts` 로 분리 이관을 고려(구현 영역 작업이며 spec 수정 사항은 아님). 지금 당장 target 문서를 바꿀 필요는 없음 — 코드가 바뀌면 spec 의 SoT 경로도 함께 갱신.

- **[INFO]** 대시보드/시스템 상태 등 단수 명사 리소스 경로 — `api-convention.md` §2.2 "복수형 명사" 원칙과 표면적 불일치
  - target 위치: `0-dashboard.md` §7 (`/api/dashboard/summary` 등), `15-system-status.md` (`/api/system-status/overview`)
  - 위반 규약: `spec/5-system/2-api-convention.md` §2.2 "리소스는 복수형 명사"
  - 상세: `dashboard`·`system-status`는 CRUD 대상 컬렉션이 아니라 집계/뷰 성격의 가상 엔드포인트라, 복수형 명사 원칙이 문면 그대로 적용되지 않는다. 다만 이는 이미 `auth`·`system-status` 등에서 반복된 기존 패턴이며 `api-convention.md` §2.3 "시스템 전역 API 예외"에서 `system-status` 자체를 이미 예외로 다루고 있어(§2.3 표), 사실상 인정된 예외 범주다. `dashboard` 는 그 표에 명시적으로 없다.
  - 제안: 문제 삼을 정도는 아니나, `api-convention.md` §2.2 에 "집계/뷰 성격의 non-CRUD 엔드포인트는 단수 명사 허용" 을 명시적 예외 조항으로 추가하면 향후 유사 리뷰에서 반복 지적을 줄일 수 있다. 규약 갱신이 더 적절한 케이스로 판단.

## 준수가 확인된 항목 (참고 — 발견사항 아님)

- 프론트매터 스키마(`id`/`status`/`code:`/`pending_plans:`)가 8개 문서 전부 `spec-impl-evidence.md` §2·§3 규격을 정확히 준수. 특히 `16-agent-memory.md`의 `id: nav-agent-memory`는 동 컨벤션 §2.1이 예시로 든 "동일 basename 충돌 시 영역 prefix로 회피" 패턴(`spec/5-system/17-agent-memory.md`의 `agent-memory`와 충돌 회피)을 그대로 실증하는 사례.
- `1-workflow-list.md`의 `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]` 경로 실존 확인(`spec-pending-plan-existence.test.ts` 가드 통과 조건 충족).
- 에러 코드 사용이 `spec/conventions/error-codes.md` 카탈로그·historical-artifact 예외 레지스트리(§3)와 정확히 일치. `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`DUPLICATE_NODE_LABEL`은 `3-error-handling.md` catalog와 일치하고, `invitation_email_mismatch`·`invitation_expired`·`invitation_already_used`(lowercase)와 OAuth callback `invalid_state`·`token_exchange_failed`·`email_required`·`server_error`는 모두 §3 레지스트리에 등재된 명시적 예외이며, `10-auth-flow.md` §5.4가 스스로 그 레지스트리 앵커를 인용해 근거를 명시한 점은 규약 준수의 모범 사례.
- `13-user-guide.md` §8의 `<ImplAnchor>` prop 서술(kind enum 4종·file·symbol·describes)이 `spec/conventions/user-guide-evidence.md` §1.1·§1.2 정의와 정확히 일치.
- 각 문서가 Overview(도입 절) → 본문 → `## Rationale` 3섹션 구조를 일관 유지(CLAUDE.md 문서 구조 컨벤션 권장 사항 충족).
- Swagger DTO 응답 위치(`dto/responses/*-response.dto.ts`)를 프론트매터 `code:`에서 대부분 정확히 반영(`dashboard-response.dto.ts`, `execution-response.dto.ts` 등).

## 요약

`spec/2-navigation/` 대상 8개 문서는 정식 규약(`spec/conventions/**`) 준수 수준이 전반적으로 높다. 프론트매터 lifecycle 스키마, 에러 코드 명명·historical exception 레지스트리 인용, `<ImplAnchor>` prop 정의, 문서 3섹션 구조 등 핵심 축에서 CRITICAL 급 위반은 발견되지 않았다. 발견된 항목은 모두 기존에 이미 구현·정착된 API 경로/DTO 배치가 `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md`의 세부 명명 규칙과 표면적으로 어긋나는 WARNING/INFO 수준이며, 이번 target 문서가 새로 만든 드리프트가 아니라 기존 구현을 정확히 서술한 결과다. `--impl-prep` 게이트를 차단할 사유는 없다.

## 위험도

LOW

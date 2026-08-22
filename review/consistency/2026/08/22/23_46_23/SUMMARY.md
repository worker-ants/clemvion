# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. `execute-body-openapi`(`ExecuteWorkflowDto` OpenAPI 전용 DTO, `spec_impact: none`) 는 착수 가능한 상태.

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(신규 DTO 가 `swagger.md §1-4` 열린 map 표기를 안 따름), 나머지는 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신규 `ExecuteWorkflowDto` 의 `parameterValues`/`input` 필드가 `type: Object` 만 쓰고 `additionalProperties: true` 를 달지 않아 열린 map 표기 규약을 벗어남. 저장소 실측: `additionalProperties: true` 사용 DTO 38개 vs `type: Object`-only 2개(`re-run.dto.ts`, 신규 `execute-workflow.dto.ts`) — 소수 패턴을 교정 없이 답습 | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (`parameterValues`, `input`) | `spec/conventions/swagger.md §1-4` (열린/동적 map 표기) | `type: Object` → `{ type: 'object', additionalProperties: true }` 로 정정(최소 신규 파일만이라도). 또는 `swagger.md` 에 `type: Object` 축약형 허용을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | "문서화 전용 `@ApiBody` DTO(파라미터 타입과 분리)" 패턴이 `swagger.md` 에 아직 이름 붙여 등재되지 않음 — `ExecuteWorkflowDto` docstring·plan 트래커가 근거를 충분히 보존하고 있어 리스크는 낮음 | `plan/in-progress/execute-body-openapi.md`, `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` | `spec/conventions/swagger.md` §1 또는 §2 에 "문서화 전용 DTO — `@Body()` 인라인 타입 유지" 절 추가 고려(필수 아님) |
| 2 | convention_compliance | `spec/5-system/2-api-convention.md` 만 형제 문서(`1-auth.md`, `3-error-handling.md`)와 달리 로컬 `## Overview` 섹션이 없음 | `spec/5-system/2-api-convention.md` (타이틀 직후 바로 `## 1. 기본 원칙`) | `## Overview` 절 추가(1-auth.md 스타일) 또는 의도적 생략 유지(3섹션은 강제 아님) |
| 3 | convention_compliance | `3-error-handling.md §3.2` 절 제목("Route to Error Port 상세")이 실제 SoT 내용(`UPPER_SNAKE_CASE` 표기 규약)을 가리키지 않아 `error-codes.md` 의 인용을 절 제목만으로 찾기 어려움 | `spec/5-system/3-error-handling.md` line 313, 337 | 필드 정의 표 앞에 앵커용 소제목(예: `#### 에러 코드 표기 규약`) 추가 |
| 4 | convention_compliance | `ExecuteWorkflowDto.input` 필드 설명(86자 실측)이 `swagger.md §3` 길이 가이드(10~40자)를 넘지만 예외 사유(응답값 상이/요청값 정책거부) 어느 쪽에도 해당하지 않음 — swagger.md 자신의 Rationale 이 이미 40자 초과 34% 실측을 추인해 강한 위반은 아님 | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` `input` 필드 | 요약 1줄로 축소 + fallback 순서 상세는 별도 spec 링크로 위임(선택) |
| 5 | naming_collision | `ExecuteWorkflowDto.input`(레거시 봉투) 과 `ExecuteNodeDto.input`(직접 값, override) 이 같은 컨트롤러 문서 표면에서 동일 필드명·다른 의미로 최초 공식 노출됨. 각 description 이 이미 형태 차이를 명시해 혼선 위험은 낮음 | `ExecuteWorkflowDto.input` vs `ExecuteNodeDto.input` (둘 다 `codebase/backend/src/modules/workflows/`) | description 앞에 "(ExecuteNodeDto.input 과 무관·형태 다름)" 같은 상호 참조 추가(선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | RBAC·에러코드 카탈로그·swagger.md §3 DTO 길이 예외·§5.4 부재 표현·엔드포인트 참조 전부 정합. 대형 파일(4-execution-engine.md 등) 전수 대조는 예산상 미수행 |
| rationale_continuity | LOW | 마스킹 마커 가드 레이어 분리 원칙·re-run/execute 헬퍼 대칭성 무결. "문서화 전용 DTO" 패턴 미등재만 INFO |
| convention_compliance | LOW | 명명·출력 포맷·문서 인용 앵커 전반 정합. `type: Object` vs `additionalProperties: true` WARNING 1건 + 문서 가독성 INFO 다수 |
| plan_coherence | NONE | plan 이 미해결 결정(여분 키 거부)을 트래커로 명시적 이연, 선행 3개 PR 모두 머지 완료, diff 가 plan 서술과 정확히 일치 |
| naming_collision | NONE | 신규 식별자(`ExecuteWorkflowDto`, 파일 경로) 저장소 전체 grep 기준 충돌 없음. 기존 필드 재문서화뿐, `input` 필드명 중복은 INFO |

## 권장 조치사항
1. (선택, 권장) `execute-workflow.dto.ts` 의 `parameterValues`/`input` 을 `{ type: 'object', additionalProperties: true }` 로 정정 — 이번 PR 범위 확대가 부담되면 신규 파일만이라도 우선 적용하고, 기존 `re-run.dto.ts` 는 별도 후속 항목으로 등재.
2. (선택) `swagger.md` §1/§2 에 "문서화 전용 `@ApiBody` DTO(파라미터 타입과 분리)" 패턴을 짧게 등재해 향후 유사 사례의 참조점으로 남긴다.
3. (선택) `spec/5-system/2-api-convention.md` 에 `## Overview` 추가, `3-error-handling.md §3.2` 에 앵커용 소제목 추가 — 둘 다 필수 아님.
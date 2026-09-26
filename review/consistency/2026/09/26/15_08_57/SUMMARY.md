# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공(전문 확보), Critical 없음.

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(문서 표 커버리지 gap, 가드 자체는 완전), 나머지는 INFO(대부분 기존 트래커에 이미 등재된 참고 사항).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/conventions/swagger.md` §2-4 "상태 코드 응답 규칙" 표가 202/410/429 를 누락 — 같은 문서 §5-2(`ApiAcceptedWrappedResponse`)·§5-4 체크리스트, `spec/5-system/2-api-convention.md` §6 표, 실제 코드(6개 컨트롤러 `ApiAcceptedResponse`, 3개 컨트롤러 `HttpStatus.GONE`, 7개 컨트롤러 429)가 이미 이 코드들을 정식으로 다룸 | `spec/conventions/swagger.md` §2-4, 289~302행(표는 293~302행) | 같은 문서 §5-2(468행)·§5-4(514행), `spec/5-system/2-api-convention.md` §6(338~355행), 실제 컨트롤러 다수 | §2-4 표에 `202 \| @ApiAcceptedResponse` · `410 \| @ApiGoneResponse` · `429 \| @ApiTooManyRequestsResponse` 행 추가. 시행 가드(`http-status-advertised-guard.ts`)는 reflection 기반이라 동작엔 영향 없음 — 사람이 참고하는 표만 좁음. 이번 세션이 §2-4 를 막 편집한 커밋(`0186bea98`)의 연장으로 함께 처리 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `api-convention.md §6` 표가 "자원을 만들지 않는 POST 액션"의 200 사용을 아직 명문화 안 함 | `spec/conventions/swagger.md` §2-4 신설 Rationale (자인 서술) vs `spec/5-system/2-api-convention.md` §6 | 별도 조치 불필요 — `plan/in-progress/spec-draft-nullable-notation-followups.md`(L4881, planner/낮음)에 이미 등재. 그 항목 처리 시 §6 함께 갱신 |
| 2 | Rationale Continuity | 서비스 문장 이음 구두점 통일(`, 또는` → ` 또는 `) 결정이 plan 문서엔 근거와 함께 있으나 spec `## Rationale` 엔 미반영 | `spec/conventions/swagger.md` §5-4 Rationale | 구속력 없음. 다음 유사 결정 시 드리프트 재발 방지용으로 `forbiddenWithService` JSDoc 또는 §5-4 에 "guard-service 결합은 ` 또는 ` 단일 구두점" 한 줄 권장(이번 PR 필수 아님) |
| 3 | Convention Compliance | `## Overview` 3섹션 구성 미준수 (2026-04-14 부터 기존 상태, 이번 변경과 무관) | `spec/conventions/swagger.md` 전체 | 이번 PR 스코프 밖. `spec/conventions/` 전체 문서 위생 라운드에서 일괄 정리 권장(저장소 25개 중 13개가 동일 미준수) |
| 4 | Plan Coherence | `integrations.controller.ts` 의 `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 상수를 이번 plan 이 리터럴→헬퍼 호출 형태로 바꾸는데, 같은 상수가 `integration-personal-owner-followup.md` 항목 3(Viewer 권한 완화 시 손으로 재편집 예정)의 대상이기도 함 | `forbidden-helper-sentences.md` 실측 표 vs `integration-personal-owner-followup.md` 항목 3 | 차단 사유 아님(편집 축이 다름: 구두점 통일 vs 역할 가드). 급하지 않으면 생략 가능하되, 나중 착수 시 "이 자리는 `forbiddenWithService` 호출 형태로 바뀌어 있다"는 한 줄 메모 권장 |
| 5 | Plan Coherence | `workspaces.controller.ts` `removeMember` 가 이번 plan(403 설명)과 `spec-draft-nullable-notation-followups.md` L4867(200 vs 204 미결)의 공통 편집 자리 | `forbidden-helper-sentences.md` "바꿀 자리" vs `spec-draft-nullable-notation-followups.md` L4867 | 조치 불요 — 서로 다른 데코레이터/관심사(403 설명 vs 성공 코드), 실질 충돌 없음. 참고용 기록만 |
| 6 | Naming Collision | 신규 식별자 `forbiddenWithService(guard, service)` — 저장소 전역 grep 0건(자기 plan 문서 2곳 제외) | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (신설 예정) | 충돌 없음 — 그대로 진행 가능. `forbiddenForRole` 과 같은 `forbidden<수식어>` 계열이라 자연스러운 명명 |
| 7 | Naming Collision | `FORBIDDEN_` 접두가 이미 두 의미 영역에 존재(`mcp-client.service.ts` 의 `FORBIDDEN_HEADER_NAMES` vs 403 설명 상수들) | `codebase/backend/src/modules/mcp/mcp-client.service.ts:198` | target 이 유발한 충돌 아님(module-private, export 없음). 조치 불요 — 향후 `FORBIDDEN_` 접두 export 신설 시에만 재확인 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §2-4/§5-4 신설 Rationale 이 `data-flow/12-workspace.md`·`error-codes.md` 코드 레지스트리와 정합. 유일한 gap(POST 액션 200 미문서화)은 기존 트래커에 이미 등재 |
| Rationale Continuity | NONE | 공용 헬퍼 재사용·`NOT_A_MEMBER`/역할 코드 분리·"서비스 거부는 세지 않는다" 원칙 모두 기존 Rationale 과 일치, 무근거 번복 없음 |
| Convention Compliance | LOW | 명명·frontmatter 증거·참조 코드 전부 정합. §2-4 표가 202/410/429 를 누락(WARNING, 가드 자체는 완전) |
| Plan Coherence | LOW | 트래커 항목(L5081)을 처방대로 정확히 닫음. 인접 in-progress plan 과 파일은 겹치나 편집 축이 달라 실질 충돌 없음 |
| Naming Collision | NONE | 신규 식별자 1개(`forbiddenWithService`), grep 0건으로 충돌 없음. 나머지는 기존 식별자 재사용 |

## 권장 조치사항
1. (선택, 비차단) `spec/conventions/swagger.md` §2-4 표에 `202`·`410`·`429` 행 추가 — §5-2·§5-4·`api-convention.md §6`·실제 코드와 커버리지 일치. 이번 PR 에 포함해도 되고 별도 후속으로 미뤄도 무방(WARNING 이지 BLOCK 사유 아님).
2. (선택) `forbiddenWithService` 신설 시 JSDoc 에 "guard-service 결합은 ` 또는 ` 단일 구두점" 한 줄 남겨 향후 드리프트 방지.
3. (선택) `integration-personal-owner-followup.md` 항목 3, `spec-draft-nullable-notation-followups.md` L4867/L4881 착수 시 이번 plan 이 남긴 코드 형태 변화를 전제로 재확인.
4. 위 모두 비차단 — 현재 diff 는 그대로 진행 가능.

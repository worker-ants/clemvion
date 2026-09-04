# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 전문을 제출했고, CRITICAL 은 발견되지 않았다.

## 전체 위험도
**LOW** — target(`spec/5-system/`) 델타는 0이며, 실 diff(16파일/1262줄)는 이미 병합된 spec 정정(`cce8a188b`) 위에서 신규 AST 가드 추가 + 계약 거짓 9곳 DTO 정정 + repo-guard 인프라 리팩터로 구성. 유일한 실질 지적은 §5.4 "응답 바디 한정" 스코프 미문서화(WARNING)이며, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴 대기 항목으로 등재돼 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 아래 WARNING 은 CRITICAL 이 아니므로 이 표의 대상이 아니지만, 근본 조치(§5.4 본문 수정)는 `spec/` 쓰기가 필요해 developer 권한 밖이다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 턴 대기 항목으로 정확히 이월돼 있어 별도 인계 불요.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, cross_spec (중복 통합) | `spec/5-system/2-api-convention.md §5.4` 가 "응답 바디 전용" 스코프를 섹션 nesting 으로만 암시하고 본문에 명시하지 않아, 이번 세션 중 요청 DTO(`create-assistant-session.dto.ts` `llmConfigId`)에 §5.4 규칙을 오적용했다가 되돌린 실제 오독 사례가 있었다 | `spec/5-system/2-api-convention.md` `## 5. 응답 형식` → `### 5.4 부재 표현` | `create-assistant-session.dto.ts` (요청 DTO, PATCH tri-state 의미), CHANGELOG 상 이전 오기재 이력 | §5.4 본문에 "본 절은 응답 바디에 적용되며, 요청 바디의 PATCH tri-state(키 생략=불변/`null`=초기화/값=설정)에는 적용하지 않는다" 명시 문구 추가. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 체크리스트에 `[ ]` 미착수 항목으로 등재돼 있음(`--impl-done 11_33_21 cross_spec` 기원) — 다음 planner 턴에서 반영 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | `spec-draft-nullable-notation-followups.md` "종결 조건" 절이 형제 plan(`entity-nullable-column-type-mismatch.md`)의 완료·체크박스 해제를 이미 선행 집행됐음에도 여전히 미래 지시형("옮길 때 함께 닫는다")으로 서술 | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 종결 조건` | "이미 반영됨(cce8a188b, 2026-09-04)"으로 갱신. 내용 무결성엔 영향 없음, 우선순위 낮음 |
| 2 | convention_compliance | DTO nullable/optional 표기 정정 9곳(`background-run-response.dto.ts` 8 + `create-assistant-session.dto.ts` 1)이 §5.4·`swagger.md §1-3/§1-4` 규약과 정확히 일치함을 양성 확인 | `codebase/backend/src/modules/executions/background-runs/dto/`, `.../workflow-assistant/dto/` | 조치 불요 — 준수 확인 기록 |
| 3 | cross_spec | `BackgroundRunResponseDto` 8필드 수정이 `spec/4-nodes/1-logic/12-background.md` 응답 예시·표(전부 `T \| null` 상시존재)와 정확히 일치함을 직접 대조로 재확인 — 수정 전 코드가 오히려 spec 과 어긋나 있었다 | `spec/4-nodes/1-logic/12-background.md:226-245` | 조치 불요 — 준수 확인 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0. 이전 회차(11_33_21) §5.4 WARNING 은 CHANGELOG 정정+plan 이월로 실질 해소, 잔여 spec 본문 수정만 planner 대기(정상 이월). `BackgroundRunResponseDto` 수정을 spec 원문과 재대조해 정합 확인 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·암묵 가정 충돌 4관점 전부 무충돌. 신규 zero-tolerance 가드와 §5.4 "소급 적용 대상 아님" 조항의 잠재 긴장은 plan 이 "타입 거짓말(가드 대상)" vs "스타일 drift(103곳, 별도 배치 이월)" 로 이미 실측 기반 해소 |
| convention_compliance | LOW | §5.4 스코프 미문서화 WARNING 1건(기존 트래킹 항목 재확인, 신규 아님). DTO 정합화·§2.2 신규 예외 조항 모두 규약 준수 양성 확인 |
| plan_coherence | LOW | target 델타 0, 형제 plan 완료 상태와 체크박스 전수 대조 결과 정합. "종결 조건" 절 미래형 서술 staleness 1건(INFO)만 |
| naming_collision | NONE | 신규 식별자 전부 저장소 내부 repo-guard/테스트 인프라(`toPosixPath`, `ContractMismatch` 등)로 spec 레벨 명칭과 충돌 없음. 신규 가드 파일 쌍도 기존 형제 guard 명명 컨벤션 준수 |

## 권장 조치사항
1. (우선) `spec/5-system/2-api-convention.md §5.4` 본문에 "응답 바디 한정, PATCH tri-state 요청 DTO 는 대상 아님" 명시 문구 추가 — 다음 planner 턴(`spec/` 쓰기 필요, developer 권한 밖). `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 체크리스트에 이미 등재된 항목을 그대로 집행하면 됨.
2. (선택, 낮은 우선순위) `spec-draft-nullable-notation-followups.md` "종결 조건" 절의 서술 시제를 실제 집행 순서에 맞게 갱신.
3. 그 외 조치 불요 — 이번 diff(신규 swagger-dto-contract 가드, 9곳 DTO 계약거짓 정정, repo-guard 인프라 리팩터)는 규약·spec·plan 전 축에서 정합성이 실측 확인됨.
# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 success, CRITICAL/WARNING 없음. 모두 INFO 또는 위험도 NONE/LOW.

## 전체 위험도
**NONE** — target(`plan/in-progress/spec-draft-window1-measured.md`)은 이미 구현·병합된 동작(#1341~#1343)을 spec 에 반영하는 좁은 범위의 사실 정정 draft이며, 5개 checker 모두 CRITICAL/WARNING 없이 참고용 INFO만 보고했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | CASCADE 500 이 카탈로그 상 신규 코드 아님(§5.3 기본값 이미 존재) | target A3, §3 ⚠️ 교체 / chat-channel §5.4 404 행 | 조치 불필요. 추후 500→전용 코드 승격 시 §1.1/§1.12 카탈로그 등재 필요함을 후속 항목에 기록 |
| 2 | cross_spec | `revoke-token` 쪽 에러 표 미신설 결정은 EIA/data-flow 문서 현황과 부합 | Rationale "revoke-token 쪽에 에러 표를 만들지 않은 이유" | 조치 불필요 |
| 3 | cross_spec | camelCase(`notificationSecretV2` 등) vs DB snake_case 표기 차이는 기존 규약(API camelCase/DB snake_case) 준수 | A3 ⚠️ 교체 문단 | 조치 불필요 |
| 4 | rationale_continuity | `trigger-config-lock.ts` JSDoc "창 1→404" 행과 target의 "창 1→500" 문장이 실은 서로 다른 하위 창(락 안 재읽기 실패 vs 재읽기 후 저장 시점 CASCADE)을 가리켜 표면상 오독 여지 | target A3 / §3 본문 | (선택) "두 경우는 서로 다른 하위 창" 한 문장 추가해 교차 오독 예방 — 필수 아님, 병합 차단 사유 아님 |
| 5 | rationale_continuity | 자매 e2e `trigger-config-lost-update.e2e-spec.ts` 가 "e2e 고정 시 등재" 원칙 적용 대상인지 불명확 (target 스코프 밖) | frontmatter `code:` | 이번 draft 처리 불요. 향후 §3 본문에 lost-update 보장의 e2e-고정 claim 이 생기면 그때 등재 필요함을 기록 |
| 6 | rationale_continuity | `revoke-token` 에러 표 미신설이 "적용 범위는 열거" 원칙과 성격은 다르나(신설 vs 커버리지 명확화) 결이 다름 | Rationale 절 | 참고용 기록, 조치 없음 |
| 7 | plan_coherence | target 은 트래커 3항목을 문구 수준까지 정확히 이행, (a)(b) 파생 발견도 스코프 내 흡수 | `## 착수 전 실측`, `### 3 을 재다가 나온 둘` | 실제 적용 시 트래커 표 3행에 (a)(b) 요약 반영 — target의 `## 반영 후 검증` 계획대로 진행하면 충족 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 신규 엔티티/계약/요구사항 ID 없음. 500은 §5.3 기존 기본값, revoke-token 표 미신설도 문서 현황과 부합. 코드 사실(부분 save, 23502/23503, 404 호출부 2곳) 전부 일치 확인 |
| rationale_continuity | LOW | 핵심 주장은 `#1343` 실측·e2e 단언과 문자 그대로 일치, 기존 Rationale 어떤 항목도 번복하지 않음. JSDoc 오독 여지·자매 e2e 등재 애매함은 INFO |
| convention_compliance | NONE | 새 에러 코드 신설 없음(기존 카탈로그 기본값), frontmatter/파일명/문서 구조 모두 plan-lifecycle·SKILL 관례 준수. 코드 사실관계(호출부 개수 등) 검증 완료 |
| plan_coherence | NONE | 부모 트래커 3항목을 문구 수준까지 정확히 이행. 선행 plan(#1343) 이미 complete. 다른 in-progress plan 과 충돌/중복 없음. 미결정 사안(500 승격) 스스로 미결정으로 유지 |
| naming_collision | NONE | 신규 식별자(요구사항 ID/엔티티/endpoint/이벤트명/env/파일) 도입 없음. 언급된 모든 심볼·endpoint·파일이 기존 코드/spec 에 이미 실재 |

## 권장 조치사항

1. (선택, 비차단) target A3 또는 §3 본문에 "락 안 재읽기 자체가 비는 경우(404)와 재읽기 뒤 저장 시점 CASCADE(500)는 서로 다른 하위 창"이라는 구분 문장을 추가해 `trigger-config-lock.ts` JSDoc과의 교차 오독을 예방한다.
2. 이번 draft 를 spec 에 반영한 뒤, 부모 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 표 3행에 (a)(b) 파생 발견(revoke-token 이중 endpoint, 심볼-only 인용 정정) 요약을 기록하고 해당 항목을 체크한다.
3. 향후 CASCADE 500 을 전용 코드(404/409 등)로 승격하기로 결정되면, 그때 `spec/5-system/3-error-handling.md` §1.1/§1.12 카탈로그 등재가 필요함을 후속 plan 항목으로 남겨둔다.
4. 필수 조치 없음 — 5개 checker 전원 BLOCK 사유 없음, 병합 진행 가능.
# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, WARNING 1건, INFO 8건)

대상: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` (spec_impact: `spec/1-data-model.md` ·
`spec/5-system/12-webhook.md` · `spec/2-navigation/2-trigger-list.md` · `spec/5-system/3-error-handling.md` ·
`spec/data-flow/10-triggers.md`)

## 전체 위험도
**LOW** — spec-vs-spec 모순·plan 충돌·명명 충돌은 없다. 유일한 WARNING 은 spec 텍스트가 아니라 "구현 단계에서
놓치면 spec 이 약속한 응답 계약이 깨지는" 기존 코드의 좁은 predicate 하나이며, 이는 developer 착수 시
`--impl-prep` 스코프로 자연스럽게 걸러진다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 서비스 계층 predicate 가 제약 이름 하나(`idx_trigger_endpoint_path`)로 좁혀져 있어, 새 테이블 `webhook_endpoint_reservation` 에서 발생하는 `unique_violation`(제약 `webhook_endpoint_reservation_owner`)을 인식하지 못하면 409 `RESOURCE_CONFLICT` 대신 처리되지 않은 예외(사실상 500)로 나간다 — 함수 자신의 JSDoc 이 "이름이 바뀌면 계약이 조용히 좁아진다" 고 경고 | draft `## 설계` "제약 이름 `webhook_endpoint_reservation_owner` — 서비스가 기존 `idx_trigger_endpoint_path` 위반과 함께 위의 409 로 옮긴다" | `codebase/backend/src/modules/triggers/triggers.service.ts` `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(228~239행) + `isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict`(1654~1679행) | draft `## 변경` 또는 `## 설계` 절에 "`isEndpointPathUniqueViolation` 이 `idx_trigger_endpoint_path` **또는** `webhook_endpoint_reservation_owner` 를 모두 인식하도록 넓힌다" 를 명시적으로 지목해 developer `--impl-prep` 스코프에 이 파일이 들어가게 한다 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/data-flow/10-triggers.md` §2.1 Schema 매핑 표에 `webhook_endpoint_reservation` sink 행 없음 | draft `## 변경 E` | 표에 `webhook_endpoint_reservation \| 트리거 생성·endpoint_path 변경(DB 트리거) \| INSERT … ON CONFLICT DO NOTHING \| PK(endpoint_path)·unique_violation(webhook_endpoint_reservation_owner)` 행 추가 |
| 2 | cross_spec | 신규 엔티티가 이 문서 25개 엔티티 전부와 달리 UUID 대리키 없이 자연키(`endpoint_path`)를 PK 로 사용 — 의도인지 누락인지 다음 리뷰어가 헷갈릴 수 있음 | draft `## 설계` `webhook_endpoint_reservation` 필드 정의 | §2.8.1 신설 시 "PK 가 곧 예약 대상 경로이므로 별도 id 가 무의미하다" 한 줄을 Rationale 또는 필드 표 옆에 명시 |
| 3 | rationale_continuity | `workspace_id` FK ON DELETE SET NULL 이 §2 FK 삭제 동작 표기 컨벤션(2026-09-19, 축약형 `(CASCADE)`/`(SET NULL)`)을 §2.8.1 표에서 따르는지 draft 본문에 명시 안 됨 | `## 설계`, `## 변경 A` | `## 변경 A` 에 "§2.8.1 표는 §2 FK 삭제 동작 표기 컨벤션(2026-09-19)의 축약형을 따른다" 한 줄 추가 |
| 4 | rationale_continuity | "묘비" 대안이 `spec/1-data-model.md` «Webhook endpoint_path 전역 유일 (2026-09-18)» 이 예고한 "남는 틈"에 대한 정식 답임을 §2.8.1 Rationale 에서 역참조하면 연속성이 더 뚜렷해짐 | `## 왜`, `## 사용자 결정 (2026-09-19)` | §2.8.1 Rationale 신설 지시에 "2026-09-18 절이 예고한 tombstone 필요성에 대한 답" 역참조 문구 추가 |
| 5 | convention_compliance | DB 트리거가 `RAISE EXCEPTION ... USING CONSTRAINT`로 붙이는 합성 이름 `webhook_endpoint_reservation_owner` 가 실재 DB 오브젝트가 아니라 논리적 라벨(PK 는 이미 `(endpoint_path)` 하나뿐)인데, `idx_trigger_endpoint_path`(실재 인덱스)와 같은 매칭 메커니즘으로 서술돼 오독 여지 | `## 설계` 다섯째 불릿 | 구현 절에 "실제 DB 제약이 아니라 트리거가 raise 시 붙이는 논리적 라벨" 임을 한 문장 명시 |
| 6 | convention_compliance | `TRIGGER_ENDPOINT_PATH_CONFLICT` 의미를 "다른 워크스페이스가 예약한 경로" 까지 확장하는 근거(정보 노출 방지)가 `error-codes.md` §3 예외 레지스트리에는 등재 안 됨(레지스트리는 "이름이 부정확한" 경우만 다룸) | `## 설계` 둘째 불릿, `## 변경 D` | `spec/5-system/3-error-handling.md` §1.10 본문에 "두 조건을 하나의 코드로 묶은 이유(정보 노출 방지)" 를 그대로 반영 — 레지스트리 신규 행은 불필요 |
| 7 | plan_coherence | 선행 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md:4644-4649` 의 `[ ]` 가 아직 미체크 — draft 자신의 체크리스트가 예정한 정상 단계이지 누락 아님 | 트래커 4644-4649행 | draft 가 `plan/complete/` 로 이동될 때 같은 커밋에서 트래커도 `[x]` + 해소 문구로 갱신되는지 후속 세션에서 확인 |
| 8 | naming_collision | 신설 DB 트리거(BEFORE INSERT OR UPDATE OF endpoint_path)의 이름이 draft 본문에 미지정 — 기존 `trg_<table>_updated_at` 컨벤션과 충돌 위험은 낮으나 명시 없음 | `## 설계` | 트리거 이름을 `trg_trigger_endpoint_path_reservation` 등으로 명시하거나 최소 "기존 `trg_trigger_updated_at` 과 별개" 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 좁혀진 predicate 확장 필요(WARNING) + 표 완결성·PK 설계 명시 INFO 2건 |
| rationale_continuity | LOW | 위반 없음 — FK 표기 확인, tombstone 역참조 보강 INFO 2건 |
| convention_compliance | LOW | 위반 없음 — RAISE 라벨 명료화, 에러코드 레지스트리 미등재 INFO 2건 |
| plan_coherence | NONE | 트래커 4개 미해결 결정 전부 충돌 없이 해소, 앵커/마이그레이션 번호 미선점 |
| naming_collision | NONE | 신규 식별자 전부 grep 0건, 트리거 이름 미지정 INFO 1건 |

## 권장 조치사항
1. (WARNING 해소, 최우선) draft `## 설계`/`## 변경` 절에 `isEndpointPathUniqueViolation`/`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 확장 필요성을 명시해 developer `--impl-prep` 스코프가 `triggers.service.ts` 를 포함하도록 한다.
2. `spec/data-flow/10-triggers.md` §2.1 표에 `webhook_endpoint_reservation` sink 행 추가.
3. §2.8.1 신설 시: UUID 미사용 이유, FK 표기 축약형 컨벤션 준수, tombstone 역참조 문구를 Rationale 에 함께 반영.
4. `spec/5-system/3-error-handling.md` §1.10 본문에 코드 통합(정보 노출 방지) 근거 명시.
5. DB 트리거 이름과 RAISE 라벨의 성격(논리적 vs 실재 제약)을 §2.8.1 또는 구현 절에 명시.
6. draft `plan/complete/` 이동 시 트래커 `spec-draft-nullable-notation-followups.md:4644-4649` 체크박스 동시 갱신 확인.

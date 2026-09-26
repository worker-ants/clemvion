# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 전문 확보, Critical 0건.

## 전체 위험도
**NONE** — spec 델타 0(`swagger.md` §5-4 는 직전 커밋에서 이미 merge), 이번 diff(6파일/506줄)는 그 규약을 강제하는 저장소 가드·대조군만 추가. 5개 관점 전부 위반 없음, INFO 4건만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | §5-4 요청 본문 스키마 Rationale 절에 "기존 라우트까지 소급 적용한다"는 명시 문장이 없음 — 인접 §5-4 403코드 절은 이 문장을 별도로 명시하는데 본 절만 비대칭. 결과(베이스라인 0·전수 스캔)는 이미 소급 적용 중이라 모순은 아니나, 다음 사람이 스스로 재구성해야 함 | `spec/conventions/swagger.md` `## Rationale` → "§5-4 요청 본문 스키마" 절 | §5-4 403코드 절의 마지막 항목과 동형인 한 문장("기존 라우트까지 소급한다…")을 추가 — 비차단, 다음 편집 시 반영 권장 |
| 2 | plan_coherence | 트래커 항목의 판정 축 표기가 아직 "AST" 로 남아 있음(target 문서 자체는 이미 정확히 "reflection" 으로 기술됨) — 뒤처진 쪽은 plan 트래커 서술뿐 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5150` (트래커 항목 2) | 조치 불요 — `plan/in-progress/request-body-guard.md` 체크리스트의 예정된 마지막 단계("트래커 항목 좁히기: AST→reflection 정정, 항목 1·2 닫고 §1-7·리네임만 남김")를 이번 PR 마무리 커밋에서 수행하면 해소 |
| 3 | plan_coherence | §1-7 요청 DTO 명명(`<Domain><Action>RequestDto` 접미 유무) 결정을 target 이 이번 변경에서 의도적으로 보류 — 충돌 아님, 계획 경계 준수 확인 | `spec/conventions/swagger.md` §5-4 신규 체크리스트 항목 vs `plan/in-progress/spec-draft-nullable-notation-followups.md:5147-5149` | 조치 불요 — 향후 §1-7 명명 결정 시 `ExecuteWorkflowDto`(접미 없음)·`ContinueExecutionRequestDto`(접미 있음, 어순 반대) 두 선례 공존을 그 결정 턴에서 재확인 |
| 4 | cross_spec | `swagger.md` 는 자신의 절을 `§5-4`(대시), `2-api-convention.md` 는 `§5.4`(점)로 표기 — 같은 숫자, 다른 구분자. 상호 참조가 이미 명시적으로 구분 인용하고 있어 실제 혼동 사례는 없음 | `spec/conventions/swagger.md` §5-4 vs `spec/5-system/2-api-convention.md` §5.4 | 조치 불요 — 신규 위반 아님, 정보성 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 델타 0, 가드가 다루는 3라우트(rotate-bot-token·execution continue·webhook 수신) 모두 기존 spec 계약과 그대로 일치. `CustomValidationPipe` 리팩터는 동작 보존적 |
| Rationale Continuity | NONE | 신설 Rationale 이 실제 작업 이력(트래커·3회 consistency-check·2회 code-review)을 정확히 반영. AST→reflection 번복은 근거 명시된 정상 사례. "클래스 승격" 기각도 R-CC-18/21 과 정합. 인접 절 대비 소급 문장 누락만 INFO |
| Convention Compliance | NONE | 파일·식별자 명명(`scan<Topic>`/`<Topic>Violation`/`<Topic>Scan`, `-guard.ts`+`.spec.ts`)이 기존 `repo-guards/__tests__` 패밀리와 정확히 일치. §5-4 체크리스트·Rationale 과 구현이 1:1 대응 |
| Plan Coherence | NONE | 상위 트래커 항목 1·2 를 정확히 구현, 인접 확정 결정(`execute-body-dto`)과 정합. 잔여 정정은 이미 자체 체크리스트에 예약됨 |
| Naming Collision | NONE | 신규 식별자(`UNVALIDATED_METATYPES`·`bodyArgIndexes`·`scanRequestBodyAdvertised`·`RequestBodyViolation`·`RequestBodyScan` 등) 전수 grep 대조, 기존 사용처와 의미 충돌 없음. `SWAGGER_EXCLUDE_ENDPOINT`/`SWAGGER_EXCLUDE_CONTROLLER` 재선언은 형제 가드와 동일 값의 기존 "가드마다 복제" 관행 반복 |

## 권장 조치사항

1. (비차단, 권장) `plan/in-progress/request-body-guard.md` 체크리스트의 예정된 마지막 단계 — 트래커(`spec-draft-nullable-notation-followups.md:5150`) 판정 축 표기를 "AST"→"reflection" 으로 정정하고, 항목 1·2 를 닫아 §1-7 명명 + 3(어순 리네임)만 남기도록 좁힌다.
2. (비차단, 권장) `spec/conventions/swagger.md` §5-4 요청 본문 스키마 Rationale 절에 "기존 라우트까지 소급 적용한다"는 문장을 §5-4 403코드 절과 동형으로 추가한다.
3. 그 외 조치 불요 — Critical/Warning 없음, 5개 checker 모두 NONE 위험도로 수렴.

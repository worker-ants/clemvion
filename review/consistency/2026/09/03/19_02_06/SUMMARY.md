# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `spec/5-system/` scope 델타 0(코드 전용 PR), 실제 diff(엔티티/DTO nullable 타입 정합화 배치 3, 10파일/152줄)는 5개 checker 전원 NONE 판정. 위반 없음, INFO 3건(위생 개선 권고)만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `null`-present 필드의 DTO 선언 패턴이 파일 내에서 두 갈래(`ipWhitelist`는 이번 diff로 `@ApiPropertyOptional({nullable:true})`+`field?: T\|null`, `sourceIp`는 기존 `@ApiProperty({nullable:true})`+`field: T\|null`) — §5.4 규약 문면의 "상시 존재"(null) 정의와 `field?:`(may-be-absent) 표기가 다소 어긋나 보임 | `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` (`AuthConfigDto.ipWhitelist` L27-28 vs `AuthConfigUsageCallDto.sourceIp` L84-88); 규약: `spec/5-system/2-api-convention.md §5.4`, `spec/conventions/swagger.md §1-3` | 이번 diff는 §5.4 문면을 정확히 따랐으므로 되돌릴 필요 없음. planner 턴에서 (a) `sourceIp`를 `ipWhitelist` 패턴에 맞추거나 (b) §5.4 문장의 `field?:` 표기를 non-optional로 정정해 `sourceIp` 선례에 맞추는 정리를 권고 |
| 2 | convention_compliance | `/api/auth/*` 액션 네임스페이스가 §2.2 명명 예외 목록에 없음 — 본 diff와 무관한 선재 gap, 이미 plan에 planner 턴 후속으로 등재됨 | `spec/5-system/2-api-convention.md §2.2`; `plan/in-progress/entity-nullable-column-type-mismatch.md` §할 일 | 신규 조치 불요 — 중복 등재 방지 목적의 확인 기록 |
| 3 | plan_coherence | DTO↔엔티티 nullable 불일치 잔여 축(48건/26파일)이 `## 할 일` 체크박스가 아니라 `## 배치 3` 절 산문 서술로만 존재 — plan이 `complete/`로 이동하면 후속 세션이 놓칠 위험 | `plan/in-progress/entity-nullable-column-type-mismatch.md` §"새로 드러난 축"; 근거 규약 `spec/5-system/2-api-convention.md §5.4` | 코드 변경 불요. `## 할 일`에 "DTO↔엔티티 nullable 대조 가드 신설 + 48건 귀속 정리"를 명시적 미해결 체크박스로 승격하거나 별도 in-progress plan으로 분리 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | diff는 6개 엔티티(+1 응답 DTO)의 TS 타입을 `spec/1-data-model.md`가 이미 문서화한 `?` nullability에 맞춘 정합화. `AuthConfigDto.ipWhitelist`의 `nullable:true` 선언은 §5.4·swagger.md §1-3과 정확히 일치. 모순 없음 |
| rationale_continuity | NONE | spec 문서 변경 0, 저장소가 이미 확립한 동일 클래스 선례(`Execution.error`, `llm-usage-log.*`)를 계승. §5.4 규칙의 "신규·변경 필드 적용" 조건에 정확히 부합해 위반 아닌 준수로 확인. 기각된 대안 재도입·번복 없음 |
| convention_compliance | NONE | 정식 규약 위반 없음. `AuthConfigDto.ipWhitelist`는 §5.4 문면 그대로 준수. INFO 2건(표기 갈래·선재 gap 중복방지)만 |
| plan_coherence | NONE | plan `spec_impact`(`spec/1-data-model.md`·`spec/data-flow/10-triggers.md`·`spec/5-system/2-api-convention.md`) 각각에 대응하는 planner 턴 후속 항목이 실제로 존재하며 미해소 상태를 정확히 반영. 미해결 결정과의 충돌 없음. INFO 1건(잔여 축 추적 위생) |
| naming_collision | NONE | 신규 파일 없음(전량 `M`), 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 도입 없음. 검토 대상 자체가 존재하지 않음 |

## 권장 조치사항
1. (BLOCK 아님, 선택 권고) planner 턴에서 `spec/5-system/2-api-convention.md §5.4`의 `field?:` 표기와 `AuthConfigUsageCallDto.sourceIp` 기존 선언 간 불일치를 정리 — `ipWhitelist`/`sourceIp` 패턴 통일 또는 규약 문면 정정.
2. `plan/in-progress/entity-nullable-column-type-mismatch.md`의 잔여 48건/26파일 DTO↔엔티티 nullable 불일치 축을 `## 할 일` 명시적 체크박스로 승격(또는 별도 plan 분리)해 plan 종결 시 누락 방지.
3. plan이 이미 위임한 두 planner 턴 후속(`spec/1-data-model.md §2.9 next_run_at`, `2-api-convention.md §2.2 /api/auth/* 네임스페이스 예외`)은 본 검토에서 신규 결함으로 등록하지 않음 — 기존 위임 유지.

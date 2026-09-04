# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음(5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**MEDIUM** — CRITICAL 급 충돌은 없으나, `spec/conventions/swagger.md` §1-4 의 정본 예제가 target ③
의 §5.4 신규 규칙과 어긋난다는 동일 결함을 **3개 checker(cross_spec·convention_compliance·
plan_coherence)가 독립적으로 지목**했다 — 반영 전 정정을 권장.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — target 자체가 planner draft 이며 발견된 Critical 이 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, plan_coherence (3중 확인) | ③ §5.4 정정 후에도 `spec/conventions/swagger.md` §1-4 의 "닫힌 union" 정본 예제(`ExecutionStatusDto.context` 등, `execution-status-response.dto.ts`)가 새 규칙이 폐기하는 옛 패턴(`@ApiPropertyOptional({nullable:true})`+`field?:`)을 그대로 시연 | `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ 변경안 | `spec/conventions/swagger.md` §1-3/§1-4 | `spec_impact` 에 `spec/conventions/swagger.md` 추가, §1-4 예제를 신규 규칙에 맞게 교체하거나 "상시 존재 필드는 §5.4 참조" 각주 추가 |
| 2 | cross_spec | ② 가 §2.2 를 편집하며 `/api/auth/*` 예외는 성문화하지만, 같은 절의 인접 갭(단일 동사 action 패턴 미문서화, `3-workflow-editor/3-execution.md:757` 이 이미 존재를 전제)은 방치 | `plan/in-progress/spec-draft-nullable-notation-followups.md` ② 변경안 (L73-86) | `spec/5-system/2-api-convention.md` §2.2, `spec/3-workflow-editor/3-execution.md:757` | 범위를 넓히거나, Rationale 에 "별도 후속으로 분리" 한 줄 명시 |
| 3 | cross_spec | ② 의 "verb-style 20개" 실측에서 `GET /api/auth/oauth/:provider`(OAuth 시작) 및 `GET /api/auth/2fa/webauthn/availability`(read-only capability 조회) 최소 2건 누락 — 신설 예외 문구("상태 전이") 로는 이 두 경로가 포섭되지 않음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` ② 실측 표 (L56-72) | `spec/5-system/1-auth.md:179, 505-507`, `auth.controller.ts:520`, `webauthn.controller.ts:77` | 실측 표에 두 경로 추가, 예외 문구를 "상태 전이 또는 인증 관련 read-only capability 조회"로 확장하거나 별도 사유 추가 |
| 4 | cross_spec | ① 이 손대는 `next_run_at` 관련, 같은 문서 §3 인덱스 전략 표의 "스케줄러 다음 실행 대상 조회" 서술이 `data-flow/10-triggers.md` 의 BullMQ-only(폴링 없음) 아키텍처 및 draft 자신의 §3.2 인용과 이미 모순 | `plan/in-progress/spec-draft-nullable-notation-followups.md` ① 변경안 (L39-52) | `spec/1-data-model.md` §3 인덱스 전략 표, `spec/data-flow/10-triggers.md` §1.3 | ① 범위에 이 인덱스 설명 정정(또는 "레거시 서술" 각주) 포함, 최소 후속 항목으로 기록 |
| 5 | convention_compliance | ③ "70 vs 16" drift 규모 실측에 집계 기준(glob·정규식·§1-4 닫힌 union 제외 여부) 미기재 — 재현 시 102 vs 17 로 절대값 상이(방향은 일치). `swagger.md` §3 Rationale 이 명시적으로 경고한 동일 실수 재발 | `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ 저장소 실측 표 (L145-152) | `spec/conventions/swagger.md` §3 Rationale ("집계 기준을 적어 둔다") | 대상 glob·분류 기준·매칭 정규식을 각주로 명시 |
| 6 | plan_coherence | ③ 이 "기존 70곳, 소급 면제" 로 뭉뚱그린 대상 중 2건(`AuthConfigDto.ipWhitelist`, `WorkspaceInvitationDto.invitedBy`)은 **이 draft 가 참조하는 형제 plan(`entity-nullable-column-type-mismatch.md`) 이 바로 이 세션에서 방금 §5.4 옛 문면대로 만든 것** — 연혁·건수 특수성이 반영되지 않음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ "마이그레이션은 강제하지 않는다" 절 | `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3 (커밋 `af1651264`), `auth-config-response.dto.ts:27-28`, `workspace-response.dto.ts:109-110,154-155` | target 본문에 이 2건을 "형제 plan 최신 인스턴스" 로 명시하고, 이번 PR 에서 함께 고칠지 70곳 배치에 남길지 결정을 기록 |
| 7 | naming_collision (WARNING), convention_compliance (INFO 병기) | ② 신설 예외명 "인증 액션 네임스페이스"가 기존 예외명 "인증 family 전용 네임스페이스"와 표면상 유사해 §2.2 표에서 혼동 가능(대상은 `/api/auth/*` vs `/api/external/*` 로 실제로는 다름) | `plan/in-progress/spec-draft-nullable-notation-followups.md` ② 변경안 (신규 세 번째 예외 행) | `spec/5-system/2-api-convention.md:54` 기존 예외 행 | 신규 예외명에서 "인증" 공유 접두 제거 — 예: "예외 — 인증 상태 전이 액션" |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | ③ 이 인용하는 "§5.4 소급 면제 조항"의 원문 적용 범위는 "키 생략 필드의 사유 문구 면제"로 좁은데, target 은 이를 "null 표현 필드의 DTO 코드 형태" 까지 유추 적용 — 결론 자체는 `swagger.md` §1-4 "적용 범위 — 신규 변경 한정"과 동형이라 위험은 낮음 | ③ "마이그레이션은 이 문서가 강제하지 않는다" 인용 블록 | §5.4 정정 시 소급 면제 범위를 "DTO 선언 형태" 까지 명시 확장하거나 draft 에 "유추 적용" 명기 |
| 2 | cross_spec | ① NULL 공식화 이후 `spec/2-navigation/3-schedule.md` §2.1 "다음 실행 시각" 열에 NULL 표시 규칙 없음(FE 코드는 이미 `"-"` 방어 처리 중이라 동작 위험은 없음) | ① 변경안 (L44-52) | §2.1 표에 "값 없으면 `-` 표시" 한 줄 추가(급하지 않음) |
| 3 | plan_coherence | target 완료(→`complete/` 이동) 시 형제 plan `entity-nullable-column-type-mismatch.md:182,190,261` 세 체크박스 및 상단 경고문 동기화 지점이 target 본문에 명시돼 있지 않음 | target 전체 | target 종결 조건에 형제 plan 체크박스 동기화 명시 |
| 4 | convention_compliance | 1차 번들이 컨텍스트 예산 초과로 `spec/conventions/swagger.md`·`migrations.md`·`error-codes.md`·`spec-impl-evidence.md` 를 절단(이번 검토는 저장소 직접 조회로 보완, 결론 영향 없음) | 리뷰 파이프라인 | orchestrator 가 `--spec` 예산 산정 시 `spec_impact` 와 이름이 겹치는 `spec/conventions/*.md` 우선순위 앞당김 고려 |
| 5 | naming_collision | `entity-nullable-column-type-mismatch.md:192` 의 "§2.2 명시된 두 예외" 서술이 target 반영 후(3개로) stale 해질 수 있음(spec 본문 자체는 문장으로 개수를 세지 않아 자기모순은 아님) | 부수 효과 | 별도 조치 불요 — 필요 시 해당 plan 소유자가 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | swagger.md 정본 예제 drift, §2.2 인접 갭 방치, verb-style 실측 누락 2건, §3 인덱스 서술 모순 — CRITICAL 없음, 인접 drift 4건 |
| rationale_continuity | LOW | ③ 소급 면제 조항 유추 적용(결론은 정합) 외 전 항목 정합 판정 |
| convention_compliance | LOW | swagger.md SoT 분산, "70 vs 16" 집계 기준 미기재(재현 시 102 vs 17), 예외명 유사성(INFO) |
| plan_coherence | MEDIUM | 형제 plan(entity-nullable-column-type-mismatch.md) 과 1:1 대응 확인(충돌 없음)하되, swagger.md drift 및 형제 plan 이 방금 만든 필드 2건 미반영 |
| naming_collision | LOW | 새 식별자 도입은 ②의 예외명 1건뿐, 기존 예외명과 표면적 유사성으로 혼동 가능(WARNING) |

## 권장 조치사항
1. **(WARNING #1, 최우선)** `spec_impact` 에 `spec/conventions/swagger.md` 추가 — §1-4 정본 예제(`ExecutionStatusDto.context`)를 신규 §5.4 규칙에 맞게 갱신하거나 "상시 존재 필드는 §5.4 참조" 각주 추가. 3개 checker 가 독립적으로 지목한 만큼 반영 전 정정 권장.
2. **(WARNING #6)** ③ 본문에 `ipWhitelist`/`invitedBy` 2건을 "형제 plan 최신 인스턴스"로 명시하고 이번 PR 포함 여부 결정 기록.
3. **(WARNING #2·#3)** ② 실측 표에 `oauth/:provider`·`webauthn/availability` 추가하고, §2.2 단일 동사 action 패턴 갭을 범위에 넣거나 Rationale 에 defer 사유 기록.
4. **(WARNING #5)** ③ "70 vs 16" 수치에 집계 기준(glob·정규식·§1-4 제외 여부) 각주 추가.
5. **(WARNING #4)** ① 범위에 `spec/1-data-model.md` §3 인덱스 전략 표의 "스케줄러" 서술 정정(또는 레거시 각주) 포함.
6. **(WARNING #7)** ② 신규 예외명을 기존 "인증 family 전용 네임스페이스"와 구분되게 개명(예: "인증 상태 전이 액션").
7. **(INFO)** 위 INFO 5건은 급하지 않으나 반영 시 함께 처리 권장(특히 INFO #3 형제 plan 체크박스 동기화는 target 종결 조건으로 명문화 권장).

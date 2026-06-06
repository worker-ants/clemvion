# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능 (단, WARNING 4건 착수 전 처리 권장)

## 전체 위험도
**MEDIUM** — Critical 0건, WARNING 4건(spec 내 모순 2건 + plan 경합 2건), INFO 7건. 구현 차단 사유는 없으나 WARNING 중 2건(Cross-Spec #2, Convention #1)은 구현 전 spec 정정이 강력 권장된다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 해당 없음 | — | — | — |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `notification_secret_v2` 컬럼 저장 내용 불일치 — EIA §7.1 은 ref-only(`secret://` URI), 데이터 모델 §2.8 은 `config.notification.signing.secret`(plaintext) 참조하는 이전 구조를 암시 | `spec/5-system/14-external-interaction-api.md` §7.1 DDL 주석 | `spec/1-data-model.md` §2.8 Trigger 표 `notification_secret_v2` 행 | `spec/1-data-model.md` §2.8 설명을 EIA §7.1 의 최신 기술(ref-only, `secret://triggers/{triggerId}/notification-signing.v2`)에 맞게 동기화. EIA DDL 주석도 "ref-only" 임을 명시 보완. project-planner 경로 필요. |
| W-2 | Cross-Spec | `iext_*` JWT secret 이 "trigger 별 분리" 라는 spec 서술이 실제 구현(글로벌 `INTERACTION_JWT_SECRET`)과 상충 — 이미 `exec-park-b2a-followup.md §②` 에서 인식된 SPEC-DRIFT | `spec/5-system/14-external-interaction-api.md` §8.3, §10.1 | `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L88-99 | EIA §8.3 을 `iext_*`(글로벌 `INTERACTION_JWT_SECRET`, execution-scoped payload)와 `itk_*`(trigger별 opaque token)로 분리 기술하도록 갱신. 구현 착수 전 spec 선행 정정 필요. |
| W-3 | Convention Compliance | `POST /interact`·`POST /cancel` 의 `202 Accepted` 응답에 `TransformInterceptor` 봉투(`{ data: ... }`) 적용 여부 미확정 — "body 없음(no-content path)" 주석과 응답 body JSON 예시가 §5.1 내에서 동시 존재하여 자기 모순 | `spec/5-system/14-external-interaction-api.md` §5.1 성공 응답 블록, §5 서두 주석 | `spec/conventions/swagger.md` §2-5 (응답 wrapping 반영 의무) | §5.1 성공 응답 블록에 현재 구현이 no-content(body 없음)인지 `{ data: { ... } }` 봉투인지 단일화해 명기. §10.1 에 `ApiAcceptedWrappedResponse` / `ApiOkWrappedResponse` 사용 안내 추가. |
| W-4 | Plan Coherence | `spec-fix-eia-token-error-codes.md` §2 (SCOPE_MISMATCH status·코드명 통일) 결정이 미완료 상태에서 `exec-park-b2a-followup.md §②` 가 같은 §8.3·§3.3 인근을 수정하면 이중 수정 발생 가능. §3 (terminal revoke 신뢰성)과의 연동도 미해결. | `plan/in-progress/exec-park-b2a-followup.md` §② | `plan/in-progress/spec-fix-eia-token-error-codes.md` §2, §3 | §② 착수 전 `spec-fix-eia-token-error-codes.md` §2 결정을 선처리하거나, §② 범위를 "§8.3 secret 출처 명확화에 한정, scope 검증 서술·revoke 신뢰성은 `spec-fix-eia-token-error-codes.md` 에 위임" 으로 plan 에 명시. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `interact` 202 응답 body 유무 — EIA §5 서두 "body 없음(no-content path)" vs §5.1 응답 예시 공존. API 규약 §5 봉투 정책 적용 여부 불명확 | `spec/5-system/14-external-interaction-api.md` §5.1, §5 서두; `spec/5-system/2-api-convention.md` §5 | W-3 와 함께 §5.1 단일화로 해소 |
| I-2 | Cross-Spec | `data-flow/3-execution.md` park/rehydration 시퀀스가 V087(`resume_call_stack`) 미반영 — 이미 `exec-park-b2a-followup.md §③` 으로 추적 중 | `spec/5-system/14-external-interaction-api.md` §7.2; `spec/data-flow/3-execution.md` L51, L112 | plan §③ 에서 처리 예정. EIA spec 자체 변경 불필요. |
| I-3 | Rationale Continuity | SSE 어댑터 single-instance 한계가 `Planned (미구현)` 로 명시돼 있으나 Redis pub/sub 분산화 plan 파일 존재 여부 미확인 | `spec/5-system/14-external-interaction-api.md` §R10, SSE 어댑터 설명 | `plan/in-progress/` 에 추적 항목 확인 권장. 구현 착수 시 Redis pub/sub 도입 결정을 별도 Rationale 항으로 추가. |
| I-4 | Convention Compliance | §5.2 "429 Too Many Requests" 에 `TOO_MANY_CONNECTIONS` 에러 코드 미병기 — §8.4 와 불일치 | `spec/5-system/14-external-interaction-api.md` §5.2 | §5.2 에 `TOO_MANY_CONNECTIONS` 코드 병기하여 §8.4 와 통일 |
| I-5 | Convention Compliance | `RATE_LIMITED` 에러 코드 도메인 prefix 미결정 — 시스템 전역인지 EIA 한정인지 불명확. "(Planned)" 상태로 실제 발행은 미존재 | `spec/5-system/14-external-interaction-api.md` §5.1 | 구현 시 `error-codes.md §3` 에 등재 또는 `EIA_RATE_LIMITED` prefix 부여 결정 |
| I-6 | Convention Compliance | Path parameter 표기 혼용 — `{executionId}` (OpenAPI 스타일)와 `:executionId` (NestJS 스타일)이 같은 문서 내 혼용 | `spec/5-system/14-external-interaction-api.md` §3.2, §5.1, §5.2, §5.3 | 코드블록은 OpenAPI 스타일 `{param}`, 서술문은 `:param` (NestJS) 으로 구분 원칙을 spec 서두에 명시하거나 코드블록 일관 통일 |
| I-7 | Plan Coherence | `fix-webchat-sse-field-map.md` 비차단 followup(§6.2/§6.5 drift, 이중 SoT)이 in-progress 잔존. `exec-park-b2a-followup.md §②` 가 §6.2/§6.5 를 건드리지 않음을 plan 에 명시하면 경합 리스크 제거 가능 | `plan/in-progress/exec-park-b2a-followup.md` §②; `spec/5-system/14-external-interaction-api.md` §6.2, §6.5 | §② 에 "§6.2/§6.5 는 fix-webchat-sse-field-map followup 대상, 본 항목은 §8.3 한정" 명기 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | WARNING 2건 — `notification_secret_v2` plaintext vs ref-only 불일치(W-1), JWT secret 글로벌 vs trigger별 SPEC-DRIFT(W-2) |
| Rationale Continuity | NONE | EIA 자체 R1~R12 전 항목 정합. 기존 결정 번복 없음. SSE single-instance 한계는 의도적 단계 결정으로 INFO 처리 |
| Convention Compliance | LOW | WARNING 1건(W-3, 202 응답 봉투 불명확), INFO 3건(에러 코드 미병기·prefix 미결·path param 혼용). frontmatter·문서 구조·에러 코드 UPPER_SNAKE_CASE 준수 |
| Plan Coherence | LOW | WARNING 1건(W-4, `spec-fix-eia-token-error-codes.md` 미완료 결정과 §8.3 이중 수정 위험). active worktree 충돌 0건. stale 2건 skip |
| Naming Collision | NONE | 요구사항 ID(`EIA-*`), endpoint prefix(`/api/external/executions/*`), 토큰 prefix(`iext_*`/`itk_*`/`wsk_*`), 이벤트명 모두 충돌 없음 |

---

## 권장 조치사항

1. **(W-2 우선 — 구현 착수 전 spec 선행)** `exec-park-b2a-followup.md §②` 에 따라 project-planner 경로로 EIA §8.3 을 `iext_*`(글로벌 `INTERACTION_JWT_SECRET`) / `itk_*`(trigger별 opaque) 분리 서술로 갱신. 이때 W-4 의 `spec-fix-eia-token-error-codes.md §2` SCOPE_MISMATCH 결정을 선처리하거나 §② 수정 범위를 "secret 출처 명확화만, scope 검증 서술 변경 없음" 으로 plan 에 명기해 이중 수정 방지.
2. **(W-1)** `spec/1-data-model.md` §2.8 `notification_secret_v2` 설명을 EIA §7.1 의 ref-only(`secret://` URI) 기술에 맞게 동기화. EIA DDL 주석 보완도 병행.
3. **(W-3 + I-1 통합)** EIA §5.1 성공 응답 body 유무를 단일화(현재 구현 확인 후 no-content 또는 `{ data: { ... } }` 봉투 중 하나로 확정). §10.1 에 `ApiAcceptedWrappedResponse` 사용 안내 추가.
4. **(I-7)** `exec-park-b2a-followup.md §②` 에 "§6.2/§6.5 는 fix-webchat-sse-field-map followup 전담" 경계 명기.
5. **(I-4, I-5, I-6)** 구현 착수 시 §5.2 에러 코드 병기, `RATE_LIMITED` prefix 결정, path param 표기 원칙 서두 명시를 spec 마이너 보완으로 처리.
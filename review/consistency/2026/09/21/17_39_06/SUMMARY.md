# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 Critical 없음(LOW/NONE). 유일한 실질 발견(에러 코드 카탈로그 미등재)은 이번 PR 이 만든 결함이 아니라 기존 spec 문서화 공백이며, developer 권한 밖(spec 쓰기)이라 착수를 막을 사유가 아님.

## 전체 위험도
**LOW** — WebAuthn credential 동시 DELETE 대응(9번째·마지막 자리)은 형제 8건과 동일 패턴을 그대로 적용하며 spec/plan 과 실질적 모순 없음. 사전 존재하던 에러 코드 카탈로그 완결성 갭 1건만 WARNING 으로 남음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 판정 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, rationale_continuity(중복 지적) | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드가 카탈로그 미등재. 게다가 코드가 이미 404(관리 API: `updateDeviceName`·`deleteCredential`)와 401(`verifyAuthentication`, 로그인 2FA 검증) 두 status 를 혼용 중이라, `3-error-handling.md` §1.3 이 선언한 "`_NOT_FOUND` 는 항상 404, 유일 예외는 `AUTH_CONFIG_NOT_FOUND`" 불변식이 이미 조용히 깨져 있음(두 번째 예외) | `spec/5-system/1-auth.md` §5 (PATCH/DELETE `credentials/:id`, `POST authenticate/verify` 행) / `spec/5-system/3-error-handling.md` §1.2.1·§1.3 | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 404행(401 UnauthorizedException, verifyAuthentication)·498/504행(404, updateDeviceName)·528행(404, deleteCredential — 이번 PR 대상) | 다음 spec-sync/planner 턴에 (1) `1-auth.md` §5 관련 행에 코드명 명시, (2) `3-error-handling.md` §1.2.1 에 404/401 두 status 모두 적어 등재, (3) §1.3 "유일한 예외" 문장을 "예외 최소 2건"으로 정정. 이번 PR 착수는 막지 않음(사전 존재 갭, developer 권한 밖) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance, plan_coherence | 동시 삭제 "두 번째 요청 → 404" 관례가 `1-auth.md` §5 DELETE 행에 명문화되어 있지 않음. 이미 알려진 사항(형제 8건도 동일 패턴)이나, 트래커(`spec-draft-nullable-notation-followups.md`)의 2026-09-21 스냅샷 열거 목록에 WebAuthn 자신의 DELETE 자리(`1-auth.md:498`)가 빠져 있어 재열거 시 놓치기 쉬움 | `spec/5-system/1-auth.md:498` §5 DELETE 행 (대조 선례: `spec/2-navigation/2-trigger-list.md`) | PR 완료 시점에 트래커 항목에 `1-auth.md §5`(WebAuthn credential DELETE)를 아홉 번째 자리로 명시 추가(planner 턴). 트래커 자체가 "실행 시점 재열거"를 명시해 둬 즉시 조치 불요 |
| 2 | rationale_continuity | 같은 `WebAuthnService` 안에서 `verifyAuthentication`(pessimistic lock 기반 동시성 보호, §1.4.2)과 `deleteCredential`(이번 PR: 무락 + `affected` 판정)이 서로 다른 동시성 기법을 쓰는 이유가 spec 에 설명돼 있지 않음. 위협 모델이 달라(카운터 역행 보안 vs 감사 로그 중복) 모순은 아님 | `spec/5-system/1-auth.md` §1.4.2 "동시성 보호" 문단 | 필수 아님. 원하면 §1.4.2 끝에 1줄 각주 추가 또는 커밋 메시지에 근거 요약 |
| 3 | rationale_continuity | "무락 원자적 DELETE + `affected` 판정" 패턴이 9회(형제 8건 + 이번) 반복됐음에도 `spec/conventions/`에 정착되지 않고 plan 문서 산문에만 존재 | 없음(부재) — 근거는 `plan/in-progress/webauthn-dup-delete.md` §0 결정 2 | 트래커 등재 시점에 `spec/conventions/`로 패턴 승격 여부를 별도 판단(이번 PR 필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 카탈로그 미등재(WARNING) + 동시삭제 문서화 부재(INFO, 다수 형제와 공통 패턴) |
| rationale_continuity | LOW | 동시성 기법 병존 미설명(INFO) + 패턴 미정착(INFO) + 에러코드 미등재(INFO, 타 checker 가 WARNING 으로 상향) |
| convention_compliance | LOW | 에러코드 미등재가 §1.3 "유일 예외" 불변식을 실제로 깨뜨리는 두 번째 사례임을 구체화(WARNING, 가장 상세) |
| plan_coherence | LOW | 착수 게이트 결정 1·2 이미 트래커 등재 확인, 선행 7·8번째 PR 머지 확인. 트래커 스냅샷에 WebAuthn 자리 누락만 지적(INFO) |
| naming_collision | NONE | 신규 식별자 없음(spec_impact: none). 기존 식별자 전부 재사용, 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 불요 — 이미 BLOCK: NO) 이번 `webauthn-dup-delete` PR 착수/진행에 제약 없음.
2. 다음 spec-sync/planner 턴에서 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 `1-auth.md` §5 관련 행과 `3-error-handling.md` §1.2.1/§1.3 에 등재하고, 404/401 두 status 를 모두 반영해 "유일한 예외" 문장을 정정한다.
3. PR 완료 시 `spec-draft-nullable-notation-followups.md` 트래커의 "동시 삭제 → 두 번째 404" 서술 부재 목록에 `1-auth.md §5`(WebAuthn DELETE)를 9번째 자리로 명시 추가한다.
4. (선택, 낮은 우선순위) `1-auth.md` §1.4.2 에 락 기반 vs 무락 `affected` 판정 병존 사유 각주 1줄, 또는 커밋 메시지에 근거 요약.

# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 모두 확보(전문 인라인 제공, output_file 5개 전부 이미 디스크에 존재 확인). CRITICAL 발견 0건.

## 전체 위험도
**LOW** — WARNING 1건(기존 갭, 이미 planner 트래커에 위임 완료)과 INFO 3건뿐, 이번 diff(WebAuthn credential 동시삭제 아홉 번째·마지막 자리)가 새로 만든 충돌은 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — 이번 라운드에 CRITICAL 발견 자체가 없어 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance (중복 통합) | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 에러 코드 카탈로그 미등재 + 같은 코드가 401(`verifyAuthentication`)과 404(`throwCredentialNotFound` 4개 지점) 사이를 오가 `3-error-handling.md §1.11/§1.3` "`_NOT_FOUND`≠404 는 유일한 예외" 서술이 거짓이 됨 | `spec/5-system/3-error-handling.md §1.11·§1.3`, `spec/5-system/1-auth.md §5`(코드명 미기재) | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `verifyAuthentication()`(401) vs 신규 헬퍼 `throwCredentialNotFound()`(404, 4개 지점) | 이번 PR 이 신설한 결함이 아니며 developer 권한 밖(spec 쓰기 불가). 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재됨 — 별도 조치 불요, 다음 project-planner 턴에서 (1) 카탈로그 등재 (2) §1.11/§1.3 "유일한 예외" 문구 정정 (3) `1-auth.md §5` 코드명 명시를 집행 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `1-auth.md §1.4.4` "동시성 보호" 문단은 트랜잭션+`SELECT ... FOR UPDATE` 기법만 서술하는데, 이번 fix 는 원자적 조건부 `DELETE`+`affected===0` 명시 비교로 다른 동시성 문제를 해결 — §1.4.4 적용 대상(verifyAuthentication)과 범위가 달라 위반은 아니나, 이 패턴이 형제 다섯 서비스에 반복되면서도 spec 에 일반 원칙으로 성문화된 적이 없음 | `spec/5-system/1-auth.md §1.4.4` vs `webauthn.service.ts deleteCredential()` | BLOCK 대상 아님. "동시 DELETE 감사 중복 방지 = 원자적 조건부 delete + affected 명시 비교" 를 `spec/conventions/` 에 일반 패턴으로 등재할지는 project-planner 재량 |
| 2 | convention_compliance | 동시 삭제 시 "두 번째 요청은 404" 계약이 `1-auth.md §5 DELETE` 행에 아직 명문화 안 됨 | `spec/5-system/1-auth.md §5` | 의도적 유예 — 트래커가 "9자리 전부 해소된 시점에 재열거" 하도록 이미 규정, 형제 8건과 동일 처리. 조치 불요 |
| 3 | plan_coherence | `CHANGELOG.md` 의 "이 결함 클래스는 9자리 전부 종료됐다" 선언이 트래커(`spec-draft-nullable-notation-followups.md` 4944번째 줄) 체크박스 해소보다 먼저 적힘 | `CHANGELOG.md` ↔ `plan/in-progress/spec-draft-nullable-notation-followups.md:4944` | 실제 발산 아님 — `webauthn-dup-delete.md` 자체 체크리스트가 이미 "리뷰 수렴 → 트래커 해소" 순서를 계획 중. PR 최종 커밋 시 4944번째 줄 체크박스를 함께 닫을 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 카탈로그 미등재 + 401/404 이원화(기존 갭, 이미 planner 위임) |
| rationale_continuity | LOW | §1.4.4 동시성 기법(트랜잭션+락) vs 이번 조건부 delete 기법의 관계가 spec 에 미명시 (INFO, 선례와 일관) |
| convention_compliance | LOW | 위 WARNING 재확인 + `1-auth.md §5` DELETE 행 404 계약 미기재 (INFO, 의도된 유예) |
| plan_coherence | NONE | CHANGELOG/트래커 선언 순서상 사소한 INFO, 미해결 결정 충돌·선행 plan 미해소·후속 누락 전부 없음 |
| naming_collision | NONE | 신규 식별자 없음(spec 델타 0). private 헬퍼 `throwCredentialNotFound()` 는 형제 5개(`throwAuthConfigNotFound` 등)와 명명 일관, 신규 e2e 파일명도 기존 컨벤션 준수 |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 조치 불요) WARNING#1(`WEBAUTHN_CREDENTIAL_NOT_FOUND` 카탈로그 미등재·401/404 이원화)은 이번 PR 이 만든 결함이 아니고 developer 권한 밖이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정확히 위임돼 있음 — 재작업 불요, 다음 project-planner 턴에서 spec 정정(카탈로그 등재 + §1.11/§1.3 문구 정정 + `1-auth.md §5` 코드명 명시)만 집행하면 됨.
2. PR 최종 커밋 시 `spec-draft-nullable-notation-followups.md` 4944번째 줄 체크박스를 닫아 CHANGELOG "계열 종료" 선언과 트래커 상태를 일치시킬 것.
3. (선택, project-planner 재량) 동시-DELETE 감사 중복 방지 패턴(원자적 조건부 delete + `affected` 명시 비교)을 형제 다섯 서비스 반복 이후 `spec/conventions/` 일반 원칙으로 등재할지 검토.

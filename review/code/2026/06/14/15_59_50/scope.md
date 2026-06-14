# 변경 범위(Scope) 리뷰

## 작업 의도 파악

plan `plan/complete/spec-fix-eia-token-error-codes.md`(파일 6) 에서 확인된 이번 PR 의 의도:
- **결정 1·2 (spec-only)**: EIA §5.1 토큰 에러 코드 정합 (TOKEN_REVOKED 추가, 401 통일, X-Refresh-Token-Url 일반화)
- **결정 3=A (spec + 구현)**: terminal revoke at-least-once 보강 — `TerminalRevokeReconcilerService`(BullMQ repeatable) + `InteractionTokenService.reconcileTerminalRevocations()` 구현
- 동반 EIA nit 정비 (consistency 결과 기반): `VALIDATION_FAILED`→`VALIDATION_ERROR`, `error.details` 배열 수정, requestId 예시, @ApiSecurity 제거 등

리뷰 대상 파일은 총 13개: 코드 5파일(module·spec·service·spec×2), plan 1파일, consistency review 산출물 7파일.

---

## 발견사항

### [INFO] consistency review 산출물 파일(파일 7~13)이 코드 변경 diff에 포함됨
- 위치: `review/consistency/2026/06/14/15_42_23/` 하위 7개 파일 (SUMMARY.md, _retry_state.json, convention_compliance.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: 이 파일들은 개발 프로세스상 consistency-check 단계 산출물로, 구현 PR에 함께 포함되었다. CLAUDE.md 규약에 따르면 `review/consistency/**` 는 일관성 검토자가 쓰는 산출물 경로이고 이 파일들은 gitignored 가 아니어서 커밋에 포함된다. 의도적 포함이며 범위 이탈이 아니다.
- 제안: 없음.

### [INFO] `plan/complete/spec-fix-eia-token-error-codes.md` (파일 6) 신규 생성
- 위치: `plan/complete/` 경로
- 상세: 완료된 plan 문서를 `plan/complete/` 에 배치한 것은 plan lifecycle 규약(완료 이동)을 따른 것이다. 파일 내용도 결정 3=A 로 reconciler 직접 구현이 포함되었다고 명기하여 PR 범위와 일치한다.
- 제안: 없음.

### [INFO] `TerminalRevokeReconcilerService.reconcile()` 퍼블릭 메서드 노출 (파일 5)
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` — `reconcile()` 메서드가 `public async`
- 상세: `process(_job)` 에서 내부적으로 `reconcile()` 를 위임 호출하며 `reconcile()` 을 별도 public 메서드로 분리했다. 이는 테스트 가능성과 수동 트리거를 위한 설계 선택으로, 과도한 기능 확장이나 불필요한 리팩토링이 아니다. BullMQ `WorkerHost` 패턴 내에서 단일 책임 범위에 있다.
- 제안: 없음.

---

## 요약

13개 변경 파일 전체가 plan에서 명시된 작업 의도(결정 1·2 spec 정합 + 결정 3=A reconciler 구현 + consistency 산출물 포함 + plan 완료 이동) 범위 내에 있다. 코드 변경 4파일은 각각 module 등록(파일 1), reconcileTerminalRevocations 단위 테스트 추가(파일 2), 동 메서드 구현(파일 3), 신규 reconciler 서비스 및 테스트(파일 4·5)로 결정 3=A 구현에 정확히 대응한다. 불필요한 리팩토링, 의도 외 파일 수정, 포맷팅 혼입, 무관한 임포트 변경은 발견되지 않았다. consistency 산출물과 plan 파일 포함은 프로젝트 규약에 따른 의도적 구성이다.

## 위험도

NONE

# Rationale 연속성 검토

## 검토 범위

- target: `spec/5-system`(scope 델타 0개 파일 — 이 브랜치는 spec 을 바꾸지 않았다)
- 실제 변경: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`(+`*.spec.ts`) ·
  신규 e2e `webauthn-credential-delete-concurrency.e2e-spec.ts` (총 3파일/393줄)
- 대조한 Rationale: `spec/5-system/1-auth.md` `## Rationale` 전체(1.4.A~K, 2.3.A~D,
  4.1.A~B, 부트 캐너리 항목 포함)
- 보조로 확인: `plan/in-progress/webauthn-dup-delete.md`, 선행 완료 plan
  `plan/complete/{authconfig,modelconfig,integration,schedule,trigger}-dup-delete.md`,
  `plan/complete/dup-delete-audit.md`

## 발견사항

이번 변경 범위에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견하지 못했다.

- **[INFO] `deleteCredential` 동시성 처방과 §1.4.4 "동시성 보호" 문단의 관계가 spec 에 명시되어 있지 않음**
  - target 위치: 코드 `webauthn.service.ts` `deleteCredential()`(diff, `credentialRepo.delete({ id, userId })` +
    `affected === 0` 판정) — spec 상 대응 위치는 `1-auth.md` §1.4.4 "동시성 보호" 문단(라인 266 부근)
  - 과거 결정 출처: `1-auth.md` §1.4.4 "동시성 보호" — `verifyAuthentication`의 credential
    조회·counter 갱신·역행 삭제·refresh revoke 를 **단일 트랜잭션 + `SELECT ... FOR UPDATE`**
    pessimistic lock 으로 처리한다고 명시.
  - 상세: 이번 fix 는 같은 WebAuthn 서비스의 다른 동시성 문제(동시 `deleteCredential` 두 건이
    `user.2fa_disabled` 감사를 중복 기록)를 트랜잭션+행 락이 아니라 **원자적 조건부 `DELETE` +
    `affected` 명시 비교**로 해결한다. 이는 §1.4.4 가 기술하는 기법과 다르지만, §1.4.4 의 서술
    범위는 `verifyAuthentication`(다단계 read-modify-write)에 명시적으로 한정되어 있고,
    `deleteCredential`(단일 DELETE 문 하나로 충분한 배타)에는 애초에 적용 대상이 아니다 —
    따라서 이것은 §1.4.4 원칙 위반이 아니라 **spec 이 다루지 않는 별도 기법의 도입**이다.
    실제로 이 패턴(`affected === 0` 명시 비교)은 이미 형제 다섯 서비스
    (`auth-configs`·`integrations`·`model-config`·`workspaces`·`schedules`,
    plan 참조 `authconfig-dup-delete.md` 등)에 선례가 있고 그 PR들도 전부
    `spec_impact: none` 으로 처리되어 spec 본문·Rationale 에 등재하지 않았다 — 이번 target 의
    무처리는 그 선례와 **일관**된다. 다만 이 급의 동시성 처방이 다섯 차례 반복되면서도
    spec 어디에도 "동시 DELETE 는 조건부 delete + affected 명시 비교로 방어한다" 는 일반
    원칙이 성문화되어 있지 않다는 점은, 다음 사람이 §1.4.4 의 트랜잭션+락 패턴만 보고
    "이 프로젝트의 동시성 처방은 항상 트랜잭션+락" 이라고 오판할 여지를 남긴다.
  - 제안: BLOCK 대상은 아니다. 여섯 번째 반복(이번이 아홉 번째 dup-delete 자리)에 이르렀으므로,
    추후 conventions 문서(예: `spec/conventions/`) 에 "동시 DELETE 감사 중복 방지 =
    원자적 조건부 delete + affected 명시 비교" 를 일반 패턴으로 등재할지는 project-planner
    판단 영역으로 남긴다 — 이번 target 자체의 결함은 아니다.

## 대조 확인 (문제 없음으로 판정한 항목)

- **1.4.E(counter 역행 시 credential 강제 삭제)** — 이번 diff 는 `deleteCredential`(사용자
  요청 삭제)만 건드리고 `verifyAuthentication`의 counter 역행 삭제 경로는 변경하지 않는다.
  두 삭제 경로가 이제 서로 다른 동시성 기법(트랜잭션+락 vs 조건부 delete)을 쓰게 되지만,
  각각 다른 트리거·다른 동시성 요구를 가지므로 상충이 아니다.
- **4.1.B(`user.*` 감사의 workspace 귀속·`firstCredential` 플래그로 중복 아닌 정상 재등록 구분)** —
  이번 fix 는 그 귀속 규칙을 바꾸지 않고, 오히려 "실제 사건당 정확히 한 번" 이라는 감사 로그의
  암묵적 무결성 전제를 레이스 상황에서도 지키도록 강화한다. 4.1.B 규칙과 방향이 같다(번복 아님).
  스킴 변경(nullable 허용, 별도 scope 신설)도 없어 4.1.B 가 이미 기각한 두 대안((b)(c))을
  재도입하지도 않는다.
  - 참고: 이번 diff 의 JSDoc(`throwCredentialNotFound`)이 `verifyAuthentication`의 401 과
    `renameCredential`/`deleteCredential`의 404 가 같은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드를
    공유하며 이는 `3-error-handling.md §1.11`("`_NOT_FOUND`≠404 는 유일한 예외")을 사실상
    반증하는 기존(pre-existing) 상태임을 명시했다. 이 이슈는 이번 diff 가 새로 만든 것이
    아니라 plan(`webauthn-dup-delete.md` §체크리스트, `--impl-prep` W1)에서 이미 발견되어
    "spec 은 developer 권한 밖" 이라는 이유로 project-planner 항목으로 별도 등재됐다 — target
    자체는 그 갈등을 도입하지 않고 기존 상태를 문서화(JSDoc)만 했으므로 이번 검토의
    CRITICAL/WARNING 대상은 아니다(이미 올바른 경로로 위임됨).
- **1.4.H(WebAuthn 모듈 분리 — 서비스가 감사를 남기지 않고 컨트롤러가 남긴다)** — 이번 fix 는
  감사 기록 위치를 서비스로 옮기지 않았다(서비스가 throw 하면 컨트롤러가 감사에 도달하지 않는
  기존 계약을 그대로 유지). 원칙 위반 없음.
- **선례 정합성(decision 2 — `isDeleteMiss()` 유틸 미추출)** — plan 이 code-review 제안을
  거절한 근거(방어 로직을 호출부에서 숨기면 대조군 테스트가 잡던 뮤턴트가 다시 통과할 위험)를
  실측(#1371 사례, `!affected` 뮤턴트 32건 생존)으로 남겼다 — Rationale 이 아니라 code-review
  의견에 대한 반박이라 이 checker 의 대상은 아니지만, "근거 없는 번복" 은 아님을 확인했다.

## 요약

target(`spec/5-system`)은 이번 브랜치에서 실제로 수정되지 않았고(스코프 델타 0), 대응하는 코드
변경(`WebAuthnService.deleteCredential`의 동시 삭제 감사 중복 버그 수정)도 `1-auth.md`
Rationale 의 명시적 결정(1.4.E counter 역행 삭제, 4.1.B 감사 귀속, 1.4.H 모듈 분리)과 방향이
같고 과거에 기각된 대안을 재도입하지 않는다. 유일하게 언급할 만한 점은 §1.4.4 "동시성 보호"
문단이 트랜잭션+행 락 기법만 서술하고 있어, 이번에 쓰인 원자적 조건부 delete 기법과의 관계가
spec 텍스트에는 드러나지 않는다는 것인데, 이는 이미 다섯 개 형제 PR 이 동일하게
`spec_impact: none` 으로 처리해 온 선례와 일관된 처리이며 이번 target 이 새로 만든 이탈이
아니다. `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드의 401/404 이중 사용이라는 기존 spec 정합성 문제도
이번 diff 가 발생시킨 것이 아니라 이미 planner 항목으로 올바르게 위임된 상태다.

## 위험도

LOW

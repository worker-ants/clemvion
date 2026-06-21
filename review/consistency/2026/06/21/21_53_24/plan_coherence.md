## 발견사항

- **[INFO]** `refactor-auth-reverify-unify.md` 의 `data-flow/2-auth.md` 갱신 예정과 동일 파일 수정
  - target 위치: `spec/data-flow/2-auth.md` §1.7.1 (신규 서브섹션, 이 worktree 에서 추가)
  - 관련 plan: `plan/in-progress/refactor-auth-reverify-unify.md` §범위 밖 "SPEC-DRIFT" 항목 — `data-flow/2-auth.md §1.2` 에 `verifyPasswordForUser` 헬퍼 경로·에러 코드 등재 + `bcrypt.compare` 참조를 `comparePassword` 추상화로 갱신 (비차단 INFO, 아직 미착수)
  - 상세: 두 작업이 모두 `data-flow/2-auth.md` 를 수정하지만 서로 다른 섹션(본 worktree = §1.7.1 신규, refactor-auth-reverify = §1.2 수정)을 대상으로 한다. 병합 시 line-level 충돌 가능성은 낮으나, §1.2 와 §1.7.1 의 `SessionsService.reauthenticate`·`verifyReauth` 설명이 정합한지 병합 검토가 필요하다.
  - 제안: plan 갱신 불요. `refactor-auth-reverify-unify.md` §범위 밖 항목에 "§1.7.1(이메일 변경) 와 용어 일관성 확인" 추적 메모 추가 권장(비차단).

- **[INFO]** `email-change-followup-email-lower-index.md` 완료 표기에 미완료 선택 항목 잔류
  - target 위치: `plan/complete/email-change-followup-email-lower-index.md` `(선택·deferred)` 항목
  - 관련 plan: 해당 파일 자체 (이 worktree 에서 `plan/in-progress` → `plan/complete` 이동됨)
  - 상세: `status: complete` 이나 "EXPLAIN (ANALYZE, BUFFERS) 확인" 항목이 `[ ]`(미완료) + `(선택·deferred)` 로 잔류. plan-lifecycle 기준으로 deferred 선택 항목이 complete 파일에 남는 것은 허용 패턴(선례 다수)이지만, 향후 재개 시 찾기 어려울 수 있다.
  - 제안: 현 상태 유지 가능. 필요 시 `cafe24-backlog-residual.md` 등과 동일하게 deferred 사유 주석 보강.

## 요약

이 worktree 의 3개 커밋(V101 LOWER 인덱스 마이그레이션, 테스트 보강, `data-flow/2-auth.md` §1.7.1 동기화, plan 완료 이동)은 `plan/in-progress/impl-email-change.md` 와 `email-change-followup-email-lower-index.md` 에서 명시한 follow-up 항목을 충실히 이행하고 있다. 미해결 결정(WebAuthn step-up reauth 일반화 → `refactor-auth-reverify-unify`, AuthConfig reveal 엔드포인트 §5 등재 → `auth-config-webhook-followups §3`)과 직접 충돌하는 일방적 결정은 없다. 유일한 잠재 접점은 `refactor-auth-reverify-unify` 가 동일 `data-flow/2-auth.md` 파일의 §1.2 갱신을 예정하고 있다는 점이나, 섹션이 달라 충돌 위험은 낮고 비차단 INFO 수준이다.

## 위험도

LOW

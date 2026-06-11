# Requirement Review — auth-refresh-rotation-atomic

## 발견사항

---

### [INFO] refresh 정상 회전 경로에서 loginHistory.record 미호출
- **위치**: `auth.service.ts` `refresh()` 메서드, 라인 578–586
- **상세**: 정상 회전(비 reuse 경로) 완료 후 `loginHistory.record`가 호출되지 않는다. reuse-detection 분기는 `token_reuse_detected` 이벤트를 기록하고, login/OAuth/verifyEmail/loginWithTotp 경로는 모두 `login_success`를 기록하지만, `refresh()` 정상 완료에 대한 이벤트는 없다. 이는 spec `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램에도 `loginHistory` 호출이 묘사되어 있지 않고, `spec/5-system/1-auth.md §4.3` 이벤트 enum에도 `token_refreshed` 류 이벤트가 없다. 의도된 설계이므로 INFO이나, 만약 감사(audit) 요건이 추가될 경우 이 경로가 조용히 누락될 위험이 있다.
- **제안**: 현재 spec 수준에서는 변경 불필요. 향후 refresh 이벤트 감사 요건이 spec에 추가되면 이 경로도 함께 반영할 것.

---

### [INFO] refresh() 내 stored.user null 체크 부재 (정상 회전 경로)
- **위치**: `auth.service.ts` `refresh()`, 라인 577, 585
- **상세**: reuse-detection 분기(라인 549)는 `if (stored.user)`로 null 가드를 한다. 그러나 정상 회전 분기(라인 577–586)는 `const user = stored.user`를 그대로 넘겨 `generateTokens(user, ...)`를 호출한다. `refreshTokenRepository.findOne({ relations: ['user'] })`로 join을 명시하므로 실제로는 user가 항상 로드되지만, 이론상 user row가 삭제된 극단 엣지에서 `generateTokens` 내부의 `resolveTokenWorkspaceContext(user)` 호출이 `null`을 받아 런타임 에러를 낼 수 있다. reuse 분기와 정상 분기 간 처리 일관성이 없다.
- **제안**: 위험도는 낮으나 일관성을 위해 `if (!stored.user)` 가드를 추가하거나, reuse 분기와 동일한 방어 패턴을 적용하는 것을 고려.

---

### [WARNING] 테스트: "rotates revoke + issue inside a single transaction" — lastUsedIp null 가정 하드코딩
- **위치**: `auth.service.spec.ts` 라인 663–668 (신규 테스트 "05 C-1 atomicity")
- **상세**: 테스트가 `lastUsedIp: null`을 단언하는데, 이는 `ctx.ip`가 미전달될 때의 기본값에 의존한다. 테스트 setupset에서 `ctx` 없이 `service.refresh('valid-refresh-token')`를 호출하므로 `ctx = {}` → `ctx.ip ?? null = null`이 되어 현재는 통과한다. 그러나 테스트 자체가 "트랜잭션 원자성"을 검증한다는 명칭에 비해 `lastUsedIp` 값 단언은 부수적인 필드 값 검증이 혼재되어 있다. 핵심 단언(트랜잭션 내 revoke+INSERT 원자성)과 부수 단언이 분리되지 않아 유지보수 시 혼동 여지가 있다.
- **제안**: `lastUsedIp: expect.anything()` 또는 `expect.any(Object)` 대신, IP 관련 단언을 별도 `it` 블록이나 주석으로 분리하는 것을 고려. 현재 테스트가 실패하지는 않으므로 WARNING.

---

### [INFO] beforeEach의 mockRefreshTokenRepo가 DataSource 클로저로 캡처되는 방식
- **위치**: `auth.service.spec.ts` 라인 162–265 (beforeEach + DataSource mock)
- **상세**: `mockRefreshTokenRepo`는 `beforeEach` 내 지역 변수로 선언되고, DataSource `transaction` mock의 `getRepository` 구현이 클로저로 이를 캡처한다. 동시에 `refreshTokenRepo` 모듈 변수에도 `module.get(getRepositoryToken(RefreshToken))`로 주입된다. 두 참조가 같은 객체를 가리켜야 트랜잭션 내 `update`/`save` 호출이 외부 단언에서 관측 가능하다. 이 패턴은 정확하게 구현되었으나, 미래에 `beforeEach`를 재구성할 때 두 참조 동기를 실수로 깰 위험이 있다. 코드 자체의 버그는 없으며, 주석(라인 40–50)이 의도를 잘 설명하고 있다.
- **제안**: 현재 구현은 올바르다. INFO 수준으로 기록만 한다.

---

### [INFO] spec fidelity — spec/data-flow/2-auth.md §1.4 업데이트 완료 (SPEC-DRIFT 없음)
- **위치**: `spec/data-flow/2-auth.md` §1.4 변경분
- **상세**: 이번 변경에서 spec도 함께 갱신되었다. 시퀀스 다이어그램에 `rect rgb(235,245,235)` 트랜잭션 박스 추가, 원자성 노트(C-1 설명) 추가. 코드 구현(`auth.service.ts` `refresh()`)과 spec 시퀀스가 line-level로 일치한다:
  - spec: `UPDATE refresh_token SET is_revoked=true, last_used_at=now WHERE id = row.id` → 코드: `manager.getRepository(RefreshToken).update(stored.id, { isRevoked: true, lastUsedAt: new Date(), lastUsedIp: ctx.ip ?? null })`
  - spec: `INSERT refresh_token (family_id=row.family_id, new token_hash, expires_at)` → 코드: `generateTokens(user, false, stored.familyId, ctx, manager)` 내 `refreshRepo.save(refreshTokenEntity)`
  - spec 주석의 "JWT sign 은 DB 무관이라 트랜잭션 밖에서 선계산" → 코드의 `jwtService.sign` 호출은 `generateTokens` 내에서 트랜잭션 콜백 내부에서 실행된다. 다만 JWT sign이 실제로 DB I/O 없이 순수 CPU 연산이므로 트랜잭션 안/밖 배치 차이가 실질적 원자성에 영향 없다. spec 주석은 "선계산"을 설명하지만, 코드에서 JWT sign은 트랜잭션 함수 내부(`generateTokens` 호출 안)에서 수행된다. 이는 spec 표현이 구현 의도를 완전히 반영하지 않는 표현 문제지만, 기능 동작에는 영향이 없다.
- **제안**: 현재 구현이 맞다. spec 주석의 "트랜잭션 밖 선계산"은 의도를 설명한 것으로, 코드 동작이 틀린 것이 아니다.

---

### [INFO] plan/in-progress/auth-refresh-rotation-atomic.md 체크리스트 미완
- **위치**: `plan/in-progress/auth-refresh-rotation-atomic.md` 체크리스트 항목
- **상세**: 모든 체크 항목이 `[ ]` 미완 상태다. 이는 이번 PR이 review 단계에 있음을 반영하는 정상 상태이나, `/consistency-check --impl-done` 및 `/ai-review` 항목이 체크되지 않아 워크플로 완료 전임을 명시한다.
- **제안**: 구현 완료 및 리뷰 반영 후 해당 항목을 체크하여 plan을 complete로 이동.

---

## 요약

이번 변경은 `auth.service.ts`의 `refresh()` 메서드에서 구 토큰 revoke(UPDATE)와 신규 토큰 INSERT를 `dataSource.transaction`으로 원자화하는 C-1 Critical 요건을 완전하고 정확하게 구현하였다. `generateTokens`에 optional `EntityManager`를 추가해 login/OAuth 경로의 기존 동작을 유지하면서 refresh 회전 경로만 트랜잭션에 합류시키는 설계가 올바르다. 단위 테스트 2건(원자성 검증 + 롤백 전파 검증)이 추가되었고, spec `data-flow/2-auth.md §1.4`도 동시에 갱신되어 코드-spec 정합이 유지된다. `spec/5-system/1-auth.md §4.3`의 이벤트 enum에 refresh 성공 이벤트가 없는 것은 의도된 설계이고, stored.user null 처리 일관성 미비는 INFO 수준의 개선 여지다. 전반적으로 요구사항(C-1 원자화)을 충족하며 기능 완전성, 에러 시나리오, 비즈니스 로직 반영이 적절하다.

## 위험도

LOW

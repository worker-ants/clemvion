### 발견사항

- **[INFO]** 인증 성공 경로에서 `generateTokens()`와 `loginHistory.record()` 병렬화 기회
  - 위치: `auth.service.ts` — `login()`, `loginWithTotp()`, `issueTokensForOauthUser()` 등 모든 success path
  - 상세: 두 호출은 서로 독립적 (둘 다 `user.id`, `user.email`만 의존). 현재 순차 실행으로 `INSERT refresh_token` 후 `INSERT login_history`가 직렬화됨.
  - 제안: 필요 시 `const [tokens] = await Promise.all([this.generateTokens(...), this.loginHistory.record(...)])` 로 ~1–5 ms 절감 가능. 단, 현재 트래픽 규모에서는 bcrypt (~50–100 ms) 가 압도적으로 지배하므로 실질 이득은 미미.

- **[INFO]** 실패 경로(USER_NOT_FOUND, ACCOUNT_LOCKED 등)에서 응답 지연 소폭 증가
  - 위치: `auth.service.ts:login()` — 각 early-return throw 직전 `await loginHistory.record()`
  - 상세: `void` 시절에는 실패 응답이 DB write를 기다리지 않았으나, 이제 모든 실패 분기에서 INSERT가 완료된 후 예외를 throw. 브루트포스 공격 시 각 실패 요청당 ~1–5 ms 추가됨.
  - 제안: 수용 가능한 수준. 오히려 실패 경로 간 응답 시간 편차를 줄여 타이밍 공격(timing attack) 벡터를 약화시키는 부수 효과가 있음. 변경 불필요.

- **[INFO]** `record()` 내부 `repository.save()` 는 매번 `INSERT` 단건 실행
  - 위치: `login-history.service.ts:record()`
  - 상세: 현재 단건 삽입 패턴은 정상. 향후 고빈도 이벤트(bulk import, 대규모 배치 처리 등) 진입 시 배치 INSERT(`repository.insert([...])`) 전환을 고려할 수 있으나 현재 단계에서는 불필요.
  - 제안: 현 구조 유지.

---

### 요약

핵심 변경(`void` → `await`)은 성능 관점에서 **의도적이고 합리적인 트레이드오프**다. 인증 응답 지연이 요청당 ~1–5 ms 증가하지만, bcrypt 연산과 refresh token INSERT가 이미 지배적 비용이므로 실측 P99 지연에 미치는 영향은 무시 가능하다. 병렬화 여지가 존재하나 현재 규모에서 최적화 우선순위는 낮다. `login-history.service.ts` 자체는 커서 기반 페이지네이션, 배치 prune 등 성능 관련 설계가 이미 양호하다.

### 위험도

**LOW**
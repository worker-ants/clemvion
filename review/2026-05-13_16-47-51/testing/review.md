### 발견사항

- **[WARNING]** `await` 전환에 대한 회귀 방지 단위 테스트 부재
  - 위치: `auth.service.ts` 13곳, `sessions.service.ts` 2곳 전체
  - 상세: `void → await` 변환이 올바르지만, 단위 테스트는 `loginHistory.record`를 `jest.fn().mockResolvedValue(undefined)`로 모킹하기 때문에 `void`든 `await`든 동일하게 통과한다. 미래에 누군가 실수로 되돌려도 단위 테스트가 잡지 못한다.
  - 제안: `jest.spyOn(loginHistory, 'record').mockImplementation(() => new Promise(res => setTimeout(res, 50)))` 처럼 지연 Promise를 주입하고, login 응답이 반환된 시점에 `record`가 이미 호출 완료됐는지 확인하는 테스트 추가. 또는 최소한 `expect(loginHistory.record).toHaveBeenCalledTimes(1)` assertion이 각 시나리오마다 존재하는지 확인.

- **[WARNING]** `record()` 예외 격리 보장에 대한 명시적 테스트 없음
  - 위치: `login-history.service.ts:75` (`record()` 내 try/catch)
  - 상세: 주석에 "실패해도 인증 흐름을 막지 않는다"고 명시되어 있지만, `repository.save`가 throw할 때 `login()`이 여전히 정상 응답을 반환하는지를 검증하는 테스트가 없다. `await`로 변경 후 이 보장이 더 중요해졌다 — `void`일 때는 실패해도 response가 이미 나갔지만, 이제는 `record()` 내부 try/catch가 올바르게 동작해야만 응답이 나온다.
  - 제안:
    ```typescript
    it('DB 장애 시에도 login 응답 정상 반환', async () => {
      loginHistoryRepository.save.mockRejectedValue(new Error('DB unavailable'));
      await expect(authService.login(validDto, ctx)).resolves.toHaveProperty('accessToken');
    });
    ```

- **[WARNING]** race condition 수정이 e2e 테스트 하나에만 의존
  - 위치: `backend/test/session-revocation.e2e-spec.ts` (plan 문서 참조)
  - 상세: race condition은 실제 DB connection pool 분기에서 발생하므로 단위 테스트로는 검출이 불가하다. 이는 구조적 한계라 허용 가능하지만, 해당 e2e 테스트가 이 시나리오를 명확히 `describe`/`it` 이름으로 문서화하고 있는지 확인 필요. 테스트가 flaky해지거나 skip되면 race가 조용히 재발한다.
  - 제안: e2e 테스트의 해당 케이스에 `// regression: void → await race (fix-login-history-race)` 형태의 최소 주석으로 의도를 고정.

- **[INFO]** `forgotPassword`, `resetPassword`에 `record()` 호출 없음 — 테스트로 문서화 미비
  - 위치: `auth.service.ts:forgotPassword`, `auth.service.ts:resetPassword`
  - 상세: 이메일 열거 방지 의도로 `forgotPassword`가 `record()`를 생략하는 것은 올바른 설계다. 그러나 이 의도를 명시하는 테스트(`expect(loginHistory.record).not.toHaveBeenCalled()`)가 없으면 추후 "누락된 record 호출"처럼 보여 실수로 추가될 수 있다.
  - 제안: `forgotPassword` 단위 테스트에 `expect(loginHistory.record).not.toHaveBeenCalled()` 단언 추가.

---

### 요약

`void → await` 변환 자체는 정확하고, `record()` 내부의 예외 swallow 덕분에 응답 latency 외 부작용이 없다. 그러나 이번 변경으로 생긴 핵심 불변 조건 두 가지 — "응답 전 INSERT 완료 보장"과 "DB 실패 시에도 인증 성공" — 을 검증하는 단위 테스트가 추가되지 않아, race condition 수정이 e2e 테스트 단 한 곳에만 의존하는 구조가 됐다. 회귀 방지 관점에서 `record()` 예외 격리에 대한 단위 테스트와 `forgotPassword`의 의도적 생략을 명시하는 테스트가 필요하다.

### 위험도

**MEDIUM**
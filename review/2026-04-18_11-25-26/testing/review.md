### 발견사항

---

**[WARNING]** `passwordResetToken` 평문 저장 — 테스트가 보안 회귀를 검증하지 않음
- 위치: `auth.service.ts:285`, `auth.service.spec.ts:340-357`
- 상세: `RefreshToken`은 `createHash('sha256')` 해시 후 DB 저장하는 반면, `passwordResetToken`은 raw UUID를 그대로 저장합니다. 현재 테스트는 `savedToken`(DB 저장값)과 이메일 발송값이 동일한지 검증하도록 설계되어 있어, 해싱 적용 시 오히려 테스트가 깨집니다 — 즉 테스트가 안전하지 않은 동작을 고정(encode)하고 있습니다.
- 제안: DB 저장 전 토큰을 해시하고, 테스트에서 `savedToken !== emailedToken`이 되도록 검증 구조 변경

---

**[WARNING]** 만료 시간 정확성 미검증
- 위치: `auth.service.spec.ts:336`
- 상세: `passwordResetExpiresAt: expect.any(Date)`로만 검증하여 만료 시간이 30분인지 전혀 확인하지 않습니다. 스펙에서 "30분"이 명시된 보안 요구사항이므로 정밀 검증이 필요합니다.
- 제안:
  ```typescript
  const expiry = updateArgs[1].passwordResetExpiresAt.getTime();
  expect(expiry).toBeGreaterThanOrEqual(Date.now() + 29 * 60 * 1000);
  expect(expiry).toBeLessThanOrEqual(Date.now() + 31 * 60 * 1000);
  ```

---

**[WARNING]** DB 업데이트 실패 경로 미테스트
- 위치: `auth.service.spec.ts` — `forgotPassword` describe 블록
- 상세: `usersService.update`가 실패할 경우 현재 구현은 예외를 전파하여 안티-열거 보호 메시지가 반환되지 않습니다. 이 경로에 대한 테스트가 없어 보안 정책의 일관성이 보장되지 않습니다.
- 제안:
  ```typescript
  it('should return same message even if update fails', async () => {
    usersService.findByEmail.mockResolvedValue(mockUser as User);
    usersService.update.mockRejectedValueOnce(new Error('DB error'));
    // 현재 구현은 throw함 — 스펙에 따라 swallow 또는 throw 여부 결정 후 테스트 작성
  });
  ```

---

**[INFO]** `?? []` 폴백으로 인한 묵시적 타입 오류 위험
- 위치: `auth.service.spec.ts:343-346`
- 상세: `usersService.update.mock.calls[0] ?? []`에서 폴백이 `[]`이면 `updateArgs[1]`이 `undefined`가 되어 런타임 오류 발생. 바로 위 줄의 `expect(usersService.update).toHaveBeenCalledWith(...)`이 통과해야 이 코드에 도달하므로 실질적 위험은 낮지만, 방어 코드가 오히려 타입 안전성을 약화시킵니다.
- 제안: `?? []` 제거 후 non-null assertion(`!`) 사용 또는 `expect(usersService.update.mock.calls[0]).toBeDefined()` 선행 검증

---

**[INFO]** `sendPasswordResetEmail` — `frontendUrl` 미설정 시 동작 미검증
- 위치: `mail.service.spec.ts` — `sendPasswordResetEmail` describe 블록
- 상세: `sendVerificationEmail`도 동일한 갭이 있으나, 링크가 깨진 상태(`/reset-password?token=...`)로 이메일이 발송될 경우 사용자 경험에 직결됩니다. `createService({})` 또는 `frontendUrl` 미설정 케이스 테스트 부재.
- 제안: `createService({ 'app.frontendUrl': '' })`로 빈 URL 케이스 추가

---

**[INFO]** XSS 테스트가 text body 미포함
- 위치: `mail.service.spec.ts:158-167`
- 상세: HTML body의 XSS 이스케이프는 검증하나 text body의 raw name 포함 여부를 검증하지 않습니다. 플레인텍스트에서 HTML 이스케이프는 불필요하므로 `callArgs.text`에 `<script>`가 그대로 포함되는 것이 올바른 동작이지만, 이를 명시적으로 검증하는 테스트가 없어 의도된 동작인지 불분명합니다.
- 제안: `expect(callArgs.text).toContain('<script>alert("xss")</script>')` 추가로 의도 명시

---

### 요약

비밀번호 재설정 이메일 발송 기능 자체의 핵심 경로(정상 발송, 메일 실패 시 동일 응답, 비존재 이메일 처리)는 잘 커버되어 있습니다. 그러나 가장 중요한 문제는 **`passwordResetToken`을 평문 그대로 DB에 저장**하는 것인데, 현재 테스트가 오히려 이 동작을 정상으로 고정하고 있어 추후 보안 개선 시 테스트 구조까지 함께 수정해야 합니다. 추가로 만료 시간 정밀 검증 및 DB 실패 경로 테스트가 누락되어 스펙에서 명시된 30분 만료와 안티-열거 보호의 완전한 커버리지가 부족합니다.

### 위험도

**MEDIUM**
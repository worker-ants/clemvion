# 보안(Security) 리뷰

## 발견사항

### **[INFO]** TOTP 에러 로깅 개선 확인 — OWASP A09 대응 완료
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` `verifyCode` catch 블록
- 상세: 이전에는 `(err as Error).message`(otplib 내부 에러 메시지 전체)를 `warn` 레벨로 로깅했으나, 이번 변경에서 `(err as Error).name`(에러 타입명, 예: `SecretTooShortError`)만 로깅하도록 수정. otplib 내부 메시지에 비밀 소재나 민감 컨텍스트가 포함될 경우 로그 집계 시스템 유입을 차단하는 OWASP A09 대응으로 적절함.
- 제안: 추가 조치 불요.

### **[INFO]** TOTP `disable()` 초기화 필드 검증 — 보안 완전성 확인
- 위치: `codebase/backend/src/modules/auth/totp.service.spec.ts` `disable` describe 블록
- 상세: `disable()` 호출 시 `twoFactorEnabled`, `twoFactorSecret`, `totpRecoveryCodes` 세 필드가 모두 초기화되는지를 테스트로 검증. 복구 코드를 `null`로 초기화하지 않으면 2FA 비활성 사용자가 만료되지 않은 복구 코드를 재사용할 수 있는 잔류 인증 벡터가 남으므로, 이 검증이 중요함. 이번 추가로 보안 경로의 회귀 가드가 갖춰졌음.
- 제안: 추가 조치 불요.

### **[INFO]** `verifyAndEnable` user=null 분기 처리 검증
- 위치: `codebase/backend/src/modules/auth/totp.service.spec.ts` verifyAndEnable describe 블록
- 상세: `findById`가 `null`을 반환하는 경우 `user.twoFactorSecret` 접근 전에 `BadRequestException`을 throw하는지 검증하는 케이스가 추가됨. null 체크 미흡 시 `null.twoFactorSecret` 런타임 오류가 500으로 노출될 수 있으므로 보안 측면에서 의미 있는 경계값 처리임.
- 제안: 추가 조치 불요.

### **[INFO]** safe-html 빈/공백 입력 경계값 — XSS sanitize 안정성 확보
- 위치: `codebase/channel-web-chat/src/lib/safe-html.test.ts` "빈/공백 입력 경계값" describe 블록
- 상세: 빈 문자열(`""`) 및 공백만 있는 입력(`"   "`)에 대해 `<script>` 미포함을 단언. DOMPurify 호출이 엣지 케이스 입력에서 throw 없이 안전하게 처리됨을 검증. 이전에 해당 케이스 미테스트로 잠재적 undefined/null 반환이 상위 컴포넌트에서 XSS-unsafe 경로로 fallback할 가능성이 있었으나, 이번 테스트 추가로 구현 안전성이 명시적으로 보장됨.
- 제안: 추가 조치 불요.

### **[INFO]** auth.service.spec.ts jwtService.sign 캐스팅 제거 — 타입 정합성 개선
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` lines 1055 (변경 후)
- 상세: `(jwtService.sign as jest.Mock).mock` 캐스팅이 `jwtService.sign.mock`으로 단순화. 보안 직접 영향은 없으나, mock 타입이 정확히 선언되어 있다는 의미로 향후 mock 기반 인증 흐름 테스트의 타입 안전성이 일관성 있게 유지됨.
- 제안: 추가 조치 불요.

### **[WARNING]** 복구 코드 저장에 KDF 미사용 (이월 확인)
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` `hashRecoveryCode` 함수
- 상세: 복구 코드를 `SHA-256` 단순 해시로만 저장. bcrypt/argon2 같은 KDF가 아님. 이번 변경 범위에서 명시적으로 "현재 설계 수용 가능"으로 처분되었으며, 72비트 엔트로피 + 일회성 소비 특성으로 단기적 위험은 낮음. 그러나 DB 유출 시 고엔트로피 코드라도 GPU 가속 SHA-256 공격에 취약할 수 있다는 점은 장기 리스크로 남음.
- 제안: 장기적으로 argon2id/scrypt 전환 검토. 현재는 수용 가능하나 별도 보안 개선 task로 백로그 등재 권장.

## 요약

이번 변경은 의존성 업그레이드(otplib v12→v13, plugin-react v4→v6, jsdom v25→v29) 후속 ai-review Warning 처분 커밋으로, 보안 관점에서는 모두 방어적 방향의 개선이다. OWASP A09 대응(에러 메시지 대신 타입명만 로깅), 2FA disable 초기화 회귀 가드, verifyAndEnable null 분기 처리, safe-html 빈입력 경계값 검증이 모두 보안 강화 방향이다. 하드코딩된 시크릿, SQL/커맨드/XSS 인젝션, 인증 우회 가능성은 이번 diff 범위에서 발견되지 않았다. SHA-256 기반 복구 코드 저장은 이전 리뷰에서 "수용 가능"으로 처분된 사항이며 본 diff에서 변경 없어 위험도 변동 없음. `thirty-two@1.0.2`(2014년 미갱신) 및 deprecated otplib v12 플러그인 제거는 공급망 보안 측면에서 긍정적인 변화다.

## 위험도

LOW

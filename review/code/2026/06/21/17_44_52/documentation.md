# 문서화(Documentation) 리뷰 결과

리뷰 대상: M-2 ai-review resolution — OAuth strategy 전용 단위 테스트 신설 + envCredentials 주석 추가
커밋: 21ecd60952843797e92f8d52b0c5b289e409b03d

---

## 발견사항

### [INFO] `integration-oauth.service.ts` 추가 주석 — 내용 정확, 위치 적절
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 라인 1077–1080 (diff +4줄)
- 상세: 이전 리뷰(17_32_11 WARNING #7)에서 지적한 `envCredentials` 가 cafe24-private·makeshop 에서 무시됨을 명확화하는 주석이 정확히 추가되었다. "only the env-backed strategies read it: cafe24-private and makeshop ignore it and use the per-install creds from `providerMeta` instead" 라는 문구는 `Cafe24PrivateOAuthStrategy.resolveCredentials` 및 `MakeshopOAuthStrategy.buildTokenRequest` 의 실제 구현과 일치한다. 오래된 주석 없음.
- 제안: 현재 수준으로 충분하다. 향후 `TokenRequestInput` 인터페이스의 `envCredentials` 필드 주석에도 `(ignored by cafe24-private and makeshop)` 를 미러하면 인터페이스 독자가 동일 맥락을 얻을 수 있으나 필수 아님.

---

### [INFO] `oauth-provider-strategy.spec.ts` 모듈 레벨 JSDoc — 적절하게 작성됨
- 위치: `codebase/backend/src/modules/integrations/oauth-providers/oauth-provider-strategy.spec.ts` 라인 125–130
- 상세: 파일 상단의 `/** Unit tests for the M-2 OAuth provider strategies ... */` 블록이 테스트 목적(전략 직접 단위 검증, ai-review testing WARNING 1-6 해소)을 명확히 기술한다. `thrownCode` 헬퍼 함수에도 `/** Capture the NestJS exception \`code\` ... */` 한 줄 독스트링이 있어 비표준 헬퍼의 의도를 즉시 전달한다. 전반적으로 테스트 파일 내 문서화는 양호하다.
- 제안: 해당 없음.

---

### [INFO] 테스트 케이스 인라인 주석 — 비자명 동작에 적절한 설명 있음
- 위치: `oauth-provider-strategy.spec.ts` 전반
- 상세: `// space → '+'`, `// comma-delimited → '%2C', not '+' / '%20'`, `// Cafe24: client creds NOT in body.`, `// No appType → public default (parse/meta are identical across the two).` 등 provider 별 프로토콜 일탈 사항에 짧은 인라인 주석이 있어 테스트 의도를 자명하게 전달한다. 명세 근거(`spec/2-navigation/4-integration.md`) 링크가 테스트 파일에 없지만 테스트 파일의 관례상 필수 아님.
- 제안: 해당 없음.

---

### [INFO] 이전 리뷰(17_32_11)에서 지적된 잔여 INFO 2건 — 이번 커밋에서 미적용, 비차단
- 위치: `codebase/backend/src/modules/integrations/oauth-providers/index.ts` (`resolveOAuthStrategy` JSDoc 부재), `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (`parseTokenExpiresAt` shim 독스트링의 구체 파일 참조 부재)
- 상세: RESOLUTION.md 에 "나머지 INFO(아키텍처 framework 결합·ISP·stub 인터페이스 분리, 문서 JSDoc 보강 등)는 현 5-provider 규모에서 허용 가능한 설계 트레이드오프로 reviewer 가 명시 — 비차단, 후속 고려" 로 의도적 미적용 결정이 명시되어 있다. resolution 범위 밖으로 처리되었으므로 차단 사유 없음.
- 제안: 후속 provider 추가 시 `resolveOAuthStrategy` JSDoc(`@param provider`, `@param appType`, `@returns`) 추가를 권장. 현재는 INFO 수준.

---

### [INFO] README / CHANGELOG 업데이트 불필요 확인
- 상세: 이번 커밋은 주석 4줄 추가 + 신규 테스트 파일(502줄)로 구성된다. 외부 동작·API 계약·환경변수·설정 옵션 변경이 없으므로 README 또는 CHANGELOG 업데이트는 불필요하다. plan 파일(`plan/in-progress/refactor/02-architecture.md`) 체크박스 갱신은 이번 커밋 이전 커밋에서 완료되었다.
- 제안: 해당 없음.

---

## 요약

이번 resolution 커밋(21ecd60)은 문서화 관점에서 의도된 변경을 정확히 이행하였다. `integration-oauth.service.ts` 에 추가된 4줄 주석은 직전 리뷰의 WARNING #7(requirement — envCredentials 무시 의도 불명확)을 완전히 해소하며, 코드와의 정합성도 확인된다. 신규 테스트 파일(`oauth-provider-strategy.spec.ts`)은 모듈 레벨 JSDoc 과 헬퍼 함수 독스트링을 갖추고, 비자명 프로토콜 동작에 인라인 주석을 적절히 배치하였다. 이전 리뷰에서 식별된 JSDoc 강화 INFO 항목(resolveOAuthStrategy 함수 레벨 JSDoc, parseTokenExpiresAt shim 구체 파일 참조)은 RESOLUTION.md 에서 의도적으로 미적용 처리되었으며 차단 사유가 아니다. API 엔드포인트·환경변수·설정 옵션 변경이 없어 외부 문서(README, CHANGELOG) 업데이트는 불필요하다.

## 위험도

NONE

---

STATUS=success ISSUES=0

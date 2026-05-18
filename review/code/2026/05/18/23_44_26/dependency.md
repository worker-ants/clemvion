# 의존성(Dependency) 리뷰

리뷰 대상: 2fa-webauthn-impl 워크트리 변경 (spec 갱신 + consistency review 산출물)

---

### 발견사항

- **[WARNING]** 신규 외부 의존성 `@simplewebauthn/server` + `@simplewebauthn/browser` — 버전 미명시
  - 위치: `spec/5-system/1-auth.md` Rationale 1.4.A (새로 추가된 섹션)
  - 상세: Rationale 1.4.A 가 WebAuthn 구현 라이브러리로 `@simplewebauthn/server` + `@simplewebauthn/browser` 를 공식 선택으로 기재했다. 그러나 이번 diff 에 `codebase/backend/package.json` 또는 `codebase/frontend/package.json` 의 변경이 포함되지 않아, 실제 패키지 추가 여부와 사용할 버전이 확정되지 않은 상태다. `@simplewebauthn` 은 v9 / v10 간 API 가 다수 변경됐으며(`generateRegistrationOptions` 옵션 구조, `verifyAuthenticationResponse` 반환 타입 등), 버전을 특정하지 않으면 구현 착수 시 API 오해가 발생할 수 있다.
  - 제안: `plan/in-progress/2fa-webauthn.md` §1 또는 §4 에 `@simplewebauthn/server@^10` / `@simplewebauthn/browser@^10` 처럼 최소 major 버전을 고정하고, `codebase/backend/package.json` + `codebase/frontend/package.json` 에 실제 패키지를 추가하는 체크리스트 항목을 명시한다.

- **[WARNING]** `@simplewebauthn/browser` — 번들 크기 영향 미검토
  - 위치: `spec/5-system/1-auth.md` Rationale 1.4.A
  - 상세: `@simplewebauthn/browser` 는 브라우저 번들에 포함된다. v10 기준 tree-shakable ESM 을 지원하지만, `startRegistration` / `startAuthentication` 등 주요 함수가 함께 로드된다. 현재 Next.js frontend 가 어떤 번들러 전략을 사용하는지, dynamic import 로 lazy load 할 계획인지 spec 또는 plan 에 언급이 없다. WebAuthn 화면(`/profile/security`, 로그인 2FA 화면)이 앱 전역 번들에 포함될 경우 초기 로드 크기가 늘어난다.
  - 제안: `plan/in-progress/2fa-webauthn.md` §5 프론트엔드 구현 항목에 `@simplewebauthn/browser` 를 dynamic import (`next/dynamic` 또는 `import()`) 로 불러올지 정적 import 로 처리할지 결정을 기재한다. WebAuthn 미지원 브라우저 분기와 맞물려 dynamic import 가 적합한 케이스다.

- **[INFO]** `@simplewebauthn/server` 라이선스 — MIT, 프로젝트와 호환
  - 위치: `spec/5-system/1-auth.md` Rationale 1.4.A
  - 상세: `@simplewebauthn/server` 와 `@simplewebauthn/browser` 는 모두 MIT 라이선스다. 프로젝트가 명시적으로 금지하는 GPL/AGPL 계열이 아니므로 라이선스 충돌은 없다.
  - 제안: 없음.

- **[INFO]** `@simplewebauthn/server` 알려진 취약점 — 현 시점 기준 없음
  - 위치: `spec/5-system/1-auth.md` Rationale 1.4.A
  - 상세: `@simplewebauthn/server` v10.x 는 2025년 8월 기준 공개된 CVE 가 없다. 단, WebAuthn 라이브러리 특성상 FIDO2 spec 변화나 attestation 검증 로직의 보안 패치가 빈번할 수 있으므로 주기적인 `npm audit` 가 필요하다. 또한 이 라이브러리는 내부적으로 Node.js 내장 `crypto` 모듈(`SubtleCrypto`)에 의존하므로 Node 18+ 환경이 전제된다.
  - 제안: CI/CD 파이프라인의 `npm audit` 단계에서 `@simplewebauthn/*` 가 포함되도록 확인한다. plan §4 의 착수 조건에 `npm audit --audit-level=high` 실행을 추가하는 것을 권장.

- **[INFO]** 신규 `webauthn.config.ts` — 기존 config 모듈 의존 관계 확인 필요
  - 위치: `spec/5-system/1-auth.md §1.4.3`, consistency review `naming_collision.md` 발견사항 3
  - 상세: spec §1.4.3 이 `codebase/backend/src/common/config/webauthn.config.ts` 를 `registerAs('webauthn', ...)` 패턴으로 등록하도록 명시했다. 기존 `common/config/index.ts` 에 해당 export 가 누락되면 NestJS `ConfigModule.forRoot` 로드에서 제외된다. 이는 라이브러리 의존성은 아니지만 **내부 모듈 의존 관계** 문제다.
  - 제안: plan §4 체크리스트에 "webauthn.config.ts 를 `common/config/index.ts` 에 export 추가" 항목을 명시한다. 구현 후 `ConfigService.get<string>('webauthn.rpId')` 단위 테스트로 주입 여부를 검증한다.

- **[INFO]** `webauthn-credential.entity.ts` — TypeORM 모듈 등록 의존 관계
  - 위치: consistency review `naming_collision.md` 발견사항 7, `rationale_continuity.md` 관련 내용
  - 상세: 신규 `WebAuthnCredential` 엔티티가 `auth.module.ts` 의 `TypeOrmModule.forFeature([...])` 에 등록되지 않으면 Repository 주입이 실패한다. plan §4 가 "app.module.ts 의 entities 배열에 추가" 로만 기재해 모듈 레벨 등록과 혼동될 여지가 있다. 이 역시 외부 패키지가 아닌 **내부 의존 관계** 사안이다.
  - 제안: plan §4 의 해당 항목을 "`auth.module.ts` 의 `TypeOrmModule.forFeature` 배열에 WebAuthnCredential 추가"로 구체화한다.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md` 내부 링크 갱신 — `§2.21` → `§2.22` 참조 수정
  - 위치: 파일 17, 변경 1줄 (`§2.20~2.21` → `§2.20·§2.22`)
  - 상세: WebAuthnCredential 이 §2.21 로 신설되면서 AssistantMessage 가 §2.22 로 번호 시프트됐다. ai-assistant.md 의 관련 문서 링크가 `§2.20·§2.22` 로 업데이트됐다. 이는 외부 의존성이 아닌 **내부 문서 의존 관계** 조정이며 올바르게 처리됐다. 단, 다른 spec 파일 중 `§2.21 AssistantMessage` 를 참조하는 곳이 더 있는지 전수 확인이 필요하다.
  - 제안: `grep -r "§2.21" spec/` 로 누락된 참조 갱신이 있는지 확인한다.

- **[INFO]** `V057__webauthn_credentials_and_recovery.sql` / `V058__login_history_webauthn_failed_event.sql` — 기존 마이그레이션 의존 관계
  - 위치: `spec/1-data-model.md §2.18.2`, plan §3
  - 상세: V058 은 기존 `chk_login_history_event` CHECK 제약(V040 도입)을 DROP + ADD 하는 패턴을 사용한다. 이 패턴은 V040 이 이미 main 에 적용된 상태에서만 작동한다. V057 은 User 테이블에 3개 컬럼(`two_factor_secret`, `totp_recovery_codes`, `webauthn_recovery_codes`) 과 `webauthn_credential` 테이블을 신설한다. 두 마이그레이션 모두 이전 번호(V001~V056)가 완전히 적용된 스키마 위에서만 순서대로 실행 가능하다. 다른 worktree 의 병렬 마이그레이션 번호 점유(replay-rerun.md)와의 충돌은 consistency review 에서 이미 지적됐다.
  - 제안: 없음 (기존 consistency review 지적 사항과 동일, plan §3 착수 조건에 번호 재확인 절차가 이미 존재).

---

### 요약

이번 diff 는 실제 `package.json` 변경이 포함되지 않은 spec 갱신 + consistency review 산출물 집합이다. 의존성 관점에서 핵심 이슈는 신규 WebAuthn 라이브러리(`@simplewebauthn/server` + `@simplewebauthn/browser`)가 spec Rationale 에 선택으로 확정됐음에도 실제 패키지 설치 및 버전 고정이 이번 변경에 포함되지 않은 점이다. 특히 `@simplewebauthn` 은 major 버전 간 API 변화가 크므로, 구현 착수 전에 버전을 plan 에 명시하고 `package.json` 에 추가하는 것이 선행되어야 한다. `@simplewebauthn/browser` 의 번들 크기 영향도 frontend 구현 전에 dynamic import 전략으로 결론을 내야 한다. 두 라이브러리의 라이선스(MIT)는 프로젝트와 호환되며, 현 시점 알려진 CVE 는 없다. 내부 의존 관계 측면에서는 `webauthn.config.ts` 의 `common/config/index.ts` 등록 누락, `WebAuthnCredential` 엔티티의 `auth.module.ts` `TypeOrmModule.forFeature` 등록, spec 섹션 번호 시프트에 따른 문서 링크 전수 확인이 구현 착수 전에 필요하다.

---

### 위험도

LOW

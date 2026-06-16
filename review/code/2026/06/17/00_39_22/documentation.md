# 문서화(Documentation) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `totp.service.ts` — `verifyCode` private 메서드 JSDoc 양호, 그러나 `setup()` 메서드 기존 JSDoc 에 v13 으로 바뀐 `generateSecret()` / `generateURI()` API 변경 언급 없음
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/totp.service.ts` — `setup()` 메서드 상단 JSDoc
  - 상세: `setup()` 에는 JSDoc 이 있으나 "v13 의 `generateURI` 사용", "secret 최소 길이 20byte" 등 v12 → v13 변경 사항이 반영되지 않았다. `verifyCode()` 는 JSDoc 이 잘 작성되어 있어 대조적이다.
  - 제안: `setup()` JSDoc 에 `@since otplib v13`, `generateURI` 옵션 구조체(`issuer`, `label`) 명시 추가.

### 발견사항 2
- **[INFO]** `jest.config.ts` — `transformIgnorePatterns` 주석이 충실하게 갱신됨. `otplib >=13 rewrite ships ESM` 배경 설명 포함. 형식도 세미콜론 구분으로 가독성 유지됨. 문서화 관점에서 양호.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/jest.config.ts` 라인 87-90
  - 상세: ESM 패키지 목록 확장 이유(otplib v13 ESM 전환, @otplib/*, @scure/base, @noble/hashes)가 인라인 주석으로 명확히 기술됨.
  - 제안: 없음 — 현행 수준 유지.

### 발견사항 3
- **[INFO]** `totp.service.spec.ts` (신규 파일) — 파일 상단의 RFC 6238 벡터 설명 주석 및 각 `describe` 블록 제목이 의도를 잘 표현함. 헬퍼 함수 `bootstrapSecret` 에 JSDoc 한 줄 달린 점도 긍정적.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/totp.service.spec.ts` 라인 617-786
  - 상세: `cross-version 호환성 (otplib v12→v13)` describe 블록에 마이그레이션 배경과 "500 방지" 의도가 명시되어 있어 향후 유지보수 시 맥락 파악이 용이하다.
  - 제안: 없음 — 현행 수준 양호.

### 발견사항 4
- **[INFO]** `markdown-renderer.test.tsx` (신규 파일) — 파일 레벨 JSDoc 블록이 "위젯 safe-html 과 동일 XSS 페이로드 셋" 과 "정책 매트릭스 SoT" 를 명시적으로 cross-reference 하고 있어 두 테스트 파일의 연관성이 추적 가능.
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/assistant-panel/__tests__/markdown-renderer.test.tsx` 라인 3415-3422
  - 상세: 스펙 단면 `spec/7-channel-web-chat/4-security.md §sanitize` 를 명시적으로 참조해 "왜 이 테스트가 존재하는가"를 셀프-설명한다.
  - 제안: 없음.

### 발견사항 5
- **[WARNING]** `PROJECT.md` 신규 섹션 "버전·도구 정책" — 내용은 충실하나, `@workflow/sdk`·`@workflow/web-chat` 의 외부 배포 SDK 에 대한 `>=20` 정책이 `codebase/packages/sdk/package.json` 이나 별도 패키지 파일에 실제로 적용되었는지에 대한 상호 확인 링크가 없다. `packages/web-chat-sdk` 는 `>=20` 으로 갱신되었으나 `packages/sdk` 는 diff 에 미포함.
  - 위치: `/Volumes/project/private/clemvion/PROJECT.md` 라인 38-39
  - 상세: PROJECT.md 에 "외부 배포 SDK(`@workflow/sdk`·`@workflow/web-chat`) = `>=20`" 라고 선언하면서, packages/sdk 의 실제 engines 필드 상태가 이 변경셋 안에서 검증되지 않는다. 문서와 구현의 정합성이 부분적으로만 확인 가능하다.
  - 제안: PROJECT.md 에 "`packages/sdk` 는 별도 확인 필요" 또는 해당 패키지 diff 를 이번 변경셋에 포함해 문서-구현 일관성 확보.

### 발견사항 6
- **[INFO]** `channel-web-chat/package.json` — `"//pin"` 필드에 exact pin 사유가 PROJECT.md 정책을 참조하며 기술됨. 이는 PROJECT.md 정책을 선언적으로 준수하는 좋은 예시. `frontend/package.json` 도 동일 패턴 적용됨.
  - 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/package.json` 라인 3211, `/Volumes/project/private/clemvion/codebase/frontend/package.json` 라인 3371
  - 상세: `//pin` JSON 주석 필드에 핀 이유(sanitize 공급망 무결성, monorepo 전역 정렬, 0.x semver)를 기재해 정책 준수 여부를 코드베이스에서 직접 확인 가능하다.
  - 제안: 없음.

### 발견사항 7
- **[INFO]** `spec/7-channel-web-chat/4-security.md` 갱신 — `§1.1 마크다운/HTML sanitize 정책 매트릭스` 가 두 렌더러(위젯/메인 앱) 모두 포함하여 추가됨. 코드 SoT cross-reference 포함. 스펙-구현 정렬 측면에서 양호.
  - 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md` 라인 3699-3706
  - 상세: 보안 위협별 처리 방식, 사용 라이브러리, 코드 SoT, 단위 테스트 연동까지 표 형식으로 문서화되었다. "검증 동등성" 단락이 테스트 파일을 명시적으로 연결한다.
  - 제안: `pending_plans` 에 남아 있는 기존 plan 파일들이 이 스펙 변경과 연관성이 있는지 주기적으로 정리할 것을 권장. 당장 필수는 아님.

### 발견사항 8
- **[INFO]** `README.md` — Node.js 요구사항 줄이 `24+` 로 갱신되고 괄호 안에 내부 빌드 기준과 외부 SDK 소비 기준을 구분하는 설명이 추가됨. 변경량이 적절하고 명확하다.
  - 위치: `/Volumes/project/private/clemvion/README.md` 라인 64
  - 상세: "외부 배포 SDK 소비는 Node 20+ 호환" 이라는 예외 사항이 같은 줄에 명시되어 혼동 방지. PROJECT.md 정책과 정렬됨.
  - 제안: 없음.

### 발견사항 9
- **[INFO]** `plan/in-progress/refactor/07-dependency-residual.md` — 체크리스트 형식이 명확하고, 결정 고정값, 워크플로 단계, 인프라 트러블슈팅 메모까지 기록되어 있어 작업 히스토리 보존이 양호하다.
  - 위치: `/Volumes/project/private/clemvion/plan/in-progress/refactor/07-dependency-residual.md`
  - 상세: 아직 `[ ]` 항목(`/ai-review`, `consistency-check --impl-done`, `plan complete 이동`)이 남아 있어 plan 이 완결 상태가 아님을 명확히 표시.
  - 제안: 없음 — 진행 중 상태로 적절히 기록됨.

### 발견사항 10
- **[INFO]** `auth.service.spec.ts` 변경 — `jwtService` 앞의 `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 주석 제거. 이는 주석 정확성 관점에서 오히려 개선으로, 이제 불필요한 억제 주석이 없어졌다.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.service.spec.ts` 라인 575-577
  - 상세: 주석 제거가 코드 의도를 더 명확히 한다. 의도하지 않은 정보 손실이 아닌 불필요한 노이즈 제거.
  - 제안: 없음.

---

## 요약

이번 변경셋은 의존성 정비(otplib v12→v13, @types/node 22→24, jsdom/vitest/vitejs 업그레이드)와 Node.js 버전 정책 공식화를 한꺼번에 처리한다. 문서화 관점에서는 전반적으로 수준이 높다 — PROJECT.md 에 버전 핀 정책·테스트 이원화·Node floor 를 명시하였고, README.md 는 내부/외부 기준 구분을 한 줄에 표현하였으며, `//pin` JSON 주석이 정책 준수 근거를 코드 안에 내재화하였다. `totp.service.ts` 의 `verifyCode` JSDoc 과 `jest.config.ts` 인라인 주석도 변경 배경을 명확히 설명한다. 유일하게 주의할 점은 PROJECT.md 에 선언된 "외부 SDK `>=20`" 정책에 대해 `packages/sdk` 의 engines 필드 반영 여부가 이 diff 에서 확인되지 않는다는 것으로, 스펙-구현 일관성 측면에서 추가 검증이 필요하다.

---

## 위험도

LOW

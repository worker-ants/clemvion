# Documentation Review — 07-dependency 잔여 8건 ai-review 후속

## 발견사항

### [INFO] totp.service.ts: verifyCode JSDoc 이 otplib v13 API 변경을 부분적으로만 반영
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/totp.service.ts` — `verifyCode` 메서드 JSDoc (L1411-L1415)
- 상세: JSDoc 에 `epochTolerance` 파라미터 설명·v13 마이그레이션 배경이 있으나, 이번 변경에서 추가된 OWASP A09 로깅 정책(에러 타입명만 로깅)은 JSDoc 본문이 아니라 인라인 주석으로만 기록됐다. `verifyCode` 는 `private` 이므로 외부 API 문서 필요성은 낮지만, `TotpService` 클래스 레벨 JSDoc 이 없어 모듈 전체 보안 정책(recovery code SHA-256 해시, OWASP A09 로깅 억제)을 설명하는 곳이 없다.
- 제안: 클래스 선언 바로 위에 `/** 2FA TOTP 서비스. ... OWASP A09: verifyCode 내부 에러는 타입명만 로깅. */` 수준의 단락 JSDoc 추가 고려.

### [INFO] totp.service.ts: disable() JSDoc 이 호출 전 사전조건을 인라인 주석으로만 기록
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/totp.service.ts` L1490
- 상세: `/** 2FA 비활성. 호출 전에 비밀번호 재확인은 컨트롤러에서 수행. */` 로 단일 줄 JSDoc 이 있으나, 이 메서드가 새로 테스트 케이스로 커버되었음에도 "어떤 필드를 null/false 로 초기화하는지" 에 대한 명세가 JSDoc 에는 없다. 특히 `twoFactorSecret: null as unknown as string` 캐스팅이 TypeScript 타입 한계 때문임을 설명하는 주석이 없다.
- 제안: `/** ... twoFactorSecret: 타입 null 불허로 인해 캐스팅. twoFactorEnabled·twoFactorSecret·totpRecoveryCodes 모두 초기화. */` 수준으로 보강.

### [INFO] safe-html.test.ts: 새 describe 블록 레이블에 리뷰 티켓 참조가 노출됨
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/lib/safe-html.test.ts` L1562(diff line), describe label `"빈/공백 입력 경계값 (ai-review m-4 W5)"`
- 상세: describe 레이블에 `ai-review m-4 W5` 라는 내부 리뷰 티켓 식별자가 포함되어 있다. 외부에서 본 파일 컨텍스트(파일 파일 L1588 `커버리지:` 섹션)는 리뷰 티켓 ref 없이 기능 단위로 기술하는 패턴인데, 새 describe 만 예외다.
- 제안: `"빈/공백 입력 경계값"` 으로 레이블 정리, 또는 파일 상단 커버리지 주석에 `빈/공백 입력 경계값` 항목만 추가하여 티켓 참조를 외부 노출에서 분리.

### [INFO] safe-html.test.ts: 파일 상단 커버리지 주석이 새 테스트 케이스를 미반영
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/lib/safe-html.test.ts` L1586-L1597 (파일 헤더 JSDoc)
- 상세: 파일 상단 `/** safe-html.ts 단위 테스트 ... 커버리지: ... */` 주석이 이번에 추가된 "빈/공백 입력 경계값" 케이스를 열거하지 않는다. 파일에 명시적 커버리지 목록이 있는 만큼 새 케이스 추가 시 갱신이 필요하다.
- 제안: 커버리지 목록에 `- 빈/공백 입력 경계값 → throw 없이 안전 string 반환` 항목 추가.

### [INFO] SUMMARY.md: 문서화 에이전트 요약 라인이 수정 완료된 항목을 반영하지 않음
- 위치: `/Volumes/project/private/clemvion/review/code/2026/06/17/00_39_22/SUMMARY.md` — `## 에이전트별 위험도 요약` 표, documentation 행
- 상세: `documentation | LOW | setup() JSDoc v13 미반영(INFO), packages/sdk engines 미확인(WARNING)` 로 기록되어 있으나, 이번 커밋에서 `setup()` JSDoc 이 갱신되었는지 여부가 불분명하고(diff 에 setup() JSDoc 변경 없음), `packages/sdk engines` 확인도 RESOLUTION.md 의 INFO-4 처분과 정합하지 않는다. RESOLUTION.md 는 `packages/sdk 는 이미 engines.node >=20.0.0 보유 — 정책 반영됨` 으로 비이슈 처분했는데 SUMMARY 에는 경고로 남아 있다. SUMMARY 는 원본 리뷰 기록이므로 수정 대상은 아니지만, RESOLUTION.md 에서 이 불일치를 명시적으로 언급하지 않아 추적성이 약하다.
- 제안: RESOLUTION.md 에 `INFO-4(packages/sdk engines): SUMMARY 문서에이전트 행 WARNING 표기는 원본 리뷰 기록이며, 실제 확인 결과 이미 반영됨으로 비이슈` 언급 추가 (선택).

### [INFO] spec/7-channel-web-chat/4-security.md: 워킹트리에 미커밋 변경 존재
- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md` — `입력 sanitize` 행
- 상세: `git status` 결과 해당 파일이 `Changes not staged for commit` 상태다. diff 내용은 `입력 sanitize` 정책을 deny-by-default 화이트리스트(DOMPurify ALLOWED_TAGS/ATTR/ALLOWED_URI_REGEXP) 로 구체화하는 spec 개선이다. 이번 커밋(11c53cb)의 파일 목록에 이 spec 변경이 포함되지 않았다.
- 제안: spec 변경이 이번 리팩터링 범위라면 커밋에 포함하거나, 별도 spec-only 커밋으로 분리하여 spec↔구현 정합성을 확보할 것. 현재 워킹트리에만 존재하는 spec 변경은 추적되지 않는 상태다.

---

## 요약

변경 범위는 테스트 보강(auth.service.spec, totp.service.spec, safe-html.test) 및 OWASP A09 로깅 개선(totp.service.ts)으로, 사용자 가시 API 변경이나 README/CHANGELOG 갱신이 필요한 기능 추가는 없다. 기존 인라인 주석·JSDoc 수준은 충분하며 Critical·WARNING 급 문서화 누락은 발견되지 않았다. 다만 safe-html.test.ts 의 파일 헤더 커버리지 목록이 새 케이스를 반영하지 않고, describe 레이블에 내부 리뷰 티켓 식별자가 노출되어 있으며, spec/7-channel-web-chat/4-security.md 의 개선 내용이 이번 커밋에 포함되지 않고 워킹트리에 미커밋 상태로 남아 있는 점이 추적성 관점에서 정리가 필요하다.

---

## 위험도

LOW

STATUS: SUCCESS

### 발견사항

- **[INFO]** `auth.controller.spec.ts` 포맷팅 변경 (기능 무관)
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.spec.ts`, diff +449~451, +462~464
  - 상세: `await expect(...).rejects.toThrow(...)` 호출의 줄바꿈 위치가 변경됨. prettier 또는 수동 포맷팅 정리로 보이며 코드 의미 변화 없음.
  - 제안: 포맷팅 전용 변경은 별도 커밋으로 분리하는 것이 이상적이나, 변경 규모가 작아 허용 가능.

- **[INFO]** `webauthn.service.ts` 에 중복 JSDoc 블록 존재
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 라인 2460~2465
  - 상세: `deleteCredential` 메서드 위에 두 개의 별도 주석 블록이 공존함 — 이전의 `/** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */`가 삭제되지 않고 새로운 `/** credential 삭제. 삭제 후 남은 credential 수(remaining)를 반환한다 — ... */`가 추가된 상태.
  - 제안: 구 주석(`/** 개별 삭제. ... */`)을 제거하거나 두 주석을 하나로 병합해야 함. 기능 영향은 없으나 문서 중복.

- **[INFO]** `spec/data-flow/1-audit.md` Rationale 단락의 call site 카운트 불일치
  - 위치: `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` Rationale 섹션 마지막 단락 ("모든 도메인 service 가 호출하는..." 폐기 선언 부분)
  - 상세: Rationale 마지막 단락은 이전 "4개 모듈 13개 call site" 수치를 그대로 유지하지만, §1.1 본문은 "7개 위치 18개 call site"로 갱신됨. Rationale 단락이 §1.1 표와 불일치.
  - 제안: Rationale 단락의 "4개 모듈 13개 call site" 수치도 "7개 위치 18개 call site"로 갱신 필요.

### 요약

변경의 핵심 목적은 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 세 audit 액션을 `audit-action.const.ts`에 추가하고 `users.controller.ts`, `auth.controller.ts`, `webauthn.controller.ts` controller 경계에서 기록하는 것이다. 이에 필요한 모듈 DI 등록(`auth.module.ts`, `users.module.ts`), 서비스 반환값 변경(`webauthn.service.ts`의 `deleteCredential`이 `{ remaining }` 반환), 단위 테스트 추가, plan 문서 완료 처리, spec 문서 갱신이 모두 이 목적에 직결된다. 의도된 범위를 벗어나는 실질적 변경은 없으나, `webauthn.service.ts`에 구 주석이 중복 잔존하고 `spec/data-flow/1-audit.md` Rationale 단락의 call site 수치가 §1.1 본문과 불일치하는 문서 결함 2건이 발견됨. 인라인 포맷팅 정렬 변경도 소폭 포함되어 있으나 기능 영향은 없다.

### 위험도
LOW

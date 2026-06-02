# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `rejectCafe24InvalidScope` 메서드 — 항상 throw 하는 함수의 반환 타입 표현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.ts` (추가된 `private async rejectCafe24InvalidScope`)
- 상세: 메서드 시그니처가 `Promise<never>` 로 선언되어 있고 내부에서 항상 throw 한다. 그러나 메서드 내 두 곳의 `throw err` 이후에 세 번째 `throw attachCallbackContext(err, ...)` 가 있어, 독자는 "왜 같은 `err` 를 두 번 만들어 두 곳에서 던지는가"라고 의문을 갖게 된다. `err` 변수가 `BadRequestException` 인스턴스를 선언 후 재사용하는 구조인데, context 없이 throw 하는 경로(state 미존재 / integrationId 없음)와 context 첨부 후 throw 하는 경로를 공유함으로써 "던지기 전에 변수 선언 → 조건부 조기 throw → 나머지 context 첨부 후 최종 throw" 라는 3단계 흐름이 하나의 12줄 메서드 안에 압축되어 있다. 가독성 저하.
- 제안: 조기 throw 경로에서 직접 `throw new BadRequestException(...)` 를 인라인으로 작성하고, 마지막 경로에서만 `err` 변수를 사용하도록 분리하거나, 반대로 헬퍼를 `buildInvalidScopeError()` 와 `consumeStateAndThrow()` 로 분리한다.

---

### [WARNING] 테스트 내 반복 타입 단언 패턴 — 중복 인라인 타입 캐스팅
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` — `pending_install → status 보존` 케이스(라인 90–94), `connected reauthorize` 케이스(라인 151–155)
- 상세: 각 it-블록마다 `const saved = integrationRepo.save.mock.calls[0][0] as { status: string; statusReason: string; lastError: {...} }` 형태의 완전히 동일한 구조의 타입 단언이 반복 작성되어 있다. 새 테스트 추가 시 매번 복사·붙여넣기가 필요하고, `lastError` 내부 타입 변경 시 모든 케이스를 개별 수정해야 한다.
- 제안: `describe` 스코프 상단에 `type SavedIntegration = { status: string; statusReason: string; lastError: { code: string; details?: { requiresCafe24Approval?: string[] } } }` 를 한 번만 선언해 재사용한다. 혹은 `getSaved()` 헬퍼 함수를 만들어 단언을 한 곳에서 관리한다.

---

### [INFO] `makeStateRow` 헬퍼 — describe 스코프 내 로컬 함수 vs. 파일 상단 팩토리 패턴 불일치
- 위치: `integration-oauth.service.cafe24.spec.ts` 라인 41–61 (`makeStateRow` 함수)
- 상세: 파일 내 다른 테스트 블록들은 state row 객체를 각 `it` 블록 내에 인라인으로 선언하는 패턴인데, 신규 `describe` 블록만 `makeStateRow` factory 함수를 도입했다. 패턴 혼재 자체가 큰 문제는 아니지만, 기존 코드베이스 스타일과 달리 `makeStateRow` 가 `Record<string, unknown>` 을 반환하고 이를 다시 `normalizeRawStateRow` 가 소비하는 이중 타입 변환이 있다. 테스트 의도(어떤 필드를 override 하는지)는 `overrides` 파라미터로 잘 드러나지만, `Record<string, unknown>` 타입은 컴파일 시 필드 오타를 잡지 못한다.
- 제안: `makeStateRow` 의 반환 타입을 `Partial<IntegrationOAuthState> & Record<string, unknown>` 으로 좁히거나, 기존 파일 내 다른 블록들과 스타일을 맞추되 `makeStateRow` 는 재사용이 많을 때만 도입한다. 현재 5개 케이스에서 활용되므로 factory 도입 자체는 적절하다.

---

### [INFO] `integration-oauth.service.spec.ts` 변경 — 인라인 `undefined` 5번째 인자 주석
- 위치: `integration-oauth.service.spec.ts` 라인 237, 246
- 상세: 기존 `markIntegrationCallbackError` 호출 검증에 `undefined` 를 5번째 인자로 명시적으로 추가하고 `// §2: 5번째 extra 인자 — invalid_scope 외에는 undefined` 주석을 붙였다. 의도 설명 자체는 좋으나, Jest `toHaveBeenCalledWith` 에서 trailing `undefined` 를 명시하지 않아도 동작에는 차이가 없을 때가 많다. 향후 `extra` 파라미터가 삭제되거나 시그니처가 변경될 경우 이 명시적 `undefined` 가 혼란을 줄 수 있다.
- 제안: 인자 수 명시의 의도를 주석으로 남기는 것은 좋으나, 주석이 두 곳에 거의 동일하게 반복되므로 한 곳에서 `§2 extra 인자 계약` 을 설명하고 나머지는 참조 형태로 줄인다.

---

### [INFO] `scope-tab.tsx` — 동일 i18n 키 + 동일 CSS 클래스 패턴 중복
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` — 라인 1526–1531(기존 `missingScopes` 블록 내부)과 신규 `oauth_invalid_scope` 섹션(라인 1543–1549)
- 상세: `t("integrations.cafe24RestrictedApprovalApiError", { scopes: requiresApprovalFromError.join(", ") })` 와 `className="text-xs text-red-900 dark:text-red-200"` 가 두 섹션에 그대로 복제되어 있다. 두 경로(insufficient_scope 케이스 내부 + oauth_invalid_scope 독립 섹션)가 같은 번역 키와 스타일을 공유한다.
- 제안: `<RestrictedApprovalMessage scopes={requiresApprovalFromError} t={t} />` 같은 소규모 컴포넌트로 추출하거나, 최소한 두 사용 위치에 `{/* 동일 메시지 — restricted approval 안내, §4.3 */}` 주석을 달아 의도적 공유임을 명시한다.

---

### [INFO] `rejectCafe24InvalidScope` — 메서드명이 계획 문서와 상이 (일관성)
- 위치: `integration-oauth.service.ts` 내 private 메서드명 `rejectCafe24InvalidScope`
- 상세: consistency 체크 산출물(`review/consistency/2026/06/02/09_09_52/SUMMARY.md` INFO #10)이 이미 `throwCafe24InvalidScope` vs `rejectCafe24InvalidScope`/`handleCafe24InvalidScope` 관례 불일치를 지적하였고, 구현에서는 `rejectCafe24InvalidScope` 로 결정했다. 코드베이스 내 유사 메서드들(`handleCallback`, `markIntegrationCallbackError`)이 `handle*`/`mark*` 패턴인 데 반해 `reject*` 는 처음 등장하는 prefix 다. private 메서드이고 외부 계약에 영향 없으나, 팀 내 "항상 throw 하는 helper = `reject*`" 라는 암묵적 새 패턴이 명시적으로 문서화되지 않으면 미래 기여자가 혼란을 겪을 수 있다.
- 제안: 현 이름 유지 시 인터페이스 JSDoc 에 "항상 throw 한다 (never returns)" 를 명시하거나, 기존 `handle*` 관례로 맞추되 JSDoc 으로 `@throws` 를 선언한다.

---

## 요약

이번 변경은 Cafe24 `invalid_scope` 콜백 처리 로직을 `handleCallback` 에 삽입하고 관련 테스트를 추가한 작업이다. 전반적으로 단일 책임 분리(`rejectCafe24InvalidScope` 추출), spec 참조 주석 일관 삽입, `makeStateRow` factory 도입 등 유지보수성을 고려한 흔적이 뚜렷하다. 주요 개선 여지는 세 가지다. 첫째, `rejectCafe24InvalidScope` 내부에서 동일한 `BadRequestException` 인스턴스를 공유하며 조건부로 재throw 하는 패턴이 독자에게 불필요한 인지 부담을 준다. 둘째, 테스트 내 동일 타입 단언 구조가 케이스마다 반복 선언되어 향후 타입 변경 시 산포 수정을 요구한다. 셋째, `scope-tab.tsx` 에서 동일 i18n 키 + 동일 CSS 클래스 쌍이 두 섹션에 복제된 점은 장기적으로 UI 정책 변경 시 누락 위험을 내포한다. 이 외 발견 사항은 모두 INFO 수준이며 현재 코드의 정확성에는 영향이 없다.

## 위험도

LOW

STATUS: SUCCESS

# 신규 식별자 충돌 검토

검토 모드: `--impl-prep`
대상 범위: `spec/2-navigation/4-integration.md` (구현 착수 전 검토)

---

## 발견사항

### [WARNING] `requestScopesCafe24PrivatePendingTitle` / `requestScopesCafe24PrivatePendingDesc` — 기존 `cafe24PrivatePending*` 계열과 의미 유사

- **target 신규 식별자**: `requestScopesCafe24PrivatePendingTitle`, `requestScopesCafe24PrivatePendingDesc`, `requestScopesCafe24PrivatePendingScopesAdded` (plan/in-progress/cafe24-request-scopes-ui.md §변경 범위)
- **기존 사용처**:
  - `frontend/src/lib/i18n/dict/ko.ts:1623` — `cafe24PrivatePendingTitle: "Cafe24 Developers 설정을 완료해 주세요"` (신규 통합 흐름 `new/page.tsx` 의 `Cafe24PrivatePendingStep` 에서 사용)
  - `frontend/src/lib/i18n/dict/ko.ts:1624` — `cafe24PrivatePendingDesc: "통합이 연결 대기 상태로..."` (동일 컴포넌트)
  - `frontend/src/lib/i18n/dict/en.ts:1625`, `1626` — 같은 키의 영문 값
- **상세**: 기존 `cafe24PrivatePending*` 키는 신규 통합 등록 흐름(`pending_install` 상태의 폴링 컴포넌트)에서 사용된다. 새로 도입하는 `requestScopesCafe24PrivatePending*` 키는 이미 `connected` 상태인 통합의 scope 추가 요청 흐름에서 사용된다. 두 상황은 맥락이 다르므로 **키 값이 달라야 하고**, 실제로 plan 이 의도한 문구("Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다.")는 기존 키의 값과 다르다. 식별자 충돌(동일 키명 중복)은 없지만, 네이밍 패턴(`cafe24PrivatePending*` vs `requestScopesCafe24PrivatePending*`)이 혼용될 경우 향후 유지보수자가 두 계열 키를 혼동하거나, 잘못된 키를 참조하는 오류가 발생할 수 있다.
- **제안**: 충돌 자체는 없으나, 일관성을 위해 `cafe24PrivatePending*` 계열의 prefix 패턴을 따르되 scope-request 맥락을 명확히 구분하는 방안을 검토한다. 예: `cafe24PrivateScopeRequestTitle`, `cafe24PrivateScopeRequestDesc`, `cafe24PrivateScopeRequestAdded`. 또는 현행 plan 의 `requestScopesCafe24PrivatePending*` 패턴을 유지하되, 기존 `cafe24PrivatePending*` 계열에 대한 그룹 주석을 추가해 의도적 분리임을 명시한다.

---

### [INFO] `scopeRequestOpened` 키 — request-scopes 성공 분기 변경 시 toast 메시지 재사용 검토

- **target 신규 식별자**: (없음 — 기존 키 재사용)
- **기존 사용처**: `frontend/src/lib/i18n/dict/ko.ts:1583`, `en.ts:1585` — `scopeRequestOpened: "권한 요청 창을 열었어요"` / `"Scope request window opened"`. `frontend/src/app/(main)/integrations/[id]/page.tsx` 의 `requestMutation.onSuccess` 에서 `authUrl` 분기에 사용 중.
- **상세**: plan 이 `onSuccess` 에 `cafe24_private_pending` 분기를 추가하면서 기존 `authUrl` 분기의 `toast.success(t("integrations.scopeRequestOpened"))` 는 그대로 유지된다. 충돌은 없다. 다만 `scopeRequestOpened` 문구("권한 요청 창을 열었어요")는 팝업 창이 열리는 흐름에만 의미가 있으므로, cafe24_private_pending 분기에서 이 키를 재사용하지 않도록 구현 시 주의가 필요하다. plan 이 `toast.info` 로 별도 알림을 추가하는 것으로 기술하고 있으므로 의도는 명확하다.
- **제안**: 구현 시 `cafe24_private_pending` 분기에서 `scopeRequestOpened` 를 호출하지 않도록 코드 리뷰 시 확인.

---

### [INFO] 신규 API endpoint 없음 — 기존 `POST /api/integrations/:id/request-scopes` 재사용

- **target 신규 식별자**: (없음)
- **기존 사용처**: `spec/2-navigation/4-integration.md §4.4` — `POST /api/integrations/:id/request-scopes`. `frontend/src/lib/api/integrations.ts` 의 `requestScopes()` 메서드.
- **상세**: 이번 변경은 이미 정의·구현된 endpoint 를 호출하는 프론트엔드 핸들러 분기 추가만 해당한다. 신규 endpoint 가 없으므로 API 충돌 없음.
- **제안**: 해당 없음.

---

### [INFO] 신규 컴포넌트명 없음 — 기존 `Cafe24PrivatePendingStep` 재사용 하지 않는 결정이 문서화됨

- **target 신규 식별자**: (없음 — inline alert 방식으로 별도 컴포넌트 미도입)
- **기존 사용처**: `frontend/src/app/(main)/integrations/new/page.tsx` — `Cafe24PrivatePendingStep` 함수 컴포넌트.
- **상세**: plan §결정 에서 `Cafe24PrivatePendingStep` 재사용을 명시적으로 배제하고 inline alert 방식을 선택했다. 컴포넌트명 충돌 없음.
- **제안**: 해당 없음.

---

## 요약

`spec/2-navigation/4-integration.md` 의 구현 범위(`--impl-prep`)에서 target 문서 자체는 변경이 없으며, 구현 대상인 i18n 키 3개(`requestScopesCafe24PrivatePendingTitle`, `requestScopesCafe24PrivatePendingDesc`, `requestScopesCafe24PrivatePendingScopesAdded`)는 기존 키와 동일 이름 충돌이 없다. 다만 기존 `cafe24PrivatePending*` 계열과 유사한 맥락을 다루는 새 계열(`requestScopesCafe24PrivatePending*`)이 생겨 prefix 패턴이 혼용되는 점은 향후 유지보수 혼동 위험이 있어 WARNING 으로 표기했다. 신규 API endpoint, 엔티티명, 이벤트명, 환경변수, 파일 경로 충돌은 발견되지 않았다.

## 위험도

LOW

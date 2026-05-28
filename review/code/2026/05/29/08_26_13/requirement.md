# 요구사항(Requirement) 리뷰 결과

리뷰 대상 커밋: `b2245213630bbf42a3dda151a9861dd88c4a63df`
리뷰어: requirement-reviewer

---

## 발견사항

### [INFO] ChatChannelCard 의 handleSave 가 여전히 수동 `saving` state 사용

- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `ChatChannelCard` 함수 내부 (`saving` state, `setSaving(true/false)`, try/catch/finally 패턴)
- 상세: 이번 커밋은 `ExternalInteractionCard.handleSave` 를 `useMutation` 으로 교체(W3)했으나, 같은 파일의 `ChatChannelCard.handleSave` 는 동일한 수동 `saving` 패턴을 그대로 유지하고 있다. 전체 파일 컨텍스트에서 `const [saving, setSaving] = useState(false)` 와 `setSaving(true)` / `setSaving(false)` 가 `ChatChannelCard` 에 남아 있음이 확인된다. 본 PR 의 commit message 와 diff 범위는 ExternalInteractionCard 에 집중되어 있으므로 기능 요구사항상 이번 커밋의 "의도" 범위를 벗어난 것이지만, 코드 일관성 측면에서 W3 해소 의도가 절반만 달성된 상태다. 기능 자체는 동작하므로 severity 는 INFO.
- 제안: `ChatChannelCard.handleSave` 도 `useMutation` 으로 교체해 파일 전체에서 `useMutation` 패턴을 일관 적용한다. 단, 본 커밋이 의도적으로 EIA 만 대상으로 했다면 별도 PR 로 처리 가능.

---

### [INFO] 테스트에서 `viewer` 역할 케이스 미검증

- 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx` 전체
- 상세: spec `2-trigger-list.md §2.3.1` 은 "editor 미만 역할은 edit 토글 자체가 노출되지 않는다. viewer 는 모든 카드가 read 모드로 보임" 을 명시한다. `beforeEach` 에서 `setRole("editor")` 로 고정하고 있으며, `viewer` 역할에서 Edit 버튼이 노출되지 않는지 검증하는 케이스가 없다. 기능 완전성 관점에서 권한 게이트(`useHasRole("editor")`) 의 UI 반영이 테스트에서 검증되지 않는다.
- 제안: `viewer` 역할 고정 후 Edit 버튼이 각 카드에 노출되지 않음을 확인하는 케이스를 추가한다.

---

### [INFO] spec `2-trigger-list.md §2.4` 의 URL 형식과 `getWebhookUrl` 구현 차이

- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `getWebhookUrl` 함수
- 상세: spec §2.4 는 `{base_url}/hooks/{endpoint_path}` 를 URL 형식으로 정의하고 "SaaS는 서비스 도메인, 셀프 호스팅은 설정 도메인" 으로 명시한다. 현재 구현은 `window.location.origin.replace(/:\d+$/, ":3011")` 로 포트를 개발 서버 포트인 3011 로 하드코딩해 덮어쓴다. 이 로직은 프로덕션 환경에서는 올바른 base_url 을 반환하지 못하고 잘못된 포트가 포함된 URL 을 노출할 수 있다. spec 이 "SaaS 의 경우 서비스 도메인" 이라고 명시한 것과 일치하지 않는다.
- 제안: 환경 변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`)나 백엔드 응답에서 base_url 을 주입하는 방식으로 교체한다. 이번 커밋의 변경 범위는 아니나 spec fidelity gap 이므로 기록한다.

---

### [INFO] 테스트 Case 6 — AuthConfig type 표시 텍스트 대소문자 의존성

- 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx` 230-232행, 262-264행
- 상세: 테스트가 `/Partner HMAC · HMAC/` 정규식으로 렌더링 확인을 한다. `AUTH_CONFIG_TYPE_LABEL_KEYS["hmac"]` 의 i18n 번역 결과 대소문자 포맷에 따라 테스트가 통과/실패한다. 현재 테스트는 i18n 사전을 mock 하지 않고 실제 locale store 를 "en" 으로 고정하므로 실제 번역값에 의존한다. spec 에 이 라벨의 대소문자 형식 정의가 없어 INFO 로 분류한다.
- 제안: 실제 i18n 사전의 `authentication.typeHmac` (또는 해당 키) 값이 "HMAC" 임을 확인하고 정규식을 고정하거나, i18n mock 을 통해 번역 결과를 제어한다.

---

### [INFO] `useCopyToClipboard` — `navigator.clipboard` 미존재 환경 케이스 미검증

- 위치: `codebase/frontend/src/lib/hooks/__tests__/use-copy-to-clipboard.test.tsx` 및 `codebase/frontend/src/lib/hooks/use-copy-to-clipboard.ts`
- 상세: 훅 구현에서 `navigator.clipboard` 가 undefined 인 환경(구형 브라우저)에서 `navigator.clipboard.writeText` 접근 시 런타임 TypeError 가 발생한다. 현재 테스트는 `writeText` 가 rejection 하는 케이스는 커버하지만 `navigator.clipboard` 자체가 undefined 인 케이스는 커버하지 않는다. `"use client"` 지시어로 SSR 실행은 방지되나 구형 브라우저 지원이 필요한 경우 에러 시나리오가 누락이다. spec 에 브라우저 호환성 요구사항 명시가 없어 INFO.
- 제안: `navigator.clipboard` 미존재 시 `error` toast 를 내보내는 방어 코드를 훅에 추가하고 이를 검증하는 테스트 케이스를 추가한다.

---

## 요약

이번 커밋(W3/W4/W6/W7)은 선언된 목표인 `useCopyToClipboard` 훅 추출, `ExternalInteractionCard.handleSave` 의 `useMutation` 교체, `TriggerDetailDrawer` 단위 테스트 신설을 모두 구현하고 있다. spec `2-trigger-list.md §2.3.1` 의 R-14(authConfigId 단일 바인딩·inline 인증 폐지), R-7(Recent Calls 카드 제거), 조건부 카드 렌더링(webhook/schedule 분기), isActive 배지 등 핵심 요구사항이 코드와 테스트 양쪽에서 충실히 반영되어 있다. 발견된 항목은 모두 INFO 수준이며 기능 동작 자체를 차단하는 CRITICAL/WARNING 이슈는 없다. `ChatChannelCard` 의 수동 saving state 가 이번 W3 의도와 대비되는 내부 불일치이고, `getWebhookUrl` 의 개발 포트 하드코딩이 spec §2.4 와 장기적으로 불일치하는 점이 가장 주목할 만한 항목이다.

## 위험도

LOW

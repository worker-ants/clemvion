# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/` (위젯 chrome i18n 활성, impl-done)

## 점검 범위 확인

`git diff origin/main..HEAD` 로 실 변경분을 확인한 결과, 이번 변경은 **위젯 chrome 문자열 EN 다국어화(`BootConfig.locale`
reserved → 활성)** 로 스코프가 명확히 좁다:

- `spec/7-channel-web-chat/{_product-overview,1-widget-app,2-sdk,4-security,5-admin-console}.md`
- `spec/conventions/i18n-userguide.md` (위젯 carve-out 재정의)
- `spec/0-overview.md` (§6.1 요약 갱신)
- `codebase/channel-web-chat/src/lib/i18n/**`(신규) + 4개 위젯 컴포넌트(`panel`/`composer`/`dynamic-form`/`launcher`/`presentations`/`widget-app`) 소비 배선
- `codebase/backend/**` 변경 없음(API 계약·데이터 모델·RBAC 미터치)
- `.claude/config/doc-sync-matrix.json`·`PROJECT.md`·`CHANGELOG.md` 동반 갱신

새 requirement ID 는 도입되지 않았다(`NAV-WC-*`/`EIA-*` 등 기존 ID 재사용·참조뿐). 신규 엔티티·엔드포인트·상태 전이·RBAC 규칙도
없다.

## 발견사항

교차 검증한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 CRITICAL/WARNING 급 충돌을
찾지 못했다. 확인한 구체 항목:

- **`BootConfig.locale` 의미 변경(reserved/inert → 활성)**: `2-sdk.md §4·R6`, `1-widget-app.md §4·R10`,
  `5-admin-console.md §4·§6.1`, `_product-overview.md §2` 4곳 모두 "명시 → `navigator.language` auto-detect → `ko`
  fallback, boot 1회 해석·재전송으로 미반영·iframe 재마운트로만 반영" 을 동일하게 서술 — 상호 모순 없음. `spec/` 전역에서
  `BootConfig`/위젯 `locale` 을 언급하는 다른 위치(`spec/2-navigation/_product-overview.md` NAV-WC-04 등)는 필드 존재만
  일반 언급할 뿐 "Korean-only"류 stale 주장을 반복하지 않음(grep 확인, 잔존 stale 참조 없음).
- **`i18n-userguide.md` 위젯 carve-out 개정**: "Principle 1·2 스코프 밖(dict indirection 전면 면제)" → "메인 앱 dict 기구는
  여전히 스코프 밖이나 위젯 로컬 catalog + parity 는 신규 적용"으로 세분화. 신설 Gate 행("2-위젯")은 기존 Gate 2(메인 앱
  dict parity) 를 대체·재번호화하지 않고 **별도 행으로 추가** — 기존 gate 참조 문서(`spec/conventions/spec-impl-evidence.md`
  등)와 번호 충돌 없음.
- **Chat Channel `languageLocale` 과의 이름 충돌 방지**: `2-sdk.md §4`·`1-widget-app.md §4` 가 "이 `locale` 은 위젯 UI
  언어일 뿐 Chat Channel 의 `languageLocale`(서버 발신 언어, [15-chat-channel §4.1](../5-system/15-chat-channel.md))과는
  별개" 를 명시 — 대상 문서(`spec/5-system/15-chat-channel.md §4.1 Trigger.config.chatChannel`)에 실제로 그 필드가
  존재함을 확인, 참조 유효. 두 `locale` 개념이 서로 다른 문서에 존재하지만 혼동 방지 문구가 선제적으로 들어가 있어 충돌
  소지가 낮다.
- **계층 책임**: 이번 변경은 위젯 SPA(`codebase/channel-web-chat`) 로컬 catalog 신설로 한정되며 메인 앱
  `frontend/src/lib/i18n/dict` 경계·backend 서버 저장 스키마·EIA 표면을 건드리지 않는다 — `0-architecture.md §R2`(EIA
  facade 미신설)·`i18n-userguide.md` "물리·개념적으로 분리된 자체 catalog" 서술과 일치. backend 코드 diff 0건으로 API
  계약·RBAC 변경 부재를 재확인.
- **plan 정합**: `plan/complete/webchat-i18n-scope.md`(과거 defer 결정, #922)는 이번 커밋에서 수정되지 않고 그대로
  보존되며, 신규 `plan/in-progress/spec-draft-webchat-en-i18n.md` 가 그 "예약된 활성화 경로 실행"임을 명시 — rationale
  번복이 아니라 예약 실행이라는 프레이밍이 `2-sdk.md R6`/`1-widget-app.md R10`/`i18n-userguide.md` 세 곳 모두 동일 표현으로
  일관됨. 연관 후속 plan(`plan/in-progress/webchat-widget-presentation-followups.md`)도 신규 chrome 문구는 i18n catalog
  경유하라는 안내를 추가해 향후 하드코딩 회귀를 선제 차단.
- **impl 대조**: `resolveLocale`/`I18nProvider`/`widget-app.tsx` 의 boot-1회 고정 로직, `error.generic` 카탈로그 키,
  admin 콘솔 `live-preview.tsx` 의 locale 변경 시 iframe key 재마운트 로직 모두 spec 서술과 일치(코드 절대경로로 직접
  확인) — spec 이 주장하는 동작과 실제 구현 간 괴리 없음.

CRITICAL/WARNING 으로 격상할 만한 항목은 발견되지 않았다.

## 요약

이번 변경은 `spec/7-channel-web-chat/` 내부 4개 문서 + `spec/conventions/i18n-userguide.md` 위젯 carve-out을 하나의
일관된 서사("v1 reserved 로 예약해 둔 `locale` 활성화 경로의 실행")로 동시 개정했고, 영향받는 인접 영역(Chat Channel
`languageLocale`, 메인 앱 dict 시스템, EIA 표면, 워크스페이스 RBAC)에 대해 명시적으로 경계·비침범을 재확인하는 문구를
같이 넣어 두었다. 새 requirement ID·엔드포인트·엔티티·상태 전이·RBAC 규칙이 도입되지 않았고 backend 코드 변경도 없어
cross-spec 충돌 표면 자체가 좁다. 실제 코드(위젯 locale 해석·admin 콘솔 재마운트 로직)도 spec 서술과 합치했다. Cross-spec
관점에서는 깨끗하다.

## 위험도

NONE

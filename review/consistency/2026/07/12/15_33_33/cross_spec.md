### 발견사항

- **[INFO]** `GENERIC_ERROR_MESSAGE`(4-security.md)가 신규 i18n 카탈로그 대상으로 편입됐다는 상호 참조 누락
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §4 "번역 대상" 목록 — "상태·에러(`GENERIC_ERROR_MESSAGE`)"
  - 충돌 대상: `spec/7-channel-web-chat/4-security.md` §1 "에러 메시지 노출" 행 — "일반화 문구(`GENERIC_ERROR_MESSAGE`)만 표시…코드 SoT: `use-widget.ts errMessage`"
  - 상세: 실제 모순은 아니다 — `4-security.md` 는 문구가 "일반화된 것"이라고만 규정할 뿐 하드코딩된 한국어 상수여야 한다고 못박지 않으므로, `1-widget-app.md §4` 가 그 문구를 위젯 로컬 catalog 키로 옮겨 en/ko parity 를 요구하는 것과 논리적으로 충돌하지 않는다. 다만 `4-security.md` 는 이번 i18n 활성화 커밋(2026-07-12, 3214db045)의 Edit 범위에 포함되지 않아 "이 문구가 이제 카탈로그를 경유한다"는 사실이 보안 문서 쪽에는 반영돼 있지 않다 — 두 문서를 동시에 읽는 구현자가 SoT 소재(에러 노출 정책=4-security, 번역 키=1-widget-app)를 헷갈릴 여지가 약간 있다.
  - 제안: 구현(developer) 단계에서 `4-security.md` §1 "에러 메시지 노출" 행에 "표시 문구는 위젯 로컬 i18n catalog 경유([1-widget-app §4](./1-widget-app.md))"라는 한 줄 상호 참조를 추가하면 향후 grep 탐색 시 혼동을 줄일 수 있다. 차단 사유는 아니므로 즉시 스펙 수정 없이 구현 PR 에서 함께 반영해도 무방하다.

### 요약
`spec/7-channel-web-chat/` 전 문서(0-architecture·1-widget-app·2-sdk·3-auth-session·4-security·5-admin-console)와 그 위에서 실행되는 이번 i18n(`locale` 활성화) 신규 마일스톤을 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점에서 검토했다. 이 draft 는 이미 같은 날 앞선 `--spec` 단계 consistency-check(14:34 세션)에서 지적된 WARNING 2건 — (1) `2-sdk.md §3` "wc:boot 재전송" 문단이 locale 을 단순 재전송으로 갱신 가능한 필드로 잘못 열거하던 문제, (2) `0-overview.md §6.1` 의 "영역 종결" 서술이 신규 마일스톤과 상충하던 문제 — 를 커밋(3214db045)에서 전부 반영해 현재 committed 상태에는 이미 해소돼 있음을 확인했다. 독립적으로 재검증한 결과: `WebChatAppearanceDto.locale`(백엔드 DTO)·`BootConfig.locale`(SDK 타입)·`use-widget.ts`/`host-bridge.ts`(위젯 코드)는 이미 `'ko'|'en'` 필드를 reserved 상태로 보유하고 있어 이번 활성화가 데이터 모델을 깨지 않으며, `NAV-WC-01~06` 요구사항 ID·EIA 참조(§5.4 cancel·§5.5 refresh-token·EIA-IN-02·EIA-RL-07·EIA-AU-04)·`9-user-profile §4.3/§6.1` RBAC(Admin+ workspace settings PATCH)·`i18n-userguide.md` 적용 범위 carve-out 모두 실제 spec 본문과 정확히 일치한다. CRITICAL/WARNING 급 실제 모순은 발견되지 않았고, `4-security.md` 의 `GENERIC_ERROR_MESSAGE` 문구가 신규 i18n 카탈로그로 흡수된다는 사실이 그 문서에는 상호 참조되지 않은 INFO 수준의 문서 동기화 누락 1건만 남아 있다.

### 위험도
LOW

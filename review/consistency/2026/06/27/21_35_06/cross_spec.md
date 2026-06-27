# Cross-Spec 일관성 검토 결과

target: `spec/7-channel-web-chat/4-security.md`

---

## 발견사항

### [INFO] EIA §8.5 "미설정 시 차단" invariant 표현과 target §3 blockquote 간 미묘한 어감 차이
- **target 위치**: `4-security.md` §3 말미 blockquote — "(b) `/api/external/*` CORS(§2): 추가 origin 0 → **built-in 위젯 CDN origin 만 허용**(secure-by-default 유지, EIA §8.5 '미설정 시 차단'과 정합)"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.5` — "미설정 시 차단 (브라우저 호출 시 사용자가 명시 설정 필요). 단 **공식 웹채팅 위젯의 hosted CDN origin 은 빌트인 상수로 항상 허용**…"
- **상세**: EIA §8.5 도 target §3 과 동일하게 "빌트인 CDN은 always-allow + 추가 origin이 없으면 그 외 차단"으로 기술한다. 두 문서의 내용은 일치하며, target이 EIA §8.5 를 cross-ref 하는 방식도 맞다. 다만 EIA §8.5 는 "미설정 시 차단"을 `interactionAllowedOrigins` 전체 미존재 기준으로 서술하고, target §3 은 "빈 목록(`[]`) 기준"으로 서술해 표현 단위가 약간 다르다. 실질적으로 같은 의미이나 "null vs 빈 배열" 구분이 명시되어 있지 않다.
- **제안**: 현행 유지로 충분. 필요시 EIA §8.5 에 "빈 배열과 null 모두 추가 origin 0으로 취급"을 한 문장 추가하면 완전 정합.

### [INFO] 0-architecture §R1 "완전 분리" 선언과 4-security §R5 `allow-same-origin` 허용 간 표면적 긴장 — 명문화 여부 확인
- **target 위치**: `4-security.md §R5` — allow-same-origin 허용의 carve-out을 §R5로 공식화하고 0-architecture §R1과의 관계를 해명
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md §R1` — "iframe은 CSS·JS·전역변수·storage·쿠키를 완전 분리하고 token/대화를 호스트 스크립트로부터 격리"
- **상세**: target이 §R5에서 "(a) §R1의 '완전 분리'는 cross-origin CDN 배포를 기준 모델로 한다"고 명문화해 §R1과 §R5의 관계를 명시적으로 해소하고 있다. 또한 0-architecture §R5 carve-out(admin 콘솔 내부 미리보기)을 참조해 동일 근거 위에 있음을 밝힌다. 이 관계는 두 문서 간 모순이 아니라 의도된 계층적 예외이며, target이 그 논리를 직접 기술하고 있어 일관성 유지됨.
- **제안**: 현행 유지. 충돌 없음.

### [INFO] webhook spec §6 SoT 주석과 target §4 간 rate-limit 수치 교차 검증
- **target 위치**: `4-security.md §4` — "IP 단위 대화 시작 rate-limit(예: 분당 10/IP)", "시간당 신규 ≤20/IP"
- **충돌 대상**: `spec/5-system/12-webhook.md §6·WH-SC-05` — "`publicWebhook.startupPerMinute`(기본 분당 10) + `publicWebhook.hourlyNewMax`(기본 20)" + "SoT: [Spec 웹채팅 보안 §4]"
- **상세**: webhook.md 가 target을 SoT로 명시하고 수치(10/분, 20/시간)가 양쪽에서 일치한다. 단 target은 수치에 "(예:)"를 붙여 "운영 데이터로 튜닝"으로 표현하고, webhook.md는 "기본값"으로 표현한다. 의미가 다르지 않으나 독자에게 두 문서의 관계(target = SoT, webhook = consumer)를 명확히 해두면 혼란이 없다.
- **제안**: 현행 유지. webhook.md 가 이미 SoT 방향을 표시하고 있어 충돌 없음.

### [INFO] 마크다운 sanitize 정책 — spec/5-system/_product-overview.md NF-SC-05 와 §1.1 의 책임 분담 명시 필요 여부
- **target 위치**: `4-security.md §1.1` — 위젯과 메인 앱 두 렌더러의 sanitize 정책 매트릭스를 정의하며, 두 렌더러가 동일 XSS 위협에 대해 보안 동등성을 보장한다고 선언
- **충돌 대상**: `spec/5-system/_product-overview.md` — `NF-SC-05`: "CSRF, XSS, SQL Injection 등 OWASP Top 10 대응 ✅"
- **상세**: NF-SC-05는 XSS 대응을 시스템 전체 요구사항으로 선언하고, target §1.1은 그 구현 세부(위젯 DOMPurify allowlist + 메인 앱 react-markdown + rehype-raw 미사용)를 정의한다. 역할 분담이 자연스럽다. 충돌 없음.
- **제안**: 현행 유지.

---

## 요약

`spec/7-channel-web-chat/4-security.md` 는 관련 spec 영역(EIA §8.4·§8.5, webhook §3.2·§6, 1-data-model §2.2, 0-architecture §R1·§R5·§4.1, 1-widget-app §3.2, 3-auth-session §3, 9-user-profile §4.3·§6.1)과 직접 참조·교차 검증 가능한 방식으로 작성되어 있으며, 발견된 사항은 모두 INFO 등급의 어감 차이나 명명 단위 표현 차이다. 어떤 항목도 두 영역 중 하나가 작동 불가해지는 CRITICAL 모순이나 잠재 충돌(WARNING)에 해당하지 않는다. CORS 이중 표면 분리, `interactionAllowedOrigins` 단일 키 정합, 빈 목록의 레이어별 비대칭 설계, rate-limit 수치의 SoT 지정, `blocked` 상태의 SoT 위임(1-widget-app §3.2 → 4-security §3-① trigger), `allow-same-origin` carve-out 의 명문화 — 모두 다른 spec 과 정합적이거나 의도적 예외로 문서화되어 있다.

---

## 위험도

NONE

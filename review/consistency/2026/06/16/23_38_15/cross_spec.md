# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/7-channel-web-chat/4-security.md`
**검토 일시**: 2026-06-16
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [INFO] EIA §8.5 CORS "미설정 시 차단" invariant 설명 방식 경미한 비대칭

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §2, §3 blockquote
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §8.5
- **상세**: target §2 는 "EIA §8.5 의 '미설정 시 차단' invariant 와의 경계: 빌트인 CDN 은 always-allow, `interactionAllowedOrigins` 는 추가 origin 병합" 이라 기술한다. EIA §8.5 는 "미설정 시 차단 (브라우저 호출 시 사용자가 명시 설정 필요)" 라 기술하면서 동시에 "공식 웹채팅 위젯의 hosted CDN origin 은 빌트인 상수로 항상 허용" 이라 기술한다. 두 문서가 동일한 정책을 묘사하고 있으며 내용 모순은 없다. 다만 §3 blockquote 에서 "(b) /api/external/* CORS(§2): 추가 origin 0 → 빌트인 위젯 CDN origin 만 허용(secure-by-default 유지, EIA §8.5 '미설정 시 차단'과 정합)" 이라고 설명할 때, EIA §8.5 는 "미설정 시 차단" 을 사용자가 설정한 interactionAllowedOrigins 가 없는 경우 빌트인 CDN 외 추가 origin 은 차단이라는 뜻으로 사용한다. target 문서가 이 표현을 쓰는 방식과 EIA 가 원문에서 의도한 범위가 일치하지만, 외부 독자가 "빈 목록 = 모든 요청 차단" 으로 오해할 수 있는 여지가 약간 남아 있다. 모순 아님.
- **제안**: 동기화 불필요. 현행 서술이 보충적으로 정합적임. 불명확성 해소를 원하면 EIA §8.5 의 footnote 에 "빌트인 CDN origin 은 항상 허용이며 차단 대상은 그 외 추가 origin" 이라는 한 줄을 추가하는 방향으로 선택적 개선 가능.

---

### [INFO] target §2.1 이 참조하는 9-user-profile §4.3·§6.1 섹션 번호 실제 일치 확인됨 (이상 없음)

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §2.1
- **충돌 대상**: `spec/2-navigation/9-user-profile.md` §4.3, §6.1
- **상세**: target 이 "편집 표면: 워크스페이스 설정 화면 개요 탭(Admin+) → PATCH /api/workspaces/:id/settings([9-user-profile §4.3·§6.1])" 라 참조한다. 실제 `spec/2-navigation/9-user-profile.md` 에서 §4.3 은 "임베드 허용 도메인 (개요 탭)", §6.1 은 "사용자/워크스페이스 API" 로 각각 존재하며 PATCH /api/workspaces/:id/settings (Admin+) 엔드포인트가 §6.1 에 정의되어 있다. 참조 링크 정확, 접근 권한 일치 (Admin+). 충돌 없음.
- **제안**: 조치 불필요.

---

### [INFO] target §3 1-widget-app §3.2 참조 — blocked 상태 정의 SoT 상호 참조 일관성

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §3 첫 번째 bullet
- **충돌 대상**: `spec/7-channel-web-chat/1-widget-app.md` §3.2
- **상세**: target 은 "blocked 상태 정의 SoT = [1-widget-app §3.2]" 라 명시하고 "본 §3-① 은 그 상태를 발동하는 정책 trigger" 라 역할을 구분한다. 1-widget-app.md §3.2 에는 blocked 상태를 "임베드 불허, [4-security §3-①]" 로 역참조한다. 양방향 참조가 정합적이며 SoT 분리가 명확하다. 충돌 없음.
- **제안**: 조치 불필요.

---

### [INFO] rate-limit 수치 표현 — target §4 vs spec/5-system/12-webhook.md §3.2 WH-SC-05

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §4
- **충돌 대상**: `spec/5-system/12-webhook.md` §3.2 WH-SC-05, §6
- **상세**: target §4 는 "IP 단위 대화 시작 rate-limit(예: 분당 10/IP)" 라 기술한다. webhook spec WH-SC-05 는 "분당 10·시간당 누적 20 기본" 라 기술하고, webhook spec §6 의 publicWebhook.startupPerMinute 및 publicWebhook.hourlyNewMax 로 명확히 정의한다. target 의 "(예:)" 표기가 수치를 확정값이 아닌 예시로 제시하고 있어 오해 소지가 있으나 webhook spec 에서 이미 SoT 로 확정돼 있다. 또한 target §4 에서 "누적 신규(시간당 ≤20/IP): 구현됨 v1" 이라고 기술하는데 이는 webhook spec 의 hourlyNewMax=20 과 일치한다. 모순 아님, webhook spec 이 실제 SoT.
- **제안**: target §4 의 "예: 분당 10/IP" 를 "분당 10/IP (publicWebhook.startupPerMinute, SoT: 12-webhook §6)" 등으로 SoT 참조를 명시하면 동기화가 더 명확해진다. 선택적 개선.

---

### [INFO] 12-webhook spec 이 target 을 SoT 로 역참조 — SoT 방향 약한 순환

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §4 blockquote
- **충돌 대상**: `spec/5-system/12-webhook.md` §6 ("SoT: Spec 웹채팅 보안 §4")
- **상세**: spec/5-system/12-webhook.md §6 에서 "SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md)" 라 기술하여 target 을 공개 webhook rate-limit 의 SoT 로 명시한다. 동시에 target §4 는 "IP 단위 대화 시작 rate-limit(예: 분당 10/IP)" 라 수치를 예시로만 표기하므로, webhook spec 이 SoT 로 지정하면서 실제 SoT 쪽(target §4)이 수치를 확정하지 않는 약한 역전 현상이 있다. 실질적 SoT 는 webhook spec §6 의 config 키(publicWebhook.startupPerMinute/hourlyNewMax)이다. 직접 모순은 아님.
- **제안**: target §4 가 수치를 확정하든지 ("분당 10/IP") 혹은 webhook spec §6 의 "SoT: 웹채팅 보안 §4" 를 "상세: 웹채팅 보안 §4, 수치 SoT: 본 §6 config 키" 로 정정하는 방향으로 선택적 정비 가능.

---

### [INFO] EIA §8.4 rate-limit 구현 상태 부분 오해 소지

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §4
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §8.4
- **상세**: target 은 "기존 EIA §8.4 유지(interact 분당 60/execution, SSE 동시 3/execution)" 라 기술한다. EIA §8.4 는 "/interact execution 당 분당 60 — 미구현 (Planned)", "SSE 동시 연결 execution 당 3 — 구현됨" 이라 구분한다. target 이 두 항목을 구현 상태 구분 없이 묶어 "유지" 라 표현해 /interact rate-limit 이 이미 구현된 것처럼 읽힐 수 있다. 수치 불일치나 정책 모순은 없다.
- **제안**: target §4 에서 EIA §8.4 인용 시 "interact 분당 60/execution(Planned), SSE 동시 3/execution(구현됨)" 으로 구현 상태를 병기하거나 "EIA §8.4 기준" 으로 EIA §8.4 에 위임하는 방향으로 선택적 개선.

---

## 요약

`spec/7-channel-web-chat/4-security.md` 는 CORS 두 표면 분리, 임베드 allowlist, 공개 webhook rate-limit, 프라이버시 정책의 네 보안 영역을 다루며, `spec/5-system/14-external-interaction-api.md §8.5`, `spec/7-channel-web-chat/1-widget-app.md §3.2`, `spec/5-system/12-webhook.md §6`, `spec/1-data-model.md §2.2`, `spec/2-navigation/9-user-profile.md §4.3·§6.1` 과 교차 참조한다. 검토 결과 CRITICAL(직접 모순) 및 WARNING(잠재 충돌) 은 발견되지 않았다. 모든 발견사항은 SoT 표기 방향의 경미한 비대칭 또는 수치 예시 표현의 선택적 명확화에 해당하는 INFO 수준이다. 특히 `interactionAllowedOrigins` 의 의미가 CORS·임베드·데이터 모델·user-profile API·EIA 전반에 걸쳐 일관되게 정의 및 참조되고 있어 단일 진실 원칙이 양호하게 유지되고 있다.

---

## 위험도

NONE

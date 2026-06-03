# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: channel-web-chat spec 갭 보완 변경 (spec/7-channel-web-chat/*, spec/conventions/spec-impl-evidence.md, consistency review artifacts)
리뷰 일시: 2026-06-03

---

## 발견사항

### [WARNING] `blocked` 상태가 두 spec 문서에 분산 정의 — 단일 책임 원칙 위반
- 위치: `spec/7-channel-web-chat/4-security.md §3-①` 및 `spec/7-channel-web-chat/1-widget-app.md §3.2`
- 상세: `blocked` 상태 enum 은 보안 정책(4-security.md)이 결정한 개념이나, 해당 파일에 enum 이름이 공식 정의로 등재되지 않은 채 1-widget-app.md §3.2 에 먼저 명기됐다. 4-security.md §3 본문은 "렌더 거부 + 시작 차단" 행위를 기술하면서 `blocked` 를 enum 값으로 명시하지 않고, 1-widget-app.md 가 그 이름을 "cross-ref: 4-security §3-①" 형태로 참조한다. 이는 상태 enum 의 소유권이 모호한 구조다 — 보안 정책 spec 이 정의하고 위젯 spec 이 참조해야 하나, 실제로는 역방향 또는 병행 정의에 가깝다. 향후 보안 정책 변경 시 두 문서를 동시에 수정해야 하는 결합도가 발생한다.
- 제안: `4-security.md §3-①` 에 `blocked` 를 공식 enum 값으로 inline 정의("→ 위젯 상태 `blocked` 진입")하고, 1-widget-app.md §3.2 는 "4-security §3-① 에서 정의한 `blocked`" 형태로 단방향 참조하도록 소유권을 명확히 분리한다. 두 spec 이 같은 commit 에서 원자 변경돼야 일관성이 보장된다는 점을 plan 에 명기.

---

### [WARNING] SoT 이중화 위험 — `0-architecture.md §4` 와 `4-security.md §2.1` 의 `WEB_CHAT_WIDGET_ORIGINS` 중복 기술
- 위치: `spec/7-channel-web-chat/0-architecture.md §4` (신규 추가) 및 `spec/7-channel-web-chat/4-security.md §2.1` (신규 추가)
- 상세: 두 spec 이 동시에 `WEB_CHAT_WIDGET_ORIGINS` env 키를 기술하고 있다. 0-architecture.md §4 는 "백엔드 런타임 키 = WEB_CHAT_WIDGET_ORIGINS, allowlist 정책·키 SoT 는 4-security §2·§2.1" 이라 선언하고, 4-security.md §2.1 은 "워크스페이스 무관 고정 always-allow 목록의 SoT 이며 0-architecture §4 가 이 키를 참조한다" 라고 쌍방 cross-ref 를 두고 있다. "SoT 는 4-security" 라는 방향성은 올바르나, 두 문서에 env 키 이름이 모두 명시됨으로써 향후 키 이름 변경 시 두 곳을 동시에 수정해야 한다. 단일 진실 원칙에서 0-architecture §4 는 cross-ref 만 두고 키 이름 자체는 SoT 문서(4-security §2.1) 에만 존재해야 한다.
- 제안: 0-architecture.md §4 에서 "WEB_CHAT_WIDGET_ORIGINS" 키 이름을 제거하고 "백엔드 런타임 env 키는 [4-security §2.1](./4-security.md) 참조" 형태의 순수 cross-ref 로만 유지. 키 이름의 단일 진실은 4-security.md §2.1 이다.

---

### [WARNING] 위젯 상태기계 레이어 분리 불완전 — `§3.2` 가 정책 결정과 UI 상태를 혼재
- 위치: `spec/7-channel-web-chat/1-widget-app.md §3.2`
- 상세: §3.2 는 위젯 가시성 상태(`visible`/`hidden`), 패널 전개(`collapsed`/`open`), `blocked`, `updateProfile` 를 단일 절에 혼재한다. 아키텍처 관점에서 이 네 개념은 서로 다른 레이어에 속한다: (a) 가시성/패널 전개는 UI 상태기계, (b) `blocked` 는 보안 정책이 결정한 진입 불가 상태, (c) `updateProfile` 은 프로파일 데이터 변이 계약이다. 이 세 개념을 "host 명령 대응" 이라는 공통점만으로 같은 절에 묶으면, 각 개념의 변경 사유가 달라 결합도가 높아진다(보안 정책 변경이 UI 상태기계 절을 건드리게 됨). 추상화 수준 불일치도 있다: visible/hidden 은 렌더링 레이어이고 blocked 는 정책 레이어이다.
- 제안: §3.2 를 (a) 위젯 가시성 축(show/hide, visible/hidden)과 (b) 정책 차단(`blocked`) 으로 분리하거나, 최소한 주석으로 "가시성 축(UI)" vs "정책 거부(보안)" 의 레이어 구분을 명시. `updateProfile` 은 별도 §3.3 또는 SDK 계약(2-sdk) 으로 이동을 검토.

---

### [INFO] `3-auth-session.md §3.1` 복원 시퀀스와 `1-widget-app.md §3.1` SSE 재연결이 상호 참조 순환 구조
- 위치: `spec/7-channel-web-chat/3-auth-session.md §3.1` 및 `spec/7-channel-web-chat/1-widget-app.md §3.1`
- 상세: 3-auth-session.md §3.1 step 2 에서 "SSE 재연결 절차 = [1-widget-app §3.1]" 로 참조하고, 1-widget-app.md §3.1 의 SSE 재연결 절차는 암묵적으로 auth-session 의 토큰 복원을 전제한다. 두 spec 이 서로를 순환 참조하는 구조다. 각 문서가 독립적으로 이해되려면 세션 복원 시퀀스의 "어느 절차가 선행이고 어느 쪽이 후행인가" 의 책임 소유가 명확해야 한다.
- 제안: 순환 참조 자체는 spec 문서 특성상 허용 가능하나, 3-auth-session.md §3.1 이 "복원 오케스트레이션(1-5 단계 시퀀스)"의 소유자임을 명시하고, 1-widget-app.md §3.1 은 "SSE 재연결 메커니즘(Last-Event-Id 절차)" 의 소유자임을 명확히 구분하면 순환 의존의 혼란을 줄일 수 있다. 현 상태에서 두 절이 각자의 책임 영역은 다르므로 큰 문제는 아니다.

---

### [INFO] `spec-impl-evidence.md §1` 추가 항목의 인라인 주석이 규약 문서 본문 스타일과 다름
- 위치: `spec/conventions/spec-impl-evidence.md §1` (신규 줄: `spec/7-channel-web-chat/**.md (클라이언트 채널...`)
- 상세: 기존 5개 항목은 경로만 나열하는 반면, 신규 추가 항목은 경로 뒤에 괄호 주석을 달았다. 규약 문서의 리스트 스타일 일관성이 깨진다. 향후 spec/8, spec/9 등 추가 영역이 생길 때 각각 주석을 달면 목록이 비대해진다. 추가 이유(클라이언트 채널 영역도 제품 표면을 약속) 는 Rationale 절에 기술하는 것이 이 규약 문서의 자체 구조(Overview 본문 / Rationale 분리)에 맞다.
- 제안: §1 항목에서 괄호 주석을 제거하고, 추가 근거는 기존 Rationale 절(또는 새 R-7 항목)에 기술. 이는 spec 내 단일 진실 원칙(본문 = 사실 목록, Rationale = 결정 배경)을 자기 자신에게도 적용하는 것이다.

---

### [INFO] 일관성 검토 sub-agent `_retry_state.json` 의 `agents_pending` 초기화 구조 — 상태 관리 아키텍처 관찰
- 위치: `review/consistency/2026/06/03/09_46_31/_retry_state.json`
- 상세: 5개 checker sub-agent 가 모두 `agents_pending` 에 있고 `agents_success` / `agents_fatal` 이 비어있는 초기 상태로 커밋됐다. 재시도 상태기계 아키텍처 자체는 팬아웃 + 상태파일 기반의 결정적 orchestration 구조로 적절하다. 다만 초기화된 상태 파일이 review 산출물로 보존되면, 실제 실행 완료 후의 최종 상태(agents_success = 5)가 덮어쓰여져 있지 않아 재시도 이력이 단계별로 기록되지 않는다. 이는 운영 가시성(observability) 약점이다.
- 제안: 현 아키텍처 설계 범위 안의 관찰이므로 즉시 조치 필요는 없다. 향후 검토 산출물 감사(audit) 목적으로 최종 상태 파일을 별도 보존하는 방식(예: `_retry_state_final.json`)을 고려할 수 있다.

---

## 요약

이번 변경은 `spec/7-channel-web-chat/` 영역의 갭 보완으로, SSE 재연결 시나리오, 세션 복원 시퀀스, 위젯 가시성/차단 상태, CORS env 키 명시화, Rationale 신설 등 5개 항목을 다룬다. 전반적으로 레이어 경계(EIA 표면 / 위젯 UI / 보안 정책)는 잘 인식돼 있고 기존 합의(2-sdk §R4, EIA invariant)와 정합한다. 아키텍처 관점의 핵심 우려는 두 가지다: (1) `blocked` 상태 enum 이 보안 spec 에서 공식 정의 없이 위젯 spec 에서 먼저 명기되어 소유권이 역전됐고, (2) `WEB_CHAT_WIDGET_ORIGINS` env 키가 두 spec 문서에 모두 기술돼 단일 진실 원칙의 엄밀한 적용이 미흡하다. 두 항목 모두 설계 의도는 명확하나 경계 정의의 실행이 한 단계 미완성인 상태다. 나머지 발견사항은 INFO 수준의 스타일·순환참조 관찰이며 기능 동작에는 영향을 주지 않는다.

---

## 위험도

MEDIUM

STATUS: SUCCESS

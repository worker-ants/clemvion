# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-channel-web-chat-gaps.md`
검토일: 2026-06-03

---

## 발견사항

### [WARNING] 4-a `blocked` 상태 — 기존 1-widget-app.md 상태다이어그램에 미등록
- target 위치: draft §4-a — "`1-widget-app §2` 상태 다이어그램에 `blocked` enum 을 명기하고 4-security §3-① 와 1:1 임을 inline 표기"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md §2/§3` 상태기계 다이어그램 (현행)
- 상세: 현행 `1-widget-app.md §2·§3` 의 상태기계에는 `blocked` enum 이 존재하지 않는다. draft 는 이를 추가하도록 지시하나, `4-security.md §3-①` 에도 "soft 검증으로 렌더 거부" 만 기술돼 있을 뿐 `blocked` 상태 명칭이 공식화돼 있지 않다. 현행 4-security §3 본문이 `blocked` 를 enum 값으로 정의하지 않은 채 draft 가 1-widget-app 에 enum 을 "추가"하도록 지시하면, 보안 spec 과 위젯 spec 이 각각 암묵적으로 다른 enum 이름을 쓸 수 있다. 두 문서를 동시에 변경 확정해야 일관성이 보장된다.
- 제안: draft 가 `4-security.md §3` 에도 `blocked` 를 공식 상태 이름으로 inline 추가하거나, 1-widget-app 추가와 4-security §3 노트 갱신을 동일 원자 변경으로 묶어야 한다. 별도 PR 로 쪼개면 짧은 기간 단일 진실이 둘로 갈린다.

---

### [WARNING] 4-a `2-sdk §1/R4` 인용 — "hidden 에서 open 무효" 현행 SoT 위치 불일치
- target 위치: draft §4-a — "`hidden` 에서 `open` 무효 (먼저 `show`, 2-sdk §1/R4 와 일치)"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md §1` (show/hide vs open/close 설명) · `§R4` (Rationale)
- 상세: `2-sdk §1` 은 "`hide` 후엔 `open` 해도 보이지 않는다(먼저 `show`)" 를 이미 기술하고 있으나, **"`hidden` 상태에서 `open` 을 수신하면 무효" 라는 명시적 전이 금지 규칙은 현행 `2-sdk §1/R4` 에 없다.** draft 는 이 규칙이 "2-sdk §1/R4 와 일치"한다고 선언하지만, 실제 §R4 는 "두 축을 분리한 이유"만 기술하고 `open`-when-`hidden` 무효 규칙을 명기하지 않는다. 또한 draft 는 `2-sdk §R4 에 "blocked 는 두 축과 무관한 정책 거부 상태(복구 불가)" 1줄 추가` 를 지시하는데, §R4 는 show/hide ↔ open/close 분리 근거 섹션이다 — blocked 설명을 R4 에 추가하면 Rationale 의 주제가 산만해진다. `ChatInstance §5` 가 공개 메서드 계약의 타입 SoT 라고 §R4 본문 자체가 선언하므로, `open`-when-`hidden` 무효 규칙도 §5 ChatInstance 타입 주석 또는 §1 본문에 명기하는 편이 SoT 위치 일관성에 부합한다.
- 제안: (a) `hidden` 에서 `open` 무효 규칙을 `2-sdk §1` 또는 `§5 ChatInstance` 주석에 명기하고, (b) `blocked` 1줄 추가 위치를 §R4 대신 `2-sdk §1` 의 show/hide 주석 또는 1-widget-app 상태다이어그램 바로 아래로 이동. §R4 에 추가하는 경우 섹션 명칭이나 스코프와 어긋난다.

---

### [WARNING] W1 — "버퍼(5분) 만료 신호" 기술이 EIA §5.2 미구현 상태와 충돌 가능
- target 위치: draft §2/W1 — "만료 신호 이벤트는 EIA 측 계획·미구현이라 위젯은 버퍼 만료를 시간 기준(>5분)으로 판단"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md §5.2` (EIA-IN-07, EIA-NF-03)
- 상세: EIA §5.2 는 "`execution.replay_unavailable` 이벤트는 **계획·미구현**" 임을 명기하고, 현재 어댑터는 만료분을 "silent drop" 한다고 기술한다. draft W1 은 이 사실을 "(계획·미구현)" 으로 올바르게 인지하지만, 1-widget-app §3.1 에 추가할 절차 문단에서 "위젯은 시간 기준(>5분)으로 판단" 이라는 **위젯 구현 의무** 를 spec 에 추가한다. 이는 EIA 의 silent drop 동작(서버는 어떤 신호도 보내지 않음)과, 위젯이 로컬 타이머로 >5분 경과 후 폴백 조회를 해야 한다는 새 행동 의무를 1-widget-app 에 도입하는 것이다. 이 새 의무는 EIA 와 충돌은 아니나 1-widget-app 의 현행 §3.1 (상태기계)에 아직 존재하지 않는 로직이다. 핵심 위험: 시간 기준 타이머가 spec 에 고정되면, 향후 EIA 가 `replay_unavailable` 신호를 구현했을 때 위젯 쪽 타이머 로직을 제거/수정해야 하는 갱신 의무가 두 spec 에 모두 발생한다. 현행 EIA spec 에는 이 결합을 예고하는 언급이 없다.
- 제안: 1-widget-app 추가 문단에 "EIA 가 `execution.replay_unavailable` 를 구현하면 타이머 기준 폴백을 이벤트 기반으로 교체" 라는 TODO 주석 또는 cross-ref 를 남겨 향후 EIA 미구현 항목 해소 시 위젯 갱신 의무가 연동됨을 명시. EIA-IN-07 / EIA-NF-03 에도 "클라이언트 fallback: 시간 기준(>5min)" 노트를 추가하면 양쪽 SoT 가 정합을 유지한다.

---

### [INFO] W3 — `INCLUDE_PREFIXES` 추가 대상이 helper 파일 vs spec-impl-evidence.md §1 이중 기술
- target 위치: draft §2/W3 — "spec-impl-evidence.md §1 목록에 `spec/7-channel-web-chat/**.md` 추가" + "동반(developer): spec-frontmatter-parse.ts 의 `INCLUDE_PREFIXES` 배열에 추가"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/spec-impl-evidence.md §1` (적용 대상 inclusive list) · `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` (INCLUDE_PREFIXES 배열)
- 상세: 현행 `spec-impl-evidence.md §1` 의 inclusive list 에는 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/conventions/` 만 있고 `spec/7-channel-web-chat/` 는 없다. draft 는 이를 spec §1 에 추가하는 것으로 올바르게 설계했고, `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열도 현재 동일하게 5개 prefix 로 구성돼 있다. 두 곳이 모두 갱신 대상임을 draft 가 인지했으므로 기술적으로는 문제없으나, spec-impl-evidence.md §1 이 **단일 진실(SoT)** 이고 `spec-frontmatter-parse.ts` 는 그 구현체 — **코드가 spec 을 따라야 하는 방향** 임을 plan 에 명기해 두면 유지보수 시 혼동이 줄어든다. 현재 draft 는 spec 먼저, 코드 동반 순서로 기술해 방향은 맞다.
- 제안: spec 갱신(project-planner) → 코드 갱신(developer) 의 분리를 명확히 하기 위해, plan 에서 W3 코드 갱신을 "spec 갱신 머지 후 동반 developer 단계" 로 순서를 명기하면 병합 순서 혼동을 예방한다.

---

### [INFO] W5 — `0-architecture.md §4` 에 `WEB_CHAT_WIDGET_ORIGINS` 추가 vs 기존 §4 범위
- target 위치: draft §2/W5 — "`0-architecture.md §4` 에 빌트인 CDN origin 의 backend env 키가 `WEB_CHAT_WIDGET_ORIGINS`(콤마 구분, `main.ts`→`parseWidgetOrigins`)임을 명시"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/0-architecture.md §4` (배포/도메인 설정), `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md §2·§2.1` (CORS allowlist 정책 SoT)
- 상세: 현행 `0-architecture.md §4` 는 `<api-base>` · `<widget-cdn-base>` 플레이스홀더 설명 + 버전 전략을 다루며 backend env 키는 언급하지 않는다. 반면 `4-security.md §2.1` 이 현행 CORS 구현 상세의 SoT 이고 `codebase/backend/src/common/cors/web-chat-cors.ts` 를 가리킨다. `WEB_CHAT_WIDGET_ORIGINS` 는 backend 운영 env 키이므로, §4 에 "env 키명 + SoT cross-ref" 를 추가하는 것 자체는 합당하나 **단일 진실 위치**를 정합하게 유지하려면 `4-security.md §2.1` 이 env 키 SoT 이고 `0-architecture.md §4` 는 cross-ref 만 두는 방향이 자연스럽다. draft 는 이미 "allowlist 정책 SoT: 4-security §2/§2.1" cross-ref 를 병기하도록 지시하고 있어 SoT 분리 원칙을 따르고 있다. 충돌은 아니다.
- 제안: 이상 없음. `4-security.md §2.1` 에 `WEB_CHAT_WIDGET_ORIGINS` env 키명이 아직 명기되지 않은 경우 §2.1 이 실질 SoT 역할을 하도록 §2.1 에도 env 키명을 추가하거나, §4 추가분이 §2.1 의 env 키를 echo 하는 관계임을 명시하면 이중 진실 우려를 없앤다.

---

### [INFO] W4 — `4-security.md` 에 Rationale 신설 — 기존 §4 blockquote "CORS두 표면" 설명과 중복 가능
- target 위치: draft §2/W4 — "`4-security.md` 끝에 `## Rationale` 신설 — (a) CORS 두 표면 분리 근거 (b) 임베드 검증 soft/hard 근거 (c) rate-limit fixed-window + fail-open 근거"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md §2·§3·§4` 본문 (이미 CORS 분리 근거, 임베드 soft 이유, fixed-window 특성이 인라인 기술됨)
- 상세: 현행 `4-security.md §2·§3·§4` 본문 자체가 각 정책의 "왜" 를 인라인으로 설명하고 있다(예: §3 "봇이 공개이므로 hard 보안 경계가 아니라 캐주얼 오남용 차단용 soft 컨트롤", §4 blockquote "인증 대체가 아닌 best-effort defense-in-depth, Redis 미가용 시 fail-open"). draft 가 "본문 §4 정책 설명·blockquote 는 유지하고 Rationale 에는 '왜'만 추가(이동이 아닌 분리)"라고 명기했으나, 같은 "왜" 설명이 본문과 Rationale 두 곳에 공존하면 동기화 부담이 생긴다. CLAUDE.md 단일 진실 원칙(본문은 사실, Rationale 은 결정 배경) 상 현행 본문의 인라인 근거 설명은 Rationale 로 이동하는 것이 원칙에 가깝다.
- 제안: 본문의 인라인 "왜" 설명을 Rationale 로 이동하되, 본문에는 결정 사실만 남기는 방향이 단일 진실 원칙과 정합한다. draft 가 "이동이 아닌 분리"로 명기한 이유가 있다면 plan 에 근거를 추가해 중복을 허용한다는 의도를 명시할 것.

---

## 요약

draft 의 W1~W5 및 show/hide/updateProfile 설계는 대체로 EIA SoT(§5.2·§5.3·§8.3·EIA-NF-03·EIA-AU-04)와 정합하며, 기존 2-sdk §R4 결정을 위젯 상태기계에 반영하는 방향도 올바르다. 다만 두 가지 WARNING 이 주의를 요한다: (1) `blocked` enum 의 공식 도입이 4-security.md 에 아직 enum 이름으로 등록되지 않은 상태에서 1-widget-app 에만 추가되면 단기 분리가 발생하고, (2) `2-sdk §R4` 에 `blocked` 1줄 추가를 지시하는 위치가 Rationale 주제 범위와 어긋나 혼란을 줄 수 있다. W1 의 버퍼 만료 타이머 로직 추가는 EIA silent drop 현행과는 충돌하지 않으나, 향후 EIA 가 `replay_unavailable` 신호를 구현할 때 위젯 갱신 의무가 연동됨을 양쪽 spec 에 명기해 두지 않으면 갭이 생길 수 있다. CRITICAL 충돌은 없다.

## 위험도

MEDIUM

STATUS: SUCCESS

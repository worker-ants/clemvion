# 요구사항(Requirement) 리뷰 — Channel Web Chat spec 갭 보강 (W1~W5, show/hide/updateProfile)

리뷰 대상: consistency-check 산출물 + spec 파일 변경 (파일 1~13)
리뷰 일시: 2026-06-03

---

## 발견사항

### [WARNING] W3 구현: plan 문서의 `_product-overview.md` 제외 근거 혼용이 spec-impl-evidence.md §1 본문과 불일치

- 위치: `spec-draft-channel-web-chat-gaps.md §W3` (plan/in-progress/spec-draft-channel-web-chat-gaps.md:51)
- 상세: plan 문서는 `_product-overview.md` 제외 근거를 "spec/6 단순 overview 제외 기준과 동일 계열"로 설명한다. 그러나 실제로 반영된 `spec/conventions/spec-impl-evidence.md §1` 본문(파일 13)에는 `_*.md` 제외 근거가 "밑줄 prefix — leaf 가 아닌 layout/index 성격"으로 명기돼 있고, `spec/6-brand.md` 제외는 "단순 overview 성격"으로 별도 규칙이다. 두 규칙은 다르다. spec 본문(파일 13 라인 1849) 자체는 정확하게 기술돼 있으나, plan 문서의 설명이 혼용 표현을 포함한 채로 그대로 남아 있어 향후 유사 작업 시 규약 이해 오류로 이어질 수 있다.
- 제안: `spec-draft-channel-web-chat-gaps.md §W3` 의 "spec/6 단순 overview 제외 기준과 동일 계열" 문구를 "underscore prefix (`spec/<영역>/_*.md` 패턴, spec-impl-evidence.md §1 제외 규칙)"로 교정한다. 단 spec 본문(파일 13)은 이미 정확하므로 spec 수정 불요.

---

### [WARNING] `2-sdk §R4` 에 `blocked` 1줄 추가가 spec 변경에서 누락됨 — plan 지시 vs 실제 구현 불일치

- 위치: `spec-draft-channel-web-chat-gaps.md §4-a:77` vs `spec/7-channel-web-chat/2-sdk.md`
- 상세: plan 문서(파일 기준 spec-draft-channel-web-chat-gaps.md 77번 라인)는 "2-sdk §R4 에 `blocked` 는 두 축과 무관한 정책 거부 상태(복구 불가) 1줄 추가"를 명시한다. 그러나 2-sdk.md 파일이 리뷰 대상에 포함돼 있지 않으며, 변경된 파일 목록(파일 9~13) 어디에도 2-sdk §R4 를 수정한 diff 가 없다. 또한 cross-spec 검토 보고서(파일 4)도 이 위치를 WARNING 으로 지적했다: "blocked 설명을 R4 에 추가하면 Rationale 의 주제가 산만해진다" — 즉 위치 자체가 spec 설계 원칙(Rationale 범위)과 어긋남에도 plan 에서 지시한 변경이 실행되지 않아 plan-구현 간 괴리가 생겼다.
- 제안: (a) 이 변경이 의도적으로 제외된 것이라면 plan 문서를 갱신해 "2-sdk §R4 추가 철회 — blocked 는 1-widget-app §3.2 와 4-security §3-① cross-ref 로 충분" 을 명기한다. (b) 추가가 여전히 필요하다면 R4 대신 2-sdk §1 의 show/hide 설명 바로 아래에 1줄 추가하는 위치 변경을 검토한다.

---

### [WARNING] `1-widget-app.md` frontmatter `pending_plans` 에 `spec-draft-channel-web-chat-gaps.md` 미등재

- 위치: `spec/7-channel-web-chat/1-widget-app.md` frontmatter (파일 10, 라인 1333~1341)
- 상세: 파일 10 의 전체 파일 컨텍스트에서 `pending_plans` 는 `channel-web-chat-impl.md`, `channel-web-chat-followups.md`, `channel-web-chat-demo.md` 3개다. 그러나 해당 PR 의 spec 변경(§3.2 신설, §R5 추가, §3.1 SSE 문단 추가)은 직접 `spec-draft-channel-web-chat-gaps.md` 가 책임지는 항목이다. plan-coherence 보고서(파일 7)도 이를 WARNING 으로 지적했다. `spec-impl-evidence.md §3/§4` 가드 기준으로, `1-widget-app.md` 가 `status: partial` 인 이상 실제 spec 변경을 책임지는 plan 이 `pending_plans` 에 등록돼야 한다.
- 제안: `1-widget-app.md` 의 `pending_plans` 에 `plan/in-progress/spec-draft-channel-web-chat-gaps.md` 를 추가하거나, 해당 plan 이 완료되는 시점에 `channel-web-chat-demo.md` 의 W1~W5 완료 처리 및 pending_plans 갱신을 원자적으로 수행한다.

---

### [WARNING] EIA `replay_unavailable` 미구현 TODO cross-ref — EIA spec 역방향 미등재

- 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 SSE 재연결 문단 (파일 10, 라인 1411~1412)
- 상세: 파일 10 에 추가된 문단은 "EIA `replay_unavailable` 구현 시 이벤트 기반으로 교체 — EIA-NF-03 연계 TODO"를 명시했다. 그러나 EIA 스펙(`spec/5-system/14-external-interaction-api.md §5.2`, EIA-IN-07, EIA-NF-03)에는 "클라이언트 fallback: 시간 기준(>5min)" 노트가 역방향으로 추가되지 않았다. cross-spec 보고서(파일 4)가 이 결합을 WARNING 으로 지적했다: EIA 쪽에 연계 의무가 명기되지 않으면 향후 EIA `replay_unavailable` 구현 시 위젯 갱신 의무를 놓칠 수 있다.
- 제안: `spec/5-system/14-external-interaction-api.md §5.2` (또는 EIA-NF-03 기술 위치)에 "클라이언트 fallback: >5분 로컬 시간 기준 판단(위젯 구현) — `replay_unavailable` 구현 시 위젯 타이머 교체 의무" 노트를 추가한다. 이는 project-planner 소관 spec 수정이다.

---

### [INFO] `4-security.md §3-①` 에 `blocked` enum 명시 추가 — 4-security 에는 enum 이름 미선행 정의

- 위치: `spec/7-channel-web-chat/4-security.md §3-①` (파일 12, 라인 1603~1604)
- 상세: 변경된 `4-security.md §3-①` 은 "위젯 상태 `blocked` — host `show` 로도 해제되지 않는 정책 거부, [1-widget-app §3.2]"를 추가했다. 이는 `blocked` enum 이름을 4-security §3 에서 처음 공식화하는 것처럼 보이나, 실제로는 1-widget-app §3.2 에서 정의하고 4-security §3-① 가 cross-ref 하는 구조다. cross-spec 보고서(파일 4)가 "4-security §3 본문이 `blocked` 를 enum 값으로 정의하지 않은 채 draft 가 1-widget-app 에 enum 을 추가하면 단기 분리 가능"을 WARNING 으로 지적했다. 현재 구현에서는 두 파일이 동시에 변경됐고(1-widget-app §3.2 + 4-security §3-① cross-ref) 상호 참조로 연결돼 있어 실질적 분리는 없다. 다만 enum의 1차 정의 위치를 명확히 하지 않으면 향후 변경 시 두 곳 동기화 의무가 모호해진다.
- 제안: 4-security §3-① 의 현재 표현("위젯 상태 `blocked`")은 cross-ref 역할로 적절하다. 다만 "`blocked` 의 정의 SoT = 1-widget-app §3.2"를 명시하면 이중 정의 혼동을 예방할 수 있다.

---

### [INFO] `spec-impl-evidence.md §1` 신규 항목 Rationale 부재 — 향후 spec/8 등 확장 시 기준 불명확

- 위치: `spec/conventions/spec-impl-evidence.md §1` (파일 13, 라인 1843)
- 상세: 추가된 `spec/7-channel-web-chat/**.md` 항목은 "(클라이언트 채널 영역도 제품 표면(UI/SDK/API)을 약속하므로 frontmatter 의무 대상)"를 인라인 주석으로 포함한다. 이는 포함 이유를 설명하나, 공식 Rationale 섹션이 아닌 인라인 설명으로만 존재한다. rationale_continuity 보고서(파일 8)도 "§1 에 spec/7 추가 이유를 Rationale 로 1줄 추가하면 향후 spec/8 등 다음 영역 추가 시 기준이 명확해진다"고 INFO 수준 제안을 했다.
- 제안: `spec-impl-evidence.md Rationale` 섹션에 "채널 영역(spec/7 이후)은 제품 표면(UI/SDK/API)을 약속하므로 frontmatter 의무 대상에 포함" 기준을 1줄 추가한다. 이는 project-planner 소관이다.

---

### [INFO] `3-auth-session.md` frontmatter `pending_plans` 에 `spec-draft-channel-web-chat-gaps.md` 미등재

- 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter (파일 11, 라인 1494~1504)
- 상세: 파일 11 의 `pending_plans` 는 `channel-web-chat-impl.md` 와 `channel-web-chat-followups.md` 2개다. 그러나 이번 변경에서 §3.1 신설과 R4 추가가 이루어졌으며 이는 `spec-draft-channel-web-chat-gaps.md` 가 책임지는 항목이다. 1-widget-app 과 동일한 문제.
- 제안: `3-auth-session.md` 의 `pending_plans` 에 `plan/in-progress/spec-draft-channel-web-chat-gaps.md` 를 추가하거나 완료 시 동시 갱신 처리한다.

---

### [INFO] `channel-web-chat-followups.md §4 [연관]` 항목 — show/hide/updateProfile 설계 완료 미반영

- 위치: `plan/in-progress/channel-web-chat-followups.md §4`
- 상세: plan-coherence 보고서(파일 7, 라인 793~797)에서 WARNING 으로 지적됐다. channel-web-chat-followups.md 는 show/hide/updateProfile 을 "[project-planner 선행] 설계 미완" 으로 체크박스가 열린 상태다. 그러나 이번 spec 변경(1-widget-app §3.2 신설)이 그 설계를 완료했다. 추적 불일치가 남아있다.
- 제안: channel-web-chat-followups.md §4 [연관] 항목을 "완료(spec-draft-channel-web-chat-gaps.md §4-a/4-b 반영)" 로 갱신한다.

---

## 요약

리뷰 대상 변경(W1~W5 spec 갭 보강 + show/hide/updateProfile 설계)은 전반적으로 의도한 기능을 충실하게 구현했다. `1-widget-app.md §3.1/§3.2`, `3-auth-session.md §3.1/R4`, `4-security.md Rationale/§3-①`, `0-architecture.md §4`, `spec-impl-evidence.md §1` 의 변경이 모두 plan 문서의 지시 사항과 기존 EIA SoT(§5.2·§5.3·§8.3·EIA-NF-03·EIA-AU-04)·2-sdk §R4 와 정합한다. 주요 미결 사항은 세 가지다: (1) plan 지시 항목인 `2-sdk §R4 에 blocked 1줄 추가`가 실제 변경에서 누락돼 plan-구현 간 괴리가 존재하고(WARNING), (2) EIA spec 역방향에 위젯 타이머 폴백 cross-ref 가 추가되지 않아 향후 `replay_unavailable` 구현 시 위젯 갱신 의무가 누락될 위험이 있으며(WARNING), (3) 관련 spec 파일(`1-widget-app.md`, `3-auth-session.md`)의 `pending_plans` 와 `channel-web-chat-followups.md` 체크박스가 갱신되지 않아 plan 추적 정합성이 깨져 있다(WARNING). CRITICAL 수준의 기능 누락이나 spec 위반은 없다.

---

## 위험도

MEDIUM

(WARNING 3건 — plan-구현 괴리 1건, EIA 역방향 cross-ref 누락 1건, plan 추적 불일치 2건. 기능 동작 자체에는 영향 없으나 향후 EIA replay_unavailable 구현 시 위젯 갱신 의무 누락 위험이 실질적 기술 부채로 남는다.)

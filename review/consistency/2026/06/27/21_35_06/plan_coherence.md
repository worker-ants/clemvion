# Plan 정합성 검토 — spec/7-channel-web-chat/4-security.md

## 발견사항

### [WARNING] web-chat-quality-backlog §D 항목들이 target 에 이미 구현돼 있으나 체크박스가 미해소 상태
- target 위치: `spec/7-channel-web-chat/4-security.md` — `## Overview`(23행), `§4`(134행), `## Rationale` R2·R3·R4·R5·I3·I4(165~240행)
- 관련 plan: `plan/in-progress/web-chat-quality-backlog.md §D` — 아래 6개 항목 전부 `[ ]` 미체크
- 상세:
  - backlog `[ ] R5 신설` — target 에 `### R5. iframe sandbox allow-same-origin` 섹션(202행~) 이미 완전 존재.
  - backlog `[ ] §4 EIA §8.4 인용 — SSE 동시 3 vs interact 분당 60 구분 기재(I1)` — target §4(134행)에 정확히 해당 구분이 기재됨.
  - backlog `[ ] R2 — 인증 webhook embed-config enforce:false 결정 Rationale(I3)` — target R2(178행)에 `인증 webhook 의 embed-config 제외(I3)` 항목 이미 존재.
  - backlog `[ ] Rationale — CORS(empty→CDN-only) vs 임베드(empty→allow-all) 비대칭 의도된 설계(I4)` — target R2(183행)에 `빈 목록의 레이어별 비대칭은 의도된 설계(I4)` 항목 이미 존재.
  - backlog `[ ] id↔basename 불일치 주석 · ## Overview 섹션 추가(I5/I6)` — target frontmatter에 이미 불일치 주석 존재, `## Overview` 섹션(23행) 이미 존재.
  - backlog `[ ] spec/5-system/12-webhook.md POST 전용 SoT에 /embed-config 서브경로 스코프 한정 문구(I2)` — `12-webhook.md` Rationale(409행)에 이미 해당 한정 문구가 명기됨.
- 제안: `plan/in-progress/web-chat-quality-backlog.md §D`의 6개 `[ ]` 항목을 전부 `[x]`로 업데이트해야 한다. target 이 이미 구현한 내용이므로 plan 측 갱신이 필요하다(target 변경 불요).

### [INFO] EIA §8.4 interact 분당 60 미구현 상태와 target 기술 정합
- target 위치: `spec/7-channel-web-chat/4-security.md` §4(134행) — "interact 분당 60/execution 은 Planned(미구현)"
- 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `[ ] Per-execution / per-trigger rate-limit 및 RATE_LIMITED 429 (§5.1/§8.4/EIA-NX-11)` 미구현으로 추적 중
- 상세: target 이 "Planned(미구현)"으로 정직하게 기재하고, EIA gaps plan이 동일 항목을 open으로 추적 중 — 상호 정합. 충돌 없음. target 이 일방적으로 "구현됨"으로 기술하는 사례 없음.
- 제안: 추적 목적 INFO. 변경 불요.

### [INFO] 1MB webhook 본문 임계 미결정과 target 의 32KB 기술
- target 위치: `spec/7-channel-web-chat/4-security.md` §4(152행) — "body 32KB: webhook gate에서 구현됨 v1"
- 관련 plan: `plan/in-progress/spec-sync-webhook-gaps.md` — WH-NF-02 1MB 통일 임계 미결(옵션 A/B/C 분석 완료, 결정 미확정)
- 상세: target 은 공개 webhook 32KB 현행만 기술하며 인증 webhook 1MB/1MB 통일 여부에 대해 언급하지 않는다. WH-NF-02 결정이 미확정이므로, 현 target 기술이 "32KB(공개 webhook)" 범위로 한정되어 있어 충돌하지 않는다. 단 결정 후 옵션 A(전역 1MB) 채택 시 target §4 본문도 동기화 대상이 될 수 있음.
- 제안: WH-NF-02 결정이 내려지면 `4-security.md §4` 본문 검토를 backlog에 추가 메모해두는 것이 좋다. 현 시점 변경 불요.

## 요약

target `spec/7-channel-web-chat/4-security.md`는 `plan/in-progress/web-chat-quality-backlog.md §D`에서 "미완료(`[ ]`)"로 추적되는 6개 spec-polish 항목(R5 신설·I1 EIA §8.4 구분·I2 webhook POST 전용 스코프·I3 인증 webhook embed-config·I4 비대칭 의도 기록·I5/I6 Overview/id주석)을 이미 전부 포함하고 있다. 이는 target이 plan 항목을 일방적으로 우회한 것이 아니라 plan 체크박스가 stale 상태인 것이며, plan 측 업데이트(6개 `[ ]` → `[x]`)가 필요하다. EIA §8.4 interact 분당 60과 WH-NF-02 1MB 임계는 각각 별도 plan이 미결로 추적 중이며, target은 이들과 충돌하지 않고 현행 구현 상태를 정확히 반영한다. 미해결 결정을 일방적으로 확정하거나 선행 plan 미해소 조건을 무시하는 사례는 발견되지 않았다.

## 위험도

LOW

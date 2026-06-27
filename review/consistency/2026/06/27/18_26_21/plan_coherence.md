# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `spec/2-navigation/1-workflow-list.md` — pending_plans 와 spec 상태 정합

- target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter (`status: partial`) 및 §2.3 / §2.7
- 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` — 태그 필터 UI / 폴더 필터 UI / 마켓플레이스 링크 3건 미체크
- 상세: spec 은 `status: partial` + `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]` 를 선언하고, 3건 모두 "**미구현 (Planned)**" 로 명시해 plan 의 open 상태와 일치한다. spec 이 이 항목들에 대해 일방적 결정을 내리고 있지 않다.
- 제안: 추적 메모 수준 — 별도 조치 불필요.

### [INFO] `spec/2-navigation/2-trigger-list.md` — Rationale R-2 TBD 미결 항목

- target 위치: `spec/2-navigation/2-trigger-list.md` §Rationale R-2 (v1.1 rotate 응답 shape / grace 기간 / 경로 세그먼트)
- 관련 plan: 직접 연결된 plan 항목 없음; EIA spec 합의 선행 조건으로 기술됨
- 상세: Rationale R-2 에 `**TBD (미결정)**` 마커가 명시적으로 존재한다. 현재 `mc-modellistdto-fix` 작업은 이 spec 을 수정하지 않으므로 충돌 없음. 단, 해당 TBD 의 EIA 선행 합의가 `plan/in-progress/` 에 별도 추적 항목으로 등재되어 있지 않아 소실될 수 있다.
- 제안: plan 추가 불필요(TBD 는 spec 본문에 명시됨); EIA plan 에서 rotate 응답 형식이 확정될 때 본 spec R-2 도 동시에 갱신해야 한다는 사실을 기억해 둘 것.

---

## 요약

`spec/2-navigation/` 대상 문서 9건 모두 in-progress plan 과 정합한다. 미구현 항목은 spec 에 `status: partial` / `pending_plans` / "**미구현 (Planned)**" 로 정직하게 반영되어 있고, 프롬프트에 포함된 5건의 in-progress plan(ai-agent-tool-connection-rewrite / ai-context-memory-followup-v2 / cafe24-backlog-residual / channel-web-chat-followups / channel-web-chat-impl)은 모두 `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/` 등 별개 영역을 다루며 `spec/2-navigation/` 와 교차 충돌이 없다. `spec/2-navigation/2-trigger-list.md` R-2 의 TBD 마커는 spec 자체에 명시적으로 남아 있는 기존 미결 사항으로, 현재 `mc-modellistdto-fix` 작업이 이를 건드리지 않아 신규 충돌이 발생하지 않는다.

## 위험도

NONE

---
worktree: TBD
started: 2026-05-16
owner: project-planner
---

# Spec overview — UI 패턴 카탈로그에 Inline Alert 추가

## 배경

`spec-cafe24-private-followup-ae9995` PR 의 consistency-check (`review/consistency/2026/05/16/01_18_15`) 가 INFO I-1 로 권고한 후속.

cafe24 Private request-scopes 흐름의 분기 ② 응답에 대한 화면 표시가 **inline alert (영구 표시, amber 톤)** 패턴으로 결정됐다. 이 패턴은 다음 화면 spec 들에 점점 더 자주 등장한다:

- `spec/2-navigation/4-integration.md §4.4` (본 PR 신규)
- `spec/2-navigation/4-integration.md §4.2` 누락 scope 배지 (현행, red 톤)
- Cafe24PrivatePending 신규 통합 폼 (현행, amber 톤 + polling)
- 향후 webhook signing key 회전·notification preference 변경 등 외부 후속 작업이 필요한 화면

매 spec 마다 inline alert 의 톤·생존 주기·toast 와의 역할 분리를 개별 기술하면 표준이 흐려지므로, `spec/0-overview.md §3.4` (또는 `spec/2-navigation/_layout.md` 의 횡단 규약) 에 한 번 정의하고 영역별 spec 은 그 패턴을 참조하는 형태로 정리하는 것이 바람직.

## 작업 범위

- [ ] 새 worktree 생성 (`spec-overview-inline-alert-<slug>`)
- [ ] `spec/0-overview.md §3.4` 또는 `spec/2-navigation/_layout.md` 에 "Inline Alert" 패턴 정의 추가:
  - 적용 시점 (사용자가 외부 작업을 진행하는 동안 안내 참조 필요)
  - 톤 (info/warning/error) 와 amber/red 색조 매핑
  - toast 와의 역할 분리 (alert = 본문, toast = 도착 신호)
  - 생존 주기 (다음 관련 mutate 시 reset)
- [ ] 영역별 spec 들이 위 패턴을 참조하도록 inline 갱신
- [ ] consistency-check --spec 호출 후 반영
- [ ] PR + merge → complete 이동

본 plan 은 그 자체로 별도 PR 이며, 본 PR (`spec-cafe24-private-followup-ae9995`) 의 머지 이후 진행한다.

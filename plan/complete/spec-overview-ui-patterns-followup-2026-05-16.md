---
worktree: spec-overview-inline-alert-283211
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

- [x] 새 worktree 생성 (`spec-overview-inline-alert-283211`)
- [x] `spec/0-overview.md §3.4` 에 "Inline Alert" 패턴 정의 추가 (Badge 와 Toast 사이의 4번째 항목):
  - 적용 시점 — 사용자가 외부 작업(Cafe24 콘솔 권한 활성화, 본사 승인, 외부 키 회전, 이메일 인증 등) 을 진행하는 동안 안내 참조 필요
  - 톤 매핑 — info(파랑) / warning(amber) / error(red), Badge 와 의미 분리 (단순 상태 ≠ alert)
  - toast 와의 역할 분리 — alert = 안내 본문 (영구), toast = 도착 신호 (단발)
  - 생존 주기 — `onMutate` 시 reset, X 버튼 원칙 미허용 (예외 명시)
  - 현재 사용처 cross-link (Cafe24 Public 폼 §3.2, Scope & Permissions §4.4)
- [x] 영역별 spec 갱신:
  - `spec/2-navigation/4-integration.md §3.2` 별도 승인 권한 안내 — "영구 amber 경고 배너" → "inline alert (warning, amber 톤 — §3.4)" 참조 형태로 정리
  - `spec/2-navigation/4-integration.md §4.4` 분기 ② UI 블록 — 공통 패턴(§3.4) 한 줄 참조로 압축, 분기 ② 고유 콘텐츠(문구·`scopesAdded` 칩·refetch 미실행) 만 본문에 유지
  - `spec/2-navigation/4-integration.md` Rationale "UI 안내 패턴 결정" — 횡단화 진행 노트 (2026-05-18) 추가, 공통 규칙 SoT 가 §3.4 임을 명시
  - `spec/conventions/cafe24-restricted-scopes.md §4.2`·`기각된 대안 (A)` — 같은 amber 배너 표현을 §3.4 참조로 정합화 (consistency-check W-1 후속)
- [x] consistency-check --spec 호출 후 반영 — `review/consistency/2026/05/18/17_22_08/SUMMARY.md` (BLOCK: NO). 반영:
  - W-1 (amber 배너 명칭 혼용) → `cafe24-restricted-scopes.md` 2건 포함 정합화
  - W-4 (Badge 파랑 vs Alert info 파랑 충돌) → §3.4 Badge·Alert 항목에 "리소스 상태 vs 긴급도 직교" 명시
  - W-5 (`notification-actions-8806b6` 의 `_layout.md` 편집 충돌 위험) → 본 PR 은 `0-overview.md §3.4` 만 수정하므로 충돌 없음
  - I-2 (에러 페이지·빈 상태 cross-link) / I-3 (Toast 도착 신호 역할) / I-4 (위치 결정 근거) → §3.4 본문 inline 반영
  - I-6 (plan frontmatter `worktree: TBD`) → `spec-overview-inline-alert-283211` 으로 갱신
- [x] PR + merge → complete 이동 (본 PR 의 마지막 commit 으로 처리)

본 plan 은 그 자체로 별도 PR 이며, 본 PR (`spec-cafe24-private-followup-ae9995`) 의 머지 이후 진행한다.

## 미적용 권고

- `Cafe24PrivatePending` 신규 통합 폼 (현행, amber 톤 + polling) — 본 PR 작업 시점에 별도 spec 본문 항목이 존재하지 않아 §3.4 cross-link 대상에서 제외했다. 해당 폼의 spec 이 추가되거나 polling spec 이 명문화될 때 §3.4 의 "현재 사용처" 줄에 추가한다.
- `_layout.md` 의 횡단 규약 후보 위치는 사용처가 navigation 외부(예: webhook signing key 회전, notification preference) 로 확장될 가능성이 높아 채택하지 않고 `0-overview.md §3.4` 의 cross-cutting 자리에 두었다.

## 본 plan 범위 외 — consistency-check 후속

본 plan 의 작업 범위 (UI 패턴 카탈로그) 와 무관한 spec 정합 이슈가 함께 발견됐다. 별도 plan 으로 분리:

- **W-2** `spec/1-data-model.md §2.6` Node.type 전체 목록에 `filter` 누락 — DB enum 정의에 실질적 영향, 우선순위 높음. 별도 plan 분리 권장.
- **W-3** `spec/0-overview.md` 말미에 `## Rationale` 섹션 부재 — 문서 전체 정리 성격이라 본 PR 범위 외.
- **I-1** §6.2 Cafe24 항목 분류 혼동 — 로드맵 정리 plan 후보.
- **I-5** CLAUDE.md §명명 컨벤션 표에 루트 레벨 `spec/0-overview.md` 항목 미명시 — CLAUDE.md 자체 정리.

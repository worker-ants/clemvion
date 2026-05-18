# Rationale 연속성 검토 결과

검토 대상: `spec/0-overview.md`
검토 모드: spec draft 검토 (--spec)
기준 Rationale 출처: `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/10-auth-flow.md`

---

### 발견사항

- **[INFO]** Toast 정의의 역할 범위 — 공존 시나리오 미반영
  - target 위치: `spec/0-overview.md §3.4` Toast 항목 ("성공/실패/정보 알림")
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "UI 안내 패턴 결정 (2026-05-16 추가)"
  - 상세: 기존 §3.4 의 Toast 정의는 "성공/실패/정보 알림" 으로 포괄 서술된다. 추가될 Inline Alert 패턴에서 Toast 는 "도착 신호(arrival signal)로만 사용, alert 가 안내 본문" 으로 역할이 좁혀진다. 두 설명이 동일 §3.4 안에 공존할 경우 "Toast = 일반 알림" 정의와 "Toast = inline alert 공존 시 도착 신호" 정의가 충돌처럼 읽힐 수 있다. Rationale 에서는 이 분리가 명시적으로 결정됐지만 §3.4 본문에는 해당 조건이 드러나지 않는다.
  - 제안: Toast 항목에 "(inline alert 와 함께 사용 시 도착 신호 역할)" 등 짧은 보조 설명을 추가하거나, Inline Alert 패턴 항목 안에 "toast = 도착 신호 (standalone toast 와 역할 분리)" 를 명시해 두 정의의 적용 컨텍스트를 구분한다.

- **[INFO]** `spec/2-navigation/4-integration.md §3.2` "영구 amber 경고 배너" 표현이 아직 §3.4 참조 형태로 갱신되지 않음
  - target 위치: `spec/0-overview.md` (본 문서 기준에서는 직접 해당 없음, 인접 문서 상태 확인 차원)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §3.2` 및 같은 문서 Rationale "UI 안내 패턴 결정"
  - 상세: `spec/2-navigation/4-integration.md §3.2` (line 159) 는 "영구 amber 경고 배너를 띄운다" 로 기술되어 있다. plan 의 작업 범위는 이를 "inline alert (warning, amber 톤 — §3.4)" 참조 형태로 정리하기로 했으나, 현재 파일에는 반영이 미확인 상태다. §3.4 의 새 패턴이 SoT 로 자리잡으면 §3.2 기술이 orphan 표현이 될 수 있다.
  - 제안: `spec/2-navigation/4-integration.md §3.2` 의 "영구 amber 경고 배너" 표현을 "inline alert (warning 톤 — `spec/0-overview.md §3.4` 참조)" 로 갱신해 단일 진실 원칙을 유지한다. plan 의 해당 체크박스 항목과 연동 확인.

- **[INFO]** `_layout.md` vs `0-overview.md` 위치 결정의 Rationale 미기재
  - target 위치: `spec/0-overview.md §3.4` (추가될 Inline Alert 패턴)
  - 과거 결정 출처: plan `spec-overview-ui-patterns-followup-2026-05-16.md` §미적용 권고
  - 상세: Inline Alert 를 `spec/2-navigation/_layout.md` 대신 `spec/0-overview.md §3.4` 에 두기로 한 이유 ("사용처가 navigation 외부로 확장될 가능성이 높음") 가 plan 문서에만 기재되어 있고 `spec/0-overview.md` 자체에는 이 위치 결정 Rationale 가 없다. 훗날 navigation 전용 횡단 규약으로 이동하자는 제안이 나왔을 때 근거가 사라진다.
  - 제안: `spec/0-overview.md` 에 Inline Alert 패턴을 추가할 때, 주석 또는 짧은 보조 설명으로 "navigation 외부(webhook 키 회전, notification preference 등) 로 확장 가능하므로 _layout.md 대신 0-overview.md 에 배치" 맥락을 inline 으로 남기거나, `## Rationale` 섹션이 없는 0-overview.md 특성상 plan/spec 링크를 footer 에 명시한다.

---

### 요약

`spec/0-overview.md §3.4` 에 Inline Alert 패턴을 추가하는 변경은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. `spec/2-navigation/4-integration.md` Rationale "UI 안내 패턴 결정 (2026-05-16)" 이 modal/dialog 를 기각하고 inline alert + toast 분리 구조를 채택한 결정과 방향이 일치한다. 발견된 3건은 모두 INFO 수준으로, Toast 정의의 컨텍스트 경계 불명확, 인접 문서의 SoT 참조 갱신 미완료, 위치 선택 Rationale 의 inline 미기재에 해당한다. 이 중 Toast 역할 중복 표현이 가장 우선순위 높은 정합성 보완 항목이다.

---

### 위험도

LOW

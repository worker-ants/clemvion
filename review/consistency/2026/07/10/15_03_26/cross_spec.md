### 발견사항

- **[WARNING]** "연결 안 됨" 배너가 기존 Inline Alert 컨벤션(`spec/0-overview.md §3.4`)과 정의상 중복되는데 상호 참조·등록이 누락됨
  - target 위치: `spec/2-navigation/4-integration.md §4.6` "연결 안 됨 배너" bullet (신규 추가)
  - 충돌 대상: `spec/0-overview.md §3.4` (상태 표시 패턴 — Inline Alert 정의 + "현재 사용처" 목록), 그리고 같은 파일의 선례 `spec/2-navigation/4-integration.md §4.4` (Scope & Permissions 탭의 Cafe24 Private pending 배너)
  - 상세: `0-overview.md §3.4`는 "페이지 안에 영구 표시되는 안내 블록"(warning/error/info 톤, X 버튼 없음, cross-cutting 정의)을 **Inline Alert**로 명명하고 이를 사용하는 모든 곳을 "현재 사용처" 목록에 등록해 왔다(현재 2건: Cafe24 Public 등록 폼 경고, `§4.4` Scope & Permissions 탭 경고). `§4.4`는 새 배너를 추가할 때 "공통 **Inline Alert** 패턴([`spec/0-overview.md §3.4`])의 warning(amber) 톤을 적용한다"고 명시적으로 인용한다. 이번 target(`§4.6`)이 추가한 "연결 안 됨" 배너는 기능·스타일 모두 Inline Alert 정의와 사실상 동일하다 — 영구 표시(닫기 버튼 없음), warning 톤(amber), 상태가 실시간으로 반영(연결 복구 시 자동 해제). 실제 구현(`activity-disconnected-banner.tsx`)도 `border-amber-300 bg-amber-50 ... dark:bg-amber-950/40`로 `scope-tab.tsx`의 Inline Alert 인스턴스(`border-amber-300 bg-amber-50 p-3 ... dark:border-amber-800 dark:bg-amber-950/40`)와 거의 동일한 톤을 재현했다. 그런데 `§4.6` bullet 은 Inline Alert 컨벤션을 전혀 인용하지 않고, `0-overview.md §3.4`의 "현재 사용처" 목록도 갱신되지 않았다 — 같은 문서(`4-integration.md`) 안에서 동일 시각적 패턴이 한 곳(§4.4)은 명명된 공용 패턴으로, 다른 곳(§4.6)은 독립 "경고 배너"로 서술되어 정의가 갈린다. 이는 CRITICAL 급 기능 충돌은 아니지만("Inline Alert" 규약을 어겼다"고 단정할 근거는 없음 — 새 배너가 mutate 결과가 아닌 순수 조회 status 파생이라 `onMutate` 리셋 규정과는 다른 성격일 수 있음), 두 서술이 같은 UI 계열을 다르게 명명한 채 방치되면 향후 세 번째 사용처가 추가될 때 "Inline Alert로 등록해야 하는가"를 다시 판단해야 하는 정의 중복이 발생한다.
  - 제안: `project-planner`가 다음 중 하나를 명시적으로 결정: (a) `§4.6` 배너를 Inline Alert 인스턴스로 확정하고 `0-overview.md §3.4` "현재 사용처" 목록에 3번째 항목으로 추가 + `§4.6` bullet 에 `[spec/0-overview.md §3.4]` 인용 삽입, 또는 (b) 이 배너가 Inline Alert 와 의도적으로 다른 경량 상태 배너임을 `§4.6`에 근거(Rationale)로 남겨 향후 혼동을 방지.

- **[INFO]** amber 다크 모드 톤이 기존 Inline Alert 인스턴스와 미세하게 다름
  - target 위치: `codebase/frontend/.../activity-disconnected-banner.tsx` (`dark:border-amber-900 dark:bg-amber-950/40`)
  - 충돌 대상: `codebase/frontend/.../scope-tab.tsx` 의 Cafe24 Private pending 배너 (`dark:border-amber-800 dark:bg-amber-950/40`)
  - 상세: 두 배너 모두 라이트 모드는 `border-amber-300 bg-amber-50`로 동일하나, 다크 모드 border 톤이 `amber-900` vs `amber-800`로 1단계 다르다. 기능·spec 상 문제는 아니고 순수 시각 디테일이지만, 위 WARNING 항목과 같은 근본 원인(공용 Inline Alert 컴포넌트 부재로 배너마다 톤을 재구현)을 보여준다.
  - 제안: 위 WARNING 결정과 함께 (a)를 택한다면 공용 스타일 상수/컴포넌트로 통합해 톤 drift 를 원천 차단하는 것을 개발자 후속 작업으로 고려.

### 요약

이번 변경은 데이터 모델(`Integration.status` enum: `connected/expired/error/pending_install`, `spec/1-data-model.md §2.10`)·상태 전이·API 계약·RBAC 어느 것도 새로 정의하지 않고 기존 `status` 필드를 UI 조건 분기로만 소비하며, `§7.3` 에디터 경고나 `§4.2` Overview 탭의 재연결 동선과도 모순 없이 맞물린다. spec(`§4.6`)과 코드가 같은 워크트리 안에서 원자적으로 함께 추가됐고 스코프 밖 문서에 이 배너를 언급하는 중복 서술도 없다. 유일한 발견사항은 새 배너가 사실상 같은 문서(`§4.4`)가 이미 명명해 둔 공용 Inline Alert 패턴(`0-overview.md §3.4`)과 스타일·행동이 거의 동일함에도 그 패턴으로 등록·인용되지 않아 두 곳의 정의가 암묵적으로 갈라졌다는 점이다 — 기능 파손 위험은 없으나 "이 배너 부류를 어떻게 명명·등록할 것인가"에 대한 명시적 결정과 문서 동기화가 필요하다.

### 위험도
LOW

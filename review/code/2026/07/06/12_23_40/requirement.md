# 요구사항 충족 리뷰 — /schedules inbound `?triggerId=` 역방향 딥링크 (행 강조)

- 커밋: 54f8aaac9
- diff base: `origin/main...HEAD`
- 대상: `codebase/frontend/src/app/(main)/schedules/page.tsx`, `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`, `spec/2-navigation/3-schedule.md`

## 발견사항

결함 없음. 모든 관점(기능 완전성 / 엣지 케이스 / 에러 시나리오 / spec fidelity)에서 문제를 발견하지 못했다. 아래는 검증한 세부 근거이며 조치가 필요한 항목은 없다.

- **[INFO]** spec fidelity — 신설 문구와 구현 line-level 일치 확인
  - 위치: `spec/2-navigation/3-schedule.md` §2.1 신설 문단 vs `codebase/frontend/src/app/(main)/schedules/page.tsx:493-509, 1017-1039`
  - 상세: spec 문구 "해당 트리거의 스케줄 행을 강조 표시하고 한 번 스크롤", "현재 페이지에 그 행이 있을 때만 강조", "cross-page 포커스는 backend triggerId 필터 신설이 필요한 후속", "강조는 시각 표시일 뿐 편집 다이얼로그를 자동으로 열지는 않는다" 4개 명제 모두 구현에서 그대로 확인됨. 코드 주석(`page.tsx:493-497`)도 spec 문구를 거의 그대로 재인용해 두어 spec↔코드 추적성이 높음. 편집 다이얼로그 자동 오픈 로직 자체가 코드에 존재하지 않음(grep 으로 `isFocused` 관련 side effect 가 강조/스크롤 외 없음을 확인).
  - 상세: outbound 트리거 발신원(`triggers/page.tsx:782`, `schedule-config-card.tsx:52`)이 `/schedules?triggerId=${trigger.id}` 형태로 생성하고, `mapSchedule`(`page.tsx:1020-1032`)이 `triggerId: s.trigger?.id ?? ""` 로 매핑하여 서로 정합.

- **[INFO]** 엣지케이스 (1) 매칭 스케줄이 현재 페이지에 없을 때
  - 상세: `isFocused = !!focusTriggerId && schedule.triggerId === focusTriggerId` (`page.tsx:1018-1019`) 는 순수 렌더 파생이므로 매칭 행이 없으면 단순히 모든 행에서 `isFocused=false` — no-op. `ref`/`data-testid`/강조 클래스 모두 조건부로만 붙으므로 예외나 크래시 경로 없음. 테스트("highlights no row when ?triggerId= matches no schedule on the page")로 회귀 방지 확인됨(17/17 pass, 실행 검증 완료).
  - 상세: `usePageParam`(`use-page-param.ts:29-41`)이 `page` 변경 시 다른 search params(`triggerId` 포함)를 보존하므로, 사용자가 다른 페이지로 이동해도 `triggerId` 파라미터는 유실되지 않아 수동 페이지 탐색을 통한 발견은 가능 — spec 이 명시한 한계("cross-page 포커스는 후속 필요")와 정확히 일치하는 graceful degradation.

- **[INFO]** 엣지케이스 (2) 빈 문자열 triggerId 오매칭 방지
  - 상세: `!!focusTriggerId` 가드(`page.tsx:1018`)가 `focusTriggerId` 가 `null`(파라미터 없음) 이거나 spec상 존재할 수 없는 빈 문자열일 때 모두 매칭을 차단. `mapSchedule` 의 `triggerId: s.trigger?.id ?? ""` fallback 과 결합해도, `""===""` 오매칭이 발생하려면 `focusTriggerId` 도 빈 문자열이어야 하는데 `!!""` 는 `false` 이므로 가드에서 이미 차단됨 — 이중 안전.
  - 상세: 테스트("highlights no row when no ?triggerId= is present")로 `focusTriggerId=null` 케이스 회귀 방지 확인.

- **[INFO]** 엣지케이스 (3) 1회 스크롤 보장
  - 상세: `scrolledFocusRef`(`useRef(false)`, `page.tsx:500`)가 컴포넌트 인스턴스당 1개이며, `ref` 콜백 내부에서 `if (el && !scrolledFocusRef.current) { scrolledFocusRef.current = true; el.scrollIntoView(...) }` (`page.tsx:1025-1032`) 구조로 최초 mount 시에만 1회 트리거. React 가 리스트 리렌더 시 동일 DOM 엘리먼트에 대해 ref 콜백을 재호출하지 않는 한(키가 바뀌지 않는 한) 재호출되지 않음 — 스펙의 "한 번 스크롤" 요구와 일치. 테스트에서 `scrollIntoView` 호출 여부만 확인하고 "정확히 1회" 카운트는 assert 하지 않지만, ref 콜백 구조 자체가 구조적으로 1회 보장.

- **[INFO]** #832 정방향과의 대칭성 — 의도적 비대칭이며 spec 에 명시
  - 상세: 정방향(`/triggers?triggerId=`, `triggers/page.tsx:159-168`)은 drawer 자동 오픈, 역방향(`/schedules?triggerId=`)은 강조 전용(다이얼로그 미오픈). 두 spec(`3-schedule.md` §2.1 / `2-trigger-list.md`)에 각각 그 차이가 명시적으로 문서화되어 있어 일관성 결여가 아닌 의도된 설계 결정.

- **[INFO]** viewMode 분기 (gray-zone, spec 침묵)
  - 상세: 강조/스크롤 로직은 `viewMode === "list"` 렌더 블록(`page.tsx:999` 이하)에만 존재하며 calendar 뷰 블록(`page.tsx:1183` 이하)에는 없음. `viewMode` 기본값이 `"list"`(`page.tsx:475`)라 딥링크 최초 진입 시에는 항상 적용되지만, 사용자가 calendar 로 전환하면 강조가 사라짐. spec 본문이 이 케이스에 침묵하므로 결함이 아닌 INFO. 필요 시 후속 spec 명문화 대상이 될 수 있으나 이번 변경 스코프의 문제는 아님.

## 요약

`?triggerId=` 역방향 딥링크 강조 기능은 spec §2.1 신설 문구(현재 페이지 한정 강조, 1회 스크롤, 편집 다이얼로그 미자동오픈, cross-page 한계 명시)와 line-level 로 정확히 일치하며, `!!focusTriggerId` 가드와 `mapSchedule` fallback 조합으로 null/빈 문자열 오매칭이 구조적으로 차단되고, `scrolledFocusRef` 로 1회 스크롤이 보장된다. `usePageParam` 이 다른 search params 를 보존해 매칭 실패 시에도 graceful no-op 이며 수동 페이지 탐색으로 발견 가능한 경로를 남겨 spec 의 문서화된 한계와 정합한다. 17개 테스트(신규 3개 포함) 전체 통과를 직접 실행 확인했다. TODO/FIXME 등 미완성 표식 없음, 정방향(#832)과의 UX 비대칭은 양쪽 spec 에 의도로 명시되어 있어 문제가 아니다. 결함 없음.

## 위험도

NONE

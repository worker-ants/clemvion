# 요구사항 충족 리뷰 — /triggers inbound ?triggerId= 딥링크 소비 (FE-3 후속)

- 대상 커밋: c75077ec5
- diff: `codebase/frontend/src/app/(main)/triggers/page.tsx`, `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx`, `spec/2-navigation/2-trigger-list.md` §2.3, `spec/2-navigation/3-schedule.md`, `plan/in-progress/spec-sync-schedule-gaps.md` → `plan/complete/`

## 발견사항

결함 없음. 이하 확인한 근거를 기록한다.

- **[INFO]** spec §2.3 신설 문구와 구현이 line-level 로 일치
  - 위치: `spec/2-navigation/2-trigger-list.md:72`, `codebase/frontend/src/app/(main)/triggers/page.tsx:161-167`
  - 상세: spec — "마운트 시 URL 파라미터를 1회 소비하며, 이후 사용자의 열기/닫기 조작은 URL 과 독립적으로 동작한다." 구현 — `useState<string | null>(() => searchParams.get("triggerId"))` 로 초기값만 lazy-capture, 이후 `searchParams` 변경에 반응하는 `useEffect` 없음(1회 소비), `setSelectedTriggerId`/`drawer onClose` 모두 URL 을 갱신하지 않음(독립적 열기/닫기). `open={selectedTriggerId !== null}` 도 spec "착지 시 자동으로 열린다"를 정확히 구현.
  - 결론: 일치.

- **[INFO]** 엣지케이스 (1) 존재하지 않는 trigger id
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:58-62`, `codebase/frontend/src/components/triggers/hooks/use-trigger.ts`
  - 상세: `useTrigger(triggerId, open)` 가 `enabled: !!triggerId && open` 로 페치하고, `trigger` 가 falsy(404/미존재)면 drawer 는 `t("triggers.detail.notFound")` 텍스트로 안전하게 폴백한다(크래시·빈 화면 없음). 이 fallback 은 딥링크가 아닌 일반 클릭 진입에도 동일하게 적용되는 기존 동작이라 이번 diff 의 회귀 리스크가 아니다. 참고로 `useTrigger` 는 `isError` 를 별도로 노출하지 않아 "존재하지 않는 id"와 "네트워크 에러"가 UI 상 구분되지 않지만, 이는 이번 diff 범위 밖의 pre-existing 설계이며 spec §2.3 도 이 구분을 요구하지 않는다.

- **[INFO]** 엣지케이스 (2) 마운트 후 클라이언트 내비게이션으로 `?triggerId=` 변경 시 재오픈 안 함 — 의도된 동작
  - 상세: spec 문구 "마운트 시 URL 파라미터를 1회 소비" + "이후 URL 과 독립적으로 동작"이 정확히 이 비-반응(non-reactive) 동작을 요구한다. `useState` lazy initializer 는 React 규약상 최초 렌더에서만 실행되므로 구현이 spec 의도를 정확히 반영. 의도치 않은 갭이 아님.

- **[INFO]** 엣지케이스 (3) drawer 닫은 뒤 URL 에 `triggerId` 잔류, 새로고침 시 재오픈
  - 상세: `onClose={() => setSelectedTriggerId(null)}` 는 로컬 state 만 초기화하고 URL 은 건드리지 않는다(스펙이 명시한 "URL 과 독립적" 동작의 자연스러운 결과). 새로고침(hard reload)은 컴포넌트 재마운트이므로 초기값 로직이 다시 실행되어 drawer 가 재오픈된다 — 이는 브라우저 새로고침의 일반적 의미론과 부합하고, spec 이 새로고침 시 URL 정리(예: `router.replace` 로 param 제거)를 요구하지 않으므로 회색지대(INFO)로 분류. 실사용상 불편함이 있을 수 있으나 spec 미명시 영역이라 결함으로 보지 않음.

- **[INFO]** 딥링크 왕복 완결성
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:1124` (`href={\`/triggers?triggerId=${schedule.triggerId}\`}`), `codebase/frontend/src/app/(main)/triggers/page.tsx:782` (`href={\`/schedules?triggerId=${trigger.id}\`}`)
  - 상세: schedules → triggers 방향은 이번 diff 로 완결(링크 생성은 기 존재, 소비만 신규). triggers → schedules 방향의 역소비(`/schedules?triggerId=` 착지 시 자동 필터/포커스)는 plan 파일에도 "본 PR 범위 밖 잠재 갭"으로 명시적으로 남겨둠(`plan/complete/spec-sync-schedule-gaps.md` 참고 문구) — 스코프 누락이 아니라 문서화된 후속.

- **[INFO]** `usePageParam` 과의 상호작용
  - 위치: `codebase/frontend/src/lib/hooks/use-page-param.ts:31` (`new URLSearchParams(searchParams.toString())`)
  - 상세: 페이지 변경 시 `page` 파라미터만 set/delete 하고 나머지(예: `triggerId`) 는 보존하므로, drawer 오픈 상태에서 페이지네이션을 조작해도 `triggerId` 쿼리 파라미터 자체는 유지된다(다만 위 (2) 에 따라 이미 소비된 초기값이라 재오픈에는 영향 없음). 충돌 없음.

- **[INFO]** 테스트 검증
  - 위치: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx:313-347`
  - 상세: "opens the detail drawer for the trigger named in ?triggerId= on landing" / "does not open the drawer when no ?triggerId= is present" 2건 신설. `next/navigation` mock 의 `useSearchParams` 를 모듈-스코프 `currentSearchParams` 변수로 제어해 딥링크 유무 양쪽 케이스를 커버. 로컬 실행 결과 `14 passed (14)` — 전체 스위트 통과 확인.

- **[SPEC-DRIFT 아님, 확인 완료]** `spec/2-navigation/3-schedule.md` 동반 변경
  - 상세: 이번 diff 의 spec 변경은 "코드가 이미 구현한 기능(더보기 메뉴, 트리거/워크플로 링크, timezone 설정 UI)에 대해 `Planned` 마커를 제거하고 `status: partial → implemented` 로 승격"하는 성격으로, 실제 코드(`codebase/frontend/src/app/(main)/schedules/page.tsx` 의 `/workflows/${schedule.workflowId}` 링크, `/triggers?triggerId=` 링크, `⋮` 드롭다운)와 직접 대조하여 서술이 부합함을 확인했다. 이번 PR 신규 구현이 아니라 선행 PR(#827 등)에서 이미 구현된 것의 spec 뒤늦은 승격이므로 코드 버그도 아니고 spec 이 낡은 것도 아니다(오히려 spec 이 뒤늦게 코드를 따라잡는 정상적인 lifecycle 승격).

## 요약

`/triggers` 의 inbound `?triggerId=` 딥링크 소비 구현은 spec §2.3 신설 문구(마운트 1회 소비, 이후 URL 독립, 착지 시 자동 오픈)와 line-level 로 정확히 일치한다. `useState` lazy initializer 를 이용한 1회성 소비 패턴은 React 의미론상 "재내비게이션 시 재오픈 안 함"을 정확히 보장하며 이는 결함이 아니라 spec 이 명시한 의도된 동작이다. 존재하지 않는 trigger id 딥링크는 기존 `useTrigger`/drawer 의 not-found 폴백으로 안전하게 처리되어 크래시나 빈 화면 위험이 없다. 스케줄→트리거 딥링크 왕복(스케줄 목록 "트리거에서 보기" → 착지 drawer 자동 오픈)은 실제로 완성되며, 역방향(트리거→스케줄) 은 문서화된 별도 후속 스코프로 남아 스코프 누락이 아니다. 동봉된 테스트 2건은 로컬 실행에서 전부(14/14) 통과했고, 동반된 spec 변경(3-schedule.md status 승격) 도 실제 코드와 대조 검증되어 정합하다.

## 위험도

NONE

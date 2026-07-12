# 유지보수성(Maintainability) 리뷰

대상 코드 변경: `codebase/channel-web-chat/src/lib/widget-state.test.ts`(신규 describe 블록 6 케이스),
`codebase/channel-web-chat/src/lib/widget-state.ts`(`mergeMessages` JSDoc 정정, 로직 무변경),
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(신규 "복원 통합" 테스트 1건).
나머지 대상(`plan/in-progress/webchat-multiturn-restore-test.md`, `review/code/2026/07/12/01_10_15/**`)은
직전 `/ai-review` 세션의 산출물(리포트·상태 JSON)이거나 작업 추적 plan 문서로, 순수 생성물/문서라
가독성·네이밍·함수 길이 등 코드 유지보수성 체크리스트가 적용되는 소스 코드가 아니므로 발견사항 없음.

## 발견사항

- **[INFO]** 신규 "복원 통합" 테스트가 인접 "race fix" 테스트와 거의 동일한 `fetchMock` 골격(embed-config
  reject → GET status endswith 분기 → webhook POST 폴백)을 재복제
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 신규 `it("복원 통합: getStatus
    다중 turn conversationThread → state.messages 를 role/text/순서대로 시드", ...)` (diff L641~702)
  - 상세: 파일에는 이미 `installFetch()`/`installControllableSse()` 공용 mock 빌더가 있으나, GET status
    (`/api/external/executions/e1`) 분기가 필요한 테스트마다 ~30줄 인라인 `vi.fn`을 새로 작성하는 기존 패턴을
    이번 변경도 그대로 답습해 중복이 한 곳 더 늘었다. 다만 이는 이번 diff가 새로 만든 문제가 아니라 파일 전반의
    기존 관례를 답습한 것이며, 직전 세션(`review/code/2026/07/12/01_10_15/`)에서 동일하게 INFO로 지적되어
    "이번 diff 단독 변경은 과도"하다는 판단 아래 후속 리팩터로 명시적으로 defer 처리됨(`RESOLUTION.md` INFO 1).
    재차 지적하되 등급 상향 근거는 없음.
  - 제안: 조치 불필요(이미 의도적 defer). 후속 리팩터 시 `installFetchWithStatusContext(...)` 류 공용 헬퍼로
    GET status 분기를 추출하는 것을 권고.

- **[INFO]** `widget-state.ts`의 `mergeMessages` JSDoc이 이번 diff로 실제 동작(length 기반 select, interleave/dedup
  아님)과 일치하도록 정정됨 — 직전 세션 WARNING 2(Documentation)의 후속 조치가 정확히 반영됨
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:414-419`
  - 상세: 새 JSDoc은 실제 삼항 select 로직(`snapshot.length >= local.length ? snapshot : local`)을 정확히
    서술하고, 분기 고정 지점(`widget-state.test.ts §mergeMessages`)까지 명시해 코드-문서-테스트 삼각 추적성이
    개선됨. 로직 자체는 무변경이라 회귀 위험 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트들의 지역 헬퍼(`user`/`bot`/`waiting`, `widget-state.test.ts`)가 `describe` 스코프로
  적절히 한정되어 5~6개 케이스 간 리터럴 생성 중복을 잘 억제함(긍정적 관찰, 조치 불필요).

## 요약

이번 변경은 제품 로직을 건드리지 않는 test-only 추가(리듀서 `mergeMessages` 분기 6케이스 + 새로고침 복원
통합 회귀 테스트 1건)와 직전 리뷰 WARNING 2건(테스트 커버리지 갭 코멘트 정정, 오래된 JSDoc 정정)에 대한
정확한 후속 조치로 구성된다. 네이밍·주석 관례(§ 참조, 한국어 서술형 테스트명, SoT 링크)와 기존 헬퍼
(`installFetch`/`installControllableSse`, `NINETY_MIN_MS` 등 매직넘버 상수화) 패턴을 일관되게 따르며, 함수
길이·중첩 깊이·순환 복잡도 모두 파일 전반의 기존 수준을 벗어나지 않는다. 유일한 지적 사항은 신규 통합
테스트의 `fetchMock` 인라인 재복제인데, 이는 파일 전체가 이미 채택한 "테스트별 독립 mock" 관례를 그대로
답습한 것이고 직전 세션에서 이미 동일하게 발견·검토되어 의도적으로 후속 리팩터로 defer된 사안이라 이번
diff의 신규 결함으로 볼 수 없다. 전반적으로 유지보수성 리스크는 무시할 만한 수준이다.

## 위험도

LOW

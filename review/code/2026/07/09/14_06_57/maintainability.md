# 유지보수성(Maintainability) Review

대상: `refactor(frontend): ai-review WARNING 조치 — 게이트 테스트 단일화·guard 헬퍼 공유·CHANGELOG·주석` (commit 5c4ffd5b)

본 커밋은 직전 리뷰(2026/07/09 13_37_11 SUMMARY, Critical 0 / Warning 5)의 W1~W5 유지보수성 지적을 그대로 조치한 후속 리팩터다. 아래는 조치 결과에 대한 재검토다.

## 발견사항

- **[INFO]** `HELPER` 상수(`path.join(SRC, "lib", "workspace", "href.ts")`)가 여전히 두 guard 테스트 파일에 동일 리터럴로 중복 정의됨
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-editor-href.test.ts` (HELPER 정의), `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts` (HELPER 정의)
  - 상세: W2 조치로 `collectSourceFiles`/`findRawHrefOffenders`는 `href-guard-utils.ts`로 공유했으나, 두 파일에서 완전히 동일한 `HELPER` 경로 상수 한 줄은 각자 재정의하고 있다. 사소하지만 "공유 헬퍼로 추출"이라는 리팩터 의도상 남은 잔여 중복이다.
  - 제안: 필요하면 `href-guard-utils.ts`에 `HREF_HELPER` 같은 이름으로 함께 옮길 수 있으나, 한 줄짜리 상수이고 두 파일이 서로 다른 exemption 목록(`API_DIR`/`NOTIF_HREF` 유무)을 갖고 있어 굳이 강제 통합할 필요는 낮음 — 현행 유지도 무방.

- **[INFO]** 두 layout wiring 테스트(`(editor)/w/[slug]/__tests__/layout.test.tsx`, `(main)/w/[slug]/__tests__/layout.test.tsx`)의 mock 셋업이 여전히 거의 동일하게 반복됨
  - 위치: 두 파일의 `vi.mock("next/navigation", ...)` / `vi.mock("@/lib/workspace/use-workspaces", ...)` / `vi.mock("@/lib/stores/workspace-store", ...)` 블록
  - 상세: W1으로 behaviour 테스트(4×2 케이스)는 `workspace-slug-gate.test.tsx`로 단일화됐고 각 layout 테스트는 "게이트 wiring 확인 1케이스"로 대폭 축소됐다(개선 확인). 다만 축소된 두 wiring 테스트끼리는 mock 3종 세트가 거의 그대로 복제돼 있다(테스트 대상 컴포넌트와 `data-testid` 문자열만 다름).
  - 제안: 현재 2개뿐이라 허용 가능한 수준이나, 세 번째 slug 레이아웃이 추가되면 공용 mock 팩토리(`href-guard-utils.ts`류 패턴)로 뽑는 것을 고려. 지금 단계에서 강제할 정도는 아님.

- **[INFO]** `workspace-slug-gate.test.tsx`가 모듈-스코프 mutable state(`mockParams`, `storeState`, `switchWorkspaceSpy`)를 `beforeEach`로 재설정하는 기존 패턴을 그대로 이전
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/workspace-slug-gate.test.tsx` 상단
  - 상세: 이 패턴은 리팩터 이전부터 두 layout 테스트가 쓰던 기존 컨벤션을 옮긴 것이라 이 커밋이 새로 도입한 문제는 아니다. 다만 모듈 레벨 mutable 변수 + `vi.clearAllMocks()` 조합은 테스트 실행 순서에 암묵적으로 의존하는 구조라 향후 케이스 추가 시 격리 실수 여지가 있다.
  - 제안: 현 상태 유지 가능(기존 컨벤션과의 일관성이 오히려 장점). 새 테스트 추가 시 `beforeEach`에서 상태 전체를 명시적으로 재대입하는 현재 방식을 계속 지키면 충분.

## 요약

이번 커밋은 새 기능 추가가 아니라 직전 ai-review WARNING 5건(테스트 중복 4×2 → 1케이스 단일화, guard 스캐닝 골격 공유 추출, stale 주석 정정, CHANGELOG 누락 보강, 신규 헬퍼 단위 테스트 보강)을 정확히 조치한 리팩터로, 변경 범위가 좁고 각 변경이 목적에 정확히 대응한다. `href-guard-utils.ts` 추출로 두 raw-href guard의 스캐닝 로직(파일 수집·오펜더 매핑) 중복이 사라졌고, `workspace-slug-gate.test.tsx` 신설로 게이트 행위 검증이 SoT 한 곳에 모여 두 layout 테스트가 순수 wiring 확인으로 축소됐다. 함수 길이·중첩·매직넘버·네이밍 모두 양호하며 코드베이스 기존 테스트 컨벤션(모듈 스코프 mock 상태, `describe/it.each` 스타일)과도 일관된다. 남은 지적은 모두 INFO 수준의 사소한 잔여 중복(HELPER 상수 재정의, 두 wiring 테스트 간 mock 세트 반복)이며 즉각 조치가 필요한 수준은 아니다.

## 위험도

NONE

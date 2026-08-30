# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신설 테스트가 실행 시점에 `src/**` 전수(약 800여 파일)를 재귀 스캔하는 파일시스템 읽기 부작용을 도입
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — `listSources()`(67행 기준 함수, 실측 174행)와 `discover()`(196행)
  - 상세: `readdirSync`/`readFileSync` 로 저장소 자신의 소스 트리를 재귀 탐색한다. 쓰기·삭제는 없고, 읽는 대상도 `node_modules`/`dist` 를 제외한 저장소 내부 `.ts` 소스로 한정돼 있어 외부 파일시스템이나 프로덕션 런타임에는 영향이 없다. `beforeAll` 로 1회만 실행해 4개 `it` 이 공유하며, 스캔 함수 자체가 순수(입력을 변형하지 않음)라 테스트 간 격리도 깨지지 않는다. 이는 diff 가 명시한 설계 의도("손으로 고른 목록 대신 전수 발견")이며, 직전 리뷰 라운드(`review/code/2026/08/30/12_41_15/SUMMARY.md` INFO #5)에서 이미 같은 결론(결함 아님)으로 처분된 항목과 동일하다. 결함이 아니라 관측 기록 목적으로만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 `.query<>()` 제네릭 타입 인자 변경은 런타임 부작용이 없는 순수 타입 정정
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — `refresh()` 메서드 내부 `this.dataSource.query<...>()` 호출 (36행)
  - 상세: `{ entity_count: number; relation_count: number }[]` → `[{ entity_count: number; relation_count: number }[], number]` 로 변경됐지만, TypeScript 제네릭 타입 인자는 컴파일 타임에만 존재하고 런타임 SQL·파라미터·반환값 처리 로직은 그대로다. `refresh(knowledgeBaseId: string): Promise<void>` 공개 시그니처도 변경되지 않았다. 호출부(`graph-extraction.service.ts:255`, `graph-query.service.ts:194,243`) 3곳 전부 반환값을 소비하지 않는 `await this.kbStats.refresh(kbId)` 형태임을 실측 확인했다 — 시그니처·인터페이스 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 export 함수 `countRawUpdateReturning`/`hasRawUpdateReturning` 은 순수 함수이며 소비 범위가 테스트 전용으로 한정됨
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (100~126행)
  - 상세: `grep -rln`으로 실측한 결과 이 두 함수는 `source-scan.spec.ts`·`update-returning-rows.spec.ts` 두 테스트 파일에서만 참조되며 프로덕션 코드 어디서도 import 되지 않는다. 전역 상태·파일 I/O·네트워크 접근이 없는 순수 문자열 처리 함수로, 공개 API(공개된 REST/이벤트 인터페이스) 노출이 아니다.
  - 제안: 조치 불요.

## 검증 절차

저장소 파일은 뮤테이션하지 않고 `Read`/`grep`/`git log`/`git status` 로만 검증했다. 확인한 것:
- `codebase/backend/src/common/__test-utils__/source-scan.ts` 실제 파일 내용이 diff 게이트 번호와 일치함을 직접 대조.
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 전체를 읽어 `discover()`/`listSources()` 가 읽기 전용임을 확인.
- `grep -rn "KbStatsHelper\|refresh("` 로 `kb-stats.helper.ts` 의 유일한 프로덕션 호출부 3곳이 반환값을 쓰지 않음을 확인.
- `find codebase/backend/src -iname "*raw-update-probe*"` 로 직전 라운드 RESOLUTION.md 가 언급한 뮤테이션 프로브 파일이 남아있지 않음을 확인 — `git status --short` 도 `review/code/2026/08/30/13_15_58/`(이번 리뷰 세션 자체의 신규 산출물) 외 잔여물 없음.
- `review/code/**`, `review/consistency/**` 하위 신규 파일 20건(SUMMARY.md, RESOLUTION.md, `_resolution_log.md`, `_resolution_state.json`, `_retry_state.json`, `meta.json`, 각 reviewer `.md` 등)은 이 프로젝트의 리뷰/일관성 검토 워크플로가 정해진 경로(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/...`)에 남기는 정상 산출물이며, 코드 실행 경로에 영향을 주는 부작용이 아니다.

## 요약

핵심 변경 3가지 — (1) `source-scan.ts` 에 순수 정적분석 함수 2개 신설, (2) `update-returning-rows.spec.ts` 에 저장소 자신의 소스 트리를 읽기 전용으로 재귀 스캔하는 신규 테스트 `describe` 신설, (3) `kb-stats.helper.ts` 의 `.query<>()` 제네릭 타입 인자를 실제 런타임 shape(`[rows, count]` 튜플)에 맞게 정정 — 모두 전역 상태 변경, 파일 쓰기/삭제, 공개 함수 시그니처 변경, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경 중 어느 것도 유발하지 않는다. 유일하게 주목할 지점은 신설 테스트가 매 실행 시 `src/**` 전수를 파일시스템에서 읽는다는 점인데, 이는 diff 가 스스로 명시한 설계 의도이자 읽기 전용·저장소 내부 한정이라 위험이 없고, 직전 리뷰 라운드에서 이미 동일하게 처분된 항목이다. `kb-stats.helper.ts` 의 타입 변경도 컴파일 타임에만 영향을 주며 3곳의 실제 호출부는 반환값을 쓰지 않음을 직접 확인했다. 저장소를 뮤테이션하지 않고 읽기 전용 검증만으로 결론에 도달했다.

## 위험도

LOW

# 아키텍처(Architecture) 코드 리뷰

## 대상

`origin/main...HEAD` diff 중 실제 `codebase/**` 변경 8개 파일(공용 유틸 신설 1쌍 + 두 서비스 모듈의
production 코드 변경 2건 + 관련 spec 4건). `plan/**`·`review/**` 하위 40여 개 파일은 이전 리뷰 라운드
(`14_01_46`~`18_19_33`)의 산출물/문서 갱신이며 실행 코드가 아니라 아키텍처 관점 검토 대상에서 제외했다.

## 발견사항

- **[INFO]** 자매-지점 회귀 가드 테스트가 하드코딩된 파일 목록으로 두 서비스 모듈의 내부 호출 지점 개수를 서로 결합시킨다
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:54-58` (`FILES` 배열)
  - 상세: `assert-row-array.spec.ts` 의 "자매 지점 전수" 테스트는 `execution-engine.service.ts` 와
    `executions.service.ts` 두 모듈의 소스를 `readFileSync` 로 직접 읽어 `.query(` 소비 호출 수와
    `assertRowArray(` 호출 수를 정적 정규식으로 세어 비교한다. 이는 `common/utils` 계층의 테스트가
    두 상위 도메인 모듈의 내부 구현(호출 지점 개수)을 알고 있어야 성립하는 구조로, 일반적인
    레이어 의존 방향(상위 모듈 → 공용 유틸)과 반대로 **공용 유틸의 테스트가 상위 모듈 내부를
    역참조**한다. 새 raw-SQL 소비 지점이 두 파일 중 하나에 추가되면 이 테스트가 실측 고정값과
    어긋나 RED 로 알려주는 것이 설계 의도이므로 안전장치 자체는 유효하지만, `FILES` 를 사람이
    수동으로 갱신해야 하는 결합이라는 점은 구조적으로 남는다. 이미 테스트 docstring 이 이 한계
    (정규식 사각지대·2파일 한정 스코프)를 명시하고 있고 `integration-oauth.service.ts` 등 나머지
    raw-query 소비 지점 전역 감사는 별도 백로그로 이연되어 있어(`review/code/2026/08/13/18_19_33/RESOLUTION.md`
    §후속), 이번 PR 범위에서 새로 만든 결함은 아니다.
  - 제안: 조치 불요(이미 인지·문서화된 트레이드오프). 후속으로 raw-query 소비 지점 전역 감사가
    이루어질 때 이 `FILES` 결합을 AST 기반 전역 스캔으로 대체하는 것을 함께 고려할 수 있다.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대는 테스트 접근만을 목적으로 모듈의 캡슐화 경계를 넓힌다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:64`
  - 상세: `const` → `export const` 전환으로 이 상수는 이제 모듈 외부에서 import 가능하다. 값(256)과
    구현(LRU 캐시 크기)은 그대로이며, 소비처는 정의부·모듈 내부(`readSnapshotCache`/`writeSnapshotCache`)·
    신규 테스트뿐임을 확인했다(`grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src`). 같은 파일에
    이미 동일 목적으로 export 된 `MAX_EXECUTION_PATH_ROWS` 패턴과 일관되므로 이번 PR 이 새 컨벤션을
    도입한 것은 아니지만, "테스트가 내부 구현 상수를 알아야 한다"는 이유로 모듈의 공개 표면이 점진적으로
    넓어지는 방향성 자체는 향후 다른 모듈이 이 상수를 import 해 캐시 구현 세부사항에 결합할 소지를
    남긴다.
  - 제안: 현재로선 조치 불요. 향후 이 상수를 소비하는 외부 모듈이 실제로 생기면 그때 캐시 구현
    세부사항 의존을 재검토.

## 확인된 양호 사항

- **`assertRowArray` 추출은 SRP·OCP 를 모두 만족하는 적절한 추상화**다. `common/utils/assert-row-array.ts`
  는 "배열 여부를 런타임으로 확정한다"는 단일 책임만 갖고, TypeScript 사용자 정의 타입 가드
  (`asserts rows is unknown[]`)로 이후 `.length`/`[0]` 접근을 타입 안전하게 좁힌다. **메시지(왜 이 지점이
  위험한가)는 의도적으로 호출부 책임으로 남겨져** 있어(`execution-engine.service.ts:2937`,
  `:8206`, `:8523`, `executions.service.ts:325`), 유틸리티가 도메인 맥락을 알 필요가 없다 — 확장 시
  (새 raw-SQL 소비 지점 추가) 유틸리티 자체를 수정하지 않고 호출만 추가하면 되므로 개방-폐쇄 원칙에
  부합한다. `common/utils/` 디렉토리의 기존 컨벤션(`with-timeout.ts`, `uuid.ts`, `crypto.util.ts` 등,
  각각 단일 목적 함수 + 동반 spec)과도 일관돼 새로운 구조를 도입하지 않았다.
- **의존 방향이 안전하다.** `assert-row-array.ts` 는 외부 import 가 전혀 없는 leaf 유틸리티이고,
  `execution-engine.service.ts:202` / `executions.service.ts:22` 가 이를 하향 참조하는 구조라 순환
  의존 위험이 없다. 두 서비스 모듈은 이 유틸을 통해서만 간접적으로 "형제"가 될 뿐, 서로를 직접
  참조하지 않는다.
- **레이어 경계 유지.** 신규 `throw`(4곳)는 모두 서비스 레이어 내부에서 발생하고, 트랜잭션 콜백
  안(`admitExecutionOrDefer` `execution-engine.service.ts:2937`, `lockNonTerminalExecutionRow`
  `:8206`)에서는 롤백을 유도해 데이터 레이어 일관성을 지키며, 트랜잭션 밖(`updateExecutionStatus`
  `:8523`)에서는 판정을 바꾸지 않고 진단만 강화한다. 예외는 기존 `GlobalExceptionFilter` 로만 수렴돼
  프레젠테이션 레이어로 내부 구현 디테일이 새지 않는다 — 새 레이어 위반은 없다.
  검증: `grep -n "assertRowArray\|admitExecutionOrDefer\|let admission:" codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  로 4개 호출 지점(202, 2937, 8206, 8523)과 `runExecutionFromQueue`(3679-3685)의 try/catch 를 직접 확인.
- **`runExecutionFromQueue` 의 try/catch(`execution-engine.service.ts:3679-3685`)는 기존 `deferred` 분기의
  `releaseExecutionRouting` 처리와 대칭을 이뤄, 리소스(라우팅 컨텍스트) 해제 책임이 모든 종료 경로에
  일관되게 분산되도록 고쳤다** — 특정 예외 경로만 해제를 빠뜨리던 비대칭이 해소됐고, 이는 새로운
  추상화 계층을 추가하지 않고도 기존 구조 안에서 불변식을 복원한 최소 개입이다.
- 이번 diff 전체가 이전 라운드(`17_15_21` maintainability WARNING 1: 가드 4곳 boilerplate 중복)가
  지적한 "helper 추출만으로는 호출 누락을 못 막는다"는 문제를 유틸리티 추출 + 구조적 회귀 테스트
  두 가지로 함께 해소한 점은, 단순 리팩터링이 아니라 아키텍처적으로 "재발 방지 메커니즘"까지
  갖춘 설계로 평가한다.

## 요약

핵심 변경은 raw SQL(`EntityManager.query()`) 반환 타입이 `Promise<any>` 라는 안전하지 않은 경계에
런타임 타입 가드(`assertRowArray`)를 도입한 것이다. 이 유틸리티는 단일 책임·개방-폐쇄 원칙을 만족하는
적절한 추상화 레벨로 설계돼 있고(검증은 공용, 메시지는 호출부 소유), 기존 `common/utils/` 컨벤션과
일관되며, 의존 방향이 안전해 순환 참조가 없다. 두 도메인 서비스(execution-engine, executions)가 이
유틸을 통해 간접적으로만 연결되므로 결합도도 낮게 유지된다. `runExecutionFromQueue` 의 try/catch
추가는 기존 리소스 해제 불변식을 모든 종료 경로에 대칭적으로 복원해 구조적 일관성을 높였다. 유일하게
남는 관찰은 (1) 회귀 가드 테스트가 두 모듈의 호출 지점 개수를 하드코딩된 파일 목록으로 결합시키는
정적 검사라는 점과 (2) 캐시 상한 상수의 export 가 테스트 접근만을 위해 캡슐화를 소폭 넓혔다는 점인데,
둘 다 이미 문서화·인지된 트레이드오프이고 이번 PR 이 새로 만든 구조적 결함은 아니다. 레이어 책임
분리, 디자인 패턴 적용, 확장성(새 raw-query 지점 추가 시 유틸 수정 없이 호출만 추가) 모두 양호하다.

## 위험도

NONE

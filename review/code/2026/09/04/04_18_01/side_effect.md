# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `stripComments` 가 모듈-비공개에서 공개 export 로 승격됨 (인터페이스 확장)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53`
  - 상세: `function stripComments` → `export function stripComments`. 새 가드
    (`nullable-type-lie-cast-guard.ts`) 가 `stripLiterals` 와 함께 재사용하기 위한 의도적
    확장이고, `source-scan.ts` 는 애초에 "테스트 전용 순수 함수만 두는" 계약이라 외부
    런타임에 영향을 주는 공개 API 는 아니다. 기존 호출자에 대한 파괴적 변경은 없음(신규
    export 추가일 뿐, 기존 시그니처·동작 불변). 위험은 낮지만 "공개 표면이 늘었다" 는 사실
    자체는 인터페이스 변경 관점에서 기록해 둔다.
  - 제안: 조치 불필요. 참고로만 남김.

- **[INFO]** 5개 walker 통합(`collectTsFiles`)으로 두 가드(`engine-error-code-anchor-guard`,
  `masked-reject-callers-guard`)의 파일 목록 반환 **순서**가 DFS 순서에서 정렬 순서로 바뀜
  — 관측 가능한 부수효과이나 회귀 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:157`
    (`walkTsFiles` → `collectTsFiles`, 원래 미정렬), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48-51`
    (`listSourceFiles` → `collectTsFiles`, 원래 미정렬)
  - 상세: `collectTsFiles` 는 `walk(root); return out.sort();` 로 **항상 정렬**한다
    (`codebase/backend/src/common/__test-utils__/source-scan.ts:249-267`). 통합 전 5개 사본 중
    2개(`audit-action-binding-guard`, `redis-fail-open-catalog-guard`)만 `sort()` 를 갖고
    있었고, 나머지 2개(`engine-error-code-anchor-guard`, `masked-reject-callers-guard`)는
    DFS 삽입 순서를 그대로 반환했다. 이번 diff 로 두 가드가 순회하는 대상 **집합**은
    불변이지만(plan 문서에 507/818/1261/818/818 실측 대조 기록됨), **순회 순서**가
    바뀐다 — 이는 가드가 위반을 보고할 때 나열하는 파일·offender 순서에 영향을 줄 수 있다.
    두 spec 파일을 grep 한 결과 순서에 의존하는 단언(`toEqual` 배열 순서 등)은 없어
    현재는 테스트 회귀를 일으키지 않는다. `source-scan.ts` docstring 도 이 변경을 "가드
    메시지가 결정적이어야 한다" 는 의도된 개선으로 명시하고 있어 실수가 아니라 설계 결정이다.
  - 제안: 조치 불필요 — 리뷰 기록 목적. 향후 이 두 가드의 실패 메시지를 스냅샷 비교하는
    테스트가 추가되면 이 순서 변경을 인지하고 있어야 한다.

- **[INFO]** `.d.ts` 필터가 `masked-reject-callers-guard` 스캔 범위에 새로 추가됨 — 현재는
  무영향(실측 0건), 4개 가드가 공유 함수로 묶이며 향후 동시 영향(blast radius) 가능성
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48-51`
  - 상세: 원래 `listSourceFiles` 는 `entry.name.endsWith('.ts')` 만 걸러 `.d.ts` 도 포함했다
    (`.d.ts` 는 문자열상 `.ts` 로 끝남). 통합된 `collectTsFiles` 는 `!entry.name.endsWith('.d.ts')` 를
    **항상** 적용해 `.d.ts` 를 제외한다. `find codebase/backend/src -name "*.d.ts" | wc -l` 실측
    결과 0건이라 지금은 동작 차이가 없다. 다만 이 변경으로 4개 가드
    (`audit-action-binding-guard`·`engine-error-code-anchor-guard`·`masked-reject-callers-guard`·
    `redis-fail-open-catalog-guard`)가 하나의 공유 필터 정책을 갖게 됐으므로, 향후 `src/` 에
    `.d.ts` 파일이 생기면 이 4곳 전부가 동시에 스캔 범위에서 그 파일을 제외한다(masked-reject
    쪽은 이전에 스캔하던 파일을 더는 안 보게 되는 방향 = 위음성 방향). `source-scan.ts` 의
    `collectTsFiles` docstring 과 plan 문서(`entity-nullable-column-type-mismatch.md`)가 이미
    이 트레이드오프를 실측·근거와 함께 명시적으로 기록했으므로 의도된 설계로 보인다.
  - 제안: 조치 불필요. 이미 문서화된 결정이라 재론하지 않되, 부작용 관점에서 "4개 가드가
    이제 단일 함수를 공유하므로 그 함수의 결함이 동시에 4곳에 전파된다"는 blast-radius 특성만
    환기해 둔다.

## 전역 상태 · 정규식 lastIndex 확인 (문제 없음)

`WIDENED_DECL`·`SPEC_CAST` 는 `g` 플래그를 가진 모듈 스코프 `const` 정규식이고
`findStaleSpecCasts`/`widenedEntityFields` 에서 `matchAll` 로 반복 사용된다
(`codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`). `String.prototype.matchAll`
은 스펙상 내부적으로 정규식을 복제해 순회하므로 `regex.lastIndex` 공유로 인한 고전적
버그(호출 간 상태 누수)는 발생하지 않는다 — 확인 결과 정상이라 별도 발견사항으로 올리지
않음.

## 파일시스템 부작용 확인 (문제 없음)

이번 diff 가 추가한 모든 신규 테스트 픽스처(`source-scan.spec.ts` 의 `collectTsFiles`/`stripLiterals`
describe 블록, `nullable-type-lie-cast.spec.ts` 의 `withFiles`/`withFixture`, `masked-reject-callers.spec.ts`
의 스캔-범위 테스트)는 `os.tmpdir()` 에 `mkdtempSync` 로 격리 디렉터리를 만들고 `try/finally`
로 `rmSync(..., { recursive: true, force: true })` 정리한다. 저장소 트리 안의 파일을 쓰거나
지우는 경로는 없다 — `nullable-type-lie-cast.spec.ts` 상단 주석 자체가 "예전엔 실제
`users.service.ts`/`user.entity.ts` 를 변형했다가 복원 실패 위험이 있었다" 는 과거 실수를
명시하며 tmpdir 방식으로 교체한 이력을 남기고 있다. `describe('저장소 전수', ...)` 류
테스트는 실제 `src/` 트리를 **읽기만** 한다(엔티티·`.spec.ts` 전수 스캔) — 기존
`repo-guards` 컨벤션과 동일한 패턴이라 새로운 부작용이 아니다.

## 시그니처·환경변수·네트워크·이벤트 확인 (해당 없음)

- 기존 공개 함수(`collectScanTargets`, `findCastOffenders`, `findUntypedNullableColumns`,
  `countNullAsUnknownAsCasts` 등)의 시그니처는 변경되지 않았다. 신규 함수
  (`collectTsFiles`, `stripLiterals`, `widenedEntityFields`, `findStaleSpecCasts`)는 전부
  additive export 라 기존 호출자에 영향이 없다.
- 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트 발행/콜백 등록·해제는 이번 diff 범위(테스트
  인프라 리팩터링 + guard 신설 + plan 문서)에서 발견되지 않았다.
- `review/code/2026/09/04/**` 하위 다수 파일과 `plan/in-progress/entity-nullable-column-type-mismatch.md`
  는 이 저장소 관례상 정식 산출물 경로(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`,
  `plan/in-progress/`)이며 예상치 못한 파일시스템 부작용이 아니다.

## 요약

이번 changeset 은 `repo-guards/__tests__/` 안에 흩어져 있던 5개의 디렉터리 재귀 walker 를
`source-scan.ts` 의 `collectTsFiles` 로, 문자열/템플릿 리터럴 스트리핑을 `stripLiterals` 로
공유하고, 그 위에 넓혀진(nullable) 엔티티 필드를 겨눈 낡은 spec 캐스트를 잡는 새 가드
(`widenedEntityFields`/`findStaleSpecCasts`)를 추가하는 순수 테스트-인프라 리팩터링이다.
전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경은 없고, 모든 신규 테스트 픽스처는
`os.tmpdir()` 격리 + `try/finally` 정리로 저장소 트리를 건드리지 않는다. 공개 시그니처
파괴적 변경도 없다(신규 함수는 전부 additive). 유일하게 부작용 관점에서 기록할 만한 것은
walker 통합으로 인한 **결과 순서 변화**(2개 가드, 정렬 안 되던 것이 정렬됨)와 **`.d.ts`
필터 신규 적용**(masked-reject-callers-guard, 현재 0건이라 무영향)인데, 둘 다 실측·근거와
함께 코드/plan 문서에 명시적으로 남겨진 의도된 설계 변경이고 테스트 회귀도 확인되지
않았다.

## 위험도

LOW

# 성능(Performance) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드

## 검증 방법

정적 판독에 더해 실측했다(저장소 트리에는 아무것도 쓰지 않음 — 별도 `node -e` 스크립트로
`collectTsFiles`/`widenedEntityFields`/`findStaleSpecCasts` 와 동일한 로직을 재구현해
실제 `codebase/backend/src` 트리에 대해 타이밍만 측정. 리뷰 종료 후 `git status --short`
확인 결과 저장소 변경 없음).

- `find codebase/backend/src -name "*.ts"` → 1261, 비-spec 818, `.entity.ts` 41, `*.spec.ts` 443
- `collectTsFiles` 1회 호출(재귀 `readdirSync`) 타이밍: 비-spec ≈5~7ms, `includeSpec:true` ≈4ms
- `widenedEntityFields`(41개 엔티티 파일 읽기+정규식) 1회 호출 ≈1~2ms
- `findStaleSpecCasts` 류(443개 spec 파일 읽기 + `stripComments`+`stripLiterals` 5회
  regex pass + `matchAll`) 전체 ≈100ms — 디스크 read 가 지배적, 문제 없음

## 발견사항

- **[INFO]** 같은 spec 파일 안에서 `src/` 전체 재귀 디렉터리 스캔(`collectTsFiles`)이
  최소 3회(그중 2회는 인자까지 동일한 완전 중복) 수행된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:394-399`
    (신규 `describe('저장소 전수', ...)` 블록의 `entities`/`specs` 계산). 같은 파일
    81번째 줄의 기존 `const files = collectScanTargets();`(→ 내부적으로
    `collectTsFiles(SRC_ROOT)`, 인자 기본값)와 완전히 동일한 호출이 한 번 더 있다.
  - 상세: `describe('저장소 전수', ...)` 블록은
    ```ts
    const entities = collectTsFiles(SRC_ROOT).filter((f) => f.endsWith('.entity.ts'));
    const specs = collectTsFiles(SRC_ROOT, { includeSpec: true }).filter((f) => f.endsWith('.spec.ts'));
    ```
    로 `src/` 트리를 두 번 더 재귀 스캔한다. 첫 번째 호출(`collectTsFiles(SRC_ROOT)`,
    기본 `includeSpec: false`)은 81번째 줄의 `collectScanTargets()` 가 이미 반환하는
    값(비-spec 818개)과 **인자·반환값이 완전히 동일**하다 — `files.filter(f =>
    f.endsWith('.entity.ts'))` 로 대체하면 이 두 번째 스캔 자체가 불필요하다. 두 번째
    호출(`includeSpec: true`, 1261개)도 첫 번째 호출의 상위 집합이라, `includeSpec:
    true` 한 번만 스캔한 뒤 `.entity.ts`/`.spec.ts`/비-spec 세 뷰를 로컬 `.filter()`
    로 파생하면 전체를 1회 스캔으로 줄일 수 있다. 두 `describe` 블록 모두 Jest
    collection phase(모든 `it` 실행 전, 파일 로드 시 동기 실행)에서 무조건 실행되므로
    `-t` 로 개별 테스트만 골라 돌려도 이 3회 스캔은 항상 발생한다.
    실측: 이 트리에서 스캔 1회 ≈5~7ms, 3회 합산 ≈16ms(순수 스캔만, 디스크 캐시 온
    상태). 절대 비용은 작지만, `collectTsFiles`(`source-scan.ts`)를 도입한 목적 자체가
    "walker 사본이 흩어져 같은 일을 반복하지 않게" 하는 것이었는데, 그 소비 측인 이
    spec 파일 안에서 같은 클래스의 중복이 그대로 재현됐다.
  - 제안: `describe('저장소 전수', ...)` 상단(또는 파일 최상단)에서
    `const all = collectTsFiles(SRC_ROOT, { includeSpec: true });` 한 번만 스캔하고,
    `entities = all.filter(f => f.endsWith('.entity.ts'))`,
    `specs = all.filter(f => f.endsWith('.spec.ts'))`,
    `files (81번째 줄의 collectScanTargets 대체) = all.filter(f => !f.endsWith('.spec.ts'))`
    로 파생하면 스캔 횟수를 3회 → 1회로 줄일 수 있다(동작 불변, 순수 리팩터).

- **[INFO]** `widenedEntityFields(entities)` 가 같은 `describe` 블록 안에서 두 번 호출돼
  41개 엔티티 파일을 두 번 읽고 정규식을 두 번 돌린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:407-408`
    (`it('[전제] 넓혀진 필드가 실제로 있다', ...)` 안의 `widenedEntityFields(entities).size`)와
    같은 파일 `:411-414`(`it('낡은 캐스트가 남아 있지 않다', ...)` 안의
    `widenedEntityFields(entities)`)
  - 상세: 두 `it` 모두 동일한 `entities` 배열에 대해 `widenedEntityFields` 를 각각
    호출한다 — 함수는 순수(같은 입력에 같은 출력)이므로 두 번째 호출은 이전 결과를
    재사용해도 무방하다. 실측상 41개 파일 기준 1회 ≈1~2ms 로 절대 비용은 작지만,
    바로 위 발견사항과 같은 클래스(같은 순수 계산의 재사용 없는 반복)라 함께 기록한다.
  - 제안: `describe` 블록 상단에서 `const widened = widenedEntityFields(entities);`
    로 한 번만 계산해 두 `it` 이 공유하도록 옮긴다(각 `it` 이 독립적으로 실패 메시지를
    내야 한다는 요구가 없다면 부작용 없는 리팩터).

- **[정보성 확인, 결함 아님]** `WIDENED_DECL`/`stripLiterals` 정규식의 이론적
  backtracking 특성은 이미 앞 라운드 security 리뷰(`02_35_22`, `02_57_22`)가 다뤘고
  본 리뷰도 별도로 형태를 확인했다 — prefix-disjoint 구조라 지수적 폭발 조건이
  성립하지 않고, 입력이 전부 저장소 자신의 신뢰된 `.ts` 소스(빌드/테스트 타임 전용,
  외부 입력 경로 없음)라 실질적 성능 리스크가 없다. 중복 보고하지 않는다.

- **[정보성 확인, 결함 아님]** `findStaleSpecCasts`(443개 spec 파일 대상)가 파일당
  `stripComments`(regex 2회) → `stripLiterals`(regex 3회) → `matchAll`(regex 1회) 로
  총 6회의 정규식 패스를 순차 수행하지만, 각 패스가 O(파일 크기)이고 중첩·지수적
  요소가 없어 전체는 O(총 소스 크기) 선형이다. 실측 전체 ≈100ms(디스크 read 지배) —
  CI 유닛 스위트(수천 개 테스트, 수 분) 규모에서 무시할 수 있는 수준이라 조치 불필요.

## 요약

이번 diff 의 핵심(`repo-guards/__tests__/` 5개 walker 사본을 `collectTsFiles` 하나로
통합 + `widenedEntityFields`/`findStaleSpecCasts` 신규 가드 추가)은 알고리즘적으로
전부 선형(O(파일 수 × 평균 파일 크기))이고, 반복문 안에 DB/네트워크 호출이나 블로킹
비동기 I/O 병목이 없으며, 정규식은 이미 다른 라운드에서 ReDoS 관점으로 검증됐다(재확인
결과 동의). 유일하게 발견한 것은 신규 `describe('저장소 전수', ...)` 블록이 같은 파일 안의
기존 `collectScanTargets()` 호출과 사실상 동일한 `collectTsFiles(SRC_ROOT)` 전체 재귀
스캔을 다시 수행하고(총 3회 스캔, 그중 2회 완전 중복), `widenedEntityFields(entities)` 도
두 `it` 에서 각각 재계산되는 것이다 — 둘 다 순수 함수의 결과를 캐시 없이 반복 호출하는
전형적 패턴이다. 실측 절대 비용은 스캔 3회 합산 ≈16ms, 이중 계산 ≈1~2ms 로 CI 스위트
전체 규모에 비해 미미하지만, `collectTsFiles` 를 만든 목적이 정확히 "같은 일을 여러 곳에서
반복하지 않는 것"이었던 만큼 그 소비 측 코드에서 같은 패턴이 재발한 점은 기록해 둔다.
둘 다 동작을 바꾸지 않는 순수 리팩터(스캔 1회로 통합 + 결과 변수 공유)로 해소 가능하며,
필수 수정 사항은 아니다.

## 위험도

LOW

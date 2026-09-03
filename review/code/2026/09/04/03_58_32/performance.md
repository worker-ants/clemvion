# 성능(Performance) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드 (7R)

## 검증 방법

`Read`/`Grep` 로 실제 소스(`source-scan.ts`, `nullable-type-lie-cast-guard.ts`,
`nullable-type-lie-cast.spec.ts`, `source-scan.spec.ts`)를 직접 열어 대조했다. 저장소 트리에는
아무것도 쓰지 않았다(뮤테이션 없음, `git status --short` 확인 불필요 — 편집 자체를 하지 않음).

이 리뷰는 이미 6라운드를 거친 diff 의 재확인이다. 이전 라운드(`03_17_44` performance INFO#10·
INFO#11)가 지적한 "저장소 전수 블록의 중복 스캔"이 `03_37_37`(6R) RESOLUTION 에서 "이번 라운드는
개수/문서 서술만 조치하고 테스트 구조는 안 건드린다"로 명시적으로 유예됐으므로, 그 지적이 현재
코드에도 그대로 남아 있는지를 실제 파일에서 라인 단위로 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** (재확인, 미해소) 같은 spec 파일 안에서 `src/` 전체 재귀 스캔(`collectTsFiles`)이 여전히 3회 수행되고, 그중 2회는 인자까지 완전히 동일한 중복이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:81`
    (`const files = collectScanTargets();` → 내부적으로 `collectTsFiles(SRC_ROOT)`, 기본
    옵션) 그리고 같은 파일 `:396`(`const entities = collectTsFiles(SRC_ROOT).filter(...)`,
    81번째 줄과 인자·반환값이 완전히 동일) 및 `:399`(`const specs = collectTsFiles(SRC_ROOT,
    { includeSpec: true }).filter(...)`, 앞 두 호출의 상위집합)
  - 상세: `grep -n` 으로 세 호출 지점을 직접 대조했고 03_17_44 라운드가 지적한 그대로다.
    81번째 줄의 결과(`files`, 비-spec 818개)와 396번째 줄의 결과(`collectTsFiles(SRC_ROOT)`,
    옵션 기본값)는 **입력·출력이 완전히 동일한데 각각 독립적으로 디렉터리 트리를 재귀
    스캔**한다. 399번째 줄(`includeSpec: true`, 1261개)도 앞 두 결과의 상위집합이라 한 번의
    `includeSpec: true` 스캔 뒤 `.filter()` 세 갈래로 파생 가능하다. 세 계산 모두 `describe`
    콜백 본문(Jest collection phase, 모든 `it` 실행 전에 파일 로드 시 동기 실행)에 있어 `-t`
    로 개별 테스트만 골라 돌려도 항상 3회 스캔이 발생한다. 절대 비용은 작다(이전 라운드
    실측 스캔 1회 ≈5~7ms, 3회 합산 ≈16ms) — CRITICAL/WARNING 급은 아니다. `collectTsFiles`
    를 만든 목적 자체가 "walker 사본이 흩어져 같은 일을 반복하지 않게" 하는 것이었는데, 그
    소비 측(이 spec 파일)에서 같은 클래스의 중복이 재현된 상태가 6라운드째 그대로다.
  - 제안: `describe('저장소 전수', ...)` 상단에서 `const all = collectTsFiles(SRC_ROOT, {
    includeSpec: true });` 한 번만 스캔하고 `entities`/`specs`/(81번째 줄의) `files` 를 전부
    `all.filter(...)` 로 파생하면 3회 → 1회로 줄어든다. 동작 불변의 순수 리팩터.

- **[INFO]** (재확인, 미해소) `widenedEntityFields(entities)` 가 동일 입력에 대해 같은 `describe` 블록 안에서 두 번 호출돼 41개 엔티티 파일을 두 번 읽고 정규식을 두 번 돌린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:409`
    (`it('[전제] 넓혀진 필드가 실제로 있다', ...)` 안의 `widenedEntityFields(entities).size`)와
    같은 파일 `:415`(`it('낡은 캐스트가 남아 있지 않다', ...)` 안의
    `widenedEntityFields(entities)`)
  - 상세: `entities`(396번째 줄)는 두 `it` 사이에서 불변인데 순수 함수 `widenedEntityFields`
    를 재계산 없이 캐시하지 않는다. 절대 비용은 작다(이전 라운드 실측 41개 파일 기준 1회
    ≈1~2ms). 03_17_44 INFO#11 과 동일 지점 — 6R RESOLUTION 이 "테스트 구조를 바꾸면 또 한
    라운드가 돈다"며 의도적으로 유예했고, 그 유예가 이번 라운드까지 유지되고 있음을 확인.
  - 제안: `describe` 블록 상단에서 `const widened = widenedEntityFields(entities);` 로 한 번만
    계산해 두 `it` 이 공유하도록 옮긴다.

- **[INFO]** (신규 관찰, 같은 클래스) `findCastOffenders`/`findUntypedNullableColumns` 가 동일한 818개 파일 배열(`files`)의 내용을 각자 독립적으로 `fs.readFileSync` 한다 — 파일 내용이 두 함수 사이에 공유되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:92`
    (`findCastOffenders(files)`) 와 `:104`(`findUntypedNullableColumns(files)`), 구현은
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:43-52`
    (`findCastOffenders` — 파일마다 `fs.readFileSync`)와 `:104-121`
    (`findUntypedNullableColumns` — 파일마다 별도로 `fs.readFileSync`)
  - 상세: `files` 배열(디렉터리 스캔 결과)은 한 번만 계산돼 두 호출에 공유되지만(위 두 항목과
    달리 스캔 자체는 중복이 아님), **각 함수가 같은 818개 파일의 내용을 처음부터 다시
    디스크에서 읽는다** — 판정 축(캐스트 패턴 vs `@Column` 선언 패턴)이 다르다는 이유로
    설계상 분리된 것이라 결함은 아니지만, 두 술어 모두 파일 내용 문자열만 있으면 되므로
    "파일 목록 → 내용 맵 1회 로드 → 두 함수에 전달" 구조였다면 디스크 read 횟수를
    818×2 → 818×1 로 줄일 수 있었다. 이전 라운드 실측치(443개 spec 파일 다중 regex pass
    ≈100ms, 디스크 read 지배)를 참고하면 818개 파일 1회 추가 read 도 CI 유닛 스위트
    전체(수천 테스트, 수 분) 규모에서는 무시 가능한 수준이라 판단한다.
  - 제안: 조치 불필요 수준. 다음에 이 파일들을 만질 기회가 있으면 `files.map(f => [f,
    fs.readFileSync(f, 'utf8')])` 형태의 공유 콘텐츠 맵으로 두 함수를 리팩터하는 것을
    고려할 만하지만, 현재 분리된 설계(관심사 분리)를 깨는 트레이드오프라 강제하지 않는다.

- **[정보성 확인, 결함 아님]** `WIDENED_DECL`/`stripLiterals` 정규식의 backtracking 특성, `findStaleSpecCasts` 의 파일당 6회 regex pass 는 이전 라운드(security `02_35_22`/`02_57_22`, performance `03_17_44`)가 이미 검증했다 — prefix-disjoint 구조라 지수적 폭발 조건이 없고, 입력이 전부 저장소 자신의 신뢰된 소규모 `.ts` 소스(빌드/테스트 전용, 외부 입력 경로 없음)이며 총 비용이 O(총 소스 크기) 선형이다. 직접 코드를 재대조했고 동의한다 — 중복 보고하지 않는다.
- **[정보성 확인, 결함 아님]** 알고리즘 복잡도 전반: `collectTsFiles`(재귀 디렉터리 walk), `countNullAsUnknownAsCasts`/`countRawUpdateReturning`/`widenedEntityFields`/`findStaleSpecCasts`(파일당 선형 regex pass) 모두 O(파일 수 × 평균 파일 크기)로 선형이다. 반복문 안에 DB·네트워크 호출은 전혀 없다(순수 파일시스템 스캔·정규식 매칭). N+1 쿼리/API 호출 패턴 자체가 해당 없음 — 이 diff 는 서비스 런타임 코드가 아니라 build/test-time 정적 가드다.
- **[정보성 확인, 결함 아님]** 5개 walker 사본 통합(`collectTsFiles`)은 이전 walker 각각이 자기 루트에서 독립적으로 스캔하던 것과 스캔 횟수 면에서 동일하다(사본을 없앤 것은 **로직 중복**이지 **실행 시점 스캔 횟수**의 중복이 아니었다) — 이번 리팩터가 새로운 성능 회귀를 만들지 않았음을 확인.

## 요약

이 diff(5개 `repo-guards/__tests__/` walker 사본을 `collectTsFiles` 하나로 통합 + 신규
`widenedEntityFields`/`findStaleSpecCasts` 가드)는 전부 build/test-time 전용 정적 분석 코드로,
알고리즘적으로 선형이고 DB·네트워크 호출·블로킹 비동기 병목이 없으며 정규식의 이론적
backtracking 위험도 신뢰된 소규모 입력에 한정돼 실질 위험이 없다. 유일하게 남은 지점은
`nullable-type-lie-cast.spec.ts` 의 `describe('저장소 전수', ...)` 블록이 같은 파일 안에서
`collectTsFiles(SRC_ROOT)` 전체 재귀 스캔을 3회(그중 2회는 인자까지 완전 동일한 중복) 수행하고,
`widenedEntityFields(entities)` 도 동일 입력에 대해 두 `it` 에서 각각 재계산한다는 것이다 — 이는
6라운드 전(03_17_44)부터 INFO 로 지적되고 "테스트 구조 변경은 또 한 라운드를 부른다"는 이유로
의도적으로 유예된 항목이며, 현재 코드에서도 그대로 남아 있음을 직접 확인했다. 실측 절대 비용은
스캔 3회 합산 ≈16ms, 중복 계산 ≈1~2ms 로 CI 유닛 스위트 전체 규모(9,280개 테스트) 대비
무시 가능한 수준이라 위험도를 올릴 근거는 아니다. 추가로 `findCastOffenders`/
`findUntypedNullableColumns` 가 같은 818개 파일의 내용을 서로 공유하지 않고 각자 다시 읽는
지점을 신규로 관찰했는데, 이 역시 같은 성격(순수 함수 결과의 캐시 없는 반복)이며 절대 비용이
작아 별도 조치를 강제할 근거는 없다. 세 항목 모두 동작을 바꾸지 않는 순수 캐싱/통합 리팩터로
해소 가능하지만 필수 수정 사항은 아니다.

## 위험도

LOW

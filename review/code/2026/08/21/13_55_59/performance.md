# 성능(Performance) Review — masked-marker-contract-7d2e14

## 검토 범위

`@workflow/masked-markers` 공유 패키지 추출(값·로직 무변경 순수 리팩터) + 등록 표면 8곳(Dockerfile
COPY·package.json·`test-stages.sh`·`packages-checks.yml`) + 미러 소멸 회귀 가드
(`masked-marker-mirror-guard.ts`/spec, backend·frontend 양쪽, 7라운드 누적 수정 반영 최종 상태) +
소비처 재export 전환(`sanitize-error-message.ts`, `lib/utils/masked-markers.ts`). 나머지 diff
(plan/review 산출물·spec frontmatter)는 런타임/CI 성능과 무관해 제외했다.

이전 라운드(`11_53_49`)의 `performance.md`가 이미 "backend·frontend 양쪽에서 저장소 3개 소스 트리
전체를 동기 순회하는 신규 캐너리"와 "루프 불변 값 재계산"을 INFO로 지적했다. 후자는 이후 라운드
(`13_14_29` W2)에서 실제로 고쳐졌음을 현재 코드(`findMirrorRedeclarations` 내 `sotPrefix` 사전 계산,
`masked-marker-mirror-guard.ts:144`)로 직접 확인했다. 이번 라운드는 **그 두 건을 재등재하지 않고**,
그 이후 라운드들(`12_25_15`~`13_34_34`)에서 `resolveScanDirs`가 1단계→2단계 스캔으로 확장되는 등
스캔 로직 자체가 바뀌었으므로 최종 상태를 다시 실측했다.

## 발견사항

- **[INFO]** 미러 소멸 가드 spec 파일 하나 안에서 저장소 전체 소스 트리에 대한 재귀 `fs` 순회가 `it` 블록마다 독립적으로 반복된다 — 메모이제이션 없이 최대 2회 전체 재귀 walk + 3회 `resolveScanDirs` 호출
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:43,51-55,84` (세 개 `it` 블록) / `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:52,60-64,96` (동일 구조) — 순수 로직은 `masked-marker-mirror-guard.ts`의 `resolveScanDirs`(양쪽 파일 공통 함수명, backend `:52`, frontend `:44`)와 `listSourceFiles`(backend `:79`, frontend `:73`)
  - 상세: 첫 `it`(`SoT 패키지 밖에서 마커 심볼을 재선언하지 않는다`)가 `findMirrorRedeclarations(repoRoot)`를 호출해 `resolveScanDirs` → 각 스캔 디렉터리에 대해 `listSourceFiles`(재귀 `readdirSync`) → 매칭 파일마다 `readFileSync` 전문 읽기를 1회 수행한다. 바로 다음 `it`(`[캐너리] 스캔 대상 파일 목록이 비어 있지 않다`)는 같은 `resolveScanDirs`를 **다시** 호출하고, 반환된 각 디렉터리에 대해 `listSourceFiles`를 **또** 호출해(파일 내용은 읽지 않지만 재귀 `readdirSync` 트리 순회는 동일하게 전부 재수행) 개수만 센다(`counts.reduce(...) > 500` 하한 단언). 세 번째 `it`(`[캐너리] 워크스페이스 패키지의 src 도 스캔 대상이다`)가 `resolveScanDirs`를 **세 번째로** 호출한다. 즉 같은 파일 안에서 "저장소 전체 소스 트리 디렉터리 나열"이 3번, 그중 "파일 내용까지 읽는 전체 스캔"이 사실상 2번(첫 `it`의 `findMirrorRedeclarations` 내부 1회 + 두 번째 `it`의 `listSourceFiles` 카운팅 1회, 후자는 read는 안 하지만 동일한 재귀 디렉터리 순회 비용을 그대로 다시 낸다) 발생한다. `resolveScanDirs` 자체는 `codebase/`와 `codebase/packages/` 아래 최상위 디렉터리만 훑어(수십 개) 비용이 낮지만, `listSourceFiles`는 그렇게 얻은 각 `src` 트리를 **재귀적으로 완전히** 순회하므로(캐너리가 하한을 500개 파일 이상으로 못박아 둠) 이 중복은 무시하기 어려운 양의 동기 `fs` 호출을 두 배로 만든다. backend jest·frontend vitest 각 실행마다 이 파일 하나에서만 이런 중복이 발생하고, 두 스택(backend+frontend)이 서로의 트리까지 스캔하는 cross-stack 중복(이전 라운드가 이미 문서화한 트레이드오프)과 별개로 **같은 스택 안에서의** 순수 재작업이다. `describe` 블록 진입 시 `beforeAll`로 한 번 계산해 공유하면 없앨 수 있는 비용이다.
  - 제안: `resolveScanDirs(repoRoot)`와 그로부터 파생되는 `listSourceFiles` 결과를 `beforeAll` 훅(또는 모듈 최상단 `describe` 스코프의 지역 변수)에서 한 번만 계산해 세 `it` 블록이 그 결과를 공유하도록 리팩터한다. `findMirrorRedeclarations`가 내부적으로 같은 스캔을 다시 수행하는 구조이므로, 캐너리 쪽에서 `resolveScanDirs`/`listSourceFiles`를 별도로 재호출하는 대신 첫 `it`에서 얻은 파일 목록(개수)을 재사용하는 형태로 리팩터할 수도 있다. CI 전용 테스트 코드라 사용자 체감 영향은 없고 절대 시간도 초 단위 이하로 추정되어 INFO에 그친다.

- **[INFO]** (확인·재등재 아님) 이전 라운드가 지적한 "backend·frontend 양쪽이 서로의 소스 트리까지 포함해 전체를 중복 스캔"하는 구조는 이번 라운드에서 스캔 범위가 1단계(`codebase/<stack>/src`)에서 2단계(`+ codebase/packages/<pkg>/src`)로 오히려 넓어졌다(`12_25_15` W1) — 즉 cross-stack 중복 스캔 비용의 절대량이 더 커졌다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:52-70`(`resolveScanDirs`), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:44-62`(동일)
  - 상세: 스캔 대상이 `codebase/backend/src`·`codebase/frontend/src`·`codebase/channel-web-chat/src` 세 트리에서, 이제 `codebase/packages/*/src` 전체(현재 8개 워크스페이스 패키지)까지 포함하도록 넓어졌다. 이는 커버리지 갭(형제 패키지의 마커 재선언을 못 잡던 결함)을 닫기 위한 의도된 트레이드오프이고(`12_25_15` RESOLUTION 근거 문서화됨), 패키지당 파일 수가 적어(`ai-end-reason` 등) 절대 비용 증가는 크지 않을 것으로 보인다. 새로 지적할 결함은 아니며, 위 첫 번째 INFO(파일 내 중복 순회)를 없애면 이 cross-stack 중복의 절대량도 자연히 줄어든다는 점만 남긴다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 런타임 hot path(`deepRedactCore`/`deepRedactObject`, 프런트 `scanForMarker`)는 이번 diff에서도 재귀 구조·깊이 캡 비교·depth-0 `WeakMap` 캐시가 전혀 바뀌지 않았음을 재확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts`(재귀 walk 로직 자체는 diff에 없음, `MAX_REDACT_DEPTH = MAX_MASK_DEPTH` 값만 재배선), `codebase/frontend/src/lib/utils/masked-markers.ts:98-104`(`scanForMarker`, `if (depth >= MAX_MASK_DEPTH) return false;` — 값 검사가 깊이 검사보다 먼저 실행되는 순서도 그대로)
  - 상세: 마커 상수·깊이 상한이 공유 패키지에서 import되는 것으로 출처만 바뀌었을 뿐, egress 마스킹 요청 경로의 알고리즘 복잡도·메모리 프로파일에는 이번 이관이 영향을 주지 않는다.
  - 제안: 없음.

## 요약

이번 diff는 값·로직을 그대로 유지한 채 마스킹 마커 상수를 공유 패키지로 옮기는 순수 리팩터이며, 실제 런타임 요청 경로(egress 마스킹 재귀 walk·프런트 마커 스캐너)는 알고리즘·복잡도·캐싱 전략이 diff 전후 완전히 동일해 회귀가 없다. 성능 관점에서 새로 생긴 비용은 전부 CI 전용 미러 소멸 가드 테스트에 국한된다 — 이전 라운드가 이미 "backend·frontend 두 스택이 서로의 트리까지 포함해 저장소 전체를 중복 스캔"하는 것을 의도된 트레이드오프로 문서화·수용했고 이번 라운드는 그 스캔 범위가 오히려 더 넓어졌음을 확인했다. 이번 라운드에서 새로 짚을 만한 지점은 그와 별개로, **같은 spec 파일 안에서** `resolveScanDirs`/`listSourceFiles`(재귀 `fs` 순회)가 서로 다른 `it` 블록에 의해 메모이제이션 없이 최대 3회 반복 호출된다는 것이다 — CI 실행 시간에 미미하게 더해지는 순수 낭비이고, `beforeAll`로 한 번 계산해 공유하면 공짜로 없앨 수 있다. N+1 호출·블로킹 프로덕션 I/O·O(n²) 문자열 누적·캐시 무효화 결함 등 CRITICAL/WARNING 급 성능 문제는 발견되지 않았다.

## 위험도
NONE

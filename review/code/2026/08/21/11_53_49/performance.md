# 성능(Performance) Review — masked-marker-contract-7d2e14

## 검토 범위

`@workflow/masked-markers` 공유 패키지 추출(순수 이관, 값·로직 무변경) + 등록 표면 8곳(Dockerfile
COPY·package.json·test-stages.sh·packages-checks.yml) + 신규 미러 소멸 회귀 가드
(`masked-marker-mirror-guard.ts`/spec, backend·frontend 양쪽). 나머지 diff(plan/review/spec 문서)는
런타임 성능과 무관해 제외했다.

## 발견사항

- **[INFO]** 미러 소멸 캐너리 가드가 backend·frontend 양쪽에서 각각 저장소 3개 소스 트리 전체를 동기 순회·전문 읽기 — 이번 PR로 스캔 비용이 사실상 2배가 됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:32-36` (`SCAN_DIRS` — `codebase/backend/src`·`codebase/frontend/src`·`codebase/channel-web-chat/src`) 및 함수 `findMirrorRedeclarations`(같은 파일 105-122) / `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:32-36`, `findMirrorRedeclarations`(113-133) — 동일 구조
  - 상세: `findMirrorRedeclarations` 는 `SCAN_DIRS` 세 디렉터리 전체를 `listSourceFiles` 로 재귀 순회(`fs.readdirSync` 동기 호출)한 뒤, 매칭되는 `.ts`/`.tsx` 파일마다 `fs.readFileSync(absolute, 'utf8')` 로 전체 내용을 메모리에 올린다(캐너리 테스트가 하한을 500개 이상으로 못박아 둠 — `masked-marker-mirror.spec.ts:48`, `masked-marker-mirror.test.ts:58`). `findRedeclaredSymbols` 안에 `SOT_SYMBOLS.some((s) => source.includes(s))` 값싼 사전 필터가 있어 대부분의 파일은 TS AST 파싱까지는 가지 않지만, **파일을 읽는 I/O 자체는 필터 이전에 이미 발생**한다(문자열 부분 일치를 하려면 내용이 있어야 하므로 이 자체는 불가피). 이번 PR 전에는 이 스캔이 frontend vitest 스위트 한 곳에만 있었는데, 이번 PR이 backend jest 쪽에 **거의 동일한 사본**을 신설하면서 — 두 사본 모두 `codebase/backend/src`·`codebase/frontend/src`·`codebase/channel-web-chat/src` **세 트리 전체**를 스캔하도록 그대로 복제했다 — backend 테스트 스위트 실행 시에도 (자기 소속이 아닌) frontend·web-chat 소스 트리 전문을 읽고, frontend 스위트 실행 시에도 (자기 소속이 아닌) backend 소스 트리 전문을 읽는 중복 I/O가 CI 매 실행마다 두 번 발생한다. 다만 이는 설계 의도가 명시적으로 문서화된 트레이드오프다(가드 헤더: "값의 미러와 달리 탐지 로직의 중복은 구멍을 만들지 않는다") — CI 경로 게이팅으로 어느 한쪽 워크플로만으로는 전체 커버리지가 안 되므로 중복 스캔을 감수한 선택이며, 파일당 비용도 "전문 읽기 + 값싼 substring 필터"로 낮게 억제돼 있어 절대 실행시간(초 단위)에 미치는 영향은 크지 않을 것으로 보인다.
  - 제안: 조치 불요(의도된 트레이드오프, 이미 근거 문서화됨). 다만 향후 저장소 소스 트리 규모가 크게 늘면(수천~수만 파일) 두 스택이 동시에 전체 트리를 두 번 훑는 비용이 누적될 수 있으므로, 필요 시 파일 목록에 대한 `fs.readFileSync` 를 지연시키거나(먼저 파일명/확장자로 러프 필터링은 이미 하고 있음) 스캔 결과를 두 프레임워크가 공유하는 캐시 파일로 대체하는 것을 장기적으로 검토할 수 있다.

- **[INFO]** 루프 불변 값이 매 반복 재계산됨 (알고리즘 자체의 복잡도에는 영향 없음 — 상수 오버헤드)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:122` — `findMirrorRedeclarations` 내부 `if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;`
  - 상세: `SOT_DIR.split(path.sep).join("/")` 는 순회 대상 파일(`rel`/`absolute`)에 의존하지 않는 불변 값인데, 스캔되는 파일 수(테스트가 하한 500개 이상을 못박음)만큼 매 반복 재계산된다. `split`+`join` 은 매우 짧은 문자열(`"codebase/packages/masked-markers"`)에 대한 연산이라 절대 비용은 무시할 수 있는 수준(마이크로초 단위 총합)이지만, 루프 밖으로 끌어올리면 공짜로 없앨 수 있는 반복 연산이다. (backend 사본 `masked-marker-mirror-guard.ts:115` 는 `SOT_DIR` 을 애초에 슬래시 리터럴로 선언해 이 재계산이 없다 — 두 사본이 같은 로직을 조금씩 다르게 구현한 결과.)
  - 제안: 루프 진입 전 `const sotPrefix = SOT_DIR.split(path.sep).join("/");` 로 한 번만 계산해 참조.

- **[INFO]** `deepRedactSecrets`/`deepRedactSecretsPreserving` (실제 런타임 hot path) 는 이번 PR에서 로직 변경이 없음 — 마커 상수·깊이 상한이 import 출처만 바뀜 (긍정적 확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `deepRedactCore`/`deepRedactObject`(리커시브 walk, depth-0 `WeakMap` 캐시)와 `MAX_REDACT_DEPTH = MAX_MASK_DEPTH`
  - 상세: 재귀 walk 알고리즘·깊이 캡 비교 연산자(`depth >= MAX_REDACT_DEPTH`)·depth-0 identity 캐시(`DEEP_REDACT_CACHE`, `WeakMap` 이라 GC 대상 유지)는 diff 전후로 동일하다. 값 자체(`10`)도 이관 전후 동일함을 diff 로 직접 확인했다. 즉 egress 마스킹의 실제 요청 경로 성능·복잡도에는 이번 이관이 영향을 주지 않는다. 참고 기재일 뿐 조치 대상 아님.
  - 제안: 없음.

## 요약

이 PR 은 backend/frontend 에 손으로 복제되던 마스킹 마커 상수·판정 로직을 공유 패키지로 추출하는 **동작 무변경 순수 리팩터**다. 런타임 hot path(`deepRedactCore`/`deepRedactObject`, 프런트 `scanForMarker`)는 재귀 구조·깊이 캡·depth-0 캐시가 diff 전후로 완전히 동일해 알고리즘 복잡도·메모리 프로파일에 회귀가 없다. 성능 관점에서 실질적으로 새로 생긴 비용은 CI 시점의 테스트/가드 코드에 한정된다 — 신규 미러 소멸 캐너리가 backend·frontend 양쪽에서 저장소 3개 소스 트리 전체를 동기 순회·전문 읽기하도록 거의 동일한 형태로 복제되어(이전에는 frontend 한 곳뿐) 스캔 I/O 가 사실상 두 배가 됐지만, 이는 CI 경로 게이팅 사각지대를 없애기 위한 의도적·문서화된 트레이드오프이고 파일당 비용도 값싼 substring 사전 필터로 낮게 억제돼 있어 절대 실행시간 영향은 미미하다. 그 외 루프 내 불변 문자열 재계산 1건은 무시 가능한 수준의 상수 오버헤드다. N+1 호출·블로킹 프로덕션 I/O·캐시 무효화·불필요한 문자열 O(n²) 누적 등 CRITICAL/WARNING 급 성능 결함은 발견되지 않았다.

## 위험도
NONE

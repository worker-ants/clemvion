STATUS=success testing review complete (9 files reviewed, 1 mutation-verified gap found, repo tree clean after mutation probes)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰

## 검증 방법

- 신규/변경된 spec 을 실제로 실행: `http-exception.filter.spec.ts` + `redis-fail-open-catalog.spec.ts` → **27/27 PASS**.
- `http-exception.filter.spec.ts` 의 신규 `describe('cause 비노출 불변식 (계측 지점)')` 에 대해 **뮤테이션 검증**을 직접 수행(사본을 scratch 에 백업 후 `codebase/backend/src/common/filters/http-exception.filter.ts` 를 `cp` 로 되돌림 — `git checkout` 미사용, 검증 후 `git status --short` 로 원복 확인 완료, 잔여물 없음).

## 발견사항

- **[WARNING]** `cause` 비노출 불변식 `it.each` 의 닫힌-키-집합 단언이 `QueryFailedError(23505)`/409(`RESOURCE_CONFLICT`) 분기에서는 **값(마커) 누출을 전혀 검증하지 않는다** — 뮤테이션으로 실측 확인(19/19 GREEN, 마커 누출에도 전부 통과).
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts:329-361` (`it.each` 의 `'QueryFailedError(23505)'` 항목 + 공통 `expect(Object.keys(bodyOf(json).error).sort()).toEqual([...])` 단언)
  - 상세: 이 describe 블록에서 새 필드 누출(예: `...exception` 스프레드)은 4개 fixture 모두 닫힌-키-집합 단언이 잡지만, **키를 늘리지 않고 기존 `message` 필드에 `cause` 내용이 섞여 드는 변형**은 나머지 세 개(매핑 안 된 Error/500, HttpException/409, http-error 4xx/413) 만 `expect(JSON.stringify(...)).not.toContain(CAUSE_MARKER)` 로 별도 방어하고, `QueryFailedError(23505)` 항목만 그 방어가 없다. 실제로 `catch()` 의 `isUniqueViolation` 분기 message 를 `'Resource already exists ...' + (exception.cause instanceof Error ? cause.message : '')` 형태로 뮤테이션해(키는 그대로, 값에만 마커 삽입) 돌린 결과, 파일 전체 **19/19 그대로 GREEN** 이었다(저장소 baseline 의 사전 존재 pinned-message 테스트인 `'maps a unique-violation QueryFailedError (23505) to 409 RESOURCE_CONFLICT'` 도 이 뮤턴트에서 살아남는다 — `cause` 가 없을 때는 빈 문자열이 붙어 문구가 그대로 유지되도록 조건부로 짰기 때문에, 이 pinned 테스트만으로는 이 축을 못 잠근다).
    이 describe 블록의 존재 이유 자체가 "미래에 APM/구조적 로깅 유틸이 에러 객체를 통째로 펼치면(`...exception`) `cause` 안의 민감 정보가 샌다" 는 부재 주장을 지키는 것인데, 그 회귀 형태 중 "새 키 없이 기존 필드에 섞여 드는" 변형이 4개 분기 중 정확히 1개(가장 나중에 추가된 QueryFailedError 항목)에서만 무방비다.
  - 제안: `it.each` 4개 항목 전부에 `expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER)` 를 추가하거나(닫힌-키-집합 단언과 함께), 최소한 QueryFailedError(23505) 케이스에 한해 위 세 개별 테스트와 같은 형태의 콘텐츠 부재 단언을 별도로 추가한다.

## 파일별 요약

### `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (파일 1)
새로 추가된 `describe('cause 비노출 불변식 (계측 지점)')` 는 이 PR 세트 중 유일하게 실질적인 신규 동작 테스트다. 품질은 전반적으로 높다:
- **vacuity 방지**가 명시적이다 — `it('fixture 자체는 유출되면 표식이 보이는 형태다')` 로 fixture 가 실제로 마커를 직렬화 가능한 형태인지 먼저 못 박는다. 이는 이 저장소가 여러 번 반복해 겪은 함정(사용자 메모리: "vacuous test 세 형태", "생성 입력 vs 큐레이션 코퍼스")을 정확히 겨냥한 설계다.
- **enumerable own key 함정**을 실측으로 문서화하고(`sensitiveCause()` 가 `query` 를 enumerable own key 로 심는 이유), `HttpException` 케이스에서 "한 겹 더 감싸면 안 되는" 이유까지 주석에 남겼다 — 실제로 그 실수를 한 번 저지르고 고친 흔적이 남아 있어 신뢰도가 높다.
- `Logger.prototype.error`/`warn` 스파이는 파일 최상단 `afterEach(() => jest.restoreAllMocks())` 로 격리되어 테스트 간 누설이 없다(**테스트 격리** 양호).
- 위 WARNING 항목을 제외하면 **회귀 테스트**로서 견고하다 — `cause: err` 제거 뮤테이션에 9건 전부 RED 라는 것도 plan 기록(`plan/in-progress/deps-peer-gating-and-eslint10.md`)과 실행 결과(10→19, 정확히 일치)로 교차 확인됨.

### `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (파일 2)
diff 는 주석(정본 위치 안내)만 바뀌고 테스트 로직·assertion 변경 없음. 회귀 위험 없음.

### `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (파일 3)
diff 는 주석(형제 개수 3→4) 만 바뀌고 로직 변경 없음. 해당 서비스의 `cause` 비부착 불변식은 이 PR 이전부터 `secret-resolver.service.spec.ts:207-229`(`err.cause` 가 `toBeUndefined()`) 로 이미 잠겨 있어 새로 추가할 테스트 갭 없음 — 확인 완료.

### `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (파일 4)
diff 는 주석(정본 위치 안내) 만 바뀌고 테스트 로직 변경 없음. 기존 C2 캐너리(`Object.keys(cause).toEqual([])`, 빈 화이트리스트)는 diff 밖에서 이미 존재.

### `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` + `.../redis-fail-open-catalog.spec.ts` (파일 5·6, 신규)
"유니온 타입 ↔ spec 카탈로그 ↔ 실제 프로덕션 호출부" 3자 정합 가드. AST 기반(정규식 아님)이고, 자기 판별력(`describe('가드 자체의 판별력')`)을 `withPatchedSpec` 헬퍼로 검증한다 — 이 헬퍼는 **저장소 밖 `os.tmpdir()`** 에만 쓰고 `finally` 로 정리해 저장소 트리를 건드리지 않는다(리뷰 규약 §뮤테이션 준수, 양호).
- **비-vacuity 안전장치**가 있다 — "유니온의 모든 값이 wired 를 가진다" 단언은 유니온이 비어 있으면 공허하게 통과할 수 있는데, 별도의 `expect(readUnionMembers(repoRoot)).toEqual(['idempotency'])` 정확값 단언이 그 공허화를 막는다. "모든 호출부가 정적으로 해석된다"(0건 기대) 단언도 마찬가지로 `wired.length > 0` + `every(component === 'idempotency')` 로 실질성을 확보한다.
- 직접 실행 확인: 8개 테스트 전부 PASS.
- **[INFO]** `findWiredComponents` 의 상수 추적은 **같은 파일 내 선언만** 따라간다(`redis-fail-open-catalog-guard.ts:113-118` 주석에도 명시). cross-file 상수 참조가 생기면 `component: null` 로 떨어지고, "정적으로 해석된다" 단언(`redis-fail-open-catalog.spec.ts:54-60`)이 fail-closed 로 RED 를 내는 설계라 결함은 아니지만, 향후 그 케이스가 실제로 발생하면 가드 확장이 선행돼야 함을 남겨 둔다(이미 가드 자신이 이 한계를 문서화하고 있어 별도 조치 불요, 참고용 기록).
- **[INFO]** `listProductionSources` 는 `__tests__/` 디렉터리를 제외하지 않는다 — 가드 자기 자신(`redis-fail-open-catalog-guard.ts`)도 "프로덕션 소스" 로 스캔 대상에 들어간다. 지금은 그 파일이 `RECORDER_FN` 문자열을 정의만 하고 `x.recordRedisFailOpen(...)` 형태의 실제 호출 표현식이 없어 오탐이 없지만(AST 기반이라 JSDoc 예시 텍스트도 안전), 이름이 같은 헬퍼 함수가 이 디렉터리 안에 새로 생기면 재검토가 필요한 지점으로 참고 기록.

### `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (파일 7)
diff 는 JSDoc(정본 선언) 만 추가되고 테스트 로직 변경 없음. 회귀 위험 없음.

### `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/deps-peer-gating-and-eslint10.md` (파일 8·9)
코드가 아닌 plan 문서. 테스트 수량 주장("9건 추가, 10→19")을 실제 파일 실행 결과와 대조해 **일치**를 확인했다(19/19 PASS, 기존 10 + 신규 9). 뮤테이션 표의 "RED" 주장들은 이 리뷰의 관점(재현) 범위를 넘어서므로 별도 재현하지 않았으나, 위에서 발견한 WARNING(QueryFailedError 분기 content-leak 미검증)은 이 두 plan 문서 어디에도 등재돼 있지 않다 — "초안 테스트는 절반이 공허했다" 절이 이미 다룬 두 함정(non-enumerable 표식, cause 없는 fixture)과는 다른 세 번째 형태이므로, 후속 항목으로 등재할 가치가 있다.

## 요약

이번 PR 세트의 실질적인 신규 테스트는 `http-exception.filter.spec.ts` 의 `cause` 비노출 계측 지점 describe 블록과 `redis-fail-open-catalog-guard/.spec.ts` 두 곳뿐이고, 나머지 파일(2·3·4·7)은 주석만 바뀌어 회귀 위험이 없다. 두 신규 테스트 스위트 모두 vacuity 방지·닫힌 집합 단언·AST 기반 파싱 등 이 저장소의 확립된 뮤테이션 검증 관행을 잘 따르고 있어 전반적 품질은 높다. 다만 직접 뮤테이션으로 확인한 결과, `cause` 비노출 불변식의 `it.each` 4개 분기 중 `QueryFailedError(23505)`(409) 분기만 키-집합 검사에 그치고 값(마커) 누출 검사가 빠져 있어, 이 describe 블록이 막으려는 바로 그 회귀 형태(에러 객체를 통째로 펼치는 미래 변경)가 이 한 분기에서는 조용히 통과한다. 나머지는 발견사항 없음.

## 위험도

LOW

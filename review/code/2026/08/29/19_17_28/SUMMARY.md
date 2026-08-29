# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 로직 변경은 주석 1줄뿐이며 나머지는 테스트/가드/문서 정리. 유일한 실질 이슈는 신규 `cause` 비노출 회귀 테스트의 커버리지 갭(WARNING 1건, testing 이 뮤테이션으로 직접 실측 확인). Critical 없음. forced(router_safety) 화이트리스트 7명(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 정상 실행·결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 `cause` 비노출 불변식 `it.each` 4개 분기 중 `QueryFailedError(23505)`(409) 분기만 닫힌-키-집합 검사에 그치고 **값(마커) 누출 검사가 빠져 있음**. 실제 뮤테이션(`message` 필드에 `cause` 내용을 조건부로 섞어 넣음)으로 실측 확인 — 19/19 그대로 GREEN, 즉 이 describe 블록이 막으려는 회귀 형태(에러 객체를 통째로 펼치는 미래 변경)가 이 한 분기에서는 조용히 통과한다. 사전 존재 pinned-message 테스트도 이 축을 못 잠근다. | `codebase/backend/src/common/filters/http-exception.filter.spec.ts:329-361` | 4개 `it.each` 항목 전부에 `expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER)` 추가, 또는 최소 QueryFailedError(23505) 케이스에 나머지 세 분기와 동일한 콘텐츠 부재 단언 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/testing | "유니온 소스 경로가 실재한다" 케이스가 주석이 설명하는 실패 모드(파일 이동 시 ENOENT)를 직접 검증하지 않음 — 존재 여부만 확인 | `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts:129` | `UNION_SOURCE` 를 scratch 경로로 바꿔 throw 를 직접 단언하거나 주석을 실측 범위에 맞게 좁힘 |
| 2 | requirement/testing | `readCatalogComponents` 의 두 번째 throw 분기(행은 있으나 `component(...)` 패턴 불일치)가 테스트되지 않음 | `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:79` | `withPatchedSpec` 변형으로 두 번째 throw 를 직접 단언하는 케이스 추가 |
| 3 | scope | 두 개의 독립 장기 백로그 트래커(`backend-lint-gate-broken-on-main.md`, `deps-peer-gating-and-eslint10.md`)를 한 PR 에서 동시 갱신 — plan 본문이 "spec-linked 파일 공유로 인한 수렴 예외"로 자기 근거를 명시하고 있어 은폐된 확장은 아님 | `plan/in-progress/backend-lint-gate-broken-on-main.md:2`, `plan/in-progress/deps-peer-gating-and-eslint10.md:3` | 각 트래커 체크박스가 기존 미해결 항목에 대응하는지만 대조 확인, 별도 조치 불요 |
| 4 | scope | `deps-peer-gating-and-eslint10.md` 의 `worktree:` 필드가 이번 diff 로 재변경됐는데, 같은 파일 내 미수정 기존 서술(17번째 줄)은 다른 워크트리를 가리켜 서술 불일치 가능성 | `plan/in-progress/deps-peer-gating-and-eslint10.md:3`(diff), 동 파일 17행(미수정) | §2 이후 항목의 실제 진행 워크트리를 재확인하고 필요 시 17행 주석도 동기화 |
| 5 | maintainability | 봉투 키 닫힌 집합 배열 `['code','message','requestId']` 리터럴이 같은 describe 블록 안에서 2회 반복 | `codebase/backend/src/common/filters/http-exception.filter.spec.ts:356-360, 371-375` | 모듈 상단에 `CLOSED_ENVELOPE_KEYS` 상수로 추출해 재사용 |
| 6 | maintainability | `Logger.prototype` spy 무음화 2줄 패턴이 신설 describe 블록 안에서 4회 반복 | `codebase/backend/src/common/filters/http-exception.filter.spec.ts:267, 299, 346-351` | `silenceLogger(...levels)` 헬퍼로 추출(규모가 작아 필수는 아님) |
| 7 | maintainability | `backend-lint-gate-broken-on-main.md`/`deps-peer-gating-and-eslint10.md` 두 트래커가 다단계 중첩 blockquote("정정의 정정")로 55KB급까지 누적돼 탐색성 저하 우려 (이번 PR 만의 결함은 아님) | `plan/in-progress/deps-peer-gating-and-eslint10.md` §체크리스트 하단, `plan/in-progress/backend-lint-gate-broken-on-main.md:581`이하 | `complete/` 이동 전 "현재 유효한 결론" 요약 섹션을 상단에 추가 고려 |
| 8 | testing | `findWiredComponents` 의 상수 추적이 같은 파일 내 선언만 따라감(cross-file 참조는 `component: null`로 fail-closed — 가드 자신이 이미 문서화, 결함 아님) | `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:113-118` | 향후 cross-file 참조가 실제 발생하면 가드 확장 선행 필요 — 현재는 조치 불요 |
| 9 | testing | `listProductionSources` 가 `__tests__/` 디렉터리를 제외하지 않아 가드 자기 자신도 스캔 대상(현재는 오탐 없음, AST 기반이라 안전) | `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:92, 119` | 동일 이름 헬퍼가 이 디렉터리에 추가되면 재검토 |
| 10 | documentation | 인접한 두 주석 문장에서 지시대명사("이 넷"/"이 셋")가 서로 다른 대상(fixture 4개 vs 키 3개)을 가리켜 빠르게 훑으면 오독 가능(실제 진술 자체는 정확함) | `codebase/backend/src/common/filters/http-exception.filter.spec.ts:355` | 지시 대상을 명시하는 문구로 교체(블로킹 아님) |

### 확인 완료 (문제 없음 — 별도 분류)

- `secret-resolver.service.ts` 의 `deleteByPrefix` LIKE 인젝션 방어는 이번 diff(주석 1줄)로 회귀 없음 (security)
- 신규 가드/spec 은 하드코딩 상수 경로만 읽어 경로 탐색 표면 없음 (security)
- `http-exception.filter.spec.ts` 신규 `cause` 비노출 테스트가 실제 필터 구현(`catch()`)과 정확히 부합 (security)
- `RedisFailOpenComponent`/`RedisFailOpenReason` 유니온 ↔ spec 카탈로그 ↔ 실배선 3자 정확히 일치, §6.3.1 C1/C2 형제 4곳 재확인, `.cause` 소비처 유일성(`telegram-client.ts` 1곳) 재확인 (requirement)
- diff 는 정확히 9개 파일로 국한, 프로덕션 코드 실질 변경은 주석 1줄뿐, import/포맷팅 변경 없음 (scope)
- `withPatchedSpec` 은 `os.tmpdir()` 안에서만 쓰고 `finally` 로 정리 — 저장소 원본 불변 (side_effect)
- Logger spy 는 상위 `afterEach(jest.restoreAllMocks())` 로 cascade 격리되어 누설 없음 (side_effect)
- `findWiredComponents` 는 `require`/`import` 없이 AST 파싱만 하여 프로덕션 모듈 최상위 부작용 실행 위험 없음 (side_effect)
- 전역 변수·시그니처·환경변수·네트워크 호출 축 전부 변경 없음 (side_effect)
- `expression-resolver.service.spec.ts`/`code.handler.spec.ts`/`error-shape.spec.ts` 는 주석만 변경, 테스트 로직·assertion 불변 (testing, documentation)
- 신규 가드 spec 8/8, `http-exception.filter.spec.ts` 19/19(신규 9건 포함), 나머지 spec 180/180, `error-shape.spec.ts` 10/10 — 전수 PASS 직접 실행 확인 (requirement, testing)
- 문서 교차참조(spec 절 번호, 파일 경로, 정량 수치 "10→19")를 전부 직접 대조해 일치 확인 (documentation)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 로직 변경 없음, 기존 보안 불변식(LIKE 인젝션 방어, cause 비노출) 회귀 없음 |
| requirement | NONE | 전 spec PASS, spec 정합 완전 일치, INFO 2건(테스트 커버리지 서술-실측 괴리) |
| scope | LOW | diff 9파일 정확히 국한, 스코프 확장 없음, plan 위생 INFO 2건 |
| side_effect | NONE | 실제 부작용 전무, 유일한 FS 쓰기(`os.tmpdir()`)는 안전하게 격리·정리됨 |
| maintainability | LOW | 소규모 DRY 여지 2건(리터럴/보일러플레이트 반복) + plan 문서 비대화 우려 |
| testing | LOW | **WARNING 1건**(cause 값 누출 커버리지 갭, 뮤테이션 실측 확인) + INFO 2건 |
| documentation | NONE | 전 교차참조 일치 확인, 가독성 수준 INFO 1건(지시대명사 혼동 가능성) |

## 발견 없는 에이전트

해당 없음 — 실행된 7개 에이전트 모두 최소 1건 이상의 INFO/WARNING 을 보고함 (Critical 은 전원 0건).

## 권장 조치사항
1. (WARNING) `http-exception.filter.spec.ts` 의 `cause` 비노출 `it.each` 4개 분기 전부에 값(마커) 누출 부재 단언을 추가해 QueryFailedError(23505) 분기의 커버리지 갭을 닫는다.
2. (INFO, 선택) `redis-fail-open-catalog` 가드/spec 에 두 개의 미검증 에러 경로(UNION_SOURCE 부재 시 throw, readCatalogComponents 두 번째 throw 분기) 테스트 케이스를 추가한다.
3. (INFO, 선택) `http-exception.filter.spec.ts` 의 봉투 키 배열·Logger spy 무음화 보일러플레이트를 상수/헬퍼로 추출해 중복을 줄인다.
4. (INFO, 선택) `deps-peer-gating-and-eslint10.md` 의 `worktree:` 필드와 파일 내 기존 서술(17행) 간 불일치 여부를 재확인해 동기화한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — 실행된 전원과 동일. forced 전원 결과 확보됨, 화이트리스트 미이행 없음)
  - **제외**: 7명 — prompt 에 개별 사유가 포함되지 않아 사유는 "미상"으로 표기

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 미상 (router 사유 미전달) |
  | architecture | 미상 (router 사유 미전달) |
  | dependency | 미상 (router 사유 미전달) |
  | database | 미상 (router 사유 미전달) |
  | concurrency | 미상 (router 사유 미전달) |
  | api_contract | 미상 (router 사유 미전달) |
  | user_guide_sync | 미상 (router 사유 미전달) |

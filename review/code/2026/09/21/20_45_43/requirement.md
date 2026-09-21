# 요구사항(Requirement) 리뷰 — `raceUnderHeldLock()` 동시성 e2e 헬퍼 추출

## 검증 방법

프롬프트의 unified diff 요약뿐 아니라, 대상 파일 전부(`codebase/backend/test/helpers/concurrency.ts`,
9개 `*-delete-concurrency.e2e-spec.ts` + `member-remove-concurrency.e2e-spec.ts`, `PROJECT.md`,
`plan/in-progress/e2e-race-helper.md`)를 `Read`/`Grep` 으로 직접 열어 변경 전후 동작을 라인 단위로
대조했다. 저장소에는 아무것도 쓰지 않았다(`git status --short` 로 확인 — 본 세션의 리뷰 산출물
디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 헬퍼 JSDoc 의 `@example` 이 숫자 비교자 없는 기본 `Array.prototype.sort()` 를 쓴다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts:59`
  - 상세: `expect(results.map((r) => r.status).sort()).toEqual([204, 404]);` 는 문서 예시일 뿐 실행되는
    코드는 아니고, 우연히 `[204, 404]` 처럼 첫 자리 숫자가 다른 두 값에서는 사전식 정렬과 결과가
    같아 이 예시 자체는 참이다. 그러나 실제 11개 호출부는 전부 `(a, b) => a.status - b.status` /
    `(a, b) => a - b` 숫자 비교자를 쓰고 있어(예: `auth-config-delete-concurrency.e2e-spec.ts:87`)
    헬퍼 자체의 동작에는 영향이 없다. 이 예시를 다른 값(예: `[9, 200]`)에 복제하면 사전식 정렬로
    깨질 수 있다는 점만 잠재적 함정이다.
  - 제안: `@example` 의 `.sort()` 를 `.sort((a, b) => a - b)` 로 바꿔 실제 호출부 관례와 맞추면 다음
    복제자가 문서 예시를 그대로 베껴도 안전하다. 기능 결함은 아니므로 조치 필수는 아니다.

- **[INFO]** `PROJECT.md` 문서 갭(직전 리뷰 라운드 `review/code/2026/09/21/20_26_50/SUMMARY.md` WARNING #1)이
  이번 diff 에서 이미 해소돼 있음을 확인.
  - 위치: `PROJECT.md`(§Backend e2e 패턴) 337–342 (게이트 숫자 기준)
  - 상세: `helpers/db.ts`/`helpers/auth.ts` 소개 옆에 `raceUnderHeldLock(locker, lock, fires)` 한 단락이
    추가돼 "손으로 복제 금지" 취지와 선례 9파일, `integration-rotate-concurrency` 제외 사유까지 실려
    있다. 이 refactor 의 존재 이유(다음 작성자가 손으로 복제하다 가드를 빠뜨리는 것 방지)가 가이드
    레벨까지 완결됐다. 새 결함이 아니라 이전 발견사항의 해소를 기록하는 것.
  - 제안: 조치 불요.

## 항목별 점검 결과

1. **기능 완전성**: `raceUnderHeldLock()` 이 `BEGIN → lock → fires 발사 → Promise.race 공허성 가드
   → expect(raced).toBe('pending') → COMMIT → return pending` / `finally: ROLLBACK + pending?.catch`
   전체를 원본 11블록과 1:1 대응으로 캡슐화했다. 9개 호출부 전부(`auth-config`·`integration-delete`·
   `member-remove`(2)·`model-config`·`schedule`·`trigger`·`webauthn-credential`(2)·`workflow`·
   `workspace`) 를 직접 열어 대조한 결과, 단언(`expect(results...).toEqual(...)`, `code` 검사, 감사
   로그 카운트 쿼리)은 **하나도 바뀌지 않았다** — 사라진 코드는 헬퍼로 옮겨간 `Promise.race` 가드
   자체뿐이다. `integration-rotate-concurrency.e2e-spec.ts` 는 (a) thunk 1개만 발사, (b) 락과 발사
   사이에 `UPDATE` IO 존재, (c) COMMIT 전에 donor 암호문을 읽는 등 구조가 근본적으로 달라 제외한 plan
   의 판단(§B)이 실제 코드로 검증됐다.
2. **엣지 케이스**: `fires.length < 2` 즉시 throw(겹침 자체가 없는 호출 방지), COMMIT 후에도
   ROLLBACK 을 항상 시도(no-op 처리), `pending?.catch(() => undefined)` 로 unhandled rejection 흡수 —
   모두 원본 9파일에 이미 있던 방어가 헬퍼로 옮겨오며 유지됨. `webauthn-credential` 둘째 블록처럼
   `fires` 가 서로 다른 인자를 바인딩하는 이형 thunk(`() => fireDelete(idA)`, `() => fireDelete(idB)`)
   케이스도 시그니처(`Array<() => Promise<T>>`)가 정확히 수용한다.
3. **TODO/FIXME**: 변경 파일 전체에서 TODO/FIXME/HACK/XXX 없음(grep 확인).
4. **의도와 구현 간 괴리**: 함수명 `raceUnderHeldLock` · JSDoc · 실제 구현이 일치. "공허성 가드를
   한 곳에 모은다"는 의도대로 `expect()` 를 헬퍼 내부에 봉인해 호출부가 가드를 빠뜨릴 수 없게
   만든 설계도 실제로 그렇게 구현됨.
5. **에러 시나리오**: `VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 **모듈 로드 시점**에
   `throw` 로 고정 — `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 실제 값(5_000, `trigger-config-lock.ts:128`)과
   대조해 `1_500 < 5_000` 성립 확인. 주석이 아니라 실행되는 assert 로 관계를 고정한다는 JSDoc 주장이
   실측과 일치.
6. **데이터 유효성**: `lock: { sql, params? }` 형태로 SQL 텍스트와 파라미터가 분리돼 있어 파라미터
   바인딩 방식(SQL 인젝션 방지)이 원본과 동일하게 유지됨.
7. **비즈니스 로직**: 각 리소스별 에러 코드(`RESOURCE_NOT_FOUND` / `MEMBER_NOT_FOUND` /
   `MODEL_CONFIG_NOT_FOUND` / `WEBAUTHN_CREDENTIAL_NOT_FOUND` / `WORKSPACE_NOT_FOUND` /
   `NOT_A_MEMBER`)와 성공 상태 코드(204 vs 200)가 파일별로 다른데도 전부 원본 그대로 보존됨 —
   호출부에 남겨 둔 정렬·판정 로직이 도메인별 차이를 여전히 담당.
8. **반환값**: `raceUnderHeldLock` 은 정상 경로에서 `T[]` 반환, `fires.length < 2` 또는 가드 실패
   시 예외로 전파(반환하지 않음) — 모든 경로가 문서화된 대로 동작.
9. **spec fidelity**: 이 변경은 테스트 인프라(백엔드 e2e 헬퍼) 리팩터로 프로덕션 API 계약을 바꾸지
   않는다. `spec/` 에 "동시성 e2e 헬퍼" 를 정의하는 문서는 없음(해당 사항 아님, INFO) — plan 의
   `spec_impact: none` 선언 및 선행 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/
   19_59_55`, BLOCK:NO·Critical 0·Warning 0, 직접 확인)과 일치. 테스트 docblock 이 인용하는
   `spec/2-navigation/2-trigger-list.md §4.4`("두 번째는 404 RESOURCE_NOT_FOUND")는 이번 diff 로
   새로 추가된 주장이 아니라 기존 docblock 내용이 그대로 이동한 것이며, spec 본문과 여전히
   일치함을 확인.

## 요약

`raceUnderHeldLock()` 추출은 아홉 파일 11개 동시성 e2e 블록의 "락 획득 → 발사 → 공허성 가드 →
COMMIT → 정렬/단언" 구조를 순수하게 캡슐화한 behavior-preserving 리팩터다. 9개 호출부 전체와 헬퍼
본문을 직접 대조한 결과 단언·에러코드·성공코드·락 종류(행 락 vs advisory lock)가 전혀 바뀌지 않았고,
제외된 `integration-rotate-concurrency`(구조가 근본적으로 다름)의 배제 근거도 실제 코드로 검증된다.
직전 리뷰 라운드가 지적한 PROJECT.md 문서 갭(WARNING)은 이번 diff 에 이미 반영돼 있다. 378/378 e2e
PASS 로그와 음성 대조군(락 제거 뮤턴트 → 11 RED) 근거도 실측 로그로 확인했다. Critical/Warning 급
결함 없음 — 요구사항 충족 관점에서 이 변경은 완전하고 안전하다.

## 위험도
NONE

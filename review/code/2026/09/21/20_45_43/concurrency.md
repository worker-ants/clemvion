# 동시성(Concurrency) 코드 리뷰

## 범위

이번 diff 는 프로덕션 코드 변경이 **0**건이고, 아홉 개 e2e 동시성 테스트 파일(11 블록)에
손으로 복제돼 있던

```
BEGIN → 락 쿼리 → 두 요청 발사 → 공허성 가드(Promise.race, 1.5초) → COMMIT → 결과 반환
finally: ROLLBACK + pending 흡수
```

블록을 `codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 로 추출하는
순수 리팩터다. 동일 코드베이스에 대한 이전 라운드 리뷰(`review/code/2026/09/21/20_26_50/concurrency.md`)
가 이미 이 추출 자체를 LOW 로 판정했고, 이번 diff 는 그 뒤 이어진 후속 커밋
(`6b29435ac docs(test): 헬퍼를 e2e 가이드에 넣고, 가드 대기 시간의 근거를 검사로 바꿨다`)
을 포함한다. 즉 리뷰 대상은 (1) `codebase/backend/test/helpers/concurrency.ts` 에 새로 추가된
모듈 로드 시점 assert, (2) `PROJECT.md` 문서 보강, (3) 이전 리뷰 산출물 커밋 — 셋이다.
9개 호출부(`auth-config-`, `integration-`, `member-remove-`(2블록), `model-config-`,
`schedule-`, `trigger-`, `webauthn-credential-`(2블록), `workflow-`, `workspace-delete-concurrency`)
자체의 헬퍼 호출 치환 부분은 이전 라운드에서 검증됐고, 이번 diff 에서 그 부분의 변경은 없다
(직접 `Read` 로 `codebase/backend/test/helpers/concurrency.ts` 전체를 확인해 대조함).

## 검증 방법

- `codebase/backend/test/helpers/concurrency.ts` 전체 파일을 `Read` 로 직접 읽어 diff 게이트
  줄 번호와 실제 파일 줄 번호가 일치함을 확인.
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 을 확인해
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 가 `5_000` 리터럴 상수(런타임/환경변수 의존 없음)임을 검증 —
  모듈 로드 시점 비교가 초기화 순서에 좌우되지 않음.
- 저장소 파일은 뮤테이션하지 않았다(`git status --short` 로 확인할 변경 없음 — read-only 리뷰).

## 발견사항

- **[INFO]** 신규 module-load-time assert(`if (VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS) throw`)
  가 이전 리뷰의 INFO(가드 대기시간이 파일별 리터럴에서 단일 전역 상수로 바뀌며 "호출부가 전제를
  스스로 검증할 방법이 없다")를 **부분적으로** 해소한다 — 하지만 완전히 닫지는 않는다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts:19-24` (assert), `:17`(`VACUITY_GUARD_MS`
    선언), `:4`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` import)
  - 상세: 이 assert 는 "`VACUITY_GUARD_MS` < **트리거 삭제 경로의** 락 타임아웃" 만 검사한다.
    현재 9파일 11블록 중 가장 타이트한 상한이 트리거/스케줄 경로의 5초이므로 지금은 안전하지만,
    향후 이 헬퍼를 재사용하는 열 번째 호출부가 트리거보다 더 짧은(예: 2초) 락/애플리케이션
    타임아웃을 가지면 이 assert 는 그 사실을 감지하지 못한다 — 여전히 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`
    하나만 기준으로 삼기 때문이다. "주석을 검사로 바꿨다"는 정확하지만, 그 검사의 범위는
    "지금까지 알려진 가장 타이트한 상수 하나" 로 한정돼 있어 새 호출부가 스스로 자신의 타임아웃을
    등록하지 않는 한 동일한 실패 모드(가드가 "겹침 실패"와 "애플리케이션 타임아웃"을 구분 못 함)가
    조용히 재발할 수 있다.
  - 제안: 현재 9개 호출부에는 결함이 아니다(문서화된 마진 안, plan `e2e-race-helper.md` §C 의
    음성 대조군 실측으로 11블록 전부 가드 생존 확인됨). 다만 이 assert 의 이름·주석에 "지금까지
    알려진 상한만 검사한다"는 한계를 명시하거나, 새 호출부 추가 시 그 호출부의 타임아웃 상수도
    이 assert 에 추가하는 것을 관례(convention)로 남기면 이 갭이 재발하지 않는다.

## 확인했으나 결함 아닌 것 (근거만 기록)

- **락 획득 → 발사 순서 / `finally` ROLLBACK+pending 흡수 / 제네릭 스레딩**: 이전 라운드
  리뷰(`review/code/2026/09/21/20_26_50/concurrency.md`)에서 이미 검증됐고, 이번 diff 는
  `codebase/backend/test/helpers/concurrency.ts:61-101` 의 함수 본문을 변경하지 않았다
  (신규 assert 는 함수 밖, 모듈 최상위에 추가됨) — 재검증 결과 동일 결론.
- **assert 의 초기화 순서 안전성**: `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`trigger-config-lock.ts:128`)
  는 환경변수·비동기 초기화 없는 리터럴 상수라, import 시점 비교(`concurrency.ts:19`)가
  모듈 평가 순서에 좌우되는 레이스 없이 결정적이다.
- **module-load-time throw 의 파급 범위**: 이 throw 는 `raceUnderHeldLock` 을 import 하는
  9개 e2e 파일 전부를 즉시 실패시킨다(개별 테스트가 아니라 스위트 로드 자체를 막음) — 이는
  "전제가 깨지면 크게, 빨리 실패한다"는 의도된 설계이고 동시성 결함은 아니다.
- **`PROJECT.md` 문서 변경**(파일 1) — 순수 가이드 문서 추가로 동시성 동작에 영향 없음.
- **`plan/in-progress/e2e-race-helper.md`, `review/**` 산출물**(파일 12-32) — 코드 실행 경로
  밖의 계획/리뷰 문서로 동시성 관점 검토 대상 아님.

## 요약

프로덕션 코드 변경이 없는 순수 테스트 헬퍼 추출/보강이다. 이번 후속 커밋의 핵심은 이전 리뷰가
지적한 "공허성 가드 대기시간의 안전 마진이 주석에만 있다"는 INFO 를 모듈 로드 시점 assert 로
격상시킨 것으로, 방향은 개선이지만 그 assert 가 "지금까지 알려진 가장 타이트한 상수 하나"만
검사하므로 향후 더 짧은 타임아웃을 가진 신규 호출부가 추가될 때의 잠재적 오탐 가능성을 완전히
닫지는 못한다(잔여 INFO). `raceUnderHeldLock()` 자체의 락 획득 순서·`Promise.race` 공허성
가드·`finally` 의 ROLLBACK/pending 흡수 로직은 이전 라운드에서 검증된 그대로 변경되지 않았다.
Critical/Warning 급 동시성 결함은 발견하지 못했다.

## 위험도

LOW

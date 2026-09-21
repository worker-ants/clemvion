# 문서화(Documentation) 리뷰

## 범위

`codebase/backend/test/helpers/concurrency.ts` 신규 추출(`raceUnderHeldLock()`) + 9개
`*-delete-concurrency.e2e-spec.ts`/`member-remove-concurrency.e2e-spec.ts` 리팩터 + `PROJECT.md`
e2e 가이드 갱신 + `plan/in-progress/e2e-race-helper.md`. 프로덕션 코드(`codebase/backend/src/**`)
변경 0건인 순수 테스트 인프라 리팩터. `review/code/2026/09/21/20_26_50/**` ·
`review/consistency/2026/09/21/19_59_55/**` 는 이 작업이 통과해야 했던 선행 리뷰/컨벤션 게이트의
정상 산출물이며 문서화 리뷰 대상 코드가 아니라 컨텍스트로만 확인했다.

이 diff 는 **직전 코드 리뷰 라운드(`20_26_50`)가 지적한 WARNING/INFO 를 반영한 결과물**로 보인다.
그 라운드의 documentation 리뷰(`review/code/2026/09/21/20_26_50/documentation.md`)가 낸 WARNING
("`PROJECT.md` 가 신규 헬퍼를 언급하지 않는다")이 이번 diff 의 `PROJECT.md:337-342` 로 해소돼
있음을 실제 파일(`Read`)로 확인했다.

## 발견사항

- **[INFO]** `raceUnderHeldLock()` 의 `@throws` 가 세 번째 암묵적 실패 경로(락 획득 쿼리 자체의
  실패)를 문서화하지 않음
  - 위치: `codebase/backend/test/helpers/concurrency.ts` — `@throws` 두 줄(함수 시그니처 바로 위,
    `fires.length < 2` 및 공허성 가드 실패를 다룸) vs `locker.query('BEGIN')`/`locker.query(lock.sql, lock.params)`
    (함수 본문, `try` 블록 진입 직후)
  - 상세: JSDoc 은 두 개의 명시적 `throw new Error(...)` 경로(입력 검증, 공허성 가드)는 정확히
    문서화하지만, `locker.query(...)` 자체가 reject 하는 경우(예: 잘못된 SQL, 커넥션 문제)도
    함수 밖으로 전파된다. 실무 영향은 낮다 — 11개 호출부 전부 정적으로 유효한 SQL 을 넘기므로
    실제로 이 경로를 타는 시나리오는 드물고, `@throws` 를 "이 함수가 명시적으로 검증해 던지는 것"
    으로 범위를 좁게 잡는 것도 합리적 해석이다.
  - 제안: 필요하면 `@throws` 에 "`lock` 쿼리 자체가 실패하는 경우"를 한 줄 추가. blocking 은 아님.

- **[INFO]** CHANGELOG 미갱신은 올바른 판단으로 확인됨(발견사항 아님, 검증 기록)
  - 위치: `CHANGELOG.md` (미변경)
  - 상세: `CHANGELOG.md` 의 기존 항목은 전부 프로덕션 동작 변경(버그 수정·behavior change)만
    기록하는 컨벤션이다(`git log`/파일 스캔으로 확인). 이번 PR 은 `spec_impact: none`·
    `codebase/backend/src/**` 변경 0건의 순수 테스트 헬퍼 추출이라 CHANGELOG 대상이 아니다 —
    누락이 아니라 정확한 스코프 판단.

## 확인한 항목 (문제 없음)

- **`PROJECT.md` 갱신 정확성**: `PROJECT.md:337-342` 가 새 헬퍼 시그니처(`raceUnderHeldLock(locker, lock, fires)`),
  왜 헬퍼를 써야 하는지(공허성 가드 없으면 조용히 거짓 초록), `locker`/`db` 커넥션 분리 이유,
  실제 선례 파일 목록, `integration-rotate-concurrency.e2e-spec.ts` 제외 사유까지 정확히 담고 있다.
  "선례 9파일: `*-delete-concurrency.e2e-spec.ts` · `member-remove-concurrency.e2e-spec.ts`" 서술도
  실제 디렉터리 목록(`ls codebase/backend/test/*concurrency*`)과 대조해 정확했다 — glob 에 안 걸리는
  `member-remove-concurrency.e2e-spec.ts` 를 별도로 명시한 것도 맞다.
- **JSDoc 최신성 재확인**: 직전 리뷰 라운드가 지적했던 "`@throws` 가 `fires.length < 2` 경로를
  누락"이라는 INFO 는 현재 파일 상태와 대조 결과 **이미 해소돼 있었다** — `@throws` 두 줄이
  두 명시적 throw 경로를 모두 정확히 서술한다.
- **중복 서술 해소 확인**: 직전 라운드가 지적한 "`VACUITY_GUARD_MS` 선택 근거가 인라인 주석과
  JSDoc 두 곳에 중복"·"상수 선언이 사용부보다 아래" 두 건은 이번 diff 에서 함께 해소됐다 —
  상수가 함수 정의 위(17번째 줄)로 옮겨졌고, 함수 본문 주석(81-83번째 줄)이 "대기 시간의 근거는
  `VACUITY_GUARD_MS` 선언부에 한 번만 적는다"고 명시해 단일 출처를 코드로 못박았다. 추가로
  프로덕션 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)와의 관계를 모듈 로드 시점 `assert`(19-24번째 줄)로
  강제해, "손으로 지키는 불변식"이라는 아키텍처 리뷰의 우려까지 부수적으로 해소했다.
- **주석-코드 정합성**: 9개 e2e 파일 전체에서 헬퍼 위임을 알리는 신규 주석("공허성 가드는
  헬퍼가 건다 — `helpers/concurrency.ts`")이 실제 헬퍼 동작과 일치하고, 기존에 있던 도메인 설명
  주석(예: `auth-config-delete-concurrency.e2e-spec.ts:76` "둘 다 무락 `findById` 를 통과한 뒤 …")도
  그대로 보존돼 오래된 주석·불일치가 발견되지 않았다.
- **`plan/in-progress/e2e-race-helper.md`**: frontmatter(`spec_impact: none`, `worktree` 명시)가
  컨벤션을 따르고, §B 실측 표·§C 판별 실험(음성 대조군 예측/실측)·체크리스트가 근거를 구체적으로
  남긴다. 마지막 세 항목(`/ai-review` 수렴·`--impl-done`·트래커 이관)이 미체크인 것은 이 리뷰가
  그 첫 항목을 수행 중인 정상적인 진행 상태다.
- **API/설정 문서**: 프로덕션 API 엔드포인트·환경변수·설정 옵션 변경 없음 — 해당 카테고리
  문서화 요구 없음.

## 요약

이번 변경은 9개 e2e 동시성 테스트에 손으로 복제돼 있던 "공허성 가드" 오케스트레이션을
`raceUnderHeldLock()` 으로 추출하는 순수 테스트 리팩터이며, 문서화 관점에서는 직전 리뷰
라운드가 낸 WARNING(신규 헬퍼가 `PROJECT.md` e2e 가이드에 없음)이 정확하고 완전하게 해소된
상태로 확인된다. 그 과정에서 상수 선언 위치·근거 중복 등 부수 INFO 도 함께 정리됐고, 프로덕션
상수와의 관계를 주석이 아니라 런타임 assert 로 고정한 점은 문서 자체가 스스로를 검증하게 만든
좋은 관행이다. 헬퍼의 JSDoc(모듈 목적·`@param`/`@returns`/`@throws`/`@example`)은 모범적인
수준이고, CHANGELOG 미갱신은 프로젝트 컨벤션과 일치하는 올바른 판단이다. 남은 것은 `@throws`
가 락 쿼리 자체의 실패 경로까지는 다루지 않는다는 극히 경미한 INFO 하나뿐이며 이는 blocking
사유가 아니다.

## 위험도

LOW

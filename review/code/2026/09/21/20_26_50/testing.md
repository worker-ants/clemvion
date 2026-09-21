# 테스트(Testing) 리뷰 — `raceUnderHeldLock()` 동시성 e2e 헬퍼 추출

## 리뷰 범위

`codebase/backend/test/helpers/concurrency.ts` 신설 + 9개 파일 11개 블록
(`auth-config-` · `integration-` · `member-remove-`(2) · `model-config-` · `schedule-` ·
`trigger-` · `webauthn-credential-`(2) · `workflow-` · `workspace-delete-concurrency.e2e-spec.ts`)
을 `raceUnderHeldLock()` 호출로 전환한 순수 테스트 리팩터. 프로덕션 코드(`codebase/backend/src/**`)
변경 없음. `plan/in-progress/e2e-race-helper.md`, `spec_impact: none`.

검증을 위해 실제 저장소 파일(`concurrency.ts`, `webauthn-credential-delete-concurrency.e2e-spec.ts`,
`plan/in-progress/e2e-race-helper.md`)을 `Read`/`grep` 으로 직접 열람했고, 전 11개 호출부의
`raceUnderHeldLock` 사용 개수를 `grep -c` 로 세어 9파일 11블록 전환이 실제로 완료됐음을
확인했다(`integration-rotate-concurrency.e2e-spec.ts` 만 의도적으로 제외되어 여전히
인라인 `Promise.race` 를 씀). `_test_logs/e2e-20260921-202202.log` 에서
`Tests: 378 passed, 378 total` 및 9개 concurrency 스위트 전부 `PASS` 를 확인했다.
저장소에 어떤 파일도 쓰거나 수정하지 않았다(`git status --short` 상 리뷰 산출물 디렉터리
외 변경 없음 — 뮤테이션 테스트를 직접 재실행하지 않았다).

## 발견사항

- **[INFO]** 공유 헬퍼(`raceUnderHeldLock`) 자체에 대한 독립 단위 테스트가 없다
  - 위치: `codebase/backend/test/helpers/concurrency.ts` (함수 전체, 38~81번 줄)
  - 상세: 이 헬퍼는 9개 e2e 스위트 11개 블록이 공유하는 단일 지점이 됐다. 현재는 각 e2e
    호출부를 통해서만 간접적으로 행사되며, `fires.length < 2` 가드 절(43~48번 줄)은
    실제 호출부가 전부 정확히 2개를 넘겨주므로 어떤 테스트에서도 도달하지 않는다.
    다만 이 헬퍼는 실제 `pg.Client` 트랜잭션·락 타이밍에 의존하므로 "고전적" 단위
    테스트(모킹된 `Client`)로 만들면 오히려 실제 Postgres 락 동작과의 괴리(허위 안전감)를
    만들 위험이 있다 — 그래서 CRITICAL/WARNING 이 아니라 INFO 로 남긴다.
  - 제안: 필요하다면 `fires.length < 2` 케이스만이라도 순수 동기 가드이므로 mocked
    `Client`(query 를 스파이만) 로 저비용 단위 테스트를 추가할 수 있다. 필수는 아니다 —
    plan 이 이미 훨씬 강한 증거(9-스위트 뮤테이션 음성 대조군, 아래 참고)로 헬퍼의 핵심
    행동(공허성 가드)을 실측 검증했다.

- **[INFO]** 공허성 가드 실패 시 스택 위치가 호출부가 아니라 헬퍼 내부로 수렴한다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:70` (`expect(raced).toBe('pending')`)
  - 상세: `expect` 를 헬퍼 안에 넣어 11개 호출부의 중복을 제거한 설계는 타당하지만,
    부작용으로 가드가 실패했을 때(겹침이 안 만들어졌을 때) Jest 실패 위치가 항상
    `helpers/concurrency.ts:70` 한 곳으로 보고된다. 어느 e2e 파일에서 실패했는지는 Jest
    가 함께 출력하는 호출 스택으로 구분 가능하므로 실무상 디버깅이 막히진 않지만, 리팩터
    이전에는 실패 지점이 각 파일의 `expect(raced)...` 줄이라 파일명이 바로 보였다는 점에서
    약간의 가독성 저하는 실재한다.
  - 제안: 조치 불필요(트레이드오프로 수용 가능). 필요하면 에러 메시지에 `lock.sql` 일부를
    포함해 어떤 락이 실패했는지 표시하면 더 좋아질 수 있다(선택 사항).

- **[INFO]** 헬퍼는 `fires` 3개 이상 케이스를 문서(`@param fires` "2개 이상")로는 지원한다고
  선언하지만 실제로 행사되는 경우는 전부 정확히 2개뿐이다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:25-26` (JSDoc) vs 11개 호출부 전체
  - 상세: 일반화된 시그니처(`Array<() => Promise<T>>`, 최소 2개)이지만 현재 9파일 11블록
    호출부 전부 정확히 `[fireX, fireX]` 또는 `[() => fireDelete(idA), () => fireDelete(idB)]`
    형태로 길이 2다. N=3 이상에서 `Promise.all`/정렬 계약이 실제로 원하는 대로 동작하는지는
    아직 어떤 테스트로도 확인되지 않았다.
  - 제안: 조치 불요 — YAGNI. 3자 이상 겹침을 다루는 새 e2e 가 추가될 때 그 자리에서 검증되면
    충분하다. 지금 미리 커버리지를 추가할 필요는 없다.

## 확인한 강점 (참고용, 결함 아님)

- **회귀 방지가 실측 기반이다.** `plan/in-progress/e2e-race-helper.md` 체크리스트(100~105번 줄)가
  "헬퍼에서 락 쿼리를 제거하는 뮤턴트 → 예측 11 RED / 실측 11 RED, 실패 사유까지
  `Received: settled` 로 확인" 을 기록했고, `_test_logs/e2e-20260921-202202.log` 에서
  `Tests: 378 passed, 378 total` 과 9개 concurrency 스위트 전부 PASS 를 직접 확인했다 —
  "전부 GREEN" 만으로는 못 얻는, 공허성 가드가 11개 블록 전부에서 살아있다는 판별력 있는
  증거다. 이는 이 프로젝트가 반복적으로 겪은 "조용히 약해지는 테스트" 결함 클래스에 대한
  정확한 대응이다.
- **단언은 하나도 바뀌지 않았다.** 각 파일 diff 를 실제 소스와 대조한 결과, 사라진 것은
  헬퍼로 이동한 `expect(raced).toBe('pending')` 11건뿐이고, 상태 코드/에러 코드/감사 로그
  카운트에 대한 도메인 단언은 전부 원문 그대로 호출부에 남아 있다. 각 파일이 서로 다른
  성공 코드(200/204)·에러 코드(`RESOURCE_NOT_FOUND`/`MODEL_CONFIG_NOT_FOUND`/
  `MEMBER_NOT_FOUND`/`NOT_A_MEMBER`/`WEBAUTHN_CREDENTIAL_NOT_FOUND`)를 여전히 정확히
  구분해서 검증한다.
- **`integration-rotate-concurrency` 제외 판단이 타당하다.** 실제로 grep 만으로는 같은
  구조로 보이지만(단일 fire, `UPDATE`-병합 축) 본문을 읽어야 다른 축임을 알 수 있는 사례이고,
  plan 이 그 grep-오판→정정 경위를 §B 에 남긴 점도 근거 추적성이 좋다.
- **테스트 격리는 그대로 유지된다.** 헬퍼 자체는 모듈 스코프 가변 상태를 갖지 않고
  (`VACUITY_GUARD_MS` 상수 하나뿐), 각 e2e 스위트는 독립된 `db`/`locker` 커넥션과
  `uniqueEmail`/`uniqueName` 격리를 그대로 쓴다. 헬퍼 도입으로 인한 스위트 간 의존성은
  발생하지 않는다.
- **Mock 을 쓰지 않는 것이 적절하다.** e2e 성격상 실제 Postgres 트랜잭션/락으로 겹침을
  강제하는 현재 방식이 유일하게 신뢰할 수 있는 방법이며(`workspace-delete-concurrency.e2e-spec.ts`
  주석이 지적하듯, mock 기반 단위 테스트는 "멤버 행도 함께 사라진다" 류의 현실을 재현하지
  못했던 전례가 있다), 리팩터가 이 구조를 그대로 보존했다.

## 요약

프로덕션 코드 변경 없이 9개 e2e 파일 11개 블록에 손으로 복제돼 있던 "BEGIN→락→발사→공허성
가드→COMMIT→finally" 보일러플레이트를 `raceUnderHeldLock()` 헬퍼로 추출한 리팩터다. 도메인
단언은 전부 원문 그대로 보존됐고, 이 리팩터의 핵심 위험(헬퍼가 조용히 락/가드를 빠뜨려 결함
탐지력을 잃는 것)에 대해 음성 대조군 뮤테이션 테스트(락 쿼리 제거 → 11/11 RED, 실패 사유까지
확인)로 판별력 있는 증거를 남겼고, 전체 e2e 스위트(378/378)로 회귀 없음도 확인했다(로그 파일
직접 대조). 남은 갭은 전부 INFO 수준(헬퍼 자체의 독립 단위 테스트 부재, 실패 시 스택이 헬퍼
내부로 수렴, N≥3 fires 미검증)이며 착수를 막을 사안이 아니다.

## 위험도

NONE

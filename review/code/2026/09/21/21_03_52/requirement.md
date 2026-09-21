# 요구사항(Requirement) 리뷰 — `raceUnderHeldLock()` e2e 동시성 헬퍼 추출 (누적 diff, 3라운드째)

## 검토 범위 요약

`origin/main` 대비 누적 diff: `codebase/backend/test/helpers/concurrency.ts`(신규) + 9개 파일
11블록의 인라인 `BEGIN → 락 → Promise.all(발사) → 1.5초 공허성 가드(Promise.race) → COMMIT →
finally(ROLLBACK+drain)` 블록을 `raceUnderHeldLock(locker, lock, fires)` 호출로 치환, `PROJECT.md`
e2e 가이드 갱신, `plan/in-progress/e2e-race-helper.md` 신설, 그리고 앞선 두 리뷰 라운드
(`review/code/2026/09/21/20_26_50/**`, `20_45_43/**`) 산출물이 함께 diff 에 실려 있다.
`codebase/backend/src/**` 변경 0, `spec_impact: none`.

이번 라운드는 앞선 두 라운드가 지적한 항목이 실제로 반영됐는지 저장소 원본 파일(`Read`/`grep`,
저장소 뮤테이션 없음 — 종료 시 `git status --short` 로 재확인, untracked 리뷰 산출물 디렉터리 외
변경 없음)을 직접 열어 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 대상 미검출.

### 검증 근거 (INFO 수준 관찰 포함)

- **[INFO] 관련 spec 문서 부재 — spec fidelity 회색지대**
  - 위치: `spec/` 전역 grep — `raceUnderHeldLock`·`공허성 가드`·`VACUITY_GUARD` 매칭 0건
  - 상세: 이 변경은 테스트 인프라(e2e 헬퍼 추출)이고 API 시그니처·에러 코드·상태 전이·비즈니스
    규칙을 하나도 바꾸지 않는다. 9개 파일 11블록의 `expect(...)` 단언 값(상태 코드·에러 코드
    문자열 `RESOURCE_NOT_FOUND`/`MODEL_CONFIG_NOT_FOUND`/`MEMBER_NOT_FOUND`/`NOT_A_MEMBER`/
    `WEBAUTHN_CREDENTIAL_NOT_FOUND`/`WORKSPACE_NOT_FOUND`)를 직접 열어 대조한 결과 리팩터 전후
    문자 그대로 동일했다. `spec_impact: none` 선언 및 `--impl-prep` consistency-check
    (`review/consistency/2026/09/21/19_59_55/SUMMARY.md`, BLOCK:NO·Critical 0·Warning 0)와
    일치한다.
  - 제안: 조치 불요 — spec 누락이 아니라 spec 이 관여할 층이 아님(테스트 하네스 리팩터).

- **[INFO] 라운드 2 WARNING(아키텍처 결합도)은 "고침"이 아니라 "명시적 기각"으로 종결됨**
  - 위치: `codebase/backend/test/helpers/concurrency.ts:4, 12-14` (import + `KNOWN_LOCK_TIMEOUTS_MS`),
    커밋 `905e1f696` 메시지
  - 상세: `review/code/2026/09/21/20_45_43/SUMMARY.md` WARNING #1 은 "범용 테스트 헬퍼가 트리거
    도메인 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)를 직접 import 하는 결합도"를 지적했다. 개발자는
    이 결합 자체는 고치지 않고("테스트가 프로덕션 상수를 임포트하는 것은 drift 를 막는 정상
    수단이고, 상수가 옮겨지면 컴파일 에러로 즉시 깨진다") **JSDoc 문구의 범위만** 좁혔다
    (`concurrency.ts:23-25`: "검사 범위는 «프로덕션 전체의 최소 상한» 이 아니라
    `KNOWN_LOCK_TIMEOUTS_MS` 에 적힌 것뿐"). 함께 지적된 `@example` 숫자 비교자 누락(`:74`)과
    `@throws` 락 쿼리 실패 경로 누락(`:63`)은 실제로 코드에 반영돼 있음을 직접 확인했다.
    결합도 자체는 "선택, blocking 아님"으로 명시된 WARNING이었으므로 미해소가 게이트 위반은
    아니나, 요구사항 관점에서 **"검증 범위가 실제 구현과 일치하는가"**는 이제 정확히 일치한다 —
    이전엔 주석이 "가장 짧은 상한"이라 보장 이상을 말했지만 지금은 "알려진 것만" 이라 정확하다.
  - 제안: 조치 불요(라운드 2 WARNING 은 아키텍처 카테고리이며 요구사항 관점에서 재차단 사유
    아님). 이 관찰은 다음 라운드 reviewer 가 "왜 아직 결합이 남아있냐"고 재지적하지 않도록
    경위를 기록해 둔다.

## 기능 완전성 / 엣지 케이스 / 반환값 / 에러 시나리오 재검증 (직접 파일 열람)

- **1:1 동치성 재확인**: `codebase/backend/test/helpers/concurrency.ts` 전체(116줄)를 직접 읽고
  9개 파일(`auth-config`·`integration`·`member-remove`(2블록)·`model-config`·`schedule`·
  `trigger`·`webauthn-credential`(2블록)·`workflow`·`workspace-delete-concurrency`)의 실제
  `raceUnderHeldLock` 호출부·`expect(...)` 문을 열어 확인 — 11개 호출 전부 락 SQL·params·
  발사 thunk·정렬 로직·에러 코드 단언이 원본 그대로 보존됐다.
- **블록 수 실측 재확인**: `grep -c raceUnderHeldLock`으로 9개 파일에서 import 1줄 + 호출부
  (member-remove·webauthn 각 2, 나머지 7개 파일 각 1) = **11개 호출부**를 직접 카운트해
  plan 문서(§B)의 "아홉 파일 11블록" 서술과 정확히 일치함을 확인.
  - 부수 확인: `let pending`/`locker.query('BEGIN'|'COMMIT'|'ROLLBACK')` 인라인 패턴이 9개
    리팩터 대상 파일에서는 완전히 사라졌고, 의도적으로 제외된
    `integration-rotate-concurrency.e2e-spec.ts` 에만 남아 있다 — 제외 결정과 실행 일치.
- **`integration-rotate-concurrency` 제외 타당성 실측**: 해당 파일을 직접 열어 확인 — 요청을
  **하나만**(`rotateB`) 발사하고 상대편은 `locker` 트랜잭션 안의 `UPDATE`(donor 암호문 복사)가
  대신하며, `donorCipher` 를 **COMMIT 이전** `db`(별도 커넥션)로 읽는 구조라 `raceUnderHeldLock`
  의 "락 → 발사 → 가드 → COMMIT" 단순 형태에 들어맞지 않는다. plan §B 의 제외 근거와 실제 코드가
  일치한다.
- **`VACUITY_GUARD_MS`(1_500) < `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5_000) 수치 검증**:
  `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 에서 실제 상수값 5000 을
  확인 — 헬퍼의 module-load 시 assert(`VACUITY_GUARD_MS >= timeoutMs` 이면 throw)가 통과하는
  것이 우연이 아니라 실측 기반임을 재확인.
- **엣지 케이스**: `fires.length < 2` 는 `BEGIN` 이전 동기 검증이라 트랜잭션 누수 없이 즉시
  throw. `pending` 이 `BEGIN`/`lock.sql` 실패로 채워지지 않아도 `finally` 의
  `pending?.catch(...)` 가 optional chaining 으로 안전. `webauthn` 둘째 블록(서로 다른
  `idA`/`idB` thunk)만 유일한 비대칭 케이스인데 `Array<() => Promise<T>>` 시그니처가 이를
  올바르게 수용함을 실제 코드(`[() => fireDelete(idA), () => fireDelete(idB)]`)로 확인.
- **반환값**: 모든 코드 경로(정상 완료 / 입력 검증 실패 / 락 쿼리 실패 / 공허성 가드 실패)에서
  `T[]` 반환 또는 명시적 throw 뿐, 암묵적 `undefined` 반환 경로 없음.
- **TODO/FIXME/HACK/XXX**: `concurrency.ts` + 9개 spec + plan 문서 전체 grep 0건.
- **spec 언급 0건**: `spec/` 전역에 이 헬퍼·공허성 가드 용어에 대한 언급이 없어 spec 층이 관여할
  변경이 아님을 뒷받침(위 발견사항 참고).

## 요약

3라운드째 누적 diff를 저장소 원본 파일 직접 열람으로 재검증한 결과, 이전 두 라운드(`20_26_50`
문서화 WARNING, `20_45_43` 아키텍처 WARNING + INFO 2건)가 지적한 항목은 각각 (1) `PROJECT.md`
e2e 가이드에 헬퍼 소개 추가로 실제 반영됨, (2) `@example` 숫자 비교자·`@throws` 누락 경로는
코드에 반영, 도메인 상수 import 결합도는 근거를 남기고 명시적으로 기각 — 이 세 항목 모두 현재
코드 상태와 커밋 메시지로 직접 확인했다. 9개 파일 11블록의 단언·정렬 로직·에러 코드는 리팩터
전후 완전히 동일함을 재확인했고, 의도적으로 제외한 `integration-rotate-concurrency` 도 실제
코드 구조(단일 발사 + COMMIT 전 읽기)가 제외 근거와 일치한다. spec 문서가 관여하는 층이
아니라는 판단도 전역 grep 으로 재확인했다. CRITICAL/WARNING 신규 발견 없음.

## 위험도

NONE

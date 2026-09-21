# 요구사항(Requirement) 리뷰 — race-helper-guard-tests

## 검증 방법 (저장소 트리 비변경)

- `codebase/backend`: `npx jest --config jest.config.ts src/shared/testing/overlap-preconditions.spec.ts` 직접 실행 → **11 tests passed**, unit 러너(`rootDir: 'src'`)가 실제로 신규 self-spec 을 수집·실행함을 실측 확인.
- 저장소 밖 `mktemp -d` 스크래치 사본에서 `guardMs >= timeoutMs` → `guardMs > timeoutMs` 로 1개 뮤턴트를 넣고 재실행 → `가장 짧은 상한과 같으면 던진다` 테스트가 예측대로 RED. plan §C 표의 뮤턴트 B 예측(RED 1)과 일치.
- `npx tsc --noEmit -p tsconfig.json` — 변경 파일 관련 타입 에러 0.
- 검증 후 `git status --short` 로 저장소가 원상태(리뷰 산출물 디렉터리 외 변경 없음)임을 확인 — 스크래치 사본은 검증 직후 삭제.

## 발견사항

- **[INFO]** 에러 메시지에서 `raceUnderHeldLock:` 접두어가 사라짐 (동작상 회귀 아님)
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` 함수 `assertEnoughFiresForOverlap`/`assertGuardBelowKnownTimeouts` 의 `throw new Error(...)` 리터럴 — 프롬프트 게이트 27-29행, 53-57행
  - 상세: 원래 `test/helpers/concurrency.ts` 안에 있던 두 검사는 메시지에 `raceUnderHeldLock: ` 접두어를 붙였다(원본: `` `raceUnderHeldLock: 겹침을 만들려면 thunk 가 2개 이상이어야 한다 (받은 수: ${fires.length})` ``). 순수 함수로 추출되며 이 접두어가 빠졌다. 현재 유일한 호출부는 여전히 `raceUnderHeldLock` 뿐이라 실질적 디버깅 저하는 작지만, 함수가 호출부-불특정 문구로 실패하면 향후 다른 호출부가 이 헬퍼를 재사용할 때(설계 의도상 재사용 가능하도록 만듦) 어느 헬퍼에서 터졌는지 메시지만으로 구분이 안 된다. 코드가 틀렸다기보다 재사용성과 진단성의 트레이드오프이며, 관련 e2e 9개 파일 어디에도 이 메시지 문자열을 단언하는 곳이 없어 회귀는 아니다(grep 확인).
  - 제안: 필요시 호출부에서 메시지에 컨텍스트를 덧붙이거나(`catch` 후 rethrow), 현행 유지도 무방 — 강제 조치 사항 아님.

- **[INFO]** spec fidelity — 이 변경 영역은 `spec/` 문서가 아니라 `PROJECT.md`(테스트 하네스 컨벤션 SoT)가 규율
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts:8` 주석("자리 근거...는 `PROJECT.md §파일 위치·명명` 한 줄이 SoT")
  - 상세: `spec/` 는 제품 요구사항을 다루고, e2e 헬퍼 파일 배치 컨벤션은 `PROJECT.md`가 SoT다. 해당 절 제목(`### 파일 위치·명명`, `PROJECT.md:327`)과 JSDoc의 참조가 정확히 일치하며, `PROJECT.md:332`에 추가된 예외 문구도 같은 diff 안에서 동시 갱신됐다 — 코드와 문서 SoT가 한 커밋 안에서 line-level 로 정합. 이번 diff는 `spec/`를 전혀 건드리지 않았고, 첨부된 consistency-check 산출물(`22_39_59/cross_spec.md` INFO #2)도 "도메인 spec 무관"으로 같은 결론을 냈다. CRITICAL 대상 아님 — 관련 spec 문서가 없는 회색지대로 INFO.

- **[INFO]** `assertEnoughFiresForOverlap(0)`은 이 가드가 아니라 다른 방어가 먼저 잡는 경계 — 문서화·테스트 모두 일치
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` JSDoc(게이트 18-21행) + `overlap-preconditions.spec.ts` 게이트 23-24행 주석
  - 상세: `fireCount=0` 이면 `Promise.all([])`가 즉시 resolve 돼 `raceUnderHeldLock`의 공허성 가드(`settled`)가 먼저 실패시킨다는 서술이 실제 함수 로직과 일치한다(`fireCount < 2` 이므로 이 가드도 함께 던지지만, 서술한 "다른 방어가 이미 잡는다"는 논리적으로 참). 실측으로 반증되는 지점 없음 — 정보성 확인.

기능적 결함, TODO/FIXME, 반환값 누락, 에러 경로 미정의, 엣지 케이스 미검증(빈 배열·경계값·최대값 등은 self-spec 이 명시적으로 커버)은 발견되지 않았다. `PROJECT.md:331` 예외 문구, `plan/in-progress/race-helper-guard-tests.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md:1895` 및 첨부된 두 차례 `--impl-prep` consistency-check 산출물(BLOCK:YES → BLOCK:NO) 은 서로 라인 레벨로 정합하고, plan 이 주장하는 수치(unit 471→472 스위트, 뮤턴트 4종 예측=실측)를 표본 재현(뮤턴트 B, 신규 spec 단독 실행)으로 검증했다.

## 요약

`raceUnderHeldLock`의 두 순수 동기 분기(발사 개수 하한·공허성 가드 상한 검사)를 `src/shared/testing/overlap-preconditions.ts`로 추출하고 self-spec으로 직접 행사한 리팩터로, 기존 동작(발사 2개 미만 시 예외, 공허성 가드가 알려진 락 타임아웃 이상이면 예외)을 그대로 보존하면서 "코드로 고정했지만 어떤 러너도 지나가지 않는다"는 종전 결함을 닫았다. `rootDir: 'src'` unit 러너가 신규 self-spec을 실제로 수집·실행함을 직접 실행으로 확인했고, 경계값(`>=` vs `>`) 뮤턴트도 예측대로 죽는 것을 확인했다. `tsconfig.build.json` exclude·`PROJECT.md` 예외 문구·기존 5쌍 선례와의 정합도 모두 실측 일치한다. 에러 메시지에서 `raceUnderHeldLock:` 접두어가 사라진 점은 회귀는 아니나 진단성 트레이드오프로 INFO 기록. 관련 `spec/` 문서는 없으며(테스트 하네스 컨벤션은 `PROJECT.md`가 SoT), 그 SoT와도 line-level 로 정합한다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE

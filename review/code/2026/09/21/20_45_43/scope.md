# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff origin/main HEAD --stat` 로 실제 diff(32개 파일)를 확인하고, 이번 세션의 마지막 커밋
`6b29435ac`(`docs(test): 헬퍼를 e2e 가이드에 넣고, 가드 대기 시간의 근거를 검사로 바꿨다`)를
`git show`로 단독 조회해 프롬프트에 실린 unified diff와 대조했다. 전체 브랜치 커밋
(`c95a983ac` → `8b3c81f7c` → `34d4e30b0` → `6b29435ac`)을 순서대로 확인해 각 파일이 어느
단계에서 어떤 목적으로 들어왔는지 추적했다. 이 리팩터가 닫는다고 주장하는 트래커 항목
(`plan/in-progress/spec-draft-nullable-notation-followups.md:5029` "동시성 e2e 아홉 파일의 공용
헬퍼를 추출한다 — 테스트 전용 PR")의 실재를 grep으로 확인했다. 저장소 파일은 건드리지 않았다
(`git status --short`는 이번 리뷰 세션 자신의 출력 디렉터리만 표시).

## 발견사항

- **[INFO]** 새 헬퍼에 plan이 명시하지 않은 방어 로직(`fires.length < 2` 가드)이 여전히 존재
  - 위치: `codebase/backend/test/helpers/concurrency.ts` — `raceUnderHeldLock` 함수 본문 도입부의
    `if (fires.length < 2) { throw new Error(...) }` (line-gate 없이 함수 시작부 기준, 이전
    리뷰 라운드의 `scope.md`가 `:43`으로 인용한 지점과 동일 자리)
  - 상세: 직전 리뷰 라운드(`review/code/2026/09/21/20_26_50/scope.md`)에서 이미 INFO로 지적됐고
    "조치 불요, 다음 확장 시 plan 체크리스트에 한 줄 기록 권장"으로 정리된 항목이다. 이번
    라운드의 fix 커밋(`6b29435ac`)은 이 가드의 `@throws` 문서화만 보강했을 뿐(적절) plan
    체크리스트에는 여전히 반영되지 않았다. 함수 자체의 목적에 종속된 5줄짜리 안전장치라
    범위 위반은 아니며, 재지적은 추적성 유지 차원의 참고용이다.
  - 제안: 조치 불요(직전 라운드 판정 유지). 트래커 종결 커밋에서 plan §D 근처에 한 줄
    추가하면 충분.

## 스코프 정합성 확인 (문제 없음)

- **fix 커밋(`6b29435ac`)이 정확히 이전 리뷰(`20_26_50`)의 지적사항에만 대응**: `PROJECT.md`
  추가(WARNING 1 해소), `concurrency.ts`의 `VACUITY_GUARD_MS` 선언 위치 이동 + 중복 근거 주석
  통합(INFO 2), 주석을 런타임 `assert`로 승격(INFO 1), `@throws` 보강(INFO 4). 이전 리뷰가
  "조치 불요"로 정리한 INFO 3·5·6·7·8·9(Jest `expect()` 내부 결합, spec 문서 부재, `fires.length<2`
  가드 plan 미기재, 헬퍼 단위테스트 부재, N≥3 미검증, consistency 산출물 포함)는 이번 커밋에서
  건드리지 않았다 — "필요한 것만, 요청받은 만큼만" 원칙과 정확히 일치.
  드라이브바이 리팩터링·무관한 정리 없음.
- **`PROJECT.md` 변경은 6줄 추가뿐**: 기존 헬퍼 소개 옆에 `raceUnderHeldLock` 한 항목을
  덧붙인 것으로, 절 구조·인접 서술·다른 절은 전혀 건드리지 않았다.
- **프로덕션 코드 변경 0 유지**: `codebase/backend/src/**` 전체 브랜치에서 변경 없음 —
  plan §D "프로덕션 코드 변경 0" 서술과 일치. `TRIGGER_DELETE_LOCK_TIMEOUT_MS` import는
  프로덕션 상수를 읽기만 할 뿐 프로덕션 파일을 수정하지 않는다.
  (`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`가 이미 같은 모듈에서
  `triggerConfigLockKey`를 import하고 있어 신규 test→src 결합이 아니다.)
- **단언(assertion) 변경 0 유지**: 9개 e2e spec 파일 전체 리팩터(`8b3c81f7c`)에서 상태 코드·
  에러 코드 기대값이 하나도 바뀌지 않았다. 사라진 것은 각 파일에 복제돼 있던
  `expect(raced).toBe('pending')` 11건뿐이며, 그것이 헬퍼로 옮겨간 가드 자체다.
- **`integration-rotate-concurrency` 제외 결정 유지**: 전체 브랜치 diff 어디에도 그 파일이
  등장하지 않음 — plan §B의 실측 근거("갱신 경합이라 축이 다르다")와 실행이 일치.
- **plan/review 산출물 포함은 게이트 정상 부산물**: `review/consistency/2026/09/21/19_59_55/**`
  (impl-prep 게이트, `refactor(test)` 커밋에 동봉)와 `review/code/2026/09/21/20_26_50/**`
  (직전 ai-review 라운드, fix 커밋에 동봉)는 모두 `CLAUDE.md`가 강제하는 프로세스 산출물이며
  각각 그 산출물을 만든 게이트 실행 시점의 커밋에 정확히 동봉됐다 — 무관한 파일 혼입이 아니다.
- **origin 추적성 확인**: plan이 닫는다고 주장하는 트래커 항목
  (`plan/in-progress/spec-draft-nullable-notation-followups.md:5029`)이 실제로 존재해,
  이 작업이 임의로 확장된 범위가 아니라 사전에 등재된 백로그 항목의 집행임을 확인했다.
- **임포트**: 이번 커밋에서 `concurrency.ts`에 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 단일 신규
  import만 추가됐고, 미사용 import나 불필요한 정리는 없다.
- **포맷팅·주석**: fix 커밋의 변경은 의미 있는 이동(선언 위치)과 통합(중복 주석 제거)뿐이며,
  무관한 줄의 공백·개행 재정렬은 관찰되지 않는다.

## 요약

이번 라운드(`6b29435ac`)는 직전 `/ai-review`(`20_26_50`)가 낸 WARNING 1건과 INFO 2건(선언
위치·중복 근거, `@throws` 문서화)에만 정확히 대응하는 정정 커밋으로, PROJECT.md 6줄 추가와
`concurrency.ts` 내부 재배치 외에 다른 파일을 건드리지 않았다. 전체 브랜치를 봐도 프로덕션
코드 변경 0, 단언 변경 0, `integration-rotate-concurrency` 제외 결정 유지 등 plan의 사전
실측·설계와 실행이 일치하며, 트래커 등재 항목의 실재도 확인했다. plan/consistency/ai-review
산출물이 diff에 포함된 것은 프로젝트가 강제하는 게이트의 정상 부산물이다. 유일하게 참고할
점은 `fires.length < 2` 가드가 여전히 plan 체크리스트에 명시적으로 기록되지 않았다는 것인데,
이는 직전 라운드에서도 이미 "조치 불요"로 판정된 사소한 항목이라 위험도에 영향을 주지 않는다.

## 위험도

NONE

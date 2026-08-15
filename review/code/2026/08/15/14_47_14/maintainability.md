# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `finalizeFailedExecution` 의 "형제와 동일한 guarded 경로" 주석이 이번 PR 이 고친
  바로 그 과대서술 문구 그대로 남아 있고, 반대편(극성이 다르다는) 캐비엇이 한쪽에만 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4990-4992`
    (diff 로 변경되지 않은 기존 줄 — `Read` 로 직접 확인. 대응 신규 JSDoc: 같은 파일 `4869-4879`)
  - 상세: `plan/in-progress/eia-db-wire-invariant.md` 는 이 PR 의 근본 원인을 *"자매
    `finalizeFailedExecution` 의 주석이 '형제와 동일한 guarded 경로' 라고 대칭을 주장하는데
    절반만 참이었다"* 로 명시한다. 실제로 `execution-engine.service.ts:4990` 의 문구
    (`// CRITICAL #1 — 형제 finalizeCancelledExecution 과 동일한 guarded 경로. DB 가 이미
    terminal 이면 0행 매칭 → false 반환, FAILED 로 재마킹하지 않는다.`)가 그 인용 원문과
    한 글자도 다르지 않다. 이번 PR 은 `finalizeCancelledExecution` 이 이제 `persisted` 를
    읽도록 구현을 "끌어올려" 그 문구의 표면적 주장(둘 다 guarded UPDATE 결과를 읽는다)은
    참으로 만들었다. 그러나 **`!persisted` 이후의 처리는 여전히 대칭이 아니다** —
    `finalizeFailedExecution` 은 무조건 skip 하는 반면 `finalizeCancelledExecution` 은 행을
    재조회해 상태에 따라 다시 emit 할 수도 있다(신규 JSDoc `4872-4879`, `4904-4914` 가 이
    "극성이 반대" 라는 점을 상세히 설명). 그 설명은 `finalizeCancelledExecution` 쪽에만
    있고, `finalizeFailedExecution` 쪽 주석은 여전히 "동일한 guarded 경로" 라고만 말해
    반대 방향 캐비엇이 없다. 이 저장소는 정확히 이 문구를 원인으로 같은 결함 클래스를
    이미 세 번 CRITICAL 로 잡았다고 스스로 기록하고 있어(plan 문서), 편도 캐비엇은 다음
    guarded-path 함수를 추가하는 사람이 `finalizeFailedExecution` 쪽만 보고 다시 복사할
    위험을 남긴다.
  - 제안: `finalizeFailedExecution:4990-4992` 주석에 한 줄 캐비엇 추가 — 예: "단, `!persisted`
    이후 처리는 극성이 반대다(자매는 재조회 후 조건부 emit, 이쪽은 무조건 skip) — 이 함수를
    본떠 새 guarded-path 를 만들 때 무조건 skip 을 기본으로 가정하지 말 것". 양방향 참조를
    만들면 한쪽만 읽고 복사하는 재발 경로가 줄어든다.

- **[INFO]** `finalizeGuarded` CANCELLED 분기가 `RETURNING` 후처리로 한 겹 더 두꺼워졌다 — 이미
  `13_58_27` 라운드가 지적하고 plan 이 의도적으로 defer 한 항목
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-676`
    (`finalizeGuarded`, 127줄짜리 함수의 일부)
  - 상세: `if (live.status === target)` → `if (target === CANCELLED)` → `if (affected > 0)` →
    `if (persistedDuration !== null)` / `if (persistedFinishedAt !== null)` 로 최대 4단
    중첩이다. 이번 diff 는 `toPersistedDate` 헬퍼 추출로 이전 라운드가 지적한 "날짜 파싱
    인라인 재발명"(W6)은 실제로 해소했지만, 중첩 자체를 평탄화하는 리팩터(W5, 별도 헬퍼로
    추출)는 하지 않았다. `plan/in-progress/eia-db-wire-invariant.md` "## 범위 밖" 절이
    "넓은 일괄 편집이 대상 밖 8곳을 조용히 바꿔 전량 되돌린 전례가 있다"는 근거로 이번
    PR 범위에서 명시적으로 제외했으므로 신규 결함으로 채점하지 않는다 — 다만 다음 손질
    때 반드시 가져갈 항목으로 재확인.
  - 제안: 조치 불요(이번 PR 범위). 후속 PR 에서 `result.raw[0]` → `{durationMs, finishedAt}`
    추출을 별도 private 헬퍼로 뽑는 안이 여전히 유효하다.

- **[INFO]** `createQueryBuilder` mock 체인 중복이 이번 diff 로 한 자리 더 늘었다 — 마찬가지로
  기 지적·defer 항목
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:79-87`,
    `:1319-1338`(신규), `:1385-1387`
  - 상세: `update/set/where/andWhere/setParameter/returning/execute` 전체를 갖춘 동일 mock
    리터럴이 diff 가 건드린 자리만 다시 3~4곳이다. 이 블록 자체의 주석(`:76-78`)이 "불완전한
    mock 은 TypeError 를 던지고 try/catch 안이면 테스트가 조용히 vacuous 해진다"고 위험을
    이미 경고하는데, 해법은 여전히 "각 자리에 손으로 필드 추가"다. `13_58_27` 라운드가 제안한
    공용 팩토리(`makeGuardedQueryBuilderMock`)는 plan 의 "범위 밖(등재됨)" 절에 명시적으로
    미루어져 있어 이번 라운드에서 새로 요구하지 않는다.
  - 제안: 조치 불요(이번 PR 범위). 다음에 프로덕션 체인에 메서드가 하나 더 늘면 정확히 같은
    실수(한 자리 누락)가 재발할 조건이 그대로 남아 있다는 점만 다시 표시해 둔다.

- **[INFO]** `returningSpy` 가 실제 사용 지점보다 훨씬 넓은 스코프(`describe` 블록 최상단)에
  `let` 선언돼 있다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:922`
    (선언), 실사용은 `:1318`, `:1325`, `:1367` (같은 `describe` 안의 단 하나의 `it` 에서만)
  - 상세: 선언과 사용 사이에 400줄 가까이 다른 테스트들이 끼어 있어, 이 변수가 그 사이의
    다른 테스트에도 영향을 주는지 확인하려면 파일을 훑어야 한다. 실제로는 단일 테스트
    지역 변수로 충분하다.
  - 제안: `let returningSpy` 선언을 제거하고 해당 `it` 블록 내부에서
    `const returningSpy = jest.fn().mockReturnThis();` 로 지역화. 사소한 가독성 개선이라
    긴급하지 않음.

## 요약

이번 diff 의 핵심 실질 코드 변경(`finalizeCancelledExecution` 의 guarded-UPDATE 결과 확인,
`finalizeGuarded` CANCELLED 분기의 `RETURNING` 되읽기, REST `durationMs` 추가, `toPersistedDate`
헬퍼 신설)은 네이밍·주석 스타일·기존 관용구(guarded UPDATE + 반환값 확인, `??` null 보존,
`toFiniteNumber`/`toPersistedDate` 자매 헬퍼)를 정확히 따르고 있고, 직전 라운드(`13_58_27`)가
지적한 항목 중 실제 결함이었던 것(날짜 파싱 인라인 재발명, W6)은 헬퍼 추출로 이번에 해소됐다.
남은 구조적 항목(중첩 5→4단, mock 팩토리 중복)은 plan 문서가 이미 근거를 대며 이번 PR 범위
밖으로 명시적으로 미뤄 뒀고 이번 diff 가 그 크기를 조금 더 키웠을 뿐이라 신규 CRITICAL/WARNING
급 결함으로 보지 않는다. 유일하게 새로 표시할 만한 항목은 이 PR 이야기의 핵심(자매 함수 주석의
"동일한 guarded 경로" 과대서술)을 절반만 닫았다는 점이다 — 구현은 그 문구를 참으로 만들었지만,
`!persisted` 이후 처리의 실제 비대칭(극성 반대)에 대한 캐비엇은 한쪽 함수에만 있다. 이 저장소가
같은 형태의 문서-구현 불일치로 이미 세 번 CRITICAL 을 겪었다는 점에서, 작은 편집(한 줄 캐비엇
추가)으로 재발 표면을 줄여 둘 가치가 있다.

## 위험도

LOW

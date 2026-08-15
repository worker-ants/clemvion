# 유지보수성(Maintainability) Review

## 검토 범위 요약

이 diff 는 `origin/main` 대비 누적분으로, 실질 코드 변경은 6개 파일 — `execution-engine.service.ts`
(`finalizeCancelledExecution`), `retry-turn.service.ts`(`finalizeGuarded` CANCELLED 분기),
`terminal-duration.ts`(`toPersistedDate` 신규), `interaction.service.ts`/`execution-status-response.dto.ts`
(`durationMs` REST 필드), 그리고 대응 `.spec.ts` 4개다. 나머지(CHANGELOG·spec·plan·`review/**`)는
문서/이전 리뷰 라운드 산출물이라 코드 유지보수성 관점에서는 대상이 아니다.

이 브랜치는 이미 두 차례(`13_58_27`, `14_47_14`) ai-review 를 거쳤고 각 RESOLUTION.md 가 조치를
주장한다. 그 주장을 재검증하지 않고 받아들이면 거짓일 수 있으므로, 아래 발견 중 "재확인" 항목은
`Read` 로 현재 소스를 직접 열어 대조했다.

## 발견사항

- **[INFO]** (재확인, 해소됨) `finalizeFailedExecution` 의 "형제와 동일한 guarded 경로" 주석에
  극성 반대 캐비엇이 이번 diff 에서 실제로 추가됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4993-4999`
    (`finalizeFailedExecution` 내부, `updateExecutionStatus` 호출 직전)
  - 상세: 직전 라운드(`14_47_14/maintainability.md` W1)가 "이쪽 주석엔 편도 캐비엇만 있다" 고
    WARNING 을 냈던 지점이다. 현재 소스를 직접 열어 대조한 결과, `finalizeFailedExecution`
    (4990-4999)에 *"`!persisted` 이후는 극성이 반대다 ... 이 함수를 본떠 새 guarded 경로를 만들
    때 무조건 skip 을 기본으로 가정하지 말 것"* 캐비엇이 실제로 들어갔고, `finalizeCancelledExecution`
    쪽(4903-4914)도 대칭으로 *"자매 `finalizeFailedExecution` 처럼 무조건 skip 하면 안 된다"*
    를 명시한다. 양방향 참조가 이제 실제로 존재한다.
  - 제안: 조치 불요 (확인 완료 — WARNING 재기재하지 않음).

- **[INFO]** `finalizeGuarded` CANCELLED 분기의 중첩 깊이 4단 — plan 이 이미 인지하고 이번 PR
  범위에서 명시적으로 제외한 항목
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-676`
    (`if (live.status === target)` → `if (target === CANCELLED)` → `if ((result.affected ?? 0) > 0)`
    → `if (persistedDuration !== null)`/`if (persistedFinishedAt !== null)`)
  - 상세: `.returning()` 되읽기 블록(658-674)이 `finalizeGuarded` 함수 안에 4단으로 얹혀, 이
    함수 하나가 "행 조회 → 멱등 판정 → CANCELLED/그 외 분기 → guarded UPDATE → RETURNING 파싱"
    을 모두 책임진다(함수 전체는 약 100줄). `plan/in-progress/eia-db-wire-invariant.md:94`("관용구
    16곳 헬퍼 추출 — 별도 PR, 넓은 일괄 편집이 대상 밖을 바꾼 전례")가 이 종류의 구조 정리를
    이미 별도 PR 로 명시 이관해 뒀다. 신규 결함이 아니라 기존에 있던 깊이가 `RETURNING` 파싱
    두 단을 더해 소폭 깊어진 것이다.
  - 제안: 조치 불요(이번 PR 범위 밖, 근거 문서화됨). 후속 PR 에서 `result.raw[0]` → 되쓰기를
    `applyReturnedRow(execution, row)` 류의 private 헬퍼로 뽑으면 4단이 2단으로 줄어든다.

- **[INFO]** `retry-turn.service.spec.ts` 의 `createQueryBuilder` mock 리터럴이 이번 diff 가
  건드린 자리에서만 4곳 중복
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:76-88`(전역
    기본 mock), `:1319-1338`(신규 테스트), `:1380-1389`(신규 테스트), `:1254`(기존 형제 블록)
  - 상세: `update/set/where/andWhere/setParameter/returning/execute` 7개 메서드를 갖춘 동일한
    mock 객체 리터럴이 파일 안에 손으로 4번 복제돼 있다. 인접 주석(76-78행 부근)이 "불완전한
    mock 은 TypeError → try/catch 안에서 조용히 vacuous 해진다"는 위험을 스스로 경고하는데도
    해법은 매번 "각 자리에 손으로 필드 추가"다 — 다음에 프로덕션 체인에 메서드가 하나 더
    늘면 정확히 같은 실수(한 자리 누락)가 재발할 조건이 그대로 남는다. 이 역시
    `plan/in-progress/eia-db-wire-invariant.md:94` 가 "16곳 헬퍼 추출"로 이미 인지·이관한
    항목이라 이번 PR 의 신규 결함으로 채점하지 않는다.
  - 제안: 조치 불요(이번 PR 범위 밖). 후속 PR 에서 `makeGuardedQueryBuilderMock(overrides)`
    같은 팩토리로 통합 권장.

- **[INFO]** `returningSpy` 가 단일 `it` 에서만 쓰이는데 `describe` 블록 최상단에 넓게 선언됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:922`(선언),
    `:1318`, `:1325`, `:1367`(유일한 실사용 지점, 모두 같은 테스트 안)
  - 상세: 선언과 사용 사이에 약 400줄의 다른 테스트가 끼어 있어, 이 변수가 그 사이 테스트에도
    영향을 주는지 확인하려면 파일을 훑어야 한다. 실제로는 해당 `it` 블록 내부의 `const` 지역
    변수로 충분하다. 기능·정확성에는 영향 없는 순수 가독성 이슈다.
  - 제안: `let returningSpy: jest.Mock;` 선언 제거 후 사용 지점에서
    `const returningSpy = jest.fn().mockReturnThis();` 로 지역화. 긴급하지 않음.

- **[INFO]** `finalizeCancelledExecution` 함수 하나가 "정상 종결 값 계산 → guarded UPDATE →
  0행 시 재조회 → 두 갈래 판정 → emit" 을 모두 수행 — 함수 길이·책임이 여전히 넓다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4884-4935`
    (`finalizeCancelledExecution`, 약 52줄 + 선행 JSDoc 28줄)
  - 상세: 이번 diff 로 "0행 → 재조회 → (a)/(b) 두 갈래" 로직이 이 함수 안에 새로 얹히면서 순환
    복잡도가 늘었다(분기 5개: `!persisted`, `live?.status !== CANCELLED`, 그리고 자매 함수와의
    대칭 판단까지 함수 하나가 짊어진다). 다만 이 로직은 이 PR 의 핵심 결함(사후 오시그널)을
    닫는 자리라 여기 흩어 두는 것 자체는 타당하고, JSDoc·인라인 주석이 각 분기의 "왜"를 상세히
    설명해 실제 가독성 저하는 제한적이다. `finalizeGuarded` 항목과 같은 성격의 부채이며 별도
    조치를 요구할 정도는 아니다.
  - 제안: 조치 불요(관찰 기록). 재조회+판정 블록(4914-4929)을 `resolveLiveCancelledFields`
    같은 private 헬퍼로 뽑으면 본 함수는 "판정 위임 + emit" 만 남아 더 짧아진다 — 위 헬퍼 추출
    후속 PR 때 함께 고려할 만하다.

## 확인했으나 문제 없음 (양호한 점)

- `terminal-duration.ts` 의 신규 `toPersistedDate` — 자매 `toFiniteNumber` 와 시그니처·null 처리
  관용구가 대칭이고, JSDoc 이 `{@link}` 로 자매를 명시 참조하며 도입 이유(인라인 재구현 금지,
  `13_58_27 maintainability W6`)까지 남긴다. "파싱은 한 곳에" 원칙을 정확히 지킨 모범 사례.
- `execution-status-response.dto.ts` 의 `durationMs` 필드 — JSDoc·`@ApiPropertyOptional`
  description·spec 예시 세 곳의 문구·example 값(`4242`)이 정확히 일치하고, 기존 `currentNode`
  필드와 동일한 "종결 전 null(키 present)" 관용구를 그대로 따른다.
- `interaction.service.ts`/`execution-engine.service.spec.ts` 의 신규 테스트(`(a)/(b)/(c)` 세
  갈래, `arrange`/`saved`/`run` 헬퍼) — 각 갈래가 "DB 가 실제로 뭐라고 하는지"를 `findOneBy` mock
  으로 명시해 "기본 mock 에 기대 통과 이유가 우연이 되는" 패턴을 피했다. 네이밍(`arrange`, `run`)도
  파일 내 기존 테스트 스타일과 부합.
- `finalizeCancelledExecution`/`finalizeFailedExecution` 양쪽 모두 `persisted` 라는 동일 변수명을
  같은 의미(guarded UPDATE 매칭 여부)로 써서 자매 함수 간 네이밍 일관성을 유지한다.

## 요약

이번 diff 의 실질 코드 변경은 기존 관용구(guarded UPDATE + 반환값 확인, `toFiniteNumber`/
`toPersistedDate` 자매 헬퍼, `persisted` 네이밍)를 정확히 따르고, 이전 두 라운드의 리뷰가 지적한
유지보수성 WARNING(자매 함수 주석의 편도 캐비엇 · 날짜 파싱 인라인 재발명)은 소스 직접 대조로
해소가 확인됐다. 남은 항목(`finalizeGuarded` 중첩 4단, mock 리터럴 4곳 중복, `returningSpy`
스코프, `finalizeCancelledExecution` 의 넓어진 책임)은 전부 plan 문서(`eia-db-wire-invariant.md`
"범위 밖(등재됨)" 절)가 근거를 대며 별도 PR 로 명시 이관해 둔 부채이거나 사소한 가독성 이슈라
CRITICAL/WARNING 급으로 보지 않는다. 새로 도입된 매직 넘버·네이밍 비일관·과도한 중복은 발견되지
않았다.

## 위험도

LOW

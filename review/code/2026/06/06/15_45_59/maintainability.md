# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 테스트 내 비공개 메서드 타입-캐스팅 중복
- 위치: `execution-engine.service.spec.ts` — `applyContinuation continue` 계열 테스트 3건 이상 (W5 블록 포함)
- 상세: `jest.spyOn(service as unknown as { rehydrateAndResume: ... }, 'rehydrateAndResume')` 패턴이 4회 반복된다. 타입 단언 인라인이 중복되며, 각 호출부에서 시그니처 타이핑을 개별 유지해야 해 나중에 시그니처가 바뀌면 산재된 위치를 모두 수정해야 한다.
- 제안: `getPendings` 처럼 단일 헬퍼(`spyRehydrate(service): jest.SpyInstance`)를 파일 상단 또는 describe 스코프에 추출하면 시그니처 변경 시 단일 지점 수정으로 해결된다.

### [INFO] `driveResumeTurn` 헬퍼의 반환 타입 구체성 부족
- 위치: `execution-engine.service.spec.ts` W5 블록 `driveResumeTurn` 함수
- 상세: 반환 타입이 `Promise<{ warnSpy: jest.SpyInstance; result: unknown }>` 으로 선언되어 있다. `result` 가 `unknown` 이므로 호출부에서 `typeof result === 'symbol'` 검사는 통과하지만, 미래 테스트 작성 시 result 의 의미를 헬퍼 서명만 보고 파악하기 어렵다.
- 제안: 주석에 "PARK_RELEASED(Symbol) 또는 void" 의미를 명시하거나, `symbol | void` 로 타입을 좁혀 의도를 드러낸다.

### [INFO] `noopQb` 로컬 변수 중복 정의 가능성
- 위치: `execution-engine.service.spec.ts` W9 테스트 내 `noopQb`
- 상세: `update/set/where/andWhere/execute` 체인 mock 객체가 인라인 정의된다. 같은 파일 내 다른 `createQueryBuilder` mock 들과 동일한 구조다. 파일 규모가 크므로 즉각적 추출 부담이 있지만, `makeNoopQb(affected = 0)` 같은 팩토리를 두면 반복을 줄일 수 있다.
- 제안: 단기 INFO 수준; 파일 전체 리팩토링 시 함께 추출 권장.

### [INFO] `makeCompletionGuard` 함수명 변경 — 주석과 함수명 불일치 가능성
- 위치: `execution-engine.service.spec.ts` 약 line 800 (`makeDeadlockGuard` → `makeCompletionGuard`)
- 상세: 함수명은 적절히 갱신됐으나, 내부 에러 메시지(`'HANG: rehydrateAndResume 가 반환하지 않음 — ...'`)가 새 모델("이제 await 됨")의 실패 원인을 충분히 설명한다. 이름 변경은 올바르며 문제 없음. 다만 에러 메시지가 `makeCompletionGuard` 임에도 단순 `HANG` prefix 를 쓰므로 "completion guard timeout" 이라는 의미가 더 명확할 수 있다.
- 제안: 에러 메시지를 `'TIMEOUT: driveResumeDetached 가 제한 시간 내 완결되지 않음'` 수준으로 갱신하면 실패 시 즉각적 이해가 가능하다.

### [INFO] `execution-engine.service.ts` — 삭제 코드 블록 내 인라인 주석 길이
- 위치: `execution-engine.service.ts` 약 line 1205 영역 (`exec-park D6 full B3 (2026-06-06) — in-memory continuation/barrier 머신 제거.`)
- 상세: 삭제된 `pendingContinuations`/`firstSegmentBarriers` 대체 설명 주석이 단일 주석 블록에 비교적 상세히 서술된다. 이는 결정 배경을 이해하는 데 유용하지만, spec 또는 plan 문서로 위임 가능한 내용이 코드에 혼재한다.
- 제안: 코드 주석은 `SoT: exec-park-durable-resume.md §B3` 참조 한 줄 수준으로 축약하고, 상세 배경은 spec Rationale 에서 읽도록 유도하면 코드 파일의 인지 부하가 줄어든다. 현재 spec/Rationale 에 상세 내용이 이미 존재하므로 중복 감소 여지가 있다.

### [INFO] `processFormResumeTurn` — 상태 전이 분기 가독성
- 위치: `execution-engine.service.ts` 약 line 4080 (`if (savedExecution.status === ExecutionStatus.RUNNING)`)
- 상세: `RUNNING→RUNNING assertTransition 회귀` 방지 목적의 분기가 `if/else` 로 작성됐다. 조건의 의미("이미 RUNNING 이면 NodeExecution 만 저장")가 코드 자체만으로 직관적이지 않다. 주석이 있어 보완되지만, 조건을 반전(`if (savedExecution.status !== ExecutionStatus.RUNNING)`)하면 "정상 경로 먼저, 예외 경로 나중" 패턴으로 읽기 수월하다.
- 제안: early-return 또는 조건 반전 고려. 혹은 `isAlreadyRunning` 로컬 변수로 의미 추출.

### [INFO] e2e 테스트 — 하드코딩된 타임아웃 상수
- 위치: `execution-park-resume.e2e-spec.ts` 신규 테스트 `}, 90_000)`
- 상세: 첫 번째 기존 e2e 테스트는 `60_000` 을 사용하고, 신규 중첩 sub-workflow 테스트는 `90_000` 을 사용한다. 두 값의 차이가 테스트 파일 내에서 이유를 설명하지 않아, 추후 유지보수자가 90초가 적절한지 판단하기 어렵다.
- 제안: 파일 상단에 `const NESTED_E2E_TIMEOUT_MS = 90_000; // 중첩 rehydration 경로 포함 — 단순 park 보다 왕복이 많아 여유 부여` 같은 이름 상수를 두면 의도가 명확해진다.

### [INFO] spec 문서 — 구현 메모 절의 단일 문단 길이
- 위치: `spec/5-system/4-execution-engine.md` — `구현 메모 — park = 세그먼트 종료` blockquote
- 상세: 갱신된 구현 메모 문단이 단일 `>` 블록 안에 수백 자를 담는다. spec 문서임을 감안해도 인라인 파싱이 어렵고, 섹션 제목/목록 구조 없이 흐른다.
- 제안: 긴급한 유지보수 이슈는 아니나, `### 구현 상태 (2026-06-06)` 등 별도 소제목 절로 분리하면 이후 편집이 용이하다.

---

## 요약

이번 변경은 `pendingContinuations` / `firstSegmentBarriers` / `firePayload` / `runAiConversationLoop` 등 복잡한 in-memory 머신을 제거하고 단일 §7.5 rehydration 경로로 일원화하는 대규모 단순화 리팩터링이다. 삭제 코드 대비 추가 코드가 적고, 복잡한 분기(`parkMode`/fast-path/detach)가 직접 `await`로 교체돼 전체적인 순환 복잡도가 낮아졌다. 주요 유지보수성 개선 요소인 `driveCallStackResume`·`processFormResumeTurn` 등 직접 처리기 분리는 단일 책임 원칙 측면에서 긍정적이다. 발견된 항목은 모두 INFO 수준으로, 테스트 내 `rehydrateAndResume` 스파이 패턴 4회 반복·인라인 타입 단언이 가장 눈에 띄는 중복이며 헬퍼 추출로 쉽게 해소 가능하다. 그 외 spec 문서의 단일 문단 과밀, e2e 매직 타임아웃, `noopQb` 인라인 반복은 향후 리팩터링 기회에 정리 권장 수준이다.

## 위험도

LOW

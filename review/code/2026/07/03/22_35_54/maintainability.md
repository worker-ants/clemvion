# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (M-4, `executeAsync` catch 블록 확장)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (M-4 신규 테스트 2건)

## 발견사항

- **[WARNING]** `runExecutionFromQueue` catch 블록과 `executeAsync` catch 블록의 `failFirstSegmentSetup` 2차 실패 처리 코드가 거의 동일하게 중복
  - 위치: `execution-engine.service.ts:2837-2858` (`runExecutionFromQueue`) 및 `execution-engine.service.ts:3383-3407` (`executeAsync`)
  - 상세: 두 곳 모두 `await this.failFirstSegmentSetup(executionId, err).catch((secondaryErr) => { this.logger.error(...) })` 패턴이 로그 메시지 문구까지 동일하게 반복된다(`failFirstSegmentSetup secondary error for ${executionId}: ...`). 주석도 "2차 실패는 fire-and-forget 컨텍스트라 재throw 시 unhandled rejection" 이라는 동일한 설명을 양쪽에 나란히 유지해야 한다. 이번 diff는 기존 큐 경로(W7)의 패턴을 그대로 복제(copy-paste)해 두 번째 사이트를 만든 것으로 보이는데, 향후 3번째 fire-and-forget 진입점(예: 다른 sub-workflow 트리거 경로)이 추가되면 동일 패턴이 또 복제될 가능성이 높다. 로직이 바뀔 때(예: 로그 포맷, 2차 실패 시 metrics 추가) 두 곳을 항상 동기화해야 하는 부담이 생긴다.
  - 제안: `private async runBestEffortFailFirstSegmentSetup(executionId: string, err: unknown): Promise<void>` 같은 private 헬퍼로 "호출 + 2차 실패 로깅" 쌍을 추출해 두 호출부(`runExecutionFromQueue`, `executeAsync`)가 한 줄로 위임하게 하면 향후 3번째 진입점 추가 시에도 재사용 가능하고 로그 포맷 drift 를 방지할 수 있다.

- **[INFO]** `executeAsync` catch 콜백이 `async` 화되면서 fire-and-forget 체인의 실행 시간이 길어짐 (기능적 이슈는 아니나 가독성/문서화 관점)
  - 위치: `execution-engine.service.ts:3383`
  - 상세: 기존에는 `.catch((err) => { this.logger.error(...) })` 로 동기 로깅만 하던 콜백이 이번 변경으로 `async (err) => { ...; await this.failFirstSegmentSetup(...).catch(...) }` 로 바뀌어 실질적으로 두 단계 비동기 흐름을 갖게 됐다. 함수 자체는 짧고 목적이 명확하지만, "fire-and-forget인데 내부적으로 await 체인이 있다"는 사실이 호출부(`executeAsync` 본문)만 봐서는 바로 드러나지 않는다. 다행히 주석(M-4 블록)과 스펙 테스트(`await new Promise((r) => setImmediate(r))` flush)가 이를 잘 보완하고 있어 심각하지 않다.
  - 제안: 현행 유지 가능. 위 WARNING 항목대로 헬퍼로 추출하면 이 흐름도 헬퍼 함수명(`runBestEffortFailFirstSegmentSetup` 등)에 의도가 자연히 드러나 가독성이 개선된다.

- **[INFO]** 테스트 파일의 캐스팅 타입 `M4AsyncFailSubject` 가 기존 컨벤션과 일관되게 별도 타입으로 로컬 선언됨
  - 위치: `execution-engine.service.spec.ts:40-47`
  - 상세: 파일 내 기존 `CheckpointSubject` (line 714) 패턴과 동일하게 "private 메서드를 spy 하기 위한 최소 캐스팅 타입"을 정의하는 방식을 따르고 있어 일관성 있다. 다만 `CheckpointSubject` 는 describe 블록 밖 상위 스코프로 승격된 반면(주석에 "W1 재사용 가능하게" 라고 명시), `M4AsyncFailSubject` 는 describe 안쪽 로컬(라인 40)에 선언되어 있다 — 현재는 2개 테스트에서만 쓰이므로 문제 없으나, 스코프 배치 기준이 "재사용 여부"로 파일 내에서 혼재되어 있다는 점은 참고할 만하다.
  - 제안: 조치 불필요 (현재 사용 범위에 맞는 스코핑으로 판단됨). 향후 3번째 사용처가 생기면 상위 스코프로 승격 고려.

- **[INFO]** 신규 테스트 2건의 이름·구조가 명확하고 목적이 잘 드러남
  - 위치: `execution-engine.service.spec.ts:49, 77`
  - 상세: 테스트명이 "M-4: runExecution setup throw 시 failFirstSegmentSetup 로 best-effort 마감" / "M-4: failFirstSegmentSetup 2차 실패는 로그로 흡수" 로 시나리오(정상 경로 vs 2차 실패 경로)를 명확히 구분하고, 각 테스트 내부 주석도 파일 상단 프로덕션 코드의 W7/M-4 설계 의도를 재인용해 테스트-구현 간 근거가 잘 연결되어 있다. `runSpy.mockRestore()` / `failSpy.mockRestore()` / `errorSpy.mockRestore()` 클린업도 누락 없이 수행됨.
  - 제안: 조치 불필요.

## 요약

이번 diff는 큐 기반 실행 경로(`runExecutionFromQueue`)에 이미 존재하던 "setup 단계 throw 시 `failFirstSegmentSetup` 로 best-effort 마감" 패턴을 fire-and-forget sub-workflow 경로(`executeAsync`)에도 동일하게 적용한 작지만 목적이 분명한 변경이다. 변경 자체는 가독성이 좋고(주석이 설계 근거·동일 계약 참조를 충실히 남김), 네이밍·테스트 구조도 기존 파일 컨벤션과 일관되며, 매직 넘버나 과도한 중첩·복잡도 문제는 없다. 유일한 개선 여지는 두 진입점(`runExecutionFromQueue`, `executeAsync`) 간 "2차 실패 로깅" 처리 코드가 문구까지 동일하게 복제된 점으로, 작은 private 헬퍼로 추출하면 향후 유사 진입점 추가 시 재사용성과 일관성이 더 좋아진다. 이는 즉시 조치가 필요한 수준은 아니며 후속 개선으로 처리 가능하다.

## 위험도

LOW

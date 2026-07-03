# 유지보수성(Maintainability) 리뷰

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `failFirstSegmentSetupBestEffort` 헬퍼 신설 + `executeAsync`/`runExecutionFromQueue` catch 위임
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — M-4 유닛 테스트 2건 추가
- `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md` — 상태 동기화 (문서, 코드 아님)
- `review/code/2026/07/03/22_35_54/{SUMMARY,RESOLUTION}.md` — 직전 리뷰 산출물 (본 리뷰 대상 코드 아님, 참고만)

이미 직전 리뷰(22:35:54)의 WARNING #1(중복)이 `failFirstSegmentSetupBestEffort` 헬퍼 추출로 해소된 상태의 코드를 실사(source read)로 재확인했다.

## 발견사항

- **[INFO]** 헬퍼 추출로 중복 제거 완료, 두 진입점이 동일 계약 공유
  - 위치: `execution-engine.service.ts:541-556` (헬퍼), 호출부 `:2872`(`runExecutionFromQueue`), `:3409`(`executeAsync`)
  - 상세: 이전 리뷰에서 지적된 "`failFirstSegmentSetup` 호출 + 2차 실패 로그 흡수" 쌍의 중복이 `private async failFirstSegmentSetupBestEffort(executionId, error)`로 정확히 추출됐다. 두 호출부 모두 한 줄 위임으로 축소되어 있고, 로그 문구·동작이 완전히 동일하게 유지된다. 헬퍼의 JSDoc(`:533-540`)도 "왜 전파하면 안 되는지"(double-exec 유발, unhandled rejection)를 명확히 설명한다. 3번째 진입점 추가 시 이 헬퍼로 자연스럽게 수렴 가능 — 향후 확장성도 좋음.
  - 제안: 조치 불필요. 모범적인 사후 리팩터링.

- **[INFO]** `executeAsync`의 `.catch(async (err) => {...})` 콜백이 fire-and-forget 안에서 `await`를 포함
  - 위치: `execution-engine.service.ts:3398-3410`
  - 상세: `this.runExecution(...).catch(async (err) => { ...; await this.failFirstSegmentSetupBestEffort(...); })` 형태로, catch 콜백 자체가 async 함수이며 반환된 Promise 는 아무도 await 하지 않는다(catch 체인 자체가 fire-and-forget). 헬퍼 내부에서 이미 모든 에러를 흡수(`.catch`)하므로 unhandled rejection 위험은 없지만, "fire-and-forget인데 내부에 await가 있다"는 형태는 최초 읽을 때 약간의 인지 부담을 준다. 다만 주석(`:3404-3408`)이 의도를 충분히 설명하고 있고, 동일 패턴이 큐 경로(`runExecutionFromQueue`, 이미 `try/await/catch` 구조)와도 정합적이라 실질 문제는 아니다. 직전 RESOLUTION.md에서도 이미 인지되고 수용된 트레이드오프.
  - 제안: 조치 불필요(참고 기록).

- **[INFO]** plan 문서(`06-concurrency.md`, `README.md`) 동시 변경은 코드 diff 와 성격이 다름
  - 위치: `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md`
  - 상세: 코드 유지보수성 관점 밖의 문서 동기화 변경으로, 실제 구현 상태(체크박스·집계 숫자)와 정합하게 갱신되어 있다. 형식·프로젝트 컨벤션(완료 근거 커밋 해시 기재 등)을 잘 따르고 있다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 유닛 테스트의 타입 캐스팅(`M4AsyncFailSubject`)
  - 위치: `execution-engine.service.spec.ts:40-47`
  - 상세: `service as unknown as M4AsyncFailSubject`로 private 메서드(`runExecution`, `failFirstSegmentSetup`)에 접근하기 위한 캐스팅. 기존 스펙 파일의 다른 private-메서드 스파이 테스트와 동일한 관용구를 따르고 있어 일관성 있음. 매직 넘버·과도한 중첩 없이 Arrange-Act-Assert가 명확하다.
  - 제안: 조치 불필요.

## 요약

이번 diff는 직전 리뷰(22:35:54 SUMMARY/RESOLUTION)에서 지적된 유일한 maintainability WARNING(2차 실패 처리 코드 중복)을 `failFirstSegmentSetupBestEffort` private 헬퍼로 정확히 해소한 후속 커밋이다. 헬퍼의 이름·JSDoc·호출부 위임 모두 명확하고, 큐 경로와 sub-workflow 경로가 동일 계약을 공유하도록 통일되어 향후 3번째 진입점이 추가되어도 자연스럽게 확장 가능하다. 신규 테스트도 기존 스펙 파일의 스타일(타입 캐스팅을 통한 private 메서드 스파이)을 그대로 따라 일관성이 유지된다. 코드 복잡도·중첩·네이밍·함수 길이 모두 문제 없음. 발견된 항목은 전부 INFO 등급으로, 실질적 조치가 필요한 사안은 없다.

## 위험도
NONE

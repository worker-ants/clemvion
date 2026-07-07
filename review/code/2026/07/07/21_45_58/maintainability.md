# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `finalizeFailedExecution` 추출 — 교과서적인 Extract Method 리팩터링
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4409-4451` (신설), 호출부 L2483-2486, L4390
  - 상세: `runExecution` catch(초기 세그먼트)와 `finalizeResumedExecutionOutcome`(재개 세그먼트)에 각각 존재하던 near-identical FAILED 종결 블록(status 마킹 → error 봉인(§1.4 sentinel code) → finishedAt/durationMs 계산 → DB save → EXECUTION_FAILED emit → execution_failed dispatch, 약 35줄)을 단일 private 헬퍼로 통합했다. 두 호출부의 유일한 차이(로그 라벨 `(rehydrated)`)는 `opts.rehydrated?: boolean` 옵션 파라미터로 깔끔하게 흡수했다. 이 중복은 실제로 "한쪽만 갱신" 버그(PR #841 버그 A: 재개 경로 dispatch 누락)를 낳았던 이력이 있어, 구조적 재발 방지 효과가 명확하다.
  - 제안: 없음 — 그대로 유지 권장.

- **[INFO]** 함수 길이·복잡도 양호
  - 위치: `finalizeFailedExecution` 본체 (약 40줄)
  - 상세: 단일 책임(FAILED 종결)에 집중하며 분기는 `error instanceof X` 타입 가드 2곳뿐으로 순환 복잡도가 낮다. 기존 두 호출부에 분산돼 있던 로직이 한 곳에 모여 가독성이 오히려 개선됐다(추출 전: 각 호출부가 자기 컨텍스트 안에서 35줄씩 섞여 있어 종결 로직의 경계가 불명확했음).
  - 제안: 없음.

- **[INFO]** 주석 품질 — "왜"를 설명하는 근거 주석 유지
  - 위치: `finalizeFailedExecution` JSDoc(L4399-4408), `dispatchExecutionFailedNotification` 직전 주석(L4448-4450)
  - 상세: 추출 헬퍼의 JSDoc 이 "무엇을 하는지" 뿐 아니라 "왜 이 헬퍼가 필요한지"(PR #841 버그 근거)와 "무엇을 의도적으로 포함하지 않는지"(in-memory context/캐시 정리는 호출자 finally 가 유지)까지 명시해, 향후 유지보수자가 헬퍼 경계를 오판할 위험을 낮춘다. WARN #7(보안: stack 미저장), §1.4(sentinel code 보존) 같은 과거 결정의 근거 주석도 원본에서 그대로 보존돼 컨텍스트 유실이 없다.
  - 제안: 없음.

- **[INFO]** 리팩터링 범위의 의도적 제한(behavior-preserving) — 스코프 판단 근거 명시
  - 위치: `plan/in-progress/notif-followup-refactor.md` 항목1, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:520`(`failFirstSegmentSetup`), `:564`(`failFirstSegmentSetupBestEffort`)
  - 상세: plan 문서가 "구조·정책이 다른(dispatch 미포함/재throw) `failFirstSegmentSetup`(L534)·sub-workflow timeout(L3929)은 본 추출 대상이 아니다"라고 명시적으로 배제 사유를 남겼다. 실제 코드에서도 `failFirstSegmentSetup`/`failFirstSegmentSetupBestEffort`는 `finalizeFailedExecution`과 병존하며 서로 다른 호출 패턴(L3450, L3987)을 유지, 무리하게 통합해 의미론이 다른 경로를 억지로 하나의 헬퍼로 뭉뚱그리는 안티패턴을 피했다. 유사 코드라고 무조건 합치지 않고 "행동이 다르면 별도 유지"라는 판단 기준이 문서화된 점이 좋은 관행이다.
  - 제안: 없음.

- **[INFO]** 회귀 가드 테스트 추가 — 헬퍼의 계약을 직접 검증
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:899-952`
  - 상세: 신규 `describe('finalizeFailedExecution — 초기·재개 세그먼트 공유 FAILED 종결 (버그 A 회귀 가드)')` 블록이 `{ rehydrated: true }` 옵션으로 헬퍼를 직접 호출해 status/save/emit/dispatch 4가지 부작용을 모두 단언한다. 기존 `dispatchExecutionFailedNotification` describe 블록과 네이밍 컨벤션(한국어 설명 + PR 참조 주석)이 일관돼 코드베이스 테스트 스타일에 부합한다.
  - 제안: 없음. 다만 두 호출부(초기/재개)가 실제로 `finalizeFailedExecution`을 거치는지 확인하는 통합 레벨 검증이 이미 기존 `dispatchExecutionFailedNotification` 스펙과 겹치는 회귀 커버리지를 제공하므로, 이 부분은 이미 충분해 보인다.

- **[INFO]** private 헬퍼로의 시그니처 노출(`opts: { rehydrated?: boolean } = {}`) — 확장 여지 존재하나 현재는 최소
  - 위치: L4412
  - 상세: 옵션 객체 패턴이 향후 세 번째 이상 호출부가 늘어날 때도 시그니처 변경 없이 확장 가능한 형태라 적절하다. 현재는 단일 boolean 플래그뿐이라 과설계는 아니다.
  - 제안: 없음 — 현 상태 유지.

## 요약
이번 변경은 `runExecution` catch(초기 세그먼트)와 `finalizeResumedExecutionOutcome`(재개 세그먼트)에 중복 존재하던 FAILED 종결 로직(약 35줄씩 2곳)을 단일 `finalizeFailedExecution` private 헬퍼로 추출한 behavior-preserving 리팩터링이다. 실제로 이 중복이 "한쪽 경로만 갱신되고 다른 쪽은 누락"되는 버그(PR #841 버그 A)를 유발했던 이력이 있어, 구조적 재발 방지라는 명확한 목적을 가진 리팩터링이며 회귀 가드 테스트·plan 문서·spec §4.4 문서화까지 동반해 변경의 의도와 경계가 잘 기록되어 있다. 함수 길이·중첩·네이밍·주석 품질 모두 기존 코드베이스 컨벤션(근거 주석, 한국어 설명 테스트 네이밍)과 일관되며, 구조·정책이 다른 유사 코드(`failFirstSegmentSetup` 등)를 무리하게 합치지 않고 의도적으로 배제한 판단도 적절하다. 유지보수성 관점에서 감점 요인을 찾지 못했다.

## 위험도
NONE

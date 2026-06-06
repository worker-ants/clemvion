# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: executions.service.ts

- **[INFO]** `reconcilePreParkWaitingStatus` 함수의 JSDoc 주석이 함수 본체보다 약 10배 긴 약 25줄 분량이다.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/executions/executions.service.ts` `reconcilePreParkWaitingStatus` 함수 상단 (파일 전체 컨텍스트 기준 877행 직전)
  - 상세: 주석이 Rationale/배경/spec 참조를 모두 inline 에 담고 있어 읽기 부담이 크다. 함수 자체는 단 11줄이므로 코드 대 주석 비율이 심하게 역전됐다. 단, 비즈니스 규칙이 복잡한 race condition 수정이기 때문에 배경 설명이 필요한 것은 인정된다.
  - 제안: 핵심 한 문장("RUNNING + outputData.status=waiting_for_input 인 intra-row inconsistency 를 read-side 에서 보정")만 남기고, 나머지는 `spec/5-system/4-execution-engine.md` 참조 링크로 대체해 주석을 5줄 이내로 줄일 수 있다.

- **[INFO]** `(ne.outputData as { status?: unknown } | null)?.status === 'waiting_for_input'` 패턴이 `executions.service.ts` 와 `apply-execution-snapshot.ts` 두 곳에 동일하게 반복된다.
  - 위치: `executions.service.ts` `reconcilePreParkWaitingStatus` 함수 내부 / `apply-execution-snapshot.ts` `isNodeWaitingForInput` 내부
  - 상세: 봉투(envelope) 에서 status 를 추출하는 단일 표현식이지만, backend·frontend 언어가 같은 TypeScript 라도 패키지 경계(backend vs frontend)가 다르므로 현실적인 공유는 어렵다. 중복 자체가 치명적이지는 않으나, 내부 코드리뷰 시 한쪽에서 조건을 변경할 때 다른 쪽을 놓칠 가능성이 있다.
  - 제안: 각 파일의 헬퍼 함수(`reconcilePreParkWaitingStatus` / `isNodeWaitingForInput`) 내에 `extractEnvelopeStatus(outputData: unknown): string | undefined` 같은 1줄 헬퍼를 두면 변경 지점을 단일화할 수 있다. 혹은 plan/spec 코멘트로 "이 조건을 변경하면 frontend `isNodeWaitingForInput` 도 함께 변경" 을 명시해 동기화 안전망을 마련한다.

- **[INFO]** `'waiting_for_input'` 문자열 리터럴이 `executions.service.ts` 의 `reconcilePreParkWaitingStatus` 에서 하드코딩돼 있다.
  - 위치: `reconcilePreParkWaitingStatus` 함수, `outputData.status === 'waiting_for_input'` 비교
  - 상세: `NodeExecutionStatus.WAITING_FOR_INPUT` enum 값과 동일 값이지만, outputData 내부는 별도 타입 없이 string 비교를 쓴다. enum 상수를 직접 사용(`NodeExecutionStatus.WAITING_FOR_INPUT` 을 `as string` 캐스팅)하거나 로컬 상수로 추출하면 오타 위험이 제거된다.
  - 제안: `const WAITING_STATUS = NodeExecutionStatus.WAITING_FOR_INPUT as string;` 식으로 중간 상수를 두거나, 비교 타겟을 enum 값으로 통일한다.

---

### 파일 2: executions.service.spec.ts

- **[INFO]** 두 신규 테스트 케이스에서 `executionRepo.createQueryBuilder.mockReturnValue(...)` 패턴(영구 mock)이 기존 다른 테스트들이 `mockReturnValueOnce(...)` 를 쓰는 것과 혼재한다.
  - 위치: 라인 44 (`mockReturnValue`) vs 파일 내 다른 테스트 라인 497, 524, 541 등 (`mockReturnValueOnce`)
  - 상세: `mockReturnValue` 는 이후 모든 호출에 영구 적용되어 `beforeEach` 재설정 없이는 테스트 간 오염이 발생할 수 있다. 해당 테스트들이 `describe` 블록의 마지막에 위치해 현재 실제 오염은 없지만, 테스트 순서 변경 시 취약점이 된다.
  - 제안: `mockReturnValueOnce` 로 변경해 기존 패턴과 일관성을 유지한다. `eW1`/`eW2` 테스트는 `findById` 를 1회씩만 호출하므로 `Once` 로도 충분하다.

- **[INFO]** 테스트 픽스처 객체(`nodeExecutionRepo.find.mockResolvedValue([ ... ])` 내 객체)가 `NodeExecution` 타입을 명시하지 않고 plain 객체 리터럴이다.
  - 위치: 라인 47-59 및 75-82
  - 상세: 타입 없는 리터럴은 엔티티 스키마 변경 시 테스트가 컴파일 오류 없이 실패하므로 유지보수 시 발견이 늦다. 기존 테스트들도 같은 패턴을 사용하므로 일관성은 유지되고 있다. 신규 케이스만 예외적으로 강 타입으로 바꾸면 오히려 불일치가 생기므로 전체 패턴 개선 논의로 분리하는 것이 적절하다.
  - 제안: 별도 이슈로 추적. 현재 변경에서는 기존 패턴을 따른 것이므로 즉시 수정 불필요.

---

### 파일 3: execution-park-resume.e2e-spec.ts

- **[INFO]** diff 는 순수 포맷 변경(줄 분리)이다. 기능 변경 없음. 유지보수성에 영향을 주지 않는다.

---

### 파일 4: use-widget-eager-start.test.ts

- **[INFO]** diff 내 변경은 `waitFor` 대기 대상을 `callCount` 에서 `executionId` state 로 교체한 것이다. 변경 이유를 설명하는 주석이 직접 코드에 포함(`// executionId state 커밋을 직접 대기 ...`)돼 있어 의도가 명확하다. 유지보수성 개선으로 긍정 평가.

---

### 파일 5: apply-execution-snapshot.test.ts

- **[INFO]** 신규 테스트 3개의 test description 에 기술 배경(`intra-row inconsistent (ne.status=running + outputData.status=waiting)`)이 포함돼 있어 후임자가 의도를 파악하기 쉽다. 다만 description 이 다소 길고 한국어/영어가 섞여 있는데, 이는 파일 전체의 기존 스타일과 일관되므로 일관성 관점에서는 문제 없다.

---

### 파일 6: apply-execution-snapshot.ts

- **[WARNING]** `isNodeWaitingForInput` 함수가 `export` 로 공개돼 있으나 동일 함수가 `executions.service.ts`(backend) 에도 논리적으로 복제된 `reconcilePreParkWaitingStatus` 로 존재한다. 두 함수는 서로 다른 패키지에 있고 독립적으로 유지보수해야 하는데, 이 사실이 코드 내 어디에도 명시적으로 표시되지 않는다.
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `isNodeWaitingForInput` 함수 (파일 컨텍스트 3370행)
  - 상세: frontend `isNodeWaitingForInput` 의 JSDoc 에 "backend `executions.service.findById` 가 1차 정규화하지만..." 이라는 언급은 있으나, 역방향(이 함수를 수정할 때 backend 도 수정해야 한다는) 연결고리가 없다. 미래 개발자가 frontend 조건만 변경하고 backend 정규화를 누락할 위험이 있다.
  - 제안: `isNodeWaitingForInput` JSDoc 에 "이 함수의 조건을 변경하면 `codebase/backend/src/modules/executions/executions.service.ts` 의 `reconcilePreParkWaitingStatus` 도 같은 조건으로 변경해야 한다" 를 추가한다.

- **[INFO]** `apply-execution-snapshot.ts` 파일 전체 길이가 약 440줄이다. 이번 변경은 `isNodeWaitingForInput` 헬퍼 추출로 기존 인라인 `ne.status === 'waiting_for_input'` 를 함수 호출로 대체한 것이며, 함수 수 증가 없이 복잡도를 낮췄다. 파일 길이 자체는 이번 diff 에 의한 증가가 34줄로 미미하다.

---

### 파일 7: plan/in-progress/fix-carousel-waiting-status.md

- **[INFO]** 계획 문서 끝에 닫히지 않은 XML-like 태그(`</content>\n</invoke>`)가 노출돼 있다.
  - 위치: 파일 마지막 3줄
  - 상세: diff 에서 `+</content>` / `+</invoke>` 가 추가됐는데 이는 툴 호출 잔재(artifact)가 파일에 유출된 것이다. 계획 문서의 내용 무결성에 영향은 없으나 가독성이 저하되고, 자동화 파서가 이 파일을 읽을 때 혼란을 줄 수 있다.
  - 제안: 파일 마지막 두 줄 `</content>` 및 `</invoke>` 를 삭제한다.

---

## 요약

이번 변경의 핵심은 backend `reconcilePreParkWaitingStatus` 와 frontend `isNodeWaitingForInput` 두 헬퍼를 각 레이어에 추가해, blocking 노드의 intra-row inconsistency(status 컬럼 vs outputData.status)를 read-side 에서 정규화하는 것이다. 함수 자체는 단순하고(11줄 이하), 책임이 명확하며, 테스트 커버리지도 충분히 추가됐다. 주요 유지보수성 우려는 동일 조건 판정 로직이 backend/frontend 에 독립 사본으로 존재하면서 연결고리가 코드에 명시되지 않은 점이다 — 미래 변경 시 한쪽 수정이 누락될 위험이 있다. 나머지는 mock 일관성, 하드코딩 문자열, 계획 문서 말미의 잔류 태그 등 소규모 개선 사항이며, 전체적으로 코드 품질은 양호하다.

## 위험도

LOW

STATUS: SUCCESS

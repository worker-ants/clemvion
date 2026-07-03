# 유지보수성(Maintainability) 리뷰

## 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- (plan 문서 `plan/in-progress/refactor-06-c2-followups.md` 는 코드가 아니므로 유지보수성 관점 리뷰 대상에서 제외)

이번 changeset 은 06 C-2(재개 진입 원자 claim) ai-review 비차단 후속(W2·W3·W5·W6) 커밋으로, (1) `claimResumeEntry` 내부 제어흐름을 boolean 클로저 플래그 + 매직 스트링 `Error` 조합에서 typed sentinel 에러 클래스(`ResumeClaimExecTerminalError`) + `instanceof` 판별로 교체, (2) `segmentStartMs.set(id, Date.now())` 중복 두 곳을 `recordRunningSegmentStart` 헬퍼로 추출, (3) 두 테스트(unit RUNNING skip-guard, e2e 동시 재개)를 추가하는 작은 범위의 리팩터링이다.

### 발견사항

- **[INFO]** `ResumeClaimExecTerminalError` JSDoc 중복
  - 위치: `execution-engine.service.ts` — 클래스 선언부 (`§7.5 재개 진입 원자 claim(06 C-2) 내부 sentinel …`)와 `claimResumeEntry` 메서드 JSDoc 내 동일 취지 설명이 각각 존재 (diff 상 line ~1496-1506, ~1520-1525 부근; 실제 파일은 284행 부근 1곳 선언 + 860행대 JSDoc)
  - 상세: 클래스 자체의 JSDoc 과 `claimResumeEntry` 메서드 JSDoc 이 "affected=0 이면 throw 후 tx 롤백" 설명을 사실상 반복 서술한다. 코드량 자체는 작아 당장 문제는 아니지만, 향후 한쪽만 갱신되면 설명이 divergence 될 여지가 있다.
  - 제안: 클래스 JSDoc 에는 "sentinel 자체가 무엇인지"만 간결히 남기고, 상세 rationale(왜 boolean 플래그 대신 throw 를 쓰는지)은 `claimResumeEntry` JSDoc/inline 주석 한 곳으로 단일화해도 좋다. 다만 이 프로젝트 컨벤션상 사용 지점 근접 설명이 흔하므로 강제 수정 사항은 아님.

- **[INFO]** `recordRunningSegmentStart` 추출은 적절하나 헬�퍼명 대비 책임이 미세하게 좁음
  - 위치: `execution-engine.service.ts` — `private recordRunningSegmentStart(executionId: string): void { this.segmentStartMs.set(executionId, Date.now()); }`
  - 상세: 단순 1줄 Map.set 을 헬퍼로 승격한 것은 두 호출부(`claimResumeEntry`, `updateExecutionStatus`)가 "RUNNING 진입 시 세그먼트 tracking" 로직을 독립적으로 drift 시키지 않도록 하려는 명확한 의도(주석에 명시)가 있어 타당하다. 이름도 목적을 잘 드러낸다. 특별한 개선 요구 없음 — 오히려 모범적인 중복 제거 사례로 평가.
  - 제안: 없음 (참고용 긍정 기록).

- **[INFO]** 신규 unit 테스트의 mock 스와핑 boilerplate 반복
  - 위치: `execution-engine.service.spec.ts` — 새 테스트 `'claim 후 Execution=RUNNING → 재개 sentinel 전이(...) skip'` (라인 ~40-124)
  - 상세: `svcAny`/`orchAny` 필드를 원본 저장(`orig`) → 교체 → `finally` 복원하는 패턴이 이 파일 전역에서 여러 테스트에 걸쳐 반복되는 기존 스타일이며, 이번 신규 테스트도 동일 패턴을 그대로 답습한다. 기존 컨벤션과의 일관성은 유지되지만, 파일 전체가 이미 11,000+ 줄로 매우 크고 이런 mock 스와핑 보일러플레이트가 테스트마다 10줄 이상 반복되는 구조적 이슈가 있다. 이는 이번 diff 의 신규 코드라기보다 기존 패턴을 따른 것이므로 이번 변경 자체의 결함은 아니다.
  - 제안: 이번 changeset 범위에서 조치 불필요. 다만 향후 `armSlowPathResume` 처럼 "mock 스와핑 + 복원" 을 캡슐화하는 공용 헬퍼(`withMockedInternals(svc, overrides, fn)` 류)를 도입하면 반복을 줄일 수 있다 — 별도 후속 과제로 제안.

- **[INFO]** 매직 넘버 `60_000` (e2e 테스트 타임아웃) 재사용
  - 위치: `execution-park-resume.e2e-spec.ts` — 신규 테스트 `it(..., 60_000)`
  - 상세: 파일 내 기존 테스트들도 동일하게 `60_000` 타임아웃을 리터럴로 사용 중이며, 신규 테스트도 동일 값을 그대로 사용해 기존 컨벤션과 일관적이다. 새로운 매직넘버 도입이 아니라 기존 패턴 재사용이므로 문제 아님.
  - 제안: 없음.

### 요약

이번 changeset 은 범위가 작고 목적이 명확하다. 핵심 프로덕션 변경(`ResumeClaimExecTerminalError` 도입, `recordRunningSegmentStart` 추출)은 둘 다 유지보수성을 개선하는 방향이다 — 특히 클로저 boolean 플래그(`execMismatch`)와 매직 스트링(`'__resume_claim_exec_terminal__'`) 기반의 암묵적 제어 흐름을 타입 안전한 sentinel 에러 클래스 + `instanceof` 판별로 교체한 것은 가독성과 의도 명확성을 뚜렷이 높인다. 두 호출부에 중복돼 있던 `segmentStartMs.set(id, Date.now())` 를 이름이 잘 붙은 헬퍼로 추출한 것도 향후 두 경로가 독립적으로 drift 하는 것을 방지하는 좋은 리팩터링이다. 함수 길이·중첩 깊이·순환 복잡도 모두 무난한 수준이며, 네이밍(`ResumeClaimExecTerminalError`, `recordRunningSegmentStart`)도 목적을 명확히 전달한다. 신규 테스트 2건(unit RUNNING skip-guard, e2e 동시 재개)도 기존 파일의 mock/헬퍼 컨벤션을 일관되게 따른다. 발견된 사항은 모두 INFO 수준의 경미한 관찰이며, 코드 자체를 수정해야 할 만한 critical/warning 급 이슈는 없다.

### 위험도
NONE

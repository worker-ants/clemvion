# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[INFO]** 무관해 보이는 test-scope 변경(`service` → `svcMetrics`)에 사유 주석 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:17002-17008` (`reentryWorkflowInput` describe, `NF-OB-07 BusinessMetrics` 블록 내부)
  - 상세: 이번 diff 는 e2e timeout override 가드 추가가 핵심 주제인데, 이 파일만 본 주제와 무관한 1-라인 변수 교체(`service` → `svcMetrics`)를 포함한다. 확인 결과 이 `describe` 블록은 `NF-OB-07 BusinessMetrics` 상위 블록이 자체 `TestingModule` 로 만든 `svcMetrics` 인스턴스를 쓰는 스코프인데, 변경 전 코드는 파일 최상단 `describe('ExecutionEngineService', ...)` 의 `service` 변수(별도 모듈 인스턴스)를 참조하고 있었다. 두 인스턴스 모두 유효한 `ExecutionEngineService` 라 종전에도 테스트 자체는 통과했을 것이나, "어느 인스턴스를 검증하는지"에 대한 의도가 불명확했던 스코프 실수로 보인다. 이 파일의 다른 인접 코드(예: 17-19 라인의 `// C-1 step2 —` 주석들)는 유사한 스코프 결정마다 근거 주석을 남기는 컨벤션을 따르는데, 이번 1-라인 수정에는 그런 설명이 없다.
  - 제안: PR 본문 또는 커밋 메시지에 "본 파일의 `svcMetrics` rename 은 timeout 가드와 무관한 pre-existing 스코프 버그 수정"이라고 한 줄 명시해 리뷰어의 diff 범위 혼선을 방지한다. (선택) 코드 자체에는 굳이 주석을 추가할 필요는 없음 — 인접 describe 블록이 이미 `svcMetrics` 를 쓰고 있어 문맥상 자명함.

- **[INFO]** 신규 가드(`e2e-no-sub-global-timeout.test.ts`) docstring 이 정규식의 실제 커버리지 한계를 명시하지 않음
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:1-22` (파일 헤더 JSDoc), 정규식 정의는 `:29` (`TIMEOUT_LITERAL`)
  - 상세: 헤더 주석은 "`e2e/**` 의 `.ts` 소스에서 bare-numeric `timeout: N` … 을 CI(unit)로 차단한다"고 단정적으로 서술하지만, 실제 매칭 정규식(`/timeout:\s*(\d[\d_]*)\b/g`)은 `timeout` 다음에 공백 없이 바로 콜론이 와야 매칭된다 — 즉 `timeout : 5000`(콜론 앞 공백)처럼 비정형 포맷이면 미검출된다. 이 프로젝트의 Prettier 컨벤션상 실제로 그런 포맷이 생성될 가능성은 낮아 실질 위험은 낮지만, "N < 전역 기본인 것을 CI(unit)로 차단한다"는 서술이 100% 보장이 아니라 "표준 포맷 리터럴에 한해" 라는 전제가 붙는다는 점이 docstring에 드러나지 않는다.
  - 제안: 필수는 아니나, docstring 또는 인접 `TIMEOUT_LITERAL` 주석에 "Prettier 표준 포맷(콜론 앞 공백 없음) 전제"라는 한 구절을 추가하면 향후 이 가드를 유지보수하는 사람이 검출 범위를 오해할 여지가 줄어든다.

## 요약

이번 변경 세트의 문서화 수준은 전반적으로 우수하다. `PROJECT.md` 에 추가된 컨벤션 문구는 PR #872 근거·가드 테스트 경로(`src/__tests__/e2e-no-sub-global-timeout.test.ts`)를 정확히 인용하며, 실제 파일 경로·`playwright.config.ts` 의 `expect.timeout` 값(10_000ms)과 모두 일치해 오래된/부정확한 참조가 없다. `test_doc_sync_matrix.py` 가 `PROJECT.md` 전체 텍스트에서 `*.test.ts` 토큰을 추출해 `codebase/` 실존 여부를 검증하므로, 이번에 추가된 참조도 이 harness 가드로 이미 보호된다. 신규 가드 테스트 파일 자체는 파일 헤더 JSDoc·함수별 JSDoc·true/false-positive self-test 매트릭스까지 갖춰 예제 코드 역할까지 겸하는 모범적인 문서화 사례다. `plan/in-progress/e2e-retry-visibility-followup.md` 의 곁가지 항목 완료 표기도 브랜치명·가드 경로·근거를 정확히 남겨 plan 라이프사이클 컨벤션에 부합한다. CHANGELOG.md 는 스캔 결과 product/spec 기반 변경만 기록하는 스코프이며 이번 변경은 순수 내부 테스트 인프라 개선이라 항목 추가가 필요 없다는 기존 관행과도 일치한다. 발견된 두 건은 모두 INFO 수준(범위 밖 rename 의 PR 설명 명시 권고, docstring 의 정규식 커버리지 한계 명시 권고)으로 병합을 막을 사유가 아니다.

## 위험도

LOW

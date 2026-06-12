# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** 테스트 코드 내 중복 호출 패턴 — `factory` 이중 실행
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts`, lines 125-134
  - 상세: `WORKSPACE_ID_REQUIRED` 코드 단언 테스트에서 `expect(() => factory(undefined, ctx)).toThrow(BadRequestException)` 로 먼저 던지는지 확인한 뒤, `try/catch` 블록에서 `factory(undefined, ctx)` 를 다시 호출한다. 즉 factory 가 동일 입력으로 2회 호출된다. 현재 factory 는 순수하므로 동작에 문제는 없지만, 패턴이 장황하고 향후 factory 에 side-effect 가 생길 경우 중복 호출이 예측 못한 결과를 낼 수 있다.
  - 제안: `try/catch` 블록만 남기고 선행 `expect(() => ...).toThrow(...)` 호출을 제거하거나, Jest `expect.assertions(n)` + `catch` 단일 경로로 단순화한다. 혹은 Jest의 `toThrow()` + 별도 `getResponse()` 단언을 분리한 두 `it` 블록으로 나눈다.

### 발견사항 2
- **[INFO]** `backend-labels.ts` 의 단일 파일 집중 — 확장 시 분할 관리 고려
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`
  - 상세: 현재 파일은 LABEL_KO, HINT_KO, PLACEHOLDER_KO, ITEM_LABEL_KO, GROUP_KO, OPTION_LABEL_KO, WARNING_KO, NODE_CATEGORY_KO, NODE_PORT_LABEL_KO, NODE_LABEL_KO, NODE_DESCRIPTION_KO, ERROR_KO, GRAPH_WARNING_KO 등 13개 테이블을 하나의 파일에 모두 유지한다. 이번 변경(`ERROR_KO`에 `WORKSPACE_ID_REQUIRED` 추가)은 작고 명확하지만, 파일 전체 크기가 증가 추세이며 도메인별(auth 오류, 노드 오류, 그래프 경고 등) 응집 단위와 파일 단위가 불일치한다. 아직 관리 가능한 수준이나 향후 확장성에서 단일 파일이 병목이 될 수 있다.
  - 제안: 단기 조치 불필요. 장기적으로는 `error-labels.ts`, `node-labels.ts`, `warning-labels.ts` 등으로 서브 모듈 분리 후 `backend-labels.ts` 에서 re-export 하는 구조를 고려한다. 현재 변경 자체는 기존 패턴에 일관성 있게 추가됐으며 구조적 문제는 없다.

### 발견사항 3
- **[INFO]** `spec/conventions/error-codes.md §5` 표 — preamble 정확화가 실질 계약 범위를 넓힘
  - 위치: `spec/conventions/error-codes.md`, §5 preamble 변경
  - 상세: "외부에 노출된 적이 없다" 문구를 "외부 client 코드에 분기로 노출된 적이 없다 (문서 목록에만 노출됐던 코드는 신규 코드로 동기화)"로 정확화했다. 이는 §5 적용 기준을 넓히는 것으로, 앞으로 "문서 목록 노출"이지만 "클라이언트 하드코딩 분기 없음"인 코드도 §5 이력에 등재될 수 있음을 암시한다. 이는 의도된 확장이지만, §5 의 게이트를 너무 넓히면 rename 이 더 쉬워 보여 §2 안정성 원칙의 실질적 마찰이 줄어들 수 있다.
  - 제안: §5 진입 기준("client 코드에 분기 없음" + "user-docs 목록 동기화 완료")을 주석 형태로 명시해 "게이트를 넓힌 것"이 아니라 "기준을 명확화한 것"임을 구분한다. 현재 추가된 `WORKSPACE_REQUIRED` 항목은 기준을 충족하며 패턴 일관성을 잘 유지한다.

### 발견사항 4
- **[INFO]** `spec/5-system/11-mcp-client.md §3.1` Internal Bridge 표 갱신 — spec SoT 단방향 흐름 정합
  - 위치: `spec/5-system/11-mcp-client.md`, §3.1 표 `makeshop` 행 추가
  - 상세: `§2.3` 본문은 이미 `makeshop` / `MakeshopMcpToolProvider` 를 언급하고 있었으나 §3.1 표에는 `cafe24` 만 등재되어 있었다. 이번 변경으로 표가 본문과 정합되었다. 아키텍처 관점에서는 spec 내 두 절이 동기화 없이 불일치하는 것 자체가 SoT 관리 문제이며, 구현 추가 시 spec 의 여러 위치를 동시에 갱신해야 한다는 절차상 취약점을 노출했다.
  - 제안: `§2.3` 본문과 `§3.1` 표를 단일 진실(SoT)로 통합하거나, 표를 `§2.3` 아래 인라인으로 이동해 동일 절에서 관리한다. 현재 변경은 정합성을 올바르게 복원했다.

## 요약

이번 변경 묶음(그룹 1+2+3)은 대부분 spec 문서와 i18n 테이블 갱신이며, 코드 변경은 `workspace.decorator.spec.ts` 에 테스트 케이스 강화와 `backend-labels.ts` 에 번역 항목 1개 추가로 국한된다. 아키텍처 관점에서 주목할 구조 변경은 없으며, `@WorkspaceId()` 공용 데코레이터를 통한 관심사 통일(workspace 컨텍스트 추출 로직의 단일 책임화)이 올바르게 적용됐음을 spec 문서와 테스트가 함께 명문화했다. `ERROR_KO` 테이블 확장은 기존 패턴을 그대로 따르고, `error-codes.md §5` preamble 정확화는 rename 이력 등재 기준을 명확화한 문서 품질 개선이다. `11-mcp-client.md §3.1` 표 갱신은 기존 §2.3 본문과 §3.1 표의 불일치를 복원한 정합 패치다. 발견된 이슈는 모두 테스트 가독성과 문서 구조에 관한 낮은 위험도의 INFO 수준이며, SOLID 위반·순환 의존·레이어 책임 혼재·안티패턴 등 아키텍처 위험은 없다.

## 위험도

NONE

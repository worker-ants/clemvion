# 테스트(Testing) 리뷰

## 검토 방법

프롬프트 번들이 잘려 전체 컨텍스트가 실리지 않은 파일들(`llm-model-config.controller.spec.ts`,
`llm.service.spec.ts`, `guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`,
`model-configs.test.ts`, `model-config-manager.test.tsx` 등)은 `Read`/`Grep` 으로 저장소 원본을
직접 열어 확인했다. 핵심 변경 스위트는 실제로 실행해 GREEN 을 실측했다:

- `codebase/backend`: `npx jest src/modules/llm/llm.service.spec.ts src/modules/llm/llm-model-config.controller.spec.ts` → **66/66 통과**
- `codebase/backend`: `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` → **39/39 통과** (DTO 필드 제거가 이 가드를 깨지 않음을 확인)
- `codebase/frontend`: `npx vitest run src/lib/docs/__tests__/guide-error-code-existence.test.ts src/lib/api/__tests__/model-configs.test.ts` → **26/26 통과**

저장소 파일은 뮤테이션하지 않았다(읽기 전용 검증만 수행). `git status --short` 로 저장소가
깨끗한 상태임을 확인.

## 발견사항

- **[WARNING] "연결 실패" 토스트가 실제 메시지를 렌더링하는지 검증하는 컴포넌트 테스트가 없다 — 이 PR 이 고친다고 주장하는 사용자 증상 자체가 UI 레이어에서 무테스트다**
  - 위치: `codebase/frontend/src/components/models/model-config-manager.tsx:83` (`t("models.connectionFailed", { error: result.message ?? "" })`) / 테스트 파일 `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` 전체 (`success: false` 를 반환하는 `testConnectionMock` 케이스가 0건 — `grep -n "success: false"` 결과 없음)
  - 상세: CHANGELOG·plan 모두 이 PR 의 핵심 사용자 증상을 "연결 실패 토스트가 `연결 실패: ` — 콜론 뒤가 비어 나갔다" 로 명시한다. 이 회귀는 **백엔드 wire 계약**(`llm-model-config.controller.spec.ts` 의 HTTP 왕복 테스트)과 **API 클라이언트 픽스처 테스트**(`model-configs.test.ts` 의 `"returns { success: false, message } on failure response"`, 이 PR 이전부터 존재)로는 고정되지만, 정작 그 문장을 화면 문자열로 조립하는 지점(`model-config-manager.tsx:83`)은 이 PR 전에도 후에도 테스트가 없다. `model-config-manager.test.tsx` 는 성공 경로(embedding dimension 자동감지, 3건)만 `testConnectionMock` 을 실패시키지 않고 통과시킨다 — `toast.error` 가 실제 `result.message` 문자열을 포함해 호출되는지 단언하는 케이스가 전무하다. 만약 이 컴포넌트가 `result.message` 를 다른 필드명으로 잘못 읽도록 리팩터링돼도(예: 오탈자, 구조분해 실수) 이 스위트는 여전히 전부 GREEN 이다 — 아래 두 계층(백엔드 계약·API 클라이언트 픽스처)은 애초에 `model-config-manager.tsx` 를 로드하지 않으므로 이 지점을 원리적으로 못 본다.
  - 제안: `model-config-manager.test.tsx` 에 `testConnectionMock.mockResolvedValue({ success: false, message: "..." })` 케이스를 추가해 `toast.error` 가 그 문자열을 포함해 호출됨을 단언한다. 이번 PR 의 회귀 방지 체인에서 **유일하게 비어 있는 마지막 층**이다.

- **[INFO] `latencyMs` 재도입을 막는 장치가 사람이 읽는 주석뿐이다**
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:53-56`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:460-462`
  - 상세: PR 자체가 이미 정확히 진단하고 있다 — `assertMatchesContract` 는 *"선언됐지만 응답에 없는 키"* 방향은 원리적으로 못 잡고(그 뮤턴트가 실측으로 GREEN 임을 컨트롤러 스펙 주석이 표로 남겼다), 유일한 그물은 `latencyMs` 는 **한 번도 발행되지 않았다** 는 코드 주석이다. 이는 개발자가 이미 인지하고 문서화한 한계이며 이 PR 의 결함은 아니지만, 두 자매 DTO 모두 같은 사각지대를 코드 주석으로만 막고 있어 향후 누군가 필드를 되살리면 아무 테스트도 실패하지 않는다.
  - 제안: 우선순위는 낮음(이미 근거를 남겼고, 응답 필드 추가는 보통 리뷰에서 걸러진다). 여유가 되면 "선언에는 있는데 실제 프로듀서가 0건" 을 잡는 정적 grep 기반 가드(이 PR 이 이미 만든 `guide-error-code-scan.ts` 류의 순수 스캐너 패턴)를 백로그로 남길 만하다.

- **[INFO] `FieldTable` 축(axis 1) 정규식이 줄 단위 스캔이라 여러 줄에 걸친 객체 리터럴 행을 놓칠 수 있다**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` — `scanErrorCodeCitations` 의 `lines.forEach(...)` 루프(파일 116-134번째 줄 부근)와 `FIELD_TABLE_NAME` 정규식(52번째 줄 부근)
  - 상세: `scanErrorCodeCitations` 는 MDX 를 줄 단위로 쪼갠 뒤 각 정규식을 **한 줄**에 대해서만 실행한다. 오늘의 실제 문서는 `{ name: "CODE", ... }` 형태를 한 줄에 다 적는 관례라 통과하지만(baseline 0 로 실측 확인), 만약 향후 누군가 `<FieldTable>` 행을 여러 줄로 줄바꿈해 적으면(`{`\n `  name: "CODE",`\n `}`) 이 축은 조용히 그 인용을 놓친다 — 정규식은 `\s*` 로 개행을 허용하지만 스캔 자체가 줄 경계에서 끊기기 때문이다. 이 형태는 16건의 뮤테이션 표에도 포함돼 있지 않다(전부 단일 축의 존재/부재를 다뤘지 "행이 여러 줄로 쪼개진다" 는 입력 변형은 다루지 않았다).
  - 제안: 우선순위 낮음 — 오늘의 코퍼스가 전부 한 줄 스타일이라 실질 위험은 낮다. 다만 이 가드의 "허용목록 없음, 베이스라인 0" 이라는 강한 주장에 비추면, `<FieldTable>` 행을 여러 줄로 쪼갠 합성 입력에 대한 대조군 테스트를 하나 추가해 이 구멍을 문서로 명시해 두는 편이 향후 재발 진단을 빠르게 한다.

## 잘된 점 (참고)

- `llm-model-config.controller.spec.ts` 의 새 `describe` 는 실제 서비스를 DI 에 넣고 의존만 mock 해 "필드 이름 축에서 vacuous 해지는" 함정을 피했고, 성공/실패 두 케이스 모두에 `assertMatchesContract` + 전수 키 비교 + 리터럴 문자열 단언을 3중으로 걸어 mutation 표(4가지 변형 각각 다른 조합으로 RED/GREEN)까지 코드 주석에 남겼다 — 재현 가능한 근거.
- `guide-error-code-existence.test.ts` 는 vacuity floor(코퍼스 크기·토큰 수 하한), 축별 최소 후보 수, 회귀 고정 케이스, 베이스라인 0 을 분리된 `it` 로 나눠 "스캐너가 조용히 `[]` 를 반환해도 초록" 이 되는 4가지 알려진 함정을 전부 차단한다. 별도 `describe('scanErrorCodeCitations — 축별 대조군')` 은 각 축의 채택/비대상 사례를 합성 입력으로 명시해 가독성과 의도 전달이 뛰어나다.
- `llm.service.ts` 필드 리네임(`error` → `message`)에 맞춰 `llm.service.spec.ts` 의 기존 4개 assertion 이 정확히 함께 갱신됐고, 회귀 방지용 신규 케이스(`실패 응답이 선언 DTO 와 일치한다`)가 별도로 추가돼 리네임 자체와 "선언과 일치하는가" 를 분리해서 고정했다 — 기존 테스트가 손상 없이 최신 계약을 반영한다(회귀 테스트 유효성 양호).
- `model-configs.test.ts` 에서 지어낸 `latencyMs: 120` 픽스처를 실재 필드 `dimension` 으로 교체한 것은 "생성 입력이 곧 커버리지" 함정을 정확히 인지하고 고친 사례.

## 요약

핵심 변경(백엔드 `LlmService.testConnection` 필드 리네임, 두 DTO 의 죽은 `latencyMs` 제거, 신규
`guide-error-code-existence` 가드)은 테스트 설계·격리·가독성·회귀 방지 측면에서 이 리포지토리의
평균 이상이며, mock 남용이나 vacuous 테스트 징후는 발견되지 않았다(직접 실행해 66/66·39/39·26/26
GREEN 을 실측). 다만 이 PR 이 스스로 내세우는 사용자 증상("토스트가 비어 나갔다")의 마지막 렌더링
지점(`model-config-manager.tsx` 의 `models.connectionFailed` 토스트)에는 실패 경로 테스트가
전혀 없어, 백엔드·API 클라이언트 계층이 다 막아도 UI 조립 단계의 회귀만은 여전히 무방비다. 이
한 곳만 채우면 이 배치의 회귀 방지 체인이 완결된다.

## 위험도

LOW

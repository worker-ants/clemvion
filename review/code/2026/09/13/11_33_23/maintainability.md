# 유지보수성(Maintainability) 리뷰

## 검토 범위

핵심 diff(28개 파일) 중 실제 코드/테스트 변경 위주로 검토했다. 프롬프트가 절단한 파일은 `Read`로 원본을 직접 열어 확인했다:
`codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`(신규), `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`(신규), `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`(신규), `codebase/backend/src/modules/llm/llm.service.ts`(`testConnection`), `codebase/frontend/src/components/models/model-config-manager.tsx`.
`review/code/**`·`review/consistency/**` 아래 과거 라운드 산출물(파일 25~107)은 코드가 아니라 이전 리뷰 리포트 커밋이라 유지보수성 관점 대상에서 제외했다.

## 발견사항

- **[INFO]** `TestConnectionResultDto`(integrations)와 `ModelTestConnectionResultDto`(model-config)가 거의 동일한 shape(`success` / `message?` / 부가 필드)을 각자 독립적으로 선언하고 있어, 이번처럼 같은 결함(`latencyMs` 유령 필드)이 양쪽에 동시에 생기고 동시에 고쳐야 했다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`TestConnectionResultDto`), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (`ModelTestConnectionResultDto`)
  - 상세: 이번 PR 자체가 "한쪽만 고치면 같은 거짓 광고가 남는다"는 주석을 양쪽에 남기며 shotgun-surgery 패턴을 스스로 인지하고 있다. 지금은 2곳뿐이라 즉시 추출을 강제할 정도는 아니지만, 세 번째 유사 DTO가 생기면 공통 베이스(`ConnectionTestResultDto` 등) 추출을 검토할 신호로 기록해 둘 만하다.
  - 제안: 지금 당장 리팩터링은 불필요(프로젝트 메모에도 "동일 반복 3회부터 추출 검토" 관례가 있음). 다음에 같은 필드가 세 번째로 어긋나면 공통화를 고려할 것.

- **[INFO]** DTO 필드 하나에 코드 5줄보다 긴 서술형 주석(2개의 `//` 블록 + JSDoc)이 붙어 실제 타입 선언보다 주석이 훨씬 길다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `TestConnectionResultDto.code` 필드(주변 `// `latencyMs`…` 블록, `// 이 선언은…` 블록, `/** 실패 분류 코드… */` JSDoc, `// `meta`도…` 블록)
  - 상세: 결함 발견 경위·근거를 코드에 남기는 것은 이 저장소의 확립된 관례(다른 DTO·서비스 파일에서도 동일 패턴 반복)이며 근거 추적성 면에서 가치가 있다. 다만 한 필드에 서로 다른 3개 주석 블록(`//` 두 덩이 + JSDoc 하나)이 섞여 있어 "이 필드의 공식 문서는 무엇인가"가 한눈에 안 들어온다.
  - 제안: 차단 사유 아님. 후속 정리 시 `//` 두 블록을 JSDoc `@remarks` 등으로 합쳐 필드당 주석 형식을 하나로 통일하면 가독성이 조금 더 좋아질 것.

- **[INFO]** `guide-error-code-scan.ts`의 `CODE_CONTEXT` 정규식이 다국어(영/한) 실패 어휘를 한 줄에 여러 개 나열한 긴 alternation이라 향후 새 어휘를 추가할 때 어디에 넣어야 하는지 판단 비용이 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:86` (`CODE_CONTEXT` 상수)
  - 상세: 다만 이 상수는 그 위 주석에서 반복 실측(39종→66종, 부재 0건 등)을 표로 남겨 "왜 이 목록인지"를 데이터로 뒷받침하고 있고, 대조군 테스트(`guide-error-code-existence.test.ts`의 "축별 대조군" describe)가 각 문맥 단어의 채택/기각 근거를 합성 입력으로 고정해 두었다. 정규식 자체의 복잡도는 실질적으로 완화돼 있다.
  - 제안: 없음(현재 상태로 충분히 방어돼 있음). 항목이 더 늘어나면 배열+`join('|')` 형태로 바꿔 항목 단위 diff가 되게 하는 정도만 고려.

## 긍정적으로 확인한 사항 (참고)

- `guide-error-code-scan.ts` / `guide-error-code-existence.test.ts` 분리는 순수 함수(스캐너)와 단언(테스트)을 깔끔히 나눠 단일 책임을 지킨다. 함수 각각(`scanErrorCodeCitations`, `collectBackendTokens`, `codeTableRows`)이 짧고 하나의 축만 책임진다.
- 새 컨트롤러 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)와 서비스 단위 테스트(`llm.service.spec.ts`)가 왜 두 층 모두 필요한지 JSDoc으로 명시해 다음 사람이 "왜 중복처럼 보이는 테스트가 두 개인가"를 다시 조사하지 않아도 된다.
- `guide-sanitized-message-parity.test.ts`가 vacuity floor(정확히 8개 추출 확인)를 SoT 추출과 가이드 표 양쪽에 각각 심어 "추출 로직이 깨지면 조용히 초록이 되는" 흔한 함정을 미리 막았다.
- `model-config-manager.test.tsx`의 신규 테스트 두 개(정상 케이스 + "대조군")는 기존 파일의 `render`/`act`/`waitFor` 패턴을 그대로 따라 스타일 일관성을 지켰다.
- 프런트 API 클라이언트(`model-configs.ts`)·픽스처(`model-configs.test.ts`)에서 생산자 0건이던 `latencyMs` 픽스처를 실재하는 `dimension` 픽스처로 교체한 것은 "지어낸 값으로 통과하는 테스트"를 걷어낸 좋은 정리다.

## 요약

핵심 로직 변경은 응답 필드 리네임(`error`→`message`)과 미발행 필드 제거뿐으로 규모가 작고, 순환 복잡도·중첩 깊이·함수 길이 모두 문제 삼을 지점이 없다. 신규 가드 파일(`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`, `guide-sanitized-message-parity.test.ts`)은 순수 함수/단언 분리, vacuity floor, 대조군 테스트를 갖춰 이 저장소 기존 가드 가족(`impl-anchor-existence`)의 관례를 잘 따르고 있다. 지적한 항목은 모두 INFO 수준 — 두 결과 DTO 간 구조적 중복(현재 2곳이라 즉시 조치 불필요), DTO 필드 주석의 형식 혼재, 다국어 문맥 정규식의 항목 나열 방식 — 이며 셋 다 이미 프로젝트가 근거·테스트로 완화해 둔 상태라 차단 사유가 아니다.

## 위험도

NONE

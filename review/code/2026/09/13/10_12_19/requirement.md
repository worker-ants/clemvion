# 요구사항(Requirement) 충족 리뷰 — guide-error-code-truth

## 검증 방법

프롬프트 번들이 여러 파일에서 절단돼 있어 원본을 `Read`로 직접 열어 대조했다. 추가로
저장소 안에서 다음을 **read-only**로 실행해 실측했다(뮤테이션 없음 — 종료 시
`git status --short` 로 확인, 리뷰 세션이 만든 미추적 산출물(`review/code/2026/09/13/10_11_53`,
`review/consistency/2026/09/13/10_12_54` 등 병렬 리뷰어 산출물) 외에는 트리에 변경 없음):

- `cd codebase/backend && npx jest src/modules/llm/llm.service.spec.ts src/modules/llm/llm-model-config.controller.spec.ts` → **66/66 PASS**
- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/guide-error-code-existence.test.ts src/lib/api/__tests__/model-configs.test.ts` → **26/26 PASS**
- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/impl-anchor-existence.test.ts --reporter=verbose` → 신규 `<ImplAnchor kind="api-endpoint">` 앵커(models.mdx/models.en.mdx) 통과 확인
- `cd codebase/frontend && npx tsc --noEmit` → 이 PR 관련 오류 0건
- `cd codebase/backend && npx tsc --noEmit` → 이 PR 관련 오류 0건 (남은 오류는 `presentation/carousel`·`chart`·`table` 의 사전 존재 오류이며 이번 diff 는 그 파일들을 건드리지 않음 — `git diff --stat origin/main...HEAD -- codebase/backend/src/nodes/presentation` 결과 0줄)
- `grep`으로 `latencyMs`(생산자 0건), `sanitizeLlmErrorMessage`의 8문장, `MAKESHOP_*` 코드 계열, `LLM_RESPONSE_INVALID`/`HTTP_BLOCKED`/`DB_PERMISSION_DENIED`/`CODE_MEMORY_LIMIT`/`SUB_WORKFLOW_NOT_FOUND` 등을 backend 소스와 대조 — CHANGELOG·plan·가이드 표의 서술이 실제 소스와 전부 일치함을 확인

## 발견사항

- **[INFO]** `assertMatchesContract`가 `POST /api/model-configs/:id/test`에 배선됐지만, 형제 `IntegrationTestResult`(`/api/integrations/:id/test`)의 `code`·`capabilities`·`serverInfo`·`preview` 필드는 여전히 `TestConnectionResultDto`에 선언돼 있지 않다(이번 diff는 그 DTO에서 `latencyMs`만 제거했다).
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`IntegrationTestResult` 인터페이스, `code?: string` 등) vs `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456-465` (`TestConnectionResultDto` — `success`/`message`/`meta`만 선언)
  - 상세: CHANGELOG·plan 본문은 "형제 엔드포인트가 이미 `{success, code, message}`로 문서화돼 있다"고 이 엔드포인트를 모범 사례로 인용하는데, 실제로는 spec(`2-navigation/4-integration.md` Rationale)에는 그 shape이 적혀 있어도 Swagger DTO 선언에는 `code`가 없다 — 즉 인용된 "모범"도 선언 계층에서는 이번 PR이 고친 것과 같은 클래스의 갭을 갖고 있다. 이번 diff의 스코프 밖(해당 DTO에 다른 변경 없음)이라 이 PR의 결함으로 보지는 않지만, 다음에 이 엔드포인트에도 `assertMatchesContract`를 배선하면 `code [undeclared]`로 스스로 드러날 것이다.
  - 제안: 별도 항목으로 트래커에 등재(이번 PR 범위 밖이므로 지금 고칠 필요는 없음, 참고용).

- **[INFO]** 이번 PR이 처음으로 실사용 `<ImplAnchor kind="api-endpoint">` 앵커를 도입했는데(`models.mdx`/`models.en.mdx`), 그로 인해 인접 파일의 주석이 조용히 낡았다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts:108-112` — "no user-guide MDX uses an `api-endpoint` anchor yet, so the in-loop assertion above would not be exercised by real content"
  - 상세: 이 주석은 이번 PR 이전엔 사실이었다. 실측(`vitest run … --reporter=verbose`)으로 확인하니 이번 PR이 추가한 앵커가 정확히 그 "in-loop assertion"(`declares a NestJS HTTP route decorator + path`)을 실제로 실행하고 통과시킨다 — 기능적으로는 문제없지만 주석이 더 이상 사실을 서술하지 않는다(§4 의도-구현 괴리, 다만 대상은 이번 diff가 건드리지 않은 파일이다).
  - 제안: `impl-anchor-existence.test.ts`의 해당 주석을 "models.mdx가 첫 실사례" 식으로 갱신하는 후속 정리(선택, 저위험).

- **[INFO]** `TABLE_HEADER_WITH_CODE`(`guide-error-code-scan.ts:90`)는 헤더 구분선(`|---|---|`)을 확인하지 않고 셀 값만으로 "코드 열 표"를 판정한다. 실측한 실제 표(`| Code | ... |` 같은 데이터 행)는 이미 검출된 표 내부에서 처리되므로 오탐이 관측되진 않았으나(베이스라인 0, 26/26 GREEN), 임의의 다른 표에서 첫 셀 값이 우연히 정확히 "코드"/"Code"/"Codes"인 **데이터 행**이 헤더 없이 나타나면 그 지점부터 새 "코드 표"로 오인식할 수 있는 이론적 여지가 있다. 설계 문서 자체가 "허용목록보다 과탐(safe) 방향을 택했다"고 명시하므로 이 방향의 오탐은 설계상 허용된 트레이드오프이고, 오탐 시 결과는 (실재하지 않는 코드로 잘못 판정되는) 시끄러운 실패이지 조용한 미검출이 아니다 — 실사용상 리스크는 낮다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:90` (`TABLE_HEADER_WITH_CODE`), `:97-113`(`codeTableRows`)
  - 제안: 조치 불요(설계 의도와 일치, 안전한 방향의 트레이드오프). 참고로만 기록.

## 핵심 확인 사항 (양호)

- `LlmService.testConnection`의 실패 반환 필드가 `error` → `message`로 정확히 바뀌었고, 실측 결과 이 서비스가 `Promise<{ success, message?, dimension? }>`을 일관되게 반환한다(3개 catch 지점 없음 — 단일 catch 블록). DTO(`ModelTestConnectionResultDto`) 선언·프런트엔드 타입(`model-configs.ts`)·실제 소비처(`model-config-manager.tsx: result.message`)가 모두 `message`로 일치함을 grep으로 확인 — 원래 결함(3층 필드명 불일치로 토스트가 `"연결 실패: "`로 비어 나가는 문제)이 실제로 해소됐다.
- `latencyMs` 제거는 두 자매 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`) 모두에서 생산자 0건임을 grep으로 재확인 — 거짓 광고 제거 주장이 사실과 일치.
- `sanitizeLlmErrorMessage`의 8개 분기 문장이 `models.mdx`/`models.en.mdx`의 8행 표와 **완전히 축자 일치**(순서 포함) — 새 가이드 표가 실제 동작을 정확히 반영.
- `run-results.mdx`/`error-handling.mdx`(ko/en 4파일)에서 제거된 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`는 `spec/5-system/3-error-handling.md §1.4`가 "더 이상 사용하지 않는다"고 명시한 은퇴 코드였고, 대체된 카테고리별 코드표(`HTTP_BLOCKED`, `DB_PERMISSION_DENIED`, `LLM_RESPONSE_INVALID`, `CODE_MEMORY_LIMIT`, `SUB_WORKFLOW_NOT_FOUND` 등)는 전부 backend 소스에 실재함을 grep으로 확인.
- `integrations.mdx`/`integrations.en.mdx`의 `MAKESHOP_API_ERROR` → `MAKESHOP_404` 치환 및 추가된 코드 계열 설명(`MAKESHOP_422`/`MAKESHOP_4XX`/`MAKESHOP_5XX`/`MAKESHOP_AUTH_FAILED`/`MAKESHOP_RATE_LIMITED`/`MAKESHOP_TRANSPORT_FAILED`)이 `makeshop-api.client.ts`/`makeshop.handler.ts`의 실제 코드와 전부 일치.
- 신규 가드(`guide-error-code-existence.test.ts` + `guide-error-code-scan.ts`)는 3축(FieldTable name / code: 값 / 실패-문맥 산문) 모두 최소 1건 이상 후보를 내는 vacuity-floor 테스트를 갖추고 있고, 스캐너 자체에 대한 합성 입력 대조군(축별 positive/negative)도 있어 "스캐너가 `return []`을 해도 초록"이 되는 형태의 vacuous 테스트가 아님을 코드로 확인.
- `assertMatchesContract`/`contractForDto` 구현을 직접 읽어, CHANGELOG·plan이 주장하는 판정 규칙(선언되지 않은 키 검출 O, 선언됐지만 응답에 없는 optional 키 검출 X)이 실제 구현과 정확히 일치함을 확인 — "왜 latencyMs 되살림 뮤턴트가 GREEN으로 생존하는가"라는 plan의 설명이 코드 근거와 부합.
- `LlmModelConfigController.testConnection`이 `this.llmService.testConnection(...)`을 순수 위임하고, 전역 `TransformInterceptor`만 `{data}` 봉투를 씌운다는 컨트롤러 spec의 주석대로 실제 컨트롤러 소스가 그렇게 구현돼 있음을 확인 — HTTP 왕복 테스트가 실제 배선을 정확히 반영.
- 새로 추가된 spec 갭(§1 카탈로그 누락, `testConnection` 실패 shape 미문서화, `user-guide-evidence.md §2.1` 관계표 누락)은 developer가 `spec/`를 직접 고치지 않고(diff에 `spec/` 변경 없음, CLAUDE.md 준수) `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 정확히 등재했으며, 반증된 기존 처분 문구("`LLM_CONNECTION_ERROR`를 적어라")는 삭제가 아니라 취소선 + 정정으로 처리해 이 저장소가 반복 지적해 온 "체크박스만 바뀌고 근거 문장이 낡는" 패턴을 이번엔 스스로 피했다.

## 요약

핵심 런타임 결함(3층 필드명 불일치로 실패 사유가 화면에 전혀 도달하지 않던 버그)이 `error`→`message` 통일로 실제로 해소됐고, 회귀 방지를 위한 서비스-단위 계약 테스트와 인터셉터를 태우는 HTTP 왕복 테스트가 함께 추가돼 66/66·26/26 전부 GREEN임을 직접 실행해 확인했다. 가이드 문서의 에러 코드 5종 치환(2건 은퇴 코드, 1건 지어낸 이름, 2건 오귀속)도 backend 소스와 grep 대조 결과 전부 정확했고, 신규 `guide-error-code-existence` 가드는 vacuity-floor·합성 대조군을 갖춘 견고한 테스트로 확인된다. spec 문서에 남은 갭(§1 카탈로그·실패 shape 미문서화·§2.1 관계표)은 developer 권한 밖이라 정확히 planner 인계 절차를 밟았다. 발견한 사항은 전부 INFO 등급 — 이번 diff 스코프 밖의 형제 DTO 선언 갭 1건(참고용), 이번 PR이 인접 파일의 주석 하나를 조용히 낡게 만든 것(저위험, 선택적 후속), 신규 스캐너 정규식의 이론적 오탐 여지(설계상 허용된 안전한 방향의 트레이드오프) 뿐이며 CRITICAL/WARNING 급 요구사항 미충족이나 spec 불일치는 발견되지 않았다.

## 위험도

NONE

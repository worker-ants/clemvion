# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep: `plan/in-progress/guide-error-code-truth.md`)

> 방법 고지: 조립 프롬프트는 컨텍스트 예산으로 `spec/5-system/3-error-handling.md`·`1-auth.md`·
> `2-api-convention.md`·`0-overview.md`(일부) 만 전문 포함하고 나머지 94개 파일(5-system 내
> `4-execution-engine.md`·`7-llm-client.md`·`14-external-interaction-api.md` 등 포함)은 절단됐다.
> "여기 없다 = 문제 없다" 로 읽지 않고, 이번 plan 의 실제 대상(LLM Test Connection 계약,
> Cafe24/Makeshop 에러 코드 카탈로그)과 관련된 파일은 `Read`/`grep` 으로 저장소에서 직접 열어
> 대조했다: `spec/5-system/7-llm-client.md`, `spec/2-navigation/4-integration.md`,
> `spec/2-navigation/6-config.md`, `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md`,
> `spec/conventions/error-codes.md`, `spec/data-flow/7-llm-usage.md`.

## 발견사항

- **[WARNING]** `3-error-handling.md §1.4` 카탈로그가 Integration 노드(Cafe24/Makeshop)·OAuth 연결
  도메인의 에러 코드를 완전히 누락 — 이번 plan 의 항목 C(`MAKESHOP_API_ERROR` 지어냄)가 정확히
  이 사각지대에서 발생했다
  - target 위치: `spec/5-system/3-error-handling.md` §1.4 "카테고리별 실재 코드표" (HTTP·Database·
    Email·LLM·Code 노드·Sub-workflow 6행)
  - 충돌 대상: `spec/conventions/error-codes.md` "적용 범위" 문단(`CAFE24_*`, `OAUTH_*` 를 본
    규율의 대상으로 명시), `spec/5-system/2-api-convention.md` §5.3 "등재되지 않은 코드는
    소비자가 존재를 알 방법이 없다", `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md §6`
    (`CAFE24_*`/`MAKESHOP_*` 실재 카탈로그), `spec/2-navigation/4-integration.md`(`OAUTH_STATE_
    MISMATCH`·`OAUTH_CONFIG_MISSING`·`OAUTH_TOKEN_EXCHANGE_FAILED`·`OAUTH_INVALID_SCOPE`)
  - 상세: §1.4 는 "노드 수준 에러 카테고리" 등재처를 자처하며 HTTP Request·Send Email·
    Database Query 노드(모두 `4-nodes/4-integration/` 소속)의 코드는 각 행으로 등재했다. 그런데
    **같은 `4-integration/` 패밀리**인 Cafe24·Makeshop 노드의 코드(`CAFE24_4XX`/`CAFE24_AUTH_
    FAILED`/`MAKESHOP_RATE_LIMITED` 등 다수)와, 통합 카드의 OAuth 연결 흐름 코드(`OAUTH_*`)는
    §1.4 는 물론 §1.5~§1.12(도메인 spec 참조용 최소 등재 섹션들, WS/EIA/webhook/KB/워크스페이스
    멤버/트리거 endpointPath/트리거 AuthConfig/Chat Channel bot token)에도 단 한 줄도 없다
    (`grep -n "CAFE24\|MAKESHOP\|OAUTH_" spec/5-system/3-error-handling.md` → 0건, `INTEGRATION_`
    은 §1.4 rationale 문장 1곳뿐). `conventions/error-codes.md` 는 "본 규율은 프로젝트 전체의
    에러 코드 문자열에 적용된다 — API·통합·OAuth 등에서 인라인 문자열 리터럴로 발행되는 코드
    (`CAFE24_*`, `OAUTH_*` 등)를 포함한다" 고 명시적으로 이 두 접두어를 카탈로그 SoT 대상으로
    지목하는데, 정작 카탈로그(`3-error-handling.md §1`)에는 그 대상이 없다 — 규율 문서의 스코프
    선언과 카탈로그 문서의 실제 내용이 어긋난다. §1.10~§1.12 처럼 최근 추가된 좁은 도메인
    (트리거 endpointPath 충돌·트리거 AuthConfig binding·Chat Channel bot token 회전)은 "도메인
    spec 참조" 최소 등재라도 받았는데, 코드 종수가 더 많고 더 오래된 Cafe24/Makeshop/OAuth
    도메인은 그 대우조차 못 받은 상태라 신구간 처리 불균형도 있다.
  - 제안: §1.4 에 "Integration 노드" 행(또는 §1.13 신설)으로 `CAFE24_*`/`MAKESHOP_*` 를
    도메인 spec 참조 등재하고, OAuth 연결 흐름(`OAUTH_*`)도 별도 §1.x 로 `2-navigation/
    4-integration.md` 를 SoT 로 최소 등재한다. 이번 plan 의 가드(§D)가 "구조화된 자리"만
    보고 코드 존재 여부를 판정할 때, 판정 기준 소스가 `error-codes.ts` 같은 좁은 registry
    라면 `CAFE24_*`/`MAKESHOP_*`/`OAUTH_*` 처럼 카탈로그 밖에서 인라인 문자열로만 존재하는
    코드를 실재하지 않는 것으로 오판할 위험도 있으니, 가드 구현 시 이 카탈로그 갭을 먼저
    메우거나 registry 소스를 grep 대상 확장(문자열 리터럴 전체)으로 잡아야 한다.

- **[WARNING]** LLM Test Connection 실패 응답 필드명이 두 spec 문서 어디에도 없다 — plan 이
  `message` 로 확정하면 두 표를 동시에 갱신해야 하며, 한쪽만 갱신 시 그 자체로 새 cross-spec
  불일치가 생긴다
  - target 위치: `spec/5-system/7-llm-client.md` §8.3 "LlmService.testConnection — kind별 probe
    전략" 표 (`{ success: true }` / `{ success: true, dimension? }` 만 기술)
  - 충돌 대상: `spec/2-navigation/6-config.md` (`POST /api/model-configs/:id/test` 행 — "응답
    `data`: chat `{ success }`, embedding `{ success, dimension? }`")
  - 상세: 두 문서는 서로 미러링된 계약 표이고 지금은 **성공 케이스만** 기술한다는 점에서 서로
    합치한다(모순은 없음). 그러나 plan A 가 실측한 실패 shape 3중 불일치(서비스 `error` / DTO
    `ModelTestConnectionResultDto` 의 `message` / FE 소비 `message`)를 `message` 로 통일하기로
    했는데, 통일 후에도 이 두 spec 표는 실패 필드를 계속 기술하지 않게 된다 — 정정의 SoT 앵커가
    없다. 더 나아가 `spec/2-navigation/4-integration.md:1275` 는 형제 엔드포인트
    `/api/integrations/:id/test` 의 계약을 `{ success, code, message }` 로 명시 문서화해 두었다
    (`message` 채택이 이 형제 패턴과 일치하는 근거이기도 하다). 즉 plan 의 `message` 선택은
    기존 spec 패턴과 정합하지만, 그 정합성이 `7-llm-client.md`·`6-config.md` 본문에는 아직
    반영돼 있지 않다.
  - 제안: 구현 완료 시 두 표에 실패 shape(`{ success: false, message }`)를 명시적으로 추가한다
    (developer 자기-반증형 소정정 조건에는 해당하지 않음 — API 계약 문서라 `--spec` 정식 경로).
    `latencyMs` 는 `spec/**` 어디에도 등장하지 않아(전수 grep 0건) 제거가 다른 spec 문서와
    충돌하지 않는다 — 이 필드만은 안전.

- **[INFO]** "연결 테스트" 계열 두 엔드포인트의 실패 표현력 비대칭 — 의도적이라면 근거를 어느
  spec 에도 남겨 두지 않았다
  - target 위치: `spec/5-system/7-llm-client.md` §8.3 (plan 반영 후 `/api/model-configs/:id/test`
    실패 shape 은 `{ success:false, message }`, 구조화 `code` 없음)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §9.1/§Rationale (`/api/integrations/:id/test`
    실패 shape 은 `{ success:false, code, message }`, 구조화 `code` 있음)
  - 상세: 두 "Test Connection" 계열 엔드포인트가 하나는 코드 없이 사람이 읽는 문장만, 다른
    하나는 코드+문장을 낸다. 후자는 `INTEGRATION_INCOMPLETE`/`INTEGRATION_CREDENTIALS_
    UNREADABLE` 처럼 클라이언트가 분기할 수 있는 값이 필요해서 코드를 넣었다는 근거가 spec 에
    있다(§5.3 유효성 검증 에러 절의 코드-분기 원칙과 같은 논리). LLM 쪽은 plan 이 "8갈래 고정
    문장, 코드 없음" 을 그대로 유지하기로 했는데 — 왜 이쪽은 코드가 필요 없는지에 대한
    명시적 근거가 `7-llm-client.md` Rationale 에 없다(반대로 `4-integration.md` 는 위 인용처럼
    근거를 남겼다). 차단 사유는 아니며 이번 배치 스코프도 아니지만, 구현 완료 시 `7-llm-client.md`
    Rationale 에 "왜 코드 없이 문장만인가"를 한 줄 남기면 다음 사람이 같은 질문을 반복하지
    않는다.

## 요약

이번 impl-prep 대상(`spec/5-system/`)의 내부 텍스트(3-error-handling.md·1-auth.md·
2-api-convention.md)는 서로 모순되지 않으며, plan 의 세 항목(A/B/C) 전제도 실제 spec·코드
대조 결과 정확했다(B 의 은퇴 코드 2종, C 의 Cafe24/Makeshop 실재 코드 목록 모두 spec 과 합치).
다만 cross-spec 관점에서 두 개의 구조적 갭이 확인된다 — (1) 중앙 에러 코드 카탈로그(§1.4)가
자신의 명명 규율(`conventions/error-codes.md`)이 명시적으로 지목하는 `CAFE24_*`/`OAUTH_*`
계열을 등재하지 않아 이번 결함(항목 C)의 재발 소지를 구조적으로 남겨 두고 있고, (2) LLM Test
Connection 실패 응답의 필드명이 어느 spec 표에도 없어 이번 fix 가 확정할 `message` 라는 이름을
앵커할 SoT 문장이 없다. 둘 다 구현을 막지는 않지만, 구현 완료 시점에 함께 갱신하지 않으면 spec
간 정합성이 다시 벌어진다.

## 위험도

MEDIUM

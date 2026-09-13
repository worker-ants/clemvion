# 정식 규약 준수 검토 — `spec/5-system/`

## 검토 범위와 방법

`--impl-prep` 모드, 대상 `spec/5-system/`. 프롬프트 번들이 예산 초과로 `spec/5-system/` 15개 파일과
`spec/conventions/` 대부분을 절단했으므로, 절단된 자리는 `Read`/`grep` 로 저장소 원본을 직접 열어
`spec/conventions/error-codes.md`·`spec/conventions/swagger.md` 전문과 `spec/5-system/3-error-handling.md`·
`1-auth.md`·`2-api-convention.md`·`7-llm-client.md`·`16-system-status-api.md` 를 대조했다. 나머지
elided 파일(4-execution-engine.md·14-external-interaction-api.md 등)은 표제·상호참조만 확인했다.

이 문서군은 이미 다수의 라운드를 거쳐 명명 규율·응답 봉투·swagger 패턴을 매우 촘촘하게
상호참조하고 있다(`error-codes.md`/`swagger.md`/`node-output.md` 를 절 단위로 인용). 아래 발견사항은
그 위에서 남은 실질 격차만 추린 것이다.

## 발견사항

- **[WARNING] LLM 도메인 HTTP 에러 코드가 §1 카탈로그에 미등재**
  - target 위치: `spec/5-system/7-llm-client.md §6`(에러 처리 표) · `§5.5`(preview-models 에러 처리)
  - 위반 규약: `spec/conventions/error-codes.md` "적용 범위"(카탈로그·트리거의 SoT 는
    `3-error-handling.md §1`) · `spec/5-system/2-api-convention.md §5.3` "등재되지 않으면
    소비자가 존재를 알 방법이 없다"
  - 상세: `§6` 표는 `LLM_CREDENTIALS_REQUIRED`(400, preview 요청 apiKey 누락)·
    `LLM_MODEL_LIST_FAILED`(400, provider 모델 목록 조회 실패)를 **HTTP 에러 봉투 코드**로
    명시한다(둘 다 `POST /api/model-configs/preview-models` 류의 400 응답 `error.code` 다). 그런데
    `3-error-handling.md §1` 카탈로그를 grep 하면 이 두 코드가 **0건**이다. 같은 문서의
    `Rationale › §1 카탈로그 완결성` 항목들은 2FA/WebAuthn(§1.2.1)·KB/Graph RAG(§1.8)·워크스페이스
    직접추가(§1.9)·트리거 endpointPath/AuthConfig(§1.10/§1.11)·chat-channel bot token(§1.12) 등
    **다른 모든 도메인**을 "도메인 spec 참조" 패턴으로 이미 §1 에 등재해 왔다 — LLM 도메인만 그
    스윕에서 빠졌다. (참고로 `MODEL_CONFIG_INVALID`·`LLM_RATE_LIMIT`·`LLM_TIMEOUT` 은 각각 §1.3·§1.4
    에 이미 등재돼 있어 전부가 빠진 것은 아니다 — 격차는 위 두 코드에 한정된다.)
  - 제안: `3-error-handling.md` 에 §1.13(가칭) "LLM/Model Config 도메인 에러 코드" 절을 신설해
    `LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED` 를 기존 도메인-참조 패턴(정의 SoT =
    `7-llm-client.md`, 본 절은 공용 카탈로그 가시성)으로 등재. `LLM_CONNECTION_ERROR`·
    `LLM_OUTPUT_MALFORMED`·`LLM_STREAMING_UNSUPPORTED` 가 HTTP 봉투로도 나가는지(또는 node
    `output.error.code` 전용인지)를 먼저 판별해 등재 여부를 정한다.

- **[WARNING] `testConnection` 실패 응답의 필드가 spec 어디에도 문서화돼 있지 않다**
  - target 위치: `spec/5-system/7-llm-client.md §8.3` "`LlmService.testConnection` — kind별 probe 전략" 표
  - 위반 규약: `spec/5-system/2-api-convention.md` Overview "OpenAPI 문서가 실제 wire 와 어긋나면
    그 어긋남이 소비자 코드로 전파된다" · `swagger.md §5-5`(에러 응답 참조 원칙 — 응답 계약은
    선언과 실제가 같아야 한다)
  - 상세: §8.3 표는 `chat`→`{ success: true }`, `embedding`→`{ success: true, dimension? }` 만
    적고 **실패 시 반환 shape 를 한 줄도 적지 않는다**. 실제로는 `{ success: false, error: ... }`
    를 반환하는데(현재 진행 중인 `plan/in-progress/guide-error-code-truth.md` §A 가 실측한 바로는
    서비스는 `error`, DTO 선언은 `message`, 프런트는 `result.message` 를 읽어 3층이 갈려 있다),
    spec 이 애초에 이 실패 경로의 필드명을 어느 쪽으로도 못박지 않았기 때문에 이 drift 가
    문서 층에서도 감지되지 않았다. `2-api-convention.md §5.4` 가 "부재 표현"에는 엄격한 표기
    규칙을 두면서 정작 **실패 시 사유가 실리는 필드 자체**를 API 규약·본 문서 어느 쪽도 규정하지
    않는 것은 이 엔드포인트 하나만의 국소적 공백이 아니라 §8.3 절이 "성공 케이스만 계약"이라고
    쓰고 있는 것과 같다.
  - 제안: §8.3 표에 실패 열을 추가(`{ success: false, message: string }` 등 — 필드명은 구현
    수정과 함께 확정)하고, 그 필드가 사용자에게 그대로 노출되는 문구인지 아니면 별도 코드
    분류(§6 카탈로그)로 갈리는지 명시한다. 이번 plan(§A)의 처분과 동시에 갱신하는 것이 자연스럽다.

- **[INFO] `spec/5-system/` 4개 파일이 `## Overview` 표준 헤딩을 쓰지 않는다**
  - target 위치: `11-mcp-client.md`·`5-expression-language.md`·`7-llm-client.md`(`## 1. 개요`
    사용) · `16-system-status-api.md`(개요 섹션 자체 부재 — 제목 다음 바로 `## 1. 대상 큐 레지스트리`)
  - 위반 규약: `CLAUDE.md` "Spec 문서 3섹션 구성(Overview/본문/Rationale) 권장" · `.claude/skills/project-planner/SKILL.md`
    "`## Overview (제품 정의)`" 명명 표
  - 상세: 저장소 전체에서 `## Overview` 55건 vs `## 개요`류 15건으로 이미 혼용돼 있어 강하게
    강제되는 규칙은 아닌 것으로 보이나(권장 문구), `16-system-status-api.md` 는 그 변형조차 없이
    개요 절 자체가 없다 — 3섹션 중 1섹션이 아예 없는 유일한 케이스다.
  - 제안: 이번 배치가 `spec/5-system/` 를 건드리는 김에 `16-system-status-api.md` 최상단에
    짧은 `## Overview` 절(현재 제목 아래 한 문단으로 이미 존재하는 소개 문장을 절로 승격)만
    추가해도 격차가 닫힌다. 나머지 3개 파일의 "## 1. 개요" → "## Overview" 통일은 이번 배치
    스코프 밖이면 별도 항목으로 등재 권고(강제 규칙이 아니므로 CRITICAL 아님).

## 명명·API 문서 규약 관련 — 문제 없음으로 확인된 항목 (참고)

- `3-error-handling.md`/`1-auth.md`/`2-api-convention.md` 의 모든 신규·구 에러 코드는
  `UPPER_SNAKE_CASE` 이거나 `error-codes.md §3` 예외 레지스트리에 명시적으로 등재된
  historical-artifact(초대 흐름 lowercase 등)뿐이었다 — 미등재 lowercase 발견 0건.
- `2-api-convention.md §5.3/§5.4` 의 `details[]` 형태·부재 표현(`null` vs 키 생략) 규칙은
  `swagger.md §1-3/§1-4` 와 상호 SoT 참조가 닫혀 있고 모순 없음.
- `2-api-convention.md §6` 의 `410` 무-기본값 결정과 `error-codes.md` 의 rename 안정성 정책이
  정합적으로 인용됨.

## 요약

`spec/5-system/` 은 이미 여러 라운드의 정합화를 거쳐 명명·응답 봉투·swagger 패턴을
conventions 와 촘촘히 맞춰 놓은 상태다. 이번 검토에서 새로 발견한 격차는 두 가지로 좁혀진다 —
① LLM 도메인의 HTTP 에러 코드 2종이 다른 모든 도메인과 달리 중앙 카탈로그(§1)에 미등재된 점,
② `testConnection` 실패 응답의 필드 계약이 spec 수준에서부터 비어 있어 지금 진행 중인 작업이
발견한 3층 drift(service/DTO/FE)의 문서적 원인이 된 점이다. 둘 다 CRITICAL 급 invariant 파괴는
아니며(다른 시스템이 이 문서를 SoT 로 삼아 무언가를 이미 잘못 구현하게 만드는 구조는 아니다),
등재 의무·wire 정직성이라는 이 문서군 스스로의 반복 원칙에 비춰 보면 방치 시 다음 사람이 같은
종류의 drift 를 반복할 여지가 있는 WARNING 급 공백이다. 구조적 3섹션 규약은 `16-system-status-api.md`
1건을 제외하면 대체로 지켜지고 있다.

## 위험도

LOW

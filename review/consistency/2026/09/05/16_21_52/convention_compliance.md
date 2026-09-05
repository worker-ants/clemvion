# 정식 규약 준수 검토 — `spec-draft-api-convention-verifier-registration.md`

## 검토 범위·방법

target 은 아직 spec 파일을 편집하지 않은 **plan 초안**(`--spec` 모드)이다. 제안된 변경(§5.4
검증자 2종을 `2-api-convention.md`/`swagger.md` 의 frontmatter `code:` 에 등재 + 역할 경계
문단 신설 + `2-api-convention.md` 에 `## Overview` 신설)이 (a) `spec-impl-evidence.md` 의
`code:` 필드 정의, (b) `project-planner/SKILL.md` 의 3섹션 구조 권장, (c) `review-citations.md`
의 인용 규약을 지키는지 실측으로 대조했다. 아래 사실관계는 저장소 원본을 직접 열어
재확인했다 (frontmatter, 대상 파일 존재 여부, import 관계, 인접 spec 문서의 실제 heading
형태, 인용된 리뷰 라운드 원문).

## 발견사항

- **[INFO]** 신설 `## Overview (제품 정의)` 헤딩 형태가 `5-system/` 내부 자매 문서 관행과 다를 수 있음
  - target 위치: `③ 변경안 > spec/5-system/2-api-convention.md` 3번 항목 ("`## Overview (제품 정의)` 신설")
  - 관련 규약: `project-planner/SKILL.md` §Spec 문서 구조(3섹션 권장) — 헤딩 문구 자체(`## Overview (제품 정의)`)를 예시로 제시
  - 상세: 실측 결과 `spec/5-system/` 안에서 실제로 로컬 개요를 가진 3개 문서(`5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`)는 전부 **번호 매김 Korean 헤딩** `## 1. 개요` 를 쓴다(직접 확인). SKILL.md 가 예시로 든 문구 그대로(`## Overview (제품 정의)`, 번호 없음)를 쓰면 같은 폴더 안에서 개요 헤딩 형태가 다시 두 갈래로 갈린다 — 이번 plan 이 처분하는 항목④("Overview 형태가 세 갈래로 갈린다")와 같은 종류의 비대칭을 하나 더 만들 소지가 있다. 규약 위반은 아니다(SKILL.md 가 번호 매김 여부를 강제하지 않고, `data-flow/0-overview.md` 등 비번호 `## Overview` 선례도 이미 존재).
  - 제안: 실행 시 `5-system/` 로컬 관행(`## 1. 개요`)을 따르거나, SKILL.md 원문 형태를 그대로 쓰기로 한다면 "이 섹션은 §1 기술 요약이 아니라 진짜 제품 정의라 별도 헤딩" 같은 한 줄 근거를 그 spec 의 Rationale 에 남겨, 다음 사람이 같은 지적을 다시 만들지 않게 한다.

- **[INFO]** `swagger-probe.ts` 등재가 `2-api-convention.md` 재검토 트리거 범위를 그 파일의 다른 3개 소비처 변경까지 넓힘
  - target 위치: `③ 변경안 > spec/5-system/2-api-convention.md` 1번 항목
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` R-1 (`code:` 글로브/공유 파일의 stale-drift 한계)
  - 상세: 저장소를 직접 열어 확인한 결과 `swagger-probe.ts` 자신의 JSDoc 이 이미 "네 스펙이 같은 보일러플레이트를 반복하고 있었다"고 적으며 `interact-ack-response.dto`·`execution-status-response.dto`·`re-run.dto` 등 **§5.4 와 무관한 DTO 스펙 3곳**에서도 쓰인다고 밝히고 있다. `2-api-convention.md` 의 `code:` 에 등재하면, 그 무관한 3곳만을 위한 편집으로 `swagger-probe.ts` 가 바뀌어도 `--impl-done` 게이트가 `2-api-convention.md` 를 재검토 대상으로 잡는다. 이 자체는 저장소 전역에 이미 넓게 선례된 패턴(예: `hooks.controller.ts` 가 6개 spec 의 `code:` 에 동시 등재)이라 규약 위반은 아니다.
  - 제안: plan ③.2 의 "검증 층" 문단에 "`swagger-probe.ts` 변경은 §5.4 와 무관한 이유로도 일어날 수 있다"는 한 문장을 추가하면, 다음 사람이 `--impl-done` 재검토 트리거를 보고 헷갈리는 것을 예방한다.

## 실측으로 확인된 사항 (참고 — 위반 아님)

아래는 지적하지 않지만, target 이 스스로 근거로 든 수치·인용이 정확한지 검증한 결과다(요청 항목 5 "금지 항목 답습 여부"와 맞물려 신뢰도를 판단하는 데 썼다):

- `codebase/backend/src/shared/testing/{response-contract,swagger-probe}.ts` 실존 확인, `response-contract.ts` 가 실제로 `swagger-probe.ts` 를 import(`buildSwaggerDocument`/`schemasOf`/`schemaOf`) — "SoT" 주장 정확.
- `swagger-dto-contract-guard.ts` 의 `ContractMismatch` vs `response-contract.ts` 의 `ContractViolation` — 두 타입명·의미 구분 표가 코드와 정확히 일치.
- `review/consistency/2026/09/05/15_53_59` W1(naming_collision) 및 그 RESOLUTION 인용문 — 원문과 정확히 일치(조작 없음).
- `--impl-prep 12_48_13` W1("`## Overview` 6개 파일 없음") — 원문 SUMMARY 항목과 일치. 이번 plan 이 "전수로 재니 다르다"고 반증한 개별 파일 상태(`5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`= `## 1. 개요` 보유, `16-system-status-api.md`= 무제목 도입문 보유, `6-websocket-protocol.md`·`2-api-convention.md`= 실제 없음)를 5개 파일 모두 직접 열어 재확인 — 주장대로다.
- `spec/*/​_product-overview.md` 존재 여부(2-navigation·3-workflow-editor·4-nodes·5-system·7-channel-web-chat= 있음, data-flow= 없음) 직접 `ls` 로 재확인 — 방향성 일치(개별 파일 카운트 값 자체는 재현하지 않았으나, 이 결과에 대한 판정에는 카운트 정밀도가 영향을 주지 않는다).
- `code:` 에 guard/test 파일을 등재하는 관행이 이미 넓다는 주장 — `spec/**` frontmatter 를 전수 파싱해 같은 code 경로가 2개 이상 spec 에 등재된 사례 다수 확인(예: e2e-spec 파일들이 여러 spec 에 공유 등재), `swagger.md` 자신도 이미 `swagger-dto-contract*.ts` 를 등재 중 — "자매 검증자가 이미 등재돼 있다"는 핵심 근거가 사실과 일치.
- 신설 파일들이 정확한 파일 경로(글로브 아님)로 등재 예정 — `spec-impl-evidence.md` R-1 이 경계하는 "넓은 트리 글롭"을 피하는 형태.
- plan 문서 자신의 frontmatter(`worktree`/`started`/`owner`/`spec_impact` 리스트) — `plan-lifecycle.md` §4 스키마 완전 준수.
- 본문의 bare `hh_mm_ss` 인용(`--impl-prep 12_48_13`)은 `review-citations.md` §3 표에서 `plan/**` 문서가 명시적으로 제외 대상이라 위반 아님.

## 요약

target plan 은 spec/conventions 의 명시 규약(특히 `spec-impl-evidence.md` 의 `code:` 필드
정의·글로브 관행, `project-planner/SKILL.md` 의 3섹션 구조)을 정확히 이해하고 그 전례를
직접 인용해 따르고 있으며, 근거로 든 모든 수치·인용을 저장소 원본과 대조해도 조작이나
과장이 없었다. CRITICAL·WARNING 급 규약 위반은 발견되지 않았다. 유일한 관찰 포인트는 신설
예정 `## Overview` 헤딩의 표기 형태가 `5-system/` 폴더 내 기존 로컬 관행과 다시 갈릴 수
있다는 점과, 범용 테스트 헬퍼를 등재하면서 생기는 재검토 트리거 확대인데, 둘 다 규약이
금지하는 패턴이 아니라 실행 단계에서 한 문장으로 보완하면 되는 수준이다.

## 위험도
LOW

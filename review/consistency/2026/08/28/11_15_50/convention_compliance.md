STATUS=success convention_compliance review complete (target=spec/5-system/, mode=--impl-prep). Findings: 0 CRITICAL, 0 WARNING, 1 INFO. Note: prompt bundle context-budget truncated 15/18 files in scope (4-execution-engine.md, 5-expression-language.md, 6-websocket-protocol.md, 8-embedding-pipeline.md, 9-rag-search.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md, 13-replay-rerun.md, 14-external-interaction-api.md, 15-chat-channel.md, 17-agent-memory.md, _product-overview.md, 7-llm-client.md, 16-system-status-api.md) — this review covers only the 3 fully-bundled files (1-auth.md, 2-api-convention.md, 3-error-handling.md) in depth, plus direct-file spot checks; absence of findings for the truncated files is NOT evidence of compliance.
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `spec/5-system/`

## 검토 범위 및 한계

- 검토 모드: `--impl-prep`, scope=`spec/5-system/`
- 조립 프롬프트(`_prompts/convention_compliance.md`, 3,965줄)는 컨텍스트 예산 초과로 `spec/5-system/` 18개 파일 중 **3개**(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 전문 포함, 나머지 15개는 "본문 생략됨 — 컨텍스트 예산 초과" 로 절단됨.
- 아래 발견사항은 전문이 포함된 3개 파일 + 대조에 필요한 `spec/conventions/error-codes.md`·`swagger.md`·`audit-actions.md` 직접 열람을 기반으로 한다. 생략된 15개 파일(특히 `14-external-interaction-api.md`(131KB)·`4-execution-engine.md`(224KB)·`6-websocket-protocol.md`(91KB)·`15-chat-channel.md`(76KB))은 이번 패스에서 규약 준수 여부를 판정하지 못했다 — "발견 없음" 을 "규약 위반 없음" 의 근거로 삼지 말 것.

## 발견사항

- **[INFO]** `2-api-convention.md` 에 `## Overview` 섹션 표제가 없음
  - target 위치: `spec/5-system/2-api-convention.md` 최상단 (H1 `# Spec: API 설계 규칙` 직후, `## 1. 기본 원칙` 진입 전)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "Spec 문서 3섹션 구성(Overview / 본문 / Rationale)" 권장, 문서 구조 규약 관점 3
  - 상세: 같은 번들에 전문 포함된 `1-auth.md`·`3-error-handling.md` 는 모두 본문 첫머리에 범위·책임경계를 서술하는 `## Overview` 섹션을 두고 있으나(예: `3-error-handling.md` "본 문서는 제품 전반의 에러 처리 정책을 단일 진실로 정의한다…"), `2-api-convention.md` 는 관련 문서 링크만 있고 바로 `## 1. 기본 원칙` 으로 진입한다. `## Rationale` 섹션은 존재하므로 3섹션 중 Overview 만 결여됐다. 단, `spec/5-system/` 전체를 훑으면 `11-mcp-client.md`·`16-system-status-api.md`·`6-websocket-protocol.md`·`7-llm-client.md`·`5-expression-language.md`·`_product-overview.md` 도 동일하게 `## Overview` 헤딩이 없어(18개 중 7개), 이는 `2-api-convention.md` 고유의 신규 이탈이 아니라 이 spec 영역에 걸쳐 있는 **선재하는 패턴**이다. "권장" 사항이라 CRITICAL/WARNING 으로 올리지 않음.
  - 제안: 이번 impl-prep 스코프에서 구현을 막을 사유는 아니므로 즉시 조치 불필요. 추후 `spec/5-system/` 문서 구조를 일괄 정리하는 별도 plan 항목으로 묶어 처리하는 편이 낫다(개별 파일 단위로 산발적으로 고치면 재발한다).

## 그 외 확인했으나 위반이 아닌 항목 (참고용)

- **감사 액션 명명** — `1-auth.md §4.1`/`§4.1.A`/`§4.1.B` 이 선언하는 `user.*`/`auth_config.*` 액션·dot-prefix·과거분사 시제는 `conventions/audit-actions.md` §1~§3 taxonomy 와 정합. `workspace_type_mismatch`/`already_a_member` 등 lowercase 초대 흐름 코드도 `error-codes.md §3` historical-artifact 레지스트리와 양쪽에서 상호 참조되며 일관됨.
- **에러 코드 명명** — `3-error-handling.md §1` 전 카탈로그가 `UPPER_SNAKE_CASE`(§1.2.1/§1.7/§1.8/§1.9 각 절 하단에 명시)를 따르고, `error-codes.md §1`(의미 기반 명명)·§2(rename 안정성)·§3(예외 레지스트리)과 교차 참조가 착지한다. 신규로 보이는 코드(`MASKED_VALUE_RESUBMITTED`, `WORKSPACE_TYPE_MISMATCH` 등)도 모두 카탈로그·레지스트리 양쪽에 등재돼 있다.
- **API 엔드포인트 명명** — `2-api-convention.md §2.2`(복수형 명사·kebab-case·중첩 2단계)에 대해 `1-auth.md §5`/본문에 나열된 전 엔드포인트(`/api/auth/2fa/webauthn/*`, `/api/auth-configs/:id/reveal` 등)를 대조한 결과 위반 없음. RPC-style sub-channel 예외(`§2.2` 명시 예외)에 해당하는 `/api/triggers/:id/notification/rotate-secret` 류도 규약이 스스로 정의한 예외 조항 안에 있다.
- **응답 envelope/DTO 패턴** — `2-api-convention.md §5.1~§5.4`·`3-error-handling.md §2` 의 `{ data }`/`{ error }` 봉투, 비-페이징 고정 컬렉션(`{ data: { items } }`) 처리가 `conventions/swagger.md §2-5`·§5-2·§6 과 정합. `webauthn.dto.ts`/`webauthn-response.dto.ts` 등 언급된 DTO 파일 경로도 swagger.md §5-1 의 `dto/responses/*-response.dto.ts` 위치 규약을 따른다.
- **WS 이벤트 명명 이질성(dot vs colon)** — `2-api-convention.md §10.3` 이 `execution.*`/`node.*`(dot) 와 `document:embedding_*`(colon) 를 나란히 제시해 언뜻 명명 불일치로 보이나, `6-websocket-protocol.md` 본문(§KB 채널 단위 전환)에 "이벤트 표기는 콜론+언더스코어를 사용 — backend type union 의 형식과 일치" 라는 명시적 근거가 있어 의도된 설계다. `spec/conventions/` 에 WS 이벤트 명명 규약 문서 자체가 없어(대상 규약 부재) 판정 대상에서 제외.

## 요약

전문이 확보된 3개 파일(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`) 범위에서는 정식 규약(`error-codes.md`·`audit-actions.md`·`swagger.md`) 위반이 발견되지 않았다. 이 spec 영역은 명명·응답 포맷·감사 액션 각각에 대해 별도 conventions 문서를 SoT 로 두고 상호 참조를 촘촘히 유지하는 성숙한 상태이며, 근접 명명 충돌(`PASSWORD_INVALID` vs `INVALID_PASSWORD` vs `PASSWORD_REQUIRED` 등)까지 문서 내에서 명시적으로 구분해 둔다. 유일한 지적은 `2-api-convention.md` 의 `## Overview` 섹션 헤딩 부재로, `spec/5-system/` 전역에 걸친 선재 패턴이라 INFO 로 낮춘다. 다만 이번 패스는 컨텍스트 예산으로 15개 파일(대형 파일 다수 포함)의 본문을 보지 못했으므로, 그 파일들에 대한 규약 준수 여부는 **미확인 상태**로 남겨 둔다 — 특히 EIA·webhook·chat-channel·execution-engine 처럼 에러 코드·이벤트 페이로드가 많은 문서는 별도 패스로 재검토가 필요하다.

## 위험도

NONE

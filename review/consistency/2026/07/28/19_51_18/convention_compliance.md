# 정식 규약 준수 검토 — spec/5-system/ (1-auth.md · 10-graph-rag.md · 11-mcp-client.md)

> 방법론 노트: `prompt_file` 의 "정식 규약 모음" 번들이 컨텍스트 예산 초과로 사실상 비어 있어(아래
> 발견사항 참고), target 3개 파일과 인용된 `spec/conventions/*.md` 전량을 워킹디렉토리에서 직접
> `Read`/`Bash` 로 재조회해 검증했다. 아래 결론은 프롬프트 payload 가 아니라 실제 파일 상태 기준.

## 발견사항

- **[WARNING]** `convention_compliance` 프롬프트의 "정식 규약 모음" 번들이 실질적으로 공백
  - target 위치: (target 문서 자체가 아니라) 본 검토의 입력 payload — `_prompts/convention_compliance.md` §"정식 규약 모음 (spec/conventions/)"
  - 위반 규약: 해당 없음 (target 문서 위반이 아니라 리뷰 harness 의 프롬프트 조립 이슈)
  - 상세: `spec/conventions/**` 40여 개 파일 중 실제로 본문이 포함된 것은 `audit-actions.md` + `cafe24-api-catalog/_overview.md`/`application.md` + Application 카테고리 field-level 문서 일부뿐이었다. 3개 target 문서가 실제로 반복 인용하는 `error-codes.md`·`node-output.md`·`swagger.md`·`secret-store.md`·`migrations.md`·`execution-context.md`·`cross-node-warning-rules.md`·`cafe24-api-metadata.md`·`spec-impl-evidence.md` 등은 전부 "컨텍스트 예산 초과로 생략된 파일 258개" 목록에만 경로로 나열되고 본문은 빠졌다. 원인은 `spec/conventions/cafe24-api-catalog/**` 하위 약 230개의 자동 생성 필드별 참조 문서(`spec-impl-evidence.md` §1/§R-7 이 스스로 "lifecycle 을 추적하는 정식 spec 이 아니다" 라고 명시하는 문서군)가 알파벳 순으로 먼저 번들에 채워져, 정작 이 3개 target 이 요구하는 상위 규약 문서 전량을 예산 밖으로 밀어냈기 때문이다. 프롬프트 자체는 "Read 로 직접 열어라" 라는 fallback 지시를 남겨두어 이번 검토는 영향받지 않았으나(직접 Read 로 전량 재검증), 그 지시를 엄격히 따르지 않는 실행에서는 정확히 이 3개 문서가 가장 많이 인용하는 규약들이 통째로 검증 공백이 되어 false negative 를 낼 위험이 있다.
  - 제안: target 문서 수정 사항 아님. orchestrator 의 프롬프트 조립 로직이 `spec/conventions/` 번들을 채울 때 카탈로그성 대량 참조 문서(`*-api-catalog/<resource>/**`, `spec-impl-evidence.md` §1 제외 목록과 동일 패턴)를 후순위로 미루거나 별도 예산으로 분리하고, 실제 target 문서가 인용하는 규약 파일을 우선 포함하도록 조정 검토 권장.

- **[INFO]** Overview 섹션 표기 방식이 3개 target 문서 간 서로 다름 (조치 불요)
  - target 위치: `1-auth.md` L24 (`## Overview`) · `10-graph-rag.md` L30 (`## Overview (제품 정의)`, 이후 별도 넘버링으로 `## 1. 개요` 재시작) · `11-mcp-client.md` L19 (별도 Overview 헤딩 없이 `## 1. 개요` 로 바로 시작)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` / 본문 / `## Rationale`
  - 상세: 3개 문서가 모두 다른 변형을 쓴다. 다만 동일 폴더의 다른 파일들을 대조한 결과 셋 다 기존 선례와 일치한다 — `## Overview (제품 정의)` 변형은 `12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`·`8-embedding-pipeline.md`·`9-rag-search.md` 등 다수가 공유하고, "별도 Overview 없이 `## 1. 개요` 로 시작" 패턴은 `2-api-convention.md`·`5-expression-language.md`·`6-websocket-protocol.md`·`7-llm-client.md`·`16-system-status-api.md` 가 이미 공유한다. SKILL.md 자체도 "3섹션 **권장**"(강제 아님)으로 명시한다.
  - 제안: 조치 불요. 규약이 "권장" 이고 두 변형 모두 기존 스펙 코퍼스에 광범위한 선례가 있어 이번 3개 문서만의 이탈이 아니다.

- **[INFO]** Graph RAG "도메인 용어 vs 구현 식별자" 병기 패턴은 이번이 첫 사례
  - target 위치: `10-graph-rag.md` §2.3~2.5 헤더("신규, 구현: `GraphEntity`" 등) + `## Rationale` "구현 식별자 주의" 단락 (최근 커밋 `71ce6c12b` 로 추가)
  - 위반 규약: 위반 아님 — 실측으로 정확성 확인 완료(`codebase/backend/src/modules/knowledge-base/entities/{entity,relation,chunk-entity}.entity.ts` 의 `export class GraphEntity/GraphRelation/GraphChunkEntity` 및 JSDoc 이 spec 서술과 일치)
  - 상세: "TypeORM `@Entity` 데코레이터·심볼 충돌 회피를 위해 구현 클래스명에만 `Graph` 접두를 붙이고 도메인 용어는 접두 없이 유지한다"는 설명 패턴은 `spec/` 전체를 검색해도 다른 곳에 선례가 없다(`grep`으로 확인) — 이번이 최초 도입이며 별도 `spec/conventions/*.md` 로 일반화되어 있지 않고 해당 spec 문서의 Rationale 각주로만 존재한다. 현재로서는 발생 지점이 1건뿐이라 이 정도 지역화가 적절하다.
  - 제안: 조치 불요. 다만 동일 유형(제품 도메인 명사가 프레임워크 예약어/데코레이터와 충돌해 구현체에만 접두/접미가 붙는 경우)이 다른 영역에서도 반복되면, `error-codes.md` §3 historical-artifact 레지스트리·`audit-actions.md` 처럼 공용 `spec/conventions/` 문서로 승격하는 것을 향후 고려할 만하다(현재는 n=1 이라 과설계 방지 차원에서 보류가 맞다).

## 요약

3개 target 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`) 를 프롬프트 payload 가 아닌 워킹디렉토리 원본과 인용된 `spec/conventions/*.md`(audit-actions, error-codes, node-output, swagger, secret-store, migrations, execution-context, cross-node-warning-rules, cafe24-api-metadata, spec-impl-evidence) 원문을 직접 대조해 검증한 결과, **명명 규약·출력 포맷 규약·API 문서 규약·금지 항목 전 영역에서 CRITICAL/WARNING 급 위반을 발견하지 못했다.** 특히 관심 있게 본 지점들 — 초대 API 의 `lower_snake_case` 에러 코드(`error-codes.md` §3 historical-artifact 레지스트리와 정확히 일치), `skipReason` 의 `lower_snake_case` vs 에러 코드 `UPPER_SNAKE_CASE` 구분(`node-output.md` §3.2 인용 정확), `ai_agent:tool-payload-budget` graph warning id(`cross-node-warning-rules.md` §8 등재와 일치), Cafe24 catalog key `cafe24.<resource>.<operation>` 형식(`cafe24-api-metadata.md` §7.5 와 일치), Integration 자격증명 AES-256-GCM 경로가 `secret-store.md` 의 `SecretResolver` 스코프 밖(동 문서 §1 "비대상" 조항과 일치)이라는 서술, migrations 의 NOT VALID 2-step 예외 근거를 `codebase/backend/migrations/README.md` 로 위임하는 것(`migrations.md` 자신이 그렇게 위임 지정) — 이 전부 실제 규약 문서·소스 코드 대조로 정확함을 확인했다. `10-graph-rag.md` 의 최근 커밋(`GraphEntity`/`GraphRelation`/`GraphChunkEntity` 식별자 병기)도 실제 엔티티 파일과 대조해 정확성을 확인했다. frontmatter `code:` 글로브(3개 문서 전량)와 `pending_plans:` 경로도 모두 실존을 확인해 `spec-impl-evidence.md` 준수를 만족한다. 유일하게 실질적인 지적 사항은 target 문서 자체가 아니라 이 검토의 입력 프롬프트 조립 방식(위 WARNING) 이다.

## 위험도

LOW

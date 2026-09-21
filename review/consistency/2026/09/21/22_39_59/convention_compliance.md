# 정식 규약 준수 검토 — spec/5-system

## 검토 방법 메모

프롬프트 번들(`_prompts/convention_compliance.md`)은 컨텍스트 예산 초과로 `spec/5-system/*.md` 17개 중 3개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문이 실렸고 나머지 14개와 `spec/conventions/**` 대부분은 절단됐다(기존에 알려진 `--spec`/`--impl-prep` 번들 예산 한계와 동일 패턴). 절단된 파일은 저장소에서 직접 `Read`로 열어 대조했다 — 특히 `spec/conventions/{error-codes,swagger,redis-keys,audit-actions,node-output,migrations}.md` 전문과 `spec/5-system/{4-execution-engine,15-chat-channel,16-system-status-api,11-mcp-client,7-llm-client,5-expression-language,17-agent-memory}.md`의 관련 구간을 직접 확인했다. "없다는 사실을 없다는 근거로 삼지 말 것"이라는 지시를 따라, 결론 근거는 모두 실제 파일 열람으로 확인했다.

또한 `git diff origin/main...HEAD -- spec/`가 빈 결과였다 — 이 세션(`race-helper-guard-tests`)은 spec 을 변경하지 않았고, 본 검토는 `1-auth.md`의 `code:` glob(`audit-logs/**`)이 이번 작업 대상(WebAuthn/ModelConfig 동시 삭제 감사 dedup)과 겹쳐 자동 번들된 **standing 감사**로 보인다. 아래 발견사항은 diff 유발이 아니라 기존 상태에 대한 것이다.

## 발견사항

- **[WARNING] `## Overview` 헤딩 컨벤션 미준수 — 4개 파일**
  - target 위치: `spec/5-system/5-expression-language.md`(L12~18) · `spec/5-system/7-llm-client.md`(L20~26) · `spec/5-system/11-mcp-client.md`(L13~19) · `spec/5-system/16-system-status-api.md`(L8~14)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §문서 구조("`## Overview (제품 정의)` — 영역의 사용자 가치·요구사항·목표") 및 CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
  - 상세: `spec/5-system/*.md` 17개 중 13개는 `## Overview` 또는 `## Overview (제품 정의)` 헤딩을 정확히 쓴다(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`·`6-websocket-protocol.md`·`8~10`·`12~15`·`17-agent-memory.md`). 그런데 위 4개 파일은 그 헤딩이 없다 — `5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`는 대신 번호 매겨진 `## 1. 개요`를 첫 섹션으로 쓰고, `16-system-status-api.md`는 그마저도 없이 frontmatter 직후 평문 한 단락 다음 바로 `## 1. 대상 큐 레지스트리`로 진입한다(자체 개요 섹션 자체가 부재). 4개 모두 `## Rationale`은 정상적으로 마지막 섹션에 있어 3섹션 중 처음 하나만 어긋난다.
    - 이 편차는 신규가 아니다 — `11-mcp-client.md`는 저장소 초기(2026-05-04, 최초 커밋 `343cfe3f3`)부터 이 형태였다. 자동화 도구가 정확히 이 문자열(`## Overview`)에 의존하는 곳은 찾지 못했다(`.claude/tests/test_consistency_impl_done.py`의 fixture 문자열이 유일하게 그 표기를 쓰지만 실제 파서는 헤딩 텍스트가 아니라 frontmatter/섹션 존재 자체를 본다) — 그래서 CRITICAL이 아니라 WARNING이다.
  - 제안: 위 4개 파일의 첫 본문 섹션 헤딩을 `## Overview` 또는 `## Overview (제품 정의)`로 통일하거나, 이 4개가 의도적으로 다른 스타일(더 오래된 세대의 spec)이라면 SKILL.md 쪽에 "레거시 문서는 소급 강제하지 않는다"는 예외 문구를 명시해 문서-구현 간 기대 불일치를 없앤다. `developer`는 `spec/` write 권한이 없으므로 정정은 `project-planner` 턴이 필요하다.

- **[INFO] `spec/conventions/migrations.md`의 Rationale 절 표기가 다른 conventions 문서와 형식이 다름**
  - target 위치: 대상 문서(`spec/5-system`) 자체는 아니고, `1-auth.md §1.4.G`가 참조하는 `spec/conventions/migrations.md` §7
  - 위반 규약: 문서 구조 관례(다른 `spec/conventions/*.md`는 전부 `## Rationale`을 리터럴 헤딩으로 씀 — `error-codes.md`·`swagger.md`·`redis-keys.md`·`audit-actions.md` 확인됨)
  - 상세: `migrations.md`는 `## 7. 폐기 대안 (Rationale)`로 번호+괄호 병기하고, 그 뒤에 `## 참고`가 하나 더 붙어 Rationale이 마지막 섹션이 아니다. 기능적으로는 동등한 내용(기각 대안 서술)이라 실질 문제는 없지만, 다른 컨벤션 문서들과 헤딩 표기가 갈린다.
  - 제안: 우선순위 낮음(스타일 통일). `project-planner`가 이 문서를 다음에 손댈 때 `## Rationale`로 맞추는 정도로 충분.

- **[INFO] 절단된 번들로 인한 검증 공백 고지**
  - target 위치: `spec/5-system/{4,6,7,8,9,10,11,12,13,14,15,17}-*.md`, `_product-overview.md`, `5-expression-language.md`, `16-system-status-api.md`
  - 상세: 위 14개 파일은 `_prompts` 번들에서 본문이 전부 생략됐다. 본 검토자가 저장소에서 직접 열어 명명 규약(redis 키·audit 액션·에러 코드 UPPER_SNAKE_CASE) 위반 여부를 표본 검사했으나(§9.2 Redis 키 표, `trigger.*` 감사 액션명, WebAuthn 삭제 감사 액션 등) 전수 정밀 검토는 아니다 — 특히 `chat-channel-adapter.md`(703줄)·`conversation-thread.md`(756줄) 대비 `15-chat-channel.md`·`14-external-interaction-api.md`의 패턴 준수는 표제·구조 수준만 확인했다.
  - 제안: 이 캡을 알고 있는 다음 checker(특히 `naming_collision`·`cross_spec`)가 같은 14개 파일을 중복으로 얕게 훑기보다, 이번에 확인된 3개(1-auth·api-convention·error-handling)를 제외한 나머지에 집중하면 커버리지가 보완된다.

## 표본 검사에서 위반이 발견되지 않은 항목 (기록용)

- Redis 키 명명: `4-execution-engine.md`가 언급하는 `exec:{ws}:execution:{id}:context`·`node:{id}:output`·`worker:{id}:heartbeat`·`lock:{id}`·`queue:priority`·`ws:{wsId}:session:{connId}`·`core:{wsId}:rate:{userId}`는 전부 "Phase-1 설계 대체 — 구현되지 않았고 코드에 존재하지 않는다"는 명시 각주 안에 있다 — `redis-keys.md` §3 인벤토리 미등재가 아니라 애초에 실재하지 않는 키다. `agent-memory:<workspaceId>:<scopeKey>`(`17-agent-memory.md`)는 BullMQ jobId이며 `redis-keys.md` §4가 명시 제외하는 `bull:<queue>:*` 계열이라 등재 대상이 아니다.
- 감사 액션 명명: `plan/in-progress/spec-sync-auth-gaps.md`가 기록한 과거 오기 3곳(`trigger.delete`/`trigger.update` → `trigger.deleted`/`trigger.updated`)은 저장소 전수 검색(`rg`) 결과 0건 — 이미 정정되어 남아 있지 않다.
- API 엔드포인트 명명: `spec/5-system/*.md` 전체에서 `(GET|POST|PATCH|PUT|DELETE) /api/...` 패턴을 추출해 대문자·camelCase 세그먼트 위반을 찾았으나 전부 kebab-case 리소스 + `2-api-convention.md §2.2`가 명시한 예외(RPC-style sub-channel, `/api/auth/*`, `/api/external/*`)로 설명 가능했다.
- frontmatter `pending_plans` 의무: `status: partial`인 5개 파일(`1-auth`·`4-execution-engine`·`9-rag-search`·`14-external-interaction-api`·`15-chat-channel`) 전부 `pending_plans`를 갖고 있어 `.claude/docs/plan-lifecycle.md`의 강제 요건을 충족한다.

## 요약

`spec/5-system` 은 이미 여러 차례의 consistency/impl-done 라운드를 거쳐 `spec/conventions/**`와 매우 촘촘하게 상호 참조돼 있고(에러 코드·API 응답 포맷·swagger DTO 패턴·redis 키·감사 액션 명명 모두 SoT 포인터 + historical-artifact 레지스트리로 정리됨), 이번 표본 검토에서 CRITICAL 급 정식 규약 위반은 발견되지 않았다. 유일한 실질 발견은 4개 파일(`5-expression-language`·`7-llm-client`·`11-mcp-client`·`16-system-status-api`)이 문서 구조 컨벤션의 `## Overview` 헤딩을 쓰지 않는 오래된(2026-05 이래) 편차로, 자동화 의존이 확인되지 않아 WARNING 등급이다. 다만 본 검토는 프롬프트 번들의 컨텍스트 예산 절단으로 14/17 대상 파일을 저장소 직접 열람으로 표본 보완한 것이며 전수 정밀 검토는 아니라는 한계를 명시한다.

## 위험도

LOW

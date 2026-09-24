# 정식 규약 준수 검토 — `spec/5-system` (--impl-prep)

## 검토 방법 메모

`prompt_file` 번들은 컨텍스트 예산 초과로 `spec/5-system` 18개 파일 중 15개(`4-execution-engine.md`
등)의 본문을 절단했다. 번들에 없는 내용을 "문제 없음" 의 근거로 삼지 말라는 지시에 따라, 절단된
파일 포함 전체 17개 스펙 파일(`_product-overview.md` 제외 16개 본문 + 1개)을 디스크에서 직접
`Read`/`grep` 으로 훑어 명명·출력 포맷·에러 코드·Redis 키·DTO 명명·금지 패턴을 대조했다. 다만
13,044줄 전체를 한 글자씩 정독한 것은 아니며, 아래 각 축의 **grep 기반 전수 스캔**으로 커버리지를
확보했다(결과는 각 항목에 실측 근거로 표기). 잔여 리스크는 grep 패턴이 놓칠 수 있는 산문 서술
수준의 미세한 사례에 한정된다.

## 발견사항

- **[WARNING] `## Overview` 헤딩 표기가 같은 디렉터리 안에서 갈린다**
  - target 위치: `spec/5-system/5-expression-language.md`, `7-llm-client.md`, `11-mcp-client.md` (각 `## 1. 개요`), `16-system-status-api.md`(개요 헤딩 자체 없음 — 무헤딩 리드 문단 뒤 바로 `## 1. 대상 큐 레지스트리`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` 를 표준 섹션 헤더로 명시
  - 상세: `spec/5-system` 17개 파일 중 13개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`·`6-websocket-protocol.md`·`8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`)는 리터럴 `## Overview` 헤더를 쓰는데, 나머지 4개는 `## 1. 개요`(번호+한국어) 또는 헤딩 없음으로 갈린다. 같은 도메인 폴더 안에서 SoT 섹션 이름이 두 가지로 공존한다. 다만 이 변이는 `spec/5-system` 국지 현상이 아니라 저장소 전체에 이미 퍼져 있다(전체 96개 depth≤2 spec 파일 중 `## Overview` 55개 vs `## 1. 개요` 15개) — 이번 변경이 새로 만든 이탈이 아니라 기존에 방치된 스타일 분기다.
  - 제안: (a) 이번 impl-prep 스코프에 걸리는 4개 파일만이라도 `## Overview` 로 통일하거나, (b) 통일 비용이 크면 SKILL.md 의 "3섹션 권장" 문구에 "`## N. 개요` 도 동등하게 허용" 을 명시해 규약을 실태에 맞추는 것을 검토. 어느 쪽도 하지 않으면 다음 검토에서 같은 지적이 반복된다.

- **[INFO] 연속된 구분선(`---`) 중복**
  - target 위치: `spec/5-system/3-error-handling.md:296-298` (`§1.12` 표 뒤, `## 2. 에러 응답 형식` 앞에 `---` 두 줄이 빈 줄 하나를 사이에 두고 연달아 있음)
  - 위반 규약: 명시적 규약 없음(순수 포맷 일관성)
  - 상세: 저장소 전체 `spec/5-system/*.md` 스캔에서 유일하게 이 파일에서만 관측된 편집 잔재. 렌더링 시 빈 `<hr>` 이 두 번 나온다.
  - 제안: `---` 한 줄로 정리. 사소하므로 다음 편집 시 함께 정리해도 무방.

## 준수 확인 (grep/대조로 검증 — 위반 없음)

아래는 이번 검토가 명시적으로 대조했고 **위반을 찾지 못한** 항목이다. 다음 리뷰가 같은 축을
재검사하는 비용을 줄이기 위해 근거를 남긴다.

- **에러 코드 표기(`UPPER_SNAKE_CASE`) 및 historical-artifact 예외** — `3-error-handling.md` §1.1~§1.12 전 코드가 `conventions/error-codes.md` §1/§3 을 정확히 인용하며, `1-auth.md` 의 lowercase 코드(`invitation_not_found` 등)는 전부 `error-codes.md` §3 예외 레지스트리에 이미 등재된 항목과 1:1 대응한다. 신규 미등재 lowercase 코드는 발견되지 않았다.
- **감사 액션 명명(`<resource>.<verb>`, 시제 3분류)** — `1-auth.md` §4.1 의 전 액션(`user.*`/`auth_config.*`/`trigger.*`/`execution.re_run` 등)이 `conventions/audit-actions.md` §1~§3 레지스트리와 정확히 일치. `re_run_initiated` 언급은 전부 "구 표기"로 역사적 맥락에서만 등장(현재형 오용 아님).
- **Redis 키 인벤토리** — `4-execution-engine.md §9.2`(`exec:recover:lock`·`exec:cont:seq:`·`exec:seq:`)와 `14-external-interaction-api.md §8.4`(`eia:rl:interact:`·`eia:rl:status:`·`eia:notif:rl:`·`interaction:idempotency:`)가 `conventions/redis-keys.md §3` 전역 인벤토리와 정확히 일치. 미등재 신규 키 패턴 없음.
- **DTO 명명(`Update<Entity>Dto` top-level 한정, `Patch` 접두 금지)** — `spec/5-system/*.md` 전체에서 언급된 DTO 이름(`UpdateTriggerDto`·`UpdateAssistantSessionDto`·`InteractAckDto`·`SystemStatusOverviewDto` 등) 중 `Patch*Dto` 패턴 또는 `swagger.md §1-7` 위반 사례 없음.
- **URL 명명(케밥 케이스, 자원 액션 동사 위치)** — `spec/5-system/*.md` 의 전 `GET/POST/PATCH/DELETE /api/...` 경로를 추출해 대조한 결과, 리터럴 세그먼트는 전부 kebab-case(`rotate-bot-token`·`background-runs`·`re-run` 등)이고 대문자·언더스코어 세그먼트는 전부 경로 파라미터명(`:executionId` 등, camelCase 허용 대상)이다. `PUT` 메서드·`@Put()` 사용 0건(§3 "PUT 사용하지 않음" 준수).
- **레거시 페이지네이션 이중 래핑 안티패턴** — `2-api-convention.md §5.2`/Rationale 이 `{data:{items,totalItems,page,limit}}` 패턴을 명시적으로 반례로 지목하며 비-페이징 `{data:{items}}` 형태와 구분해 서술 — `swagger.md §6` 금지 패턴을 스스로 재확인하는 서술이라 위반 아님.
- **`pending_plans` frontmatter 형식** — `1-auth.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`4-execution-engine.md`·`9-rag-search.md` 의 `pending_plans` 항목 전부가 `plan/in-progress/` 에 실재하는 파일을 가리킨다(댕글링 참조 0건). 직전 커밋(`93b4ce6d3`)이 이 축의 사고를 이미 정정한 상태와 일치.

## 요약

`spec/5-system` 은 이미 수십 회의 consistency-check 라운드를 거친 성숙한 문서군으로, 에러 코드
명명·Redis 키 인벤토리·DTO 명명·URL 케밥케이스·레거시 안티패턴 등 핵심 정식 규약 축에서 위반이
발견되지 않았다(전수 grep 대조 결과 첨부). 유일한 실질 지적은 문서 구조 규약의 `## Overview`
헤딩 표기가 폴더 내 4개 파일에서 `## 1. 개요`/헤딩 부재로 갈리는 것인데, 이는 이번 변경이 만든
새 이탈이 아니라 저장소 전반에 이미 퍼진 기존 스타일 분기라 impl-prep 을 막을 사안은 아니다.
`3-error-handling.md` 의 중복 구분선은 순수 포맷 잡음이다.

## 위험도

LOW

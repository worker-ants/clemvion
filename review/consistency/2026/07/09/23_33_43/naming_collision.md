# 신규 식별자 충돌 검토 결과

## 사전 안내 — prompt_file 페이로드 불일치

`prompt_file` 에 담긴 "Target 문서"/"구현 대상 spec 영역" 본문은 `spec/5-system/1-auth.md`,
`spec/5-system/10-graph-rag.md`, `0-overview.md`, `1-data-model.md`, 워크스페이스 슬러그
라우팅 plan, `conventions/api-catalog-conventions.md`, `cafe24-api-catalog/**` 등 본 작업
(`trigger-param-output-enricher`)과 무관한 대용량 콘텐츠였고, 실제 diff 대상인
`spec/5-system/5-expression-language.md` / `node-output-schema-enrichers.ts` /
`use-expression-context.ts` / `plan/in-progress/trigger-param-output-enricher.md` 는
prompt 어디에도 포함돼 있지 않았다 (grep 0건). 이는 orchestrator 의 prompt 조립 단계
결함으로 보인다 — 별도 세션(예: 워크스페이스 슬러그 라우팅 관련 검토)용 페이로드가
잘못 재사용됐을 가능성이 있다.

이에 따라 본 checker 는 payload 를 무시하고 **HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-param-output-enricher-92985f`)의
`git diff origin/main...HEAD`** 를 1차 근거로 독립 확인하여 아래 분석을 수행했다.
실제 diff 범위: `spec/5-system/5-expression-language.md` (§7.2 표 1행 추가),
`codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts`
(`enrichManualTriggerOutputSchema` 함수 신규 + `INFO_EXTRACTOR_TYPE_MAP` →
`JSON_SCHEMA_IDENTITY_TYPE_MAP` rename), `use-expression-context.ts` (2개 호출부 분기 추가),
`plan/in-progress/trigger-param-output-enricher.md` (신규 plan).

## 발견사항

없음 — 신규 식별자 충돌 관점에서 CRITICAL/WARNING/INFO 발견 없음.

검증한 항목:

- **함수명 `enrichManualTriggerOutputSchema`** — 저장소 전체 `git grep` 결과 정의는
  `node-output-schema-enrichers.ts:339` 1곳뿐이고, 나머지는 import/호출/테스트에서의
  동일 참조. 기존 `enrichInfoExtractorOutputSchema` / `enrichFormOutputSchema` /
  `enrichTableOutputSchema` / `enrichTransformOutputSchema` 4개와 이름 패턴이 일관되고
  중복·재정의 없음.
- **상수명 rename `INFO_EXTRACTOR_TYPE_MAP` → `JSON_SCHEMA_IDENTITY_TYPE_MAP`** — 구
  이름의 잔존 참조 0건(완전 치환 확인), 신 이름은 파일 내 2회(공유) 참조 외 타 파일
  중복 정의 없음.
- **spec 표 신규 행 `manual_trigger`** (`spec/5-system/5-expression-language.md §7.2`) —
  `manual_trigger` 는 `spec/1-data-model.md:167`, `spec/3-workflow-editor/0-canvas.md:538`,
  `spec/3-workflow-editor/1-node-common.md:275`,
  `spec/3-workflow-editor/4-ai-assistant.md` 등에서 이미 쓰이는 **기존 노드 타입
  식별자**를 그대로 재사용한 것이며 신규 의미 부여가 아니다 (테이블 행 추가만).
  같은 표의 기존 4행(`information_extractor`/`form`/`table`/`transform`)과 겹치지 않음.
- **`use-expression-context.ts` 신규 분기 조건** `sourceType === "manual_trigger"` /
  `nodeType === "manual_trigger"` — origin/main 기준 기존 `else if` 체인
  (`information_extractor`/`form`/`table`/`transform`)에 `manual_trigger` 분기가
  없었음을 확인(사전 미존재), 신규 추가는 순수 additive이고 기존 분기와 겹치지 않음.
- **plan 파일 경로** `plan/in-progress/trigger-param-output-enricher.md` — `plan/in-progress/`,
  `plan/complete/` 어디에도 동명·유사명 파일 없음(신규, 충돌 없음). frontmatter 의
  `spec_area: spec/4-nodes/7-trigger/1-manual-trigger.md` 표기는 실제 spec 반영처가
  `spec/5-system/5-expression-language.md §7.2` 로 옮겨간 사실을 본문 "정정" 절에서
  스스로 정정해두고 있어 별도 지적 불필요.
- **API endpoint / 이벤트 / ENV var 신규 도입** — 본 diff 는 프론트엔드 표현식
  자동완성 UX 전용이며 신규 REST endpoint, webhook/queue/SSE 이벤트명, 환경변수를
  전혀 도입하지 않음. 해당 관점 점검 대상 없음.

## 요약

실제 diff(`origin/main...HEAD`)를 기준으로 재확인한 결과, 이번 변경이 도입하는 신규
식별자(`enrichManualTriggerOutputSchema` 함수, `JSON_SCHEMA_IDENTITY_TYPE_MAP` 리네임,
spec 표의 `manual_trigger` 신규 행, 신규 plan 파일 경로) 는 모두 기존 사용처와
충돌하지 않으며 기존 명명 패턴(4개 enricher 함수·contents table 행 구조)을 그대로
따른다. `manual_trigger` 는 이미 여러 spec/코드 위치에서 동일 의미로 쓰이던 기존 노드
타입 식별자의 재사용일 뿐 신규 의미 부여가 아니다. 다만 orchestrator 가 전달한
`prompt_file` 페이로드 자체가 본 작업과 무관한 다른 세션 콘텐츠(인증/그래프RAG/워크스페이스
슬러그 라우팅/Cafe24 카탈로그 등)로 채워져 있었다는 프로세스 결함이 발견됐으며, 이는
naming-collision 관점의 실체적 위험은 아니지만 orchestrator 의 prompt 조립 로직 점검이
필요함을 시사한다.

## 위험도

NONE

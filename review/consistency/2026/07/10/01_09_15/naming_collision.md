# 신규 식별자 충돌 검토 — naming_collision

## ⚠️ 프롬프트 payload 불일치 안내

`_prompts/naming_collision.md` 의 "Target 문서" 섹션은 `spec/5-system/1-auth.md` ·
`spec/5-system/10-graph-rag.md` 전문을 담고 있으나, 실제 이번 변경(HEAD 워킹트리
`git diff origin/main`)은 이 두 파일을 전혀 건드리지 않는다. 실제 diff 대상은
`spec/5-system/5-expression-language.md`(§7.1, 1행) 이며 이 파일명은 프롬프트 전체
315KB 안에 단 한 번도 등장하지 않는다 (`grep -n "expression-language"` 0건). 즉
payload 생성 단계에서 target 파일 선정이 실제 diff 와 어긋난 것으로 보인다
(orchestrator 측 버그로 추정, 본 checker 소관 밖).

이에 따라 payload 의 임베디드 텍스트 대신, HEAD 워킹트리(
`/Volumes/project/private/clemvion/.claude/worktrees/trigger-params-autocomplete-30acb1`,
곧 본 checker 의 실제 CWD)에서 `git diff origin/main` 으로 직접 확인한 실 변경분을
대상으로 점검 관점을 적용했다.

### 실제 변경 파일 (origin/main 대비)
- `spec/5-system/5-expression-language.md` (+1)
- `plan/in-progress/trigger-params-autocomplete.md` (신규)
- `plan/in-progress/trigger-param-output-enricher.md` (체크박스 갱신)
- `plan/in-progress/node-output-redesign/manual-trigger.md` (체크박스 갱신)
- `CHANGELOG.md`, 프론트 `expression-constants.ts` / `use-expression-suggestions.ts` /
  `node-output-schema-enrichers.ts` / 관련 테스트 2개

## 점검 결과

### 1. 요구사항 ID 충돌
신규 요구사항 ID 부여 없음. `$params.` 자동완성 트리거 행은 §7.1 표에 항목만
추가됐고 별도 ID 체계(`XX-YY-##` 류)를 쓰지 않는 섹션이다. 해당 없음.

### 2. 엔티티/타입명 충돌
새 인터페이스·DTO·엔티티 없음. `ROOT_VARIABLES` 배열에 원소 1개(`$params`)를
추가했을 뿐 `RootVariable` 타입 자체는 기존 정의 재사용. 해당 없음.

### 3. API endpoint 충돌
없음 (엔드포인트 변경 없음).

### 4. 이벤트/메시지명 충돌
없음 (webhook/queue/SSE 이벤트 변경 없음).

### 5. 환경변수·설정키 충돌
없음.

### 6. 파일 경로 충돌
`plan/in-progress/trigger-params-autocomplete.md` 신규 생성. 동일 디렉터리의
`trigger-param-output-enricher.md`(선행 작업, PR #875)와 이름이 유사하지만 목적이
분명히 구분되고(전자=후속 UX 힌트, 후자=enricher 스키마 투영) 본문 backlink 로
상호 참조돼 혼동 가능성 낮음. 다른 파일과 경로 중복 없음.

## `$params` 자체는 신규 식별자가 아님

가장 중요한 확인: 이번 diff 가 문서화하는 `$params` 토큰은 **이미 spec 전역에
일관되게 정의·사용 중인 기존 식별자**다. 신규 도입이 아니라 프론트 자동완성
구현이 기존 spec 규정을 뒤늦게 따라잡은 것(plan 자체가 "spec 이미 규정, 구현
catch-up" 으로 명시).

`git -C <worktree> grep -n '\$params' spec/` 확인 결과, 동일 의미(`$input.parameters`
단축)로 5개 파일에서 일관되게 쓰이고 있다:

- `spec/4-nodes/7-trigger/1-manual-trigger.md:150`
- `spec/4-nodes/7-trigger/0-common.md:38, 74, 85`
- `spec/5-system/4-execution-engine.md:607, 779`
- `spec/5-system/12-webhook.md:54, 274`
- `spec/5-system/5-expression-language.md:171` (기존), `:401`(이번 diff, §7.1 표 신규 행)

의미 충돌 없음 — 전 파일이 "Trigger 가 만든 구조화 파라미터에 대한 `$input.parameters`
단축 참조"라는 동일 정의를 공유한다. §7.1 신규 행은 이 기존 정의를 자동완성
트리거 조건표에 반영한 것뿐이며 표 안에 중복 행도 없다(§7.1 원본에는 `$params.`
행이 없었고 diff 로 정확히 1행만 추가됨, 확인: `spec/5-system/5-expression-language.md`
§7.1 397~404행).

프론트 코드 측 `ROOT_VARIABLES` 배열에도 `$params` 라벨이 이전에 존재하지 않았음을
`git diff origin/main -- '*expression-constants.ts'` 로 확인 — 배열 추가는 순수
신규지만, 문자열 값 `"$params"` 자체가 배열 밖(런타임 `expression-resolver.service.ts`
의 `paramsFromInput`, spec 5곳)에서 이미 통용되는 값과 정확히 일치해 **의미 충돌이
아니라 의미 일치**다.

## 요약

이번 변경은 `$params.<name>` 프론트 자동완성 구현으로, spec 이 이미 여러 문서에서
일관되게 정의해 온 `$params` 토큰을 프론트 `ROOT_VARIABLES` 자동완성 후보와
`5-expression-language.md` §7.1 트리거 조건표에 뒤늦게 등록하는 catch-up 성격이다.
신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·충돌 가능 파일 경로 중
어느 것도 새로 도입되지 않았고, `$params` 자체도 신규 식별자가 아니라 기존
정의와 완전히 일치하는 재사용이다. naming-collision 관점에서 이슈 없음.

다만 payload 생성 단계에서 실제 diff 대상 파일(`5-expression-language.md`)이 아닌
무관한 두 파일(`1-auth.md`, `10-graph-rag.md`) 전문이 "Target 문서"로 잘못 첨부된
점은 orchestrator 측에서 확인이 필요하다 (본 checker 는 실제 워킹트리 diff 로
우회 확인해 결과 신뢰도는 유지됨).

## 위험도
NONE

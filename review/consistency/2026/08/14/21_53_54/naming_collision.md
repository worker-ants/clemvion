# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

prompt_file 의 번들은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`
본문과 `<git diff origin/main...HEAD -- code_areas>` 자체를 절단했다. 이 절단분이 바로
target PR 의 실제 변경 내용이라, 번들 대신 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`,
CWD 와 동일 — HEAD 커밋 `462455a52`)에서 직접 아래를 재구성해 검토했다:

- `git diff origin/main...HEAD --stat` (전체 변경 파일 목록)
- `git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md`
- `git diff origin/main...HEAD -- spec/5-system/6-websocket-protocol.md`
- `git diff origin/main...HEAD -- codebase/backend/src/shared/utils/strip-external-only-fields.ts`
  (신규 파일 전문) · `websocket.service.ts` · `interaction.service.ts` diff
- `git diff origin/main...HEAD -- CHANGELOG.md`, `spec/1-data-model.md`,
  `plan/in-progress/*` (신규 4개 plan 파일)
- `git show origin/main:...` 대조로 R-ID·wire 필드명이 이번 diff 로 신규 도입된 것인지
  이전부터 origin/main 에 있던 것인지 판별

이번 target 은 "EIA R8 cache scope" 라는 워크트리 이름과 무관하게, 실제로는
`execution.waiting_for_input` 의 `llmCalls` raw payload 가 fanout(depth-1 strip 만 적용)
과 EIA REST `getStatus()`(값 마스킹만 적용) 양쪽에서 중첩 경로로 새고 있던 보안 결함의
수정 + 관련 spec 정합화다 (`plan/in-progress/eia-terminal-payload.md`,
`plan/in-progress/HANDOFF-eia-terminal-payload.md` 참조).

## 발견사항

신규 식별자 충돌(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·
파일 경로) 6개 관점을 diff 범위(`codebase/backend/src/shared/utils/strip-external-only-fields.ts`
신설, `websocket.service.ts`/`interaction.service.ts` 수정, `spec/5-system/14-external-interaction-api.md`·
`6-websocket-protocol.md`·`1-data-model.md` 수정, `plan/in-progress/` 신규 4개 파일)에
전수 적용한 결과 **충돌 없음**.

- **요구사항 ID**: `spec/5-system/14-external-interaction-api.md` 의 `### R1`~`### R19`
  헤딩을 origin/main 과 HEAD 양쪽에서 추출해 대조 — 번호·제목 100% 동일(라인만 앞쪽
  본문 추가로 이동). 이번 diff 는 새 R-ID 를 신설하지 않았다. `§6.4` 의 `error.code`
  nullable 정정도 기존 절 안의 문구 추가일 뿐 새 섹션이 아니다.
- **엔티티/타입명**: 신규 export 는 `EXTERNAL_STRIPPED_FIELDS`(상수) ·
  `stripExternalOnlyFields`(함수) — 둘 다 원래 `websocket.service.ts` 안에 **모듈-private**로
  존재하던 동명 식별자를 `shared/utils/strip-external-only-fields.ts` 로 승격 이동한 것이라
  이름이 같아도 신규 충돌이 아니다(같은 개념의 재배치). `interaction.service.ts` 의 신규
  private 함수 `stripAndRedact` 는 codebase 전체에서 이 파일에만 정의되어 있고
  (`grep -rn "stripAndRedact\b"` 결과: 정의 1곳 + 테스트/문서 참조만) 다른 의미로 쓰이는
  동명 식별자가 없다. `MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH` 는 이번 diff 이전부터 존재하던
  자매 상수이며 이번 diff 는 그 값을 신규 함수 호출부에 전달만 한다.
- **API endpoint**: 이번 diff 는 REST endpoint 를 신설하지 않는다 — `§6.2` 의
  `interaction.{submitUrl,streamUrl,statusUrl,cancelUrl}` 블록은 "미구현(Planned)" 으로
  재확인하는 문서 정정이며 실제 5개 EIA endpoint(§5.1~§5.5)는 미변경.
- **이벤트/메시지명**: `execution.waiting_for_input` 등 wire 이벤트 이름·필드명은 신규가
  아니다. `waitingNodeId`/`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`
  fanout 필드는 `git show origin/main:spec/5-system/6-websocket-protocol.md` 로 대조한 결과
  origin/main 시점에 이미 존재 — 이번 PR 은 그 필드들의 **오너십 문서 귀속**(WS §4.4 vs
  EIA §6.2)만 재조정했다(직전 커밋 `462455a52` "waitingNodeType 철회").
- **환경변수·설정키**: diff 전체에서 `process.env`/신규 ENV 참조 없음(grep 0건). 새 config
  key 도입 없음.
- **파일 경로**: 신규 파일은 `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
  (+`.spec.ts`) 하나뿐 — 같은 디렉터리의 `bcrypt-format.ts`/`retry-after.ts`/
  `sanitize-error-message.ts` 와 동일한 kebab-case + `.spec.ts` 짝 컨벤션을 그대로 따르고,
  기존 파일과 겹치지 않는다. 신규 plan 파일 4개(`plan/in-progress/eia-terminal-payload.md`,
  `HANDOFF-eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`,
  `spec-draft-eia-notification-payload-contract.md` 는 실은 기존 파일에 9줄 추가)도
  `find plan -iname "*eia-terminal-payload*" -o -iname "*eia-62-waiting-payload*"` 로 확인한
  결과 `plan/complete/` 등 다른 곳에 동명 파일이 없다.

## 요약

target diff 의 실제 신규 표면(공유 유틸 `strip-external-only-fields.ts`, `interaction.service.ts`
의 `stripAndRedact`, EIA/WS spec 의 `llmCalls` strip 범위·`error.code`/`nodeId` nullable 정정,
신규 plan 문서 4개)을 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·
파일 경로)으로 전수 대조했으나 기존 사용처와 다른 의미로 충돌하는 식별자는 없었다.
유일하게 이름이 재사용된 `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` 는 기존
module-private 정의를 공유 유틸로 승격 이동한 리팩터이며, 의미·SoT 가 하나로 유지되어
충돌이 아니라 정당한 재배치다. R-ID·wire 필드명·endpoint·이벤트명 모두 origin/main 대비
신규 도입분이 없고, 유일한 신규 파일 경로는 기존 디렉터리 컨벤션을 따른다.

## 위험도
NONE

# 부작용(Side Effect) 리뷰 — HEAD 748d3813d

리뷰 대상: `feat(external-interaction): conversation_thread 공개 표면 secret 마스킹 egress 강제 (EIA §R17)`

## 검증한 항목 (실측)

- `git show HEAD` 전체 diff 정독.
- `cloneThread` / `redactThreadForPublic` / `sanitizeLastErrorMessage` / `redactSecrets` 전 사용처 `grep` 재확인.
- `npx jest thread-renderer.spec.ts sanitize-error-message.spec.ts interaction.service.spec.ts` — 78 tests pass.
- `tsc --noEmit` 로 변경 파일 관련 타입 에러 없음 확인(무관 파일의 기존 pre-existing 에러만 존재).
- `stageDurableResumeSnapshot` (durable park 저장 경로)이 여전히 `cloneThread`(비마스킹)를 쓰는지 확인 — egress-only 설계 실측 일치.
- `interaction.service.ts::getStatus` 전체를 읽고 마스킹된 사본이 `execution` 엔티티에 다시 대입되지 않음(읽기 전용 응답 조립에만 사용) 확인.
- 위젯(`channel-web-chat`) 쪽 `getStatus` 호출부가 재연결 시 1회 seed 용도이지 tight polling 이 아님을 확인 — 성능 우려 낮음.

## 발견사항

### INFO findings 없음 (코드 자체는 side-effect 관점에서 문제 없음)

- **[INFO]** `sanitizeLastErrorMessage` 리팩터는 동작 보존
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:44-63`
  - 상세: `redactSecrets`(마스킹만) → `sanitizeLastErrorMessage`(마스킹 + 200자 truncate)로 위임 재구성. 두 함수 모두 자체 `typeof raw !== 'string' || raw.length === 0` guard 를 갖는 이중 체크가 되어 미세 중복이 있으나, `sanitizeLastErrorMessage` 는 이미 string/non-empty 를 검증한 뒤 `redactSecrets` 를 호출하므로 내부 guard 는 항상 no-op — 동작·리턴값 회귀 없음. 신규 spec(`sanitize-error-message.spec.ts`)이 truncate 길이(`LAST_ERROR_MESSAGE_MAX_LEN+1`, `…` 접미사)와 `redactSecrets` 는 truncate 하지 않음을 명시적으로 교차검증. 기존 호출처(makeshop/cafe24 api client, integration-oauth.service, ai-turn-orchestrator)는 시그니처·리턴 타입 불변이라 영향 없음 — `grep` 로 12개 호출처 전수 확인, 전부 `sanitizeLastErrorMessage(string)` 그대로.
  - 제안: 없음(리팩터 안전).

- **[INFO]** `cloneThread` → `redactThreadForPublic` 교체는 egress 4곳(button/form/ai-turn SSE emit + REST getStatus)에 국한, `cloneThread` 자체는 유지
  - 위치: `codebase/backend/src/modules/execution-engine/{button,form,ai-turn-orchestrator}.service.ts`, `interaction.service.ts`
  - 상세: `cloneThread` export 는 삭제되지 않았고 `execution-engine.service.ts`(durable park 스냅샷 저장, `agent-memory` 관련 background isolation)에서 계속 사용된다 — import 만 4개 파일에서 교체됐을 뿐 다른 소비처는 원본 그대로. `redactThreadForPublic` 은 "clean turn 은 참조 공유 + 변경된 turn 만 신규 할당" 전략이며, 입력 `thread`/`turn`/`toolCalls` 를 절대 mutate 하지 않음을 `thread-renderer.spec.ts` 의 "does not mutate the input thread or its turns" 테스트로 명시적으로 회귀 가드. 하류(프론트/위젯) 코드는 응답을 렌더링만 하고 mutate 하지 않으므로(SSE/REST 는 매번 fresh JSON 직렬화 응답) 참조 공유 가정은 안전. `context.conversationThread`(라이브 in-memory 객체, LLM 재주입에 계속 쓰이는 faithful 버전)는 그대로 유지되고 마스킹된 결과는 emit payload 로만 흘러가 원본 오염 없음 — `stageDurableResumeSnapshot`(DB 저장 경로, execution-engine.service.ts:7574)이 여전히 비마스킹 `cloneThread` 를 쓰는 것으로 실측 확인.
  - 제안: 없음.

- **[INFO]** emit/응답 payload shape 불변
  - 상세: `redactThreadForPublic` 은 `turns[].text`, `turns[].toolCalls[].arguments`, `runningSummary` 의 값만 치환하고 필드 구조(`seq`/`nodeId`/`source`/`timestamp`/`toolCalls[].name` 등)는 그대로 보존 — spec `preserves non-text metadata` 테스트로 검증됨. `ConversationTurnToolCall.arguments` 필드명도 실제 타입 정의(`conversation-thread.types.ts:111`)와 일치. 프론트/위젯 파서(`parseWaitingForInput`/`threadToMessages`) 계약에 영향 없음.
  - 제안: 없음.

- **[INFO]** 성능 — bounded, 우려 낮음
  - 상세: 마스킹 대상은 `STORAGE_MAX_TURNS=500`(execution-engine/conversation-thread/conversation-thread.service.ts:68)으로 이미 상한이 걸려 있고, SSE emit 은 상태 전이(park) 시에만 발생(폴링 아님), REST `getStatus` 는 위젯 재연결/새로고침 시 1회 seed 용도로 확인(`channel-web-chat/src/widget/use-widget.ts`) — tight polling 경로 아님. 4개 정규식 × 최대 500 turn 순회는 이 호출 빈도에서 무시할 수준.
  - 제안: 없음.

## 세션 중 자기유발 side effect (참고용, 리뷰 대상 코드와 무관)

리뷰 중 baseline 비교를 위해 `cd codebase/backend && git stash && npx tsc ...; git stash pop` 을 실행했는데, 이 worktree 는 (검토 대상 커밋 반영 후) 실제로 uncommitted 변경이 없어 `git stash` 자체는 "No local changes to save" 였음에도, `git stash pop` 이 **이 worktree 와 무관한 선재(pre-existing) stash 엔트리**(`stash@{0}: WIP on claude/cafe24-node-ux-frontend-f5a3b8` — 현재 `codebase/frontend/` 구조 이전의 구 레이아웃 `frontend/...` 경로를 참조하는 오래된 스태시)를 이 worktree 인덱스에 적용해 `DU`(deleted-by-us) 머지 충돌을 유발했다. 발견 즉시 `git status` 로 확인 후 `git reset --hard HEAD` 로 이 worktree 를 커밋 `748d3813d`(리뷰 대상 HEAD, 세션 시작 시 clean 상태와 동일)로 완전히 원복했고, 문제의 stash 엔트리는 다른 작업 소유일 수 있어 삭제하지 않고 그대로 보존했다(`git stash list` 로 재확인). 리뷰 대상 코드·커밋 자체에는 어떤 영향도 없었음 — worktree 인덱스는 각 worktree 전용(`$GIT_DIR/worktrees/<name>/index`)이라 다른 worktree 나 main 저장소로 전파되지 않는다.

이 사고는 리뷰 대상 diff 의 결함이 아니라 **리뷰어(나)의 진단 명령 부주의**였음을 명시한다. 참고로 이 프로젝트의 다른 worktree 에도 유사하게 stash 상태가 오염돼 있을 가능성은 낮지만(각 worktree 는 독립 인덱스), `git stash`/`git stash pop` 페어링 시 "No local changes to save" 응답을 받으면 즉시 pop 을 생략해야 함을 재확인.

## 요약

리뷰 대상 커밋(748d3813d) 자체는 부작용 관점에서 문제가 없다. `sanitizeLastErrorMessage` 는 순수 리팩터로 동작·리턴값·호출처 계약이 보존되고(12개 호출처 확인, 신규 spec 이 truncate/mask 분리 회귀를 명시적으로 가드), `cloneThread`→`redactThreadForPublic` 치환은 egress 경계(SSE emit 4곳 + REST getStatus) 로 스코프가 정확히 한정돼 durable 저장 경로(`stageDurableResumeSnapshot`)와 LLM 주입용 라이브 `context.conversationThread` 는 영향받지 않으며, 입력 thread/turn 을 mutate 하지 않는다는 불변식이 전용 테스트로 뒷받침된다. wire payload 필드 구조와 프론트 파서 계약도 값만 치환되고 유지된다. 성능도 STORAGE_MAX_TURNS 상한과 비-폴링 호출 빈도로 볼 때 수용 가능하다. (별도로, 리뷰 세션 중 필자의 진단 명령이 이 worktree 의 git 인덱스에 무관한 stash 를 잘못 적용시켜 일시적 충돌을 유발했으나 즉시 `git reset --hard HEAD` 로 원복했고 리뷰 대상 코드에는 영향이 없었다 — 위 "세션 중 자기유발 side effect" 절 참고.)

## 위험도

NONE

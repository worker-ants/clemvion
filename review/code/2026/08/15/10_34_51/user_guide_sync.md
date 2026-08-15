STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 항목) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (127~197행) 본문을 함께 Read 했다.

## 변경 파일 컨텍스트

`git diff origin/main --stat` 로 전체 변경 파일 집합을 실측 확인했다 (66 files changed). 프롬프트에 포함된 코드 변경은 전부:

- `CHANGELOG.md`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service{,.spec}.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service{,.spec}.ts`
- `codebase/backend/src/shared/utils/terminal-duration.{ts,spec.ts}` (신규)
- `plan/in-progress/*.md` 3건, `review/code/**` 산출물 다수
- (이 리뷰 프롬프트 번들 밖의 별도 커밋으로) `spec/5-system/14-external-interaction-api.md`, `spec/3-workflow-editor/3-execution.md`, `spec/conventions/chat-channel-adapter.md`

**`git diff origin/main --stat -- codebase/frontend/ codebase/channel-web-chat/` 결과는 0줄** — 이번 변경 set 에 frontend `content/docs/**`, `i18n/dict/**`, `backend-labels.ts`, `docs/locale.ts` 파일이 **단 하나도 포함되지 않았다.** 매트릭스의 모든 target 은 이 다섯 표면(`codebase/frontend/src/content/docs/**`, `i18n/dict/**`, `backend-labels.ts`, `docs/locale.ts`, `README.md`) 중 하나를 가리키므로, 이 리뷰의 핵심 질문은 "누락된 갱신이 있는가" 다.

## trigger 매칭 검토

변경의 본질은 backend 실행 엔진의 종결 이벤트(`execution.completed`/`failed`/`cancelled`, webhook/SSE/WS) payload 에 `durationMs` 필드를 신규로 싣는 것이다(16 emit 경로). 아래 후보 trigger 를 순서대로 검토했다.

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일에 `backend/src/nodes/**` 경로가 없다.
- **신규 UI 문자열 (TSX)** / **신규 위젯 chrome 문자열** — 매칭 없음. `.tsx` 파일 변경이 0건이다(frontend/channel-web-chat 모두 diff 없음).
- **유저 가이드 신규 섹션 디렉토리** — 매칭 없음. `content/docs/*/` 신규 디렉토리 없음.
- **인증·권한·세션 흐름 변경** (`backend/src/modules/auth/**`) — 매칭 없음.
- **표현식 언어 변경** (`packages/expression-engine/**`) — 매칭 없음.
- **신규 warningCode/errorCode** — `error-codes.ts`/`warningRules` 변경 없음 (grep 확인, 매치 0건).
- **AuthConfig enum 변경 / cross-cutting enum 값 추가** — 매칭 없음(신규 enum 값 없음, 기존 `ExecutionEventType`/`ExecutionStatus` 값 재사용뿐).
- **실행·디버깅 흐름 변경** (semantic, target `05-run-and-debug/`) — 그레이존으로 판단해 실측했다. `05-run-and-debug/run-results.mdx`·`running-a-workflow.mdx` 는 이미 "실행 시간/소요 시간" 을 문서화하고 있으나, 이는 **에디터 내부 실행 히스토리·노드별 소요시간** UI(기존부터 존재하는 `Execution.durationMs`/`NodeExecution` 필드 노출)에 대한 서술이다. 이번 PR 은 그 내부 UI 경로를 건드리지 않는다 — 변경 대상은 **외부 webhook/SSE/WS 구독자**에게 나가는 EIA 종결 payload 뿐이다(`chat-channel.dispatcher.ts`/`types.ts`/`terminal-duration.ts`). 두 표면이 다르므로 이 trigger 는 매칭되지 않는다고 판단.
- **백엔드 API 추가·변경** (semantic, target: "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지") — 가장 근접한 후보. `chat-channel.dispatcher.ts`/`types.ts` 는 controller/dto 는 아니지만 외부로 나가는 EIA 이벤트 payload 계약을 바꾼다(신규 필드 추가, CHANGELOG 가 "수신자 영향" 을 명시). `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 가 이 webhook/SSE 채널을 사용자에게 안내하는 유일한 user-guide 페이지다.
  - **실측**: `triggers.mdx`/`.en.mdx` 를 전문 grep 한 결과, 이 문서는 애초에 종결 이벤트의 **필드 단위 payload 예시를 문서화한 적이 없다** — `events` 배열은 이벤트 **이름**만 나열하고(`"execution.completed"` 등), `status`/`result`/`error` 등 실제 payload shape 예시는 어디에도 없다.
  - **선례 확인**: 바로 앞선 자매 PR (`e3825cc2c`, "종결 error 를 문자열로 emit하던 4곳" — `error` 필드를 문자열→object 로 바꾼 동일 계열 변경) 도 `git log --follow -- triggers.mdx` 로 확인한 결과 이 문서를 건드리지 않았다. 즉 "종결 이벤트 payload 필드 단위 shape 변경은 `triggers.mdx` 동반 갱신 대상이 아니다" 가 이 저장소의 기존 관례이며, 이번 PR 이 그 관례에서 새로 이탈한 것이 아니다. payload shape 의 SoT 는 `spec/5-system/14-external-interaction-api.md` §6 이고, 그 spec 문서는 (이 리뷰 프롬프트 밖의 별도 커밋으로) 이미 갱신됐다(`git diff origin/main --stat` 로 확인).
  - 따라서 target (b) 는 "회색 지대지만 관례상 트리거되지 않는" 사례로 판단했다 — CRITICAL/WARNING 이 아니라 정보성 관찰로만 기록한다.

## 발견사항

- **[INFO]** 외부 EIA 종결 이벤트 payload 확장이 사용자 가이드(`02-nodes/triggers.mdx`)에는 반영되지 않았으나, 이는 신규 결함이 아니라 기존 관례(payload 필드 단위 shape 는 spec 이 SoT, user-guide 는 채널 설정법만 다룸)의 연장이다
  - 변경 파일: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `codebase/backend/src/modules/chat-channel/types.ts`, `codebase/backend/src/shared/utils/terminal-duration.ts`
  - 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (semantic match)
  - 확인한 부재: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` 어디에도 종결 이벤트의 필드 단위 payload 예시(`status`/`result`/`error`/`durationMs`)가 없음 — 이번 PR 이전부터 없었고, 자매 PR(`e3825cc2c`, `error` 필드 shape 변경)도 이 문서를 갱신하지 않은 선례가 있음
  - 상세: 사용자 영향은 낮다 — 필드가 추가적(additive)이고 하위호환이며(CHANGELOG 명시), 문서가 애초에 payload 필드를 다루지 않으므로 "정확했던 문서가 stale 해진" 상황이 아니다. 다만 매트릭스가 "회색 지대는 보수적으로 갱신 필요로 분류" 를 요구하므로 정보성으로 등재한다.
  - 제안: 조치 불필요(선례상 정상). 다음에 EIA 페이로드 shape 를 통째로 user-guide 화할 계획이 생기면 `durationMs`/`error`/`result` 를 한 번에 반영할 것.

이 외에 노드/i18n/backend-labels/locale.ts/README.md 관련 trigger 는 매칭되는 변경 파일이 전혀 없다(글로브·의미 매칭 모두 0건). `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/**` 산출물은 매트릭스 대상 표면이 아니다.

## 요약

매트릭스 21개 trigger 행 전수를 이번 변경 set(backend `execution-engine`/`chat-channel`/`shared/utils` + plan 3건, frontend 변경 0건)에 대입했다. 글로브 매칭 트리거는 전부 미스매치(노드/TSX/채널위젯/신규섹션 없음), semantic 트리거 중 유일한 근접 후보는 "백엔드 API 추가·변경"(EIA 종결 payload 에 `durationMs` 신규 필드)이었으나, 실측(`triggers.mdx` 전문 grep + 자매 PR `e3825cc2c` 의 미갱신 선례)으로 이 문서가 애초에 payload 필드 단위 shape 를 다루지 않는다는 기존 관례를 확인해 CRITICAL/WARNING 이 아닌 INFO 1건으로 하향했다. 동반 갱신 누락(CRITICAL/WARNING)은 0건이다.

## 위험도

NONE

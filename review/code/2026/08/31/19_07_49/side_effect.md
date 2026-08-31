# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `--impl-done` 프롬프트 본문에 새 census 블록이 항상 삽입되어 checker 가 받는 입력이 늘어난다(의도된 변경).
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:778-784` (`collect_context`) — 신설 함수는 `:485-568` (`_scope_delta_census`).
  - 상세: `collect_context` 의 `--impl-done` 분기가 `target_doc` 조립에 `_scope_delta_census(root, target_path_rel, _rank_changed, diff_text)` 를 새로 끼워 넣는다. 이 함수는 순수 문자열 조합(파일시스템·네트워크·환경변수 접근 없음)이라 그 자체로는 부작용이 없지만, **모든 `--impl-done` 세션의 프롬프트 크기·형태가 이 커밋부터 바뀐다** — HEAD 구역(절단 비대상)에 `### 이 검토가 실제로 다루는 델타` 섹션이 항상 추가되고, `_SCOPE_HITS_DISPLAY_LIMIT`(20) 초과 시 목록이 접힌다. `collect_context` 의 반환 시그니처·다른 모드(`--spec`/`--plan`/`--impl-prep`)는 건드리지 않아 호출자(`run_consistency_check` 등)에 영향이 없다. 함수가 참조하는 `_rank_changed`(`_edited_rels(diff_base, root)`)·`diff_text`(`_collect_code_diff`)는 이미 그 지점 이전에 계산돼 있던 값을 재사용하는 것이라 **추가 `git` 서브프로세스 호출을 유발하지 않는다** — 새 I/O 없음.
  - 제안: 없음 — 의도된 harness 동작 변경이며 부작용 관점에서 위험 없음. 회귀 테스트(`test_consistency_scope_census.py`)가 `collect_context` 호출부 배선까지 소스 검사로 고정하고 있어 조용한 제거도 잡힌다.

- **[INFO]** `WorkflowAssistantController` 에 `@ApiUnauthorizedResponse` 데코레이터 7건 추가 — 공개 OpenAPI 문서(swagger) 산출물이 바뀐다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` (`list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 각 메서드 데코레이터 블록).
  - 상세: 순수 문서 데코레이터 추가로 런타임 가드·응답 바디·상태 코드 로직 변경은 없다(추가 검증: guard 체인·핸들러 본문 diff 없음). 다만 이 컨트롤러의 **생성된 OpenAPI 문서 shape 이 바뀐다** — 이 문서를 파싱해 SDK 를 생성하거나 계약 diff 를 만드는 외부 파이프라인이 있다면 그 산출물도 영향받는다(additive 라 breaking 은 아님). 신규 스펙(`workflow-assistant.controller.swagger.spec.ts`)이 라우트 수·401 description 문구를 캐너리로 고정해 회귀는 잡힌다.
  - 제안: 없음.

- **[INFO]** `notifications-channel-authorizer.ts` 의 JSDoc 만 변경 — 코드 로직·시그니처·이벤트 배선 변경 없음.
  - 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts:9-15` (클래스 상단 주석).
  - 상세: "emit 은 미구현이라 실피해 0" → "emit 은 구현·배선 완료라 실제 트래픽을 막고 있다" 로 주석 문구만 정정. `git log`/plan(`spec-sync-external-interaction-api-gaps.md`)로 대조 시 실측 근거(`websocket.service.ts` ← `notifications.service.ts` 배선)가 있어 문구 자체는 정확하다. 인가 로직(`canSubscribe` 등)에는 diff 가 없다.
  - 제안: 없음.

- **[INFO]** `chat-channel.dispatcher.ts`/`chat-channel.dispatcher.spec.ts`/`types.ts`/`websocket-events.types.ts`/`websocket.service.ts`/`websocket.service.spec.ts` 의 나머지 변경은 전부 주석·JSDoc·테스트 설명 문자열 안의 "줄 번호 인용"(`line 536`, `line 89`) 삭제 또는 spec 절 번호(`§4.4`→`§4.5`) 갱신뿐이다. 함수 본문·타입 정의·assertion 로직에는 문자 하나도 바뀌지 않았다(각 hunk 를 개별 확인: 코드 라인은 모두 컨텍스트, 변경 라인은 전부 `//` 주석 또는 `it(...)` 설명 문자열).
  - 위치: 없음(해당 없음 — 순수 주석/문자열 리터럴 변경).
  - 상세: 부작용 관점에서 무해.
  - 제안: 없음.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 에서 §4.3(KB 문서 이벤트) 절을 §4.4(알림) 앞으로 이동하고 뒤따르는 3개 절 번호를 순연(§4.4→§4.5, §4.5→§4.6, §4.6→§4.7)했다 — 문서 내 앵커 재배치.
  - 위치: 해당 없음(md 재구조화, 코드 아님).
  - 상세: 이벤트 이름·채널 키·payload 필드는 이동 전후 동일 — 실제 프로토콜 계약(부작용 관점의 "인터페이스")은 변하지 않는다. plan 기록(`spec-sync-external-interaction-api-gaps.md`)에 96건 앵커 링크 + bare `§4.x` 프로즈 인용 재검증 이력이 남아 있고, 이번 diff 세트 안의 코드 주석 4곳(`websocket-events.types.ts`, `websocket.service.ts`, `websocket.service.spec.ts`)도 함께 갱신되어 코드-스펙 절 번호 drift 는 없다. 코드 실행에 영향 없음.
  - 제안: 없음.

- **뮤테이션 검증**: `_scope_delta_census`/`_count_diff_files` 는 순수 함수(파일시스템·네트워크·환경변수·전역 변수 접근 없음)임을 소스 검사로 직접 확인했다(저장소 파일은 건드리지 않았고, `git status --short` 로 트리 무결성 재확인 — 이번 세션 산출물 디렉터리 `review/code/2026/08/31/19_07_49/` 외 변경 없음).

## 요약

이번 diff 는 실질 프로덕션 로직 변경이 거의 없다 — codebase 쪽은 (1) `WorkflowAssistantController` 에 순수 additive `@ApiUnauthorizedResponse` 데코레이터 7건, (2) `chat-channel`/`websocket` 모듈 6개 파일의 주석·JSDoc·테스트 설명문 안 줄 번호→절 번호 정정뿐이며 함수 시그니처·가드 로직·이벤트 emit 경로는 하나도 바뀌지 않았다. 유일한 "동작이 바뀌는" 코드는 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `--impl-done` harness 인데, 신설 `_scope_delta_census`/`_count_diff_files` 는 이미 계산된 값을 문자열로만 조합하는 순수 함수라 파일시스템·네트워크·환경변수·전역 상태에 손대지 않으며, `collect_context` 의 다른 모드나 반환 시그니처에도 영향이 없다. 나머지 대다수 변경분(plan/*.md, spec 문서 절번호 재배치, 이전 리뷰 라운드 산출물)은 문서/추적 파일이라 부작용 표면 밖이다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE

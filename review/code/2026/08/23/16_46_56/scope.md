# 변경 범위(Scope) 리뷰 — assistant-mask-leak

## 컨텍스트

`plan/in-progress/assistant-mask-leak.md` 가 서술하는 작업(workflow-assistant LLM 도구의
`inputData`/`outputData`/`error` 마스킹을 값-패턴(`deepRedactSecrets`)까지 겹쳐 유출을 막는
것)과, 그 결과 `--impl-prep` 이 BLOCK:YES 를 낸 것을 원인으로 같은 PR 안에 병합된 planner 턴
(spec 4곳 동기화)까지 총 27개 파일 diff 를 전수 확인했다(`git diff origin/main... --stat` 로
프롬프트에 열거된 27건과 실제 diff 파일 목록이 정확히 일치함을 재확인). CLAUDE.md 가 "구현 중
spec 변경 필요 시 developer 는 멈추고 planner 위임" + "같은 PR 안에서 원자적으로 갈 수 있다"는
절차를 명문화하고 있고, plan 문서 자체가 이 확장의 근거(`--impl-prep` BLOCK:YES → planner 턴
→ `--spec` BLOCK:NO)를 투명하게 기록하고 있어, spec 4개 파일·review/consistency 산출물
16개·plan 문서 2개(신규)를 포함한 전체 변경은 **절차적으로 정당화된 확장**으로 판단했다.

## 발견사항

- **[INFO]** `DEFAULT_SENSITIVE_KEYS` 확장의 실질 수혜자는 이 diff 에 없는 파일(`handler-output.adapter.ts`)이다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:13-27` (`csrfToken`·`csrf_token`·`authToken`·`auth_token`·`sessionToken`·`session_token`·`idToken`·`id_token` 추가)
  - 상세: 이 리스트는 `maskSensitiveFields` 의 기본 인자로 3곳이 공유한다(`grep` 로 확인: `explore-tools.service.ts`, `handler-output.adapter.ts`, 주석-only 참조 `ai-turn-executor.ts`). 그런데 plan 본문(`assistant-mask-leak.md` "실측이 트래커의 예상을 바꿨다" 절)이 스스로 밝히듯, **정작 이번 티켓의 표적인 `explore-tools.service.ts` 표면은 이 리스트 확장이 불필요**하다 — `deepRedactSecrets` 의 `CREDENTIAL_KEY_PATTERN`(`/i` 플래그의 `[a-z0-9_-]*token`)이 이미 `token` 접두 계열을 덮기 때문이다(뮤테이션 M2: 리스트에서 8개를 빼도 explore-tools 스위트는 27/27 GREEN). 즉 이 유틸 변경이 실제로 동작을 바꾸는 지점은 이번 diff 에 **포함되지 않은** `handler-output.adapter.ts`(노드 `config` echo → DB 저장·WS emit·표현식) 다. 티켓 제목("workflow-assistant LLM 도구") 기준으로는 범위 밖 파일의 동작을 바꾸는 변경이 섞여 있는 셈이다.
  - 다만 이 확장은 우발적이지 않다 — plan 이 "자매를 그냥 두면 이 저장소에서 반복한 '방어를 한 칸 좁게 잡는다' 가 된다"는 근거로 의도적으로 포함시켰고, `mask-sensitive-fields.util.spec.ts` 에 전용 캐너리 9건을 신설해 고정했으며, 자매 표면의 **값 축** 잔여는 별도로 `spec-sync-external-interaction-api-gaps.md` 새 체크박스에 등재해 범위를 명시적으로 그었다. 사용자가 발견사항을 판단할 때 "의도 이상의 변경"으로 오판하지 않도록, 이 비대칭(코드는 이번 diff, 수혜는 다른 파일)을 기록해 둔다.
  - 제안: 조치 불요. PR 설명·plan 이 이미 근거를 갖추고 있으므로 그대로 승인 가능. 다만 커밋 메시지/PR 제목이 "workflow-assistant" 로만 한정되어 있다면, 리뷰어가 diff 만 보고 "이 유틸 변경이 왜 필요한가"를 바로 알 수 있도록 PR 설명에 이 비대칭을 한 줄 언급하면 좋다.

- **[INFO]** `explore-tools.service.ts` 의 3중복 마스킹 호출을 헬퍼로 리팩터링
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:67-112` (`redactAssistantFields` 신설), 호출부 `:507`·`:525` 근방(`...redactAssistantFields(ne)` / `...redactAssistantFields(e)`)
  - 상세: 기존에 각 3줄씩 반복되던 `maskSensitiveFields(...)` 호출 6줄을 헬퍼 함수로 묶었다. 이 리팩터링은 정확히 이번 변경이 손대는 두 지점(`toNodeExecutionRow`·`toExecutionRow` 유사 매퍼)에 국한되어 있고, 두 겹 마스킹을 6번 반복 작성하는 것보다 명백히 안전하다(순서 실수 방지). "관련 없는 리팩터링"이 아니라 이번 변경이 요구하는 최소 리팩터링으로 판단, 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** spec 4개 파일 동기화 + review/consistency 산출물 16개 동봉은 절차 준수이며 무관한 변경이 아니다
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md:259-266,1435` · `spec/5-system/14-external-interaction-api.md:1648-1668` · `spec/2-navigation/_product-overview.md:265` · `spec/conventions/egress-masking.md:10-11,47,87-91` · `review/consistency/2026/08/23/{16_09_25,16_21_45}/**` · `plan/in-progress/spec-update-assistant-masking.md`(신규)
  - 상세: `--impl-prep`(`16_09_25`) 이 CRITICAL 1(spec drift, `spec_impact: none` 오선언)으로 BLOCK:YES 를 냈고, CLAUDE.md 규약대로 developer 가 멈추고 project-planner 턴을 같은 PR 안에 앞세워 `--spec`(`16_21_45`, BLOCK:NO·WARNING 5)까지 거쳤다. WARNING 5건이 스스로 "고칠 두 곳"이 실제 파급(같은 문서 내 결정 메모 표·EIA 캐비엇·`_product-overview.md`·`egress-masking.md` 좌표계 표)을 못 덮는다고 지적해 4개 파일로 확장된 것도 게이트를 통과한 근거가 있다. review/consistency 산출물은 이 게이트 실행의 증거이며 프로젝트 컨벤션상 `review/` 는 gitignore 대상이 아니라 커밋에 포함되는 것이 정상이다.
  - 제안: 조치 불요.

## 요약

이번 diff(27파일)는 표면적으로는 방대하지만, 전부 하나의 인과 사슬로 추적된다 — workflow-assistant 마스킹 갭 수정 → 그 갭 수정이 spec SoT 와 충돌해 `--impl-prep` BLOCK:YES → CLAUDE.md 규약에 따른 같은-PR 내 planner 턴 → `--spec` 통과 후 재개. 포맷팅-only 변경, 무관한 파일 건드림, 승인되지 않은 기능 확장, 정리성 리팩터링은 발견되지 않았다. 유일하게 짚을 점은 `mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS` 확장이 실질적으로는 이번 diff 에 포함되지 않은 자매 파일(`handler-output.adapter.ts`)의 동작을 바꾼다는 비대칭인데, 이는 plan 문서가 명시적으로 인지·정당화하고 전용 캐너리로 고정했으며 자매의 잔여 갭(값 축)은 별도 트래커 항목으로 명확히 분리해 뒀으므로 우발적 스코프 확장이 아니라 의도된 방어 확장으로 판단한다.

## 위험도
NONE

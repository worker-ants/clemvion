## 검토 대상

`plan/in-progress/spec-draft-pr874-deferred-docs.md` 가 제안하는 3건:

1. `spec/7-channel-web-chat/1-widget-app.md` — Rationale `### R7` 신설
2. `spec/conventions/conversation-thread.md` §9 서두 — 스코프 예외 1줄
3. `spec/conventions/conversation-thread.md` — frontmatter `code:` 항목 추가 + §4 표 비고 1문장 추가

## 발견사항

- **[INFO]** `1-widget-app.md` R7 은 같은 문서 안에서 미사용 — 안전한 다음 번호
  - target 신규 식별자: `### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기` (`spec/7-channel-web-chat/1-widget-app.md`)
  - 기존 사용처: 같은 문서 내 `### R4`(L123)·`### R5`(L128)·`### R6`(L135) — R7 은 미존재 확인(`grep "^### R" 1-widget-app.md` → R4/R5/R6 만).
  - 상세: `7-channel-web-chat` 영역의 R 번호는 **문서-로컬**이 실측 결과다 — `0-architecture.md`(R1~R5), `2-sdk.md`(R2~R5), `3-auth-session.md`(R3~R6), `4-security.md`(R1~R6), `5-admin-console.md`(R1~R7) 모두 자기 문서 안에서만 유일. `1-widget-app.md`(R4~R6)도 이 패턴을 따르며, 다음 로컬 번호는 R7 이 맞다. 다만 이력을 보면 애초부터 "문서-로컬 설계" 였던 건 아니다 — 이 영역을 신설한 최초 커밋(`a652f8733`)에서는 R 번호가 **영역 전체에 걸친 단일 연속 시퀀스**로 부여됐다(architecture=R1, sdk=R2, auth-session=R3, widget-app=R4, architecture 추가분=R5~R8). 이후 `#761`(`aba46cc90`) 에서 `0-architecture.md` 만 자기 문서 내 R5~R8 을 R1~R5 로 재넘버링했고, 형제 문서(`1-widget-app`/`2-sdk`/`3-auth-session`)는 당시 부여된 "영역-전역" 잔재 번호(R4/R2/R3 시작)를 재넘버링 없이 그대로 이어받아 지금의 문서-로컬 시퀀스를 계속하고 있다. 즉 R1~R3 이 `1-widget-app.md` 안에서 "삭제·이관"된 적은 없다 — 애초에 이 문서엔 할당된 적이 없다(그 번호들은 architecture/sdk/auth-session 문서가 가져갔다). 이 히스토리는 target 의 R7 추가 자체를 막지 않지만, draft Rationale 의 "문서-로컬 연속" 서술은 "항상 그래왔다"는 인상을 줄 수 있어 미묘하게 불완전하다(실제로는 레거시 전역 잔재의 연속).
  - 제안: 변경 불필요(R7 추가는 안전). 원하면 draft 각주에 "R4 시작은 영역 신설 당시 전역 순번 잔재(§git history), 이후 문서-로컬로 굳어짐" 한 줄만 덧붙이면 향후 독자 혼동을 예방할 수 있음 — 선택사항.

- **[INFO]** cross-doc 참조 표기 관례 — bare `§R7` 은 동일 문서 self-reference 전용, 신규 R7 도 이를 따라야 모호성 없음
  - target 신규 식별자: `1-widget-app.md §R7`
  - 기존 사용처: 저장소에 이미 "R7" 이 두 곳 더 있음 — `spec/5-system/14-external-interaction-api.md` `### R7. seq 동일 공유 — SSE 와 Notification`(EIA 영역), `spec/7-channel-web-chat/5-admin-console.md` `### R7. 미리보기 2-column 배치`. 세 문서 모두에서 "R7" 이 공존하지만, 실측 결과 저장소 전체가 예외 없이 **cross-doc 참조는 항상 문서명으로 한정**한다 — `[EIA §R7]`(6-websocket-protocol.md:106, 4-execution-engine.md:1130), `[2-sdk §R4]`(1-widget-app.md:129), `[3-auth-session §R6]`(1-widget-app.md:87/89) 등. bare `§R7`(문서명 없이)은 오직 그 라벨을 정의한 문서 자신의 본문에서만 나타난다(예: `14-external-interaction-api.md:155` 자기참조). target 이 신설하는 R7 도 이 관례를 따르는 한(향후 다른 문서에서 인용 시 반드시 `[1-widget-app §R7]` 로 한정) 3개의 "R7" 이 공존해도 충돌이 생기지 않는다.
  - 상세: draft 자체는 R7 본문 안에서 cross-doc 참조를 하지 않으므로(§2/§3/§3.1 자기 섹션 참조 + `4-execution-engine §7.4·§7.5` 링크는 R-라벨이 아닌 절 번호) 이 항목은 현재 변경안엔 즉시 리스크가 없음.
  - 제안: 이후 다른 spec 문서가 이 신규 R7 을 인용할 일이 생기면 반드시 `[1-widget-app §R7]` 형태로 문서명을 한정할 것(기존 관례와 동일). 별도 조치 불필요.

- **[NONE/INFO]** `interaction.service.ts` 실재 확인 — conversation-thread.md 자체 `code:` 리스트 내 중복 없음, 타 spec 과의 overlap 은 기존 관례
  - target 신규 식별자: `code:` 항목 추가 `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`spec/conventions/conversation-thread.md`)
  - 기존 사용처: 파일 실재 확인 — `codebase/backend/src/modules/external-interaction/interaction.service.ts` (18492 bytes, 존재). `conversation-thread.md` 현재 `code:` 리스트(15개 항목, L4~L19)에는 이 경로를 포괄하는 glob 이 없음(`shared/conversation-thread/**`·`execution-engine/conversation-thread/**`·개별 AI 노드 파일·프런트 파일뿐) — **문서 자체 리스트 안에서는 중복 아님**.
  - 상세: 단, 이 정확한 파일은 이미 **다른 spec 문서** `spec/5-system/14-external-interaction-api.md`(`id: external-interaction-api`) 의 `code:` 에 `codebase/backend/src/modules/external-interaction/**` glob 으로 포괄되어 있다 — 즉 같은 코드 파일이 두 spec 문서의 `code:` 에 동시에 등재된다. 이것이 규약 위반인지 확인한 결과, 이는 **기존에 이미 널리 쓰이는 정상 패턴**이다 — 예: `ai-agent.handler.ts`/`ai-agent.schema.ts` 는 `1-ai-agent.md` 와 `conversation-thread.md` 양쪽 `code:` 에 이미 동시 등재돼 있다(하나의 구현 파일이 여러 spec 관심사를 구현하는 경우 각 spec 이 자기 관심사 범위에서 등재). `spec/conventions/spec-impl-evidence.md` 의 가드(`spec-code-paths.test.ts`)도 "glob 이 ≥1 파일에 매치"만 검증하며 배타적 소유를 강제하지 않는다.
  - 제안: 변경 불필요 — 실재+비중복(자기 문서 기준)+cross-spec overlap 은 기존 관례와 정합.

- **[INFO]** `redactThreadForPublic` 심볼 실재·서술 일치, 단일 정의
  - target 신규 식별자: 없음(이미 §8.4 에 존재하는 기존 서술을 §4 표 비고에 요약 인용하는 것 — draft 자체는 이 심볼을 "신규 도입"하지 않음)
  - 기존 사용처: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:60` `export function redactThreadForPublic(...)` 단일 정의. 소비처: `form-interaction.service.ts`(SSE waiting emit, form 경로)·`button-interaction.service.ts`(SSE waiting emit, button 경로)·`ai-turn-orchestrator.service.ts`(SSE waiting emit, AI 경로)·`interaction.service.ts`(REST `getStatus`). draft 가 서술하는 "(b) SSE waiting emit / (c) getStatus REST 두 표면이 `redactThreadForPublic` 로 egress 마스킹" 은 코드와 정확히 일치.
  - 상세: 충돌 없음. 심볼명 중복 정의도 없음(단일 export). 다만 §4 표에 추가되는 문장은 §8.4 에 이미 있는 3-소비처 서술("소비처는 (a) rehydration (b) SSE waiting_for_input emit (c) getStatus REST")을 요약해 반복하는 것이라, 향후 §8.4 가 갱신될 때 §4 요약문도 함께 갱신하지 않으면 두 서술이 drift 할 잠재 리스크가 있음(draft 자체가 "§8.4 로 위임" 이라고 명시했으므로 의도된 요약이며 즉각 조치 불필요).
  - 제안: 변경 불필요. 향후 §8.4 소비처 목록이 바뀌면 §4 표 비고의 요약문도 동반 갱신 필요하다는 점만 인지.

## 요약

3건 모두 **신규 식별자 충돌은 발견되지 않았다**. (1) `1-widget-app.md` 의 `### R7` 은 같은 문서 안에서 미사용이며, 영역 내 R 번호는 문서-로컬(각 문서 자기 시퀀스)이라는 실측이 확인됐다 — `0-architecture.md`/`2-sdk.md`/`3-auth-session.md`/`4-security.md`/`5-admin-console.md` 전부 자기 문서 안에서만 유일하고, cross-doc 참조는 예외 없이 문서명으로 한정하는 관례가 이미 확립돼 있어 저장소에 "R7" 이 3곳(EIA·admin-console·본 target) 병존해도 모호성이 생기지 않는다. git log 추적 결과 `1-widget-app.md` 가 R4 부터 시작하는 이유는 문서 자체의 삭제·이관이 아니라, 영역 신설 최초 커밋에서 R 번호가 영역-전역 단일 시퀀스로 배분됐던 잔재이며(architecture=R1, sdk=R2, auth-session=R3, widget-app=R4…), 이후 architecture 문서만 자기 로컬로 재넘버링되고 형제 문서는 그대로 남았다 — 이는 draft 를 막을 사유가 아니라 배경 설명일 뿐이다. (2) `interaction.service.ts` 는 실재하며 `conversation-thread.md` 자체 `code:` 리스트에는 중복 glob 이 없다. 다른 spec(`14-external-interaction-api.md`) 의 broader glob 과 파일이 겹치지만, 이는 `ai-agent.handler.ts` 사례처럼 이 저장소에서 이미 정상적으로 용인되는 다중-spec 소유 패턴이다. (3) `redactThreadForPublic` 은 실재하는 단일 심볼이며 draft 서술과 정확히 일치한다. 전반적으로 이번 변경안은 문서 서술 보강·frontmatter 미러링일 뿐 신규 결정·신규 코드가 없어 식별자 충돌 표면 자체가 작다.

## 위험도

LOW
STATUS: DONE

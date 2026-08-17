# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

## 검토 범위·방법

`spec/5-system/` 전체 번들(prompt 7002줄)은 컨텍스트 예산 초과로 14개 파일 본문이 절단되어 있어,
번들에 실제로 실린 파일(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`)과
+ 이번 라운드(commit `107c8038f`~`89c3f3c53`, PR #1177~#1180 "EIA 마스킹")에서 실제로 바뀐 파일을
`git diff`로 특정해 `Read`로 직접 열어 검토했다: `spec/1-data-model.md`, `spec/5-system/{3-error-handling,
6-websocket-protocol,12-webhook,13-replay-rerun,15-chat-channel,14-external-interaction-api}.md`,
`spec/conventions/{node-output,swagger}.md`. 대조군으로 `spec/conventions/error-codes.md`·
`data-hydration-surfaces.md`·`secret-store.md`를 함께 열었다.

---

## 발견사항

### [WARNING] `nodeName` 잔존 — 전사 정정에서 누락된 한 곳
- target 위치: `spec/5-system/15-chat-channel.md` §R-CC-15 (line 659), `` `nodeId` / `nodeName` placeholder 는 워크플로우 작성자가 임의로 정의한 internal label`` 구절
- 위반 규약: 본 라운드 자체가 세운 명명 정정 — `spec/5-system/6-websocket-protocol.md` line 191 "Note (2026-08-16 정정 완료)"와 `spec/5-system/3-error-handling.md` line 258 "`nodeLabel` 로 정정 (2026-08-17)"가 "엔진 emit 은 전수가 `nodeLabel`, `nodeName` emit 은 코드베이스에 **0건**"이라고 실측·확정했다.
- 상세: 이 두 커밋(#1176, #1180)이 `nodeName`→`nodeLabel` 전사 정정을 했다고 선언했지만, `grep -rn nodeName spec/`으로 재확인하면 `15-chat-channel.md`의 이 줄이 남아 있다(`git blame` 확인 결과 2026-05-29 작성, 이번 라운드가 손대지 않은 파일). 다른 후보(`executionId`/`traceCode`)와 나란히 "왜 placeholder로 채택하지 않았는가"를 설명하는 문장이라, 필드명이 아니라 개념적 예시로 쓰인 것이긴 하나, 정확히 이번 라운드가 근절하려던 바로 그 어휘라 재도입 위험이 있다(다음 사람이 이 문장을 근거로 `nodeName` 필드가 실존한다고 오인할 수 있음).
- 제안: `nodeId` / `nodeLabel` placeholder 로 정정. "전수 정정"을 주장하는 커밋 메시지가 있는 경우 `grep -rn "nodeName" spec/`을 정정 checklist에 넣을 것을 권고(스코프가 `6-websocket-protocol.md`+`3-error-handling.md`에 한정돼 있었다고 명시했다면 이 발견은 그 한정을 벗어난 파일이라 별건으로 처리 가능).

### [WARNING] 이번 라운드 핵심 계약("내부 읽기 경로 + WS emit 값-패턴 마스킹")이 EIA 본문 어디에도 요약되지 않고 Rationale(R17)에만 존재
- target 위치: `spec/5-system/14-external-interaction-api.md` — 본문 §5(API 명세 Inbound)·§6(Outbound Notification)·§8(보안)에는 이번 라운드가 새로 넣은 "`Execution.error`/`NodeExecution.error`/`outputData` 내부 읽기 경로 마스킹"과 "WS `execution.node.*`/비종결 `execution.*` emit 값-패턴 마스킹"에 대한 언급이 **전혀 없음**(§8.1~§8.5 확인, `마스킹`/`R17`/`redact` grep 결과 0건). 두 항목 모두 `## Rationale`(line 1158~) 안의 R17(line 1380~1650)에만 서술.
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `기술 명세 | spec/<영역>/*.md 본문`, `결정의 배경·근거 | 해당 spec 문서 끝의 ## Rationale`. R17 안의 서술은 "왜 이렇게 결정했는가"를 넘어 "표면 여섯 곳·컬럼 둘, `Execution.inputData`만 카브아웃" 같은 **지금 유효한 계약 자체**(normative content)를 담고 있는데, 이게 본문에 대응 항목 없이 Rationale에만 있다.
- 상세: 같은 EIA 문서 §6 안(line 788)에는 종결 payload의 `message`/`details` 마스킹에 대해 "**요약 1~2문장 + §R17 링크**" 형태의 본문 pointer가 이미 있다(이 라운드 이전에 세워진 패턴). 반면 이번 라운드가 새로 추가한 (a) 내부 읽기 경로(`findById`/`getChain`/`stop`/`toExecutionDto`/`nodeExecutions[]`/`BackgroundRunsService`) 마스킹과 (b) WS `execution.node.*` emit 마스킹은 그 "본문 pointer" 패턴이 §5/§6/§8 어디에도 새로 추가되지 않았다. `spec/5-system/6-websocket-protocol.md`는 §4.1 자체가 이벤트 목록 본문이라 이 규칙이 잘 반영돼 있지만, EIA 문서 쪽에서 보면 "이 시스템이 응답 값을 DB 원문과 다르게 되돌려줄 수 있다"는, API 계약을 소비하는 개발자가 가장 먼저 찾아볼 §5/§8에 아무 흔적이 없다.
- 제안: §8 보안에 "8.6 응답/이벤트 값-패턴 마스킹 (egress)" 같은 짧은 서브섹션을 신설해 (1) 대상 표면 6곳+2컬럼, (2) `Execution.inputData` 카브아웃, (3) 상세는 R17 참조, 를 3~5줄로 요약. 또는 §5/§6 각 엔드포인트 설명에 §6 line 788과 동일한 형식의 인라인 pointer를 추가.

### [WARNING] cross-cutting 마스킹 정책의 SoT가 `spec/conventions/`가 아니라 feature spec의 Rationale 항목(EIA §R17)
- target 위치: `spec/conventions/node-output.md` Principle 7 신규 문단(line 314-323), `spec/conventions/swagger.md` §3 신규 예외(line 260-267) — 둘 다 "SoT: EIA §R17"(`spec/5-system/14-external-interaction-api.md`)를 가리킴. `spec/1-data-model.md`(Execution/NodeExecution 컬럼), `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/6-websocket-protocol.md`도 전부 동일하게 EIA §R17을 SoT로 인용.
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `정식 규약 | spec/conventions/<name>.md`. §R17이 실질적으로 "이 시스템 전역에서 자격증명 값-패턴을 언제·어디서 가리는가"를 규정하는 **정식 규약**(node-output.md·swagger.md라는 두 개의 진짜 conventions 파일이 이걸 인용해 자신의 규칙을 정의)인데, 정작 그 정본은 conventions 폴더가 아니라 EIA라는 단일 기능 spec의 결정 로그 섹션 안에 있다.
- 상세: 이 저장소에는 이미 정확히 이 형태(필드 하나가 여러 surface에서 일관되게 처리돼야 한다는 매트릭스)를 다루는 전용 convention이 있다 — `spec/conventions/data-hydration-surfaces.md`("handler output field가 여러 surface에서 어떻게 hydration되는지"). 마스킹도 동형 문제("필드 하나가 REST/WS/SSE/webhook 몇 곳에서 마스킹되는가")인데 그 패턴을 재사용하지 않고 EIA 문서 안에 self-contained 결정 로그로만 남아 있다. 결과적으로 node-output.md/swagger.md라는 "규약 문서"가 "기술 명세 문서"를 SoT로 참조하는 역방향 의존이 생겼다.
- 제안: 시급하지 않으면 현행 유지(문서 상호링크는 정확하고 일관되며 실제로 동작한다). 다만 다음 EIA 마스킹 변경(예: 이번 round2) 시점에 `spec/conventions/egress-masking.md`(가칭) 신설을 고려 — R17 서술을 옮기고 EIA/node-output/swagger/websocket-protocol/webhook/replay-rerun/chat-channel/data-model 8개 문서가 전부 그 한 곳을 가리키도록 정리하면 "SoT가 기능 spec의 Rationale"이라는 구조적 이상 신호가 해소된다.

### [INFO] swagger.md 신설 예외 — "9곳 이상" 수치·"1~2문장" 권고가 실제 DTO와 정확히 맞지 않음
- target 위치: `spec/conventions/swagger.md` §3 (line 265-267)
- 위반 규약: 같은 절 자신이 규정한 "다만 상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크로 적는다"(line 262-263)
- 상세: 실측(`grep -rn "마스킹되어 반환된다\|자격증명으로 판별된 값" codebase/backend/src --include="*.dto.ts"`)하면 이 형태의 description은 `execution-response.dto.ts` 5곳 + `background-run-response.dto.ts` 3곳 = **8곳**이다("9곳 이상"과 근사하지만 정확한 재현이 안 됨 — 근거 카운트가 어떤 기준이었는지 불명). 또한 실제 description 예시(`background-run-response.dto.ts` line 50-51/58-59/66-67)는 문장 수로 보면 3~4개 절이 `—`로 이어진 하나의 긴 문단이라, 방금 자신이 정한 "1~2문장" 권고보다 김.
- 제안: "9곳 이상"을 "8곳"으로 정정하거나 카운트 기준(파일 단위/필드 단위/패턴 문자열 단위)을 명시. "1~2문장" 권고를 실제 관행("근거 사슬을 `—`로 잇는 1문단, 문장 수 무관")에 맞게 완화하거나, 반대로 DTO 쪽 description을 절 단위로 쪼개 권고에 맞출 것. (참고: 이 프로젝트 메모리에 "실측했다"류 수치 주장이 반복적으로 어긋난 이력이 있어 정확한 재현 가능한 수치를 권장.)

### [INFO] `spec/5-system/6-websocket-protocol.md`에 `## Overview` 섹션 부재
- target 위치: `spec/5-system/6-websocket-protocol.md` line 20-26 — frontmatter 직후 바로 `# Spec: WebSocket 프로토콜` → 관련 문서 링크 → `## 1. 연결`로 진입, `## Overview` 헤딩이 없음(`## Rationale`은 line 989에 존재).
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
- 상세: 같은 라운드에서 §4.1을 대폭 확장하며 이 파일을 크게 편집했음에도 기존의 구조적 결함(Overview 부재)은 다루지 않았다. `1-auth.md`·`13-replay-rerun.md`·`12-webhook.md`·`15-chat-channel.md`는 모두 `## Overview` 헤딩(일부는 `## Overview (제품 정의)`)을 갖고 있어 이 파일만 예외.
- 제안: 이번 라운드가 만든 결함은 아니라 이번에 반드시 고칠 필요는 없음. 다음에 이 파일을 손댈 때 `## Overview` 섹션을 추가해 3-섹션 컨벤션에 맞출 것을 권고.

---

## 요약

이번 라운드(EIA 마스킹, PR #1177~#1180)의 spec 변경은 상호 링크가 촘촘하고 각 결정에 근거·기각 대안·잔여 갭을 빠짐없이 남기는 등 내용 정합성은 매우 높다. `nodeLabel` 통일처럼 스스로 발견한 drift를 실측 후 정정하는 규율도 있었다. 다만 정식 규약 관점에서는 두 축의 구조적 이상이 보인다: (1) 이번 라운드의 핵심 계약(내부 읽기 경로·WS emit 값-패턴 마스킹)이 EIA 문서의 본문(§5/§6/§8)에는 요약조차 없이 Rationale(R17)에만 있어 CLAUDE.md의 "본문=기술명세, Rationale=배경" 역할 분리와 어긋나고, (2) 그 결과 두 개의 정식 conventions 파일(node-output.md, swagger.md)이 규약을 정의하며 SoT로 feature spec을 역참조하는 모양이 됐다 — data-hydration-surfaces.md 같은 이미 있는 "surface 매트릭스" 패턴을 재사용하지 않은 채. 이 둘은 CRITICAL은 아니며(상호링크가 정확해 정보 접근 자체는 가능하다) 규약 위치·구조 개선을 권고하는 WARNING 수준이다. 그 외 `nodeName` 잔존 1건, swagger.md 신설 예외의 수치·권고 자기불일치, `6-websocket-protocol.md` Overview 부재는 경미한 INFO/WARNING 급 지적이다.

## 위험도

MEDIUM

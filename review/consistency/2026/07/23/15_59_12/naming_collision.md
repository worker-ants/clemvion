# 신규 식별자 충돌 검토 — presentation `previousOutput` 폐기 서술 정정

## 검토 대상

`plan/in-progress/presentation-previousoutput-spec-drift.md` — spec 신규 서술이 아니라
기존 4개 spec 파일(`spec/4-nodes/6-presentation/0-common.md`, `3-chart.md`, `4-form.md`)의
**기존 문구를 정정**하는 draft. 신규 spec 파일 생성이나 신규 요구사항 ID·엔티티·endpoint 도입은
계획되어 있지 않다.

## 발견사항

- **[INFO]** `previousOutput` 이 Loop 노드 내부 로컬 변수명과 우연히 동명이의
  - target 신규 식별자: (target 이 새로 도입하는 식별자 아님 — 기존 필드명 `previousOutput` 을 그대로 인용)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts:69,92,94` — `let previousOutput: unknown = undefined; … previousOutput = output;` (loop body 이전 iteration 출력을 체이닝하는 완전히 무관한 로컬 변수)
  - 상세: target 은 presentation resume 출력의 legacy 필드 `output.previousOutput` (spec: `spec/conventions/node-output.md:194`, `button-interaction.service.ts:269-294`) 를 다룬다. Loop 노드의 `previousOutput` 은 코드 내부 구현 디테일이며 spec 어디에도 문서화되어 있지 않다(`spec/4-nodes/1-logic/*.md` grep 0건). 두 개념은 도메인·레이어가 완전히 분리돼 있어 실질적 독자 혼선 가능성은 낮다.
  - 제안: target 범위 밖. 필요 시 향후 Loop 노드 spec 작성자가 참고할 각주 정도로만 인지해 두면 충분 — 이번 정정에서 조치 불요.

- **[INFO]** 같은 파일(`0-common.md`) 안에 "5종" 이 서로 다른 두 개념을 가리킴 (target 편집 범위 밖의 사전 존재 상태)
  - target 신규 식별자: target 이 "5종→6종" 으로 정정하는 대상은 §10.9 의 **Continuation Bus 메시지 타입 수**(`continue`/`cancel`/`button_click`/`ai_message`/`ai_end_conversation`/`retry_last_turn`, `0-common.md:394,426`)
  - 기존 사용처: 같은 파일 최상단 `0-common.md:14` 의 "관련 문서" 링크 텍스트가 `PRD Presentation 노드 5종` (Carousel/Chart/Form/Table/Template **5개 노드 타입**을 가리키는, 전혀 다른 "5종") 을 참조
  - 상세: target 은 §10.9 로 스코프를 명시했고(본문·"4-layer SSOT 정렬" 두 곳 + `waitForAiConversation` 정정이 있는 Rationale 절), 실측 결과 `execution-engine.md:893,1162` 가 이미 6종(`retry_last_turn` 포함)을 SoT 로 확정해 두었으므로 이 정정은 **기존 SoT 와의 drift 해소**이지 신규 식별자 도입이 아니다. `previousOutput`·`processAiResumeTurn`·`retry_last_turn`·"no-op park(재파킹)" 모두 target 이전에 이미 spec/코드 여러 곳에서 확립된 용어를 그대로 재사용한다(실측: `spec/5-system/4-execution-engine.md:893,1162`, `spec/4-nodes/6-presentation/0-common.md:396-427` 본문, `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 계열).
  - 제안: 실제 편집(치환) 수행 시 "5종" 을 blind 문자열 치환하지 말고 §10.9 로 라인 범위를 좁혀서 적용할 것 — 이는 나열된 4개 체크리스트 항목의 실행 정밀도 문제이지 이번 신규 식별자 충돌 관점에서 CRITICAL/WARNING 은 아니다.

## 관점별 확인 결과

1. **요구사항 ID 충돌** — target 은 신규 요구사항 ID 를 부여하지 않는다 (해당 없음).
2. **엔티티/타입명 충돌** — 신규 엔티티/DTO/인터페이스명 없음. 재인용되는 `previousOutput`(spec `node-output.md` §4.2 이 이미 SoT), `processAiResumeTurn`(engine §7.4/§7.5, `ai-turn-orchestrator.service.ts` 이미 존재), `waitForAiConversation`(동일 서비스, deprecated 옛 아키텍처 명칭이나 여전히 존재하는 실제 함수명 — target 은 완전 폐기가 아니라 잘못 인용된 자리만 정정) 모두 기존 확립 식별자이며 target 은 새 의미를 부여하지 않는다.
3. **API endpoint 충돌** — 신규 endpoint 없음.
4. **이벤트/메시지명 충돌** — `retry_last_turn` 은 target 이 새로 도입하는 이름이 아니라 `execution-engine.md §7.4/§9.3`(`ContinuationType`, `continuation-bus.service.ts`)에 이미 존재하는 Continuation Bus 메시지 타입이다. target 의 "5종→6종" 정정은 `0-common.md` 를 실제 SoT 카운트에 맞추는 작업이라 충돌이 아니라 drift 해소다.
5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음.
6. **파일 경로 충돌** — 신규 spec 파일 생성 없음. 대상 3개 파일 모두 기존 파일 편집이며 명명 컨벤션 변경도 없다. plan 파일 자체 경로(`plan/in-progress/presentation-previousoutput-spec-drift.md`)도 `plan/in-progress/<name>.md` 컨벤션을 그대로 따른다.

## 요약

target 은 신규 spec 파일이나 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수를 전혀 도입하지 않는 순수 **서술 정정(사실관계 교정) 작업**이다. 인용되는 모든 식별자(`previousOutput`, `processAiResumeTurn`, `waitForAiConversation`, `retry_last_turn`, "no-op park/재파킹")는 실측 결과 이미 코드·다른 spec 문서에서 확립되어 있는 기존 명칭을 그대로 재사용하며, target 의 개정 방향은 오히려 `0-common.md` 를 기존 SoT(`node-output.md` §4.2, `execution-engine.md` §7.4/§9.3)와 일치시키는 쪽이라 신규 식별자 충돌 관점에서 문제될 소지가 없다. 발견한 2건은 모두 target 범위 밖의 사전 존재 상태에 대한 참고용 INFO(무관 도메인 동명 로컬 변수, 같은 문서 내 무관 "5종" 표현 병존)이며 이번 개정을 막을 이유가 되지 않는다.

## 위험도

NONE

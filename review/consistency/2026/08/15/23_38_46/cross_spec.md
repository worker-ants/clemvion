STATUS=success cross_spec review complete — 0 CRITICAL, 0 WARNING, 0 INFO (7곳 pointer 정정 + §4.4 보완, 전건 실측 검증 완료)
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — WS 이벤트 값·타입 정본 위치 서술 정정 (7곳) + §4.4 보완

## 사전 안내 — 번들 예산 절단으로 인한 직접 검증

프롬프트에 첨부된 "관련 spec 본문" 번들에서 target 이 수정하려는 7개 파일 중 6개
(`4-execution-engine.md`, `6-websocket-protocol.md`, `8-embedding-pipeline.md`,
`10-graph-rag.md`, `data-flow/0-overview.md`, `data-flow/6-knowledge-base.md`)가
"컨텍스트 예산 초과로 본문 생략"되어 있었다. 번들만으로는 판정할 수 없어, 해당 spec 파일과
관련 코드(`websocket-events.types.ts`, `websocket.service.ts`)를 저장소에서 직접 읽어
target 이 인용한 7개 위치(라인 번호·인용문)를 전수 대조했다.

## 실측 결과 — 7곳 인용문 전건 일치

| # | 파일:라인 | target 의 "현재" 인용 | 저장소 실제 내용 | 일치 |
|---|---|---|---|---|
| ① | `3-workflow-editor/3-execution.md:657` | `` `NodeEventType` 의 `execution.node.*` prefix — `websocket.service.ts` `` | 동일 | ✅ |
| ② | `5-system/10-graph-rag.md:552` | `` `websocket.service.ts` 의 `KbEventType` union...#443 `` | 동일 | ✅ |
| ③ | `5-system/6-websocket-protocol.md:740` | `` `WebsocketService` 의 `KbEventType` union (11개) `` | 동일 | ✅ |
| ④ | `5-system/6-websocket-protocol.md:1034` | `` `WebsocketService.emitKbEvent` 의 `KbEventType` union `` | 동일 | ✅ |
| ⑤ | `5-system/8-embedding-pipeline.md:276` | `` `WebsocketService.emitKbEvent` (KbEventType union) `` | 동일 | ✅ |
| ⑥ | `data-flow/6-knowledge-base.md:288` | `` `WebsocketService` 의 `KbEventType` union `` | 동일 | ✅ |
| ⑦ | `data-flow/0-overview.md:110` | `` `websocket.service.ts` 헤더 주석, EIA §R10 `` | 동일 | ✅ |

코드 측도 대조했다:
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 가 실존하며
  `ExecutionChannelEvent` / `NodeEventType` / `KbEventType`(11개 union, `document:graph_error`
  없음 — #443) 등 12 심볼을 정의한다.
- `websocket.service.ts` 는 이 모듈에서 `import` 후 **re-export**(`export { ... } from`)하고,
  `emitKbEvent` 메서드·`executionEvents$` RxJS fan-out 은 그대로 남아 있다 — target 이 "메서드는
  안 옮겼다" 고 판정한 부분과 일치.
- `websocket-events.types.ts:26` 의 `ExecutionChannelEvent` JSDoc 이 실제로 `[Spec EIA §R10]`
  문구를 담고 있다 — ⑦ 의 인용 대상 변경(`websocket.service.ts` 헤더 주석 → 새 모듈의 JSDoc)이
  정확하다.

## §4.4 삽입 지점 검증

`spec/5-system/4-execution-engine.md:478` 의 정확한 원문(`"...현재는 두 기법으로 봉인한 상태를
유지한다."`)을 확인했고, target 이 지목한 삽입 지점(그 문장 직후, `- **테스트 격리**` 불릿 앞,
479행 이전)이 실제 문서 구조와 일치한다. 추가하려는 문단("DI 그래프는 이 조치로 바뀌지 않으며 …
줄어든 것은 모듈 그래프이지 DI 그래프가 아니다")은 원문 478행의 "이벤트 기반 디커플링 등으로
근본 축소하는 것은 별도 backlog" 문구와 축을 분리해 재확인할 뿐, 유예 결정을 뒤집지 않는다.
이 근본 축소 문구를 참조하는 다른 spec 은 없음(전체 `spec/` grep 결과 이 한 곳뿐) — 추가로 인한
2차 drift 위험 없음.

## Cross-Spec 충돌 관점별 판정

1. **데이터 모델 충돌** — 없음. 엔티티·필드 정의 변경 없음, 서술 위치만 정정.
2. **API 계약 충돌** — 없음. endpoint·payload shape 불변.
3. **요구사항 ID 충돌** — 없음. 새 요구사항 ID 미부여.
4. **상태 전이 충돌** — 없음. 상태 머신 서술 변경 없음.
5. **권한·RBAC 충돌** — 없음. 관련 없는 영역.
6. **계층 책임 충돌** — 없음. `codebase/**` 는 target 이 명시적으로 범위 밖("planner 턴") 처리했고,
   실제로 발행 주체(`WebsocketService.emitKbEvent`, `executionEvents$` facade)는 그대로 두고
   선언(타입/enum) 소재만 정정하므로 §4.4 "단일 sink 정책" 결정과 충돌 없음. `spec/5-system/
   14-external-interaction-api.md` §R10, `spec/5-system/15-chat-channel.md`, `spec/conventions/
   chat-channel-adapter.md` 등 "단일 sink" 를 인용하는 다수 문서를 grep 했으나 모두 **메서드/
   facade**(`emitToExecution`/`executionEvents$`/`emitKbEvent`)를 가리키고 있어 이번 정정 대상
   (타입 선언 소재)과 겹치지 않는다 — 회귀 없음.

## 추가 확인 — 7곳 밖에 남는 유사 표현

`grep -rn "KbEventType|NodeEventType|ExecutionChannelEvent|..." spec/` 로 전수 스캔한 결과,
target 이 "범위 밖(제외 판정)"으로 처리한 `8-embedding-pipeline.md:285,411`,
`data-flow/6-knowledge-base.md:416` 은 union 을 **언급만** 하거나 취소선 이력(폐기 서술)일 뿐
"정본 위치" 를 새로 주장하지 않아 정정 대상이 아니라는 target 의 판단이 정확함을 확인했다.
`websocket.service.ts`/`WebsocketService` 를 인용하는 그 밖의 spec 문장(예:
`14-external-interaction-api.md`, `15-chat-channel.md`, `data-flow/8-notifications.md`,
`data-flow/15-external-interaction.md` 등 다수)은 전부 **메서드/facade 호출**(안 옮긴 대상)을
가리키므로 정정 불필요 — target 의 7곳 스코프에 누락이 없다.

또한 `plan/in-progress/ws-event-types-extract.md` §"후속"의 체크리스트(7개 spec 위치 +
frontmatter `code:` 항목 + §4.4 항목)를 대조한 결과 target 의 변경안과 1:1 대응하며 누락·추가
없음을 확인했다. `spec/5-system/6-websocket-protocol.md` 의 기존 `pending_plans:
spec-sync-websocket-protocol-gaps.md` 는 `KbEventType`/`NodeEventType`/`websocket-events.types`
를 언급하지 않아 target 의 편집과 겹치지 않는다(중복 작업 위험 없음).

## 요약

target 은 실제 코드 상태(`websocket-events.types.ts` 로 12 심볼 분리 + re-export 보존)와
현재 spec 7개 위치의 정확한 인용문을 저장소에서 직접 대조해도 전건 일치했다. "선언 이동"과
"동작 주체(메서드/facade) 불변"을 정확히 구분해 일괄 치환의 함정(예: `WebsocketService` 전체를
새 파일명으로 바꿔 `emitKbEvent`/`executionEvents$` 관련 문장을 오히려 틀리게 만드는 것)을
피했다. §4.4 보완 문단의 삽입 지점도 실제 문서 구조와 정확히 일치하며, 유예 결정을 뒤집는
문구가 아니다. 다른 영역(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 어디에서도
모순을 발견하지 못했다.

## 위험도

NONE

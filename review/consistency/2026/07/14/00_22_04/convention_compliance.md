# 정식 규약 준수 검토 — Convention Compliance

- 검토 모드: spec draft 검토 (`--spec`)
- target: `plan/in-progress/spec-draft-webchat-crossref-ws-wire-drift.md`
- 대조 규약: `spec/conventions/**` (특히 `spec-impl-evidence.md`, `interaction-type-registry.md`, `swagger.md`, `node-output.md`, `conversation-thread.md`) + CLAUDE.md 명명/구조 컨벤션

## 검토 방법

target 은 아직 spec 에 적용되지 않은 **draft plan** 이며, 적용을 전제로 한 4개 편집안(WARNING #1: `4-ai-assistant.md`, WARNING #2: `6-websocket-protocol.md` / `14-external-interaction-api.md` / `0-architecture.md`)을 담고 있다. 각 편집의 인용 라인·인용문·앵커·참조 코드 경로를 실제 파일과 대조해 사실 정확성 및 규약 부합을 확인했다.

## 발견사항

- **[WARNING] EIA §6.2 를 "전체 필드 매핑 SoT" 로 지칭하나 실제로는 불완전 — draft 가 스스로 표방한 "단일 SoT, 3중 복제 회피" 원칙과 충돌**
  - target 위치: target 문서 "편집 2" 절 (`spec/5-system/6-websocket-protocol.md §4.4` 에 삽입할 caveat blockquote 문안) — "**전체 필드 매핑 SoT: [EIA §6.2 ... blockquote]**" 문구.
  - 위반 규약: 프로젝트 전반의 "단일 SoT + 완전성" 컨벤션 패턴 — `spec/conventions/interaction-type-registry.md`(enum 값 1개 추가 시 N개 위치 누락 방지가 문서 존재 이유 자체), `spec/conventions/swagger.md §1-4 Rationale`("왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가" — 봉투로 명시적으로 닫힌 필드를 `interactionType`/`waitingNodeId`/`conversationThread`/변형 키로 열거), `spec/conventions/spec-impl-evidence.md` 전반의 evidence-SoT 철학.
  - 상세: target 의 "배경 — 검증한 사실" 절이 직접 코드 근거로 제시한 emit 지점(`form-interaction.service.ts:120`, `button-interaction.service.ts:407`, `ai-turn-orchestrator.service.ts:451`)을 실제로 읽어보면, `execution.waiting_for_input` fanout envelope 은 `waitingNodeId`/`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`/`interactionType`/`nodeOutput`/`conversationThread` 를 평면 병합해 emit 한다 (3개 서비스 모두 동일 shape). 그런데 target 이 "이미 full 매핑 SoT 보유" 로 지목한 `spec/5-system/14-external-interaction-api.md §6.2` 의 기존 caveat blockquote(line 585–593, 이번 draft 가 수정하지 않고 그대로 인용만 함)는 `node.id→waitingNodeId` / `node.interactionType→interactionType` / `context.conversationConfig→nodeOutput.conversationConfig` / `context.buttonConfig→buttonConfig` / `context.formConfig→nodeOutput.formConfig` / `context.conversationThread→conversationThread` **6개 매핑만** 열거하며, `waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt` 4개 필드는 언급이 없다. `spec/conventions/swagger.md §1-4` 의 "봉투 닫힌 필드" 목록(`interactionType`/`waitingNodeId`/`conversationThread`/변형 키)도 동일하게 이 4개 필드를 다루지 않는다 — 즉 이 gap 은 본 draft 가 새로 만든 것은 아니고 기존 EIA/swagger 문서에 이미 있던 것이지만(`plan/complete/fix-webchat-sse-field-map.md` line 57 에 "추상 블록 자체를 wire 로 교체하는 정식 EIA 이슈는 backlog" 로 알려진 채 남겨둔 기록 확인), **본 draft 가 그 blockquote 를 "전체 필드 매핑 SoT" 라고 명시적으로 격상해 부르면서도 그 gap 을 메우지 않는다**는 점이 문제다. `interactionType`/`waitingNodeId`/`nodeOutput`/`conversationThread` 처럼 위젯이 실제로 소비하는 필드만 다루려는 의도적 스코프라면 "전체"(완전성 주장)라는 표현 자체가 과대 서술이고, 위 4개 필드까지 포함해 진짜 완전하게 만들 의도라면 EIA §6.2 blockquote 자체도 함께 갱신해야 한다. 현재 안대로 병합하면 "3중 복제 방지 위해 EIA §6.2 를 SoT 로 가리킨다"는 draft 의 처분 결정 취지와 달리, **WS §4.4 caveat 가 EIA §6.2 보다 더 많은 정보(추가 4필드 인지)를 배경 조사로 확보하고도 그 SoT 문서엔 반영하지 않은 채 "전체" 라고만 못박는** 자기모순적 상태로 남는다 — 다음에 누군가 이 필드들 중 하나가 또 바뀌면 "전체 SoT" 라는 라벨을 믿고 EIA §6.2 만 갱신하거나, 반대로 WS §4.4 caveat 만 갱신하는 새로운 drift 표면이 열린다.
  - 제안: 다음 중 하나를 선택해 draft 를 보정.
    1. (권장) EIA §6.2 blockquote 에 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`(+ 필요 시 `startedAt`, 위젯 미소비 필드로 명시) 3–4개 항목을 추가해 실제로 "전체" 로 만든 뒤, WS §4.4 caveat 는 draft 안대로 그대로 가리킨다.
    2. WS §4.4 caveat 문구에서 "전체 필드 매핑 SoT" 를 "위젯 소비 필드 매핑 SoT"(또는 유사하게 스코프를 명시하는 표현)로 낮춰, EIA §6.2 가 위젯 소비 필드만 다루는 의도된 범위임을 명확히 하고 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt` 는 "내부 bookkeeping 필드, 위젯 미소비"로 별도 한 줄만 덧붙인다.
    본 draft 의 체크리스트("side-effect 점검") 단계에 이 항목을 추가하는 것도 방법.

- **[INFO] `startedAt` 필드는 target 의 배경 조사·caveat 어디에도 언급되지 않음**
  - target 위치: "배경 — 검증한 사실" WARNING #2 절 전체.
  - 위반 규약: 없음(직접적 규약 위반 아님) — 위 WARNING finding 의 보충 사실.
  - 상세: 3개 emit 지점 모두 `startedAt: nodeExec?.startedAt?.toISOString?.()` 을 fanout envelope 에 항상 동봉하지만, target 의 "실제로 …를 평면 병합해 보낸다" 열거에 포함되지 않았고 EIA §6.2/swagger.md 어디에도 없다. 위 WARNING 조치 시 함께 정리하면 완전성이 높아진다.
  - 제안: 위 WARNING 해결 시 같이 반영(별도 조치 불필요, 참고용).

## 검증 통과 항목 (긍정 확인)

- 인용 라인 번호(`4-ai-assistant.md:145`, `6-websocket-protocol.md:380`, `14-external-interaction-api.md:593`, `0-architecture.md:82`)와 실제 파일 내용이 정확히 일치.
- 앵커 슬러그(`#11-마크다운html-sanitize-정책-매트릭스`, `#62-페이로드--executionwaiting_for_input`, `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`)는 저장소 내 기존 검증된 유사 앵커 패턴(예: `#65-페이로드--executioncancelled--executionai_message`, `interaction-type-registry.md` 의 기존 WS §4.4 링크)과 동일한 github-slugger 규칙을 따름 — `spec-link-integrity.test.ts` 통과 예상.
- 인용 코드 경로(`markdown-renderer.tsx`, `safe-html.ts`, `form-interaction.service.ts`, `button-interaction.service.ts`, `ai-turn-orchestrator.service.ts`, `eia-events.ts`)는 모두 실존하며 인용 내용(react-markdown+remark-gfm, rehype-raw 미사용 / DOMPurify allowlist / `waitingNodeId` 등 emit 필드)도 코드와 일치.
- 편집 2 가 채택한 "논리 구조 표기 + 구현현실 caveat 블록" 패턴은 `spec/5-system/6-websocket-protocol.md §2.1/§2.2`, `spec/5-system/14-external-interaction-api.md §6.2` 가 이미 쓰는 기존 문서 관례와 동일한 스타일(볼드 라벨 + 콜론 + 목록)을 따름.
- `waitingNodeId` 등 fanout envelope 필드명은 `spec/conventions/swagger.md §1-4 Rationale` 에 이미 "봉투 닫힌 필드"로 문서화된 이름과 일치 — 새 명명 도입이 아니라 기존 규약과 정합.
- plan frontmatter(`worktree`/`started`/`owner`)는 `plan-lifecycle.md §4` 필수 3필드를 모두 포함하며 형식(ISO 날짜 등)도 준수. `spec_impact` 는 in-progress 단계에서 의무는 아니지만 미리 선언해도 규약 위반 아님(Gate C 는 완료 시점에만 강제).
- `spec_impact` 4개 경로 모두 실존 spec 파일 — dangling 없음.
- WARNING #1/#2 채택/기각 논거가 기존 규약(단일 SoT, "논리 표기 + caveat" 패턴)을 근거로 삼고 있어 규약 인식 자체는 정확함 — 다만 WARNING #2 실행 문안에서 그 원칙이 완벽히 관철되지 않은 부분이 위 finding.
- 문서 구조 3섹션(Overview/본문/Rationale) 관련해 target 편집은 기존 spec 문서의 절 내부 삽입/구절 교체에 그쳐 구조를 훼손하지 않음. `_product-overview.md`/`0-` prefix 등 CLAUDE.md 명명 컨벤션과도 무관(신규 파일 생성 없음).
- API 문서 규약(OpenAPI/Swagger 데코레이터·DTO 명명) 관점은 target 이 REST DTO/컨트롤러를 건드리지 않아 직접 해당 사항 없음 — 다만 위 WARNING 이 `swagger.md §1-4` 의 봉투 필드 목록과 상호 영향이 있음을 참고.

## 요약

target draft 는 인용 라인·인용문·앵커·코드 경로가 모두 실제 코드/문서와 정확히 일치하는 등 사실 검증 정밀도가 높고, 채택한 "논리 구조 표기 + 구현현실 caveat" 패턴과 단일 SoT 참조 방식도 이 저장소의 기존 문서 관례·`spec/conventions/swagger.md`·`interaction-type-registry.md` 가 표방하는 원칙과 대체로 부합한다. 다만 WARNING #2 의 실행 문안이 EIA §6.2 blockquote 를 "전체 필드 매핑 SoT" 로 격상해 지칭하면서도, draft 자신이 코드로 확인한 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`(+`startedAt`) 4개 필드를 그 "SoT" 에 반영하지 않아 완전성 주장과 실제 내용이 어긋난다 — 이는 draft 가 명시적으로 피하려던 "3중 복제/재-drift" 위험을 문구 수준에서 재도입하는 결과다. CRITICAL 급 invariant 위반은 없으며(빌드 가드·링크 무결성은 모두 통과 예상), spec 반영 전에 위 WARNING 항목만 보정하면 규약 준수 상태로 병합 가능하다.

## 위험도

LOW

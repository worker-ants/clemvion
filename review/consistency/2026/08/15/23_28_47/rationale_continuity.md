### 발견사항

없음. target 문서(`plan/in-progress/spec-draft-ws-types-canonical-location.md`)가 건드리는 7+1곳을
관련 spec(`3-workflow-editor/3-execution.md`, `5-system/6-websocket-protocol.md`,
`5-system/8-embedding-pipeline.md`, `5-system/10-graph-rag.md`, `data-flow/0-overview.md`,
`data-flow/6-knowledge-base.md`, `5-system/4-execution-engine.md`)의 `## Rationale` 실제 본문과
대조했으나, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 유형도 발견되지
않았다.

검증 근거(실측):

- target 이 인용한 "현재" 문구 7건 전부(`3-execution.md:657`, `10-graph-rag.md:552`,
  `6-websocket-protocol.md:740`/`1034`, `8-embedding-pipeline.md:276`,
  `data-flow/6-knowledge-base.md:288`, `data-flow/0-overview.md:110`)가 실제 spec 텍스트와
  글자 단위로 일치함을 `Read`로 확인했다. 지어낸 인용이 아니다.
- `websocket-events.types.ts` 헤더 JSDoc(코드)이 이미 "[4-execution-engine §4.4] Rationale 이
  유예한 것은 '이벤트 기반 디커플링 등으로 순환을 근본 축소' 하는 대규모 리팩터이고, 이 모듈은 그
  봉인 기법을 대체하지 않는 보완 조치다" 라고 명시하고 있어, target 이 §4.4 에 추가하려는 문장과
  거의 동형이다 — 코드 쪽 주석이 이미 이 rationale-continuity 를 선언해 둔 상태를 spec 에 반영하는
  것뿐이라 사실상 무근거 번복 리스크가 없다.
- `4-execution-engine.md` §4.4 본문(line 478)의 기존 문구 "위 순환 자체를 이벤트 기반 디커플링
  등으로 근본 축소하는 것은 별도 대규모 리팩터링 backlog 다 — 현재는 두 기법으로 봉인한 상태를
  유지한다"는 target 이 추가하려는 문장과 정면 대립하지 않는다 — target 은 그 유예를 명시적으로
  "번복하지 않는다"고 문장 안에 못박았고(`"여전히 유예 상태다"`), 세 번째 완화 기법을 "대체가
  아니라 보완"으로 규정해 §4.4 의 두-기법 체계(forwardRef/ModuleRef)를 무너뜨리지 않는다.
- `5-system/6-websocket-protocol.md`·`data-flow/6-knowledge-base.md`·`8-embedding-pipeline.md`
  의 `## Rationale`(KB 채널 단위 전환·union count 11개·`retry-failed scope=all` 등)은 파일 위치가
  아니라 **채널 단위·이벤트 개수·전송 프로토콜** 등 직교하는 축을 다루므로 target 의 "정본 파일
  위치" 정정과 충돌하지 않는다. 특히 `8-embedding-pipeline.md:411`(Rationale)의 "backend
  `KbEventType` union 과 `emitKbEvent` 구현이 권위" 문구는 파일 경로를 명시하지 않아 target 의
  범위 밖이며, target 이 이를 건드리지 않은 것도 갭이 아니다.
- target 이 스스로 새로 적은 Rationale 3건("일괄 치환 대신 7곳 개별 판정", "새 spec 문서 신설
  기각", "§4.4 유예 결정 불변") 은 과거 이력을 사칭하지 않고 이번 결정 자체의 trade-off 로 정직하게
  서술되어 있다 — `feedback_rationale_rejected_alternatives_need_history.md` 가 경계하는
  "지어낸 과거 기각 이력" 패턴이 아니다.
- "새 spec 문서 신설 기각" 판단은 `data-flow/0-overview.md` 자체 Rationale("각 도메인 문서는
  entity 전체 정의를 복사하지 않고 SoT 를 링크한다 — 그래야 entity 정의가 바뀌어도 표가 유효하다")
  의 기존 원칙과 방향이 같다(중복 문서 증식 대신 포인터 유지) — 오히려 원칙을 강화하는 선택.
- frontmatter `code:` 비대칭 주장(`3-execution.md` 에 `websocket-events.types.ts` 부재,
  `6-websocket-protocol.md` 에는 이미 존재)도 실제 두 파일의 frontmatter 를 대조해 사실로
  확인했다.

구조적으로 사소한 참고(비-차단, Rationale 연속성 범주 밖에 더 가까움): target 의 ⑧ 항목은
"§4.4 Rationale 말미에 문장 추가"라고 표현하지만, §4.4 는 문서 하단의 마스터 `## Rationale`
섹션이 아니라 본문 §4 (Worker 모델) 안에 인라인 "근거:" 목록으로 이미 존재하는 절이다. 이는
target 이 새로 만드는 구조가 아니라 §4.4 가 원래부터 갖고 있던 (본문 안에 inline rationale 을
두는) 기존 패턴을 그대로 따르는 것이므로 Rationale 연속성 위반은 아니다.

### 요약
target 이 다루는 7+1곳 전부에서 인용된 "현재" spec 문구가 실측과 일치하고, 이동 대상(선언 12개)과
비이동 대상(`emitKbEvent` 메서드, 단일 sink facade)을 명확히 구분해 "일괄 치환" 이라는, 이 저장소가
과거 반복 겪은 실수 패턴을 스스로 경계하고 있다. §4.4 Rationale 보완 항목은 code 쪽에 이미 존재하는
동일 취지의 JSDoc 을 spec 에 미러링하는 수준이며, "이벤트 기반 디커플링 근본 축소" 유예 결정을
번복하지 않는다고 문장 자체에 명시해 과거 결정과 충돌하지 않는다. 자체적으로 작성한 새 Rationale
항목들도 과거 이력을 사칭하지 않고 이번 결정의 trade-off 를 정직하게 서술한다. Rationale 연속성
관점에서 이 target 문서는 깨끗하다.

### 위험도
NONE

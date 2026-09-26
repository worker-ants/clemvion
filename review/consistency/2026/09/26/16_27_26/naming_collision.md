# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-ed-ai-19-status.md`

## 검토 범위 확인

target 문서는 `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행 끝에 **밑줄 기울임 표기 하나**
(`_(미구현 — 계획, [§4-ai-assistant §12.2](./4-ai-assistant.md#122-실행디버깅))_`)를 덧붙이는 draft다. 요구사항
ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로 중 어느 것도 **새로 만들지 않는다** — 기존 ID(`ED-AI-19`)에
기존 문서(`4-ai-assistant.md`)의 기존 절(`§12.2`)로 가는 링크 텍스트를 추가할 뿐이다. 아래는 6개 관점을 이 draft에
투영한 확인 결과다.

## 점검 결과

1. **요구사항 ID 충돌** — 새 ID 없음. `ED-AI-19`는 이미 §10.4에 존재하는 행이고, 이 draft는 그 행에 주석을 붙일 뿐
   새 ID를 부여하지 않는다. 충돌 없음.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 없음. 충돌 없음.
3. **API endpoint 충돌** — 새 endpoint 없음. 충돌 없음.
4. **이벤트/메시지명 충돌** — 새 이벤트명 없음. 충돌 없음.
5. **환경변수·설정키 충돌** — 새 ENV/config key 없음. 충돌 없음.
6. **파일 경로 충돌** — 새 spec 파일 생성 없음(기존 `_product-overview.md` 수정). plan 파일 `plan/in-progress/spec-draft-ed-ai-19-status.md` 는
   `find plan -iname "*spec-draft*"` 로 확인한 130여 개 기존 `spec-draft-*.md` 파일과 이름이 겹치지 않으며 명명
   컨벤션(`spec-draft-<slug>.md`)도 따른다. 충돌 없음.

## 발견사항

- **[INFO]** 같은 표 안에서 "미구현" 주석 어휘가 두 가지로 갈린다
  - target 신규 식별자: `_(미구현 — 계획, [§4-ai-assistant §12.2](...))_ ` (draft가 §10.4 ED-AI-19 행에 추가하려는 문구)
  - 기존 사용처: 같은 파일 `spec/3-workflow-editor/_product-overview.md:134` ED-DB-05 행의 `_(미구현 — 로드맵, [§3-execution §6](...))_`
  - 상세: draft 본문은 "형식은 같은 문서 ED-DB-05 행의 선례를 따른다"고 명시하지만, 실제로 붙이는 낱말은 로드맵이 아니라
    "계획"이다. 이는 **오류가 아니라 의도된 구분**으로 보인다 — `spec/conventions/spec-impl-evidence.md` 의 상태
    어휘 관례상 `backlog`(장기·미결정)는 "로드맵"(`spec/0-overview.md §6.3` 연결), 이미 결정되어 추적 중인 미구현
    갭은 "계획"/`pending_plans` 계열 어휘를 쓴다. ED-DB-05(브레이크포인트)는 `spec/5-system/4-execution-engine.md`·
    `6-websocket-protocol.md` 등에서 실제로 "로드맵"으로 불리는 장기 항목인 반면, ED-AI-19 가드 미구현은
    `4-ai-assistant.md:717`에서 이미 "**(계획)**"으로 불리는 근접 추적 항목이라 draft의 낱말 선택이 원문과 정합한다.
    다만 같은 §10.4 표 안에 "미구현 — 로드맵"과 "미구현 — 계획" 두 카테고리 라벨이 공존하게 되므로, 표만 보는
    독자에게는 두 어휘의 차이(장기 backlog vs 추적 중인 partial 갭)가 설명 없이 드러나지 않는다.
  - 제안: 충돌은 아니므로 변경을 요구하지 않는다. 다만 표 상단이나 범례에 "로드맵"과 "계획" 두 표기가 서로 다른
    상태(§6.3 backlog vs 추적 중인 미구현 갭)를 가리킨다는 한 줄 각주를 두면 다음 편집자가 두 어휘를 같은 것으로
    오인해 통일하려는 시도를 막을 수 있다.

## 요약

target draft는 새 요구사항 ID·엔티티·endpoint·이벤트·환경변수·파일 경로를 전혀 도입하지 않고, 기존 `ED-AI-19` 행에
기존 `4-ai-assistant.md §12.2`로의 상대 링크 주석 하나를 추가할 뿐이다. 링크 텍스트("§4-ai-assistant §12.2")·앵커
(`122-실행디버깅`)·plan 파일명 모두 기존 사용처와 겹치지 않으며 명명 컨벤션도 지킨다. 유일하게 눈에 띄는 점은 같은
문서 안에서 "미구현" 상태 주석 어휘가 "로드맵"(ED-DB-05)과 "계획"(ED-AI-19, 신규)으로 갈린다는 것인데, 이는 실측 결과
서로 다른 상태 범주(backlog 로드맵 vs 추적 중인 partial 갭)를 정확히 반영한 의도된 구분이라 충돌로 보지 않는다.

## 위험도

NONE

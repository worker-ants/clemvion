# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`git diff origin/main...HEAD` 로 실제 변경분을 확인한 결과, 이번 target(`spec/5-system/`,
impl-done, node-output-envelope 작업)이 건드린 파일은 다음과 같다:

- `spec/5-system/14-external-interaction-api.md` — EIA §R17 표의 `envelope.output` 행을
  "deny-list 유지" → "fail-closed allowlist" 로 상태 플립 + 유예 근거 취소선 정정
- `spec/5-system/6-websocket-protocol.md` — §4.1 `execution.node.completed`/`.failed` 표
  서술 정정(래퍼/도메인값 구분, `output` 열 추가), §4.4 caveat 취소선 정정
- `spec/conventions/conversation-thread.md` — §8.4 자기-반증형 소정정(developer 가 직접
  쓴 예고 문장의 취소선 정정, CLAUDE.md 예외 조건 충족)
- `plan/complete/node-output-envelope.md`(신규) · `plan/complete/sse-nodeoutput-allowlist.md` ·
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` ·
  `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
- 코드: `codebase/backend/src/modules/websocket/websocket.service.ts` (+`.spec.ts`) —
  `narrowTopLevelNodeOutput` 헬퍼 신설 + `allowlistFanoutNodeOutput` 이 `output` 키까지 배선

**핵심 성격**: 이번 변경은 **새 요구사항·엔티티·엔드포인트·이벤트·ENV 를 도입하지 않는다.**
`#1208`(`sse-nodeoutput-allowlist`)에서 developer 스스로 쓴 유예 근거("`envelope.output` 은
이종 payload 라 같은 allowlist 를 걸 수 없다")를 실 DB 조회로 반증하고, **기존에 이미 spec 이
알고 있던 필드(`envelope.output`, `execution.node.completed`/`.failed`, EIA §R17)의 상태를
correction** 한 것이다. 신규 식별자 충돌 관점에서 점검할 "새 이름"이 거의 없다.

## 점검 결과 (관점별)

### 1. 요구사항 ID 충돌
새 ID 없음. `R17` 은 diff 전에도 이미 EIA 문서의 SoT 였고(§R17 "내부 읽기 경로"/"nodeOutput
allowlist 표"), 이번 변경은 그 표의 기존 행 상태만 바꿨다. 새 `R-*` ID 발번 없음(diff 전수
grep 확인).

### 2. 엔티티/타입명 충돌
- 코드에 새로 추가된 함수 `narrowTopLevelNodeOutput` (`websocket.service.ts:182`) —
  저장소 전체(`spec/`, `plan/`, `codebase/`) grep 결과 이 diff 가 만든 4곳(정의 1 + JSDoc
  참조 1 + 호출 2 + plan 인용 1)에만 존재. 기존 식별자와 충돌 없음.
- `allowlistFanoutNodeOutput` / `allowlistNodeOutputKeys` 는 `#1208`에서 이미 존재하던
  함수로, 이번 diff 는 시그니처를 유지한 채 내부 구현만 리팩터(공통 헬퍼로 위임). 신규
  타입/엔티티 발번 없음.
- spec 문서에 새 DTO/인터페이스명 도입 없음 — `output`/`nodeOutput`/`envelope` 등은 모두
  기존 wire 필드명 재확인일 뿐.

### 3. API endpoint 충돌
없음. REST/WS endpoint 신설 없음.

### 4. 이벤트/메시지명 충돌
없음. `execution.node.completed` / `execution.node.failed` 는 diff 이전부터 §4.1 표에
존재하던 이벤트(서술만 정정). 새 이벤트 이름 도입 없음.

### 5. 환경변수·설정키 충돌
없음. diff 전체에 `process.env` / `_SECONDS` / `_ENABLED` 류 신규 키 추가 0건(grep 확인).

### 6. 파일 경로 충돌

- **[INFO] 신규 plan 파일명이 기존 in-progress 트래커와 접두어를 공유**
  - target 신규 식별자: `plan/complete/node-output-envelope.md` (본 작업의 완료 plan)
  - 기존 사용처: `plan/in-progress/node-output-redesign/`(28개 노드별 파일을 담은
    디렉토리, `README.md` 기준 "노드별 `output` 필드 정의가 spec/conventions/node-output.md
    에 부합하는지" 를 다루는 별개의 대형 in-progress 트래커)
  - 상세: 둘 다 "node-output" 접두를 공유하지만 스코프가 다르다 — 신규 파일은
    "WS/SSE fanout **egress 필터링**(어떤 키를 외부로 흘릴지)" 이고, 기존 디렉토리는
    "노드 핸들러가 채우는 **`output` 필드의 도메인 shape/schema**" 다. 파일명 자체는
    `-envelope`(신규) vs `-redesign`(기존 디렉토리)로 접미어가 달라 정확한 문자열 충돌은
    아니며, `plan/complete/` vs `plan/in-progress/` 로 위치도 갈린다.
  - 제안: 실질 충돌은 아니라 이름 변경은 불요. 다만 향후 "node-output" 접두 plan 이
    더 늘어나면(예: 이번 것처럼 egress 필터링 계열이 반복되면) `node-output-egress-*` 처럼
    접두를 한 단계 더 세분화해 두 계열(도메인 shape vs egress 필터)을 검색으로도 구분되게
    하는 편이 좋다. 이번 1건만으로는 조치 불요.

- 그 외 신규 spec 파일 경로 생성 없음(diff 는 모두 기존 spec 파일 내부 수정).
  `plan/complete/fix-webchat-envelope-unwrap.md`(REST `{data}` 봉투 언랩 버그, 2026-06)와도
  스코프가 명확히 달라(webchat 위젯 REST 응답 unwrap vs WS/SSE egress allowlist) 혼동 위험
  낮음.

## 부가 확인 — 테스트 캐너리명

`websocket.service.spec.ts` 에 신규 `it()` 3건을 추가했고(`[캐너리] execution.node.* 의
envelope.output 도 allowlist 를 지난다` 등), `#1208` 이 심어 둔 구 `[잔여] … 아직 allowlist 를
지나지 않는다` 캐너리 문자열은 저장소 전체에서 더 이상 발견되지 않는다 — plan 이 명시한
"뒤집었다"가 실제로 반영됐고, 신·구 캐너리가 모순된 이름으로 공존하는 상태는 없다.

## 요약

이번 target 은 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV 변수를 전혀 도입하지
않는다 — `#1208`이 남긴 유예 근거(실측으로 반증됨)를 정정하고, 이미 spec 표에 있던
`envelope.output` 행의 allowlist 적용 상태를 플립하는 correction PR 이다. 코드에 신설된
유일한 식별자 `narrowTopLevelNodeOutput` 은 저장소 전역에서 충돌이 없고, 신규 plan 파일
`plan/complete/node-output-envelope.md` 도 기존 `node-output-redesign` 트래커와 접두어만
공유할 뿐 접미어·위치·스코프가 명확히 갈려 실질 충돌이 아니다(INFO 로만 기록). CRITICAL/
WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

LOW

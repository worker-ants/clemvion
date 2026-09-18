# Plan 정합성 검토 — spec-draft-webhook-endpoint-path-global-unique.md

## 검토 범위 확인

- 트래커 원 항목 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  «웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다»(line 4632~4637)를 직접 읽었다.
  이 항목은 명시적으로 **"결정할 것: `endpoint_path` 는 UUID v4(CHECK)라 전역 유일로 좁혀도
  되는가 · 아니면 비유일 보조 인덱스로 조회만 고치는가"** 를 미해결로 남겨 두었다. target
  draft 는 이 두 선택지 중 전자를 택하고 «결정 (2026-09-18 사용자)» 로 표시하며, 후자(비유일
  보조 인덱스 + 앱 레벨 중복 검사)를 "동시 요청 경합을 DB 가 막지 못한다" 는 근거로 명시
  기각했다. **미해결 결정을 일방적으로 우회한 것이 아니라, 트래커가 열어 둔 두 선택지 중
  하나를 근거와 함께 명시적으로 닫은 것**이다 — 정합.
- 등재 시 적힌 실측값 «W=10,000 에서 0.9 ms» 를 draft 가 "5만 행 UPDATE 직후 VACUUM 없이 잰
  값" 이라고 스스로 정정하고 재실측 표를 실었다 — 트래커 반영 예정 문구와도 일치.
- 트래커 항목의 출처 표시(`plan/complete/spec-draft-fk-remaining-dispositions.md` «비대상»)와
  `spec/1-data-model.md` Rationale «쓸 인덱스가 없는 FK 서른하나의 처분» 절의 인용문(«28개
  **밖**에서 같은 모양으로 찾은 웹훅 트리거 조회…»)을 원문과 대조 — **정확히 일치**한다(스코프
  진입 근거 조작 없음).

## 다른 in-progress plan 과의 충돌 여부

- `plan/in-progress/` 전체를 대상으로 `endpoint_path`/`endpointPath`/웹훅 트리거 관련 문구를
  훑었다. 웹훅이라는 단어가 걸리는 다른 항목(`chat-channel-slack-socket-mode.md`,
  `chat-channel-discord-gateway.md`)은 Slack/Discord 의 "webhook 모드" 라는 별개 개념(공급자
  프로토콜 선택지)이고 `trigger.endpoint_path` 유일성 범위와는 무관 — 충돌 없음.
- V131·V132 마이그레이션 번호, `idx_trigger_endpoint_path` 인덱스명이 기존 마이그레이션
  (`ls codebase/backend/migrations` 최신 V130) · 다른 in-progress plan 어디에도 선점되어
  있지 않음을 확인 — 명명 충돌 없음.
- `(workspace_id, endpoint_path)` 유일성을 전제로 하는 다른 미해결 plan 항목(예: 채팅 채널
  등록, webhook URL 불변성)을 찾지 못했다. `spec/5-system/15-chat-channel.md` 의
  `endpointPath` 변경 PATCH → provider 재등록(`setupChannel`) 관례는 **애플리케이션 계층
  PATCH 경로**를 전제로 한 것이고, target 의 V131 중복 정리는 **비정상 상태(복사 공격 흔적)의
  DB 직접 정리**이므로 같은 계층이 아니다 — 이 draft 의 «비대상» 표(지운 경로 재등록·대소문자·
  인증 웹훅)에는 없지만, 정상 트리거는 애초에 다른 워크스페이스와 `endpoint_path` 가 겹치지
  않는다는 draft 자신의 전제(복제·가져오기 범위 밖, `data-flow/11-workflow.md` 확인)와
  모순되지 않는다 — 실질적 충돌 없음(참고용 INFO 수준).

## 발견사항

- **[INFO]** S6 이 같은 파일의 인접 절을 놓쳤다 — target 문서 자기-완결성(스코프 인접)
  - target 위치: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` §S6
  - 관련 plan: 해당 없음 — `plan/in-progress/**` 항목과의 충돌이 아니라, target 문서(spec
    draft) 자신의 spec_impact 이행 완결성 문제. 다른 관점(기술 정확성/구조) checker 영역과
    겹칠 수 있어 참고용으로만 남긴다.
  - 상세: S6 은 `spec/data-flow/10-triggers.md` 의 "`trigger` 생성" 표 행 한 줄만 교체 대상으로
    적었다. 그런데 같은 파일에 별도 절 `### Webhook endpoint_path 의 UNIQUE 범위`
    (line 245-255)가 있고, 여기 "`(workspace_id, endpoint_path)` 가 UNIQUE 이므로 워크스페이스
    스코프 안에서는 경로가 유일하다" · "충돌 회피는 `endpoint_path` 를 UUID 로 자동 발급해
    **사실상 전역 고유로 만드는 방식에 의존**한다" · "예측 가능한 비-UUID 경로 직접 지정
    (squatting·enumeration)을 형식 강제로 차단한다" 라고 적혀 있다. 이 문장들은 정확히 이
    draft 가 반증한 전제(고엔트로피는 추측만 막고 복사는 막지 못한다)를 그대로 담고 있어,
    S1~S6 적용 뒤에도 같은 파일 안에서 서로 모순되는 서술이 남는다.
  - 제안: S6 범위를 이 절까지 확장하거나, 별도 S7 로 추가해 "UNIQUE 범위" 절의 전제 문장을
    정정할 것.

- **[INFO]** S5 가 같은 파일의 인접 행을 놓쳤다 — target 문서 자기-완결성(스코프 인접)
  - target 위치: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` §S5
  - 관련 plan: 해당 없음 — 위와 같은 이유로 참고용.
  - 상세: S5 는 `spec/5-system/3-error-handling.md` 에서 `(workspace_id, endpoint_path) UNIQUE`
    문자열이 나오는 한 곳(line 234, "발행 조건" 문장)만 교체 대상으로 적었다. 같은 파일의
    에러 코드 카탈로그 행(line 238) `TRIGGER_ENDPOINT_PATH_CONFLICT` 설명 — "**동일
    워크스페이스에** 같은 `endpointPath` 를 쓰는 트리거가 이미 존재" — 는 `(workspace_id,
    endpoint_path) UNIQUE` 문자열을 쓰지 않아 S5 의 문자열 치환 대상에서 빠진다. 전역 UNIQUE
    적용 뒤에는 다른 워크스페이스의 트리거와도 충돌하므로 "동일 워크스페이스에" 라는 설명이
    거짓이 된다.
  - 제안: S5 에 이 카탈로그 행 문구("동일 워크스페이스에" → "전역으로")도 명시 추가.

## 요약

target 이 다루는 트래커 항목(`spec-draft-nullable-notation-followups.md` «웹훅 트리거 조회가
`endpoint_path` 인덱스 전체를 훑는다»)은 원문 대조 결과 draft 의 인용·정정이 정확하고, 트래커가
명시적으로 열어 둔 두 선택지 중 하나를 사용자 결정과 반증(재현)으로 뒷받침해 닫았다 — 미해결
결정을 우회한 흔적은 없다. `plan/in-progress/**` 전체를 훑어도 이 변경이 가정을 깨뜨리거나
후속 조치를 요구하는 다른 진행 중 plan 항목, 마이그레이션 번호·인덱스명 충돌은 발견되지
않았다. 다만 조사 중 target 문서 자신이 명시한 S5·S6 변경 목록이 같은 파일 안의 인접 서술
(`3-error-handling.md` 카탈로그 행, `data-flow/10-triggers.md` 별도 절)을 놓쳐 적용 후에도
"워크스페이스 단위" 라는 옛 전제가 그대로 남는 지점 둘을 확인했다 — 엄밀히는 plan-coherence
관점(다른 plan 과의 충돌)보다 spec 자기-완결성에 가까워 INFO 로만 남긴다.

## 위험도

LOW

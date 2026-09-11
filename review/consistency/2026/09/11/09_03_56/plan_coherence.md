# Plan 정합성 검토 — `spec-draft-chat-channel-conventions.md`

## 발견사항

- **[WARNING]** D-4/D1 변경안이 `details[].code` "없음" 서술의 실제 발생 자리(3곳) 중 1곳만 겨눈다
  - target 위치: `## 결정` D-4, `## 변경안` D1 행 — `15-chat-channel.md §5.4.1` 3축 표에서
    `details[].code` 칸을 계약값(`INVALID_FIELD`)으로 바꾸고 배선 대기 각주를 붙인다는 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커, 오늘
    `plan/complete/spec-draft-chat-channel-drift-3.md` 가 방금 착지시킨 "details.field 세 축"
    audit). 이 audit 이 이미 `code` "없음" 서술의 정확한 위치를 확정해 두었다.
  - 상세: `spec/5-system/15-chat-channel.md` 를 직접 열어 실측하면(스크립트 조회, 캐시된
    스냅샷 아님) 동일한 "서비스 가드 갈래는 `details` 가 단일 object 이고 `code` **없음**"
    서술이 **세 곳**에 있다 — (1) §5.4.1 표 "토큰 변경(rotation)" 행, (2) §5.4.1.1 표
    "회전(rotation)" 행(문구가 거의 축자적으로 동일), (3) §5.4.1.2 마지막 문단
    "`details[].code` 는 두 항목 모두 **서비스 가드 갈래**라 싣지 않는다(**위 §5.4.1 의
    두-갈래 서술 참조**)". 세 번째는 §5.4.1 을 명시적으로 인용해 자신의 근거로 삼고 있다.
    target 의 D1 이 §5.4.1 셀만 "계약값 `INVALID_FIELD`(배선 대기)" 로 바꾸고 §5.4.1.1·
    §5.4.1.2 를 그대로 두면, 같은 문서 안에서 세 줄 아래 §5.4.1.1 이 여전히 "코드 없음"
    (계약 언급 없이)이라 말하고, §5.4.1.2 는 방금 뒤집힌 §5.4.1 문장을 근거로 "그래서 안
    싣는다"는 낡은 인용을 남기게 된다 — target 자신이 (a) 절에서 지적한 "형태는 shape
    예시로 읽히지 필수라 말하지 않는다" 류의 새로운 오독이 이번엔 target 스스로의 변경이
    만드는 것이다.
  - 제안: target 변경안에 §5.4.1.1 "회전(rotation)" 행과 §5.4.1.2 마지막 문단을 동반 갱신
    항목으로 명시하거나(가장 안전), 최소한 "이 턴에 하지 않는 것" 절에 §5.4.1.1·§5.4.1.2 는
    별도 후속이라고 명문으로 유예할 것. 침묵은 둘 중 어느 쪽도 아니라서 위험하다.

- **[INFO]** 체크리스트의 "트래커: `:2130`·`:2235`" 항목이 파일명을 적지 않는다
  - target 위치: `## 체크리스트` 4번째 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (실측으로 역추적
    확인 — 현재 그 파일의 두 지점에 "`chat-channel-adapter.md §1.1` 의 `setupChannel`
    '멱등 = yes' … 각주가 필요하다" 항목이 문자 그대로 중복 등재돼 있고, 위치가 정확히
    `:2130`·`:2235` 부근이다. `swagger.md §1` Update 접두 결정 항목·`details[].code` 규약
    항목도 같은 파일에 있어 target 의 "세 건" 서술과 일치한다)
  - 상세: 파일명을 밝히지 않고 줄 번호만 적었다. 이 파일은 2026-09-04 시작 이후 지금까지
    계속 자라는 P2 트래커(현재 2,600줄대)이고, 오늘도 여러 건이 새로 등재됐다 —
    "내가 편집하는 파일을 줄 번호로 인용하지 마라" 는 이 저장소가 반복 학습한 패턴과 같은
    위험군이다. 지금은 우연히 맞아떨어지지만, 이 target 문서가 `plan/complete/` 로 이동한
    뒤 다른 세션이 체크박스만 보고 실행하면 어느 파일의 몇 번째 줄인지 다시 역추적해야 한다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라는 파일명과, 가능하면
    중복 항목의 인용문(*"setupChannel '멱등 = yes' … 각주가 필요하다"*)을 줄 번호 대신/함께
    적을 것.

## 요약

target 문서는 `#1314`/`#1315`(`plan/complete/spec-draft-chat-channel-drift-3.md`)가 오늘 오전
남긴 "planner 몫 세 건"(details.code 규약·Update 접두 범위·setupChannel 멱등 각주)을 정확히
겨누고 있고, 세 결정 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미
등재된 미해결 항목·중복 항목과 내용상 일치한다 — 사용자 결정을 우회하거나 선행 plan의 미해결
전제를 무시하는 지점은 없었다. 다만 D-4 가 손대는 `details[].code` "없음" 서술이 같은 spec
문서 안에 세 곳(§5.4.1·§5.4.1.1·§5.4.1.2, 그중 하나는 §5.4.1 을 직접 인용) 있다는 것을
직전 플랜(오늘 아침 착지)의 실측이 이미 밝혀 두었는데, target 의 변경안(D1)은 그중 한 곳만
지목한다 — 좁게 고치면 target 자신이 반복 지적하는 "shape 예시를 필수 규칙으로 오독" 류의
새 drift 를 세 줄 옆에 만든다. 체크리스트의 트래커 참조도 파일명 없이 줄 번호만 적어
추적성이 약하다. 두 건 다 실행 전에 target 자체를 한 문장씩 보강하면 해소되는 수준이라
치명도는 낮다.

## 위험도

LOW

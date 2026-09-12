# Plan 정합성 검토 — `spec-draft-chat-channel-doc-batch.md`

## 발견사항

### [WARNING] "트래커 항목 종결" 체크리스트가 대상 tracker 를 특정하지 않는다 — `spec-draft-nullable-notation-followups.md` 의 완료 게이트가 걸려 있다

- **target 위치**: `plan/in-progress/spec-draft-chat-channel-doc-batch.md` `## 체크리스트` 마지막 줄
  `- [ ] 트래커 항목 종결 + draft plan/complete/ 이동`
- **관련 plan**: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속 (이 draft 범위 밖 — 등재만)` 섹션의 8개 항목 + `## 종결 조건`
- **상세**:
  target 은 "왜 한 턴인가" 에서 "`#1324`·`#1326` 이 남긴 **planner 축 잔여가 7건**" 이라고 적지만,
  그 7건이 **정확히 어느 문서의 어느 항목인지 target 본문 어디에도 이름이 없다.** 직접 대조하니
  `spec-draft-nullable-notation-followups.md` 의 `## 후속` 섹션에 **2026-09-12 등재** 태그로
  이미 `- [ ]` 상태로 등록돼 있고, target 의 항목 1·3·4·5·6·7·8 과 문구·제안·인용 세션까지
  거의 그대로 일치한다(둘 다 같은 `review/consistency/2026/09/12/{12_05_58,12_22_24,12_54_15,18_08_30}`
  세션을 근거로 든다):

  | target 항목 | tracker 대응 항목 (내용으로 인용 — 줄 번호는 드리프트하므로 참고용) |
  |---|---|
  | 1. `15-chat-channel.md` code glob | "`15-chat-channel.md` 의 `code:` glob 이 `dto/responses/` 를 못 잡는다" (tracker ~L3097) |
  | 2 (후반부 — §7 서술 부정확) | "`15-chat-channel.md §7` 파일 트리가 `chat-channel-input-rules.ts` 를 '입력' 으로만 적는다" (tracker ~L2973) |
  | 3. `swagger.md §5-1` | "`swagger.md §5-1` 에 'DTO 클래스명은 저장소 전체에서 유일하다' 규칙이 없다" (tracker ~L3061) |
  | 4. `chat-channel-adapter.md §1.1.2` 4번째 뜻 | "CCA §1.1.2 다의성 표에 Node 시스템 `.code` 행을 추가한다" (tracker ~L2955) |
  | 5. `slack.md §3.1` 5값 확정 | "`slack.md §3.1` 의 개방형 열거를 확정 5값으로" (tracker ~L2948) |
  | 6. `2-api-convention.md §7` rate-limit 행 | "`2-api-convention.md §7` rate-limit 표에 chat-channel per-chat 행이 없다" (tracker ~L2962) |
  | 7. `3-error-handling.md §1.12` 카탈로그 | "`3-error-handling.md §1` 중앙 카탈로그에 chat-channel rotate 에러 코드군이 없다" (tracker ~L2806) |
  | 8. §3.x 절 번호 중복 인용 규칙 | "`15-chat-channel.md` 가 '3.x' 절 번호를 두 계층에서 중복 사용한다" (tracker ~L2968) |
  | 9. R-CC-23 미래형 정정 | tracker 에 없음 — target 이 독자적으로 발견한 항목으로 보임 |

  즉 target 이 닫으려는 7건 중 실질적으로 7~8건이 **이미 다른 in-progress plan 의 열린 체크박스**다.
  더 중요한 것은 `spec-draft-nullable-notation-followups.md` `## 종결 조건` 이 스스로 이렇게 못박는다:

  > "**이 draft 자신의 종결 조건**은 위 `## 후속` 체크박스가 전부 닫히는 것이다."

  즉 target 이 spec 본문을 전부 고쳐도, tracker 쪽 체크박스를 갱신하지 않으면:
  (a) `spec-draft-nullable-notation-followups.md` 는 **실제로 끝난 항목을 계속 미완료로 표시**해
  다음 세션이 이미 끝난 조사를 반복하고, (b) 그 tracker 자신의 `plan/complete/` 이행이
  target 과 무관하게 계속 막힌다. 이 저장소는 정확히 같은 파일 쌍(`triggers.service.ts`
  chat-channel 계열)을 겨눈 선행 PR `#1319`·`#1320`·`#1324`·`#1326` 이 전부 "트래커 잔여 배치"
  라는 제목으로 커밋 메시지에 tracker 를 명시하고 그 안의 항목을 `[x]` + 해소 메모로 갱신해 온
  확립된 관행을 가지고 있다(`git show 9762fe53f` 등). target 의 마지막 체크리스트 줄은 그 관행을
  "트래커" 라는 한 단어로만 가리켜, 파일 경로·항목 목록이 없다 — 3,553줄짜리 tracker 안에서
  해당 8개 항목을 정확히 되찾지 못하면(그리고 이 저장소는 "이미 등재됨" 주장이 grep 없이는
  거짓이었던 사례를 스스로 여러 번 기록해 뒀다) 체크박스 동기화가 누락될 위험이 실질적이다.

- **제안**: target `## 체크리스트`의 "트래커 항목 종결" 줄을 구체화한다 —
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 경로로 명시하고, 위 표의
  tracker 쪽 8개 항목 제목을 그대로 인용해 "이 draft 완료 시 아래 항목을 `[x]` + 완료 메모
  (본 draft 또는 이동 후 `plan/complete/spec-draft-chat-channel-doc-batch.md` 를 근거로)로 갱신할 것"
  이라고 적는다. 항목 9(R-CC-23)는 tracker 에 없는 target 고유 발견이므로 그대로 두면 된다.
  줄 번호는 인용하지 말고 항목 **제목 문구**로 찾을 것(같은 세션 동안에도 위쪽 편집으로 줄이 이동한
  전례가 이 tracker 자체에 이미 여러 번 기록돼 있다).

## 요약

target spec draft 자체의 변경 내용(글롭 확장, swagger 규약 보강, 다의성 표 4번째 뜻, slack 5값 확정,
rate-limit 행, 에러 카탈로그, 절 번호 인용 규칙, R-CC-23 완료 주석)은 각각 실측에 근거가 있고
서로 충돌하는 미해결 결정을 우회하는 곳은 없었다. 다만 target 이 닫으려는 7~8개 항목은 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 섹션에 거의 동일한
문구로 등록돼 있고, 그 tracker 의 `plan/complete/` 이행 조건이 바로 그 체크박스 전체 완료다.
target 의 체크리스트는 "트래커 항목 종결" 이라는 한 줄로만 이를 인지하고 있어 실행이 누락될
위험이 있다 — 이 저장소가 반복적으로 겪어 온 "체크박스 두 곳 동기화 실패" 클래스와 정확히
같은 모양이다. 이 한 항목을 구체화하면 정합성 문제는 남지 않는다.

## 위험도

MEDIUM

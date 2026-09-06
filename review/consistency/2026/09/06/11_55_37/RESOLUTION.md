# RESOLUTION — `review/consistency/2026/09/06/11_55_37`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 3 · 위험도 LOW
**처분**: W3 수정 · W1·W2 는 4차 재확인된 planner 항목(권한 밖)

## WARNING 3 — 필드 JSDoc 에 내부 서사를 또 넣었다

`WorkspaceMemberDto.joinedAt` JSDoc 에 §5.4 적용 근거·실측 날짜·내부 서비스 동작을 담았다.
필드 JSDoc 은 `introspectComments` 로 **공개 OpenAPI description** 이 된다(`swagger.md §3`,
2026-09-05 성문화). **이 브랜치 계열이 세 번째로 같은 위반**을 했다.

**수정** — 공개 문장은 한 줄(*"멤버가 워크스페이스에 합류한 시각. 상시 존재하며, 값이
없으면 `null`."*)로 줄이고, §5.4 근거·실측·`WorkspaceInvitation` 구분은 `//` 로 내렸다.
checker 가 정본 예시로 든 `alert-rule-response.dto.ts` 의 `threshold` 와 같은 배치다.

### 고치면서 같은 형태 두 곳을 더 찾았다 — 등재만 한다

전수 grep(`review/code/2026\|review/consistency/2026` in `dto/responses/*.ts`)으로
**클래스 JSDoc** 두 곳에 리뷰 인용이 남아 있는 것을 확인했다:

| 파일 | 클래스 |
|---|---|
| `schedules/dto/responses/schedule-response.dto.ts` | `ScheduleTriggerWorkflowRefDto` |
| `triggers/dto/responses/trigger-response.dto.ts` | `TriggerWorkflowRefDto` |

**둘 다 #1291 이 넣었고 그 PR 의 게이트를 통과했다** — 그때도 이번에도 checker 가 "필드
JSDoc" 만 보고 클래스 쪽은 안 봤다.

**이 브랜치에서 고치지 않는다**: 두 파일 모두 이 diff 밖이라 손대면 scope 이탈이고,
`review-citations.md §4`(*"그 자리를 다음에 건드릴 때 함께 맞춘다"*)의 취지에도 맞지 않는다.
`plan` 에 등재하면서 **선행 질문**을 함께 적었다 — `review-citations.md §3` 표가
*"DTO·컨트롤러의 JSDoc"* 이라고만 적어 **필드/클래스를 안 가른다**. 그 문장부터 갈라야
같은 질문이 또 안 생기고, 그건 planner 몫이다.

## WARNING 1·2 — 4차 재확인, 코드 변경 없음

신규 검출 2축의 `code:` 미등재 · `User` 7컬럼 노출 금지 규범 부재. 둘 다 `spec/` 쓰기라
권한 밖이고 `plan` 에 등재돼 있다. checker 가 이번엔 **planner 인계 표**까지 채워 넣었는데,
내용은 등재문과 일치한다 — 새로 옮길 것이 없다.

## INFO — 조치 불요

fixture 배치 관례가 flat/서브디렉터리 두 갈래로 공존(신규 파일은 기존 선례를 따름) —
충돌 아님. 문서화는 별도 사안.

## 검증

lint PASS · unit PASS · build PASS · e2e PASS **299**.

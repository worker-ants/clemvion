# Plan 정합성 검토 — `spec/5-system/` (impl-prep)

## 발견사항

- **[WARNING]** `impl-details-code-wiring.md` 의 A/B/C/D(+후속 E) 전 범위가 이미
  `spec-draft-nullable-notation-followups.md` 의 5개 독립 체크박스와 1:1 대응하는데,
  target plan 은 그 대응을 "같은 트래커" 라는 한 문장과 체크리스트의 "트래커 항목 종결"
  한 줄로만 가리켜 **어느 파일의 어느 항목인지 명시하지 않는다.**
  - target 위치: `plan/in-progress/impl-details-code-wiring.md` §"왜 이 턴인가"
    ("같은 트래커에 남아 있던 chat-channel 코드 항목들을 닫는다") ·
    §체크리스트 "- [ ] 트래커 항목 종결"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (owner: planner, worktree: `plan-in-progress-items-b0c80b`, HEAD 커밋 `94e19be8d` =
    이 worktree 의 parent 커밋과 동일 — 병렬 세션이 아니라 같은 트리 위의 후속 작업)
    - L2237–2265 `- [ ]` "서비스 가드가 `details[].code` 를 안 싣는다" → target **A** 와
      완전 동일(같은 15곳 카운트: `triggers.service.ts` 13 · `password.util.ts` 2, 같은
      "6곳은 범위 밖" 판정)
    - L2219–2222 `- [ ]` "`botToken` 이 swagger 로 `minLength:1` 을 약속하는데 validator 가
      없다" → target **C** 와 동일 (처방 후보 중 `@MinLength(1)` 을 target 이 채택)
    - L2224–2229 `- [ ]` "DTO `@IsEmpty()` 메시지와 서비스 가드 메시지가 5필드 모두 리터럴
      복붙" → target **D** 와 동일 (5필드 목록·처방 모두 일치)
    - L2278–2286 `- [ ]` "`chat-channel-config.dto.ts` 의 `swagger.md:315` 줄-번호 인용이
      stale" → target **B** 와 동일
    - L2231–2235 `- [ ]` "chat-channel 도메인 규칙이 제네릭 `TriggersService` 에 계속 쌓인다"
      → target 이 **후속 PR 로 미룬 E** 와 동일 대상
  - 상세: 이 저장소는 "체크리스트 두 군데 동기화 누락"·"미룬 항목 5건을 잃을 뻔" 클래스의
    실패를 반복 기록해 온 곳이다 — PR 이 착지한 뒤 실제로 남는 산출물은 커밋된 코드와
    `impl-details-code-wiring.md` 자신의 체크박스뿐이고, `spec-draft-nullable-notation-followups.md`
    쪽 5개 체크박스는 **누군가 별도로 열어서 수동으로 플립**해야 하는데 target 문서 어디에도
    그 파일 경로·라인이 적혀 있지 않다. 두 plan 의 owner 도 다르다(developer 워크트리 vs
    planner 소유 트래커) — "완료했으니 당연히 상대가 닫겠지" 가 성립하지 않는 구도다.
    (A 항목은 실제로 tracker 쪽이 스스로 "✅ 2026-09-11 규약은 확정됐다... 남은 것 = 15곳
    배선(developer). ... 기존 자리는 **이 항목이 유일한 추적점**이다" 라고 명시해 두었다 —
    즉 트래커 자신도 "이 항목을 닫는 것은 이 배선 PR" 이라고 기대하고 있다.)
  - 제안: `impl-details-code-wiring.md` 의 계획/체크리스트에 "`spec-draft-nullable-notation-followups.md`
    L2237·L2219·L2224·L2278 을 각각 A/C/D/B 완료로 플립 + 근거 각주" 를 명시 항목으로 추가하고,
    E 는 별 PR 착지 시 L2231 을 플립하도록 그 PR 의 체크리스트에도 동일하게 못박는다. 현재의
    "트래커 항목 종결" 한 줄은 다음 세션(또는 다른 사람이 이어받을 경우)이 대상 파일을 못 찾고
    지나칠 위험이 있다.

- **[INFO]** 트래커 L2196–2199 는 "`chatChannel` 최초 부착 차단 → `details.field='chatChannel'`"
  · "provider 전환 차단 → `details.field='provider'`" 두 신규 검증 분기가 `§5.4.1` 표와
  `2-trigger-list.md` PATCH 에러 표에 **미등재**라고 지적한다. target A 가 `triggers.service.ts`
  13곳 전체에 `code: 'INVALID_FIELD'` 를 배선하면 이 두 분기도 포함될 가능성이 높다(같은
  객체 `{ field }` 형태). target 은 이 표 등재 여부를 범위에 넣지 않았는데, 코드 변경이
  선행되면 문서 갭이 더 눈에 띄게 되므로 이 항목도 위 트래커-동기화 각주에 함께 얹을 만하다.
  - target 위치: `impl-details-code-wiring.md` §A
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L2196–2199 (owner: developer, 미해결)
  - 제안: A 착지 후 이 두 분기가 실제로 `code` 를 받는지 확인하고, 받는다면 표 등재 항목의
    "미등재" 근거 문장이 이번 커밋으로 부분적으로 낡는지 짧게 각주.

## 요약

target(`impl-details-code-wiring.md`)이 결정하는 내용 자체(§5.3 `details[].code` 배선 규칙
적용, `botToken` `@MinLength(1)`, 메시지 상수화, 인용 절 참조화)는 `2-api-convention.md §5.3`
(2026-09-11 규약화, `#1316`)과 정확히 정합하고, 미해결 결정을 우회하거나 선행 조건이
빠진 곳은 없다(선행 PR `#1316` 은 이미 HEAD 에 병합돼 있다). 다만 이 plan 의 전 범위(A~E)가
`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 5개 독립 체크박스와 정확히
1:1 대응하면서도, 그 대응 관계를 파일·라인 단위로 명시하지 않아 착지 후 그 트래커가 이미
끝난 항목을 미완으로 계속 들고 있을 위험이 있다 — 이 저장소가 반복적으로 겪은 "체크리스트
동기화 누락" 클래스와 동일한 모양이다. CRITICAL 급 결정 충돌은 없다.

## 위험도

MEDIUM

# Plan 정합성 검토 — `spec-draft-chat-channel-drift-3.md`

## 발견사항

- **[WARNING]** 트래커 종결 항목이 소유 plan 파일명·라인으로 특정돼 있지 않다
  - target 위치: `## 체크리스트` — `트래커 3항목 종결 + 10번째 자리 실측 반영`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (worktree
    `plan-in-progress-items-b0c80b`, owner planner) 의 미해결 체크박스 3건 —
    - L2034 `§5.4.1 · §5.4.1.1 의 details.field 문면이 실제 페이로드와 다를 수 있다`
    - L2073 `assertChatChannelInputSafe 의 세 분기가 dead code 일 수 있다`
    - L2137 `spec 9곳이 SecretResolver.store() 라 적는데 실제 호출은 전부 rotate() 다`
      (embedded sub-note 로 신규 400 두 분기 "같은 턴에 병기할 것" 포함, L2164-2166)
  - 상세: 이 세 항목은 오늘(2026-09-11) 같은 `--impl-done`/`--spec` 세션 체인
    (`00_21_57`·`01_10_44` 등, target 문서의 "왜 이 턴인가" 절이 인용하는 것과 동일 세션 ID)
    에서 실측이 이미 끝났다고 표시돼 있고, target 문서의 D-1/D-2/D-3 이 그 실측 결과를
    그대로 spec 문면에 반영하는 후속 턴이다 — 내용 자체는 정합한다(코드 대조로 확인:
    `assertChatChannelAlreadySetUp`·`assertPatchCarriesNoSecrets`·
    `normalizeNotificationSecretRef` 가 실제로 target 의 서술과 일치). 다만 target 문서
    어디에도 `spec-draft-nullable-notation-followups.md` 라는 파일명이 등장하지 않는다.
    체크리스트가 "트래커 3항목" 이라고만 적어, 실행 시점에 어느 plan 의 어느 체크박스인지
    다시 찾아야 한다 — 이 저장소가 이미 "미룬 항목 5건을 잃을 뻔"·"다음 사람이 있지도
    않은 작업을 쫓는다" 류의 실패를 반복 학습한 클래스다. 파일이 132,397자로 커서
    (`## 진행 중 plan 문서 모음`의 절단 안내 참고) 재탐색 비용도 크다.
  - 추가로, 그 트래커의 L2159-2160 은 *"정정 대상은 chat-channel **9곳**뿐"* 이라고
    `secret-store.md:301` 을 명시적으로 스코프 밖에 두는데, target 의 D-3/C2 는 그 자리를
    **10번째로 실측 포함**한다(근거는 타당 — `normalizeNotificationSecretRef` 가 실제로
    `secrets.rotate(...)` 를 호출함을 코드로 확인). 이 자체는 잘못된 결정이 아니라 미실측
    항목을 실측으로 메운 정당한 확장이지만, 트래커의 그 문장은 target 반영 후 **거짓**이
    된다 — "9곳뿐" 을 남겨 두면 다음 사람이 반대 방향으로 오독한다.
  - 제안: target 의 체크리스트 항목을 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 정확한 라인(L2034·L2073·L2137)을 지목하도록 구체화하고, 완료 시 그 세 체크박스를
    `[x]` + "✅ 2026-09-11 해소 — spec-draft-chat-channel-drift-3.md 참조" 로 갱신할 것
    (이 트래커 문서 자신이 이미 여러 차례 쓴 관례). 동시에 L2159-2160 의 *"정정 대상은
    chat-channel 9곳뿐"* 문장을 10곳으로 정정하거나 취소선 처리할 것.

- **[INFO]** `details.field` 두 갈래의 "SoT" 질문이 문서화로 우회됐다 — 명시적 결론 문장 권장
  - target 위치: 변경안 A1/A2/B1/B2 (`details.field` 두 갈래 표기)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L2098-2104 —
    *"파이프 선언과 서비스 가드가 서로 다른 details.field 형식을 낸다는 사실 자체.
    어느 쪽을 SoT 로 할지는 아직 결정하지 않았다 — 그 결정은 spec 표기 정정과 같은
    planner 턴에서 함께 하는 것이 맞다."*
  - 상세: target 의 D-1 은 "두 갈래를 있는 그대로 문서화" 하는 방식으로 이 질문에
    답한다(구현 통일이 아니라 현실 인정). 실질적으로는 타당한 해소 방식이지만, 트래커가
    명시적으로 요구한 "어느 쪽을 SoT 로 할지" 라는 질문 형태에 대해 target 문서가
    "SoT 는 하나가 아니다(값 형태에 따라 갈린다)" 라는 결론을 명시적으로 적지는 않는다 —
    독자가 "아직 결정 안 됐다" 로 오독할 여지가 남는다.
  - 제안: `15-chat-channel.md` §5.4.1 또는 Rationale 정정 시 "SoT 는 단일하지 않다 — 검증
    계층(전역 파이프 vs 서비스 가드)에 따라 갈리며 이것이 확정 설계다" 라는 한 줄을 명시해
    트래커의 미해결 질문을 문면으로 닫아 둘 것.

## 요약

target 문서(`spec-draft-chat-channel-drift-3.md`)의 3개 결정(D-1 details.field 두 갈래,
D-2 신규 400 두 분기, D-3 store()→rotate() 10곳)은 모두 코드 실측(`assertChatChannelAlreadySetUp`
provider/chatChannel 400 분기, `normalizeNotificationSecretRef` 의 `rotate()` 호출, slack/discord
생성 경로 서비스 가드)과 대조해 정확했고, 어떤 in-progress plan 의 "결정 필요" 항목과도 정면
충돌하지 않았다. 다만 이 세 결정은 사실상 별도 worktree 소유의 대형 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 오늘 자로 등재된 미해결
체크박스 3건(L2034·L2073·L2137)을 그대로 이어받는 후속 턴인데, target 문서 자신은 그 트래커
파일명을 한 번도 인용하지 않는다. 체크리스트의 "트래커 3항목 종결"이 구체적 파일·라인 없이
남아 있어, 병합 후 그 트래커의 체크박스가 갱신되지 않고 stale 상태로 방치될 위험이 있다 —
이 저장소가 반복 학습한 실패 클래스(빠뜨린 plan 이동·잃어버린 후속 항목)와 같은 모양이다.
아울러 그 트래커가 "정정 대상은 chat-channel 9곳뿐"이라고 명시한 스코프 제한 문장은 target 의
10번째 자리 포함 결정으로 인해 반영 후 거짓 문장이 되므로 함께 정정돼야 한다. CRITICAL 급 결정
충돌이나 선행 조건 미해소는 발견되지 않았다.

## 위험도

LOW

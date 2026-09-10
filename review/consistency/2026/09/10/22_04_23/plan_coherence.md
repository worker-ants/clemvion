# Plan 정합성 검토 — `spec-draft-telegram-signing-carveout.md` (2R)

## 발견사항

- **[INFO]** 1R WARNING(D-2 처방 요약문 미반영)은 변경안 G 로 해소됐으나 실행 시 재발 형태를 한 번 더 좁혀 둘 필요
  - target 위치: `## 변경안` 표 G행("`plan/in-progress/spec-draft-nullable-notation-followups.md` … 체크박스가
    아니라 본문을 직접 고쳐 telegram 축을 박아 넣는다")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1894-1978`,
    `- [ ] CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다` 항목의
    D-1/D-2/D-3 요약문(`:1957-1959`)
  - 상세: `review/consistency/2026/09/10/21_53_42/plan_coherence.md` 의 WARNING("D-2 처방 요약문이
    provider 구분 없이 적혀 있어 문면대로 구현하면 이 턴이 막으려는 401 이 재발한다")을 target 이
    변경안 G 항목 신설로 인지·반영한 것은 확인된다 — 1R 대비 진전이다. 다만 G 의 실행 문구가
    "telegram 축을 박아 넣는다" 로만 돼 있어, 1R 리포트가 구체적으로 제시한 각주 형식·삽입 위치
    (`:1957-1959` 직후, 두 번째 CRITICAL 항목이 이미 쓴 "(2026-09-10 정정) … telegram 한정으로만
    참이었다" 관례와 동형)를 그대로 인용하지 않았다. 1R 리포트 자신이 지적했던 실패 모드가
    "체크박스만 닫고 본문 문구는 그대로 두는 최소 실행" 이었던 만큼, G 의 실행 시점에 같은 최소
    실행으로 다시 수렴할 여지가 남는다.
  - 제안: G 적용 시 1R 리포트가 제시한 각주 예시 문구(또는 그와 동형의 구체 텍스트)를 그대로 삽입할
    것 — 위치는 `:1957-1959`(D-1/D-2/D-3 요약문) 바로 아래. 실행 완료 여부는 "체크박스 종결" 이
    아니라 "본문에 telegram 예외 각주가 실재하는가" 로 판정할 것.

- **[INFO]** 변경안 E(§5.4.1 표 2행 캐비아트)가 자매 plan 의 미해소 질문을 앞지르지 않도록 문구 검토 필요
  - target 위치: `## 변경안` 표 E행
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2031-2038`,
    `- [ ] §5.4.1 표 2행(활성화 PATCH 가 setupChannel 재호출)이 구현과 어긋날 수 있다` 항목
    (아직 미완, "판정에 필요한 것: 활성화 시 provider webhook 재등록이 필요한지" 로 열려 있음)
  - 상세: target 은 이 불확실성을 "해소하지 않고 자매 행과 같은 형식의 캐비아트만 부여" 하겠다고
    명시했고, 이는 followups 항목이 요구하는 실측(e2e 확인) 없이 결론을 앞지르지 않는 올바른
    처리 방향이다(1R 도 같은 판정, `21_53_42/plan_coherence.md` "그 외 확인한 항목" 참고). 다만
    실제 캐비아트 문구가 아직 확정되지 않은 상태라, 적용 시 "재호출 여부가 확정되지 않았다" 는
    중립적 서술을 유지해야지 D-2/D-A 의 telegram 결정을 이 행에도 암묵적으로 확장하는 방향으로
    쓰면 followups 의 미해소 질문(스펙 문장 결함 vs 구현 결함)을 target 이 선점하게 된다.
  - 제안: E 적용 시 "이 행의 시나리오가 현재 구현에서 실제로 발생하는지는 별도 후속에서 확인 중
    (`spec-draft-nullable-notation-followups.md`)" 형태의 forward-link 캐비아트로 한정할 것 — D-B
    의 판별 기준(사용자 입력 vs server-issued)을 이 행에 직접 적용해 결론을 내리지 않는다.

## 그 외 확인한 항목 (결함 아님 — 정합 확인)

- **미러 커버리지 완결성**: 어제 커밋(`df1962e25`)이 이식한 세 spec 파일(`15-chat-channel.md`,
  `2-trigger-list.md`, `data-flow/14-chat-channel.md`) 모두 변경안 A/B/C/D/E(전자)·F(2번째)·C(3번째)
  로 커버됨을 재확인 — 1R 이 지적한 "미러 3/4" 갭(2-trigger-list.md 누락)이 F 항목 신설로
  해소됐다.
- **선행 plan 해소 확인**: R-CC-21 결정(PR #1311, `df1962e25`)이 `plan/complete/
  spec-draft-chat-channel-patch-token.md` 로 이미 이관·적용됐고, 그 문서의 D-2 관측 계약
  ("PATCH 전후 두 비밀 동일")이 telegram 예외 없이 적힌 것도 실측 확인됨 — target 이 고치려는
  전제가 실재한다.
- **v2 결정 미선점 확인**: `15-chat-channel.md §5.4.1.1` 이 유예 중인 "v2 회전" 결정을 이 target
  이 건드리지 않음을 D-C 와 "기각한 대안" 표 2행이 명시적으로 밝히고 있고, 다른 in-progress plan
  에도 이 v2 결정을 다루는 미해결 항목이 없어(전수 grep) 충돌 없음.
- **다른 chat-channel 계열 plan 과 충돌 없음**: `chat-channel-discord-gateway.md`,
  `chat-channel-slack-socket-mode.md` 는 telegram/inboundSigning/R-CC-21/chatChannel/setupChannel
  키워드 매치가 0건(전수 grep 재확인), `chat-channel-visual-ssr-png.md` 는 렌더링 축이라 무관.
  `spec-draft-eia-notification-payload-contract.md`·`spec-sync-external-interaction-api-gaps.md`
  의 `chatChannel` 언급은 라우팅 컨텍스트 마스킹 축이라 이 target 의 secret-rotation 축과
  직교한다.
- **채번 충돌 없음**: `R-CC-21` 을 이 target 외에 점유하려는 in-progress 항목 없음(1R 재확인,
  이번 라운드도 grep 으로 재검증).

## 요약

1R(`21_53_42`)이 지목한 plan_coherence WARNING(자매 plan `spec-draft-nullable-notation-followups.md`
의 D-2 처방 요약문에 telegram 예외가 반영되지 않아 developer 가 문면 그대로 구현하면 401 이
재발할 위험)은 이번 2R 초안에서 변경안 **G** 항목 신설로 인지·반영됐다. 미러 커버리지도 이전
라운드가 지적한 3/4 갭(2-trigger-list.md)이 변경안 **F** 로 메워져 어제 커밋이 이식한 세 spec
파일 전부를 이번 변경안이 다시 커버한다. v2 회전 결정 등 다른 in-progress plan 의 미해결 결정과
충돌하지 않고, `chat-channel-*` 계열 자매 plan 과의 교차도 없다. 남은 것은 실행 단계의 구체성
문제뿐이다 — G 의 실행 문구가 "본문을 직접 고친다" 는 방향만 정하고 1R 이 제시한 구체 각주
텍스트·삽입 위치를 그대로 담지 않아 "체크박스만 닫는" 이전 실패 모드로 되돌아갈 여지가 남아
있고, E 의 캐비아트도 아직 문구가 확정되지 않아 followups 의 미해소 질문을 앞지를 위험이
이론상 남는다. 둘 다 실행(적용) 단계에서 좁혀지면 해소되는 INFO 수준이며, CRITICAL/WARNING 급
결정 충돌이나 후속 항목 누락은 발견되지 않았다.

## 위험도

LOW

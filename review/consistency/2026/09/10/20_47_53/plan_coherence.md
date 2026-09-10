# Plan 정합성 검토 — 3라운드 (확인 전용)

대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md`
검증 범위: 2라운드(`20_29_00`) `plan_coherence` WARNING 의 반영 여부(5문항, 좁게)

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 은 없다. 지시받은 5개 확인 항목을 아래에 기록한다.

- **[INFO]** 확인 1 — 여섯 체크박스 실재 + 형식 정합
  - target 위치: `spec-draft-chat-channel-patch-token.md` §「등재 완료 — 트래커의 실제 체크박스」 표(6행)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: `git diff HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md` 로 실측. 여섯 항목이
    전부 `- [ ]` 체크박스로 신규 삽입돼 있고, owner·`2026-09-10 등재`·근거 출처(`--spec` 세션ID +
    checker 이름 + 등급)를 갖췄다 — 같은 파일의 기존 항목들(예: `트리거 비밀 스트립을 deny-list…`,
    `Ref DTO JSDoc…`)과 동일한 관례 형식이다. target 표(§「등재 완료」 6행)의 owner 열과 tracker 의
    실제 owner 태그를 1:1 대조했고 전부 일치한다: ① planner ② developer ③ planner + 조사
    ④ developer + 보안(판단) ⑤ developer ⑥ harness. 옛 처방("PATCH 전용 DTO 변형") 문자열이
    tracker 안에 다른 자리에서 살아있는 활성 처방으로 재등장하는지도 grep 했는데, 유일한 잔존은
    그 처방이 위험했다고 **경고하는 인용문 안**(1건, 1949번째 줄 부근)뿐이다 — 스테일 사본 없음.
  - 제안: 없음. 처분 완료로 본다.

- **[INFO]** 확인 2 — 두 CRITICAL 처방문 갱신 + "D-1 만 구현하면 파괴" 위험 문서화
  - target 위치: `spec-draft-nullable-notation-followups.md` 의 두 CRITICAL 항목
    (`CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다`,
    `버그: ChatChannelCard 편집-저장이 항상 400 이다`)
  - 관련 plan: 동일 파일, 본문 직접 수정분(새 체크박스 아님 — diff 로 확인)
  - 상세: 첫 CRITICAL 항목은 "developer 수정 대기" 라벨을 유지한 채, 본문에
    "**처방은 `spec-draft-chat-channel-patch-token.md` 의 D-1·D-2·D-3 을 따른다**" +
    "**종전에 이 자리에 적혀 있던 처방(\"PATCH 전용 `ChatChannelConfigDto` 변형(`botToken` 제외)\")만
    구현하면 저장된 봇 토큰이 파괴된다**" 문장을 명시적으로 넣었다. 파괴 메커니즘(무조건
    `setupChatChannel` → 무조건 `secrets.rotate` → `SecretResolver.rotate` 빈 값 가드 없음)까지
    이어서 서술하므로, 이 항목만 읽고 착수하는 developer 가 D-1 단독 구현(필드 제외)으로 그치는
    경로를 문서 수준에서 막는다. 요약 문단이 D-1/D-2/D-3 세 결정을 각각 한 줄로 재진술해 실수
    여지를 좁혔다. 두 번째 CRITICAL 항목에는 "(2026-09-10 정정)" 문단이 추가돼 *"프런트
    무수정 통과"* 가 telegram 한정으로만 참이었음과 "이 항목은 **구현 전까지 열려 있다** —
    spec 변경만으로는 닫히지 않는다" 를 명시했다.
  - 제안: 없음. 위험은 문서 수준에서 닫혔다(구현 자체는 여전히 developer 턴 — 그것은 이 항목의
    본래 미완 상태이지 정합성 결함이 아니다).

- **[INFO]** 확인 3 — 두 CRITICAL 체크박스가 `- [ ]` 미완 상태로 유지
  - target 위치: 위와 동일한 두 항목의 라인 헤드
  - 상세: `grep -n '^- \[ \]\|^- \[x\]'` 로 두 항목 모두 `- [ ]` 임을 확인. diff 상 이번 라운드가
    건드린 것은 본문 서술뿐이고 체크박스 마커는 변경되지 않았다 — spec 변경(A~H 적용)만으로는
    CRITICAL 이 요구하는 실제 구현(DTO 분리·`setupChatChannel` 분기)이 끝난 것이 아니므로 미완
    상태 유지가 맞다.
  - 제안: 없음.

- **[INFO]** 확인 4 — draft 가 `plan/complete/` 로 이동될 때 유실될 항목
  - target 위치: `plan/in-progress/spec-draft-chat-channel-patch-token.md` 전체
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` + `spec/5-system/15-chat-channel.md`
    (R-CC-21) + `spec/2-navigation/2-trigger-list.md` + `spec/data-flow/14-chat-channel.md`
  - 상세: target 문서의 실질 내용(변경안 A~H, D-1/D-2/D-3, 기각한 대안, 재검토 신호)은 이미
    세 spec 파일에 `git diff` 로 확인되는 실제 편집으로 옮겨져 있고(§5.4.1 표·정당화 문단·
    §5.4.1.1 표·`2-trigger-list.md §3`·`data-flow/14-chat-channel.md §1.3`·신설 `R-CC-21`·
    R-CC-10 전방 포인터·frontmatter `pending_plans` 정리, 8건 전부), 여섯 후속 항목과 두
    CRITICAL 의 갱신된 처방은 `spec-draft-nullable-notation-followups.md` 에 이미 중복
    등재됐다. target 문서를 다른 살아있는 문서가 마크다운 링크로 인용하는 자리는 0건
    (`spec/**`·`plan/**` 전체 grep — 세 곳이 파일명을 인라인 코드로 언급할 뿐 하이퍼링크는
    없어 이동 시 깨질 링크가 없다). target 자신의 frontmatter `spec_impact` 3건도 실제
    편집분과 정확히 일치한다. 남는 것은 이 draft 고유의 "개정 이력"·"2라운드 — 처분이
    거짓이었다" 절인데, 이는 이번 검토 과정의 시점 기록이라 `complete/` 로 옮겨 보존하는
    것이 정상이고(§3 "인입 참조" 규칙 대상 아님 — outgoing 링크가 없다), 다른 곳에 미리
    복제해 둘 실행 항목이 아니다. 결론: 지금 시점에서 이동 시 유실될 실행 정보는 없다.
  - 제안: 없음. 다만 실제로 `complete/` 로 옮기는 커밋에서는 `plan-lifecycle.md §5` 체크리스트
    (frontmatter `status` 를 종료값으로, commit 메시지 형식)를 그대로 따르면 된다 — 이는
    일반 절차이지 이번 라운드가 새로 발견한 갭은 아니다.

- 확인 5 — 이미 처분된 것 재지적 여부: 1라운드(`20_13_39`)·2라운드(`20_29_00`) 이 잡은 항목
  (Rationale 번호 충돌, 형제 필드 방향 오판, `details.field` 증거 과장, §5.4.1 표 2행 인용,
  R-CC-10 단방향 인용, "등재했다" 거짓 처분)은 이번 라운드에서 전부 해소 상태로 재확인됐고
  별도 항목으로 재기재하지 않았다.

## 요약

지시받은 5개 확인 항목 모두 실측으로 충족을 확인했다 — 여섯 후속 항목은 트래커 관례 형식을
갖춘 실제 체크박스로 존재하고, 두 CRITICAL 항목의 처방문은 "D-1 단독 구현 시 봇 토큰 파괴"
위험을 본문에 명시해 닫았으며, 두 체크박스는 여전히 미완(`- [ ]`)으로 남아 구현 착수 전임을
정확히 반영한다. target draft 의 실질 내용은 이미 세 spec 파일 편집과 tracker 중복 등재로
분산 보존돼 있어 향후 `plan/complete/` 이동 시 유실 위험도 없다. 이번 라운드에서 새로
지적할 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도
NONE

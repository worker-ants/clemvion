# Cross-Spec 일관성 검토 — `spec-draft-telegram-signing-carveout.md`

## 발견사항

- **[CRITICAL]** 변경안이 `R-CC-10` 안의 네 번째 미러 자리를 놓쳤다 — 원인이 된 커밋(`df1962e25`)
  자신이 그 자리를 별도 항목("F")으로 편집했었다
  - target 위치: target 문서 `## 변경안` 표 (A~G) 전체, 그리고 `## 1R 에서 잡힌 것` 절
    ("전수 열거로 대조했다")
  - 충돌 대상: `spec/5-system/15-chat-channel.md:614` — `### R-CC-10. Bot Token 변경
    single-path` 문단의 `*(2026-09-10 확장 — …)*` 괄호 삽입문
  - 상세: 실측(`git show df1962e25 --name-only` + `git show df1962e25 -- spec/5-system/15-chat-channel.md`
    의 hunk 목록, `git blame -L 612,615`)으로 확인한 사실 —
    어제 그 커밋은 스스로의 커밋 메시지 `## 변경 (A~H)` 절에서 `15-chat-channel.md` 안의 변경을
    **A(표 두 필드 차단) · B(기준=값 변경 명시) · C(§5.4.1.1 회전 행 정합화) · E(신설 R-CC-21)
    · F(R-CC-10 전방 포인터) · H(dangling pending_plans 제거)** 여섯 자리로 스스로 나눠 적었다.
    그중 **F, 즉 R-CC-10 문단 안의 전방 포인터 문장**이 지금 라인 614 의 그 괄호 문구이고,
    본문은 이렇게 적혀 있다 — *"차단 대상이 `botTokenRef` 뿐 아니라 값 필드 `botToken` 까지
    포함하고, `chatChannel` 이 실린 PATCH 는 저장된 비밀을 **아예 쓰지 않는다**."*
    이 문장은 "자세한 내용은 R-CC-21 참조" 로 끝나지 않고, **그 자체로 결론("아예 쓰지 않는다")을
    한 번 더 요약 진술**한다. target 문서의 항목 B 는 `R-CC-21` 절 본문("어떤 비밀도 받지 않고,
    어떤 비밀도 쓰지 않는다")만 두 축 한정으로 좁히는데, R-CC-10 의 이 요약문은 **B 의 편집
    대상이 아니다** — 좁혀지지 않은 채 그대로 남는다. 결과: 2R 이 반영된 뒤에도 `spec/5-system/15-chat-channel.md`
    안에 *"chatChannel 이 실린 PATCH 는 저장된 비밀을 아예 쓰지 않는다"* 는 문장이 **여전히
    남아**, 몇 줄 아래 새로 쓰일 §5.4.1.1 telegram 행("`setupChannel()` 재호출마다 재발급·재저장된다")과
    같은 파일 안에서 정면으로 모순된다. `grep -n "아예 쓰지 않는다"` 를 돌리는 다음 사람은 R-CC-10
    을 근거로 삼아 telegram carve-out 을 다시 되돌릴 위험이 있다.
  - 이 miss 는 target 문서가 스스로 진단한 재발 패턴("내가 편집한 문서를 내가 검토할 때 한 칸
    좁아진다")의 **네 번째 사례**다 — 단 이번엔 "파일 4개 중 3개만 셌다"(1R 의 결함, 이미 F 항목으로
    고쳐짐)가 아니라, **같은 파일 안의 hunk 6개 중 1개를 놓친** 더 미세한 층위에서 재발했다.
    대조 단위를 "파일" 로 잡았기 때문에 파일 내부의 두 번째 blanket-claim 자리를 못 봤다 — target
    문서의 "1R 에서 잡힌 것" 절이 이미 df1962e25 커밋 메시지의 `A/B/C/E/F/H` 여섯 글자를 인용해
    놓고도, 자신의 변경안 A~G 를 그 여섯 글자와 1:1 대조하지 않았다.
  - 제안: 변경안에 항목 **H'** (또는 B 의 스코프를 명시적으로 확장) 를 추가해 `R-CC-10` 문단의
    괄호 요약문도 함께 좁힌다 — 예: *"chatChannel 이 실린 PATCH 는 **bot token 값**을 쓰지
    않는다(telegram 의 inboundSigning 축은 예외 — [§5.4.1.1](#5411-inboundsigning-patch-정책-slack--discord-한정--v1-차단)
    /  [R-CC-21](#r-cc-21-patch-는-비밀을-쓰지-않는다--차단이-필드명-층에만-걸려-있었다) 참조)."*
    이 편집을 놓치면 2R 도 같은 자리에서 다시 BLOCK 될 가능성이 높다.

- **[INFO]** `conventions/chat-channel-adapter.md §1.1` 의 `setupChannel` 멱등성 표기가
  telegram carve-out 도입 후 오독 여지가 생긴다
  - target 위치: target 문서는 이 파일을 변경 대상으로 삼지 않음 (참고용 미러 후보)
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md:127` — `setupChannel | … | 외부 API
    호출 1회 이상 | **yes — 같은 config 재호출 OK**`
  - 상세: 이 "yes(멱등)" 는 "레지스트리 재등록이 안전하다"(같은 `triggerId` overwrite, 중복
    엔트리 없음)는 뜻이지 "재호출해도 반환값·시크릿 값이 그대로다"라는 뜻이 아니다. telegram
    은 이번 carve-out 결정(D-A)에 따라 매 `setupChannel` 호출마다 **다른** `issuedInboundSigning`
    을 발급·저장한다. "멱등 = yes" 라는 한 단어만 보고 "값도 불변" 이라고 잘못 일반화할 위험이
    이번 turn 으로 조금 더 커졌다 — carve-out 이 §5.4.1.1 에 명문화되면 "멱등이지만 매번 다른
    시크릿을 발급" 이라는 조합이 문서 두 곳에 흩어져 헷갈리기 쉽다.
  - 제안: 이번 턴 범위는 아니지만, §5.4.1.1 편집(A) 완료 후 이 표 셀에 각주로 "멱등성은
    레지스트리 등록 안전성을 의미하며 시크릿 값의 불변을 의미하지 않는다(telegram 은 매 호출
    새 값 발급 — [Chat Channel §5.4.1.1])" 정도의 1줄 cross-link 을 후속 트래커에 등재 권장.

- **[INFO]** `plan/complete/spec-draft-chat-channel-patch-token.md` 에도 동일 blanket 문구가
  원문 그대로 남는다 — 수정 대상 아님을 확인
  - target 위치: target 문서는 이 파일을 변경 대상으로 삼지 않음
  - 충돌 대상: `plan/complete/spec-draft-chat-channel-patch-token.md:102-105`
    (`### D-2. PATCH 경로는 비밀을 쓰지 않는다 … 그 요청 전후로 두 비밀은 동일하다.`)
  - 상세: 이 파일은 `plan/complete/` 로 봉인된 과거 결정 기록이라 프로젝트 관례상 소급 수정
    대상이 아니다(spec 이 SoT, plan 은 그 시점의 판단 기록). target 문서의 D-C 도 "R-CC-21 을
    번복하지 않고 좁힌다" 는 입장이라 이 archive 파일을 건드리지 않는 것은 관례와 정합적이다.
    다만 향후 누군가 이 archive 를 grep 해 "D-2 는 무조건 참" 이라고 재인용할 여지가 있다는
    점만 기록.
  - 제안: 조치 불요(관례 확인용 기록).

## 요약

target 문서가 지목한 세 파일(15-chat-channel.md / 2-trigger-list.md / data-flow/14-chat-channel.md)
자체의 범위 설정과 telegram vs slack/discord 자원-성격 구분(D-A/D-B/D-C)은 기존 §4.1 데이터
모델, `conventions/chat-channel-adapter.md §2.3`, `conventions/secret-store.md §5.5`, 어댑터·서비스
코드(telegram.adapter.ts:73, triggers.service.ts:948-993)와 모두 정합적으로 실측 검증됐고,
CCH-AD-02 forward-link(D)·§5.4.1 활성화 행 캐비아트(E)·nullable-notation-followups 트래커
동기화(G) 도 각각의 근거를 찾을 수 있었다. 그러나 원인 커밋 `df1962e25` 의 자체 변경 로그
(`## 변경 (A~H)`)를 hunk 단위로 대조한 결과, `15-chat-channel.md` 안의 **R-CC-10 rationale
문단(라인 614, 원 커밋의 "F" 항목)에 있는 동일 blanket 요약문이 이번 변경안 A~G 어디에도
편집 대상으로 잡혀 있지 않다** — target 문서가 스스로 지적한 "미러 3/4" 재발 패턴이 이번엔
파일이 아니라 같은 파일 안의 hunk 층위에서 다시 나타난 사례다. 이 한 곳을 제외하면 나머지
cross-spec 표면(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)에서 추가 충돌은
발견되지 않았다.

## 위험도

HIGH

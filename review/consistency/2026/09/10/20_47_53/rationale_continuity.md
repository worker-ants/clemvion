# Rationale 연속성 검토 — 3라운드 (확인 전용)

검토 대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md`. 이번 라운드는 2라운드
(`20_29_00`)에서 이 checker 자신이 낸 CRITICAL(「등재했다」는 처분이 거짓 — 후속 5건이 실제로는
draft 안의 평문 목록뿐이고 살아 있는 트래커에 0건) 이후 실제로 무엇이 바뀌었는지를 좁게 검증한다.

## 검증 결과

### 1. 등재가 실제로 됐는가 — **예, 확인됨**

`plan/in-progress/spec-draft-nullable-notation-followups.md` 를 직접 열어 여섯 항목을 모두
찾았다(중복 등재 없음, `grep -c` 로 확인):

| # | 라인 | 항목 | owner |
|---|---|---|---|
| 1 | 2010 | `details.field` 문면이 실제 페이로드와 다를 수 있다 | planner |
| 2 | 2023 | `assertChatChannelInputSafe` 세 분기가 dead code 일 수 있다 | developer |
| 3 | 2031 | §5.4.1 표 2행(활성화 PATCH 재호출)이 구현과 어긋날 수 있다 | planner + 조사 |
| 4 | 2040 | `SecretResolver.rotate` 빈 값 가드 없음 | developer + 보안 판단 |
| 5 | 2047 | 생성/수정 검증 함수 분리 필요 | developer |
| 6 | 2055 | docs 가드가 dangling `pending_plans` 를 안 잡는다 | harness |

전부 `- [ ]` 미체크 체크박스이고, 트래커 관례 형식(owner · `2026-09-10 등재` · 근거 라운드/checker
출처)을 지킨다. draft 의 「등재 완료」 표(§)와 항목 순서·owner·요지가 1:1로 일치한다. 2라운드가
지적한 결함(「절 제목만 바꾸고 선언만 함」)의 반대 증거 — 실제 체크박스가 물리적으로 존재한다.

두 CRITICAL 항목(`chatChannel PATCH bot token 우회`, `ChatChannelCard 400`)의 처방문도 **새
체크박스가 아니라 본문 직접 수정**으로 확인했다:

- 라인 1949~1962: 종전 처방(*"PATCH 전용 DTO 변형(`botToken` 제외)"*)이 그대로였다면 토큰이
  파괴됐을 것이라는 정정과 D-1/D-2/D-3 요약이 그 CRITICAL 항목 본문 안에 직접 들어가 있다(새
  항목 추가가 아님 — 옛 처방 문장을 대체).
- 라인 1999~2003: `(2026-09-10 정정)` 블록이 "`ChatChannelCard` 무수정 통과"가 **telegram
  한정으로만 참**이었다는 정정을 같은 CRITICAL 항목 본문에 인라인으로 추가했다(별 체크박스 아님).

2라운드 `plan_coherence` 가 요구한 "새 체크박스가 아니라 기존 두 CRITICAL 항목의 본문을 직접
갱신"이 문자 그대로 이행됐다.

### 2. 개정 이력·2라운드 절 서술이 원본 리포트와 일치하는가 — **일치**

1라운드(`20_13_39`) 원본 대조:
- 등급 분포 — `naming_collision`·`convention_compliance`·`cross_spec`·`rationale_continuity` 4개
  파일에서 `[CRITICAL]` 헤딩 확인, `plan_coherence.md` 는 CRITICAL 헤딩 없이 WARNING만 확인 →
  draft 의 "넷 CRITICAL + `plan_coherence` 는 WARNING" 서술과 정확히 일치.
- 근거 강도 — 1라운드 `cross_spec.md:51`の WARNING 이 *"그 이탈이 실제로 관측 가능한지 미검증"*
  이라는 유보 표현을 쓴다. draft 가 개정 이력 표 3행에 "가능성이 있다, 미검증"으로 낮춘 것은 원본
  표현과 일치 — 이전에 있던 "거꾸로였다" 단정은 실제로 과장이었고 지금은 정정돼 있다.

2라운드(`20_29_00`) 원본 대조:
- `rationale_continuity.md:9` 의 `[CRITICAL] 개정 이력 표 7행 "실제 등재" 처분이 거짓이다` —
  draft 의 「§`--spec` 2라운드」 절이 이 CRITICAL 을 그대로 인용하고 처분을 서술한다. 일치.
- `convention_compliance.md:101` "이번 라운드는 CRITICAL/WARNING이 없다" — draft 는 이 라운드를
  "1라운드 CRITICAL 은 해소됐다"고만 적어 과장 없음.
- `cross_spec.md:55` 의 WARNING(`data-flow/14-chat-channel.md` 미동기화)이 draft 의 변경안 G 로
  반영된 것과 서술이 일치.

과장·왜곡을 재발시키는 새 문장은 발견하지 못했다.

### 3. 실제 적용된 spec 편집이 D-1/D-2/D-3 와 일치하는가 — **일치, 신설 R-CC-21 은 R-CC-10 을
번복하지 않고 §5.4.1.1 v2 유예를 침범하지 않는다**

세 파일을 직접 열어 대조했다:

- `spec/5-system/15-chat-channel.md` §5.4.1 표 — 3행("토큰 변경 rotation")이 `botTokenRef`(ref)
  뿐 아니라 `config.chatChannel.botToken`(값)도 400 으로 명시(변경안 A), 4행("`chatChannel` 이
  실린 PATCH")이 신설돼 "secret store 에 저장된 bot token 을 바꾸지 않는다"를 명시(D-2). 정당화
  문단("차단의 기준은 필드명이 아니라 토큰 값이 바뀌는가")이 §5.4.1.1 자원-성격 대조를 "바꾸지
  않는다"고 스스로 못박는다(변경안 B).
- §5.4.1.1 — "(2026-09-10 정합화)" 콜아웃이 *"문면을 바꾼 것이 아니라 그 규칙이 PATCH 전 구간에
  걸린다는 것을 명시했다"*고 적고, **"v2 회전 후보 결정(아래 불릿)은 손대지 않는다"**를 명문화.
  아래 v2 후보 (A)/(B)/(C) 불릿과 "별 spec 결정 사안" 서술은 그대로 보존돼 있다(변경안 C).
- `R-CC-10` — "*(2026-09-10 확장 — ... 상세: R-CC-21)*" 전방 포인터가 본문에 삽입돼 있다(변경안
  F). 본문의 core 결정("토큰 변경은 rotate 단일 경로")은 취소선·삭제 없이 그대로 남아 있다.
- `R-CC-21` (신설) — 첫 문장이 *"R-CC-10 은 ... 결정했다. 그 결정은 유효하고 이 항목이 번복하지
  않는다"*로 명시적으로 R-CC-10 을 보존한다고 선언하고, 실제로 "single-path" 결정을 재확인할 뿐
  대체하지 않는다. "재검토 신호" 절이 *"inboundSigning 회전이 v2 에서 정의되면 signing 축만 그
  결정으로 대체되고 bot token 축은 그대로 유효 — 두 축을 한 문장으로 묶어 함께 푸는 실수를 하지
  말 것"*이라고 적어, v2 유예를 침범하지 않는 경계를 스스로 명문화했다. 번호도 실측(`R-CC-14` 영구
  결번, 최댓값 20)에 근거해 `R-CC-21`을 채번 — `R-CC-17`(기존 `render_form` fallback) 재사용
  없음을 확인.
- `spec/2-navigation/2-trigger-list.md §3` — PATCH 본문 설명(라인 176)에 "`botTokenRef`(ref) 와
  `botToken`(plaintext) 둘 다 PATCH 로 변경 불가", "`chatChannel` 이 실린 PATCH 는 저장된 비밀을
  바꾸지 않는다", "`botTokenRef` 는 ... 소멸하지 않는다(trigger id 에서 재유도된다)"가 모두 반영돼
  D-1/D-2/D-3 세 결정과 1:1 대응한다(변경안 D).
- `spec/data-flow/14-chat-channel.md §1.3` — "최초 setup" 행이 "**생성 `POST /api/triggers` 한정**"
  으로 좁혀졌고, "`chatChannel` 이 실린 PATCH" 신규 행이 "secret store 에 쓰지 않는다"를 명시,
  R-CC-21 로 링크(변경안 G).
- frontmatter `pending_plans` — dangling 항목(`spec-sync-chat-channel-gaps.md`)이 제거됐고 나머지
  세 항목(`chat-channel-discord-gateway.md` 등)은 여전히 `plan/in-progress/` 에 실존함을 확인
  (변경안 H, `status: partial` 유지 타당).

변경안 A~H(F 포함 8건) 전부 실제 파일에서 확인했고, D-1/D-2/D-3 결정과 어긋나는 지점은 없다.

### 4. 재지적 여부

1·2라운드에서 이미 처분된 항목(`R-CC-17` 충돌, 등급 분포, 근거 과장, data-flow 미동기화, R-CC-10
전방 포인터 부재)은 전부 실측으로 해소가 확인돼 재지적하지 않는다.

## 발견사항

새로운 CRITICAL/WARNING 은 발견하지 못했다. 참고용 INFO 하나:

- **[INFO]** 「변경안」 목록의 항목 순서가 `A, B, C, D, E, G, H, F` 로 `F` 만 끝에 붙어 있다(1라운드
  지적 #5 로 사후 추가됐기 때문으로 보임). 실제 적용에는 영향 없음(8건 모두 적용 확인) — 다음에
  이 draft 를 `plan/complete/` 로 옮기기 전에 알파벳 순으로 재배열하면 가독성이 좋아진다는 정도의
  제안이며 병합을 막을 사안은 아니다.

## 요약

2라운드에서 지적한 「등재했다는 처분이 거짓」 CRITICAL 은 이번 라운드에서 실측으로 해소됐다 —
여섯 개 후속 항목이 실제 `- [ ]` 체크박스로 트래커에 물리적으로 존재하고, 두 CRITICAL 트래커
항목의 처방문도 새 항목이 아니라 본문 직접 수정으로 갱신됐다. draft 의 개정 이력·2라운드 절 서술은
1·2라운드 원본 리포트의 등급·표현 강도와 정확히 일치하며 추가 과장은 발견되지 않았다. 실제 적용된
spec 편집(A~H, 8건)은 `15-chat-channel.md`·`2-trigger-list.md`·`data-flow/14-chat-channel.md`
세 파일에서 모두 확인됐고, 신설 `R-CC-21` 은 첫 문장부터 "R-CC-10 을 번복하지 않는다"를 명시하며
§5.4.1.1 의 v2 회전 유예 불릿·서술을 그대로 보존한 채 "재검토 신호" 절로 두 축(bot token vs
signing)이 v2 시점에 따로 풀린다는 경계까지 명문화했다. Rationale 연속성 관점에서 이 draft 는
이번 라운드 검증 항목에서 결함을 남기지 않았다.

## 위험도

NONE

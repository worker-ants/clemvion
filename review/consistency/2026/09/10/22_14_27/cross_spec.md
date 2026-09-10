# Cross-Spec 일관성 검토 — telegram signing carve-out draft

대상: `plan/in-progress/spec-draft-telegram-signing-carveout.md` (--spec 3R)

## 조사 방법

프롬프트 번들이 `spec/5-system/15-chat-channel.md`(원 79,983자)와
`spec/data-flow/14-chat-channel.md`(원 17,974자) — 이 draft 의 두 주요 `spec_impact`
대상 — 를 포함해 **111개 파일의 본문을 예산 초과로 생략**했고, `spec/conventions/**`
(secret-store.md·chat-channel-adapter.md)는 후보 목록에도 오르지 않았다. 번들만으로는
판정이 불가능해 `Read`/`grep` 으로 해당 파일들을 저장소에서 직접 열어 대조했다
(아래 발견사항은 전부 실측).

## 발견사항

- **[INFO]** consistency 번들이 이 draft 의 정본 대상 파일 자체를 예산 초과로 떨어뜨렸다
  - target 위치: 프롬프트 조립 단계 (harness, target 문서 자체는 아님)
  - 충돌 대상: `spec/5-system/15-chat-channel.md`, `spec/data-flow/14-chat-channel.md`,
    `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md` 전부 번들에
    없음(뒤 둘은 "생략 목록"에도 없음 — 애초에 후보로 안 뽑힘)
  - 상세: 기존 메모(`feedback_consistency_spec_mode_budget`)가 지적한 "conventions 통째로 탈락"
    패턴이 이번엔 **target 이 직접 편집하는 정본 파일**에도 재발했다. 이 라운드는 직접 `Read`
    로 우회해 검증을 완료했지만, 우회하지 않았다면 이 checker 는 "없다" 를 "없음의 근거"로
    삼을 뻔했다(프롬프트 자체가 그러지 말라고 경고하고 있었다).
  - 제안: harness 쪽에서 `spec_impact` 로 명시된 파일은 우선순위를 최상위로 두고 예산에서
    보호하는 것을 검토. (본 리뷰 자체의 판정에는 영향 없음 — 직접 재조회로 보완함.)

- **[INFO]** 독립 재검증 — draft 가 찾은 5개 자리 외 추가 blanket 주장 없음 (확인 완료, 조치 불요)
  - target 위치: 체크리스트 "재발 기록" 절, 3R 대응 (`아예 쓰지 않는다|비밀을 쓰지 않는다|…` grep)
  - 충돌 대상: `spec/**` 전체
  - 상세: draft 의 grep 어휘 집합을 더 넓혀(`값이 요청 전후`·`token 은 그대로`·`값이 동일하다`
    등 추가) `spec/` 전체를 재검색했다. 결과는 draft 가 이미 열거한 정확히 같은 5 자리
    (`2-navigation/2-trigger-list.md:176`, `5-system/15-chat-channel.md:392`(§5.4.1.1 안,
    제목이 이미 slack/discord 로 스코프됨) · `:614` · `:734`/`:761`(R-CC-21),
    `data-flow/14-chat-channel.md:151`) 뿐이었다. `providers/slack.md`·`discord.md`·
    `14-external-interaction-api.md` 의 `PATCH` 언급은 전부 무관 문맥(Discord 자체 API·EIA
    interaction merge 등). `2-trigger-list.md:119`·`:337` (Chat Channel 필드 매트릭스의
    `inboundSigning` 행)은 이미 "telegram 은 server-issued 라 본 필드 미사용" 으로 정확히
    스코프돼 있어 손댈 필요 없다는 draft 의 주장도 확인됨. **3R 의 "전수 grep 전환"이 실제로
    수렴했다.**
  - 제안: 없음 (검증 완료 사실만 기록).

- **[INFO]** Change A 의 앵커 변경 파급 범위 — draft 의 열거(2곳)가 정확함, 추가 자리 없음
  - target 위치: 변경안 표 **A** 행 "④ 앵커가 바뀌므로 인용 2곳(`:380`·`:747`)을 동시 갱신"
  - 충돌 대상: `spec/5-system/15-chat-channel.md` 내부 자기참조
  - 상세: §5.4.1.1 제목을 바꾸면 자동 생성 앵커
    (`#5411-inboundsigning-patch-정책-slack--discord-한정--v1-차단`)가 깨진다. `spec/` 전체를
    이 앵커 문자열로 grep 한 결과 정확히 **파일 내부 2곳**(`:380`, `:747`)만 나왔고, 외부
    파일에서 이 앵커를 참조하는 곳은 없었다. draft 의 범위 산정이 정확하다 — 새 제목 확정 시
    이 두 링크의 앵커 문자열도 함께 갱신해야 한다는 점만 재확인해 둔다(정확한 새 앵커 슬러그는
    최종 제목이 정해진 뒤에나 계산 가능하므로 지금은 자리만 확인).
  - 제안: 없음 (draft 그대로 진행 가능).

- **[INFO]** telegram `inboundSigning` 재발급은 §4.1 감사 카탈로그의 "특권 시크릿 교체" 축 밖에
  있다 (draft 의 결정 영향 아님 — 기존 상태의 관찰)
  - target 위치: D-A/D-B 결정 (telegram 의 `issuedInboundSigning` 은 `setupChannel()` 재호출마다
    계속 갱신·저장)
  - 충돌 대상: `spec/5-system/1-auth.md` §4.1 "트리거 (시크릿·토큰)" 행 — *"계정 탈취 후의 조용한
    시크릿 교체를 `audit_log` 만으로 재구성할 수 있어야 한다"*
  - 상세: `trigger.notification_secret_rotated` / `chat_channel_bot_token_rotated` /
    `interaction_token_revoked` 세 액션은 전용 audit action 을 갖고 이 원칙의 적용 대상으로
    명시돼 있다. telegram 의 `inboundSigningRef` 는 (draft 의 D-A 채택 후에도) 어떤 chatChannel
    PATCH·활성화에서도 **전용 audit action 없이** `trigger.updated` 로만 남는다 — "이 시크릿이
    언제 바뀌었는가"는 audit_log 만으로 재구성 불가하다. 다만 이 값은 서버가 `randomBytes` 로
    자체 발급하는 값이라(공격자가 원하는 값으로 바꿔치기할 수 없음) 위 원칙이 방어하려는
    "공격자가 자기 자격증명으로 갈아끼우는" 시나리오와 성격이 다르고, 이 gap 은 draft 이전부터
    있던 상태이지 D-A 가 새로 만드는 것은 아니다 — CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 이 턴의 스코프는 아니지만, §4.1 카탈로그나 CCH-SE-03 근처에 "telegram inbound-signing
    재발급은 서버 자체 발급값이라 전용 audit action 대상에서 제외" 라는 한 줄 caveat 를 추가하면
    다음 리뷰어가 이 gap 을 "빠뜨린 액션"으로 재발견하는 것을 막을 수 있다 (트래커 등재 검토 권장,
    이번 턴 필수 아님).

- **[INFO]** D-C 서술의 미묘한 프레이밍 — "좁힌다"는 §5.4.1.1 표 자체에는 정확히 반대다
  - target 위치: "## 결정" D-C — *"두 정본 표가 이미 가진 스코프를 산문과 미러 문서에 맞춰 좁히는
    것이다."*
  - 충돌 대상: 변경안 **A** (§5.4.1.1 제목을 slack/discord 한정 → 3-provider 로 **확장**,
    telegram 행 **신설**)
  - 상세: 실측 결과 §5.4.1.1 표(제목 포함)는 지금 이미 slack/discord 로 정확히 스코프돼
    있고(`384행`), 그 표의 **본문 회전 행(`:392`)**과 이를 인용하는 산문(R-CC-21·미러 문서)이
    스코프를 벗어나 있었다. Change A 가 하는 일은 (i) 그 회전 행의 산문을 slack/discord 로
    "좁히고" 이면서 동시에 (ii) 섹션 제목·표 자체는 telegram 행을 받아들이도록 **넓힌다** —
    "표는 좁히고 산문만 넓힌다" 는 D-C 문장이 §5.4.1.1 한정으로는 방향이 섞여 있다. 실질
    변경안(A~H)의 내용 자체는 정확하므로 등급은 INFO — 결정문 산문의 정밀도 이슈.
  - 제안: D-C 문장에 "(§5.4.1.1 의 **섹션 스코프**는 telegram 을 받아들이도록 넓히고, 그 안의
    **회전 행 서술**은 slack/discord 로 좁힌다)" 정도의 괄호를 붙여 방향을 명확히 하면 향후
    reviewer 의 재해석 비용을 줄인다.

## 요약

target draft 가 인용하는 실측 3층(adapter 코드 `telegram.adapter.ts:73`, 호출부
`triggers.service.ts:987-993`, spec `providers/telegram.md:219`)과 draft 가 지목한 5개
blanket-statement 자리(`2-trigger-list.md:176`, `15-chat-channel.md:392/614/734·761`,
`data-flow/14-chat-channel.md:151`)를 프롬프트 번들이 아니라 저장소 원본에서 전부 독립
재검증했고, 모두 draft 의 서술과 정확히 일치했다. `spec/` 전체를 더 넓은 어휘로 재검색해도
draft 가 놓친 6번째 자리는 나오지 않았고, §5.4.1.1 제목 변경이 깨뜨릴 앵커 참조도 draft 가
지목한 2곳(`:380`·`:747`)이 전부였다. `providers/telegram.md`·`conventions/secret-store.md
§5.5`·`conventions/chat-channel-adapter.md §2.3`·데이터 모델 §4.1 은 이미 telegram 을
server-issued 축으로 정확히 분리해 두고 있어 draft 의 "넓어진 것은 다섯 자리뿐" 주장과
일치했다. CRITICAL/WARNING 급 cross-spec 모순은 발견되지 않았다 — 남은 항목은 harness 번들
예산(INFO, 이 draft 의 책임 밖)과 audit 카탈로그 caveat 부재(INFO, 이 draft 이전부터 있던
상태) 등 저강도 후속 메모뿐이다.

## 위험도

LOW

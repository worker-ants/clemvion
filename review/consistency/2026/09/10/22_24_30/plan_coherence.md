# Plan 정합성 검토 — spec-draft-telegram-signing-carveout.md (4R)

## 검토 범위와 방법

- Target: `plan/in-progress/spec-draft-telegram-signing-carveout.md` — 4R 재구성판(변경안 A1~A14 ·
  B1~B2 · C1~C2, 결정 D-A/D-B/D-B'/D-C)
- 대조: `plan/in-progress/**` 전체(프롬프트에 본문이 생략된 63개 파일 포함, 관련 키워드로
  전수 grep 후 개별 `Read`) + 선행 완료 plan `plan/complete/spec-draft-chat-channel-patch-token.md`
  (D-1/D-2/D-3 원문) + 그 plan 이 실제로 등재했다고 주장하는 후속 6건의 현재 상태
  (`plan/in-progress/spec-draft-nullable-notation-followups.md`)
- 직전 라운드(3R, `22_14_27`)가 낸 WARNING 1건이 이번 개정판에서 실제로 해소됐는지 재확인

## 3R WARNING 재확인 — 해소됨

3R 은 *"'이 턴에 하지 않는 것' 의 두 트래커 등재 예고(`details.field` 범위 확장 ·
`swagger.md` naming 제안)가 변경안·체크리스트에 구체 항목으로 없다"* 를 WARNING 으로 냈다
(같은 plan 계열의 직전 선행 plan 이 "등재한다고 선언만 하고 실제로 등재 안 함"을 두 번
반복한 것과 동일 클래스 결함이라는 근거였다).

이번 4R 개정판은 이를 반영했다 — **C1·C2** 가 신설되어 두 예고가 "자리 단위" 변경안 표의
정식 항목이 됐고, 체크리스트도 `변경안 A1~A14 · B1~B2 · C1~C2 적용` 으로 C1/C2 를 포함한다.
`details.field` 캡처는 "이 턴에 하지 않는 것" 절에 남아 있지만 그 문장 자체가 이제
*"범위를 5필드 전체로 넓혀 트래커에 반영"* 이라고 구체 대상(기존 `spec-draft-nullable-
notation-followups.md:2010` 항목의 범위 확장)을 가리키므로 3R 이 지적한 "선언뿐"과는
다르다. `swagger.md` naming 제안은 C2 ②로 흡수돼 대상 트래커(`spec-draft-nullable-notation-
followups.md`)가 명시됐다 — 3R 이 지적한 "대상 트래커 자체가 불명확" 문제가 없어졌다.

**직접 대조 확인**: `plan/in-progress/spec-draft-nullable-notation-followups.md:1957-1978`
(C1 이 지목하는 자리)을 직접 열어 D-1/D-2/D-3 요약 문단이 실재하고, D-2 가 여전히
*"PATCH 경로는 비밀을 쓰지 않는다(그 요청 전후로 두 비밀이 동일)"* 는 blanket 문구임을
확인했다 — C1 의 footnote 삽입 계획이 겨냥하는 결함이 실제로 그 자리에 있다. 같은 파일에
`멱등` · `Patch` 접두 명명 · `Update` DTO 승격에 대한 기존 등재가 없음도 확인해(grep 0건)
C2 ①·②가 신규 항목이지 중복 등재가 아님을 검증했다.

## 나머지 두 관점 — 발견 없음

**미해결 결정과의 충돌**: `plan/in-progress/**` 전체에서 `R-CC-21`·`R-CC-10`·`CCH-AD-02`·
`issuedInboundSigning`·`inboundSigningRef`·`secret_token` 을 grep 한 결과, target 자신과
`spec-draft-nullable-notation-followups.md` 외에는 이 표면을 다루는 in-progress plan 이 없다.
`spec-draft-nullable-notation-followups.md:2031`(§5.4.1 표 2행 "활성화 PATCH" 재호출 여부가
불확실하다는 open item, planner+조사 소유)은 target 의 **A2/A6** 가 "중립 forward-link
캐비아트"로만 처리하고 그 불확실성을 해결된 것처럼 단정하지 않아 충돌하지 않는다. 같은
파일의 나머지 open item(`SecretResolver.rotate` 빈 값 가드, 생성/수정 검증 함수 분리,
`assertChatChannelInputSafe` dead code 여부)은 모두 `botToken`/slack·discord
`inboundSigningPlaintext` 축이거나 텔레그램과 무관한 호출부 표면이라 telegram
server-issued `issuedInboundSigning` 축을 다루는 target 의 결정과 겹치지 않는다.
`chat-channel-discord-gateway.md`·`chat-channel-slack-socket-mode.md`·
`chat-channel-visual-ssr-png.md`·`spec-sync-auth-gaps.md`·`backend-lint-gate-broken-on-
main.md`·`spec-sync-external-interaction-api-gaps.md` 등 telegram/chat-channel/시크릿
키워드가 걸리는 나머지 plan 은 메시지 포맷(CCH-MP-0x)·rate-limit·Redis 키·감사 로그 등
축이 달라 target 의 PATCH-비밀 정책과 표면이 겹치지 않는다.

**선행 plan 미해소**: target 이 전제하는 `plan/complete/spec-draft-chat-channel-patch-token.md`
(D-1/D-2/D-3, PR #1311 전신)는 이미 `status: applied` 로 완료·이동돼 있고, target 이 인용하는
`15-chat-channel.md` 앵커(`:614` R-CC-10, `:734/750/761/767` R-CC-21, `:372-407` §5.4.1/
§5.4.1.1)가 그 완료 plan 의 변경안이 실제로 만든 문구와 일치함을 확인했다. developer 구현
턴(`.claude/worktrees/impl-chat-channel-patch-token-a17c4e`)이 착수 게이트에서 막힌 것이
바로 이 target 의 존재 이유이므로, "선행 조건 미해소"가 아니라 **target 자신이 그 미해소를
닫는 턴**이다. 그 구현 턴의 plan 파일(`impl-chat-channel-patch-token.md`)은 현재 이 worktree
에 존재하지 않아(다른 worktree/branch 전용, main 에 미병합) 그 문서 자체와의 정합은
검증 대상 밖이다 — target 의 체크리스트가 그 파일의 frontmatter 결함을 언급하는 것은 참고
메모일 뿐, 이 worktree 의 `plan/in-progress/**` 정합성 판정에는 영향을 주지 않는다.

**후속 항목 누락**: 위 C1/C2 재확인 외에, target 의 A1~A14/B1~B2 변경이 다른 plan 의 후속
항목을 무효화하는 사례는 발견되지 않았다.

## 발견사항

없음.

## 요약

3R 이 낸 유일한 WARNING(트래커 등재 예고의 미실체화)이 이번 4R 개정에서 C1·C2 신설로
해소됐음을 대상 트래커(`spec-draft-nullable-notation-followups.md`)를 직접 열어 확인했다.
`plan/in-progress/**` 전체를 대조해도 target 의 telegram carve-out 결정과 경합하는
"결정 필요" 항목이 다른 plan 에 없고, target 이 전제하는 선행 plan(`spec-draft-chat-channel-
patch-token.md`)은 이미 적용·완료돼 있으며, target 의 변경이 무효화하거나 새로 만들어야
할 후속 항목도 다른 in-progress plan 에서 찾지 못했다. Plan 정합성 관점에서 이 라운드는
BLOCK 사유가 없다.

## 위험도
NONE

# 신규 식별자 충돌 검토 — spec-draft-chat-channel-patch-token.md (2라운드)

## 발견사항

- **[INFO]** `R-CC-21` 재확인 — 완전히 비어 있고, `R-CC-14` 재사용 회피 판단도 유지된다
  - target 신규 식별자: `R-CC-21` (변경안 E — 신설 Rationale)
  - 기존 사용처: 없음. `grep -rn "R-CC-21" spec/ codebase/ plan/` 전수 실행 결과, 매치는 이번 draft 자신(`plan/in-progress/spec-draft-chat-channel-patch-token.md`)과 1라운드 리뷰 산출물(`review/consistency/2026/09/10/20_13_39/*`) 뿐이었다. `spec/5-system/15-chat-channel.md` 의 실제 `### R-CC-` 시퀀스는 `10, 11, 12, 13, 15, 16, 17, 18, 19, 20` 이고 최댓값은 20 — `21` 은 다음 미사용 번호가 맞다.
  - 상세: `14` 를 재사용하지 않는 판단도 `git log --all -S"R-CC-14" -- spec/5-system/15-chat-channel.md` 로 직접 재실측했다 — `f4640ff2d`(도입) → `841d6cfb8`(*"의사결정 과정·시간·review/plan 참조 제거"*, 의도적 철회)로, 1라운드 `convention_compliance` 의 인용과 정확히 일치한다. 이 저장소가 철회된 번호를 영구 결번으로 다루는 선례(과거 라운드 `2026/06/12` 계열 리뷰들도 동일 판단 반복)와도 부합해 `14` 를 건너뛰고 `21` 을 쓰는 것이 맞다. 동시에 진행 중인 다른 chat-channel 관련 in-progress plan(`chat-channel-visual-ssr-png.md`, `chat-channel-slack-socket-mode.md`, `chat-channel-discord-gateway.md`)도 확인했으나 `R-CC-2x` 를 선점하는 항목은 없다.
  - 제안: 없음 — 1라운드 정정(`R-CC-17`→`R-CC-21`)이 유효하며 이번 라운드에서 새로 깨진 것 없음.

- **[INFO]** `details.field` 값 미확정 처리는 1라운드 WARNING(`chatChannel.botToken` nested vs `botTokenRef` flat 형태 혼재)을 재발시키지 않는다
  - target 신규 식별자: 없음 — draft 는 `### D-1` 에서 "**`details.field` 형태는 이 턴에서 규정하지 않는다**" 라고 명시적으로 값 결정을 보류했다(변경안 A 도 표 서술에서 `botTokenRef`(ref)·`botToken`(값) 이라는 필드명만 언급할 뿐 `details.field=` 구체값을 새로 못박지 않는다).
  - 기존 사용처: 참고용 — `15-chat-channel.md:376`(`details.field='botTokenRef'`), `:390`(`details.field='inboundSigningPlaintext'`) 둘 다 flat 형태.
  - 상세: 1라운드에서 내가 낸 WARNING 은 draft 가 `details.field='chatChannel.botToken'` 이라는 **nested 값을 새로 명문화**하려 했던 것에 대한 지적이었다. 이번 draft 는 그 값 자체를 아예 규정하지 않기로 바꿨으므로(`e2e 실측 후속` 으로 이연), 새 `details.field` 문자열이 생성되지 않는다 — 즉 "새 식별자와 기존 식별자의 형태 불일치" 라는 문제 자체가 이 턴에서는 발생할 여지가 없어졌다. 재확인 결과 draft 전체에 `details.field=` 형태의 구체 값 신설은 더 이상 없다(`grep -n "details.field" plan/in-progress/spec-draft-chat-channel-patch-token.md` → 두 곳 모두 "규정하지 않는다"/"문면이 실제 페이로드와 다를 수 있다" 는 유보·후속 서술뿐).
  - 제안: 조치 불필요. 다만 후속(§5.4.1/§5.4.1.1 details.field 문면 e2e 정정)이 실제로 값을 확정할 때, 그 시점에 이 nested-vs-flat 비일관 판단을 다시 적용해야 한다는 것만 유의(이번 턴 대상 아님).

- **[INFO]** 변경안 C 는 새 식별자를 도입하지 않는다
  - target 신규 식별자: 없음
  - 기존 사용처: `inboundSigningPlaintext` 는 `15-chat-channel.md:390`, `2-trigger-list.md:167,224` 등에 이미 존재하는 필드명
  - 상세: 변경안 C(`§5.4.1.1 표 — inboundSigningPlaintext 도 PATCH 에서 차단`)는 기존 필드명 `inboundSigningPlaintext` 를 그대로 재사용해 표의 "PATCH 허용 여부" 값만 뒤집는 것이라, 신규 엔티티·필드·엔드포인트·이벤트명·ENV 키 어느 것도 새로 생기지 않는다. 변경안 A(`botTokenRef`+`botToken`도 기존 필드명 재사용), B(정당화 문단, 식별자 없음), D(trigger-list 문서 서술 보강, 식별자 없음), F(R-CC-10 전방 포인터 한 줄, `R-CC-21` 인용뿐)도 마찬가지로 이번 라운드에서 새로 검토할 식별자가 없다.
  - 제안: 없음.

## 요약

2라운드 초점 네 가지 모두 확인했다. `R-CC-21` 은 spec/plan/codebase 전수 검색 결과 실제로 비어 있고, `R-CC-14` 를 건너뛰는 판단도 `git log -S` 재실측으로 유지된다(도입 `f4640ff2d` → 의도적 철회 `841d6cfb8`). 1라운드 WARNING 이었던 `details.field='chatChannel.botToken'` nested-vs-flat 비일관은 draft 가 그 값 자체를 이번 턴에 규정하지 않기로 바꾸면서 문제의 전제(새 값 신설)가 사라져 재발하지 않는다. 변경안 C(및 A/B/D/F)는 전부 기존 필드명·기존 섹션·기존 Rationale 인용을 재사용할 뿐 새 코드·필드·엔드포인트·이벤트명을 도입하지 않는다. 신규 식별자 충돌 관점에서 이번 draft 는 깨끗하다.

## 위험도

NONE

# 문서화(Documentation) 리뷰

## 배경

이 diff 는 `sse-nodeoutput-allowlist` 작업의 최종 상태로, 이전 5라운드(`22_51_46`→`23_16_40`→
`23_56_18`→`00_16_59`→`00_26_17`)의 코드/consistency 리뷰가 이미 CHANGELOG 정정, JSDoc 정정,
spec §R17/§4.4 정정, plan 자기-반증형 소정정까지 반복적으로 검증·수정한 결과물이다. 아래는 그
누적 산출물을 신뢰하지 않고 실제 소스(`git diff origin/main...HEAD`, `Read`/`grep`)를 직접
열어 재검증한 결과다.

## 발견사항

- **[INFO]** plan frontmatter 주석에 대상 없는 섹션 참조 `(CLAUDE.md §)` — `§` 뒤에 절 번호/이름이
  비어 있다.
  - 위치: `plan/complete/sse-nodeoutput-allowlist.md` (frontmatter `spec_impact:` 블록의 주석,
    `# 자기-반증형 소정정 (CLAUDE.md §) — ...` 줄. `git show HEAD:plan/complete/sse-nodeoutput-allowlist.md`
    로 직접 확인 — 이 파일은 이번 PR 이 신설한 파일이라 사전 존재하던 결함이 아니다.)
  - 상세: `spec/**` 문서는 `§R17`처럼 자체 절 번호 체계를 갖지만, `CLAUDE.md` 는 그런 번호 체계를
    쓰지 않고 `###` 제목만 쓴다(예: `### 자기-반증형 소정정 — developer 가 spec 을 고칠 수 있는
    유일한 경우`). `spec/` 참조 스타일을 그대로 옮기다가 실제 절 식별자를 채우지 않은 편집
    잔재로 보인다. 기능에는 영향 없고(이 줄은 YAML 주석), 이 문서가 CLAUDE.md 의 어느 절을
    근거로 드는지 다음 독자가 즉시 찾기 어렵게 만드는 정도다.
  - 제안: `(CLAUDE.md § 자기-반증형 소정정)` 처럼 섹션 제목을 채우거나, CLAUDE.md 가 번호
    체계를 안 쓰므로 `§` 표기 자체를 빼고 `(CLAUDE.md "자기-반증형 소정정" 절)` 로 바꿀 것.

- **[INFO]** (기지정·의도적 defer 재확인) 신규 `nodeOutput` allowlist 캐너리 4~5건이
  `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` 블록 안에 위치해 블록명이 실제
  검증 대상(`nodeOutput`/`buttonConfig.nodeOutput` allowlist)과 어긋난다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 는 해당 없음;
    `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `describe(` 줄 604
    (`llmCalls strip — 외부 fanout 수신자 보호`) 내부에 762·803·848·882·931 줄의 `it`/`it.each`
    캐너리가 중첩돼 있음.
  - 상세: `review/code/2026/08/23/23_16_40/RESOLUTION.md` INFO 항목(#14·#12)이 이미 이 불일치를
    지적받고 *"이동은 `codebase/**` 변경이라 막 끝난 리뷰를 다시 stale 로 만드는데 순수 이동에
    리뷰 한 바퀴를 쓸 값어치가 없다"* 는 근거로 의식적으로 defer 했다. 새 지적은 아니고, 이번
    라운드 diff 에도 여전히 그 상태로 남아 있음을 직접 확인했다는 재확인이다.
  - 제안: 조치 불요(우선순위 낮음, 다음에 이 파일을 만질 때 `describe` 를 나누거나 이름을
    `llmCalls strip & nodeOutput allowlist — 외부 fanout 수신자 보호` 로 넓힐 것).

## 확인한 항목 (문제 없음 — 직접 재검증)

- **CHANGELOG.md**: `Unreleased` 항목의 *"SSE·fanout 은 여전히 deny-list(잔여)"* 원문이 취소선으로
  보존되고, `waiting_for_input` 표면만 닫혔다는 정정 블록(9→13키 실측, 외부 수신자 동작 변경 고지,
  잔여는 `envelope.output` 하나)이 정확하다. `spec/**`·`codebase/**`·`plan/**` 전체에서
  `잔여`/`SSE`/`fanout` 조합을 재-grep 했으나 미정정 상태로 남은 자리는 없었다(4라운드가
  겪은 "조사 한 글자로 스윕이 비켰다" 류의 잔존 문구도 재확인 결과 없음).
- **`node-output-allowlist.ts` 헤더 주석·JSDoc 표**: "소비처는 둘이다" 서술, 3그룹 표(핸들러
  계약/위젯 wire/chat-channel wire), `spec/5-system/15-chat-channel.md` §(c)
  `renderPresentationByType shape 처리 우선순위` 인용 — 해당 문서 703행에 실재함을 직접 확인.
  `00_26_17` 라운드가 잡은 *"§R17 이 정의한 「렌더에 필요한 키」"* 지어낸 인용은 이미 제거되고
  "§R17 이 정의한 키가 아니라 별개 carve-out" 으로 정확히 뒤집혀 있다(`grep -c` 로 해당 문구
  0건 재확인).
- **`websocket.service.ts` `allowlistFanoutNodeOutput`/`toFanoutEnvelope` JSDoc**: `waiting_for_input`
  표면 한정 서술, `envelope.output` 잔여 서술, 내부 WS 비영향 서술이 `interaction.service.ts`·
  `spec/5-system/14-external-interaction-api.md` §R17·`spec/5-system/6-websocket-protocol.md`
  §4.4·`spec/conventions/conversation-thread.md` §8.4 다섯 자리와 일관됨(3라운드 W3/W4, 4라운드
  W1 이 각각 잡은 미러 누락이 전부 반영된 상태를 직접 대조).
- **`plan/complete/sse-nodeoutput-allowlist.md`**: `spec_impact` 에 자기-반증형 소정정 대상
  (`spec/conventions/conversation-thread.md`) 이 포함돼 CLAUDE.md 게이트 요구(`--impl-done` 을
  그 파일이 포함되는 scope 로)와 부합. `conversation-thread.md` frontmatter `code:` 에
  `websocket.service.ts` 가 빠진 것은 이번 diff 가 고치지 않았지만, 그 대신
  `spec-sync-external-interaction-api-gaps.md` 에 planner 항목으로 명시적으로 등재해 두었다
  (범위 밖 defer 사유: frontmatter 메타데이터 추가는 자기-반증형 예외의 "내가 쓴 문장의 정정"
  범위가 아님) — CLAUDE.md 예외 규정을 정확히 좁게 해석한 것으로 판단.
- **신규 캐너리 테스트 JSDoc**(`websocket.service.spec.ts`, `node-output-allowlist.spec.ts`,
  `interaction.service.spec.ts`): 각 테스트가 "왜 필요한가"·"실측 근거"·"뮤테이션 번호"를
  본문에 명시해 테스트 자체가 문서 역할을 겸한다. `[캐너리]`/`[잔여]` 접두 규약도 일관됨.
- **README/설정 문서**: 이번 변경은 내부 보안 강화(fanout allowlist)이며 신규 공개 API·CLI
  플래그·환경변수를 추가하지 않는다 — README 갱신 불요 판단이 타당함을 재확인.

## 요약

5라운드에 걸친 선행 리뷰·자기-반증형 소정정이 CHANGELOG·JSDoc·spec 2편·convention 1편·plan
2편 사이의 서술을 반복적으로 맞춰 왔고, 이번 최종 상태를 독립적으로 재검증한 결과 그 정합성은
그대로 유지돼 있다(허위 인용·낡은 서술·미반영 미러를 재-grep 했으나 발견되지 않음). 새로 찾은
것은 `plan/complete/sse-nodeoutput-allowlist.md` frontmatter 의 주석 한 줄에 남은 대상 없는
`(CLAUDE.md §)` 참조뿐이며, 기능·게이트에 영향 없는 순수 가독성 결함이다. 그 외 한 건은 이미
알려져 의도적으로 defer 된 테스트 `describe` 블록명 불일치의 재확인이다. Critical/Warning 급
문서화 결함은 없다.

## 위험도
NONE

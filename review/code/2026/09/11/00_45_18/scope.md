# 변경 범위(Scope) 리뷰 — `impl-chat-channel-patch-token` (4라운드, `00_45_18`)

## 검토 방법

`origin/main`(`c0f2a885c`)`...HEAD`(`5976587c7`) 누적 diff(96개 파일, 6개 커밋)를 대상으로 했다.
이전 세 라운드(`review/code/2026/09/10/23_21_57/scope.md` · `23_55_23`(RESOLUTION 경유) ·
`00_21_55/scope.md`)가 이미 핵심 코드 6개 파일(DTO·서비스·컨트롤러·e2e)의 스코프를 상세 검증해
NONE/LOW 로 수렴했으므로, 이번 라운드는 (a) 그 결론이 최신 소스에서도 유지되는지 표본
재확인하고 (b) 직전 라운드 **이후** 실제로 추가된 델타(마지막 커밋 `5976587c7` — `00_21_55`
라운드 WARNING 3건 중 W1/W2 조치 + INFO#9 이중 공백 오타 수정)에 스코프 이탈이 있는지에
집중했다. `git log`/`git show <hash> -- <path>`로 커밋 단위 diff를 직접 열고 현재 소스를
`grep`/`Read`로 대조했다. 저장소 트리 뮤테이션 없음(`git status --short` 확인 — 세션이 만든
빈 리뷰 출력 디렉터리 2개만 untracked, 내가 쓴 것 없음).

## 델타(`5976587c7`) 재검증 — 전부 직전 WARNING/INFO 에 1:1 대응

- **W1 (slack/discord 유저가이드 미갱신)**: `discord.mdx`·`discord.en.mdx`·`slack.mdx`·
  `slack.en.mdx` 4파일에 telegram 문서의 "Bot Token 회전(single-path)" 절과 대칭되는 절을
  신설(각 15줄) — bot token은 rotate API 전용, signing 값(discord public key / slack signing
  secret)은 v1에서 PATCH로 변경 불가(삭제·재생성 안내), 카드 표시 옵션 저장은 무관이라는
  Callout. 새 기능이 아니라 기존 telegram 문서 패턴을 대칭 provider로 미러링한 것.
- **W2 (테스트 판별력 부족)**: `triggers.service.spec.ts:3151~3160` 단언을
  `{ code: 'VALIDATION_ERROR' }` → `{ code: 'VALIDATION_ERROR', details: { field: 'chatChannel' } }`
  로 좁혔다. `Read`로 직접 대조 — 8줄 변경(주석 3 + 단언 확장 5)뿐, 로직 변경 없음.
- **INFO#9 (이중 공백 오타)**: `triggers.mdx:429` `grep`으로 재확인 — `**항상 rotate API 만**`
  단일 공백으로 정정됨. 3라운드에서 자신이 넣은 오타를 4라운드 대응 커밋에서 즉시 고쳤다.
- **W3 (동시 PATCH lost update)**: 이번 커밋에서 미착수 — 커밋 메시지가 명시하듯 사전 존재
  설계(CCH-SE-01)로 `spec-draft-nullable-notation-followups.md`에 이미 등재·defer 확정된
  항목이라 의도적으로 범위 밖에 뒀다. 스코프 확장 유혹에 응하지 않은 사례.
- **`spec-draft-nullable-notation-followups.md`**: 두 곳의 "근거: `plan/complete/...`" 를
  `plan/{in-progress → complete}/...(마무리 커밋에서 이동)` 으로 정정(파일이 실제로는 아직
  `plan/in-progress/`에 있음을 `find` 로 확인 — 표현이 사실과 일치하도록 자기 정정) +
  `--impl-done`(`00_21_57`) W3 이 지적한 미등재 갭 1건(신규 검증 분기 2건이 §5.4.1 표 미반영)을
  트래커에 추가. 코드 변경이 아니라 plan 트래커 유지보수이며 developer 의 `plan/**` 쓰기 권한
  범위 안.

## 이전 라운드 확인 사항 — 최신 소스에서도 유지됨

- `triggers.service.ts` 의 `type ChatChannelInput`/`ChatChannelInputMode` 선언은 (1라운드
  scope 지적 → `771801fca` RESOLUTION #6 "수정") 실제로 전체 import 블록 **뒤**로 옮겨져 있음을
  `Read`로 재확인(50번째 줄대 `SLACK_SIGNING_SECRET_REGEX` import 이후, `export type
  TriggerDetail` 이전) — import 블록을 물리적으로 쪼개던 상태는 해소됨.
- 핵심 코드 6개 파일(DTO 신설·서비스 게이팅·컨트롤러 문서·e2e 캐너리 갱신)은 plan
  D-1/D-2/D-3 세 항목에 정확히 대응한다는 앞선 세 라운드의 결론 — 이번 라운드에서 뒤집을
  근거 없음.
- `package.json`/`tsconfig*`/`eslint.config.mjs` 등 설정 파일 변경 0건(`git diff
  c0f2a885c..HEAD --stat` 전체 96개 파일 재확인).
- `spec/**` 파일 변경 0건 — developer 가 spec 결함(§5.4.1 `details.field` 두 갈래·telegram
  carve-out 등)을 코드로 우회하지 않고 전부 plan 트래커의 planner 인계 항목으로만 남긴 경계가
  4라운드 누적 diff 전체에서 유지됨.
- `review/code/**`·`review/consistency/**` 산출물의 동반 커밋은 CLAUDE.md 저장소 관례
  ("코드/일관성 리뷰 산출물 → 지정 경로에 커밋")에 따른 것으로 스코프 위반이 아니다.

## 발견사항

없음 — 신규 스코프 이탈 없음. (이전 라운드가 이미 닫은 이중 공백 오타는 이번 델타에서
실제로 수정됨을 확인했을 뿐, 새 발견이 아니다.)

## 요약

이번 라운드가 대상으로 하는 신규 델타(`5976587c7`)는 직전 `00_21_55` 라운드 WARNING 3건 중
2건(W1 slack/discord 문서 공백, W2 테스트 판별력)과 INFO 1건(이중 공백 오타)에 정확히 1:1
대응하는 최소 수정이며, 새 기능·무관한 리팩토링·설정 변경·미사용 import 는 없다. 착수하지
않은 W3(동시 PATCH lost update)은 사전 존재 설계로 명시적으로 defer 됐고, 그 판단 자체가
스코프를 함부로 넓히지 않으려는 절제로 읽힌다. 앞선 세 스코프 리뷰 라운드의 결론(핵심 코드
6개 파일이 D-1/D-2/D-3에 좁게 대응)도 최신 소스에서 재확인돼 유지된다.

## 위험도

NONE

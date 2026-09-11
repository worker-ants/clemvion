# 문서화(Documentation) 리뷰 — `impl-chat-channel-binder` (3라운드, 커밋 `81d2a8c18`)

## 검증 방법 (요약)

이번 라운드의 diff 는 `origin/main`(`3796c7308`) 대비 누적 3커밋(`2ae81077c` → `6dc2b7d60` →
`81d2a8c18`, HEAD)이다. `git diff origin/main HEAD --stat -- codebase/ plan/ spec/` 로 확인한
실제 코드/문서 변경 파일은 5개뿐이다: `chat-channel-input-rules.spec.ts`(신규) ·
`chat-channel-input-rules.ts`(신규) · `triggers.service.ts`(수정) ·
`plan/in-progress/impl-chat-channel-binder.md`(신규) ·
`plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 등재). 프롬프트에 포함된
나머지 파일(`review/code/2026/09/11/{15_31_54,15_57_42}/**`)은 이전 두 라운드가 이미 낸 리뷰
산출물이 커밋에 편입된 것으로, 이번 라운드가 새로 검토할 코드 변경이 아니다.

이번 라운드(`81d2a8c18`)만의 실제 diff 를 `git show 81d2a8c18 --stat` 로 별도 확인했다 — 이전
라운드(`15_57_42`)가 낸 WARNING 1~3(테스트 커버리지 공백 2건 + plan 수치 불일치 1건)과 INFO 5
(JSDoc 미기재)를 해소하는 fix 커밋이다. `npx jest src/modules/triggers/chat-channel-input-rules.spec.ts`
를 직접 재실행해 19 passed(이전 라운드 12 → +7, 커밋 메시지의 "+7" 주장과 일치)를 확인했다.
모든 실측은 `git show`/`git diff <commit>`으로 **커밋된 상태**를 대상으로 했다.

## 작업트리 오염 관측 (내가 만든 것 아님 — 원복하지 않음)

리뷰 도중 `git status --short` 로 두 파일에 미커밋 변경이 있는 것을 관측했다 —
`codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` 의 `as never` 캐스트
제거 1줄, `chat-channel-input-rules.ts` 의 `translateSetupChannelError` 첫 줄
(`err instanceof Error ? err.message : String(err)` → `String(err)`)이었다. 몇 초 뒤 재확인하니
후자는 사라지고 전자만 남아 있었다 — 다른 reviewer 가 이 공유 워크트리에서 뮤테이션 검증을
진행 중인 것으로 보인다(호출 규약이 경고한 병렬 fan-out 오염 시나리오와 일치). 나는 이 변경을
만들지 않았고, 되돌리지도 않았다(다른 reviewer 의 진행 중 작업을 지울 수 있어서). 본 리포트의
모든 실측(줄 번호·JSDoc 인용·테스트 통과 수)은 committed 상태(`HEAD`)를 대상으로 했으므로 이
일시적 작업트리 변경의 영향을 받지 않았다. 이 리뷰가 끝나는 시점에도
`chat-channel-input-rules.spec.ts` 에 그 1줄짜리 변경이 남아 있을 수 있다 — 내가 남긴 것이
아니므로 다음에 이 파일을 보는 사람(다른 reviewer 또는 통합 SUMMARY)이 진짜 결함으로 오인하지
않도록 여기 기록한다.

## 이전 라운드 발견사항의 해소 여부 — 실측 확인

- **해소됨 (documentation CRITICAL, `15_31_54`)** — plan 의 철회된 "얇은 delegator" 처방이
  취소선 처리되고 실제 결정·drift 범위(2곳)가 서술되며, `spec-draft-nullable-notation-followups.md:2523-2534`
  에 durable 트래커 항목이 실재함을 재확인.
- **해소됨 (testing WARNING 1·2, `15_57_42`)** — `chat-channel-input-rules.spec.ts`에
  `assertPatchCarriesNoSecrets` 의 `inboundSigningPlaintext` 대칭 케이스, `assertInboundSigningPlaintextByProvider`
  의 slack/discord 교차 길이 케이스(`it.each`)가 추가됨을 diff 로 확인.
- **부분 해소 (documentation WARNING 3, `15_57_42`)** — 아래 발견사항 참조. 값을 정정하긴
  했으나 같은 커밋이 스스로 추가한 변화를 다시 반영하지 못해, 같은 결함 클래스가 더 작은
  규모로 재발했다.
- **해소됨 (documentation INFO 5, `15_57_42`)** — `chat-channel-input-rules.ts:299-304` 에
  discord verify_key 불일치가 502 로 떨어지는 "알려진 예외" 각주가 함수 JSDoc 본문에 직접
  추가됨을 확인(이전에는 테스트 파일에만 있었음).

## 발견사항

- **[WARNING]** plan 체크리스트의 테스트 통과 수치가, 그 수치를 **정정한 바로 이 커밋** 자신이
  추가한 변화를 반영하지 못해 다시 stale 하다 — 직전 라운드가 지적한 것과 같은 결함 클래스가
  같은 필드에서 재발
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:163`
    (`- [x] \`run-test.sh\` 4단계 GREEN (backend **9,580** — T1 이동 시점 9,568 + 신규 spec 12 · ...)`)
  - 상세: 이 줄은 `81d2a8c18` 자신이 `9,568` → `9,580`으로 고친 자리다(직전 라운드
    `15_57_42/documentation.md` WARNING 3 이 "9,568 이 같은 커밋이 추가한 12개를 반영 못한다"고
    지적했고, 그 제안("9,568 → 9,580")을 문자 그대로 적용한 것으로 보인다). 그런데 `81d2a8c18`
    은 그 정정과 **같은 커밋 안에서** `chat-channel-input-rules.spec.ts` 에 테스트를 **7개 더**
    추가한다 — `npx jest src/modules/triggers/chat-channel-input-rules.spec.ts` 재실행 결과
    19 passed(직전 라운드 12개 대비 +7), 커밋 메시지 자신의 "## 검증" 절도 "4단계 PASS — backend
    **9,587**(+7)"이라고 명시한다. 즉 이 커밋이 스스로 만든 최신 상태의 정확한 수치는 이미
    커밋 메시지 안에 있는데(`9,587`), 같은 커밋이 편집한 durable 문서(plan 체크리스트)에는 그
    값이 아니라 한 단계 전 값(`9,580`)이 실렸다. 커밋 메시지 W3 절이 스스로 "'거짓 주장을
    바로잡는' 커밋에서 같은 패턴이 재발했다"고 진단해 놓고, 그 정정 작업 자체가 다시 같은
    패턴(측정치를 반영할 시점보다 먼저 확정)을 한 단계 작게 반복한 형태다. 이 plan 은 아직
    `plan/complete/` 로 봉인되지 않았으므로 지금이 고치는 비용이 가장 낮다.
  - 제안: `9,580` → `9,587`(커밋 메시지가 이미 계산해 둔 값, 재실행 불필요)로 정정한다. 앞으로
    같은 커밋 안에서 plan 체크리스트에 수치를 적을 때는 **그 커밋의 diff 가 전부 확정된 뒤**
    마지막으로 채우는 순서를 권장한다(현재는 본문 초안 작성 중 수치를 적고 이후 테스트를
    더 추가하는 순서라 어긋난다).

## 확인해 통과로 판정한 항목 (참고용)

- 신규 테스트 케이스들의 인라인 주석(`W1`/`W2`/`INFO 1~4` 각주, `/ai-review review/code/2026/09/11/15_57_42` 인용)이 실제로 그 세션 디렉터리(`review/code/2026/09/11/15_57_42/`)에 존재하는 발견사항과 1:1로 대응함을 `SUMMARY.md`·`testing.md`와 대조해 확인했다 — 근거 없는 인용이 아니다.
- 신규로 추가된 slack/discord 교차 길이 테스트의 주석("길이가 판별자다 … 정규식 스왑을 잡는다")이 실제 코드 형태(`SLACK_SIGNING_SECRET_REGEX`=hex32, `DISCORD_PUBLIC_KEY_REGEX`=hex64)와 일치하며, 과장 없이 정확하다.
- `chat-channel-input-rules.ts`의 신규 JSDoc 각주("알려진 예외 — discord verify_key 불일치는 502로 떨어진다")가 캐너리 테스트(`chat-channel-input-rules.spec.ts` 마지막 `it`)·트래커(`spec-draft-nullable-notation-followups.md`) 양쪽을 정확한 상대 경로 없이도 식별 가능한 이름으로 인용해 서로 다른 세 자리(소스 JSDoc·테스트 docstring·트래커)가 같은 이야기를 하고 있음을 확인했다.
- README·API 문서·ENV/설정 문서·CHANGELOG — 이번 라운드도 순수 내부 리팩터 + 테스트 보강 + plan 갱신뿐이라 갱신 불필요(공개 API·환경변수·동작 변화 없음, 이전 두 라운드 전원의 결론과 일치. `CHANGELOG.md`는 이 저장소 관례대로 사용자 관측 가능한 동작/계약 변경만 기록한다).
- `spec_impact: none` 유지도 이번 라운드에서 `spec/**` 변경이 여전히 0줄임과 일치한다.

## 요약

이번 라운드(`81d2a8c18`)는 직전 라운드가 낸 테스트 커버리지 WARNING 2건과 JSDoc INFO 1건을
실제로 닫았고, 그 이전 라운드의 documentation CRITICAL(등재 주장 불일치)도 재확인 결과 여전히
해소된 상태다. 다만 직전 라운드가 낸 documentation WARNING("plan 체크리스트 수치가 같은 커밋의
최종 상태를 반영 못한다")을 고치는 과정에서, **같은 커밋이 그 직후 테스트를 7개 더 추가**했는데
체크리스트 값은 그 변화 이전 값(`9,580`)에 멈춰 있어 같은 결함 클래스가 한 단계 작은 규모로
재발했다. 커밋 메시지 본문에는 이미 정확한 최종값(`9,587`)이 적혀 있어 정정 비용은 사실상
문자열 치환 1회뿐이다. 그 외 코드 자체의 문서화 품질(JSDoc·인라인 주석·트래커 인용 정확성)은
이번 라운드에서도 견고하며, README/API 문서/CHANGELOG/설정 문서 갱신 불필요 판정도 그대로
유지된다. 리뷰 도중 다른 reviewer 로 추정되는 작업트리 뮤테이션(내가 만들지 않음, 원복하지
않음)을 관측해 위에 별도로 기록했다.

## 위험도

LOW

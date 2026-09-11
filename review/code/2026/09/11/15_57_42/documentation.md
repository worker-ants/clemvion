# 문서화(Documentation) 리뷰 — `impl-chat-channel-binder` (fix 라운드, 커밋 `6dc2b7d60`)

## 검토 범위 및 방법

이번 라운드의 diff(`origin/main..HEAD`, 커밋 `2ae81077c` + `6dc2b7d60`)는 이전 라운드
(`review/code/2026/09/11/15_31_54`)가 **CRITICAL 1**(plan 문서의 "처방"이 실제 구현과 반대인데
정정 안 됨 + "planner 항목 등재" 주장이 저장소 어디에도 없음)로 지적한 것을 고치는 fix 커밋을
포함한다. `git show 6dc2b7d60 --stat` / `git diff 2ae81077c..6dc2b7d60 -- plan/in-progress/impl-chat-channel-binder.md` 로 실제 변경분만 직접 대조했고, `chat-channel-input-rules.ts` ·
`triggers.service.ts` 는 이번 fix 커밋에서 변경되지 않음을 `git show 6dc2b7d60 --stat` 로 확인했다
(두 파일은 `2ae81077c`에서만 생성/수정됨 — 이전 라운드가 이미 검토).

저장소 트리는 건드리지 않았다(`Read`/`git diff`/`grep`만 사용). `git status --short` 원상태 확인 —
세션 산출 디렉터리(`review/code/2026/09/11/15_57_42/`)만 untracked, 잔여물 없음.

## 이전 CRITICAL 의 해소 여부 — 실측 확인

- **해소됨.** `plan/in-progress/impl-chat-channel-binder.md:93-98`(구 "얇은 delegator로 drift 0"
  처방)이 취소선 처리되고, 그 아래 "실제 결정" 절(:99-116)에 철회 사유·정정된 drift 범위(2곳)가
  적혔다.
- **해소됨.** `grep -rn "TriggersService.X.*귀속\|assertInboundSigningPlaintextByProvider" plan/in-progress/spec-draft-nullable-notation-followups.md`로 확인 — `spec-draft-nullable-notation-followups.md:2523-2534`에 "`slack.md`·`discord.md`의 `TriggersService.assertInboundSigningPlaintextByProvider` 귀속 표기가 부정확해졌다" 항목이 실제로 추가됐다. `slack.md:275`, `discord.md:297`을 직접 열어 재확인한 결과 두 곳 모두 여전히 `TriggersService.assertInboundSigningPlaintextByProvider`를 실명 인용하고 있어(이동 후 문법적으로 성립 불가) 이 트래커 항목이 가리키는 실제 drift와 정확히 일치한다.
- **해소됨.** 체크리스트(`:159-166`)가 이번 커밋에서 실제로 완료된 단계(`--impl-prep` BLOCK:NO,
  T1 이동, 뮤테이션 5/5 RED)를 체크 상태로 갱신했다.

## 발견사항 (신규 — 이번 fix 커밋이 만든 것)

- **[WARNING]** 같은 커밋 안에서 plan 체크리스트의 측정치가 커밋 메시지의 측정치와 어긋난다 —
  "9,568"은 이 커밋이 스스로 추가한 12개 테스트를 반영하지 못한 이전 수치다
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:163` (`- [x] \`run-test.sh\` 4단계 GREEN
    (backend 9,568 · e2e 305 + playwright 51 · ratchet 197/52)`)
  - 상세: 이 체크박스 행 자체가 `git diff 2ae81077c..6dc2b7d60`로 확인한 결과 **이번 fix 커밋에서
    새로 추가**됐다(직전 상태는 `- [ ] run-test.sh 4단계 GREEN`, 숫자 없음). 그런데 같은 커밋의
    본문은 "4단계 PASS — backend **9,580**(+12) · e2e supertest 305 + playwright 51 · ratchet
    baseline 일치(197/52)"라고 적어, `+12`(신규 `chat-channel-input-rules.spec.ts` 12케이스가
    바로 이 커밋에서 추가된 것)를 반영한 최종 수치를 쓴다. 체크리스트의 "9,568"은 그 12개가
    더해지기 **전** 숫자를 그대로 옮긴 것으로 보인다 — 즉 이 한 줄 안에서 "GREEN을 확인했다"는
    체크(`[x]`)와 그 증거로 인용한 수치가 같은 실행 결과를 가리키지 않는다. 이 프로젝트가 반복
    경험한 "실측했다는 문장이 실제로는 다른 시점/다른 수량을 가리킨다" 패턴과 같은 모양이며,
    하필 이 커밋 자체가 "직전 커밋의 거짓 주장을 바로잡는다"는 목적으로 쓰였다는 점에서 재발
    위험을 더 눈에 띄게 만든다.
  - 제안: `9,568` → `9,580`(또는 다음 세션이 재실행해 확정된 수치)으로 정정. 이 plan은
    `plan/complete/`로 이동하기 전이므로 지금 고치는 비용이 가장 낮다.

- **[INFO]** `translateSetupChannelError`의 JSDoc이 스스로의 가정이 최소 한 provider(discord)
  경로에서 거짓임을 캐너리 테스트로 증명해 놓고도, 그 사실이 함수 옆(소스 파일)에는 남지 않고
  테스트 파일에만 남는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:293-303`(docstring
    — "adapter 가 throw 하는 Error 의 message 에 status code 가 포함됨을 가정") /
    대조 지점: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:163-177`
    (같은 함수를 겨냥한 캐너리 테스트 docstring, "discord verify_key 불일치는 **지금은** 502로
    떨어진다")
  - 상세: 이번 커밋이 새로 추가한 캐너리 테스트는 `discord.adapter.ts:94`가 던지는
    `'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와 불일치'`(숫자 없음)가
    `translateSetupChannelError`의 판별식 `/\b(401|403)\b/`(:306)에 걸리지 않아 의도한 400이
    아니라 502로 떨어진다는 것을 실측·고정한다. 그런데 이 사실을 아는 유일한 자리는 신규
    `*.spec.ts` 파일의 테스트 docstring뿐이고, 정작 그 판별식을 담은 함수 자신의 JSDoc
    (:299-302 "adapter 가 throw 하는 Error 의 message 에 status code 가 포함됨을 가정 …")은
    이 알려진 반례를 언급하지 않은 채 "정확도가 낮을 경우 default 가 SETUP_FAILED 라
    fail-safe"라고만 적어, 마치 이 fallback이 이례적 상황에만 발동하는 것처럼 읽힌다. 테스트
    파일을 보지 않고 소스 파일(`chat-channel-input-rules.ts`)만 읽는 다음 사람은 이 가정이
    discord 경로에서 이미 깨져 있다는 것을 알 방법이 없다.
  - 제안: 함수 JSDoc에 한 줄 각주 추가 — 예: "알려진 예외: `discord.adapter.ts`의 verify_key
    불일치 메시지는 숫자를 포함하지 않아 이 판별식을 통과하지 못한다(캐너리:
    `chat-channel-input-rules.spec.ts`, 트래커:
    `plan/in-progress/spec-draft-nullable-notation-followups.md`)". 코드 변경 없이 문서만
    보강하는 것이므로 이번 PR의 "동작 보존" 제약과도 충돌하지 않는다.

## 확인해 통과로 판정한 항목 (참고용)

- `chat-channel-input-rules.spec.ts` 최상단 docstring의 사실 주장 — "이동 자체의 증거는
  `triggers.service.spec.ts`다(테스트 무편집 통과)" / "`translateSetupChannelError`는 이동 전
  테스트가 0건이었다" — 둘 다 `git diff 2ae81077c..HEAD -- '*.spec.ts'`(0건) 및 이전 라운드
  testing.md의 grep 실측과 일치한다.
- 신규 tracker 항목 3건(`spec-draft-nullable-notation-followups.md:2523-2561`)이 이전 라운드
  documentation/architecture/requirement reviewer가 지적한 CRITICAL·W3·W4 각각과 정확히
  1:1로 대응하며, 위치(`slack.md:275`/`discord.md:297`)·근거·처방 후보까지 구체적이다. "등재
  했다"는 주장이 이번에는 실제로 검증 가능하다.
- README·API 문서·ENV/설정 문서·CHANGELOG — 이번 fix 커밋은 순수 내부 리팩터 + 신규 테스트
  파일 + plan/tracker 갱신뿐이라 갱신 불필요(공개 API·설정·동작 변화 없음, 이전 라운드
  reviewer 전원의 결론과 일치).
- `spec_impact: none` 유지 — 이 PR이 `spec/**`을 한 줄도 건드리지 않는다는 사실과 일치하고,
  drift 추적 책임을 트래커로 명시적으로 넘긴 근거(`#1316` 선례 인용)도 타당하다.

## 요약

직전 라운드의 documentation CRITICAL(plan의 철회된 처방이 정정 안 됨 + "등재했다"는 거짓 주장)은
이번 fix 커밋에서 실질적으로 해소됐다 — 취소선 정정, 실제 트래커 등재(grep으로 재확인 가능),
체크리스트 갱신 모두 확인했다. 다만 그 정정 작업 자체가 새로운 작은 문서 결함을 하나 남겼다:
같은 커밋이 자신의 checklist에 적은 테스트 통과 수치(9,568)가 같은 커밋 메시지가 주장하는
최종 수치(9,580, +12)와 어긋난다 — "측정된 주장"을 다루는 커밋에서 재발했다는 점에서 사소하지만
눈에 띈다. 그 외에는 `translateSetupChannelError`의 알려진 결함(discord verify_key 502 오분류)이
테스트 파일에만 문서화되고 정작 그 함수의 JSDoc에는 남지 않아, 소스만 읽는 독자에게는 여전히
보이지 않는다는 INFO 수준 개선 여지가 있다. 두 항목 모두 병합을 막을 사유는 아니다.

## 위험도

LOW

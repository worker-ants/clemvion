# 문서화(Documentation) 리뷰 — `impl-chat-channel-binder` (T1 추출)

## 발견사항

- **[CRITICAL]** plan 문서의 "처방"(design decision) 이 실제 구현과 정반대인데 정정되지 않았고, 그 결과로 생긴 spec drift 의 완화책("planner 항목 등재")도 저장소 어디에도 존재하지 않는다
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:93`, `:96`, `:98` (§`--impl-prep` 이 설계를 바꿨다 → "### 처방 — 문서화된 진입점 2개는 **얇은 delegator** 로 남긴다")
  - 상세: plan 은 "`TriggersService.assertInboundSigningPlaintextByProvider` 는 **한 줄 위임 메서드로 남긴다**... **drift 가 0 이다**" 라고 명시적으로 선언한다. 그런데 이미 머지된 커밋 `2ae81077c`(`git show --stat` 로 확인, `HEAD` 가 바로 이 커밋)의 본문은 이 처방을 스스로 철회한다: *"내 처방은 '얇은 delegator 를 남겨 drift 0' 이었는데 그것이 틀렸다 — 그 함수의 호출부도 함께 옮겨져서 아무도 부르지 않는다 ... → 남기지 않았다."* 실제로 `grep -n "assertInboundSigningPlaintextByProvider\|assertPatchCarriesNoSecrets" codebase/backend/src/modules/triggers/triggers.service.ts` 는 **0건** — `TriggersService` 에 위임 메서드도 어떤 흔적도 없다. 그 결과 `spec/4-nodes/7-trigger/providers/slack.md:275` 와 `discord.md:297` 가 지금 이 순간 저장소에 커밋된 상태로 **`TriggersService.assertInboundSigningPlaintextByProvider` 라는, 이제 존재하지 않는 클래스 메서드**를 실명 인용하고 있다(두 파일 모두 직접 `grep` 으로 재확인). 커밋 메시지는 이 drift 를 "**planner 항목으로 등재**했다" 고 적지만, `plan/` 전체를 `grep -rn "assertInboundSigningPlaintextByProvider"` 로 훑어도 이 특정 drift(두 provider 문서의 `TriggersService.X` 오기 정정)를 가리키는 신규 항목은 **없다** — `HEAD` 이후 `plan/` 을 건드린 커밋도 없음을 `git log 2ae81077c..HEAD -- plan/` 로 확인했다. 즉 (1) plan 문서 자신의 설계 서술이 이제 거짓이고, (2) 그 거짓을 낳은 실제 결정(delegator 미보존)의 근거는 커밋 메시지에만 있고 plan 파일에는 반영되지 않았으며, (3) "등재했다" 는 사후 완화책 자체가 검증되지 않는다. 다음에 이 plan 을 읽는 사람(또는 `--impl-done` 게이트)은 "drift 0" 이라는 문장을 신뢰해 두 provider 문서를 열어보지 않을 것이다.
  - 제안: (a) `plan/in-progress/impl-chat-channel-binder.md` 의 §93-98 을 취소선 처리하고 실제 결정(delegator 는 dead code 라 만들지 않았고, `slack.md:275`/`discord.md:297` 의 `TriggersService.X` 표기가 부정확해졌다는 사실)으로 정정한다. (b) 그 정정 문장이 가리킬 수 있는 **실재하는 tracker 항목**(예: `plan/in-progress/spec-draft-nullable-notation-followups.md`)을 실제로 만들어 "planner 턴이 `slack.md:275`/`discord.md:297` 의 `TriggersService.` 접두어를 제거하거나 호출자/정의처를 분리한 문장으로 바꿔야 한다"를 명시한다. 커밋 본문의 주장과 실제 저장소 상태가 어긋난 이 케이스는 프로젝트가 과거에도 반복해서 겪은 "plan 서술이 실측 없이 참으로 간주됨" 패턴과 동형이다.

- **[WARNING]** plan 체크리스트가 이미 완료된 단계도 전부 미체크(`[ ]`) 상태로 남아 있다
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:142` (`- [ ] T1 이동 + 테스트 diff 0줄 확인`)
  - 상세: `HEAD`(`2ae81077c`)가 이미 T1 이동을 포함하고, 커밋 메시지 자신이 "테스트 파일 diff 0줄(`git diff --numstat -- '*.spec.ts'` = 0)" 을 증거로 제시한다(`git show --numstat 2ae81077c -- '*.spec.ts'` 로 직접 재확인 — 출력 없음, 즉 0줄). 그런데 체크리스트 항목 2("T1 이동 + 테스트 diff 0줄 확인")는 여전히 미체크다. 이 저장소의 관례(plan 체크박스 = 실제 수행 상태를 반영, 수행 후에만 체크)를 따르지 않는 상태로 커밋이 이미 랜딩됐다.
  - 제안: 이 PR/커밋을 반영해 체크리스트 항목 1·2 를 체크하고, T2 가 남아 있으므로 `status: in-progress` 는 유지한다.

- **[INFO]** `chat-channel-rejection-messages.const.ts` 의 기존 주석이 이번 이동으로 한 단계 더 부정확해졌다 (이번 diff 대상 파일은 아님)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:8` (`// - null / '' → @IsEmpty() 를 통과하고 TriggersService 가드가 거부`)
  - 상세: 이 주석은 이번 diff 에 포함되지 않은 기존 파일에 있지만, 이번 이동의 직접적 결과로 서술 정확도가 낮아졌다. 거부를 수행하는 가드 로직(`assertChatChannelInputSafe` 등)은 이제 `TriggersService` 클래스 밖(`chat-channel-input-rules.ts` 모듈 함수)에 있고, `TriggersService` 는 그것을 **호출**만 한다. "TriggersService 가드" 라는 표현은 여전히 대략적으로는 참(그 요청 경로가 `TriggersService.update()`/`create()` 를 통과하므로)이지만, 정확히는 "TriggersService 가 호출하는 chat-channel-input-rules 가드"다. `naming_collision.md`(이번 diff 에 포함된 `--impl-prep` 산출물)도 이 지점을 이미 인지했으나 "통상적 리팩터 중 자연히 갱신될 항목" 으로 판단해 별도 항목화하지 않았다 — 그런데 실제 T1 커밋이 랜딩된 지금도 이 주석은 갱신되지 않았다.
  - 제안: 후속(T2) 커밋 또는 별도 minor 커밋에서 한 단어만 정정 — "TriggersService 가드" → "TriggersService 가 호출하는 chat-channel-input-rules 가드" 또는 "서비스 층 가드".

## 검증해 통과로 확인한 항목 (참고용)

- 신규 `chat-channel-input-rules.ts` 의 JSDoc/모듈 docstring 은 이례적으로 충실하다 — 각 export 마다 spec 인용(§5.4.1·§5.4.1.1·§5.4.1.2·R-CC-21·provider docs)이 실제 대상 섹션과 정확히 일치함을 직접 `grep`/`Read` 로 대조했고(예: §5.4 에러 표의 `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 매핑, `2-trigger-list.md` R-12), `@workflow/chat-channel-validation`(정규식 SoT)과의 역할 차이를 명시한 문단도 plan 의 INFO-4 처분대로 실제로 추가돼 있다.
- `triggers.service.ts` 안에는 이동 후 남은 `this.assertChatChannelInputSafe` 류의 orphan 자기-참조가 없다(전수 `grep` 확인) — 클래스 쪽 주석은 깨끗하게 정리됐다.
- README·API 문서·ENV/설정 문서·CHANGELOG 갱신은 이번 변경 범위에서 불필요하다고 판단한다 — 순수 내부 리팩터로 공개 API·환경변수·설정 표면이 전혀 바뀌지 않았고, 이 저장소의 `CHANGELOG.md` 는 사용자 관측 가능한 동작/계약 변경만 기록하는 관례를 유지하고 있다(다른 항목 전수가 그 패턴).
- `--impl-prep` consistency 산출물(파일 4·6·7·9·10·11) 자체는 문서화 관점에서 발견을 제대로 수행했다 — 특히 `naming_collision.md`(WARNING 2)가 이번 CRITICAL 로 이어진 drift 를 사전에 정확히 예견했다. 다만 그 WARNING 이 겨냥한 "구현 시 상태"(사후)를 이 라운드에서 재확인한 결과, plan 이 예견된 완화책을 실제로 적용하지 않았고 그 사실이 plan 문서에 반영되지도 않았다는 점이 이번 라운드의 신규 발견이다.

## 요약

신규 파일 `chat-channel-input-rules.ts` 자체의 문서화 품질(JSDoc·SoT 인용·역할 구분 docstring)은 높다. 그러나 이 PR 의 핵심 문서화 리스크는 코드가 아니라 **plan 문서와 실제 구현의 불일치**다 — `plan/in-progress/impl-chat-channel-binder.md` 는 여전히 "얇은 delegator 로 drift 0" 이라는, 이미 랜딩된 커밋(`2ae81077c`)이 스스로 철회한 설계를 그대로 기재하고 있고, 커밋 메시지가 주장한 "planner 항목 등재" 도 저장소 어디에서도 확인되지 않는다. 그 결과 `spec/4-nodes/7-trigger/providers/slack.md:275`·`discord.md:297` 는 지금 이 순간 존재하지 않는 `TriggersService.assertInboundSigningPlaintextByProvider` 를 실명 인용한 채 방치되어 있으며, 이를 바로잡을 추적 가능한 다음 단계가 어디에도 기록돼 있지 않다. 여기에 plan 체크리스트가 이미 완료된 단계까지 미체크로 남아 있는 점, 그리고 이번 diff 밖의 인접 주석 하나가 한 단계 더 부정확해진 점이 더해진다.

## 위험도

CRITICAL

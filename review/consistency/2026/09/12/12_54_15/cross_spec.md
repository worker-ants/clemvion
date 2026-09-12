# Cross-Spec 일관성 검토 — setupChannel 실패 분류 (`R-CC-23`/`R-CCA-9`, `--impl-prep`)

> **검토 대상 재확인**: 조립된 `_prompts/cross_spec.md` 는 `spec/5-system/` 대부분 파일과
> `관련 spec 본문` 섹션의 다수 파일이 "본문 생략됨 — 컨텍스트 예산 초과" 로 절단돼 있었다
> (기존 교훈 `feedback_consistency_spec_mode_budget` 재현). 번들 대신 worktree 실제 파일과
> `git log`/`git show` 로 대상 커밋(`8964a7114`, "docs(spec): setupChannel 실패를 transport
> 대신 원인으로 분류한다 — 502 는 실재하지 않았다 (#1323)")의 diff 를 직접 대조했다. 이 커밋은
> 이미 3 회의 `--spec` 라운드(`11_50_28` BLOCK:YES → `12_05_58`/`12_22_24` BLOCK:NO)를 거쳐
> `origin/main` 에 병합돼 있고, 현재 `--impl-prep` 세션(`plan/in-progress/impl-setup-error-code.md`,
> `spec_impact: none`)은 그 spec 을 구현으로 옮기는 턴이다. 아래는 그 커밋이 손댄 8개 파일
> (`spec/5-system/{2-api-convention,15-chat-channel,4-execution-engine}.md` ·
> `spec/2-navigation/2-trigger-list.md` · `spec/data-flow/14-chat-channel.md` ·
> `spec/4-nodes/7-trigger/providers/slack.md` · `spec/conventions/{swagger,chat-channel-adapter}.md`)
> 를 대상으로 한 신선한 cross-spec 대조 결과다.

## 발견사항

이번 라운드에서 **CRITICAL/WARNING 신규 발견 없음**. 이전 두 라운드가 지적한 항목은 최종
커밋에서 실제로 반영됐음을 실측으로 확인했다 — 상세는 아래 "정합성이 확인된 주요 항목" 참조.

- **[INFO]** `chat-channel-input-rules.ts` 의 §7 파일 트리 서술과 실제 책임의 불일치 (기존 갭, 이번 턴이 재확인만 함)
  - target 위치: `15-chat-channel.md` §7 구현 파일 트리 — `chat-channel-input-rules.ts` 를
    "입력 검증·변환 순수 함수 (R-CC-21 정본)" 로 서술
  - 충돌 대상: 그 파일이 실제로 담는 `translateSetupChannelError`(§5.4/§1.1.2 대상, developer 후속
    작업 1번) — **출력측**(에러 응답 변환) 함수라 "입력 검증·변환" 이라는 §7 서술과 결이 다르다
  - 상세: `--impl-prep` 이 구현을 착수시키는 시점이라 이 계층-책임 서술 불일치가 실무에 영향을
    준다 — developer 가 §7 트리 서술만 보고 `translateSetupChannelError` 를 "입력측" 파일로
    오인해 잘못된 곳에 새 로직을 추가할 여지가 있다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 별도 트래커 항목으로 유예돼 있어 CRITICAL/WARNING 은 아니다.
  - 제안: 이번 developer 턴에서 `translateSetupChannelError` 를 건드리므로, 완료 후 §7 트리 주석에
    "출력측(에러 변환)" 한 줄을 함께 정정하면 트래커 항목을 앞당겨 닫을 수 있다 (선택 사항 — spec
    수정은 developer 권한 밖이므로 후속 planner 턴 또는 자기-반증형 소정정 조건 검토 필요).

- **[INFO]** 중앙 에러 카탈로그(`error-handling.md §1` / `conventions/error-codes.md`)에 `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 미등재 (기존 갭, 이번 결정 이전부터 존재)
  - target 위치: 없음(이번 커밋이 만든 갭이 아님)
  - 충돌 대상: `2-api-convention.md §5.3` "어느 쪽을 택하든 에러 처리 §1 카탈로그에 등재한다" 규칙
  - 상세: `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 두 코드 모두 `error-handling.md §1` /
    `conventions/error-codes.md` 중앙 카탈로그에 없음을 재확인했다(grep 0건). 이번 커밋은 이
    코드들의 **분류 기준**만 바꿨고 신규 코드를 만들지 않았으므로 이 갭을 새로 만든 것은 아니다.
    다만 `502` 가 이 저장소의 첫 사용이라는 점을 고려하면, developer 가 `@ApiBadGatewayResponse`
    를 붙이는 시점에 이 미등재 상태가 함께 눈에 띌 가능성이 높다.
  - 제안: 이번 구현 턴의 범위는 아니다(`spec_impact: none` 이 이미 그렇게 선언). developer 가
    작업 중 이 갭을 건드리고 싶어지면 자기-반증형 소정정 조건(HTTP 코드는 API 계약이라 조건 2가
    배제)에 걸리므로 planner 턴으로 넘길 것 — 이미 `#1323` 커밋 메시지가 같은 결론을 냈다.

## 정합성이 확인된 주요 항목 (이번 라운드 실측)

- **이전 WARNING 해소 확인** — 라운드 2(`12_22_24`)가 지적한 *"`4-execution-engine.md` C-1 의
  '502 아니라 503' 문장이 스코프 한정 없이 절대적으로 읽힌다"* 는 최종 커밋에서 해소됐다.
  `4-execution-engine.md:1410` 에 역방향 각주(*"이 「502 아니라 503」 판정은 **우리** 의존성
  장애에 스코프된다 — **외부 제3자 API** 호출이 실패하는 경우의 502 사용은 [Chat Channel
  R-CC-23] 이 정의한다"*)가 실제로 추가된 것을 diff 로 확인했다.
- **이전 INFO 해소 확인** — 라운드 2가 제안한 *"§7 '모든 구체 어댑터 명세' 해석을 Rationale 에
  명시"* 도 반영됐다. `chat-channel-adapter.md` R-CCA-9 말미에 *"§7 의 문면은 「영향받는 모든」
  으로 읽는다. 선례가 있다 — §1.1.1 도 telegram 한 파일만 갱신했다"* 가 실제로 추가돼 있다.
- **요구사항 ID 충돌 없음** — `R-CC-23`(`15-chat-channel.md`) 직전 최대값 `R-CC-22`, `R-CCA-9`
  (`chat-channel-adapter.md`) 직전 최대값 `R-CCA-8` — 번호가 정확히 이어지고 중복·재사용 없음
  (전수 grep 재확인).
- **502 상태코드 축 전역 정합** — `spec/` 전체에서 `502` 를 우리 API 응답 코드로 쓰는 곳은
  `2-api-convention.md §6`·`15-chat-channel.md §5.4/R-CC-23`·`4-execution-engine.md`(역참조)
  뿐이고, 그 외 등장(`2-navigation/4-integration.md`·`3-error-handling.md`·`text-classifier.md`)은
  전부 **HTTP Request 노드가 관측한 제3자 응답의 `statusCode`**(워크플로우 노드 출력)라 다른
  네임스페이스 — target 의 "노드 출력 payload 의 statusCode 와는 다른 축" 각주가 실제로 필요하고
  정확하다.
- **`503` 실사용처 3곳 검증** — `WEBAUTHN_DISABLED`(`1-auth.md §1.4.3`/`error-handling.md:57`)·
  `SERVER_SHUTTING_DOWN`·`EXECUTION_ENQUEUE_FAILED` 모두 "우리 쪽" 장애를 가리킴을 재확인 —
  R-CC-23 의 "기존 502/503 축과 충돌하지 않는다" 논증의 전제가 맞다.
- **복제 제거 완결성** — "401/403 에서 드러난다" 류 서술이 남아있는 곳은 정확히 target 이
  의도적으로 남긴 3곳(§5.4 신규 표의 신호 열거, R-CC-23 본문의 옛 규칙 인용, §1.1.2 의 한시
  fallback 서술) 뿐이고, `2-trigger-list.md:120`·`data-flow/14-chat-channel.md:161-162` 는 §5.4
  링크 위임으로 정정돼 있다. 저장소 전체 `401/403` grep 재실행 결과 chat-channel 도메인 밖의
  다른 모든 매치(OAuth Integration·MCP Client·AI Agent LLM 분류·임베딩 파이프라인)는 무관 도메인.
- **provider spec 갱신 범위 검증** — `providers/discord.md`(L56·L76)는 이미 `verify_key` 불일치
  시 `BOT_TOKEN_INVALID` 를 서술하고 있어 이번 결정과 모순되지 않고, `providers/telegram.md` 는
  실패 분류 서술 자체가 없어(401 이 client 메시지에 포함되는 것으로 충분히 옛 fallback 을 통과)
  갱신 불요, `providers/_overview.md` catalog 는 실패 코드 서술을 갖지 않아 §7 의 "catalog 동시
  갱신" 대상이 아니다 — `providers/slack.md` 만 갱신한 target 의 판단과 일치.
- **swagger.md §2-4 표 문법 정합** — 신설 행(`| 502 외부 provider 호출 실패 |
  @ApiBadGatewayResponse |`)이 기존 표의 "상태 코드 1개당 데코레이터 1개" 패턴을 그대로 따른다
  (라운드 2 가 지적한 "5xx 뭉뚱그림" 위험은 실제 커밋에서 구체 코드로 반영돼 해소).
- **§7.5.2 보안 게이트 인용 정확성** — R-CC-23 이 인용하는 `4-execution-engine.md §7.5.2` 의
  "plain `Error` 의 `error.message` 를 client 에 전달하지 않는다" 문구가 실제로 그 절에 존재하고
  (`비-typed(plain) Error / unknown ... 내부 error.message 를 client 에 전달하지 않는다`), R-CC-23
  이 도입하는 "provider 원문 echo 중단" 결정과 원칙이 정확히 대칭.

## 요약

이 target 은 이미 `--spec` 3 라운드를 거쳐 병합된 spec 커밋(`8964a7114`)이며, 이전 라운드가
지적한 유일한 실질 리스크(`execution-engine.md` 의 편도 인용)와 절차적 긴장(§7 "모든" 문면 대
"영향받는 모든" 해석)이 최종본에서 모두 명시적으로 해소된 것을 diff 로 재확인했다. 이번
`--impl-prep` 라운드에서 독자적으로 재검증한 결과 — 요구사항 ID 충돌, API 계약(502/503 축) 충돌,
provider spec 간 상태 서술 불일치, 카탈로그/데코레이터 표 문법 불일치 — 어느 축에서도 새로운
CRITICAL/WARNING 은 나오지 않았다. 남은 두 항목(계층-책임 서술의 소소한 부정확·중앙 에러
카탈로그의 사전 존재 갭)은 모두 이미 다른 트래커에 유예돼 있고 이번 결정이 만든 것이 아니라
구현 착수를 막을 사유가 아니다.

## 위험도

NONE

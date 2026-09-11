# Rationale 연속성 검토 — `plan/in-progress/spec-draft-chat-channel-binder-drift.md`

## 조사 방법

target 이 스스로 인용하는 근거(git 커밋 해시·Rationale 항목 번호·가드 상수)를 전부 저장소에서
직접 실행/열람해 재현 검증했다. `--spec` 번들이 컨텍스트 예산 초과로 `15-chat-channel.md` ·
`data-flow/14-chat-channel.md` 본문을 절단했으므로, 그 두 파일과 `secret-store.md` ·
`chat-channel-adapter.md` · `spec-impl-evidence.md` 의 `## Rationale` 은 저장소에서 직접 읽었다.

## 발견사항

### [INFO] R-CC-22 초안이 같은 파일 안의 기존 glob 선례를 인용하지 않는다

- target 위치: `plan/in-progress/spec-draft-chat-channel-binder-drift.md` `## Rationale (spec 본문에
  실을 근거)` 절 (line 225-243) — `R-CC-22` 로 15-chat-channel.md 에 신설 예정인 문구
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` frontmatter `code:` 자체 (git 이력
  `7821-7836` 최초 커밋부터 `codebase/backend/src/modules/chat-channel/**` 를 이미 `**` glob 으로
  등재해 왔다)
- 상세: target 은 *"다른 spec 은 대부분 명시 경로다(633개 중 528개가 `*` 없음)"* 를 근거로
  *"왜 여기만 glob 인가"* 라는 미래 질문에 대비하지만, 실은 **같은 파일이 처음부터 `chat-channel/`
  쪽을 glob 으로 등재해 왔다**는 더 직접적인 선례가 있다. 이 선례를 R-CC-22 가 인용하면
  *"이 spec 은 원래 glob 을 써 왔고 `triggers/` 쪽만 명시 경로로 시작했다가 재발로 뒤늦게
  맞춘 것"* 이라는, 더 강하고 이미 사실인 근거가 된다. 지금 초안은 `spec-impl-evidence.md R-1`
  (일반 원칙)만 인용하고 이 **문서 내부 선례**는 인용하지 않아 근거가 실제보다 약하게 제시된다.
  이는 Rationale 위반이 아니라 **보강 기회**다.
- 제안: `R-CC-22` 본문에 "`chat-channel/**` 는 최초 커밋부터 glob 이었다 — `triggers/` 쪽만 명시
  경로로 남아 있던 것이 예외였고 이번이 그 예외를 없애는 것" 이라는 한 문장을 추가해 근거를
  강화한다. (필수 아님 — 없어도 CRITICAL/WARNING 아님.)

## 교차검증 상세 (참고용 — 위 발견사항의 근거)

아래는 target 이 인용하는 개별 근거를 실측 검증한 결과다. 전부 **일치**했다 — 별도 발견사항으로
올리지 않는다.

1. **R-CC-14 결번 주장**: `spec/5-system/15-chat-channel.md` 의 `### R-CC-` 헤더를 전수 grep 하면
   `R-CC-13` 다음이 `R-CC-15` 다 — `R-CC-14` 는 실제로 결번이고 `R-CC-21` 이 현재 최댓값이다.
   target 의 `R-CC-22` 번호 채번과 "결번 재사용 안 함" 서술이 사실과 일치한다.

2. **`spec-impl-evidence.md` R-1 인용**: 원문이 정확히 *"넓은 트리 글롭으로 가드만 통과시키는 것은
   아무것도 가리키지 않는 것과 같다"* 라고 §2.1 필드 정의 표에 적혀 있고, `## Rationale` R-1 도
   "글로브 허용을 채택 … stale 글로브 는 본 가드만으로 검출 불가"라고 명시한다. target 의 인용은
   축약 없이 정확하며, target 이 스스로 "R-CC-22 는 예외가 아니라 R-1 의 적용례"라고 자리매김한
   것도 이 원문과 부합한다 — R-1 은 애초에 glob 허용을 원칙으로 선언했지 예외로 두지 않았다.

3. **이동 심볼 9개(T1 6 + T2 3) 주장**: `ba634a4b0`(#1319, T1)과 `77f4a88e5`(#1320, T2)를 직접
   `git show` 로 확인했다. T1 은 `chat-channel-input-rules.ts` 에 6개 함수(`assertChatChannelInputSafe`
   등, `assertInboundSigningPlaintextByProvider` 포함)를 신설했고, T2 는
   `chat-channel-binder.service.ts`(`setupChatChannel`/`teardownChatChannel`)와
   `trigger-callback-url.ts`(`buildCallbackUrl`→`buildTriggerCallbackUrl` 개명)를 신설했다 —
   6+3=9, target 의 집합과 정확히 일치한다. 지어낸 이력이 아니다.

4. **가드 상수 `_MAX_GLOB_WILDCARDS = 6`**: `.claude/hooks/_lib/review_guard.py` 549행 근방에
   `_MAX_GLOB_WILDCARDS = 6` 이 실재하고 `_glob_to_regex` 가 이를 강제한다. target 의 "가드 상한
   (6)" 인용이 정확하다.

5. **R-CC-10 (Bot Token single-path rotate)**: target 의 §7 편집·귀속 편집 어느 것도 rotate
   단일 경로 결정을 건드리지 않는다 — `chat-channel-token-rotator.service.ts` 는 그대로 §7·
   `code:` 양쪽에 잔류하고, R-CC-21 이 다룬 "PATCH 가 비밀을 쓰지 않는다" 결정도 target 이 재론하지
   않는다. 충돌 없음.

6. **`C-2` 이관(§7 주석 근거)**: `e827ed2a7`(#676, 2026-06-24)이 이미
   `chat-channel-token-rotator.service.ts`·`rotateBotToken` 컨트롤러 엔드포인트의 `triggers/`
   이관을 결정·시행했다. target 의 §7 주석("C-2: chat-channel 에서 이전")은 그 기존 결정을 다시
   진술하는 것이지 새로 뒤집는 것이 아니다.

7. **`chat-channel-adapter.md §7` 두-spec 동시 갱신 의무**: 이 조항은 **어댑터 인터페이스 변경**에
   적용되는데, target 의 (b)(e)(f)(g) 편집은 인터페이스(필드·타입)가 아니라 JSDoc/본문의 caller
   attribution 문구만 고친다 — 조항의 적용 대상이 아니다. 다만 target 은 어차피 같은 PR 에서
   `15-chat-channel.md`·`slack.md`·`discord.md`·`telegram.md` 를 모두 갱신하므로 결과적으로
   조항의 정신과 충돌하지 않는다.

## 요약

target 문서는 세 축(frontmatter `code:` 술어, §7 열거, 7곳 귀속 표기)을 T1/T2 리팩터 이후의
실제 코드 상태에 맞추는 **문서 정합화 작업**이며, 어느 편집도 기존 spec 의 `## Rationale` 이
명시적으로 기각한 대안을 재도입하거나 합의된 설계 원칙(R-CC-10 rotate 단일 경로, R-CC-21 PATCH
비밀-쓰기 금지, R10 단일 sink facade, `spec-impl-evidence.md` R-1 의 glob 허용+stale 경고 등)을
위반하지 않는다. `code:` 를 명시 경로에서 glob 으로 바꾸는 결정은 R-1 을 정확히 인용해 적용례로
자리매김했고, 그 결정의 근거로 든 git 커밋·가드 상수·함수 이동 내역은 전부 실측으로 재현됐다 —
지어낸 이력이 없다. 유일한 발견은 CRITICAL/WARNING 이 아닌 INFO 수준으로, 신설될 `R-CC-22` 가
같은 파일에 이미 있던 `chat-channel/**` glob 선례를 인용하면 근거가 한 단계 더 탄탄해진다는
보강 제안이다.

## 위험도

LOW

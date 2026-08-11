# 문서화(Documentation) Review — webchat `wc:boot` apiBase 스킴 검증 (라운드 2, 커밋 `99d3e9000` 처분 검증)

직전 라운드에서 이 리뷰어가 낸 CRITICAL("spec §R0 은 정정하고 `safeApiBase` JSDoc 에는 같은 거짓
문장을 남겼다")의 처분(`99d3e9000`)을 **이번엔 전수로** 검증했다. 소스 파일을 직접 `grep`/`Read`
로 열고, `codebase/channel-web-chat` 테스트 스위트를 실제로 실행해(`npx vitest run` →
**451 passed**) 문서가 주장하는 수치를 실측과 대조했다.

## 요청된 5개 항목 검증 결과

### 1. 거짓 문장("`apiBase` 가 없으면 `applyConfig` 가 자기 자리에서 실패한다")의 모든 복제본

`codebase/`·`spec/`·`plan/` 전체를 `자기 자리에서 실패`로 grep한 결과 3곳:

- `codebase/channel-web-chat/src/widget/use-widget.ts:197` — `safeApiBase` JSDoc. **정정된 인용**
  ("> 첫 판은 ... 고 적었다. **거짓이다.**")으로 올바르게 표시됨.
- `spec/7-channel-web-chat/4-security.md:296-297` — §R7 Rationale. 같은 방식으로 **정정된 인용**.
- `plan/complete/webchat-boot-apibase-scheme-validation.md:94` — "## 리뷰 라운드 1 이 잡은 것" 절.
  과거 시점 기록으로 **정정된 인용**.

이 3곳은 전부 "거짓이었다"고 명시하는 올바른 정정문이라 문제 없다. 그런데 **네 번째 복제본**이
남아 있다 — 아래 발견사항 참조 (`use-widget.test.ts:89`).

### 2. `R0` → `R7` 재번호가 모든 참조에 반영됐는가

`spec/7-channel-web-chat/4-security.md` 는 이제 `### R1`~`### R7` 만 갖고(`### R0` 0건, 직접
확인), `spec/7-channel-web-chat/2-sdk.md:149` 의 교차 참조도 `§R7` 로 정확히 갱신돼 있다.
`plan/complete/webchat-boot-apibase-scheme-validation.md` 의 두 참조(라인 46, 93)도 `§R7`
(하나는 `§R7(당시 §R0)` 로 이력까지 병기)로 정확하다.

**단 하나, 놓친 곳이 있다**: `use-widget.ts:197` 자신 — 아래 발견사항 참조.

### 3. `safeApiBaseFromQuery` 인용이 살아있는 문서에 남았는가

`codebase/` 전체에서 `safeApiBaseFromQuery` 0건(직접 확인 — 이전 라운드 maintainability WARNING
처분으로 `@deprecated` 위임 자체가 삭제되고 호출부 7곳이 `safeApiBase` 로 치환됨, `d8abc7003`).
`spec/` 도 0건. `plan/` 에는 `webchat-polish-batch.md`·`webchat-boot-apibase-scheme-validation.md`
의 "## 문제"/"## 관련"(구버전 인용) 절에 남아 있지만, 전부 **그 시점 기준으로 정확했던 과거
기록**(lifecycle 관행상 보존)이라 갱신 대상 아님 — 직전 라운드 판정과 동일하게 재확인.

### 4. 새 e2e 테스트 JSDoc — "직접 로드 폴백이 두 경로를 같게 만든다" 진단의 정확성

`use-widget-eager-start.test.ts:4243-4255`(신규 3번째 `it`)의 JSDoc 을 코드와 대조:

- `configFromQuery()` → `use-widget.ts:1378-1381`: `if (fallback.apiBase && fallback.triggerEndpointPath) runApplyConfig(fallback)` — JSDoc 이 인용한 조건문과 **글자 그대로 일치**.
- 테스트가 쿼리에 `apiBase` 만 넣고 `trigger` 를 뺀 것(`window.history.replaceState(..., `?apiBase=${...}`)`) → `configFromQuery()` 의 `triggerEndpointPath` 는 `undefined` → 위 조건문이 **거짓**이 되어 직접 로드 폴백이 발동하지 않는다 — JSDoc 주장과 일치.
- `boot()` 헬퍼(`use-widget-eager-start.test.ts:183-197`)는 `triggerEndpointPath: "t1"` 을 **항상** 페이로드에 싣는다 — 테스트 안의 주석 `// trigger 는 boot 이 준다`(`:4264`)가 정확하다.
- 결과적으로 이 테스트에서 `apiBase` 의 유일한 공급 경로는 `mergeBootConfig` 뿐이라, JSDoc 이 서술한 "이 축이 관측된다" 는 결론이 코드로 뒷받침된다.

**정확함 — 새 CRITICAL 없음.**

### 5. 이번 라운드 정정문이 새 부정확을 들여왔는가

**들여왔다.** 아래 발견사항 2건 참조 — 둘 다 `99d3e9000` 자신이 만들거나(부정확한 수치를 새로
써넣음) 놓친(문맥상 같은 hunk 안에서 R0→R7 을 고치면서 옆의 stale 참조는 못 본) 것이다.

---

## 발견사항

- **[WARNING]** `safeApiBase` JSDoc 의 역사 인용이 그 자신이 촉발한 R0→R7 재번호를 못 따라갔다 — 죽은 앵커
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197` (`* > 첫 판은 "\`applyConfig\` 가 자기 자리에서 실패한다" 고 적었다. **거짓이다.** spec §R0 에서`)
  - 상세: 이 인용문은 `99d3e9000` 커밋에서 **새로 작성**됐다. 그런데 **같은 커밋**이 `spec/7-channel-web-chat/4-security.md` 의 `### R0.` 를 `### R7.` 로 재번호했다(직접 확인: 현재 파일에 `### R0` 는 0건, `### R7`(`4-security.md:272`)만 존재). 결과적으로 이 JSDoc 이 가리키는 "spec §R0" 은 이제 존재하지 않는 섹션이다 — 리더가 `4-security.md` 에서 §R0 을 찾으면 없다. 같은 diff 안에서 `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 두 참조(`:46`, `:93`)와 `spec/7-channel-web-chat/2-sdk.md:149` 의 교차 참조는 정확히 `§R7` 로 갱신됐는데, **이 JSDoc 자기 자신의 새 문장만** 갱신에서 빠졌다. 직전 라운드 CRITICAL 이 정확히 이 형태("정정을 한 곳에만 했다" — 사실이 여러 곳에 복제돼 있는데 한 곳만 고침)였고, 이번 정정 과정 안에서 **같은 실패 패턴이 반복**됐다 — 다만 이번엔 "거짓 사실"이 아니라 "죽은 섹션 번호 참조"라는 점에서 앞선 CRITICAL보다는 낮은 등급으로 본다.
  - 제안: `spec §R0` → `spec §R7` 한 글자만 고치면 된다.

- **[WARNING]** plan "완료" 노트의 최종 테스트 수치가 이번 라운드 자신이 만든 다른 문서(RESOLUTION.md)·실제 실행 결과와 모순된다
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:76` (`검증(라운드1 시점): channel-web-chat **448 passed**. 최종은 **450 passed**(신규 8 = 단위 6 + 호출부 통합 2).`), 같은 파일 `:41`(`**단위 6건**(...) + **호출부 통합 2건**(...)`)
  - 상세: 실측 3중 대조 결과 전부 **451**·**신규 9**·**통합 3** 이다 — (a) `codebase/channel-web-chat` 에서 직접 `npx vitest run` 실행 → `Tests 451 passed (451)`. (b) 같은 커밋(`99d3e9000`)이 만든 `review/code/2026/08/11/15_32_44/RESOLUTION.md:55` — `"channel-web-chat **451 passed**(신규 9 = 단위 6 + 통합 3)"`. (c) 커밋 메시지 자체 — `"검증: channel-web-chat **451 passed**(신규 9)"`. plan 파일의 "450 passed(신규 8 = 단위 6 + 호출부 통합 2)" 는 `99d3e9000` 이 이 e2e 테스트 1건(`use-widget-eager-start.test.ts` 의 vacuous-fix 3번째 `it`, 항목 4 참조)을 추가한 **바로 그 커밋**에서 쓰인 문장인데, 그 자신이 추가한 테스트를 카운트에 반영하지 않았다 — "회귀 5건→6건 혼선"(직전 라운드 requirement INFO)과 **같은 클래스의 실수가 그 실수를 지적받은 지 한 라운드 만에 재발**했다. `:41` 의 "호출부 통합 2건" 도 같은 이유로 3건이어야 한다(이 줄은 이번 커밋의 diff hunk 바로 옆(R0→R7 교체 줄)에 있었는데도 안 고쳐졌다).
  - 제안: `:76` → "최종은 **451 passed**(신규 9 = 단위 6 + 호출부 통합 3)." `:41` → "**호출부 통합 3건**(...)."로 수정.

- **[INFO]** 옛 "자기 자리에서 실패" 문구가 정정 안내 없이 남은 네 번째 복제본 — 테스트 주석
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:89` (`// \`applyConfig\` 가 자기 자리에서 실패하도록 둔다(여기서 throw 하지 않는다).`)
  - 상세: `git log -S"자기 자리에서 실패하도록 둔다"` 로 확인하면 이 주석은 `3f1169ab5`(최초 구현, 거짓 JSDoc 이 처음 들어간 바로 그 커밋)에서 생겨 이후 `d8abc7003`·`99d3e9000` 두 정정 라운드를 거치는 동안 한 번도 손대지 않았다. spec/JSDoc 에서는 같은 문구가 전부 "**거짓이다**" 로 명시 정정됐는데, 이 주석만 정정 표시 없이 원 표현을 그대로 쓴다. 괄호 안 "(여기서 throw 하지 않는다)" 라는 자기-보정이 있어 독자를 크게 오도할 위험은 낮고, 프로덕션 JSDoc/spec 처럼 "코드 SoT" 지위를 갖지도 않는 테스트 내부 주석이라 INFO 로 본다 — 다만 "이 문장은 이 PR 안에서 이미 거짓으로 판명됐다"는 사실을 감안하면 다음에 이 파일을 편집할 때 "그 필드가 undefined 로 남아 `applyConfig` 가 조용히 반환하도록 둔다" 식으로 정리해 두는 편이 안전하다.
  - 제안: 주석을 "`mergeBootConfig` 가 undefined 를 반환하게 두어 `applyConfig` 가 조용히 no-op 하는 경로를 테스트한다" 정도로 바꾸면 spec/JSDoc 의 정정된 서술과 어휘가 맞는다. blocking 은 아니다.

새 CRITICAL 은 없다. 직전 라운드 CRITICAL(거짓 문장의 미동기화)은 실제로 처분됐다 — 남은 문제는
그 처분 과정에서 **새로 생긴 stale 참조 2건**(§R0 죽은 앵커, 테스트 수 오기재)과, 애초에 처분
대상에서 빠졌던 **테스트 주석 1건**이다. 전부 낮은 등급이다.

## 요약

직전 라운드 documentation CRITICAL("spec §R0 은 정정하고 코드 SoT JSDoc 에는 같은 거짓 문장을
남겼다")은 이번 커밋(`99d3e9000`)에서 실제로 처분됐다 — `use-widget.ts`·`4-security.md`·plan
완료 노트 3곳 모두 거짓 문장을 "거짓이다" 로 명시 정정했고, `safeApiBaseFromQuery` 잔존도
살아있는 문서에는 없으며, 신규 e2e 테스트 JSDoc 의 "직접 로드 폴백이 두 경로를 같게 만든다"
진단도 코드(`configFromQuery`/`fallback.apiBase && fallback.triggerEndpointPath`/`boot()`
헬퍼)와 실측 대조해 정확했다. 다만 "전수로 세라"는 이번 라운드 주제에 맞춰 다시 훑으니, 그
정정 작업 **자신**이 두 개의 새 stale 참조를 남겼다 — 같은 커밋에서 R0→R7 재번호를 하면서 자신이
방금 새로 쓴 JSDoc 인용문 속 "§R0" 는 못 고쳤고(WARNING), 자신이 추가한 3번째 e2e 테스트를
plan 완료 노트의 최종 테스트 수치("450 passed/신규 8")에 반영하지 못해 같은 커밋이 만든
RESOLUTION.md(451/신규 9, 실측 `npx vitest run` 로 재확인) 와 모순됐다(WARNING). 추가로, 최초
구현 커밋에서 생겨 두 번의 정정 라운드를 그대로 통과한 네 번째 "자기 자리에서 실패" 문구가
테스트 주석에 남아 있다(INFO, 코드 SoT 지위 없음). 모두 이전 CRITICAL 만큼 심각하지 않은
"완전히 쓸어내지 못한 부스러기" 수준이며, 이 PR 이 반복 겪어 온 "한 사실을 여러 곳에 복제하고
한 곳만 고친다" 패턴이 정정 작업 안에서도 규모를 줄여 가며 계속되고 있다는 것을 보여준다.

## 위험도

LOW

STATUS: OK

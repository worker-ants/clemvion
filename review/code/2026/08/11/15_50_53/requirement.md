# 요구사항(Requirement) Review — 2026/08/11 15_50_53 (델타 `99d3e9000`)

## 컨텍스트

이 델타는 직전 라운드(`15_32_44` 코드 + `15_32_46` consistency)의 처분 결과다: documentation
CRITICAL 1(§R0 정정을 spec 에만 하고 코드 JSDoc 은 안 고침) · convention WARNING(`R0`→`R7`
재번호) · plan_coherence/documentation WARNING(완료조건 표 미반영) · testing INFO(vacuous e2e)를
처분했다고 주장한다. 오케스트레이터가 지정한 4개 확인 항목을 실측으로 검증했다.

## 1. `spec_impact` — 이제 틀렸다 (WARNING, 게이트는 통과하지만 선언이 실제와 어긋남)

`hasValidSpecImpact`(`codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:386-400`)는 다음만
검사한다:

```ts
export function hasValidSpecImpact(impact: unknown, specExists: (p: string) => boolean): boolean {
  if (typeof impact === "string") return NONE_VALUES.has(impact.trim().toLowerCase());
  if (Array.isArray(impact)) {
    return impact.length > 0 && impact.every((p) => typeof p === "string" && specExists(p));
  }
  return false;
}
```

배열이면 **비어있지 않고 모든 원소가 실존 spec 파일**이면 통과 — **선언된 목록이 실제 diff 에서
건드린 spec 파일 전부를 커버하는지는 전혀 검사하지 않는다.** completeness 는 gate 의 판정
범위 밖이다.

그런데 `git show 99d3e9000 --stat`로 확인하면 이 델타는 `spec/7-channel-web-chat/2-sdk.md`
(`BootConfig.apiBase` 필드에 런타임 검증 상호참조 1줄 추가, `git log -- spec/7-channel-web-chat/2-sdk.md`
로 확인하면 **이 커밋이 그 파일을 건드린 유일 커밋** — 이전 두 라운드 `3f1169ab5`/`d8abc7003`
은 건드리지 않았다)와 `spec/7-channel-web-chat/4-security.md` 둘 다 수정한다. 그런데
`plan/complete/webchat-boot-apibase-scheme-validation.md:8-9` 의 frontmatter 는 여전히

```yaml
spec_impact:
  - spec/7-channel-web-chat/4-security.md
```

`4-security.md` 하나뿐이다. `plan-lifecycle.md §4`(Gate C)의 문면 정의("본 작업이 건드린 spec
파일들")를 문자 그대로 적용하면 이 목록은 이제 **불완전**하다 — 이번 델타가 만든 새 상태다
(이전 두 라운드까지는 `4-security.md` 단독 선언이 정확했다).

- 기계적 영향: 없음. `hasValidSpecImpact`가 completeness 를 안 보므로 `spec-plan-completion.test.ts`
  는 그대로 통과하고 CI 를 막지 않는다.
- 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:8-9`(frontmatter) / 근거:
  `spec/7-channel-web-chat/2-sdk.md:149`(이번 델타가 수정한 줄), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:386-400`(`hasValidSpecImpact`)
- 제안: `spec_impact` 에 `spec/7-channel-web-chat/2-sdk.md` 추가. 게이트가 안 잡는다고 방치하면
  "선언은 있는데 실제로 뭘 건드렸는지는 선언과 다르다"는, 이 프로젝트가 반복 경계하는 실패
  형태(`findDanglingSpecImpact` 주석이 명시하는 "선언은 있는데 아무도 모르는 상태") 그대로다.

## 2. plan 의 수치 — 커밋 메시지는 맞고, plan 본문(같은 커밋에서 수정)은 여전히 틀리다 (WARNING)

실측(직접 카운트, `node_modules` 미설치라 `pnpm test` 대신 정적 카운트):

```
mergeBootConfig describe 내 it(): 6건  (use-widget.test.ts)
wc:boot 의 apiBase 스킴 검증(호출부 배선) describe 내 it(): 3건  (use-widget-eager-start.test.ts,
  이번 델타가 3번째 it 을 추가)
```

합계 9건 신규 — 커밋 메시지 "채널-web-chat **451 passed**(신규 9)"와 정확히 일치한다(직전
라운드까지 450/신규8이었고 이번 델타가 정확히 1건을 더했다는 산술과도 맞는다).

**그런데 plan 파일 자신의 본문은 이 델타로 편집됐음에도 갱신되지 않았다:**

- `plan/complete/webchat-boot-apibase-scheme-validation.md:41` — 체크리스트 2번째 항목:
  `**단위 6건**(...) + **호출부 통합 2건**(...)` — 실제로는(이번 델타 이후) **3건**인데 여전히
  "2건"이라 적혀 있다. 이 줄 자체는 이번 델타가 건드리지 않았다(`git show 99d3e9000` diff 확인 —
  이 라인은 diff 밖).
- `plan/complete/webchat-boot-apibase-scheme-validation.md:76` — **이번 델타가 바로 이 줄을
  편집했다**(`git show 99d3e9000` 확인: `-검증: channel-web-chat 448 passed...` →
  `+검증(라운드1 시점): channel-web-chat 448 passed. 최종은 450 passed(신규 8 = 단위 6 + 호출부
  통합 2).`). 즉 이 문장을 고치는 바로 그 동작 안에서, 같은 커밋이 3번째 통합 테스트를
  추가했는데 그 사실이 이 줄에 반영되지 않았다 — "최종"이 450/8 이 아니라 451/9 여야 정확하다.

이 발견은 이 PR 계열이 반복 학습한 정확히 그 형태다: 커밋 메시지("정정을 한 곳에만 했다")가
스스로 표방한 교훈("한 사실을 두 곳에 복제해 놓고 한 곳만 고친다")이 **이 커밋의 이 지점에서
다시** 재발했다 — 커밋 메시지 쪽(451/9)은 고쳤는데 plan 본문 쪽(여전히 450/8, 그리고 체크리스트의
"2건")은 못 미쳤다.

- 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:41`, `:76`
- 제안: `:41` "호출부 통합 2건" → "3건"(그리고 이번 델타가 추가한 e2e 시나리오 — "쿼리 유효 +
  boot 거절" — 한 줄 요약 추가 권장). `:76` "최종은 450 passed(신규 8 = ...)" → "최종은 451
  passed(신규 9 = 단위 6 + 호출부 통합 3)".

## 3. spec §R7 · `2-sdk.md` 신규 상호참조 vs 구현 — 대부분 일치, 코드 JSDoc 에 새 stale 참조 1건 (WARNING)

**일치 확인된 부분:**
- `spec/7-channel-web-chat/2-sdk.md:149`의 신규 주석 `[4-security §1 \`apiBase\` 입력 검증 ·
  §R7](./4-security.md)` — `4-security.md:39`의 §1 표 "`apiBase` 입력 검증" 행, 그리고
  `4-security.md:272`의 `### R7. ...` 헤딩 둘 다 실재 확인. §R0→§R7 재번호가 이 참조에는 이미
  정확히 반영돼 있다.
- `4-security.md §R7`(`:272-306`)의 서술("두 입력 경로 모두 SDK 가 같은 값을 보낸다",
  "`{ ...configFromQuery(), ...boot }` 병합", "`applyConfig` 의 `if (!cfg.apiBase ||
  !cfg.triggerEndpointPath) return;` 은 warn/dispatch 없이 조용히 빠지고 바로 아래 자매 분기가
  `BLOCKED` 를 dispatch")는 실제 `use-widget.ts:1229`(early return)·`:1239`(`dispatch({ type:
  "BLOCKED", ... })`)와 line-level 로 일치한다.
- §1 표 "코드 SoT: `use-widget.ts` 의 `safeApiBase`/`configFromQuery`/`mergeBootConfig`" — 세
  함수 모두 실재(`use-widget.ts:201`(`safeApiBase`), `:221`(`configFromQuery`),
  `:236`(`mergeBootConfig`)).

**불일치 1건 — 이번 델타가 직접 만든 새 stale 참조:**

- **[WARNING]** `use-widget.ts` 의 `safeApiBase` JSDoc 블록쿼트가 여전히 "spec §R0" 을 인용한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197`
    (`* > 첫 판은 "\`applyConfig\` 가 자기 자리에서 실패한다" 고 적었다. **거짓이다.** spec §R0 에서`)
  - 상세: 이 세 줄(`:195-199`)은 **이번 델타(`99d3e9000`)가 새로 추가한 텍스트**다(`git show
    99d3e9000`의 `+` 라인 — 직전 라운드 documentation CRITICAL "spec 은 고쳤는데 코드 JSDoc 은
    안 고쳤다"를 처분하며 새로 쓴 문단). 그런데 **같은 커밋이 동시에** `4-security.md`의
    `### R0.` 섹션을 `### R7.`로 재번호·이동시켰다(convention WARNING 처분, 같은 diff 안).
    결과: 이 새로 쓴 코드 주석이 인용하는 "spec §R0"는 이 커밋이 끝나는 시점에 이미 존재하지
    않는 라벨이다 — `grep -rn "§R0" codebase/ spec/ plan/`(review/ 제외) 결과 이 한 줄만 남는다.
    같은 커밋 안에서 두 SoT(코드 인용 vs spec 실제 섹션 번호)가 서로 다른 번호를 가리키게 된
    것으로, "정정을 한 곳에만 했다"는 이 PR 자신의 주제가 그 정정 작업 **내부에서** 다시
    재현된 형태다. 동작에는 영향 없음(사람이 읽는 주석의 참조 라벨일 뿐이라 CRITICAL 은 아님).
  - 제안: `use-widget.ts:197`의 "spec §R0" → "spec §R7"로 정정.

## 4. plan 체크박스 — 실제 상태와 대체로 일치, 위 2번 항목의 수치 서브클로즈만 stale

`plan/complete/webchat-boot-apibase-scheme-validation.md`의 체크리스트 3항목 모두 `[x]`이고,
서술의 핵심 주장(판정=적용·구현+테스트 존재·근거를 §R7+JSDoc 에 남김)은 실제 코드·spec 상태와
부합한다. `§R0`→`§R7` 재번호도 체크리스트 항목 3(`:46`)에는 정확히 반영돼 있다. 유일한 흠은
위 2번 항목에서 지적한 항목 2(`:41`)의 "호출부 통합 2건" 수치 — 완료 여부(`[x]`) 판정 자체는
틀리지 않았으나 그 안의 세부 수치가 stale하다.

`plan/in-progress/webchat-auth-session-status-reconcile.md`도 이번 델타로 "완료 조건" 표에
새 행(`§applyConfig 조용한 early return`)이 추가돼(`:25`) 직전 라운드 WARNING(표 미반영)이
실제로 처분됐음을 확인했다 — 이 부분은 정확히 고쳐졌다.

## 요약

이번 델타(`99d3e9000`)의 핵심 기능 변경은 JSDoc 문구 정정 + 신규 e2e 테스트 1건 + spec 문서
동기화(§R0→§R7 재번호, `2-sdk.md` 상호참조 추가)이며, 새로 도입된 기능적 CRITICAL 은 없다.
다만 정정 작업 그 자체 안에서 이 PR 계열이 반복 겪어 온 "한 사실을 두 곳에 복제하고 한 곳만
고친다" 패턴이 **세 번째로** 재현됐다: (1) `spec_impact` frontmatter 가 이번 델타 자신이 새로
건드린 `2-sdk.md` 를 반영하지 못했고(게이트는 completeness 를 안 보므로 CI 는 안 막지만 선언
자체는 이제 부정확), (2) plan 본문의 "최종 450 passed(신규 8)"·"호출부 통합 2건"이 바로 이
델타가 추가한 9번째 테스트를 반영하지 못했으며, (3) `safeApiBase` JSDoc 이 인용하는 "spec §R0"
가 같은 커밋의 R0→R7 재번호 이후 존재하지 않는 라벨이 됐다. 세 건 모두 기능·동작에는 영향이
없는 documentation/plan-accuracy 급이라 WARNING 으로 처리했으며, 새 CRITICAL 은 없다.

## 위험도

LOW — 기능 회귀·spec 위반 CRITICAL 은 없음. 다만 WARNING 3건이 전부 "이 PR 스스로 반복
경계해 온 실패 형태의 재발"이라 다음 라운드에서 반드시 반영 확인이 필요하다.

STATUS: OK

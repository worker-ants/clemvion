# 요구사항(Requirement) Review — 2026/08/11 16_06_02 (최종 확인 라운드)

## 컨텍스트

직전 라운드(`15_50_53`)에서 본 reviewer 가 낸 WARNING 3건 — (1) `spec_impact` 에 `2-sdk.md` 누락,
(2) plan 검증 수치 stale("450 passed, 신규 8"), (3) `use-widget.ts` JSDoc 이 재번호된 뒤 죽은
`spec §R0` 를 인용 — 이 이번 델타(커밋 `4479e771b`)로 전부 처분됐다고 주장한다. 오케스트레이터
요청대로 세 처분을 각각 실측하고, plan 수치를 직접 세고, `spec_impact` 를 `git diff origin/main --
spec/` 결과와 대조하고, 마지막으로 plan 체크리스트 전수 이행 여부를 재확인한다.

## 검증 절차 (직접 실측, 전부 이 워크트리에서 재현)

1. `git show --stat 4479e771b` / `git show 4479e771b -- <6개 파일>` 로 처분 커밋의 실제 diff 확인.
2. `spec/7-channel-web-chat/4-security.md` 를 `Read` 해 `### R` 헤딩을 전수로 세고 `§R0` 잔존 여부를
   `codebase/`·`spec/`(전체) 대상 `grep` 로 확인.
3. `use-widget.ts` JSDoc 블록(166-203행 부근)을 직접 열어 인용 문구를 확인.
4. `use-widget.test.ts` 의 `mergeBootConfig` describe 블록과 `use-widget-eager-start.test.ts` 의
   `wc:boot` 스킴 검증 describe 블록을 `sed`/`grep` 로 `it(` 개수를 직접 세었다(추정이 아니라 실제
   라인 카운트).
5. `pnpm`/`npx vitest run` 을 이 워크트리(`codebase/channel-web-chat`)에서 **실제로 실행**해 통과
   개수를 직접 확인(이전 라운드들은 `node_modules` 미설치로 실행 불가했으나 이번엔 설치돼 있어
   실행 가능했다).
6. `git fetch origin main` 후 `git diff origin/main -- spec/ --stat` 로 실제 변경된 spec 파일 목록을
   뽑아 plan frontmatter `spec_impact` 와 문자열 단위로 대조.
7. `npx tsc --noEmit`, `npx eslint <3개 변경 파일>` 로 타입/lint 회귀 여부 확인.
8. `web-chat-sdk/src/bridge.ts`·`index.ts` 를 직접 열어 §R7/§1 표가 인용하는 "SDK 가 apiBase 를
   양쪽 경로로 보낸다" 주장을 소스로 재확인(spec fidelity 점검).
9. `git diff origin/main --stat` 전체로 이 PR 이 건드린 파일 전량을 확인해 plan 체크리스트 범위
   밖의 손실/누락이 없는지 최종 점검.

## 처분 1 — spec_impact 불완전 → 고침, 실측 일치

`plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter:

```yaml
spec_impact:
  - spec/7-channel-web-chat/4-security.md
  - spec/7-channel-web-chat/2-sdk.md
```

`git diff origin/main -- spec/ --stat` 결과 실제로 변경된 spec 파일은 정확히 이 두 개뿐이다
(`spec/7-channel-web-chat/2-sdk.md`, `spec/7-channel-web-chat/4-security.md`). 리스트 형식(bare
string·빈 배열 아님)도 Gate C 요건과 부합한다. **일치 확인.**

## 처분 2 — plan 수치 stale → 고침, 실측 일치(정적 카운트 + 실제 테스트 실행 둘 다)

- `use-widget.test.ts` 의 `describe("mergeBootConfig — ...")` 블록: `it(` **6개** (73/79/87/93/100/109행 부근,
  직접 카운트).
- `use-widget-eager-start.test.ts` 의 `describe("useWidget — wc:boot 의 apiBase 스킴 검증(호출부 배선)", ...)`
  블록: `it(` **3개**(4217/4232/4256행 부근, 직접 카운트) — 직전 라운드까지 2개였다가 `99d3e9000`
  커밋(round 3, vacuous e2e 처분)에서 세 번째("유효 쿼리 + 악성 boot → 쿼리 값이 이긴다")가 추가된
  것을 `git show 99d3e9000` 로 확인했다.
- 합계 6+3=9. plan 본문 "체크리스트" 항목과 "## 완료" 절 둘 다 "**단위 6건**...+ **호출부 통합
  3건**", "**451 passed**(신규 9 = 단위 6 + 호출부 통합 3)" 로 정확히 이 숫자와 일치한다.
- **실제 테스트를 이 워크트리에서 실행**해 재확인: `npx vitest run` (channel-web-chat) →
  `Test Files 23 passed (23)` / `Tests 451 passed (451)`. plan 이 주장하는 "451 passed" 와 **문자
  그대로 일치**(이전 라운드들은 `node_modules` 부재로 이 숫자를 실행 검증하지 못했다 — 이번
  라운드는 실행까지 확인한 첫 라운드다).
- `npx tsc --noEmit` 오류 0, `npx eslint use-widget.ts use-widget.test.ts use-widget-eager-start.test.ts`
  → warning 1건(4200줄 이전, 이 PR 범위 밖의 선재 `fetchMock` 미사용 경고, diff 게이트(`@@ -4200,3
  +4200,77`) 밖이라 이번 변경과 무관함을 `git diff` 로 확인) 뿐, 이번 PR 이 새로 만든 lint 오류 없음.

## 처분 3 — JSDoc 의 죽은 `§R0` → `§R7` 로 정정, 실측 일치

`use-widget.ts` 현재 JSDoc(safeApiBase 함수 바로 위)의 해당 문단:

```
> 첫 판은 "`applyConfig` 가 자기 자리에서 실패한다" 고 적었다 — **거짓이다.**
> 정정 이력은 `4-security.md` **§R7** 참고(같은 서술을 여기 되풀이하지 않는다).
```

`spec/7-channel-web-chat/4-security.md` 를 `### R` 헤딩 기준으로 전수 확인한 결과 `R1`~`R7` 이
순서대로 존재하고 `R7` 은 정확히 "`apiBase` 스킴 검증을 두 경로 모두에 거는 이유"다 — JSDoc 이
가리키는 앵커가 실재한다. `grep -rn "§R0|### R0"` 를 `codebase/`·`spec/` 전체에 돌린 결과 **0건**
(코드·spec 안에는 죽은 참조가 완전히 사라짐). 유일하게 남은 `§R0` 문자열은
`plan/complete/webchat-boot-apibase-scheme-validation.md:94` 의 "§R7(**당시** §R0)" — 이는 과거
시점을 명시적으로 표시하는 역사 서술이라 죽은 참조가 아니라 정확한 이력 기록이다. **일치 확인.**

## Plan 체크리스트 전수 이행 확인 (요청 4)

`plan/complete/webchat-boot-apibase-scheme-validation.md` 의 체크리스트 3항목:

1. `[x]` 스킴 검증 적용 여부 판정 — "정당한 상대경로/프록시 배포 없음"을 `widgetOrigin: originOf(base)`
   (`bridge.ts:203` 부근) 근거로 실측 확정. 코드로 확인됨.
2. `[x]` 구현 + 회귀 테스트 — `safeApiBase(raw, source)`/`mergeBootConfig` 구현 확인(`use-widget.ts:166-247`),
   호출부(`bridge.onBoot`)가 실제로 `mergeBootConfig(configFromQuery(), c)` 를 쓰도록 배선됨
   (`use-widget.ts:1343`) — 옛 인라인 spread 는 완전히 대체됨. 단위 6 + 통합 3 = 9건, 위에서 실행
   검증까지 마침.
3. `[x]` (미적용 시 근거 고정 — 해당 없음, 적용했으므로) — 적용 근거가 `4-security.md §R7` +
   `safeApiBase` JSDoc 양쪽에 실재함을 확인.

`git diff origin/main --stat` 전체(코드베이스 부분만) 를 확인한 결과 이번 PR 이 건드린 코드 파일은
정확히 `use-widget.ts`/`use-widget.test.ts`/`use-widget-eager-start.test.ts` 셋뿐이고, plan/spec
파일 4개(신설 completed plan, in-progress reconcile plan 갱신, in-progress 삭제, spec 2개) 외
스코프 이탈 변경은 없다 — plan 이 정의한 범위와 정확히 대응한다. `review/**` 산출물(대량)은 이
저장소 관행상 리뷰 라운드 산출물이 커밋되는 것이 정상이며 별도 검토 대상이 아니다.

TODO/FIXME/HACK/XXX 계열 미완성 마커는 변경된 3개 코드/테스트 파일 어디에도 없음(`grep` 0건).

## Spec fidelity — §R7/§1 표 주장의 소스 재확인

`web-chat-sdk/src/bridge.ts:198`(`resolveIframeTarget` 내부 `apiBase: config.apiBase` 를 iframe src
쿼리에 실음)와 `web-chat-sdk/src/index.ts:84,94`(`resolveIframeTarget` 호출 직후 같은 `config` 를
`bridge.post("wc:boot", config)` 로도 전송)를 직접 열어 "SDK 는 같은 apiBase 를 iframe 쿼리·`wc:boot`
양쪽으로 보낸다" 는 §R7/§1 표 주장이 코드와 정확히 일치함을 재확인했다. `safeApiBase` 함수 본문
(`new URL(raw)` + `protocol === "http:" || "https:"` 화이트리스트)도 라운드 1부터 문자 그대로
불변이고, 이번 델타(`4479e771b`)는 이 함수의 로직 라인을 전혀 건드리지 않았다(JSDoc 산문만 수정).

## 새로 발견된 CRITICAL / WARNING

없음. 오케스트레이터가 지목한 세 처분 전부 실측 확인됐고, 그 외 재검토에서도 새 결함을 찾지
못했다.

## 요약

이번 델타(`4479e771b`)는 직전 라운드 requirement WARNING 3건 — `spec_impact` 의 `2-sdk.md` 누락,
plan "450 passed(신규 8)" stale 수치, `use-widget.ts` JSDoc 의 재번호 후 죽은 `§R0` 인용 — 을
정확히 처분했다. `spec_impact` 는 `git diff origin/main -- spec/` 실측 결과와 문자열 단위로
일치하고, plan 수치("451 passed, 신규 9 = 단위 6 + 통합 3")는 정적 카운트뿐 아니라 이 워크트리에서
직접 실행한 `vitest run` 결과("451 passed")와도 정확히 일치한다(이전 라운드들이 `node_modules`
부재로 못했던 실행 검증을 이번엔 완료했다). JSDoc 의 `§R7` 참조도 실재하는 앵커를 정확히
가리키며, `§R0` 잔존 참조는 코드·spec 어디에도 없다(plan 의 역사 서술 1건은 "당시" 표기로 정확히
과거형임을 밝혀 죽은 참조가 아니다). plan 체크리스트 3항목은 실제 구현·테스트·spec 근거와
전수로 대응하며, 이번 PR 이 건드린 파일 범위도 plan 범위를 벗어나지 않는다. `tsc`/`eslint`
회귀 없음, TODO/FIXME 류 미완성 마커 없음. 새로 제기할 CRITICAL/WARNING 없음 — 요구사항 충족
관점에서 이 PR 은 수렴했다.

## 위험도

NONE

STATUS: OK

# 문서화(Documentation) 리뷰 — webchat-apibase-scheme (라운드 4, 델타 `4479e771b` 검증)

이 PR 은 이미 3라운드 문서 결함을 냈다(spec↔JSDoc 정정 누락, "자기 자리에서 실패한다" 거짓 문장의
4번째 복제본, 죽은 `§R0` 참조 6명 수렴). 이번 라운드는 그 세 결함이 실제로 처분됐는지, 그리고
plan 수치·spec_impact·§1 새 서술·`2-sdk.md` 코드펜스까지 요청받은 6개 항목을 **전수로** 직접
소스/커밋/실행으로 대조했다. `git restore`/`git checkout` 은 쓰지 않았고 파일은 `Read`/`grep`/
`vitest run` 으로만 확인했다(저장소 미수정).

## 검증 결과 (요청된 6개 항목)

### 1. `§R0` 를 가리키는 살아있는 참조가 0인가

**확인됨 — 0건.** `grep -rn "§R0" codebase/ spec/` 결과 0건. `codebase/channel-web-chat/src/widget/use-widget.ts:198`
은 이제 `> 정정 이력은 \`4-security.md\` **§R7** 참고`로 올바른 앵커를 가리킨다. 유일하게 문자열
`§R0`가 남은 곳은 `plan/complete/webchat-boot-apibase-scheme-validation.md:94`인데, 그 문장 자체가
`§R7(당시 §R0)`라고 명시해 **재번호 이전 시점의 역사적 인용**임을 밝히고 있어 예외 조건(시점 기록)에
해당한다. `spec/7-channel-web-chat/4-security.md`의 Rationale 섹션 헤딩은 `R1`~`R7` 순서로만 존재하고
(`grep -n "^### R"` 확인), `R7`이 파일 끝에 정상 append 돼 있다(저장소 관례 — R1 시작·끝에 append).

### 2. "`applyConfig` 가 자기 자리에서 실패한다" 거짓 문장의 모든 복제본이 사라졌는가

**확인됨 — 원 거짓 서술의 무정정 복제본 0건.** 저장소 전체(`codebase/`·`spec/`)를 `자기 자리에서 실패`로
grep한 결과 남은 것은 두 곳뿐이고, 둘 다 **정정하는 인용**이지 원 거짓 서술의 반복이 아니다:
- `codebase/channel-web-chat/src/widget/use-widget.ts:197` — `> 첫 판은 "\`applyConfig\` 가 자기
  자리에서 실패한다" 고 적었다 — **거짓이다.**`(부정문 + `§R7` 위임)
- `spec/7-channel-web-chat/4-security.md:296-297` — 같은 형식의 부정문(정정의 SoT)

3라운드에서 지적됐던 **4번째 복제본**(`use-widget.test.ts:89`의 무정정 테스트 주석, `// applyConfig
가 자기 자리에서 실패하도록 둔다`)은 `grep -n "실패" codebase/channel-web-chat/src/widget/use-widget.test.ts`
결과 더 이상 존재하지 않는다 — 그 자리는 이제 `sseErrorDetail`/`shouldAbortAfterSeed` 테스트로 대체돼
있고 원 주석은 삭제됐다.

### 3. plan 수치(451 / 신규 9 / 단위 6 + 통합 3)가 실제와 맞는가 — 직접 셌다

**확인됨 — 전부 정확.** 세 방식으로 교차 검증했다:
- **직접 실행**: `cd codebase/channel-web-chat && npx vitest run` → `Test Files 23 passed (23)` /
  `Tests 451 passed (451)`. plan(`plan/complete/webchat-boot-apibase-scheme-validation.md:77`)의
  "최종은 **451 passed**" 와 정확히 일치(추측이 아니라 이번 세션에서 직접 재실행 — 과거 라운드는
  `node_modules` 미설치로 실행 검증을 못 했다고 명시했는데 이번엔 가능했다).
- **직접 카운트**: `use-widget.test.ts`의 `describe("mergeBootConfig — ...")` 블록에 `it(` 6건
  (73/79/87/93/100/109행), `use-widget-eager-start.test.ts`의 `describe("useWidget — wc:boot 의
  apiBase 스킴 검증(호출부 배선)")` 블록에 `it(` 3건(4217/4232/4256행) — 합 9건. plan(:42)의 "**단위
  6건**(`use-widget.test.ts`) + **호출부 통합 3건**(`use-widget-eager-start.test.ts`)" 과 일치.
- 이전 라운드가 겪은 "448 → 450 → 451"의 단계적 stale 패턴(요청 4번 항목이었던 "448 passed" 문구)은
  이번엔 `plan/complete/webchat-boot-apibase-scheme-validation.md` 안에서 재발하지 않았다 — grep
  결과 "448"·"450" 잔존 0건, "451"·"신규 9" 만 남아 있다.

### 4. `spec_impact` 두 항목이 이 PR 이 실제로 건드린 spec 파일과 일치하는가

**확인됨 — 정확히 일치.** `plan/complete/webchat-boot-apibase-scheme-validation.md:8-10`의
`spec_impact: [spec/7-channel-web-chat/4-security.md, spec/7-channel-web-chat/2-sdk.md]`와,
`git diff origin/main...HEAD --stat -- spec/`가 보고하는 실제 변경 spec 파일(`2-sdk.md`,
`4-security.md` 딱 두 개, 다른 spec 파일 변경 없음)이 1:1 대응한다. bare string·빈 배열이 아니라
YAML 리스트 형식(Gate C 요건)도 충족한다.

### 5. `4-security.md §1` "정상 임베드에서 둘 다 순차 발동" 서술이 코드와 맞는가

**확인됨 — 코드와 일치.** 직접 두 파일을 열어 대조했다:

- `codebase/packages/web-chat-sdk/src/bridge.ts:192-204`의 `resolveIframeTarget`은 **모든** boot에서
  무조건 `apiBase`(+`trigger`)를 `URLSearchParams`에 실어 iframe src 쿼리로 만든다 — "샘플/직접
  로드 전용"이라는 조건 분기가 코드 어디에도 없다.
- `codebase/packages/web-chat-sdk/src/index.ts:80-94`의 `boot()`은 그 iframe을 먼저 주입한 뒤(iframe
  이 mount되어 위젯 쪽 React effect가 즉시 실행되는 시점) `bridge.post("wc:boot", config)`로 postMessage를
  **그 다음에** 보낸다 — 순서가 iframe 로드 → wc:boot 순.
- 위젯 쪽 `codebase/channel-web-chat/src/widget/use-widget.ts:1376-1380`의 "host 없이 직접 로드" 폴백은
  주석과 달리 **host 유무를 검사하지 않는다** — `if (fallback.apiBase && fallback.triggerEndpointPath)`
  만 검사하므로, SDK가 넣어준 쿼리값이 있으면 정상 임베드에서도 이 분기가 그대로 발동해 `runApplyConfig`를
  즉시 호출한다.
- 그 직후(또는 거의 동시에) 도착하는 `wc:boot`가 `bridge.onBoot`(`use-widget.ts:1342-1344`)을 통해
  `runApplyConfig(mergeBootConfig(configFromQuery(), c))`를 다시 호출해 세대 판정(`isStale`/`attempt`
  토큰, 이 파일의 기존 stale 가드)으로 최종 상태를 대체한다.

→ "정상 임베드에서 둘 다 순차 발동한다"는 §1 표(`4-security.md:39`)의 새 서술이 실제 실행 순서·조건과
line-level로 일치한다. 이 PR이 이미 한 번(§R0 원 서술) spec 서술 오류를 냈던 이력을 감안해 특히 꼼꼼히
봤지만, 이번 서술은 코드가 뒷받침한다.

### 6. `2-sdk.md` 주석이 이제 코드펜스 안에서 제대로 읽히는가

**확인됨 — 수정됨.** `git show 4479e771b -- spec/7-channel-web-chat/2-sdk.md` diff로 직접 대조하면,
수정 전 문구는 ` ```ts ` 코드펜스 **안**에 `API **origin**`(굵게 마크다운)과
`[4-security §1 \`apiBase\` 입력 검증 · §R7](./4-security.md)`(마크다운 링크 문법)를 TS 라인 주석
안에 그대로 썼다 — 코드펜스 내부이므로 렌더러가 이를 마크다운으로 해석하지 않고 `**origin**`·
`[...](...)`를 **리터럴 문자 그대로** 보여준다(사용자가 실제로 보는 API 문서 예시 코드에 깨진
마크다운 잔재가 노출됨). 현재(`spec/7-channel-web-chat/2-sdk.md:149`)는
`// API origin. 런타임 검증: http(s) 스킴만 허용 — 위반 시 그 필드만 무시(부팅은 계속). 4-security.md
§1·§R7 참조`로, 마크다운 문법 없는 순수 산문으로 바뀌어 코드펜스(147~159행) 안에서 정상적으로
평범한 TS 주석처럼 읽힌다. 코드펜스 시작/끝(````ts` / ` ``` `) 짝도 어긋나지 않았다.

## 새 CRITICAL

**없음.** 요청받은 6개 항목 전부 실측(직접 파일 열람·grep 전수·`git show`로 커밋 diff 대조·
`vitest run` 직접 실행) 결과 정확했다. 이 PR이 반복해 낸 세 가지 실패 형태(spec↔코드 정정 동기화
누락 · 거짓 문장의 미정정 복제본 · 재번호 뒤 죽은 참조) 모두 델타 `4479e771b`에서 처분됐고, 이번
라운드에서 재발하지 않았다.

## 그 외 관찰 (INFO, 신규 아님 — 참고용)

- **[INFO]** `mergeBootConfig`에 `@param`/`@returns` 태그 없음 — 라운드 1(`15_16_20`
  documentation)에서 이미 지적된 non-blocking 항목이며, 3라운드가 지나도록 변경되지 않았다(같은
  파일의 `safeApiBase`·`openStream` 등은 태그를 갖춘 것과 대비). 새로 발견한 것이 아니라 기존 관찰이
  여전히 유효함을 확인한 것뿐이다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:229`(JSDoc 시작)~`235`(`export function
    mergeBootConfig(`)
  - 제안: 여전히 blocking 아님. 다음에 이 함수를 편집할 때 `@param fromQuery`/`@param boot`/`@returns`
    세 줄을 추가하면 파일 내 일관성이 맞는다.

## 요약

요청받은 6개 검증 항목(죽은 `§R0` 참조 전수, "자기 자리에서 실패한다" 거짓 문장의 전 복제본, plan
수치 451/9/6+3, `spec_impact` 2건, `§1` "둘 다 순차 발동" 서술, `2-sdk.md` 코드펜스) 모두 소스
코드·커밋 diff·직접 테스트 실행으로 대조했으며 전부 정확했다. 특히 5번(§1 새 서술)은 이 PR이 이미
한 번 spec 서술 오류를 낸 이력이 있어 `resolveIframeTarget`·`use-widget.ts`의 실제 조건문까지 직접
추적했고, 코드가 "정상 임베드에서 두 경로가 순차 발동한다"는 서술을 정확히 뒷받침함을 확인했다. 3라운드
연속으로 잡혔던 문서 결함 클래스(정정 누락·복제본 잔존·죽은 참조)는 이번 델타에서 전수 처분됐다.
새 CRITICAL은 없으며, 유일한 잔여는 이미 3라운드 전부터 알려진 non-blocking INFO(`mergeBootConfig`
JSDoc 태그 누락) 하나뿐이다.

## 위험도

NONE

STATUS: OK

---
worktree: guide-error-code-truth
started: 2026-09-13
owner: developer
---

# 가이드가 이름 붙인 에러 코드 5종이 실재하지 않는다 — 그리고 그중 하나는 **화면에 아무것도 안 뜬다**

트래커 항목 *"유저 가이드가 존재하지 않는 에러 코드 5종을 이름으로 적는다"* 를 닫는다.

> **자기 정정** — 이 문단은 처음 *"그 자매 항목 「가이드 식별자 실재성 가드」"* 도 함께 닫는다고
> 적었다. **그런 트래커 항목은 없다**(실측: `plan/` 전체 grep 결과 이 파일 자신이 유일한 출현).
> 가드는 등재된 항목이 아니라 **이 배치가 스윕 결과를 보고 스스로 판단해 추가한 것**이다 —
> 없는 항목을 근거로 세우면 다음 사람이 그 항목을 찾으러 간다.

> **스코프 고지** — `#1328` 은 같은 스윕이 찾은 **오귀속**(`TRIGGER_NOT_FOUND` 이 존재하지만 그
> 엔드포인트가 안 냄)을 닫았다. 이 배치는 **실재하지 않는 이름**(축 1)이다 — 다만 아래 §A 에서
> 드러나듯 다섯 중 셋은 실은 오귀속이었다. 두 축이 깔끔히 갈리지 않는다.
>
> **트래커가 지목한 6파일보다 넓었다.** 다섯 토큰이 실린 MDX 를 전수로 세니 **9파일**이다 —
> `discord{,.en}` · `telegram{,.en}` · `slack{,.en}` 여섯이 `LLM_TIMEOUT`·`LLM_RATE_LIMIT` 를
> 인용한다. **그 여섯은 비대상이다**: 그 자리는 노드 실행 실패 분류를 서술하고 있고
> (`chat-channel/shared/execution-failure-classifier.ts` 가 소비), 코드도 층도 맞다.
> 넓다고 다 고치면 맞는 것을 망가뜨린다 — 후보마다 *"어느 층을 서술하나"* 를 물어 갈랐다.

착수하며 다섯을 하나씩 실측했더니 **셋 다 성격이 달랐고, 첫째는 문서 결함이 아니라 런타임
결함이었다.**

## A. Test Connection — 3중 계약 불일치, 사용자는 **이유를 못 본다**

가이드(`models{,.en}.mdx`)는 *"실패 시 내려오는 **에러 코드**는 LLM 클라이언트가 정규화한
값"* 이라며 5행 표를 싣는다(`LLM_AUTH_ERROR` 401 · `LLM_RATE_LIMIT` 429 · `LLM_MODEL_NOT_FOUND`
404 · `LLM_CONNECTION_ERROR` · `LLM_TIMEOUT`).

**실측하니 주어부터 틀렸다 — 이 엔드포인트는 코드를 내지 않는다.**
그리고 다섯 이름 중 **셋은 실재한다**(`LLM_RATE_LIMIT` 63건 · `LLM_CONNECTION_ERROR` 10 ·
`LLM_TIMEOUT` 9 — backend 소스 실측). 없는 것은 둘(`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`)
뿐이다. 즉 이 표의 결함은 *"없는 이름"* 이 아니라 **엉뚱한 층에 붙인 귀속**이다 — 그 셋은
워크플로우 **실행** 경로(`nodes/core/error-codes.ts`)의 코드이고 연결 테스트와 무관하다.
`LlmService.testConnection` 은 `{ success:false, error: sanitizeLlmErrorMessage(message) }` 를
돌려준다. `sanitize-error.util.ts` 가 **8갈래 고정 문장**으로 정규화한다(401/403/404/429·timeout·
ECONNREFUSED·ENOTFOUND·폴백). 표의 `type` 열(401/429/404)도 응답 상태가 아니다 — 응답은 200 이고
그 숫자들은 **provider 원문을 패턴 매칭하는 입력**이다.

### 그런데 그 문장조차 화면에 도달하지 않는다

| 층 | 필드 |
|---|---|
| 서비스 실제 반환 | `{ success, **error**?, dimension? }` |
| 선언 DTO `ModelTestConnectionResultDto` | `{ success, **latencyMs**?, **message**?, dimension? }` |
| 프런트엔드 소비 (`model-config-manager.tsx`) | `result.**message** ?? ""` |

세 층이 **서로 다른 이름**을 쓴다. 결과: 연결 실패 토스트가
`t("models.connectionFailed", { error: "" })` → **`"연결 실패: "`** — 콜론 뒤가 비어 있다.
백엔드가 공들여 만든 사유가 사용자에게 **한 글자도** 안 간다. 덤으로 DTO 는 한 번도 발행되지
않는 `latencyMs`·`message` 를 OpenAPI 에 광고하고, 실제로 나가는 `error` 는 선언에 없다.

> **왜 안 잡혔나.** 이 저장소에는 `assertMatchesContract`(값 vs 선언, 런타임)가 있는데
> **이 엔드포인트에 배선돼 있지 않다**(실측: 사용처는 일부 e2e 뿐). 정적 가드
> `swagger-dto-contract` 는 선언 vs 선언이라 원리적으로 못 본다.

### 처분

1. **세 층을 `message` 로 맞춘다** — DTO·FE 가 이미 그 이름이므로 서비스 한 줄이 최소 변경이다.
   한 번도 발행되지 않는 `latencyMs` 는 DTO 에서 뺀다(거짓 광고).
2. **`assertMatchesContract` 를 이 엔드포인트에 배선한다.** 가드를 새로 만들지 않는다 —
   이 클래스를 위한 정본 도구가 이미 있고 배선만 빠져 있었다.
   > **어느 층에 배선하나 — 체크리스트에 "e2e" 라고 적었지만 실측 후 바꿨다.**
   > dockerized e2e 는 `LLM_STUB_MODE=true` 라 `createClient` 가 캐시 검사보다 **먼저** stub 을
   > 돌려주고, stub 은 성공한다 — 즉 **결함의 경로(실패)에 e2e 로 도달할 수 없다**. 성공 경로에
   > 단언을 걸면 `message` 가 애초에 실리지 않으므로 이 결함에 대해 vacuous 하다.
   > 그래서 두 층에 걸었다: 서비스 단위 프로브(반환 객체 vs 선언)와 **컨트롤러 HTTP 왕복**
   > (`Test.createTestingModule` + supertest + 전역 `TransformInterceptor`). 후자는 mock 서비스가
   > 아니라 **진짜 `LlmService`** 를 DI 에 넣어 필드 이름 축에서 vacuous 해지지 않게 했다.
   > `#1328` 에서 *"HTTP 왕복은 e2e 가 필요하다"* 를 실측 없이 결론 냈다가 뒤집힌 것과 같은 자리다.
3. 가이드 표를 **사용자가 실제로 보는 것**으로 바꾼다 — 8갈래 문장과 각 의미. SoT 는
   `sanitize-error.util.ts`.

## B. run-results · error-handling — **은퇴한** 코드 2종 (4파일)

`NODE_EXECUTION_FAILED` · `INTEGRATION_ERROR` 는 지어낸 이름이 아니라 **폐기된 이름**이다.
`spec/5-system/3-error-handling.md §1.4` 가 명시한다:

> 구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준
> envelope 에 **더 이상 사용하지 않는다**.

같은 §1.4 가 **카테고리별 실재 코드표**를 갖고 있다(HTTP·Database·Email·LLM·Code·Sub-workflow).
즉 *"노드 핸들러가 예외를 던졌을 때"* 를 대표하는 **단일 코드는 없다** — 카테고리별로 갈린다.
가이드가 그 구조를 "대표 코드 하나" 로 뭉갠 것이 결함이다.

## C. integrations — `MAKESHOP_API_ERROR` (2파일)

error 포트 예시가 `{ error: { code: "MAKESHOP_API_ERROR" } }` 다. 실재하는 것은
`MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_4XX` · `MAKESHOP_5XX` · `MAKESHOP_CALL_FAILED` ·
`MAKESHOP_AUTH_FAILED` · `MAKESHOP_TRANSPORT_FAILED` · `MAKESHOP_RATE_LIMITED` 등이다.

> **처음 이 자리에 *"같은 파일이 자기를 반증한다 — `integrations.mdx` 의 cafe24 절이
> `CAFE24_404` 등으로 이미 맞게 적고 있다"* 고 썼다. 틀렸다.** 실측하니 `integrations.mdx` 의
> cafe24 절에는 **error 포트 코드 예시가 아예 없다**(`CAFE24_` 출현 0건). 맞게 적고 있는 것은
> **형제 페이지** `06-integrations-and-config/cafe24{,.en}.mdx` 다.
>
> 그 차이가 진단을 바꾼다 — 같은 파일 안의 불일치가 아니라, **베낄 미러가 그 파일에 없어서**
> 지어낸 것이다. 그래서 고침은 이름 치환에 그치지 않고 **코드 계열 설명 한 줄**을 함께 넣었다
> (형제 페이지로 링크). `#1328` 의 `backend-labels.test.ts`(한 파일이 자기를 반증)와는 다른
> 형태다.

## D. 가드 — 기계적 서명이 있고, **들어갈 가족도 이미 있다**

`#1329` 에서는 *"커서 디코더"* 에 정적 서명이 없어 가드를 안 만들었다. 여기는 다르다:
가이드가 에러 코드를 적는 자리는 **구조화돼 있다**.

> **`--impl-prep` 이 내 설계를 한 칸 바꿨다** (`review/consistency/2026/09/13/01_15_40`
> naming_collision WARNING#4·#5). 나는 이 가드를 `repo-guards/`(backend)에 새로 만들 생각이었는데,
> **같은 문제 영역의 가드 가족이 이미 있다** — `spec/conventions/user-guide-evidence.md` 가
> *"가이드가 거짓을 말하지 않는가"* 축의 build-time 가드 3건을 `codebase/frontend/src/lib/docs/
> __tests__/` 에 두고 **§2.1 에 관계표**까지 갖고 있다. 그중 `impl-anchor-existence.test.ts` 가
> 가장 가까운 자매다(*"가이드가 약속한 코드 symbol 실존"*).
>
> | 결정 | 이유 |
> |---|---|
> | **위치** = `codebase/frontend/src/lib/docs/__tests__/` | 가족이 거기 산다. `repo-guards/`(backend)에 두면 같은 축이 두 곳으로 갈린다 |
> | **중복 아님** | 자매는 `<ImplAnchor>` 의 `symbol` 을 보고, 이 가드는 **에러 코드 토큰**을 본다 — 같은 방향(가이드 → 코드), 다른 표면 |
> | **문서화 위치** | `error-codes.md` 가 **아니다** — 그 문서는 소유 범위를 *명명원칙/rename/historical-artifact* 로 스스로 못박았다. `user-guide-evidence.md §2.1` 관계표에 등재해야 하는데 그건 `spec/**` 이라 **planner 소관** → 등재 |

| 자리 | 형태 |
|---|---|
| `<FieldTable rows={[{ name: "CODE", … }]} />` | JSX 속성 안의 객체 리터럴 |
| `{ error: { code: "CODE" } }` | 예시 코드펜스 |
| `` NNN `CODE` `` | 산문 (`#1328` 이 이 축을 셌다) |

판정 축을 **"에러 코드 문맥에 놓인 토큰"** 으로 좁히면 `#1328` 스윕이 부딪힌 오탐(외부 어휘
`MESSAGE_CREATE`, 문서 플레이스홀더 `LABEL_KO`, 범주어 `SUB_WORKFLOW`)이 **구조적으로** 빠진다 —
허용목록이 필요 없다. 그게 이 가드를 만들 수 있는 이유다.

**베이스라인은 A·B·C 를 고친 뒤 0 이어야 한다.** 0 이 아니면 그 잔여가 이 배치의 누락이다.

### 축을 실제로 재고 두 번 고쳤다

| 축 | 후보 | 부재 | 채택 |
|---|---|---|---|
| 1 `<FieldTable>` 의 `name` | 19종 | 0 | ✓ |
| 2 `code:` 값 | 2종 | 0 | ✓ |
| 3 산문 백틱 (무조건) | 82종 | **1** | ✗ — 그 1건이 전부 오탐(`MESSAGE_CREATE`) |
| 3′ + 에러-코드 문맥만 | 39종 | 0 | ✗ — 실패 서술 표를 통째로 놓쳤다 |
| 3″ + 실패 어휘 문맥 | **66종** | 0 | ✓ |

두 번 고친 자리:

1. **문맥 신호가 좁았다.** `error.code`·"에러 코드" 만 보면 chat-channel 의 `executionFailed*`
   키 표(6파일)가 코드를 괄호로 인용하는 자리가 통째로 빠진다 — 39종. 실패 어휘를 넣어 66종,
   **부재는 그대로 0**. 좁은 판이면 놓쳤을 자리를 뮤턴트(`D4`)로 양성 확인했다.
2. **`\b` 가 한국어 뒤에서 성립하지 않는다.** 표 헤더 판정을 `(?:코드|Code)\b` 부분일치로
   짰는데 JS 정규식의 `\b` 는 ASCII 워드 문자로만 정의되므로 **한국어 헤더가 조용히 빠졌다**.
   Python 으로 먼저 실측할 때는 `re` 가 유니코드 인식이라 **차이가 안 보였다** — 프로토타입
   언어와 구현 언어가 다르면 정규식 의미가 갈린다. 지금은 셀 정확일치로 바꿨다.

**전수 열거(82종) + 허용목록도 검토했고 기각했다.** 미검출 구멍은 없어지지만 판정 기준집합을
넓혀야 한다 — "가이드의 모든 대문자 식별자" 를 대상으로 하면 frontend 전용 상수가 오탐이 되고,
그걸 막으려 frontend 소스를 기준집합에 넣으면 **가이드가 인용한 이름이 프런트 라벨 맵으로
자기를 증명**한다. backend-only 기준집합이 옳은 것은 대상이 **에러 코드**일 때뿐이다.
(실측으로 확인: 기준집합에 frontend 를 넣어도 오늘은 GREEN — 넓히는 실수는 **조용히** 통과한다.)

### Planned 로드맵 코드명 처리 방침 (`--impl-prep` rationale_continuity INFO#2)

`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND` 는 `7-llm-client.md §6` 에 **Planned** 로 실재하는
로드맵 이름이다. 가드의 술어는 *"backend 소스에 존재하는가"* 이므로 Planned 코드는 **잡힌다** —
그리고 **그게 맞다**: 유저 가이드는 *현재 동작*을 서술하는 문서이고, 미구현 코드를 에러 코드
표에 넣는 것이 바로 이 배치가 고치는 결함이다.

**탈출구를 만들지 않는다.** 훗날 가이드가 로드맵을 명시적으로 소개해야 하면 그때 RED 가 뜨고
사람이 판단한다 — 허용목록을 미리 파 두면 *"Planned 니까"* 로 오늘의 결함이 다시 들어온다.

## E. `--impl-prep` 결과 — **BLOCK: NO** (Critical 0 · WARNING 6 · 위험도 MEDIUM)

`review/consistency/2026/09/13/01_15_40`. 여섯 중 둘은 위 §D 에 반영했고, 나머지는 아래.

| # | 지적 | 처분 |
|---|---|---|
| 1 | §1.4 카탈로그가 `CAFE24_*`/`MAKESHOP_*`/`OAUTH_*` 를 통째로 누락 — **§C 의 결함이 정확히 이 사각지대에서 났다** | planner 등재 |
| 2 | LLM 도메인 코드 2종(`LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED`)도 §1 미등재 | planner 등재 (1과 한 턴) |
| 3 | **`testConnection` 실패 응답 필드가 어느 spec 표에도 없다** — 5개 checker 전원이 짚었다 | planner 등재. `7-llm-client.md` 는 spec-linked 라 `--impl-done` 에서 재조우할 것이다 |
| 6 | 트래커의 처분 제안(*"수렴 코드 `LLM_CONNECTION_ERROR` 를 적어라"*)이 **내 실측에 반증됐다** | 체크박스만 바꾸지 말고 **그 문장을 취소선+정정** |

> **3번이 이 배치의 구조적 원인이다.** 형제 엔드포인트 `/api/integrations/:id/test` 는
> `2-navigation/4-integration.md §9.1` 에 `{success, code, message}` 로 실패 shape 이 문서화돼
> 있는데, LLM 쪽은 성공 케이스만 적혀 있다. **앵커가 없으니 가이드가 지어냈다.** 코드를 고치는
> 것만으로는 다음 사람이 같은 자리에서 또 지어낼 수 있다.
>
> 6번은 이 저장소가 반복해 온 형태다 — *"체크박스만 바뀌고 근거 문장이 낡은 채 남는다."*
> `#1329` 에서도 같은 지적을 받았다.

## F. 등재만 하는 것

- `ERROR_KO` 매핑 미배선(`#1328` 등재분)은 이 배치와 **같은 병**이다 — 백엔드가 만든 사용자
  안내가 화면에 도달하지 않는다. 다만 그쪽은 *"코드를 UI 에 노출할 것인가"* 라는 제품 결정이
  선행이고, 여기 §A 는 **이미 노출하기로 한 문장이 버그로 사라진** 경우라 성격이 다르다.

## 체크리스트

- [x] A: 서비스 반환 필드를 `message` 로 · DTO 에서 `latencyMs` 제거 (두 자매 DTO + FE 타입)
- [x] A: `assertMatchesContract` 배선 — ~~e2e~~ **단위 프로브 + 컨트롤러 HTTP 왕복**
      (e2e 는 `LLM_STUB_MODE` 때문에 실패 경로에 도달 불가 — 위 §A 처분 2 참조)
- [x] A: 회귀 테스트 — 수정 전 RED 확인 (`error [undeclared]`)
- [x] A: 가이드 표를 8갈래 문장으로 (`models{,.en}.mdx`)
- [x] A: FE 테스트가 지어낸 `latencyMs` 픽스처를 실재 필드 `dimension` 으로
- [x] B: `run-results{,.en}.mdx` · `error-handling{,.en}.mdx` 의 은퇴 코드 2종
      (노드 수준은 **카테고리별**이라 대표 코드 행을 지우고 종류별 표로)
- [x] C: `integrations{,.en}.mdx` 의 `MAKESHOP_API_ERROR` → `MAKESHOP_404` + 계열 설명
- [x] D: 가드 + 대조군 fixture (`guide-error-code-{scan,existence}`) — 베이스라인 0
- [x] D: 뮤테이션 — **전 16건 중 RED 12 · GREEN 4**, 넷 다 사유 기록
      | 생존 | 왜 정상인가 |
      |---|---|
      | DTO 에 생산자 0건인 키를 되살림 | **선언** 쪽 변경이라 런타임 검사가 원리적으로 못 본다. grep 이 유일한 그물 — 이 GREEN 이 내가 테스트 주석에 쓴 반대 주장을 반증했다 |
      | 스캐너 블록 재배치 | 의미 동등한 no-op 이었다(무효 뮤턴트) |
      | 기준집합에서 `packages` 제거 | 오늘 인용된 코드 중 packages-only 가 없다. 그래도 유지 — 그쪽이 `EXPR_*` 를 정의하므로 좁히면 훗날 실재 코드에 RED 가 난다 |
      | 기준집합에 frontend 추가 | **넓히는 실수는 조용히 통과한다**는 증거. 기각 근거를 데이터로 고정 |
- [x] E: 트래커 종결 + 반증된 처분 문장 취소선
- [x] `/consistency-check --impl-prep spec/5-system/`
      `review/consistency/2026/09/13/01_15_40` — **BLOCK: NO** (Critical 0 · WARNING 6).
      둘은 §D 설계에 반영(가드 위치·Planned 방침), 넷은 §E.
- [x] E: planner 항목 3건 등재 (§1 카탈로그 누락 · `testConnection` shape 미문서 · §2.1 관계표)
- [ ] `.claude/tools/run-test-all.sh`
- [x] `/ai-review` (`review/code/2026/09/13/10_12_19` — 14 reviewer 전원, **Critical 0** ·
      WARNING 5 · LOW) + `--impl-done spec/5-system/`
      (`review/consistency/2026/09/13/10_12_54` — **BLOCK: NO** · Critical 0 · WARNING 5)

## G. 리뷰 라운드 1 — 지적 10건 처분

**가장 아픈 지적은 내 주장의 마지막 층이 비어 있었다는 것이다.** 이 PR 은 *"실패 사유가 화면에
도달하지 않았다"* 를 고친다고 말하면서, 정작 그 문장을 **렌더링하는** 컴포넌트
(`model-config-manager.tsx`)의 실패 경로 테스트가 **0건**이었다 — `success: true` 케이스만 셋.
백엔드 계약 테스트도 API 클라이언트 픽스처 테스트도 그 파일을 로드하지 않으므로 그 공백을
**원리적으로** 못 본다. 회귀 방지 체인의 마지막 고리가 없는 채로 "고쳤다" 고 적을 뻔했다.

| 지적 | 처분 |
|---|---|
| testing W#2 — UI 실패 경로 무테스트 | **고침**. 실패 토스트가 사유를 포함해 호출됨을 **정확 문자열**로 단언 + 사유가 빈 경우 대조군. 뮤턴트(컴포넌트를 다시 `result.error` 로)에 RED 확인 |
| architecture W#1 — 8갈래 문장이 수기 사본이라 무가드 | **고침**. `guide-sanitized-message-parity.test.ts` 신설 — SoT 반환 리터럴 8개를 텍스트로 추출해 `models{,.en}.mdx` 표와 **양방향** 대조(표→SoT · SoT→표). 뮤턴트 2건 RED |
| api_contract W#3 — 형제 DTO 가 `code` 미선언 | **부분 고침**. `code?: string` 선언(26곳 발행 · spec §9.1 이 이미 문서화). MCP 전용 3종은 DTO 신설이 필요해 트래커 등재 |
| maintainability W#4 — 시그니처 중간 6줄 주석 | **고침**. JSDoc 으로 이동 + `@returns` 에 실패 shape 명기 |
| maintainability W#5 — `collectBackendTokens(files)` 오명명 | **고침** → `fileTexts`(값은 파일 **내용**) |
| cross_spec W#1 — `LLM_RATE_LIMIT` 이 두 표에 중복 | **고침**. **내가 이 라운드에 만든 자기모순**이다 — 2단 구조를 도입하면서 노드 표에 넣고 엔진 표에서 지우지 않았다. spec §1.4 엔진 표에도 없다 |
| rationale W#2 — `nodeName` 잔존 | **고침** → `nodeLabel`. spec §2.2 가 2026-08-17 에 이미 정정했고, 실측 재확인(backend emit `nodeName` 0 · `nodeLabel` 57). **바로 옆 `code` 를 고치면서 지나쳤다** |
| plan_coherence W#3 — 같은 절 겨냥 plan 3건 상호 참조 부재 | **고침**. 내 등재 항목에 나머지 둘의 파일·줄을 실측해 병기 |
| INFO#7 — `api-endpoint` 분기 주석이 낡음 | **고침**. *"아직 실사례 없음"* 이 이 PR 의 앵커로 깨졌다. 다만 실 콘텐츠 커버리지는 **우연**이라 합성 케이스는 남긴다고 적었다 |
| INFO#9 — 축 1 이 줄 단위라 여러 줄 행은 놓침 | **경계를 테스트로 고정**. 놓치는 것 자체를 단언해 다음 사람이 추적하지 않게 |

세 지적(`--impl-done` W#4·W#5 · 그리고 W#3 의 spec 편집분)은 **이미 planner 등재분**이라 무조치.

- [x] 리뷰 라운드 1 처분 후 뮤테이션 3건 — 전부 RED (원 결함 재도입 · SoT 변경 · 표 행 삭제)

## H. 리뷰 라운드 2 — 지적 5건 처분 (Critical 0)

`review/code/2026/09/13/10_40_34` (14 reviewer 전원 · Critical 0 · WARNING 3 · LOW) +
`review/consistency/2026/09/13/10_41_13` (**BLOCK: NO** · Critical 0 · WARNING 4).

**이번 라운드의 발견은 전부 "라운드 1 에서 내가 만든 것" 이다** — 새 결함이 아니라 내 수정의
뒷정리다. 발견의 성격이 동작(라운드 1: UI 무테스트) → 구조(가드 부재) → **문서·배선**(라운드 2)
으로 내려왔다. 정지 규칙이 예상한 진행이다.

| 지적 | 처분 |
|---|---|
| convention W#1 — `code` 의 JSDoc 에 내부 서사 | **고침**. `swagger.md §3` 은 *"플러그인이 JSDoc 을 `description` 에 그대로 싣는다 → 경위·리뷰 참조는 그 위 `//` 에"* 라고 명시한다. **같은 파일 `meta` 에는 이 분리를 맞게 적용해 놓고 `code` 에서 어겼다** — 자기모순 |
| testing W#2 — 형제 DTO 에 계약 검사 미배선 | **고침**(등재로 미루지 않았다). `pending_install` 케이스가 이미 `{success:false, code, message}` 를 내고 있어 그 자리에 `assertMatchesContract` 를 걸었다. **성공 경로는 아직 못 건다** — MCP 3종이 미선언이라 지금 걸면 그 자리에서 RED 다. 그 사유를 테스트 주석에 적었다 |
| scope W#1 — CHANGELOG 가 `meta` 제거·`code` 추가 누락 | **고침**. 제목이 *"필드 2종 제거"* 로 못박혀 있었는데 라운드 1 이 형제 DTO 까지 범위를 넓혔다. 두 엔드포인트를 갈라 적고, `code` 는 **없던 필드가 생기는 게 아니라 나가던 필드가 문서에 보이는 것**임을 명시 |
| user_guide_sync W#3 · convention W#2 (양 게이트 동시 지적) | **고침**. 내 planner 등재 문구가 가드 **하나만** 적고 있었다 — 둘째 가드는 라운드 1 이 낳았는데 등재는 스냅샷에 멈춰 있었다. 그대로 두면 관계표가 3→**4건**으로 마감된다(정답 5건) |
| SPEC-DRIFT · 나머지 | **무조치** — 이미 planner 등재분 |

> **리뷰가 자기 과거 지적을 하나 철회했다** (INFO#5). 라운드 2 의 documentation 이 라운드 1 의
> maintainability WARNING#1(*"근거 주석이 시그니처를 끊는다"*)을 *"부정확한 서술이었다"* 고
> 적었는데, **그건 라운드 1 이 이미 고친 뒤의 코드를 본 것**이다. 원 지적은 옳았다(주석이
> 파라미터 목록 안에 있었다). 이 문장을 근거로 되돌리지 말 것.

- [x] 라운드 2 뮤테이션 2건 — `code` 선언 제거 **RED**(새 배선이 문다) · `meta` 되살리기
      **GREEN**(선언-쪽 과잉은 런타임이 원리적으로 못 본다 — 세 번째 재확인)

### 정지 규칙 (라운드 2 **결과를 보기 전에** 선언)

라운드 1 은 `codebase/**` 를 고쳤으니 리뷰 시계가 낡았다 — 한 라운드 더 돈다. 종료 조건:

- **Critical 0** 이고, 모든 발견이 (a) 이미 planner 등재분이거나 (b) `plan/**`·`review/**` 만
  고쳐서 닫히는 것 — 즉 **`codebase/**` 수정 0 으로 끝나는 라운드**.
- 라운드 2 가 새 `codebase/**` 발견을 내면 고치고 라운드 3.
- 라운드 3 이 또 `codebase/**` 발견을 내되 그 성격이 **주석·문서**면(동작·구조가 아니면)
  고치지 않고 등재하고 멈춘다 — 그 지점부터는 수렴이 아니라 무한 루프다.

근거: `#1308` 이 같은 자리에서 4라운드를 돌았고, 그때 배운 것이 *"발견 0"이 아니라 **발견의
성격**(동작→구조→문서)으로 판단하라* 다. 라운드 1 의 발견은 이미 동작(UI 무테스트)→구조
(가드 부재)→문서(주석 낡음) 순으로 내려왔다.

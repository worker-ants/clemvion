# RESOLUTION — `14_55_29` (+ consistency `14_55_31`, `--spec` `15_06_43`)

ai-review **CRITICAL 0 / WARNING 6**(코드 4 + SPEC-DRIFT 2). 코드 4건 조치, SPEC-DRIFT 2건은
planner 인계 등재. `--spec` `15_06_43` CRITICAL 1 + WARNING 9 도 함께 처리.

## 코드 WARNING

### W1 — REST 경로에 깊이 sweep 이 없었다 (testing·security·architecture 수렴)

**조치 완료.** WS 경로에는 `it.each` sweep 이 있는데 REST 에는 없었다. 두 경로는 **순서가
반대**(WS: redact→strip / REST: strip→redact)라 한쪽이 다른 쪽을 대신하지 못한다.

`strip-external-only-fields.spec.ts` 에 `MAX_REDACT_DEPTH` 상대값 sweep 추가.

**판별력을 재보니 두 sweep 의 판별 구간이 다르다:**

| | 판별하는 depth |
|---|---|
| WS sweep | `0` · `MAX-5` · `MAX-3` |
| REST sweep | `0` · `MAX-5` (— `MAX-3` 부터는 `deepRedactSecrets` 가 먼저 막는다) |

자매의 경계 연산자가 `>=`(REST) vs `>`(WS)로 달라서다. **"한쪽 sweep 이 다른 쪽을 대신
못 한다" 는 리뷰어 주장의 근거가 정확히 이 차이**였고, 재보기 전엔 나도 몰랐다.

### W2 — 정정한 문장과 정정 안 한 문장이 한 커밋에 공존

**조치 완료.** 두 갈래였다:

- **인과 서술** — "자매가 **먼저** collapse 하니 안전" 이라 **한쪽 순서만** 설명했는데,
  REST 호출부가 정확히 반대 순서다. 순서 무관 서술로 고쳤다("먼저든 나중이든 그 깊이에서는
  둘 중 하나가 객체를 없앤다").
- **`@param maxDepth`** — 파일 상단에서 이미 정정한 *"같은 값·같은 경계 연산자"* 가 여기
  그대로 남아 있었다. 상단 절을 참조하도록 좁혔다.

### W3 — 함수명이 실행 순서를 거꾸로 읽히게 했다

**조치 완료.** `redactAndStrip` → `stripAndRedact`(실제 순서는 strip 먼저).

> 개명 후 **spec 에 남은 옛 이름 참조 1건을 잡았다.** 직전 라운드에 "커밋 직전 이번 diff 의
> JSDoc 을 훑는다" 를 절차로 넣었는데, 그 첫 적용에서 걸렸다.

### W4 — 함수를 옮긴 자리에 orphan JSDoc

**조치 완료.** 붙을 선언이 없어 **바로 아래 KB union 의 문서로 읽혔다.** 라인 주석으로 전환.

## SPEC-DRIFT 2건 (W5·W6) — planner 인계

§R17 이 `getStatus` 를 "secret-shape 만 치환" 으로, WS §4.4 가 "strip 대상은 본 WS 이벤트
필드뿐" 으로 서술한다. 둘 다 **코드가 spec 을 앞지른** 상태다. draft (7) 에 등재됨.

## `--spec` `15_06_43` — draft 자체의 결함

### CRITICAL — `turnDebug` 처분이 미확정이었다

**조치 완료(범위 확정형).** (1)을 철회해 §6.2 안쪽을 건드리지 않으므로 **이 draft 가 만드는
어떤 spec 문장도 top-level `turnDebug` 를 문서화하지 않는다** — 충돌이 고착될 경로가 없다.
그 결론을 본문에 못박고 `[x]` 로 닫은 뒤, 충돌 자체의 해소는 **별건**으로 재등재했다
(카운트 밖으로 새지 않게).

### W4 — title·Overview·Rationale 이 철회된 결론을 그대로 말했다

**조치 완료.** (1)을 철회했는데 제목은 여전히 *"실측 shape 으로 재작성"*, Overview 는
*"안쪽이 통째로 다르다"*, Rationale 은 *"왜 예시를 실측으로 맞추나"* 였다. 셋 다 고치고
Rationale 의 적용 범위를 **blockquote 로 한정**했다.

### W2·W6 — `error.code` 파급

**조치 완료.** 부재 표현을 **`null` 로 확정**(형제 `nodeId` 관례와 통일, §5.4 가 근거를
요구한다). 파급 2곳 등재 — `1-data-model.md §2.14` "구조" 행, `15-chat-channel.md` R-CC-15
(closed-enum 분류 입력이라 `null` 흡수 여부 **확인 전엔 (4) 를 완료로 보지 말 것**).

### W1 — 대조표가 성격이 정반대인 것을 한 행에 뭉쳤다

**조치 완료.** `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 은 WS §4.4 가 **소유를 선언한**
필드라 EIA 가 안 다루는 게 정상이고, `turnDebug` 만 진짜 gap 이다. 한 행으로 두면 (3) 집행
시 과대 스코프로 읽힌다.

### W9·INFO 1

- §R17 재서술이 형제 트래커의 **열린 항목**(`nodeOutput 키-allowlist 잔여`)을 지우지 않도록
  경고 등재 — 이번 정정은 "`llmCalls` 는 삭제된다" 를 더하는 것이지 allowlist 가 생긴 게 아니다
- 형제 plan 각주를 "포함한다"(미래형)로 적었는데 **이미 달았다**(`7fa12301c`) → 시제 정정

## 검증

- 전체 백엔드 **423 suites / 8656 passed** · lint(`--max-warnings 0`) · ratchet 199/38
- REST sweep 판별력 실측(뮤턴트에서 `0`·`MAX-5` RED)

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| ai INFO 1 (REST strip 비용) | 요청당 1회라 절대 비용 낮음. 폴링이 늘면 REST 전용 A/B |
| ai INFO 3 (`stripDeep`↔`sanitizeInner` 스켈레톤 중복) | 파일 분리로 짝점검이 약해진 건 맞다. `@see` 상호참조는 다음 편집 때 |
| ai INFO 4 (`stripAndRedact` null 분기 미실행) | `outputData: null` fixture 추가는 저비용 — 다음 라운드 |
| `--spec` INFO 2·4 | `writeOnly` 데코레이터·SIGTERM 경로는 해당 항목 구현 시점 사안 |

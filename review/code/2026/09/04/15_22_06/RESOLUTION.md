# RESOLUTION — 2R (`15_22_06`)

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W2 (side_effect) | `ExecutionDto` 의 "tsc 가 검증했다" 가 **노출 경로 4개 중 1개**에서만 성립 — `stop`/`getChain`/`reRun` 은 엔티티 파생 `Omit` 타입을 반환해 DTO 선언과 구조적으로 무관 | **`ExecutionDto` 10곳을 되돌렸다.** 배치가 15 → 5 로 줄었다 |
| W4 (testing) | `ExecutionDto` 에는 `createDocument()` 기반 스키마 테스트가 **아예 없다** | 되돌렸으므로 이 PR 범위 밖. **2단계 항목에 신설 요구를 명시 등재** |
| W3 (maintainability) | 새 `required` 가드가 필드 목록을 `it.each` 와 `arrayContaining` **두 곳에 하드코딩** | `NULL_PRESENT_FIELDS` 상수로 추출해 두 단언이 공유 |
| W1 (requirement) | plan `## 종결 조건` 요약이 실제 체크박스와 불일치 — 닫힌 3건을 열려 있다 하고, 새로 연 2건이 빠짐 | 실제 열린 **4건**의 표로 교체(트랙·선행 조건 포함) |

## W2 — 68곳에 적용한 기준을 나 자신에게도 적용했다

직전 라운드에서 68곳을 되돌린 근거는 *"DTO-typed 대입 지점이 없어 tsc 가 검증하지 않는다"*
였다. 리뷰어가 **`ExecutionDto` 도 같은 상태**임을 지적했다 — 목록 경로(`toExecutionDto`)만
`ExecutionDto` 로 조립되고 나머지 셋은 `ResponseExecution`(엔티티 `Omit`)을 반환한다.

확인했다. `executions.service.ts` 는 `select(['e.id', …])`·`select: { id: true, … }` 같은
부분 선택도 쓴다 — "엔티티라 키가 항상 있다" 로 넘길 수 없다.

→ **되돌렸다.** 남은 5곳(`ExecutionStatusDto`)은 노출 경로가 `getStatus()` **하나뿐**이라
주장이 성립한다(리뷰어 INFO#9 가 같은 판정).

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,322건**
- build: **PASS**
- e2e: **PASS** — 292건
- 타입체크 ratchet: **baseline 일치** (197/36)

## 보류·후속 항목

**§5.4 drift 2단계 — 검증자 없는 응답 DTO 78곳** (패스스루 68 + `ExecutionDto` 10).
`spec-draft-nullable-notation-followups.md` 에 등재. `ExecutionDto` 는 형태가 달라 **네 노출
경로를 한 타입으로 모으는 것이 선행**이고, 스키마-레벨 테스트 신설도 함께 요구된다.

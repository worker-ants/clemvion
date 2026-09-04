# RESOLUTION — `14_54_36`

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W1 (testing) | *"`tsc` 가 판정자였다"* 는 검증이 **엔티티를 그대로 반환하는 컨트롤러에는 적용되지 않는다** — DTO-typed 대입 지점이 없어 타입체커가 발동하지 않는다 | **배치를 83곳 → 15곳으로 좁혔다.** 도달성을 재 보니 tsc 가 실제로 검사한 것은 15뿐이었다. 68곳을 되돌리고 검증자와 함께 2단계로 등재 |
| W2 (testing) | 실제 Swagger 문서를 빌드하는 유일한 테스트가 **이 PR 이 바꾸는 축(`required`)을 단언하지 않는다** | `it.each` 를 3→5필드로 넓히고 **`required` 배열 단언**을 추가. 뮤테이션으로 검증 |

## W1 — "오류 0건" 을 잘못 읽었다

83곳을 뒤집고 `tsc --noEmit` 이 **비-spec 오류 0건**을 내자 "83필드 전부 상시 존재임이
증명됐다" 고 적었다. **틀렸다.**

도달성을 계산하니(비-DTO 파일의 타입 위치에 나타나는 DTO 를 루트로, 필드 타입 참조로 폐포)
**83 중 tsc 가 도달한 것은 15**뿐이었다. 나머지 68은 컨트롤러가 엔티티를 그대로 반환해
**DTO-typed 대입 지점이 아예 없다** — 오류 0건은 *"전부 옳다"* 가 아니라 **"대부분
검사되지 않았다"** 였다.

**대체 논거도 실측이 부정했다.** "엔티티를 반환하니 모든 컬럼이 키로 실린다" 를 확인하려
부분 선택을 셌더니 `notifications` 4곳 · `alerts` 2곳 · `triggers` 1곳 · `auth-configs` 1곳이
`select:`/`qb.select()` 를 쓴다. 키 부재가 가능하므로 `required: true` 를 주장할 수 없다.

→ **68곳 되돌리고 2단계로 등재.** 그 단계는 표기 정리가 아니라 **계약 검증 도입**이다 —
리뷰가 짚은 `AlertRuleDto.threshold: number` vs 엔티티 `string`(numeric 컬럼)처럼, 반환
타입을 명시하면 실재하는 DTO↔엔티티 불일치가 드러난다.

## W2 — 두 축이 갈린다 (예측 / 실측)

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| `currentNode` 를 `@ApiPropertyOptional` 로 되돌림 | `required` 단언만 RED, `nullable` 단언은 GREEN | **RED 1건 / 19 pass — 정확히 그 갈림** |
| 원복 | GREEN | **GREEN 20건** |

`@ApiPropertyOptional` 은 `nullable` 을 그대로 두고 `required` 만 뺀다. `nullable` 만 보는
단언은 그 회귀를 **통째로 놓친다** — 실제로 이 다섯 필드가 정정 전 그 상태였다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,322건**
- build: **PASS**
- e2e: **PASS** — 292건
- 타입체크 ratchet: **baseline 일치** (197/36)

## 보류·후속 항목

- **패스스루 응답 DTO 68곳** — `spec-draft-nullable-notation-followups.md` 에 2단계로 등재.
  검증자((a) 컨트롤러 반환 타입 명시 또는 (b) 응답 대조 테스트) 없이는 진행하지 않는다.

# RESOLUTION — `16_29_50`

ai-review **CRITICAL 0 / WARNING 1**. 조치 완료. INFO 13건은 전부 이월·재확인성이라 넘긴다.

수렴 판정: 발견의 성격이 **동작 → 구조 → 문서**로 내려왔다. 이번 라운드의 유일한 WARNING 은
내가 직전 라운드에서 **새로 추가한 테스트의 타이틀 렌더링**이고, strip 로직 자체는 한 글자도
바뀌지 않았다(security/architecture/scope/maintainability/api_contract 공통 확인).

## W1 — `it.each` 타이틀 placeholder 수가 인자 수와 어긋났다 (documentation)

**조치 완료.** 지적은 맞다. 다만 **기전은 리뷰어 설명과 달랐고, 그 차이가 수정 방법을 갈랐다.**

리뷰어: *"`util.format` 이 두 번째 `%s` 에 `status` 를 채우고 `field` 는 문자열 뒤에 그대로
붙는다."* → 추론하지 않고 프로브로 확인했다:

| 타이틀 | 인자 | 렌더링 |
|---|---|---|
| `one:%s` | `['A','B','C']` | `one:A` |
| `two:%s\|%s` | `['A','B','C']` | `two:A\|B` |
| `three:%s\|%s\|%s` | `['A','B','C']` | `three:A\|B\|C` |

**jest 는 남는 인자를 뒤에 붙이지 않고 버린다** (`util.format` 과 다르다). 따라서:

- 자매 블록(668행, `%s` 1개 / 인자 3개)은 **정상**이다 — 리뷰어가 이쪽을 "올바른 선례" 로
  지목한 것도 맞다. 남는 인자가 붙지 않으니 `completed — terminal outputData …` 로 렌더링된다
- 내 블록은 `%s` 2개가 `[label, status]` 를 받아 **`result` 대신 `completed` 가 찍혔다**

**수정**: 튜플 순서를 `[label, field, status]` 로 바꿔 타이틀에 띄우고 싶은 둘을 앞에 뒀다.
`%s` 를 3개로 늘리는 대안도 있었지만 `label` 과 `status` 가 같은 문자열이라 `completed(completed)`
로 중복된다. 순서를 의도적으로 잡은 이유는 주석으로 고정했다 — 안 적으면 다음 사람이
"자연스러운 순서" 로 되돌린다.

> **교훈**: 리뷰어 지적이 맞아도 **기전 설명까지 맞는 것은 아니다.** 여기서 기전을 그대로
> 받았다면 "`field` 가 뒤에 붙으니 `%s` 를 하나 더" 라는 잘못된 수정을 했을 것이다.
> 4줄 프로브가 그걸 갈랐다.

## INFO — 전부 넘김 (근거 명시)

| # | 처분 |
|---|---|
| 1 (스코프 확인) | positive finding |
| 2 (보안 재확인, 150/150) | positive finding |
| 3 (이중 순회 +61ms·identity 캐시) | `15_58_26` W1 에서 실측·유예 확정. 별건 등재됨 |
| 4 (재귀 스켈레톤 3벌) | `11_02_16` 의도적 defer, 상태 불변 |
| 5 (`maxDepth` 짝 불변식이 타입 미강제) | 현재 호출부 2곳 모두 정상. 3번째 표면 추가 시 재고 |
| 6 (JSDoc 비대화 1.6:1) | 유예 유지. **다만 실재하는 추세**다 — 다음에 이 파일을 만지면 근거 서사를 spec Rationale 로 옮기고 JSDoc 엔 포인터만 남기는 것을 먼저 검토할 것 |
| 7 (JSDoc 이 `review/**` 타임스탬프 인용 → dangling 위험) | 유효한 지적. `review/` 아카이브 작업이 생기면 인용 목록 우선 점검 |
| 8 (fixture 배열 소규모 중복) | 2회라 아직 추출 안 함. 3회째에 상수화 |
| 9 (export 시그니처 1→2 인자) | 호출자 전원 diff 안에서 갱신 확인, breaking 없음 |
| 10 (§5.3 인라인 콜아웃 비대칭) | `15_58_26` 에서 이월. 급하지 않음 |
| 11 (`websocket.service.spec.ts:15` 일본어 JSDoc) | pre-existing, 이번 diff 밖. 다음에 그 헬퍼를 만질 때 |
| 12 (이미 유출된 데이터 사후 대응) | 코드 조치 불요 — **운영 판단**. plan 에 추적 항목으로 등재돼 있음 |
| 13 (doc-sync-matrix 21 trigger 전수 대조) | 대상 없음 |

## 검증

- `interaction.service.spec.ts` **52 passed** · `lint --max-warnings 0`
- 타이틀 포맷 의미론은 프로브로 실증(위 표), 추론 아님

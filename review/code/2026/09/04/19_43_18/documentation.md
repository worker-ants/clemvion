# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `AlertRuleDto.threshold` 수정 서술이 실제 영향 범위보다 좁다 — `GET /api/alerts/rules` 하나만 언급하지만 같은 DTO 를 쓰는 `POST`/`PATCH` 응답도 동일한 결함을 갖고 있었다
  - 위치: `CHANGELOG.md:5`("`GET /api/alerts/rules` 의 OpenAPI 는...") 및 `CHANGELOG.md:27`("`alerts.controller.list()` 에 **반환 타입 애노테이션이 없다.**"); `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:22`("이 엔드포인트는 엔티티를 그대로 반환하므로")
  - 상세: CHANGELOG 항목과 DTO JSDoc 모두 "이 엔드포인트"(단수)·`list()` 만을 원인으로 지목한다. 그러나 저장소를 직접 확인하면 `alerts.controller.ts` 의 `create()`(`POST /api/alerts/rules`, `@ApiCreatedWrappedResponse(AlertRuleDto, …)`)와 `update()`(`PATCH /api/alerts/rules/:id`, `@ApiOkWrappedResponse(AlertRuleDto, …)`) 도 반환 타입 애노테이션 없이 `alerts.service.ts` 의 `create()`/`update()`(둘 다 `Promise<AlertRule>` 엔티티 직접 반환, `threshold: String(dto.threshold)`)를 그대로 돌려주고 있어 **동일한 "number 라고 문서화했는데 wire 는 string" 결함이 세 엔드포인트 모두에 있었다.** DTO 를 고쳐 세 곳이 함께 바로잡힌 것은 맞지만(그래서 기능적으로는 문제없음), 원인 서술("이 엔드포인트만")이 실제 결함 범위(list·create·update 셋)를 축소해 전달한다. 나중에 이 CHANGELOG 항목만 보고 "list() 만 고치면 된다"고 잘못 일반화할 여지가 있다.
  - 제안: CHANGELOG "왜 아무도 몰랐나" 절과 DTO JSDoc 을 "`list()`" 단수 대신 "`AlertRuleDto` 를 쓰는 `list`/`create`/`update` 세 응답 모두 컨트롤러 반환 타입 애노테이션이 없다"로 정정.

- **[WARNING]** CHANGELOG 신규 항목에 코드젠 클라이언트 영향(`영향:`) 서술이 빠져 있다 — 같은 파일의 다른 DTO 타입 변경 항목들은 전부 명시한다
  - 위치: `CHANGELOG.md:3`~`29` (`## Unreleased — AlertRuleDto.threshold 가 number 라고 했지만 wire 는 문자열이었다` 절 전체, 명시적 "영향" 문단 없음)
  - 상세: 같은 파일의 `invitedBy`·`ipWhitelist`·`ExecutionStatusDto` 등 다른 모든 DTO 표기 정정 항목은 `**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 …` 형태로 codegen 소비자 영향을 명시한다(nullable 완화 정도의 변화에도 빠짐없이 적음). 이번 항목은 `number` → `string` 으로 **타입 자체가 바뀌는**, nullable 플립보다 소비자 코드에 더 파괴적일 수 있는 변경(코드젠 클라이언트가 `threshold * 2` 같은 산술을 하고 있었다면 타입 체크가 깨지거나 문자열 연결로 조용히 오동작)인데도 영향 문단이 없다. "wire 는 바뀌지 않는다" 는 바이트 수준 사실일 뿐, 타입 수준 영향과는 별개다.
  - 제안: 다른 항목과 동일한 형식으로 `**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 threshold 가 number → string 으로 바뀐다. 산술 연산을 하던 코드는 갱신이 필요하다` 류의 문장 추가.

- **[WARNING]** 계획 문서 내 서술 수치와 표 합계가 불일치 (59건 vs 표 합산 57건)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:276`("엔티티와 짝지어지는 응답 DTO 23개의 필드 타입을 전수 대조했다 — **불일치 59건**.") 및 바로 아래 표 `:281`~`:284`(`46 + 6 + 4 + 1 = 57`)
  - 상세: 본문은 "불일치 59건"이라 적고, 그 근거로 제시한 표는 `Date→string 46` + `enum→string 6` + `관계 축소 4` + `실제 불일치 1` = **57**건이다. 2가 빈다. 이 문서 자체가 "정량 기록은 잰 시점의 값이며 반복해서 실수했다"는 것을 여러 차례 자기반성으로 기록하고 있는 문서라(§③ "이 표를 두 번 틀렸다" 등), 같은 종류의 산술 오차가 또 남아 있다는 점에서 특히 눈에 띈다. 이 수치는 §5.4 drift 2단계에서 "(a) 반환 타입 명시" 방안을 기각하는 근거로 쓰이므로, 카운트 정확성이 그 결론의 신뢰도에 직결된다.
  - 제안: 59 → 57로 정정하거나(표가 맞다면), 표에 빠진 2건의 항목을 추가해 합계를 59로 맞출 것. 어느 쪽이든 실제로 재계산해서 반영.

## 요약

리뷰 대상은 CHANGELOG 신규 항목, `AlertRuleDto` JSDoc, 그리고 nullable 표기 후속 plan 문서 갱신이다. 세 파일 모두 문서화 품질 자체는 높은 편(원인 분석, 대안 기각 근거, 날짜 박은 실측치, 상호 참조가 꼼꼼함)이고 핵심 사실관계(엔티티-프런트-서비스 코드 대조)도 grep 으로 재확인한 결과 정확했다. 다만 (1) 결함의 실제 영향 범위(엔드포인트 3곳 중 1곳만 언급)가 CHANGELOG·JSDoc 양쪽에서 축소 서술되어 있고, (2) 같은 파일의 다른 항목들과 달리 코드젠 클라이언트 영향 문단이 빠져 있으며, (3) plan 문서 자체에 산술 불일치(59 vs 57)가 남아 있다 — 세 번째는 이 문서가 스스로 경계하는 바로 그 실수 클래스라 특히 정정 가치가 크다. 코드 변경(DTO 필드 타입 정정) 자체는 정확하고 문제없다.

## 위험도

LOW

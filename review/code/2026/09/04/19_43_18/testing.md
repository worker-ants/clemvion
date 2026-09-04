# 테스트(Testing) 리뷰

## 범위 확인

`CHANGELOG.md` diff 는 `@@ -1,5 +1,33 @@` 로, 이번 diff 가 실제로 추가하는 것은 최상단의
`AlertRuleDto.threshold` 항목 한 섹션뿐이다(그 아래 방대한 "Unreleased" 항목들은 이미 병합된
과거 변경의 기존 본문이며 이번 diff 의 대상이 아니다). 따라서 이번 리뷰의 실질 코드 변경은
사실상 1건 — `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 의
`threshold: number` → `threshold: string`(+JSDoc) — 이고, 나머지 두 파일(`CHANGELOG.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)은 순수 문서다. 저장소 소스는
읽기만 했고 아무것도 뮤테이션하지 않았다(`git status --short` 로 확인, 변경 없음).

## 발견사항

- **[WARNING]** 이 PR 이 고친 바로 그 결함(`AlertRuleDto.threshold`)에 대한 회귀 테스트가 여전히 없다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:36-37`
    (`@ApiProperty({ type: String, example: '10.0000' })` / `threshold: string;`), 및
    `codebase/backend/src/modules/alerts/alerts.controller.ts` `list()`(반환 타입 미명시)
  - 상세: CHANGELOG 본문 자체가 "왜 아무도 몰랐나 — `alerts.controller.list()` 에 반환 타입
    애노테이션이 없어 `tsc` 가 DTO 와 엔티티를 대조한 적이 없었다" 라고 원인을 명시하는데, 이번
    수정은 **DTO 선언(문서/타입)만 사실에 맞췄을 뿐, 그 원인 — "아무 검증자도 이 필드를 보지
    않는다" — 을 닫는 테스트를 추가하지 않았다.** `codebase/backend/src/modules/alerts/` 하위에는
    `alerts-evaluator.service.spec.ts` 하나만 있고, `AlertRuleDto`/`alerts.controller`/
    `GET /api/alerts/rules` 를 참조하는 테스트는 unit·e2e 어디에도 없다(`grep -rn AlertRuleDto
    codebase/backend/src codebase/backend/test` → Swagger 데코레이터 인자로만 등장, 테스트에서는
    0건). 저장소 전역 회귀 가드인 `swagger-dto-contract-guard.ts`(`findSwaggerContractMismatches`)
    도 이 클래스의 결함을 못 잡는다 — 소스를 열어 확인한 결과 이 가드가 보는 축은 `'presence'`
    (required vs `?`) 와 `'null'`(nullable vs `| null`) 두 개뿐이고, `threshold` 는 수정 전에도
    "required·non-null" 로 TS/OpenAPI 가 일치했으므로(둘 다 `number`, 둘 다 필수) 애초에 이 가드의
    판정 범위 밖이다. 즉 지금 이 순간에도 누군가 `threshold` 를 다시 `number` 로 되돌리거나
    엔티티의 `numeric` 컬럼 매핑이 바뀌어도, 이 저장소의 어떤 테스트도 RED 를 내지 않는다.
  - 제안: 최소 하나의 얕은 계약 테스트를 추가한다 — (a) `alerts.controller.spec.ts` 를 신설해
    `AlertsService.list` 를 stub 하고(엔티티 형태로 `threshold: '10.0000'` 반환) 컨트롤러 응답의
    `data[0].threshold` 가 `typeof === 'string'` 임을 단언하거나, (b) 기존 `execution-status-
    response.dto.spec.ts` 패턴처럼 `SwaggerModule.createDocument()` 로 `AlertRuleDto.threshold`
    스키마의 `type` 이 `'string'` 인지 보는 스냅샷성 테스트. 다만 (b) 는 데코레이터 인자 자체를
    다시 읽는 것이라 "데코레이터와 TS 타입을 동시에 되돌리는" 회귀는 여전히 못 잡으므로, 실제
    엔드포인트 응답을 보는 e2e/통합 테스트가 더 강한 방어선이다.

- **[INFO]** 위 갭은 이미 자기 자신을 추적하고 있다 — 새 항목이 아니라 "알려진 미해결"
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 체크리스트,
    `- [ ] §5.4 drift 배치 — 2단계: 검증자가 없는 응답 DTO 78곳` 항목과 그 하위 "(b) 대표
    엔드포인트에 실제 응답 대조 테스트 — 이제 이것만 남았다" 문구
  - 상세: 같은 문서가 "(a) 컨트롤러 반환 타입 명시" 를 시도했다가 46건의 거짓 양성
    (`Date`→`string` 직렬화 등)을 근거로 명시적으로 기각하고, "검증자는 직렬화를 거친 뒤를
    봐야 한다 → (b) 만 성립한다" 고 스스로 결론 내렸다. 즉 `list()` 에 반환 타입을 안 붙인 것과
    구조적 검증자가 없는 것은 이 PR 범위 밖의 의도된 유예이지, 리뷰에서 새로 지적할 미검토
    사항은 아니다. 다만 **그 유예의 대상 78곳 목록에 `AlertRuleDto` 가 명시적으로 포함돼
    있는지는 이 문서에서 확인되지 않는다** — `AlertRuleDto` 는 그 "83 응답 DTO" 분석 대상에
    들어 있었는지 언급이 없고, 이번에 고친 필드가 바로 그 분석을 촉발한 사례이므로 후속
    2단계 착수 시 대표 엔드포인트 선정에서 빠뜨리지 않도록 문서에 명시하는 편이 안전하다.
  - 제안: 위 WARNING 을 즉시 이 PR 에서 닫지 않는다면, 최소한 `spec-draft-nullable-notation-
    followups.md` 의 2단계 대표 엔드포인트 후보 목록에 `GET /api/alerts/rules`(`AlertRuleDto`)를
    명시적으로 추가해 "이미 실제 결함이 한 번 났던 자리" 라는 사실이 다음 착수자에게 전달되게
    한다.

- **[INFO]** 이번 diff 는 기존 테스트를 깨지 않는다 (회귀 위험 없음, 커버리지도 늘지 않음)
  - 위치: `codebase/backend/src/modules/alerts/**` 전역
  - 상세: `grep -rn AlertRuleDto codebase/backend/src codebase/backend/test`, `find
    codebase/backend/src/modules/alerts -iname '*.spec.ts'` 로 확인 — `AlertRuleDto` 를
    import/참조하는 테스트가 0건이라 `number`→`string` 타입 변경이 어떤 기존 단언과도
    충돌하지 않는다. Swagger 데코레이터는 런타임 변환을 하지 않고(컨트롤러가
    `plainToInstance(AlertRuleDto, …)` 를 쓰지 않음, 엔티티를 그대로 반환) 순수 문서 메타데이터라
    이번 변경의 런타임 동작 변화는 실제로 없다(CHANGELOG 의 "wire 는 바뀌지 않는다" 주장과
    소스 확인 결과가 일치).

- **[INFO]** `CHANGELOG.md`·plan 문서 diff 자체는 테스트 관점에서 검증할 코드가 없다
  - 위치: `CHANGELOG.md`(diff 상단 신규 섹션), `plan/in-progress/spec-draft-nullable-notation-
    followups.md`(체크박스·표 갱신)
  - 상세: 두 파일 모두 순수 서술/추적 갱신이다. 문서가 주장하는 사실들(entity `threshold:
    string`, `alerts.service.ts` 의 `String(dto.threshold)` 변환, frontend `lib/api/alerts.ts`
    의 읽기/쓰기 타입 분리, `alerts.controller.ts list()` 반환 타입 미명시)은 모두 소스 대조로
    확인했고 어긋남이 없었다.

## 요약

이번 diff 의 실질 코드 변경은 `AlertRuleDto.threshold` 를 `number`→`string` 으로 정정하는
문서/타입 수정 한 건뿐이며, 런타임 wire 는 불변이고 기존 테스트를 깨는 부분도 없다. 다만 이
필드는 "아무 검증자도 보지 않아 오랫동안 몰랐다" 는 것 자체가 버그의 원인이었는데, 수정 후에도
그 원인(무검증)은 그대로 남아 있다 — 저장소 전역 가드(`swagger-dto-contract-guard.ts`)는
presence/null 두 축만 보고 primitive 타입 불일치는 구조적으로 잡지 못하며, `AlertRuleDto`·
`GET /api/alerts/rules` 를 참조하는 unit/e2e 테스트는 한 건도 없다. 이 갭은 프로젝트가 자체
tracker(`plan/in-progress/spec-draft-nullable-notation-followups.md` §5.4 2단계)에 이미
등재해 둔 것이라 "숨겨진 결함" 은 아니지만, 정작 그 트래커의 동기가 된 사례(`AlertRuleDto.
threshold`)가 후속 대표 엔드포인트 후보로 명시되어 있지는 않다.

## 위험도

LOW

# 테스트(Testing) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number → string` 정정 (코드)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findNumericAsNumber` 세 번째 축 추가 (가드 로직)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 축을 무는 테스트 10건 신설
- `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서(테스트 자체는 아니나 후속 테스트 항목을 추적)
- `review/code/2026/09/04/{19_43_18,20_16_17}/**`, `review/consistency/2026/09/04/20_05_42/**` — 이전 라운드 산출물(읽기 전용 이력, 이번 diff 의 코드 대상 아님)

검증을 위해 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 를 **저장소 밖 scratch 로 원본을 `cp` 해 둔 뒤** 두 차례 뮤테이션하고, 매번 `npx jest swagger-dto-contract.spec.ts` 로 RED/GREEN 을 실측한 뒤 `cp` 로 즉시 원복했다(`git status --short` 로 클린 확인, 아래 근거에 결과 기재). `git checkout`/`restore` 는 쓰지 않았다.

## 발견사항

- **[WARNING]** 신규 추가된 실저장소 스캔 단언(`저장소에 그런 자리가 없다`)에 `[전제]` 테스트가 없어, 경로 분류 상수가 깨져도 조용히 통과한다 — 뮤테이션으로 재현·확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:291-294` (해당 `it`), 원인은 `swagger-dto-contract-guard.ts:238-239` (`ENTITY_DIR`/`RESPONSE_DTO_DIR` 상수)
  - 상세: 같은 파일 위쪽의 형제 함수(`findSwaggerContractMismatches`)에는 실저장소 단언 앞에 `[전제] 스캔 대상이 비어 있지 않다`·`[전제] 스캔 대상에 Api* 데코레이터가 실제로 있다` 두 개의 premise 테스트가 있어, 스캔 대상이 실수로 비면 그 사실 자체가 RED 로 드러난다(`swagger-dto-contract.spec.ts:66-75`). 그런데 신설된 `findNumericAsNumber` 축에는 이 대칭 premise 가 없다. 실측: `ENTITY_DIR`/`RESPONSE_DTO_DIR` 상수를 존재하지 않는 경로(`/nonexistent-entities-dir/` 등)로 바꿔 `numericFields`/`dtoFields` 분류가 통째로 실패하도록 뮤테이션한 뒤 스위트를 돌리니, `[대조군] 술어가 실제로 무는가` 하위 6개 테스트는 예상대로 전부 RED 가 됐지만 **`저장소에 그런 자리가 없다`(실저장소 스캔) 테스트는 그대로 GREEN 으로 통과했다** — `expect(...).toEqual([])` 가 "위반 없음"과 "애초에 아무것도 스캔되지 않음"을 구분하지 못하기 때문이다. 즉 이 단언은 지금 저장소에 numeric 컬럼이 2곳뿐이라는 사실과 맞물려, 판별력을 전적으로 합성 픽스처(`[대조군]`)에 의존하고 있다 — 실저장소 축 자체는 "회귀가 없다"는 증거를 주지 못한다.
  - 제안: `alert_rule.threshold`/`llm_usage_log.cost_usd` 처럼 저장소에 실재하는 numeric 컬럼이 `collectTsFiles(SRC_ROOT)` 스캔에서 최소 1개 이상 발견됨을 확인하는 `[전제]` 테스트를 추가한다(예: 경로 분류가 살아있어 `numericFields`/`dtoFields` 맵이 비어있지 않음을 내부적으로 노출하거나, 알려진 엔티티 파일 하나를 직접 스캔해 최소 1개 필드를 얻는지 확인).

- **[WARNING]** (직전 라운드 `19_43_18` W1 의 잔여) `AlertRuleDto.threshold` 를 되잡을 런타임 계약 테스트가 여전히 없다 — 이번에 추가된 가드는 선언 대 선언(엔티티 `@Column` 타입 텍스트 vs DTO 필드 타입 텍스트)만 비교하는 정적 검사이고, 실제 `GET/POST/PATCH /api/alerts/rules` 응답이 문자열을 내려주는지 확인하는 controller/e2e 테스트는 이번 diff 에도 신설되지 않았다
  - 위치: `codebase/backend/src/modules/alerts/alerts.controller.ts` (`list`/`create`/`update` 모두 반환 타입 애노테이션 없음, 이번 diff 로도 불변 — 재확인: grep 결과 세 메서드 모두 여전히 미표기), `codebase/backend/src/modules/alerts/` 아래 `*.spec.ts`/e2e 테스트 0건(재확인: `alerts.controller`/`AlertRuleDto`/`threshold` 를 참조하는 spec 파일은 evaluator 서비스 spec 뿐, 컨트롤러·엔드포인트 레벨 테스트는 없음)
  - 상세: `review/code/2026/09/04/19_43_18/RESOLUTION.md` 는 W1 을 "가드에 세 번째 축을 세웠다"로 조치 완료 처리했지만, 그 축은 **소스 코드 텍스트 비교**이지 런타임 값 검증이 아니다. 컨트롤러 반환 타입이 여전히 미표기이므로 `tsc` 는 여전히 DTO-엔티티를 대조하지 않고, 만약 향후 누군가 서비스 계층에서 `threshold` 를 `Number(...)` 로 감싸는 실수를 하더라도(엔티티/DTO 선언 텍스트는 그대로 `string` 이므로) 이 정적 가드는 잡지 못한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 자체가 "(b) 대표 엔드포인트에 실제 응답 대조 테스트 — 이제 이것만 남았다"고 명시해 이 갭을 인지·추적하고 있으나, 아직 구현되지 않았다는 사실은 이번 diff 시점 기준으로 유효한 관찰이다.
  - 제안: 후속 작업(plan 에 이미 등재됨)으로 `GET /api/alerts/rules` 최소 1건의 컨트롤러/e2e 테스트를 추가해 `data[0].threshold` 가 `typeof === 'string'` 임을 실제 응답으로 단언한다.

- **[INFO]** `collectDtoFieldTypes`/`collectNumericFields` 의 상속·합성(`extends`/`PickType`/`OmitType`) 사각지대가 테스트로 고정돼 있지 않다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:252-273`(`collectNumericFields`), `:276-295`(`collectDtoFieldTypes`) — 둘 다 `node.members` 만 순회해 클래스가 **직접 선언한** 필드만 본다
  - 상세: 같은 파일이 이미 문서화한 "알려진 한계"(`<Entity>Dto` 이름 관례를 벗어나면 못 본다, `swagger-dto-contract.spec.ts:391-403` 에 캐너리로 고정됨)와 같은 성격의 또 다른 사각지대다 — 만약 향후 어떤 응답 DTO 가 numeric 필드를 부모 클래스나 `PickType`/`IntersectionType` 합성으로 얻는다면, `node.members` 순회가 그 필드를 못 보고 `findNumericAsNumber` 가 조용히 검출하지 못한다. 현재 저장소에는 실사례가 없다(`AlertRuleDto` 는 `extends` 없이 직접 필드 선언) — 그래서 CRITICAL/WARNING 이 아니라 INFO 다.
  - 제안: `<Entity>Dto` 이름 관례 한계와 같은 방식으로 "[알려진 한계]" 캐너리 하나를 추가해 이 사각지대도 명시적으로 고정해 두면, 나중에 이 가드를 강화할 때(혹은 강화하지 않기로 결정할 때) 그 판단이 문서화된 채로 남는다.

## 검증 절차 (재현 가능)

1. `findNumericAsNumber` 의 `if (!/\bnumber\b/.test(type)) continue;` 를 `if (true) continue;` 로 뮤테이션 → `[대조군]` 하위 6개 테스트 RED, 나머지 23개 GREEN(정상 판별력 확인). 즉시 `cp` 원복, `git status --short` 클린 확인.
2. `ENTITY_DIR`/`RESPONSE_DTO_DIR` 상수를 존재하지 않는 경로로 뮤테이션 → `[대조군]` 6개는 RED, 그러나 `저장소에 그런 자리가 없다`(실저장소 스캔) 는 GREEN 유지 → 위 WARNING #1 의 근거. 즉시 `cp` 원복, `git status --short` 클린 확인.
3. `RESOLUTION.md` 의 "가드 4" 테스트 개수 서술을 실측 대조 — `swagger-dto-contract.spec.ts` 전체 테스트 수는 이 축 도입 커밋(`5a7de8ab1`) 직후 19→23(+4, RESOLUTION 서술과 일치)이었고, 이후 리뷰 라운드(`20_16_17`)에서 지적된 정규식 위음성을 AST 로 고친 커밋(`c15489e61`)이 추가로 6건을 더해 최종 29건이 됐다 — 서술은 작성 시점 기준 정확했다(오류 아님, 참고용으로만 확인).
4. 최종 상태: `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` → **29 passed, 29 total**. `git status --short` → 리뷰 산출물 디렉터리(`review/code/2026/09/04/20_39_25/`) 외 변경 없음.

## 요약

새로 추가된 `findNumericAsNumber` 축과 그 10개 테스트는 원인이 됐던 `AlertRuleDto.threshold` 결함 형태(및 리뷰가 재현한 정규식 위음성 4형태)를 실제로 무는 것으로 뮤테이션 테스트로 확인했고, 격리(`withFiles`/tmpdir)·가독성(각 픽스처에 왜 필요한지 주석)·회귀 방지(기존 presence/null 축 테스트 불변, 실저장소 판정 여전히 `[]`) 모두 양호하다. 다만 두 가지 갭이 남는다 — (1) 신설된 실저장소 스캔 단언 자체는 경로 분류가 깨져도 조용히 통과하는 구조적 맹점이 있고(형제 축에는 있는 `[전제]` 테스트가 이 축엔 없음, 뮤테이션으로 확인), (2) 근본 원인이던 "런타임에 실제로 문자열이 내려가는가"를 확인하는 controller/e2e 테스트는 이번 diff 로도 신설되지 않았다(plan 에 후속으로 추적 중이나 미구현). 코드 자체(DTO 필드 타입 정정)에는 결함이 없다.

## 위험도

LOW

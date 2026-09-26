# 테스트(Testing) 리뷰 — canvas-save-typed

## 발견사항

- **[WARNING]** e2e `I. 버전 복원` 테스트가 갱신 가지의 노드 개수를 직접 단언하지 않아, 핵심 증거(`idsOf` 비교)가 저장 응답(`saved`)의 정상성에 암묵적으로 의존한다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:624-628` (`idsOf` 정의 및 `expect(idsOf(restored.body)).toEqual(idsOf(saved.body))`)
  - 상세: C 케이스(`:274-275`)는 `save.body.data.nodes).toHaveLength(5)` 로 원소 수를 먼저 고정한 뒤 계약을 대조한다(주석: "원소가 없으면 원소 대조가 vacuous 하므로 개수부터 고정"). 그런데 새로 추가된 I 케이스는 같은 원칙을 `saved`/`restored` 어느 쪽에도 적용하지 않는다 — `restored.body.data.edges).toHaveLength(2)` 만 있고 `nodes` 는 길이 단언이 없다. 만약 `restoreVersion`(갱신 가지, `syncNodes` 의 update 경로)이 노드를 하나도 갱신하지 못해 `restored.body.data.nodes = []` 를 돌려주는 회귀가 생기면, `saved.body.data.nodes` 가 5개인 이상 `idsOf(saved.body)` 는 5개 id 배열이라 `toEqual([])` 은 실패하므로 이 특정 회귀는 잡힌다. 다만 그 방어는 "`saved` 가 반드시 5개를 돌려준다" 는, **이 테스트 자신이 검증하지 않는 가정**(C 케이스가 같은 코드 경로로 간접 보증할 뿐)에 기대고 있다 — I 테스트를 단독으로 읽으면 `saved`/`restored` 양쪽이 우연히 같은 값(빈 배열 포함)으로 수렴하는 경우를 걸러낼 장치가 그 안에 없다. `assertMatchesContract` 도 `nodes` 를 `required` 로만 보고 `minItems` 를 강제하지 않으므로 빈 배열을 통과시킨다.
  - 제안: `saved.body.data.nodes).toHaveLength(5)` 를 restore 호출 전에 추가해 C 와 대칭을 맞추고, 테스트 격리(다른 테스트의 통과 여부에 기대지 않음) 원칙을 지킨다. 실패 시 진단(어느 단계에서 개수가 틀렸는지)도 더 명확해진다.

- **[INFO]** 신규 유닛 테스트(`workflow-response.dto.spec.ts`)는 `nodes`/`edges` 프로퍼티의 `type`/`$ref`/`required` 만 확인하고 `nullable` 여부는 보지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts:19-29` (`it.each` 블록)
  - 상세: 이번 변경 범위(타입 없는 배열 → `NodeDto[]`/`EdgeDto[]`)에 한정하면 필요충분하다. 다만 plan(`plan/in-progress/canvas-save-typed.md` INFO 1)에서 `NodeDto`/`EdgeDto` 자체가 기존에 "optional + nullable" §5.4 금지 조합을 갖고 있다고 명시적으로 인지하고 있으므로, 이 캐너리가 그 조합까지 단언하지 않는 것은 의도된 스코프 밖(기존 drift, 별도 트래커)임이 plan 에 already 문서화돼 있어 재지적하지 않는다.

- **[INFO]** 뮤턴트 검증(M1~M3, plan 문서)은 스키마 선언 되돌리기 2건 + `NodeDto.toolOwnerId` 선언 제거 1건만 다뤘고, "값 검사기가 빈 배열을 vacuous 하게 통과시키는" 클래스의 뮤턴트는 포함되지 않았다. 위 WARNING 이 지적하는 형태(빈 배열)는 이번 뮤턴트 표로는 판별되지 않는다 — 뮤턴트 표 자체가 틀렸다는 뜻은 아니고, 표가 커버하는 범위 밖의 갭이라는 뜻이다.

## 요약

핵심 변경(`CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 광고)에 대해 유닛(스키마 캐너리)과 e2e(실응답 대조, 생성 가지·갱신 가지 양쪽)를 모두 갖췄고, 뮤턴트 3개(KILLED)로 판별력도 실측했다는 점에서 테스트 설계는 전반적으로 탄탄하다. `contractForDto`/`assertMatchesContract` 는 배열 원소 안까지 재귀 검증하므로 얕은 최상위 검사에 그치지 않는다. 다만 신규 I(복원) e2e 케이스는 C 케이스가 지키던 "원소 수부터 고정한다"(vacuous 방지) 원칙을 그대로 따르지 않아, 이 테스트만 단독으로 봤을 때 `saved`/`restored` 양쪽이 우연히 대칭적으로 비어도 걸러내지 못하는 잠재적 약점이 있다 — 다만 같은 코드 경로를 쓰는 C 케이스가 간접적으로 이를 방어하고 있어 실질 위험도는 낮다.

## 위험도
LOW

# 유지보수성(Maintainability) Review

## 대상 요약

실질 코드 변경은 `ExecuteWorkflowDto.input` 필드에 `@ApiPropertyOptional({ deprecated: true, description: ... })` 를 추가하고 JSDoc 을 확장한 것, 그리고 이를 고정하는 `workflows-execute-body.spec.ts` 단언 1건이 전부다. 나머지는 plan 문서(`swagger-decisions.md` 신설, `spec-sync-external-interaction-api-gaps.md` 갱신)와 `spec/conventions/swagger.md` 컨벤션 개정, 그리고 직전 리뷰 라운드(`12_22_08`)의 산출물(`RESOLUTION.md`/`SUMMARY.md`/각 리뷰어 리포트)이다. 함수 길이·중첩·순환 복잡도·매직 넘버가 발생할 표면 자체가 거의 없는 diff다.

## 발견사항

- **[INFO]** 동일한 결정 서사(rationale)가 3곳에 사실상 같은 문장으로 반복 기재됨
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:46-53`(JSDoc `> **deprecated 인 이유**` 블록), `plan/in-progress/swagger-decisions.md:32-39`(`## ② deprecated 표시 — 리네임이 아니다`), `plan/in-progress/spec-sync-external-interaction-api-gaps.md:987-995`(트래커 항목 결정 blockquote)
  - 상세: "`parameterValues ?? input.parameters` 는 처음부터 back-compat 경로다 / `deprecated: true` 는 비파괴이며 클라이언트를 `parameterValues` 로 유도해 동명이의가 시간이 지나며 저절로 해소된다" 는 동일 논지가 세 파일에 거의 같은 문장으로 중복돼 있다. 이 저장소는 "결정을 코드 인접 지점에도 남겨 다음 리뷰가 재조사하지 않게 한다"는 관행을 이미 채택하고 있고(예: `execution-seq-allocator.service.ts` 류), 세 지점이 각기 다른 소비자(트래커=이력 SoT, plan=작업 근거, DTO=코드 옆 근거)를 겨냥하므로 의도된 트레이드오프로 보인다.
  - 제안: 별도 조치 불요. 다만 이 결정이 향후 번복되면 세 지점을 함께 갱신해야 한다는 점만 인지해 둘 것.

- **[INFO]** `ExecuteWorkflowDto.input` 필드 JSDoc 이 세 가지 서로 다른 관심사를 한 docblock 에 혼재
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:41-59`
  - 상세: "형태 차이 설명"(42-44) · "`deprecated` 채택 근거"(46-53) · "마커 거부 공동 적용 근거"(55-58) 세 개의 독립된 결정 서사가 인용 블록(`>`)으로 순차 나열돼 19줄짜리 필드 docblock 을 이룬다. 클래스 레벨 docstring(3-29줄)도 이미 유사하게 길다. 현재는 필드가 2개뿐이라 아직 부담스럽지 않지만, 이 패턴이 늘어나면 DTO 파일이 결정 이력 저장소가 될 위험이 있다.
  - 제안: 구조를 지금 바꿀 필요는 없다(기존 관행과 일치). 다만 필드가 더 늘어나면 `swagger.md` §3 이 이번에 보안·정책 캐비엇에 적용한 패턴처럼 "요약 1~2문장 + spec 링크"로 상세 서사를 분리하는 방향을 고려할 수 있다.

- **[INFO]** (양호) 신규 테스트 라벨 `[결정]` 이 기존 `[캐너리]`/`[가드]`/`[대조군]` 태그 컨벤션에 자연스럽게 합류
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:163`(`it('[결정] \`input\` 만 deprecated 로 표시된다', ...)`)
  - 상세: 대괄호 태그로 테스트 의도를 분류하는 파일 기존 패턴을 그대로 따랐고, 변수명(`input`/`preferred`)도 목적을 명확히 드러낸다. `preferred.deprecated).toBeFalsy()` 대조군 단언까지 포함해 "한쪽만 보면 둘 다 deprecated 로 바꿔도 통과한다"는 실패 모드를 docstring(156-161줄)에 명시적으로 남겼다 — 침묵 회귀를 막는 좋은 습관이다.

- **[INFO]** `plan/in-progress/swagger-decisions.md` 결정 표의 "성격" 열이 행마다 다른 범주를 담아 오독 소지
  - 위치: `plan/in-progress/swagger-decisions.md:17-21`(`| 항목 | 결정 | 성격 |` 표)
  - 상세: ①행 값은 `코드 무변경 — 결정 기록만`(변경의 **성질**)인데 ②·③행 값은 각각 `developer`/`planner`(작업의 **담당자**)로, 같은 열에 서로 다른 축이 섞여 있다. plan 문서라 런타임 유지보수성에 직접 영향은 없지만, 이 plan 이 `plan/complete/` 로 이관돼 역사적 기록으로 남는다는 점에서 가독성 결함이 고정된다.
  - 제안: 열을 "성격"(변경 성질)과 "담당"(owner)으로 분리하거나 값 범주를 통일. 낮은 우선순위.

## 미검출(양호하게 처리된 항목)

- `spec/conventions/swagger.md` §3 길이 규칙 개정은 산문 두 줄(`DTO description은 10~40자 내외` / `summary는 10~20자 내외, description은 50~150자 내외`)을 `대상 | 길이 | 성격` 3행 표로 대체해 오히려 가독성이 개선됐다(`spec/conventions/swagger.md:259-264`).
- 직전 리뷰 라운드(`12_22_08`)의 documentation WARNING("예외"→"지시" 재정의와 미변경 Rationale 절 프레이밍 충돌)이 이번 diff 의 `spec/conventions/swagger.md` 섹션 제목·도입부 갱신으로 실제 해소된 상태를 확인했다(`### §3 보안·정책 캐비엇 — 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가` + "2026-08-17~08-22 에는 이걸 '예외' 라고 불렀다" 이력 blockquote).
- DTO 클래스·필드 docstring 은 근거·인용·의사결정 이력을 정확히 서술하며, 컨트롤러의 실제 병합 로직(`parameterValues ?? input.parameters`)과 문서 내용이 일치한다.

## 요약

이번 diff 의 유일한 실질 코드 변경은 `ExecuteWorkflowDto.input` 데코레이터 옵션 1개(`deprecated: true`) 추가와 이를 고정하는 unit 테스트 1건으로, 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등 전형적 유지보수성 위험이 발생할 표면이 거의 없다. 유일하게 반복해 짚을 지점은 동일 결정 서사가 DTO JSDoc·plan 문서·트래커 세 곳에 유사 문장으로 중복된다는 것과 필드 JSDoc 이 다중 관심사를 19줄에 담고 있다는 것인데, 둘 다 이 저장소가 이미 채택한 "결정을 코드/문서 인접 지점에 남긴다"는 관행과 일치하는 의도된 트레이드오프로 판단되어 조치가 필요한 결함은 아니다. 네이밍·테스트 라벨 컨벤션은 기존 스타일과 일관되게 유지됐고, `swagger.md` 표 형태 전환은 가독성을 개선했다. 직전 라운드에서 지적된 documentation WARNING(용어 프레이밍 충돌)도 이번 diff 에서 실제로 해소된 것을 확인했다.

## 위험도
NONE

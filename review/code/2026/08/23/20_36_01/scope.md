# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 원 작업(`re-run.dto.ts` 의 `type: Object` 축약형 정정)과 무관한 결정 항목 체크박스가 같은 diff 에 묶였다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:384`
  - 상세: 이번 PR 의 의도는 `ReRunRequestDto.inputOverride` 의 OpenAPI 스키마 표현(`type: Object` → `type: 'object' + additionalProperties: true`)을 고치는 것이다. 그런데 같은 트래커 파일에서 전혀 다른 항목인 "Docker Hub 익명 pull rate limit" 의 won't-do 체크박스를 `- [ ]` → `- [x]` 로 함께 플립했다. 작성자가 `plan/in-progress/rerun-dto-shorthand.md:50-54` "## 부수 — won't-do 가 열린 체크박스로 남아 있었다" 절에서 이 변경을 스스로 명시적으로 "부수(원 작업과 별개)"라고 밝히고 있어 은폐성은 전혀 없고, 대상도 코드가 아닌 plan 문서이며 이미 사용자가 내린 기존 결정을 문서에 반영하는 것뿐이라 실질 위험은 낮다. 다만 관점 1(의도 이상의 변경)·4(무관한 수정) 기준으로는 원 작업 범위 밖의 독립적인 변경이 맞다.
  - 제안: 현재처럼 plan 문서에서 자체적으로 "부수" 로 분리 기재한 것은 최소한의 완화 조치로 적절하다. 더 엄격히 가르려면 이 체크박스 정정을 별도의 사소한 plan-hygiene 커밋/PR 로 분리할 수 있으나, 두 변경 모두 `codebase/**` 에 영향이 없는 plan 문서 범위이므로 강제 분리까지는 불필요하다고 판단됨(INFO 수준으로 낮춰도 무방).

- **[INFO]** 신규 캐너리의 두 번째 단언이 이번 diff 에서 변경되지 않은 기존 문구를 검증한다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:65-68` (`it('마커 거부 캐비엇을 description 에 싣는다 (EIA §R17)', …)`)
  - 상세: 이번 작업의 핵심은 `type`/`additionalProperties` 메타데이터 표현이다. 그런데 두 번째 `it` 블록은 `description` 안의 `MASKED_VALUE_RESUBMITTED` 문자열을 검증하는데, 이 `description` 텍스트는 `re-run.dto.ts` 의 `@ApiPropertyOptional` 에서 이번 diff 로 변경되지 않은 기존 값이다(파일 2 unified diff 확인, `description` 필드는 문맥(` `) 줄로만 나타나고 `+`/`-` 대상이 아님). 즉 이 단언은 이번 코드 변경 자체를 고정하는 것이 아니라 인접한 기존 동작을 부수적으로 캐너리 스위트에 편입시킨 것이다.
  - 제안: 같은 프로퍼티의 OpenAPI 노출을 검증하는 스위트에 자연스럽게 포함되는 성격이라 위험도는 낮다. 다만 커밋 메시지나 PR 설명에서 "이 캐너리는 축약형 회귀 방지 + 기존 마커 캐비엇 회귀 방지 두 가지를 겸한다" 는 점을 한 줄 명시하면 향후 diff 검토자가 "왜 안 바뀐 필드를 새로 테스트하나" 라는 의문을 갖지 않는다.

## 요약

핵심 변경(`re-run.dto.ts` 의 `type: Object` → `type: 'object' + additionalProperties: true` 전환 + 이를 고정하는 OpenAPI 산출 캐너리 신설 + 해당 트래커 항목 종결 기록)은 작업 제목·plan 문서가 서술하는 의도와 정확히 일치하며, 불필요한 리팩토링·기능 확장·포맷팅 뒤섞임·임포트/설정 변경은 발견되지 않았다. 유일하게 범위를 벗어나는 것은 같은 트래커 파일 안에서 함께 플립된 "Docker Hub" 무관 체크박스인데, 이는 작성자가 plan 문서 안에서 "부수" 로 명시적으로 분리·고지했고 코드에 영향이 없는 plan-hygiene 성격이라 위험은 낮다. 두 번째 캐너리 단언이 이번 diff 로 바뀌지 않은 기존 `description` 문구를 검증하는 점도 같은 프로퍼티를 다루는 자연스러운 확장으로 볼 수 있어 심각한 스코프 이탈은 아니다.

## 위험도

LOW

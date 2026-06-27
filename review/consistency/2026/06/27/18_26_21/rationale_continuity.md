# Rationale 연속성 검토 결과

검토 모드: --impl-done, scope=spec/2-navigation/, diff-base=origin/main
검토 대상 변경 파일:
- `codebase/backend/src/modules/llm/llm-model-config.controller.ts`
- `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`

---

## 발견사항

발견된 Rationale 연속성 위반이 없습니다.

---

## 요약

이번 변경은 `ModelListDto`(Swagger 상 `{ models: [...] }` 중첩 객체)를 제거하고 `ModelItemDto`를 `ModelInfoDto`로 교체하면서 컨트롤러 Swagger 데코레이터를 `ApiOkWrappedArrayResponse(ModelInfoDto, ...)` 로 전환한 Swagger 문서 정합 버그픽스다. 실제 wire format은 서비스 계층이 항상 `ModelInfo[]` 배열을 반환했으므로(`spec/5-system/7-llm-client.md §5.5` 및 인터페이스 정의 `listModels(): Promise<ModelInfo[]>`), 변경은 실제 동작을 바꾸지 않고 Swagger 선언을 사실에 맞춘다. `spec/2-navigation/6-config.md`의 Rationale 7개 항목(R-1~R-7)은 모델 목록 API의 응답 wire shape에 대한 결정을 포함하지 않으며, `spec/2-navigation/` 내 다른 Rationale 절 어느 곳도 `ModelListDto` 래퍼 객체 채택 결정을 기록한 바 없다. `ModelInfoDto`에 `type: ModelTypeFilter` 필드를 필수로 추가하고 `meta` 선택 필드를 제거한 것은 `ModelInfo` 인터페이스를 "충실히 미러한다"는 DTO 코멘트에 명시된 설계 의도(인터페이스 mirroring)와 일치하며, 이에 반하는 선행 Rationale 결정이 없다. 종합적으로 Rationale 연속성 관점에서 위반·번복·invariant 우회가 없다.

---

## 위험도

NONE

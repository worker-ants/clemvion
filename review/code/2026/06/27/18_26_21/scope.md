# 변경 범위(Scope) Review

## 발견사항

### [INFO] plan/complete/mc-config-polish.md — spec_impact frontmatter 추가
- 위치: `plan/complete/mc-config-polish.md` 5행 신규 추가 블록
- 상세: 현재 작업(`mc-modellistdto-fix`) 범위는 swagger DTO 정합 수정이지만, 본 PR 에서 `mc-config-polish.md` (완료된 별개 작업)에 `spec_impact` frontmatter 를 추가하고 있다. 이는 기술적으로 현재 작업 의도 외의 파일 수정이다.
- 맥락: 플랜 파일 자체에 "TEST 중 발견(pre-existing 조치): mc-config-polish.md(#720)가 Gate C(spec_impact frontmatter) 미선언으로 unit 실패" 로 명확히 문서화되어 있다. 해당 변경이 테스트 게이트를 통과하기 위한 불가피한 선행 조건이었음이 명시적으로 기록되어 있으며, 변경 자체가 5행의 frontmatter 추가에 불과하다.
- 제안: 현재 문서화 방식이 적절하다. 단, 향후 유사한 경우 commit message 나 PR description 에도 명시하여 리뷰어 혼란을 최소화하는 것을 권장한다.

---

### 코드 변경 개별 평가

**파일 1: llm-model-config.controller.ts**
- import 추가(`ApiOkWrappedArrayResponse`) 및 교체(`ModelListDto` → `ModelInfoDto`): 정확히 annotation 교체에 필요한 최소한의 변경.
- decorator 교체 2건(`@ApiOkWrappedResponse(ModelListDto)` → `@ApiOkWrappedArrayResponse(ModelInfoDto)`): 작업 의도와 100% 일치.
- 멀티라인 포맷팅: 데코레이터 이름이 길어짐에 따른 자연스러운 포맷 변경이며, 의미 없는 공백 변경 없음.
- `ApiOkWrappedResponse` 임포트 잔존: testConnection 핸들러에서 여전히 사용 중 — 정상.

**파일 2: model-config-response.dto.ts**
- `ModelInfoDto` 신설(`{ id, name, type }`): 실제 `ModelInfo` 인터페이스를 충실히 미러하는 것이 목적. `name` optional → required, `meta` 제거, `type` 추가 모두 버그 수정 범위 내.
- `ModelListDto`·`ModelItemDto` 삭제: 교체 대상이 삭제된 것이므로 범위 내.
- 주석 확장: 폐기 배경을 설명하는 JSDoc 추가 — 설계 결정의 근거를 코드에 남기는 적절한 행위. 불필요한 주석 변경에 해당하지 않음.
- `MODEL_TYPE_ENUM, type ModelTypeFilter` import 추가: `ModelInfoDto.type` 필드 정의에 필요 — 정상.

**파일 4: plan/in-progress/mc-modellistdto-swagger-fix.md (신규)**
- 프로젝트 규약(plan lifecycle)에 따른 필수 작업 추적 파일 생성. 범위 이탈 아님.

---

## 요약

변경 범위는 의도된 목적(swagger DTO `ModelListDto` → `ModelInfoDto` 정합 수정)에 엄격히 한정되어 있다. 코드 파일 2건의 수정은 swagger annotation 교체와 DTO 신설/구형 삭제에만 집중하며, 불필요한 리팩토링·기능 추가·무관한 파일 수정은 없다. `plan/complete/mc-config-polish.md`의 `spec_impact` frontmatter 추가는 엄밀히 따지면 현재 작업 범위 외이나, 테스트 게이트 통과를 위한 pre-existing 조치로 플랜에 명시 문서화되어 있어 경미한 수준의 참고 사항(INFO)에 그친다.

## 위험도

NONE

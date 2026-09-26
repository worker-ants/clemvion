# 발견사항

- **[INFO]** `swagger-probe.ts` 의 JSDoc 문구 변경("Nest 메이저 업그레이드" → "`^` 범위 안의 마이너·패치 업그레이드도")이 이번 가드 기능과 직접 관련 없는 곁가지 수정으로 같은 커밋(`1c19eebc7`)에 번들됨
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:141-142` (diff 게이트 기준)
  - 상세: `plan/in-progress/request-body-guard.md` 본문에 "곁가지: … JSDoc 문구를 닫는다(`18_17_12` INFO4)"로 명시적으로 추적·승인된 항목이라 은닉된 무단 변경은 아니다. 다만 스코프 관점에서는 이번 작업 제목("요청 본문 스키마 가드")과 무관한 별도 문서 정정이 같은 커밋에 섞여 있다.
  - 제안: 이미 plan 에 기록되어 추적 가능하므로 조치 불요 — 다만 향후 유사 "곁가지 닫기"는 별도 커밋으로 분리하면 diff 리뷰가 더 명확해진다.

- **[INFO]** `swagger-probe.ts` 의 `bodyParamDesignType` 이 신설 `bodyArgIndexes` 로 리팩터되며 다중 `@Body()` 자리 선택 순서가 `Object.entries()` 삽입 순서에서 인덱스 오름차순 정렬로 바뀜(동작이 미세하게 변경됨)
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` (변경된 `bodyParamDesignType`, 신설 `bodyArgIndexes`)
  - 상세: 이 변경 자체는 가드가 결정적 순서를 필요로 하기 때문에 공유 헬퍼를 뽑아낸 정당한 리팩터링으로 보이며(스코프 밖 아님), 다만 기존 소비처(`*-body.spec.ts` 캐너리)의 암묵적 순서 가정에 영향을 줄 수 있어 로직/정확성 관점 리뷰어가 볼 사안이다. 스코프 위반으로는 판단하지 않음.
  - 제안: 별도 로직 리뷰어 확인 권장(본 리뷰 범위 밖).

이 외에 `CHANGELOG.md`, `plan/in-progress/*.md`, `spec/conventions/swagger.md`, `review/consistency/**` 아티팩트는 모두 이번 작업(요청 본문 스키마 가드 신설)에 직접 대응하며, `validation.pipe.ts` 의 `UNVALIDATED_METATYPES` export 추출은 가드가 파이프와 "같은 상수"를 참조해야 한다는 명시적 설계 근거(JSDoc·commit `1c19eebc7`)에 의해 정당화된다. 포맷팅만의 변경, 미사용 임포트, 의도치 않은 설정 변경, 관련 없는 파일 수정은 발견되지 않았다. `review/consistency/**` 다수 파일은 프로젝트 컨벤션상 SDD 워크플로(`--spec`/`--impl-prep`) 의무 산출물이라 스코프 확장이 아니다.

### 요약
25개 변경 파일 전부가 "요청 본문 스키마 광고 가드(request-body-advertised)" 신설이라는 단일 목적에 수렴한다. `validation.pipe.ts`·`swagger-probe.ts` 의 리팩터링은 가드와 기존 파이프/헬퍼가 동일한 판정 축(같은 상수·같은 자리 탐색 로직)을 공유해야 한다는 문서화된 설계 근거에 의해 정당화되는 필요 최소 변경이며, `swagger-probe.ts` 의 JSDoc 문구 정정은 이전 리뷰(INFO4)에서 추적된 곁가지로 plan 에 명시되어 있다. 불필요한 리팩토링, over-engineering, 무관한 파일 수정, 포맷팅/주석/임포트/설정의 의도치 않은 혼입은 발견되지 않았다.

### 위험도
NONE

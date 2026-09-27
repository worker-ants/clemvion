# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 리그레션 가드(`EXPECTED_DTO_JSDOC_CITATIONS`)의 허용 목록이 2건 → 0건으로 좁혀져, 응답 DTO 파일의 클래스/필드 JSDoc 어디든 새 리뷰 인용이 생기면 이제 곧바로 테스트가 실패한다(이전엔 두 자리가 예외로 동결돼 통과).
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` — `const EXPECTED_DTO_JSDOC_CITATIONS: readonly string[] = [];` (파일 5, 게이트 `49`행)
  - 상세: 이는 CI 게이트의 관측 가능한 동작 변화(부작용)다 — 종전에 동결됐던 두 인용이 실제로 `//` 주석으로 옮겨졌기 때문에 정합성이 유지되지만, "래칫이 더 엄격해진다"는 점 자체는 향후 이 두 DTO 클래스에 리뷰 인용을 다시 넣는 어떤 커밋이든 즉시 실패시키는 새로운 차단 지점이다. plan 문서(`dto-class-jsdoc-citation.md`)의 뮤턴트 표(M1·M2)가 이 의도된 변화를 실측·KILLED 로 확인했으므로 의도치 않은 부작용은 아니다.
  - 제안: 조치 불요 — 의도된 동작이며 실측으로 검증됨. 기록 목적의 INFO.

- **[INFO]** 리뷰 결과물(`review/consistency/2026/09/27/08_41_33/**`, `08_53_02/**`)이 저장소에 새 파일로 커밋된다.
  - 위치: `review/consistency/2026/09/27/08_41_33/*`, `review/consistency/2026/09/27/08_53_02/*` (파일 8~24)
  - 상세: 파일시스템 부작용(신규 파일 생성)이지만, `review/**` 는 프로젝트 컨벤션상 시점 기록(same-point-in-time record)으로 커밋되는 것이 정상 워크플로다(gitignore 대상 아님). 런타임 코드나 애플리케이션 상태에는 영향이 없다.
  - 제안: 조치 불요.

## 점검했으나 부작용 없음으로 확인된 항목

- `schedule-response.dto.ts` / `trigger-response.dto.ts`: 클래스 필드·데코레이터(`@ApiProperty` 등)·export 되는 클래스명·타입은 diff 전후 동일. 변경은 JSDoc 텍스트를 `//` 블록으로 옮긴 것뿐이며, OpenAPI 스키마 산출물에 실제로 영향이 없다는 점은 plan 의 실측(빌드 산출물 `dist/**` 대조)으로 확인되어 있다.
- `dto-jsdoc-citation-guard.ts`: `findDtoJsDocCitations`, `isResponseDtoFile`, `SRC_ROOT` 등 export 되는 함수/상수 시그니처는 변경 없음(docstring 만 수정). 호출자(스펙 파일)에 영향 없음.
- 환경 변수 읽기/쓰기, 네트워크 호출, 전역 변수 도입/변경, 이벤트·콜백 변경: diff 전체(26개 파일)에 해당 패턴 없음. 모두 주석·문서·plan/review 산출물이거나 테스트 상수 값 변경.
- `git diff --stat origin/main...HEAD` 로 전수 26개 파일을 프롬프트의 파일 목록과 대조 확인 — 누락·추가 없음.

뮤테이션 검증: 이번 리뷰에서는 저장소 파일을 직접 수정하지 않았다(모두 `Read`/`Bash cat`/`git diff` 로만 확인). 원복이 필요한 변경 없음 — `git status --short` 로 재확인함(추가 파일 없음).

## 요약
이번 변경은 응답 DTO 두 클래스의 JSDoc 안 리뷰 인용을 `//` 주석으로 옮기고, 그에 맞춰 회귀 가드의 허용 목록을 2건에서 0건으로 좁히는 순수 문서/주석/테스트-상수 변경이다. DTO 클래스의 필드·데코레이터·export 시그니처, 가드 함수의 공개 시그니처는 전혀 바뀌지 않았고, 전역 상태·환경 변수·네트워크·이벤트 콜백에 영향을 주는 코드도 없다. 유일하게 관측 가능한 "부작용"은 CI 래칫이 더 엄격해진다는 점인데, 이는 plan 문서에 뮤턴트 실측(M1·M2 KILLED)으로 의도가 명시·검증되어 있다. 나머지 파일 변경(plan/spec/review 산출물)은 모두 문서 저장 관례에 부합하는 신규 파일 생성으로, 런타임 부작용이 없다.

## 위험도
NONE

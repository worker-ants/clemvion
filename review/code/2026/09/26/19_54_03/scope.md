# 변경 범위(Scope) 리뷰 — request-body-guard

## 검증 방법

- `git log --oneline origin/main..HEAD`, `git diff --stat origin/main...HEAD` 로 전체 39개 파일·2070(+)/12(-) 라인의 변경 목록을 확보.
- 프롬프트에 diff 가 생략되거나 잘린 파일(`request-body-advertised.spec.ts`, `validation.pipe.ts`, `validation.pipe.spec.ts`, `swagger-probe.ts`, `swagger-probe.spec.ts`, `CHANGELOG.md`)은 `git diff origin/main...HEAD -- <path>` 로 직접 재조회해 프롬프트 내용과 대조.
- 저장소 파일은 읽기만 했다 — 뮤테이션 없음. 종료 시 `git status --short` 결과 `?? review/code/2026/09/26/19_54_03/`(본 리뷰 산출물)만 존재.

## 발견사항

- **[INFO]** `swagger-probe.ts` JSDoc 문구 정정("Nest 메이저 업그레이드로 키 형식이 바뀌면…" → "`^` 범위 안의 마이너 · 패치 업그레이드로도 키 형식이 바뀔 수 있고…")이 가드 신설 기능 자체와 직접 관련 없는 곁가지 정정으로 같은 기능 커밋(`1c19eebc7`)에 섞여 있다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` — `bodyParamDesignType` JSDoc(변경 전 게이트 141-142, 함수 정의 앞)
  - 상세: 무단 은닉 변경은 아니다 — `plan/in-progress/request-body-guard.md` "## 방향"에 "곁가지: `shared/testing/swagger-probe.ts` `bodyParamDesignType` JSDoc 의 «Nest 메이저 업그레이드» → «마이너 · 패치 포함»(`18_17_12` INFO4)"로 명시적으로 추적·계획됐고, 이전 `/ai-review` 라운드(`review/code/2026/09/26/19_32_47/scope.md`)에서도 이미 같은 지점을 INFO 로 짚었다. 직전 리뷰와 동일한 결론을 독립적으로 재확인한 것으로, 새로 발견된 결함은 아니다.
  - 제안: 조치 불요(이미 plan 에 승인·기록됨). 향후 유사한 "곁가지 정정"은 별도 커밋으로 분리하면 diff 리뷰가 더 명확해진다는 점만 재확인.

- **[INFO]** `bodyParamDesignType` 내부에 있던 `@Body()` 자리 탐색 로직이 `bodyArgIndexes` 로 추출되며 다중 자리 선택 순서가 `Object.entries()` 삽입 순서 → 인덱스 오름차순 정렬로 바뀌었다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` 함수 `bodyArgIndexes`(신설), `bodyParamDesignType`(위임하도록 축소)
  - 상세: 이 변경은 무관한 리팩터가 아니라 신규 가드(`scanRequestBodyAdvertised`)가 한 핸들러의 `@Body()` 자리를 여럿(키 지정 본문) 결정적 순서로 순회해야 한다는 요구에서 나온 필요 최소 추출이다. 기존 소비처(`bodyParamDesignType`)는 자리가 2개 이상이면 정렬 이전에 즉시 `throw` 하므로(변경 없음) 기존 3개 캐너리(`triggers-rotate-bot-token-body.spec.ts` 등)의 관측 가능한 동작에 영향이 없음을 `git diff` 로 확인했다.
  - 제안: 조치 불요 — 목적과 필요성이 plan("가드 · 대조군 · 곁가지" 항목)에 정합한다.

- **[INFO]** 이번 diff 의 2070줄 삽입 중 다수(약 1700줄, 30개 파일)가 `review/code/2026/09/26/19_32_47/**` (직전 `/ai-review` 1R 산출물)와 `review/consistency/2026/09/26/{18_59_58,19_09_17}/**` (`--spec`/`--impl-prep` consistency-check 산출물)이다.
  - 위치: `review/code/2026/09/26/19_32_47/*.md`, `_retry_state.json`, `meta.json` / `review/consistency/2026/09/26/18_59_58/**`, `review/consistency/2026/09/26/19_09_17/**`
  - 상세: 프로젝트 규약(`CLAUDE.md` "정보 저장 위치") 상 코드 리뷰·일관성 검토 산출물은 각각 `review/code/**`, `review/consistency/**` 에 커밋되는 것이 표준 워크플로이며, `developer` 스킬이 구현 착수 전(`--impl-prep`) · 완료 후(`/ai-review`) 의무적으로 거치는 단계다. 파일 수는 많지만 전부 이번 작업("요청 본문 스키마 가드")의 SDD 절차 부산물이지, 무관한 파일·기능 확장이 아니다.
  - 제안: 조치 불요 — 규약이 요구하는 표준 산출물.

## 요약

39개 변경 파일·2070(+)/12(-) 라인을 `git diff origin/main...HEAD` 로 전수 대조한 결과, 실질 애플리케이션 코드 변경(`validation.pipe.ts`·`swagger-probe.ts`·신규 가드 `request-body-advertised{-guard,}.ts`)은 전부 "요청 본문 스키마 광고 가드 신설"이라는 단일 목적에 수렴하며, `UNVALIDATED_METATYPES` export 승격과 `bodyArgIndexes` 추출은 가드가 파이프·헬퍼와 판정 축을 공유해야 한다는 명시적 설계 근거로 정당화되는 필요 최소 변경이다. 유일한 곁가지(`swagger-probe.ts` JSDoc 문구 정정)는 plan 에 사전 추적·승인된 항목이며 직전 리뷰 라운드에서도 이미 INFO 로 식별돼 새로운 발견이 아니다. 나머지 대다수 삽입 줄은 프로젝트가 의무화한 consistency-check·`/ai-review` 산출물이라 스코프 확장이 아니다. 불필요한 리팩토링, over-engineering, 무관한 파일 수정, 포맷팅/주석/임포트/설정의 의도치 않은 혼입은 발견되지 않았다.

## 위험도

NONE

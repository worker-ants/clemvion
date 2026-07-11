# 변경 범위(Scope) 리뷰 결과

대상: `codebase/channel-web-chat/src/lib/widget-state.test.ts`, `codebase/channel-web-chat/src/lib/widget-state.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `plan/in-progress/webchat-multiturn-restore-test.md`,
`review/code/2026/07/12/01_10_15/*`(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·documentation.md·maintainability.md·
meta.json·requirement.md·scope.md·security.md·side_effect.md·testing.md, 11개 신규 파일).

## 발견사항

- **[INFO]** `widget-state.ts` 의 `mergeMessages` JSDoc 재작성은 로직 무변경(주석만)이나 plan 스코프에 명시적으로 포함된 추적된 수정
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` (diff 상 `mergeMessages` 상단 주석 블록만 교체, `if (snapshot.length >= local.length) return snapshot; return local;` 함수 본문은 완전히 동일)
  - 상세: 관점 6("주석 변경")·8 대상이 되는 변경이지만, 이번 diff 는 test-only 로 시작한 작업이 앞선 `/ai-review`(session `01_10_15`) 에서 "JSDoc 이 실제 `>=` length-select 정책과 어긋난다"(WARNING#2)로 지적된 것을 그 자리에서 정정한 것이다. `plan/in-progress/webchat-multiturn-restore-test.md` §범위에 `src/lib/widget-state.ts — mergeMessages JSDoc 정정(…, ai-review WARNING#2)` 로 명시적으로 기재돼 있고 `RESOLUTION.md` 조치 항목 표에도 동일 커밋(`462a23e4e`)으로 매핑된다. 함수 시그니처·조건문·반환값 모두 diff 전후 바이트 단위로 동일 — 리팩토링이나 로직 변경이 섞여 들어온 것이 아니라 순수 문서 정정 1건이므로 "불필요한 리팩토링"·"의도 이상의 변경"에 해당하지 않는다.
  - 제안: 조치 불요. 향후 유사 사례(리뷰가 지적한 diff-밖 주석을 그 자리에서 고치는 것)는 plan/RESOLUTION 에 근거를 남기는 현재 방식을 유지할 것.

- **[INFO]** `review/code/2026/07/12/01_10_15/**` 11개 신규 파일(이전 `/ai-review` 라운드 산출물)이 이번 changeset 에 포함
  - 위치: `review/code/2026/07/12/01_10_15/{RESOLUTION,SUMMARY,documentation,maintainability,meta,requirement,scope,security,side_effect,testing}.md`, `_retry_state.json`
  - 상세: CLAUDE.md 정보 저장 위치 표·메모리("review/ 는 gitignored 아님 — SUMMARY·RESOLUTION 도 커밋")에 따라 코드 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 커밋되는 것이 프로젝트 규약이다. 모두 순수 신규 파일 추가(`new file mode`)이고 기존 파일 수정·삭제는 없다. 이번 리뷰가 그 다음 라운드(`01_40_43`)이므로 이전 라운드 산출물이 diff 에 잡히는 것은 워크플로 상 정상.
  - 제안: 조치 불요.

- **[INFO]** `widget-state.test.ts` 의 신규 `import type { DisplayMessage } from "./conversation"` 는 같은 diff 내 `user()`/`bot()` 헬퍼 반환 타입에 실사용 — 불필요한 임포트 아님. 그 외 임포트 변경 없음.

## 분석 근거 (관점별)

1. **의도 이상의 변경**: 없음. 신규 테스트 6종(`widget-state.test.ts`) + 통합 테스트 1종(`use-widget-eager-start.test.ts`)은 모두 plan `## 범위` 체크리스트 항목과 1:1 대응. `widget-state.ts` JSDoc 정정도 같은 plan 에 명시적으로 등재된 항목(위 INFO 참조).
2. **불필요한 리팩토링**: 없음. 프로덕션 로직(코드) 변경 0줄 — `widgetReducer`/`mergeMessages` 함수 본문 무변경.
3. **기능 확장(over-engineering)**: 없음. 신규 export·신규 public API·신규 프로덕션 분기 없음. 순수 characterization 테스트 추가.
4. **무관한 수정**: 없음. 4개 코드/문서 파일(테스트 2·prod 1·plan 1) + review 산출물 11개 전부 이번 작업(multi-turn 복원 테스트 + 그 리뷰 사이클) 범위 안.
5. **포맷팅 변경**: 없음. 테스트 파일들의 trailing-newline 부재는 diff 이전부터 존재하던 상태(신규 introduce 아님, 순수 append). 인터리브된 의미 없는 공백/줄바꿈 변경 없음.
6. **주석 변경**: `mergeMessages` JSDoc 1건 — 위 INFO 참조(추적됨, 정당).
7. **임포트 변경**: `DisplayMessage` type-only import 1건 — 실사용, 불필요한 정리/추가 없음.
8. **설정 변경**: 없음. `.eslintrc`/`tsconfig`/`package.json`/CI 설정 등 미포함.

## 요약

이번 changeset 은 plan(`plan/in-progress/webchat-multiturn-restore-test.md`)이 명시한 "test-only, 제품 코드 무변경" 스코프에 정확히 부합한다. 유일한 비-테스트 코드 변경(`widget-state.ts` JSDoc)은 로직 변경 없는 순수 문서 정정이며, 이전 리뷰 라운드(WARNING#2)의 지적을 그 자리에서 해소한 것으로 plan·RESOLUTION 에 근거가 명시돼 있어 스코프 이탈이 아니다. 함께 포함된 `review/code/2026/07/12/01_10_15/**` 11개 파일은 프로젝트 규약상 커밋 대상인 이전 라운드 리뷰 산출물(순수 신규 파일)이다. 리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅·불필요한 임포트·설정 변경 모두 발견되지 않았다.

## 위험도

NONE

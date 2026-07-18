# 부작용(Side Effect) 리뷰 결과

## 검토 대상

1. `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — OR-체인 3분기 mutation 고립 테스트 3건 추가
2. `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput` JSDoc 확장 ("no known producer" 근거 추가). 실행 코드(함수 본문) 무변경
3. `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` — `maxTurns` 항목 주석 정정 (라인 번호 참조 → 함수명 참조)
4. `review/code/2026/07/17/20_06_14/{RESOLUTION.md, SUMMARY.md, _retry_state.json, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md}` — 직전 리뷰 라운드의 산출물 신규 커밋

## 발견사항

- **[INFO]** 프로덕션 로직 무변경 — JSDoc 주석만 확장
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (`isConversationOutput` 위 JSDoc, `@@ -121,19 +121,31 @@` 구간)
  - 상세: diff 를 라인 단위로 대조한 결과 `isConversationOutput` 함수 본문(`return (...)` 의 OR-체인 포함), `unwrapNodeOutput`, `extractIeSnapshot`, `extractAiMetadata`, `extractTurnDebug`, `extractRagSources`, `extractRagDiagnostics` 등 이 파일이 export 하는 모든 함수의 실행 코드는 한 글자도 바뀌지 않았다. 변경분은 전부 JSDoc 블록 안의 "no known producer" 설명(핸들러/WS emit/EIA DTO 전수 확인 결과) 추가뿐이다. 시그니처·리턴 타입·분기 로직·import 대상 모두 동일 — 시그니처/인터페이스 변경 항목에도 해당 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트 3건은 순수 함수 호출 + 로컬 fixture 만 사용
  - 위치: `output-shape.test.ts` 신규 3개 `it(...)` (파일 끝, `isConversationOutput / unwrapNodeOutput regression` describe 블록 안)
  - 상세: 각 테스트는 로컬 `raw` 객체 리터럴을 생성해 `isConversationOutput(raw)` 를 호출하고 boolean 을 단언할 뿐이다. `isConversationOutput` 은 인자를 mutate 하지 않는 순수 함수(내부적으로 `Record<string, unknown>` 캐스팅 + 프로퍼티 read 만 수행, write 없음)이므로 테스트 간 공유 상태·모듈 스코프 mutable 변수·전역 변수·파일시스템·네트워크·환경 변수 접근이 없다. `beforeEach`/`afterEach`/`vi.mock`/module-level fixture 도 도입되지 않았다 — 각 테스트가 완전히 독립적으로 격리돼 실행 순서에 의존하지 않는다.
  - 제안: 없음.

- **[INFO]** `hydration-coverage.test.ts` 는 주석만 수정, 검증 로직·부작용 표면 무변경
  - 위치: `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` `maxTurns` 항목 (파일 내 54-61행)
  - 상세: `COVERAGE_MATRIX` 의 `sites` 배열 값·`REPO_ROOT`/`F()`(`readFileSync` 래퍼) 헬퍼는 이번 diff 에서 손대지 않았다. `F()` 가 파일시스템을 읽는 것은 기존부터 있던 동작이고, 읽는 경로도 하드코딩된 상수 배열에서만 온다(사용자 입력 없음) — 이번 변경으로 새로 도입된 side effect 표면이 아니다. 변경분은 "왜 이 필드가 `output.conversationConfig` 가 아니라 `buildConvConfigFromStructured` 병합으로 채워지는지"를 설명하는 주석 텍스트 교체뿐.
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/17/20_06_14/*` 신규 파일 커밋 — 예상된 파일시스템 산출물
  - 위치: `review/code/2026/07/17/20_06_14/{RESOLUTION.md, SUMMARY.md, _retry_state.json, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md}` (전부 `new file mode`)
  - 상세: 코드 리뷰 산출물은 프로젝트 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이 명시한 정식 저장 위치이며, 해당 세션의 파일들이 git 이력에 처음 반영되는 것뿐이다(런타임 코드가 아닌 정적 문서/리뷰 텍스트). 애플리케이션 실행 경로에 영향이 없고, 신규 전역 상태·설정·환경 변수도 도입하지 않는다. 다만 `_retry_state.json` 은 `"routing_status": "pending"`, `"agents_success": []` 등 **세션 진행 중간 스냅샷**을 그대로 커밋한 것으로 보인다 — 부작용은 아니지만(사후 실행에 영향 없는 정적 JSON), 반영 완료 후의 최종 상태가 아니라 초기 상태가 영구히 기록에 남는다는 점은 side-effect 카테고리 밖의 문서 정확성 이슈로만 참고.
  - 제안: 없음 (블로킹 사유 아님). 필요 시 maintainability/documentation 리뷰 관점에서 별도 논의.

- **[INFO]** 테스트 실행 자체의 부작용 표면 — mutation 실측 절차(RESOLUTION.md 기재)는 diff 밖의 일회성 검증 행위
  - 위치: `review/code/2026/07/17/20_06_14/RESOLUTION.md` §mutation 실측
  - 상세: RESOLUTION.md 는 `output-shape.ts` 를 임시로 훼손 후 원복해 mutation 격리를 실측했다고 기록한다. 이는 **커밋된 코드에는 반영되지 않은** 검증 절차(파일을 임시로 바꿨다가 `git status` clean 확인 후 복구)이며, 최종 diff 에는 그 훼손이 남아있지 않다 — 즉 실제 반영된 코드에는 해당 절차로 인한 잔여 부작용이 없다. 정보성으로만 기재.
  - 제안: 없음.

## 실질 발견 없음

- 전역 변수 도입/수정: 없음.
- 함수/메서드 시그니처 변경: 없음 (`isConversationOutput`, `unwrapNodeOutput` 등 전부 동일).
- 공개 API(export) 변경: 없음 — export 되는 타입/함수 목록 무변경.
- 환경 변수 읽기/쓰기: 없음 (신규 도입 없음, 기존 `readFileSync` 패턴도 무변경).
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 — 테스트는 콜백 등록 없이 동기 함수 호출 + `expect` 단언만 수행.
- 파일시스템 부작용(런타임 코드 관점): 없음 — 유일한 파일 생성은 리뷰 프로세스 산출물(`review/code/**`)이며 이는 프로젝트 규약이 지정한 정식 저장 경로.

## 요약

변경 세트는 (1) `output-shape.ts` 의 JSDoc 확장(실행 로직 0 변경), (2) `output-shape.test.ts` 에 순수 함수 호출 기반의 격리 테스트 3건 추가, (3) `hydration-coverage.test.ts` 의 주석 정정, (4) 직전 리뷰 세션 산출물의 최초 커밋으로 구성된다. 신규/변경 테스트는 로컬 fixture 객체만 사용하는 순수 함수 호출이라 전역 상태·모듈 스코프 mutable 변수·파일시스템·네트워크·환경 변수·이벤트/콜백에 전혀 접근하지 않으며, 프로덕션 함수의 시그니처·반환 타입·export 표면도 모두 그대로다. `review/` 하위 신규 파일들은 프로젝트가 정한 리뷰 산출물 저장 규약에 부합하는 정적 문서로, 런타임 부작용 표면이 아니다. 부작용 관점에서 차단 사유를 발견하지 못했다.

## 위험도

NONE

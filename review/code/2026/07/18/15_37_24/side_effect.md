# 부작용(Side Effect) 리뷰 결과

## 검토 대상

- **애플리케이션 코드/테스트 (파일 1-3)**
  1. `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — `isConversationOutput` OR-체인 3분기 + AND-guard 4곳, 총 7개 mutation 고립 테스트 신규 추가
  2. `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput` JSDoc 확장("no known producer" 근거 기록). 함수 본문(실행 로직) 무변경
  3. `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` — `maxTurns` 항목 설명 주석 정정(하드코딩 라인 번호 → 함수명 참조)
- **리뷰 산출물 커밋 (파일 4-23)**: `review/code/2026/07/17/20_06_14/**` 9개 파일 + `review/code/2026/07/18/10_40_03/**` 11개 파일 신규 추가(`RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, 개별 리뷰어 리포트 `.md`)

## 발견사항

- **[INFO]** 프로덕션 로직 무변경 — JSDoc 주석만 확장
  - 위치: `output-shape.ts` `isConversationOutput` 함수 (JSDoc 100-149행, 함수 본문 150-209행)
  - 상세: 실제 파일을 직접 읽어 대조한 결과 `isConversationOutput` 의 `return (...)` OR/AND-체인, `unwrapNodeOutput`/`extractIeSnapshot` 등 export 되는 모든 함수의 실행 코드는 한 글자도 바뀌지 않았다. 변경분은 JSDoc 블록 안의 "no known producer" 설명 문단 추가뿐이다. 시그니처·리턴 타입·분기 로직·import 대상 모두 기존과 동일 — 시그니처/공개 인터페이스 변경 항목에 해당 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트 7건(OR-체인 3 + AND-guard 4)은 순수 함수 호출 + 로컬 fixture 만 사용
  - 위치: `output-shape.test.ts` 신규 `it(...)` 7개 블록 (기존 `describe("isConversationOutput / unwrapNodeOutput regression", ...)` 말미)
  - 상세: 각 테스트는 로컬 `raw` 객체 리터럴을 만들어 `isConversationOutput(raw)` 를 호출하고 boolean 을 단언할 뿐이다. `isConversationOutput` 은 인자를 매개변수로 받아 `Record<string, unknown>` 캐스팅 후 프로퍼티를 읽기만 하며(`raw.interactionType`, `output.messages` 등), 어디에도 `raw[...] = ...` 형태의 쓰기가 없어 인자를 mutate 하지 않는 순수 함수다. `beforeEach`/`afterEach`/`vi.mock`/module-level mutable fixture 도 도입되지 않아 테스트 간 공유 상태·전역 변수·파일시스템·네트워크·환경 변수 접근이 전혀 없다.
  - 제안: 없음.

- **[INFO]** `hydration-coverage.test.ts` 는 주석만 수정, 파일시스템 접근 패턴 자체는 무변경
  - 위치: `hydration-coverage.test.ts` `maxTurns` 항목 (54-61행 부근)
  - 상세: `COVERAGE_MATRIX` 의 `sites` 배열 값·`REPO_ROOT`/`F()`(`readFileSync` 래퍼) 헬퍼는 이번 diff 에서 손대지 않았다. `F()` 가 파일시스템을 읽는 것은 기존부터 있던 동작이고 읽는 경로도 코드에 하드코딩된 상수 배열에서만 오므로(사용자 입력 경유 없음), 이번 변경으로 새로 도입된 side effect 표면이 아니다. 변경분은 "왜 이 필드가 `output.conversationConfig` 직접 읽기가 아니라 `buildConvConfigFromStructured` 병합으로 채워지는지"를 설명하는 주석 텍스트 교체뿐.
  - 제안: 없음.

- **[INFO]** `review/code/**` 신규 파일 20건 커밋 — 프로젝트 규약이 지정한 정식 저장 경로, 런타임 부작용 아님
  - 위치: `review/code/2026/07/17/20_06_14/*` 9건, `review/code/2026/07/18/10_40_03/*` 11건 (전부 `new file mode`)
  - 상세: CLAUDE.md 가 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"·"review/ 는 gitignored 아님(SUMMARY·RESOLUTION 도 커밋)"으로 명시한 표준 워크플로 산출물이다. 애플리케이션 실행 경로에 영향이 없고, 신규 전역 상태·설정·환경 변수를 도입하지 않는다. 단, `_retry_state.json` 두 건 모두 `"routing_status": "pending"`, `"agents_success": []` 등 **세션 진행 중간 스냅샷**을 최종 상태 갱신 없이 그대로 영구 커밋한다 — 부작용 카테고리는 아니고(정적 JSON, 이후 실행에 영향 없음) 감사 문서 정확성 이슈(다른 리뷰어가 이미 WARNING/INFO 로 지적)로만 참고.
  - 제안: 없음(side_effect 관점 차단 사유 아님). 문서 정확성 이슈는 requirement/maintainability 리뷰가 이미 다룸.

- **[INFO]** RESOLUTION.md 가 서술하는 mutation 실측 절차는 diff 밖의 일회성 검증 행위, 커밋에 잔여 없음
  - 위치: `review/code/2026/07/17/20_06_14/RESOLUTION.md` §mutation 실측, `review/code/2026/07/18/10_40_03/RESOLUTION.md` §mutation 실측 (A~D)
  - 상세: 두 RESOLUTION 모두 `output-shape.ts` 를 임시로 훼손 후 `git status`/`git diff --stat` 로 원복 확인했다고 기록한다. 이는 커밋된 코드에는 반영되지 않은 검증 절차이며, 최종 diff(HEAD)에는 그 훼손이 남아있지 않음을 직접 파일 읽기로 확인했다(위 JSDoc 확인과 동일 파일 읽기).
  - 제안: 없음.

## 실질 발견 없음

- 전역 변수 도입/수정: 없음.
- 함수/메서드 시그니처 변경: 없음(`isConversationOutput`, `unwrapNodeOutput` 등 export 표면 전부 동일, 직접 소스 대조로 확인).
- 공개 API(export) 변경: 없음.
- 환경 변수 읽기/쓰기: 없음(신규 도입 없음, 기존 `readFileSync` 패턴도 무변경).
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 — 신규 테스트는 콜백 등록 없이 동기 함수 호출 + `expect` 단언만 수행.
- 파일시스템 부작용(런타임 코드 관점): 없음 — 유일한 파일 생성은 리뷰 프로세스 산출물(`review/code/**`)이며 프로젝트 규약이 지정한 정식 경로.

## 요약

이번 diff 는 (1) `output-shape.ts` 의 JSDoc 확장(실행 로직 0 변경, 직접 파일 대조로 확인), (2) `output-shape.test.ts` 에 순수 함수 호출 기반 mutation 고립 테스트 7건(OR-체인 3 + AND-guard 4) 추가, (3) `hydration-coverage.test.ts` 주석 정정, (4) 직전 두 리뷰 세션(20_06_14, 10_40_03) 산출물 20개 파일의 최초 커밋으로 구성된다. 신규/변경 테스트는 로컬 fixture 객체만 사용하는 순수 함수 호출이라 전역 상태·모듈 스코프 mutable 변수·파일시스템·네트워크·환경 변수·이벤트/콜백에 전혀 접근하지 않으며, 대상 함수(`isConversationOutput`)는 인자를 mutate 하지 않고 프로덕션 함수의 시그니처·반환 타입·export 표면도 모두 그대로다. `review/` 하위 신규 파일들은 프로젝트가 정한 리뷰 산출물 저장 규약에 부합하는 정적 문서로, 런타임 부작용 표면이 아니다. 부작용 관점에서 차단 사유를 발견하지 못했다.

## 위험도

NONE

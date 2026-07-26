# 문서화(Documentation) Review — linear-cancel-mechanism (5R, W21/W22 실코드 대조 + 5번째 재발 여부 정밀 검증)

## 스코프 노트 (선행 확인)

이번 프롬프트에 첨부된 "변경된 코드" 24개 파일은 전부 `review/code/2026/07/26/{13_47_42,14_45_30}/*`
(3R·4R 리뷰 산출물 자신)이며, 실제 `codebase/**` 소스 diff(`execution-engine.service.ts`,
`CHANGELOG.md` 등)는 이번 프롬프트에 포함돼 있지 않다 — 3R·4R 이 이미 여러 차례 지적한 "harness
diff-base 스코프 갭"의 재현이다(직전 라운드들과 동일 증상, 새로운 결함 아님). 오케스트레이터
지시(W21·W22 정정 여부, 5번째 재발 여부)를 판정하려면 코드 자체를 직접 열어야 하므로, `Read`/`Grep`
으로 현재 워크트리의 실제 소스(`execution-engine.service.ts`, `CHANGELOG.md`,
`node-cancellation-residual-signal-propagation.md`, `spec/conventions/node-cancellation.md`)와
`git log`/`git show 0f4047426`(4R 실코드 수정 커밋)를 직접 대조해 검증했다. 아래 위치 인용은 프롬프트
게이트가 아니라 워크트리 현재 상태를 `Read`로 직접 확인한 실제 줄 번호다.

## 중점 검증 ① — W21 (§5→§2.2 오인용 + 정리 지점 2곳→3곳) 실코드 정정 확인

**결론: 완전히 해소됨.**

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 를 직접 열어 대조:

- **`containerCancelCheckedAtMs` 필드 JSDoc(현재 536-541행)** — "누수 방지: execution 종료 지점
  **3곳**에서 반드시 `delete` 한다 — `finalizeRehydrationCleanup`, `runExecution` catch/finally,
  그리고 `executeBackgroundSubgraph` finally (ai-review W14: ...)" 로 정정돼 있다. 3곳 모두 실제
  `delete` 호출부(`:2673`, `:4547`, `:6988`)와 정확히 대응한다(`grep -n
  "containerCancelCheckedAtMs"` 로 5개 참조 지점 전수 확인 — 필드 선언 1 + delete 3 + JSDoc 코멘트
  참조 다수).
- **`CONTAINER_CANCEL_CHECK_THROTTLE_MS` 필드 JSDoc(현재 545-551행)** — "`spec/conventions/
  node-cancellation.md` **§2.2**(CPU 바운드 / 즉시 완료 노드)가 명시하듯 취소 전파는 애초부터
  **best-effort** 계약" 으로 정정돼 있다. `spec/conventions/node-cancellation.md` 를 직접 열어
  §2.2(52-54행)에 실제로 "signal 미지원 — best-effort. 자기 작업 완료까지 계속 진행해도 무방"
  문구가 있음을, §5(103-119행, `AbortError` 분류)에는 그 문구가 **없음**을 재확인했다.
- 전체 파일에서 `spec/conventions/node-cancellation.md` §5 를 best-effort 근거로 잘못 인용하는
  다른 잔존 지점이 있는지 `grep -n "§5\|§2\.2\|best-effort"` 전수 재확인 — 남은 `§5.1` 인용
  (`:462`, `isAbortError` JSDoc — AbortError 분류 자체를 다뤄 정확한 인용; `:5762`, `:5769`,
  `:6157`, `:7921` 등 — 모두 §5.1 `AbortError` 분류·`output.error` 봉투 형식 등 §5.1 이 실제로
  다루는 주제와 일치)는 전부 정확한 참조다. best-effort 근거를 잘못된 절에서 인용하는 잔존
  인스턴스는 발견되지 않았다.
- `plan/in-progress/node-cancellation-residual-signal-propagation.md:177-178` 도 여전히
  §2.2 로 정정된 상태를 유지하고 있음을 재확인(3R 조치가 되돌아가지 않았음).

W21(문서·유지보수성 2명 수렴, "4번째 재발")은 소스 JSDoc·plan 문서 양쪽 모두에서 실코드 기준으로
완전히 해소됐다.

## 중점 검증 ② — W22 (CHANGELOG 에 W14~W16 미반영) 실코드 정정 확인

**결론: 완전히 해소됨.**

`CHANGELOG.md` 의 "## Unreleased — 외부 cancel(Stop) 후에도 하류 노드 dispatch·부수효과가 계속되던
결함 수정" 섹션(1-21행)에 항목 6~9 가 추가돼 있다:

- 항목 6 — "스로틀 상태 Map 누수 수정(ai-review W14)" — `containerCancelCheckedAtMs` background
  경로 누수, "정리 지점을 3곳으로 맞췄다" 서술이 위 W21 검증 결과와 일치.
- 항목 7 — "Sub-Workflow 노드의 취소 오분류·내부 메시지 노출 수정(ai-review W15)" — 실제
  `executeNode`(5822-5844행) 의 `ExecutionCancelledError` 분기가 `CANCELLED` 마킹 +
  `NODE_CANCELLED` emit(내부 message 미포함)을 수행함을 코드로 직접 확인, 서술과 일치.
- 항목 8 — "재시도 정책 노드에서 취소가 재시도되던 결함 수정(ai-review 4R)" — 실제
  `executeWithRetry`(6187행) 에 `isAbortError(lastError) || err instanceof
  ExecutionCancelledError` 로 정확히 수정돼 있음을 확인(W20).
- 항목 9 — "취소 시 `execution.error` 저장 금지(ai-review W16)" — `retry-turn.service.ts` 의
  `isCancelled` 게이팅(3R RESOLUTION·4R testing 이 이미 확인한 그대로) 서술과 일치.

W22 도 완전히 해소됐다.

## 5번째 재발 여부 — 신규 코드/CHANGELOG 기준으로는 없음, 단 미해소 리뷰 산출물 1건 승계

지시대로 "이번 diff 의 모든 주석·JSDoc·CHANGELOG·RESOLUTION 서술을 실제 코드와 대조"한 결과, 코드
(JSDoc)·CHANGELOG 양쪽 다 실제 소스와 문자 그대로 일치하며, 이번 라운드가 새로 만든 코드/문서 조합에서
**새로운(5번째) 인용 불일치는 발견되지 않았다.**

다만 4R 자신의 `documentation.md`(review/code/2026/07/26/14_45_30/documentation.md:116-131)가
스스로 "같은 클래스의 **다섯 번째** 사례"라고 이미 명명해 둔 항목 하나가 있고, 이는 W19~W24 조치
표(SUMMARY.md)에 **번호가 매겨지지 않아** RESOLUTION 4R 의 명시적 조치 대상에서 빠졌다 — 실제로
아직 미해소 상태임을 재확인했다.

### [INFO] `review/code/2026/07/26/13_47_42/RESOLUTION.md` W17 행의 줄 인용이 여전히 실제 위치와 다르다 (4R 이 이미 발견한 항목, 아직 미조치)

- 위치: `review/code/2026/07/26/13_47_42/RESOLUTION.md:12` (W17 행, "→ `execution-engine.service.ts:10196`")
- 상세: 4R `documentation.md`가 이미 "RESOLUTION.md 는 W17 근거를 `:10196` 으로 기재하지만 실제
  위치는 W17 이 건드리지 않은 기존 W9 테스트 부근이고, 실제 수정 위치는(4R 시점 기준) `:10308`
  부근"이라고 정확히 지적했다. 이번에 직접 재확인한 결과, 현재(4R 의 W19/W20 코드+테스트 82줄
  추가 이후) `execution-engine.service.spec.ts` 에서 `ai-review W17` 태그가 붙은 실제 위치는
  `:10386`(`Date.now` 고정 코드), 해당 `it(...)` 블록 시작은 `:10385` 이다 — `RESOLUTION.md`의
  `:10196` 은 여전히 근처의 다른(2R 시절) 테스트("아이템 경계 취소가 컨테이너 노드를 FAILED 로
  오분류... (W9)", 실제로 `:10271` 부근)를 가리켜 부정확하다.
  - 이 항목은 SUMMARY.md(4R)의 W19~W24 조치 표에 번호가 매겨지지 않고 "## 참고 (INFO)" 섹션
    한 줄로만 남아, RESOLUTION 4R 의 "4건 조치" 목록(W19·W20·W21·W22)에서 빠졌다 — 즉 인지는
    됐으나 액션 아이템으로 승격되지 않아 이번 라운드에도 그대로 남아 있다.
  - 코드 정확성에는 영향이 없다(review 산출물 내부의 과거 감사 기록 오류일 뿐이며, `RESOLUTION.md`
    는 관례상 사후 수정 대상이 아닌 그 라운드의 역사적 기록물이다). "인용이 실체와 어긋난다"
    패턴이 이 저장소에서 5라운드 연속으로 (형태를 바꿔가며) 관찰되고 있다는 근거로 재확인 차원에서
    기록해 둔다 — 새로운 차단 사유는 아니다.
- 제안: 필수 아님(review 산출물은 일반적으로 사후 수정하지 않는 관례). 다만 이 결함 클래스의
  근본 원인이 "라인 번호를 손으로 옮겨 적는 인용 관행" 자체에 있다는 점이 4R 문서화 리뷰가
  이미 짚었듯 5회 가까이 반복되고 있으므로, `spec/conventions/` 또는 리뷰 산출물 작성 관례에
  "줄 번호 인용은 커밋 SHA + 상대 검색어(함수/테스트명)를 함께 남긴다" 정도의 저비용 완화책을
  고려할 만하다(4R maintainability 가 재throw 가드 확산에 대해 제안한 "규약 명문화"와 같은 결).

### [INFO] CHANGELOG 항목 8 의 태그 표기가 형제 항목들과 다른 형식이다

- 위치: `CHANGELOG.md:18` (항목 8, "재시도 정책 노드에서 취소가 재시도되던 결함 수정(ai-review 4R)")
- 상세: 같은 목록의 형제 항목들은 전부 구체적 이슈 번호로 태깅돼 있다 — 항목 6 "(ai-review W14)",
  항목 7 "(ai-review W15)", 항목 9 "(ai-review W16)". 항목 8만 라운드 명("4R")으로 태깅돼 이
  결함의 원 발견 번호(W20)가 CHANGELOG 자체에서는 드러나지 않는다. `RESOLUTION.md`/`SUMMARY.md`
  등 다른 산출물과 교차 대조하면 W20 임을 알 수 있으므로 실질적 추적 불가는 아니지만, 같은
  섹션 내 일관성이 근소하게 어긋난다.
- 제안: `(ai-review W20)` 으로 통일. 필수 아님, 우선순위 낮음.

## 정합성 교차검증 (신뢰도 근거 — 이번 라운드에서 직접 확인)

- `execution-engine.service.ts:6187` — `if (isAbortError(lastError) || err instanceof
  ExecutionCancelledError) {` 로 W20 이 정확히 구현돼 있고, 같은 줄 위 주석("ai-review 4R
  (requirement) — `ExecutionCancelledError` 도 같은 이유로 제외한다")이 실제 코드와 일치.
- `execution-engine.service.ts:5822-5844` — W19 재throw 확장(`CANCELLED` 마킹 +
  `NODE_CANCELLED` emit, 내부 message 미포함)이 SUMMARY/RESOLUTION 서술과 정확히 일치.
- `execution-engine.service.ts` 전체에서 `containerCancelCheckedAtMs` 참조 5곳(필드 선언
  1 + `delete` 3 + `assertExecutionNotCancelled` 내부 get/set 2)이 모두 JSDoc 이 서술하는
  3-지점 정리 불변식과 부합.
- `spec/conventions/node-cancellation.md` 실제 섹션 구조(§2.2/§5) 확인 — 코드·plan 문서의
  §2.2 인용이 spec 실체와 문자 그대로 일치.

## 스코프 밖 항목 (참고, 유지)

- README/설정 문서 갱신 불요 — 여전히 새 환경변수·설정 플래그 없음.
- API 문서 갱신 불요 — HTTP/WS 계약 변경 없음(이번 4R 변경 역시 기존 emit/응답 필드의 값
  정확성 수정이지 스키마 변경이 아님).
- 이미 해소 확인된 C1~C5·W1~W18 은 재론하지 않음(지시 준수). W19·W20·W21·W22 도 이번
  라운드에서 실코드 기준 해소를 재확인했으므로 향후 라운드에서 재론 불필요.
- W23(구조적 flakiness, 백로그)·W24(프로세스 수용, SUMMARY §범위 판정 신설로 완결)는 이번
  라운드 문서화 관점에서 추가로 지적할 사항 없음.

## 요약

이번 라운드의 핵심 검증 대상인 W21(§5→§2.2 오인용 + Map 정리 지점 2곳→3곳 서술)과
W22(CHANGELOG 에 W14~W16 미반영)는 둘 다 실제 소스(`execution-engine.service.ts` JSDoc,
`CHANGELOG.md`)를 직접 열어 대조한 결과 **완전히 해소됐다** — JSDoc 은 3곳 정리 지점을 정확히
나열하고 §2.2 를 정확히 인용하며, CHANGELOG 는 W14·W15·W20·W16 을 항목 6~9 로 순서대로 기록하고
있고 코드와 문자 그대로 일치한다. 이번 diff(3R·4R 리뷰 산출물)에 새로 등장한 JSDoc/주석/CHANGELOG
서술 중 실코드와 어긋나는 신규(5번째) 사례는 발견하지 못했다. 다만 4R 자신이 이미 "다섯 번째
사례"로 명명해 둔 `RESOLUTION.md`(13_47_42)의 W17 줄 인용 오류(`:10196` → 실제 `:10386` 부근)가
SUMMARY 의 조치 표에 번호가 매겨지지 않아 여전히 미해소 상태로 남아 있음을 재확인했다(INFO,
코드 정확성 무영향, review 산출물 내부 기록 오류). CHANGELOG 항목 8 의 태그 표기가 형제 항목과
형식이 다른 점도 사소한 일관성 이슈로 기록한다(INFO). 두 건 모두 차단 사유는 아니다.

## 위험도

LOW

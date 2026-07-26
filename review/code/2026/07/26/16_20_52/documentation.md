# 문서화(Documentation) Review — linear-cancel-mechanism (7R, W26 JSDoc 고아 해소 검증)

## 스코프 노트

이번 라운드 프롬프트에 첨부된 48개 파일은 전부 `review/code/2026/07/26/{13_47_42,14_45_30,15_30_00,15_56_53}/*` 리뷰 산출물이며, 검증 대상 실제 소스 diff 는 payload 에 포함돼 있지 않다 — 6R 이전부터 반복된 동일한 "harness diff-list 갭"으로, 이미 harness 백로그로 분리돼 있어 재론하지 않는다. 지시대로 `git log`/`git show`로 실제 커밋을 직접 열어 대조했다. 이번 라운드에서 검토 대상이 되는 실제 코드 변경은 커밋 `3428129b1`("fix(engine): 6R W26·W27 — JSDoc 고아 해소 + error 키 부재 불변식 결속") 하나뿐이며, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` + `execution-engine.service.spec.ts` 두 파일과 `review/code/2026/07/26/15_56_53/*` 리뷰 산출물(RESOLUTION.md·SUMMARY.md 등)로 구성된다.

## 중점 검증 — W26(JSDoc 고아) 해소 여부

직전 라운드(6R, `review/code/2026/07/26/15_56_53/documentation.md`)가 낸 WARNING: 5R 에서 신규 `markNodeCancelled` 를 기존 `finalizeCancelledExecution` 의 JSDoc 과 그 함수 선언 사이에 삽입해, `finalizeCancelledExecution` 이 자신의 W12 JSDoc 과 47줄 떨어진 고아 상태가 됐다는 지적이었다.

`git show 3428129b1 -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 로 실제 diff 를 확인했다: 기존 `finalizeCancelledExecution` JSDoc 블록(W12, `@param logContext` 로 끝남)을 원래 위치(`markNodeCancelled` JSDoc **앞**)에서 삭제하고, `markNodeCancelled` 함수 본문이 끝나는 지점(원래 빈 줄 하나 뒤, `finalizeCancelledExecution` 선언 바로 앞)에 **바이트 단위로 동일한 텍스트**로 재삽입했다 — diff 의 `-` 블록과 `+` 블록을 줄 단위로 대조한 결과 코멘트 문구·`@param` 서술·줄바꿈 전부 일치, 이동 중 내용 훼손 없음.

실제 파일(`execution-engine.service.ts`)을 직접 열어 재확인한 현재 구조:

| 요소 | 줄 |
| --- | --- |
| `markNodeCancelled` JSDoc 시작 | 4551 |
| `markNodeCancelled` JSDoc 종료(`*/`) | 4565 |
| `markNodeCancelled` 선언 | **4566** (JSDoc 바로 다음 줄) |
| `markNodeCancelled` 함수 종료 `}` | 4595 |
| (빈 줄) | 4596 |
| `finalizeCancelledExecution` JSDoc 시작 | 4597 |
| `finalizeCancelledExecution` JSDoc 종료(`*/`) | 4616 |
| `finalizeCancelledExecution` 선언 | **4617** (JSDoc 바로 다음 줄) |
| (빈 줄) | 4631 |
| `finalizeFailedExecution` JSDoc 시작 | 4632 |
| `finalizeFailedExecution` 선언 | 4642 |

세 헬퍼(`markNodeCancelled`/`finalizeCancelledExecution`/`finalizeFailedExecution`) 모두 자기 JSDoc 이 자기 선언과 사이에 다른 코드 없이 바로 인접해 있고, 각 블록 사이는 빈 줄 하나로만 분리돼 있다(관용적 멤버 간 간격). 파일 전체를 대상으로 "`*/` 직후 빈 줄 없이 바로 `/**`가 이어지는" back-to-back JSDoc 패턴(W26 이 발생시켰던 정확한 형태)을 스캔했으나 **한 건도 없음**을 확인했다.

**결론: W26 은 완전히 해소됐다.** (a) 구조 — 각 JSDoc 이 자기 함수 선언과 인접, 더 이상 고아 없음. (b) 내용 — 이동 과정에서 텍스트 훼손·누락 없음(diff 상 `-`/`+` 완전 동일). IDE hover/TypeDoc 이 이제 올바른 선언에 올바른 문서를 귀속시킬 것으로 판단된다. 재론하지 않는다.

## W27 관련 문서 확인 (부수, 재론 아님)

W27(헬퍼의 불변식 — `errorEnvelope` 부재 시 `error` 키 미생성 — 을 검증하는 단언 부재)에 대한 조치로 추가된 테스트 코드(`execution-engine.service.spec.ts:5799-5803`)에는 "왜 이 단언이 필요한가"(기존 문자열 단언만으로는 구조적 누출을 못 잡는다는 것을 mutation 으로 실측)를 설명하는 인라인 주석이 함께 추가돼 있다. 기존 인접 주석들(5772-5778, 5789)과 스타일·형식이 일관되고, 내용도 커밋 메시지의 mutation 근거(leak 주입 시 RED)와 정확히 일치한다 — 새 결함 없음.

## 신규 발견

- **[INFO]** `RESOLUTION.md` 의 배치 실측 인용이 실제 줄 번호와 1줄 어긋남
  - 위치: `review/code/2026/07/26/15_56_53/RESOLUTION.md` — "배치 실측: ... `finalizeCancelledExecution` JSDoc(`:4598~`) → `:4617` 선언" 서술 (`git show 3428129b1 -- review/code/2026/07/26/15_56_53/RESOLUTION.md` 로 확인)
  - 상세: 실제 파일에서 `finalizeCancelledExecution` 의 JSDoc 은 `:4598`이 아니라 **`:4597`**에서 시작한다(`  /**`, 그 앞 4596행은 빈 줄, 4595행이 `markNodeCancelled`의 닫는 `}`). 결론(JSDoc 이 자기 선언과 인접)과 조치 자체는 정확하지만, 인용된 시작 줄 번호가 1줄 벗어나 있다. 이 리뷰 산출물은 코드베이스가 아니라 review 메타 문서이고 다른 항목(`:4566`, `:4617` 등)은 정확해 실질적으로 독자를 오도할 위험은 낮지만, 이 프로젝트가 이전 라운드들에서 "인용·서술이 실체와 어긋난다" 패턴을 반복 지적해 온 이력을 감안해 기록해 둔다.
  - 제안: 사소한 오탈자 수준이라 별도 커밋으로 정정할 실익은 낮음. 참고용 기록.

## 그 외 항목 (확인만, 재론 아님)

- **CHANGELOG 미갱신은 결함 아님** — `CHANGELOG.md` 최상단 "Unreleased — 외부 cancel(Stop) 후에도 하류 노드 dispatch·부수효과가 계속되던 결함 수정" 항목이 W16 까지만 개별 서술하고 W25(`markNodeCancelled` 추출)·W26(JSDoc 재배치)·W27(단언 추가)은 언급하지 않는다. 그러나 W25·W26 은 동작 보존 순수 리팩터/문서 재배치이고 W27 은 신규 회귀 단언 추가(동작 변경 없음)라, 5R·6R 문서화 리뷰가 이미 확립한 선례(W12 `finalizeCancelledExecution` 추출도 순수 리팩터라 CHANGELOG 대상이 아니었음)와 동일한 패턴이다. 새로운 판단이 필요 없음.
- **plan SoT(`plan/in-progress/node-cancellation-residual-signal-propagation.md`) 미갱신도 결함 아님** — 이 문서는 spec 레벨 트레이드오프(W10 스로틀 등)만 다루며 ai-review WARNING 개별 항목(W19~W27)을 전수 추적하지 않는 것이 이미 확립된 관용구.
- **인라인 주석 정확성** — `finally` 블록의 기존 주석(`:4543-4544`, `containerCancelCheckedAtMs` 정리 근거)은 이번 diff 로 변경되지 않았고 현재 코드(`:4547` `this.containerCancelCheckedAtMs.delete(executionId)`)와 여전히 일치한다. stale 코멘트 없음.
- **RESOLUTION.md/SUMMARY.md 본문 서술** — 나머지 근거·조치 서술(mutation RED/GREEN 절차, W26 이동 방향, W27 단언 내용)은 실제 diff·커밋 메시지와 대조해 전부 일치함을 확인했다(위 1건의 줄 번호 오탈자 제외).

## 요약

직전 라운드(6R)가 지적한 W26(`markNodeCancelled` JSDoc/본문이 `finalizeCancelledExecution` 의 JSDoc 과 그 선언 사이에 끼어들어 후자가 자기 문서와 고아가 된 문제)은 커밋 `3428129b1`에서 완전히 해소됐다 — 헬퍼 블록 이동으로 세 헬퍼(`markNodeCancelled`/`finalizeCancelledExecution`/`finalizeFailedExecution`) 모두 자기 JSDoc 과 인접하고, 이동 과정에서 JSDoc 내용(문구·`@param` 서술)은 바이트 단위로 보존됐다. 파일 전체에 대해 동일 패턴(back-to-back JSDoc)이 다른 곳에서도 발생했는지 스캔했으나 추가 사례는 없다. W27 조치로 추가된 테스트 인라인 주석도 정확하고 기존 스타일과 일관된다. 이번 라운드에서 새로 발견한 것은 `RESOLUTION.md`(리뷰 메타 문서, 코드베이스 아님)의 줄 번호 인용이 1줄 어긋난 사소한 오탈자 1건(INFO)뿐이며, 코드베이스 자체의 문서화 결함은 없다.

## 위험도

NONE

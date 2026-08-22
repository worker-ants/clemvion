# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `resolveTriggerParameters` 함수 JSDoc 블록 안에서 영어→한국어로 언어가 전환됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-124` (기존 영문 설명은 100-107, 새로 추가된 한국어 설명은 109-123 — 같은 `/** ... */` 블록 하나 안에서 전환)
  - 상세: 이 함수의 docblock 은 원래 전부 영어(`Resolve raw parameter values against a declared schema.` 이하 bullet 목록)였는데, 이번 diff 가 그 바로 아래에 `## ⚠️ Manual 실행 경로는 이 함수를 직접 부르지 않는다` 로 시작하는 한국어 설명 17줄을 같은 블록에 이어붙였다. 결과적으로 **하나의 연속된 JSDoc 주석**이 문장 중간에 영어→한국어로 바뀐다. 같은 PR 의 다른 두 파일(`trigger-parameter.types.ts` 의 새 comment 들은 순한국어, `workflows.controller.ts` 의 번역된 블록도 순한국어)은 블록 단위로 언어를 통일했지만, 이 파일만 기존 영문 블록에 이어쓰기를 해 블록 내부가 섞였다. 이 저장소의 다른 다단락 JSDoc(`handler-output.adapter.ts` 등)은 함수 docblock 은 한 언어로 통일하고 한국어 설명은 별도의 인라인 `//` 주석으로 분리하는 패턴을 쓴다 — 이번 추가는 그 패턴과 어긋난다.
  - 제안: 새로 추가한 한국어 단락을 별도 블록(예: 함수 위 JSDoc 은 영문 요약만 남기고, 그 아래 별도의 한국어 `//` 주석 블록으로 wrapper 안내를 분리)으로 떼어내거나, 반대로 기존 영문 bullet 들도 한국어로 통일해 블록 하나가 한 언어를 유지하게 한다.

- **[INFO]** `workflows.controller.ts` 의 `execute()` 메서드는 이번 fix 이후에도 여전히 한/영 혼재
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute()` 메서드 내부. 한국어로 남은 부분: 위치 `280` 대 부근("Graceful Shutdown gate"), `320-322`(이번에 번역된 `details` 주석). 영어로 남은 부분: `294`(`// Verify workflow belongs to workspace`), `297-299`(`// Resolve trigger parameters against...`), `332-335`(`// Stamp the trigger-source marker...`).
  - 상세: 이번 diff 는 plan 문서(`plan/in-progress/masked-marker-cosmetic-followups.md`)에 명시된 대로 "같은 try/catch 블록" 하나만 한국어로 통일했고, 같은 메서드의 다른 영문 주석들은 스코프 밖으로 의도적으로 남겼다. 의도된 축소 스코프이므로 이번 diff 자체의 결함은 아니지만, 결과적으로 `execute()` 메서드 하나를 봤을 때 여전히 언어가 문단마다 뒤섞여 있어 "일관성" 관점에서는 미해결로 남는다.
  - 제안: 다음에 이 메서드를 만질 기회에 나머지 영문 주석도 함께 한국어로 통일 — plan 문서가 이미 이 의도를 기록해 뒀으므로 별도 액션 불요, 참고용 기록.

- **[INFO]** 마스킹 마커 리터럴 3종이 여러 문서 위치에 verbatim 으로 중복 기술됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` (Swagger description), `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표/각주 — 둘 다 `` `***` / `[REDACTED]` / `[REDACTED_DEPTH]` `` 를 그대로 나열
  - 상세: 코드 로직은 공유 패키지(`@workflow/masked-markers`, `plan/complete/masked-marker-shared-package.md` 기준)를 SoT 로 쓰지만, 이번 diff 로 늘어난 산문 설명들은 그 SoT 를 링크 없이 문자열로 재복사한다. 마커 집합이 바뀌면 이 프로즈들도 수동으로 동기화해야 한다. (이미 이번 세션의 `/consistency-check` 가 `rationale_continuity` INFO #1 로 같은 사실을 지적하고 non-blocking 으로 defer 했으므로 새 결함이 아니라 참고용 재확인.)
  - 제안: 별도 액션 불요 — 이미 트래킹됨. 다음에 이 문서들을 만질 때 SoT 패키지 링크를 보강하는 것으로 충분.

## 요약

이번 변경은 4개 백엔드 코드 파일(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`, `re-run.dto.ts`, `workflows.controller.ts`) 전부에서 **실행 로직은 한 줄도 건드리지 않고 주석/JSDoc/Swagger description 만 확장**한 순수 문서화 PR이다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버·중복 로직 등 구조적 유지보수성 지표는 변화가 없다. 새로 추가된 설명들은 대체로 "왜"를 잘 설명하고(예: `REASON_TO_DETAIL` 4종을 사용자 행동 기준으로 구분, base 함수가 마스킹 검사를 갖지 않는 이유 + CI 가드 위치 명시) 다음 작업자의 재질문을 줄이는 방향으로 잘 작성됐다. 유일하게 실질적인 지적은 `resolve-trigger-parameters.ts` 의 `resolveTriggerParameters` JSDoc 블록이 기존 영문 설명 뒤에 신규 한국어 설명을 같은 블록에 이어붙여 한 주석 안에서 언어가 전환되는 점으로, 이 저장소의 "docblock 은 한 언어로, 인라인 설명은 별도 주석으로" 패턴과 어긋난다. 그 외에는 스코프가 명시적으로 좁혀진 부분 언어 통일(controller)과 이미 트래킹 중인 문서 중복 리스크뿐이라 전체적으로 위험도는 낮다.

## 위험도
LOW

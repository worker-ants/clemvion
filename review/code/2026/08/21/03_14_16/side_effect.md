# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 마커 재제출 서버측 거부

## 발견사항

- **[WARNING]** `POST /workflows/:id/execute` 의 거부 범위가 "재제출" 에서 "Manual 실행 전체" 로 넓어짐 — 직접 API 호출자에게 새 breaking 동작
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute` 메서드 내 `resolveTriggerParametersRejectingMasked(schema, rawValues)` 호출부(신규 import 는 46번째 줄 부근, 호출은 그 아래 try 블록)
  - 상세: 이 엔드포인트는 재제출 전용이 아니라 Manual 트리거 실행의 단일 진입점이다. 이번 변경으로 `parameterValues`/`input.parameters` 의 어느 필드든 값이 정확히 `'***'`, `'[REDACTED]'`, `'[REDACTED_DEPTH]'` 와 일치하면 이제 `400 INVALID_TRIGGER_PARAMETERS` 로 거부된다. re-run/에디터 UI 를 거치지 않고 이 엔드포인트를 직접 호출하는 제3자 통합·QA 자동화·운영 스크립트가 (의도했든 우연이든) 이 세 리터럴 문자열 중 하나를 정상 파라미터 값으로 보내고 있었다면 그 호출은 이번 배포부터 실패한다. 이는 이 PR 의 핵심 의도이자 CHANGELOG·spec 문서·테스트로 충분히 설명·검증돼 있어 "의도치 않은" 부작용은 아니지만, side-effect 관점에서 **공개 API 계약이 조용히(버전 플래그 없이) 좁아진다**는 사실은 명시적으로 남겨 둘 필요가 있다.
  - 제안: 추가 조치 불필요(이미 CHANGELOG·`spec-update-masked-reject-framing.md`·`spec-sync-external-interaction-api-gaps.md` 에 결정·근거가 기록됨). 다만 릴리스 노트에 이 엔드포인트가 breaking 표면임을 재확인하는 것을 권장.

- **[INFO]** `ExecutionsService.reRun` 의 에러 응답 키가 `errors` → `details` 로 바뀜 — 그러나 실질 영향은 없음(선존 버그 수정)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512` (`details: toTriggerParameterErrorDetails(err.errors)`, 종전 `errors: err.errors`)
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:73`, `details = resp.details ?? nested?.details;`)는 예외 응답 객체에서 `details` 필드만 읽는다. 종전 `errors: err.errors` 는 이 필터가 절대 읽지 않는 키였으므로 최종 HTTP 응답 봉투에는 애초에 실리지 않았다 — 즉 외부 소비자는 이 변경 전에도 필드별 상세를 받은 적이 없다(top-level `code`/`message` 만 봤다). 이번 변경은 인터페이스를 "축소" 하는 게 아니라 이전에 죽어 있던 데이터 경로를 살리는 것이다. `workflows.controller.ts` 는 처음부터 `details` 형태였으므로 두 자매 호출부가 이제 대칭이 된다.
  - 제안: 없음. 확인 완료.

- **[INFO]** `TriggerParameterValidationError['reason']` / `TriggerParameterErrorDetail['code']` 유니온에 새 멤버 추가(`masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`) — 기존 소비자 exhaustiveness 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:11-18`, `:26-34`
  - 상세: 이 유니온을 소비하는 곳은 `REASON_TO_DETAIL`(같은 파일의 `Record<reason, ...>`, 신규 멤버 누락 시 TS 컴파일 에러로 강제됨)뿐이다. 저장소 전체를 검색했을 때 이 두 타입에 대해 `switch`/`case` 로 분기하는 다른 소비처(백엔드·프런트 모두)가 없어, 새 열거값이 조용히 `default` 분기로 떨어지거나 미처리되는 지점이 없다.
  - 제안: 없음. 확인 완료.

- **[INFO]** `MASKED_MARKERS` 자료구조가 `ReadonlySet<string>`(모듈 비공개) → `readonly string[]`(export) 로 바뀌고 `isMaskedMarker` 가 `export` 로 승격 — 새 공개 표면이지만 소비처는 의도된 신규 호출부뿐
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150,164`
  - 상세: 같은 파일 안의 유일한 기존 소비처(`deepRedactObject` 의 292번째 줄, `isMaskedMarker(v) ? v : VALUE_MASK_MARKER`)는 `Set.has` → `Array.includes` 로 동작이 동일하게 유지된다(둘 다 O(n) 선형 탐색이지만 원소 3개뿐이라 실질 영향 없음). 저장소 전체에서 `MASKED_MARKERS`/`isMaskedMarker` 의 다른 소비처를 확인한 결과, 새 export 를 실제로 쓰는 곳은 이번 PR 이 추가한 `reject-masked-resubmission.ts` 하나뿐이다. `Object.freeze` 를 `Set` 대신 배열에 적용해 런타임 불변성이 실제로 강제되도록 고친 것도 캐너리 테스트(`sanitize-error-message.spec.ts` 신규 `describe('MASKED_MARKERS 불변성')`)로 뒷받침된다.
  - 제안: 없음. 확인 완료.

- **[INFO]** `masked-reject-callers-guard.ts` 의 파일시스템 접근은 테스트 실행 시점(`fs.readdirSync`/`readFileSync`)에만 발생하고 런타임 경로엔 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:42-57` (`listSourceFiles`), `:126-135` (`findUnexpectedCallers`)
  - 상세: 이 가드는 `src/` 하위 전체 `.ts` 파일을 재귀적으로 읽어 `resolveTriggerParameters` 직접 import 여부를 정적으로 스캔한다. 소비처는 `masked-reject-callers.spec.ts` 뿐이며 그 안에서만 호출되므로 프로덕션 런타임에는 영향이 없다(테스트/CI 시점 한정 파일 읽기). 캐너리 테스트(`masked-guard-` 접두 `os.tmpdir()` 임시 디렉터리)는 `fs.mkdtempSync`/`fs.writeFileSync`/`fs.rmSync` 로 파일을 생성·삭제하지만 시스템 임시 디렉터리 안에서 `finally` 블록으로 정리되므로 저장소나 공유 상태를 오염시키지 않는다.
  - 제안: 없음. 확인 완료.

- **[INFO]** 함수 시그니처는 완전한 drop-in 교체 — 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:56-59` (`resolveTriggerParametersRejectingMasked(schema, rawSource)`) vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:109-111` (`resolveTriggerParameters(schema, rawSource)`)
  - 상세: 두 함수의 파라미터 타입(`TriggerParameterDefinition[] | undefined | null`, `unknown`)과 반환 타입(`Record<string, unknown>`)이 동일하다. `executions.service.ts`·`workflows.controller.ts` 두 호출부 모두 import 문과 함수명만 바뀌고 인자 전달 방식은 그대로다 — 시그니처 드리프트로 인한 컴파일/런타임 불일치 없음.
  - 제안: 없음. 확인 완료.

- **[INFO]** webhook/schedule 경로는 의도적으로 변경 대상에서 제외됨(가드로 강제) — 회귀 없음 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:183`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts:78,88` — 둘 다 여전히 base `resolveTriggerParameters` 를 직접 호출
  - 상세: 저장소 전수 검색 결과 `resolveTriggerParameters` 를 여전히 직접 쓰는 프로덕션 코드는 이 두 파일뿐이며, `masked-reject-callers-guard.ts` 의 `ALLOWED_DIRECT_CALLERS` 화이트리스트가 이를 명시적으로 허용하고 있다. webhook/schedule 은 외부 시스템이 저작하는 임의 페이로드라 리터럴 `'***'` 가 정상 값일 수 있다는 근거가 코드·CHANGELOG·spec 문서 세 곳에 일관되게 남아 있어, 이 카브아웃이 실수로 빠진 것이 아니라 의도된 스코프 경계임을 확인했다.
  - 제안: 없음. 확인 완료.

- **[INFO]** `plan/`·`review/` 아래 markdown 산출물 변경은 전부 문서/추적 파일 — 코드 실행 경로에 영향 없음
  - 위치: `plan/complete/spec-update-masked-reject-framing.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신), `review/code/2026/08/21/00_03_57/**`(이전 리뷰 라운드 산출물)
  - 상세: 이 diff 에 포함된 markdown/JSON 파일은 모두 plan 라이프사이클·리뷰 산출물이며 애플리케이션 코드가 이를 읽거나 실행 경로에서 참조하지 않는다. side-effect 관점에서 특기할 사항 없음.
  - 제안: 없음.

## 요약

핵심 변경(`resolveTriggerParametersRejectingMasked` 신규 도입 + 두 Manual 실행 호출부 교체)은 순수 함수 조합이고 전역 상태·파일시스템·네트워크·환경변수를 건드리지 않는다. 함수 시그니처는 기존 `resolveTriggerParameters` 와 완전히 동일해 drop-in 교체이며, webhook/schedule 경로는 가드(`masked-reject-callers-guard.ts`)로 명시적으로 카브아웃돼 회귀가 없음을 확인했다. `errors`→`details` 응답 키 변경은 표면상 인터페이스 변경처럼 보이지만 `GlobalExceptionFilter` 가 애초에 `details` 만 읽었으므로 실질적으로는 죽어 있던 데이터 경로를 살리는 수정이지 축소가 아니다. 유일하게 실질적인 부작용은 **의도된 것**이다 — `POST /workflows/:id/execute` 가 이제 재제출뿐 아니라 Manual 실행 전체에서 마스킹 마커 리터럴 값을 거부하므로, re-run/에디터 UI 를 우회해 이 엔드포인트를 직접 호출하며 우연히 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 를 정상 값으로 쓰던 외부 클라이언트가 있다면 이번 배포로 깨진다. 이는 CHANGELOG·spec 정정 문서·테스트에 충분히 기록돼 있어 "의도치 않은" 부작용은 아니지만, 공개 API 계약이 버전 플래그 없이 좁아진다는 점은 릴리스 커뮤니케이션 관점에서 유의할 가치가 있다.

## 위험도

LOW

STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로 전체, 재검토 01_15_47)

## 검토 범위

실질 코드 변경은 `git diff --stat` 기준 8개 파일(+681/-10)이다.

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(CHANGELOG, `plan/in-progress/*.md`, `review/code/2026/08/21/00_03_57/**`·`review/code/2026/08/21/00_39_27/**`·`review/consistency/2026/08/20/**` 산출물)는 문서/리뷰 아티팩트로 실행 경로가 없어 부작용 관점 대상에서 제외했다(내용은 대조만 함 — 이하 참고사항 절 참조).

이전 두 라운드(`00_03_57`, `00_39_27`)의 side_effect 리뷰가 이미 이 diff 계열을 검토했다. 그 발견사항(모두 INFO)이 이번 재검토에서도 여전히 유효한지 소스를 직접 열어 재확인했고, 아래는 그 재확인 결과 + 독립적으로 추가 점검한 항목이다.

## 발견사항

- **[INFO]** `MASKED_MARKERS` 가 `export const` 로 승격됐지만 런타임에서 `freeze` 되지 않은 일반 `Set` 이다 (기승격 이슈, 재확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`export const MASKED_MARKERS: ReadonlySet<string> = new Set([`)
  - 상세: `ReadonlySet<string>` 은 컴파일 타임 제약일 뿐이라 `(MASKED_MARKERS as Set<string>).add(...)` 로 타입을 우회하면 런타임에 변형 가능하다. 이 싱글턴은 이제 egress 마스킹 판정(`isMaskedMarker`)과 신규 재제출 거부 판정(`findMaskedResubmissions` → `hasMaskedLeaf`, `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:129`) 양쪽이 공유한다 — 설계 의도가 "같은 프로세스 안이라 공유" 이므로 원치 않는 변형의 파급 범위가 두 판정기 전체로 넓다. 실제로 코드베이스 전체에서 `MASKED_MARKERS` 를 직접 import 하는 소비처를 찾아봤으나(`grep -rn "MASKED_MARKERS" codebase/backend/src`) `sanitize-error-message.ts` 자체와 `reject-masked-resubmission.spec.ts`(read-only 비교용)뿐이라, 현재 diff 안에 즉시 악용 경로는 없다.
  - 제안: 필수는 아님. `Object.freeze(new Set([...]))` 로 감싸면 컴파일 타임뿐 아니라 런타임에서도 이 공유 SoT 를 보호할 수 있다.

## 확인했으나 문제 없음 (side-effect 관점 재검증)

- **시그니처/인터페이스 변경 영향**: `resolveTriggerParametersRejectingMasked(schema, rawSource)` 는 `resolveTriggerParameters` 와 동일한 인자·반환 타입(`Record<string, unknown>`)의 drop-in 대체다. 두 호출부(`executions.service.ts:499`, `workflows.controller.ts:317`)에서 옛 import(`resolveTriggerParameters`, `TriggerParameterValidationException` 단독 import)가 완전히 제거되고 다른 잔존 참조가 없음을 `grep` 으로 확인했다 — 죽은 import 나 컴파일 실패 소지 없음.
- **범위 격리**: webhook(`hooks.service.ts:183`)·schedule(`schedule-runner.service.ts:78,88`)은 여전히 원본 `resolveTriggerParameters` 를 직접 호출한다(`grep -rn "resolveTriggerParameters\b"` 로 전수 확인) — 신규 거부 로직이 의도한 두 Manual 경로 밖으로 새어 나가지 않는다.
- **에러 봉투 키 변경(`errors` → `details`)**: `codebase/backend/src/common/filters/http-exception.filter.ts:73` (`details = resp.details ?? nested?.details;`) 를 직접 열어 확인 — 필터는 애초에 `resp.errors` 를 읽지 않으므로, 종전 `errors: err.errors` 는 응답 봉투에서 조용히 버려지고 있었다. 이번 교정은 기존에 값을 읽던 소비자를 깨뜨리는 게 아니라 비어 있던 필드를 처음 채우는 것이라 기존 클라이언트에 대한 회귀가 아니다.
- **입력 불변성**: `reject-masked-resubmission.ts` 의 `findMaskedResubmissions`/`hasMaskedLeaf`/`throwIfAny` 모두 순수 함수 — `rawSource`/`values`/`schema` 어느 것도 변형(mutate)하지 않고 읽기만 한다. `to-record.ts` 의 `isRecord`(신규 import, 로컬 `isPlainRecord` 재구현 제거됨 — 전전 라운드 WARNING 해소 확인)도 동일하게 순수 타입가드다.
- **파일시스템/네트워크/환경변수**: 8개 프로덕션 코드 파일 전부 동기 CPU 연산 + 기존 예외 클래스 재사용뿐이며, 새 파일 I/O·HTTP 호출·`process.env` 읽기/쓰기가 없다.
- **전역 상태**: 신규 모듈 스코프 변수 없음. `MASKED_MARKERS`/`MAX_REDACT_DEPTH`/마커 상수 3개는 기존 값 재사용(export 가시성만 확대)이며 값 자체는 변경되지 않았다.
- **이벤트/콜백**: 이번 diff 는 이벤트 발행·구독·콜백 등록을 추가/제거하지 않는다. `throw`/`catch` 흐름만 재구성됐다.

## 참고사항 (부작용 아님, 정보 등재만)

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`·`spec-update-masked-reject-framing.md`·CHANGELOG 갱신은 트래커/spec 정정 문서로 런타임 부작용과 무관하다. 다만 `plan/in-progress/spec-update-masked-reject-framing.md` 자체가 기록하듯, 선행 커밋(`50f799efd`)에서 `developer` 턴이 `spec/5-system/14-external-interaction-api.md` 표 행을 직접 수정한 절차 위반이 있었다(CLAUDE.md 의 `spec/` read-only 규칙 위반) — 이는 side-effect 관점의 코드 결함이 아니라 **워크플로 절차** 이슈이고, 이번 diff 는 그 위반을 planner 턴 문서로 사후 정규화하는 내용이라 재발 방지 조치는 이미 diff 안에 포함돼 있다.

## 요약

핵심 변경은 두 Manual 실행 진입점(`re-run`/`execute`)에서 기존 `resolveTriggerParameters` 호출을 시그니처 동일한 래퍼 `resolveTriggerParametersRejectingMasked` 로 치환한 drop-in 교체이며, 신설 헬퍼는 입력을 변형하지 않는 순수 함수다. webhook/schedule 경로는 원본 함수를 그대로 쓰도록 격리돼 있음을 직접 grep 으로 재확인했고, 옛 import 잔존 참조도 없다. `errors`→`details` 에러 봉투 키 교정은 `GlobalExceptionFilter` 실코드 대조 결과 기존 소비자를 깨뜨리지 않는 순수 버그 수정이다. 유일하게 남는 항목은 두 판정기(egress 마스킹/재제출 거부)가 공유하는 `MASKED_MARKERS` 싱글턴이 `ReadonlySet` 타입으로만 보호되고 런타임 freeze 가 없다는 INFO 수준 지적으로, 현재 diff 안에 실제 위반 소비처는 없어 즉시 조치 불요다. 새 전역 변수·파일시스템/네트워크/환경변수 부작용·의도치 않은 이벤트 변경은 발견되지 않았다.

## 위험도

LOW

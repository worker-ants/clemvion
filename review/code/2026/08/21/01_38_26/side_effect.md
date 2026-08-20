# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (4라운드 누적 diff)

## 검토 범위

실질 애플리케이션 코드 변경은 8개 파일(`git diff origin/main...HEAD --stat -- codebase/` 로 실측,
+700/-14):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(CHANGELOG, `plan/**`, `review/**`)는 이전 세 라운드(`00_03_57`/`00_39_27`/`01_15_47`)의
산출물·spec 정정 기록이며 실행 경로 코드가 아니다. 이번 라운드는 그 세 라운드가 이미 심층
검증(CRITICAL 1건 fix → WARNING 다수 fix → INFO 3건 fix, 최종 수렴: Critical 0 / Warning 0)한
것과 **동일한 최종 코드 상태**를 대상으로 한다는 것을 `Read`로 실물 대조해 확인했다. 아래는
side-effect 관점 독립 재검증이다.

## 발견사항

- **[INFO]** 두 기존 공개 엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)의 요청 유효값 집합이 좁아지는 인터페이스 변경
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 함수 `resolveTriggerParametersRejectingMasked` (56~75행) — 호출부는 `codebase/backend/src/modules/executions/executions.service.ts:499`, `codebase/backend/src/modules/workflows/workflows.controller.ts:317`
  - 상세: 이전에는 Manual 트리거 파라미터 값이 마스킹 마커(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 정확히 일치해도 정상 입력으로 수락됐다. 이 변경 이후 동일 값은 400(`MASKED_VALUE_RESUBMITTED`)으로 거부되며, 재제출 값뿐 아니라 사용자가 방금 타이핑한 fresh 입력도 대상이다. 이 breaking 성격은 `plan/complete/spec-update-masked-reject-framing.md` · `spec/5-system/14-external-interaction-api.md`(§R17) 등 spec 3+1곳에 명문화됐고, 저장소 밖 소비자 존재 여부는 저장소 소유자 확인으로 "없음"이 기록돼 있다(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`). 코드 결함이 아니라 의도된 계약 축소이며 문서·영향 확인이 완료된 상태.
  - 제안: 조치 불요. 참고 등재만.

- **[INFO]** `webhook`/`schedule` 두 형제 어댑터는 여전히 구 `resolveTriggerParameters` 를 직접 호출 — 신규 거부 래퍼로 옮겨지지 않았음을 grep 으로 실측 확인
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.ts:78,88`, `codebase/backend/src/modules/hooks/hooks.service.ts:183` (모두 미변경 — 이번 diff 밖)
  - 상세: `reject-masked-resubmission.ts` 의 최상단 docstring 이 이 배제를 의도로 명시한다 — webhook/schedule body 는 외부 시스템이 저작하는 임의 페이로드라 리터럴 `'***'` 가 정상 값일 수 있어, 공유 `resolveTriggerParameters` 안에 판정을 넣으면 무관한 경로가 오염된다는 근거다. 두 파일 다 이번 diff 에서 손대지 않았음을 직접 확인해, "누락"이 아니라 "의도적 배제"임을 코드 레벨로 재확인했다.
  - 제안: 조치 불요. 의도된 스코프 경계.

- **[INFO]** `MASKED_MARKERS` 는 `Object.freeze` 로 감싸져 export 됐고(변경 후 코드로 확인), 유일한 신규 소비처(`findMaskedResubmissions`)는 `isMaskedMarker()` 함수 경유로만 읽는다 — Set 인스턴스 자체를 직접 import 하는 신규 소비처는 없다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150-163`, `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:1-4`
  - 상세: 이전 라운드(`01_15_47`)가 "타입만 `ReadonlySet`이고 런타임 freeze 가 없다"는 INFO 를 냈고, 이번 최종 코드에서 `Object.freeze(new Set([...]))` 로 반영되어 있음을 실물로 확인했다. egress 마스킹(`isMaskedMarker`)과 재제출 거부(`findMaskedResubmissions`)가 같은 싱글턴을 공유하는 설계이므로, freeze 는 "한쪽이 실수로 변형하면 둘 다 오염"되는 부작용 경로를 런타임에서도 막는다.
  - 제안: 조치 불요.

- **[INFO]** `resolveTriggerParametersRejectingMasked` 는 raw 검사 통과 시에만 내부적으로 `resolveTriggerParameters` 를 1회 추가 호출 — 이중 실행이 새 부작용을 만드는지 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:62-72`
  - 상세: `resolveTriggerParameters` 는 순수 함수(DB/IO 없음, 스키마 기반 타입 강제·기본값 채움만 수행)이고 입력 객체(`rawSource`/`schema`)를 변형하지 않는다. raw 검사가 먼저 막으면 resolve 자체가 아예 호출되지 않으므로(early return via `throwIfAny`), 거부되는 요청에 대해 resolve 부작용(있었다면)이 추가로 실행되는 일도 없다. 통과하는 요청은 종전과 동일하게 resolve 1회만 실행된다 — 순서 변경일 뿐 호출 횟수 증가는 없다.
  - 제안: 조치 불요.

- **[INFO]** `errors` → `details` 키 교정은 `GlobalExceptionFilter` 실코드로 breaking 아님을 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`(`details: toTriggerParameterErrorDetails(err.errors)`) — 필터 근거: `codebase/backend/src/common/filters/http-exception.filter.ts:73`(`details = resp.details ?? nested?.details;`, `errors` 키는 어디에서도 읽지 않음, grep 으로 재확인)
  - 상세: 변경 전 `throw new BadRequestException({ code, message, errors: err.errors })` 였으나 필터가 `resp.errors` 를 읽는 코드 경로가 존재하지 않아, 종전에도 이 엔드포인트의 400 바디에는 필드별 내역이 실리지 않았다. 이번 변경은 키 이름을 바꾼 게 아니라 **누락돼 있던 필드를 채운 것**이라, `body.errors` 를 읽던 기존 클라이언트가 있었다면 애초에 항상 `undefined` 를 읽고 있었으므로 이번 변경으로 새로 깨지는 소비자는 없다.
  - 제안: 조치 불요. 확인 완료.

- **[INFO]** 신규 union 값(`masked_value_resubmitted` / `MASKED_VALUE_RESUBMITTED`) 추가가 기존 소비자의 exhaustive switch 를 깨지 않는지 확인
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:11-34` (interface 정의), `REASON_TO_DETAIL` 매핑
  - 상세: `grep -rn "TriggerParameterValidationError|TriggerParameterErrorDetail"` 로 전수 확인한 결과 소비처는 `execution-engine` 모듈 내부(`resolve-trigger-parameters.ts`, `reject-masked-resubmission.ts`, 자기 자신)뿐이고, 이 값을 exhaustive 하게 switch 하는 프런트/외부 코드는 없다(프런트는 `details[]` 를 배열로만 순회해 표시). `REASON_TO_DETAIL` 은 `Record<reason, {...}>` 형태라 신규 값 추가 시 TS 컴파일러가 누락을 강제로 잡아준다 — 실제로 매핑이 4항목 전부 채워져 있음을 파일에서 확인.
  - 제안: 조치 불요.

## 요약

핵심 변경은 두 Manual 실행 진입점(`executions.service.ts` `reRun`, `workflows.controller.ts`
`execute`)에서 기존 `resolveTriggerParameters` 호출을 시그니처 호환 래퍼
`resolveTriggerParametersRejectingMasked` 로 drop-in 치환한 것이고, 신설 헬퍼는 입력을 변형하지
않는 순수 함수이며 전역 상태·파일시스템·네트워크·환경변수 접근이 없다. webhook/schedule
어댑터는 grep 으로 확인한 결과 이번 변경 대상 밖으로 그대로 남아 있어 의도된 스코프 경계가
코드 레벨에서도 지켜진다. `MASKED_MARKERS` 는 `Object.freeze` 로 런타임 불변성까지 확보된 채
export 됐고 신규 소비처는 함수 경유로만 접근한다. 두 엔드포인트의 요청 유효값 집합이 좁아지는
것과 re-run 응답 봉투의 `errors`→`details` 교정은 모두 실제 필터 코드·spec 문서·저장소 소유자
확인을 근거로 breaking 이 아님이 검증돼 있다. 이 diff는 이미 3라운드(9개 reviewer)에 걸쳐
CRITICAL 1건과 WARNING 다수가 fix된 뒤 수렴한 최종 상태이며, 이번 side-effect 관점 독립
재검증에서도 새로운 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW

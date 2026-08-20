STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로)

## 검토 방법

이 세션은 이미 9라운드(`00_03_57` ~ `04_20_10`)의 코드 리뷰를 거쳐 CRITICAL 0 / WARNING 0 으로
수렴한 상태에서 재소집됐다. 프롬프트에 포함된 79개 변경 파일 중 실질 애플리케이션 코드는
8개(`CHANGELOG.md` 제외)이고 나머지는 과거 라운드 산출물(`review/**`)·spec·plan 문서다. 실코드
파일은 `Read`로 현재 저장소 상태를 직접 열어(diff 가 잘린 `reject-masked-resubmission.ts`,
repo-guard 신규 파일 포함) 부작용 관점으로 재확인했고, `executions.service.ts`/
`workflows.controller.ts` 는 호출 순서(부수효과 발생 지점 대비 신규 검사 위치)까지 전체
컨텍스트로 대조했다.

## 발견사항

- **[INFO]** `MASKED_MARKERS` 가 module-private → `export const` 로 승격되며 egress 마스킹
  판정(`isMaskedMarker`)과 재제출 거부 판정(`findMaskedResubmissions`)이 같은 배열 인스턴스를
  공유하는 설계로 굳어졌다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`export const
    MASKED_MARKERS: readonly string[] = Object.freeze([...])`), 소비처
    `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:3-4`(`isMaskedMarker` import)
  - 상세: 직전 라운드(`02_04_38`)에서 `Object.freeze(new Set(...))` 가 런타임 불변성을 전혀
    보장하지 못한다는 사실(Set 데이터는 내부 슬롯이라 freeze 가 `.add()` 를 막지 못함)이
    반증되어 `readonly string[]` + `Object.freeze` 로 교체됐고, 이번 세션에서 직접 확인한 결과
    현재 저장소에는 그 교체가 반영돼 있다(`sanitize-error-message.ts:150,164-165`). 이 배열
    자체를 직접 import 하는 신규 소비처는 `isMaskedMarker` 함수 호출뿐(`grep` 으로 확인, 배열
    직접 참조 없음)이라 공유 싱글턴이 실수로 변형될 새 표면은 없다. 캐너리
    (`sanitize-error-message.spec.ts` "MASKED_MARKERS 불변성")가 `Object.isFrozen`·`push` 시
    `TypeError`·주입값이 마커로 미판정됨을 기계적으로 고정한다.
  - 제안: 조치 불요 — 이미 라운드 내에서 발견·수정·회귀 캐너리로 닫힌 항목. 참고 등재만.

- **[INFO]** `POST /executions/:id/re-run` 400 응답 봉투의 필드가 `errors` → `details` 로
  바뀜(인터페이스 관점) — 실질 회귀 여부를 직접 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`(`details:
    toTriggerParameterErrorDetails(err.errors)`) / 대조 대상
    `codebase/backend/src/common/filters/http-exception.filter.ts`(`resp.details`/`nested?.details`
    만 조회, `resp.errors` 는 어디에서도 읽지 않음 — grep 으로 재확인)
  - 상세: 변경 전 `throw new BadRequestException({ code, message, errors: err.errors })` 는
    `GlobalExceptionFilter` 가 `errors` 키를 애초에 읽지 않아 필드별 내역이 조용히 버려지던
    선존 결함이었다. 이번 변경은 키 이름을 "바꾼" 것이 아니라 **비어 있던 필드를 채운** 것이라
    기존에 `body.errors` 를 읽던 외부 클라이언트가 있었어도 그 값은 애초에 무의미했다 — 새로
    깨지는 소비자는 없다. 회귀 캐너리(`executions-rerun.service.spec.ts` "[회귀] 거부 응답이
    details[] 로...")가 `body.errors` 가 `undefined` 이고 `body.details` 가 채워짐을 함께 고정한다.
  - 제안: 조치 불요. 확인 완료로 기록.

- **[INFO]** 두 Manual 실행 진입점(`executions.service.ts:499`, `workflows.controller.ts:317`)
  모두 신규 검사(`resolveTriggerParametersRejectingMasked`)가 실행 엔진 호출·감사 로그
  기록보다 **먼저** 배치되어 있음을 직접 확인 — 부수효과 순서 이상 없음
  - 위치: `executions.service.ts` `reRun` — 마스킹 검사(§499) → `executionEngineService.execute`(§523)
    → `auditLogsService.record`(§540) 순. `workflows.controller.ts` `execute` — 마스킹 검사(§317)
    → 이후 실행 트리거.
  - 상세: 거부 시 `BadRequestException` 을 던지고 함수가 즉시 종료되므로, 마스킹된 값으로는
    실행 엔진 큐잉·감사 로그 기록 등 어떤 부수효과도 발생하지 않는다. 기존 chain-depth
    체크·dry-run pre-flight 와 같은 자리(입력 해석 단계)에 놓여 이 서비스의 기존 "먼저 검증,
    나중에 부수효과" 순서 관례를 그대로 따른다.
  - 제안: 조치 불요.

- **[INFO]** `POST /workflows/:id/nodes/:nodeId/execute`(`executeNode`)는 이번 거부 검사를
  거치지 않음 — 신규 결함 아님, 기존 라운드에서 스코프 밖으로 확정된 항목
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` `executeNode`
    (§380 시작) — `resolveTriggerParameters`/`resolveTriggerParametersRejectingMasked` 어느
    쪽도 import·호출하지 않고 `body.input` 을 스키마 검증 없이 그대로 실행 엔진에 전달
  - 상세: 이 엔드포인트는 Manual 트리거 스키마 기반 파라미터 해석 자체를 하지 않는(단일 노드
    seed 실행) 별개 메커니즘이라, 이번 마스킹 재제출 거부의 대상 범위(트리거 파라미터 resolve
    경로) 밖이다. `02_04_38` RESOLUTION 미조치 INFO 목록에 "executeNode 스코프 밖"으로 이미
    명시적으로 처분돼 있다 — 재지적이 아니라 확인 결과로 기록.
  - 제안: 조치 불요. 향후 이 엔드포인트가 스키마 기반 파라미터 해석을 갖게 되면 그때 재검토.

## 요약

이번 diff 의 실질 부작용 표면은 8개 코드 파일에 한정되며, 전역 상태 변경·의도치 않은
파일시스템 부작용·환경 변수 접근·외부 네트워크 호출·이벤트/콜백 변경은 발견되지 않았다.
`MASKED_MARKERS` 의 `export` 승격은 공유 싱글턴 표면을 넓혔지만 직접 소비처가 없고 런타임
불변성이 (`readonly string[]` + `Object.freeze` + 캐너리로) 실제로 보장된다. 신규
`resolveTriggerParametersRejectingMasked` 는 기존 `resolveTriggerParameters` 시그니처를
바꾸지 않고 별도 함수로 추가됐으며, 두 Manual 진입점의 호출 교체는 실행 엔진 호출·감사 로그
같은 부수효과보다 앞선 자리에 위치해 거부 시 부수효과가 전혀 발생하지 않음을 직접 확인했다.
`errors`→`details` 봉투 변경은 인터페이스 형태 변화이나 필터가 애초에 `errors` 를 읽지 않았던
선존 결함의 교정이라 기존 클라이언트에 대한 실질 회귀가 아니다. 신규 repo-guard 두 쌍
(`masked-reject-callers-guard`/`production-build-devdep-guard`)은 소스 트리를 읽기 전용으로
스캔하며, 캐너리 테스트가 만드는 임시 디렉터리는 `try/finally` 로 확실히 정리된다. 이 항목들은
전부 앞선 9라운드 중 어느 한 라운드에서 이미 발견·수정·회귀 고정이 끝난 것들로, 이번 재검토가
새로 찾아낸 부작용은 없다.

## 위험도

NONE

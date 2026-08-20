STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — 마스킹 값 재제출 서버측 거부 (EIA §R17, 4라운드 후 최종 확인)

## 검토 방법

이 세션은 이미 4라운드(`00_03_57` CRITICAL 1 fix, `00_39_27` 절차/spec drift 정정, `01_15_47`
리팩터 검증, `01_38_26` 불변식 가드 추가)를 거쳐 Critical 0 · Warning 0 으로 수렴한 상태다.
프롬프트가 생략한 실제 소스(`reject-masked-resubmission.ts`/`.spec.ts`,
`masked-reject-callers-guard.ts`)를 `Read` 로 직접 열어 재검증했고, 호출부(`executions.service.ts`,
`workflows.controller.ts`)·타입 매핑(`trigger-parameter.types.ts`)·spec 5개 문서
(`1-manual-trigger.md` §6, `3-error-handling.md` §1.7, `12-webhook.md`, `1-data-model.md`,
`14-external-interaction-api.md` §R17)를 line-level 로 대조했다. `resolveTriggerParameters`
직접 호출부를 저장소 전수 grep 으로 재현해 `ALLOWED_DIRECT_CALLERS` 목록과 정확히 일치함을
확인했고, 관련 jest 스위트 4개(`reject-masked-resubmission`·`masked-reject-callers`·
`executions-rerun.service`·`workflows.controller.spec`) 71개를 직접 재실행해 전부 통과함을
확인했다.

## 발견사항

기존 4라운드가 잡았던 CRITICAL(`boolean` 파라미터 완전 우회 — resolve 결과만 검사)과 WARNING
전량(호출부 판정 중복 → `resolveTriggerParametersRejectingMasked` 캡슐화, `errors`→`details`
봉투 유실, §6 검사 시점 "직후"→"전후" stale 서술, 범위 서술 3곳 "재제출 한정"→"Manual 실행
경로 한정" stale 서술, `isPlainRecord` 재구현→`isRecord` 공유 유틸 교체, base 함수 직접
호출 방지 repo-guard)이 실코드·실spec 로 재확인한 결과 전부 해소되어 있다. 신규 CRITICAL/WARNING
은 발견되지 않았다.

- **[INFO]** `POST /:id/nodes/:nodeId/execute`(단일 노드 실행)는 `resolveTriggerParameters` 계열을
  전혀 호출하지 않아 이번 거부 가드의 적용 대상 밖이다 — 의도된 설계임을 spec 으로 확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` 함수 `executeNode`
    (`@Post(':id/nodes/:nodeId/execute')`, 게이트 349행 부근) — `body?.input` 을 스키마 검증 없이
    그대로 `executionInput` 에 병합한다
  - 상세: 이전 라운드(`00_03_57` maintainability)가 "향후 세 번째 호출부가 될 수 있다"고 INFO 로
    남긴 자리인데, 실측하면 이 엔드포인트는 트리거 파라미터 스키마를 resolve 하지 않는 별개
    경로(노드 단위 부분 실행)라 애초에 이 가드의 적용 대상이 아니다. `spec/5-system/14-external-interaction-api.md:1546` 이 *"노드 레벨엔 재제출 소비처가 없기 때문"* 이라고 명시적으로
    근거를 남겨 뒀고, `masked-reject-callers-guard.ts` 의 허용목록도 이 파일을 포함하지 않는데
    실제로 `resolveTriggerParameters` 를 import 하지 않으므로 가드가 정확하다. 코드 결함이
    아니라 확인 결과를 기록한다.
  - 제안: 조치 불요. `NodeExecution.inputData` 가 향후 재제출 소비처를 얻게 되면(현재는 표시
    전용) 그때 이 엔드포인트도 스코프에 재평가 대상으로 삼을 것.

- **[INFO]** `findMaskedResubmissions` 는 `rawSource`/`values` 가 `Record` 가 아니면(예: 배열,
  스칼라) 조용히 빈 배열을 반환해 검사를 건너뛴다 — 기존 `resolveTriggerParameters` 의
  비-record 입력 처리와 동일한 fail-open 이라 이번 diff 의 이탈은 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `findMaskedResubmissions` (게이트 121행, `if (!isRecord(rawSource) || !isRecord(values)) return [];`)
  - 상세: `ReRunRequestDto.inputOverride`(`@IsObject()`)와 execute 엔드포인트의 인라인 타입
    (`Record<string, unknown>` 기대, 런타임 강제 없음) 둘 다 상위에서 object 형태를 전제하지만
    class-validator/타입 시그니처를 우회한 배열·스칼라가 도달하면 마커 검사 자체가 스킵된다.
    다만 이 경우 하류의 `resolveTriggerParameters(schema, rawSource)` 도 동일하게 record 가
    아닌 입력을 사실상 무시하거나 실패 처리하도록 기존에 설계돼 있어(이번 diff 가 건드리지
    않은 기존 계약), 이 gap 은 이번 PR 이 새로 연 표면이 아니라 기존 입력 유효성 경계를
    그대로 상속한 것이다.
  - 제안: 조치 불요 — 새로 만든 표면이 아니며 DTO 단의 `@IsObject()`/컨트롤러 타입 계약이
    1차 방어선이다. 향후 두 진입점에 엄격한 body 스키마 검증(class-validator whitelist 등)이
    들어갈 때 자연히 함께 좁혀질 사안.

## 요약

핵심 구현(`resolveTriggerParametersRejectingMasked`)은 raw 우선 검사 → resolve → resolve 후
재검사의 2단계 순서를 함수 자신이 소유하도록 캡슐화해, 이전 CRITICAL(boolean 완전 우회)·
WARNING(number 안내 오분류·defaultValue 과잉 차단·호출부 판정 중복)의 근본 원인을 구조적으로
제거했다. 대상 키를 항상 raw 기준으로 제한해 사용자가 손대지 않은 `defaultValue` 필드를
과잉 차단하지 않고, 정확 일치(부분 포함 `a***b` 통과)·깊이 상한(`MAX_REDACT_DEPTH`, 값 검사가
깊이 검사보다 우선이라 off-by-one 없음)·스택 안전성(depth 5000)까지 캐너리/경계 테스트로
고정돼 있으며, 마스커(`deepRedactSecrets`) 실산출물을 그대로 먹이는 왕복 통합 테스트로 마스커–
판정기 미러 발산도 막았다. re-run 경로의 선존 버그(`errors` 키로 던져 `GlobalExceptionFilter` 가
`details` 만 읽어 필드별 내역이 버려지던 문제)도 `details: toTriggerParameterErrorDetails(...)`
로 함께 교정되고 회귀 테스트("[회귀] 거부 응답이 details[] 로...")로 고정됐다. `resolveTriggerParameters`
직접 호출부를 전수 grep 한 결과 `masked-reject-callers-guard.ts` 의 `ALLOWED_DIRECT_CALLERS`
(wrapper 자신·두 base 테스트·webhook·schedule·가드 자기 자신)와 정확히 일치해, Manual 실행
경로가 base 함수를 우회해 가드를 건너뛸 표면이 현재 없다. spec 5개 문서(`1-manual-trigger.md`
§6 검사 시점 "전후 2단계", `3-error-handling.md`/`12-webhook.md`/`1-data-model.md`/
`14-external-interaction-api.md` §R17 의 "Manual 실행 경로 전체, 저작 주체 기준" 범위 서술,
에러 코드·응답 봉투 필드명)은 코드와 line-level 로 일치한다. TODO/FIXME/HACK/XXX 주석은
관련 8개 프로덕션 파일 어디에도 없다. 관련 jest 스위트 71개를 직접 재실행해 전부 통과를
확인했다. 신규 CRITICAL/WARNING 없음 — 남은 INFO 2건은 이번 diff 의 이탈이 아니라 기존 설계
경계를 확인한 기록이다.

## 위험도

NONE

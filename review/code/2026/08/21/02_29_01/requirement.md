# 요구사항(Requirement) 리뷰 — 마스킹 값 재제출 서버측 거부 (EIA §R17, 5라운드 후 재확인)

## 검토 방법

이 세션은 이미 5라운드(`00_03_57` CRITICAL 1건 fix, `00_39_27` 절차/spec-drift 정정, `01_15_47`
리팩터 검증, `01_38_26` 불변식 가드 추가, `02_04_38` 가드 품질 WARNING 3건 등재 → `02_29_01`
직전 커밋 `29ce00bdc` 로 그 3건 fix)를 거쳐 CRITICAL 0 · WARNING 0 으로 수렴한 상태다. 이번
라운드는 **`02_04_38` 이후 새로 반영된 round5 diff**(`Object.freeze(Set)` 플라시보 교정,
`importsBaseFn` 주석/문자열 스트리핑, positive-detection 캐너리 3건 추가)를 중심으로 실코드를
직접 열어 재검증했다.

확인한 것:
- `reject-masked-resubmission.ts`/`.spec.ts`, `trigger-parameter.types.ts`,
  `executions.service.ts`, `workflows.controller.ts`, `masked-reject-callers-guard.ts`/
  `.spec.ts`, `sanitize-error-message.ts`/`.spec.ts` 전문을 `Read` 로 직접 열어 line-level 확인.
- `resolveTriggerParameters` 직접 호출부를 저장소 전수 grep(`grep -rln`)으로 재현해
  `ALLOWED_DIRECT_CALLERS` 목록과 정확히 일치함을 재확인(`manual-trigger.handler.ts`·
  `re-run.dto.ts` 의 2건은 주석/문자열 언급일 뿐 실제 import 가 아님을 직접 확인).
- 관련 jest 스위트 7개(`reject-masked-resubmission`·`masked-reject-callers`·
  `sanitize-error-message`·`workflows.controller.spec`·`executions.service.spec`·
  `executions-rerun`) 201개 테스트를 직접 재실행해 전부 통과 확인.
- `tsc --noEmit` 전체 실행 — 이 PR 이 건드린 6개 파일 중 어디에도 타입 에러 없음(잔존 에러는
  전부 `nodes/presentation/{carousel,chart,table}` 등 무관 파일의 기존 baseline).
- spec 5개 문서(`1-manual-trigger.md` §6, `3-error-handling.md` §1.7 인근, `12-webhook.md`,
  `1-data-model.md:471`, `14-external-interaction-api.md` §R17)를 코드와 대조.

## 발견사항

기존 라운드가 잡았던 CRITICAL(`boolean` 파라미터 완전 우회)과 WARNING 전량(호출부 판정 중복,
`errors`→`details` 봉투 유실, §6 검사 시점 stale 서술, 범위 서술 3곳 stale 서술, `isPlainRecord`
재구현, base 함수 직접 호출 방지 가드 부재, 그리고 `02_04_38` 이 지목한 가드 자체의 결함 3건
— 정규식 주석/문자열 오판·탐지력 무보증·`Object.freeze(Set)` 플라시보)이 실코드로 재확인한
결과 전부 해소되어 있다. 신규 CRITICAL/WARNING 은 발견되지 않았다.

- **[INFO]** round5 가 고친 `Object.freeze(Set)` 플라시보 — 교정 자체는 정확하고, 실측으로도
  확인됨
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`
    (`export const MASKED_MARKERS: readonly string[] = Object.freeze([...])`),
    `:164-166`(`isMaskedMarker` 가 `MASKED_MARKERS.includes(v)` 로 배열 API 사용)
  - 상세: `Set` 인스턴스는 `Object.freeze` 로 `.add()`/`.delete()` 를 막지 못한다(내부 슬롯이라
    freeze 가 안 닿음) — 직전 라운드가 "런타임에서도 막았다"고 서술한 보장이 실제로는
    존재하지 않았다는 지적이 정확했고, `readonly string[]` + `Object.freeze` 로 교체해 실제
    불변성을 확보했다. `sanitize-error-message.spec.ts` 의 신규 캐너리(`Object.isFrozen` 참·
    `push` 가 `TypeError`·주입값이 `isMaskedMarker(false)`)로 이 보장을 기계에 위임했음을
    직접 실행해 확인(GREEN). 소비처(`reject-masked-resubmission.ts`, frontend 미러 아님)를
    grep 으로 재확인했고 `.has()` 잔존 호출이 없어 API 전환 누락도 없다.
  - 제안: 조치 불요. 이미 반영·검증됨. (참고: frontend `masked-markers.ts` 는 이 diff 범위
    밖의 별개 파일로 여전히 `new Set()`(freeze 없음)을 쓰지만, 그쪽은 브라우저 단일 세션
    프로세스라 backend 처럼 "여러 판정기가 같은 프로세스 싱글턴을 공유"하는 위험 프로파일이
    아니고 이번 diff 가 건드리지 않았다 — 별도 이슈로 남겨도 무방.)

- **[INFO]** `POST /:id/nodes/:nodeId/execute`(단일 노드 실행)는 이번 거부 가드의 적용 대상
  밖이며, 의도된 설계임을 spec 으로 재확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` 함수 `executeNode`
  - 상세: 이 경로는 `resolveTriggerParameters` 계열을 아예 호출하지 않는 별개(노드 단위 부분
    실행) 경로다. `spec/5-system/14-external-interaction-api.md:1546` 이 근거를 명시하고,
    `masked-reject-callers-guard.ts` 의 허용목록에도 없는데 실제로 import 하지 않으므로 가드가
    정확하다.
  - 제안: 조치 불요. `NodeExecution.inputData` 가 향후 재제출 소비처를 얻으면 재평가 대상.

- **[INFO]** `findMaskedResubmissions` 는 `rawSource`/`values` 가 non-record(배열·스칼라)면
  조용히 빈 배열을 반환해 검사를 건너뛴다 — 기존 `resolveTriggerParameters` 의 동일 계약을
  상속한 것이라 이번 diff 의 이탈은 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `findMaskedResubmissions`(`if (!isRecord(rawSource) || !isRecord(values)) return [];`)
  - 상세: `ReRunRequestDto.inputOverride`(`@IsObject()`)와 execute 엔드포인트의 타입 시그니처
    (런타임 강제 없음)가 상위에서 object 형태를 전제하나, 이를 우회한 배열/스칼라가 도달하면
    마커 검사가 스킵된다. 다만 하류 `resolveTriggerParameters` 도 동일한 non-record 입력을
    사실상 무시/실패 처리하도록 기존에 설계돼 있어 새로 연 표면이 아니다.
  - 제안: 조치 불요 — DTO 단 `@IsObject()` 가 1차 방어선. 향후 body 스키마 강화 시 자연 해소.

## 요약

핵심 구현(`resolveTriggerParametersRejectingMasked`)은 raw 우선 검사 → resolve → resolve 후
재검사의 2단계 순서를 함수 자신이 소유하도록 캡슐화해, 4라운드 전 CRITICAL(`boolean` 완전
우회)과 그 계열 WARNING(number 안내 오분류·`defaultValue` 과잉 차단·호출부 판정 중복)의 근본
원인을 구조적으로 제거한 상태가 이번 라운드에서도 유지된다. 대상 키를 항상 raw 기준으로 제한해
사용자가 손대지 않은 `defaultValue` 필드를 과잉 차단하지 않고, 정확 일치·깊이 상한
(`MAX_REDACT_DEPTH`, 값 검사가 깊이 검사보다 우선)·스택 안전성(depth 5000)·object↔array 혼합
중첩까지 경계/캐너리 테스트로 고정돼 있으며, 마스커(`deepRedactSecrets`) 실산출물을 그대로
먹이는 왕복 통합 테스트로 마스커–판정기 미러 발산도 막았다. re-run 경로의 선존 버그(`errors`
키로 던져 `GlobalExceptionFilter` 가 `details` 만 읽어 필드별 내역이 버려지던 문제)도
`details: toTriggerParameterErrorDetails(...)` 로 함께 교정되고 회귀 테스트로 고정됐다.
`02_04_38` 이 지목한 신규 repo-guard 자체의 결함 3건(정규식이 주석/문자열 속 import 예시를
오판·탐지력 무검증·`Object.freeze(Set)` 플라시보)은 round5 커밋(`29ce00bdc`)에서 실제로
교정되었음을 소스·테스트 재실행으로 직접 확인했다 — `stripCommentsAndStrings` 전처리,
`readonly string[]` + `Object.freeze` 전환, 임시 디렉터리 fixture 기반 positive-detection
캐너리 3건이 전부 현재 코드에 존재하고 GREEN 이다. spec 5개 문서는 검사 시점("전후 2단계")과
범위("Manual 실행 경로 전체, 저작 주체 기준")를 코드와 line-level 로 일치시켜 두었다.
TODO/FIXME/HACK/XXX 주석은 관련 프로덕션 파일 어디에도 없고, `tsc --noEmit` 은 변경 파일
전부에서 클린하다. 신규 CRITICAL/WARNING 없음 — 남은 INFO 3건은 이번 diff 의 이탈이 아니라
기존 설계 경계 및 직전 라운드 교정을 확인한 기록이다.

## 위험도

NONE

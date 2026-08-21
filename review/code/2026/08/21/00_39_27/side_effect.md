STATUS=success ISSUES=3
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로)

## 발견사항

- **[INFO]** `MASKED_MARKERS` 가 module-private `const` 에서 `export const` 로 승격되면서, 여전히 **일반 `Set` 인스턴스**(런타임에서 freeze 되지 않음)를 `ReadonlySet<string>` 타입으로만 감싸 노출한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`export const MASKED_MARKERS: ReadonlySet<string> = new Set([`)
  - 상세: `ReadonlySet<string>` 은 컴파일 타임 제약일 뿐 런타임 불변성을 보장하지 않는다. 향후 어떤 소비 모듈이 `(MASKED_MARKERS as Set<string>).add(...)` 처럼 타입을 우회해 이 싱글턴을 변형하면, 같은 프로세스 안에서 `isMaskedMarker`(egress 마스킹 판정)와 이번 PR 이 새로 도입한 `findMaskedResubmissions`(재제출 거부 판정, `reject-masked-resubmission.ts:118`) 양쪽의 판정 기준이 동시에 조용히 바뀐다 — 두 판정기가 지금 이 한 Set 인스턴스를 공유하기로 설계됐기 때문에(주석: "같은 프로세스 안이라 공유하지 못할 이유가 없다") 원치 않는 변형의 파급 범위가 넓다. 현재 diff 안에서 `MASKED_MARKERS` 자체(Set 값)를 직접 import 하는 신규 소비처는 없고(`isMaskedMarker` 함수만 import), 즉시 악용 경로는 없다.
  - 제안: 필수는 아니나, export 시 `Object.freeze(new Set([...]))` 로 감싸거나 `as const` + 별도 immutable wrapper 로 내보내 "공유 싱글턴을 실수로 변형" 하는 미래 회귀를 컴파일 타임이 아니라 런타임에서도 막아 두면 이 판정기 공유 설계의 전제(단일 SoT)가 더 견고해진다.

- **[INFO]** 두 기존 공개 엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)의 요청 유효값 집합이 좁아지는 breaking 인터페이스 변경 — 문서화·영향 확인은 완료됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69`(`resolveTriggerParametersRejectingMasked` 신설, 두 호출부에서 기존 `resolveTriggerParameters` 를 대체) — 호출부는 `codebase/backend/src/modules/executions/executions.service.ts:499`, `codebase/backend/src/modules/workflows/workflows.controller.ts:317`
  - 상세: 이전에는 Manual 파라미터 값이 마스킹 마커 세 문자열(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)과 정확히 일치해도 정상 입력으로 수락됐다. 이 변경 이후 동일 값은 400(`MASKED_VALUE_RESUBMITTED`)으로 거부된다. 재제출 값뿐 아니라 사용자가 방금 타이핑한 fresh 입력도 대상이라는 점이 문서에 명시돼 있고(`spec/5-system/14-external-interaction-api.md:1573`), 저장소 밖 소비자 존재 여부는 저장소 소유자 확인으로 "없음" 이 기록돼 있다(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:357`). 코드 자체의 결함은 아니며, 이미 다른 리뷰 라운드(api_contract)에서도 같은 항목이 INFO 로 처리된 이력이 있다 — side-effect 관점에서도 동일 결론으로 확인.
  - 제안: 조치 불요. 참고 등재만.

- **[INFO]** `POST /executions/:id/re-run` 400 응답의 에러 봉투 키가 `errors` → `details` 로 바뀜 — `GlobalExceptionFilter` 가 `details` 만 읽는다는 사실을 직접 확인해, 기존 클라이언트에 대한 실질 회귀가 아님을 검증
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`(`details: toTriggerParameterErrorDetails(err.errors),`) — 필터 쪽 근거는 `codebase/backend/src/common/filters/http-exception.filter.ts:73`(`details = resp.details ?? nested?.details;`, `errors` 키는 어디에서도 읽지 않음)
  - 상세: 변경 전 코드는 `throw new BadRequestException({ code, message, errors: err.errors })` 형태였는데, `GlobalExceptionFilter.catch()` 는 `resp.details`/`nested?.details` 만 조회하고 `resp.errors` 는 애초에 읽지 않는다. 즉 종전에도 이 엔드포인트의 400 응답 바디에는 필드별 내역이 실리지 않았고(`error.details` 부재), 이번 변경으로 그 내역이 처음 노출되기 시작한 것이다 — 키 이름이 바뀐 게 아니라 **누락돼 있던 필드가 채워진 것**이므로 `body.errors` 를 읽던 기존 클라이언트가 있었다면 애초에 무의미한 읽기였고, 이번 변경으로 새로 깨지는 소비자는 없다.
  - 제안: 조치 불요. 확인 완료로 기록.

## 요약

핵심 진입점 두 곳(`executions.service.ts`/`workflows.controller.ts`)이 기존 `resolveTriggerParameters` 호출을 새 래퍼 `resolveTriggerParametersRejectingMasked` 로 치환한 방식은 시그니처를 그대로 유지한 drop-in 교체이고(반환 타입·인자 동일), 신설 헬퍼(`reject-masked-resubmission.ts`)는 입력 객체를 변형하지 않는 순수 함수라 예상치 못한 상태 변경·전역 변수 도입·파일시스템/네트워크/환경변수 부작용은 없다. `sanitize-error-message.ts` 에서 기존 private 상수·함수(`MASKED_MARKERS`/`isMaskedMarker`)를 export 로 승격한 것은 가시성만 넓히는 non-breaking 변경이나, `MASKED_MARKERS` 가 freeze 되지 않은 채 `ReadonlySet` 타입으로만 보호되는 공유 싱글턴이라는 점은 향후 오용 여지로 INFO 등재했다(현재 실제 위반 소비처는 없음). 두 엔드포인트의 요청 유효값 집합이 좁아지는 인터페이스 변경과 re-run 응답 봉투 키 변경은 모두 `GlobalExceptionFilter` 실코드 확인·plan 문서 확인을 거쳐 실질적 회귀가 아님을 검증했다. 전반적으로 부작용 관점에서 이 변경은 안전하다.

## 위험도

LOW

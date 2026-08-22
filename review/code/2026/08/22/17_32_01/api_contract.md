# API 계약(API Contract) 리뷰

## 검증 방법

프롬프트의 unified diff 35개 파일을 확인하고, API 계약과 직접 관련된 핵심 파일
(`executions.service.ts`, `executions.controller.ts`, `workflows.controller.ts`,
`workflows.service.ts`, `error-codes.md`, `2-api-convention.md`, `rerun-modal.tsx`,
`http-exception.filter.ts`)을 저장소 원본에서 직접 `Read`/`grep` 으로 대조했다. 이번
diff 는 직전 리뷰 세션(`17_06_14`)이 낸 WARNING 들에 대한 `RESOLUTION.md` 반영분
(CHANGELOG 신설, 테스트 코드값 단언 추가)을 포함한 재검토 대상이다.

### 발견사항

- **[WARNING]** `POST /executions/:id/re-run` 의 최상위 `error.code` 를 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 dual-emit 없이 즉시 rename — 하위 호환성 breaking
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:510` (diff 게이트 510) / Swagger 서술 `codebase/backend/src/modules/executions/executions.controller.ts:274`
  - 상세: `resolveTriggerParametersRejectingMasked` 검증 실패 시 던지던 최상위 `code`가 값만 바뀐다. 이 엔드포인트는 `@Roles('editor')` + 워크스페이스 JWT 만 있으면 UI 밖에서도 호출 가능한 REST 엔드포인트라, 저장소 밖 제3자 클라이언트가 이 값으로 분기했을 가능성을 grep 만으로 완전히 배제할 수 없다. `error.code` 가 단일 스칼라 필드라 구조적으로 alias/dual-emit 자리가 없다는 점은 확인했고(`error.details[]` 항목 코드는 이번 변경으로 값이 바뀌지 않음), 사내 프런트(`rerun-modal.tsx`)는 이 값으로 분기하지 않음을 실측 확인했다.
  - 제안: (이미 상당 부분 처리됨 — 재확인용) `spec/conventions/error-codes.md:145` §5 Rename 이력에 "본 표에서 리스크 등급이 가장 높은 행" 으로 명시 등재돼 있고, 사용자 결정(2026-08-22)으로 잔여 위험을 인수했다. `CHANGELOG.md` 에도 `## Unreleased` 섹션(breaking 고지 + 영향 엔드포인트 + `details[]` 불변 명시)이 이번 diff 에서 신설됐다 — 직전 리뷰가 지적한 "CHANGELOG 누락" 은 해소됐다. 추가 조치는 불요하나, 배포 시점에 외부 API consumer 채널(고객 공지 등)에도 동일 고지가 나가는지는 이 리뷰 범위 밖이므로 별도 확인 권장.

- **[INFO]** 세 Manual 경로(`POST /workflows/:id/execute` · `POST /workflows/:id/save` · `POST /executions/:id/re-run`) 의 응답 봉투가 완전히 동형화됨 — 계약 일관성 개선(긍정 관찰)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:503-520`, `codebase/backend/src/modules/workflows/workflows.controller.ts:324`, `codebase/backend/src/modules/workflows/workflows.service.ts:931`
  - 상세: 셋 다 `TriggerParameterValidationException` 을 `BadRequestException`(400) + `code: 'INVALID_TRIGGER_PARAMETERS'` + `details: toTriggerParameterErrorDetails(err.errors)` 로 동일하게 감싸는 것을 grep 으로 재확인했다(`workflows.controller.ts:324`, `workflows.service.ts:931`, `executions.service.ts:510` 전부 동일 리터럴). `GlobalExceptionFilter`(`http-exception.filter.ts:73`)는 `details` 필드만 읽으므로 봉투 스키마도 일치한다. 부수로 종전 re-run 경로가 `errors` 키로 던져 `details[]` 가 응답에 실리지 않던 선존 버그(2026-08-20 이전)도 이미 교정된 상태임을 코드로 확인했다.
  - 제안: 없음(정보성).

- **[INFO]** API 버전 관리: URL 버저닝이 없는 단일 버전 운영 정책과 이번 breaking rename 처리 방식이 일치함
  - 위치: `spec/5-system/2-api-convention.md:31` ("버전 | URL 경로에 포함하지 않음")
  - 상세: 이 프로젝트는 버전 분기 없이 rename 이력 문서(`error-codes.md §5`)로 breaking change 를 추적하는 절차를 쓴다. 이번 변경은 그 절차(§5 신규 행 + 리스크 등급 명시 + CHANGELOG)를 그대로 따랐고, 기존 3건의 선례와 같은 패턴이다.
  - 제안: 없음(정보성).

- **[INFO]** `error-codes.md §5` Rename 이력 표의 신규 행 "PR" 컬럼이 여전히 placeholder(`#TBD_PR`) — API 계약 자체는 아니나 rename 추적 SoT 미완결
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: `grep -n TBD_PR spec/conventions/error-codes.md` 로 현재 저장소 상태에서도 미치환 확인. `RESOLUTION.md`(W4)가 "PR 생성 직후 치환" 을 명시적 후속 절차로 잡아 뒀으므로 이 시점(PR 생성 전)엔 정상적인 중간 상태다.
  - 제안: PR 번호 확정 즉시 치환 — push 전 최종 확인 체크리스트 항목으로 유지.

### 요약

핵심 변경은 `POST /executions/:id/re-run` 의 최상위 `error.code` 를 자매 두 엔드포인트(`execute`/`save`)와 동일한 `INVALID_TRIGGER_PARAMETERS` 로 통일하는 것으로, 기술적으로 명백한 breaking change 다. 다만 (1) `error.code` 가 단일 필드라 dual-emit 이 구조적으로 불가능함을 확인했고, (2) 더 세밀한 `error.details[].code` 는 값이 바뀌지 않으며, (3) 사내 프런트 분기 없음을 grep 으로 실측했고, (4) `spec/conventions/error-codes.md §5` 에 "최고 리스크 등급" 행으로 명시 등재 + 사용자 결정으로 잔여 위험을 인수했으며, (5) 직전 리뷰가 지적한 CHANGELOG 누락도 이번 diff 에서 `## Unreleased` 섹션 신설로 해소됐다. HTTP 상태 코드·응답 봉투 구조·인증/인가·요청 검증 로직·URL 설계·페이지네이션에는 변경이 없다. 남은 실무 항목은 `error-codes.md:145` 의 `#TBD_PR` placeholder 를 PR 생성 후 실제 번호로 치환하는 절차뿐이며, 이는 이미 RESOLUTION 에 후속 조치로 명시돼 있다.

### 위험도

MEDIUM

# API 계약(API Contract) 리뷰 — 마스킹 값 재제출 서버측 거부 (EIA §R17, 5라운드째)

## 검토 범위와 방법

`git diff origin/main...HEAD --stat -- codebase/` 로 실제 애플리케이션 코드 범위를 확인했다
(10개 파일, +859/-14). 이번 라운드(`02_04_38`)에서 직전 라운드(`01_38_26`) 대비 **순증분은
`repo-guards/__tests__/masked-reject-callers-guard.ts` + `.spec.ts` 두 파일뿐**이다 — 나머지
production 코드(`reject-masked-resubmission.ts`, `trigger-parameter.types.ts`,
`executions.service.ts`, `workflows.controller.ts`, `sanitize-error-message.ts`)는 앞선
4라운드(`00_03_57`→`00_39_27`→`01_15_47`→`01_38_26`)에서 이미 API 계약 관점으로 심층
검토됐고, 실물 코드(`Read`)로 현재 상태를 재대조했다:

- `codebase/backend/src/modules/executions/executions.service.ts` (게이트 484-519, `reRun`)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (게이트 295-335, `execute`)
- `codebase/backend/src/common/filters/http-exception.filter.ts` (`details`/`errors` 배선 재확인)
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts`
- `spec/5-system/3-error-handling.md` §1.6/§1.7 (에러 카탈로그 정합)

신규 두 파일(`masked-reject-callers-guard.ts`/`.spec.ts`)은 **internal repo-guard**(어느 소스가
`resolveTriggerParameters` base 를 직접 import하는지 감시하는 아키텍처 가드)로, HTTP 표면·요청/응답
스키마·라우팅과 무관해 API 계약 관점 발견사항이 없다.

## 발견사항

- **[INFO]** 두 Manual 실행 진입점의 최상위 `error.code` 가 여전히 다르다(`INVALID_INPUT` vs
  `INVALID_TRIGGER_PARAMETERS`) — 문서화된 선존 drift, 이번 라운드도 재확인만
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`code: 'INVALID_INPUT'`,
    reRun catch 블록) / `codebase/backend/src/modules/workflows/workflows.controller.ts`
    (`code: 'INVALID_TRIGGER_PARAMETERS'`, execute catch 블록)
  - 상세: `01_38_26` api_contract 라운드가 WARNING 으로 처음 지적했고, 같은 라운드 RESOLUTION 이
    "선존 + 이 PR 스코프 밖"으로 조치 불요 처분했다. 이번에 `spec/5-system/3-error-handling.md`
    §1.7 인근(`> **error.details[].code (필드별 사유, 구현)**...`)을 직접 열어 대조한 결과, 제안됐던
    캐비엇("re-run 은 `INVALID_INPUT`, execute 는 `INVALID_TRIGGER_PARAMETERS`, `details[].code` 만
    공통")이 실제로 명문화돼 있음을 확인했다 — "Manual 실행 경로... `INVALID_TRIGGER_PARAMETERS`,
    그리고 Manual re-run 경로... `INVALID_INPUT`... 도 동일 헬퍼를 쓴다" 문장이 정확히 그 역할을
    한다. `details[].code = MASKED_VALUE_RESUBMITTED` 는 두 경로에서 완전히 수렴했으므로, 필드
    단위로 분기하는 클라이언트에는 영향이 없다. 최상위 `code` 로 분기하는 클라이언트만 두 갈래
    처리가 필요하며, 이는 이번 PR 이 만든 게 아니라 이미 존재하던 두 엔드포인트 간 봉투 drift다.
  - 제안: 조치 불요(재확인 등재). 두 봉투를 통일하는 것은 기존 클라이언트가 보는 최상위 코드를
    바꾸는 별도 breaking 결정이라 이 PR 범위 밖.

- **[INFO]** `ReRunRequestDto.inputOverride` 의 Swagger description 이 새 예약어 제약을 언급하지
  않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride` 필드,
    `@ApiPropertyOptional({ description: '... Manual Trigger parameters 스키마와 호환
    (resolveTriggerParameters 검증)' ...})`)
  - 상세: 실제 검증 함수는 `resolveTriggerParametersRejectingMasked` 로 바뀌었고 마스킹 마커 세
    문자열이 이제 값 자리에서 예약어가 되지만, DTO 의 Swagger 설명은 여전히 옛 함수명
    (`resolveTriggerParameters`)만 언급한다. `01_15_47` RESOLUTION 이 이미 이 항목(#5)을
    "기존 문서화 관행과 일치, 외부 소비자 부재 확인됨, 다음 DTO 편집 기회로 유예"로 처분했다 —
    이번 라운드에도 그 상태 그대로임을 재확인.
  - 제안: 조치 불요(유예 유지). Swagger 를 소비하는 외부 API 클라이언트가 없다고 이미 확인된
    상태이므로 즉시성 낮음. 다음에 이 DTO 를 편집할 기회에 한 줄 보강 권장.

- **[INFO]** 신규 두 파일(`masked-reject-callers-guard.ts`/`.spec.ts`)은 API 표면(HTTP 라우트·
  요청/응답 스키마·인증)에 영향이 없는 순수 정적 분석 가드다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`
  - 상세: `resolveTriggerParameters`(base)를 허용목록 밖에서 직접 import 하는 소스가 있으면
    테스트 스위트를 RED 로 만드는 소스 스캔 유틸이다. 런타임 요청 경로·엔드포인트·DTO 를
    건드리지 않으므로 API 계약 관점에서는 발견사항이 없다 — 참고 등재만.
  - 제안: 해당 없음.

## 관점별 요지 (재확인)

1. **하위 호환성**: 리터럴 마스킹 마커 세 문자열(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)이
   Manual 실행 경로 두 엔드포인트에서 값으로 쓰이던 기존 호출은 이제 400 으로 거부된다 —
   의도된 breaking change. CHANGELOG·spec(§R17)·저장소 소유자 확인(외부 소비자 부재)으로 통제됨.
   이번 라운드에서 이 판단을 뒤집을 근거는 발견되지 않았다.
2. **버전 관리**: API 버전 스킴 부재는 선존 구조(이 diff 밖) — CHANGELOG/spec 문서화 관행 유지.
3. **응답 형식**: `error.details[]` 3속성(`field`/`code`/`message`) 패턴을 기존 3개 reason 과 동일한
   포맷으로 확장. 최상위 `error.code` 는 경로별 선존 drift(위 INFO) — 이번 diff 가 새로 만든 게
   아니고 spec 에 명문화됨.
4. **에러 응답**: HTTP 400 적절. `GlobalExceptionFilter`(`http-exception.filter.ts:73`)가
   `resp.details`만 읽는다는 것을 실물 코드로 재확인 — re-run 의 `errors`→`details` 교정은 실질
   회귀 없는 순개선.
5. **요청 검증**: `resolveTriggerParametersRejectingMasked` 가 raw 우선→resolve→재검사 2단계로
   요청 바디 검증을 강화. 정확 일치만 판정해 과잉 차단 방지가 캐너리로 고정됨. `ReRunRequestDto`
   자체의 얕은 `@IsObject()` 검증 수준은 이 diff 가 만든 게 아님.
6. **URL/경로 설계**: 신규 엔드포인트 없음. 기존 두 엔드포인트의 내부 검증 로직만 변경.
7. **페이지네이션**: 해당 없음.
8. **인증/인가**: 변경 없음 — 두 컨트롤러 메서드 모두 기존 가드(`findById`/권한 체크)가 마스킹
   검사보다 앞서 수행되는 순서가 유지됨을 실물 코드로 재확인.

## 요약

이번 라운드의 실질 코드 증분은 API 표면과 무관한 internal repo-guard 테스트 두 파일뿐이며,
Manual 실행 경로 두 엔드포인트(`POST /executions/:id/re-run`, `POST /workflows/:id/execute`)의
API 계약 자체는 앞선 4라운드(`00_03_57`~`01_38_26`)를 거치며 CRITICAL 1건(boolean 완전 우회)과
다수 WARNING(호출부 중복·`errors`→`details` 배선·spec 시점 서술)이 전부 수정·검증됐고, 현재
CRITICAL 0 / WARNING 0 로 수렴한 상태다. 유일하게 남은 관점은 두 엔드포인트의 최상위 `error.code`
가 서로 다르다는 선존 drift인데, 이는 spec(`error-handling.md` §1.7 인근)에 이미 명문화돼 있고
`details[].code`(`MASKED_VALUE_RESUBMITTED`)는 완전히 수렴했으므로 실질 영향은 낮아 INFO 로
재확인만 한다. 이번 PR 전체의 breaking change(마스킹 마커 리터럴 값 거부)는 CHANGELOG·spec·
저장소 소유자 확인을 통해 통제된 형태로 문서화돼 있다.

## 위험도

LOW

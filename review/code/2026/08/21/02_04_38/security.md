# 보안 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, 5라운드 누적)

## 검토 범위 및 방법

이번 diff 는 `codebase/` 실질 코드 변경(파일 1~11) + 이전 네 리뷰 라운드(`00_03_57`,
`00_39_27`, `01_15_47`, `01_38_26`)와 최근 4회 consistency 라운드의 산출물 + plan/spec
문서(파일 12~109)를 함께 커밋한 형태다. 프롬프트가 크기 제한으로 생략한 핵심 파일
(`reject-masked-resubmission.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`)은 `Read` 로
저장소에서 직접 전문을 열어 확인했고, 호출부 두 곳(`executions.service.ts` `reRun`,
`workflows.controller.ts` `execute`)의 실제 주변 코드, `trigger-parameter.types.ts`,
`sanitize-error-message.ts` 전문을 실코드로 대조했다. `git log -S`/`git show`로 라운드4
(`54142453c`, `masked-reject-callers-guard.ts`+`.spec.ts` 신규 추가)가 이번 라운드에서
새로 반영된 유일한 실질 코드 델타임을 확인했고, `git diff` 로 하드코딩 시크릿 패턴을
전수 grep 했다(테스트 더미 값 `sk-live-abc123`/`hunter2` 외 매치 없음).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 신규 repo-guard(`masked-reject-callers-guard.ts`/`masked-reject-callers.spec.ts`)가
  마커 거부 우회를 컴파일 타임이 아니라 CI 산출물(테스트)로 강제한다 — 방어 심층화, 신규
  취약점 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    함수 `importsBaseFn`(72~82행), `findUnexpectedCallers`(85~94행)
  - 상세: `resolveTriggerParameters`(base, 마커 거부 없음)를 Manual 실행 경로가 실수로
    직접 import 하면 마스킹 재제출이 조용히 통과할 수 있었던 자리를 이 가드가 닫는다.
    import 문 블록만 매칭하는 정규식(`import\s*\{[\s\S]*?\}\s*from`, non-greedy·중첩
    정량자 없음)이라 ReDoS 형태가 아니고, 입력도 신뢰된 저장소 소스 파일(사용자 입력
    아님)이라 별도 위협 표면이 아니다. 접두 겹침(`resolveTriggerParametersRejectingMasked`
    vs `resolveTriggerParameters`) 오탐 방지 캐너리도 확인했다.
  - 참고: 허용목록(`ALLOWED_DIRECT_CALLERS`)이 webhook/schedule 호출부를 base 함수 허용
    대상으로 명시하는데, 이는 EIA §R17 이 문서화한 의도된 설계(외부 시스템이 저작하는
    페이로드는 마커 리터럴이 정상 값일 수 있음)와 일치 — 카브아웃이 아니라 확정된 범위.
- **[INFO]** 핵심 판정 로직(`resolveTriggerParametersRejectingMasked`/
  `findMaskedResubmissions`/`hasMaskedLeaf`)은 이전 라운드 CRITICAL(boolean 파라미터
  완전 우회)을 raw(coerce 전) → resolve 순 2단계 검사로 해소한 상태를 그대로 유지 —
  회귀 없음 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `resolveTriggerParametersRejectingMasked`(56~75행), `hasMaskedLeaf`(132~145행)
  - 상세: 값 검사가 깊이 검사보다 먼저 수행되어(133~135행) 마스커의 치환 지점(`MAX_REDACT_DEPTH`)
    을 놓치지 않고, 대상 키는 `rawSource` own-property 로만 제한되어(`findMaskedResubmissions`
    124행) `defaultValue` 과잉 차단이 없다. 정확 일치만 보므로(`isMaskedMarker`) `a***b`
    류 정상 값은 통과 — 경계·회귀 캐너리(`reject-masked-resubmission.spec.ts`)로 고정됨을
    직접 확인.
- **[INFO]** 에러 응답에 실제 제출 값이 echo 되지 않는다 — 정보 노출 없음
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    `toTriggerParameterErrorDetails`/`REASON_TO_DETAIL`(36~81행)
  - 상세: `details[]` 에는 스키마 정의 `field` 명·고정 `code`(`MASKED_VALUE_RESUBMITTED`
    등)·고정 `message` 만 실린다. 마스킹 마커든 사용자 원문이든 값 자체는 직렬화되지
    않는다. `TriggerParameterValidationException` 의 내부 `Error.message` 는 필드명+reason
    문자열만 담고(값 미포함), `GlobalExceptionFilter` 는 `details` 만 응답에 실어 이 내부
    메시지가 클라이언트로 직접 노출되지 않는다.
- **[INFO]** 두 Manual 실행 진입점 모두 인가 체크(워크스페이스 소유권/권한)가 마커 검사
  보다 선행 — 신규 인가 우회 표면 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reRun`
    (마커 검사는 dto 처리 흐름 안쪽, `useOriginalInput` 분기·chain depth 체크·workspace
    조회 이후에 위치), `codebase/backend/src/modules/workflows/workflows.controller.ts`
    `execute`(`workflowsService.findById` 가 마커 검사보다 먼저 실행)
  - 상세: 이번 diff 가 추가한 검사는 기존 IDOR/권한 검증 순서를 앞지르지 않는다.
- **[INFO]** 공유 마스킹 마커 집합(`MASKED_MARKERS`)이 `Object.freeze` 로 런타임 불변화된
  상태 유지 — 이전 라운드 side_effect 지적 반영 확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 150~152행
  - 상세: egress 마스킹 판정(`isMaskedMarker`)과 재제출 거부 판정(`findMaskedResubmissions`)이
    같은 싱글턴을 공유하도록 export 승격됐고, 타입 우회로 변형돼도 런타임에서 막힌다.
- **[INFO]** `useOriginalInput: true` 분기(원본 `inputData` 그대로 재실행)는 이 마커 거부
  검사를 거치지 않는다 — 설계상 의도, 신규 결함 아님
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reRun`
    (`useOriginal` 분기, 마커 검사는 `else`/`inputOverride` 분기에만 위치)
  - 상세: 이 경로는 저장된 원본 실행의 `inputData` 를 그대로 재사용하는 경로라 애초에
    `'***'` 문자열이 사용자가 방금 입력한 값일 수 없고(마스킹 카브아웃이 이미 별도로
    처리하는 영역), 사용자가 조작 가능한 `inputOverride`/`parameterValues` 표면만
    Manual 파라미터 예약어 규칙의 대상이다.
- **[INFO]** 테스트 fixture 예시 값(`sk-live-abc123`, `hunter2`, `postgres://***@db/prod`)은
  전부 마스킹 왕복 확인용 더미 값 — `git diff` 전수 grep 으로 실제 시크릿 부재 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts`

## 요약

이번 라운드의 유일한 실질 코드 델타(`masked-reject-callers-guard.ts`/`.spec.ts` — Manual
실행 경로가 마커-비거부 base 함수를 실수로 직접 import 하지 못하게 하는 repo-guard)는
새로운 취약점을 도입하지 않았고, 기존 방어(raw-우선 2단계 마커 검사, 정확 일치, 깊이 상한,
값 미노출 에러 응답, 마커 집합 freeze, 인가 체크 선행 순서)를 코드/우회 표면 관점에서
한 단계 더 굳히는 방어 심층화(defense-in-depth) 성격이다. 인젝션, 하드코딩 시크릿,
인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 관련 신규 결함은 발견되지 않았다.
이전 네 라운드가 발견한 CRITICAL(boolean 파라미터 완전 우회) 및 WARNING(호출부 중복,
`isPlainRecord` 재구현, `errors`→`details` 봉투 유실, `MASKED_MARKERS` 미고정, 불변식이
주석으로만 강제됨)은 전부 실물 코드에서 해소가 유지되고 있음을 재확인했다.

## 위험도

NONE

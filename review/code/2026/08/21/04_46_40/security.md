# 보안 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 실질 애플리케이션 코드 변경 15개 파일을 확인하고,
프롬프트에서 diff 가 생략된 신규 파일(`reject-masked-resubmission.ts`/`.spec.ts`,
`masked-reject-callers-guard.ts`/`.spec.ts`, `production-build-devdep-guard.ts`/`.spec.ts`)은
저장소에서 직접 `Read` 로 전문을 확인했다. 나머지(plan/spec/review 산출물)는 이번 변경의
배경·근거 기록이며 애플리케이션 코드가 아니라 보안 관점 별도 발견사항 없음.

핵심 변경: Manual 트리거 파라미터 재제출 경로(re-run `inputOverride`, execute `parameterValues`)
에서 egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)가 그대로 되돌아오면 서버가 400
으로 거부한다(`resolveTriggerParametersRejectingMasked`). 이 리뷰 라운드(`04_46_40`) 이전에
이미 9라운드에 걸쳐 CRITICAL 1건(`boolean` 파라미터 완전 우회 — `Boolean('***')===true`)과
다수 WARNING(호출부 중복, `errors`→`details` 봉투 유실, 정규식 기반 repo-guard 의 4차례 우회
형태, `Object.freeze(Set)` 플라시보 등)이 지적·해소돼 왔다. 이번 라운드는 그 최종 상태를 코드
기준으로 재검증한다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 두 단계(raw → resolve) 검사 사이 알려진 UX 트레이드오프가 남아 있으나 보안 우회는 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    `resolveTriggerParametersRejectingMasked` (① `rawHits` 검사 후 `throwIfAny`, 이어서 ②
    `resolveTriggerParameters` 결과 재검사)
  - 상세: ①(raw)을 통과한 뒤 무관한 필드의 진짜 타입 오류로 `resolveTriggerParameters` 가
    `coerce_failed` 를 던지면 ②(object/array 를 JSON 문자열로 보낸 경우의 마커 검사)는 실행되지
    않는다. 값 자체는 항상 정확 일치로만 판정되고 거부 자체가 무력화되는 것은 아니므로(사용자는
    타입 오류를 먼저 고쳐 재제출하고, 그때 마커 안내를 받는다) 우회가 아니라 안내 지연이다. 이미
    이전 라운드(`01_15_47` testing INFO-3)가 같은 트레이드오프를 식별해 docstring 에 명시했고
    ("합쳐서 throw 하지 않는 이유"), 이번 라운드에서도 재확인 결과 결론 변경 없음.
  - 제안: 조치 불요(문서화 완료, 보안 영향 없음).

- **[INFO]** `masked-reject-callers-guard.ts` 의 AST 기반 사용처 탐지는 정적 문자열 연결(예:
  `'resolve' + 'TriggerParameters'`)이나 프록시/리플렉션 경유 호출까지는 포착하지 못한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    `importsBaseFn`
  - 상세: 이 가드는 CI 상의 방어선(架空 아키텍처 회귀 방지)이지 런타임 보안 통제 자체는 아니다.
    실제 값 비교 로직(`findMaskedResubmissions`/`hasMaskedLeaf`)은 이 가드와 무관하게 항상
    작동한다. 가드가 놓치는 극단적 우회 형태(동적 문자열 조합으로 함수를 얻어 호출)는 저장소
    내부 개발자가 의도적으로 가드를 피해가려는 시나리오에서만 의미가 있고, 외부 공격자가 통제
    가능한 입력이 아니다. 이미 7가지 알려진 우회 형태(named/rename/namespace/require/dynamic
    import/bracket/colon-rename)에 대해 캐너리 테스트로 회귀 고정돼 있어 실질 커버리지는 높다.
  - 제안: 조치 불요. 남은 표면은 이론적이며 CI 가드의 목적(사람의 실수 방지)에 비례해 과도한
    하드닝이다.

- **[INFO]** 에러 응답(`TriggerParameterErrorDetail`)에는 `field`(스키마 정의 파라미터명)·
  `code`(고정 enum)·`message`(고정 문자열)만 실리고, 실제 제출값(마스킹 마커든 원문이든)은
  어디에도 echo 되지 않는다 — 정보 노출 관점에서 안전
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    `toTriggerParameterErrorDetails`/`REASON_TO_DETAIL`
  - 상세: 재확인 결과 이전 라운드 결론과 동일. 값 회귀 없음.

- **[INFO]** 선존 결함 교정(`errors` → `details`)이 `GlobalExceptionFilter` 의 실제 소비 로직과
  일치함을 소스로 재확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (신규 `details:
    toTriggerParameterErrorDetails(err.errors)`), 필터 근거는
    `codebase/backend/src/common/filters/http-exception.filter.ts:73`
    (`details = resp.details ?? nested?.details;` — `errors` 키는 읽지 않음)
  - 상세: 종전 `errors: err.errors` 는 필터가 읽지 않아 필드별 내역이 조용히 버려졌었고, 이번
    교정으로 `workflows.controller.ts` 의 자매 호출부와 형태가 같아졌다. 노출되는 값은 여전히
    분류 정보(`field`/`code`/`message`)뿐이라 새로운 정보 노출은 없다.
  - 제안: 조치 불요.

- **[INFO]** `tsconfig.build.json` 의 `src/repo-guards/**` 프로덕션 빌드 제외는 devDependency
  (`typescript`) 가 프로덕션 산출물(`dist/`)에 `require` 형태로 새어나가던 잠재적 배포 결함을
  막는다 — `production-build-devdep-guard.ts` 가 회귀를 CI 에서 지속 검증
  - 위치: `codebase/backend/tsconfig.build.json`,
    `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts`
  - 상세: 이 결함 자체는 인젝션·인증 우회류가 아니라 프로덕션 설치에 없는 모듈을 `require`
    하면 런타임 크래시가 나는 가용성 문제에 가깝다. 다만 "의존성 보안" 관점에서 프로덕션
    산출물에 devDependency 가 섞이지 않도록 하는 위생 조치로서 긍정적이며, 가드 스펙에
    스킵된 테스트가 없어 실제로 CI 강제됨을 확인했다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 Manual 트리거 파라미터 재제출 경로(re-run `inputOverride`, execute
`parameterValues`)에서 egress 마스킹 마커가 실제 입력값으로 그대로 되돌아오는 것을 서버측
2차 방어층으로 차단하는 보안 강화 변경이다. 핵심 판정 함수(`findMaskedResubmissions`/
`hasMaskedLeaf`)는 정확 일치만 보고(부분 포함 값 과잉 차단 없음), 값 검사를 깊이 검사보다
먼저 수행해(`MAX_REDACT_DEPTH` 경계에서의 off-by-one/fail-open 회피) 이전 라운드가 실증한
CRITICAL(boolean 파라미터 `Boolean('***')===true` 완전 우회)을 raw-우선 2단계 검사로 근본
해소했다. 재귀는 기존 `deepRedactCore` 와 동일한 `MAX_REDACT_DEPTH` 상수를 재사용해 상한이
있고, 입력이 이미 파싱된 JSON 이라 순환 참조 우려도 없다. 에러 응답은 필드명·고정 코드·고정
메시지만 실어 실제 제출값을 echo 하지 않으며, 선존 버그(`errors`→`details` 봉투 유실)도 함께
교정돼 두 Manual 엔드포인트의 응답 형태가 일치한다. 우회 방지를 위한 CI 가드
(`masked-reject-callers-guard`)는 초기 정규식 기반에서 AST 기반으로 전환되어 7가지 알려진
우회 형태(namespace/require/dynamic-import/bracket-access/colon-rename 포함)를 캐너리
테스트로 회귀 고정했고, 실제 위반 탐지 여부를 합성 fixture 로 검증하는 테스트까지 갖춰
"가드가 있다고 믿게 만드는" 무보증 가드 패턴을 피했다. 인젝션·하드코딩 시크릿·인증/인가
우회·안전하지 않은 암호화 관련 문제는 발견되지 않았고, 남은 항목은 전부 이미 문서화된 경미한
트레이드오프(INFO)뿐이다.

## 위험도

NONE

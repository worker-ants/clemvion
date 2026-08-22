# 보안(Security) 코드 리뷰

## 검토 방법

프롬프트의 unified diff 를 실제 워크트리 `git diff origin/main...HEAD` 로 직접 대조했다.
애플리케이션 코드로 분류되는 파일은 4개뿐이며(나머지는 `plan/**`·`review/**` 프로세스
산출물과 spec frontmatter 1줄), 이 4개 전부 **JSDoc/인라인 주석/Swagger `description`
문자열만** 바뀌었고 실행 가능한 문(statement)·조건문·시그니처·리턴값은 diff 이전과
바이트 단위로 동일함을 확인했다:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL` 3개 항목에 JSDoc 추가만
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — `resolveTriggerParameters` JSDoc 블록 확장만
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `@ApiPropertyOptional({ description })` 문자열만 확장
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — 기존 영문 인라인 주석 3줄을 한국어로 치환(정보 보존), `throw new BadRequestException({...})` 로직 자체는 무변경

실제 마스킹 마커 거부 로직 파일(`reject-masked-resubmission.ts`)은 이번 diff 에 전혀
포함되지 않았음을 `git diff --stat` 로 확인했다 — raw 단계 우선 검사 → resolve 후 재검사의
2단계 판정, `hasMaskedLeaf`/`findMaskedResubmissions` 의 **정확 일치**(exact match) 판정
로직은 이번 변경으로 손대지 않았다.

## 발견사항

- **[INFO]** Swagger `description` 이 마스킹 마커 리터럴 3종과 거부 조건·부분 일치 경계를 명시
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-24` (`inputOverride` 의 `@ApiPropertyOptional`)
  - 상세: `inputOverride` 필드 설명에 예약 마커 문자열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 "값이 정확히 일치하면 400 `MASKED_VALUE_RESUBMITTED`" 를 명시한다. 이 정보는 신규 공개가 아니다 — `spec/4-nodes/7-trigger/1-manual-trigger.md:172`("값 leaf 가 egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)와 **정확히 일치**")에 이미 정본으로 서술돼 있고, 이번 diff 는 그 문서의 frontmatter `code:` 목록 1줄만 추가했을 뿐 §6 본문은 건드리지 않았다. "정확히 일치" 판정이라는 사실 자체가 이미 공개 spec 에 있으므로 부분 일치가 통과한다는 것은 spec 을 읽으면 추론 가능한 내용이며, 이번 변경은 그 정보를 API 문서 한 곳에 재수록한 것뿐이다. 거부 로직(`hasMaskedLeaf`/`findMaskedResubmissions`)·판정 순서(raw 우선 → resolve 후 재검사)는 diff 대상이 아니라 변경되지 않았다. 마커 리터럴은 시크릿이 아니라 "가려졌다"는 sentinel 표식이므로, 이를 문서화해도 실제 원본 값이나 인증/인가 우회 경로는 노출되지 않는다.
  - 제안: 조치 불요. 참고로만 기록.

- **[INFO]** JSDoc 이 CI 가드 테스트 파일 상대경로를 인용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:118` (`resolveTriggerParameters` JSDoc, `repo-guards/__tests__/masked-reject-callers-guard.ts` 인용)
  - 상세: 저장소 내부 파일 경로 노출은 공격 표면과 무관하다 — 레포 자체가 이미 코드베이스 컨텍스트로 접근 가능하고, 가드는 소스 가시성과 무관하게 정적 AST 검사(`ts.createSourceFile` 기반 identifier 순회, JSDoc 트리비아는 판정 대상 아님 — 직전 두 라운드(`19_25_39`, `19_36_12`)가 가드 소스를 직접 읽고 뮤테이션 테스트로 확인)로 동작해 이 문구 자체가 가드를 무력화하거나 우회 정보를 제공하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `workflows.controller.ts` 의 에러 응답 조립부는 diff 이전과 완전히 동일
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:317-330` (주석만 영→한 치환, `throw new BadRequestException({ code, message, details })` 는 문맥 그대로 유지)
  - 상세: `GlobalExceptionFilter` 로 전달되는 payload 는 필드별 코드(`UPPER_SNAKE_CASE`)와 고정 메시지만 담으며, 재제출된 raw 값·예외 스택·내부 상태를 응답에 포함하지 않는다. 이번 변경은 그 근거("`errors` 가 아니라 `details`")를 한국어로 옮겼을 뿐 응답 구성 자체는 불변이다.
  - 제안: 조치 불요.

인젝션·하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리·의존성 관점에서 4개 코드
파일을 모두 검토했으나, 신규 사용자 입력 처리 경로, 신규 SQL/외부 호출, 신규 인증/인가
분기, 신규 암호화·해시 사용, 신규 에러 메시지 조합은 이번 변경에 없다. 마스킹 마커 재제출
거부 wrapper(`resolveTriggerParametersRejectingMasked`)는 Manual `execute`/`re-run` 두
경로 모두에서 여전히 사용되고, base `resolveTriggerParameters` 본문에는 마스킹 검사가
추가되지 않았다 — 즉 base JSDoc 에 wrapper 함수명이 처음 언급됐다고 해서 실제 인가/검증
경로나 CI 가드(AST 기반, 텍스트 트리비아 무관) 판정이 바뀌지 않는다.

## 요약

리뷰 대상 4개 백엔드 코드 파일은 실행 코드·검증 로직·인가 경로·에러 처리 흐름이 한 줄도
바뀌지 않은 순수 JSDoc/인라인 주석/Swagger `description` 문서화 변경이며, 실제 마스킹
마커 재제출 거부 로직 파일(`reject-masked-resubmission.ts`)은 이번 diff 범위 밖이다. 새로
추가된 Swagger 설명이 마커 리터럴과 "정확 일치만 거부"라는 경계를 노출하지만, 이는 이미
공개 spec(`1-manual-trigger.md §6`, 본문 무변경)에 정본으로 서술돼 있던 내용을 API 문서에
재수록한 것뿐이라 신규 정보 노출이나 공격 표면 확대로 보기 어렵다. 하드코딩된 시크릿,
인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출, 취약 의존성 등 보안
취약점은 발견되지 않았다.

## 위험도
NONE

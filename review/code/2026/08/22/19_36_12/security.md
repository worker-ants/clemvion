# 보안(Security) 리뷰

## 검증 방법

프롬프트 diff 외에 워크트리의 실제 소스를 직접 열어 대조했다:
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` (전체)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (execute() 핸들러 전체, try/catch 블록)
- 관련 diff(`trigger-parameter.types.ts`, `re-run.dto.ts`, `spec/4-nodes/7-trigger/1-manual-trigger.md`)

## 변경 성격 요약

리뷰 대상 26개 파일 중 실제 애플리케이션 코드는 4개(`trigger-parameter.types.ts`,
`resolve-trigger-parameters.ts`, `re-run.dto.ts`, `workflows.controller.ts`)뿐이며, 이 4개
전부 **JSDoc/인라인 주석/Swagger `description` 문자열만** 변경됐다 — 실행 로직·분기·시그니처·
반환값·에러 처리 흐름 변경이 0줄이다(직접 소스 대조로 확인). 나머지 22개 파일은 plan
트래커 갱신, spec frontmatter `code:` 목록 1줄 추가, 그리고 선행 리뷰/consistency-check 세션의
산출물(RESOLUTION.md·SUMMARY.md·meta.json·개별 reviewer 리포트 등 프로세스 생성 문서)이다.

## 발견사항

- **[INFO]** Swagger `description` 이 마스킹 마커 리터럴 3종(`***` / `[REDACTED]` / `[REDACTED_DEPTH]`)과 거부 조건(정확 일치 시 400 + `MASKED_VALUE_RESUBMITTED`)·경계(부분 일치는 통과)를 공개 API 문서에 명시한다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-24`
  - 상세: 이 마커 값들은 이미 프런트엔드 egress 마스킹 동작으로 클라이언트에 노출돼 있고(사용자가 실제로 화면에서 보는 문자열), spec(`1-manual-trigger.md §6`)에도 이미 정본으로 서술돼 있던 값이다. Swagger 설명에 그대로 옮긴 것은 **새로운 정보 노출이 아니라 기존 공개 동작의 문서화**다. 마커 리터럴 자체는 시크릿이 아니라 "값이 가려졌다"는 것을 나타내는 sentinel 문자열이므로, 이를 문서화해도 실제 가려진 값이나 인증/인가 우회 경로가 노출되지 않는다.
  - 제안: 조치 불요.
- **[INFO]** base 함수 JSDoc 이 CI 가드 테스트 파일 상대경로(`repo-guards/__tests__/masked-reject-callers-guard.ts`)를 인용한다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:118`
  - 상세: 저장소 내부 파일 경로이며 공개 API 응답에 노출되지 않는 소스 주석이다. 공격 표면과 무관.
  - 제안: 조치 불요.
- **[INFO]** `BadRequestException` 이 던지는 에러 페이로드가 여전히 일반화된 메시지(`'Invalid trigger parameters'`)와 구조화된 `details[]`(필드명·코드·고정 메시지)만 담는다 — 스택트레이스·내부 상태·raw 값을 노출하지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:317-330` (주석만 영→한 번역, catch 블록 로직 자체는 diff 이전과 동일)
  - 상세: 이번 PR 은 이 catch 블록의 인라인 주석만 한국어로 옮겼을 뿐 `throw new BadRequestException({...})` 의 구조는 변경하지 않았다. `GlobalExceptionFilter` 로 전달되는 payload 는 여전히 필드 코드/메시지만 담고, 재제출된 raw 값이나 예외 스택은 응답에 포함되지 않는다.
  - 제안: 조치 불요.
- **[INFO]** `resolveTriggerParametersRejectingMasked` wrapper (`reject-masked-resubmission.ts`)가 Manual 실행 경로(`execute`/`re-run`) 두 곳 모두에서 여전히 사용되고 있으며, base `resolveTriggerParameters` 를 직접 호출하지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:317`, `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` import 관계
  - 상세: 이번 diff 는 base 함수의 JSDoc 에 wrapper 함수명을 처음 언급하는데, 이것이 AST 기반 CI 가드(`masked-reject-callers-guard.ts`)를 무력화하거나 오탐시키지 않는지가 이 변경 세트의 핵심 보안 관심사였다. 직접 소스를 읽어 확인한 결과 base 함수 본문(`resolveTriggerParameters` 함수 선언부, :124-163)에는 마스킹 거부 검사가 추가되지 않았고, Manual 경로 두 곳 모두 여전히 wrapper 를 통해서만 호출한다 — 실제 인가/검증 경로 변경 없음.
  - 제안: 조치 불요.

## 요약

리뷰 대상 4개 백엔드 코드 파일은 실행 코드·검증 로직·에러 처리 흐름·인가 경로가 한 줄도 바뀌지 않은 순수 주석/JSDoc/Swagger 문서화 변경이며, 직접 소스를 열어 대조한 결과 마스킹 마커 재제출 거부 로직(`resolveTriggerParametersRejectingMasked` wrapper 경유)은 이전과 동일하게 유지되고 있다. 새로 추가된 Swagger description 이 마커 리터럴과 거부 조건을 노출하지만 이는 이미 공개된 클라이언트 동작·spec 서술을 옮긴 것으로 신규 공격 표면이나 시크릿 노출이 아니다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지를 통한 민감정보 노출, 취약 의존성 등 OWASP Top 10 관련 문제는 발견되지 않았다.

## 위험도
NONE

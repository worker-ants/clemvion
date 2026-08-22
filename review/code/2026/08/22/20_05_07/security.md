# 보안(Security) 코드 리뷰

## 검토 범위 확인

`git diff origin/main...HEAD` 로 실제 코드 변경분을 직접 대조했다. 코드 파일은 4개
(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`, `re-run.dto.ts`,
`workflows.controller.ts`)뿐이며, 전부 JSDoc·인라인 주석·`@ApiPropertyOptional`
`description` 문자열의 추가/치환/영→한 번역이다. 조건문·분기·검증 로직·리턴값·예외
타입 등 실행 가능한 코드 라인은 **0줄** 변경됐다. 나머지 변경 대상(`plan/**`,
`review/**`, spec frontmatter `code:` 목록 1줄)도 문서/추적 산출물이며 런타임에
로드·실행되지 않는다.

이 diff 가 문서화하는 실제 거부 로직(`resolveTriggerParametersRejectingMasked`,
`findMaskedResubmissions`/`hasMaskedLeaf` 의 정확 일치 판정, 컨트롤러의
`BadRequestException({ code, message, details })` 응답 구성, 스키마 이름 검증 정규식)은
이번 diff 로 전혀 손대지 않았다 — 전부 이전 커밋(4287cdd5b, b677564e0 등, 이미 별도
리뷰를 거쳐 머지됨)에 있는 코드다. 신규 사용자 입력 처리 경로, 신규 SQL/외부 호출,
신규 인증/인가 분기, 신규 암호화·해시 사용, 신규 에러 메시지 조합은 이번 변경에 없다.

## 발견사항

- **[INFO]** Swagger `description` 이 마스킹 마커 거부 규칙(예약어·부분 일치 통과 경계)을 API 소비자에게 명시
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `ReRunRequestDto.inputOverride` 의 `@ApiPropertyOptional({ description: ... })` 블록
  - 상세: `origin/main` 대비 최종 상태는 "마스킹 마커와 **정확히 일치**하는 값 leaf 는 예약어로 거부된다(400, `details[].code = MASKED_VALUE_RESUBMITTED`) — 부분 일치는 통과. SoT: EIA §R17" 로 서술한다(중간 커밋에서 마커 리터럴 3종을 직접 나열했다가, 후속 커밋에서 SoT 링크 방식으로 축약됨 — 문서 중복 축소 방향으로 개선). 이 정보 자체는 신규 공개가 아니다: 동일 내용이 이미 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6·Rationale, 프런트 `lib/utils/masked-markers.ts` 에 공개돼 있고, 거부 로직(raw 우선 검사 → resolve 후 재검사)도 이미 구현·배포된 동작이다. Swagger 문서화는 이미 관측 가능한 서버 응답 동작을 API 문서에 반영할 뿐이며, "부분 일치는 통과"라는 경계는 마스킹의 구조적 한계(마커가 값의 일부로 들어올 수 있음)이지 이 문서화로 새로 열리는 우회로가 아니다. 위협 모델 변화 없음.
  - 제안: 조치 불요.

- **[INFO]** JSDoc 이 내부 CI 가드 테스트 파일 경로(`repo-guards/__tests__/masked-reject-callers-guard.ts`)를 인용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — `resolveTriggerParameters` 함수 JSDoc, "## ⚠️ Manual 실행 경로는 이 함수를 직접 부르지 않는다" 절
  - 상세: 저장소 내부 CI 가드 파일 경로 노출은 공격 표면과 무관하다 — 레포 자체가 이미 협업자에게 공개된 코드베이스이고, 그 가드는 정적 AST 검사(식별자 매칭)라 경로 인지 여부와 무관하게 우회 불가능하다(직전 라운드 리뷰에서 `masked-reject-callers.spec.ts` 의 캐너리로 "주석 속 이름·접두 겹침으로도 오탐/무력화되지 않음"이 실측 확인됨).
  - 제안: 조치 불요.

## 요약

이번 diff 는 4개 backend TypeScript 파일(주석/JSDoc/Swagger description)과 plan/review
문서, spec frontmatter 1줄로 구성된 순수 문서화 변경이며, 실행 코드·검증 로직·응답
스키마·에러 처리 동작은 한 줄도 바뀌지 않았다(`git diff origin/main...HEAD` 실측으로
확인). 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은
암호화, 민감정보 노출 등 OWASP Top 10 관점의 취약점은 발견되지 않았다. Swagger
설명에 마스킹 마커 거부 규칙을 명시한 것은 이미 spec·프런트에 공개된 기존 동작을
문서화한 것뿐이라 신규 정보 노출이나 공격 표면 확대로 보기 어렵다.

## 위험도
NONE

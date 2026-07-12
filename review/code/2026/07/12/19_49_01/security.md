# 보안(Security) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (수정)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` (신규)
- `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts` (수정)
- `plan/in-progress/eia-context-schema-followups.md` (문서, 코드 아님)

## 변경 개요

`ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 각자 선언하던 동일한 6값 리터럴 유니온(`'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled'`)과 swagger `enum` 배열을 신규 파일 `execution-status.literal.ts` 의 `EXECUTION_STATUS_VALUES`(as const) + `ExecutionStatusLiteral` 타입으로 통합한 순수 DRY 리팩터. 두 DTO 는 응답(response) DTO 이며 `class-validator` 데코레이터가 없고, 클라이언트 입력을 파싱/검증하는 경로가 아니라 서버가 응답 시 OpenAPI 스키마 문서화 + TypeScript 컴파일타임 타입으로만 쓰인다. 값 집합 자체(6개 문자열)는 변경 전후 동일하며 순서도 동일하다.

### 발견사항

- **[INFO]** 순수 리팩터 — 보안 영향 없음
  - 위치: `execution-status.literal.ts` 전체, 및 두 DTO 파일의 `status`/`currentStatus` 필드
  - 상세: 이 변경은 (1) 응답 필드이므로 입력 검증/인젝션 표면과 무관, (2) 값 집합·직렬화 형태(wire enum 배열 순서 포함)가 리팩터 전후 동일, (3) 비밀값·자격증명 없음, (4) 인증/인가 로직 미접촉, (5) 암호화·해시 알고리즘 무관, (6) 에러 메시지 내용 무변경(`InteractAckDto`/`ExecutionStatusDto` 의 `description` 텍스트만 스타일 변경 없이 유지), (7) 신규 외부 의존성 없음(로컬 파일 추가일 뿐).
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/eia-context-schema-followups.md` 문서 변경
  - 위치: frontmatter `worktree` 필드, 체크박스 상태
  - 상세: 코드가 아닌 작업 추적 문서. 시크릿·개인정보·내부 인프라 세부사항 노출 없음.
  - 제안: 조치 불요.

## 요약

이번 변경은 두 응답 DTO 가 중복 선언하던 6값 상태 리터럴 유니온과 swagger `enum` 배열을 단일 로컬 SoT 파일로 추출한 순수 유지보수성 리팩터다. 응답(output) 스키마 정의에 국한되며 입력 검증·인증/인가·암호화·에러 노출·의존성 어느 축에서도 동작이나 신뢰 경계에 변화가 없다. 값 집합·순서가 리팩터 전후 동일함을 diff 로 확인했고, 하드코딩된 시크릿이나 인젝션 가능 지점도 없다.

## 위험도

NONE

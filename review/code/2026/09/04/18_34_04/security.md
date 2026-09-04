# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 실질적으로 4개 파일이다:

1. `CHANGELOG.md` — 이미 별도 커밋으로 반영된 과거 변경사항(자격증명 마스킹, 아바타 업로드 접근제어, 소켓 토큰 재검증 등)을 서술하는 **문서 전용** 추가. 이 diff 자체가 코드를 바꾸지 않는다.
2. `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `GET /api/executions/workflow/:workflowId` 의 죽은(no-op) 쿼리 파라미터 `workflowId` 와 그 `@IsOptional()/@IsUUID()/@Transform` 데코레이터를 제거.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — repo-guard 판정 로직 자체는 불변, JSDoc 주석만 갱신(`@Transform` 예외의 실사례가 0건이 됐다는 재실측 기록).
4. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 계획 문서 체크박스/서술 갱신. 실행 코드 없음.

즉 이번 diff 에서 **실행되는 코드가 바뀌는 지점은 파일 2 하나**이고, 그마저도 기능 축소(dead filter 제거)다.

## 발견사항

- **[INFO]** `QueryExecutionDto.workflowId` 제거는 보안 관점에서 중립~긍정적
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (diff 게이트 1~15, `workflowId` 필드 삭제는 원본 파일 기준 삭제된 줄이라 게이트 없음)
  - 상세: 제거된 필드는 `findByWorkflow` 서비스 로직이 애초에 구조분해하지 않던 값이라 SQL 인젝션 등 인젝션 표면과 무관했다. `@IsUUID()` 검증이 있었으므로 형식 공격면도 원래 없었다. 필드 자체를 없애면서 검증 로직도 함께 사라지지만, 그 검증이 지키던 실질적 자원(쿼리 실행 로직)이 애초에 그 값을 참조하지 않았으므로 회귀 위험은 없다. `forbidNonWhitelisted: true` 글로벌 파이프 덕에 미지 파라미터는 자동으로 400 거부된다.
  - 제안: 없음(변경 자체가 이미 안전한 방향).

- **[INFO]** CHANGELOG.md 에 기재된 예시 자격증명 문자열은 전부 명백한 플레이스홀더
  - 위치: `CHANGELOG.md` (예: 게이트 706 `Bearer sk-live-…`, 게이트 803 `postgres://user:pw@host/db`)
  - 상세: `sk-live-ABC`, `postgres://user:pw@host/db`, `Bearer eyJ…` 등은 마스킹 동작을 설명하기 위한 예시이며 실제 발급된 키·토큰이 아니다. 하드코딩된 시크릿에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 순수 문서(JSDoc) 갱신
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:100-121` (게이트 기준)
  - 상세: `findSwaggerContractMismatches` 함수 로직·AST 순회·판정 조건은 diff 전후 동일하다. `@Transform` 예외를 적용하는 조건(`!decorators.some((d) => d.name === 'Transform')`, 게이트 166)도 불변이다. 이 가드는 실행 시점 보안 통제가 아니라 OpenAPI 문서와 TS 타입의 정합성을 검사하는 정적 분석 도구이므로 이번 diff 로 인한 보안 영향은 없다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 계획 문서, 코드 아님
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 체크박스 플립과 실측 근거 서술만 있고 실행되는 코드나 스키마 변경이 없다.
  - 제안: 없음.

## 점검 관점별 결과 (해당 diff 범위 내)

1. 인젝션(SQL/XSS/커맨드/경로탐색): 해당 없음 — 신규 입력 처리 로직 없음, 오히려 미사용 입력 필드 제거.
2. 하드코딩된 시크릿: 발견 없음(CHANGELOG 의 예시 문자열은 명백한 플레이스홀더).
3. 인증/인가: 변경 없음.
4. 입력 검증: `@IsUUID()` 검증 대상 필드를 아예 제거했으므로 그 축은 사라지지만, 서비스 로직이 원래 그 값을 소비하지 않았으므로 실질 위험 변화 없음.
5. OWASP Top 10: 해당 사항 없음.
6. 암호화: 변경 없음.
7. 에러 처리: 변경 없음(문서만 서술).
8. 의존성 보안: 신규/변경 의존성 없음.

CHANGELOG.md 가 서술하는 과거 변경들(자격증명 값-패턴 마스킹 확대, 아바타 업로드 공개 버킷 UUID 키 설계, WS 소켓 토큰 재검증, 마스킹 마커 재제출 차단 등)은 이미 별도 커밋으로 구현·리뷰된 것이며 이번 diff 의 코드 범위에 포함되지 않는다. 다만 문서를 훑은 결과 보안 설계 자체에 새로 도입된 결함 서술은 없었고, 오히려 여러 항목이 실제 유출 결함을 닫은 기록(egress 마스킹 chokepoint 통합, allowlist 전환 등)이다.

## 요약

이번 diff 의 실질 코드 변경은 사용되지 않던 UUID 쿼리 파라미터 하나를 제거한 것이 전부이며, 이는 검증 로직과 함께 삭제됐지만 애초에 그 값을 소비하는 로직이 없었으므로 보안상 회귀가 없다. 나머지 파일(CHANGELOG.md, 리포 가드의 JSDoc, in-progress 계획 문서)은 실행되지 않는 문서/주석 변경으로, 하드코딩된 시크릿·인젝션·인증 우회·안전하지 않은 암호화 등 어떤 취약점도 발견되지 않았다. CHANGELOG 에 기재된 과거 보안 개선 이력도 이번 diff 범위 밖이며 검토한 한도에서 특이사항이 없다.

## 위험도

NONE

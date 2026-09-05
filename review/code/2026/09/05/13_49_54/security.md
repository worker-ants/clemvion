# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/src/shared/testing/response-contract.ts` (신규, 195줄) — §5.4 응답 vs DTO 선언 대조 헬퍼
- `codebase/backend/src/shared/testing/response-contract.spec.ts` (신규, 181줄) — 위 헬퍼의 단위 테스트
- `codebase/backend/test/audit-logs.e2e-spec.ts`, `session-revocation.e2e-spec.ts`, `workflow-crud.e2e-spec.ts`, `workflow-execution.e2e-spec.ts` — 기존 e2e 스펙에 `assertMatchesDtoSchema` 배선 추가 (각 12~15줄)
- `plan/in-progress/*.md`, `review/consistency/2026/09/05/12_48_13/**` — plan 갱신 및 이전 consistency-check 라운드 산출물 (텍스트/JSON 문서, 실행 코드 아님)

테스트·문서 위주의 변경이라 보안 표면이 매우 좁다. 아래는 8개 관점을 각각 적용한 결과다.

## 발견사항

(없음)

검토한 8개 관점 중 어느 것도 이번 변경에서 위반을 찾지 못했다. 근거:

1. **인젝션 취약점** — 새로 추가된 e2e 코드가 DB에 접근하는 자리(`audit-logs.e2e-spec.ts`의 `INSERT INTO audit_log`, `session-revocation.e2e-spec.ts`의 `SELECT u.email ... JOIN refresh_token`)는 모두 `$1`/`$2` 파라미터 바인딩을 쓴다 — 문자열 결합 SQL 없음. `response-contract.ts` 는 HTTP 요청이나 쉘 명령을 다루지 않고, 순수하게 메모리 안의 `payload`/`schema` 객체를 대조하는 로직이라 인젝션 표면 자체가 없다.
2. **하드코딩된 시크릿** — diff 안에 API 키·비밀번호·토큰 리터럴 없음. `assertMatchesDtoSchema` 호출부가 참조하는 `TEST_PASSWORD` 는 이번 diff 밖(`test/helpers/auth.ts`, 기존 파일)의 테스트 전용 상수이고 실제 운영 자격증명이 아니다.
3. **인증/인가** — 이번 변경은 기존 e2e 스펙의 "응답 200 이후" 지점에 스키마 대조 한 줄을 추가할 뿐, 인증/인가 분기(403/404 검증 등 IDOR·RBAC 테스트)는 그대로 유지된다. 새 헬퍼 자체는 권한 검사 로직에 관여하지 않는다.
4. **입력 검증** — `findContractViolations` 의 `payload` 는 테스트 코드 안에서 이미 200 OK 로 받은 자기 서버 응답이며, 외부 신뢰 경계를 넘는 사용자 입력이 아니다. non-object 가드(`payload === null || typeof payload !== 'object'`)로 방어적으로 처리한다.
5. **OWASP Top 10** — 해당 범주에서 걸리는 패턴 없음(테스트 전용 코드, 프로덕션 런타임 미포함).
6. **암호화** — 해시/암호화 알고리즘을 다루는 코드 변경 없음.
7. **에러 처리** — `formatViolations`/`assertMatchesDtoSchema` 가 던지는 에러 메시지에는 필드명·위반 종류·DTO 이름만 담기고, 비밀번호·토큰·DB 커넥션 문자열 등 민감정보는 포함되지 않는다. 이 코드는 프로덕션에 배포되지 않으므로(아래 8번) 사용자에게 노출될 경로도 없다.
8. **의존성 보안** — 새 의존성 추가 없음. `response-contract.ts` 가 간접 사용하는 `@nestjs/testing`(devDependency)은 `tsconfig.build.json` 의 `exclude: ["src/shared/testing/**"]` 로 이미 프로덕션 `dist` 번들에서 명시적으로 제외되어 있음을 확인했다(주석: "같은 이유의 두 번째 자리" — `src/repo-guards/**` 오염 사고 이후 재발 방지 조치). 즉 devDependency 가 프로덕션 설치에 새어 나갈 위험이 없다.

`plan/`·`review/` 하위 markdown/JSON 변경은 이전 라운드 산출물 기록·plan 갱신이며 실행되는 코드가 아니고, 시크릿·자격증명·민감 인프라 정보를 담고 있지 않다.

## 요약

이번 변경은 신규 테스트 전용 헬퍼(`response-contract.ts`/`.spec.ts`)와 그것을 배선한 4개 e2e 스펙, 그리고 plan/consistency 문서 갱신으로 구성된다. 신규 코드는 프로덕션 빌드에서 제외되도록 이미 안전장치(`tsconfig.build.json` exclude)가 되어 있고, DB 접근은 전부 파라미터 바인딩을 쓰며, 하드코딩된 시크릿·인증 우회·안전하지 않은 암호화·민감정보 노출 등 8개 관점 어디에서도 위반을 발견하지 못했다.

## 위험도

NONE

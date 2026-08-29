# Security Review

## 발견사항

- **[INFO]** `deleteByPrefix` 의 LIKE 인젝션 방어는 정상 동작 확인, 변경 없음
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:182`~`200` (`deleteByPrefix`)
  - 상세: 이번 diff 는 이 파일에서 주석 한 문장(`형제 3곳` → `형제 4곳`)만 바꿨다(파일 3, 게이트 92~94줄). `deleteByPrefix` 의 실제 방어 로직(prefix 는 `secret://` 로 시작해야 하고 `%`/`_`/`\` 를 거부, TypeORM 파라미터 바인딩으로 실행)은 이번 변경으로 건드리지 않았고, 다시 읽어봐도 SQL/LIKE 인젝션·과잉 삭제 방어가 여전히 유효하다. 회귀 아님 — 참고로만 기록.

- **[INFO]** 신규 `redis-fail-open-catalog-guard.ts`/`.spec.ts` 는 저장소 루트 기준 하드코딩 상수 경로만 읽어 경로 탐색 표면이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:31`~`89` (`readUnionMembers`, `readCatalogComponents`), `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts` (`withPatchedSpec`)
  - 상세: `UNION_SOURCE`/`CATALOG_SPEC` 이 리터럴 상수이고 사용자 입력이 개입하지 않는다. `withPatchedSpec` 은 `fs.mkdtempSync(os.tmpdir())` 로 만든 임시 디렉터리에만 쓰고 `finally` 로 정리한다 — 저장소 트리를 뮤테이션하지 않는 규약을 준수. 테스트/CI 전용 코드라 공격 표면 아님.

- **[INFO]** `http-exception.filter.spec.ts` 신규 `cause` 비노출 테스트는 실제 필터 구현과 부합함을 직접 대조 확인
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (`describe('\`cause\` 비노출 불변식 (계측 지점)')`, 게이트 226~377줄) — 대응 구현은 `codebase/backend/src/common/filters/http-exception.filter.ts` 의 `catch()` (본 diff 대상 아님)
  - 상세: `catch()` 는 응답 봉투를 `{ code, message, requestId, ...(details ? {details} : {}) }` 로만 구성하고 `exception`/`cause` 를 스프레드하지 않는다 — 신규 테스트(닫힌 키 집합 단언, `JSON.stringify` 전체 검사, vacuity 방지 fixture)가 이 불변식을 정확히 검증한다. 하드코딩된 것으로 보이는 `CAUSE_MARKER = 'SENSITIVE-CAUSE-DETAIL-a1b2c3'` 는 실제 시크릿이 아니라 유출 여부를 관측하기 위한 합성 마커다 — 오탐 방지 차원에서 명시.

## 요약

이번 변경 세트는 실질적으로 프로덕션 런타임 코드를 거의 건드리지 않는다 — `secret-resolver.service.ts`·`expression-resolver.service.spec.ts`·`code.handler.spec.ts`·`error-shape.spec.ts` 는 전부 주석/근거 서술 정리(정본 위치 재지정)이고, 유일한 실질 로직 추가는 (1) `http-exception.filter.spec.ts` 에 추가된 `cause` 비노출 회귀 테스트 9건과 (2) 신규 `redis-fail-open-catalog-guard.ts`/`.spec.ts`(관측성 메트릭 라벨의 코드·spec·실배선 3자 정합 가드)이며, 둘 다 테스트/가드 코드로서 기존 프로덕션 코드의 보안 불변식(에러 응답에 `cause` 미노출, LIKE 메타문자 거부)을 강화하는 방향이다. 인젝션·인증/인가·시크릿 하드코딩·안전하지 않은 암호화·민감정보 노출 등 OWASP Top 10 관점에서 새로 도입된 취약점은 발견되지 않았다. `secret-resolver.service.ts` 의 `deleteByPrefix` LIKE 인젝션 방어와 `GlobalExceptionFilter` 의 CWE-209 방어(내부 메시지 미echo)를 직접 대조 확인했고 모두 이번 diff 로 인한 회귀가 없다. 테스트 fixture 의 `CAUSE_MARKER`·가짜 SQL 문자열은 유출 탐지용 합성 데이터이며 실제 시크릿이 아니다.

## 위험도

NONE

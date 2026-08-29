# 보안(Security) Review

## 발견사항

- **[INFO]** `secret-resolver.service.ts` 의 `deleteByPrefix` LIKE 인젝션 방어는 이번 diff 로 변경되지 않았고 여전히 유효하다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (게이트 93~94줄, "형제 3곳" → "형제 4곳" 주석 정정만)
  - 상세: 이 diff 가 이 파일에서 건드린 것은 주석 한 문장뿐이다. `deleteByPrefix` 의 실제 방어(prefix 는 `secret://` 로 시작 강제, `%`/`_`/`\` 거부, TypeORM 파라미터 바인딩)는 diff 범위 밖이며 변경되지 않았다. 회귀 없음 — 참고 기록.

- **[INFO]** 신규 `redis-fail-open-catalog-guard.ts`/`.spec.ts` 는 사용자 입력이 개입하지 않는 하드코딩 상수 경로만 읽어 경로 탐색(path traversal) 표면이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` 의 `readUnionMembers`(31행 함수 선언부)·`readCatalogComponents`(66행 함수 선언부), `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts` 의 `withPatchedSpec`(71행 함수 선언부)
  - 상세: `UNION_SOURCE`/`CATALOG_SPEC` 은 파일 상단에 선언된 리터럴 상수이며 외부 입력으로 대체되지 않는다. `withPatchedSpec` 는 `fs.mkdtempSync(os.tmpdir())` 로 만든 임시 디렉터리에만 쓰고 `finally` 로 삭제한다 — 저장소 원본을 뮤테이션하지 않는다. 정규식 대신 TypeScript AST(`ts.createSourceFile`)로 파싱해 주석/문자열 리터럴 오인식을 피한 점도 안전한 설계다. CI/테스트 전용 코드로 외부 공격 표면이 아니다.

- **[INFO]** `http-exception.filter.spec.ts` 신규 `cause` 비노출 테스트는 CWE-209(민감 정보의 에러 메시지 노출) 회귀를 정확히 겨냥하며, 실제 필터 구현과 일치를 대조 확인했다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (`describe('\`cause\` 비노출 불변식 (계측 지점)')`, 게이트 226~382줄); 대응 프로덕션 구현은 `GlobalExceptionFilter.catch()`(본 diff 대상 아님, 응답 봉투를 `{code, message, requestId, ...(details?{details}:{})}` 로만 구성하고 `exception`/`cause` 를 스프레드하지 않음)
  - 상세: 신규 테스트는 (1) 닫힌 키 집합 단언(`Object.keys(...).sort()`), (2) 봉투 전체 `JSON.stringify` 에 대해 값 누출 마커 부재 단언, (3) fixture 자체가 유출 시 마커를 노출하는 형태인지 확인하는 vacuity 방지 테스트로 구성돼 견고하다. `CAUSE_MARKER = 'SENSITIVE-CAUSE-DETAIL-a1b2c3'` 는 실제 시크릿이 아니라 유출 관측용 합성 마커다(오탐 방지 차원에서 명시). 다만 이 WARNING("QueryFailedError(23505) 분기에 값 누출 부재 단언이 빠짐")은 같은 PR 내 선행 리뷰 라운드(`review/code/2026/08/29/19_17_28`)에서 이미 지적됐고, `RESOLUTION.md`/커밋 `4dbc6ee39` 로 4개 분기 전부에 `not.toContain(CAUSE_MARKER)` 를 추가해 해소됐음을 diff 상 확인했다(현재 코드는 게이트 367행 `expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER);` 로 4개 분기 공유 바디에 이미 반영된 상태). 재발 아님, 참고로만 기록.

- **[INFO]** 테스트 fixture 의 합성 문자열(`ECONNREFUSED ... at /srv/app/secret.ts:42`, `SELECT * FROM secrets -- ...`)은 실제 시크릿·자격 증명이 아니라 유출 탐지용 더미 값이다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` `sensitiveCause()` (게이트 243~248줄)
  - 상세: 파일 경로·SQL 문자열 모두 하드코딩된 테스트 전용 더미이며 실제 인프라 정보나 자격 증명을 포함하지 않는다. 하드코딩된 시크릿에 해당하지 않는다.

## 확인한 사항 (문제 없음)

- 이번 diff 전체(코드 7개 파일 + plan/review 문서 25개)에 대해 `eval`, `child_process`, `exec(Sync)`, `dangerouslySetInnerHTML`/`innerHTML`, `new Function`, SQL 문자열 결합, 하드코딩된 API 키/비밀번호/토큰/인증서 패턴을 전수 grep 했고 해당 없음을 확인했다.
- 프로덕션 런타임 코드 변경은 `secret-resolver.service.ts` 의 주석 한 줄뿐이며, `expression-resolver.service.spec.ts`/`code.handler.spec.ts`/`error-shape.spec.ts` 는 전부 주석(근거 정본화) 정리로 테스트 로직·단언 자체는 불변이다.
- 신규 프로덕션 소스는 `redis-fail-open-catalog-guard.ts` 하나이며, 이는 `src/repo-guards/__tests__/` 하위의 **가드/테스트 헬퍼**(빌드 산출물에 배포되지 않는 CI 전용 코드)로, 외부 공격 표면과 무관하다.
- 인증/인가 로직, 세션 관리, 암호화/해시 알고리즘, 네트워크 전송 방식과 관련된 코드는 이번 diff 에서 전혀 변경되지 않았다.
- plan/review 문서(파일 8~32)는 서술·정량 기록·이전 라운드 산출물이며 실행 코드가 아니다. 여기에도 실제 시크릿·자격 증명·내부 인프라 세부 정보 노출은 없다(검색 결과 매칭은 전부 테스트 마커·SQL fixture·주제어 언급뿐).

## 요약

이번 변경 세트는 프로덕션 런타임 로직을 거의 건드리지 않는다 — 유일한 프로덕션 코드 수정은 `secret-resolver.service.ts` 의 주석 한 문장 정정이며, `deleteByPrefix` 의 LIKE 인젝션 방어 로직은 그대로다. 신규로 추가된 실질 코드는 (1) `GlobalExceptionFilter` 의 CWE-209(에러 응답을 통한 민감정보 노출) 방지 불변식을 고정하는 회귀 테스트와, (2) 관측성 메트릭 라벨의 코드·spec·실배선 3자 정합을 검증하는 CI 전용 AST 가드뿐이며, 둘 다 하드코딩 상수 경로만 다루고 사용자 입력을 처리하지 않아 새로운 공격 표면을 만들지 않는다. 나머지는 주석 정본화와 plan/review 문서 갱신이다. 인젝션·하드코딩된 시크릿·인증/인가 우회·암호화 약화·에러 메시지를 통한 정보 노출 관점에서 이번 diff 로 새로 도입된 취약점은 없으며, 오히려 기존 정보 노출 방지 불변식(cause 비노출)의 테스트 커버리지를 강화하는 방향이다.

## 위험도

NONE

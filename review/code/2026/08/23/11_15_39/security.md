# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/test/terminal-duration-sql.e2e-spec.ts` — 신규 e2e 테스트 (`TERMINAL_DURATION_MS_SQL` 을 실제 Postgres 에서 값으로 검증)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 트래커 체크박스 flip + 해소 근거 기록 (문서만)
- `plan/in-progress/terminal-duration-sql-safety-net.md` — 신규 작업 plan 문서
- `review/consistency/2026/08/23/10_48_33/*` (SUMMARY.md, meta.json, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`) — 사전 `/consistency-check` 실행이 남긴 자동 생성 리포트 산출물

실질적인 애플리케이션 코드 변경은 신규 e2e 테스트 파일 1개뿐이며, 나머지는 plan 문서·자동 생성 리뷰 산출물이다.

## 발견사항

발견된 보안 이슈 없음.

### 검토 근거 (참고)

- **SQL 인젝션 관점**: `terminal-duration-sql.e2e-spec.ts` 의 `durationMs()`(전체 파일 컨텍스트 기준 77~89행)와 `column()`(130~138행)은 모두 `pg` 의 파라미터 바인딩(`$1`, `$2`)을 사용한다. 유일하게 문자열 템플릿에 직접 삽입되는 값은 `toPgSql()`(56~62행)이 반환하는 `TERMINAL_DURATION_MS_SQL` 이며, 이는 프로덕션 코드(`src/shared/utils/terminal-duration`)의 **정본 상수**를 이름 있는 파라미터만 치환해 그대로 가져온 것이지 외부/사용자 입력이 아니다. `entityTable()`/`entityColumn()`(20~34행)도 TypeORM 메타데이터에서 유도되는 정적 값으로 사용자 입력 경로가 없다. 테스트가 프로덕션 SQL 재작성 없이 그대로 태우는 설계 의도(주석 49~52행)와도 일치하며, 인젝션 벡터로 볼 수 없다.
- **하드코딩된 시크릿**: 이번 diff 범위 내에 자격증명·API 키·토큰 등이 새로 하드코딩된 곳은 없다. (`createDbClient()` 가 참조하는 `test/helpers/db.ts` 의 e2e 전용 기본 DB 자격증명은 이번 변경에 포함되지 않은 기존 파일이라 리뷰 범위 밖.)
- **인증/인가**: 해당 없음 — 신규 코드는 CI/로컬에서만 실행되는 e2e 테스트이며 프로덕션 인증/인가 경로를 건드리지 않는다.
- **에러 처리/정보 노출**: `throw new Error(...)` 메시지(22, 32행)는 테스트 실패 시 콘솔에만 노출되는 개발자용 진단 문구로, 민감 정보를 포함하지 않는다.
- **plan/review 문서 변경**: 코드가 아닌 서술 변경으로, 시크릿 패턴·레닥션 관련 과거 결정을 인용하는 문구(`SECRET_LEAK_PATTERNS`, `deepRedactSecrets` 등)가 있으나 모두 기존(변경 전) 파일 컨텍스트이며 이번 diff hunk 로 새로 추가된 내용이 아니다. 실제 시크릿 값은 어디에도 없다.
- **의존성 보안**: 신규 의존성 추가 없음 (`pg`, `typeorm`, `@jest/globals` 모두 기존 사용 라이브러리 재사용).

## 요약

이번 변경분의 실질 코드는 프로덕션 SQL 상수(`TERMINAL_DURATION_MS_SQL`)를 실제 Postgres에 태워 값 검증을 강화하는 신규 e2e 테스트 하나이며, 모든 동적 값이 `pg` 파라미터 바인딩을 통해 전달되고 나머지는 ORM 메타데이터에서 유도된 정적 값이라 인젝션 벡터가 없다. 그 외 변경은 plan 문서 갱신과 이전 `/consistency-check` 실행이 남긴 자동 생성 리뷰 산출물로, 보안 관점에서 실질적 영향이 없는 문서성 변경이다. 하드코딩된 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화, 민감정보 노출 등 OWASP Top 10 관련 이슈는 발견되지 않았다.

## 위험도

NONE

# 보안(Security) 코드 리뷰

## 검토 대상 요약

이번 diff 는 TypeORM 엔티티 `@Column` 데코레이터에 `type: 'uuid'` · `enumName` · `default` 메타데이터를 추가해 선언을 실제 DB 컬럼 정의와 맞추는 작업이다 (`alert-rule.entity.ts`, `edge.entity.ts`, `integration-usage-log.entity.ts`, `llm-usage-log.entity.ts`, `model-config.entity.ts`, `node.entity.ts`, `workflow-assistant-session.entity.ts`, `workspace-invitation.entity.ts`). 이 메타데이터는 `synchronize: false` 환경에서 TypeORM 스키마 비교기(`createSchemaBuilder().log()`)에만 쓰이며 쿼리 실행 경로(파라미터 바인딩, WHERE 절 생성)를 바꾸지 않는다 — pg 드라이버는 컬럼 타입 애너테이션과 무관하게 항상 파라미터화된 쿼리를 사용한다. 나머지 하나(`entity-schema-declarations.e2e-spec.ts`)는 이 정합성을 지키는 e2e 가드 테스트 추가이고, 그 외 파일(`plan/**`, `review/consistency/**`)은 코드가 아닌 문서 산출물이다.

## 발견사항

- **[INFO]** 신규 컬럼 층 가드가 신뢰하는 입력은 TypeORM 이 스스로 계산한 DDL 문자열(`log().upQueries`)뿐이고 사용자 입력이 개입하지 않는다.
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 신규 `it('컬럼 — TypeORM 스키마 비교기가...')` 블록, `COLUMN_LEVEL` 정규식 배열
  - 상세: 정규식 필터링과 `Map.has()` 비교만 수행하며 SQL 을 실제로 실행하지 않는(`log()`= 기록 전용) 테스트 전용 코드다. 인젝션·정보노출 표면 없음.
  - 제안: 조치 불요.

## 항목별 점검

1. **인젝션**: 해당 없음 — 변경분 전체가 정적 데코레이터 인자(문자열 리터럴 `'uuid'`, `enumName` 상수, 함수 리터럴 `() => 'now()'`)이며 사용자 입력이 SQL/쿼리 빌더에 새로 흘러드는 지점이 없다.
2. **하드코딩된 시크릿**: 없음. `model-config.entity.ts` 의 `apiKey` 컬럼은 이번 diff 로 만들어진 게 아니라 기존 선언(`type: 'varchar', nullable: true`)이 그대로이고, 이번 변경은 그 파일에서 `kind` 컬럼에 `default: 'chat'` 을 추가한 것뿐이다.
3. **인증/인가**: 영향 없음. `workspace-invitation.entity.ts` 의 `type: 'uuid'` 추가는 `workspaceId` 컬럼 하나이고 토큰 생성·검증·만료 로직은 diff 범위 밖(불변)이다.
4. **입력 검증**: 런타임 검증 로직 변경 없음. `type: 'uuid'` 는 애플리케이션 레이어에서 값의 UUID 형식을 강제하지 않는다(계획 문서에도 "스키마 비교에만 쓰인다"고 명시) — 이는 이번 변경으로 새로 생긴 갭이 아니라 기존과 동일한 상태 유지다.
5. **OWASP Top 10**: 해당 사항 발견되지 않음.
6. **암호화**: 관련 변경 없음.
7. **에러 처리**: 관련 변경 없음.
8. **의존성 보안**: 변경 없음(신규/변경 의존성 없음).

## 요약

이번 변경은 TypeORM 엔티티의 컬럼 메타데이터(타입 애너테이션·enum 이름·기본값)를 실제 DB 스키마와 일치시키는 선언 정정과, 그 정합성을 지키는 e2e 가드 테스트 추가로 구성되어 있다. 모든 변경이 스키마 비교(문서화) 목적의 정적 메타데이터이며 쿼리 실행·인증·인가·입력검증 로직에는 영향을 주지 않는다. 시크릿 하드코딩, 인젝션 표면, 에러 메시지 노출 등 OWASP 관점의 새로운 취약점은 발견되지 않았다.

## 위험도

NONE

# 데이터베이스(Database) 리뷰

## 검토 범위

이번 changeset(핵심 변경 파일 기준 약 25개, 나머지는 이전 리뷰 라운드/일관성 검토 산출물)을 전수 확인했다. 대상은 다음 세 갈래다.

1. LLM/통합 연결 테스트 응답 필드 정정 — `LlmService.testConnection`(`error`→`message` 리네임), `ModelTestConnectionResultDto`/`TestConnectionResultDto`(미발행 `latencyMs`/`meta` 제거, 실제 발행 중이던 `code` 필드 선언 추가)
2. `assertMatchesContract` 값-vs-선언 계약 검증 배선 (`integrations.service.spec.ts`, `llm.service.spec.ts`, `llm-model-config.controller.spec.ts`)
3. 유저 가이드(MDX) 에러 코드 서술 정정 + 신규 정적 가드(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`) + `CHANGELOG.md`/`plan/**`/이전 `review/**` 산출물

엔티티(`@Entity`), 리포지토리(TypeORM `Repository`/`QueryRunner`), 마이그레이션 파일, raw SQL 문자열, ORM 쿼리 빌더, 트랜잭션 경계, 커넥션 풀 설정 코드가 diff 안에 하나도 없다. 다음 키워드로 프롬프트 전체(3,429줄)를 훑었다.

```
grep -niE "migration|entity|repository|typeorm|query builder|transaction|\.query\(|SELECT |INSERT INTO|UPDATE |DELETE FROM|@Entity|@Column|dataSource|QueryRunner|pool\.|connection\."
```

매치는 두 종류뿐이었다 — (1) `import type { Integration } from './entities/integration.entity'`(타입 임포트, DB 접근 없음) 및 `mockClient.testConnection` 류(테스트 대상 메서드 이름이 우연히 "connection"을 포함), (2) 이전 리뷰 라운드(`10_12_19`~`11_33_23`)가 이미 작성해 둔 "DB 관련 코드 없음" 서술문 자체(재귀적 자기 인용). 실제 DB 코드 매치는 0건이다.

변경된 서비스 메서드(`LlmService.testConnection`, `IntegrationsService` 테스트)도 DB 쿼리를 호출하지 않는 순수 응답 형태(필드명·값) 변경이며, 신규 가드(`guide-error-code-scan.ts`)는 MDX 문자열을 정규식으로 스캔하는 상태 없는 순수 함수다.

## 발견사항

없음.

## 요약

이번 changeset 은 LLM/통합 연결 테스트 응답 DTO 의 필드명·값 정합성 수정과 유저 가이드 문서·정적 가드 정비로 구성되며, 엔티티·리포지토리·마이그레이션·raw SQL·트랜잭션·커넥션 풀 등 데이터베이스 관점의 점검 대상이 diff 안에 전혀 없다. 해당 없음.

## 위험도

NONE

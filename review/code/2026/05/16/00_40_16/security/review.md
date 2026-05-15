# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 파라미터화된 쿼리 사용 확인 — SQL 인젝션 방어 적절
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L237–248 (전체 파일 기준)
  - 상세: `this.dataSource.query(sql, [knowledgeBaseId])` 형태로 knowledgeBaseId 를 바인딩 파라미터 `$1` 에 전달하고 있다. TypeORM의 파라미터화 쿼리를 사용하므로 SQL 인젝션 공격 경로가 없다. 긍정적 패턴으로 기록.
  - 제안: 현행 유지. 추후 raw SQL을 추가할 때도 반드시 동일 패턴 유지.

- **[INFO]** knowledgeBaseId 입력 검증 부재 — 서비스 계층 위임 구조
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` `refresh(knowledgeBaseId: string)` 메서드
  - 상세: `knowledgeBaseId` 에 대한 형식 검증(UUID/ULID 등)이 helper 내부에 없다. 이 helper 는 내부 서비스 레이어에서만 호출되므로 직접적인 외부 공격 노출은 없다. 단, SQL 파라미터화 쿼리를 사용하므로 비정상 형식의 ID가 들어와도 SQL 인젝션 위험은 없고 단순히 `WHERE id = $1` 조건 불일치로 0건 업데이트가 발생한다.
  - 제안: 내부 helper이므로 즉각 수정 필수는 아니다. 다만, 상위 호출자(GraphExtractionService, GraphQueryService 등)에서 UUID/ULID 형식 검증 또는 NestJS의 `ParseUUIDPipe` 같은 ValidationPipe 를 적용하고 있는지 별도로 확인할 것을 권장한다.

- **[INFO]** 에러 전파 방식 — 내부 DB 에러가 상위로 그대로 전파
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` `refresh()` 전체, 및 spec 파일 `kb-stats.helper.spec.ts` L73–77 "propagates DB errors to the caller" 테스트
  - 상세: 이전 코드에는 WebSocket emit 부분에 `try { ... } catch { // best-effort }` 가 있어 내부 에러를 무시했으나, 변경 후 DB 쿼리 에러는 호출자에게 그대로 rethrow된다. DB 에러 객체에 스택 트레이스·쿼리 내용 등 민감 정보가 포함될 수 있으나, 이는 NestJS 글로벌 예외 필터(ExceptionFilter) 혹은 컨트롤러 계층에서 처리되어야 한다. helper 자체는 에러를 직접 HTTP 응답으로 내보내지 않으므로 직접적인 민감 정보 노출 경로는 없다.
  - 제안: 글로벌 예외 필터에서 TypeORM/DB 에러를 래핑해 스택 트레이스가 API 응답 body에 포함되지 않도록 하는지 확인할 것. 이미 적용되어 있다면 현행 유지.

- **[INFO]** 이전 코드에서 `as never` 강제 타입 캐스트 제거 — 보안 관련 타입 안전성 개선
  - 위치: `kb-stats.helper.ts` diff 의 삭제된 블록 (`'kb:graph_stats_updated' as never`)
  - 상세: 삭제 전 코드에서 TypeScript 타입 시스템을 `as never` 로 우회하는 패턴이 있었다. 이는 타입 안전성을 깨트려 잘못된 이벤트 타입이 런타임에 전달되는 경로를 허용했다. 해당 dead path 제거로 이 취약한 패턴이 함께 사라진 것은 긍정적 변화다.
  - 제안: 현행 제거 방향 유지. 추후 새 이벤트 타입을 추가할 때 `as never` 또는 `as any` 캐스트 없이 union 타입을 올바르게 확장할 것.

## 요약

이번 변경은 보안 관점에서 전반적으로 건전하다. 핵심 구현 파일(`kb-stats.helper.ts`)은 SQL 파라미터화 쿼리를 올바르게 사용해 SQL 인젝션 위험이 없으며, 하드코딩된 시크릿·인증 우회·암호화 문제도 해당 코드 범위에서 발견되지 않았다. 오히려 삭제된 코드(WebSocket dead path)에서 `as never` 타입 강제 캐스트가 제거됨으로써 타입 안전성이 개선되었다. 테스트 파일은 목(mock) DB만 사용하므로 시크릿 노출 위험이 없다. 미비한 점으로는 `knowledgeBaseId` 의 형식 검증이 helper 내부에 없다는 점이 있으나, 이는 상위 서비스 계층의 책임으로 위임되는 구조이며 파라미터화 쿼리로 SQL 인젝션은 차단된다. DB 에러 전파는 글로벌 예외 필터 적용 여부만 재확인하면 충분하다.

## 위험도

LOW

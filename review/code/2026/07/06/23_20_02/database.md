해당 없음, 위험도 NONE

본 변경(23개 파일: MCP client connect-timeout 분류, `mcp-error-codes.ts` 시크릿 redaction, `McpDiagnostics` 타입/누적기 확장, 관련 spec·plan·리뷰 문서)은 ORM/리포지토리/쿼리빌더/raw SQL/마이그레이션 등 데이터베이스 접근 코드를 포함하지 않는다. `mcpDiagnostics` 는 노드 실행 단위의 인메모리 누적기(`McpDiagnosticsAccumulator`)이며 최종적으로 `meta` 필드로 emit 될 뿐, 본 diff 범위 내에서 직접적인 DB read/write 호출은 없다.

STATUS=success ISSUES=0

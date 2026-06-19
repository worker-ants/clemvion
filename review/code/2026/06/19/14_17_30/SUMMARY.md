# 코드 리뷰 SUMMARY (fresh, post-resolution) — PR #633

BLOCK: NO

- 대상: `claude/agent-ae9a373e25190d9f9` (PR #633), `origin/main..HEAD` codebase/ diff 전체 (impl 1e573534 + fix 71c31793).
- 사유: resolution-applier 가 1차 review(14_03_38) FIX 후 코드를 추가 수정 → push guard 가 fresh review 요구. 본 세션이 그 fresh review.
- 리뷰어 6: database / api-contract / requirement / testing / side-effect / security.
- **Critical: 0**.

## Warning 통합 + 조치

| 리뷰어 | 등급 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| api-contract / side-effect | WARNING (수렴) | `integration-response.dto.ts` `IntegrationUsageItemDto` | `isActive` 필드가 DTO 에 아예 없어 OpenAPI 스키마 누락 (서비스·프론트는 사용) | FIX A — `@ApiProperty({ type: Boolean }) isActive: boolean` 추가 |
| testing | WARNING | `integration-usage-mcp.e2e-spec.ts` | 양쪽(direct+mcp) 매칭 노드 → 단일 'direct'(spec §7.1) 및 다중 mcpServers 비-0 인덱스 매칭이 e2e 미커버 | FIX B — e2e 케이스 C 추가 (실 PG @>/CASE 로 검증) |
| testing | WARNING | `integrations.service.spec.ts` getUsages | NotFoundException(cross-workspace 누출 방어) 단위테스트 부재 | FIX C — 단위테스트 추가 |
| side-effect | WARNING (LOW) | `remove()` | findOne + getUsages 내부 findById 이중 조회 | DEFER — 후속 plan ⑦ |
| database | INFO | `node.config` seq scan | GIN 인덱스 부재 | DEFER — 후속 plan ⑤ (회귀 아님) |
| requirement | WARNING (spec-drift) | `spec/2-navigation/4-integration.md` §7.1 / `_product-overview.md` INT-US-01 | spec 본문이 usageKind·MCP 경로를 아직 미반영 (코드가 옳음, spec 이 낡음) | DEFER — spec 갱신은 project-planner 영역. 후속 추적 |
| testing | INFO | 프론트 MCP 배지 렌더 테스트 부재 | usageKind==='mcp' 배지·i18n 키 테스트 없음 | 비차단 (저위험). 후속 권장 |
| database/security/side-effect | INFO | `:integrationId` 단일 named param 을 Brackets·CASE 양쪽 공유 | 현재 정상, 향후 리팩터 시 분리 권장 | 비차단 |

## security
- Critical/Warning 0. SQL 전부 파라미터 바인딩, workspace 스코프(`w.workspace_id`) 격리 유지. 시크릿 노출 없음.

## 결론
- Critical 0, Warning 6 중 **3건(isActive DTO, e2e §7.1/multi-mcp, getUsages NotFound 단위테스트) 즉시 FIX**, 나머지는 후속 plan(⑤⑦) 및 spec 갱신(project-planner)·저위험 INFO 로 이관.
- FIX 적용 후 backend tsc PASS, 단위 120/120 PASS, e2e 재실행 PASS (RESOLUTION.md 참조).

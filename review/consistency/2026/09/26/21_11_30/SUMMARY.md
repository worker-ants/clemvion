# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원이 전문을 반환했고, Critical 판정은 없다.

## 전체 위험도
**LOW** — 코드 변경(`TestConnectionResultDto` MCP 필드 3종 선언 + 계약 테스트 신설)은 이미 spec 이 문서화한 계약을 뒤늦게 따라잡는 순수 gap-closure. 유일하게 새로 발견된 실질 항목은 관련 트래커 plan 의 `spec_impact:` frontmatter 누락(WARNING)이며, 이는 이번 diff 의 코드 표면과 무관하다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없으므로 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 이 브랜치 첫 커밋이 `spec-draft-nullable-notation-followups.md` 에 신규 planner 항목(`INTEGRATION_TEST_FAILED` 상태코드/경로 불일치)을 등재하면서, 그 항목이 겨냥하는 두 spec 파일을 트래커 자신의 `spec_impact:` frontmatter 에 반영하지 않음 — 같은 트래커가 이미 3번 자백한 실패 모드의 4번째 재발 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (frontmatter `spec_impact:`, 본문 라인 3610-3619 신규 항목) | `spec/2-navigation/4-integration.md`, `spec/5-system/11-mcp-client.md` (두 파일 모두 목록·`pending_plans` 역참조 누락) | planner 턴에서 `spec_impact:` 에 두 파일 추가 + 필요 시 두 spec 파일 frontmatter `pending_plans` 에 이 트래커 역참조 |
| 2 | cross_spec, convention_compliance | `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드·발생 엔드포인트를 두 spec 문서가 다르게 서술 (실제 코드는 400·`:id/rotate` 단독, `:id/test` 는 이 코드를 던지지 않음 — 이번 PR 신설 wire 테스트가 실측으로 고정) — **pre-existing, 이번 PR 무관, 이미 planner 트래커에 처분안까지 등재 완료** | `spec/2-navigation/4-integration.md §9.4` ("422") | `spec/5-system/11-mcp-client.md §9` ("`:id/test` 후 갱신 … 400") | `plan/in-progress/spec-draft-nullable-notation-followups.md:3610` 의 기존 처분안(§9.4 를 400·`:id/rotate` 한정 정정, mcp-client §9 경로를 `:id/rotate` 로 정정)대로 별도 planner 턴에서 집행. **재중복 등재 금지** |
| 3 | convention_compliance | 신규 필드 `capabilities`/`serverInfo` 가 `swagger.md §1-4` 의 열린 map 명시 표기(`type: 'object'`)를 생략 — 기존 형제 `PreviewTestResultDto` 선언을 글자 그대로 미러링한 의도적 선택(뮤턴트 대조 테스트로 고정)이라 CRITICAL 아님 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` `TestConnectionResultDto.capabilities`/`.serverInfo` (및 사전 존재 형제 `PreviewTestResultDto` 동일 필드) | `spec/conventions/swagger.md §1-4` | 다음에 이 두 DTO 를 함께 건드릴 때 양쪽에 `type: 'object'` 추가(형제 패리티 테스트 통과 위해 동시 수정 필요) — 이번 PR 스코프 확장 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `serverInfo` 의 열린 OpenAPI 스키마(`additionalProperties:true`) vs 닫힌 TS 타입(`{name,version}`) 불일치가 형제 DTO 패턴을 신규 필드에도 복제 — `swagger.md §1-4` Rationale 이 경계하는 사고와 형태 유사하나 이미 `--impl-prep`·`/ai-review` 양쪽에서 인지·수용됨 | `integration-response.dto.ts:510-516` | 다음 터치 시 TS 타입을 넓히거나(`Record<string,unknown>`) Rationale 에 "SDK 확장 필드 수용 위해 연다" 명시 |
| 2 | convention_compliance | `capabilities`/`serverInfo` 의 `@ApiProperty.description` 이 영어 — `swagger.md §3` 한국어 톤 규약과 어긋남(형제 DTO 기존 패턴 복제, 이번 PR 신규 편차 아님) | 동일 필드 `description` 문자열 | 다음 터치 시 한국어로 통일 |
| 3 | convention_compliance | `POST /integrations/:id/test` `@ApiOperation` summary(9자)/description(40자)가 `swagger.md §3` 강제 하한(10~20자/50~150자) 미달 — 컨트롤러 17개 중 13개가 동일 패턴인 저장소 전반의 기존 상태, 자동 가드 없음, 이번 PR 신규 위반 아님 | `integrations.controller.ts` `testConnection()` | 규약 문서에 길이 규칙도 JSDoc 규칙처럼 소급 유예 문구 명시하거나, `swagger-dto-contract` 계열에 길이 가드 신설 검토(이번 PR 범위 아님) |
| 4 | naming_collision | 신규 테스트 파일 `integrations.controller.wire.spec.ts` — 로컬 `owner`/`wire` 관점별 파일 관례와는 정합, 백엔드 전역 컨벤션으로는 유일 사례 | `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts` | 조치 불요, 참고용 기록 |
| 5 | plan_coherence | 트래커 developer 소유 미결 두 항목(라인 3434, 3603)은 이번 diff 로 정확히 집행됐고, `[ ]` 로 남은 것은 `--impl-done` 통과 후 닫을 예정된 다음 단계 — 미해소 아님 | `plan/in-progress/integration-test-contract.md` 체크리스트, `spec-draft-nullable-notation-followups.md:3434,3603` | `--impl-done` 통과 후 같은 커밋에서 두 체크박스 + 트래커 두 항목 함께 닫기 |
| 6 | plan_coherence | `INTEGRATION_TEST_FAILED` 불일치를 developer 가 직접 spec 을 고치지 않고 planner 항목으로 등재한 처리는 역할 경계 준수 | `plan/in-progress/integration-test-contract.md` §`--impl-prep` 처분 WARNING 1 | 조치 불요 — 위 경고 #1 의 `spec_impact:` 보완과 함께 처리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/2-navigation/` 델타 0, DTO 가 기존 spec 문서화 계약을 뒤늦게 따라잡음. `INTEGRATION_TEST_FAILED` 상태코드 불일치는 pre-existing·이미 트래커 등재 |
| rationale_continuity | NONE | 기각된 대안(422/400) 재도입 없음, §1-4 원칙 준수, 예고된 후속(`spec-draft-nullable-notation-followups.md`)의 정상 집행 |
| convention_compliance | LOW | 응답 필드는 spec·swagger 규약 충족. `type:'object'` 생략·영어 description·ApiOperation 길이 미달은 모두 기존 형제 패턴 복제/전사적 기존 상태 |
| plan_coherence | LOW | diff 는 트래커 두 developer 항목의 정확한 집행. 단 신규 등재 항목의 `spec_impact:` frontmatter 갱신 누락(4번째 재발) 발견 |
| naming_collision | NONE | 신규 필드 3종·신규 테스트 파일 모두 기존 형제 선언/서비스 타입/spec 문서와 이름·의미 일치. 이질적 의미 충돌 없음 |

## 권장 조치사항
1. **(planner 턴)** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `spec_impact:` 에 `spec/2-navigation/4-integration.md`, `spec/5-system/11-mcp-client.md` 추가 — 같은 트래커가 이미 3번 자백한 실패 모드의 4번째 재발이므로 우선 처리 권장(비차단이나 방치 시 향후 `--spec`/`--impl-done` 번들이 두 파일을 조용히 누락).
2. **(별도 planner 턴, 이미 처분안 존재)** `spec/2-navigation/4-integration.md §9.4` 를 400·`:id/rotate` 한정으로, `spec/5-system/11-mcp-client.md §9` 의 경로 라벨을 `:id/rotate` 로 정정 — 재중복 등재 금지.
3. **(다음 DTO 터치 시)** `capabilities`/`serverInfo` 에 `type:'object'` 추가 + description 한국어 통일 (형제 `PreviewTestResultDto` 와 동시 수정).
4. **(이번 PR 마무리)** `--impl-done` 통과 후 `plan/in-progress/integration-test-contract.md` 체크리스트 두 줄 + `spec-draft-nullable-notation-followups.md` 라인 3434/3603 항목을 같은 커밋에서 닫기.
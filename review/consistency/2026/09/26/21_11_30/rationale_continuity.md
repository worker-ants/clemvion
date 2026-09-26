# Rationale 연속성 검토 — `spec/2-navigation/` (impl-done: `integration-test-contract`)

## 검토 범위 확인

`--impl-done` scope 는 `spec/2-navigation/` 이지만 이 브랜치의 spec 델타는 0개 파일이다(순수
`codebase/backend/**` 변경, `spec_impact: none`). 실제 diff(4파일/346줄)는 `POST /api/integrations/:id/test`
응답 DTO(`TestConnectionResultDto`)에 MCP 전용 필드 3종(`capabilities`·`serverInfo`·`preview`)을 선언하고,
서비스 축 계약 검증(`assertMatchesContract`) + 와이어 축(`integrations.controller.wire.spec.ts`)을 신설한 것이다.
프롬프트 번들이 `spec/2-navigation/4-integration.md` 등 다수 파일을 예산 절단했으므로, 아래는 HEAD 워킹트리를
절대경로로 직접 `Read`/`git diff`/`git log -S` 해 확인한 결과다 (`git -C
/Volumes/project/private/clemvion/.claude/worktrees/integration-test-contract diff origin/main...HEAD`).

## 대조한 과거 결정

- `spec/2-navigation/4-integration.md` `## Rationale` → `### 연결 테스트 endpoint 의 pending_install 가드 — 응답 형식`
  (200 + `{success:false, code}` 채택, `422`/`400` 명시적 기각)
- `spec/5-system/11-mcp-client.md` `## 9. 연결 테스트` — 성공 응답 필드 예시(`capabilities`·`serverInfo`·`preview.{toolCount,resourceSupported,promptSupported}`)
- `spec/conventions/swagger.md` `## Rationale` → `### §1-4 닫힌 union 을 additionalProperties 로 뭉개지 않는다`
- `spec/5-system/2-api-convention.md` §5.4 (부재 표현: 키 생략형 vs `nullable`)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 트래커 항목(MCP 필드 3종 미선언, 와이어 계약 검증 부재) — 이번 PR 이 닫으려는 대상 자체

## 발견사항

### INFO — `serverInfo` 열린 스키마 vs 닫힌 TS 타입 불일치가 신규 필드에도 복제됨
- target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:510-516`
  (`TestConnectionResultDto.serverInfo?: { name: string; version: string }` + `@ApiProperty({ additionalProperties: true })`)
- 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` § `#1-4 닫힌 union 을 additionalProperties 로 뭉개지 않는다` — "타입을 특정하기 번거롭다는 사유로 쓰지 않는다"
- 상세: TS 타입은 `name`/`version` 두 필드로 닫혀 있는데 OpenAPI 선언은 완전히 열린 맵(`additionalProperties: true`, `properties` 없음)이다. §1-4 Rationale 이 실제로 경계하는 사고(§1-4 자신이 인용하는 실증 사례 — `eia-types.ts` 가 wire 와 다른 타입을 선언했는데 아무 검증도 못 잡음)와 형태가 같다. 다만 이는 **이번 PR 이 새로 만든 결정이 아니라 형제 `PreviewTestResultDto.serverInfo`(같은 파일 234-282행 부근, 기존 코드)의 기존 선언을 "형제와 동일하게" 그대로 복제한 것**이다 — plan §방향-1 이 명시적으로 이 복제를 목표로 삼았고, `git log -S` 상으로도 `PreviewTestResultDto` 쪽 선언이 이번 PR 이전부터 존재했다. 코드 주석은 이유(SDK 가 `name`/`version` 밖의 키를 실을 수 있음)를 밝히고 있으나, 이 이유가 성립한다면 §1-4 정신상 TS 타입도 열려 있어야 계약이 "선언=실제" 로 일치한다.
- 제안: 이번 PR 을 막을 사유는 아니다(이미 `--impl-prep` INFO 2 및 `/ai-review` `api_contract.md` INFO 항목에서 인지·수용됨 — 새로 지적하는 결함이 아니라 재확인). 다음에 이 DTO 를 만질 기회에 `Record<string, unknown>` 등으로 TS 타입을 넓히거나, `## Rationale` 에 "형태는 부분 고정이나 SDK 확장 필드 수용을 위해 연다"는 문구를 명시해 §1-4 의 "번거로움" 예외와 구별해 두면 다음 리뷰 라운드에서 같은 관찰이 반복되지 않는다.

## 대조 결과 — 위반 없음을 확인한 항목

- **기각된 대안(422/400)의 재도입 없음**: 이번 diff 는 `:id/test` 의 응답 **형식**(200 + `{success, code, message}` 봉투)을 전혀 건드리지 않는다 — 새로 추가된 것은 성공 시 페이로드 필드 3종의 *선언*뿐이고, 실패 시 HTTP status 로직은 그대로다. `4-integration.md` Rationale 이 기각한 `422`/`400` 대안이 코드에 재도입된 흔적은 없다(`integrations.service.ts`·`integrations.controller.ts` diff 확인).
- **§9.4 vs Rationale 불일치는 이 PR 의 산물이 아니고, 재도입도 아니다**: `spec/2-navigation/4-integration.md §9.4`(`INTEGRATION_TEST_FAILED (422)`)와 위 Rationale(200 채택, 422/400 기각) 사이에 기존 spec 자기모순이 있고, `spec/5-system/11-mcp-client.md §9`도 `:id/test`와 `:id/rotate`를 혼동해 적었다. 이는 이번 PR 이전부터 있던 spec 자체의 결함이며, 이번 PR 의 개발자가 `git log -S`/실측으로 정확히 찾아내 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 실측 근거(원 커밋 SHA·재현 코드 경로)와 함께 planner 항목으로 등재했고(`spec_impact: none` 유지 근거로 기록), `--impl-prep` consistency check(WARNING 1, `20_32_24`)·`/ai-review`(`api_contract.md` INFO)에서도 동일하게 스코프 밖으로 처분됐다. "결정을 뒤집으면서 새 Rationale 없이 번복"하는 패턴이 아니라 반대로 — 뒤집지 않고 기존 Rationale 을 인용해 스코프를 지킨 모범 사례다.
- **합의된 설계 원칙(§1-4) 준수**: `capabilities`/`serverInfo`를 열린 맵으로, `preview`를 닫힌 `McpConnectionPreviewDto`로 선언한 것은 이미 존재하는 형제 `PreviewTestResultDto` 선언과 동형이며, "SDK 가 `name`/`version` 밖의 키를 실을 수 있다"는 근거는 §1-4 가 금지하는 "번거로움" 사유가 아니라 "실제로 키가 런타임 결정된다"는 주 사유에 해당한다.
- **spec 과의 일치**: `spec/2-navigation/4-integration.md §5.6`·`spec/5-system/11-mcp-client.md §9`가 이미 성공 응답에 `{capabilities, serverInfo, preview:{toolCount, resourceSupported, promptSupported}}`를 문서화하고 있고, 이번 diff는 그 문서화된 계약에 DTO·테스트를 사후 정합시키는 gap-closure다.
- **§5.4 부재 표현 규약 준수**: 신규 필드 3종 모두 `?`(키 생략형)이고 `| null`을 쓰지 않는다 — "다른 service_type 에서는 생략된다"는 present-when-available 패턴과 부합.
- **무근거 번복 없음**: 제거된 코드 주석("MCP 전용 필드도 미선언이지만 … 별도 등재 — `spec-draft-nullable-notation-followups.md`")은 예고했던 후속 작업 자체이며, 이번 PR 이 그 예고를 정확히 이행하고 트래커 항목도 함께 닫는다(`git diff` 확인) — 임의 번복이 아니라 예고된 후속의 정상 집행이다.
- **테스트 설계와 Rationale 의 상호 보강**: 서비스 spec 에 추가된 "[형제 대조]" 테스트가 `TestConnectionResultDto`/`PreviewTestResultDto` 선언의 구조적 동일성을 뮤테이션 테스트(M3·M9, 캐너리 추가 후 KILLED)로 강제해, §1-4 원칙이 향후에도 두 DTO 사이에서 다시 벌어지지 않도록 방어한다 — Rationale 을 코드로 고정하는 바람직한 방향.

## 요약

이번 PR 은 `spec/2-navigation/4-integration.md §5.6`·`spec/5-system/11-mcp-client.md §9`가 이미 문서화한 MCP 테스트
응답 계약에 DTO 선언·계약 검증·와이어 테스트를 사후 정합시키는 순수 gap-closure이며, `spec/conventions/swagger.md`
§1-4의 열린/닫힌 선언 기준과 형제 엔드포인트(`preview-test`) 선례를 그대로 따른다. `4-integration.md` Rationale이
명시적으로 기각한 `422`/`400` 대안은 코드에 재도입되지 않았고, 이 문서와 무관한 기존 spec 자기모순(§9.4 vs Rationale,
`:id/test`/`:id/rotate` 혼동)은 developer 가 실측으로 발견해 planner 트래커에 근거와 함께 정확히 등재했을 뿐 이 PR의
코드 표면과는 접점이 없다. 유일한 관찰(INFO)은 `serverInfo`의 "열린 OpenAPI 스키마 vs 닫힌 TS 타입" 불일치가 기존
형제 DTO 패턴을 의도적으로 복제하며 신규 필드에도 이어졌다는 점이며, 이는 `--impl-prep`·`/ai-review` 양쪽에서 이미
인지·수용된 사안으로 이번 검토에서 새로 발견된 결함이 아니다. Rationale 연속성 관점에서 차단 사유는 없다.

## 위험도

NONE

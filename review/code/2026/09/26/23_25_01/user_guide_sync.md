# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 변경 개요

- `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `GET /workflows/:id/export` 응답 `nodes`/`edges` 를 타입 없는 `Record<string, unknown>[]` 에서 응답 전용 DTO(`ExportedNodeDto` 10필드 · `ExportedEdgeDto` 6필드)로 광고.
- `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts` — 위 DTO 원소 선언을 고정하는 캔너리 확장.
- `codebase/backend/test/workflow-crud.e2e-spec.ts` — e2e C(복제본 export)를 `ExportWorkflowDto` 와 대조.
- `CHANGELOG.md` — 해당 변경 항목 추가.
- `plan/in-progress/export-workflow-typed.md` (신규) — 실측·방향·뮤턴트 표.

응답 자체(와이어 포맷)는 **변경되지 않았다** — 서버가 이미 이 10/6 필드를 내보내고 있었고, 이번 변경은 그 기존 필드를 OpenAPI 스키마에 타입으로 광고하는 것뿐이다(CHANGELOG 원문: "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다").

## 매트릭스 매칭

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 를 전수 대조한 결과:

- **`backend-api-change`** (id) — trigger glob `codebase/backend/src/**/dto/**` 에 `workflow-response.dto.ts` 가 매칭된다. targets: (1) "controller·DTO 의 swagger jsdoc", (2) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지".
- 그 외 행은 매칭되지 않는다 — `new-node`/`node-schema-change` 는 `codebase/backend/src/nodes/**` 글롭인데 이번 변경은 `modules/workflows/dto/**` 라 미매칭. `new-ui-string`/신규 섹션 디렉토리/통합 제공자/인증·세션/표현식 언어/실행·디버깅 흐름 트리거는 모두 무관.

## 발견사항

### [INFO] `backend-api-change` trigger 는 매칭되지만 두 target 모두 이 변경 set 안에서 충족되거나 해당 없음으로 판단됨

- 변경 파일: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`
- 매트릭스 항목: `backend-api-change` — targets: `"controller·DTO 의 swagger jsdoc"`, `"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"`
- 확인 내용:
  1. **swagger jsdoc** — 신설된 `ExportedNodeDto`/`ExportedEdgeDto` 의 모든 필드에 `@ApiProperty`/`@ApiPropertyOptional` + 필드별 JSDoc 주석이 이미 같은 커밋(`b39ddd802`)에 포함되어 있다. 충족.
  2. **user-guide 페이지 반영 필요 여부** — `codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx`(+`.en.mdx`) 가 JSON 내보내기/가져오기를 설명하는 유일한 유저 가이드 페이지인데, 필드 단위 스키마를 나열하지 않고 "워크플로우 이름·설명·태그·설정과 노드·연결선 구성이 담긴다" 수준으로만 서술한다. 이번 변경은 필드 추가/제거/이름 변경이 전혀 없는 **순수 타입 선언**이라 이 서술과 충돌하지 않는다. 또한 `spec/2-navigation/1-workflow-list.md` §3.2 는 이미 `containerIndex`/`toolOwnerIndex`/`sourceNodeIndex`/`targetNodeIndex` 등 index 기반 참조 필드명을 필드 레벨로 열거하고 있고, 이번 DTO 의 필드 이름과 정확히 일치한다(사전에 spec 이 SoT 로 앞서 있었고, 이번 PR 은 그 문서화된 계약을 타입으로 뒤따라간 것). 즉 spec·유저 가이드 어느 쪽도 갱신이 필요한 실질적 드리프트가 없다.
- 상세: 이 trigger 는 "API 노출 변경이 **사용자 안내에 영향**" 이라는 조건부 문구를 달고 있어 semantic 판단이 필요한 행이다. 판단 결과 사용자에게 노출되는 동작·필드 목록에 변화가 없으므로 target (2)는 이번 변경 set 에 대해 적용되지 않는다(누락이 아니라 애초에 불필요).
- 제안: 조치 불필요. 단, 향후 이 DTO 에 실제 필드 추가/제거/이름 변경이 생기면 그때는 `saving-and-sharing.mdx`(+`.en.mdx`) 및 `spec/2-navigation/1-workflow-list.md` §3.2 동반 갱신이 필요하다는 점을 이 판단의 전제로 남겨둔다.

### 그 외 trigger — 해당 없음

- i18n dict(`codebase/frontend/src/lib/i18n/dict/**`), `backend-labels.ts`, `SECTION_LABELS_BY_LOCALE`, 노드 신규/스키마 문서(`02-nodes/*.mdx`), 통합 제공자 문서(`06-integrations-and-config/*`), 표현식 언어 문서(`04-expression-language/*`), 실행·디버깅 문서(`05-run-and-debug/*`), 인증·세션 문서(`07-workspace-and-team/*`) — 이번 변경 set 에 프론트엔드 TSX·신규 노드·신규 provider·신규 warning/error code·auth 모듈·expression-engine 변경이 전혀 없어 어느 trigger 도 활성화되지 않는다.

### 참고 (범위 밖, 참고용)

plan(`plan/in-progress/export-workflow-typed.md`) 자체가 "관찰(이 PR 밖)" 절에서 `codebase/frontend/src/lib/api/workflows.ts` 의 `ExportedNode.description?: string` 타입이 실제 `null` 응답을 반영하지 않는다는 점을 이미 인지·추적하고 있다(소비처가 필드를 읽지 않아 동작 결함은 아님, INFO 로 등재). 이는 유저 가이드 동반 갱신 매트릭스의 어떤 trigger 에도 해당하지 않는 프론트엔드 타입 정확성 이슈이므로 본 리뷰의 판정에는 영향 없음 — 다만 이미 별도로 추적되고 있다는 점만 확인.

## 요약

매트릭스 21개 행 중 glob/semantic 매칭이 검토된 것은 `backend-api-change` 1건뿐이며(나머지는 노드·i18n·문서 섹션·통합·인증·표현식 트리거 전부 미매칭), 그 1건도 target 두 가지(swagger jsdoc·user-guide 페이지) 모두 같은 changeset 안에서 충족되었거나(jsdoc) 실질적으로 불필요함(user-guide — 응답 필드에 변화 없음, 기존 spec §3.2 와 필드명이 이미 일치)이 `Read`/`grep` 실측으로 확인됐다. 이 PR 은 이미 존재하던 와이어 포맷을 OpenAPI 스키마로 뒤늦게 광고하는 순수 타입 선언 변경이라 유저 가이드 동반 갱신 관점에서 실제 누락은 발견되지 않았다.

## 위험도

NONE

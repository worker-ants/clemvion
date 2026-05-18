# RESOLUTION

세션: `review/code/2026/05/19/07_49_43/`
대상: AI Timezone Context (Cafe24 MCP KST suffix + AI 노드 systemPrompt 자동 prefix)

## 조치 항목

### Warning

| ID | 조치 | Commit |
|---|---|---|
| W1 (architecture) | `buildSystemContextPrefixFromContext` 의 `config: Record<string, unknown>` → `SystemContextConfigFields` 인터페이스 (`includeSystemContext` / `systemContextSections` typed). `normalizeSystemContextConfig` 도 동일 적용. | 본 PR 후속 commit |
| W2 / W8 (requirement / documentation) | multi-turn 주석 정확화 — "첫 진입 시 prepend 결과가 `_resumeState.messages` 의 system role 메시지로 영속되어, 후속 turn (processMultiTurnMessage / endMultiTurnConversation) 은 systemPrompt 를 재빌드하지 않고 영속된 messages 를 재사용". `ai-agent.handler.ts` multi-turn 경로 + `information-extractor.handler.ts` multi-turn 경로 양쪽 갱신. | 동일 |
| W3 (side_effect) — silent behavior change | 본 PR 의 Rationale (`spec/4-nodes/3-ai/0-common.md §Rationale "기존 워크플로 점진 적용"`) 에 명시. config 부재 시 default 해석 정책으로 DB 마이그레이션 없이 자동 활성화. 회귀 우려 워크플로는 명시 `includeSystemContext: false` 로 opt-out. **추가 spec 변경 없음** — Rationale 본문 자체가 안내 채널. (PR 본문에 "기존 LLM 응답이 30 토큰 prefix 추가로 미세 변화 가능" 한 줄 보강 권장 — RESOLUTION 작성 시점에는 PR description 갱신 별도.) | n/a (spec Rationale 본문) |
| W4 (side_effect) | `ExecutionContext` 인터페이스 (`node-handler.interface.ts`) 의 `variables` 필드 JSDoc 에 `__workspaceId` / `__workspaceTimezone` 알려진 키 명시. spec/4-nodes/3-ai/0-common.md §11.3 SoT 의 timezone 복제값 임을 표기. | 동일 |
| W5 (maintainability) — schema 중복 | 3 schema 파일의 `includeSystemContext` / `systemContextSections` 블록 (~30줄 × 3) 헬퍼 추출은 향후 enhancement 로 보류. 본 PR 의 scope 우선 — 3곳 동기는 신규 변경 시 1회만 필요하고, 헬퍼 추출은 zod 스키마 + UI meta 의 양쪽 책임이라 즉시 적용 시 가독성 저하 가능. **후속 plan 으로 기록** (impl-ai-timezone-context.md). | 보류 (후속) |
| W6 (maintainability) — 언어 일관성 | cafe24 metadata description 영어 통일 (`'Cafe24 interprets naive ISO as KST.'`). `product.ts` / `customer.ts` 의 `Naive ISO 도 Cafe24 가 KST 로 해석` 한국어 부분 제거. | 동일 |
| W7 (testing) — false positive | `cafe24-mcp-tool-provider.spec.ts` 의 KST suffix 테스트에 `tools.find(name === 'mcp_<sid>__product_list')` 직접 조회 + 명시 `expect(productList).toBeDefined()` 가드 + suffix 위치 검증 (`lastIndexOf > indexOf('(Cafe24 ')`) 추가. 0-tool 회귀 시 false-pass 차단. | 동일 |
| W9 (api_contract) — 역직렬화 호환 | 3 schema 모두 `.passthrough()` 적용 확인. 신규 필드는 모두 `.default()` 보유 — zod safeParse 에서 부재 시 default 가 채워지므로 기존 row 자동 호환. **추가 변경 불요**. | 검증만 (변경 없음) |

### Info

| ID | 조치 |
|---|---|
| I8 — workspace name (unnamed) | 본 PR default 섹션 `['time','timezone']` 에서 workspace section 미사용. 사용자가 명시 `'workspace'` 활성화 시에만 노출되며, name 주입은 후속 enhancement (별도 ExecutionContext 채널). RESOLUTION 추적 항목으로만 기록. |
| I10 — `customer.ts` until 비대칭 | `customer.ts` 의 `until` 필드에 `'ISO8601 datetime (KST, UTC+9) — created_before. Cafe24 interprets naive ISO as KST.'` description 추가. since 와 대칭. |
| I14 — execution-engine spec timezone 케이스 | `findOne` mock 의 `workspace.settings` 가 `{}` 만 — Asia/Seoul 케이스 추가는 후속 enhancement. 현재 mock 으로도 `__workspaceTimezone` 빈 string 주입은 정상 검증. |
| I17 — `*전달하는` 오탈자 | `system-context-prefix.ts` 헤더 주석의 `*전달하는` → `* 전달하는` 으로 공백 추가. |
| I18 — `CAFE24_TIMEZONE_SUFFIX` JSDoc | 상수에 1줄 JSDoc 추가 — spec/conventions/cafe24-api-metadata.md §5.3 참조. |
| 기타 INFO 13건 | 보안 (내부 ID 노출 UI 경고), 성능 (`Intl.DateTimeFormat` 캐싱), 아키텍처 (constants 이동), 등 — 모두 본 PR scope 밖의 후속 enhancement. 향후 별 PR 로 처리. |

## TEST 결과

- **lint**: `cd codebase/backend && npm run lint` → 0 errors, 19 warnings (모두 기존 코드 — `@typescript-eslint/no-unsafe-*`). `cd codebase/frontend && npm run lint` → 0 errors.
- **unit**: backend 3967/3967 pass · frontend 1495/1495 pass.
- **build**: `nest build` OK · `next build` OK.
- **e2e**: `make e2e-test` → 16 test suites · **93/93 tests pass** (worktree 격리 compose project `clemvion-e2e-ai-timezone-context-9c8e2f` — 인프라 정상 stop · 볼륨 정리 완료).

## 보류·후속 항목

- **W5 schema 중복 헬퍼 추출** — `buildSystemContextSchemaFields(orderStart)` 공통 헬퍼. 본 PR scope 밖, 후속 plan 으로 기록 (impl-ai-timezone-context.md).
- **I1 / I4 / I5 / I6 / I7 / I12 / I13 / I15 / I16 / I19** — 모두 INFO 등급의 enhancement (성능 캐싱, 아키텍처 정리, 추가 테스트, 문서 보강 등). 본 PR scope 밖.
- **W3 silent behavior change 안내** — Rationale 본문에 점진 적용 정책 명시됨. 사용자 측 안내는 RELEASE NOTE 책임.

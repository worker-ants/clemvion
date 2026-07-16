# RESOLUTION — AI Agent config-time payload 경고 (ai-review 08_36_49)

리뷰 결과: 위험도 **MEDIUM**, Critical 0, Warning 7, INFO 8. 11 reviewer 실행(performance/dependency/database 는 router skip). Critical 없음 → 저장/조회 정확성은 견고. WARNING 은 성능·중복·문서 정합성 위주.

## 조치 항목

| SUMMARY # | 카테고리 | 처분 | 조치 내용 |
|---|---|---|---|
| W1 | 동시성/성능 | **fix** | (a) `saveCanvas` 는 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` off(기본) 시 평가 자체 skip — 도달 불가 차단 분기를 위한 매 저장 통합 조회 비용(dead path) 제거. (b) 통합 조회를 그래프 전체 integrationId 수집 후 `In()` **단일 배치**로 전환(노드 수 N+1 제거). (c) saveCanvas 경로는 `manager.getRepository(Integration)`(트랜잭션 매니저 스코프)로 조회해 추가 커넥션 미확보 → 커넥션 풀 기아/hang 리스크 해소. `AiAgentToolBudgetDeps.loadIntegration(id)` → `loadIntegrations(ids)→Map` 배치 인터페이스로 변경, batch load try/catch 로 best-effort 유지. |
| W3 | 유지보수성 | **fix** | `pickCulpritProvider`·`buildBudgetExceededPrefix`(subject 파라미터 추가로 노드 라벨 주입)를 `tool-payload-budget.ts` 에서 export → `tool-payload-save-warning.ts` 가 재사용(로컬 `pickCulprit`·메시지 템플릿 복제 제거). |
| W5 | 문서화 | **fix** | 존재하지 않는 파일명 `config-time-tool-budget.ts` 참조 4곳(cafe24/makeshop provider 주석)을 실제 파일명 `tool-payload-save-warning.ts` 로 정정. |
| W6 | 문서화 | **fix** | 신규 env `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=false` 를 `codebase/backend/.env.example` 에 설명과 함께 등재(선행 3종과 동일 블록). |
| W7 | 문서화 | **fix** | `CHANGELOG.md` 최상단에 config-time 저장 경고 Unreleased 섹션 추가(신규 rule·응답 append·strict-save env). 선행 런타임 가드레일 섹션이 "후속 본 PR 범위 밖"으로 예고한 항목의 반영. |
| INFO#3 | 문서화/API계약 | **fix(부분)** | `getGraphWarnings` JSDoc 에 workspaceId 파라미터·tool-payload append 설명 보강. |
| INFO#6 | 동시성 | **fix** | eval docstring "결정적" 문구를 배치 단일 쿼리 스냅샷 근거로 정정(노드 간 시간차 불일치 없음, row 갱신에 대한 완전 원자성은 아닌 advisory 성격 명시). |

## 보류·후속 항목 (수용 — 코드 변경 없음, 근거 기록)

| SUMMARY # | 처분 | 근거 |
|---|---|---|
| W2 (WorkflowsService 가 IntegrationsService 우회) | **수용** | `IntegrationsModule→NotificationsModule→WebsocketModule→WorkflowsModule` 순환 회피를 위한 의도적 repository 직접 주입. 복제 로직은 `find(In)` + `isUnreadableCredentials` 2줄뿐이라 drift 위험 낮음. 배치 로더에도 동일 unreadable 판정 유지. 향후 정책 변경 시 parity 회귀 테스트 추가는 별도 후속. |
| W4 (cafe24/makeshop JSON schema·allowlist 100% 중복) | **후속** | 두 provider 의 근원적 중복(본 PR 이전부터 존재)으로, 본 PR 은 이를 module-level pure 함수로 승격만 했다(신규 중복 도입 아님). 공유 `buildJsonSchemaFromFields`/`applyAllowlist` 추출은 별도 리팩터 범위 → followups plan 항목으로 명시. |
| INFO#1 (viewer 조회가 credentials 복호화 트리거) | **수용** | 응답에 credentials/scope 미노출(직접 유출 없음). 향후 evaluation 결과 필드 추가 시 credentials 미노출 회귀 테스트 추가 권고 기록. |
| INFO#2 (RenderToolProvider workspaceId:'' 재사용 drift) | **수용** | 현재 render buildTools 는 workspaceId 미사용(안전). drift 계약 테스트는 별도 후속. |
| INFO#4 (restoreVersion 이 신규 게이트 미우회) | **수용** | 기존 `evaluateGraphWarnings` 와 동일 패턴의 의도적 일관성. strict-save 운영 시 인지 사항. |
| INFO#5 (KO 템플릿 culprit 생략) | **수용** | KO 표시 간결성 위해 의도적 생략(영문 SoT message·params 에는 culprit 존재). |
| INFO#7 (rebase 커밋에 포맷 변경 혼재) | **수용** | 커밋 메시지에 "eslint --fix 포맷 정규화"로 투명 기술, 동작 영향 없음. |
| INFO#8 (params.culprit 이 sid 노출) | **수용** | 기존 런타임 도구명(`mcp_<sid>__op`)에서 이미 동일 노출 — 신규 누출 아님. |

## TEST 결과

조치 커밋: `refactor(ai-agent): ai-review 조치 …` (c8dbe05a5). 조치 후 TEST WORKFLOW 전 단계 재수행:

- **lint**: 통과 (0 errors; eslint --fix 로 신규 lockfile prettier 기준 정규화)
- **unit**: 통과 (영향 spec 208 tests 포함 전체 통과)
- **build**: 통과
- **e2e**: 통과 (256/256, 신규 `ai-agent-tool-payload-warning.e2e-spec.ts` 배치 조회 경로 재검증 포함)

## 사후 일관성 검토 (`/consistency-check --impl-done spec/4-nodes/3-ai/`)

**BLOCK: NO** (5/5 checker CRITICAL=0, session 09_13_49). convention_compliance WARNING 1건(신규 모듈이 `ai-agent.md` frontmatter `code:` 에 누락)은 **조치 완료**(추가). 나머지 INFO 는 pre-existing 문서 drift·절차 문구 수준으로 본 PR 범위 밖.

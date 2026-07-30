# Consistency Check 통합 보고서

**BLOCK: YES** — 서로 다른 영역에서 독립적으로 발견된 Critical 3건(RBAC 매트릭스 자기모순, `retry_last_turn` 원자성 불변식 위반, `Entity`/TypeORM 명명충돌)으로 인해 impl-prep 을 차단해야 합니다.

## 전체 위험도

**CRITICAL** — 5개 checker(Cross-Spec/Rationale Continuity/Convention Compliance/Plan Coherence/Naming Collision) 전원이 `success` 로 전문을 반환했고 출력 파일도 모두 디스크에 존재합니다(재시도 불요 — "재시도 필요" 항목 없음). 그중 3개 checker 가 서로 겹치지 않는 3개 영역에서 각각 독립적으로 Critical 위배를 보고했으며, 특히 이번 worktree(`retry-atomic-claim-4d9e77`)가 실제로 착수하려는 작업인 `retry_last_turn` 원자 claim 의 안전 불변식("동일 turn 이중 실행 0")이 spec 상 "전역적으로 유지된다"고 5곳에서 반복 단언되지만 실제 코드로는 깨져 있다는 사실이 Rationale Continuity·Plan Coherence 두 checker 에 의해 교차 확인됐습니다.

## 검토 커버리지 참고 (비차단, 신뢰도 관련 caveat)

prompt 조립 시 `spec/5-system/` 를 알파벳순으로 나열하다 컨텍스트 예산을 초과해 `1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md` 3개 파일만 전문이 포함되고, 정작 이번 실제 작업 대상인 `4-execution-engine.md`(알파벳순 뒤쪽)는 5개 checker 중 4개의 프롬프트에서 생략되었습니다. Rationale Continuity·Convention Compliance·Plan Coherence 3개 checker 는 이를 인지하고 브랜치명·`plan/in-progress/retry-turn-terminal-guard.md` 를 단서로 `4-execution-engine.md`·`node-cancellation.md`·실제 코드를 직접 Read/grep 해 보완했고, 그 결과로 이번 보고서의 Critical #2 가 발견됐습니다. Cross-Spec 과 Naming Collision 은 주어진 3개 파일 범위 내에서만 검토를 완결했습니다(각 checker 의 Critical 은 그 범위 내에서도 유효하나, `4-execution-engine.md` 관련 추가 위배가 더 있을 가능성은 두 checker 관점에서는 미확인 상태). 아울러 Naming Collision checker 는 프롬프트의 "생략된 파일" 목록 생성 로직에 파일 경로가 아닌 코드 식별자(`_selectedPort`, `integration_expired` 등)가 섞여 있음을 지적했습니다 — 스펙 문제는 아니나 향후 호출의 생략 파일 카운트 신뢰도에 영향을 줄 수 있어 별도 기록합니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | RBAC 매트릭스 "멤버 관리" 행에서 Admin 의 삭제 권한이 누락되어 같은 문서·타 문서·실제 코드와 정면 충돌 | `spec/5-system/1-auth.md` §3.2 L367 (Owner=CRUD, Admin=CRU → D 없음) | 동일문서 §3.1 L357(Admin 역할 서술="멤버 관리"가 핵심 권한); `spec/2-navigation/9-user-profile.md` §6.1 L358·§4.2 L235(Admin 삭제 가능 명시); `workspaces.service.ts` L682-720 `removeMember()`(실제로 Admin 허용, Owner 제한 없음) | L367 을 "Owner=CRUD, Admin=CRUD, Member=R, Viewer=R" 로 정정(별도 행인 "Admin 역할 부여"=Owner 전용은 그대로 유지) |
| 2 | Rationale Continuity, Plan Coherence (병합*) | `retry_last_turn` 재진입 경로가 spec 이 5곳에서 반복 단언하는 "동일 turn 이중 실행 0" 불변식을 실제로 충족하지 못함 — 자가 예고한 재검증 의무가 다른 기능(크래시 re-drive)의 재검증으로 잘못 대체되어 해소된 것처럼 방치되었고, 한 번 PASS 로 닫힌 판정이 이후 리팩터로 무효화된 사실도 어디에도 기록되지 않음 | `spec/5-system/4-execution-engine.md` §4.1 L425 각주, §7.4 L906/L914, §8 L1607/L1615, §Rationale L1354-1377; `plan/complete/exec-intake-queue-impl.md:57-65`(2026-06-06 PASS 판정); `plan/in-progress/retry-turn-terminal-guard.md`(P1, 5R CRITICAL 승격) | `continuation-execution.processor.ts` L83-86(retry_last_turn 을 원자 claim `claimResumeEntry` 대상에서 명시적 제외); `retry-turn.service.ts` L272-284 `applyRetryLastTurn`(조건부 UPDATE 아닌 단순 read-then-branch); `execution-continuation` 큐 jobId 가 매 enqueue 마다 유일해 BullMQ 레벨 dedup 도 안 됨 | (코드) W1/P1 원자 claim 구현은 §7.5 CAS 일반화 원칙과 부합하므로 방향 유지. (spec, 코드와 동반 필수) ① §4.1 L425 각주를 crash re-drive 항목이 아닌 `retry_last_turn` 전용 신규 Rationale 로 재연결 ② §7.4 L906/L914 갱신(신규 claim 위치 반영) ③ §8 L1607/L1615 각주 추가 ④ §7.5 대칭 신규 Rationale 항목 추가(spawn 단계 원자성만으론 불충분한 이유) ⑤ `plan/complete/exec-intake-queue-impl.md` 의 PASS 판정이 DI 리팩터(#638, 2026-06-19)로 무효화됐음을 번복 기록 + `retry-turn-terminal-guard.md` 위임목록에 위 spec 갱신 항목 등재 |
| 3 | Naming Collision | Graph RAG 의 `Entity`/`Relation`/`ChunkEntity` 타입명이 TypeORM `@Entity` 심볼과 이미 실제로 충돌 — 코드는 `Graph` 접두로 우회했으나 spec 은 그 사실을 반영하지 않음 | `spec/1-data-model.md` §2.12.2~2.12.4; `spec/5-system/10-graph-rag.md` §2.3~2.5 및 Rationale "도메인 용어" 절 | `codebase/backend/.../knowledge-base/entities/{entity,relation,chunk-entity}.entity.ts`(실제 클래스명 `GraphEntity`/`GraphRelation`/`GraphChunkEntity`, 동일 취지의 코드 주석 3곳); `knowledge-base-response.dto.ts`(`GraphEntityDto` 등); 프런트 `entity-list.tsx`(`GraphEntity` import) | 두 spec 문서에 실제 구현 식별자(`GraphEntity` 등) 병기 또는 "TypeORM `@Entity` 충돌 회피로 `Graph` 접두 사용" 각주 추가. 재발 방지를 위해 domain-modeling 명명 규약(예약어 접두 규칙) 신설 검토 |

\* Plan Coherence 자체 등급은 WARNING 이었으나, 동일 사안(같은 spec 각주·같은 코드 경로)을 독립적으로 CRITICAL 로 판정한 Rationale Continuity 와 관점만 다를 뿐 실질적으로 동일한 위배이므로 "가장 강한 등급으로 통합" 규칙에 따라 CRITICAL 1건으로 병합했습니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | MCP Integration 의 "개인 등록 미지원" 제약이 Integration 공통 스펙에 반영되지 않음 | `spec/5-system/11-mcp-client.md` §1 L27, §3.1 L99 | `spec/2-navigation/4-integration.md` §3.2/§5.6/§8(서비스타입 예외 미언급); `spec/1-data-model.md` §2.10(일반적 정의); 실제 DTO 도 service_type 조건부 검증 없음(grep 무결과) | `4-integration.md` §5.6 에 "personal 스코프 미지원(조직 전용)" 명시 + §3.2/§8 각주 추가, 또는 실제로 제약이 없다면 `mcp-client.md` 의 단정 문구 완화 — 어느 쪽이 맞는지 결정 필요 |
| 2 | Cross-Spec | MCP Internal Bridge 401 자가회복 예외가 Cafe24 만 명시, MakeShop 누락 | `spec/5-system/11-mcp-client.md` §2.3 L81, §8.4 L511, Rationale L579 | 동일문서 §3.1 표(cafe24+makeshop 둘 다 Internal Bridge 대상); `spec/4-nodes/4-integration/5-makeshop.md` §6.1 L191-193, §8.6 L214(refresh 우선 정책 자체 명시) | "예: cafe24" 옆에 "makeshop(§8.6 동일 정책)" 병기 또는 `[Spec MakeShop §6.1]` 링크 추가 |
| 3 | Convention Compliance | `2-api-convention.md` §12.1 상태 토글 예시가 snake_case(`is_active`), 실제 DTO·타 문서는 전부 camelCase(`isActive`) | `spec/5-system/2-api-convention.md` §12.1 (L386-403 부근) | `triggers`/`schedules`/`workflows` DTO(camelCase `isActive`); `spec/2-navigation/2-trigger-list.md`·`3-schedule.md`·`data-flow/10-triggers.md`·`7-channel-web-chat/5-admin-console.md`(전부 camelCase) | §12.1 예시·표를 camelCase(`isActive`/`isDisabled`/`isRead`)로 정정 |
| 4 | Convention Compliance | `spec/5-system/` 6개 파일이 `## Overview` 헤딩 없이 바로 본문(§1)으로 시작 — project-planner SKILL.md 3섹션 관행과 편차 | `11-mcp-client.md:19`, `16-system-status-api.md:14`, `2-api-convention.md:22`, `5-expression-language.md:18`, `6-websocket-protocol.md:22`, `7-llm-client.md:26` | 같은 디렉터리 11개 형제 파일의 `## Overview`/`## Overview (제품 정의)` 관행 | 6개 파일에 `## Overview` 헤딩 추가, 또는 프로토콜 사양형 문서로서의 의도적 예외라면 SKILL.md 에 그 예외 범주를 명문화(하네스가 파싱하지 않아 CRITICAL 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `graph-rag.md` §2.1 "추가 컬럼" 표에 자신이 §7 에서 참조하는 `reextract_status` 가 빠져 있음(정의 자체는 `data-model.md` §2.11 에 존재, 값 불일치는 아닌 self-reference 완결성 문제) | `spec/5-system/10-graph-rag.md` §2.1(L236-249) ↔ §7(L564) ↔ `spec/1-data-model.md` §2.11(L356) | §2.1 표에 `reextract_status` 행 추가(`data-model.md` 문구 그대로 복사) |
| 2 | Naming Collision | 그래프 시각화의 "노드/엣지" 용어가 워크플로우 핵심 용어(Node/Edge)와 표면적으로 겹침(라이브러리도 다르고 실질 충돌은 아님) | `spec/5-system/10-graph-rag.md` KB-GR-UI-07 ↔ `spec/0-overview.md` §7 용어 정의 | 필요 시 KB-GR-UI-07 인근에 "그래프의 노드/엣지는 워크플로우 캔버스의 Node/Edge 와 무관" 1회성 disambiguation 각주 추가 (선택) |
| 3 | Rationale Continuity | 인라인 제공된 3개 target 문서(`1-auth`/`10-graph-rag`/`11-mcp-client`) 자체는 Rationale 연속성 모범사례(날짜 명시+기각 대안 나열+선례 cross-link)를 보임 | 각 문서 자신의 `## Rationale` | 위 Critical #2 의 spec 갱신 작업 시 이 세 문서의 서술 패턴을 템플릿으로 사용 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | auth.md RBAC 매트릭스 Admin 삭제권한 누락(CRITICAL) + MCP 관련 WARNING 2건 + graph-rag 컬럼목록 INFO 1건 |
| Rationale Continuity | HIGH | `retry_last_turn` 원자성 불변식이 spec 자기서술과 실제 코드 사이에서 깨져있고, 재검증 의무가 다른 기능으로 오상계됨(CRITICAL) — `4-execution-engine.md` 를 직접 Read 해 발견 |
| Convention Compliance | LOW | `2-api-convention.md` 토글 예시 case 불일치 + `## Overview` 헤딩 누락 6건(둘 다 WARNING, 하네스 강제 없음) |
| Plan Coherence | MEDIUM | `retry_last_turn` 재검증 의무의 PASS→CRITICAL 반전이 spec 각주·완료 plan 어디에도 미기록(WARNING → 위 Critical #2 로 병합 반영) |
| Naming Collision | MEDIUM | `Entity`/`Relation`/`ChunkEntity` 가 TypeORM `@Entity` 와 실충돌, spec 미반영(CRITICAL) + 그래프 용어 표면충돌 INFO + 리뷰 자체 커버리지 caveat |

## 권장 조치사항

1. (BLOCK 해소 — 최우선, 즉시 정정 가능) `spec/5-system/1-auth.md` §3.2 L367 RBAC 매트릭스에서 "멤버 관리" 행의 Admin 을 CRU → CRUD 로 정정.
2. (BLOCK 해소 — 이번 worktree 의 실제 작업과 직결) `retry_last_turn` 원자 claim 코드(W1/P1) 구현과 **동시에** `spec/5-system/4-execution-engine.md` 5곳 각주 갱신 + `plan/complete/exec-intake-queue-impl.md` 의 stale PASS 판정 번복 기록 + `plan/in-progress/retry-turn-terminal-guard.md` project-planner 위임 목록에 이 spec 갱신 항목을 등재. 코드만 고치고 spec/plan 을 그대로 두면 이번에 지적된 자기모순이 재발한다.
3. (BLOCK 해소) `spec/1-data-model.md` §2.12.2~2.12.4 + `spec/5-system/10-graph-rag.md` §2.3~2.5 에 실제 구현 식별자(`GraphEntity` 등) 병기 또는 TypeORM 충돌 회피 각주 추가.
4. (WARNING, 비차단이나 권장) `4-integration.md` 에 MCP personal-scope 지원 여부를 명시적으로 결정·기록하고, `mcp-client.md` 의 MakeShop 401 자가회복 크로스레퍼런스를 추가.
5. (WARNING) `2-api-convention.md` §12.1 토글 예시를 camelCase 로 정정.
6. (WARNING, 선택) `spec/5-system/` 6개 파일에 `## Overview` 헤딩 보완 또는 예외 범주 명문화.
7. (프로세스 개선, 비차단) 이번 impl-prep 호출에서 `spec/5-system/` 대상 파일이 알파벳순으로 나열되다 컨텍스트 예산에 걸려 실제 작업 파일(`4-execution-engine.md`)이 4/5 checker 프롬프트에서 누락됐다. 향후 호출 시 대상 파일 우선순위를 브랜치명/열려있는 plan 참조 파일 기준으로 재정렬하는 방안을 검토할 것.
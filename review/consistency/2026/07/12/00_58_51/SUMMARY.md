# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — KB WebSocket emit 헬퍼의 `event` 파라미터를 `string` → 기존 `KbEventType`(11종, 무변경) 으로 좁히고 `as` 캐스트를 제거하는 순수 컴파일타임 타입 강화 리팩터. 5개 checker 전원이 신규 계약·엔티티·요구사항 ID·상태·권한·식별자·Rationale 충돌을 발견하지 못했다(위험도 전원 NONE).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `2-api-convention.md §2.2` 의 "3단계 이상 중첩 예외(RPC-style sub-channel, `:id` 포함)" 목록이 `1-auth.md §5` WebAuthn 엔드포인트(`:id` 없는 4~5 세그먼트, 예: `POST /api/auth/2fa/webauthn/register/options`)를 비롯한 시스템 전역의 기존 관행보다 좁게 쓰여 있음 | `spec/5-system/2-api-convention.md §2.2` (오래된 규약 문서화 공백, target·이번 diff 와 무관한 사전 존재 상태) | target 문서 수정 불요. 후속으로 `2-api-convention.md §2.2` 예외 조항을 "`:id` 유무 무관, 절차형 sub-action 네임스페이스(2FA/OAuth/이메일 변경 등)" 로 일반화하거나 대표 사례를 예시에 추가 |
| 2 | Naming Collision | `spec/5-system/10-graph-rag.md §2.3~2.5`·`spec/1-data-model.md §2.12.2~2.12.4` 의 spec 표기(`Entity`/`Relation`/`ChunkEntity`)가 실제 TypeORM 클래스명(`GraphEntity`/`GraphRelation`/`GraphChunkEntity`)과 어긋남(코드는 이미 `Graph` 접두사로 충돌 회피) | `spec/5-system/10-graph-rag.md §2.3~2.5`, `spec/1-data-model.md §2.12.2~2.12.4` (사전 존재, 이번 diff 와 무관) | 액션 불요(이번 diff 범위 밖). 후속 spec 정리 시 헤더를 `GraphEntity`/`GraphRelation`/`GraphChunkEntity` 로 코드와 정렬 권장 |
| 3 | Naming Collision | 이번 세션 `prompt_file` 이 번들한 target(`1-auth.md`, `10-graph-rag.md` 전문)이 실제 브랜치 diff(KB WebSocket emit 3개 backend 파일 + plan 문서)와 무관 — 두 spec 파일 모두 `origin/main` 대비 diff 0라인(byte-identical) | 세션 target 스코핑 (모든 5개 checker 가 동일하게 관찰) | 액션 불요(이번 결과에 영향 없음, 5개 checker 전원 실제 diff 기준으로 독립 재확인 후 위험도 NONE 도출). 향후 세션 생성 시 target/diff 스코프 매칭 재확인 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 신규 엔티티/필드/endpoint/요구사항 ID/상태전이/RBAC/계층책임 변경 없음. `KbEventType` union(11종) 무변경 확인 |
| Rationale Continuity | NONE | `spec/5-system/**` diff 0. KB-GR-OB-02("닫힌 union, `document:graph_error` 없음") 결정을 코드로 강제하는 방향 — 기각된 대안 재도입·원칙 위반·무근거 번복·암묵적 가정 충돌 전부 없음 |
| Convention Compliance | NONE (INFO 1건) | `audit-actions`/`error-codes`/`node-output`/`swagger`/`spec-impl-evidence`/`migrations`/`secret-store` 전 항목 교차검증 통과. §2.2 URL 중첩 예외 목록 공백만 INFO |
| Plan Coherence | NONE | `plan/in-progress/kb-websocket-emit-compile-guard.md` 가 diff 와 정확히 일치, 선행 plan(#891) 이미 해소, 타 in-progress plan 과 충돌·무효화 없음 |
| Naming Collision | NONE (INFO 2건) | 실제 diff 는 기존 export `KbEventType` 재사용뿐, 신규 식별자 없음. 번들 target 액면 보조 점검도 실질 충돌 없음(사전 존재 Graph 접두사 불일치만 INFO) |

## 권장 조치사항

1. (BLOCK 해소 불필요 — Critical 없음) 이번 diff 는 그대로 진행 가능.
2. (선택, 저우선) `spec/5-system/2-api-convention.md §2.2` 의 RPC-style 중첩 예외 조항을 실제 관행(WebAuthn 등 `:id` 없는 절차형 sub-action)에 맞게 일반화 — 별도 규약 정비 작업으로 트래킹 권장.
3. (선택, 저우선) `spec/5-system/10-graph-rag.md §2.3~2.5`·`spec/1-data-model.md §2.12.2~2.12.4` 의 `Entity`/`Relation`/`ChunkEntity` 표기를 코드의 `Graph` 접두사 클래스명과 정렬하는 후속 spec 정리 검토.
4. (프로세스) 향후 세션 준비 시 `prompt_file` target 번들이 실제 checkout diff 와 일치하는지(특히 target spec 파일이 diff 0라인인 경우) 사전 검증 권장 — 이번엔 5개 checker 가 독립적으로 실제 diff 를 재확인해 결과에 영향 없었음.

STATUS: OK

# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`, scope=`spec/5-system/`
Target: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
대조: `spec/0-overview.md`, `spec/1-data-model.md` + 실제 저장소의 `spec/2-navigation/9-user-profile.md`,
`spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/6-config.md`, `spec/conventions/audit-actions.md`,
`spec/conventions/error-codes.md`, `spec/data-flow/2-auth.md`, `spec/data-flow/12-workspace.md`,
`spec/5-system/9-rag-search.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `plan/complete/workspace-slug-routing.md`

## 발견사항

- **[WARNING]** 워크스페이스 슬러그 라우팅(`/w/[slug]/...`) 도입 후 `1-auth.md`·`10-auth-flow.md`의 인증 관련 bare-path 서술이 실제 라우트와 불일치
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 "경로·진입"(라인 267), §1.1.B(라인 74 `/profile`·`/profile/change-email`), §1.4.1/§1.4.4(라인 69, 182, 569 `/profile/security`)
  - 충돌 대상: (a) 같은 문서의 frontmatter `code:` 필드 — `codebase/frontend/src/app/(main)/w/[slug]/invitations/accept/**` (PR #865 `be7eba803`에서 이미 slug 경로로 갱신됨). (b) `spec/2-navigation/10-auth-flow.md` L131 — 동일하게 `/invitations/accept?token=…` (slug 미반영) 서술 중복. (c) `spec/2-navigation/9-user-profile.md §3`(URL slug = FE 라우팅 SoT로 flip 완료) 및 실제 코드(`codebase/frontend/src/app/(main)/w/[slug]/{invitations/accept,profile/security,profile/change-email}/**` 실존 확인).
  - 상세: PR #865("워크스페이스 슬러그 URL 라우팅 phase 1")는 `(main)/*` 26개 페이지를 `(main)/w/[slug]/*`로 이동시키고, 그 SPEC-DRIFT reflux 커밋에서 `9-user-profile §3`·`data-flow/12-workspace Rationale`·`10-auth-flow §7.2`(로그인 후 `/dashboard` 리다이렉트)·`_layout §2.2/§3.1`·`11-error-empty-states §1.3`·`0-dashboard`·`1-workflow-list`·`4-ai-assistant`·`13-replay-rerun`·`15-system-status`·`16-agent-memory`·`14-execution-history` 등 다수 문서의 "bare-path 산문"을 slug-aware 로 정정했다. 그러나 `1-auth.md`는 frontmatter `code:` 경로만 `git mv` 미러로 갱신되고 본문 산문(§1.1.B `/profile`·`/profile/change-email`, §1.4 `/profile/security` ×3, §1.5.3 `/invitations/accept`)은 정정되지 않았고, `10-auth-flow.md` L131의 동일 서술도 그대로 남았다. 실제로는 `(main)/[...rest]` catch-all이 클라이언트 사이드에서 `/invitations/accept` → `/w/<slug>/invitations/accept`로 흡수하므로 **런타임 동작 자체는 깨지지 않지만**, 두 spec 문서가 서로를 참조하면서(1-auth.md §1.5.3 ↔ 10-auth-flow.md L131) 둘 다 구 경로를 "최종 경로"인 것처럼 서술해 API 계약/라우트 문서를 신뢰하는 독자(예: e2e 시나리오 작성자)를 오도할 수 있다. `plan/complete/workspace-slug-routing.md` "잔여(후속)" 섹션에도 이 갭이 별도로 추적되지 있지 않다.
  - 제안: `1-auth.md` §1.1.B/§1.4/§1.5.3의 `/profile`·`/profile/security`·`/profile/change-email`·`/invitations/accept` bare-path 서술에 "실제 마운트 경로는 `/w/<slug>/...`이며 bare 경로는 `(main)/[...rest]` catch-all이 흡수" 각주를 추가(9-user-profile §3/§4.3와 동일한 slug-aware 각주 패턴). `10-auth-flow.md` L131도 동일하게 정정. 두 문서 모두 `spec-sync` 형태의 소규모 후속으로 처리 가능(behavior 변경 없음, 문서 동기화만).

- **[INFO]** RBAC 매트릭스가 `1-auth.md §3.2`(SoT 선언)와 `9-user-profile.md §4.2`에 이중 존재하며 SoT 포인터 부재
  - target 위치: `spec/5-system/1-auth.md` Overview(라인 26 "본 문서는... 권한(RBAC)의 단일 진실이다") 및 §3.2
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2 "역할 권한 매트릭스"`
  - 상세: 두 표의 실제 값은 상호 모순되지 않는다(9-user-profile §4.2는 "관리 액션 가능 여부"만 이진 표시하는 축약 버전이고, 1-auth §3.2는 CRUD 세분화 버전 — 예: "멤버 관리"에서 9-user-profile은 Editor/Viewer ❌, 1-auth는 Editor/Viewer=R로 세분화했을 뿐 상충 아님). 다만 1-auth.md는 스스로 "권한(RBAC)의 단일 진실"이라 선언하면서도 9-user-profile.md §4.2에는 그 관계를 명시하는 역참조(SoT 포인터)가 없어, 향후 어느 한쪽만 갱신될 경우 drift 위험이 있다(이 문서 세트의 다른 곳들 — 예: 4-integration.md §8, 6-config.md §A.4 — 은 "근거: Spec 인증 §3.2" 식으로 명시적으로 SoT를 인용하는 패턴을 일관되게 쓴다).
  - 제안: `9-user-profile.md §4.2` 표 상단에 "상세 CRUD 매트릭스는 [인증/인가 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스)가 SoT, 본 표는 관리 UI 버튼 노출 기준 요약" 같은 한 줄 pointer를 추가해 다른 영역과 동일한 SoT 인용 관례를 맞춘다. 즉시 조치가 필요한 CRITICAL은 아님.

## 확인했지만 문제 없음 (참고)

다음 항목들은 잠재 충돌 후보로 점검했으나 실제로는 정합했다:
- `spec/1-data-model.md` §2.12.2~2.12.4(Entity/Relation/ChunkEntity) ↔ `10-graph-rag.md` §2.3~2.5: 필드·제약·인덱스 완전 일치.
- `spec/1-data-model.md` §2.11 KnowledgeBase의 `rag_mode`/`max_hops`/`vector_seed_top_k`/`expanded_chunk_limit`/`entity_count`/`relation_count` ↔ `10-graph-rag.md` §2.1: 일치.
- `10-graph-rag.md` KB-GR-PA-03(AI Agent 노드는 `ragTopK`/`ragThreshold`만 노출) ↔ `4-nodes/3-ai/1-ai-agent.md`: 그래프 파라미터 미노출 확인, 일치.
- Auth Config Reveal 권한(Admin+, 비밀번호 재확인, `auth_config.reveal` 감사) — `1-auth.md §3.2/§4.1` ↔ `2-navigation/6-config.md §A.4/§9`: 일치.
- 감사 액션 시제·네임스페이스(`user.*`, `workspace.transfer_ownership` 도메인 고유 동사 분류 등) — `1-auth.md §4.1/Rationale 4.1.A` ↔ `conventions/audit-actions.md`: 완전 일치.
- 초대 흐름 에러 코드의 `lower_snake_case` historical-artifact 예외(`invitation_not_found` 등) — `1-auth.md §1.5.4` ↔ `conventions/error-codes.md §3`: 목록·근거 일치.
- `activeWorkspaceId` JWT 클레임/dual-read/전환 엔드포인트 — `1-auth.md §2.2/§3.3` ↔ `data-flow/12-workspace.md`·`5-system/2-api-convention.md`: 일치.
- 로그인/이메일 변경/비밀번호 재설정 시퀀스 — `1-auth.md §1.1.A/§1.1.B/§2.3` ↔ `data-flow/2-auth.md`: 세부 스텝까지 일치.
- Graph RAG 동적 점수 컷(§4.1 step 7) ↔ `9-rag-search.md §3.4`: 일치.
- Bootstrap stuck 문서 회수 10분 임계 — `10-graph-rag.md` KB-GR-EX-10 ↔ `8-embedding-pipeline.md §9.3`: 동일 서비스·임계값.
- `KB-GR-*` 요구사항 ID는 다른 spec 문서에서 재사용되지 않음(ID 충돌 없음).

## 요약

`spec/5-system/1-auth.md`·`10-graph-rag.md`는 이미 수차례의 spec-sync/consistency 그루밍을 거친 문서로, 데이터 모델(Entity/Relation/KnowledgeBase 컬럼)·API 계약(엔드포인트·에러코드)·RBAC·감사 액션 네임스페이스·상태 전이 정의가 `spec/1-data-model.md`, `conventions/audit-actions.md`, `conventions/error-codes.md`, `data-flow/2-auth.md`, `2-navigation/6-config.md`, `9-rag-search.md` 등과 광범위하게 정합했다. 유일하게 확인된 실질적 갭은 최근 병합된 워크스페이스 슬러그 라우팅(PR #865)이 다른 다수 spec 문서의 bare-path 서술을 slug-aware로 정정하면서 `1-auth.md`(및 이를 인용하는 `10-auth-flow.md`)의 인증 관련 페이지 경로(`/profile/*`, `/invitations/accept`) 서술만 누락시킨 것으로, 런타임 동작에는 영향이 없으나(catch-all 리다이렉트로 흡수) 문서 신뢰성 저하 위험이 있어 WARNING으로 보고한다. RBAC 매트릭스 중복(9-user-profile §4.2 vs 1-auth §3.2)은 값 자체는 일치하므로 INFO 수준의 SoT 포인터 보강 권고에 그친다.

## 위험도

LOW

---
worktree: spec-sync-audit-998544
started: 2026-06-10
owner: claude
---

# Spec↔Codebase 전수 상호 감사 (2026-06-10) — 역방향 커버리지 + 순방향 drift + data-flow 전면 갱신

2026-06-03 전수 동기화(audit, PR #443~#452) 이후의 후속 감사. 산출물: [`review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md`](../../review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md).

## 범위·방법

- **역방향 커버리지** (이전 audit 의 보류 D 항목): spec frontmatter `code:` 미커버 소스 378파일을 21개 클러스터로 fan-out 감사 — spec 없는 기능/위반 검출.
- **순방향 drift**: 동기화 커밋 1161775f 이후 58커밋·코드 293파일과 교차하는 spec 57개를 19개 유닛으로 재검증.
- **data-flow 전수**: 13문서 본문 주장 전수 검증 + 폴더 구조 갭 분석.

## 처리 내역

- [x] 감사 fan-out (Workflow 3-phase, 54 유닛) + rate-limit 사망분 재시도 2회 — 전 유닛 확보
- [x] 적용 Wave 1 — 영역별 writer 14: spec-outdated 57·undocumented 17·frontmatter-gap 56 중 위반/연기분 제외 116건 적용
- [x] 적용 Wave 2 — data-flow major-drift 재작성 5 (1-audit·3-execution·5-integration·6-knowledge-base·7-llm-usage), minor-drift 패치 8, **신규 3 문서** (13-agent-memory·14-chat-channel·15-external-interaction), 이월/연기분 (3-ai·graph-rag·fe-lib frontmatter·handoff)
- [x] spec-violation 은 무수정 보고 (위 SUMMARY §1 — 19건: severe 3 / major 6 / minor 9 / info 1)
- [x] frontmatter·link·area-index·plan 가드 통과 확인 (worktree 내 vitest)

## 후속 (미해결 — 별도 결정 필요)

- [ ] SUMMARY §1 위반 19건의 코드 수정 vs spec 하향 결정 (developer/project-planner) — 특히 severe 3: audit-logs Admin+ 가드 부재(V-03, 보안), makeshop expired 오격하(V-01), AI 노드 override UI 필드 누락(V-02)
  - [x] **V-03** (audit-logs Admin+ 가드) — PR #523 머지 완료
  - [x] **V-01** (makeshop expired 오격하) + **V-07** (§11.2 알림 정책) + **V-15** (큐 레지스트리) + V-19(rag 신호화, #511) — `integration-expiry-fixes` 브랜치(본 PR)에서 해소
  - [x] **V-06** (makeshop `services/makeshop/catalog` operations 미충전) + **V-08** (Activity 탭 라벨 namespace cafe24 고정) — `makeshop-catalog-labels` 브랜치(PR #530)에서 코드 수정 해소 (getServiceCatalog makeshop 분기 + tryTranslateLabel provider-prefix 일반화)
  - [x] **V-16** (KB DTO Swagger `cross_encoder_llm 후속 구현` stale) + **V-17** (web-chat-sdk README·byo-ui-headless 예제의 `firstMessage` 폐기 패턴) — `rag-webchat-doc-strings` 브랜치(PR #533)에서 코드측 문서 문자열 정정 (spec 변경 불요)
  - [x] **V-02** (AI 노드 override UI 필드 누락, **severe**) — `ai-node-override-fields` 브랜치(본 PR)에서 `information_extractor`·`text_classifier` 를 OVERRIDE_REGISTRY 에서 제거해 auto-form(schema-driven) 이행. 두 노드의 zod schema 가 이미 누락 필드(conversation-context 5·agent-memory 7·system-context 2·examples·enumValues·maxCollectionRetries) 전부 ui 힌트로 방출 중이라 backend 0건, bespoke `ai-configs.tsx` 삭제. ai_agent 와 동일 패턴 일관. spec 변경 불요(spec 이 명시한 필드 노출을 코드가 충족)
  - [x] **V-11** (통합 삭제 차단 다이얼로그) — PR #634 머지 완료 (`delete-blocked-dialog.tsx` 사용처 사전조회 차단 다이얼로그 + usageKind 배지)
  - [x] **V-04** (folder update() cycle/depth 미검증, **major**) — `folder-depth-cycle-guard` 브랜치(본 PR)에서 코드 구현(plan 권장 채택). update() 에 parentId 변경 시 계층 무결성 검증(같은 workspace parent·self/자손 아님(cycle)·parent depth+subtree height ≤5) + getDepth() visited-set/상한 가드(cycle 무한루프 방지). 위반=`VALIDATION_ERROR`(create 일관, 신규 cycle 코드 미도입 — naming 충돌 회피). spec `1-data-model §2.5`·`2-navigation/1-workflow-list §3.1`·controller Swagger 문서화. TEST WORKFLOW(e2e 235)+ai-review(Critical 0)+impl-done.
  - [x] **V-09** (초대 수락 페이지 자동수락, **major**) — `invite-accept-confirm-ui` 브랜치(본 PR)에서 코드 구현(plan 권장 채택). accept page 를 §1.5.3 로 재작성(마운트 자동수락 → 토큰메타 조회 → 로그인 email==토큰 email 이면 [수락] 버튼, 불일치면 안내+로그아웃, 410 error) + **진입 경로**(impl-prep cross_spec CRITICAL): register-form 이 로그인 사용자를 `/invitations/accept?token=` 로 redirect. `1-auth` frontmatter 에 frontend 초대흐름 code 매핑 + §1.5.3 에 accept page `token` query param·진입 경로 문서화. i18n ko/en(mismatch/logout). TEST WORKFLOW(e2e 235)+ai-review(Critical 0)+impl-done.
  - [x] **V-05** (실행 상세 노드 서브탭, **major**) — `execution-detail-node-subtabs` 브랜치(본 PR)에서 코드 구현(plan 권장 채택). 실행 상세 `page.tsx` 의 우측 노드 상세 패널(로컬 4탭 preview/input/output/error + 중복 waiting 핸들러)을 에디터 `ResultDetail` 컴포넌트 재사용으로 교체 → §3.3/§3.4.2 대로 Config·LLM Usage·메시지 레벨(Response/Request/LLM Usage)·References 탭과 dangling 안내문 해소, 두 surface 일관. `nodeExecution.outputData` 가 에디터 run 결과와 동일 shape 라 데이터 추출 그대로 동작하고, ResultDetail 내부 `useExecutionInteractionCommands` 로 live waiting(form/buttons/conversation) 상호작용도 통일. spec 변경 불요(EH-DETAIL-03·§3.3/§3.4 이미 ✅). 재사용 방침으로 §10.6.1 retry-error-exception·auto-fallback·§3.4.2 R-3 평탄화 자동 상속. TEST WORKFLOW(e2e)+ai-review+impl-done.
    - **V-05 후속 항목** (ai-review/impl-done 17_10_43 에서 이관 확정 — 본 PR 범위 밖, 추적용 등록):
      - [x] (planner) spec-doc 완전성 — `spec-doc-batch-v13-v18` 브랜치(본 PR)에서 반영: `3-execution.md §10.6.1`(탭 SoT)에 References/Meta/Port/Status 4탭 추가 + `14-execution-history §3.3` 이 §10.6.1 로 위임 + `13-replay-rerun §7.4`·§9.2 에 실행 상세 execution-level `Execution.dry_run` 배지 스코프(에디터 드로어와 비대칭) 명시 + `14-execution-history` Rationale **R-5**(Config 탭 viewer 노출=서버 masking parity 로 안전) 신설. `/consistency-check --spec` BLOCK: NO(19_27_28).
      - [x] (refactor) `run-results/use-result-detail-waiting.ts` 공용 hook 추출 — `result-detail-props-hook` 브랜치(본 PR). 에디터 드로어·실행 상세 페이지가 중복 유도하던 waiting selector(11)·resume 콜백(4)을 hook 이 제공, 타입별 대기 플래그는 `deriveFlags(isSelectedWaiting)`(ai_form_render 뉘앙스 단일 정의)로 노출. isSelectedWaiting(소비처별 상이)·conversation 선택 소스는 소비처 유지. Rules of Hooks(드로어 idle early return) 준수 위해 selector 는 hook 이, boolean 은 deriveFlags 가. hook unit 5 + 회귀(execution-detail-waiting·result-detail 41) 통과. **registry SoT 동반 이동**: WaitingInteractionType 4값 exhaustive 분기가 drawer(d)+page(e)→hook `deriveFlags` 단일화 → `interaction-type-registry.md §1.2` 매트릭스·rule 3 + `interaction-type-exhaustiveness.test.ts` `REGISTRY_SITES`(4→3파일, drawer/page 제거·hook 추가) 동시 갱신. drawer 잔여 `isLiveConversation`(2값 subset)=TS 커버. TEST WORKFLOW 전 단계(lint·unit 48·build·e2e 236) 통과.
      - [ ] (low) 미사용 i18n 키 `executions.tabPreview/tabInput/tabOutput/tabError` 제거(리팩터로 orphan, 코드 참조 0 확인) + `components/editor/run-results` 폴더가 이제 에디터/실행내역 이중 소유이므로 rename 검토.
  - [x] **V-10** (트리거 목록 Cron·다음 실행 시각, minor) — `trigger-list-cron-nextrun` 브랜치(본 PR)에서 코드 구현(plan 권장 채택, 사용자 확정 2026-07-05). `TriggersService.findAll()` 이 schedule 타입 행을 `scheduleRepository.find({triggerId In(...)})` 배치 1회로 enrich(cron/timezone/nextRunAt) → GET /api/triggers 목록이 `2-trigger-list.md §2.1` 대로 표시(N+1 회피, findOneDetail 단건 로직의 목록판·workflow-list §2.4 선례). `TriggerDto` JSDoc "단건 조회 시에만"→"목록·단건 모두" 정정으로 본문·DTO주석·FE 3자 불일치 완전 해소. FE 이미 렌더(변경 불요). spec 변경 불요(§2.1 이미 약속). TEST WORKFLOW+ai-review+impl-done.
  - [x] **V-14** (Re-run 모달 원본 ID 링크 + typed 동적 폼, minor) — `rerun-modal-typed-form` 브랜치(본 PR)에서 코드 구현(plan 권장 채택, 사용자 확정 2026-07-05). `rerun-modal.tsx` 가 (a) 원본 ID 를 `/workflows/:wid/executions/:id` 새 탭 링크로, (b) 입력 폼을 워크플로 manual_trigger 노드 `config.parameters` 스키마 기반 typed 필드(string→text·number→number·boolean→checkbox·object/array→JSON, 타입 coerce)로 렌더. 스키마 부재 시 원본 키 text fallback. backend `resolveTriggerParameters` native-typed 수용(cross_spec 확인). spec 변경 불요(§10.2 이미 명시). TEST WORKFLOW+ai-review+impl-done.
    - **V-14 후속 항목** (ai-review 18_37_10 이관, 본 PR 범위 밖):
      - [x] (refactor) 프런트 trigger-param 타입 통합 — `trigger-param-type-consolidate` 브랜치(본 PR). `lib/api/triggers.ts`(트리거 도메인 타입 canonical 홈)에 `TriggerParameterDefinition`+`TriggerParameterType` 신설(backend `trigger-parameter.types.ts`·spec 0-common §1 이름 정합) → `rerun-modal.tsx`(로컬 ParamType/TriggerParameterDefinition 제거)·editor `trigger-configs.tsx`(로컬 `TriggerParameter` export 제거, TS 소비처 0 확인) 양쪽이 import. 순수 타입 통합(동작 무변경, 기존 테스트 22 pass).
      - [x] (planner) `13-replay-rerun §10.2` spec-doc 보강 — `spec-doc-batch-v13-v18` 브랜치(본 PR): §10.2 입력 폼 행에 스키마 부재 fallback(원본 키 text)+타입별 위젯 각주 + §10.2 원본 헤더 행 ↔ `14-execution-history §3.7` chain badge 에 new-tab(모달) vs same-tab(badge) 의도적 구분 상호 각주.
  - [x] **V-13** (캔버스 요약 summaryTemplate, minor) — `spec-doc-batch-v13-v18` 브랜치(본 PR)에서 **spec 하향**(사용자 확정 2026-07-05 1순위 배치). 재검증: `getConfigSummary` 는 `summaryTemplate` 있어야 렌더하는데 ai_agent/info_extractor 는 부재(text_classifier 만 보유) → 요약 미표시. 조건부 세그먼트·`Multi Turn` 접두어는 mustache DSL 로 표현 불가라 Planned 마킹이 합리적. `0-common §8`·`1-ai-agent §11`·`3-information-extractor §8`·`0-canvas §5.3.1/§5.3.4` 4문서 동시 하향 + 제거된 Tool Area 참조 `{N} tools` stale 정정. `/consistency-check --spec` BLOCK: NO.
  - [x] **V-18** (위젯 재로드 복원 시퀀스, minor) — `spec-doc-batch-v13-v18` 브랜치(본 PR)에서 **보류 + spec v1 범위 명시**(plan 권장 채택). 재검증(정정): `use-widget.ts` `seedWaitingFromStatus` 가 `getStatus` 호출은 하나 **`waiting_for_input` 성공만 처리**하고 200+종료·404·401·오류는 soft-fail 후 SSE 직행 — §3.1 의 200/404/401 분기+`401 낙관적 refresh` 는 **미구현(Planned)**. (초기 "정합 종결" 은 getStatus 호출만 보고 내린 오판 — consistency-check --spec CRITICAL 로 정정.) `3-auth-session §3.1` 에 v1 부분 범위 주석 추가(완전 구현은 별도 결정). `/consistency-check --spec` BLOCK: NO.
  - [x] **V-12** (Switch switchValue asterisk, minor) — `switch-value-asterisk` 브랜치(본 PR)에서 코드 구현(plan 권장 채택, 사용자 확정 2026-07-05). bespoke `SwitchConfig`(`logic-configs.tsx`) switchValue `ExpressionInput` 에 `required={mode === "value"}` 추가 → `2-switch §8.1` 의 `ui.requiredWhen: {field:'mode', equals:['value']}` asterisk 를 override-track 에서 재현(backend `switch.schema.ts` whitelist 일치, 기각 blacklist `notEquals` 아님). `ExpressionInput.required`=순수 시각(런타임 검증은 `NodeHandler.validate` 유지). spec 변경 불요(§8.1 이미 명시). unit 3(mode=value/기본/expression). TEST WORKFLOW+ai-review+impl-done.
  - [x] **cross-audit 코드-구현 항목 전량 종결** — V-01~V-19 중 코드 구현/spec 하향/보류 결정이 필요한 항목 모두 처리(V-12 가 마지막 코드-구현). 잔여는 저우선 refactor 후속뿐: V-05 ResultDetail props hook·V-05 orphan i18n/folder rename. (V-14 trigger-param 타입 통합은 완료 — 위 §V-14 후속 참조.)
- [x] SUMMARY §2 audit 도메인 코드 갭 (**G-01·G-02**) — `audit-coverage-naming` 브랜치(본 PR): (a) **G-02** `re_run_initiated`→`execution.re_run` 개명(`<resource>.<verb>` 규약, 신규 row 부터·레거시 불변), (b) **G-01** action 상수 인프라 `audit-action.const.ts`(`AUDIT_ACTIONS` union) 신설 + `record({action})` 타입 강제 + 9 call site 상수 전환. **방향: spec 하향 + 코드 위생** (사용자 결정) — spec §4.1 을 "구현됨(integration.*·workspace.transfer_ownership·execution.re_run·auth_config.reveal)/Planned(workflow·trigger·schedule·member·llm_config·rerank_config·auth)" 구분, integration 과거분사형은 audit 의미상 유지(코드↔spec 정합). data-flow/1-audit·13-replay-rerun 동반 갱신. 전 도메인 audit 기록 확대는 별도 기능 plan 으로 이월(Planned)
- [x] Trigger→Schedule 역방향 is_active 동기화 — PR #519 머지 완료 (1-data-model §2.9.1)
- [x] integration-expiry-scanner 코드 주석 stale (`기본 10일` → 실제 7일) — 본 PR 에서 정정. 잔여 Swagger 문자열 정정은 별도 developer 백로그

## 결정 옵션 (2026-06-13) — 잔여 위반 V-04·V-05·V-09~V-14·V-18

아래 9건은 모두 **같은 형태의 결정** — (1) 코드 구현으로 spec 의도 달성 / (2) spec 하향(현행 코드에 맞춰 약속 완화) / (3) 보류 — 중 하나를 고르는 것이다. severity 가 우선순위를 결정한다: major 3건(V-04·V-05·V-09)을 먼저 처리하고 minor 6건(V-10~V-14·V-18)은 후속. 보안·UX 정합성 위반(V-09 자동수락, V-04 cycle 미검증)은 코드 구현 쪽으로, 순수 cosmetic·aspirational 갭은 spec 하향/보류가 합리적이다.

### V-04 [major] 폴더 깊이·cycle 검증 (update 경로)
- **갭**: 1-data-model §2.5 '중첩 깊이 최대 5단계' 약속 vs `folders.service.ts` update() 가 parentId 를 깊이·cycle·workspace 검증 없이 Object.assign 저장(create() 에만 getDepth 검사). cycle 생성 시 getDepth while 루프 무한루프 위험.
- **옵션**:
  - 코드 구현: update() 에 (a) 새 부모 같은 workspace, (b) 깊이+서브트리 높이 ≤5, (c) self/자손 아님(cycle) 검증 + getDepth 에 방문집합/상한 가드 추가. 장점: 데이터 무결성·무한루프 제거, spec SoT 유지. 단점: 서브트리 높이 계산 추가 쿼리 비용.
  - spec 하향: 깊이 제한을 create-only 로 명문화. 장점: 코드 무변경. 단점: cycle 무한루프(가용성 결함)는 spec 하향으로 사라지지 않음 — 부적절.
- **권장**: 코드 구현. cycle→무한루프는 잠재 DoS 결함이라 dormant API 라도 가드 필요. spec §2.5 가 SoT.
- **트레이드오프**: 현재 FE 미사용 dormant 경로라 사용자 노출은 없으나, 가드 부재 자체가 후속 기능의 지뢰.

### V-05 [major] 실행 상세 페이지 노드 서브탭
- **갭**: 14-execution-history EH-DETAIL-03·§3.3/§3.4 가 노드 서브탭(LLM Usage·Config·메시지 레벨 Response/Request)을 ✅구현으로 명시 vs 실행 상세 `page.tsx` detailTabs 는 preview/input/output/error 4개뿐(해당 탭은 에디터 `result-detail.tsx` 에만 존재). ConversationInspector 안내문이 없는 탭을 가리키는 dangling 상태.
- **옵션**:
  - 코드 구현: NodeResultsTab 을 에디터 `result-detail.tsx` 탭 구성과 정렬(공용 컴포넌트 재사용으로 Config·LLM Usage·메시지 레벨 탭 추가). 장점: spec 의도 충족, dangling 안내문 해소, 두 surface 일관. 단점: 공용화 리팩토링 범위.
  - spec 하향: EH-DETAIL-03·§3.3/§3.4.1/§3.4.2 를 '에디터 run-results 패널 한정' 으로 재서술. 장점: 빠름. 단점: 실행 내역 surface UX 후퇴를 영구 확정 + dangling 안내문은 별도 정정 필요.
- **권장**: 코드 구현. spec 이 ✅구현으로 못박았고 안내문이 실제로 그 탭을 가리켜 사용자 혼란을 유발 — 의도 vs 구현 괴리가 명백.
- **트레이드오프**: 공용 컴포넌트 재사용 시 에디터/실행내역 양쪽 회귀 테스트 필요.

### V-09 [major] 초대 수락 페이지 자동수락
- **갭**: 5-system/1-auth §1.5.3 은 토큰 메타 조회→[수락]버튼→이메일 불일치 시 계정전환 안내+로그아웃 UI 를 규정 vs `accept-invitation-content.tsx` 가 마운트 즉시 `acceptInvitation` 자동 호출(버튼·불일치 UI 없음). frontmatter `code:` 매핑도 부재.
- **옵션**:
  - 코드 구현: §1.5.3 대로 GET 토큰 메타→[수락]버튼→이메일 불일치 안내+로그아웃 affordance 구현 + frontmatter 매핑 추가. 장점: 명시적 확인 단계(오클릭·계정혼동 방지), spec 정합. 단점: 흐름 재작성 + 토큰 메타 endpoint 소비 추가.
  - spec 하향: 자동수락을 의도된 진화로 §1.5.3·9-user-profile §4.1.1 갱신. 장점: 코드 무변경. 단점: 다른 계정 로그인 상태에서 링크 클릭 시 사용자가 의도 없이 워크스페이스 가입 — UX 정합성 결함을 정당화하게 됨.
- **권장**: 코드 구현. 확인 단계 부재는 UX-correctness 결함(서버측 email 일치 강제는 있으나 프론트 흐름 계약과 모순). frontmatter 매핑도 동반 필요.
- **트레이드오프**: 자동수락의 '원클릭 편의' 는 사라지나, 명시 확인이 의도 안전성을 우선.

### V-10 [minor] 트리거 목록 Cron·다음 실행 시각
- **갭**: 2-trigger-list §2.1 은 목록 행에 Schedule 트리거의 Cron 식·다음 실행 시각 표시를 명시(목업 `0 9 * * * Next: 09:00`) vs `triggers.service.ts` findAll() 이 schedule join 없이 반환(enrichment 는 findOneDetail 단건에만). 본문·응답 DTO 주석·FE 기대 3자 불일치.
- **옵션**:
  - 코드 구현: findAll() 에 type=schedule 행 schedule 테이블 일괄 join(triggerId IN) 으로 cron/nextRun enrichment. 장점: spec §2.1 충족, 3자 불일치 해소. 단점: 목록 쿼리에 join 1회 추가.
  - spec 하향: §1 목업·§2.1 두 행을 단건 조회/드로어 한정으로 격하. 장점: 코드 무변경. 단점: 목록 정보 밀도 후퇴.
- **권장**: 코드 구현. 일괄 join 비용이 낮고 DTO 주석까지 3자가 어긋난 상태라 정합화 이득이 큼.
- **트레이드오프**: minor 라 major 처리 후 후속 가능.

### V-11 [minor] 통합 삭제 차단 다이얼로그 — ✅ 해소 (PR #634, 아래는 결정 당시 기록)
- **갭**: 4-integration §4.7/§7.2 는 삭제 클릭 시 GET usages 사전 조회→사용처 목록+[Open Workflow] 차단 다이얼로그를 명시 vs `integrations/[id]/page.tsx` DangerTab 이 사전 조회 없이 DELETE→409 시 일반 토스트. 서버측 차단(409)은 동작.
- **옵션**:
  - 코드 구현: 삭제 클릭 시 usages 사전 조회→사용처 목록·Open Workflow 링크 차단 다이얼로그. 장점: spec UX 충족(사용자가 어디서 쓰이는지 바로 인지). 단점: 다이얼로그 컴포넌트 신규 + 조회 1회.
  - spec 하향: '409→토스트 + Usage 탭 참조' 를 의도로 확정하고 §4.7/§7.2 다운스케일. 장점: 빠름. 단점: 사용처 발견 동선이 끊겨 UX 후퇴.
- **권장**: 코드 구현(약). UX 명세가 구체적(§7.2 와이어프레임)이라 의도가 분명. 단 minor·서버 차단 존재라 우선순위는 낮음.
- **트레이드오프**: 후속 가능; 즉시 안전성 영향 없음(서버가 막음).

### V-12 [minor] Switch switchValue requiredWhen asterisk
- **갭**: 4-nodes/1-logic/2-switch §8.1 은 `ui.requiredWhen` 화이트리스트로 mode=value 시 switchValue asterisk 노출을 구현사실로 기술 vs bespoke `SwitchConfig`(override) 의 switchValue ExpressionInput 이 asterisk 미렌더(requiredWhen 은 auto-form 만 소비).
- **옵션**:
  - 코드 구현: SwitchConfig 에 mode==='value' 시 asterisk 추가, 또는 switch 를 auto-form 이행. 장점: spec 정합. 단점: auto-form 이행은 범위 큼(asterisk 단건만이면 소).
  - spec 하향: §8.1 에 'asterisk 는 schema 힌트 계약, 현 override UI 미반영' 단서. 장점: 빠름. 단점: 약속과 구현 영구 괴리.
- **권장**: 코드 구현(소규모) — asterisk 1개 추가는 저비용이고 required 표시 부재는 입력 누락 UX 결함.
- **트레이드오프**: cosmetic 에 가까워 우선순위 최하위.

### V-13 [minor] 캔버스 요약 summaryTemplate (ai_agent·information_extractor)
- **갭**: 4-nodes/3-ai/0-common §8 은 ai_agent·info_extractor 캔버스 요약(`{mode}·{model}·{N} KB·{N} MCP…`)을 약속(1-ai-agent §11·3-IE §8 인용) vs 두 노드 metadata 에 summaryTemplate 부재로 요약 미렌더(text_classifier 만 구현). 추가로 `{N} tools` 세그먼트는 제거된 Tool Area 참조라 이중 stale.
- **옵션**:
  - 코드 구현: 두 노드에 summaryTemplate 또는 전용 동적 요약 빌더. 장점: spec 정합·캔버스 가독성. 단점: mini-DSL 로는 'Multi Turn' 접두어·조건부 `· {N} KB` 조합 불가 → DSL 확장 또는 전용 빌더 필요(범위 중).
  - spec 하향: §8/§11/§8 두 행을 '미구현(Planned)' 또는 현 동작(warning 배지만)으로 축소 기술. 장점: 빠름. 단점: 캔버스 정보 밀도 약속 철회.
- **권장**: spec 하향(부분) + 코드 위생. DSL 확장 비용 대비 cosmetic 이득이라 Planned 마킹이 합리적. 단 `{N} tools` 세그먼트는 Tool Area 제거에 맞춰 spec 에서 즉시 삭제(stale 정정).
- **트레이드오프**: 요약 미표시는 기능 손실 아닌 보조 정보 부재 — 보류 허용.

### V-14 [minor] Re-run 모달 (원본 ID 링크 + typed 동적 폼)
- **갭**: 5-system/13-replay-rerun §10.2 는 (a) 원본 ID 클릭 시 새 탭 상세 링크, (b) manual_trigger 스키마 기반 typed 동적 폼(체크박스 등)을 명시 vs `rerun-modal.tsx` 가 ID 를 링크 없는 span 으로, 폼을 inputData.parameters 키 전부 텍스트 Input 으로 렌더(manual_trigger config 미조회). 나머지 계약은 정확히 일치.
- **옵션**:
  - 코드 구현: ID 를 `/workflows/:wid/executions/:id` 새 탭 링크로, 폼을 manual_trigger config 스키마 기반 typed 폼으로. 장점: spec 충족·타입 안전한 입력. 단점: manual_trigger config 조회 + 위젯 매핑 추가.
  - spec 하향: §10.2 두 진술을 현 구현(plain 텍스트 ID, 키 기반 텍스트 폼)으로 완화. 장점: 빠름. 단점: 잘못된 타입 입력 가능성 잔존(예: boolean 을 텍스트로).
- **권장**: 코드 구현(약). typed 폼은 입력 정합성 이득. ID 링크는 저비용. 단 minor 라 후속.
- **트레이드오프**: 현행도 동작하므로(텍스트로 입력 가능) 우선순위 낮음.

### V-18 [minor] 위젯 재로드 복원 시퀀스
- **갭**: 7-channel-web-chat/3-auth-session §3.1 은 복원 시 GET 상태 확인(200→SSE 재연결 / 410→storage 정리+[ended] / 401→낙관적 refresh 1회)을 규정 vs `use-widget.ts` 복원 경로가 상태 확인 없이 저장 세션으로 SSE 직행(`getStatus` 미호출, openStream lastEventId 는 dead param). 2026-06-03 이전부터의 상태이며 이를 추적하던 followups 는 parked(활성 TODO 0).
- **옵션**:
  - 코드 구현: §3.1 복원 시퀀스·SSE snapshot 폴백 구현 후속 plan(followups 재개). 장점: 만료/blacklist 토큰 시 올바른 [ended] 전이·복원 견고성. 단점: SSE 재연결·refresh·snapshot 폴백 구현 범위 큼.
  - 보류(spec 명시): v1 은 SSE 직행 복원, 상태확인/낙관적 refresh 는 후속임을 §3.1 본문에 명시해 partial 범위를 식별 가능하게. 장점: 빠름·정직. 단점: 견고성 갭 잔존.
- **권장**: 보류 + spec 명시. 추적 활성 항목이 없고 forward drift 아닌 기존 partial 이라, 우선 §3.1 에 v1 범위 단서를 달아 정직하게 표기하고 구현은 followups 재개 여부로 별도 결정.
- **트레이드오프**: 토큰 만료 복원 시 console.warn 만 남고 [ended] 전이 부재라는 견고성 결함은 구현 전까지 잔존.

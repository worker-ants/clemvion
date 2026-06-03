---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# spec-sync 후속 — 구조 정규화 + 동기화 중 발견된 코드 갭

> 출처: 2026-06-03 spec 전수 코드정합성 동기화 (review/spec-coverage/2026/06/03/08_05_49).
> 본 동기화는 **spec 본문/frontmatter 를 코드에 맞춤**. 아래는 (A) 링크/가드 영향이 커 의도적으로 보류한 구조 변경, (B) 단일-파일 범위 밖이라 미처리한 cross-spec 정리, (C) 동기화 중 발견한 **코드 측 갭/버그**(developer 영역) 를 추적.

## A. 구조 정규화 (project-planner, rename/split — 링크·가드 동반 갱신 필수)

- [ ] **5-system/0-overview.md 신규** — 5-system 은 `0-overview` 없이 `1-auth` 부터 시작(다른 영역은 0-overview 보유). 영역 기술개요 진입 문서 신규 작성 검토. 신규 파일이라 링크 영향 없음 — 안전.
- [ ] **version-history 영역 재배치 검토** — `spec/2-navigation/12-workflow-version-history.md` 는 에디터 결합이 강해 `spec/3-workflow-editor/` 로 옮길 후보. 단 cross-area 상호링크·frontmatter `code:`·user-guide `spec:` 참조 다수가 깨지므로 **단독 적용 금지**. 옮길 경우 INCLUDE_PREFIXES·역참조 일괄 갱신.
- [ ] **4-nodes/4-integration/_product-overview §4 Marketplace 분리** — vaporware(Marketplace/커스텀 노드 게시)를 별도 `backlog`/`spec-only` 문서로 split 검토(implemented 본문 혼재 오해 감소).
- [ ] **노드 카테고리 `_product-overview.md` 비대칭** — `3-ai`/`4-integration` 만 보유, `1-logic`/`2-flow`/`5-data`/`6-presentation`/`7-trigger` 는 `0-common.md` 가 인덱스 겸함. 현 패턴 내부 일관 — 강제 추가 권장 아님(보류, 기록만).
- [ ] **4-nodes/0-overview.md frontmatter** — basename `0-overview.md` 라 가드 면제이나, 추적성 위해 선택적 `code:` 부여 검토(가드 의무 아님).

## B. cross-spec 정리 (단일-파일 동기화 범위 밖)

- [ ] **4-nodes/0-overview.md §2.4** — Integration 노드 카운트/cafe24 누락 stale (동기화에서 _product-overview 만 처리, 0-overview 는 미처리).
- [ ] **4-nodes/2-flow/0-common.md §4** — Workflow 노드 캔버스 요약 템플릿/'⚠ Missing workflow' 가 1-workflow.md 와 동일하게 미구현인데 0-common 은 Planned 표기 미적용(후속 동일 처리 필요).
- [ ] **3-workflow-editor/3-execution §10.13** — 노드 이벤트 명칭(node.started 등)이 §8.1 의 권위 표(execution. prefix)와 톤 정렬 필요.
- [ ] **data-flow/9-observability** — System Status SoT 참조가 5-system/16 과 2-navigation/15 두 갈래 — cross-spec consistency-check 로 정리 권장.
- [ ] **/docs 단일언어 cross-ref** — 13-user-guide 는 이중언어로 정정했으나 0-overview 등 다른 곳의 `/docs` 단일언어 cross-ref 잔존 가능 — 점검 필요.

## C. 동기화 중 발견된 코드 측 갭/버그 (developer 영역 — spec 은 코드 현실대로 기술 완료)

> spec 은 "코드 현실 + (계획) 표기" 로 정직하게 맞췄다. 아래는 코드를 고쳐야 spec 의 원래 의도에 도달하는 항목. 각 항목은 개별 `spec-sync-*-gaps.md` 스텁에도 분산 기재.

- [ ] **workflow-list 상태필터 비동작** — 클라이언트 `?isActive=true` vs 서버 `?status=active` (page.tsx:112 vs query-workflow.dto.ts). end-to-end 미동작.
- [ ] **chatChannel 비활성 webhook 410** — hooks.service.handleWebhook 이 isActive 체크에서 410 throw → R-CC-12 (d) 의 '202 silent skip + 인증 수행' 위반(Telegram non-2xx retry 폭주 위험). chatChannel 분기를 isActive 체크 앞으로.
- [ ] **variable-modification UI 무효 옵션** — frontend logic-configs.tsx:352-353 의 set_field/delete_field 가 backend 6종 화이트리스트에 없어 선택 시 reject 되는 무효 config 생성.
- [ ] **if-else regex 연산자 no-op** — schema 는 regex 허용하나 handler 가 미평가(condition-evaluator.util.ts:80-86 의도적 unset) → 항상 false. UI 차단 또는 평가 연결 결정 필요.
- [ ] **telegram /help dead-code** — hooks.service 에 /help 분기 있으나 parseTelegramUpdate 가 /help 를 null 반환해 영구 도달 불가.
- [ ] **notification.type CHECK vs 동적 type** — AlertsEvaluator 가 발사하는 `alert_<type>` 가 V052 CHECK 허용목록에 없어 INSERT 제약 위반 가능.
- [ ] **execution-history 목록 Nodes 열** — 목록 API 가 nodeExecutions 미반환 → Nodes 열 항상 '—'. DTO 보강 또는 집계 필드 추가.
- [ ] **dashboard/statistics/schedule** — Success Rate 분모·정렬 컬럼·/toggle 부재·기간 enum(1d vs custom) 등 (각 spec-sync gaps 스텁 참조).
- [ ] **discord/slack** — Reply 버튼→modal·file upload(filesUploadV2)·setupChannel verify_key cross-check 미구현.
- [ ] **DTO/스키마 완전성** — manual-trigger output schema 의 meta 미선언(.passthrough 의존), re-run.dto dryRun '미지원' stale 주석, LlmUsageSummaryDto 누락 필드 등.
- [ ] **dead export/declaration** — CAFE24_RESOURCE_LABELS(types.ts:199), chart legacy export, websocket 'document:graph_error' union, UQ_node_workflow_label(마이그레이션 부재+synchronize:false 로 DB 미적용).

## 비고
- 본 plan 은 동기화의 부산물 추적용. A/B 는 planner, C 는 developer 가 picking.
- 전체 근거: `review/spec-coverage/2026/06/03/08_05_49/SUMMARY.md` + `findings/<area>.md` + 각 `plan/in-progress/spec-sync-*-gaps.md` 스텁의 unresolved 항목.

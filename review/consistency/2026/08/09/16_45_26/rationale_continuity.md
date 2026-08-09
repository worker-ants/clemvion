# Rationale 연속성 검토 보고서

## 검토 범위 메모

- 검토 모드: `--impl-prep`, scope=`spec/conventions/` — target 은 diff 가 아니라 `spec/conventions/` 디렉토리 전체 bundle(이미 저장소에 존재·병합된 내용)이다.
- 실제 이 worktree(`backend-typecheck-gap-3d7a91`)의 unstaged 변경은 `codebase/backend/src/modules/{chat-channel,execution-engine,executions,integrations,workflows}/**/*.spec.ts` 5개 파일뿐이며, 모두 mock 시그니처/누락 import 를 실제 프로덕션 타입에 맞추는 **기계적 TS 타입체크 정합 수정**이다 (`renderSlackEvent` 3번째 인자 제거, `updateExecutionStatus` 4번째 `opts` 인자 미러링, `reRun` 8번째 인자 `workspacesService` 보강, `expirePendingInstalls` 8번째 인자 `cafe24RefreshQueue` 보강, `SaveCanvasDto` import 추가). 이 변경들은 `spec/conventions/` 의 어떤 설계 결정도 건드리지 않으며 새 Rationale 이 필요한 성격이 아니다.
- 따라서 본 검토의 실질 대상은 "이미 존재하는 `spec/conventions/` 문서가 자신이 인용하는 Rationale(같은 문서 내부 + cross-reference 되는 다른 spec 문서)과 정합한가" 이다. prompt bundle 은 컨텍스트 예산 초과로 `spec/conventions/` 하위 263개 파일(대부분 cafe24/makeshop field-level 카탈로그, 그리고 `error-codes.md`/`execution-context.md`/`secret-store.md` 등 상위 컨벤션 다수)과, cross-reference된 spec 문서 72개(`5-system/1-auth.md`, `5-system/15-chat-channel.md`, `data-flow/1-audit.md`, `data-flow/12-workspace.md`, provider 문서 등 포함)의 본문을 생략했다. 이 리뷰어는 저장소 파일시스템에 직접 접근 가능하므로, bundle 에 없는 해당 원본 파일들을 `Read`/`grep` 으로 직접 열어 핵심 cross-reference를 교차검증했다 (아래 상세).

## 교차검증 상세 (문제 없음 확인)

1. **`audit-actions.md` ↔ `spec/5-system/1-auth.md §4.1.A`** — `workspace.transfer_ownership` 을 "도메인 고유 동사(§2.3)"로 분류하고 `created`/`updated` 만 과거분사(§2.1)로 두는 것, `model_config` 를 `set_default` 때문에 현재형(§2.2) 예외로 유지하는 것 모두 1-auth.md §4.1.A 본문과 문자 그대로 일치. `execution.re_run`(cross-audit G-02 정정)의 선례도 양쪽에서 동일하게 인용됨.
2. **`audit-actions.md` §3 하단 각주 ↔ `spec/data-flow/12-workspace.md` Rationale "workspace.deleted 감사 제외" / `spec/data-flow/1-audit.md`** — `workspace.deleted` 미등재 사유(`ON DELETE CASCADE`, V001)가 3개 문서에서 동일하게 서술됨. 모순 없음.
3. **`cafe24-api-metadata.md` Rationale "backend `label` 필드 제거"** — 본문 §2(Operation 메타데이터 형식)·§7.5 어디에도 `label` 필드가 재등장하지 않고 `labelKey`/`descriptionKey` 로 일관됨. 기각된 대안("deprecate 만 하고 유지")이 본문에 재도입되지 않았음을 실제 grep 으로 확인.
4. **`chat-channel-adapter.md` R-CCA-5/6/7/8 ↔ `spec/5-system/15-chat-channel.md`** — Rationale ID prefix 컨벤션(`R-CCA-N` vs `R-CC-N`), `EIA-RL-04`(TX commit 후 발송), R8(per-trigger `ChannelListenerRegistry` silent skip), R-CC-15(d)(분류 helper와 `chat_channel_health` 의 자원 분리) 등 상호 인용이 양쪽 문서에서 정확히 대응. 특히 R-CCA-8("Native form modal 예외")은 스스로 "R4 가 기각한 대안의 재도입이 아니라 R4 본문이 예고한 미래 경로(v2 옵션)의 활성화"라고 명시적으로 근거를 남기며, R4 의 핵심 가치(채널 간 일관성)가 어떻게 보존되는지(`formMode` opt-out, capability 기반 자동 다단계 fallback)까지 서술 — 이는 본 checker 가 요구하는 "결정 번복 시 새 Rationale 동반" 기준을 정확히 충족하는 모범 사례임.
5. **`cafe24-api-catalog/*.md` (store/category/translation)** — 표 형식·sync 정책 근거는 `_overview.md` §2/§4/§7 을 SoT 로 위임하고 자체 Rationale 은 데이터 정정 이력(미문서화 seed 9개 제거 등)만 남기는 구조로, 상위 문서와 충돌 없음.

위 5개 축 모두 "기각된 대안 재도입"·"합의 원칙 위반"·"무근거 번복"·"invariant 우회" 패턴이 발견되지 않았다.

## 발견사항

- **[INFO] 미검증 잔여 표면 — 263개 conventions 파일 + 72개 cross-reference spec 파일**
  - target 위치: `spec/conventions/` 전체 (bundle 에서 컨텍스트 예산으로 생략된 목록. 예: `error-codes.md`, `execution-context.md`, `secret-store.md`, `node-cancellation.md`, `node-output.md`, `interaction-type-registry.md`, `conversation-thread.md`, `migrations.md`, `frontend-layering.md`, `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `cafe24-restricted-scopes.md`, `makeshop-api-catalog/**`, `makeshop-api-metadata.md`, 및 cafe24 field-level 카탈로그 대부분)
  - 과거 결정 출처: 해당 파일들의 `## Rationale` 자체 (본 세션에서 원문 미확인)
  - 상세: 이번 검토는 대표 표본(audit-actions.md, cafe24-api-metadata.md, cafe24-api-catalog/{_overview,category,store,translation}.md, chat-channel-adapter.md)과 이들이 실제로 인용하는 cross-reference 문서(1-auth.md, data-flow/1-audit.md, data-flow/12-workspace.md, 15-chat-channel.md)를 직접 열어 교차검증했으나, 나머지 파일들은 이번 turn 의 실제 코드 변경(backend `*.spec.ts` 타입 정합)과 무관해 전수 검증하지 않았다. "생략됐다는 사실을 내용 부재의 근거로 삼지 말라"는 bundle 주의사항을 존중한다.
  - 제안: 별도 조치 불요 — 향후 이 생략된 파일들을 대상으로 실제 spec 변경(`project-planner`)이 발생하면, 그 시점의 `consistency-check --spec` 이 해당 파일의 Rationale 을 온전히 로드해 검증하게 된다. 이번 turn 은 그 파일들에 대한 변경이 없다.

## 요약

이번 `--impl-prep` 요청의 target 은 `spec/conventions/` 전체 bundle(diff 아님)이며, 실제 이 worktree 의 코드 변경은 5개 `*.spec.ts` 파일의 mock 시그니처/누락 import 를 프로덕션 타입에 맞추는 순수 기계적 TS 타입체크 정합 수정으로, `spec/conventions/` 의 어떤 결정도 재론하거나 우회하지 않는다. Bundle 에 포함된 대표 컨벤션 문서(audit-actions, cafe24-api-metadata, cafe24-api-catalog 계열, chat-channel-adapter)를 이들이 인용하는 원본 spec 문서(1-auth.md §4.1.A, data-flow/1-audit.md, data-flow/12-workspace.md, 15-chat-channel.md)와 직접 대조한 결과 전 항목이 일치했고, 오히려 chat-channel-adapter.md 의 R-CCA-8 처럼 "과거 결정을 뒤집을 때 그것이 재도입이 아니라 예고된 확장임을 근거와 함께 명시"하는 모범적 Rationale 연속성 관리가 관찰됐다. 컨텍스트 예산으로 생략된 263개 잔여 conventions 파일은 이번 diff 와 무관해 전수 검증하지 않았으며 이는 INFO 로만 기록한다.

## 위험도
LOW

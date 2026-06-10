---
name: kb-model-change-reembed-followup
owner: developer
worktree: (unstarted)
started: 2026-06-06
---

# KB 임베딩 모델 변경 시 재임베딩 미트리거 — 근본 원인 후속

## 배경

`kb-unsearchable-warning` (PR #508)은 `embedding_dimension == null` KB의 검색 불가를
**신호로 노출**하는 데 집중했다. 그러나 근본 원인은 그대로 남아 있다:

`KnowledgeBaseService.update()` (`knowledge-base.service.ts:152`)는 임베딩 모델을
바꾸면 `embedding_dimension` 을 NULL 로 초기화하지만 **재임베딩을 자동 트리거하지
않고, 문서 embedding_status 도 건드리지 않는다**. 사용자가 수동으로 `reEmbedAll` 을
실행하지 않으면 KB 는 **경고만 뜬 채 영구 검색 불가** 상태로 남는다.

## 검토한 선택지 (비용·UX 정책 결정)

1. **모델 변경 시 재임베딩 자동 트리거** — `update()` 가 모델 변경을 감지하면
   `reEmbedAll` 을 fire-and-forget 큐잉. 단 graph 모드는 추출 LLM 비용이 추가로
   발생하므로 비용 통제와 상충(현재 spec은 "비용 통제 위해 수동 트리거" 명시).
2. **저장 차단 + 강제 확인 모달** — 모델 변경 저장 시 "재임베딩이 필요하며 비용이
   발생합니다. 지금 시작할까요?" 확인을 강제. 사용자가 명시 동의해야 저장.
3. ✅ **(채택) 변경 후 재임베딩 미실행 상태를 더 강하게 노출** — 목록 경고(§2.2.1)에
   더해 **KB 상세 상단 배너 + "지금 재임베딩" CTA**. 자동 비용·저장 마찰을 만들지
   않고 발견 지점에서 1-클릭 조치. 기존 `POST /re-embed` 재사용, 신규 API 없음.

## 결정 (사용자 confirm 2026-06-11)

**선택지 ③ 상세 배너 강화** 채택. ①(자동 트리거)은 graph 추출 LLM 비용 부담,
②(저장 차단)은 UX 마찰이 커 보류. ③은 비용·상태전이 변화 없이 조치 동선만 보강한다.

## SoT / spec 갱신 (project-planner — 본 후속의 spec 단계)

- `spec/2-navigation/5-knowledge-base.md` §2.4.1 **검색 불가 배너**(idle/in_progress + [지금 재임베딩] CTA) + R-3 추가, frontmatter status partial + 본 plan 을 pending_plans 에 등록 — **본 spec PR에서 완료.**
- `spec/5-system/9-rag-search.md` §6 not_searchable 신호 — 선행 PR(#508/#511)에서 이미 도입, 변경 불요.
- `spec/5-system/8-embedding-pipeline.md` §7.3 재임베딩 — ③은 파이프라인 동작 무변경(자동 트리거 아님)이라 변경 불요.

## 남은 작업 (developer 구현 단계)

- [ ] worktree 설정 + `consistency-check --impl-prep`
- [ ] 테스트 선작성 — `[id]/page.tsx` 상세 배너 3종(idle+editor CTA / idle+비-editor 텍스트만 / in_progress 진행표시), CTA→ConfirmModal→`POST /re-embed` 배선, 재임베딩 완료 시 배너 소멸
- [ ] 구현 (상세 배너 컴포넌트 + RoleGate + 기존 re-embed 호출 재사용 + i18n ko/en 키)
- [ ] TEST WORKFLOW (lint/unit/build/e2e)
- [ ] `/ai-review` + critical/warning fix
- [ ] `consistency-check --impl-done`
- [ ] 완료 시 5-knowledge-base.md status partial→implemented 복귀 + pending_plans 에서 본 plan 제거 + plan complete/ 이동

## 비고

**spec 선갱신 의무(충족)**: 정책 결정 ③ 확정 후 project-planner 가 위 spec 단계를
먼저 확정한 뒤 developer 가 구현한다 (spec diverge 방지). consistency --impl-done
07_15_48 WARNING#1 반영.

**consistency-check --spec 결과**: `review/consistency/2026/06/11/07_50_44/SUMMARY.md`.
Plan Coherence 가 BLOCK:YES(Critical 1) 를 냈으나 **baseline-read false positive 로
확정**(checker 가 origin/main 옛 plan 을 읽어 "결정 미기재" 오판 — 본 변경분 plan 은
위 `## 결정` 절에서 ③ 채택을 명기). git 실측 반증은 SUMMARY 말미 "호출자 사후 판정"
절. WARNING(merge 충돌·API 중첩·Overview 누락)도 FP 또는 pre-existing/systemic 으로
본 PR 범위 밖. 따라서 main 판정 BLOCK:NO — spec 진행.

**구현 착수 시 참고**: 선택지 ③ 은 본 spec PR 의 §2.4.1·R-3 에 반영됨(SoT). developer 는
해당 spec 을 SoT 로 삼아 위 "남은 작업" 체크리스트로 착수한다. 배너는 X 버튼 없는
auto-dismiss inline alert, CTA 는 editor 한정·기존 `POST /re-embed` 재사용.

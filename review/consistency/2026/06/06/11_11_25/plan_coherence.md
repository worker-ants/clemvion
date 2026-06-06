## 발견사항

- **[WARNING]** `spec/5-system/7-llm-client.md §3.3` 의 미래 방향 주석과 target 변경의 배제 의도 미명시
  - target 위치: `plan/in-progress/spec-update-llm-embed-signature.md §제안 변경 / 7-llm-client.md §8.3`
  - 관련 plan: 직접 관련 in-progress plan 없음. `7-llm-client.md §3.3` 현재 본문에 다음 Planned 노트 존재:
    > "EmbedResponse 도입 시 옵션 객체로 통합 검토. `inputType` 도 그와 같은 이유로 응답 객체화 대신 위치 인자 확장을 채택"
  - 상세: target 은 `opts` 를 §3.3(LLMClient 인터페이스) 이 아닌 §8.3(LlmService 서비스 레이어)에 추가하는 것으로 스스로 교정했으며, 이는 적절하다. 다만 §3.3 `LLMClient` 인터페이스 주석(`embed(texts, model?, inputType?)`)은 여전히 `opts` 없이 남는다. `LlmService.embed` 가 서비스 래퍼로서 `opts` 를 추가 계층에서만 받는 것이 의도적 설계인지, 아니면 `LLMClient` 인터페이스도 함께 갱신해야 하는지가 plan 에 명시되지 않았다. 이 구분이 없으면 후속 개발자가 §3.3 도 변경해야 하는지 혼동할 수 있다.
  - 제안: target plan 에 "§3.3 LLMClient 인터페이스는 opts 추가 대상이 아닌 이유(timeoutMs/disableInnerRetry 는 서비스 래퍼 전용 재시도/타임아웃 파라미터이므로 클라이언트 인터페이스에 노출 불요)" 를 한 줄 명시. 또는 실제 코드를 확인해 `LLMClient` 인터페이스도 갱신이 필요하면 target plan 변경 범위에 포함.

- **[INFO]** `rag-rerank-followup.md` 가 `spec/5-system/7-llm-client.md` SoT 선언 + `pending_plans` 등재
  - target 위치: `plan/in-progress/spec-update-llm-embed-signature.md` 전체
  - 관련 plan: `plan/in-progress/rag-rerank-followup.md`
  - 상세: `7-llm-client.md` frontmatter 에 `pending_plans: [plan/in-progress/rag-rerank-followup.md]` 가 등재되어 있고, 해당 plan 은 모든 surface 완료 후 해당 spec 을 `implemented` 로 승격하는 것을 수용 기준으로 명시한다. target 의 embed 시그니처 수정(opts 추가)은 리랭킹 surface 와 무관하므로 충돌 없음. `rag-rerank-followup` 의 `conditional escalate` 항목이 아직 미완(P0 의존)이어서 spec 은 partial 유지 — target 변경이 이 상태를 바꾸지 않으므로 문제 없음.
  - 제안: 조치 불요. 정보성 기록.

- **[INFO]** `rag-quality-improvement.md` 가 `spec/5-system/8-embedding-pipeline.md` 미래 갱신 예정
  - target 위치: `plan/in-progress/spec-update-llm-embed-signature.md §제안 변경 / 8-embedding-pipeline.md §5.4`
  - 관련 plan: `plan/in-progress/rag-quality-improvement.md` (P2/P3 미착수 단계)
  - 상세: `rag-quality-improvement.md` 의 미착수 P2/P3 단계들이 `8-embedding-pipeline.md` 청킹·색인·enrichment 절을 갱신할 예정이나, target 이 수정하는 §5.4(LlmService.embed 인자 서술)는 그 범위와 다른 절이다. target 은 `config` 인자 누락이라는 오기 수정만 수행하므로 경합 없음.
  - 제안: 조치 불요. 정보성 기록.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석:

- `rag-eval-harness-b8cc46` (branch `claude/rag-eval-harness-b8cc46`) — Step 1: ACTIVE (ancestor 아님). Step 2: PR #488 MERGED → **stale**. `rag-rerank-followup.md` 를 공유하며 `7-llm-client.md` 를 SoT 로 참조하나 stale 처리.
- `rag-eval-plan-hygiene-279c3e` (branch `claude/rag-eval-plan-hygiene-279c3e`) — Step 1: ACTIVE (ancestor 아님). Step 2: PR #489 MERGED → **stale**. `8-embedding-pipeline.md` 참조하나 stale 처리.

두 worktree 모두 PR 이 MERGED 됐음에도 물리 디렉터리가 남아 있다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target (`plan/in-progress/spec-update-llm-embed-signature.md`) 은 `spec/5-system/7-llm-client.md §8.3` 과 `spec/5-system/8-embedding-pipeline.md §5.4` 의 소형 SPEC-DRIFT 수정이다. 미해결 결정 우회·선행 plan 미해소·active worktree 경합은 없다. 유일한 주의사항은 `§3.3 LLMClient` 인터페이스 대비 `opts` 배제 의도가 plan 에 명시되지 않은 점(WARNING) — plan 한 줄 추가로 해소 가능하다. worktree 충돌 후보 2건(rag-eval-harness-b8cc46, rag-eval-plan-hygiene-279c3e)은 모두 stale(PR #488, #489 MERGED)로 skip; active 충돌 없음.

---

## 위험도

LOW

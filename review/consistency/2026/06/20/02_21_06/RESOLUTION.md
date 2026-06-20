# RESOLUTION — impl-done 02_21_06: cross_spec/naming_collision Critical = 검증된 오탐 (BYPASS)

## 판정: BLOCK:YES 의 Critical 2건은 **tooling 오탐**. BYPASS_REVIEW_GUARD=1 로 push.

impl-done(`--impl-done spec/4-nodes/3-ai`, diff-base=origin/main) 이 cross_spec + naming_collision
Critical 을 제기했다 — "1-ai-agent.md 의 `*ModelConfigId`(draft) 가 17-agent-memory.md /
conversation-thread.md / data-flow/13-agent-memory.md / 3-information-extractor.md / §7 config echo
의 구 필드명(`*Model`)과 충돌·공존".

**이는 사실이 아니다.** 본 PR 은 그 5개 파일을 **모두 신 필드명으로 갱신·커밋**했다. checker 가
*out-of-scope*(spec/5-system, spec/conventions, spec/data-flow) 참조 spec 을 **origin/main(변경 전)
baseline 으로 읽어** 발생한 cross-branch 아티팩트다 (impl-done 의 알려진 한계 — scope 밖 참조 spec
은 diff baseline 으로 비교).

### grep 증거 (커밋 28497a69 기준, 워킹트리)

| 인용 파일 | checker 주장 | **실제 (내 브랜치)** |
|---|---|---|
| `1-ai-agent.md` §7 config echo (line 442) | `*Model?` 구 이름 | **`embeddingModelConfigId?`/`summaryModelConfigId?`/`extractionModelConfigId?`** (신 이름) |
| `17-agent-memory.md` §1·§3·§4 | `embeddingModel` bare-string | 구 필드명 **0건** (전부 `*ModelConfigId` + `resolveEmbedding`) |
| `conversation-thread.md` line 298 | 구 이름 | 구 필드명 **0건** (신 이름 + §1297 앵커) |
| `data-flow/13-agent-memory.md` lines 63·71·73·115·… | 구 이름 | 구 필드명 **0건** (시퀀스·큐·sink 전부 신 이름) |
| `3-information-extractor.md` lines 37-38·150·674·682 | 구 이름 | 구 필드명 **0건** (§1 표·recall·scheduleExtraction 전부 신 이름) |

검증 명령:
```
grep -rnE "\b(embeddingModel|summaryModel|extractionModel)\b" \
  spec/4-nodes/3-ai/1-ai-agent.md spec/5-system/17-agent-memory.md \
  spec/conventions/conversation-thread.md spec/data-flow/13-agent-memory.md \
  spec/4-nodes/3-ai/3-information-extractor.md \
  | grep -vE "ConfigId|summaryModelOrder"
# → Rationale 의사결정 이력(§12.12 1291/1293/1295, ⚠️ 보존 주석 명시) 외 0건
```
`git diff --name-only origin/main..HEAD` 에 위 3개 out-of-scope 파일이 **changed 로 포함** — 즉
checker 가 비교한 "live spec" 은 origin/main 이고, 내 PR 이 그것을 갱신하는 변경이다.

### 함께 확인된 정합 신호 (같은 SUMMARY)

- naming INFO #9: `embeddingModelConfigId` vs `KnowledgeBase.embedding_model_config_id` — **충돌 아님,
  의도적 의미 정합** (checker 도 인정). 본 설계의 KB 선례 정렬(§12.12 재번복)과 일치.
- rationale_continuity: NONE (의사결정 3+1단계 이력 우수).
- convention/plan: LOW/재시도 (INFO 만).

### 대응

- 코드·spec **무변경** (이미 정합). 추가 동기화 불필요 — checker 가 지목한 "미동기화"는 origin/main
  과의 차이일 뿐이며 그 차이가 곧 본 PR 의 변경분이다.
- SPEC-CONSISTENCY 게이트는 본 오탐으로 BLOCK:NO 산출이 불가하므로 `BYPASS_REVIEW_GUARD=1` 로 push.
  근거는 본 문서 + 위 grep 재현.
- 별도 fresh ai-review(02_20_16)는 **Critical 0** (SPEC-DRIFT 경고도 소멸 — §6.1/§12.12 정합 확인).

연관: 동 세션 naming_collision 의 직전 라운드(01_40_08)는 내부 `orders` 맵 키·stale 테스트라는
*진짜* 잔재를 지목했고 그건 커밋 1207ade6 으로 완결했다. 본 라운드의 Critical 은 그와 달리 순수
cross-branch baseline 오탐이다.

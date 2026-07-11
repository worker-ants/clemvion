# Cross-Spec 일관성 검토 — LlmUsageLog §2.16.1 → §2.24 재넘버링

- target: `spec/1-data-model.md` (§2.24 LlmUsageLog 신설/§2.16.1 삭제, §2.16 pointer 추가, ERD 트리 주석 갱신) + `spec/data-flow/7-llm-usage.md:133` (앵커 정정)
- diff base: 태스크 명시 base `1682777fe` (참고: 실제 `origin/main` 은 이후 `#910`(c96a61825, resume-llm-usage-attribution won't-do 기록)이 1커밋 추가로 진행되어 있어, 그 커밋 기준으로 diff 를 뜨면 `spec/5-system/4-execution-engine.md` 의 무관한 "기각된 대안" 단락이 삭제된 것처럼 보인다 — 이는 이 브랜치가 아직 그 커밋을 흡수하지 않은 rebase 차이일 뿐, 본 target 변경과 무관하므로 검토 대상에서 제외했다.)

## 발견사항

0건. 아래 5개 관점 모두 통과.

### 1. Dangling anchor 검사 — 통과

`grep -rn "2161-llmusagelog\|2\.16\.1" spec/` 결과, `spec/1-data-model.md:832` (§2.24 본문 안의 신규 "넘버링 주의" 설명 문단, 역사적 배경 서술 목적)를 제외하고 **spec/ 내 살아있는 링크·앵커 참조 0건**. `#2161-llmusagelog` 앵커 자체는 spec/ 어디에도 남아있지 않음(전량 §2.24/`#224-llmusagelog` 로 갱신 확인 — `spec/data-flow/7-llm-usage.md:133`).

참고(비대상, INFO 성격): `plan/complete/rag-rerank-impl.md:12` 가 `spec/1-data-model.md §2.16.1` 을 텍스트 라벨(앵커 fragment 없는 문서 링크)로 여전히 참조하지만, 이는 §2.24 신설 note 자체가 명시하듯 **unified-model-management 이전 RerankConfig 시절의 §2.16.1** 의미이고 이번 relocation 이전부터 존재하던 별개의 오래된 drift다(이번 변경으로 새로 생기거나 악화되지 않음, plan/complete 동결 문서). target 의 §2.24 새 "넘버링 주의" 문단이 정확히 이 사실을 사전 언급하고 있어 별도 조치 불요.

### 2. 필드 테이블 정확성 — 통과

`git diff`로 구 §2.16.1 본문과 신 §2.24 본문을 라인 단위 비교한 결과, 필드 테이블 14행(`id`~`created_at`) + 인덱스 3종 문구가 **바이트 단위로 동일** — 이동 과정에서 행 누락/변경 없음. 실제 스키마와도 일치:
- `codebase/backend/migrations/V014__llm_usage_logs.sql` — id/workspace_id(CASCADE)/workflow_id/execution_id/node_execution_id/llm_config_id(모두 SET NULL)/provider/model/prompt_tokens/completion_tokens/total_tokens/cost_usd/created_at + 인덱스 3종(workspace+created_at DESC, workflow_id partial, provider+model+created_at DESC) 전부 스펙 표와 일치.
- `codebase/backend/migrations/V018*.sql` — `thinking_tokens INTEGER` (nullable) 추가, 스펙 표의 "V018" 각주와 일치.
- `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts` — 컬럼 13개(+@Index 2개 데코레이터, 3번째 partial 인덱스는 SQL 마이그레이션으로만 존재 — 기존과 동일한 패턴) 모두 스펙 표와 1:1 대응.

### 3. §2.16 ModelConfig pointer + 참조 관계 라인 — 통과

`spec/1-data-model.md:608` 신규 pointer("§2.16 의 자식이 아니라 §2.24") 는 §2.16 Rationale 블록 바로 뒤, `### 2.17 AuthConfig` 바로 앞에 위치해 문맥상 자연스럽게 §2.16 절의 마무리 disambiguation 으로 읽힌다. §2.16 필드 테이블 하단의 `**참조 관계 (kind 별)**: chat → … · llm_usage_log.llm_config_id · …` (line 583) 은 FK 관계(`llm_config_id → ModelConfig`, `ON DELETE SET NULL`) 서술이라 섹션 번호 이동과 무관하게 그대로 유효 — 갱신 불필요, 모순 없음.

### 4. §3 인덱스 표 + ERD 트리 — 통과

- ERD 트리(`spec/1-data-model.md:38`): `├── LlmUsageLog (1:N)    # chat 사용량 로그 (§2.24)` — 신 번호로 정확히 갱신됨. 주석 스타일도 바로 위 `ModelConfig (1:N)   # kind: chat | embedding | rerank` 행과 동일 컨벤션 유지.
- §3 인덱스 표(`spec/1-data-model.md:905-907`, `LlmUsageLog` 3행) 는애초에 섹션 번호를 참조하지 않는 서술이라(엔티티명·컬럼·용도만 기재) 이번 이동으로 갱신할 내용 자체가 없음 — §2.24 본문의 인덱스 각주 3종과 내용도 일치.

### 5. 신규 요구사항 ID / 엔티티 / API — 없음

구/신 섹션 본문 diff 가 위 2번 확인대로 순수 재배치(헤딩 번호·pointer 문단·앵커 fragment 만 변경)임을 라인 단위로 확인 — 신규 필드·엔티티·API·요구사항 ID 도입 없음.

## 부수 확인 (참고, 비차단)

- `#216-modelconfig`(§2.16), `#2101-integrationusagelog`(§2.10.1) 등 기존 GitHub 헤딩 슬러그 컨벤션(`.` 제거, 공백→hyphen)과 `#224-llmusagelog` 앵커가 정확히 부합함을 대조 확인.
- 신규 "넘버링 주의" 문단이 근거로 든 대칭 사례 — `IntegrationUsageLog`(§2.10.1) 의 CASCADE 부모가 실제로 `Integration`(`integration_id … ON DELETE CASCADE`)인지 `spec/1-data-model.md:319` 에서 직접 확인 — 사실과 부합.
- `codebase/` 전역에 `2161-llmusagelog`/`2.16.1` 하드코딩 참조 0건(코드·테스트 어디에도 이 앵커에 의존하는 곳 없음) — 문서 전용 이동이 다른 레이어에 부작용 없음을 뒷받침(참고용, 이 검토의 정식 스코프인 spec/ 밖이라 등급 없음).

## 요약

LlmUsageLog 서브섹션의 §2.16.1 → §2.24 재넘버링은 순수 위치 이동이며, spec/ 전역에 구 앵커(`#2161-llmusagelog`)로의 살아있는 링크가 전혀 남아있지 않고, 필드 테이블·인덱스 각주가 마이그레이션(V014/V018)·엔티티 정의와 라인 단위로 완전히 일치한다. §2.16 ModelConfig 에 추가된 위치 안내 pointer 와 §2.24 에 추가된 "넘버링 주의" 설명은 근거(CASCADE 소유 부모=Workspace, IntegrationUsageLog 대칭, 구 §2.16.1=RerankConfig 시절 번호 재사용 방지)가 실제 스펙·코드 사실과 부합해 신뢰할 수 있다. ERD 트리·§3 인덱스 표도 갱신/정합 확인됐고 신규 요구사항 ID·엔티티·API 도입은 없다. 유일한 잔여 항목은 이번 변경과 무관한 과거 drift(`plan/complete/rag-rerank-impl.md` 의 §2.16.1 라벨, RerankConfig 시절 의미)이며 target 자신의 새 note 가 이미 그 배경을 정확히 설명하고 있어 추가 조치가 필요하지 않다.

## 위험도

NONE

STATUS: DONE

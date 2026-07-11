# consistency-check --spec SUMMARY — llm-usage 인접 문서 정합 (A-track)

draft: `plan/in-progress/spec-llm-usage-adjacent-docs.md`. 대상 spec: `1-data-model.md`,
`data-flow/6-knowledge-base.md`, `data-flow/13-agent-memory.md`, `data-flow/7-llm-usage.md`.

## 최종: **BLOCK: NO** (최초 CRITICAL 1건 → 정정 + reverify 로 해소)

## 1. 최초 회차 (3 checker)

| Checker | 등급 | 발견 | 처분 |
|---|---|---|---|
| rationale_continuity | **CRITICAL** | A3 를 "lean 포인터(필드 표 없음)"로 신설하려던 것이 `0-overview.md ## Rationale`("1-data-model.md = 엔티티 정의 단일 진실") + 실측(§2.1~§2.23 모든 엔티티가 full 표, 외부 SoT 를 둔 §2.23 AgentMemory 포함) 관행 위반 | **FIX**: A3 → full 필드 표 |
| cross_spec | LOW(WARNING+INFO) | 동일 lean 예외 지적(WARNING). A1 정확·A2/A4 no-op 판단 타당·A3 내용(컬럼/nullable/attribution) §2.1 정합 확인. 역링크 부재 INFO | A3 full 표로 해소 + 역링크 추가 |
| convention_compliance | LOW(WARNING+INFO) | A3 7-llm-usage 링크에 `./data-flow/` prefix 필요(빌드가드) WARNING. 부분필드 나열·FK 배치 INFO | 링크 경로 `./data-flow/` + CASCADE 명시로 해소 |

## 2. 적용 (spec)

- **A1** — `6-knowledge-base.md:348`·`13-agent-memory.md:231`: "모든 LLM 호출 적재" → "chat 계열만 적재(embed 미적재) — §1.3".
- **A3** — `1-data-model.md` §2.16.1 LlmUsageLog **full 필드 표**(V014+V018 DDL: 14컬럼, CASCADE 부모=Workspace/나머지 SET NULL) + `> 관련 문서:` SoT 오프너 + ERD 트리 `LlmUsageLog (1:N)` + §3 인덱스 표 3행 + `7-llm-usage.md §2.1` 역링크. 링크는 `./data-flow/7-llm-usage.md`(prefix).
- **A2·A4 = 변경 없음** (검증 결과 이미 정합 — draft §검증 결과).

## 3. 재검증 (`reverify/`, 적용 후)

| Checker | 등급 | 결과 |
|---|---|---|
| rationale_continuity | **NONE** | 직전 CRITICAL **완전 해소** — §2.16.1 full 표가 모든 엔티티 관행에 부합, 14컬럼이 V014/V018 DDL 과 정확히 일치, 0-overview 결정과 연속적. |
| convention_compliance | LOW | CRITICAL 없음. 잔여 polish 4건(FK 표기 순서 WARNING + INFO 3) → **모두 반영**(FK `ModelConfig` 우선 표기, §3 인덱스 표 등재, 오프너 스타일, 역링크 라벨 "데이터 모델"). |

## 4. 게이트 확인
- `spec-link-integrity.test.ts` 11/11 PASS (신규 앵커 `#2161-llmusagelog` + `./data-flow/` 링크 유효).
- spec-only 변경(codebase/** 0) — review/plan push gate 비발화 영역.

**BLOCK: NO — Critical 0 (재검증 확정).**

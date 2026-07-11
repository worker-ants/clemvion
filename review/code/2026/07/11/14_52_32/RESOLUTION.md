# RESOLUTION — DTO 위치 정규화 ai-review 14_52_32 (+ consistency 14_53_21)

/ ai-review: RISK=LOW, CRITICAL=0, WARNING=2, INFO=8
/ consistency --impl-done: BLOCK=NO (5 checker, rationale_continuity/plan_coherence 은 workflow disk-write gap 으로 journal.jsonl 에서 복구 — 둘 다 clean)

## 조치 항목

| # | 출처 | 발견 | 조치 | 근거 커밋 |
|---|------|------|------|-----------|
| W1 | ai-review WARNING #1 (arch·requirement·scope·maintainability 4명) + consistency plan_coherence | DTO 위치 정규화 plan 항목 체크박스 미갱신 | plan `line 16` 을 `[x]` + 완료 노트로 정정 | REVIEW WORKFLOW 커밋 |
| C1 | consistency convention_compliance·naming_collision WARNING | spec §10 "구현 파일 구조" 다이어그램이 삭제된 `responses.dto.ts` 를 계속 나열 | §10 코드블록을 `responses/` 3파일 구조로 갱신 | REVIEW WORKFLOW 커밋 |
| C2 | consistency cross_spec·convention_compliance·naming_collision WARNING | `interaction-type-registry.md:40` SoT 각주가 옛 경로 `external-interaction/dto/responses.dto.ts` 인용 | 각주 경로를 `dto/responses/execution-status-response.dto.ts` 로 갱신(`interactionType` enum 실제 위치) | REVIEW WORKFLOW 커밋 |

> C1/C2 는 spec 문서 편집이다. CLAUDE.md 상 `spec/` 는 planner 트랙이나, 두 건 모두 **본 PR 의 rename 이 직접 유발한 옛 파일명 인용의 기계적 정합화**(동반 갱신)이며 제품 정의·요구사항 변경이 아니다. "consistency WARNING 은 BLOCK:NO 여도 반영" 프로젝트 규약에 따라 적용하고, 사후 `--impl-done` 재실행으로 재검증했다. planner 사후 리뷰 대상.

## 보류·후속 항목

- **W2 (ai-review maintainability WARNING #2) — `status` 리터럴 유니온 SoT 통합**: `plan/in-progress/eia-context-schema-followups.md` §리뷰 후속에 신규 항목으로 이관. 사유: (1) 이 중복은 flat `responses.dto.ts` 시절부터 존재한 **pre-existing** 이며 본 PR(위치 정규화)이 도입/악화한 것이 아니다(두 클래스가 각자 유니온을 선언하던 상태를 파일만 분리). (2) 올바른 통합은 공유 타입의 거처(파일 간 결합 vs 신규 공유 파일)와 wire-doc 영향 판단이 필요한 별개 리팩터로 위치 정규화 범위 밖. (3) reviewer 가 제안한 "`ExecutionStatus` 엔티티 enum 파생"은 부정확 — DTO-엔티티 비결합(swagger §5-1) 원칙 위반 + 엔티티 enum 순서가 DTO 순서와 달라 wire-doc enum 배열을 바꾼다(로컬 리터럴 alias 로 통합해야 함). 또한 reviewer 의 "두 DTO 순서가 다름" 은 오판 — 실제로 양쪽 동일 순서(`pending,running,waiting_for_input,completed,failed,cancelled`).
- **INFO (ai-review)**: interactionType 중복·`OPEN_MAP_SCHEMA` 반복·`CurrentNodeDto` 필드 단위 스키마 검증·`WaitingContextBaseDto` phantom-schema 부재 단언·oneOf 순서 brittle·frontmatter worktree stale — 전부 저우선 비차단. 저위험이라 본 PR 미조치(필요 시 W2 후속과 함께 처리). frontmatter `worktree` 는 다중 worktree 진행 plan 의 알려진 표기(차단 아님).

## TEST 결과

- lint: 통과 (`stage=lint status=PASS`, 마지막 코드 커밋 `31bbbac31` 기준)
- unit: 통과 (`stage=unit status=PASS`; external-interaction 모듈 228 tests green — OpenAPI schema 회귀 가드 포함. spec-link-integrity 가드 13 tests green)
- build: 통과 (`stage=build status=PASS`)
- e2e: 통과 (`stage=e2e status=PASS tests=252 passed`, 마지막 코드 커밋 `31bbbac31` 기준). 본 REVIEW WORKFLOW 커밋은 `spec/**`·`plan/**`·`review/**` 문서만 변경 → e2e 면제 화이트리스트 부분집합(코드 변경 0줄).

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
- [ ] SUMMARY §2 audit 도메인 코드 갭 — audit 기록 커버리지(workflow.*/trigger.* 등 미기록)·action 표기 비일관(`re_run_initiated`) 정리
- [ ] Trigger→Schedule 역방향 is_active 동기화 미구현 (1-data-model §2.9.1 갭 표기 완료, 코드 결정 대기)
- [ ] integration-expiry-scanner 코드 주석 stale (`기본 10일` vs 실제 7일) 등 writer 들이 보고한 코드 주석/Swagger 문자열 정정 (developer)

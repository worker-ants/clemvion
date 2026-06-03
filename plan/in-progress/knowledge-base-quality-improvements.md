---
worktree: kb-quality-fba2f2
started: 2026-06-03
owner: developer
---

# 지식 저장소 품질 개선 (knowledge-base quality)

`spec/` · `plan/` · `review/` 지식 저장소의 품질을 한 단계 끌어올리기 위한 감사 결과와 실행 로드맵. 2026-06-03 4영역 실측 감사(링크 무결성 · QA 가드 인벤토리 · plan 라이프사이클 · spec 콘텐츠) 기반.

## Overview — 감사 결론

저장소의 **품질 인프라는 이미 강하고 콘텐츠도 건강**하다. 자동 가드(frontmatter 유효성, `code:` glob 생존성, spec→plan 링크, status 라이프사이클, i18n parity, mermaid 문법, 리뷰 커버리지 게이트, spec-drift Gate A/B)와 5종 on-demand consistency checker + spec-coverage 가 대부분의 차원을 덮는다. 콘텐츠 측면도 placeholder ≈ 0, `partial` 은 전부 `pending_plans` 추적, `implemented` 는 라인 단위로 코드와 일치.

따라서 개선 레버리지는 "rot 제거"가 아니라 **(a) 자동 가드의 명확한 사각지대를 기존 build-test 패턴으로 가드화** + **(b) plan/ 라이프사이클 위생**에 있다.

### 실측 핵심 갭

| 갭 | 실측 | 현재 커버리지 |
| --- | --- | --- |
| in-body 마크다운 링크/앵커 무결성 | 깨진 링크 110건 (dead 38 + anchor 72) | **없음** (frontmatter 경로만 검증) |
| plan-stale-audit 정확도 | `maxdepth 1` 로 28개 plan 누락(실제 92개), staleness=커밋나이만 | 도구 자체 결함 |
| plan worktree 필드 | 라이브 worktree 참조 3 / ~56 | 허구 데이터 → plan-coherence 무력화 |
| 완료된 plan 미이동 | 100% done 인데 in-progress 잔류 3건 | 수동 |
| plan frontmatter 스키마 | 위반 12건 (무 frontmatter 6) | **없음** |
| 영역 index 완전성 | 5-system 16중 4링크, providers index 부재 | **없음** |
| impl→spec 역방향 커버리지 | 신규 라우트/이벤트/env 미참조 invisible | Gate D 보류 |
| plan 완료 시 spec 정합 | 미강제 | Gate C 보류 |

## 실행 로드맵 (item 1~7)

### item 1 — in-body 링크/앵커 무결성 ⭐
청소 78건(확실) 적용 → 빌드 가드 신설 → green.

- [ ] `.kb-broken-links.tsv` confident 수정 78건 적용 (dead 19 + anchor 59)
- [ ] UNKNOWN 32건 개별 조사 (삭제된 타깃은 링크 제거/대체, 모호한 것은 보류 기록)
- [ ] `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 신설 — 본문 in-repo 링크 타깃 존재 + `#anchor` heading slug 대조 (GitHub slug, CJK 유지). 카탈로그 scope 제외(`isApplicable` 재사용)
- [ ] 전체 spec/plan green 확인 후 게이트 on

### item 2 — plan-stale-audit.sh 수정 + 완료 plan 이동
- [ ] `find -maxdepth 1` → 재귀화 (node-output-redesign/ 28개 포함)
- [ ] staleness 신호 보강: worktree 미존재 + branch merged + 체크박스 전부 done 복합 판정
- [ ] 완료 plan `git mv` → complete/: `eia-strip-llmcalls`(8/8), `fix-spec-frontmatter-catalog`(7/7), `channel-web-chat-demo`(22/22)
- [ ] (잔류 정당: `channel-web-chat-followups`·`followup-conversation-reconcile` — 보류항목 보유)

### item 3 — plan frontmatter 백필 + 가드
- [ ] 무 frontmatter 6건 백필: `ai-agent-tool-connection-rewrite`, `marketplace-and-plugin-sdk`, `merge-p2-async-fanin`, `node-cancellation-infrastructure`, `parallel-p2-followups`, `self-hosting-deployment`
- [ ] 부분 위반 6건 정규화 (`continuation-resume-optional-followups`, `eia-strip-llmcalls`, `followup-conversation-reconcile`, `chat-channel-secret-store-infra`, `chat-channel-visual-ssr-png` 등)
- [ ] `plan-frontmatter.test.ts` 신설 — `worktree`/`started`/`owner` 필수 + ISO 날짜 형식

### item 4 — worktree 필드 sentinel 정리
- [ ] 미착수 plan 의 placeholder(`TBD`·`(assigned at impl-start)`·인라인 주석 값) → 명시 sentinel `worktree: (unstarted)` 로 정규화
- [ ] `plan-frontmatter.test.ts` 가 sentinel 을 유효값으로 허용
- [ ] 결정: 보수적(레지스트리 분리 아님) — Rationale 참조

### item 5 — 거대 클러스터 트리아지 (비파괴적)
- [ ] `spec-sync-*` 31개 중 `⚠ decision-free 아님 → planner 결정 필요` 항목을 명시 분류(개발 착수가능 vs 기획 결정대기). 파일 mass-move 아님 — 표기/owner 조정
- [ ] `spec-sync-expression-language-gaps.md` 자기모순(일부 done/일부 blocked) 분리 표기
- [ ] `node-output-redesign/` README 상태표 stale 표기 갱신 (parked 명시)

### item 6 — 영역 index 완전성 + 가드
- [ ] `5-system/_product-overview.md` 형제 16개 전부 링크 (4-execution-engine 등 12개 누락 보강)
- [ ] `2-navigation` index 누락 6개 보강
- [ ] `4-nodes/7-trigger/providers/` index 신설 (slack·telegram·discord)
- [ ] `7-channel-web-chat` index `1-widget-app` 보강
- [ ] `spec-area-index.test.ts` 신설 — 영역 폴더 형제 spec 이 entry 문서에서 링크되는지 검증

### item 7 — Gate C/D 재개
- [ ] Gate D (advisory): spec-coverage reverse 모드 — `code:`/본문 어디서도 참조 안 되는 신규 controller route·event·ENV 탐지. high-confidence(spec-less 라우트)만 강조. `review/spec-coverage` 산출
- [ ] Gate C (hard): plan 이 complete/ 이동 시, 건드린 `code:`-linked 코드가 변했으면 spec-update 섹션 또는 "spec 변경 불요" 명시 강제 (`spec-pending-plan-existence.test.ts` 미러링)

## Rationale

- **왜 in-body 링크 가드가 최우선인가**: 결정적 판정(NLP 휴리스틱 아님)이라 FP 없이 하드게이트 가능하고, 기존 `spec-*.test.ts` 패턴과 동형이라 비용이 낮다. 또한 메모리 `reference_consistency_check_main_baseline_fp.md` 가 기록한 consistency-checker 의 dead-link false Critical 의 근원(=positive 가드 부재)을 동시에 제거한다.
- **item 4 보수적 선택(sentinel vs 레지스트리)**: worktree↔plan 매핑을 별도 레지스트리로 분리하는 대안은 ensure-worktree.sh·plan-coherence-checker 양쪽을 손대야 해 변경면이 넓다. 미착수 plan 에 명시 sentinel `(unstarted)` 를 두면 (a) plan-coherence 가 "죽은 worktree" 오탐을 멈추고 (b) 단일 진실이 plan frontmatter 에 유지된다. 더 큰 재설계가 필요하면 후속 plan 으로 승격.
- **item 5 비파괴 트리아지**: 31+28개 plan 의 mass-move/삭제는 진행 맥락을 파괴할 위험이 크다. git 으로 복구 가능하나, 1차로는 reclassify(개발 vs 기획 결정대기)·상태표기만 수행하고, 실제 이동은 owner(planner) 판단으로 분리.
- **Gate C/D 가 보류였던 이유와 재개**: `project_spec_drift_gate_backlog.md` 기준 A·B 만 적용되고 C·D 는 보류였다. D 는 NLP FP 위험으로 advisory 유지, C 는 결정적이라 hard 가능 — 두 보류 항목이 곧 남은 자동화 사각지대(impl→spec 역류·plan완료 정합)와 정확히 일치한다.

## 출처

4영역 감사 원자료는 본 세션 산출. 감사 스크립트/인벤토리: `.kb-broken-links.tsv` (worktree 루트, untracked).

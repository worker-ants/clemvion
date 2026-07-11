# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. WARNING 2건은 모두 비차단(범위 밖 브랜치 분기/표 완결성 갭)이며 target 자체의 신규 결정·구현은 인접 spec과 문구 단위로 정합함.

> 참고(운영): `rationale_continuity`·`convention_compliance` 두 checker 는 manifest 상 `status=success` 였으나 산출 파일이 디스크에 실제로 쓰이지 않은 상태였다(subagent write 가 non-terminal 인데도 미기록). 세션 journal(`~/.claude/projects/.../subagents/workflows/wf_af708a7a-d16/journal.jsonl`)에서 두 결과 원문을 복원해 본 통합에 반영했다 — 내용 손실 없음, 단 디스크상 `rationale_continuity.md`/`convention_compliance.md` 파일 자체는 여전히 부재하므로 후속 아카이빙 시 필요하면 journal 에서 재추출할 것.

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건은 (1) 문서 완결성 갭 1건(표 누락) (2) 병행 병합된 sibling PR #899 를 브랜치가 아직 흡수하지 못한 데서 오는 일시적 누락 1건(merge-tree 시뮬레이션상 충돌 없음, 자연 해소 예정)으로 구성.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `0-architecture.md` §3 "EIA 매핑" 표가 스스로를 "위젯이 사용하는 EIA 표면" 카탈로그로 표방하면서 위젯이 실제 구독하는 `execution.message` SSE 이벤트 행이 빠져 있음 | `spec/7-channel-web-chat/0-architecture.md` §3 표 | `spec/7-channel-web-chat/1-widget-app.md` §2(2번째 메시지 소스로 `execution.message` 명시), `5-admin-console.md` §6, EIA §5.2/§R18 | §3 표에 "표시 메시지(자동 진행 presentation)" 행 추가 — `SSE execution.message`, 참조 EIA §5.2·§R18. `ai_message` 와 "AI 생성 vs 표시-전용 정적 표시" 구분을 짧게 병기 |
| 2 | convention_compliance (+ cross_spec·naming_collision 교차확인) | 브랜치가 fork(`cc3dafa8c`) 이후 `origin/main` 에 병합된 sibling PR #899(`52f46f95f`, "R7 신설·§9 위젯 스코프 예외·conversation_thread 소비처 미러")를 아직 흡수하지 못해, SoT 워킹트리의 `conversation-thread.md` 에 §9 "임베드형 채널 위젯" scope-exception blockquote·§8.2 적용범위 단락·§4 소비처(rehydration/SSE emit/getStatus/egress 마스킹) 서술·frontmatter `code:` 의 `interaction.service.ts` 항목이 부재, `1-widget-app.md` 의 `### R7. 헤더 세션 컨트롤` Rationale 서브섹션도 부재. 현재 워킹트리만 읽으면 `1-widget-app.md` §2 의 2-way role 축약이 §9 "강제" 규정에 대한 명시적 carve-out 근거 없이 서술된 것처럼 보임 | `spec/conventions/conversation-thread.md` §8.2/§9/§4/frontmatter, `spec/7-channel-web-chat/1-widget-app.md` `## Rationale` 말미 | `origin/main` 커밋 `52f46f95f`/`1eda09081`(#899) | 최종 통합 전 `origin/main` 위로 rebase/merge 1회 — 3개 checker(cross_spec·convention_compliance·naming_collision) 모두 `git merge-tree` 시뮬레이션으로 실제 충돌 0건(양쪽 hunk 비중첩) 확인했으므로 merge-coordinator 표준 절차로 충분. **주의**: rebase 로 #899 의 R7("헤더 세션 컨트롤")을 흡수한 뒤, 아래 INFO #2(rationale_continuity 권고)의 신규 Rationale 항목은 번호 충돌을 피해 R7 이 아닌 **R8** 로 붙일 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 이번 diff 의 실질 설계 결정("위젯 렌더러가 두 presentation shape 을 통일 수용, `truncation` 메타 흡수, standalone 노드 표시물은 복원 범위 밖")의 근거가 `1-widget-app.md` 자신의 `## Rationale`(R4~R6)에는 반영되지 않고 `plan/in-progress/widget-presentation-restore.md`(R1~R3)에만 상세 기록됨. 차단 사유는 아님(본문 인라인 서술로 이해 가능) | `spec/7-channel-web-chat/1-widget-app.md` `## Rationale` | plan 이 `complete/`·`archive/` 로 이동한 뒤에도 spec 단독으로 결정 이력이 추적되도록 짧은 신규 항목 추가 권장 — 번호는 위 WARNING #2 rebase 이후 흡수될 origin/main 의 R7 과 겹치지 않게 **R8**로 |
| 2 | plan_coherence | governing plan `widget-presentation-restore.md` §5 가 스스로 식별한 사전 존재 spec drift 3건(`4-security.md` rate-limit "Planned" 오기재, `3-auth-session.md`/`4-security.md` embed-config envelope 표기 누락, NAV-WC-06 stale)이 "별도 팔로우업" 으로 산문(prose) 위임만 되어 있고 별도 `plan/in-progress/*.md` 트래커가 없음 — plan-lifecycle "미해결 follow-up 0건" 게이트가 checkbox 스캔이라 이를 놓칠 위험 | `plan/in-progress/widget-presentation-restore.md` §5 | governing plan 을 `complete/` 로 이동하기 전 §5 3항목을 `[ ]` checkbox 로 전환하거나 별도 `plan/in-progress/spec-fix-webchat-eia-drift.md` 로 분리 등록. target 문서 자체의 즉시 수정은 불요(고의적 범위 제외) |
| 3 | plan_coherence | `spec-sync-external-interaction-api-gaps.md` 의 `execution.replay_unavailable` 위젯 소비 후속 항목과 target(`1-widget-app.md` §3.1)의 "서버 emit 구현·위젯 리스너 no-op·로컬 폴백" 서술이 정확히 일치 — 조기 종결·반대 서술 없음 | `spec/7-channel-web-chat/1-widget-app.md` §3.1 | 조치 불요(정합 확인 기록) |
| 4 | convention_compliance | target 문서 자체의 명명·포맷·구조 규약(필드명·이벤트명·cross-ref 앵커·3섹션 구성)은 전수 확인 결과 전부 준수. 단, 본 checker 에 제공된 payload 의 "정식 규약 모음"이 `audit-actions.md`·`cafe24-api-catalog/**` 만 포함하고 실제로 target 이 인용하는 `conversation-thread.md`/`interaction-type-registry.md`/`error-codes.md`/`swagger.md`/`node-output.md` 는 누락 — checker 가 `spec/conventions/` 직접 열람으로 보완함 | `spec/7-channel-web-chat/1-widget-app.md`, `_product-overview.md` | 조치 불요(참고). consistency-checker payload 구성 스크립트가 `spec/conventions/` 인용 대상을 더 폭넓게 자동 포함하도록 개선 여지 있음(비차단, 도구 개선 백로그) |
| 5 | cross_spec / naming_collision | 2-ref `git diff origin/main..HEAD` 로 보면 `1-widget-app.md`/`conversation-thread.md` 의 R7·§9 blockquote 블록이 "삭제"되는 것처럼 보이나 실제로는 fork 이후 `origin/main` 이 sibling PR #899 로 추가한 내용이며 본 브랜치가 지운 게 아님(표준적 2-ref diff 아티팩트) | `spec/7-channel-web-chat/1-widget-app.md`, `spec/conventions/conversation-thread.md` | 위 WARNING #2 와 동일 근원 — rebase 로 해소. `git merge-tree` 로 무충돌 확인됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `0-architecture.md` §3 EIA 매핑 표에 `execution.message` 행 누락(WARNING) + origin/main #899 미흡수(INFO, 충돌 없음 확인) — 그 외 presentation shape/truncation 서술은 AI Agent §7.10·Presentation 공통 §10.4·EIA §R18 과 문구까지 정합 |
| rationale_continuity | LOW | 이번 결정의 근거가 spec 자신의 `## Rationale` 이 아닌 plan 문서에만 있음(INFO). 기각 대안 재도입·합의 원칙 위반·무근거 번복·암묵적 가정 충돌은 전부 없음 |
| convention_compliance | LOW | `conversation-thread.md` 위젯 scope-exception 규약 문서화가 브랜치 분기로 미반영(WARNING, #899 rebase 로 자연 해소) + R7 Rationale 미반영(INFO, 정보 손실 없음). target 자체 명명/포맷/구조 규약 준수는 양호 |
| plan_coherence | NONE | governing plan 결정 정확히 반영, 다른 in-progress plan 과 충돌 없음. §5 의 3건 사전 spec drift 가 산문 위임만 되어 추적 아티팩트 부재(INFO) |
| naming_collision | NONE | 신규 식별자(요구사항 ID·타입명·API·이벤트명·ENV 키·경로) 전무 — 기존 spec 필드를 위젯이 뒤늦게 흡수한 정정/버그픽스. 코드 신규 로컬 심벌(`TRUNCATION_KEYS`/`truncationMeta`)도 저장소 전역 유일 |

## 권장 조치사항

1. **최종 통합 전 `origin/main` 위로 rebase/merge 1회** — sibling PR #899(`52f46f95f`)의 `conversation-thread.md` §8.2/§9/§4/frontmatter 및 `1-widget-app.md` R7 을 흡수. 3개 checker 가 `git merge-tree` 로 충돌 0건을 확인했으므로 merge-coordinator 표준 절차로 충분(WARNING #2 해소).
2. `spec/7-channel-web-chat/0-architecture.md` §3 EIA 매핑 표에 `execution.message`(표시-전용 presentation 자동 진행 메시지) 행 추가 — `1-widget-app.md` §2, `5-admin-console.md` §6 과 표면 정합(WARNING #1 해소).
3. `1-widget-app.md` `## Rationale` 에 이번 diff 의 실질 결정(두 shape 통일 수용·standalone 노드 복원 범위 제외) 항목 신설 — 위 조치 1 이후 번호는 **R8**(origin/main 흡수분 R7 과 겹치지 않게).
4. governing plan `widget-presentation-restore.md` §5 의 3건 팔로우업을 `[ ]` checkbox 화 또는 별도 `plan/in-progress/*.md` 로 분리해 plan-lifecycle 게이트가 인지하게 할 것 — `complete/` 이동 전 필수.
5. (도구 개선, 비차단) consistency-check payload 구성이 `spec/conventions/conversation-thread.md`·`interaction-type-registry.md` 등 실제 인용 대상 convention 문서를 더 폭넓게 자동 포함하도록 개선 검토.

---
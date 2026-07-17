# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL 0건. 5개 전원 인라인 전문을 확보했으며 재시도가 필요한 checker는 없음.

target: `spec/4-nodes/3-ai/` (--impl-done, diff-base=origin/main). 실질 변경은 `1-ai-agent.md`·`3-information-extractor.md` 각 2줄, `endReason` 값 도메인의 code-level SoT를 `@workflow/ai-end-reason` 패키지로 지목하는 backlink 추가뿐이다 (근거: `plan/complete/is-conversation-output-restructure.md` E-7, 동일 브랜치의 `spec/conventions/interaction-type-registry.md` §4 신설과 세트).

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건 중 2건은 target 콘텐츠 결함이 아니라 (a) 문서 정밀도 격차(단일턴 `'out'` 제외 사실 미기재)와 (b) 워크트리가 origin/main 대비 5커밋 stale(병합 전 rebase 필요)이며, 나머지 1건은 이번 diff 이전부터 있던 무관한 문서 인용 오류다.

## Critical 위배 (BLOCK 사유)

*Critical 발견 없음 — 5개 checker 전원 0건.*

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec, Rationale Continuity | `1-ai-agent.md` §7 신규 `endReason` SoT backlink가 "값 목록 자체는 패키지가 소유한다"고 무조건 서술하면서, `AiAgentEndReason`이 단일턴 `'out'`을 의도적으로 제외한다는 plan/코드 결정을 spec 본문에 승계하지 않음. 바로 아래 §7.1~§7.10 표에 `endReason: "out"` 행이 인접해 있어 "out도 이 도메인에 포함"으로 오독할 유인이 큼 | `spec/4-nodes/3-ai/1-ai-agent.md` L463 (§7 상단 blockquote, 서브섹션 표 직전) | `codebase/packages/ai-end-reason/src/index.ts` L30-34/63-65 JSDoc("단일턴 종결 'out'은 포함하지 않는다") · `plan/complete/is-conversation-output-restructure.md` "유니온 분기" 절(E-3 범위 확장 여지로 의도적 스코프 제외) · 대비 사례: `3-information-extractor.md` §5.6은 같은 backlink 패턴이지만 "Multi Turn 종결" 헤딩 바로 아래 배치돼 범위가 자명함 | §7 blockquote에 "(multi-turn 4값 한정 — 단일턴 `'out'`은 `result.messages` 부재로 대화 판정 대상이 아니라 패키지 도메인 밖)" 한 줄 추가. `interaction-type-registry.md §4` "경계" 문단에도 동일 취지 보강 |
| 2 | Cross-Spec(참고), Plan Coherence | 워크트리가 origin/main 대비 5커밋 stale (merge-base `d891694608f`(#962) 이후 origin이 #963~#967 독립 병합, 특히 #964 "replay_unavailable 소비 배선" 미반영) — 그 결과 `spec/7-channel-web-chat/*`가 `spec/5-system/14-external-interaction-api.md`의 "구현됨" 요구사항과 동시에 "미배선"으로 상충된 상태로 diff에 노출됨. target(`spec/4-nodes/3-ai/`) 콘텐츠 자체는 origin이 merge-base 이후 이 경로를 전혀 건드리지 않아 무영향 확인됨(양쪽 checker 실측 일치) | target 외 — 워크트리/브랜치 상태 전반 (target 자체는 무관, 병합 전 조치 필요 항목으로 기록) | `spec/7-channel-web-chat/1-widget-app.md` L104-105, `3-auth-session.md` L62 vs `spec/5-system/14-external-interaction-api.md` EIA-IN-07(L77)/EIA-NF-03(L153)/§5.2(L423, "구현됨"). 원인 커밋 `5de44d4d6`(#964, origin/main에만 존재) | PR 생성/병합 전 `git fetch origin && git rebase origin/main`으로 stale base 해소 — 이미 origin/main에 반영된 PR들의 silent revert 방지. target 자체는 CRITICAL 사유 아니므로 별도 트래킹으로 충분 |
| 3 | Convention Compliance | `0-common.md §5` "응답 형식 규약 (Principle 11)" 라벨이 실제 `node-output.md` Principle 11(문서 작성 형식 규칙: Case 블록/undefined 생략 등)과 다른 의미(3-wrapper 구조 자체의 근거)로 오용됨. **이번 diff가 도입한 문제가 아니며 기능 영향 없음** — target 전역에 이미 존재하던 이슈 | `spec/4-nodes/3-ai/0-common.md` L81/L83 (+ L144 자기참조, `3-information-extractor.md` L183으로 전파) | `spec/conventions/node-output.md` §Principle 11 실제 정의 vs 3-wrapper 구조의 실질 근거(Principle 8.2/3.2/4.5). `2-text-classifier.md` L130·`3-information-extractor.md` L181은 "Principle 11"을 올바른 의미(문서 형식 규칙)로 정확히 사용해 대비됨 | 제목/인용을 `(Principle 1/3.2/4.5/8.2)`로 정정하거나 node-output.md 쪽에 상위 라벨 의도를 명시. 이번 PR diff 범위 밖 — 별도 후속 이슈로 처리 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `PROJECT.md` doc-sync 매트릭스가 `endReason`의 신규 "패키지가 SoT (매트릭스 불필요)" 예외를 반영하지 않음 — 향후 유사 enum 추가 시 불필요한 매트릭스 행 시도 유발 가능 | `spec/conventions/interaction-type-registry.md §4`(L119-124) vs `PROJECT.md` L134 | `PROJECT.md` L134에 각주/행으로 "AI 노드 endReason은 예외 — 패키지 컴파일타임 강제, 매트릭스 등록 불필요" 1줄 추가 |
| 2 | Cross-Spec | (기존 이월, 이번 diff 신규 도입 아님) `3-information-extractor.md` 내부 timeout 서술 자기모순 — L49 "외부 cancel 외에는 타임아웃 발생 안 함" vs L174 "engine이 timeout 등을 만났을 때 호출". `--spec` 단계 리뷰(15_06_14)에서 이미 지적된 사안 | `spec/4-nodes/3-ai/3-information-extractor.md` L49, L174 | L174를 L49와 정합시키는 문구 보강("timeout은 값 예약이나 현재 프로덕션 경로 미발생" 등, 필수 아님) |
| 3 | Rationale Continuity | `3-information-extractor.md` §5.6 backlink는 패키지 6값(`InformationExtractorEndReason`: completed/max_turns/user_ended/timeout/max_retries/error) 인용 vs 바로 다음 문장 "4가지 종결 사유"로 범위 축소 — 6-vs-4 수 불일치가 괄호 설명 없이 남음(1-ai-agent.md 사례보다는 오독 위험 낮음) | `spec/4-nodes/3-ai/3-information-extractor.md` §5.6 상단 blockquote | blockquote 말미에 "(패키지 6값 중 error는 §5.3 케이스, timeout은 dormant 값 — 본 §5.6은 나머지 4값만 다룸)" 한 줄 보강 |
| 4 | Plan Coherence | endReason SoT 각주(§7)와 미해결 out-포트 drift(`plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1, §3.2 "Multi Turn엔 out 포트 없음" vs `_product-overview.md`의 하위호환 서술 — 여전히 미해결, 실측 재확인됨)가 같은 `'out'` 리터럴을 다른 축(값 도메인 vs 포트 구조)으로 다룸. 사전검토(15_06_14)에서 이미 "충돌 아님"으로 확인됐고 §3.2는 plan이 의도적으로 스코프 제외한 영역 | `spec/4-nodes/3-ai/1-ai-agent.md` L463(§7) vs L217(§3.2) | 향후 spec-drift plan 처리 시 담당자가 §7 backlink를 "이미 답 나왔다"고 오인하지 않도록 disambiguation 한 줄 권장 (non-blocking, 강제 아님) |
| 5 | Convention Compliance | 신규 endReason SoT 안내 문구가 두 노드 문서(§7 / §5.6)에 거의 동일한 문장으로 중복 (형식 위반 아님, 설계 선택) | `1-ai-agent.md` §7 / `3-information-extractor.md` §5.6 | 현행 유지 가능 — 노드별 실제 값·예시가 다르고 "출력 구조" 절 서두 배치가 발견성 면에서 유리 |
| 6 | Naming Collision | `CONVERSATION_END_REASONS`가 패키지 export(`readonly string[]`, `ai-end-reason/src/index.ts:80`)와 frontend `output-shape.ts:109`(module-local `ReadonlySet`)에 동일 이름·다른 타입으로 재선언 — alias import(`as PACKAGE_CONVERSATION_END_REASONS`) + 인접 JSDoc으로 이미 완화됨, 파일 내 오독 위험 낮음 | `codebase/packages/ai-end-reason/src/index.ts:80` vs `codebase/frontend/src/components/editor/run-results/output-shape.ts:109` | 필수 아님 — 원하면 로컬명을 `CONVERSATION_END_REASON_SET`으로 구분해 자료구조 차이를 이름에도 반영 가능 |
| 7 | Naming Collision | (확인, 회귀 없음) 직전 `--spec` 단계 라운드가 지적한 WARNING(`@workflow/node-output-contract`가 `node-output.md` SoT를 참칭할 위험)이 `@workflow/ai-end-reason` 개명 + README 소유/비소유 스코프 명시로 완전히 해소됨. `node-output-contract` 문자열 저장소 전역 0건, 패키지명 충돌 0건 | `codebase/packages/ai-end-reason/package.json:2`, `README.md:13-18` | 없음 — 확인용 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | endReason backlink 배치 정밀도 WARNING(1-ai-agent.md, 'out' 제외 미기재) + target 외 워크트리 stale(#964 미반영→channel-web-chat/EIA 상충, orchestrator 참고용 WARNING) + doc-sync 매트릭스·IE timeout 자기모순 INFO 2건. 사전 `--spec` 단계 WARNING 2건(governance 미등록·backlink 부재)은 모두 해소 확인 |
| Rationale Continuity | LOW | 'out' 제외 결정이 spec 본문에 승계 안 됨(WARNING, cross_spec과 동일 근본원인·다른 각도) + IE 6-vs-4 수 불일치(INFO). 기각된 대안 재도입/합의 원칙 위반/무근거 번복 3개 관점 모두 해당 없음 확인 |
| Convention Compliance | LOW | Principle 11 인용 오류(WARNING, 기존 이월·이번 diff 무관) + backlink 문구 중복(INFO, 무해) — 패키지 명명·상대경로·앵커·타입명·`retryable` invariant·에러코드·frontmatter·문서구조·포트명명 전수 검증 통과 |
| Plan Coherence | LOW | 브랜치 5커밋 stale·rebase 필요(WARNING, target 무영향이나 병합 전 필수) + out-포트 drift 축 구분 명확(INFO, non-blocking) — `pending_plans`·`node-output-redesign/**` 등 열린 plan과 충돌 0건, E-7 이행 위치 plan과 정확히 일치 |
| Naming Collision | NONE | CRITICAL·WARNING 0건. `CONVERSATION_END_REASONS` 동일명 재선언(INFO, alias로 완화됨) + 직전 라운드 `@workflow/node-output-contract` WARNING 해소 확인(INFO, 회귀 없음) |

## 권장 조치사항

1. **병합 전 필수(target 콘텐츠와 무관하나 PR 절차상 우선)**: `git fetch origin && git rebase origin/main`으로 5커밋 stale 해소 — 이미 origin/main에 반영된 #963~#967(특히 #964 replay_unavailable 배선)을 silent revert하지 않도록 함 (WARNING #2).
2. `spec/4-nodes/3-ai/1-ai-agent.md` §7 blockquote(L463)에 "multi-turn 4값 한정 — 단일턴 `'out'`은 패키지 도메인 밖" 명시 문구 추가 (WARNING #1).
3. `spec/4-nodes/3-ai/3-information-extractor.md` §5.6 blockquote에 6-vs-4 수 불일치 해소 문구 추가 — 위 2번과 세트로 한 커밋에서 함께 처리 권장 (INFO #3).
4. (선택, 이번 PR 범위 밖) `spec/4-nodes/3-ai/0-common.md §5`의 Principle 11 인용을 실제 근거(8.2/3.2/4.5)로 정정 — 별도 후속 이슈로 트래킹 (WARNING #3).
5. (선택) `PROJECT.md` L134 doc-sync 매트릭스에 endReason "매트릭스 불필요" 예외 각주 1줄 추가 (INFO #1).
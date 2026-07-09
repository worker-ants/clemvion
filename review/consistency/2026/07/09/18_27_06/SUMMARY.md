# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

> 처리 메모: 원 매니페스트는 `rationale_continuity`/`convention_compliance`/`naming_collision` 3개 checker 의
> `output_file` 을 `success` 로 보고했으나 실제로는 해당 경로에 파일이 기록되지 않았다(디렉터리에는
> `cross_spec.md`·`plan_coherence.md` 두 개만 존재). 세션 transcript 의 Workflow 하위 journal
> (`wf_fdf80627-109/journal.jsonl`)에서 5개 checker 전원의 `result` 이벤트를 확인해 복구했다. 알려진
> "Workflow subagent success 인데 output 파일 부재" 패턴과 일치 — 위양성 BLOCK 은 이번엔 없었다(Critical 0건).

## 전체 위험도
**MEDIUM** — Critical 은 없으나 WARNING 4건(표현 정밀도·규약 완전성·명명 모호성) + INFO 다수.

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING) 및 처리

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | cross_spec | `1-widget-app §3.1` "새 대화" 행의 "이전 execution TTL/idle 만료" 문구가 execution-engine 의 `waiting_for_input` 무기한 보존 불변식과 문면 충돌 | **수정함** — "**토큰만** TTL/idle 만료" + Execution row 는 `waiting_for_input` 무기한 잔존 병기(§4-execution-engine §7.4·§7.5 링크). 즉시 종료는 "대화 종료" 사용 명시 |
| 2 | convention_compliance | `itk_*`(§7.1) SecretResolver 미경유 — target 스스로 "향후 검토" | **범위 밖(pre-existing)** — 본 PR 이 신규 도입한 위반 아님. 별도 백로그 |
| 3 | naming_collision | "notification" 어휘가 EIA 웹훅 vs 인앱 Notification 엔티티에 disambiguation 없이 공유 | **범위 밖(pre-existing)** — 본 PR diff 무관 |
| 4 | naming_collision | `interactionType` 필드가 interaction-type-registry SoT 미 cross-link | **범위 밖(pre-existing)** — 본 PR diff 무관 |

## 참고 (INFO) 및 처리
- INFO#1 (cross_spec): 재로드 복원 문구 과잉 일반화 → **수정함** ("`waiting_for_input` 상태면" 한정어 추가).
- INFO#2 (rationale_continuity): R17 addendum 에 "기각 대안" bullet 미기재 → **수정함** (기각 대안 (a)/(b) bullet 추가).
- INFO#5 (plan_coherence): plan 검증 체크박스 미갱신 → developer 워크플로 완주(단위/ai-review/e2e) 후 같은 커밋으로 갱신 예정.
- 기타 INFO(payload truncation 프로세스 관찰, dto/responses flat 경로 pre-existing 편차, InteractionToken/ExecutionToken 명명) → 범위 밖.

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| cross_spec | MEDIUM → 수정 후 해소 |
| rationale_continuity | LOW (R17 addendum 무근거 번복 없음, 모범적) |
| convention_compliance | LOW (pre-existing 만) |
| plan_coherence | NONE |
| naming_collision | LOW (pre-existing lexical 모호성만) |

## 결론
BLOCK: NO. 본 PR 이 직접 유발한 WARNING(#1)·INFO(#1·#2)는 모두 수정 반영. 나머지는 pre-existing 으로 범위 밖.

# Consistency Check 통합 보고서

**BLOCK: NO** — 4개 checker 결과에서 Critical 발견 없음. 단, `plan_coherence` checker 는 output 파일이 디스크에 없어(아래 참고) 내용을 검토하지 못했으므로 완전한 clearance 는 아님.

## 전체 위험도
**LOW** — Critical 없음. i18n 컨벤션 WARNING 1건 + `plan_coherence` 미검토 데이터 갭 1건.

## ⚠ 데이터 갭 — `plan_coherence` output 파일 누락 (재시도 필요)

`plan_coherence` 는 `results` 블록에 `status=success` 로 보고되었으나, 지정된 output_file
(`review/consistency/2026/07/11/22_58_26/plan_coherence.md`)이 디스크에 존재하지 않는다
(`Read` 시도 시 "File does not exist"). 세션 디렉터리에는 다른 4개 checker 의 output 만 있고
`plan_coherence.md` 만 빠져 있으며, 이를 복구할 journal/로그도 발견되지 않았다. 이는 과거에도
관측된 바 있는 알려진 실패 모드다 — "sub-agent 가 status=success 인데 output 파일이 없으면
summary 가 해당 리뷰어를 카운트에서 제외해 실제 WARNING/Critical 을 clean 으로 오보고" (workflow
disk-write gap). 따라서 **plan_coherence 관점(예: target 이 편집하려는 plan 문서 자체의 frontmatter·
스코프·라이프사이클 정합성, 다른 in-progress/complete plan 과의 중복·모순)의 검토는 아직 수행되지
않은 것으로 간주해야 한다.**

- **제안**: `plan_coherence` checker 를 동일 target(`plan/in-progress/spec-draft-webchat-truncation-total-count.md`)에 대해 재실행하고, 결과를 이 SUMMARY 에 추가 반영할 것. 재실행 전까지는 이 통합 보고서를 "4/5 checker 완료" 상태로 취급.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신규 배너 문구("총 N개 중 일부만 표시됩니다.")가 TSX 하드코딩 금지(Principle 1) 및 해요체 통일(Principle 6, `~됩니다` 형은 금지)을 문언 그대로 위반. 위젯이 i18n 하드코딩 빌드 가드(`hardcoded-korean-ratchet.test.ts`) 스캔 범위 밖이라 build 는 막히지 않지만, 위젯 자체 기존 선례(`use-widget.ts:605`, 해요체)와도 어긋남 | `plan/in-progress/spec-draft-webchat-truncation-total-count.md` `## 후속 구현` | `spec/conventions/i18n-userguide.md` Principle 1·Principle 6 | 문구를 해요체로 조정(예: "총 N개 중 일부만 표시돼요.") + 가능하면 상수/사전 경유로 분리. 의도적 예외라면 target `## 결정` 절에 "위젯은 i18n-userguide 컨벤션 비적용 대상, 문체는 기존 관례(해요체) 따름"을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | §2 신규 문구("잘림 표시를 총 개수와 함께 노출한다")가 carousel/table/chart/template 4종을 묶은 행 전체에 적용되지만 실제 구현은 table 한정. target 의 "스코프 경계" 절이 이를 이미 인지·문서화(기존 gap 의 연장, 새 모순 아님)했으나 §2 본문 자체엔 caveat 없음 | `spec/7-channel-web-chat/1-widget-app.md` §2 L48 / target `## 결정`·`## 스코프 경계` | §2 편집 문구에 "(table 한정. carousel 은 `webchat-widget-presentation-followups.md` 별도 추적)" 같은 인라인 caveat 추가 |
| 2 | convention_compliance | target 문서 내부에서 `{rowsTotalCount\|itemsTotalCount}`(`## 결정` §2) vs `{itemsTotalCount\|rowsTotalCount}`(`## 실측`) 순서 불일치. SoT(`0-common.md` §4/§10.4)는 items-first | target `## 실측` / `## 결정` §2 | §2 최종 문구 작성 시 SoT 순서(`{itemsTotalCount\|rowsTotalCount}`)로 통일 |
| 3 | rationale_continuity | `webchat-widget-presentation-followups.md` 의 "위젯 truncation 배너에 총 개수 노출" 체크박스가 아직 미체크(L15). target 은 `widget-presentation-restore.md`(#901) 가 예약해 둔 선행 결정을 정확히 이행 중이나, PR 완료 후 followups 체크박스 동기화 필요 | `plan/in-progress/webchat-widget-presentation-followups.md` L15 | 본 PR(spec+구현) 완료 시 해당 체크박스 갱신 또는 완료 이관을 developer 단계 체크리스트에 남길 것 |
| 4 | cross_spec | `PresentationPayload.truncation` 4키(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`) 흡수 계약과 target 실측 주장이 완전 일치 확인(충돌 없음, 참고용) | `spec/4-nodes/3-ai/1-ai-agent.md` §7.10, `spec/4-nodes/6-presentation/0-common.md` §4·§10.4, `codebase/channel-web-chat/.../presentation.ts:113-114` | 조치 불요 |
| 5 | naming_collision | target 이 실제 신규 도입하는 식별자는 `TableData.totalCount?: number` 뿐(신규 요구사항 ID·엔드포인트·이벤트·ENV·spec 파일 없음). `totalCount`(Filter 노드 `meta.totalCount`, MakeShop wire) 는 타 도메인 동명이나 스코프 비중첩, `TableData` interface 는 codebase 전체 단일 정의, `§R8` 은 기존 섹션 재사용(신규 헤딩 아님) — 모두 충돌 없음 | `codebase/channel-web-chat/src/lib/presentation.ts`, `spec/7-channel-web-chat/1-widget-app.md` §R8 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §2 스코프 caveat 권고(table-only vs 4-타입 서술) 외 데이터 모델·wire 계약 완전 정합 |
| rationale_continuity | NONE | #901 이 예약한 선행 결정을 정확히 이행. followups 체크박스 동기화만 권고 |
| convention_compliance | LOW | i18n 하드코딩·해요체 WARNING 1건. 그 외 필드명·frontmatter 스키마 준수 |
| plan_coherence | **미검토 (재시도 필요)** | output 파일 디스크 누락 — status=success 오보고 가능성. 내용 미확인 |
| naming_collision | NONE | 신규 식별자(`TableData.totalCount`) 1건, 전수 대조 결과 충돌 없음 |

## 권장 조치사항
1. **(우선)** `plan_coherence` checker 를 동일 target 으로 재실행해 누락된 output 을 확보하고 이 보고서에 병합할 것 — 재실행 전까지 "완전 clean" 으로 간주하지 말 것.
2. §2 신규 배너 문구를 해요체로 조정하고(i18n-userguide Principle 6), 하드코딩이 의도적이라면 target `## 결정` 절에 그 예외 근거를 명시할 것.
3. §2 편집 문구에 table-only 스코프 caveat 을 인라인으로 추가해 carousel gap 승계를 명확히 할 것(INFO #1).
4. §2/§실측 간 `{itemsTotalCount|rowsTotalCount}` 표기 순서를 SoT 기준으로 통일할 것(INFO #2).
5. 본 PR 완료 후 `webchat-widget-presentation-followups.md` 체크박스를 갱신할 것(INFO #3).
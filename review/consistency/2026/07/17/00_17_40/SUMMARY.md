# Consistency Check 통합 보고서

> ## ✅ 최종 판정 (2026-07-17, main Claude 가 전수 확보 후 확정): **BLOCK: NO**
>
> 아래 본문의 최초 "BLOCK: YES" 는 **Critical 발견이 아니라 3개 checker 결과 미확보**에 따른 절차적·보수적 판정이었다(summary agent 의 올바른 처신 — 전수 확보 전 차단 해제 금지 관행). 그 3건(`convention_compliance`·`plan_coherence`·`naming_collision`)은 **재실행 대신 workflow journal(`journal.jsonl`) 에서 원문을 복구**해 같은 디렉토리에 기록했다(재실행은 토큰 이중 소모 + 결과 비결정성이라 원본 보존 우선). **5개 전수 확보 결과 Critical 0** 이므로 BLOCK: NO 로 확정한다.
>
> **전수 확보 후 실제 발견 (본문 표에 미반영 — 여기 기록)**:
> - **plan_coherence WARNING (실질 결함 — fix 완료)**: `parallel-p2-followups.md` 이동 후 `plan/complete/` 내부에 옛 경로(`../in-progress/...`) dead 백링크 **5곳** 잔존 (`backend-msg-i18n-impl.md:12`, `cross-node-warning-rules.md:4,69,79`, `parallel-p2-followups-done.md:5`). `spec-link-integrity.test.ts` 는 `spec/**.md` 만 스캔하므로 **어떤 build 가드도 못 잡는** 사각지대였다. → 5곳 전부 `./parallel-p2-followups.md` 로 정정. 부가로 `cross-node-warning-rules.md` §종결 결정의 위임 서술("그 plan 이 e2e 를 소유·추적 중")이 실제 처분(부분 이행 + canvas 배지 층 won't-do)과 어긋나 갱신.
> - **convention_compliance WARNING (본 diff 밖 — 이월)**: cafe24 카탈로그 field-level 파일명의 `__`(중첩 path segment 경계) 규칙이 `_overview.md §7.1` 의 "kebab-case = docs anchor 와 동일 형식" 서술과 어긋남(222개 중 67개 영향). checker 자신이 "**실제 diff 는 규약 위반 없음**"이라 명시했듯 scope 전체 스냅샷 스캔에서 나온 **기존 부채**이며 본 PR 변경분과 무관 → cafe24 카탈로그 트랙으로 이월.
> - naming_collision: 신규 식별자 **0건** (경로·status 값 변경뿐).
>
> 원 보고서 본문은 아래에 그대로 보존한다(시점 기록).

---

**BLOCK: YES** (최초 판정 — 위 최종 판정으로 대체됨) — Critical 발견이 있어서가 아니라, 5개 checker 중 3개(`convention_compliance`, `plan_coherence`, `naming_collision`)가 workflow manifest 상 `status=success` 로 보고되었음에도 실제 output 파일이 디스크에 생성되지 않아(`review/consistency/2026/07/17/00_17_40/` 에 부재, `_prompts/` 하위의 동명 프롬프트 파일과 혼동 주의) 내용을 확인할 수 없다. 알려진 workflow FS-write 비결정적 flakiness 패턴과 일치하며, 전수 확보 전 차단 해제를 금지하는 기존 운영 관행에 따라 안전 차원에서 BLOCK 처리한다.

## 전체 위험도
**MEDIUM** — 실제 확인된 2개 checker(`cross_spec`, `rationale_continuity`)는 Critical/Warning 없이 LOW 위험(INFO 2건)이었으나, 나머지 3개 checker(`convention_compliance`, `plan_coherence`, `naming_collision`)의 결과를 전혀 확인하지 못해 Critical 부재를 보증할 수 없다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | (절차적) convention_compliance / plan_coherence / naming_collision | 3개 checker 가 `status=success` 로 보고됐으나 output_file 이 실제로 생성되지 않아 결과를 읽을 수 없음 (known workflow FS-write flakiness) | `review/consistency/2026/07/17/00_17_40/{convention_compliance,plan_coherence,naming_collision}.md` (미존재 — 동일 이름의 `_prompts/` 하위 파일은 프롬프트이지 결과 아님) | scope: `spec/conventions/` (`spec-impl-evidence.md` 가드 표 정정 포함) | 호출자(main)가 해당 3개 checker 를 Agent tool 로 직접 재실행 → 실제 output_file 생성을 `ls` 로 대조 확인 → 본 요약에 재통합 후 최종 BLOCK 판정 확정. 전수 확보 전 병합/차단 해제 금지 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|

(확인된 2개 checker 결과에는 WARNING 없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Cafe24 `webhooks` 리소스(`application.md` `webhooks_logs_list`/`webhooks_update`)와 Integration `service_type='webhook'` 간 명명 근접 — `app_type` 사례와 달리 disambiguation 주석 없음. 토큰 불일치(복수형 리소스명 vs 단수형 값)로 실제 충돌 가능성 낮음 | `spec/conventions/cafe24-api-catalog/application.md` (충돌 대상: `spec/1-data-model.md` §2.10 Integration `service_type` enum) | `application.md` 상단 기존 disambiguation 주석에 "Webhook(logs/setting) 리소스도 Integration `service_type='webhook'`(범용 아웃바운드 웹훅)과 무관" 한 줄 추가 (필수 아님) |
| 2 | rationale_continuity | `spec-impl-evidence.md` §4 가드 표에서 `spec-link-integrity.test.ts` 검증 범위 서술을 정정(오기 교정, 결정 번복 아님)했으나, 근거가 문서 자신의 관행(R-1~R-10)과 달리 `## Rationale` 이 아닌 표 셀 인라인 각주에만 존재 | `spec/conventions/spec-impl-evidence.md` §4 표 + `## Rationale` | `## Rationale` 에 R-11(또는 기존 R-9 보강)로 "spec→plan 링크는 `spec-link-integrity` 담당, plan 문서 내부 링크는 `plan-coherence-checker` 담당" 책임 경계 명문화 (필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/conventions/` 실제 diff(4파일·각 1줄, plan 경로 이동 반영 + 가드 서술 정정)는 무해. 첨부된 `audit-actions.md`/`cafe24-api-catalog/**` 기존 콘텐츠도 `1-data-model.md`·`5-system/1-auth.md`·실제 구현(`audit-action.const.ts`, `types.ts`)과 전부 대조 확인, 불일치 없음. Critical/Warning 없음, INFO 1건 |
| rationale_continuity | LOW | 동일 diff 4건 모두 기각된 대안 재도입·설계 원칙 위반 없음. `spec-impl-evidence.md` 서술 정정은 오기 교정으로 판단(결정 번복 아님). Critical/Warning 없음, INFO 1건 |
| convention_compliance | 재시도 필요 | status=success 보고되었으나 output_file 미생성 — 내용 미확인 |
| plan_coherence | 재시도 필요 | status=success 보고되었으나 output_file 미생성 — 내용 미확인 |
| naming_collision | 재시도 필요 | status=success 보고되었으나 output_file 미생성 — 내용 미확인 |

## 권장 조치사항
1. **(BLOCK 해소 우선)** `convention_compliance`, `plan_coherence`, `naming_collision` 3개 checker 를 Agent tool 로 직접 재실행 (scope=`spec/conventions/`, diff-base=`origin/main`, target 은 기존과 동일). 완료 후 `ls review/consistency/2026/07/17/00_17_40/` 로 실제 파일 생성 여부 대조 확인 → 본 요약(SUMMARY.md)에 재통합하여 최종 BLOCK 판정 확정.
2. (선택) `spec/conventions/cafe24-api-catalog/application.md` 의 기존 `app_type` disambiguation 주석에 webhooks 리소스 관련 한 줄 추가.
3. (선택) `spec/conventions/spec-impl-evidence.md` `## Rationale` 에 R-11 항목 추가하여 `spec-link-integrity.test.ts` vs `plan-coherence-checker` 책임 경계 명문화.
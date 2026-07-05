# Consistency SUMMARY — --spec 재검증 (19_27_28)

모드: `--spec plan/in-progress/spec-draft-cross-audit-doc-batch.md` 재검증(직전 19_19_53 BLOCK: YES 정정 후).

## BLOCK: NO

직전 라운드 CRITICAL(V-18 오종결) + WARNING(0-canvas 미러·§9.2 충돌·§10.6.1 stale) 전부 draft 수정으로 해소.

## Checker 결과 (재검증)

| Checker | 위험도 | 판정 |
|---|---|---|
| plan_coherence | LOW | **CRITICAL 해소** — V-18 을 "보류+spec v1 범위 명시"로 정정, use-widget.ts 코드(seedWaitingFromStatus=waiting 성공만)·plan 결정과 정합. WARNING(종합 Rationale stale 문구)→draft 수정 완료 |
| rationale | LOW | dry-run §7.4/§9.2 동반 갱신으로 충돌 해소(코드 JSDoc 정합). WARNING(0-canvas §5.3.1+§5.3.4 두 미러)→draft 3b 양쪽 커버로 수정 완료 |
| cross_spec | LOW | §10.6.1 4탭 추가(변경 4a)+spec_impact 포함으로 위임 체인 정합. 4탭=result-detail.tsx:255-271·node-output.md 일치. INFO: EH-DETAIL-03 표·port 표현 |
| (naming/convention) | NONE/LOW | 직전 라운드 확인 — 신규 식별자 0·implemented+section-Planned 선례 존재 |

## 적용 방침 (INFO 반영)

- §10.6.1 4탭 추가 시 port 는 "port directive/selector" 정확 표현. EH-DETAIL-03 요구 표는 고수준 요약 유지하되 "전체 탭 §10.6.1" 참조.
- V-13: 0-common·1-ai-agent·3-IE·0-canvas(§5.3.1+§5.3.4) 4문서 동시 하향.
- dry-run: §7.4 + §9.2 동시.

## 교훈

`--spec` 게이트가 (a) V-18 얕은 "정합" 오판(getStatus 호출만 보고 결론 — 실제는 waiting 성공만 처리)과 (b) 미러 문서 누락(0-canvas 2곳·§10.6.1·§9.2)을 정확히 포착. snap 결론 위험 재확인 — 코드 line-by-line 추적이 authoritative.

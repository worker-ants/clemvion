# Consistency Check 통합 보고서 (복구·재집계본)

**BLOCK: NO** — Critical 위배 0. 최초 자동 SUMMARY 는 3개 checker(cross_spec·convention_compliance·naming_collision)의
disk-write gap 으로 결과 파일이 부재해 **fail-closed 로 BLOCK: YES 오판정**했다. 세 checker 는 반환값(전문)을 workflow
`journal.jsonl` 에 남겼고, 이를 각 `output_file` 로 복구·재집계한 결과 **Critical 없음**을 확인해 BLOCK 을 NO 로 확정한다.
([known failure mode: Workflow disk-write 갭 = 거짓 음성](../../../../../plan/complete) 대응 — journal 복구 절차 적용.)

## 대상
`plan/in-progress/spec-draft-webchat-en-i18n.md` — channel-web-chat 위젯 chrome 문자열 EN 다국어화(locale 활성), project-planner `--spec` 게이트.

## Checker별 판정 (5/5 확보)

| Checker | 위험도 | 판정 |
|---|---|---|
| rationale_continuity | LOW | Critical/Warning 0, INFO 3. **기각 대안 재도입·무근거 번복 없음** — #922 가 defer 하고 spec(§R6 등)이 예약한 활성화 경로임을 실측 확인. |
| plan_coherence | LOW | WARNING 1 (카루셀 잘림 배너 후속 plan 이 신설 parity 요구 미반영 — 교차참조 권고). 선행 #922 merge 완료. |
| naming_collision | NONE | 6관점 전부 충돌 0. R10(파일-로컬 시퀀스 정확)·신설 §4(미사용)·위젯 로컬 catalog 키(메인 앱 dict 와 물리·개념 분리) 모두 안전. |
| cross_spec | MEDIUM | WARNING 2 — (W1) `2-sdk §3` wc:boot 재전송 문단이 locale 을 "재전송 갱신 필드" 로 열거(boot-1회 해석 설계와 충돌). (W2) `0-overview §6.1` "영역 종결" 서술이 신규 마일스톤과 충돌 + spec_impact 누락. |
| convention_compliance | LOW | WARNING 1 — (W3) Edit E 범위가 좁아 `i18n-userguide.md` Rationale 하위섹션·자동 가드 요약 표 미반영 시 문서 내부 상충. |

## Critical
없음.

## WARNING (전부 draft 에 반영 — §4 Edit 범위 확대 + §6/§7)

| # | Checker | 요지 | 반영 |
|---|---|---|---|
| W1 | cross_spec | `2-sdk §3` wc:boot 재전송 목록에서 locale 제거/재마운트 명시 | Edit B 범위 확대 (§3 문단 포함) |
| W2 | cross_spec | `0-overview §6.1` 영역-종결 서술 갱신 + spec_impact 추가 | **Edit F 신설** + spec_impact 에 `0-overview.md` 추가 |
| W3 | convention_compliance | Edit E 를 §적용범위 본문 → Rationale 하위섹션 + 자동 가드 요약 표까지 확대 | Edit E 범위 확대 |
| P1 | plan_coherence | 카루셀 배너 후속 plan 교차참조 | §7 + 후속 plan 각주 |

## INFO (반영)
- 보간 문법 `{{name}}` 이중 중괄호로 통일 (§3.1/§3.4).
- 위젯 `locale`(UI 렌더 언어) ≠ Chat Channel `languageLocale`(서버 발신 언어) 구분 1줄 (Edit B/C).
- `PROJECT.md 변경-위치 매핑` + `doc-sync-matrix.json` 위젯 chrome i18n 행 추가를 §8 구현 완료 조건에 명시.
- Edit E: "이득 0" 전제 폐기 인과 + "위젯 로컬 parity 가드가 스코프-밖 서술의 backstop 대체" 명시.

## 결론
BLOCK: NO. WARNING/INFO 전부 draft 에 반영 후 spec 적용 진행. 재-invoke 불요(복구로 5/5 확보, Critical 0).

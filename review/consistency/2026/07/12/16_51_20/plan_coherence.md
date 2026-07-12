> **복구 주의**: 본 checker 는 disk-write gap 으로 output 이 유실됐고 journal 반환값도 짧은 확인 fragment 만 남아 전문 복구 불가.
> (naming_collision 전문은 `naming_collision.md` 로 정정 분리했다.) plan_coherence 관점 판정 신호:
> (1) cross_spec 이 plan 일관성을 독립 확인("webchat-i18n-scope defer 결정 vs 신규 spec-draft-webchat-en-i18n.md 예약 실행 일관"),
> (2) journal 전 result 스캔에서 CRITICAL/HIGH 위험도 0건. → plan_coherence 관점 **BLOCK 사유 없음**(잠정 LOW, 미확인은 명시).

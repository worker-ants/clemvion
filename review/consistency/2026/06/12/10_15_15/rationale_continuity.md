# Rationale 연속성 검토 — spec/5-system/1-auth.md

검토 대상: worktree `spec-audit-action-prose` 의 `spec/5-system/1-auth.md` 변경분 (diff vs main)

---

## 발견사항

### [INFO] §4.1 Planned 감사 액션 표기 변경 — `password_change`/`2fa_enable/disable` → `user.*` dot-prefix 형식

- **target 위치**: `spec/5-system/1-auth.md` §4.1 "Planned (미구현)" 표, `인증 (워크스페이스 컨텍스트)` 행
- **과거 결정 출처**: 기존 main 분기 동일 파일 §4.1 Planned 표 — `password_change`, `2fa_enable/disable` 표기 사용 중. 관련 Rationale 항목 없음 (구 표기에 대한 근거 문서 미존재)
- **상세**: 변경 전 표기(`password_change`, `2fa_enable/disable`)는 `<resource>.<verb>` dot-prefix 규약(§4.1 서두 Action naming 규약, `data-flow/1-audit.md §1.1` 표기 규약)을 따르지 않은 상태였다. target 이 이를 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`로 수정하면서 동시에 새 Rationale `4.1.A`에 근거를 명시했다. Planned 단계(미구현, 코드 의존 0)라 기존 사용자·API 계약에 영향이 없으며, 번복이 아니라 규약 준수 방향으로의 정정에 해당한다.
- **제안**: 현행 유지. 새 Rationale `4.1.A`가 근거를 충분히 기술하고 있어 불연속 없음.

---

### [INFO] §4.1 "읽기측 계약" 산문 블록 신규 추가

- **target 위치**: `spec/5-system/1-auth.md` §4.1 현재 구현된 액션 표 직후 산문 블록 (`> **읽기측 계약 — action 은 닫힌 enum 이 아니다.**`)
- **과거 결정 출처**: `spec/data-flow/1-audit.md §1.1` — "`AuditLog.action` 자체는 DB 자유 문자열 컬럼이다"·"과거 row 에 현재 union 밖 레거시 값이 존재할 수 있다" 사실이 data-flow 문서에 기존 기록되어 있음
- **상세**: target 이 data-flow 에 이미 존재하는 "DB 자유 문자열·닫힌 enum 아님·레거시 값 보존" 계약을 auth spec 의 §4.1 에도 소비자 가이드 형태로 인용·추가했다. 두 문서 간 내용이 정합하며, 과거 Rationale 에서 기각된 대안(예: DB CHECK 제약을 두는 안)을 재도입하지 않는다. 오히려 기존 결정(DB CHECK 미설치 — 액션 추가가 잦아 마이그레이션 비용을 피하기 위함)을 재확인하는 방향이다.
- **제안**: 현행 유지. 단, 이 산문 블록이 `data-flow/1-audit.md §1.1`의 내용을 파편화할 수 있으므로, 향후 두 문서 중 하나만 SoT로 남기고 다른 쪽은 교차 참조 링크로 대체하는 정리를 권장한다 (강제 아님).

---

## 요약

이번 변경은 두 가지로 구성된다. (1) §4.1 Planned 감사 액션 행에서 dot-prefix 규약 이탈을 바로잡은 표기 정정, (2) 기존 data-flow 문서에 이미 수립된 "audit action 은 닫힌 enum 이 아님" 계약을 auth spec 본문에 인용하는 산문 추가. 두 변경 모두 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant(dot-prefix 필수, DB CHECK 미설치, append-only audit 원칙)를 위반하지 않는다. Planned 표기 변경은 기존 미결정 표기를 규약에 맞게 확정하면서 새 Rationale `4.1.A`로 근거를 함께 제시하고 있어 "결정의 무근거 번복" 에도 해당하지 않는다. Rationale 연속성 관점에서 차단 이슈 없음.

## 위험도

NONE

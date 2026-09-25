# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전부 CRITICAL 없음. WARNING 도 없음(INFO 4건만 존재).

## 전체 위험도
**LOW** — target(`plan/in-progress/lockfile-libc-pin.md`, pnpm `packageManager` 핀 상향 + Dockerfile corepack 폴백 정정)은 spec/규약/명명 어느 축과도 충돌이 없으나(4개 checker NONE), plan_coherence 가 후속 체크리스트 실행 디테일 미흡을 LOW 로 표시.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | spec Rationale 적용 대상 아님 — 범위 확인만 기록. 번들 전 spec Rationale 대조 결과 pnpm 버전 핀·lockfile `libc:`·dependabot·CI 툴체인 관련 항목 0건 | `plan/in-progress/lockfile-libc-pin.md` frontmatter (`spec_impact: none`) | 조치 불요 |
| 2 | rationale_continuity | 유일한 "결정 번복"(lockfile `libc:` 개수 가드 → 엔트리별 os/cpu/libc 동일성 설계)은 spec Rationale 이 아니라 자매 plan(`deps-guard-hardening.md`) 소관이라 본 checker 스코프 밖이지만, target 이 번복 사유·대체 설계를 이미 명시 | `plan/in-progress/lockfile-libc-pin.md` §B "가드를 새로 세우지 않는 이유" (라인 97~101) | §C 체크리스트 실행 시 "정확한 불변식" 문구를 `deps-guard-hardening.md` 에 축약 없이 그대로 옮길 것 |
| 3 | plan_coherence | 재설계된 회귀 가드 체크박스를 실행 시 원문(개수 기준) 없이 덮어쓸 위험 — 같은 문서의 기존 관례(취소선 + 블록쿼트로 이력 보존)를 따르라는 지시가 target 에 없음 | `plan/in-progress/lockfile-libc-pin.md` §B + §C 검증 마지막 체크리스트 / 관련: `plan/in-progress/deps-guard-hardening.md` §후속 둘째 체크박스 | §C 체크리스트 마지막 항목에 "원문(개수 기준)을 취소선으로 남기고 새 설계를 인용으로 추가, 체크박스는 `[ ]` 유지" 라고 구체화 |
| 4 | plan_coherence | "트래커 항목 닫기" 문구가 두 트래커·세 갈래 처분(nullable-notation-followups 항목 닫기 / deps-guard-hardening 첫 체크박스 `[x]` / 둘째 체크박스는 설계만 갱신하고 `[ ]` 유지)을 한 줄로 뭉개, 실행자가 둘째 체크박스까지 오체크할 위험 | `plan/in-progress/lockfile-libc-pin.md` §C 검증, 마지막 체크리스트 항목 | 체크리스트를 세 갈래로 분리해 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | pnpm 툴체인 핀 변경만, 제품 spec(데이터모델·API·요구사항ID·상태전이·RBAC·계층책임) 표면 없음. `spec/` 내 pnpm 언급 5건 전부 버전-비종속 커맨드라 충돌 없음 |
| rationale_continuity | NONE | 번들 전 spec Rationale 대조 결과 관련 항목 0건, `spec_impact: none` 실측과 부합. 유일한 결정 번복은 자매 plan 소관이며 이미 근거 동반 |
| convention_compliance | NONE | `spec/conventions/**` 25개 전부 API/DTO/DB마이그레이션/도메인 명명 규약이라 target 표면 밖. frontmatter·배치·`packageManager` 처방 경로 모두 규약과 정확히 일치 |
| plan_coherence | LOW | 실측(package.json·3개 Dockerfile·CI action-setup)이 target 처방 범위와 정확히 일치, 미해결 결정 우회·선행 조건 누락 없음. 후속 체크박스 처분의 실행 디테일 미흡(INFO 2건)만 남음 |
| naming_collision | NONE | 신규 요구사항ID·엔티티·API·이벤트·환경변수·파일경로 없음. `packageManager`·Dockerfile 값은 기존 키의 값 갱신일 뿐 신규 키 아님 |

## 권장 조치사항

1. (BLOCK 해소 불요 — Critical/Warning 없음)
2. §C 체크리스트 실행 시 `deps-guard-hardening.md` 둘째 체크박스는 원문(개수 기준)을 취소선으로 보존하고 새 불변식(엔트리별 os/cpu/libc 동일성)을 인용으로 추가, 체크박스는 `[ ]` 유지 (plan_coherence INFO #3)
3. §C 체크리스트를 세 갈래(spec-draft-nullable-notation-followups.md 항목 닫기 / deps-guard-hardening.md 첫 체크박스 `[x]` / 둘째 체크박스는 설계만 갱신하고 `[ ]` 유지)로 분리해 명시 (plan_coherence INFO #4)
4. 위 §C 실행 시 target §B 의 "정확한 불변식" 문구를 축약 없이 `deps-guard-hardening.md` 로 그대로 옮길 것 (rationale_continuity INFO #2)

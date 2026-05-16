# Architecture Review

## 발견사항

- **[INFO]** 단일 진실 원칙(Single Source of Truth) 정합성 복원 — 문서 아키텍처 관점
  - 위치: `CHANGELOG.md` L4, `README.md` L77·L232
  - 상세: `docs-consolidation(2026-05-12)` 이후 폐기된 `prd/`, `user_memo/` 경로가 핵심 공개 문서(README, CHANGELOG)에 잔존해 있었음. 이는 정보 아키텍처 상 단일 진실 원칙 위반이며, 신규 개발자나 자동화 도구가 구 경로를 참조할 수 있는 위험이 있었다. 본 변경으로 `spec/` 를 유일한 진실 공급원으로 정렬.
  - 제안: 향후 docs-consolidation 같은 구조 전환 시, README/CHANGELOG 를 동일 커밋·PR 범위에 포함하는 체크리스트를 developer SKILL.md 에 추가해 잔존 참조가 발생하지 않도록 선제 예방.

- **[INFO]** 테스트 인프라 아키텍처의 문서화 — 격리 원칙 명시
  - 위치: `README.md` (신설 "격리 인프라 기반 e2e" 섹션), `CHANGELOG.md` ("Test infrastructure" 섹션), `Makefile` help 텍스트
  - 상세: 격리 인프라(`docker-compose.e2e.yml`)와 개발 인프라(`docker-compose.yml`)가 `name:` top-level key 로 충돌 없이 공존하는 격리 아키텍처 결정이 이전까지 코드 내에만 암묵적으로 존재했음. 이번 변경으로 격리 원칙과 `--build` 강제 결정의 배경(stale 이미지 → 사일런트 404 회귀 사례)이 README·CHANGELOG 에 명시됨. 아키텍처 결정 사유가 문서화됨으로써 이후 유지보수자의 의사결정 맥락이 보존됨.
  - 제안: CHANGELOG 의 "Test infrastructure" 절이 `spec/` 의 어느 문서와 대응되는지 참조 링크를 추가하면, spec-driven 원칙과의 정합성이 더 명확해진다 (예: developer SKILL.md 의 E2E TEST WRITING GUIDE 또는 관련 spec 경로).

- **[INFO]** `e2e-test-full` 의 `runner1 && runner2; STATUS=$$?` 패턴 — 인라인 주석으로 설계 의도 명시
  - 위치: `Makefile` `e2e-test-full` 타겟 상단 주석 블록
  - 상세: short-circuit `&&` 와 최종 exit code 캡처 로직은 shell 스크립팅의 비자명한 패턴이다. 이전에는 코드만 존재했고, `e2e-test` 와 패턴이 달라 보여 유지보수자가 "버그인가?" 하는 오해를 살 수 있었음. 다중 라인 주석으로 의도를 인라인 문서화한 것은 적절한 조치. 동작 변경이 없으므로 회귀 위험 없음.
  - 제안: 없음. 현행 처리 적절함.

- **[INFO]** plan 문서의 미완료 상태 — `in-progress/` 위치 적절
  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 체크리스트
  - 상세: `TEST WORKFLOW` 와 `REVIEW WORKFLOW` 항목이 미체크(`[ ]`) 상태로 `in-progress/` 에 위치함. CLAUDE.md plan 라이프사이클 규약과 정합. 리뷰 대상 커밋 시점에서 아직 완료 전 단계이므로 `complete/` 이동은 하지 않은 것이 올바름.
  - 제안: 리뷰 완료 후 모든 항목이 체크되면 `git mv` 로 `complete/` 이동 필요. 자동 reminder 가 없으므로 REVIEW WORKFLOW 후 즉시 처리.

### 아키텍처 관점 추가 검토

- **[INFO]** consistency-checker 결과의 동반 처리 — 사전 결함 흡수 패턴
  - 위치: `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, plan 문서 §동반 사전 결함 해소
  - 상세: consistency-checker 가 발견한 Critical 3건이 "같은 파일을 편집하는 김에 동반 해소"로 plan 에 흡수되었다. 이 패턴은 아키텍처적으로 적절하다 — 동일 레이어(문서 계층)의 관련 결함을 별도 PR/worktree 로 분산시키면 오히려 문서 정합성의 일관성이 낮아지고 review 부담이 증가한다. 단, 흡수 범위가 커지면 PR 의 단일 책임 원칙(SRP)이 희석될 수 있음. 이번 케이스는 모두 문서 경로 교정이라 범위가 명확하게 한정되어 있어 적절한 판단.
  - 제안: 향후 흡수할 결함이 "동일 파일, 동일 레이어"를 벗어나는 경우 (예: 구현 코드 변경을 수반하는 경우)는 별도 PR 분리를 원칙으로 삼을 것을 권장.

## 요약

이번 변경은 소스 코드 아키텍처가 아닌 **프로젝트 정보 아키텍처(문서 계층)**를 대상으로 한 정리 작업이다. 핵심은 `docs-consolidation` 이후 잔존한 폐기 경로 참조를 제거하여 `spec/` 단일 진실 원칙을 README·CHANGELOG까지 일관되게 적용한 것이다. `Makefile`의 e2e 인프라 격리 아키텍처와 `--build` 강제 결정 사유가 명시됨으로써, 테스트 인프라의 설계 의도가 처음으로 공개 문서 수준에서 가시화되었다. SOLID 원칙 관점에서는 단일 책임 범위가 "문서 경로 교정 + 인프라 안내 추가"로 다소 혼합되어 있으나, 동일 파일을 편집하는 불가피한 맥락에서의 흡수이고 구현 코드 변경이 없으므로 위험도는 낮다. 순환 의존성·레이어 책임·디자인 패턴 관점에서 이 변경이 미치는 부정적 영향은 없다.

## 위험도

NONE

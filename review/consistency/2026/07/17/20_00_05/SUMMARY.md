# Consistency Check 통합 보고서

- **모드**: `--spec plan/in-progress/spec-draft-frontend-layering.md`
- **대상**: `spec/conventions/frontend-layering.md` (신설) + `spec/0-overview.md` §4 등재
- **선행 세션**: `19_44_52` (BLOCK: YES — 중복 작업 Critical)

## BLOCK: NO

Critical 0건. 선행 세션의 Critical(sibling 브랜치 경로 선점)은 **채택 처분으로 해소**됐고,
naming_collision 이 `git show` diff 실측으로 이를 확인했다. 잔여는 WARNING 1건(조치 완료) +
INFO 3건(defer).

## Critical 발견사항

없음.

### 선행 Critical 의 해소 확인

| 선행 발견 | 처분 | 검증 |
|---|---|---|
| sibling 브랜치 `claude/zen-kapitsa-c5e1de` 가 동일 경로·id 선점 | 사용자 결정에 따라 **그 문서를 채택**하고 현재 main(`099f63cc`) 기준으로 정정. 가드 확장은 main 위 재적용(Phase 2)으로 분리 | naming_collision 이 `git show <branch>:<path>` vs 워크트리 파일 diff 로 "정정 4개 항목이 실제로 반영됨" 확인 → CRITICAL → LOW 강등 |

## 경고 (WARNING)

| # | 체커 | 발견사항 | 처분 |
|---|------|----------|------|
| 1 | rationale_continuity | §1 계층 표는 전 계층에 "위로 의존 금지" 를 선언하지만 §2·§4 는 `{lib, types} → components` 단일 pair 만 다룸 — `types → lib` 는 Phase 2 완료 후에도 영구 무가드로 남는데 문서가 그 차이를 숨김 (`no-restricted-imports` group 에 `@/lib` 부재 실측 확인) | **조치 완료** — §2 를 "규약이 선언하는 범위" 와 "CI 가 강제하는 부분집합" 으로 분리 서술하고, Rationale 에 "왜 `types → lib` 는 가드가 없나" 절 신설(압력 0 · 전용 블록 비용 · 재평가 조건 명시) |

## 참고 (INFO)

| # | 체커 | 발견사항 | 처분 |
|---|------|----------|------|
| 1 | naming_collision | sibling 브랜치·워크트리(`claude/zen-kapitsa-c5e1de` / `nifty-greider-35167d`) 가 로컬에 잔존 | defer — plan 에 "사용자 확인 후 정리" 로 이미 명시. 다른 세션 사용 가능성이 있어 임의 삭제하지 않음 |
| 2 | cross_spec | `spec/7-channel-web-chat/0-architecture.md` §1 "레이어 분리"(배포/격리 경계, 별도 코드베이스)는 문서의 동음이의어 각주가 커버하지 않음 | defer — 별개 앱·별개 eslint config 라 실질 충돌 위험 0 |
| 3 | cross_spec | `spec/0-overview.md` §2.1 이 frontend 의 Next.js App Router 채택을 명시하지 않아 target §1 과 구체성 수준 불일치 (모순 아님) | defer — 이번 diff 범위 밖 |
| 4 | convention_compliance | 도입부 cross-link 에 코드 경로를 직접 나열하지 않음 | 조치 불요 — §4 표 + frontmatter `code:` 로 정보 충족 |

## 체커별 요약

| 체커 | 위험도 | 결과 |
|------|--------|------|
| cross_spec | LOW | Critical 0 · Warning 0 · INFO 2. 데이터 모델·API·요구사항 ID·상태 전이·RBAC 어느 축에도 충돌 없음. 인접 spec(`data-hydration-surfaces`, `4-nodes/5-data/1-transform`, `spec-impl-evidence` §3)과 코드 경로·frontmatter 요건 정합 확인 |
| rationale_continuity | LOW→해소 | WARNING 1 (위 조치 완료). D3/D2 의 "관측 압력에 비례" 비대칭은 명시적 Rationale 문단으로 해소됨을 긍정 확인 |
| convention_compliance | NONE | Critical 0 · Warning 0. 선행 WARNING(frontmatter 설계 누락)이 `status: partial` + `code:` + `pending_plans:` 로 정확히 해소. **frontend spec/plan 가드 8개 파일 1,116 테스트 전수 통과** 실측 |
| plan_coherence | NONE | `plan/in-progress/**` 23개 문서 전수 대조 — 결정 충돌·선행 미해소 없음 |
| naming_collision | LOW | id `frontend-layering` 전역 유일. Phase 2 가 언급하는 코드 식별자(`literalSpecifier`/`backtickSpecifier`/`COMPONENTS_PATH_RE`)가 실제 `eslint.config.mjs` 와 일치 확인 |

## 결론

spec 쓰기 **진행 가능**. Phase 1(spec 신설 + 0-overview 등재)은 본 PR 로 착지하고,
Phase 2(가드 `src/types/**` 확장) · Phase 3(`status: implemented` 승격)은 `developer` 후속 위임.

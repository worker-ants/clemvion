# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견이 있으나 단순 앵커 갱신 누락으로, 설계 방향 자체의 차단 사유에 해당하지 않아 조치 후 진행 가능.

세션: `review/consistency/2026/05/18/23_08_06/`
대상: `plan/in-progress/spec-draft-ai-timezone-context.md`
모드: `--spec` (project-planner 의무 사전 검토)

---

## 전체 위험도
**MEDIUM** — 설계 방향은 기존 spec 과 정합. Critical 설계 충돌 없음. 앵커 broken-link 1건(CRITICAL, 수동 갱신으로 즉시 해소)·명명 모순 2건·경로 오류 2건·plan 직렬화 조건 미명시 3건이 실제 편집 전 처리 필요.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `cafe24-api-metadata.md` §5 신설로 기존 §6/§7 앵커 3곳 broken link 발생 | `cafe24-api-metadata.md` §5~§8 전체 shift | `4-cafe24.md:370,378`, `4-integration.md:975` 의 `#6-mcp-bridge-와의-매핑` / `#7-allowlist-와의-관계` 앵커 | Phase A 편집 시 `4-cafe24.md:370,378` 과 `2-navigation/4-integration.md:975` 앵커를 `#7-mcp-bridge-와의-매핑` / `#8-allowlist-와의-관계` 로 갱신 |

---

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| W1 | Cross-Spec / Convention / Rationale | "description 끝에 자동 **prepend**" 용어 모순 — 실제 의도는 append(suffix) | §5.3·§1.2·§5.4 의 "자동 prepend" → "자동 append(suffix)" 통일 |
| W2 | Convention | `0-common.md` 내 상대 경로 depth 오류 (`../../` 사용) | `../../../conventions/cafe24-api-metadata.md`, `../../../2-navigation/_product-overview.md` 로 수정 |
| W3 | Cross-Spec | `conversation-thread.md §5` 와 ordering 중복 정의 가능성 | `conversation-thread.md §5` 추가 한 줄은 `0-common.md §11.4` 포인터 링크만 |
| W4 | Cross-Spec | `$now` "turn 마다 prefix 재계산" 표현이 모호 | "재계산해도 동일 값 — `$now` 는 execution 시작 시점 고정" 으로 명확화 |
| W5 | Convention | 신설 §5.2 규약이 기존 §3 예시를 즉시 위반 사례로 만듦 | Phase A 체크리스트에 "§3 예시 `since.description` 동시 갱신" 추가 |
| W6 | Plan Coherence | `1-ai-agent.md §1` config 표가 `conversation-thread-e509c5` worktree 와 동시 수정 위험 | target plan 에 "conversation-thread-e509c5 merge 이후 착수" 조건 명시 |
| W7 | Plan Coherence | `node-output-redesign` plan 이 `2-text-classifier.md` / `3-information-extractor.md` 재설계 대상 | 활성 여부 확인 후 직렬화 결정 기록 |
| W8 | Naming Collision | `0-common.md §11` 신설로 기존 `## 11. CHANGELOG` 가 §12 로 밀림 | CHANGELOG 에 "§11 → §12 번호 변경" 행 추가 |
| W9 | Naming Collision | §10 "자동 컨텍스트 주입" 과 §11 "시스템 컨텍스트 자동 주입" 제목 키워드 중복 | §11 제목을 "AI 노드 시스템 프롬프트 자동 prefix" 등 차별화 |

---

## 참고 (INFO) — 14건 요약

- I1: `output.config` echo 의 `includeSystemContext?` optional 기준 → node-output.md Principle 7 확인
- I2: `Workspace.settings.timezone` 필드가 `spec/1-data-model.md §2.2` JSONB 내부에 공식 schema 미기재 → `settings` 행에 `timezone: string (IANA, optional)` 추가 권장
- I3: `11-mcp-client.md §2.3` 표 행 vs blockquote 형식 확인
- I4: Cafe24 노드 $now UTC-to-KST 변환의 normative/informative 등급 명시
- I5–I7: Phase A 체크리스트 — anchor 유효성 검증, _overview.md §6 주석 번호 갱신, node-output.md Principle 7 예시 추가
- I8: default-true 의 기존 워크플로 영향 완화 (config 부재 시 true 해석) Rationale 보강
- I9: 기각 대안(A) 와 기존 원칙 연결 명시
- I10–I12: conversation-thread-e509c5 수정 범위 확인, cross-link grep 전수 검증, Phase B 구현 plan 신설
- I13: §10/§11 산문 내 번호 참조 grep 검증
- I14: `systemContextSections` 리터럴 enum 네임스페이스 분리

---

## Checker별 위험도

| Checker | 위험도 | 결과 파일 |
|---------|--------|----------|
| Cross-Spec | LOW | `cross_spec.md` (issues=7) |
| Rationale Continuity | LOW | `rationale_continuity.md` (issues=3) |
| Convention Compliance | LOW | `convention_compliance.md` (issues=7) |
| Plan Coherence | MEDIUM | `plan_coherence.md` (issues=6) |
| Naming Collision | MEDIUM | `naming_collision.md` (issues=5) |

---

## 권장 조치 (Phase A 착수 전·체크리스트 통합)

1. **[Critical 해소]** `spec/4-nodes/4-integration/4-cafe24.md:370,378` / `spec/2-navigation/4-integration.md:975` 앵커를 `#7-mcp-bridge-와의-매핑` / `#8-allowlist-와의-관계` 로 갱신 (§4 삽입 선례 2026-05-16 따름)
2. "자동 prepend" → "자동 append(suffix)" 용어 통일 (3곳)
3. `0-common.md` 의 상대 경로 `../../` → `../../../` 전수 수정
4. §5.2 규약 적용 시 §3 예시 `since.description` 동시 갱신
5. target plan 에 worktree 직렬화 조건 명시 (`conversation-thread-e509c5` 이후 + `node-output-redesign` 활성 여부 확인)
6. `conversation-thread.md §5` 추가 한 줄은 `0-common.md §11.4` 포인터 링크만
7. `0-common.md §11` 제목을 "AI 노드 시스템 프롬프트 자동 prefix" 로 변경
8. Phase B 구현 plan 신설 또는 target plan Phase B 체크박스 유지
9. (후속 권장) `spec/1-data-model.md §2.2` Workspace `settings.timezone` 공식화
10. (후속 권장) default-true 점진 적용 범위 (`config 부재 시 true 해석`) Rationale 보강

---

> Note (BLOCK 판정 근거): Naming Collision 의 CRITICAL 은 "broken link 3곳" 의 명백한 수정 항목이며 설계 충돌이 아니다. consistency-checker 의 BLOCK 정책은 "Critical = 설계·요구사항 충돌" 에 한정되므로 단순 앵커 갱신은 권장 조치 1번으로 흡수해 진행한다.

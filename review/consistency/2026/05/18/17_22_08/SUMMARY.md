# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 작업 진행 가능하나 WARNING 5건 조치 권장.

검토 대상: `spec/0-overview.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-18 17:22

---

## 전체 위험도

**MEDIUM** — Critical 없음. WARNING 5건(중복 통합 후), INFO 6건. 주요 원인은 Inline Alert 공식 패턴명 미정의로 인한 용어 혼용 및 `spec/1-data-model.md` filter 타입 누락.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec + Naming-Collision | Inline Alert 패턴이 §3.4에 미정의 상태로 동일 패턴을 "영구 amber 경고 배너" / "inline alert" 두 명칭이 코퍼스 6곳에서 혼용 | `spec/0-overview.md §3.4` | `spec/2-navigation/4-integration.md §3.2, §4.4, Rationale` / `spec/conventions/cafe24-restricted-scopes.md:83, 122` | §3.4에 Inline Alert 항목 추가 후 위 사용처를 "inline alert (warning, amber 톤 — §3.4 참조)"로 정합화. plan 범위에 `cafe24-restricted-scopes.md:83, 122` 2건 추가 필요 |
| W-2 | Cross-Spec | `spec/1-data-model.md §2.6` Node.type 전체 목록에 `filter` 타입 누락 — `spec/0-overview.md §6.1` 및 `spec/4-nodes/0-overview.md`와 직접 모순 | `spec/1-data-model.md §2.6 Node.type 전체 목록` | `spec/0-overview.md §6.1`, `spec/4-nodes/0-overview.md`, `spec/4-nodes/1-logic/8-filter.md` | `spec/1-data-model.md §2.6` split 행 다음에 `filter \| 배열 필터링` 행 추가. `spec/4-nodes/_product-overview.md` §4.6~§4.7 사이 Filter 섹션도 보완 |
| W-3 | Convention-Compliance | `spec/0-overview.md`에 `## Rationale` 섹션 부재. 아키텍처 결정 근거(S3 키 설계, Flyway 선택, Redis 큐 도입 배경)가 본문에 산재 | `spec/0-overview.md` (문서 말미) | CLAUDE.md §명명 컨벤션 — "본문 끝에 `## Rationale` 섹션 권장" | 문서 말미에 `## Rationale` 섹션 추가, 산재한 결정 근거 집약 |
| W-4 | Naming-Collision | Badge/Tag `Processing(파랑)` 과 Inline Alert `info(파랑)` 이 동일 §3.4에서 파랑 색상을 서로 다른 의미로 공유 | `spec/0-overview.md §3.4` | `spec/0-overview.md §3.4 Badge/Tag Processing(파랑 스피너)` | §3.4 Inline Alert 추가 시 "Badge/Tag 색상은 리소스 상태, Inline Alert 색상은 안내 긴급도 — 동일 색상이라도 역할 다름" 한 줄 명시 또는 `info` 톤에 "(Processing 스피너와 무관)" 괄호 주석 |
| W-5 | Plan-Coherence | `spec-draft-notification-dismiss` plan (`worktree: notification-actions-8806b6`)이 `spec/2-navigation/_layout.md §3.1`을 수정 예정 — 본 작업이 `_layout.md`에 Inline Alert를 정의할 경우 편집 충돌 위험 | `spec/2-navigation/_layout.md` (잠재적) | `plan/in-progress/spec-draft-notification-dismiss.md` (`notification-actions-8806b6` worktree) | 착수 전 `notification-actions-8806b6` 병합 상태 확인. 미병합 시 Inline Alert 정의 위치를 `spec/0-overview.md §3.4`로 고정하고 `_layout.md` 편집 제외 |

> W-1은 Cross-Spec과 Naming-Collision 두 checker의 동일 위배를 통합.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | §6.2 Cafe24 항목이 "모두 구현 완료"라 명시되나 섹션 제목은 "백엔드만 존재 / 부분 구현" — 분류 혼동 | `spec/0-overview.md §6.2` | Cafe24 항목을 §6.1로 이동하거나 "구현 완료 — 남은 확장은 §6.3 참조" 상태 컬럼 추가 |
| I-2 | Cross-Spec | §3.4가 에러 페이지·빈 상태 패턴(`spec/2-navigation/11-error-empty-states.md`)에 대한 참조 링크 없어 카탈로그가 불완전 | `spec/0-overview.md §3.4` | Inline Alert 추가 시 에러 페이지·빈 상태 canonical 위치 참조 링크도 함께 추가 |
| I-3 | Rationale-Continuity | Toast 정의가 "성공/실패/정보 알림"으로 포괄 서술되나 Inline Alert 추가 후 "도착 신호 역할"로 좁아지는 맥락이 §3.4 본문에 미기재 | `spec/0-overview.md §3.4 Toast` | Toast 항목에 "(inline alert와 함께 사용 시 도착 신호 역할 — standalone toast와 구분)" 보조 설명 추가 |
| I-4 | Rationale-Continuity | Inline Alert를 `_layout.md` 대신 `spec/0-overview.md §3.4`에 두기로 한 위치 결정 근거가 plan에만 있고 spec 문서 내 미기재 | `spec/0-overview.md §3.4` (추가 예정 항목) | Inline Alert 항목에 "navigation 외부 확장 가능성으로 0-overview에 배치" 맥락을 짧은 주석으로 inline 기재 |
| I-5 | Convention-Compliance | `spec/0-overview.md`가 `spec/` 루트에 위치하나 CLAUDE.md 명명 컨벤션 표는 `spec/<영역>/0-overview.md` 패턴만 명시 — 규약과 실제 불일치 | `spec/0-overview.md` 경로 | CLAUDE.md §명명 컨벤션 표에 루트 레벨 `spec/0-overview.md` 항목을 명시적 추가 (target 문서 수정 불필요) |
| I-6 | Plan-Coherence | `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` frontmatter `worktree: TBD` — 실제 worktree 미반영 | `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` frontmatter | `worktree: spec-overview-inline-alert-283211`으로 갱신하고 "새 worktree 생성" 체크박스를 `[x]`로 표시 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | Inline Alert §3.4 미정의 → 용어 혼용 (W-1), filter 타입 누락 (W-2) |
| Rationale-Continuity | LOW | Toast 역할 경계 불명확(I-3), 위치 결정 근거 미기재(I-4) — 모두 INFO |
| Convention-Compliance | LOW | Rationale 섹션 부재(W-3), 루트 경로 규약 불일치(I-5) |
| Plan-Coherence | LOW | _layout.md 편집 충돌 위험(W-5), plan frontmatter TBD(I-6) |
| Naming-Collision | LOW | 파랑 색상 의미 이중 정의(W-4), amber 배너 명칭 혼용(W-1에 통합) |

---

## 권장 조치사항

1. **[즉시 — 착수 전]** `notification-actions-8806b6` worktree / `spec-draft-notification-dismiss` plan의 main 병합 여부 확인. 미병합 시 Inline Alert 정의 위치를 `spec/0-overview.md §3.4`로 확정하고 `_layout.md` 편집 제외 (W-5 해소).
2. **[본 PR — §3.4 추가 시 함께]** `spec/0-overview.md §3.4`에 Inline Alert 항목 추가 (W-1 부분 해소): 파랑 색상 역할 구분 주석(W-4), Toast 도착 신호 역할 보조 설명(I-3), 에러 페이지·빈 상태 참조 링크(I-2), 위치 결정 근거 inline 주석(I-4) 포함.
3. **[본 PR — §3.4 추가 후]** 용어 정합화: `spec/2-navigation/4-integration.md §3.2, §4.4, Rationale` 및 `spec/conventions/cafe24-restricted-scopes.md:83, 122` 의 "영구 amber 경고 배너" 표현을 "inline alert (warning, amber 톤 — §3.4 참조)"로 갱신. plan 작업 범위에 `cafe24-restricted-scopes.md` 2건 추가 필요 (W-1).
4. **[별도 — 우선순위 높음]** `spec/1-data-model.md §2.6` Node.type 목록에 `filter \| 배열 필터링` 행 추가 + `spec/4-nodes/_product-overview.md` Filter 섹션 보완 (W-2 — 본 worktree 범위 외이나 DB enum 정의에 실질적 영향).
5. **[본 PR 내 chore]** `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` frontmatter `worktree: TBD` → `spec-overview-inline-alert-283211`으로 갱신 (I-6).
6. **[저우선]** `spec/0-overview.md` 말미에 `## Rationale` 섹션 추가 (W-3).
7. **[저우선]** CLAUDE.md §명명 컨벤션 표에 루트 레벨 `spec/0-overview.md` 항목 명시 (I-5).

---

## 본 PR 처리 상태 (2026-05-18 본 작업 반영)

| 권고 | 처리 |
|---|---|
| 1 (W-5) | `notification-actions-8806b6` 가 `_layout.md §3.1` 만 손대고 본 PR 은 `0-overview.md §3.4` 만 손대므로 편집 충돌 없음. 그대로 진행. |
| 2 (W-1 부분 / W-4 / I-2 / I-3 / I-4) | §3.4 추가 시 함께 반영 완료. |
| 3 (W-1 후속) | `4-integration.md §3.2`·§4.4·Rationale, `cafe24-restricted-scopes.md §4.2`·`기각된 대안 (A)` 5곳 정합화 완료. |
| 4 (W-2 filter) | 본 plan 범위 외, 별도 plan 후속. |
| 5 (I-6) | plan frontmatter `worktree` 필드 갱신 완료. |
| 6·7 (W-3 / I-5) | 본 plan 범위 외, 저우선 별도 처리.

참고: `_retry_state.json`의 `agents_pending` 목록에 5개 checker 모두 남아있으나, 각 output 파일이 모두 실제 결과로 채워져 있어 사실상 완료. 재시도 필요 건수: 0건.

# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — spec frontmatter `status: planned` 가 규약 enum 외 값으로 build-time 가드 fail 위험 존재. 나머지는 동기화 누락·링크 파손 수준의 WARNING.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | Spec A·B frontmatter `status: planned` — 규약 enum(`backlog\|spec-only\|partial\|implemented\|archived`) 에 없는 값. build-time 가드 fail 위험 | `spec/5-system/16-system-status.md` frontmatter, `spec/2-navigation/15-system-status.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` | `status: spec-only` 로 교정 |
| W-2 | Convention Compliance | Spec A·B `code:` 에 미존재 경로 지정 — `status` 승격 시 `spec-code-paths.test.ts` fail 위험 | Spec A `code: codebase/backend/src/modules/queue-monitor/**`, Spec B `code: codebase/frontend/src/app/(main)/queue-monitor/page.tsx` | `spec/conventions/spec-impl-evidence.md §3` | `code: []` 로 두고 첫 코드 머지 시 `partial` 로 승격하며 실제 경로 기입 |
| W-3 | Convention Compliance | Spec B `id: system-status-page` 와 파일명 `15-system-status.md` 불일치. Spec A `id: system-status` 와도 패턴 비일관 | `spec/2-navigation/15-system-status.md` frontmatter | `spec/conventions/spec-impl-evidence.md §2.1` | id↔파일명 통일 |
| W-4 | Naming Collision | `_product-overview.md §3.9~§3.11` 재번호 시 `8-marketplace.md`, `9-user-profile.md` anchor 링크 파손 | `spec/2-navigation/8-marketplace.md` line 9, `spec/2-navigation/9-user-profile.md` line 10 | `_product-overview.md §3` | anchor 동시 갱신 |
| W-5 | Cross-Spec | `_layout.md` §1 ASCII 다이어그램 동기화 계획 없음 | plan §C | `_layout.md §1` | SysStatus 라인 삽입 |
| W-6 | Cross-Spec | `_product-overview.md` §2 구조 트리 수정 지침 미구체화 | plan §D | `_product-overview.md §2` | System Status 행 삽입 |
| W-7 | Cross-Spec | `spec/0-overview.md §6.1` 내비게이션 완료 목록 갱신 단계 누락 | plan 체크리스트 | `spec/0-overview.md §6.1` | 단계 추가 |
| W-8 | Plan Coherence | `QueueRegistry` 표가 `spec/data-flow/0-overview.md §4` 큐 카탈로그와 SoT 중복 위험 | `16-system-status.md §1` | `data-flow/0-overview.md §4` | cross-reference + 요약 목적 표기 |
| W-9 | Plan Coherence | 재번호로 `marketplace-and-plugin-sdk.md` 내 "§3.9" 인용 stale | plan marketplace | `_product-overview.md §3.9→§3.10` | ID 기반 인용 교체 |
| W-10 | Plan Coherence | 사이드바 순서 재정렬 체크리스트 sub-item 누락 | plan 체크리스트 | `_layout.md §2.2` | sub-item 추가 |

## 참고 (INFO)

- I-1: `GET /queue-monitor/overview` 는 cross-workspace — §2 에 "X-Workspace-Id 무시, 시스템 전역 API" 명시
- I-2: "폴링 패턴은 통계 화면을 따른다" → 통계는 수동 새로고침이라 오해 소지. 레이아웃·인증·{data} 추출은 통계 기반, 폴링은 별도 정의로 분리
- I-3: Spec A id↔파일명 번호 prefix 제외 관행 확인
- I-4: `/api/` prefix 명시 검토
- I-5: `refetchInterval: 5000ms` 명시
- I-6: `health` 어휘 — 신규 `ok/degraded/down` vs 기존 `healthy/...` 통일 검토
- I-7~I-10: 인덱스 추가·data-flow 의존 섹션·id 중복 없음·식별자 충돌 없음 (대부분 조치 불필요)

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 동기화 누락 3건 (WARNING) |
| Rationale Continuity | NONE | 위반 없음 |
| Convention Compliance | MEDIUM | frontmatter status enum 외 값 (필수 교정) |
| Plan Coherence | LOW | SoT 중복·재번호 stale·체크리스트 누락 |
| Naming Collision | LOW | anchor 링크 파손 1건 |

## 권장 조치사항

1. **(필수)** Spec A·B `status: planned` → `spec-only`, `code:` → `[]` (W-1, W-2)
2. **(spec D 동시 필수)** 8-marketplace/9-user-profile anchor + marketplace plan 인용 갱신 (W-4, W-9)
3. **(권장)** `_layout.md §1` ASCII, `_product-overview.md §2` 트리 동기화 (W-5, W-6)
4. **(권장)** plan 체크리스트 보강 (W-7, W-10)
5. **(권장)** data-flow §4 cross-reference (W-8)
6. **(선택)** `/api/` prefix, health 어휘, refetchInterval 명시 (I-4, I-5, I-6)

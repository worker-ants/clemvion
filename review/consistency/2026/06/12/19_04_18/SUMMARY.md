# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 규약 텍스트 오류(snake_case vs kebab-case) 1건, 명명 패턴 반전(INVALID_BOT_TOKEN vs BOT_TOKEN_INVALID) 1건이 WARNING 수준으로 존재하나 구현을 차단할 수준이 아님.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `_overview.md §7.1` 에 entity_id 를 "(snake_case)" 로 명시하나, 실제 파일명·frontmatter·생성기 모두 kebab-case 사용 — 규약 텍스트 자체가 운용 현실과 모순 | `spec/conventions/cafe24-api-catalog/_overview.md §7.1` (line 142) | 전체 field-level 파일 frontmatter | "(snake_case)" 를 "(kebab-case)" 으로 수정 |
| 2 | Naming Collision | `INVALID_BOT_TOKEN`(입력 검증) 과 `BOT_TOKEN_INVALID`(provider 인증 실패) 공존. 명명 패턴 반전으로 코드명만으로 의미 구분 불가 | `backend-labels.ts` ERROR_KO | `triggers.service.ts:987`, `discord.adapter.ts:94`, `spec/5-system/15-chat-channel.md:345` | `INVALID_BOT_TOKEN` rename 검토 (breaking — 별 task) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `store/users.md` 의 `menu_access_authority.order` / `detail_authority_setting.order` 행에 동일 cross-map fallback 버그 잔존 | `spec/conventions/cafe24-api-catalog/store/users.md` line 136, 195 | "(응답 객체)" 로 수정. `_overview.md §7.3` 예시에 추가 |
| 2 | Rationale Continuity | `_overview.md §7.3` 결정 배경이 인라인 산문에만 기술, 정식 `## Rationale` 절 부재 | `_overview.md §7.3` | `## Rationale` 신설 (선택) |
| 3 | Convention Compliance | resource index 파일 전체 `## Rationale` 부재 | `application.md` 등 | 권고 (엄격 의무 아님) |
| 4 | Convention Compliance | `appstore-orders.md` operation 헤더 "Retreive" 오탈자 (Cafe24 docs 원문) | `appstore-orders.md` | `_overview.md §7.2` 에 의도적 차이 명시 |
| 5 | Plan Coherence | G-4 잔여 ↔ G-1-remaining 동일 파일군 — 착수 순서 미명시 | `cafe24-backlog-residual.md §G-4` | G-1-remaining 선행 권장 주석 |
| 6 | Naming Collision | `TRIGGER_NOT_FOUND` 가 `CHAT_CHANNEL_CODES` 배열 포함 — webhook 범용 코드 | `backend-labels.test.ts` | 배열명/분리 검토 |
| 7 | Naming Collision | `G-4` 순번 — `complete/` 선점 여부 미확인 | `cafe24-backlog-residual.md` | 확인 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `store/users.md` cross-map fallback 버그 잔존(INFO) |
| Rationale Continuity | NONE | 규약 위반 없음. Rationale 절 부재(INFO) |
| Convention Compliance | LOW | §7.1 snake_case vs kebab-case 텍스트 오류(WARNING) |
| Plan Coherence | NONE | plan 충돌 없음. worktree 경합 없음 |
| Naming Collision | LOW | `INVALID_BOT_TOKEN` vs `BOT_TOKEN_INVALID` 명명 반전(WARNING) |

## 권장 조치사항
1. **(WARNING#1 — fix)** `_overview.md §7.1` "(snake_case)" → "(kebab-case)".
2. **(WARNING#2 — disposition)** `INVALID_BOT_TOKEN` rename 은 기존 API 에러 코드 breaking 변경 — 본 i18n followup 범위 밖. 별 task.
3. **(INFO#1 — fix)** `store/users.md` line 136, 195 wrapper `order` → "(응답 객체)". §7.3 예시 추가.
4. 나머지 INFO — 비차단 doc nit, RESOLUTION disposition.

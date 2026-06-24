# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 중 3개(Convention Compliance, Plan Coherence, Naming Collision)는 NONE, 2개(Cross-Spec, Rationale Continuity)는 LOW. Critical·WARNING 발견 없음. INFO 7건 존재.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `5-admin-console.md §2.1` 에서 `R-4` 언급이 로컬 앵커로 오독될 여지 | `spec/7-channel-web-chat/5-admin-console.md §2.1` 비고 열 | `(R-4 단일 PATCH 경로)` 를 `([trigger-list R-4](../2-navigation/2-trigger-list.md#r-4-...))` 형식 절대 앵커로 교체하거나 로컬 Rationale 미정의 주석 추가 |
| 2 | Cross-Spec | `viewer+` 와 "모든 역할" 동의어 명시 누락 | `spec/7-channel-web-chat/5-admin-console.md §7` 권한 표 | "viewer+ (= 모든 인증 사용자)" 로 부연 또는 주석 한 줄 추가 |
| 3 | Cross-Spec | `TriggerHistoryDialog.onOpenFullDetail` 미전달 이유 spec 미기재 | `spec/7-channel-web-chat/5-admin-console.md §2.1` | "onOpenFullDetail 미전달 — trigger list drawer 전환이 웹채팅 콘솔에 적용 불가하므로 생략" 한 줄 추가 |
| 4 | Cross-Spec | `lastTriggeredAt` nullable 표현 미세 불일치 (frontend `string \| undefined` vs backend DTO `string \| null`) | `codebase/frontend/src/lib/types/trigger.ts` 52–53행 | `string \| null \| undefined` 로 통일 + `use-web-chat.ts` 에서 `?? undefined` 정규화; spec `1-data-model.md §2.8` 응답 DTO 매핑 노트 보충 권장 |
| 5 | Rationale Continuity | `useUpdateWebChatMeta` onError 미처리 정책이 코드 JSDoc 에만 존재, spec 미기재 | `spec/7-channel-web-chat/5-admin-console.md §2.1 또는 §4` | "PATCH 실패 시 onError invalidate 없음 — 서버 미변경이 전제" 한 줄 추가 권장 |
| 6 | Convention Compliance | `spec` frontmatter `user_guide:` 필드 미선언 (선택 필드, 위반 아님) | `spec/7-channel-web-chat/5-admin-console.md` frontmatter | 양방향 cross-link 명시 위해 `user_guide: codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` 추가 가능 |
| 7 | Convention Compliance | `code:` glob 이 `codebase/frontend/src/lib/types/trigger.ts` 미커버 (build 가드 통과) | `spec/7-channel-web-chat/5-admin-console.md` frontmatter `code:` | 해당 파일 명시 추가 또는 `trigger-list.md` 가 커버하므로 현 상태 유지도 수용 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음. 교차 참조 앵커 명확화·nullable 표현 불일치 등 INFO 4건 |
| Rationale Continuity | LOW | 기각 결정 재도입 없음. onError 정책 spec 미기재 INFO 1건 |
| Convention Compliance | NONE | frontmatter 스키마 만족. user_guide 미선언·code glob 미커버 INFO 2건 |
| Plan Coherence | NONE | P0~P2 전 항목 완료. 미해결 결정·선행 조건 미해소·후속 항목 누락 없음 |
| Naming Collision | NONE | 신규 식별자 전체 충돌 없음. i18n 키 값 중복은 의미 충돌 아님 |

## 권장 조치사항

1. (선택) `spec/7-channel-web-chat/5-admin-console.md §2.1` 에 `onOpenFullDetail` 미전달 이유 한 줄 추가 — 향후 컴포넌트 재사용자 혼란 방지 (INFO 3).
2. (선택) `codebase/frontend/src/lib/types/trigger.ts` 의 `lastTriggeredAt` 타입을 `string | null | undefined` 로 통일하고 `use-web-chat.ts` 에서 `?? undefined` 정규화 — 타입 정확성 개선 (INFO 4).
3. (선택) `spec/7-channel-web-chat/5-admin-console.md §4` 에 "PATCH 실패 시 onError invalidate 없음" 정책 한 줄 추가 — spec 근거 보존 (INFO 5).
4. (선택) frontmatter `user_guide:` 필드 추가로 양방향 cross-link 완성 (INFO 6).
5. 나머지 INFO (교차 참조 앵커, viewer+ 동의어 명시, code glob) 는 즉각 조치 불필요. 다음 spec 편집 시 함께 처리 권장.
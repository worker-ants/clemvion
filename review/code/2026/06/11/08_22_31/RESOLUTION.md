# RESOLUTION — KB 검색 불가 상세 배너 (옵션 ③)

리뷰 위험도 **LOW · Critical 0 · Warning 0**. resolution-applier auto-fix 의무 트리거 없음(critical+warning=0). INFO 10건을 저비용·고가치 기준으로 선별 처리.

## 처리 (fix)

| INFO | 처리 | 내용 |
|------|------|------|
| #1·#10 | ✅ fix | `unsearchable-banner.test.tsx` — `pending=true` 시 CTA `disabled` 검증 케이스 추가 |
| #3 | ✅ fix | desc 단락 렌더 검증 케이스 추가(idle/in_progress 양 상태) |
| #4 | ✅ fix | `admin`(≥editor) 역할 CTA 노출 케이스 추가 — role 계층 회귀 가드 |
| #8 | ✅ fix | `[id]/page.tsx` 배너 블록에 spec §2.4.1·R-3 배치 의도 주석 1줄 |

## 검증 (verify)

| INFO | 결과 |
|------|------|
| #5 | ✅ **확인됨** — 백엔드 `POST /knowledge-bases/:id/re-embed` 에 `@Roles('editor')` 적용(`knowledge-base.controller.ts` L178·L180). 프론트 RoleGate 는 defense-in-depth, API 직접 호출도 editor 가드로 보호됨. 보안 갭 없음. |

## 보류 (no-op, 사유 기록)

| INFO | 사유 |
|------|------|
| #2 | 상세 페이지 전용 통합 테스트 하네스(getById·embeddingStats·graphStats·llmConfigs·rerankConfigs·useKbEvents WS 등 6+ mock) 신설은 presentational 배너 대비 과투자. 컴포넌트 단위 7종 + 재사용한 ConfirmModal/`kbReEmbedMutation`(기검증) + build 로 커버. 게이트(`embeddingDimension==null`)·CTA 배선은 3줄 conditional 로 자명. |
| #6 | `embeddingErrorMessage` 툴팁 렌더는 **기존 코드**(본 PR 무관). 별건 추적 사안. |
| #7 | `== null`(배너 게이트)와 `!= null`(dimension 표시)은 **반대 조건**이라 의미상 정상 — 스타일 통일이 오히려 가독성 저하. no-op. |
| #9 | `kb.reembedStatus`(배너) vs `embeddingStats.reembedStatus`(진행 박스) 이중 출처는 리뷰어도 "현재 구조 유지 가능" 판정. 배너는 KB 자체 상태만 보므로 정상. no-op. |

## 재검증

frontend 배너 테스트 7종 + i18n parity + lint 재통과(아래 커밋 게이트).

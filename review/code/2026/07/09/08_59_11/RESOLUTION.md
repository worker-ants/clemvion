# Resolution — 미니맵/토글 버튼 겹침 수정 (커밋 후 재리뷰)

- 세션: `review/code/2026/07/09/08_59_11/SUMMARY.md`
- 대상: 커밋된 HEAD(`origin/main..HEAD`, 4개 파일) 기준 재리뷰 — 코드 커밋(08:47) 이후 리뷰 세션이 오도록 재실행하여 review-guard 시계 정합 확보.
- 위험도: **LOW** · Critical 0 · Warning 1
- 정합성: 동반 `--impl-done` 정합성 체크(`review/consistency/2026/07/09/09_00_08/`) **BLOCK: NO** (5/5 checker 확보).

## Critical

없음.

## Warning 처분

| # | 카테고리 | 처분 | 근거 |
|---|----------|------|------|
| 1 | testing | **조치 없음 (수용된 한계)** | 회귀 테스트가 `@xyflow/react` mock 경계 안에서 산술 관계(`minimapBottom ≥ toggleBottom + toggleHeight`)만 검증하고, "MiniMap/Panel 이 동일 기본 margin 공유" 가정 자체는 mock 이라 미검증이라는 지적. **testing 리뷰어 스스로 "프로젝트 e2e 정책상 픽셀 단위 시각 회귀는 범위 밖 → 액션 불필요, `@xyflow/react` 업그레이드 시 재확인 대상으로만 인지"로 판단**. 추가로 그 margin 가정은 설치된 라이브러리(`@xyflow/react@12.10.2`) CSS(`.react-flow__panel { margin:15px }`)와 소스(MiniMap 이 `<Panel>` 래핑)로 **수동 실측 확인**함. 따라서 코드 변경 없이 수용하며, 아래 INFO #2 로 업그레이드 재확인 메모를 남긴다. |

## INFO 처분

| # | 카테고리 | 처분 | 사유 |
|---|----------|------|------|
| documentation-CHANGELOG | 문서 | **미반영 (선택)** | `CHANGELOG.md` 에 이번 UX 수정 엔트리 부재 지적(INFO, 형식 의무 아님). 리뷰 완료 후 codebase 추가 변경은 review-guard 를 재무장시키므로 이번 PR 에서는 넣지 않음. 필요 시 별도 후속으로 처리 가능. |
| maintainability #5/#6 | 유지보수 | **미반영 (선택)** | 오프셋 매직넘버(`h-8`/`!bottom-2`/`!bottom-12`) 상호종속 비강제·렌더 순서 의도 미문서화. 값이 3개로 소수이고 회귀 테스트가 어긋남을 즉시 감지하므로 현 규모에서 상수 추출은 과설계. 값이 늘거나 재사용될 때 재고. |
| documentation "8px 정확" vs 부등식 | 문서 | **인지, 미반영** | 주석은 설계 의도(8px 갭)를 설명하고 테스트는 `≥` 부등식으로 "겹치지 않음"이라는 더 약하지만 견고한 불변조건을 검증 — 의도적 선택(버튼/오프셋이 커져도 겹침만 없으면 통과). 표현 불일치는 사소하여 미반영. |
| requirement #2 (spec gray zone) | 요구사항 | **조치 없음** | spec §7 이 토글-미니맵 상대 위치를 규정하지 않는 gray zone → 위반 아님. mdx 매뉴얼(ko/en)은 구현과 합치하도록 갱신 완료. |
| side_effect #4 (stacking order) | 부작용 | **조치 없음** | z-index 없이 소스 순서 의존이나 오프셋으로 겹치지 않아 현재 무영향. 회귀 테스트가 관계를 검증하는 안전망 존재. |

## 재실행 보고 (FS-write flakiness 복구)

최초 workflow 에서 `scope` · `documentation` 리뷰어가 STATUS=success 였으나 output_file 이 누락됨(알려진 flakiness). main 이 두 reviewer 를 `Agent` tool 로 직접 재실행하여 확보:
- `scope.md` — 위험도 NONE (4개 파일 전부 단일 목적에 수렴, 범위 이탈 없음)
- `documentation.md` — 위험도 LOW (Critical/Warning 0, INFO 3 — 위 처분 반영)

## 검증

- `eslint` — clean (component + test)
- 유닛 테스트 — `src/components/editor/canvas/` 11 files / 98 tests 전부 pass

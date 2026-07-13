# Resolution — edge §4/§5 ai-review 3회차 (2026-07-13 16:49)

원 위험도 **LOW** (CRITICAL 0 + WARNING 1). disk-write gap(maintainability/user_guide_sync) 은 workflow journal.jsonl 에서 복구 → 둘 다 **NONE**(maintainability=전부 INFO, user_guide_sync=0건, running-a-workflow 추가가 이전 라운드 INFO 를 해소 확인). 숨은 WARNING/CRITICAL 없음.

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 성능 | 바이트 크기 계산이 축약 전 원본 전체를 대상으로 하며 상한 없음. `SHOW_DELAY` 는 sweep 만 막고, 대용량 출력 엣지 1개에 정착 hover 시 동기 직렬화 비용은 잔존(3라운드 비차단) | **반영(리뷰어 권고안 그대로)** — 직렬화 문자열이 `BYTE_APPROX_THRESHOLD=100KB` 이하면 정확 `TextEncoder` 인코딩, 초과 시 인코딩(O(n) Uint8Array 할당) 생략하고 `full.length` char 수 하한 근사(`bytesApprox=true`). 툴팁은 근사면 `~` prefix 표기. 미리보기는 여전히 축약(긴 문자열 잘림)이라 렌더 비용 작음. util 테스트 2건(approx true/false)·빈 컬렉션 1건 추가. |

## INFO(반영/이월)
- (maintainability) `onOpenModal` 인라인 콜백이 형제 `useCallback` 스타일과 불일치 → **반영**: `openDataModal`/`closeDataModal` `useCallback` 추출(canvas 콜백 안정화 스타일 통일).
- (testing #11) 모달 "정상 데이터" 단언(`toContain("1")`)이 느슨 → **반영**: 축약 마커(`[3 items]`) 부재 + 배열 원소 전부(1/2/3) 명시 단언.
- (testing #12) 비-`completed` status hover 미검증 → **반영**: `seedResult` status 파라미터화 + `running`(부분 output) 툴팁 렌더 케이스.
- (testing #13) 빈 컬렉션 `isEmpty` 미고정 → **반영**: `{}`/`[]` → `isEmpty=false` 회귀 테스트.
- (maintainability INFO) `formatBytes` `BYTES_PER_KB` 상수화가 최종 상태에 존재함을 리뷰어가 재확인(2회차 반영분).
- (이월·비차단) abbreviate 객체 eager 열거(perf INFO #5)·`edges` prop-drill 재탐색(#6)·canvas↔run-results cross-import(#7)·`workflow-canvas` God-component(#8)·spec §5 목업 따옴표 vs 실제 `"[3 items]"`(requirement INFO #9)·`findLatestResultByNodeId` JSDoc "소비처 공유" 경미 과장(doc INFO #10)·canvas RTL 통합 하네스(#14) → §4-insert/후속 오케스트레이션 정리로 이월. DRY 기존 소비처 이관은 scope 밖 defer(`task_edb57ca2`).
- (security INFO) hover 노출은 기존 Run Results 패널과 동일 범위·신규 인가 경계 아님. XSS/인젝션 벡터 없음(React 텍스트 자식).

## 검증
- tsc `--noEmit` clean · 관련 vitest 5파일 **96 passed | 1 skipped**(util 16 + hook 6 + component 9 + store 4 + ratchet) · eslint 0 errors(잔여 1 warning 은 `workflow-canvas.tsx:1000` 기존 aria, 본 변경 무관) · e2e 44 suites/253 · fresh `/ai-review` 4회차로 수렴 확인.

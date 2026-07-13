# Resolution — edge §4/§5 ai-review 2회차 (2026-07-13 16:20)

원 위험도 **MEDIUM** (CRITICAL 0 + WARNING 6). disk-write gap(documentation/user_guide_sync) 은 workflow journal.jsonl 에서 복구 → `documentation.md`(LOW: WARNING 1 + INFO 1), `user_guide_sync.md`(NONE: INFO 1) 디스크 기록 완료. 아래는 복구분 포함 전 findings.

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 프로세스(disk-write gap) | documentation·user_guide_sync output 파일 부재 | **복구** — journal.jsonl 에서 두 리뷰어 전문 복구·디스크 기록. documentation=spec §5 문구 WARNING(아래 반영), user_guide_sync=전부 동기 완료(NONE). |
| 2 | 아키텍처/유지보수(DRY) | 신규 selector `findLatestResultByNodeId` 가 신규 소비처에만 적용, 기존 역스캔 2곳 미이관 → divergence 위험 | **부분 반영 + defer(정확 스코핑)** — 실측 결과 `node-settings-panel.tsx InfoTab`(≈508–513)만 1:1 이관 후보이고 `use-expression-context.ts`(≈107–120)는 전체 `Map<nodeId,latest>` 빌드라 single-nodeId selector 로 드롭인 불가. 무관 컴포넌트 변경은 §4/§5 surface scope 이탈 → plan 비고에 근거 기록 + follow-up task(`task_edb57ca2`) 분리. |
| 3 | 성능 | bytes 직렬화·툴팁 표시가 상한·debounce 없이 sweep 마다 전체 직렬화 | **반영** — `useEdgeHoverPreview.show()` 에 진입 지연(`SHOW_DELAY_MS=90`) 추가. 커서가 스쳐 지나는 엣지는 다음 show/scheduleHide 가 타이머를 취소해 `setPreview`(→툴팁 마운트·`summarizeDataForPreview` 직렬화)가 정착한 엣지 1개에만 발생. hook 테스트에 sweep 취소 케이스 추가, spec §5 "현재 구현" 주석에 sweep 방어 반영. |
| 4 | 테스팅 | `EdgeDataModal` 테스트 전무(round-1 `data == null` 수정 회귀 가드 없음) | **반영** — `EdgeDataModal` RTL 4케이스: edgeId=null→미렌더, output:null→'데이터 없음' 문구(리터럴 "null" 아님, `<pre>` 부재 단언), 정상→JsonContent 전체 렌더, X 클릭→onClose. |
| 5 | 테스팅 | 툴팁 onMouseEnter/onMouseLeave→onKeepAlive/onDismiss 배선 미검증(동일 시그니처라 tsc 무력) | **반영** — `fireEvent.mouseEnter/mouseLeave` 로 각 mock 정확 호출 검증 케이스 추가. |
| 6 | 테스팅 | 신규 selector `findLatestResultByNodeId` 단위 테스트 부재 | **반영** — `execution-store.test.ts` 전용 describe 4케이스: 정상 조회, 부재→undefined, Loop 다중 실행→최신, stale-index(다른 nodeId 슬롯)→undefined. |
| (doc) | 문서 | spec §5 마지막 불릿 `- 클릭 시 전체 데이터 모달 표시` 가 §4 "클릭=엣지 선택" 과 상충 소지 | **반영** — `- 툴팁의 "전체 데이터 보기" 버튼 클릭 시 … (§4 엣지 클릭=엣지 선택 과 별개 — 모달은 툴팁 버튼에서만)` 로 명확화. |

## INFO(반영/이월)
- (doc INFO) `use-edge-hover-preview.ts` JSDoc `HIDE_DELAY`→실제 `HIDE_DELAY_MS` 오타 → **정정**(+`SHOW_DELAY_MS` 문서화).
- (user_guide INFO) `05-run-and-debug/running-a-workflow.mdx`/`.en.mdx` "실행 상태 확인" 절에 hover 데이터 미리보기 한 줄 추가(§3.2 교차링크 선례와 정렬, ko/en 대칭).
- (perf/maint INFO) `formatBytes` 매직넘버 → `BYTES_PER_KB` 상수 추출(#4). 경계값 테스트 추가(#5: 배열 5/6·객체 20/21·formatBytes 1024/1024²).
- (이월) abbreviate 객체 eager 열거(#2)·canvas RTL 통합 테스트 하네스(#6)·store 시딩 afterEach(#7)·툴팁 뷰포트 clamp(보안 INFO #8) → 낮은 우선순위/기존 갭 연장, §4-insert 후속.
- (보안 INFO #1) hover 노출은 신규 접근 경로 아님(동일 세션·기존 store 데이터) → 향후 output redaction 정책 시 포함.

## 검증
- tsc `--noEmit` clean · 관련 vitest 5파일 **92 passed | 1 skipped**(util 경계 포함 15 + hook 6 + component 8 + store selector 4 + ratchet) · eslint 0 · e2e 44 suites/253 · fresh `/ai-review` 3회차로 수렴 확인.

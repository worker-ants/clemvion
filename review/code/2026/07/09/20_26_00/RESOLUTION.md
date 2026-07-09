# RESOLUTION — e2e sub-global timeout 가드 리뷰 (session 20_26_00)

대상: `SUMMARY.md` (커밋 `7887bfb93` backend fix + `e23fff03b` 가드/문서).
위험도 LOW · **Critical 0 · Warning 3 · INFO 8**.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 |
|---|---|---|
| **WARNING 1** | maintainability/testing | **fix** — self-test 와 프로덕션 스캔의 판정 로직 이중 구현(drift 위험) 해소. 라인 단위 판정을 `subGlobalTimeoutsInLine(line, global)` 단일 헬퍼로 추출 → `findSubGlobalTimeouts`(프로덕션)와 self-test 가 **공유**. self-test 의 로컬 `scanLine` 제거 |
| **WARNING 2** | maintainability | **fix** — 메인 `it()` 타이틀이 주석과 달리 고정문자열을 보간하던 오도 코드 제거. 실제 `${GLOBAL}` 값(config 파싱값)을 보간하도록 정정 |
| **WARNING 3** | requirement | **미변경(정당)** — `TIMEOUT_LITERAL` word-boundary 부재. 리뷰어 명시대로 "과탐이 미탐보다 CI 차단 목적상 안전"이라 **당장 조치 불필요**. 주석/문자열 스킵을 넣으면 오히려 미탐(under-detection) 위험이 생겨 가드 목적에 역행 → 의도적 미채택. 현재 `e2e/**` 전수 위반 0건, 오탐 사례 발생 시 재검토 |
| INFO 3 | documentation | **fix** — 신규 가드를 `PROJECT.md §자동 가드(build-time 차단)` 목록에 등록(invariant 홈이 §Frontend e2e 패턴임을 명시해 doc-sync 계열과 구분). `test_doc_sync_matrix.py` 는 참조 `*.test.ts` 실존만 강제하므로 안전 |
| INFO 4 | maintainability | **fix** — `toBeGreaterThan(10)` 매직넘버에 근거 주석 추가 |
| INFO 1 | scope 외 6개 | 동반된 backend 1줄 수정(`service`→`svcMetrics`, #868 회귀)은 별도 커밋 `7887bfb93` 로 격리 + 커밋/PR 본문에 disclose. 리뷰어 다수가 직접 재현(2/2·378/378 통과) 확인 → 조치 완료 |
| INFO 2·5·6·7·8 | 각 | 조치 불필요(설계 트레이드오프·fail-closed·read-only 안전 확인). INFO 2(포맷 전제)는 WARNING 3 판단과 동일 근거로 미채택 |

### 출력 파일 부재 4건 (security·scope·side_effect·testing)

알려진 Workflow write-isolation 위양성. `wf_41522d27-75c/journal.jsonl` 에서 4개 reviewer
원문 복원(내용 시그니처로 정확 매핑, 상호 distinct 검증 md5 중복 0). 복원 결과 **전부
INFO 수준**(security=NONE, scope/side_effect/testing=LOW, 숨은 Critical/Warning 없음).

## TEST 결과

- **lint**: 통과 (재실행).
- **unit**: 통과 (재실행) — 가드 `e2e-no-sub-global-timeout.test.ts` 11/11(공유 헬퍼·타이틀 보간 반영), backend `reentryWorkflowInput` 2/2 포함 전 워크스페이스 green.
- **build**: 미재수행 — Next build 대상(프로덕션 src) 무변경(유닛 테스트·문서만).
- **e2e**: 통과 — backend Jest e2e 247 passed(`make e2e-test`). 본 fix 는 frontend 유닛 가드 내부 리팩터 + 문서라 e2e 동작 무관하나 화이트리스트(`*.test.ts`)상 재수행.

## 보류·후속 항목

- WARNING 3 / INFO 2(정규식 오탐 경계·포맷 전제)는 현재 무해(위반 0건)라 미채택. 실제 오탐 발생 시 `{}` 컨텍스트 협소화로 재검토 — `plan/in-progress/e2e-retry-visibility-followup.md` 곁가지에 인접 기록 가능.

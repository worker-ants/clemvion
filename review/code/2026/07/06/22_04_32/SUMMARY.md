# Code Review 통합 보고서 (재실행 — 커밋 1a4124842 postdate)

## 전체 위험도
**LOW** — MCP 진단 메타 구조화 승격 + build-phase granular 에러 코드 도입은 CRITICAL 급 결함 없는 안전한 additive 리팩터. 신규 `TimeoutError`/`withTimeout` 단위 테스트 부재 + multi-turn 경로 테스트 갭 2건이 WARNING. `documentation`/`user_guide_sync` 2 reviewer output 미생성(harness write 차단).

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 처분 |
|---|----------|----------|------|------|
| 1 | testing | `with-timeout.ts` 신규 `TimeoutError`/`withTimeout` 전용 단위 테스트 부재 (간접 검증만) | `with-timeout.ts` (spec 부재) | **해소** — `with-timeout.spec.ts` 신설: resolve 값 전달, 타임아웃 TimeoutError reject + 메시지 포맷, non-Error 래핑, Error 원본 전파, subclass/name 검증 (7 케이스). |
| 2 | testing | `executeMultiTurn` 경로에 `mcpDiagnostics` 구조화·카운터 emit 테스트 없음 (single-turn describe 에만 존재) | `ai-turn-executor.spec.ts` | **해소** — multi-turn(processMultiTurnMessage max_turns 종결) emit/omit 2 케이스 추가. |

## 참고 (INFO) — 처분 요약

| # | 카테고리 | 처분 |
|---|----------|------|
| 1 | security | errors[].message redaction — task_fa96e218 이관(스코프 유지). |
| 2 | side_effect | meta 필드명 rename, 소비자 0건 확인. 저장 로그 재노출 경로 없음(신규 emit). |
| 3 | architecture | ProviderBuildCtx 2슬롯 — 3번째 진단 슬롯 시 sub-object 통합 고려(백로그). |
| 4 | architecture | withTimeout 이원화(common vs llm/utils) — 사전 존재, 본 PR 범위 밖(백로그). |
| 5 | maintainability | openServer 중첩 복잡도 — 중복 2회뿐, 즉시 강제 아님(LOW). classifyBuildPhaseError 추출은 phase 확장 시. |
| 6 | maintainability | McpBuildPhaseError vs McpDiagnosticError 이름 유사 — JSDoc 교차참조로 문서화 양호, 조치 불요. |
| 7 | testing | McpBuildPhaseError 방어적 re-throw 분기 dead defensive — 조치 불요(방어). |
| 8 | testing | classifyMcpCall `__` 미포함 엣지 미검증 | **해소** — 명시 테스트 케이스 추가. |
| 9 | testing | finalizeMcpDiagnostics 다중-connected serverCount 미검증 | **해소** — connected 2 + skipped 1 케이스 추가. |
| 10 | scope | diff 에 review/consistency 산출물 포함 — CLAUDE.md 규약상 필수 증적, 무관 아님. |
| 11 | scope | spec-update draft + spec 본문 수정 공존 — spec-sync task 특성상 계획됨(role 분리는 spec-update draft→적용 경로 준수). |
| 12 | requirement | call-phase errors[] 미누적 — spec §6.2/§8.1 Planned 명시, 의도된 축소. |
| 13 | requirement | spec 동기화 완료 — 이전 SPEC-DRIFT 해소됨, 조치 불요. |
| 14 | performance | O(1)~작은 배열, 신규 I/O 없음. |
| 15 | concurrency | 공유 accumulator 동기 push + resolve 후 순차 카운터 — race 없음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| security / side_effect / maintainability / architecture / concurrency / testing | LOW |
| performance / requirement / scope | NONE |
| documentation / user_guide_sync | 재시도 필요 (output 미생성) |

## 권장 조치사항 (처분)
1. `with-timeout.spec.ts` 신설 (WARNING #1) — **적용**.
2. multi-turn `meta.mcpDiagnostics` emit/omit 테스트 (WARNING #2) — **적용**.
3. classifyMcpCall 엣지 + 다중-connected serverCount 테스트 (INFO #8/#9) — **적용**.
4. redaction(task_fa96e218) / openServer 헬퍼 추출 / withTimeout 통합 — 후속·백로그.

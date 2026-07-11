# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 전 리뷰어가 INFO 수준 발견사항만 보고했고, 그중 2건(유지보수성·테스트)이 종합 위험도를 LOW 로 표기(구조적 가독성·미검증 pre-existing 분기에 대한 저우선 권고). 차단 사유 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 / 테스트 | `spec-links.test.ts` 의 `let root: string;` 가 `beforeAll` 내부에서만 할당됨. `mkdtempSync` 등이 던지면 `root` 가 `undefined` 로 남고, `afterAll` 의 `fs.rmSync(root, ...)` 가 원 실패를 가리는 2차 `TypeError` 를 낼 수 있음(side_effect·testing 리뷰어 공통 지적) | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:64-100` | 낮은 우선순위. `afterAll(() => { if (root) fs.rmSync(root, { recursive: true, force: true }); });` 가드 추가 고려 |
| 2 | 테스트 | 리팩터 이후에도 공유 코어의 일부 분기(빈 self-anchor `[text](#)` 스킵, `decodeAnchor` 의 percent-encoded fragment 디코드)가 여전히 미검증 — 이번 dedup 리팩터 이전부터 존재하던 갭이나, 공유 코어로 합쳐진 지금이 두 진입점을 동시에 지키는 회귀 가드를 저비용으로 추가할 수 있는 시점 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:647-650`, `:778-784` | 필수 아님. `mkLink("empty", "#")`, `mkLink("encoded", "./real.md#%67ood-anchor")` fixture 추가 시 두 public 함수 모두에 무료 회귀 가드 확보 |
| 3 | 유지보수성 | private 코어 `findBrokenLinksInFiles` 와 public `findBrokenLinks` 이름이 한 단어(`InFiles`)만 달라 IDE 자동완성·빠른 리딩 시 혼동 여지 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:627` vs `:707` | `scanLinksCore`, `runLinkScan` 등으로 접두어 차별화 고려. JSDoc 이 관계를 이미 설명해 실질 위험은 낮음 |
| 4 | 유지보수성 | `findBrokenLinksInFiles` 의 중첩 깊이·순환 복잡도가 다소 높음(최대 4단 중첩, CC ~11). 병합 전 두 함수 각각에 있던 구조를 옵션화해 합친 결과이며 이번 diff 신규 도입 아님 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:627-698` | 즉각 조치 불요. 세 번째 scan 변형 추가 시 `checkSameFileAnchor`/`checkPathTarget` 등 이름 있는 헬퍼로 분리 고려 |
| 5 | 유지보수성 / 테스트 | 임시 디렉터리 생성·정리 패턴이 `beforeAll`/`afterAll` 공유 픽스처와 마지막 단일 테스트(인라인 `try/finally`)에서 서로 다른 스타일로 반복됨 | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:64-65, 98-100, 126-141` | 현재 규모(6줄 내외)에서는 조치 불요. 유사 fixture 증가 시 `withTempSpecTree(setupFn)` 헬퍼 추출 또는 `describe`+`beforeEach`/`afterEach` 분리 고려 |
| 6 | 문서화 | 파일 최상단 헤더 코멘트가 아직 "Validates in-repo markdown links in `spec/**` narrative docs" 로만 서술되어, 이번 리팩터로 명시적으로 통합된 codebase-source 스캔(`findBrokenSpecLinksInSources`) 경로를 언급하지 않음. diff 이전(#912)부터 이미 stale 했던 서술로 이번 변경이 새로 유발한 문제는 아님 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:447-458` (diff 밖 미변경 컨텍스트) | 필수 아님. 후속 편집 시 헤더에 "spec/** 내부 링크 + codebase 소스의 spec 참조 링크 둘 다 검증" 한 줄 추가 |
| 7 | 요구사항 | 공유 코어에 무조건적 `violations.sort(...)` 가 추가되며, 이전에는 정렬 없던 `findBrokenLinks(spec/**)` 경로에도 정렬이 새로 적용됨. 실질적으로는 안전한 no-op(파일 수집 시 이미 `relPath` 오름차순, 라인도 오름차순 순회라 원래도 동일 순서) | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:695-698` | 조치 불요 — 동작 회귀 없음, 오히려 두 엔트리포인트의 정렬 계약을 명시적으로 통일하는 개선 |
| 8 | 보안 | 마크다운 링크의 `pathPart` 가 traversal 검증 없이 `path.resolve` 로 해석되어 저장소 바깥 절대경로까지 해석 가능. 다만 `fs.existsSync` boolean 판정만 하고 파일 내용 노출/실행/쓰기 없음, 링크 소스도 저장소 내부 개발자 작성 콘텐츠뿐이라 실질 공격 표면 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:670` | 별도 조치 불요. fork PR 이 CI 에서 이 가드를 도는 저장소라면 `resolved.startsWith(root)` 방어적 assert 추가 고려 정도 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | traversal/ReDoS/temp-dir 점검 — 모두 실질 위험 없음(CI 전용 dev-tool, 신뢰 입력만) |
| requirement | NONE | 리팩터 전/후 전 분기 수동 트레이스 + 실제 테스트 실행(17/17 green) 대조로 회귀 없음 확인. 신규 `sort()` 는 안전한 no-op |
| scope | NONE | `git diff origin/main --stat` 대조로 3개 파일 = 선언된 범위와 정확히 일치, 편승 변경 없음 |
| side_effect | NONE | 파일시스템 부작용은 OS temp 디렉터리에 한정되고 격리·정리 확인됨. `afterAll` 방어 가드 부재만 저위험 지적 |
| maintainability | LOW | 네이밍 근접성·중첩 복잡도·temp-dir 셋업 스타일 혼재 — 모두 즉각 조치 불요한 INFO |
| testing | LOW | 신규 negative-path fixture 4건이 실제 검증 대상 분기를 정확히 겨냥(non-vacuous). 남은 갭은 diff 범위 밖 pre-existing 미검증 분기 |
| documentation | NONE | JSDoc/주석/plan 문서 모두 구현과 일치. 유일한 지적은 diff 이전부터 stale 했던 파일 헤더 서술 |

## 발견 없는 에이전트

없음 (전 실행 에이전트가 INFO 이상 최소 1건 이상 보고).

## 권장 조치사항

1. (저우선) `spec-links.test.ts` 의 `afterAll` 에 `if (root)` 가드 추가 — `beforeAll` 부분 실패 시 2차 에러로 원인이 가려지는 것을 방지 (side_effect·testing 중복 지적).
2. (선택) 공유 코어로 통합된 지금 시점에 빈 self-anchor(`[text](#)`)·percent-encoded anchor fixture 를 추가해 pre-existing 미검증 분기에 대한 회귀 가드를 두 public 함수 모두에 저비용으로 확보.
3. (선택) 파일 헤더 코멘트를 갱신해 codebase-source 스캔 경로(`findBrokenSpecLinksInSources`)를 명시 — 후속 편집 시 일괄 반영 가능.
4. 그 외 지적(네이밍 근접성, 중첩 복잡도, temp-dir 셋업 스타일 혼재)은 모두 즉각 조치 불요, 향후 유사 변경 누적 시 참고.

## 비고 (workflow disk-write 갭)

`side_effect`·`testing` 두 reviewer 는 워크플로 매니페스트에 `status=success` 로 기록됐으나 지정된 `output_file`(`side_effect.md`, `testing.md`)이 세션 디렉터리에 실제로 쓰이지 않았다(디스크 확인 결과 부재). 두 reviewer 의 sub-agent 실행 transcript(`/Users/gehrig/.claude/projects/-Volumes-project-private-clemvion--claude-worktrees-spec-links-dedup-ad581b/aaefd839-0296-4beb-9102-3e650f7902f9/subagents/workflows/wf_31e23103-8cb/agent-ae064e548f96e86b6.jsonl` [side_effect], `agent-afcddb48e0d243dde.jsonl` [testing])에서 최종 응답 텍스트를 직접 복구해 본 통합 보고서에 반영했다. 두 reviewer 모두 실질적으로는 INFO 수준 발견사항만 보고했으며(위 표 참고), 위험도는 각각 NONE/LOW 로 CRITICAL/WARNING 은 없었다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 `router_safety` 강제 포함)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
  - **제외**: 7명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 CI/로컬 dev-tool 리팩터(파일 존재 여부 검사 + 문자열 스캔) — 런타임 성능 영향 없는 변경 범위로 router 가 비관련 판단 |
  | architecture | 모듈 내부 함수 추출(공유 코어화)로 아키텍처 경계·의존성 구조 변경 없음 |
  | dependency | 신규/변경 의존성 없음(기존 `mdast-util-*`, `github-slugger` 그대로 사용) |
  | database | DB 접점 없는 변경 |
  | concurrency | 동시성/비동기 상태 변경 없는 순수 동기 리팩터 |
  | api_contract | 공개 API/HTTP 계약과 무관한 devDependency 계열 내부 테스트 유틸리티 변경 |
  | user_guide_sync | 사용자 대면 기능·문서 변경 없음(내부 CI 가드 리팩터) |
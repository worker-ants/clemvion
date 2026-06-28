# 유지보수성(Maintainability) 리뷰

## 발견사항

### 발견 1
- **[WARNING]** 리뷰 산출물 파일에 동일 내용이 두 번 포함됨 (diff 섹션 + 전체 파일 컨텍스트 섹션 중복)
  - 위치: `review/consistency/2026/06/27/23_02_31/cross_spec.md`, `rationale_continuity.md`, `naming_collision.md`, `plan_coherence.md` 및 `review/consistency/2026/06/28/00_48_38/` 하위 동일 구조 파일들
  - 상세: 각 리뷰 파일이 diff 섹션과 "전체 파일 컨텍스트" 섹션으로 구성되어 있으며 내용이 사실상 동일하다. 이 구조는 단일 리뷰 파일에서 동일 정보를 두 번 유지해야 하는 문제를 만든다. 두 섹션 중 하나가 갱신될 때 다른 쪽이 누락되면 stale 불일치가 발생할 수 있다. 이는 코드 중복과 동일한 DRY 위반 문제다.
  - 제안: 프롬프트 입력 파일에서 diff와 전체 컨텍스트를 구분해 실어야 할 이유(orchestrator가 두 표현 모두 필요한 경우)가 있다면 이를 주석으로 명시. 그렇지 않으면 한 섹션으로 통일.

### 발견 2
- **[WARNING]** `_retry_state.json`의 절대경로 하드코딩 — 이동 내성 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/review/code/2026/06/28/11_17_48/_prompts/maintainability.md` 내 참조된 `review/consistency/2026/06/28/00_48_38/_retry_state.json`
  - 상세: `session_dir`, `summary_output_file`, `prompt_file`, `output_file` 필드 모두 `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-frontend/review/...` 형태의 절대 경로를 하드코딩하고 있다. 이 파일을 다른 머신이나 워크트리에서 읽으면 즉시 오동작한다. 또한 이 절대경로는 `ai-mem-admin-frontend` worktree를 가리키는데, 현재 리뷰 대상 worktree는 `ai-mem-admin-rebase-df13f9`로 불일치한다. 경로 불일치가 실제로 재시도 로직 오작동을 유발할 수 있다.
  - 제안: session_dir는 스크립트 실행 시점에 동적으로 주입(환경변수 또는 런타임 resolve)하거나, worktree 루트 기준 상대경로로 저장하는 방식을 검토.

### 발견 3
- **[INFO]** `meta.json` 파일에 newline 누락 (no newline at end of file)
  - 위치: `review/consistency/2026/06/27/23_02_31/meta.json` 및 `review/consistency/2026/06/28/00_48_38/meta.json`
  - 상세: 두 meta.json 파일 모두 diff에서 `\ No newline at end of file` 경고가 표시된다. JSON 파일 규약상 trailing newline이 없으면 일부 도구에서 경고가 발생하고, diff 도구에서 불필요한 노이즈가 생긴다.
  - 제안: 파일 작성 시 trailing newline을 추가. 파일 생성 스크립트/orchestrator에서 이를 보장하는 로직 추가.

### 발견 4
- **[INFO]** `spec/5-system/17-agent-memory.md` 삭제 건수 echo 설명이 두 곳에 중복 기술됨
  - 위치: `spec/5-system/17-agent-memory.md` §6 API 표 셀과 별도 bullet `삭제 건수 echo (X-Deleted-Count)` (라인 1545, 1550)
  - 상세: `DELETE /agent-memories?scopeKey=` 행의 테이블 셀과 그 아래 bullet 모두 `X-Deleted-Count` 헤더의 역할(0 가능, 멱등 삭제, 프론트 토스트 분기, CORS exposedHeaders)을 서술한다. 동일 사실이 두 위치에 기술되면 향후 수정 시 하나만 갱신하고 다른 하나가 stale 상태로 남을 위험이 있다.
  - 제안: 테이블 셀은 간결하게 "실제 삭제 행 수를 `X-Deleted-Count` 헤더로 echo"만 기재하고, 상세(0 가능 semantics, CORS, 프론트 분기)는 별도 bullet에만 기술해 중복을 제거.

### 발견 5
- **[INFO]** `spec/2-navigation/16-agent-memory.md` scope 전체 삭제 bullet이 과도하게 길어짐
  - 위치: `spec/2-navigation/16-agent-memory.md` §2, `scope 전체 삭제` bullet 라인 (라인 1452)
  - 상세: 단일 bullet이 API 경로, 헤더명, 섹션 링크, UX 분기 논리("0건이면 success가 아닌 중립 토스트"), 토스트 메시지 문자열("삭제할 메모리가 없었어요"), 멱등 UX 개념 설명까지 한 문장에 포함하고 있다. 이 길이는 해당 bullet의 단일 책임 원칙(하나의 기능 포인트를 기술)을 벗어나며, 상세 UX 논리가 navigation spec과 system spec에 이중으로 서술된다.
  - 제안: bullet을 "scope 전체 삭제: `DELETE /agent-memories?scopeKey=`. `X-Deleted-Count` 헤더로 삭제 건수를 받아 0건 시 중립 토스트로 분기(상세: [§6](../5-system/17-agent-memory.md#6-메모리-관리-api-조회삭제-admin-surface))." 정도로 단축하고 논리 상세는 system spec에 위임.

### 발견 6
- **[INFO]** Consistency 리뷰 산출물 디렉토리 구조가 두 세션(23_02_31, 00_48_38)에 걸쳐 동일 패턴으로 반복
  - 위치: `review/consistency/2026/06/27/23_02_31/` 및 `review/consistency/2026/06/28/00_48_38/`
  - 상세: 두 세션 모두 `cross_spec.md`, `rationale_continuity.md`, `naming_collision.md`, `plan_coherence.md`, `meta.json` 동일 파일 집합을 갖는다. 이는 정상적인 설계(세션별 독립 스냅샷)이지만, 00_48_38 세션의 `_retry_state.json`이 23_02_31 세션 없이 별도 존재하고 SUMMARY.md도 00_48_38에만 있어 두 세션의 완성도가 비대칭이다. 23_02_31 세션에 SUMMARY.md가 없는 것이 의도인지 중단인지 알 수 없어 유지보수 시 혼란을 줄 수 있다.
  - 제안: 세션 완성도를 나타내는 상태 마커(예: `STATUS: COMPLETE` 또는 `SUMMARY.md` 존재 여부)를 규약화하거나, 미완 세션에 incomplete 마커를 남기는 관행을 수립.

### 발견 7
- **[INFO]** `plan_coherence.md`(00_48_38)의 diff-base 커밋 해시 표기 일관성 부재
  - 위치: `review/consistency/2026/06/28/00_48_38/plan_coherence.md` 내 diff-base 표기
  - 상세: `37230c91f`(9자리), `de8ebff3c`(9자리)로 표기되나, 동일 문서 내에서 일부는 `37230c91f` 단독, 일부는 `37230c91f → de8ebff3c` 범위로 표기된다. `23_02_31` 세션의 `rationale_continuity.md`는 전체 40자 SHA-1 해시(`acfa6735b1e426f73f5965bf9272aa88a2a7aafd`)를 사용한다. 같은 리포지토리 내 문서에서 해시 표기 길이가 일관되지 않으면 자동 파싱 도구나 검색 시 누락이 발생할 수 있다.
  - 제안: 리뷰 산출물의 diff-base 해시 표기 길이를 규약화(예: 최소 12자 prefix 또는 전체 해시)하고 orchestrator가 이를 통일 적용.

---

## 요약

이번 변경 대상은 일관성 검토 산출물(Markdown 문서 + JSON 메타파일)과 두 개의 spec 문서 수정으로 구성된다. 실질 코드 변경은 `spec/5-system/17-agent-memory.md` §6 API 표에 `X-Deleted-Count` 헤더 명세 추가와 `spec/2-navigation/16-agent-memory.md`의 scope 삭제 UX 기술 추가가 전부이며, 두 변경 모두 의도가 명확하고 관련 Rationale 섹션과 연결이 잘 되어 있다. 그러나 `X-Deleted-Count` 설명이 API 테이블 셀과 별도 bullet 두 곳에 중복 기술된 점, `_retry_state.json`에 다른 worktree를 가리키는 절대경로가 하드코딩된 점은 유지보수 위험이다. 리뷰 산출물 파일에서 diff와 전체 컨텍스트가 이중으로 실려 있는 구조적 중복, meta.json의 trailing newline 누락, 두 리뷰 세션 간 완성도 비대칭도 유지보수성을 약화시킨다. 중요 기능 코드(spec)의 품질 자체는 양호하나, 리뷰 인프라 파일들의 일관성과 중복 제거가 필요하다.

---

## 위험도

LOW

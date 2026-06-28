STATUS: OK

# 부작용(Side Effect) 리뷰 결과

분석 대상: 15개 파일 (review/consistency/** 신규 생성 12개 + spec/** 편집 2개 + spec/** 편집 1개)

---

## 발견사항

### **[INFO]** `_retry_state.json` 내 session_dir 경로가 실제 출력 디렉토리와 상이
- 위치: `review/consistency/2026/06/28/00_48_38/_retry_state.json`
- 상세: `session_dir` 값이 `…/00_48_37` (37초)인데 실제 산출물 파일들은 `…/00_48_38` (38초) 디렉토리에 존재한다. prompt_file/output_file 경로도 전부 `00_48_37`을 가리키고 있어 이 파일이 가리키는 경로와 실제 파일 위치가 1초 불일치한다. 리트라이 상태 추적 오케스트레이터가 이 경로를 읽어 재시도 여부를 판단할 경우 파일을 찾지 못해 오작동할 수 있다.
- 제안: `session_dir` 및 `subagent_invocations[*].prompt_file`/`output_file` 경로를 실제 디렉토리(`00_48_38`)와 일치시키거나, 이 파일이 오케스트레이터에서 실제로 읽히지 않는 단순 아카이브임을 주석으로 명시한다.

---

### **[INFO]** `spec/5-system/17-agent-memory.md` — CORS `exposedHeaders` 변경은 런타임 부작용 없음, spec 기술만
- 위치: `spec/5-system/17-agent-memory.md` §6 추가된 "삭제 건수 echo (`X-Deleted-Count`)" 항목
- 상세: 이번 변경은 spec 문서에 `X-Deleted-Count` 헤더와 CORS `exposedHeaders` 요건을 기술하는 것이다. 실제 코드(`codebase/backend/src/main.ts`, `web-chat-cors.ts`)는 이 diff 범위에 포함되지 않아 spec 변경만으로는 런타임 부작용이 없다. 단, spec이 `exposedHeaders` 추가를 의무로 기술하므로 구현 누락 시 cross-origin 브라우저 클라이언트가 헤더를 읽지 못하는 silent 실패가 발생할 수 있다. consistency 검토(rationale_continuity.md)에 따르면 실제 코드 변경(`main.ts`, `web-chat-cors.ts`)이 이미 완료되었으므로 실질 위험은 없다.
- 제안: 해당 코드 파일들이 이번 PR에 함께 포함되어 있는지 최종 확인한다.

---

## 요약

이번 변경 집합은 review/consistency/** 산출물 파일(Markdown, JSON) 12개 신규 생성과 spec/** 문서 2개 편집으로 구성된다. 실행 가능한 코드, 전역 변수, 환경 변수, 네트워크 호출, 이벤트 발생 변경이 전혀 없다. 파일시스템 부작용은 review/ 하위 디렉토리 신규 생성과 spec/ 파일 편집에 국한되며 이는 의도된 동작이다. 공개 API 시그니처나 인터페이스 변경도 없다. 유일한 주의 사항은 `_retry_state.json`의 session_dir 경로가 실제 산출물 디렉토리와 1초 불일치하는 점(INFO)이며, 오케스트레이터가 이 파일을 재시도 판단에 활용하지 않는다면 무해하다. spec 문서의 `X-Deleted-Count` + CORS `exposedHeaders` 기술은 이미 완료된 코드 변경을 사후 문서화한 것으로 추가 부작용 없다.

---

## 위험도

NONE

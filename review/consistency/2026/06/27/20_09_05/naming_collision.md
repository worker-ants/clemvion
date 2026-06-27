# 신규 식별자 충돌 검토

검토 대상: `plan/in-progress/graph-rag-doc-fix.md`
변경 파일: `spec/5-system/10-graph-rag.md` (line 25 링크 교체, 헤딩 무변경)

## 발견사항

이 plan 이 도입하는 변경은 다음 하나다.

- `spec/5-system/10-graph-rag.md` line 25: 링크 텍스트 `PRD Graph RAG` + 타겟 `./10-graph-rag.md` (self-link) → 링크 텍스트 `PRD AI & 지식 저장소` + 타겟 `../4-nodes/3-ai/_product-overview.md`

6개 점검 관점 전체에서 충돌 없음.

1. **요구사항 ID 충돌** — 새 요구사항 ID 없음. 변경 없음.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 없음. 변경 없음.
3. **API endpoint 충돌** — 새 endpoint 없음. 변경 없음.
4. **이벤트/메시지명 충돌** — 새 이벤트/메시지 없음. 변경 없음.
5. **환경변수·설정키 충돌** — 새 ENV var / config key 없음. 변경 없음.
6. **파일 경로 충돌** — 새 파일 생성 없음. 기존 `10-graph-rag.md` 편집이며, 교체 대상 링크 텍스트 `PRD AI & 지식 저장소` 는 `spec/0-overview.md §6.1` 에서 동일 문서(`spec/4-nodes/3-ai/_product-overview.md`)를 가리킬 때 이미 사용 중인 표기("PRD 9")와 일관성이 있고, 실제 파일은 실재가 확인됐다. 자기참조 self-link(`./10-graph-rag.md`)가 제거되어 형제 spec(8·9) 컨벤션과 정렬된다.

## 요약

`graph-rag-doc-fix` plan 은 `spec/5-system/10-graph-rag.md` 의 관련 문서 링크 1줄을 self-link 에서 공유 PRD 링크로 교체하는 것이 전부이며, 새 식별자(요구사항 ID, 엔티티명, API endpoint, 이벤트명, ENV var, 파일 경로)를 일절 도입하지 않는다. 충돌 대상이 없어 명명 충돌 위험이 없다.

## 위험도

NONE

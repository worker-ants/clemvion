# Consistency (--impl-done) — agent-memory 공유 유틸 추출

**BLOCK: NO** — Critical 0. 2 checker(cross-spec/convention) BLOCK:NO. rationale/plan/naming 은 순수 리팩토링이라 생략(신규 ID/번복 없음).
- cross-spec/convention: shared 파일 명명(conversation-context-* 패턴 일관), spec frontmatter code glob 정합. **공통 WARNING: IE handler DEFAULT import 미완** → code 리뷰 fix A 로 해소. INFO: 17-agent code 미등록 → fix C.
- spec 본문 무변경(순수 리팩토링), 동작 불변.

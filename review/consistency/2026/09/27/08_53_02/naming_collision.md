# 신규 식별자 충돌 검토 — spec/conventions/ (review-citations.md · swagger.md)

## 검토 범위

`--impl-prep` 스코프(`spec/conventions/`)로 전달된 번들은 두 파일 전문을 담고 있으나, 실제
target 변경분은 병합된 3개 커밋(`f1e943be4` planner draft → `c8bf27c8e` spec 반영 →
`b77e10a57` plan 정리)의 diff 로 한정된다. 그 diff 를 기준으로 신규 식별자 도입 여부를
검토했다.

```
spec/conventions/review-citations.md | 27 ++++++++++++++++++++++++--
spec/conventions/swagger.md          |  5 +++--
```

변경 내용 요약: §3 표의 "DTO·컨트롤러의 JSDoc" 한 행을 "DTO 필드" 행과 "응답 DTO 클래스" 행
둘로 가르고, 새 Rationale 서브섹션 `§3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다
(2026-09-27)` 를 추가했다. 새 파일·새 코드 심볼·새 endpoint·새 ENV var 는 도입하지 않는다.

## 발견사항

검토 관점 1~6 (요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로) 전부에서
**신규 식별자가 도입되지 않았다**:

- **엔티티/타입명**: diff 가 언급하는 `TriggerWorkflowRefDto` 는 기존에 이미 존재하는 응답
  DTO(swagger.md §1-7 표에 이미 등재, `ScheduleTriggerWorkflowRefDto` 와 짝 비교로도 이미
  언급됨)를 **예시로 재인용**한 것이지 새로 명명한 엔티티가 아니다. 신규 클래스·인터페이스
  명은 도입되지 않는다.
- **파일 경로**: `code:` frontmatter 변경 없음(두 파일 모두 frontmatter 는 diff 밖). 새
  spec 파일도 생성되지 않았다 — 기존 두 파일을 in-place 수정.
- **anchor(문서 내부 식별자) 충돌 점검**: 새로 추가된 heading
  `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)` 가 생성하는 GitHub
  스타일 slug 는 `#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27` 이며, 같은
  diff 안에서 이 slug 를 참조하는 링크
  (`[Rationale](#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27)`, §3 표
  "응답 DTO 클래스" 행)와 정확히 일치한다. `review-citations.md` 안의 기존 heading 중
  이 slug 와 충돌하는 것은 없다(기존 Rationale heading 5개는 모두 다른 문구로 시작하고,
  본문의 `## 3. 적용 범위 — 맥락 없이 읽히는 자리` 가 만드는 slug
  `#3-적용-범위--맥락-없이-읽히는-자리` 와도 접두사만 "3" 으로 같을 뿐 전체 문자열은 다르다).
- **"§3" 이라는 표기 자체의 잠재적 혼동(WARNING 후보로 검토했으나 기각)**: 새 Rationale
  heading 이 본문 내내 "§3" 로 약칭되는 `## 3. 적용 범위` 절과 같은 접두사("§3")를 쓴다.
  다만 이는 같은 문서의 기존 Rationale 관행과 동형이다 — swagger.md 의
  `### §1-6 numeric wire 타입 — 가드와 규약의 책임 분리`, 이 문서 자신의 다른 각주가
  참조하는 `§1-7`, `§3 DTO 길이는 왜 강제가 아닌가` 등, "Rationale 서브섹션 제목을 그것이
  설명하는 본문 절 번호로 시작한다"는 패턴이 저장소 전체에 이미 정착돼 있다. 새 heading 은
  그 관행을 그대로 따른 것이라 신규 명명 충돌로 보지 않는다.
- **트래커 번호**: `#1292`(질문 제기)·`#1291`(위반 유입) 두 이슈 번호가 diff 에 새로 등장하지만
  본 저장소에서 이슈 번호는 GitHub 발급 식별자이고 문서가 새로 "부여"하는 값이 아니므로
  요구사항 ID 충돌 검토 대상이 아니다. 두 번호가 이 diff 안에서 서로 다른 역할(질문 제기
  vs 실제 위반 유입)로 쓰여 혼동 소지는 낮다.

## 요약

이번 target 은 기존 두 convention 문서의 §3 항목을 "필드 JSDoc"과 "클래스 JSDoc"으로 세분하는
순수 문서 명확화이며, 새 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트명·환경변수·
설정키·spec 파일 경로 중 어느 것도 신규 도입하지 않는다. 유일하게 검토할 만했던 "신규 heading"
은 자체 생성 anchor slug 가 문서 내 다른 heading 과 충돌하지 않고, 참조 링크와도 정확히
일치하며, "§N 접두 Rationale 제목" 관행도 기존 패턴을 그대로 따른다. 신규 식별자 충돌 관점에서
지적할 CRITICAL/WARNING 은 없다.

## 위험도

NONE

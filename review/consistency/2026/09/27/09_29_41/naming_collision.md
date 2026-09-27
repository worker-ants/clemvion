# 신규 식별자 충돌 검토 — dto-class-jsdoc-citation

## 검토 범위

- scope 델타(2개): `spec/conventions/review-citations.md`, `spec/conventions/swagger.md`
- 구현 diff(4개 파일 / 113줄): `schedule-response.dto.ts`, `trigger-response.dto.ts` 의
  클래스 JSDoc → `//` 주석 이동, `dto-jsdoc-citation-guard.ts` 독스트링 정정,
  `dto-jsdoc-citation.spec.ts` 의 `EXPECTED_DTO_JSDOC_CITATIONS` 를 `[]` 로 비움.

`git diff origin/main...HEAD` 를 절대경로 워킹트리에서 직접 확인했다. 이번 변경은 **§3 표의
근거 문장 정정 + 기존 두 클래스 JSDoc 인용을 `//` 로 옮기는 것**이 전부다.

## 발견사항

신규로 도입된 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·spec 파일
경로는 **없음**을 확인했다.

- 요구사항 ID: 신규 ID 없음 (기존 `review-citations`/`swagger` id 유지, frontmatter 변경 없음)
- 엔티티/타입명: `ScheduleTriggerWorkflowRefDto`·`TriggerWorkflowRefDto` 는 기존 클래스이고
  이번 diff 는 그 클래스의 JSDoc 위치만 옮겼을 뿐 이름을 새로 만들지 않았다
- API endpoint: 변경 없음
- 이벤트/메시지명: 변경 없음
- 환경변수·설정키: 변경 없음
- 파일 경로: `code:` frontmatter 목록에 신규 entry 없음(diff 확인 결과 두 spec 파일
  frontmatter 는 무변경)

새로 생긴 것은 문서 내부의 heading 하나뿐이다 — `review-citations.md` Rationale 에
`### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)` 를 추가하고, 본문에서
`[Rationale](#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27)` 앵커로 참조한다.
같은 파일의 기존 heading 전체를 grep 해 대조한 결과(`review-citations.md`·`swagger.md` 각각),
동일 텍스트의 heading 은 없어 GitHub/마크다운 앵커 슬러그 충돌(예: `-1` suffix 재배정) 위험이
없다. `swagger.md` 에도 `§3 DTO 길이는...`·`§3 보안·정책 캐비엇...` 두 heading 이 이미 있지만
전체 텍스트가 달라 앵커가 갈리지 않는다 — 표시상 "§3" 접두만 같을 뿐 실질 충돌은 없다.

## 요약

이번 target 변경은 신규 식별자를 사실상 도입하지 않는다 — 기존 두 DTO 클래스(이미 존재)의
JSDoc 주석 두 곳을 `//` 로 옮기고, 그 근거를 설명하는 spec 문서 heading 하나를 추가했을
뿐이다. ID·엔티티/타입명·endpoint·이벤트명·환경변수·파일 경로 어느 축에서도 기존 사용처와
의미가 다르게 겹치는 이름이 없다. 새로 추가된 heading 앵커도 같은 문서 내 기존 heading 과
텍스트가 겹치지 않아 슬러그 충돌이 없음을 확인했다.

## 위험도

NONE

# 신규 식별자 충돌 검토 — spec/7-channel-web-chat (--impl-done)

## 사전 확인

- `git diff origin/main --stat -- spec/7-channel-web-chat/` → **0 파일 변경**. 본 target payload 에 포함된 `spec/7-channel-web-chat/*.md` 전문은 기존(main 과 동일) 내용의 컨텍스트 덤프이며, 이번 작업이 새로 도입한 spec 텍스트가 아니다.
- 실제 `origin/main` 대비 diff(`git diff origin/main --stat`)는 다음으로 한정:
  - `codebase/channel-web-chat/src/lib/widget-state.test.ts` (신규 테스트 파일)
  - `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (신규 테스트 파일)
  - `codebase/channel-web-chat/src/lib/widget-state.ts` — 기존 `mergeMessages` 함수의 **JSDoc 주석만** 정정(로직 무변경)
  - `plan/in-progress/webchat-multiturn-restore-test.md`, `review/code/2026/07/12/01_10_15/**` (문서·리뷰 산출물, 식별자 신설과 무관)
- `plan/in-progress/webchat-multiturn-restore-test.md` 자체가 "범위(test-only, 제품 코드 무변경)" 로 명시하고 있고, 결정 메모에도 "제품 코드·spec·신규 식별자·API 변경 0" 이라 기재돼 있다 — 자체 신고와 실측 diff 가 일치한다.
- 본 검토가 트리거된 이유는 신규 spec 도입이 아니라, `spec/7-channel-web-chat/1-widget-app.md` frontmatter 의 `code:` glob 이 `codebase/channel-web-chat/**` 를 매칭해 spec-linked 코드 변경 가드가 발동했기 때문이다(프로젝트 컨벤션상 `--impl-done` 의무 호출).

## 신규 식별자 스캔 결과

diff `+` 라인을 전수 확인:

- **요구사항 ID** — 신규 부여 없음(spec 파일 무변경).
- **엔티티/타입명** — 신규 export 타입·인터페이스·클래스 없음. 테스트 파일 내부 로컬 헬퍼(`user()`, `bot()`, `waiting()`, `fetchMock` 등)는 파일-스코프 `const`/함수로 export 되지 않으며, 다른 어떤 모듈에서도 참조되지 않아 전역 네임스페이스에 노출되지 않는다.
- **API endpoint** — 신규 endpoint 없음. `use-widget-eager-start.test.ts` 의 mock fetch 분기(`/api/external/executions/:id`, `/api/hooks/...`)는 기존 EIA 표면(spec §3 EIA 매핑, `4-security.md` §2)을 그대로 재사용한 테스트 mock 이다.
- **이벤트/메시지명** — 신규 webhook/queue/SSE 이벤트명 없음. `waiting_for_input` 등은 기존 EIA §6.2 표기 재사용.
- **환경변수·설정키** — 신규 ENV var/config key 없음.
- **파일 경로** — 신규 파일 2개(`widget-state.test.ts`, `use-widget-eager-start.test.ts`)는 각각 대상 소스(`widget-state.ts`, `use-widget-eager-start.ts`)와 동일 디렉토리의 기존 `*.test.ts` 명명 컨벤션을 그대로 따르며, 다른 파일과 경로 충돌 없음.

## 발견사항

없음.

## 요약

이번 turn 의 실제 변경분(`origin/main` 대비)은 `codebase/channel-web-chat` 하위 테스트 파일 2개 신설과 기존 `mergeMessages` 함수 JSDoc 주석 정정뿐이며, `spec/7-channel-web-chat/**` 는 한 글자도 변경되지 않았다. prompt payload 에 포함된 spec 전문은 impl-done 검토 관행상 첨부된 기존(불변) 컨텍스트일 뿐 "target 이 새로 도입하는 식별자"가 아니다. 신규로 도입된 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로가 전무하므로 신규 식별자 충돌 관점에서 검토할 대상 자체가 없다. 이 검토는 `1-widget-app.md` 의 `code:` glob 매칭에 따른 절차상 필수 게이트 실행이며, 실질적 충돌 리스크는 없다.

## 위험도

NONE

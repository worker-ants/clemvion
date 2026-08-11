# 변경 범위(Scope) Review

대상: `origin/main...HEAD` (`claude/webchat-reload-rest-branches`, 11 commit) — §3.1-2·§R4 재로드 REST 오류 분기 구현 + 두 라운드 리뷰(`16_09_40`, `16_26_09`) 반영 + 그 산출물 커밋.

기능/코드 diff 는 7파일(`CHANGELOG.md`, `session-store.ts`, `use-token-refresh.ts`, `use-widget-eager-start.test.ts`, `use-widget.ts`, `spec/7-channel-web-chat/3-auth-session.md`, `plan/in-progress/webchat-auth-session-status-reconcile.md`, 549 insertions)이고, 나머지 22파일은 `review/code/2026/08/10/{16_09_40,16_26_09}/**` 리뷰 산출물이다. 프롬프트에 diff 가 생략된 `use-widget.ts`·`use-widget-eager-start.test.ts` 는 `git diff origin/main...HEAD` 로 직접 대조했다.

## 발견사항

- **[INFO]** 기능 diff 자체는 스코프 이탈 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`seedWaitingFromStatus`, `recoverFromExpiredToken`), `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (신규 `it` 6건)
  - 상세: `use-widget.ts` 의 변경은 (1) `seedWaitingFromStatus` 의 catch 블록에 `404`/`401` 분기 추가, (2) `401` 복구를 별도 `recoverFromExpiredToken` 콜백으로 분리(16_09_40 maintainability WARNING 반영), (3) 두 `openStream` 호출부가 캡처된 지역 변수 대신 `sessionRef.current` 를 읽도록 수정(16_09_40 CRITICAL 4명 독립 수렴 반영)으로 국한된다. 테스트 파일은 기존 `describe` 안에 신규 `it` 6개(404·401-성공·401-경합-재검사·401-재차실패·401-네트워크오류·500)와 `installControllableEventSource` 에 `getUrl()` 하나를 추가했을 뿐, 기존 테스트·다른 헬퍼·기존 import 는 손대지 않았다. 무관한 리팩토링·포맷팅·주석 정리는 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** `session-store.ts` 의 `applyRefreshedToken` 추출은 요청된 WARNING(자매 갱신 경로 리터럴 중복)에 정확히 대응
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`
  - 상세: 두 갱신 경로(`use-token-refresh.ts` 주기 갱신, `use-widget.ts` 401 낙관적 복구)가 복제하던 "토큰 반영+영속화" 4줄만 뽑았고, 실패 정책이 정반대인 오케스트레이션은 그대로 분리 유지했다(`16_09_40` maintainability 가 명시적으로 권고한 범위와 일치). `use-token-refresh.ts` 는 `saveSession` import 를 `applyRefreshedToken` 으로 교체했고 `saveSession` 잔존 참조가 없어(`grep` 확인) 죽은 import 도 없다.
  - 제안: 없음.

- **[INFO]** `CHANGELOG.md`·`spec/7-channel-web-chat/3-auth-session.md`·`plan/in-progress/webchat-auth-session-status-reconcile.md` 는 전부 이번 기능/이번 리뷰 라운드가 직접 만든 필요에 대한 비례적 응답
  - 위치: `CHANGELOG.md:166-174`(신규 항목), `spec/7-channel-web-chat/3-auth-session.md`(§3.1 배너 정정 + frontmatter 조율 안내), `plan/in-progress/webchat-auth-session-status-reconcile.md:1-141`(신규 plan)
  - 상세: CHANGELOG 항목은 이 diff 가 구현한 정확히 그 기능(404/401 분기)만 서술한다. spec 배너 정정은 "미구현(Planned)"→"구현됐다"로 사실만 갱신했고 frontmatter(`status: implemented`)는 손대지 않았다(별도 PR `#1130` 과의 충돌 회피, `16_09_40` scope 판단과 동일). 신규 plan 파일은 그 frontmatter 충돌 회피 결정을 커밋 메시지에만 남겼던 것을 `16_09_40` scope WARNING 이 지적해 반영한 결과이고, 동시에 이번 세션이 스스로 흘렸다가 재발견한 갭 3건(`start()` 401 경로 도달성, refresh 동시 발화 경합, catch 분기 세대 재검사 미검증)도 같은 문서에 명시적으로 등재했다 — `CLAUDE.md`/메모리의 "review/ 는 SoT 아니므로 미룬 항목은 plan/ 에 적어라" 관례에 정확히 부합한다. 세 파일 모두 이번 diff 가 스스로 만든 문제에 대한 응답이지, 무관한 영역 확장이 아니다.
  - 제안: 없음.

- **[INFO]** 리뷰 세션 산출물 22파일(`review/code/2026/08/10/16_09_40/**`, `review/code/2026/08/10/16_26_09/**`) 이 같은 브랜치 diff 에 포함됨 — 관례상 정상이나 규모가 큼
  - 위치: `review/code/2026/08/10/16_09_40/*.md`·`*.json` (11파일), `review/code/2026/08/10/16_26_09/*.md`·`*.json` (11파일)
  - 상세: `CLAUDE.md` 는 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 를 코드 리뷰 산출물의 지정 저장 위치로 명시하고, `review/` 는 gitignore 대상이 아니며, "review/ 는 SoT 아니므로 미룬 항목은 plan/ 에 적어라"는 메모리 교훈도 이 산출물들이 커밋되어 저장소에 남는 것을 전제한다. `git log` 상에도 동형의 선례(`chore(review): <round> 라운드 산출물` 커밋 2건, `b8689ec41`·`de6a1b84b`)가 이미 이 브랜치 자체에 있다. 따라서 이 22파일은 스코프 위반이 아니라 이 저장소가 강제하는 review-fix-review 워크플로(developer SKILL §REVIEW WORKFLOW, hook 강제)의 정상 부산물이다. 다만 실질 기능 변경(7파일, 549줄)에 비해 리뷰 아카이브(22파일, ~1,700줄 이상)의 절대량이 훨씬 커서, 이 diff 를 처음 보는 리뷰어 입장에서는 "무엇이 실제 변경인지" 를 가리는 노이즈로 작용할 수 있다는 점만 참고로 남긴다.
  - 제안: 조치 불요(관례 준수). 다만 향후 세션이 이런 대형 리뷰 아카이브 커밋을 별도 `chore(review):` 커밋으로 분리(이번 브랜치가 이미 그렇게 하고 있음)하는 관행을 계속 유지할 것을 권장 — 기능 커밋과 산출물 커밋이 뒤섞이지 않아 스코프 리뷰가 더 쉬워진다.

- **[INFO]** 설정/의존성 파일 변경 없음
  - 위치: 전체 diff (`git diff origin/main...HEAD --name-only`)
  - 상세: `package.json`·`tsconfig`·`eslint` 등 설정 파일은 diff 에 없다. `.json` 확장자로 걸리는 파일은 `review/code/**/{meta,_retry_state}.json` 뿐이며 둘 다 리뷰 하네스가 자동 생성하는 메타데이터로 코드 설정이 아니다.
  - 제안: 없음.

## 요약

이번 diff 는 §3.1-2·§R4 가 spec 에 확정 서술해 두고 비어 있던 재로드 REST 오류 분기 3종(404 종료·401 낙관적 refresh 성공/재실패)을 구현하고, 그 위에서 두 라운드(`16_09_40`, `16_26_09`)의 자동 리뷰가 찾은 CRITICAL 1건·WARNING 8+7건을 즉시 반영한 결과다. 실 기능/테스트/spec/plan/CHANGELOG 7파일은 전부 "이번 기능 또는 이번 diff 가 만든 문제"에 1:1로 대응하며, 무관한 리팩토링·포맷팅·주석/임포트 정리·기능 확장·설정 변경은 발견되지 않았다. 함께 커밋된 22개 리뷰 산출물 파일은 `CLAUDE.md` 가 지정한 `review/code/**` 저장 관례와 이 브랜치 자체의 선례에 부합하는 정상 부산물이며 스코프 이탈이 아니다 — 다만 실질 코드 변경(7파일)에 비해 절대량이 커서 리뷰 노이즈가 된다는 점만 참고로 기록한다.

## 위험도

NONE

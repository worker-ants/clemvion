# 변경 범위(Scope) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원
> (`plan/complete/webchat-session-controls-history-restore.md`). 3개 커밋(feat + 2회 ai-review 반영 fix/refactor),
> 총 48개 변경 파일을 원본(작업 착수 전) diff(`git diff origin/main...HEAD`) 기준으로 검토했다.

## 발견사항

- **[INFO]** `plan/complete/webchat-session-controls-history-restore.md` frontmatter `status: in-progress` 로 남아있음
  - 위치: `plan/complete/webchat-session-controls-history-restore.md:5`
  - 상세: 3번째 커밋 메시지("chore(plan): mark ... complete")와 파일 위치(`plan/complete/`)는 완료를 의도하지만, frontmatter `status` 필드는 `in-progress` 그대로다. 코드 변경 범위 자체와는 무관한 메타데이터 drift로, "scope"보다는 plan-lifecycle 컨벤션에 가깝다.
  - 제안: `status: complete` 로 정정(차단 사유 아님, 참고용).

## 범위 검증 상세

1. **의도 이상의 변경 없음**: 계획서(파일 14)의 A(spec 재조정 3건)·B(backend `interaction.service.ts` durable thread 동봉)·C(frontend `conversation.ts`/`eia-types.ts`/`use-widget.ts`/`panel.tsx`/`widget-state.ts`) 3개 트랙과 실제 diff 파일 목록이 1:1로 대응한다. 계획에 없던 모듈·엔드포인트·DB 마이그레이션은 없다.
2. **리팩토링은 신규 코드 자체에 국한**: `resetSessionRefs()` 추출(`use-widget.ts`), `CONFIRM_COPY` 조회 테이블 도입, `isActiveConversationPhase` 를 `widget-state.ts` 로 이관한 것은 모두 *이번 PR 이 새로 추가한 코드*(newChat/endConversation, confirm UI, 컨트롤 노출 조건)를 대상으로 한 리팩토링이다 — 무관한 기존 코드를 손댄 사례는 없다. 이 리팩토링들은 2·3차 커밋에서 `/ai-review` WARNING 처리로 기록돼 있어(RESOLUTION.md) 근거가 추적 가능하다.
3. **기능 확장(over-engineering) 없음**: `endConversation`/`newChat` 은 계획서 "사용자 결정" 그대로("새 대화 + 대화 종료 둘 다, 가벼운 확인")만 구현했다. gen guard(`startGenRef`)는 신규 기능(종료/새 대화)이 유발하는 실제 race를 막는 필수 정합성 코드이며 부가 기능이 아니다.
4. **무관한 파일 수정 없음**: `git diff --stat origin/main...HEAD` 48개 파일 = 코드 13(백엔드 1+backend spec 1, 프런트 11) + spec 3 + plan 1 + CHANGELOG 1 + `review/code/**`·`review/consistency/**` 30(프로세스 산출물, 본 저장소 컨벤션상 커밋 대상 — 메모리 "review/ 는 gitignored 아님, SUMMARY/RESOLUTION 도 커밋" 과 일치). `package.json`/lint/CI 설정, 다른 모듈(예: workflow 에디터, 알림 등)에 대한 수정은 전무하다.
5. **포맷팅 변경 없음**: 각 파일 diff 가 순수 추가 라인 위주이며, 기존 라인의 개행/들여쓰기만 바꾸는 잡음성 hunk가 보이지 않는다(`panel.tsx` 의 헤더 `<div className="wc-panel-actions">` 래핑은 신규 버튼 2개를 배치하기 위한 구조적으로 필요한 변경).
6. **주석 변경은 전부 신규 로직 설명**: JSDoc·인라인 주석 대량 추가(`interaction.service.ts`, `conversation.ts`, `eia-types.ts`, `widget-state.ts`, `use-widget.ts`)는 모두 이번에 추가된 `conversationThread` 동봉·`roleOf` 매핑·`isActiveConversationPhase`·`endConversation`/gen guard 를 설명하는 내용이며, 무관한 기존 코드의 주석을 건드리지 않았다.
7. **임포트 변경은 필요분만**: `panel.test.tsx` 의 `fireEvent` 임포트 추가(확인 다이얼로그 클릭 테스트에 필요), `panel.tsx` 의 `useState` 추가(confirm 상태), `isActiveConversationPhase` named import 추가 — 전부 신규 코드가 실제로 사용. 불필요한 임포트 정리/추가 없음.
8. **설정 변경 없음**: `styles.ts`(CSS-in-JS) 에 신규 클래스(`wc-panel-actions`/`wc-panel-action`/`wc-confirm*`)만 additive 로 추가됐고, 빌드/lint/tsconfig 등 설정 파일은 diff 대상에 없다.

## 요약

전체 diff(48 파일)를 계획서(`plan/complete/webchat-session-controls-history-restore.md`)의 A/B/C 작업 목록과 대조한 결과, 코드 변경은 "세션 컨트롤 2종 + 새로고침 히스토리 복원"이라는 의도된 범위 안에 정확히 머물러 있다. 3개 커밋 중 2·3번째는 `/ai-review` 라운드 결과(WARNING) 반영이며, 그 리팩토링(헬퍼 추출·조회 테이블·phase 판정 이관)도 모두 이번에 신설된 코드 자체를 대상으로 해 "무관한 리팩토링"에 해당하지 않는다. `review/code/**`·`review/consistency/**` 하위 다수 신규 파일은 언뜻 방대해 보이지만 본 저장소가 리뷰 산출물을 PR 에 커밋하는 것을 표준 워크플로로 요구하므로 스코프 이탈이 아니다. 유일한 옥의 티는 plan frontmatter `status` 필드가 `complete` 로 갱신되지 않은 메타데이터 누락(INFO)뿐이며, 이는 코드 스코프와 무관하다.

## 위험도
NONE

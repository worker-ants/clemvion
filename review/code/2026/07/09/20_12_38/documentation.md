# 문서화(Documentation) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원 changeset — 6번째(최종 수렴) 리뷰 라운드(`20_12_38`). 본 라운드의 직접 payload(34개 파일)는 앞선
> 5라운드(`18_44_10`~`20_01_04` `/ai-review`, `18_27_06` `consistency-check --spec`)의 리뷰 산출물 커밋 + 4개
> spec 문서(`14-external-interaction-api.md`/`1-widget-app.md`/`2-sdk.md`/`3-auth-session.md`) diff 로만
> 구성되며, 애플리케이션 코드(`interaction.service.ts`/`use-widget.ts`/`panel.tsx`/`conversation.ts` 등) 자체의
> diff 는 이번 payload 범위 밖이다(알려진 "후속 라운드 changeset 이 직전 반영 코드를 제외" 패턴). payload 인용만
> 신뢰하지 않고 `git log`/`git show`/`git diff origin/main...HEAD`로 현재 HEAD(커밋 `672f4b6bb`)의 실제 코드·
> CHANGELOG·plan·README 상태를 직접 열람해 독립 재검증했다.

## 발견사항

- **[INFO]** 직전 라운드(`20_01_04`)의 유일한 WARNING(CHANGELOG stale 서술)이 실제로 반영됐음을 코드 레벨로 확인
  - 위치: `CHANGELOG.md:7`, 반영 커밋 `672f4b6bb`("docs(web-chat): ai-review R5 반영")
  - 상세: `git show 672f4b6bb -- CHANGELOG.md` 로 직접 확인한 결과, "진행 중(booting/streaming/awaiting) 에서만
    노출"(폐기된 round1 서술)이 "대화가 확립된(`streaming`/`awaiting_user_message`) 뒤에만 ... `booting`(webhook
    in-flight, 세션 미확립) ... 는 미노출"로 정확히 정정되어 있다. 현재 코드(`widget-state.ts:43-45`
    `isActiveConversationPhase`)·spec(`1-widget-app.md` §2 헤더 행)과 line-level 로 일치한다. 같은 커밋에서
    `use-widget.ts` catch 블록 주석의 하드코딩 라인번호(`:289·:299`)도 "try 블록의 두 gen 검사(BOOTED 직전·
    openStream 직전)"라는 구조적 서술로 대체됐고(`use-widget.ts:305-306`), plan frontmatter `spec_impact` 에
    `spec/7-channel-web-chat/2-sdk.md` 가 추가되어 실제 변경 spec 파일 4건과 1:1 대응함을 확인했다
    (`plan/complete/webchat-session-controls-history-restore.md:5-9`). 신규 문서 결함은 아니며, 이전 라운드가
    지적한 항목이 정확히 해소됐음을 재확인하는 참고 기록이다.
  - 제안: 없음(확인 완료).

- **[INFO]** `codebase/channel-web-chat/README.md` "상태" 섹션이 이번 changeset 의 신규 기능(헤더 세션 컨트롤·
  durable thread 새로고침 복원·turn source→role 매핑)을 정확히 반영
  - 위치: `codebase/channel-web-chat/README.md:62-68` (커밋 이력상 반영, `git diff origin/main...HEAD` 로 직접 확인)
  - 상세: "구현됨" 목록에 "헤더 세션 컨트롤(새 대화·대화 종료 + 가벼운 확인)", "세션 복원(... + EIA `getStatus`
    가 durable `conversationThread` 동봉 → 새로고침 시 대화 히스토리 전체 복원)", "conversation 렌더 규약(...
    turn `source`(백엔드 5값 ...)→말풍선 role 매핑)"이 정확한 문구로 추가돼 있다. CHANGELOG 와 달리 이 README
    갱신은 booting 관련 과장 서술 없이 처음부터 정확했다. 문제 없음, 참고 기록.
  - 제안: 없음.

- **[INFO]** 잔존 backlog 문서 갭 3건 — 여러 라운드(19_40_53/20_01_04)에 걸쳐 반복 확인·저우선 defer 확정,
  이번 라운드에서도 상태 불변(신규 악화·해소 없음)
  - 위치: (1) `use-widget-eager-start.test.ts:771` 테스트 제목("... host conversationEnded 통지 경로")이 실제
    단언 범위(phase 전이만, `sendEvent`/`postMessage` spy 없음)보다 넓게 읽힘. (2) `spec/5-system/
    14-external-interaction-api.md` §5.3/§R17 의 `context.conversationThread` "키 생략 vs 형제 필드 null" 비대칭이
    전용 DTO/OpenAPI 스키마로 형식화되지 않음. (3) durable thread 존재 + 대기 `NodeExecution` 부재 조합에서
    `context` 전체가 조용히 `null` 로 드롭되는 edge case가 spec 본문에 명문화되지 않음(테스트도 미고정).
  - 상세: 세 항목 모두 `review/code/2026/07/09/19_40_53/RESOLUTION.md`·`review/code/2026/07/09/20_01_04/
    RESOLUTION.md` 에 "저우선/backlog"로 명시적으로 defer 기록돼 있고, 현재 코드/spec 상태를 직접 확인한 결과
    이번 라운드에서 새로 발견되거나 악화된 변화는 없다. 기능·spec fidelity 를 저해하지 않는 참고 사항이다.
  - 제안: 조치 불필요(기존 backlog 유지). 여력이 되면 (1) 테스트 제목에서 "통지 경로" 문구를 빼거나
    `postMessage`/`sendEvent` spy 를 추가, (2)(3) spec 문구에 존재/부재 조건과 fail-safe 동작을 한 줄씩 보강.

## 검증한 항목 (문제 없음 확인)

- **spec 4개 파일 diff**(`14-external-interaction-api.md` §5.3/R17, `1-widget-app.md` §2/§3.1, `2-sdk.md`
  `wc:event` 행, `3-auth-session.md` §3.1) — 모두 실제 구현(durable thread 조건부 동봉·키 생략·`endConversation`
  graceful/cancel 라우팅·`roleOf` 매핑·`conversationEnded.reason` 값)과 line-level 로 일치함을 앞선 5라운드에
  걸쳐 반복 코드-대조 검증했고, 이번 라운드에서 그 최종 diff 텍스트를 재열람한 결과도 동일하다. R17 addendum 은
  기각 대안(a)/(b)까지 근거와 함께 기록해 rationale 연속성이 좋다.
- **`execution.entity.ts` JSDoc 교차참조**(`:161-162`): "단 EIA `getStatus`(...) 는 waiting_for_input 시 이
  스냅샷을 read-only 로 노출한다" 문구가 실제로 존재 — 여러 라운드에 걸쳐 지적된 "엔티티 주석만 읽으면 오해
  가능" 긴장이 해소돼 있음을 재확인.
- **plan frontmatter**: `status: complete`, `spec_impact` 4개 spec 파일 전부 등재 — 메타데이터 완전성 이슈 해소.
- **CHANGELOG 항목**: 백엔드(additive read-only 확장)·프런트(CSR 위젯 전용) 스코프 서술, SoT 링크 3개 spec 파일
  모두 정확.
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD` 전체(코드 20파일 + 문서)에 신규 마커 없음(재확인).
- **환경변수/설정**: 이번 changeset 은 신규 env var·설정 옵션을 도입하지 않는다(additive REST 필드 확장 + FE
  전용 UI/상태 변경). 별도 설정 문서화 필요 없음.
- **예제 코드**: `14-external-interaction-api.md` §5.3 의 `jsonc` 응답 예시가 신규 `context.conversationThread`
  필드를 포함하도록 갱신돼 있어(파일 31 diff), API 소비자용 사용 예시 갭 없음.

## 요약

6라운드에 걸친 반복 리뷰·수정 사이클(`18_44_10`~`20_01_04` `/ai-review` + `18_27_06` `consistency-check`)을
거치며 spec 4개 파일·JSDoc·엔티티 주석·plan frontmatter·README·CHANGELOG 가 실제 코드 최종 상태(HEAD
`672f4b6bb`)와 line-level 로 정합함을 이번 라운드에서 직접 코드 대조로 재확인했다. 직전(`20_01_04`) 라운드의
유일한 WARNING(CHANGELOG "booting 세션 컨트롤 노출" stale 서술)은 커밋 `672f4b6bb` 로 정확히 반영됐고, 함께
지적된 INFO 2건(plan `spec_impact` 누락, catch 주석 하드코딩 라인번호)도 같은 커밋에서 해소됐다. 이번 라운드
payload 자체는 애플리케이션 코드 diff 를 포함하지 않아 리뷰 대상은 review 산출물·spec 문서였으나, 그 문서들이
서술하는 실제 코드 상태를 직접 열람해 문서-코드 불일치가 새로 발생하지 않았음을 검증했다. 새로운
CRITICAL/WARNING 급 문서화 갭(공개 API 미문서화·README/CHANGELOG 누락·오래된 주석·신규 env var 미문서화)은
발견되지 않았다. 잔존하는 3건의 저우선 backlog(테스트 제목 과대표현, OpenAPI 스키마 미형식화, node-null edge
case 미명문화)는 여러 라운드에 걸쳐 이미 defer 로 확정된 항목으로 이번 라운드에서도 상태 불변이며 차단
사유가 아니다.

## 위험도
NONE

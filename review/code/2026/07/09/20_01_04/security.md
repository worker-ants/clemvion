# 보안(Security) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원 changeset 의 5차(누적) 리뷰 라운드(20_01_04). 이번 라운드의 diff(26개 파일)는 **애플리케이션 코드
> (`codebase/**/*.ts`, `.tsx`) 를 전혀 포함하지 않는다** — 전량이 (1) 이전 4개 라운드
> (`review/code/2026/07/09/{19_26_15,19_40_53}/*`)의 리뷰 산출물(requirement/scope/security/side_effect/testing,
> RESOLUTION/SUMMARY/`_retry_state.json`/`meta.json`/api_contract/concurrency/documentation)과
> `review/consistency/2026/07/09/18_27_06/*` 산출물의 신규 커밋, (2) 그 리뷰들이 근거로 삼은 spec 문서 4종
> (`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/{1-widget-app,2-sdk,3-auth-session}.md`)
> 갱신뿐이다. 실제 보안 표면 코드(`interaction.service.ts`, `interaction.guard.ts`, `use-widget.ts`, `panel.tsx`,
> `conversation.ts`, `eia-types.ts`)는 앞선 라운드(`19_26_15/security.md`)에서 이미 CRITICAL/WARNING 0건(NONE)으로
> 독립 검토됐고, 그 이후(`19_40_53`)에도 코드 diff 재출현이 없어 추가 코드 변경 없이 문서·리포트만 누적된
> 상태임을 확인했다. 이번 라운드는 (a) 신규 커밋되는 리뷰 산출물 자체에 민감정보 유출이 없는지, (b) spec 문서
> 갱신이 서술하는 보안 관련 내용(EIA 인가 경계·토큰 모델·origin 검증)이 실제로 안전한 방향인지, (c) `RESOLUTION.md`
> 가 반영했다고 기록한 concurrency WARNING(2건)이 보안 관점에서 새 위험을 만들지 않는지를 중심으로 재검증했다.

## 발견사항

- **[INFO]** 하드코딩된 시크릿/자격증명 없음 (26개 파일 전량)
  - 위치: 전체 diff(`review/code/**`, `review/consistency/**`, `spec/**`)
  - 상세: API 키·비밀번호·토큰 실값·인증서 리터럴 패턴을 전수 스캔한 결과 매치 없음. `iext_*`/`itk_*`/
    `X-Clemvion-Signature` 등은 전부 토큰 **접두사 네이밍 컨벤션** 문서화이며 실값이 아니다. spec 문서에 등장하는
    "노드 핸들러는 `outputData` 에 민감 중간결과(secret·내부 토큰 등)를 기록하지 말 것"(`14-external-interaction-api.md`
    §R17 "outputData 표면 제약(보안)", 비변경 유지)은 시크릿 유출을 **경고하는 컨벤션 텍스트**일 뿐 실제 시크릿이
    아니다.
  - 제안: 없음.

- **[INFO]** `getStatus` REST 응답의 durable `conversationThread` 노출 재조정(spec §R17 addendum) — 인가 경계·데이터
  스코핑 무변경, 신규 민감 표면 아님을 spec 문면 기준으로도 재확인
  - 위치: `spec/5-system/14-external-interaction-api.md` R17 addendum("`conversationThread` 노출로의 재조정
    (2026-07-09)")
  - 상세: 갱신된 spec 문면 자체가 "표면 확장은 이미 SSE `waiting_for_input` 으로 공개 중인 `conversationThread` 를
    REST 단발 응답에도 read-only 로 노출하는 것뿐이라 신규 민감 데이터 표면이 아니다"라고 명시하고, 바로 아래
    "outputData 표면 제약(보안)" 문단(비변경)과 나란히 배치돼 노드 핸들러의 민감정보 비기록 컨벤션을 재확인한다.
    이는 이전 라운드(`19_26_15/security.md`)가 코드 레벨(`interaction.guard.ts` 의 `iext_*`/`itk_*` 토큰↔
    `executionId` 바인딩 무변경)에서 확인한 결론과 spec 레벨에서도 정확히 일치하며, 이번 라운드에서 diff 코드가
    아예 없다는 점(즉 `interaction.guard.ts`/`getStatus` 인가 로직이 이 시점 이후 추가로 손대지지 않았다는 점)도
    함께 확인했다.
  - 제안: 없음(양호, 참고 기록).

- **[INFO]** SDK/토큰 모델 관련 spec 갱신(`2-sdk.md`, `3-auth-session.md`) — origin 검증·토큰 iframe 격리·
    sessionStorage 저장 전략 모두 비변경으로 유지
  - 위치: `spec/7-channel-web-chat/2-sdk.md`(`wc:event conversationEnded.data.reason` 을 열린 문자열로 명시),
    `spec/7-channel-web-chat/3-auth-session.md` §3.1(재로드 시 `conversationThread` 도 함께 시드된다는 문구 추가)
  - 상세: `2-sdk.md` 의 "**origin 검증 필수**(양방향 `event.origin` 화이트리스트). 토큰·대화 내용은 iframe 내부
    유지, host 로 비노출" 문구는 이번 diff 로 변경되지 않았고, `reason` 값 확장(`user_ended`)은 인증·인가·토큰과
    무관한 순수 열린 문자열 문서화다. `3-auth-session.md` 도 토큰 모델(`iext_*` per_execution 단명 토큰)·저장소
    (`sessionStorage`, 탭 종료 시 자동 소거)·`401` 낙관적 refresh 절차 자체는 변경하지 않고, 재로드 시
    `conversationThread` 도 함께 시드된다는 부가 서술만 추가한다. 이 데이터는 이미 동일 execution 스코프의
    read-only 데이터라 토큰 탈취·세션 고정 등 새 인증 리스크를 만들지 않는다.
  - 제안: 없음.

- **[INFO]** `RESOLUTION.md`(`19_40_53`)가 반영했다고 기록한 concurrency WARNING 2건은 보안 카테고리(인젝션·
  인가·시크릿·암호화) 밖 — 이번 diff 에 해당 코드 변경 자체가 포함되지 않아 독립 검증 불가하나, 기술한 결함
  성격상 보안 위험도에 영향 없음
  - 위치: `review/code/2026/07/09/19_40_53/RESOLUTION.md`(WARNING #1 `start()` catch gen 검사 누락, #2
    `"gone"` reason spec-code 불일치), 대응 근거 `review/code/2026/07/09/19_40_53/concurrency.md`
  - 상세: WARNING #1(`catch` 블록의 세대 토큰 검사 누락으로 인한 phase 오염/잠재적 중복 execution 시작)은
    **클라이언트 로컬 state machine 의 race condition**이며, 인가 경계나 토큰 검증 로직을 우회하지 않는다(옛
    `start()` 시도든 새 시도든 동일 사용자의 동일 브라우저 세션에서 발생하는 자기 자신의 실행에 대한 상태
    혼선일 뿐, 타 사용자/타 execution 데이터에 접근하지 않음). WARNING #2(`reason: "gone"` 이 문서화됐으나 실제
    host 로 미전달)는 문서-코드 정합성 이슈로 정보 노출·인가 문제가 아니다. 두 항목 모두 이미 concurrency/
    documentation 리뷰 축이 정확히 담당했고, RESOLUTION 상 "회귀 테스트 추가 후 반영" 으로 종결 기록돼 있다.
    다만 이번 20_01_04 페이로드에는 그 수정 자체의 코드 diff(`use-widget.ts` catch 블록·`sendCommand` 410 분기)가
    포함돼 있지 않아, 보안 리뷰어 관점에서 수정 내용을 직접 재검증하지는 못했다 — 성격상 보안 카테고리 밖이므로
    이는 concurrency/documentation 리뷰 축의 책임 범위로 남긴다.
  - 제안: 없음(보안 관점 조치 불필요). 참고로, 코드 diff 가 다음 라운드 페이로드에 포함되면 concurrency 축이
    재검증을 이어가는 것이 적절하다.

- **[INFO]** 리뷰 산출물(`review/consistency/2026/07/09/18_27_06/SUMMARY.md`)이 지적한 pre-existing 보안 인접
  이슈(`itk_*` 가 SecretResolver 를 경유하지 않음)는 이번 changeset 범위 밖으로 정확히 스코프됨
  - 위치: `review/consistency/2026/07/09/18_27_06/SUMMARY.md` WARNING 테이블
  - 상세: consistency checker 가 발견한 기존 설계 이슈이며, 26개 파일 어디에도 `itk_*` 발급/저장 로직 변경이
    없어 "본 PR 신규 도입 아님 — 별도 백로그" 스코핑이 이번 라운드 기준으로도 여전히 타당하다. 위젯은
    `3-auth-session.md` §R3 에 따라 애초에 `itk_*`(per_trigger 영구 토큰)를 지원하지 않으므로 이번 changeset 의
    보안 표면과 직접 연관도 낮다.
  - 제안: 없음(기존 백로그로 충분, 이번 PR 차단 사유 아님).

## 요약

이번 라운드(20_01_04)의 diff 는 애플리케이션 코드를 포함하지 않고 이전 4라운드 리뷰 산출물의 커밋과 spec 문서
갱신 4건으로만 구성된다. 실제 보안 표면 변경(`getStatus` REST 에 durable `conversationThread` 추가 노출, 헤더
세션 컨트롤 신설)은 앞선 라운드(`review/code/2026/07/09/19_26_15/security.md`)에서 코드 레벨로 이미 독립
검토되어 CRITICAL/WARNING 0건으로 결론났고, 이번 라운드에서 spec 문서 서술을 직접 대조 재검증한 결과도 동일
결론(`InteractionGuard` 토큰↔executionId 바인딩 무변경, 이미 SSE 로 공개되던 데이터의 read-only REST 재노출,
origin 검증·토큰 iframe 격리·저장소 전략 무변경)과 정확히 일치했다. `RESOLUTION.md` 가 반영을 기록한 concurrency
WARNING 2건은 보안 카테고리(인젝션·인가·시크릿·암호화) 밖의 클라이언트 상태 race/문서-코드 정합성 이슈로, 타
사용자·타 execution 데이터 접근이나 인가 우회를 유발하지 않는다. 리뷰 산출물·spec 문서 전체에 하드코딩된
시크릿·자격증명은 없으며, 기존에 식별된 pre-existing 보안 인접 이슈(`itk_*` SecretResolver 미경유)도 이번 diff
범위 밖으로 정확히 스코프되어 있다. 인젝션·인증 우회·안전하지 않은 암호화·민감정보 에러 노출 등 신규
CRITICAL/WARNING 급 항목은 발견되지 않았다.

## 위험도
NONE

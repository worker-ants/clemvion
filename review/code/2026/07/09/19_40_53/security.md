# 보안(Security) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원 changeset 의 최종(4차) 리뷰 라운드.
> 이번 배치(19_40_53)의 diff 는 **애플리케이션 코드(`codebase/**`) 변경분을 포함하지 않는다** — 전량이 (1) 이전
> 3라운드 리뷰 산출물(`review/code/2026/07/09/19_26_15/*.md`, `review/consistency/2026/07/09/18_27_06/*`)의
> 신규 커밋과 (2) 그 리뷰가 근거로 삼은 spec 문서 갱신(`spec/5-system/14-external-interaction-api.md`,
> `spec/7-channel-web-chat/{1-widget-app,2-sdk,3-auth-session}.md`) 14개 파일이다. 실제 코드(`interaction.service.ts`,
> `use-widget.ts`, `panel.tsx`, `conversation.ts`, `eia-types.ts` 등)는 이전 라운드(`19_26_15/security.md`)에서
> 이미 독립 검토되어 CRITICAL/WARNING 0건(위험도 NONE)으로 종결된 상태이며, 이번 라운드 diff 에는 해당 코드가
> 다시 나타나지 않는다(즉 그 사이 추가 코드 수정 없음). 따라서 본 라운드는 (a) 신규 커밋되는 review 산출물 자체에
> 보안 문제(예: 민감정보 유출)가 없는지, (b) spec 문서 변경이 서술하는 보안 관련 내용(EIA 인가 경계·토큰 모델)이
> 실제로 안전한 방향인지를 중심으로 재검증했다.

## 발견사항

- **[INFO]** 하드코딩된 시크릿/자격증명 없음 (review 산출물 + spec 문서 전량)
  - 위치: 전체 diff (14개 파일, `review/code/**`·`review/consistency/**`·`spec/**`)
  - 상세: `grep -niE "(api[_-]?key|secret|password|bearer <값>|-----BEGIN|token=<英数20+>|sk-...)"` 패턴으로
    전수 스캔한 결과 실제 자격증명 리터럴은 발견되지 않았다. 유일한 매치는
    `spec/5-system/14-external-interaction-api.md:1290` 의 문서 문장("노드 핸들러는 `outputData` 에 민감
    중간결과(secret·내부 토큰 등)를 기록하지 말 것")으로, 이는 시크릿 유출을 **경고하는 컨벤션 텍스트**이지
    실제 시크릿이 아니다. `iext_*`/`itk_*`/`X-Clemvion-Signature` 등은 전부 토큰 **접두사 네이밍 컨벤션**
    문서화이며 실값이 아니다.
  - 제안: 없음.

- **[INFO]** `getStatus` REST 응답에 durable `conversationThread` 노출 — spec 문서 서술 기준으로도 인가 경계 무변경 재확인
  - 위치: `spec/5-system/14-external-interaction-api.md` R17 addendum(`+**`conversationThread` 노출로의
    재조정(2026-07-09)**`), §5.3 콜아웃 갱신 hunk
  - 상세: 이번 diff 로 갱신된 spec 문면 자체가 "표면 확장은 이미 SSE `waiting_for_input` 으로 공개 중인
    `conversationThread` 를 REST 단발 응답에도 read-only 로 노출하는 것뿐이라 신규 민감 데이터 표면이 아니다"
    라고 명시하고, "outputData 표면 제약(보안)" 문단(비변경 유지)과 나란히 배치되어 노드 핸들러의 민감정보
    비기록 컨벤션을 재확인한다. 이는 이전 라운드(`19_26_15/security.md`) 가 코드 레벨(`interaction.guard.ts`
    토큰↔executionId 바인딩 무변경)에서 이미 확인한 결론과 spec 레벨에서도 정확히 일치한다 — 새로운 인가
    우회·IDOR 서술은 없다.
  - 제안: 없음(양호, 참고 기록).

- **[INFO]** 토큰 저장 전략(`sessionStorage`) 및 재로드 `401` 처리(§R4/§R6) 서술 — defense-in-depth 원칙과 일치, 신규 취약점 서술 없음
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 hunk(재로드 시 `conversationThread` 도 함께 시드된다는
    문구 추가), Rationale §R3/§R4/§R6(비변경, 컨텍스트로 확인)
  - 상세: 이번 diff 는 토큰 모델(`iext_*` per_execution 단명 토큰)·저장소(`sessionStorage`, 탭 종료 시 자동
    소거)·jti blacklist·`401` 낙관적 refresh 절차 자체를 변경하지 않는다. 새로 추가되는 것은 재로드 시
    `conversationThread` 도 함께 시드된다는 **부가 서술**뿐이며, 이 데이터는 이미 §5.3 에서 확인했듯 동일
    execution 스코프의 read-only 데이터라 토큰 탈취/세션 고정 등 새 인증 리스크를 만들지 않는다.
  - 제안: 없음.

- **[INFO]** SDK 문서(`2-sdk.md`) — `conversationEnded.data.reason` 을 열린 문자열 집합으로 명시 (host 강타입 오추정 방지 목적, 인증/인가 무관)
  - 위치: `spec/7-channel-web-chat/2-sdk.md` hunk(`wc:event` 표 갱신)
  - 상세: `reason` 값에 `user_ended` 가 추가된 사실을 host 통합 문서에 "열린 문자열(닫힌 enum 아님)"로 명시하는
    순수 문서 정밀화다. 인증·토큰·origin 검증 등 보안 메커니즘과 무관하며, `origin` 검증 필수·토큰 iframe 내부
    유지 등 기존 보안 문구는 비변경으로 유지된다.
  - 제안: 없음.

- **[INFO]** review 산출물(consistency-check SUMMARY 등)이 지적한 pre-existing 항목 중 보안 인접 사안(`itk_*` SecretResolver 미경유)은 이번 diff 범위 밖으로 정확히 스코프됨
  - 위치: `review/consistency/2026/07/09/18_27_06/SUMMARY.md` WARNING 테이블 #2
  - 상세: consistency checker 가 `itk_*`(per_trigger 영구 토큰) 가 SecretResolver 를 경유하지 않는다는 기존
    설계 이슈를 발견했으나, "본 PR 이 신규 도입한 위반 아님 — 별도 백로그"로 명시적으로 범위 밖 처리했다. 확인
    결과 이번 diff(14개 파일) 어디에도 `itk_*` 발급/저장 로직 변경이 없어 이 스코핑은 타당하다. 위젯은
    §R3 에 따라 애초에 `itk_*` 를 미지원(공개 임베드에 영구 토큰 노출 금지)하므로 이번 changeset 의 보안
    표면과 직접 연관도 낮다.
  - 제안: 없음(기존 백로그로 충분, 이번 PR 차단 사유 아님).

## 요약

이번 라운드(19_40_53)의 diff 는 애플리케이션 코드가 아니라 (1) 이전 3라운드 코드/일관성 리뷰의 산출물 파일과
(2) 그 리뷰들이 검증한 spec 문서 갱신으로만 구성된다. 실제 보안 표면 변경(`getStatus` REST 에 durable
`conversationThread` 추가 노출, 헤더 세션 컨트롤 신설)은 이전 라운드(`review/code/2026/07/09/19_26_15/security.md`)
에서 코드 레벨로 이미 독립 검토되어 CRITICAL/WARNING 0건으로 결론났고, 이번 라운드에서 spec 문서 서술을
교차검증한 결과도 동일 결론(`InteractionGuard` 토큰↔executionId 바인딩 무변경, 이미 SSE 로 공개되던 데이터의
read-only REST 재노출, 토큰 모델·저장소 전략 무변경)과 정확히 일치했다. review 산출물·spec 문서 전체에 하드코딩된
시크릿·자격증명은 없으며, 문서가 지적한 pre-existing 보안 인접 이슈(`itk_*` SecretResolver 미경유)도 이번 diff
범위 밖으로 정확히 스코프되어 있다. 인젝션·인증 우회·안전하지 않은 암호화·민감정보 에러 노출 등 신규
CRITICAL/WARNING 급 항목은 발견되지 않았다.

## 위험도
NONE

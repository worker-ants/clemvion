# Cross-Spec 일관성 검토 결과 — `spec/7-channel-web-chat` (impl-done)

## 검토 범위 확인

- 실제 diff(`origin/main...HEAD`)는 두 곳뿐이다:
  - `spec/7-channel-web-chat/3-auth-session.md` — frontmatter `status: implemented` → `status: partial` +
    `pending_plans:` 신설, R4/R7 Rationale 문구 보강(변경 없는 결정을 명문화·재확인 수준).
  - `codebase/channel-web-chat/src/widget/use-widget.ts`(+테스트) — `openStream()` 진입부로 스트림 소유권
    가드를 이동하는 내부 리팩터(`StreamClaim` union 도입). host↔iframe `wc:*` 프로토콜, 공개 타입(`ChatInstance`),
    EIA 호출 shape 등 **외부로 노출되는 계약은 변경되지 않았다**(순수 client 내부 구현 세부).
- `spec/7-channel-web-chat/{0-architecture,1-widget-app,2-sdk,4-security,5-admin-console,_product-overview}.md`
  는 diff 없이 컨텍스트로만 번들됐다(현재 본문 그대로).
- 코드 diff가 참조하는 요구사항 ID(EIA-RL-07/EIA-AU-04/EIA-IN-12/EIA-IN-02/R-replay-unavailable 등)를
  `spec/5-system/14-external-interaction-api.md` 원본과 대조 — 값·정의 모두 기존과 일치, 새로 재정의되지 않음.
- `pending_plans:` 필드는 `spec/conventions/spec-impl-evidence.md §2.1/§3`이 정의한 정식 규약이며, 가리키는
  `plan/in-progress/webchat-reload-rest-error-branches.md`도 실존한다 — frontmatter 자체는 규약 위반이 아니다.

## 발견사항

- **[WARNING]** `spec/0-overview.md` §6.1 이 이번 status 하향과 어긋남
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter `status:` (implemented → partial)
  - 충돌 대상: `spec/0-overview.md:82` (§6.1 "구현 완료 (✅)" 표, "임베드형 웹채팅 위젯 + SDK" 행)
  - 상세: 루트 진입 문서 `spec/0-overview.md`는 "✅ 구현 완료" 섹션 안에서 이 영역을 두고 **"영역 spec 6문서
    전부 `implemented`"** 라고 명시한다. 그러나 이번 변경으로 6문서 중 하나인 `3-auth-session.md`가
    `status: partial`(+ `pending_plans:` 의무 필드)로 내려갔다. 두 문서를 나란히 읽으면 "6/6 implemented"라는
    루트의 집계 서술과 영역 문서 자신의 frontmatter가 직접 모순한다. `spec-code-paths.test.ts`/
    `spec-status-lifecycle.test.ts` 등 기존 build 가드는 개별 spec의 frontmatter 내부 정합(코드 매치·
    pending_plans 존재)만 보고, `0-overview.md` 본문 프로즈가 하위 영역 status 집계와 일치하는지는 검증하지
    않는다 — 이번처럼 조용히 stale해질 수 있는 지점이다. (참고: 같은 유형의 drift가
    `spec/2-navigation/14-execution-history.md`에서도 과거 한 번 있었고 그때도 "별건으로 정정"됐다 — 이 문서
    라인 470 참조.)
  - 제안: `spec/0-overview.md:82`의 "영역 spec 6문서 전부 `implemented`" 문구를 "5/6 `implemented`, 1건
    (`3-auth-session.md`) `partial`" 식으로 갱신하거나, 최소한 "전부 implemented" 단정을 빼고 `partial` 잔여
    (`404`/복구불가 `401`/낙관적 refresh 미구현)를 한 줄로 반영한다. `project-planner`가 `spec/` 쓰기 권한을
    가지므로 이 라인 갱신도 같은 PR/후속 plan에서 함께 처리하는 편이 좋다(§6.1 은 "구현 완료" 섹션이라 완전
    사실이 아닌 채로 두면 다음 독자가 다시 오판한다).

## 그 외 점검한 관점 — 이상 없음

- **데이터 모델**: 이번 diff는 신규 엔티티·필드를 도입하지 않는다(`StreamClaim`은 client 내부 union 타입, 서버
  응답 shape·DB 컬럼과 무관).
- **API 계약**: EIA endpoint/method/response shape 변경 없음. `interact`/`getStatus`/`cancel`/`refresh-token`
  등 기존 계약 그대로 인용.
- **요구사항 ID**: 코드 diff·spec 텍스트가 참조하는 EIA-RL-07/EIA-AU-04/EIA-IN-12/EIA-IN-02/R-replay-unavailable
  전부 `spec/5-system/14-external-interaction-api.md` 원문과 값 일치, 신규 재정의 없음. 문서 내부 Rationale
  번호(R4/R7 등)는 각 spec 파일 로컬 번호로 이 저장소의 기존 관례이며 전역 요구사항 ID와 다른 네임스페이스라
  충돌 아님.
- **상태 전이**: 위젯 상태기계(`collapsed→panel→booting→streaming↔awaiting_user_message→ended`)·EIA
  execution 상태·`end_conversation`/`cancel` 분기 서술 변경 없음. `StreamClaim`(`opened`/`already_owned`/
  `no_client`)은 SSE 연결 소유권을 다투는 client-local 신호일 뿐 EIA/실행엔진이 아는 execution 상태와는
  다른 축이며, 문서(R7)도 이를 "표면 되감기 방어 축 ≠ 종료 확정 축"으로 명확히 구분해 서술한다.
  `4-execution-engine.md §7.4/§7.5`의 무기한 보존 불변식·`waiting_for_input→cancelled` 사유 예약과도 모순 없음.
- **RBAC**: 변경 없음(이번 diff는 워크스페이스/역할 개념을 건드리지 않는다).
- **계층 책임**: 스트림 소유권 가드를 호출부 2곳의 손복제에서 `openStream()` 내부로 옮긴 것은 위젯 SPA
  (`codebase/channel-web-chat`) 내부 리팩터로, SDK(`2-sdk.md` wc:* 프로토콜)·서버(EIA)·운영 콘솔 어느 쪽의
  책임 경계도 넘지 않는다. `2-sdk.md` frontmatter 주석이 이미 "이 파일(`3-auth-session.md`)의 표면 되감기
  방어 축과 `use-session-generations.ts`의 config 적용 경합 축은 다른 축"이라고 명시해 두었고, 이번 diff는
  그 구분을 재확인할 뿐 재배치하지 않는다.

## 요약

이번 변경은 `spec/7-channel-web-chat` 영역 내부로 매우 좁게 스코프돼 있다 — client 내부 리팩터(스트림 소유권
가드 이동) + `3-auth-session.md`의 frontmatter 정직화(`implemented`→`partial` + `pending_plans:`)뿐이며,
EIA/webhook/execution-engine/conversation-thread 등 인접 spec 영역의 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임 어느 것도 재정의하지 않는다. 다만 그 frontmatter 하향이 `spec/0-overview.md §6.1`의
"영역 spec 6문서 전부 `implemented`" 집계 서술과 직접 어긋나게 됐고, 이는 기존 build 가드가 검증하지 않는
사각지대라 사람이 잡아야 한다.

## 위험도

LOW

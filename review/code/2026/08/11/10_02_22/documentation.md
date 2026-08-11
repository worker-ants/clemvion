# 문서화(Documentation) Review

호출자가 지정한 3개 판정 질문(redactToken JSDoc 재정정 범위 · CHANGELOG 반영 여부 · `shouldAbortAfterSeed` breadcrumb 정확성)을 코드/plan 원본을 직접 열어 대조했다. 부수로 실제 build gate 를 재현 실행해 검증했다.

## 발견사항

- **[CRITICAL]** `plan/complete/webchat-reload-rest-error-branches.md` 가 `spec_impact` frontmatter 없이 `plan/complete/` 에 있어 Gate C 빌드 가드가 **현재도 FAIL 한다**(재현 확인)
  - 위치: `plan/complete/webchat-reload-rest-error-branches.md:1-5`(frontmatter 블록 — `worktree`/`started`/`owner` 만 있고 `spec_impact` 없음)
  - 상세: `.claude/docs/plan-lifecycle.md §5 Gate C` 는 완료 plan 에 `spec_impact`(spec path 리스트 또는 `"none"`)를 의무화하고, `started: 2026-08-10` 는 컷오프(`2026-06-04`) 이후라 grandfather 예외도 못 받는다. 직접 실행해 재현했다:
    ```
    cd codebase/frontend && npx vitest run src/lib/docs/__tests__/spec-plan-completion.test.ts
    → FAIL Gate C — plan-completion spec-consistency
      > plan/complete/webchat-reload-rest-error-branches.md > declares `spec_impact`
      AssertionError: expected false to be true
    Test Files 1 failed (1) · Tests 1 failed | 813 passed (814)
    ```
    이 사실은 이미 `review/code/2026/08/10/18_51_07/documentation.md`(같은 브랜치의 직전 문서화 리뷰)가 CRITICAL 로 정확히 지적하고 수정안까지 제시했다 — `spec_impact: [spec/7-channel-web-chat/3-auth-session.md]` 한 줄 추가. 그런데 이번 delta(10_02_22 시점)까지도 그 한 줄이 반영되지 않은 채 남아 있다 — **지적된 CRITICAL 이 처분 없이 방치된 상태**다. push 시 CI 가 이 테스트로 그대로 막힌다.
  - 제안: frontmatter 에 `spec_impact: [spec/7-channel-web-chat/3-auth-session.md]`(같은 diff 가 `spec/0-overview.md` 도 건드렸다면 그 경로도 함께) 추가.

- **[WARNING]** CHANGELOG 가 이번 delta 의 보안 수정(로그 redaction 3곳 + `applyConfig` unhandled rejection 닫힘 + SSE `onError` sanitize)을 전혀 반영하지 않는다
  - 위치: `CHANGELOG.md`(관련 있을 만한 자리는 166-174행 "재로드 복원의 `404`·`401`/`410` REST 분기" 항목 — 이 항목엔 없음). 근거가 되는 실제 코드: `codebase/channel-web-chat/src/lib/eia-client.ts:183-201`(`redactToken` 신설), 호출부 `codebase/channel-web-chat/src/widget/use-widget.ts:1243-1246`(`runApplyConfig` — `applyConfig(cfg).catch(...)` 로 unhandled rejection 닫음), `:1325-1330`(`errMessage`), `codebase/channel-web-chat/src/widget/use-token-refresh.ts:166-176`(`onRefreshed` consumer catch), 그리고 SSE `onError` 이벤트 sanitize(`use-widget.ts:471-481`, 원본 `Event` 대신 `e.type` 만 로깅).
  - 상세: `grep -n "redact\|unhandled rejection" CHANGELOG.md` 는 무관한 항목(690행, HTTP Request 노드 `output.responseHeaders`)만 걸리고 웹채팅 관련 매치는 0건이다. 이 저장소는 CHANGELOG 를 "사용자 UI 가시 변경"에만 한정하지 않는다 — 파일 최상단 항목(워크스페이스 멤버십 cross-tenant 보안 수정)도 UI 변화가 아니라 보안/인가 동작 변경이고, 바로 이 웹채팅 기능 자체도 같은 브랜치 안에서 이미 한 번 "CHANGELOG 관례 미이행" WARNING(`review/code/2026/08/10/16_09_40` §6~8, documentation reviewer)이 나와 실제로 항목이 신설된 선례가 있다(CHANGELOG.md:166-174 가 그 산출물). 그런데 이후 두 라운드(`18_23_54`, `18_51_07`)가 도입한 보안 수정(토큰 redaction·unhandled rejection 폐쇄)은 같은 처리를 받지 못했다 — 두 라운드의 documentation.md 를 직접 열어 확인한 결과 `18_51_07` 은 CHANGELOG 를 언급하되 **기존 항목의 스타일(SoT 줄 위치)만** INFO 로 짚었을 뿐, 이 delta 가 만든 새 동작(redaction 도입)의 미반영 자체는 어느 라운드도 지적하지 않았다. **사용자 UI 가시 변경은 아니다**(위젯 화면·상호작용은 동일) — 다만 콘솔에 노출되던 단명 토큰을 더 이상 노출하지 않는 보안 동작 변경이고, `applyConfig` 의 unhandled rejection 을 catch 로 닫은 것도 에러 처리 경로의 실질적 변경이라, 이 저장소의 기존 CHANGELOG 관례(보안/견고성 수정을 UI-visible 여부와 무관하게 기록)에 비춰보면 반영 대상이다.
  - 제안: 기존 §재로드 복원 항목(166-174행) 끝에 짧은 6번 항목을 추가하거나, 별도 `## Unreleased — 웹채팅 위젯: 로그의 단명 토큰 노출 차단` 항목을 신설해 (1) `redactToken` 도입 배경(EventSource 가 헤더를 못 실어 토큰이 쿼리에 남는다), (2) 적용 지점 3곳(`start()`/`applyConfig`/주기 갱신 콜백), (3) `applyConfig` 의 unhandled rejection 폐쇄(redaction 이 개입할 자리조차 없던 경로), (4) SSE `onError` 는 원본 이벤트 대신 타입만 로깅 — 을 서술할 것.

- **[INFO]** `redactToken` JSDoc 의 재정정된 위협 모델은 구현·실제 배포 범위를 넘지 않는다 — 확인 완료, 조치 불요
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:183-201`(`redactToken` JSDoc + 구현)
  - 상세: 새 서술이 나열한 노출면 넷(devtools·콘솔 수집 확장·버그리포트 콘솔 덤프/스크린샷·"위젯을 같은 origin 에 임베드하는 배포") 중 마지막 항목이 실제로 존재하는 배포 형태인지 `spec/7-channel-web-chat/0-architecture.md` 로 대조했다 — §4.1 은 "`<widget-cdn-base>` 기본값 = 배포 자신의 origin(동봉 서빙) — 셀프호스트는 추가 인프라 없이 same-origin", §R5 는 "admin 콘솔 내부 미리보기는 same-origin 실제 `src` iframe 으로 로드"라고 명문화한다. 즉 "같은 origin 임베드"는 가상의 케이스가 아니라 이 아키텍처가 실제로 지원하는 배포 모드(셀프호스트 동봉 + admin 라이브 미리보기)이고, same-origin 이면 호스트 스크립트가 `iframe.contentWindow`(→ 그 realm 의 `console`)에 접근할 수 있어 위협 모델상으로도 타당하다. 원래 있던 문장("호스트 페이지의 다른 스크립트가 콘솔을 읽을 수 있다")을 무조건 틀렸다고 지운 게 아니라, "위젯은 항상 cross-origin"이라는 **범위를 좁힌 뒤에도 여전히 유효한 부분**(same-origin 배포 한정)만 남긴 형태라 과장이 없다. `redactToken` 의 실제 동작(정규식이 `token=` 값만 치환, `lastEventId` 등 인접 파라미터 보존)도 JSDoc 이 약속하는 범위와 정확히 일치한다(테스트 `eia-client.test.ts:288-300` 로 재확인).

- **[INFO]** `shouldAbortAfterSeed` 의 plan breadcrumb 이 가리키는 절은 실제로 그 내용을 담고 있다 — 확인 완료, 조치 불요
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:130-135`(breadcrumb 문장: `plan/in-progress/webchat-auth-session-status-reconcile.md §꼬리 블록 중복`), 대상 `plan/in-progress/webchat-auth-session-status-reconcile.md:245-263`(`## \`start()\`/\`applyConfig\` 꼬리 블록 중복 (2026-08-10, maintainability WARNING)`)
  - 상세: breadcrumb 이 서술하는 세 요소 — (1) `live` 재확인 → `deferredStreamRef` 세팅 → 조건부 `openStream` → `scheduleRefresh` 꼬리 4단계가 두 호출부(`start()`/`applyConfig`)에 리터럴 복제돼 있다는 사실, (2) "지금 안 고치는 이유"(두 호출부가 진짜로 비대칭이라 오케스트레이션 통합은 이미 여러 번 기각됨), (3) "언제 하나"(`SeedOutcome` 다섯 번째 갈래 추가 시점, 착수 전 부분 추출 검토) — 가 plan 절 본문(245-263행)에 그대로 존재한다. 짧은 라벨("§꼬리 블록 중복")이 실제 헤딩 전문("`start()`/`applyConfig` 꼬리 블록 중복 (2026-08-10, maintainability WARNING)")과 글자 그대로 일치하진 않지만 핵심 어구가 동일해 식별에 문제가 없다. 링크 대상 자체(`webchat-auth-session-status-reconcile.md`)도 실존 파일이다.

## 요약

호출자가 요청한 3개 판정 중 (a) `redactToken` 재정정과 (c) `shouldAbortAfterSeed` breadcrumb 은 둘 다 코드·spec·plan 원본과 대조해 정확함을 확인했다(과장 없음, 링크 무결). (b) CHANGELOG 는 이번 delta 의 REST 분기 기능 자체는 이미 반영돼 있으나, 그 이후 두 라운드(`18_23_54`·`18_51_07`)가 도입한 보안 수정(토큰 로그 redaction 3곳·`applyConfig` unhandled rejection 폐쇄·SSE `onError` sanitize)은 미반영이며, 이 저장소가 UI-비가시 보안 수정도 CHANGELOG 에 기록해 온 기존 관례(같은 브랜치 안의 선례 포함)에 비추면 WARNING 대상으로 판단한다. 부수로, 이번 delta 가 신설한 `plan/complete/webchat-reload-rest-error-branches.md` 는 `spec_impact` frontmatter 누락으로 Gate C 빌드 가드를 **현재도 실제로 깨뜨리고 있음**을 테스트 재실행으로 직접 확인했다 — 이는 직전 문서화 리뷰(`18_51_07`)가 이미 CRITICAL 로 지적하고 한 줄짜리 수정안까지 제시했으나 아직 적용되지 않은 상태다.

## 위험도

HIGH — CI 를 확실히 깨뜨리는 CRITICAL 1건(수정 비용은 낮음, 한 줄) + CHANGELOG 관례 미이행 WARNING 1건. 호출자가 지정한 3개 판정 자체(redactToken 범위·breadcrumb 정확성)만 보면 위험 없음(NONE)이지만, 재확인 중 발견한 미처분 build-gate 실패가 전체 위험도를 끌어올린다.

# Maintainability Review — spec/7-channel-web-chat/3-auth-session.md

## 발견사항

- **[INFO]** 정상 서술 문장 안에 자기 개정사(diff 역사) 각주가 섞임
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`
  - 상세: "재차 `401`·`410` 이면 종료로 간주(§R4 와 동일 — **종전 이 줄만 `401` 로 좁게 적혀 있었다**. `410`(`EXECUTION_TERMINATED`)도 서버가 실제로 내는 분기다)." — 괄호 안 절반이 "지금 참인 사실"이 아니라 "이 줄이 전에 어떻게 적혀 있었는가"를 서술한다. spec 본문은 현재 규범을 진술하는 자리이고, 개정 이력은 git log·commit message·Rationale 의 changelog 성격 항목이 맡는 편이 낫다. 이런 self-referential diff 주석이 절 안에 누적되면(같은 절의 §3.1 배너도 "2026-08-10" 타임스탬프를 본문에 직접 박는 동일 패턴) 독자가 "지금 사실"과 "예전에 뭐가 달랐는지"를 매번 갈라 읽어야 하는 인지 비용이 쌓인다. R4(라인 104-108, 이번 diff 밖 기존 내용)는 이미 "401/410"으로 정확히 적혀 있어 §3.1-2 만 뒤늦게 따라잡는 상황인데, 그 정합화 과정 자체가 규범문에 남을 필요는 없다.
  - 제안: 괄호의 이력 설명을 지우고 "재차 `401`·`410` 이면 종료로 간주(§R4)."로 남긴다. 정정 사유가 꼭 필요하면 Rationale 섹션 R4 하단에 짧은 changelog 줄로 옮긴다.

- **[INFO]** 계속 길어지는 단일 문단 blockquote — 가독성
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:66`
  - 상세: `> ⚠ v1 구현 현황(부분)` 블록쿼트가 이미 극단적으로 긴 한 문장(원문부터 그러함)이었는데, 이번 diff 가 "**`404`·복구불가 `401` REST 분기와 `401 → 낙관적 refresh 1회` 도 구현됐다**(2026-08-10) — `404` 는 storage 정리 후 `[ended]`, `401` 은 낙관적 refresh 1회 후 성공 시 복원·재차 실패 시 종료 확정(§R4). 그 외 status·오류는 **여전히** `catch` soft-fail 후 SSE 로 진행한다 — ..." 절을 이어 붙여 문장을 한 번 더 확장했다. 구현 상태를 분기별(200+terminal / 404 / 401 재시도실패 / 그 외)로 나열하는 내용인데 전부 한 문단·한 문장에 압축돼 있어 스캔하기 어렵고, 앞으로 또 다른 분기가 구현될 때마다 같은 방식으로 계속 늘어날 형태다.
  - 제안: "구현됨 / Planned / soft-fail" 을 짧은 bullet list 로 구조화하면 향후 항목이 늘어도 가독성이 유지된다(예: `- 200+terminal: 구현됨` / `- 404, 401(재시도 실패): 구현됨(2026-08-10)` / `- 그 외 status·오류: catch soft-fail`).

- **[INFO]** 병행 PR 조율 배너의 스코프 확인 (참고용, 실제로는 근거 있음)
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:67-70`
  - 상세: `frontmatter 재판정 대기` 블록쿼트는 §3.1 정본 절차 한가운데에 임시 조율 메모를 끼워 넣는다. `plan/in-progress/webchat-auth-session-status-reconcile.md` 를 직접 열어 확인한 결과, 이 배치는 즉흥적인 게 아니라 그 plan 문서의 "왜 커밋 메시지로 부족했나" 절에 명시적 근거가 있고("`3-auth-session.md` 자체에는 아무 단서가 없다" → 파일을 여는 어떤 에이전트/사람도 이 의존을 알 방법이 없어 spec 안에 직접 남긴다), 두 PR 중 나중에 머지되는 쪽이 처리하도록 체크리스트도 갖춰져 있다. 문제로 지적하는 것은 아니고, 이 노트가 제거될 때 §3.1 문단 전체를 다시 읽어야 하는 정도의 국지적 비용만 남는다는 점만 기록해 둔다.
  - 제안: (조치 불필요) 정리 시점에 `webchat-auth-session-status-reconcile.md` 체크리스트를 그대로 따르면 된다.

- **[WARNING]** (요청에 따른 범위 밖 보충 분석) `SeedOutcome` 게이팅 관용구 중복
  - 위치: 이 회차 diff 대상은 아니지만 오케스트레이터 요청에 따라 직접 확인함 — `codebase/channel-web-chat/src/widget/use-widget.ts:700`, `codebase/channel-web-chat/src/widget/use-widget.ts:1057` (타입 정의는 `:84-106`, 함수는 `:403-461`·`:548-627`)
  - 판정 1 — **fail-closed 여부**: `if (outcome !== "continue" && outcome !== "refresh_deferred") return;` 는 화이트리스트(허용값만 명시적으로 나열) 형태다. `SeedOutcome` 에 5번째 갈래가 추가돼도 이 조건식을 고치지 않으면 그 값은 자동으로 "중단"(return)으로 분류된다 — 이는 타입 JSDoc(`:78-83`)이 명문화한 불변식 "`"continue"` 외에는 **반드시 중단**해야 한다"와 정확히 일치하는 안전한 기본값이다. 즉 이 관용구는 **fail-closed 다**.
  - 판정 2 — **네 갈래가 여전히 뚜렷한 의미를 갖는가**: `ended`(세션 정리 완료, 재개 불가)/`stale`(await 중 세계 교체, 아무 부작용 없이 폐기)/`continue`(정상 진행, `openStream`+`scheduleRefresh` 둘 다)/`refresh_deferred`(스트림은 건너뛰되 `scheduleRefresh` 는 예약)는 부작용 조합이 서로 겹치지 않는다. JSDoc(`:94-106`)이 `refresh_deferred` 를 `continue`/`stale` 로 뭉갤 수 없는 구체적 이유를 각각 실제 CRITICAL 인시던트(`16_42_07`, `16_56_39`)로 근거를 남겨 자의적 분화가 아님을 보여준다 — 네 갈래 모두 유지할 근거가 있다.
  - 그러나 **중복 코드** 관점에서: 동일한 2-값 화이트리스트 조건식과, 그를 둘러싼 취지가 거의 같은 긴 주석 블록이 두 호출부(`:700` `start()`, `:1057` `applyConfig` 내부)에 리터럴로 중복돼 있다. 5번째 갈래가 향후 "continue 처럼 진행해야 하는" 의미로 추가되면 두 지점을 함께 고쳐야 하는데, 어느 쪽도 다른 쪽의 존재를 컴파일 타임에 알려주지 않는다(현재는 안전한 기본이 abort 라 **보안·정합성 결함은 아니고 기능 누락으로만** 남을 위험). 이 파일의 다른 유사 케이스(`establishConfig` 의 `"reset" | "continue"` 등, `:1023`)도 exhaustive switch 대신 문자열 비교 관용구를 쓰므로 "패턴 자체"는 기존 컨벤션과 일관되다 — switch/`assertNever` 로 바꾸라는 제안은 아니다.
  - 제안: `const shouldAbortAfterSeed = (o: SeedOutcome) => o !== "continue" && o !== "refresh_deferred";` 같은 이름 있는 헬퍼 하나로 뽑아 두 호출부가 이를 참조하게 하면, 다음에 "continue-류" 갈래가 추가될 때 고칠 지점이 하나로 줄고 두 호출부가 조용히 갈라질 여지가 사라진다.

## 요약

이번 회차의 실제 diff(`spec/7-channel-web-chat/3-auth-session.md`)는 순수 문서 정정으로, 코드 복잡도·중첩·매직넘버·함수 길이 같은 구조적 문제는 해당사항이 없다. 남는 것은 문서 특유의 가독성 이슈 두 가지 — (1) 규범 서술 문장 안에 자기 개정 이력을 괄호로 남기는 self-referential 각주, (2) 계속 확장되는 단일 문단 blockquote — 로 모두 INFO 수준이며, 나머지 하나(병행 PR 조율 배너)는 실제로 `plan/in-progress/webchat-auth-session-status-reconcile.md` 를 대조해 보니 근거 있는 의도적 설계였다. 오케스트레이터가 별도로 요청한 `SeedOutcome`(`use-widget.ts`) 게이팅 관용구는 이번 diff 범위 밖이지만 확인 결과 **fail-closed 이고 네 갈래 모두 여전히 뚜렷이 구분되는 의미**를 갖는다 — 다만 동일한 게이팅 조건식+주석이 두 호출부에 리터럴 중복돼 있어 향후 갈래 추가 시 한쪽만 갱신되고 드리프트할 위험이 있으므로 이름 있는 헬퍼로의 추출을 권장한다(WARNING).

## 위험도

LOW

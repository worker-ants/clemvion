# 부작용(Side Effect) 리뷰 — Cafe24 HMAC raw-fix 세션

대상 변경 세트: `review/consistency/2026/05/16/` 하위 다수 review 문서 + `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 및 관련 consistency-check 산출물 (파일 1~24)

---

### 발견사항

- **[INFO]** `buildHmacMessage` 함수 동작 변경 — 기존 호출자(handleInstall, tryRecoverByMallId) 영향 분석 필요
  - 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 변경 1 (§9.8 알고리즘 재정정)
  - 상세: spec draft 는 `buildHmacMessage(rawQuery: string): string` 시그니처가 동일하게 유지된다고 명시하나(`self-check: buildHmacMessage 시그니처 호환 — 호출자 변경 불필요`), 함수의 **내부 동작**은 `URLSearchParams` decode → `formUrlEncode` 재인코딩 방식에서 raw byte 직접 보존 방식으로 근본적으로 바뀐다. 시그니처는 유지되지만 동일한 입력에 대해 다른 출력이 나오는 의미 변경(semantic breaking change)이다. 호출 시 `rawQuery` 에 공백이 포함된 쿼리스트링을 넘기는 경우 기존에는 `+` 로 인코딩된 메시지가, 새 버전에서는 `%20` 그대로가 메시지에 포함된다.
  - 제안: `handleInstall`, `tryRecoverByMallId` 에서 `buildHmacMessage` 를 호출하는 모든 코드 경로를 재검토하여 raw query string 이 올바르게 전달되는지(decode 없이) 확인한다. 특히 Express/NestJS 에서 `req.query` 대신 `req.url` 또는 `req.originalUrl` 의 쿼리 부분을 파싱하는지 확인 필수.

- **[INFO]** `formUrlEncode` 헬퍼 제거에 따른 잠재 사용처 확인
  - 위치: spec draft 변경 1 — "통째로 제거" 지시 (옛 코드 예시 line 434-458)
  - 상세: spec draft 는 `formUrlEncode` 헬퍼가 HMAC 관련 spec 본문 외에는 인용이 없다고 `grep 확인` 으로 검증했다고 명시한다. 그러나 이는 **spec 문서 수준의 grep** 이며, 실제 backend 코드(`integration-oauth.service.ts` 또는 관련 파일)에서도 동일 이름의 함수를 사용하는지 별도로 확인해야 한다. 만약 backend 에 `formUrlEncode` 가 util 함수로 export 되어 다른 모듈에서 import 된 경우, spec 에서의 제거 지시가 실제 코드 제거로 이어질 때 런타임 오류가 발생할 수 있다.
  - 제안: 구현 단계에서 `grep -r "formUrlEncode" backend/src` 를 실행하여 다른 코드 경로에서의 사용 여부를 확인 후 제거한다.

- **[INFO]** consistency review 산출물 파일 22건 신규 생성 — 파일시스템 부작용 (정상 범주)
  - 위치: `review/consistency/2026/05/16/12_24_55/`, `review/consistency/2026/05/16/13_09_46/`, `review/consistency/2026/05/16/13_29_47/`, `review/consistency/2026/05/16/14_06_49/` 하위
  - 상세: 이번 diff 는 review 산출물 파일 다수(SUMMARY.md, 각 checker review.md, _prompts/*.md, _retry_state.json 등)를 신규 생성한다. 이는 CLAUDE.md 의 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 경로 규약을 따르는 의도된 파일시스템 변화이므로 부작용이 아니다. 단, `_retry_state.json` 에 절대 경로(`/Volumes/project/private/clemvion/.claude/worktrees/...`)가 하드코딩되어 있어, worktree 위치가 달라지면 해당 JSON 의 경로들이 무효화될 수 있다.
  - 제안: `_retry_state.json` 의 절대 경로 하드코딩은 현 worktree 고정 환경에서는 문제가 없으나, worktree 이동이나 다른 머신에서의 재시도 시나리오가 생길 경우 경로를 재생성할 수 있도록 orchestrator 가 동적으로 path 를 계산하는 구조를 고려할 수 있다.

- **[INFO]** `_retry_state.json` 신규 도입 — 전역 상태 역할 가능성
  - 위치: `review/consistency/2026/05/16/14_06_49/_retry_state.json` (파일 22)
  - 상세: `_retry_state.json` 은 `agents_pending`, `agents_success`, `agents_fatal`, `rate_limit_episodes` 등 세션 재시도 상태를 영속 파일로 관리한다. 이 파일은 orchestrator 와 main session 사이의 공유 상태(shared state) 로 기능하며, 두 프로세스가 동시에 읽고 쓸 경우 race condition 이 발생할 수 있다. 단, 현재 아키텍처(prepare 모드 only, 실제 model 호출은 main session)에서는 동시 쓰기 위험이 낮다.
  - 제안: 두 개의 consistency-check 세션이 거의 동시에 같은 세션 dir 에 `_retry_state.json` 을 쓰는 상황(race)이 가능한지 점검한다. 세션 dir 가 타임스탬프로 유일하게 분리되므로 현재 구조에서는 충돌 위험이 없다.

---

### 요약

이번 변경 세트는 대부분 `review/consistency/` 하위의 문서 산출물(마크다운 리뷰 파일, JSON 상태 파일, 프롬프트 파일)을 신규 생성하는 것으로, 코드 실행 경로나 전역 상태를 직접 변경하지 않는다. 부작용 관점에서 가장 중요한 사항은 `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 에 기술된 `buildHmacMessage` 함수의 **시그니처는 유지되지만 동작이 근본적으로 달라지는** 의미적 변경이다. 시그니처 호환을 이유로 호출자 영향이 없다고 판단하면 실제 구현 단계에서 raw query 전달 방식을 별도로 검증하지 않을 위험이 있다. `formUrlEncode` 헬퍼 제거는 spec 수준에서는 grep 으로 확인됐으나, backend 코드의 실제 사용처를 구현 단계에서 재확인할 것을 권장한다. 그 외 파일시스템 부작용(review 파일 생성, `_retry_state.json` 상태 파일)은 모두 프로젝트 아키텍처 규약 내의 의도된 변화이며, 전역 변수 도입, 환경 변수 읽기/쓰기, 네트워크 호출 변경, 이벤트/콜백 변경은 발견되지 않았다.

### 위험도

LOW

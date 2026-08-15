STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (재리뷰, `11_29_02`)

## 리뷰 범위 및 방법론

프롬프트 번들이 크기 제한으로 다수 파일(특히 `execution-engine.service.ts`/`execution-engine.service.spec.ts`)의 diff 를 생략했으므로, `git diff origin/main -- codebase/ spec/ plan/` 를 직접 실행해 실제 소스 diff 전문을 대조했다. 대상은 다음과 같이 두 그룹이다.

- **코드 diff (보안 실질 대상)**: `chat-channel.dispatcher.ts`/`types.ts`/각 `.spec.ts`, `execution-engine.service.ts`, `retry-turn.service.ts`, 신규 `shared/utils/terminal-duration.ts`(+spec)
- **문서/리뷰 산출물**: `CHANGELOG.md`, `spec/**`, `plan/in-progress/**`, `review/code/2026/08/15/{09_58_24,10_18_38,11_09_44}/**`(이전 라운드의 RESOLUTION/SUMMARY/각 관점 리포트), `review/consistency/2026/08/15/**` — 코드가 아니므로 보안 표면을 만들지 않는다. 단, 이 안에 담긴 내용 중 보안 관련 서술(HMAC 화이트리스트 자기모순 기록 등)은 실제 코드와 교차 검증했다.

이 PR 은 이전 두 리뷰 라운드(`09_58_24`, `10_18_38`)에서 CRITICAL(int4 상한 미클램프로 인한 UPDATE 실패·영구 고착)을 지적받아 이미 조치된 상태이고, 이번 라운드 diff 는 그 조치를 유지한 채 CHANGELOG/spec/plan 문서 동기화와 회귀 테스트 보강이 중심이다.

## 발견사항

발견된 Critical/Warning 없음. 아래는 확인 결과(INFO)만 기록한다.

- **[INFO]** raw SQL 삽입 지점 재검증 — 여전히 파라미터 바인딩으로 안전
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (`TERMINAL_DURATION_MS_SQL` 정의, `export const TERMINAL_DURATION_MS_SQL =` 로 시작하는 블록), 사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 5곳(`cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted` — `grep -n "TERMINAL_DURATION_MS_SQL"` 결과 라인 1036/1173/2830/2901/3354)
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 형태로 raw SQL 을 SET 절에 삽입하는 TypeORM API 를 쓰지만, 삽입 문자열은 (1) 사용자 입력이 전혀 섞이지 않는 **하드코딩 모듈 상수**이고, (2) 유일한 가변 요소인 `:terminalFinishedAt` 플레이스홀더는 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 바인딩되며, 그 값 자체가 서버 내부에서 `new Date()` 로 생성된 시각이지 요청 본문·헤더·경로 파라미터에서 온 값이 아니다(직접 `grep`으로 5곳 모두 `const terminalFinishedAt = new Date();`/`const finishedAt = new Date();` 로 선언됨을 확인). `WHERE`/`AND WHERE` 절도 기존과 동일하게 `:id`/`:waiting`/`:pending`/`:running` 파라미터 바인딩을 유지한다. 문자열 결합(concatenation)에 외부 입력이 개입하는 지점이 없어 SQL 인젝션 표면이 없다는 이전 라운드(`09_58_24/security.md`) 판정이 이번 diff 에서도 그대로 유지된다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts` 의 "SQL 쌍둥이와 같은 상한 상수를 쓴다" 테스트가 JS/SQL 두 클램프 값의 drift 를 계속 잡아준다.

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱 — 변경 없음, 여전히 안전
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toFiniteNumber`/`resolveTerminalDurationMs`
  - 상세: pg 드라이버가 `bigint`/`numeric` 을 문자열로 반환하는 경우, `Invalid Date`, 시계 역행(음수), `NaN`/`Infinity` 를 전부 `null` 로 흡수해 wire 로 비정상 값이 나가지 않도록 방어한다. 이번 라운드에서 새로 추가된 `PG_INT4_MAX`(`LEAST` 클램프) 도 값 자체가 상수라 인젝션·오버플로 표면을 만들지 않는다.
  - 제안: 없음.

- **[INFO]** 타입 완화(`durationMs?: number` → `durationMs?: number | null`)는 인가·검증 로직에 영향 없음
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`), `chat-channel.dispatcher.ts` 캐스팅 3곳
  - 상세: 외부로 나가는 응답 필드의 타입을 넓힌 것뿐이고, 사용자 입력을 받아 검증하는 스키마가 아니다(consumer 계약이라는 취지가 코드/주석에 일관). 인증·인가·레이트리밋 등 기존 가드 로직은 이번 diff 범위 밖이며 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** 문서(plan)에 기록된 §8.2 HMAC 화이트리스트 자기모순은 이번 diff 가 만든 결함이 아니라 **기존에 존재하던 spec 문서 오기**를 백로그에 등재만 한 것
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "§8.2 HMAC 화이트리스트가 자기 문서와 모순" 절
  - 상세: `spec/5-system/14-external-interaction-api.md` §8.2 본문은 `hmac-sha256` 만 화이트리스트라고 서술하지만, 실제 코드(`notification-signature.util.ts` 의 `SupportedHmacAlgorithm`)는 이번 PR 과 무관하게 이미 `sha256`+`sha512` 둘 다 허용한다 — 즉 **런타임 동작은 안전(더 넓은 화이트리스트이지 취약해진 것이 아님)**이고 문서만 뒤처져 있다. 이번 diff 는 그 사실을 plan 체크박스로 등재했을 뿐 코드나 spec 본문(§8.2)을 아직 고치지 않았다. 이 PR 의 실제 변경(`durationMs` 배관)과는 별개 표면이라 이번 라운드의 스코프 밖으로 판단한다.
  - 제안: 별도 후속에서 §8.2 본문을 코드/§3.1/§R12 와 일치시킬 것(문서만 수정, 런타임 결함 아님이므로 이번 PR 을 막을 사유는 아니다).

- **[INFO]** 에러 메시지·민감정보 노출 없음 (변경 없음)
  - 상세: 이번 diff 가 payload 에 추가하는 것은 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)뿐이다. 자격증명, 스택트레이스, 내부 경로, PII 등을 새로 노출하는 지점이 없다. `toTerminalErrorPayload` 등 기존 에러 직렬화 로직은 이번 diff 범위 밖(재사용만)이라 재검토 불필요.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음 (변경 없음)
  - 상세: 5개 raw UPDATE 경로 모두 기존 `WHERE id = :id AND status = :waiting/:pending/:running` 상태 가드를 그대로 유지한 채 `SET`/`RETURNING` 절만 확장했다. 상태 전이 가드가 우회되거나 완화된 지점이 없다.
  - 제안: 없음.

## 요약

이번 라운드는 이전 두 라운드에서 지적·조치된 CRITICAL(SQL 경로 int4 미클램프로 인한 실행 영구 고착)을 유지한 채, CHANGELOG·spec·plan 문서 동기화와 dispatcher/retry-turn 회귀 테스트 보강이 중심인 diff 다. 새로 추가된 raw SQL(`TERMINAL_DURATION_MS_SQL`)은 하드코딩된 상수이며 유일한 가변 요소(`terminalFinishedAt`)는 서버가 생성한 `Date` 값이 5곳 모두 파라미터 바인딩으로 들어가 사용자 입력이 SQL 문자열에 개입할 경로가 없다 — 이는 이번 세션에서 프롬프트에 실리지 않은 `execution-engine.service.ts` 실제 diff 를 `git diff origin/main` 으로 직접 열어 재확인한 결과다. `RETURNING` 값 파싱(`toFiniteNumber`)도 타입 불확실한 DB 원본값을 방어적으로 좁혀 비정상 값의 wire 유출을 막는다. 문서에 기록된 HMAC 화이트리스트 서술 불일치는 이미 코드가 안전한 상태(더 넓은 화이트리스트)이고 문서만 뒤처진 pre-existing 이슈라 이번 PR 의 신규 취약점이 아니다. 인증/인가, 시크릿, 에러 메시지 노출, 암호화 등 다른 OWASP Top 10 항목에서도 이번 diff 범위 내 새로운 취약점은 발견되지 않았다.

## 위험도

NONE

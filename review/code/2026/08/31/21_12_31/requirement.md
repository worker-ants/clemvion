# 요구사항(Requirement) 충족 리뷰 — 엔진 에러 코드 앵커링 (`error-codes-layer-split`, 4라운드)

## 컨텍스트

이번 diff(`origin/main` 대비)는 4개 커밋(`adc4a3ff6` 본 구현 + `4141c64e3`/`eb65d3e6d`/`18062a61a`
3라운드 fix)의 누적이며, 각 라운드마다 이미 `/ai-review` 7-forced-reviewer 가 전부 돌았다
(`review/code/2026/08/31/{20_27_29,20_43_35,20_59_14}/`, 매 라운드 Critical 0). 본 라운드는
그 누적 상태에 대한 4번째(수렴 확인) 패스다.

## 검증 방법

정적 판독 외에 실제로 재실행 확인 (`git status --short` 최종 확인 결과 이번 세션 산출물
디렉터리(`review/code/2026/08/31/21_12_31/`)만 untracked, 소스 변경/뮤테이션 없음):

- `npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` → **14/14 PASS**
- `grep` 으로 `execution-limits.ts`/`execution-engine.module.ts`/`queues/execution-run*.ts` 안의
  `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED` 잔존 인용을 전수
  확인 — 전부 **주석/env-var 이름**(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`)이지 `code`/`errorCode`
  바인딩이 아님. 가드 스캔 표면 밖이 맞고 실제로 위반도 아님.
- `error-codes.ts`·`engine-error-code-anchor-guard.ts`·`engine-error-code-anchor.spec.ts` 전문을
  직접 열어 JSDoc 서술("다섯 형태" · "셋"의 `ANCHORED_ELSEWHERE` 카테고리 · "5지점")과 실제 코드가
  일치하는지 대조 — 일치.
- `RESUME_FAILED` 가 정말 "일반 메서드 인자"로만 쓰여 가드 스캔 밖인지 실 소스에서 확인
  (`execution-engine.service.ts:1469,1473` — `markExecutionCancelled`/`markNodeExecutionFailed`
  호출부, 파라미터 타입은 `'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' | 'RESUME_INCOMPATIBLE_STATE'`
  리터럴 유니온) — 주장과 일치, 오탈자는 `tsc` 가 잡는다는 근거도 실제로 성립.
- `RehydrationError.code` 가 실제로 리터럴 유니온 생성자 positional 인자인지 소스 확인
  (`ai-conversation-helpers.ts:38-43`) — 일치.
- `plan/complete/exec-intake-followups.md` 표(9지점 리다이렉트 목록)와 `CHANGELOG.md`/
  `error-codes.ts` JSDoc 세 문서의 "4코드·5지점" 서술이 상호 일치함을 대조.
- TODO/FIXME/HACK/XXX grep → 실 마커 없음(스펙 스캐너 spec 파일 안의 `'TODO'` 문자열 리터럴 인용
  1건뿐, 실제 미완성 마커 아님).

## 발견사항

없음. Critical/Warning 급 요구사항 결함을 찾지 못했다.

- **[INFO]** (재확인, 신규 아님) `EngineErrorCode` 경계 규칙이 `EXECUTION_TIME_LIMIT_EXCEEDED` 등
  개념상 유사한 `ErrorCode` 소속 엔진 코드에는 소급 적용되지 않는다.
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 등)
  - 상세: 1라운드 requirement 리뷰가 이미 지적했고 `plan/complete/exec-intake-followups.md` 완료
    기록이 "의도된 스코프 축소"로 명시한 항목 그대로다. 4라운드째 재확인해도 동일 결론 — 새 결함
    아니라 알려진 트레이드오프.
  - 제안: 조치 불요.

- **[INFO]** spec fidelity — 관련 spec 은 `spec/conventions/error-codes.md`(§3 historical-artifact
  레지스트리, `WORKER_HEARTBEAT_TIMEOUT` 행), `spec/5-system/3-error-handling.md`,
  `spec/5-system/4-execution-engine.md` §7/§8 세 문서다. 본 라운드에서 `error-codes.md` §3 의
  `WORKER_HEARTBEAT_TIMEOUT` 행 전문을 다시 읽어 `error-codes.ts` JSDoc 의 "이름의 HEARTBEAT 는
  ... 2026-07-04 부터 의미가 재정의됐고 코드명은 유지" 서술과 line-level 로 대조했다 — 일치.
  이번 diff 는 문자열 **값을 전혀 바꾸지 않는** 내부 리다이렉트이므로 이 spec 문서들의 갱신은
  불요하다는 1~3라운드 결론이 재확인됐다. `spec_impact: none`(plan frontmatter) 정확.

## 요약

`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`shutdown-state.service.ts` 세 곳의
엔진 레벨 에러 코드 맨 문자열 9지점(4개 코드 `EXECUTION_QUEUE_WAIT_TIMEOUT`·`WORKER_HEARTBEAT_TIMEOUT`·
`SERVER_INTERRUPTED`×2·`WEBCHAT_IDLE_TIMEOUT` + 이미 `ErrorCode` 에 있던 `LLM_RATE_LIMIT`/
`LLM_CALL_FAILED`×3)를 신설 `EngineErrorCode`/기존 `ErrorCode` 상수 참조로 교체한 순수 리팩터다.
값이 전부 byte-identical 로 보존돼 런타임 동작·DB 영속값·spec 계약을 바꾸지 않는다. 재발 방지용
AST 가드(`engine-error-code-anchor-guard.ts` + fixture + spec, 14 테스트 GREEN)가 앵커 없는 맨
문자열 재발을 형태 기반으로 차단하며, `ANCHORED_ELSEWHERE` 예외 6건(3개 카테고리: 클래스
`readonly code`, trigger `details[].code` 유니온, `RehydrationError` 생성자 인자)의 각 근거를
소스에서 직접 대조해 전부 사실과 일치함을 확인했다. 이미 3라운드(20_27_29→20_43_35→20_59_14)
동안 발견의 성격이 "CHANGELOG 부재 → 가드 보장 범위 → 문서 역전파" 로 좁아지며 Critical 0 을
유지해 왔고, 본 4라운드 독립 재검증(테스트 재실행·소스 직접 대조·잔존 맨 문자열 grep)에서도
새로운 기능적 결함이나 spec 불일치를 찾지 못했다. 반환값·에러 시나리오·엣지 케이스는 모두 원본
동작을 그대로 보존하는 기계적 치환이다. 발견된 2건은 전부 이미 알려진 INFO(의도된 스코프 경계 1건,
spec 정합성 재확인 1건)이며 신규 코드 fix 나 spec 갱신을 요구하지 않는다.

## 위험도

NONE

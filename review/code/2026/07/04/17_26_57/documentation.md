# 문서화(Documentation) 리뷰 결과 (RE-VERIFY)

## 재검증 대상

이전 라운드(16_58_32) Warning:
- spec §8 "PR2b 정책 정의 완료, enforcement 후속" → "PR2b 구현 완료" flip 필요 + admission 원자성 서술을 **advisory lock 필수**로 정정(조건부 UPDATE 단독 불충분 명시) 필요.
- `GET /api/workspaces/:id/settings` 응답 + `WorkspaceSettingsDto` 에 `maxConcurrentExecutions` 누락(PATCH/GET round-trip 비대칭).

## 재검증 결과

### 1. spec §8 flip — RESOLVED

`spec/5-system/4-execution-engine.md` §8 "구현 상태" 안내 문구(L1071)를 워크트리 실파일로 직접 확인:

- "워크스페이스/워크플로우 동시 실행 cap + 큐 대기 5분 cancel 은 **PR2b 구현 완료**(settings 키·advisory-lock admission gate·`queued_at`·`EXECUTION_QUEUE_WAIT_TIMEOUT`·workspace settings write API)" — 이전 "정책 정의 완료, enforcement 는 후속 developer PR" 문구가 제거되고 "구현 완료" 로 정확히 flip됨.
- L1085 (cap 초과 시 동작 서술), L1087 (큐 대기 5분 cancel 서술) 모두 "PR2b(정책 정의 완료, enforcement 구현 후속)" → "**PR2b 구현 완료**" 로 일관되게 갱신됨.
- L1090 admission gate 원자성(TOCTOU) 서술: 이전엔 "per-scope pg advisory lock **또는** 조건부 UPDATE... (구현 재량)" 이었으나, 지금은 "구현은 **per-workspace pg advisory lock(`pg_advisory_xact_lock`)으로 admission 을 직렬화**한 트랜잭션 안에서 조건부 UPDATE... **조건부 UPDATE 단독은 불충분** — 서브쿼리 COUNT 가 스캔하는 다른 `running` 행에는 락이 없어... 둘 다 통과(cap 초과)한다(ai-review CRITICAL 실증)" 로 정확히 정정됨. 실제 구현(advisory lock 필수)과 spec 서술이 이제 일치한다.
- `§Rationale` 절의 "TOCTOU 원자화" 항목(L1535 부근)도 동일하게 "per-workspace `pg_advisory_xact_lock` 으로 admission 을 직렬화... 조건부 UPDATE 단독은 불충분했다... ai-review 가 실 Postgres 로 재현" 으로 갱신되어 본문과 Rationale 간 정합.

이전 라운드 지적 사항은 모두 해소됐다. **다만 재검증 과정에서 이번 PR 의 스코프 밖의 새 stale 포인트를 발견**했다(아래 발견사항 참조).

### 2. GET settings 필드 — RESOLVED (api_contract 라운드에서 이미 확인, 문서화 관점에서도 이상 없음)

`WorkspaceSettingsDto`(`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:37-53`)에 `maxConcurrentExecutions` `@ApiProperty` 가 추가되어 있고, `getWorkspaceSettings()`(`workspaces.service.ts:368-402`) 리턴 타입·구현 모두 해당 필드를 조건부로 채워 반환한다. Swagger 문서와 실제 응답이 이제 일치한다.

## 발견사항 (신규, 이번 PR 스코프에서 파생된 잔여 문서 불일치 — 비차단 권고)

- **[WARNING]** spec §4(Worker 모델) "구현 상태" 안내가 §8 flip 과 모순되는 stale 문구를 그대로 유지
  - 위치: `spec/5-system/4-execution-engine.md:379`
  - 상세: 이번 diff 가 §8 절(L1071/1085/1087/1090, §Rationale)의 구현 상태를 "PR2b 구현 완료"로 정확히 갱신했지만, 같은 문서 앞부분 §4 "구현 상태" 안내 블록은 **수정되지 않은 채** 여전히 다음과 같이 적혀 있다: "**단 §8 동시성 cap·우선순위 3-tier(webhook/schedule 세분화)는 여전히 Planned (PR2b)** — 동시성/타임아웃 enforcement 코드 없음, priority 는 manual > 트리거 이분." 이는 §8 자체가 방금 "구현 완료"로 갱신된 것과 정면으로 모순된다(같은 문서 안에서 §4 는 "enforcement 코드 없음"이라 하고 §8 은 "advisory-lock admission gate 구현 완료"라 함). `git diff origin/main -- spec/5-system/4-execution-engine.md` 로 확인한 결과 이 라인은 이번 PR 의 diff 에 포함되지 않았다 — 즉 §8 을 flip 하면서 문서 앞부분의 상태 요약을 놓친 전형적 "부분 갱신 누락"이다. 우선순위 3-tier 는 실제로 여전히 Planned 가 맞으나("동시성 cap" 부분만 완료로 바뀌었으므로), 현재 문구는 두 항목을 한 문장에 묶어 "동시성 cap"까지 미완료인 것처럼 오독을 유발한다.
  - 제안: L379 문구를 "단 §8 우선순위 3-tier(webhook/schedule 세분화)는 여전히 Planned — priority 는 manual > 트리거 이분. **동시성 cap + 큐 대기 5분 cancel 은 PR2b 구현 완료**(§8 참조)" 식으로 분리·갱신해 §8 본문과 정합시킬 것. 이후 §8 상태를 다시 flip 할 때 이 cross-reference 라인도 함께 갱신 대상에 포함하도록 체크리스트화하는 것을 권장.

- **[INFO]** `WorkspaceSettingsDto` 클래스 docblock 및 컨트롤러 `@ApiOperation.description` 이 신규 필드를 반영하지 못해 Swagger 요약 설명이 실제 스키마보다 좁음
  - 위치:
    - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:36` (`/** 워크스페이스 설정 조회 응답 (현재 interactionAllowedOrigins). */`)
    - `codebase/backend/src/modules/workspaces/workspaces.controller.ts:180-182` (`@ApiOperation({ ... description: '워크스페이스 설정을 조회합니다. 현재는 외부 상호작용 허용 origin 목록(interactionAllowedOrigins)만 반환합니다. ...' })`)
  - 상세: 두 설명 모두 응답이 `interactionAllowedOrigins` "만" 반환한다고 명시하는데, 실제로는 `timezone`(기존, 이번 PR 이전부터)과 이제 `maxConcurrentExecutions`(이번 PR)까지 반환한다. `@ApiProperty` 필드 자체는 정확히 갱신됐으므로 Swagger UI 의 스키마 테이블(필드 목록)은 정확하지만, 사람이 읽는 요약 설명(class docblock·operation description)은 구식이라 문서 이용자가 "origin 목록만 온다"고 오인할 수 있다. `timezone` 누락은 이번 PR 이전부터의 기존 gap 이고, `maxConcurrentExecutions` 는 이번 PR 이 추가한 필드라 신규 stale 유발분이다. 컨트롤러 파일 자체는 이번 diff 에 포함되지 않았으므로(git diff 로 확인, 미변경) 이번 PR 이 직접 건드리지는 않았지만, 새 필드를 추가하면서 상위 설명을 동기화하지 않은 전형적 "부분 갱신" 패턴이다.
  - 제안: class docblock 을 "워크스페이스 설정 조회 응답 (interactionAllowedOrigins, timezone, maxConcurrentExecutions)." 정도로, `@ApiOperation.description` 도 신규 필드를 포함하도록 갱신 권장. 차단 사유는 아님(스키마 자체는 정확) — INFO.

- **[INFO]** 참고: 동일 재검증 라운드의 `api_contract.md` 산출물(L25)이 "`timezone` 필드도 ... `WorkspaceSettingsDto` Swagger 애노테이션에는 이미 존재(사전 확인 결과 해당 없음)" 라고 자기모순적으로 서술 — 실제로는 `WorkspaceSettingsDto` 에 `timezone` `@ApiProperty` 가 없다(grep 으로 확인: `interactionAllowedOrigins`, `maxConcurrentExecutions` 두 필드만 존재). 다른 리뷰어 산출물에 대한 참고 사항이며 이번 documentation 리뷰의 직접 대상은 아니지만, 후속 조치 시 `timezone` 스키마 누락도 함께 정리할 근거로 남겨둔다.

## 요약

이번 RE-VERIFY 라운드의 두 핵심 대상 — spec §8 "구현 완료" flip 과 advisory-lock 필수 서술 정정, `GET /api/workspaces/:id/settings` 의 `maxConcurrentExecutions` 필드 노출 — 은 모두 워크트리 실파일 대조로 해결이 확인됐다(§8 본문·Rationale 정합, DTO·서비스·컨트롤러 스키마 정합). 다만 §8 을 flip 하는 과정에서 같은 문서 앞부분(§4 Worker 모델 "구현 상태" 안내, L379)에 남아있던 cross-reference 문구가 함께 갱신되지 않아, 같은 파일 안에서 "동시성 cap enforcement 코드 없음"(§4)과 "advisory-lock admission gate 구현 완료"(§8)가 공존하는 새로운 내부 모순이 발생했다 — 이는 이번 PR 스코프가 만든 부작용이므로 WARNING 으로 반영한다. 그 외 `WorkspaceSettingsDto`/컨트롤러의 요약 설명이 신규 필드를 반영하지 못한 점은 차단 사유가 아닌 INFO 수준의 사소한 개선 여지다. Critical 급 문서화 결함은 없다.

## 위험도

LOW

STATUS: SUCCESS

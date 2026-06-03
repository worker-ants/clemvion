# Testing Review — spec-sync-audit

## 발견사항

### [INFO] spec/conventions/interaction-type-registry.md — `REGISTRY_SITES` vs `SOURCE_REGISTRY_SITES` 명시 정합
- 위치: 파일 1, `§1.2 규칙 3` 및 `§2.1 system_error` 행
- 상세: 변경된 spec은 `REGISTRY_SITES` 4개 파일과 `SOURCE_REGISTRY_SITES` 1개 파일을 명시한다. `/Volumes/project/private/clemvion/codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 코드를 확인하면 `REGISTRY_SITES`(4개)와 `SOURCE_REGISTRY_SITES`(1개)가 spec 기술과 정확히 일치한다. ConversationTurnSource 6값 (`system_error` 포함)도 `SOURCE_ENUM_VALUES`에 반영되어 있다. spec 변경이 테스트와 동기화되어 있어 회귀 위험 없음.
- 제안: 현재 상태 유지. spec과 테스트의 단일 진실이 잘 지켜짐.

### [INFO] spec/conventions/spec-impl-evidence.md — `spec-pending-plan-existence.test.ts` 로직 변경 반영
- 위치: 파일 6, `§4 가드 표` 및 `§2.1 pending_plans 행`
- 상세: spec 변경 — `pending_plans:` 경로가 `plan/in-progress/` 또는 `plan/complete/`(치환) 중 하나에 실존해야 한다는 규칙. `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts`를 확인하면 `inProgressAbs`와 `completeAbs` 양쪽 모두 `fs.existsSync`로 확인하며 OR 조건을 쓴다 — spec 명세와 완전히 일치한다. 테스트가 이미 새 규칙을 구현하고 있음.
- 제안: 이상 없음.

### [INFO] spec/conventions/spec-impl-evidence.md — `backlog` 가드 — 전체 텍스트 vs `§6.3` 절 한정
- 위치: 파일 6, `R-3`, `§3 표`
- 상세: 구 spec은 "`spec/0-overview.md §6.3 로드맵` 항목에 grep 매칭"이라 했고 신 spec은 "문서 전체 텍스트에 `includes` 매칭 — 현 구현이 §6.3 절 한정이 아닌 전체 텍스트"라고 정정했다. `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts`를 확인하면 `overviewText.includes(id)` — 전체 텍스트 검사로 동작하며 spec 기술과 일치한다. 단, spec은 "향후 §6.3 절 단위로 좁힐 계획"을 언급하므로 이후 절 단위 검증으로 전환 시 테스트도 함께 갱신해야 한다는 TODO 성격의 사항이 spec에만 기재되고 테스트 주석에는 반영되어 있지 않다.
- 제안: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts`의 `(d)` 케이스 주석에 "현재 전체 텍스트 검사, §6.3 절 단위 전환 계획" 내용 추가 권장 (테스트 오동작은 없으나 가독성·미래 수정 시 맥락 보호).

### [WARNING] spec/conventions/user-guide-evidence.md — `impl-anchor-existence.test.ts` spec 기술 vs 실제 테스트 불일치
- 위치: 파일 8, `§2 가드 표` (`impl-anchor-existence.test.ts` 행)
- 상세: 변경된 spec은 "`kind` enum 유효성 + `file` 실존 + `symbol` 이 file 안 substring grep ≥1 매치. `api-endpoint` 도 동일한 substring grep 만 적용하며, NestJS `@Post`/`@Get` 데코레이터·path 매치 검증은 **미구현 (Planned)**"이라고 기술한다. `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts`를 확인하면 `kind` enum 유효성 검사(`isValidKind`)와 `file.includes(symbol)` substring 검사가 존재하고 `api-endpoint` 전용 경로 분기는 없다. spec 기술과 정확히 일치한다. **그러나** 구 spec이 "kind=api-endpoint인 경우 NestJS `@Post`/`@Get` 데코레이터 + path 매치 추가 검증"이라 기술했던 것이 사실은 구현되어 있지 않았음이 이번 변경으로 드러났다. 이는 spec-code 불일치가 수정된 케이스로, 테스트 자체는 정확하지만 과거 spec이 구현을 과장했던 회귀 리스크가 있었다.
- 제안: 향후 `api-endpoint` 전용 NestJS 데코레이터 검증이 구현될 경우, 테스트가 자동으로 업데이트되지 않으므로 plan 추적이 필요하다. 해당 기능은 `plan/in-progress/spec-sync-user-guide-evidence-gaps.md`로 이미 추적 중이므로 현재 상태 적절.

### [INFO] spec/conventions/migrations.md — `[migration-guard] ` prefix 추가, 테스트 영향 없음
- 위치: 파일 2, `§6 가드 표`
- 상세: 변경은 위반 메시지에 `[migration-guard] ` prefix가 붙는다는 사실을 명시. `/Volumes/project/private/clemvion/codebase/backend/src/migrations.spec.ts`와 `scripts/check-migration-versions.py`는 파일명 형식 검사를 하는 것이지 오류 메시지 문자열을 파싱하지 않는다. 따라서 테스트 영향 없음.
- 제안: 이상 없음.

### [INFO] spec/conventions/migrations.md — `SQL_NAME_RE`(하이픈 허용) vs `SQL_RE`(대문자 허용) 가드 정규식 불일치 문서화
- 위치: 파일 2, `§3 번호 명명` 상세 변경
- 상세: spec이 `migrations.spec.ts`의 `SQL_NAME_RE`는 `[a-z0-9_-]+`(하이픈 허용)이고 `check-migration-versions.py`의 `SQL_RE`는 `[A-Za-z0-9_]+`(대문자 허용)라는 불일치를 이번에 명시했다. 두 가드가 다른 허용 문자집합을 쓰는 것은 기존 동작이며 spec이 정정한 것이다. 단, 두 가드 사이의 불일치 자체를 검증하는 테스트는 없다 — 예컨대 "하이픈을 포함한 파일명이 양쪽 가드를 동시에 통과하는지" 크로스 검증이 없다.
- 제안: 가드 정규식 불일치를 명시적으로 검증하는 테스트(Python script 단위 테스트 또는 `migrations.spec.ts` 내 추가 케이스)가 없는 점은 낮은 위험이지만, 향후 한쪽 가드가 수정될 때 다른 쪽과의 괴리를 놓칠 수 있다.

### [INFO] spec/conventions/node-cancellation.md — AI 노드 signal 전파 구현 완료, 테스트 보강 필요
- 위치: 파일 3, `§6 구현 현황 표` — AI 노드 signal 전파 `✓` 표시
- 상세: spec이 `ai-agent.handler.ts` / `text-classifier.handler.ts` / `information-extractor.handler.ts`의 Anthropic SDK `signal` 전파가 구현됐음을 기술한다. 그러나 `HTTP 단위 테스트 ✓ (http-request.handler.spec.ts)`와 달리 **AI 노드 signal 전파에 대한 단위 테스트는 spec에도 기재되어 있지 않고**, `§6 표`에서도 "HTTP 단위 테스트"만 별도 항목으로 존재한다. AbortSignal이 실제로 Anthropic SDK에 전달되는지 검증하는 테스트가 없다면 구현 drift를 잡지 못할 수 있다.
- 제안: `ai-agent.handler.spec.ts` / `text-classifier.handler.spec.ts` / `information-extractor.handler.spec.ts`에서 `context.abortSignal`이 SDK `create()` 호출의 `signal` 파라미터로 전달되는지 mock 검증 케이스 추가 권장. spec의 `pending_plans` 또는 `plan/in-progress/node-cancellation-infrastructure.md`에 이 테스트 항목을 추적하는 것을 고려.

### [WARNING] spec/conventions/node-cancellation.md — DB / Email 노드 in-flight 중단 미구현, 테스트 전략 부재
- 위치: 파일 3, `§6 표` — `🚧 부분 구현` 항목
- 상세: `database-query.handler.ts`와 `send-email.handler.ts`는 진입 직전 `abortSignal?.aborted` 사전 체크만 하고 in-flight 중단은 없다. 이 "사전 체크만" 동작을 명시적으로 검증하는 단위 테스트가 있는지 확인이 필요하다. spec에 기술된 behavior("진입 직전 `abortSignal?.aborted` → AbortError")가 실제로 테스트로 커버되지 않는다면, 추후 리팩터링 시 이 사전 체크가 제거되어도 알 수 없다.
- 제안: `database-query.handler.spec.ts` / `send-email.handler.spec.ts`에 `abortSignal.aborted=true`인 상태로 진입 시 AbortError가 throw되는지 검증하는 테스트 추가 권장.

### [INFO] spec/data-flow/10-triggers.md — Schedule BullMQ 이관 관련 테스트 커버리지 갭
- 위치: 파일 11, `§1.3 Schedule 발사` / `§1.4 동기화`
- 상세: BullMQ repeatable job scheduler로의 이관이 완료됐음을 spec이 기술한다. `upsertJobScheduler` 호출, `registerJob`/`removeJob` 동작, `next_run_at`이 발사를 트리거하지 않는다는 사실 등이 새로 기술됐다. 이 동작들을 검증하는 단위 테스트의 존재 여부가 spec에 언급되지 않는다. `@Cron` → BullMQ 이관은 멀티 인스턴스 환경에서의 중복 실행 제거가 핵심인데, 이를 검증하는 integration 테스트가 없으면 이관이 올바르게 동작하는지 확인이 어렵다.
- 제안: `SchedulesService` 단위 테스트에서 `is_active=false` 토글 시 `removeJob` 호출, cron 변경 시 `upsertJobScheduler` 재등록이 이루어지는지 mock 검증 추가 권장.

### [INFO] spec/data-flow/12-workspace.md — `(owner_id, type) UNIQUE` DB 제약 누락 문서화, 회귀 테스트 없음
- 위치: 파일 13, Rationale `### (owner_id, type) UNIQUE`
- 상세: spec이 TypeORM `@Unique` 데코레이터만 있고 DB UNIQUE 제약이 없다는 갭을 명시했다. 이 갭은 "personal workspace 중복 생성 방지가 DB 레벨에서 강제되지 않음"을 의미한다. 이를 검증하는 테스트가 없으며, 현재는 application 코드 흐름으로만 방지한다. 잘못된 코드 경로 또는 직접 DB INSERT 시 중복 생성이 가능하다.
- 제안: integration 테스트 또는 마이그레이션 spec 검사에서 "personal workspace 중복 생성 방지" 케이스를 추가하거나, DB UNIQUE 제약 추가 migration을 plan에 등록 권장. 현재로서는 이 갭이 테스트로 잡히지 않는다.

### [INFO] spec/data-flow/2-auth.md — 2단계 회원가입 흐름 변경, 테스트 업데이트 필요 가능성
- 위치: 파일 14, `§1.1 회원가입`
- 상세: spec이 로컬 회원가입이 2단계(`register` → 메일 발송 → `verify-email` → personal workspace + token 발급)임을 명시했다. 기존 spec은 단일 트랜잭션으로 기술했다. 이 흐름 변경에 대응하는 테스트(`auth.service.spec.ts` 등)가 기존의 "register 시 즉시 token 반환" 가정으로 작성되어 있다면 현재 동작과 불일치할 수 있다.
- 제안: 회원가입 관련 기존 테스트가 2단계 흐름에 맞게 갱신되어 있는지 확인 필요. 특히 `invitationToken` 동봉 가입(예외 경로 — personal workspace 미생성, 자동 로그인)을 검증하는 별도 테스트 케이스 존재 여부 확인 권장.

### [INFO] spec/data-flow/8-notifications.md — 미구현 기능들의 테스트 부재는 적절하나 추적 필요
- 위치: 파일 19, 전반
- 상세: spec이 WS emit, 이메일 발송, 단일 `notify()` 표면 등을 **미구현 (Planned)**으로 명시했다. 이들 기능에 대한 테스트가 없는 것은 미구현이므로 당연하다. 다만 `alert_<rule.type>` 동적 type이 V052 CHECK 제약 목록 밖이라는 점은 DB 정합성 관점에서 테스트로 검증되지 않는다 — spec 자체도 "spec 범위 밖 별도 추적"으로 미룬다.
- 제안: `alert_<type>` 동적 type 값이 실제로 DB에 삽입될 때 CHECK 위반이 발생하지 않는지 검증하는 테스트 필요 여부를 별도 plan에 등록 권장.

---

## 요약

이번 변경은 20개 spec 문서(`spec/conventions/`, `spec/data-flow/`)의 구현 현황 정합성 갱신이다. 대부분의 변경은 기존 테스트 코드(`interaction-type-exhaustiveness.test.ts`, `spec-pending-plan-existence.test.ts`, `spec-status-lifecycle.test.ts`, `impl-anchor-existence.test.ts`, `migrations.spec.ts`)와 정확히 일치하여 회귀 위험이 낮다. 주요 테스트 갭으로는 (1) AI 노드 AbortSignal 전파에 대한 단위 테스트 부재, (2) DB/Email 노드 사전 abort 체크의 명시적 테스트 부재, (3) `workspace.(owner_id, type)` DB UNIQUE 제약 누락에 대한 테스트 보호 부재가 있다. spec 변경이 기존 구현 현황을 더 정확하게 기술하는 방향으로 이루어졌으며, 이 변경 자체가 기존 가드 테스트를 깨뜨리지 않는다. 단, spec에서 새로 구현 완료로 표기된 기능(AI 노드 cancellation signal, BullMQ 스케줄러 이관, Chat Channel inbound 분기)에 대응하는 단위 테스트 커버리지가 spec에 언급되지 않는다는 점은 향후 드리프트 위험 요인이다.

## 위험도

LOW

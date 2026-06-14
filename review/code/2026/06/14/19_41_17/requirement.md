# Requirement Review — EIA Follow-up Code Quality

리뷰 일시: 2026-06-14
대상 파일: 8개 (파일 1~8)

---

## 발견사항

### [INFO] 파일 1 — `external-interaction.module.ts`: `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수 분리
- 위치: diff hunk (line 40-41)
- 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 `terminal-revoke-reconciler.service.ts` 에서 신규 `terminal-revoke-reconciler.types.ts` 로 이동하는 import 경로 수정. 기능 동작에 변화 없음. spec §10 파일 구조 목록에는 `terminal-revoke-reconciler.types.ts` 가 별도 항목으로 없으나, `notification-dispatcher.types` 와 동일 패턴이라 의도적 패턴 확장임.
- 제안: 무결. 현재 상태 유지.

---

### [INFO] 파일 2 — `interaction-token.service.spec.ts`: 신규 테스트 3건

#### (2-A) `batchLimit 하한 — 0/음수는 1 로 clamp`
- 위치: line 138-147 (추가)
- 상세: `reconcileTerminalRevocations(0)` 호출 시 `qb.limit` 에 `1` 이 전달됨을 검증. 구현체의 `Math.max(1, Math.floor(batchLimit))` clamp 로직과 정합.
- 엣지 케이스 완전성: 음수 케이스는 테스트 명칭에 포함("0/음수")하나 실제로 `0` 만 테스트. 음수 입력은 `Math.max(1, Math.floor(-5)) = 1` 이므로 동일 결과이며 기존 테스트로 커버되는 정도는 충분하나, 명칭과 테스트 인자 사이의 사소한 불일치. 기능적으로는 문제 없음.
- 제안: 허용 수준. 음수 케이스도 인자로 추가하면 이름과 일치하지만 선택적 개선.

#### (2-B) `RECONCILE_CONCURRENCY(20) 초과 — 다중 청크 전부 처리·집계 정확`
- 위치: line 149-169 (추가)
- 상세: 25건 rows 로 청크(20)+청크(5) 분리 처리 및 `swept:25`, `revoked:25`, `repo.find` 25회 호출을 검증. 구현체의 `for (let i = 0; i < rows.length; i += RECONCILE_CONCURRENCY)` + `Promise.allSettled` 경로와 정합.
- 기능 완전성: 집계 누락 없음, 청크 경계 처리 확인. 적절.

#### (2-C) 만료 토큰 `repo.delete` 호출 확인 (기존 테스트에 단언 추가)
- 위치: line 178-179 (기존 테스트에 2행 추가)
- 상세: "만료 토큰이라도 `execution_token` row 는 정리" 단언. 구현체 `revokeAllForExecution` 의 `await this.executionTokenRepository.delete({ executionId })` 호출 경로와 일치. `ttl <= 0` 분기에서도 `delete` 가 그 이후에 실행됨을 테스트가 검증함.
- 비즈니스 로직: spec §7.3 "Revoke = 각 jti 를 Redis blacklist 에 등록 + `execution_token` row 삭제" 규칙과 일치. 만료 jti 는 blacklist 등재 skip 이지만 row 는 삭제해야 한다는 의도가 코드·테스트·설명 주석에서 일관됨.

---

### [INFO] 파일 3 — `interaction-token.service.ts`: `DEV_EPHEMERAL_SECRET` 도입

- 위치: line 850 (상수 추가), line 867 (fallback 할당)
- 상세: 구 `'interaction-fallback'` 하드코딩 문자열을 `randomBytes(32).toString('hex')` ephemeral 값으로 교체. 모듈 로드 시 1회 생성 → 프로세스 재시작마다 변경.
- spec §8.3 일치: "셋 다 미설정이면 dev 는 비보안 placeholder 로 떨어지지만 `NODE_ENV=production` 에서는 생성자가 throw" 명세와 완전 일치. 변경은 "비보안 placeholder" 를 version history 에 고정값이 남지 않는 ephemeral 로 강화한 것.
- warn 메시지: 기존 "비보안 fallback" → "ephemeral random fallback (재시작마다 변경, dev 토큰 무효화)" 로 갱신. 운영자가 dev 토큰 재시작 무효화를 인지하도록 개선.
- 에러 시나리오: `NODE_ENV=production` + secret 전무 → throw `/NODE_ENV=production/` 패턴 테스트와 일치. 비프로덕션 환경 → throw 없음 테스트와 일치.
- 반환값: 모든 경로에서 `this.secret` 할당 완료. constructor 에서 throw 경로 포함 모든 분기 처리됨.

---

### [INFO] 파일 4 — `interaction.controller.ts`: Swagger 응답 데코레이터 교체

- 위치: 4개 endpoint (interact, cancel, refreshToken, getStatus)의 `@ApiAcceptedResponse`/`@ApiOkResponse` → `@ApiAcceptedWrappedResponse`/`@ApiOkWrappedResponse`
- 상세: Swagger 응답 스키마가 `{ data: <Dto> }` 래퍼를 반영하도록 수정. 실제 런타임 동작(전역 `TransformInterceptor` 래핑)과 API 문서 간 정합성 복원.
- spec §10.1: "Swagger 규약 §5-2 공용 래퍼 헬퍼 적용 대상" — `ApiAcceptedWrappedResponse`/`ApiOkWrappedResponse` 는 `spec/conventions/swagger.md §5` 의 공식 래퍼 헬퍼이므로 spec 의도와 정확히 일치.
- spec §5.1 · §5.4 · §5.5 · §5.3: 각 endpoint 의 응답 shape 가 `{ "data": { ... } }` 로 감싸진다는 §5 서두 명세와 정합.
- 기능 완전성: 문서 수준 변경만. 실제 핸들러 로직 변경 없음. 무결.

---

### [INFO] 파일 5 — `terminal-revoke-reconciler.service.spec.ts`: job opts 단언 추가

- 위치: line 38-46의 `expect.objectContaining` 내부에 `opts` 중첩 추가
- 상세: `upsertJobScheduler` 3번째 인자에 `opts.removeOnComplete: { age: 24*60*60 }` 및 `opts.removeOnFail: { age: 7*24*60*60 }` 가 동봉됨을 검증.
- spec §Rationale R15: "repeatable job 보존 — 완료 24h / 실패 7d" 주석이 코드에 상수(`REMOVE_ON_COMPLETE_AGE_SEC`, `REMOVE_ON_FAIL_AGE_SEC`)로 표현되어 있으며, 테스트가 이를 숫자 값으로 단언함. spec 의도(R15의 BullMQ repeatable scheduler 정의) 와 일치.
- 기능 완전성: 기존 `name` 단언은 유지하고 `opts` 단언이 추가됐으므로 실제 scheduler 등록 내용을 더 완전하게 검증.

---

### [INFO] 파일 6 — `terminal-revoke-reconciler.service.ts`: `TERMINAL_REVOKE_RECONCILE_QUEUE` import 경로 변경

- 위치: line 4 (import 변경), line 6 (`export const` 제거)
- 상세: 상수를 `./terminal-revoke-reconciler.types` 로부터 import 하고 서비스 파일 내 export 를 제거. 기능 동작 불변. SoT 단순화 (서비스 파일이 상수 소유권을 갖지 않음).
- 비즈니스 로직: `process()`, `reconcile()`, `onModuleInit()` 로직 변경 없음. 무결.

---

### [INFO] 파일 7 — `terminal-revoke-reconciler.types.ts`: 신규 파일

- 위치: 전체 파일 신규 생성 (8행)
- 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile'` 단일 상수 파일. JSDoc 에 `notification-dispatcher.types` 와 동일 패턴이라 명시.
- 기능 완전성: `system-status.constants.ts`, `external-interaction.module.ts`, `terminal-revoke-reconciler.service.ts`, `terminal-revoke-reconciler.service.spec.ts` 네 소비자 모두 이 파일을 import 하도록 이미 변경됨(파일 1, 6, 8, 5). 순환 의존 없음. 완전.

---

### [INFO] 파일 8 — `system-status.constants.ts`: import 경로 수정

- 위치: line 11 (import 경로 변경)
- 상세: `'../external-interaction/terminal-revoke-reconciler.service'` → `'../external-interaction/terminal-revoke-reconciler.types'` 로 경로 수정. `system-status.constants` 가 service 구현 파일을 직접 import 하는 불필요한 결합 제거.
- 상수값 `'terminal-revoke-reconcile'` 자체는 불변. 런타임 동작 변화 없음.

---

### [SPEC-DRIFT] [WARNING] spec §10 파일 구조에 `terminal-revoke-reconciler.types.ts` 미등재
- 위치: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §10 (line 762 영역)
- 상세: §10 파일 구조 목록이 `terminal-revoke-reconciler.service.ts` 만 명시하고 신규 `terminal-revoke-reconciler.types.ts` 는 미등재. 코드는 `notification-dispatcher.types` 패턴과 일관되게 의도적으로 추가된 것이며 되돌리는 것이 오답.
- 제안: 코드 유지 + spec §10 파일 구조 목록에 `terminal-revoke-reconciler.types.ts # BullMQ 큐 이름 상수 (notification-dispatcher.types 패턴)` 행 추가. 갱신 대상: `spec/5-system/14-external-interaction-api.md` §10 파일 구조 목록.

---

## 요약

8개 파일 모두 의도한 기능을 완전히 구현하고 있으며 spec §3.3(EIA-AU-04), §3.4(EIA-RL-06), §7.3, §8.3, §9.3(R15), §10.1 과 line-level 로 정합한다. `DEV_EPHEMERAL_SECRET` 교체는 버전 이력에 예측 가능한 고정 secret 을 남기지 않는 보안 강화이며, `TERMINAL_REVOKE_RECONCILE_QUEUE` 분리는 `notification-dispatcher.types` 와 동일 패턴 적용으로 일관성 있는 의도적 개선이다. 신규 테스트 3건(`batchLimit 하한`, `RECONCILE_CONCURRENCY` 초과 청크, 만료 토큰 row 정리)은 구현 로직의 엣지 케이스를 정확하게 커버하며, Swagger 래퍼 데코레이터 교체는 실제 wire format `{ data: ... }` 와 API 문서의 정합을 복원한다. TODO/FIXME/HACK 주석 없음. 코드 버그 없음. SPEC-DRIFT 1건(spec §10 파일 구조 목록 미갱신)은 spec 갱신 누락으로 코드 fix 대상이 아니다.

## 위험도

NONE

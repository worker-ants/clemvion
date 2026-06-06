# 보안(Security) 리뷰

## 발견사항

### INFO: PARK_RELEASED Symbol 분리 — 모듈 경계 강화
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` (신규 파일)
- 상세: `PARK_RELEASED` sentinel Symbol 및 `ProcessTurnResult` 타입이 `execution-engine.service.ts` 내 로컬 정의에서 공유 모듈(`shared/execution-resume/`)로 이관됐다. Symbol 은 JavaScript 에서 전역 고유(단일 인스턴스)이므로, 모듈 분리 자체가 동일성 비교(`=== PARK_RELEASED`)에 영향을 주지 않는다. 보안 관점에서 긍정적 — sentinel 이 외부 모듈에서 위조될 수 없고, 타입 시스템이 잘못된 return 값을 컴파일 타임에 차단한다.
- 제안: 현 구조 유지. 추가 위험 없음.

### INFO: 에러 메시지에 노드 타입 정보 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-followup-272c4f/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `dispatchResumeTurn` (신규 추가 L1048~1054), `handleAiResumeTurn` (신규 추가 L1079~1084)
- 상세: 예외 메시지에 `ctx.node.type`, `ctx.persistedInteractionType` 등 내부 구현 세부 정보가 포함된다:
  ```
  `Unsupported interaction type for rehydration: ${ctx.persistedInteractionType ?? '(unknown)'} (node type=${ctx.node.type})`
  `Multi-turn AI 노드(${ctx.node.type}) _resumeCheckpoint 재구성 실패: ${err.message}`
  ```
  이 메시지가 API 응답으로 클라이언트에 그대로 노출될 경우 내부 아키텍처 정보(노드 타입, interaction 타입 등)가 누출된다. `RehydrationError` 의 상위 catch 가 어떻게 처리하는지 이 diff 범위에서는 확인 불가.
- 제안: `RehydrationError` 를 캐치하는 최상위 핸들러에서 구체 메시지를 로그에만 기록하고, 클라이언트 응답에는 일반화된 오류 코드(`RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`)만 노출하는지 확인할 것. 현재 diff 에서 해당 경계가 보이지 않으면 별도 점검 필요.

### INFO: `as unknown as` 캐스팅 — 테스트 전용, 프로덕션 미영향
- 위치: `execution-engine.service.spec.ts` — `dispatchResumeTurn`, `handleAiResumeTurn`, `processFormResumeTurn` 등 private 메서드 직접 접근
- 상세: 테스트 파일에서 `service as unknown as DispatchSubject` 캐스팅으로 private 메서드를 직접 호출한다. 이는 TypeScript 의 접근 제어를 우회하는 패턴이지만, 테스트 코드에 한정되며 컴파일 후 실행 경계에는 영향이 없다. 프로덕션 코드에서 동일 패턴이 사용되지 않는 한 보안 위험은 없다.
- 제안: 테스트 관용 패턴으로 수용 가능. 단, 테스트 파일 외 프로덕션 코드에서 `as unknown as` 를 통한 접근 제어 우회가 없는지 별도 확인 권장.

### INFO: `resumeCheckpoint` 타입 캐스팅 — 스키마 검증 부재
- 위치: `execution-engine.service.ts` `handleAiResumeTurn` L1075
  ```typescript
  ctx.resumeCheckpoint as Record<string, unknown>
  ```
- 상세: `resumeCheckpoint` 는 `Record<string, unknown> | undefined` 로 선언되어 있으나, `dispatchResumeTurn` 에서 `hasResumeCheckpoint: !!ctx.resumeCheckpoint` 로 존재 여부만 검사하고 구조 검증은 하지 않는다. `buildRetryReentryState` 가 손상된 checkpoint 를 받으면 try/catch 로 `RESUME_INCOMPATIBLE_STATE` 를 발생시켜 graceful 처리한다 — 이 방어 로직은 적절하다. 그러나 checkpoint 가 외부 공격자에 의해 조작 가능한 경로(DB 직접 조작, 미검증 입력 등)가 있다면 런타임 오류 이상의 영향이 생길 수 있다.
- 제안: `resumeCheckpoint` 가 영속 DB 칼럼에서 읽히는 경우, 해당 칼럼에 대한 접근 제어(SQL-level)가 적절한지 확인. `buildRetryReentryState` 내부의 손상 데이터 처리가 예외 throw 외에 추가 부작용을 일으키지 않는지 검토.

### INFO: 계획 문서(plan/complete) 내 민감 정보 흔적 — `.env` 관련 참조
- 위치: `plan/complete/exec-park-b2a-followup.md`, `plan/complete/exec-park-polish.md`
- 상세: 계획 문서에 `ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef`(이전 e2e 환경의 32-char 키) 가 언급된다. 이는 e2e 테스트 환경의 ephemeral 값을 설명하는 context 로, 하드코딩된 프로덕션 시크릿이 아니다. 계획 문서에는 실제 API 키나 비밀번호는 포함되어 있지 않다. 단, 이 파일이 git 히스토리에 포함되므로 해당 값이 어느 환경에서도 재사용되지 않는지 확인 권장.
- 제안: `docker-compose.e2e.yml` 의 `ENCRYPTION_KEY` 가 64-hex 로 교정됐다고 명시되어 있으며, 이전 32-char 값이 프로덕션 어디에도 사용되지 않음을 확인. 테스트 환경 키는 더미 값으로 유지하되 프로덕션 값과 동일하지 않도록 관리.

## 요약

이번 변경은 `PARK_RELEASED` sentinel 과 관련 타입을 공유 모듈로 추출하고, `dispatchResumeTurn`/`handleAiResumeTurn` 두 개의 신규 private 메서드를 도입해 form/buttons/AI 재개 분기를 registry 패턴으로 일원화하는 리팩터링이다. 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회, 암호화 알고리즘 문제는 이 diff 범위에서 발견되지 않는다. 주요 주의 사항은 두 가지다: (1) `RehydrationError` 의 상세 메시지(노드 타입, interaction 타입)가 API 응답으로 클라이언트에 전달되는 경로가 있는지 최상위 핸들러 레벨에서 확인이 필요하며, (2) `resumeCheckpoint` 에 대한 런타임 구조 검증 없이 `Record<string, unknown>` 으로 타입 캐스팅하는 부분은 `buildRetryReentryState` 의 try/catch 로 방어되나, checkpoint 데이터 소스의 신뢰성(DB 접근 제어)을 별도로 검토해야 한다. 전반적으로 이 변경은 중복 코드 제거와 extension seam 확보에 집중한 안전한 내부 구조 개선으로, 보안 위험 증가는 없다.

## 위험도

LOW

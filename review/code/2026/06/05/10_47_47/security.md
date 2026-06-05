# 보안(Security) 리뷰 — PR-A2a _resumeCheckpoint schemaVersion + 재구성 견고화

## 발견사항

### [INFO] checkpoint 데이터를 DB(JSONB)에서 신뢰하지 않고 타입 검증 적용
- 위치: `execution-engine.service.ts` diff — 버전 가드 블록 (`ckptVersion > CHECKPOINT_SCHEMA_VERSION`)
- 상세: `resumeCheckpoint.schemaVersion` 을 `typeof ckptVersion === 'number'` 조건 후 비교한다. DB에서 로드한 JSONB 필드이므로 문자열·null·배열 등 예상 외 타입이 올 수 있으나, `typeof` 검사가 선행되어 타입 혼동(type confusion) 으로 인한 부정확한 비교를 차단하고 있다. 현재 구현은 적절하다.
- 제안: 현 구현 유지. 다만 `schemaVersion < 0` 같은 음수 방어가 명시적으로는 없으며, `CHECKPOINT_SCHEMA_VERSION` 이 항상 양수 정수로 유지되는 한 문제는 없다. 상수 변경 시 주석 또는 단위 테스트로 불변식을 보장하면 충분하다.

### [INFO] `resumeFields` spread + 방어적 기본값 패턴 — 오염 필드 유입 가능성
- 위치: `execution-engine.service.ts` diff — `buildRetryReentryState` 내 `resumeState` 구성 블록
- 상세: `...resumeFields` spread 가 `retryState`(즉 checkpoint JSONB)의 모든 알 수 없는 필드를 `resumeState` 로 그대로 전달한다. `schemaVersion` 은 명시적으로 strip 되지만, 향후 checkpoint 에 추가되는 임의 필드나 외부 조작으로 주입된 필드가 `resumeState` 를 경유해 AI 핸들러 또는 LLM 프롬프트에 도달할 여지가 있다. 현재 `_resumeCheckpoint` 의 저장·로드 경로가 내부 제어 하에 있고 외부 사용자 입력이 직접 checkpoint 에 기록되지 않는 구조이므로 즉각적인 취약점은 아니다. 그러나 allow-list 방식이 아닌 deny-list(strip) 방식이어서 스키마 확장 시 보안 검토 주의가 필요하다.
- 제안: 장기적으로 `resumeState` 를 spread 대신 명시 필드 열거 방식(allow-list)으로 재구성하거나, checkpoint 로드 시 known-field 스키마 검증 단계를 두는 것을 권장한다. 단기적으로는 현 수준의 위험도는 낮다.

### [INFO] 에러 메시지에 내부 구현 세부사항 포함
- 위치: `execution-engine.service.ts` diff — `RehydrationError` 생성자 호출 메시지 (`schemaVersion(${ckptVersion}) 이 현재 지원 버전(${CHECKPOINT_SCHEMA_VERSION}) 초과`)
- 상세: `RESUME_INCOMPATIBLE_STATE` 에러 메시지에 실제 `ckptVersion` 숫자와 `CHECKPOINT_SCHEMA_VERSION` 상수 값이 포함된다. 이 에러는 `Execution.error.code/message` 로 DB 에 저장되며, spec 에 따르면 채널 어댑터가 사용자에게 "graceful 안내"로 변환한다. 채널 어댑터가 변환을 빠트리면 내부 버전 정보가 사용자에게 노출될 수 있다.
- 제안: 채널 어댑터(`error.code === 'RESUME_INCOMPATIBLE_STATE'` 분기)에서 원본 메시지를 사용자에게 그대로 노출하지 않도록 보장하는 코드를 확인한다. 이미 구현된 경우 현 수준은 수용 가능하다.

### [INFO] 테스트 코드에서 `service as unknown as ...` 내부 필드 직접 접근
- 위치: `execution-engine.service.spec.ts` diff — `cpSubject()`, `svcAny.waitForAiConversation` 접근
- 상세: 테스트 파일로 프로덕션 보안 영향은 없다. 다만 `private` 메서드를 `as unknown as` 타입 단언으로 직접 호출하므로, 리팩터링 시 컴파일 오류 없이 테스트가 실제 구현과 분리될 수 있다. 테스트 코드의 표준 패턴이므로 운영 위험은 없다.

## 요약

이번 변경(PR-A2a)은 `_resumeCheckpoint` 에 스키마 버전(`CHECKPOINT_SCHEMA_VERSION=1`)을 도입하고 재구성 시 방어적 기본값을 적용하는 보안-무관 기능 강화다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 암호화 관련 취약점은 발견되지 않았다. 가장 주목할 부분은 `...resumeFields` spread 로 DB JSONB 의 모든 필드가 `resumeState` 에 전달되는 allow-list 미적용 패턴인데, 현재 checkpoint 쓰기 경로가 내부 제어 하에 있어 즉각적 위험은 없으나 장기적으로 스키마 확장 시 주의가 필요하다. 에러 메시지에 내부 버전 상수 값이 포함되는 점은 채널 어댑터가 변환을 보장하는 한 수용 가능 수준이다. 전체적으로 이번 변경은 보안 수준을 저하시키지 않으며, 부분 손상 checkpoint 에 대한 방어적 처리로 오히려 안정성을 향상한다.

## 위험도

LOW

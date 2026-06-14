# Security Review

## 발견사항

### **[INFO]** 폼 데이터 입력 검증 미구현 상태 인지 (서버측)
- 위치: `plan/in-progress/spec-sync-form-gaps.md`, `§4 step5 / §6.2` 항목
- 상세: plan 문서에 서버측 폼 검증(필수 필드·타입·validation·파일 검증)이 미구현 상태로 명시 추적 중이다. 이번 PR 변경 범위(§5.5 durationMs)와 직접 관련은 없으나, 해당 검증 공백이 지속되면 악의적 폼 제출 페이로드(빈 필수 필드, 잘못된 타입, 과도한 파일 크기/MIME)가 서버에 그대로 전달될 수 있다. 현재 `processFormResumeTurn`이 화이트리스트 필터만 수행한다고 plan에 명시되어 있다.
- 제안: plan에 이미 "파일검증 cluster" 후속 PR로 분리 결정되어 있으므로, 해당 PR에서 서버측 필수/타입/file 검증 + 재-waiting 흐름을 구현할 때 MIME 타입 화이트리스트와 크기 상한을 enforce 하는 것을 우선순위 높게 처리한다.

### **[INFO]** `nodeExec.startedAt` 신뢰 경계 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, diff 추가 라인(~L4077-L4550 구간)
- 상세: `resumeDurationMs`를 `nodeExec.startedAt`(DB에서 읽은 값)으로 계산한다. 이 값은 서버가 직접 기록한 `startedAt`(신뢰 가능한 내부 값)이며 사용자 입력으로 오염될 수 없다. `Math.max(0, ...)` 가드로 음수 방지도 적용되어 있다.
- 제안: 현재 구현으로 충분. 추가 조치 불필요.

### **[INFO]** 테스트 내 내부 메서드 직접 접근
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, diff 추가 테스트(§5.5)
- 상세: 테스트 파일이 `service as unknown as { processFormResumeTurn: ... }`로 private 메서드에 직접 접근한다. 이는 테스트 파일에서만 사용되는 패턴이며 프로덕션 공격 표면을 넓히지 않는다. 단, `structuredOutputCache`를 테스트에서 직접 조작하는 방식은 내부 구현이 변경될 경우 테스트가 조용히 잘못된 상태를 시뮬레이션할 위험이 있다.
- 제안: 보안 영향 없음. 테스트 유지보수 관점에서 향후 공개 API를 통해 초기 상태를 설정하는 방향을 검토할 수 있으나 필수 아님.

## 요약

이번 변경(§5.5 `meta.durationMs` 갱신)은 보안 관련 코드를 직접 수정하지 않는다. 추가된 로직은 DB에서 읽어온 신뢰 가능한 `nodeExec.startedAt`으로 경과시간을 재계산해 기존 meta를 덮어쓰는 순수 내부 연산이며, `Math.max(0, ...)` 가드로 음수 보호를 적용한다. 사용자 입력이 새로운 계산 경로에 진입하지 않고, 하드코딩된 시크릿·인젝션·인증 우회·암호화 문제는 발견되지 않는다. 잔존 보안 위험은 이번 변경과 무관한 서버측 폼 유효성 검증 미구현(별도 "파일검증 cluster" PR로 추적 중)이며, plan에 이미 인지·계획 반영되어 있다.

## 위험도

LOW

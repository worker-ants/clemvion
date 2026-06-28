## 발견사항

### [WARNING] `spec/2-navigation/4-integration.md` 의 `preview-test` body 필드명 `service` — 코드의 `serviceType` 과 불일치

- **target 신규 식별자**: `{ service, authType, credentials }` — PR 이 spec 설명을 `{ serviceType, authType, credentials }` 에서 이 형태로 변경
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/codebase/backend/src/modules/integrations/dto/integration.dto.ts` L161 — `serviceType: string` (필드명 `serviceType`)
  - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L122 — `serviceType: string`
  - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/codebase/backend/src/modules/integrations/entities/integration.entity.ts` L37 — `serviceType: string`
- **상세**: origin/main 의 spec 에는 `body: { serviceType, authType, credentials }` 와 함께 "※ `oauth/begin` 은 `service`, `preview-test` 는 `serviceType` — 두 DTO 가 독립적으로 발전한 결과이며 rename 은 별도 breaking-change PR 범위" 라는 해설 주석이 있었다. 이 PR 은 그 주석을 제거하면서 body 기술을 `{ service, authType, credentials }` 로 바꿨다. 그러나 실제 `PreviewTestDto.serviceType` 은 변경하지 않았으므로, spec 이 존재하지 않는 필드명 `service` 를 정규 필드로 선언하는 상황이다. 코드 소비자가 spec 을 보고 `service` 를 body 에 보내면 DTO 검증에서 `serviceType` 미제공 오류가 발생한다.
- **제안**: spec 에서 `{ service, authType, credentials }` 를 실제 코드 필드명인 `{ serviceType, authType, credentials }` 로 되돌리거나, 아니면 코드에서 `PreviewTestDto.serviceType` 을 `service` 로 rename(breaking-change)해 spec 과 일치시킨다. 전자(spec 표기 복원)가 이 PR 범위에서 즉시 처리 가능하다.

---

### [INFO] `UNIDENTIFIED_IP_BUCKET` 상수 — 기존 사용처와 충돌 없음, Redis 키 가시성 안내

- **target 신규 식별자**: `UNIDENTIFIED_IP_BUCKET = '__no_client_ip__'` — `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` L164
- **기존 사용처**: 동일 이름의 상수 또는 문자열 값 `__no_client_ip__` 가 origin/main 의 코드베이스 어디에도 존재하지 않음. 충돌 없음.
- **상세**: Redis 키 `wh:rl:min:__no_client_ip__` / `wh:rl:hour:__no_client_ip__` 가 모니터링·로그 분석 시 실제 IP 처럼 보일 수 있으나, JSDoc 에 sentinel 의미가 이미 명시되어 있고(`public-webhook-quota.service.ts` L154) 단위 테스트도 IP 표기 비충돌을 검증한다. 별도 조치 불필요.
- **제안**: 필요 시 Datadog/Prometheus 대시보드에서 `__no_client_ip__` 를 별도 레이블로 처리하는 권고를 운영 가이드에 기재하면 충분하다(spec 변경 불필요).

---

### [INFO] `R6` rationale 앵커 — `spec/7-channel-web-chat/4-security.md` 내 R1~R5 연번 뒤에 자연 추가, 충돌 없음

- **target 신규 식별자**: `### R6. 공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도`
- **기존 사용처**: 동일 파일에 R1~R5 가 순서대로 존재하며 R6 는 미사용. 다른 spec 파일(`spec/conventions/chat-channel-adapter.md`)의 `### R3` 는 해당 파일 내 로컬 앵커로 `4-security.md#R3` 와 독립적임. 충돌 없음.
- **제안**: 없음.

---

### [INFO] 결정 태그 `D-12` — 코드·plan·spec 에서 인라인 코멘트로만 사용, 정식 레지스트리 없음

- **target 신규 식별자**: 코드 주석·plan 파일에서 `D-12` 로 참조되는 결정 태그
- **기존 사용처**: origin/main 에서 동일 `D-12` 를 다른 의미로 쓰는 사용처 없음. `plan/in-progress/webhook-hardening-cleanup.md` 가 `D-12` 를 "IP 미식별 fail-open 우회" 로 식별해 이미 추적 중이며 이번 PR 이 그 구현에 해당함.
- **제안**: 없음.

---

## 요약

이번 PR 이 도입하는 신규 식별자 중 실질적 충돌은 `spec/2-navigation/4-integration.md` 의 `preview-test` body 필드명 변경(`serviceType` → `service`)에서 발생한다. 이 변경은 origin/main 에서 의도적으로 유지하던 "spec 과 코드의 필드명 불일치 해설 주석"을 삭제하면서 존재하지 않는 필드명 `service` 를 정규 spec 으로 선언하는 문제를 만든다. 실제 `PreviewTestDto.serviceType` 이 변경되지 않아 spec-code 불일치가 생겼으므로 수정이 필요하다. 나머지 신규 식별자(`UNIDENTIFIED_IP_BUCKET`/`R6`/`D-12`)는 기존 사용처와 충돌하지 않는다.

## 위험도

LOW

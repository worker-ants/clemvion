# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` — 구현 완료 후 검토 (diff base: origin/main)

---

### 발견사항

- **[WARNING]** `driveResumeDetached` → `driveResumeAwaited` 메서드명 변경 — spec 에 옛 이름이 잔존
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 전체, 동명 spec 파일 코드 주석 다수
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` "park 즉시 해제 + slow-path 일원화 (Phase B)" 항 — "detached" 모델이 기각됐고 PR-B2b 에서 awaited 구동으로 완전 전환됐음을 기술함. 단, spec 본문 §7.5 (line 903: `driveResumeDetached(top-level, awaited)`), §1.3 (line 128: `driveResumeDetached/driveResumeFrame`), §Rationale line 1306: `runExecution / driveResumeDetached` 에 **옛 메서드명이 그대로 남아 있음**.
  - 상세: 구현은 메서드명을 `driveResumeAwaited` 로 변경(올바른 방향 — detach 모델이 폐기됐음을 명확히 함)했으나, spec 본문·Rationale 에는 `driveResumeDetached` 참조가 잔존한다. 결정의 번복이 아니라 **spec 동기화 누락**이다. Rationale 자체는 "옛 detach 모델 폐기"를 이미 기록하고 있으나, 개별 참조 지점에 옛 이름이 남아 spec 독자가 혼동할 수 있다.
  - 제안: spec `§1.3` (line 128), `§4.x 구현 메모` (line 903), `## Rationale` "Phase B" 항 (line 1306, 1311)의 `driveResumeDetached` 참조를 `driveResumeAwaited` 로 갱신하거나, 이름 변경 경위를 Rationale 에 한 줄 추가한다.

- **[INFO]** `ProcessTurnResult` named type alias 도입 — spec 에 `void | ParkSignal` 인라인 타입 미갱신
  - target 위치: `execution-engine.service.ts` — `type ProcessTurnResult = void | ParkSignal` 신설 및 관련 처리기 시그니처 변경
  - 과거 결정 출처: 해당 타입을 다루는 Rationale 항은 없음. ai-review W11 응답으로 도입됐다는 주석이 코드 내에 명시됨.
  - 상세: 이 변경은 기각된 대안 재도입이 아니라 타입 정의 정합성 개선이다. Rationale 상 invariant 충돌 없음. spec 에 타입 언급이 없으므로 spec 갱신이 필요한 사안도 아니다.
  - 제안: 특별한 조치 불필요. 필요 시 `## Rationale` 에 "처리기 반환 타입을 `ProcessTurnResult` named alias 로 통일 (ai-review W11)" 한 줄 추가해 추적성 확보.

- **[INFO]** `LLM_STUB_MODE` 환경변수 도입 — spec `spec/5-system/7-llm-client.md §7.1` 과 정합
  - target 위치: `codebase/backend/.env.example` — `LLM_STUB_MODE=false` 추가
  - 과거 결정 출처: `spec/5-system/7-llm-client.md` §7.1 ("테스트 전용 Stub 모드 (`LLM_STUB_MODE`)") — OAUTH_STUB_MODE 선례를 따르는 동일 패턴이며, 프로덕션 fail-closed 부팅 가드가 명시됨.
  - 상세: 구현이 spec 에 정의된 설계를 그대로 따른다. Rationale 위반 없음.
  - 제안: 없음.

- **[INFO]** `InteractionTokenService` 생성자 prod fail-closed 추가 — spec §8.3 과 부분 정합, Rationale 업데이트 권고
  - target 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `NODE_ENV=production` + secret 전무 시 throw 추가
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md §8.3` — "셋 다 미설정인 dev 환경은 비보안 placeholder 로 떨어지므로 프로덕션은 반드시 설정해야 한다"고 명시하나, **fail-closed(부팅 throw)** 동작은 spec에 기술되지 않음. spec §8.3 은 경고(warn) 수준만을 암시하고 있었다.
  - 상세: 구현이 spec 보다 더 강한 보안 제약(warn → throw)을 추가한 경우다. 기각된 대안의 재도입이 아니며 합의된 원칙(보안 fail-closed)의 강화이다. 다만 spec §8.3 에 `fail-closed` 동작이 명시되지 않아 spec·구현 간 괴리가 생겼다. `## Rationale` 에 `OAUTH_STUB_MODE` / `LLM_STUB_MODE` 부팅 가드 패턴과 동일하게 fail-closed 결정 근거를 기록하면 연속성이 완성된다.
  - 제안: `spec/5-system/14-external-interaction-api.md §8.3` 또는 Rationale 에 "secret 전무 + production 시 부팅 throw (fail-closed, OAUTH_STUB_MODE 패턴 동일)" 한 항 추가.

---

### 요약

이번 변경에서 Rationale 연속성 관점의 실질적 위반은 없다. 가장 중요한 관찰은 `driveResumeDetached` → `driveResumeAwaited` 메서드명 변경이 구현에서는 완수됐으나 spec 본문·Rationale 의 참조 지점(§1.3, §4.x 구현 메모, §Rationale Phase B 항)에 옛 이름이 잔존한다는 것이다 — 결정 번복이 아닌 spec 동기화 누락이므로 WARNING 으로 분류한다. `ProcessTurnResult` 타입 alias 도입, `LLM_STUB_MODE` 환경변수 추가는 각각 spec 정의 또는 선례와 정합한다. `InteractionTokenService` prod fail-closed 강화는 spec 에 명시되지 않은 동작을 추가한 것이지만 합의된 보안 원칙의 연장이라 INFO 수준이며, Rationale 보완을 권고한다.

### 위험도

LOW

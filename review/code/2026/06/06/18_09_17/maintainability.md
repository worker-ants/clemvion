# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/backend/.env.example`

- **[INFO]** `LLM_STUB_MODE` 변수가 OAuth 섹션 내부에 배치됨
  - 위치: `LLM_STUB_MODE=false` 추가 위치 (OAUTH_STUB_MODE 직후)
  - 상세: `LLM_STUB_MODE` 는 LLM 클라이언트 동작을 제어하는 변수인데, "OAuth — shared between Integration OAuth and User Auth OAuth" 헤더 섹션 아래에 위치한다. OAuth 와 LLM 은 다른 관심사라 섹션 경계가 모호해진다.
  - 제안: `# LLM Client` 또는 `# Stub Modes` 같은 별도 소섹션 주석을 추가하거나, Execution Engine 섹션 근처로 이동하는 것이 개념적으로 더 가깝다. 단, 현재 배치도 "프로덕션에서 동일 패턴(STUB_MODE)" 을 묶는 의도가 주석에 명시되어 있어 실용적 이유가 있음.

- **[INFO]** `INTERACTION_JWT_SECRET` 의 위치는 적절(JWT 섹션 내)하고 주석이 충분히 설명적임. 변경 수용 가능.

---

### 파일 2: `execution-engine.service.spec.ts`

- **[INFO]** `driveResumeDetached` → `driveResumeAwaited` 리네임이 테스트 주석, spy 선언, spy 등록 총 8곳에 일관되게 반영됨
  - 위치: diff 의 모든 변경 라인
  - 상세: 메서드명이 구현의 실제 동작(awaited)을 반영하게 되어 가독성과 의도 명확성이 향상됨. 리네임 누락 없음.

- **[INFO]** 테스트 파일 전체 컨텍스트에서 `svcAny` 타입 캐스팅 패턴이 반복됨
  - 위치: L11717, L11731 및 다수 `(service as unknown as { ... })` 패턴
  - 상세: private 메서드 직접 접근을 위해 `as unknown as { methodName }` 타입 캐스팅이 수십 곳에 중복. 이미 기존 코드 스타일이고 이번 변경이 도입한 것이 아니므로 pre-existing 이슈.
  - 제안: 장기적으로 테스트 전용 헬퍼 타입이나 `@visibleForTesting` 패턴 도입 고려.

---

### 파일 3: `execution-engine.service.ts`

- **[INFO]** `ProcessTurnResult = void | ParkSignal` 타입 별칭 신설
  - 위치: L1646 (새 추가)
  - 상세: `waitForFormSubmission`, `waitForButtonInteraction`, `waitForAiConversation`, `processAiResumeTurn` 의 반환 타입을 `void | ParkSignal` 인라인에서 named alias 로 통일했다. 처리기 추가 시 계약을 한 곳에서 관리할 수 있어 유지보수성이 개선됨.

- **[INFO]** `driveResumeAwaited` JSDoc 업데이트가 실제 동작(awaited, single-segment, no detach)을 정확히 기술함
  - 위치: L1725–L1733 (JSDoc 전체 재작성)
  - 상세: 옛 "void로(detach) 호출" 문구 제거 후 "await 하는 전체 resume 구동", "park = 세그먼트 종료", "한 turn만 처리 후 반환" 등 현행 모델을 명확히 기술. 마지막 주석에 "(메서드명은 옛 detach 모델의 잔재)" 언급이 있어 이름과 동작 불일치에 대한 맥락 제공은 양호하나, 명칭 자체가 이제 `driveResumeAwaited` 로 변경됐으므로 해당 괄호 안 문구는 불필요해졌다.
  - 제안: L1733 의 `(메서드명은 옛 detach 모델의 잔재 — 현재는 awaited 구동.)` 주석은 이제 명칭이 `driveResumeAwaited` 로 변경됐으므로 해당 문구를 제거하거나 "이전 `driveResumeDetached` 에서 rename" 정도로 간소화하는 것이 혼란을 줄인다.

- **[INFO]** `parkSignal` 지역 변수 타입이 `void | ParkSignal` 에서 `ProcessTurnResult` 로 변경됨 (L3789)
  - 상세: named alias 도입과 일관성 있게 적용됨. 양호.

---

### 파일 4: `interaction-token.service.spec.ts`

- **[INFO]** `constructor — secret 미설정 시 prod fail-closed` describe 블록이 `iext_*` 와 `itk_*` 두 상위 describe 에 각각 중복 추가됨
  - 위치: L430–L452 (itk_ describe 내) 및 파일 내 대응 위치(iext_ describe 내 미포함 — diff 표시 없음)
  - 상세: 실제 diff 를 보면 동일한 `constructor — secret 미설정 시 prod fail-closed` 블록이 `itk_*` describe 끝에 추가됐고, 전체 파일 컨텍스트(L2394–L2432)를 보면 이 블록이 두 번 정의되어 있다. 두 블록의 본체(setup/teardown/assertion)가 완전히 동일하다. 이 블록은 `InteractionTokenService` 의 constructor 를 테스트하므로 어느 describe 에도 속하지 않는 독립 describe 로 승격하거나 한 곳에만 두는 것이 중복을 제거한다.
  - 제안: 두 상위 describe 밖으로 추출해 단일 `describe('InteractionTokenService — constructor guard')` 블록으로 통합.

- **[INFO]** `afterEach` 에서 `process.env` 복원 패턴이 올바르게 구현됨
  - 상세: `undefined` 인 경우 `delete process.env.KEY`, 값이 있는 경우 복원. 환경 오염 방지 패턴이 양호.

---

### 파일 5: `interaction-token.service.ts`

- **[INFO]** fail-closed 가드 주석이 충분히 설명적이고 OAUTH/LLM_STUB 패턴을 명시적으로 참조함
  - 위치: L2453–L2462
  - 상세: "실무상 JWT_SECRET 가 앱 인증에 필수라 도달 드물지만" 같은 맥락 주석이 미래 유지보수자가 이 코드를 제거 충동을 느낄 때 배경을 이해하게 해줌.

- **[INFO]** throw 메시지가 한국어로 작성되어 있고 에러 메시지 내에 `NODE_ENV=production` 이 포함됨 — 테스트에서 `/NODE_ENV=production/` 정규식으로 매칭하므로 메시지 변경 시 테스트 깨짐에 주의
  - 위치: L2458–L2461
  - 상세: 테스트가 throw 메시지의 특정 문자열(`NODE_ENV=production`)에 의존한다. 메시지 수정 시 테스트도 함께 수정해야 하는 묵시적 결합.
  - 제안: 에러 코드 기반의 커스텀 에러 클래스 사용 또는 테스트에서 메시지 대신 에러 코드를 검증하는 것이 장기적으로 유지보수성이 높다. 현재 규모에서는 허용 가능한 수준.

---

### 파일 6: `plan/in-progress/exec-park-polish.md`

- **[INFO]** plan 파일이 완료 메모("2026-06-06 구현 완료") 를 포함하고 있으나 `plan/in-progress/` 에 위치함
  - 상세: 구현이 완료된 것으로 기록되었으나 파일이 `in-progress` 에 있다. 리뷰 사이클이 끝난 후 `plan/complete/` 로 이동되어야 한다. 이는 plan lifecycle 규약 사항이므로 이번 변경의 문제라기보다 후속 액션 항목이다.

---

### 파일 7: `spec/4-nodes/3-ai/1-ai-agent.md`

- **[INFO]** 변경된 한 줄이 "multi-turn loop 재진입" → "단발 재진입(processAiResumeTurn, exec-park full B3 turn-park 모델 — 옛 장수 loop 폐기)" 로 정정됨
  - 상세: 기술적으로 정확한 수정이며 spec 과 구현 일치를 개선함. 다만 한 줄 안에 parenthetical 정보가 과밀해졌다. 단순 독자를 위한 짧은 설명 후 세부 사항을 별도 문장으로 분리하면 가독성이 향상되지만, 기존 문서 스타일과는 일관성이 있음.

---

### 파일 8–9: `spec/5-system/4-execution-engine.md`, `spec/conventions/execution-context.md`

- **[INFO]** frontmatter `code:` glob 에 `shared/execution-resume/**` 추가
  - 상세: spec-impl evidence 연결 목적으로 최소한의 변경. 내용 정확성 문제 없음.

---

## 요약

이번 변경의 핵심은 세 가지다: (A1) `driveResumeDetached` → `driveResumeAwaited` 리네임 — 메서드명이 실제 동작(awaited)을 반영하게 되어 가독성이 명확히 향상됐고 8곳의 주석/테스트 참조가 일관되게 갱신됐다. (B1/B2) `.env.example` 변수 등재와 `InteractionTokenService` fail-closed 가드 — 환경 설정 문서화와 보안 경계가 강화됐으며, 단위테스트가 동작을 충분히 커버한다. (C1) `ProcessTurnResult` named type alias 신설 — 인라인 `void | ParkSignal` 혼용을 통일해 처리기 추가 시 단일 변경 지점을 제공한다. 주요 유지보수성 이슈는 `constructor — secret 미설정 시 prod fail-closed` 테스트 블록이 두 상위 describe 에 동일하게 중복 추가된 점(파일 4)이며, 이는 테스트 추가 시 DRY 를 위반한다. 나머지 발견사항은 기존 코드베이스 스타일과 일치하는 INFO 수준이다. 전반적으로 이번 변경은 유지보수성을 개선하는 방향의 polish 작업으로 평가된다.

## 위험도

LOW

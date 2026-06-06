# 문서화(Documentation) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** 신규 `describe` 블록 두 개(`processFormResumeTurn — 4 branches`, `SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트`)에 블록 상단 주석 배너가 있고 각 `it()` 케이스도 한국어 인라인 설명이 포함되어 있어 의도 파악이 용이하다.
  - 위치: diff 내 lines 36–42, 455–461
  - 상세: 배너 주석이 spec 참조(§10.9, §7.5, exec-park D6 full B3)를 명시해 테스트 맥락을 충분히 서술한다.
  - 제안: 현 상태 유지. 추가 개선 불필요.

- **[INFO]** `FormResumeSubject` / `DriveW3Subject` / `W5Subject` / `W6Subject` / `W7Subject` private-access 헬퍼 타입들이 `describe` 또는 `it` 블록 내부에 인라인으로 정의되어 있다. 테스트 파일 외부에 공개 API가 없으므로 JSDoc 생략은 허용 범위이나, 타입 사용 패턴(as-unknown-as 우회)에 대한 짧은 설명 주석이 일부 누락되어 있다.
  - 위치: lines 236–252, 467–491
  - 상세: `FormResumeSubject` 정의 바로 위에 "// Helper: access private method via as-unknown-as pattern." 한 줄이 있어 의도를 설명한다. 나머지 W3/W5/W6/W7 Subject 타입은 동일 설명이 없다.
  - 제안: 각 Subject 타입 선언 위에 `// Private access via as-unknown-as — 실서비스 타입이 아님.` 또는 동등 한 줄 추가.

- **[INFO]** `W6` 테스트(`rehydrateAndResume outer catch 흡수 검증`)가 `rfcSpy.mockRestore()` 호출 후 추가 assertion 없이 종료된다. 주석(`// W6: ...`)에서 "호출자 미전파" 검증을 명시하지만 `rejects.toBeUndefined()` assertion의 맥락 설명이 짧다.
  - 위치: lines 729–791
  - 상세: `resolves.toBeUndefined()` 이후 추가 assertion 없이 `rfcSpy.mockRestore()`로 종결되어 검증 의도(예외가 외부에 전파되지 않음)가 코드 자체에서 충분히 드러난다.
  - 제안: 현 상태 허용. 선택적으로 `// 예외 미전파 확인 — resolves.toBeUndefined()` 주석을 assertion 앞에 추가하면 명료해진다.

---

### 파일 2: execution-engine.service.ts

- **[WARNING]** `rehydrateAndResume` 메서드 내 주석이 두 곳 갱신되었다 (lines 1874–1894). 변경 후 주석은 `resumeFromCheckpoint`가 이제 내부 드라이브 전체를 **await**한다는 새 동작을 정확히 기술하며, "fire-and-forget 모델 제거" 배경도 명시한다. 그러나 `driveResumeDetached`라는 메서드명이 주석에 여전히 등장하는데, 이 메서드가 실제로 detach 없이 await 되는 방식으로 변경되었다면 메서드명 자체가 오해를 유발할 수 있다.
  - 위치: diff hunk 1 (line 1875–1878 주석)
  - 상세: `driveResumeDetached`라는 이름은 "detached(비동기 분리)" 의미를 함의하나 현재 동작은 awaited다. 주석이 이를 설명하지만, 메서드명 불일치가 잠재적인 혼란 소지다.
  - 제안: (즉각 필수는 아님) `driveResumeDetached` JSDoc 에 `@deprecated name — 이제 caller 가 await 함. D6 full B3 이후 fire-and-forget 제거.` 한 줄 추가. 또는 plan에 이미 언급된 "(W2) `driveResumeDetached` JSDoc 정정" 작업을 추적하면 충분하다. plan의 "잔여 doc polish" 항목이 이를 커버하므로 블로커 아님.

- **[INFO]** `runExecutionFromQueue` catch 블록 내 신규 주석(`W7 (ai-review) — failFirstSegmentSetup 자체가 throw 시...`)이 변경 의도와 안전성 근거를 명확히 설명한다.
  - 위치: diff hunk 2 (lines 1900–1913)
  - 상세: ai-review 경유 근거(`W7 (ai-review)`)와 `best-effort 마감 실패는 worker 레벨 재시도보다 로그로 관측` 이유가 주석에 기술되어 적절하다.
  - 제안: 현 상태 유지.

- **[INFO]** 로그 메시지가 `"Rehydration launched (drive detached)"` → `"Rehydration completed (drive awaited)"`로 변경되었다. 운영 로그를 파싱하는 모니터링/알림 규칙이 있다면 이 문자열 변경이 기존 패턴을 깨뜨릴 수 있다.
  - 위치: line 1881
  - 상세: 프로젝트에 별도 로그 파싱 문서/runbook이 존재하는 경우 갱신 필요. 현재 코드베이스에 해당 문서 존재 여부는 이 리뷰 범위 외.
  - 제안: 운영 runbook 또는 알림 쿼리에 해당 로그 문자열이 하드코딩되어 있는지 확인 후 필요 시 업데이트.

---

### 파일 3: plan/in-progress/exec-park-durable-resume.md

- **[INFO]** plan 문서가 상세하게 갱신되어 PR-B2b 완료 상태(체크박스 flip, 커밋 해시, e2e 결과, spec flip 범위)를 정확히 반영한다. "차수 메모"도 현행 상태와 일치한다.
  - 위치: 전체 diff
  - 상세: `full B3 제거`, `dockerized e2e 완료`, `spec flip 완료` 항목이 상세 커밋 해시와 함께 기록되어 있어 추적성이 높다.
  - 제안: 현 상태 유지.

- **[INFO]** "잔여 doc polish(비차단, 최종 --impl-done `16_16_04` BLOCK:NO)" 항목이 별도 `[ ]`(미완료)로 남아 있어, 추후 처리 항목이 명시적으로 추적된다.
  - 위치: plan diff 마지막 `[ ]` 항목
  - 상세: (W2) `driveResumeDetached` JSDoc 정정, (INFO8/9) frontmatter `code:` 등록, (INFO5) `1-ai-agent §7` 잔존 `runAiConversationLoop` 언급 등이 포함되어 있어 누락 없이 기록되었다.
  - 제안: 현 상태 유지. 별도 doc PR 또는 umbrella 정리 시 일괄 처리 예정임이 명시되어 있어 충분하다.

- **[INFO]** plan 문서 내 "PR-B2a follow-up (남음, 분리)" 항목에 `LLM_STUB_MODE 문서화·EIA §8.3·doc-sync·e2e ENCRYPTION_KEY`가 언급되나 이 리뷰 대상 코드 변경에서는 직접 다루지 않는다. 별도 추적 항목으로 분리된 상태이므로 현 범위에서는 허용 가능하다.
  - 위치: plan 내 `PR-B2a follow-up` 항목
  - 상세: 본 PR 범위 밖으로 명시됨.
  - 제안: 별도 처리 확인으로 충분. 추가 조치 불필요.

---

## 요약

이번 변경은 세 파일 모두 문서화 품질이 전반적으로 양호하다. 테스트 파일은 블록 배너·인라인 한국어 설명·spec 참조가 충실하며, 서비스 파일의 두 주석 변경은 실제 동작 변화(fire-and-forget 제거 → await 직접)를 정확하게 반영한다. plan 문서는 PR-B2b 완료 상태를 커밋 해시·e2e 결과·spec flip 범위와 함께 상세히 기록하고 있어 추적성이 높다. 유일한 주의 사항은 `driveResumeDetached` 메서드명이 변경된 동작(awaited)과 의미적으로 불일치하는 점인데, 이는 plan의 "잔여 doc polish" 항목에 이미 추적되어 있어 현 시점에서 블로커는 아니다. Private-access 헬퍼 타입들의 설명 주석이 일부 비대칭인 점도 선택적 개선 수준이다.

## 위험도

LOW

## 발견사항

- **[INFO]** 신규 테스트의 mock 설정 블록 3중 중복
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1027-1039`
    (신규 `collection-retry loop passes attribution (llmContext) to the 2nd retry chat too`)
  - 상세: `mockLlmService.chat.mockResolvedValueOnce(finalizeCall(...)).mockResolvedValueOnce(finalizeCall(...))`
    블록이 바로 위 기존 테스트(`994`)와 거의 동일하게 반복되며, 파일 내 동일 패턴이 이미 `1105`
    에도 존재해 이번 추가로 3중이 됐다. 다만 이는 이 파일의 기존 관례(각 `it` 가 자기 완결적으로
    mock 을 재설정)를 그대로 따른 것이라 새로 도입된 스타일 이탈은 아니다.
  - 제안: 지금 당장 손댈 필요는 없음. 다음에 4번째 유사 케이스가 추가되는 시점엔
    `mockTwoTurnFinalizeCalls(first, second)` 같은 헬퍼로 추출을 고려.

- **[INFO]** `[B4]` 태그가 코드 주석에만 존재, 참조 대상(plan 문서) 링크 부재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2277`, `:2566`
  - 상세: 기존에도 `(M-7)`, `(03 C-2)`, `(ai-review INFO#1)` 처럼 plan/review slice ID 를 코드 주석에
    남기는 관례가 있어 스타일 일관성 자체는 문제 없음. 다만 `B4` 라는 축약 태그가 어떤 plan 문서를
    가리키는지는 diff 만 봐서는 알 수 없어(이번 세트는 `plan/in-progress/llm-usage-resume-followups.md`
    참조로 추정) 장기적으로 plan 파일이 `complete/` 로 이동·재넘버링되면 태그의 추적성이 옅어질 수
    있음 — 기존 관례상 감수 가능한 수준.
  - 제안: 특별한 조치 불필요. 향후 대규모 리팩터 시 plan slice 태그의 유효기간을 한 번 정리하는 정도.

## 요약

변경 범위가 좁고(4파일, +65/-13) 성격이 명확히 분리되어 있다 — B2 는 문서 정밀화, B3 는 순수
회귀 테스트 추가(대상 코드 무변경), B4 는 이미 존재하던 `narrowResumeState` 헬퍼를 3개 소비
사이트에 적용해 `state.X as string | undefined` raw 캐스트를 제거하는 behavior-preserving
리팩터다. 새 로컬 변수 `resumeState` 는 파일 전역에서 이미 쓰이던 이름·패턴을 그대로 재사용해
네이밍 일관성이 유지되고, 각 변경 지점에 "왜"(필드 오탈자 컴파일 타임 차단, 첫 턴 사이트와의
대칭)를 설명하는 주석이 충실히 달려 있어 가독성도 양호하다. 함수 길이·중첩 깊이·매직 넘버 등은
이번 diff 로 인해 새로 늘거나 나빠지지 않았고(기존 장문 함수 `processMultiTurnMessage` 는 그대로,
diff 는 그 내부 라인 단위 캐스트만 교체), 새로 추가된 테스트는 파일의 기존 헬퍼(`retryState`,
`finalizeCall`)와 assertion 스타일을 그대로 재사용해 컨벤션 이탈이 없다. 발견된 사항은 모두
정보성(INFO)으로, 조치를 요구하는 수준의 유지보수성 리스크는 없다.

## 위험도
NONE

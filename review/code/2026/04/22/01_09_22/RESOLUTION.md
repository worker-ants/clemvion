# 리뷰 이슈 조치 내역 — 2026-04-22 (harmony filter + auto-scroll 후속)

대상 리뷰: `review/2026-04-22_01-09-22/SUMMARY.md`
조치자: developer role

## 조치 요약

| # | 카테고리 | 발견 | 조치 | 위치 |
|---|----------|------|------|------|
| W3 | Testing/Requirement | 스트리밍 청크 경계에서 `<|chan` 같은 partial 토큰이 regex 에 걸리지 않아 한 순간 노출 | `TRAILING_PARTIAL_TOKEN_RE = /<\|[^\|>]*$/` 로 말미 미완성 토큰 제거. `does not strip incomplete harmony tokens mid-stream` 네거티브 케이스 대신 "drops trailing partial harmony tokens mid-stream" 포지티브 테스트 추가 | `harmony-filter.ts`, `harmony-filter.test.ts` |
| W4 | Architecture/Performance | `sanitizeAssistantText` 가 MarkdownRenderer 와 AssistantMessageView 양쪽에서 호출 — 스트리밍 중 regex 2배 | sanitize 단일 owner 를 `AssistantMessageView` 로 확정. MarkdownRenderer 는 순수 렌더러로 남기고 JSDoc Design choices 에 "Harmony sanitize is NOT done here" 명시. AssistantMessageView 의 `displayText` 는 `useMemo([message.content])` 로 캐시 | `markdown-renderer.tsx`, `assistant-message.tsx` |
| W5 | Side Effect | `out.replace(m[0], "")` 가 동일 블록이 여러 번 등장할 때 첫 번째만 제거 | `replaceAll(m[0], "")` 로 교체. `removes repeated non-final channel blocks globally` 테스트 추가 | `harmony-filter.ts` |
| W7 | Testing | `Final`/`FINAL` 대소문자 변형 미테스트 | `treats channel name case-insensitively` 테스트 추가. 구현은 이미 `.toLowerCase()` 비교 중이라 버그 없이 고정됨 | `harmony-filter.test.ts` |
| I1 | Performance | `lastSignature` 의 `plan.steps.filter` 가 매 렌더 실행 | `useMemo([last])` + `reduce` 로 단일 패스 계산 | `assistant-panel.tsx` |
| I2 | Performance | `displayText` memoization 부재 | `useMemo([message.content])` 적용 | `assistant-message.tsx` |
| I3 | Documentation | `CHANNEL_BLOCK_RE` 캡처 그룹 주석 없음 | `// m[1] = channel name, m[2] = message body` 주석 추가 | `harmony-filter.ts` |
| I4 | Documentation | `markdown-renderer.tsx` JSDoc Design choices 에 harmony sanitize 관련 항목 없음 | Design choices 목록에 "Harmony sanitize is NOT done here. The single owner is AssistantMessageView." 항목 추가 | `markdown-renderer.tsx` |
| I5 | Documentation/Testing | `harmony-filter.test.ts` 의 "공백 정규화" 주석이 실제 동작과 불일치 | 주석을 "inner whitespace is preserved, not collapsed" 로 수정, expected 값도 정렬 (`"hello  world"`) | `harmony-filter.test.ts` |
| I6 | Maintainability | 모듈 레벨 `/g` 정규식의 `lastIndex` 오염 위험 | 주석 추가: "`/g` 플래그는 `matchAll`·`replaceAll` 전용. `.exec()` 루프로 전환 시 `lastIndex` 오염 주의" | `harmony-filter.ts` |

## 스코프 밖 (별도 과제로 분리)

| # | 이유 |
|---|------|
| W1 (Prompt Injection — 사용자 입력 필드 escape / role: tool 채널 분리) | 아키텍처 전환 수준의 설계 과제. 본 PR 의 UI 필터링 범위와 분리 |
| W2 (`redactConfig` 단위 테스트) | **이미 이전 라운드**(`review/2026-04-22_00-00-12/RESOLUTION`)에서 `backend/src/modules/workflow-assistant/tools/redact.spec.ts` 신규 작성·통과. 본 리뷰는 해당 파일을 검토 대상에 포함하지 않아 재지적된 것 — 실제로는 이미 해결 |
| W6 (auto-scroll 변경 분리) | 본 스레드에서 사용자가 harmony leak + auto-scroll 문제를 한 요청으로 묶어 보고. 같은 assistant-panel UX 결함이라 동반 수정이 자연스러움. PR 분리 대신 RESOLUTION 에 의도된 동반 수정임을 명시 |
| I7 (시스템 프롬프트 harmony bullet 축약·통합) | 기존 두 bullet 과 의도 겹치지만, 신규 모델에서 재발 시 원인 추적이 쉽도록 별도 bullet 로 남기는 편이 유지보수에 유리 |
| I8 (백엔드 sanitize 레이어) | 중장기 과제. 현재는 단일 클라이언트만 존재 |
| I9 (partial 토큰 테스트) | W3 조치에 포함되어 해결 |
| I10 (컴포넌트 수준 bubble 숨김 RTL 테스트) | 추후 테스트 라운드. 본 PR 은 unit 수준에서 sanitize 동작 고정 |
| I11 (`buildLastSignature` 순수 함수 추출) | `useMemo` 내부 로직으로 충분. 추출 이득 대비 API 표면 증가 |
| I12 (CHANNEL_BLOCK_RE constrain 공백 없는 케이스) | 현재 테스트 케이스(`<|channel|>commentary <|constrain|>json<|message|>{…}`)가 공백 있는 실제 leak 형태를 커버. 공백 없는 형태가 관찰되면 별도 추가 |
| I13 (`<|end|>` 뒤 trailing 텍스트 처리) | 현재 구현은 channel 블록 밖의 trailing prose 를 자연스럽게 유지 (final 채널이 있으면 final body 만, 아니면 non-final block 들만 제거). 별도 테스트 케이스 추가는 추후 |

## 검증

- `frontend` vitest 전체: 1001 테스트 통과 (이전 998 → +3 신규)
- `frontend` eslint / tsc --noEmit 통과
- `backend` eslint / jest 1508 통과 / nest build 통과

## E2E 검증 (사용자 확인 필요)

1. 신규 세션에서 LLM 이 harmony 포맷으로 tool call 을 leak 하는 시나리오 재현 → bubble 에 `<|channel|>…` 문자열이 보이지 않고 plan 카드만 렌더되는지 확인
2. 긴 plan 실행 중 — text delta · tool_call 배지 · plan step 체크 진행 세 가지 모두에서 리스트가 자동으로 하단 스크롤되는지 확인
3. 스트리밍 중 우연히 `<|chan` 같은 꼬리 토큰이 잠깐 나타났다가 다음 delta 에서 정상 토큰으로 교체되는 시나리오: 사용자에게 꼬리가 노출되지 않는지 시각 확인

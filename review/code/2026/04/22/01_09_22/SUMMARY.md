파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-04-22_01-09-22/SUMMARY.md`에 저장하겠습니다. 먼저 통합 보고서 내용을 보여드립니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 기능(harmony 토큰 필터링)은 정상 동작하나, 프롬프트 인젝션 취약점과 스트리밍 중 부분 토큰 노출 가능성이 실사용 환경에서 보안·UX 결함으로 이어질 수 있음

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `JSON.stringify(current)`를 시스템 프롬프트에 직접 삽입 — Prompt Injection 공격면 | `system-prompt.ts` | 사용자 입력 필드(노드 라벨·설명)를 서버 측에서 주입 패턴 사전 검증·이스케이프하거나, 워크플로우 스냅샷을 `role: tool` 채널로 분리하는 아키텍처 전환 검토 |
| 2 | Security | `redactConfig()` 구현 미검증 — API Key·Bearer Token 등 시크릿이 LLM 프로바이더 로그에 기록될 수 있음 | `system-prompt.ts` 주석 참조 | 민감 키(`token`, `apiKey`, `secret` 등)를 `[REDACTED]`로 치환하는지 단위 테스트로 명시적 검증 |
| 3 | Testing / Requirement | 스트리밍 중 partial 토큰 노출 — 청크 경계에서 `<|channel` 처럼 잘린 토큰이 어떤 regex에도 매칭되지 않아 사용자에게 그대로 렌더됨 | `harmony-filter.ts` 전반 | `/<\|[^>]*$/` 패턴으로 말미 불완전 토큰 제거 로직 추가; 테스트 케이스 및 스펙에 "in-flight delta는 brief flicker 허용" 단서 추가 |
| 4 | Architecture / Performance / Maintainability | `sanitizeAssistantText` 이중 호출 — 스트리밍 중 regex 연산 2배 발생, sanitize 책임 소유권 불명확 | `assistant-message.tsx:44`, `markdown-renderer.tsx:25` | `MarkdownRenderer` 내부 호출 제거하고 `AssistantMessageView`에서만 단일 담당; `displayText`를 `useMemo`로 메모이제이션 |
| 5 | Side Effect / Requirement | `out.replace(m[0], "")` — 동일 채널 블록이 두 번 이상 등장 시 첫 번째만 제거 | `harmony-filter.ts:44` | `out.replaceAll(m[0], "")` 또는 escape한 정규식으로 `replace(new RegExp(escaped, "g"), "")` 사용 |
| 6 | Scope | 자동 스크롤 로직 교체(`lastMessageLength` → `lastSignature`)가 harmony filter와 무관한 별도 버그 수정이나 같은 커밋에 혼합됨 | `assistant-panel.tsx` diff | 별도 커밋으로 분리하거나 PR 설명에 "의도된 동반 수정"으로 명시 |
| 7 | Testing | 채널 이름 대소문자 변형 테스트 누락 — `Final`, `FINAL` 케이스 미검증 | `harmony-filter.test.ts` | `it("treats Final/FINAL channel same as final", ...)` 케이스 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `lastSignature`의 `plan.steps.filter()` 연산이 `useMemo` 없이 매 렌더마다 실행 | `assistant-panel.tsx:67-78` | `useMemo`로 감싸거나 `reduce`로 단일 패스 계산 |
| 2 | Performance | `displayText` memoization 부재 — 부모 리렌더 시 `message.content` 미변경에도 regex 재실행 | `assistant-message.tsx:39` | `useMemo(() => sanitizeAssistantText(message.content), [message.content])` |
| 3 | Documentation | `CHANNEL_BLOCK_RE` 캡처 그룹 인덱스(`m[1]`, `m[2]`) 대응 주석 없음 — 정규식 수정 시 silent bug 가능 | `harmony-filter.ts:26` 소비 코드 | 정규식 아래 `// m[1] = channel name, m[2] = message body` 주석 추가 |
| 4 | Documentation | `markdown-renderer.tsx` JSDoc Design choices에 harmony sanitize 항목 미추가 | `markdown-renderer.tsx` 상단 | Design choices 목록에 sanitize 적용 이유 항목 추가 |
| 5 | Documentation / Testing | `harmony-filter.test.ts` "공백 정규화" 주석이 실제 동작(공백 미정규화)과 불일치 | `harmony-filter.test.ts:37-38` | 주석을 "잔여 토큰만 제거, 내부 공백은 정규화하지 않음"으로 수정 |
| 6 | Maintainability | 모듈 레벨 `/g` 플래그 정규식 — `matchAll`/`replace`에서는 안전하나 향후 `exec()` 루프 전환 시 `lastIndex` 오염 위험 | `harmony-filter.ts:18-20` | `// always used with matchAll — lastIndex-safe` 주석 추가 |
| 7 | Maintainability | 시스템 프롬프트 내 유사 지침 중복 — harmony 토큰 bullet이 기존 두 bullet과 의도 겹침 | `system-prompt.ts:51-53` | 기존 bullet에 "특히 harmony 제어 토큰도 해당" 부연으로 통합·축약 |
| 8 | Architecture | 필터링 레이어가 프론트엔드에만 존재 — 추후 다른 클라이언트 추가 시 동일 방어 로직 중복 구현 필요 | `harmony-filter.ts` | 중장기적으로 백엔드 SSE 이벤트 발행 직전 sanitize 단계 추가 검토 |
| 9 | Testing | 스트리밍 partial 토큰 테스트 케이스 부재 — 미래 기여자가 이 한계를 알 수 없음 | `harmony-filter.test.ts` | `it("does not strip incomplete harmony tokens mid-stream", ...)` 추가 |
| 10 | Testing | `AssistantMessageView` 컴포넌트 수준 렌더링 테스트 부재 — bubble 숨김 조건이 통합 테스트로 미검증 | `assistant-message.tsx:43-45` | RTL로 harmony 토큰만 있는 메시지에서 bubble 미노출 확인 |
| 11 | Testing | `lastSignature` 로직이 인라인에 있어 단독 단위 테스트 불가 | `assistant-panel.tsx:67-76` | `buildLastSignature(msg)` 순수 함수로 추출 후 단위 테스트 |
| 12 | Requirement | `CHANNEL_BLOCK_RE`가 채널명과 `<|constrain|>` 사이 공백 없는 경우 캡처 범위 모호 | `harmony-filter.ts:26` | inner 토큰을 건너뛰는 패턴 `(?:<\|[^|>]*\|>|\s)*?`으로 보강 검토 |
| 13 | Testing | `<|end|>` 이후 trailing 텍스트 처리 미테스트 — 현재 구현은 버리지만 의도 불명확 | `harmony-filter.ts` | 스펙 확인 후 케이스 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | 시스템 프롬프트 Prompt Injection 취약점, `redactConfig()` 미검증 시크릿 노출 위험 |
| Testing | MEDIUM | 스트리밍 partial 토큰 미테스트, 컴포넌트 수준 렌더 조건 테스트 부재 |
| Requirement | LOW | 스트리밍 partial 토큰 스펙 간극, `replace(m[0], "")` edge case |
| Architecture | LOW | `sanitizeAssistantText` SRP 위반, 필터 레이어 클라이언트 단독 존재 |
| Performance | LOW | 이중 sanitize, `lastSignature` `useMemo` 미적용 |
| Side Effect | LOW | 이중 sanitize 성능 낭비, `replace` first-match-only |
| Maintainability | LOW | 이중 sanitize 소유권 불명확, `/g` 플래그 위험, 프롬프트 지침 중복 |
| Scope | LOW | 자동 스크롤 버그 수정 혼합 |
| Dependency | LOW | 이중 sanitize, `/g` 플래그 주의 사항 |
| Documentation | LOW | 캡처 그룹 주석 부재, JSDoc 미갱신, 테스트 주석 오기재 |

## 발견 없는 에이전트
- **Database** — DB 관련 코드 없음
- **API Contract** — API 엔드포인트·스키마 변경 없음
- **Concurrency** — 공유 가변 상태·경쟁 조건 없음 (모듈 수준 `/g` 정규식은 현재 사용 패턴에서 안전 확인)

---

## 권장 조치사항

1. **[MEDIUM · Security] 프롬프트 인젝션 방어** — `system-prompt.ts`에서 사용자 입력 필드 서버 측 sanitize 또는 워크플로우 스냅샷을 `role: tool` 채널로 분리
2. **[MEDIUM · Security] `redactConfig()` 단위 테스트** — 민감 키가 `[REDACTED]`로 치환되는지 명시적 검증
3. **[WARNING] 스트리밍 partial 토큰 처리** — `harmony-filter.ts`에 `/<\|[^>]*$/` 패턴으로 말미 불완전 토큰 제거 및 테스트 케이스 작성
4. **[WARNING] `replace(m[0], "")` → `replaceAll`** — `harmony-filter.ts:44` 동일 블록 반복 시 모두 제거
5. **[WARNING] `sanitizeAssistantText` 이중 호출 제거** — `MarkdownRenderer` 내부 호출 제거, `displayText`를 `useMemo`로 메모이제이션
6. **[WARNING] 채널 이름 대소문자 테스트** — `Final`, `FINAL` 케이스 커버
7. **[INFO] `lastSignature` `useMemo` 적용** — `plan.steps.filter()` 연산 메모이제이션
8. **[INFO] `CHANNEL_BLOCK_RE` 그룹 인덱스 주석** — `// m[1] = channel name, m[2] = message body`
9. **[INFO] 자동 스크롤 변경 명시** — PR 설명에 "의도된 동반 수정"으로 명시
10. **[INFO] 컴포넌트 수준 테스트 추가** — bubble 미노출 조건을 RTL로 검증
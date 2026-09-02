# Cross-Spec 일관성 검토 — `spec/conventions/error-codes.md`

## 검토 범위 확인

- scope 델타: `spec/conventions/error-codes.md` 1개 파일, 11줄 추가/1줄 삭제 (`git diff origin/main...HEAD -- spec/conventions/`로 실측 확인).
- 함께 번들된 `secret-store.md` / `spec-impl-evidence.md` / `swagger.md` 는 이번 diff 에 포함되지 않은 **참고용 관련 spec**이다(동일 명령으로 무변경 확인) — target 이 아니므로 아래 분석 대상에서 제외.
- 구현 diff 4개 파일(HEAD 워킹트리에서 직접 확인): `codebase/backend/src/nodes/core/error-codes.ts`(주석 추가, `ErrorCode` 가 엔진도 발행함을 명시), `codebase/frontend/src/lib/docs/__tests__/{spec-links.test.ts,stray-tool-tags.test.ts,tree-walk.ts}`(문서 링크·아티팩트 태그 스캐너 하니스 테스트 — spec/conventions 와 직접 연관 없음).

## 발견사항

없음 — CRITICAL/WARNING 등급 충돌을 찾지 못했다.

### 검증한 항목 (근거)

1. **"대표 surface 는 둘이다" 주장의 코드 정합성**: `error-codes.ts` HEAD 워킹트리를 직접 읽어 `ErrorCode`·`EngineErrorCode` 가 실제로 같은 파일의 자매 `const`이며, 키 비중복은 `error-codes.spec.ts:59` (`Object.keys(EngineErrorCode).filter((k) => k in ErrorCode)`)가 테스트로 고정함을 확인. target 문서의 "테스트로 고정" 서술과 일치한다.
2. **"§1 카탈로그 분류와 1:1 대응하지 않는다" 주장**: `spec/5-system/3-error-handling.md` §1 "엔진 수준 에러" 표(라인 108~114)가 실제로 `ErrorCode` 소속(`EXECUTION_TIME_LIMIT_EXCEEDED`)과 `EngineErrorCode` 소속(`WORKER_HEARTBEAT_TIMEOUT`)을 같은 "엔진 수준" 묶음에 섞어 나열하고 있어, target 이 경고하는 비1:1 대응을 실제로 재현하고 있다 — 모순이 아니라 target 이 그 기존 사실을 정확히 명문화한 것.
3. **다른 spec 문서에 "대표 surface" 단수 주장이 남아있는지**: `grep -rn "대표 surface" spec/` 결과 `error-codes.md` 자신 외에는 없음 — 충돌하는 잔존 서술 없음.
4. **`error-codes.ts` 를 참조하는 타 spec 문서들과의 정합**: `2-navigation/4-integration.md`, `4-nodes/0-overview.md`, `4-nodes/3-ai/1-ai-agent.md`, `5-system/{7-llm-client,11-mcp-client,14-external-interaction-api,6-websocket-protocol}.md` 를 grep 하여 전수 확인 — 모두 `ErrorCode`(노드 taxonomy)를 가리키는 서술뿐이고, "이 파일에는 `ErrorCode` 하나만 있다"는 식의 배타적 전제를 깐 문장은 없다. `EngineErrorCode` 존재를 부정하거나 그와 모순되는 서술도 없음.
5. **코드 쪽 주석 앵커**: `error-codes.ts` 새 주석이 가리키는 `spec/conventions/error-codes.md` §Overview 는 실제로 그 자리(§1 명명 원칙 앞, "적용 범위" 문단 직후)에 "대표 surface 는 둘이다" 문단이 존재 — 앵커가 착지한다.

### 참고 (충돌 아님, INFO 수준 관찰)

- **[INFO]** `tree-walk.ts` 의 신규 3번째 소비자
  - target 위치: 구현 diff `stray-tool-tags.test.ts` (신규 파일, `walkTree` import)
  - 관련 spec: `spec/conventions/spec-impl-evidence.md` `code:` frontmatter, `spec/conventions/user-guide-evidence.md` `code:` frontmatter — 둘 다 `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts` 를 자신의 evidence-linked 코드로 명시하며 "두 컨벤션이 같은 헬퍼를 공유"한다고 이미 서술 중.
  - 상세: 이번 PR 로 `walkTree` 소비자가 (spec-impl-evidence, user-guide-evidence) 둘에서 셋(신규 `stray-tool-tags` 가드)으로 늘었다. `stray-tool-tags` 가드는 제품 spec 이 아니라 `.claude/` 하니스 자체 위생 검사라 spec/conventions 문서화 대상은 아니지만, "공유 헬퍼" 서술이 이제 소비자 목록을 완전히 나열하지 않는다는 점만 참고로 남긴다 — 액션 불요, 정보용.
  - 제안: 없음 (충돌 아님).

## 요약

target(`spec/conventions/error-codes.md`)의 변경은 `ErrorCode`/`EngineErrorCode` 두 자매 const 가 이미 코드에 존재하던 사실을 명문화하는 문서 정정이며, 대응하는 코드 주석 1줄 추가와 함께 왔다. 이 주장은 (a) 코드 실측(자매 const·키 비중복 테스트), (b) `3-error-handling.md` §1 카탈로그의 실제 혼재 양상, (c) `error-codes.ts` 를 참조하는 다른 6개 spec 문서 전수 grep 으로 모두 뒷받침되며, 어디에도 이를 부정하거나 배타적 단일-surface 를 전제한 잔존 서술이 없다. 나머지 3개 구현 diff(`spec-links.test.ts`/`stray-tool-tags.test.ts`/`tree-walk.ts`)는 `.claude/` 문서 하니스 내부 가드로 spec/conventions 의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임과 무관하다. Cross-Spec 관점에서 채택을 막을 모순은 없다.

## 위험도

NONE

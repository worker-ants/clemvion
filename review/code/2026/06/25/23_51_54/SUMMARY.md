# Code Review 통합 보고서

대상: refactor 03 m-1 — 서비스 console.* → NestJS Logger + no-console 가드 (커밋 `980b6375`)

## 전체 위험도
**LOW** — 7개 reviewer 모두 Critical 없음. Testing 이 로깅 계약 커버리지 갭 2건을 WARNING. 나머지 6개 NONE.

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `telegram-message.renderer.ts` `visualNode='photo'` → `logger.warn` 경로 테스트 누락 | telegram renderer photo 분기 | photo 케이스 + `jest.spyOn(Logger.prototype,'warn')` 검증 |
| 2 | Testing | `mcp-test-connection.service.spec.ts` `logInternal()` → `Logger.warn` 호출 미검증 | mcp-test spec (MCP_CONNECT_FAILED/MCP_LIST_FAILED) | Logger.prototype.warn spy + 인수 `[mcp:test]` 포함 assertion |

## 참고 (INFO) — 처분

| # | 카테고리 | 발견 | 처분 |
|---|----------|------|------|
| 1 | SPEC-DRIFT | ai-agent §6.2.c.fallback·presentation 0-common spec 의 console.warn 처방 stale | **planner 위임**(plan §m-1, 코드 무관). |
| 2·3 | Architecture | 순수함수/Injectable 의 모듈/직접 Logger 생성 — DI 미주입 | 현 단계 수용(리뷰어 명시). 장기 LoggerService 주입 후속. |
| 4 | Architecture | scripts/** glob 면제가 신규 파일 자동 확장 | 수용(scripts=CLI 전용 컨벤션). |
| 5 | Maintainability | eslint.config.mjs prettier 따옴표 스타일 변경(자동 포매터) | 범위 외 noise, 수용. |
| 6 | Maintainability | code.handler inline disable 3회 반복 | 수용(개별 사유 명확). |
| 7 | Maintainability | mcp-test `[mcp:test]` prefix 이중화 | 수용(operation 태그, context와 별개). |
| 8·9 | Testing | node-handler assertion·language-hint 접근 패턴 견고성 | INFO 선택 — W1/W2 fix 시 함께 검토. |
| 10 | Requirement | plan §m-1 audit-logs:85 stale | plan-update 단계 제거. |
| 11 | Security | 테스트 no-console off 로 CI 로그 민감정보 가능성 | 팀 규약 유지(비차단). |
| 12 | Side Effect | main.ts bootstrap 로그 형식 NestJS Logger 로 변경 | 의도된 변경(§6.2 정합). |

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. 로그 집중화로 노출 표면 감소. |
| architecture | NONE | DI 외부 Logger 생성 실용 범위 정당. no-console 긍정. |
| requirement | NONE | plan §m-1 완전 구현. SPEC-DRIFT 2건 planner 위임 명시. |
| scope | NONE | 범위 일탈 없음(포맷 1건 허용). |
| side_effect | NONE | 부트스트랩 로그 형식 변경=의도. |
| maintainability | NONE | 명확한 향상. 발견 모두 INFO. |
| testing | LOW | WARNING 2건(photo 분기·logInternal 검증 부재). |

## 처분 (RESOLUTION 상세는 RESOLUTION.md)

- **반영(이 PR)**: W1·W2(신규 logger.warn 경로 단위 테스트 추가).
- **보류**: INFO-1 SPEC-DRIFT(planner), INFO-10(plan-update 단계 정리), 그 외 INFO(수용/후속).

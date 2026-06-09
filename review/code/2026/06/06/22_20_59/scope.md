# 변경 범위(Scope) 리뷰

## 작업 의도

`kb-unsearchable-warning` (PR #508): `embedding_dimension == null` KB의 검색 불가 상태를 **신호로 노출**하는 것. 구체적으로:
- (A) 백엔드: `RagSearchService.searchWithMeta` unsearchable 신호 + `KbToolProvider` not_searchable 봉투 + `AiAgentHandler` skipReason `kb_unsearchable`
- (B) 프론트엔드: `/knowledge-bases` 목록 카드에 경고 배지 + i18n
- plan 파일 신설(현재 작업 + follow-up), 관련 review 산출물

## 발견사항

### [INFO] plan/complete 파일 2개에 `spec_impact` 필드 추가 (파일 12, 13)
- 위치: `plan/complete/spec-update-pr2a-active-running-invariants.md`, `plan/complete/spec-update-pr2a-timeout.md`
- 상세: 이 두 파일은 이전 PR(PR2a `impl-exec-concurrency-cap`)의 완료 plan 파일이다. 현재 작업(`kb-unsearchable-warning`)과 직접 관련 없는 파일에 `spec_impact:` frontmatter 필드가 추가됐다. plan 체크리스트(파일 15 line 1373)에 "pre-existing main red 부수 수정(pr2a Gate C spec_impact, 커밋 4d013d9e)"으로 명시되어 있어 Gate C 빌드 가드 통과를 위한 부수 수정임이 설명되어 있다.
- 제안: 범위 이탈이지만 빌드 게이트 통과를 위한 불가피한 수정으로 plan에 명시 기록됨. 수용 가능하나, 이 변경이 PR2a 완료 plan의 내용(텍스트)은 건드리지 않고 frontmatter만 추가한다는 점에서 부작용 최소. 추가 설명 주석 없이도 plan 체크리스트 항목으로 추적 가능.

### [INFO] review/consistency 산출물 파일 다수 포함 (파일 16~18 등)
- 위치: `review/consistency/2026/06/06/21_40_26/` 하위 파일들
- 상세: consistency-check 실행 산출물(`SUMMARY.md`, `_retry_state.json`, `convention_compliance.md` 등)이 커밋에 포함되어 있다. 이는 CLAUDE.md의 정책(개발자 구현 전 `consistency-check --impl-prep` 의무, 산출물은 `review/consistency/**` 에 저장)에 따른 정상 절차다.
- 제안: 의도된 포함. 이슈 없음.

### [INFO] `RagAccumulator`에 `diagnosticCount` / `unsearchableCount` 두 카운터 추가 (파일 4)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, `RagAccumulator` 클래스
- 상세: `skipReason='kb_unsearchable'` 판별 로직을 위해 "모든 호출 KB가 unsearchable인 경우에만" 조건을 추적한다. plan §4.2 설계 명세와 일치하며 over-engineering이 아니다. 단, 이 로직이 `KbSearchDiagnostic.unsearchable?: boolean` 필드(파일 5)에 의존하고, 해당 필드가 `agent-tool-provider.interface.ts`에 추가된 것은 작업 범위 내 필수 인터페이스 확장이다.

### [INFO] `KbToolProvider`의 `unsearchable` 변수 타입을 `Awaited<ReturnType<...>>['unsearchable']` 로 추론 (파일 7)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`
- 상세: `SearchWithMetaResult` 의 `unsearchable` 타입을 `ReturnType` 유틸로 간접 참조하는 대신 타입 별칭(`KbUnsearchableReason[]`...)을 직접 임포트하는 방식도 가능하지만, 현재 방식도 타입 안전성을 보장하며 범위 이탈은 아니다.

## 범위 이탈 없는 변경 요약

파일 1~11은 모두 작업 의도(A 백엔드 신호 + B 프론트 경고 배지)에 직접 대응한다:
- 파일 1~2: `rag-search.service` — `reembedStatus` 필드 추가, unsearchable 사전 차단 로직, 테스트
- 파일 3~7: `ai-agent.handler`, `KbToolProvider`, 인터페이스 — `not_searchable` 봉투, `kb_unsearchable` skipReason, 테스트
- 파일 8~11: 프론트엔드 페이지·테스트, i18n dict en/ko
- 파일 12~13: pre-existing Gate C 빌드 가드 수정(plan에 명시)
- 파일 14~15: 신규 plan 파일(follow-up + 현재 작업) — 정책 의무
- 파일 16~18: consistency-check 산출물 — 정책 의무

불필요한 리팩토링, 무관한 기능 추가, 포맷팅 변경, 미사용 임포트 추가/삭제는 발견되지 않았다. `page.tsx` lucide import 블록 재포맷은 `AlertTriangle` 추가를 위한 불가피한 구조 변경으로 실질 변경과 분리 불가능하다.

## 요약

전체 변경은 `kb-unsearchable-warning` 작업 의도(백엔드 unsearchable 신호 + 프론트 경고 배지)에 엄격히 대응한다. 유일한 범위 이탈 후보는 PR2a 완료 plan 파일 2개의 `spec_impact` frontmatter 추가(파일 12~13)인데, 이는 사전 plan 체크리스트에 "pre-existing main red 부수 수정"으로 명시된 Gate C 게이트 통과용 수정이며 내용 변경 없이 frontmatter 필드만 추가하는 최소 수정이다. 의도 이상의 리팩토링, 기능 확장, 무관한 코드 영역 수정, 불필요한 포맷팅 변경은 없다.

## 위험도

NONE

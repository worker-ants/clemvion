# Code Review 통합 보고서 — kb-unsearchable-warning (PR #508)

> ⚠️ ai-review Workflow 의 `code-review-summary` sub-agent 가 **주간 사용 한도**(resets
> Jun 11 07:00 KST)에 걸려 실패했다. 12개 reviewer 산출물은 정상 생성됐으므로, 본
> SUMMARY 는 main Claude 가 각 reviewer `.md` 를 직접 읽어 합성했다.

**전체 위험도: LOW** — Critical 0. 모든 reviewer 최고 위험도 NONE~LOW. 발견된 WARNING 은
전부 naming/JSDoc/주석/중복 등 **유지보수성·문서화 nit** 이며 기능 정확성·보안·성능·동시성
영향 없음.

## Critical 위배

**해당 없음.**

## Warning (조치 대상)

| # | Reviewer | 발견 | 위치 | 조치 |
|---|----------|------|------|------|
| W1 | architecture / maintainability | `diagnosticCount` 이름이 "KB 호출 수"를 직관적으로 전달 못함 (이중 카운터 응집도) | `ai-agent.handler.ts` RagAccumulator | ✅ `kbCallCount`/`unsearchableKbCallCount` 로 rename + 클래스 JSDoc 에 판정 규칙 명시 |
| W2 | maintainability | `withUnsearchable` 헬퍼 이름이 predicate 로 오독될 수 있음 | `rag-search.service.ts` | ✅ `mergeUnsearchable` 로 rename |
| W3 | architecture / maintainability | `unsearchableHit && results.length === 0` 가드의 필요성이 코드만으론 불명확 | `kb-tool-provider.ts` | ✅ INVARIANT 주석(단일 KB 호출 → searchableKbs 필터로 results 빌 수밖에 없음 + 멀티-KB 확장 시 재검토) 추가 |
| W4 | maintainability | 프론트 `page.tsx` 에서 `reembedStatus==='in_progress'` 3회 중복 평가 | `page.tsx` | ✅ `isReembedding` 단일 참조점으로 통합 |
| W5 | documentation | `KbUnsearchableReason`/`SearchWithMetaResult` JSDoc 블록 연속 배치로 IDE 연결 모호 | `rag-search.service.ts` | ✅ 각 JSDoc 을 대응 타입 직전으로 재배치 |
| W6 | documentation | `RagAccumulator` 클래스 JSDoc 에 카운터 판정 규칙 미기재 | `ai-agent.handler.ts` | ✅ 클래스 JSDoc 에 `kb_unsearchable` 판정 규칙 1줄 추가 (W1 과 함께) |

## INFO / 권고 (advisory — 본 PR 미조치, 후속 또는 의도적)

| Reviewer | 항목 | 처리 |
|----------|------|------|
| documentation | `note` 영문 하드코딩이 i18n 대상 아님을 주석에 명시 권고 | ✅ `// note 는 LLM 행동 지시문 — i18n 대상 아님` 주석 추가 |
| documentation | plan owner `project-planner→developer` 비표준 | ✅ `owner: developer` 로 정리 |
| documentation | plan `spec_impact` 에 8-embedding-pipeline 누락 | ✅ 이미 추가됨(reviewer 가 본 diff 가 stale) |
| architecture | 프론트 배지 `UnsearchableKbBadge` 컴포넌트 추출 | ⏭️ 후속(kb-model-change-reembed-followup 의 상세 배너 재사용 시 자연스러운 추출점) |
| architecture | `KbToolProvider.execute` 서브책임 누적 / 멀티-KB 확장 | ⏭️ 후속(rag-rerank-followup 멀티-KB 리랭크 시 레이어 재검토) — W3 INVARIANT 주석으로 전제 고정 |
| testing | rerank 경로의 `mergeUnsearchable` 호출 검증 테스트 부재 | ⏭️ INFO — 핵심 경로(vector·early-return)는 커버, rerank+unsearchable 동시는 드문 조합 |
| api_contract | `kb_unsearchable` skipReason 외부 노출 여부 / DTO 필드 확인 | ℹ️ 내부 진단 메타(ragDiagnostics)로 외부 REST 직접 변경 없음. `reembedStatus`·`embeddingDimension` 은 기존 KnowledgeBaseDto 에 이미 존재(확인 완료) |
| user_guide_sync | trigger 무매칭(정확). KB 통합 가이드 "임베딩 모델 변경" 절 보강 권고 | ⏭️ 후속(kb-model-change-reembed-followup) — 강제 아님 |
| maintainability | 테스트 픽스처 리터럴 타입 / `kbCard` 네이밍 등 | ℹ️ INFO, 현 규모 수용 |

## Reviewer별 위험도

| Reviewer | 위험도 | 핵심 |
|----------|--------|------|
| security | NONE | i18n 키 XSS 없음, secret 노출 없음 |
| performance | NONE | 리스트 수십 개 규모, 영향 없음 |
| architecture | LOW | 레이어 책임 분리 명확, WARNING 2(카운터·서브책임) |
| requirement | NONE | spec 동작 일치, `diagnosticCount>0` 중복조건 무해 지적 |
| scope | NONE | pr2a Gate C 부수 수정은 plan 에 명시된 의도된 포함 |
| side_effect | NONE | additive optional 필드, 역호환 |
| maintainability | LOW | WARNING 3(naming·중복) |
| testing | NONE | 커버리지 양호, INFO 1 |
| documentation | LOW | WARNING 2(JSDoc 배치·클래스 문서) |
| concurrency | NONE | 단일 이벤트 루프, 경쟁 없음 |
| api_contract | LOW | optional 확장, 하위호환 |
| user_guide_sync | NONE | trigger 무매칭(정확), KO/EN parity 충족 |

## 결론

Critical 0 · 기능/보안/성능/동시성 위험 없음. WARNING 6건(전부 nit)은 본 턴에서 수동 조치
완료(RESOLUTION.md). 깊은 리팩터(컴포넌트 추출·멀티-KB 레이어 재설계)는 reviewer 권고대로
후속(kb-model-change-reembed-followup / rag-rerank-followup)으로 분리.

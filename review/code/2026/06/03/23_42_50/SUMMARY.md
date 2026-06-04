# Code Review 통합 보고서

## 전체 위험도
**HIGH** — KB 파이프라인 핵심 기능(segment 파싱·metadata 전파·멀티-세그먼트 임베딩) 삭제와 동시에 관련 테스트가 전부 제거되어 회귀 감지 경로가 소멸됨. spec 문서 링크 앵커 수정은 대부분 올바르나 2건의 오류가 잔존함.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `baseMetadata` 전파 기능 삭제와 동시에 테스트도 삭제 — 회귀 감지 불가. 기능 삭제가 spec `§6.1` 명세 철회인지 미완성 리팩토링인지 테스트 코드만으로 판단 불가 | `text-chunker.spec.ts` (삭제된 `describe('chunkText baseMetadata propagation')` 블록), `text-chunker.ts` | 의도적 명세 철회라면 `spec/5-system/8-embedding-pipeline.md §6.1` metadata 약속 존치 여부 확인 후 명시적 기록; 재도입 예상이면 `TODO` 주석과 함께 보존 또는 feature-flag 분리 |
| 2 | Testing | `parseMdSegments`, `parsePdfSegments`, `parseDocumentSegments` 삭제 + 테스트 파일 2개 전체 삭제 — PDF/MD 파서 동작 검증 테스트 **0개** 상태 | `md.parser.spec.ts`(삭제), `pdf.parser.spec.ts`(삭제), `parser.factory.ts` | `parseMd`/`parsePdf` 정상 동작(non-empty output, 빈 파일 처리) 최소 단위 테스트 신규 작성; 기능 축소 의도라면 예외 경로 회귀 테스트 최소 1개 이상 필수 |
| 3 | Testing | `embedding.service.spec.ts` — multi-segment 경로 테스트 삭제, 단일 flat-text 경로만 남음. `parseDocument` 실제 동작(fileType dispatch, 예외 경로) 미커버 | `embedding.service.spec.ts` (삭제된 `chunks each segment` 테스트) | `fileType === 'csv'` vs 나머지 분기 통합 테스트, `parseDocument` unsupported fileType 시 `failed` status 처리 검증 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `§3.4.2` 링크 표시 텍스트 미갱신 — 앵커는 §4.2 를 올바르게 가리키나 표시 텍스트가 구버전 `§3.4.2` 로 남아 독자 혼란 초래 | `spec/5-system/15-chat-channel.md` 86행 (CCH-SE-01 행) | `[§3.4.2](#42-trigger-테이블-신규-컬럼)` → `[§4.2](#42-trigger-테이블-신규-컬럼)` 로 표시 텍스트 수정 |
| 2 | Requirement | R-CC-16 앵커에서 `render_` 언더스코어 누락 — `render_*` heading 의 `_` 가 제거되어 실제 앵커와 불일치, 브라우저에서 해당 섹션으로 이동 불가 | `spec/5-system/14-external-interaction-api.md` R10 단락 내 링크 | 앵커를 `#r-cc-16-...-ai-render_-presentations-발화` (언더스코어 복원) 로 수정 |
| 3 | Testing | `$itemIsFirst`/`$itemIsLast` 표현식 변수 삭제 — 양단 테스트도 삭제. 해당 변수를 참조하는 expression 의 undefined 폴백 vs 오류 동작이 미검증 | `expression-resolver.service.ts`, `expression-resolver.service.spec.ts` | Filter 노드 등 `$item` 계열 통합 테스트에서 `$itemIsFirst`/`$itemIsLast` 참조 시 undefined 해소를 명시하는 테스트 추가 |
| 4 | Testing | `summaryTemplate` 4개 노드에서 삭제, 관련 `renderSummaryTemplate` 단위 테스트도 삭제 — `undefined` summaryTemplate 처리 경로 미검증 | `code.schema.ts`, `database-query.schema.ts`, `send-email.schema.ts`, `template.schema.ts` + 각 `.spec.ts` | `renderSummaryTemplate(undefined, {})` 동작 검증 테스트를 `@workflow/node-summary` 패키지 수준에서 추가; 캔버스 요약 제거 의도라면 컴포넌트 테스트에서 요약 영역 미렌더링 assert |
| 5 | Testing | `NodeSettingsPanel` 에러 핸들링 탭 테스트 파일 전체 삭제, 레거시 마이그레이션 로직도 삭제 — 단순화된 `errorPolicy` state 저장/로드 경로 테스트 0개 | `node-settings-panel-error-handling.test.tsx`(전체 삭제), `node-settings-panel.tsx` | 단순화된 `errorPolicy` 저장 동작 및 기본값 적용 검증 최소 테스트 복원 |
| 6 | Testing | 새 테스트 4개(`spec-link-integrity`, `spec-area-index`, `plan-frontmatter`, `spec-plan-completion`) — 실제 파일시스템 직접 의존, `repoRoot()` 반환 오류 시 silent pass 위험 | `codebase/frontend/src/lib/docs/__tests__/` 하위 4개 파일 | `repoRoot()` 가 `spec/` 폴더를 포함하는지 assertion 추가; `files.length` 하한을 > 100 등 보수적으로 상향 |
| 7 | Maintainability | 앵커 링크가 수십 개 문서에 걸쳐 수동 관리 — 헤딩 변경 시 링크 깨짐이 반복 발생하는 구조적 취약점 (이번 24-파일 패치가 재발할 수 있음) | 파일 3~24 전체 `#fragment` 링크들 | CI 에 `markdown-link-check` 또는 `remark-validate-links` 추가해 앵커 자동 감지; 단기에는 `spec-link-integrity.test.ts` CI 강제 실행 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `spec/conventions/node-cancellation.md` 의 `../../spec/` prefix 경로 — 이번 PR 미도입이지만 렌더링 환경에 따라 깨질 수 있음 | `spec/conventions/node-cancellation.md` §5.1 | 별도 링크 정합 작업에서 검출 대상으로 유지 |
| 2 | Scope | 파일 19(`spec/5-system/_product-overview.md`) 관련 문서 블록 재구성 — 3개 링크를 16개 spec 맵으로 확장, item 6 명세와 일치 | `spec/5-system/_product-overview.md` | 범위 내, 추가 조치 불필요 |
| 3 | Scope | 파일 28(`spec/conventions/spec-impl-evidence.md`) Gate C/D 추가 — 가드 수 5건, `spec-plan-completion.test.ts` 행 추가 | `spec/conventions/spec-impl-evidence.md` §4 | 범위 내, 이상 없음 |
| 4 | Maintainability | 일부 앵커 슬러그가 매우 길고 특수문자 포함해 오타 유발 위험 | 예: `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`, `#83-allowlist-mcpserversenabledtools` | 섹션 헤딩에 짧고 안정적인 `<a id>` slug 명시 또는 spec 작성 가이드에 컨벤션 추가 검토 |
| 5 | Maintainability | plan 파일 이름 변경 시 spec 역참조 갱신 체크리스트 부재 | `plan-lifecycle.md` | plan 파일 rename 시 spec 역참조 함께 갱신하는 체크리스트를 plan-lifecycle 문서에 명시 |
| 6 | Testing | `spec-plan-completion.test.ts` — `spec_impact` 파일 존재 여부만 검증, `none` 남용 모니터링 없음 | `spec-plan-completion.test.ts` | `none` 사용 plan 목록을 test output 에 출력하는 optional assertion 추가 |
| 7 | Documentation | Presentation 노드 종수 6종→5종 변경 배경 설명 없음 | `spec/4-nodes/6-presentation/0-common.md` | 변경 이유(노드 추가/제거/재분류)를 관련 plan 또는 Rationale 섹션에 기록 |
| 8 | Documentation | Integration 노드 종수 `3종` 잔존 위치 추가 확인 권고 | 전체 spec 검색 | `3종` 잔존 위치 grep 후 일괄 수정 |
| 9 | API Contract | API 계약 변경 없음 — 24개 변경 파일 모두 spec 내부 앵커 링크 수정에 한정 | — | 해당 없음 |
| 10 | User Guide Sync | 동반 갱신 누락 없음 — anchor 수정은 frontmatter parity 갱신 의무를 발생시키지 않음 | — | 해당 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | KB 파이프라인 기능 삭제 + 테스트 동반 삭제 3건(CRITICAL), 표현식/summaryTemplate/에러핸들링 테스트 삭제 3건(WARNING), 신규 FS 의존 테스트 격리 취약점 1건(WARNING) |
| requirement | LOW | 앵커 수정 2건 오류 잔존(WARNING): §3.4.2 표시 텍스트 미갱신, R-CC-16 언더스코어 누락 |
| maintainability | LOW | 앵커 수동 관리 구조적 취약점(WARNING), 슬러그 복잡성·plan rename 체크리스트 부재(INFO) |
| documentation | LOW | Presentation 종수 변경 배경 미기재(INFO), 전반적 링크 정합 개선은 긍정적 |
| scope | NONE | 29개 파일 변경 모두 plan item 1·6·7 직접 구현, 무관 파일 수정 없음 |
| api_contract | NONE | API 계약 영향 없음 |
| user_guide_sync | NONE | 동반 갱신 누락 없음 |

---

## 발견 없는 에이전트

- **api_contract**: API 엔드포인트·스키마·인증 계약 변경 없음, 검토 대상 해당 없음
- **user_guide_sync**: 매트릭스 trigger 매칭 후 전수 검토 결과 동반 갱신 의무 발생 0건

---

## 권장 조치사항

1. **(CRITICAL — 즉시)** `parseMdSegments`/`parsePdfSegments`/`parseDocumentSegments` 삭제에 대해 최소 단위 테스트 복원: `parseMd`/`parsePdf` 정상 동작 및 예외 경로 커버.
2. **(CRITICAL — 즉시)** `baseMetadata` 전파 삭제가 `spec/5-system/8-embedding-pipeline.md §6.1` 명세 철회를 의도한 것인지 팀 결정 후, 의도라면 spec 갱신 또는 명시적 기록; 아니라면 기능 복원.
3. **(CRITICAL — 즉시)** `embedding.service.spec.ts` — `fileType` 분기 및 `parseDocument` 예외 경로 통합 테스트 추가.
4. **(WARNING — 이번 PR 내 수정)** `spec/5-system/15-chat-channel.md` CCH-SE-01 행 표시 텍스트 `§3.4.2` → `§4.2` 수정.
5. **(WARNING — 이번 PR 내 수정)** `spec/5-system/14-external-interaction-api.md` R-CC-16 앵커 언더스코어 복원.
6. **(WARNING — 단기)** 단순화된 `errorPolicy` 저장·기본값 적용 최소 테스트 복원 (`NodeSettingsPanel`).
7. **(WARNING — 단기)** `renderSummaryTemplate(undefined, {})` 동작 검증 테스트를 `@workflow/node-summary` 패키지에 추가.
8. **(WARNING — 단기)** `$itemIsFirst`/`$itemIsLast` 참조 expression 의 undefined 폴백 동작 검증 테스트 추가.
9. **(WARNING — 단기)** `repoRoot()` 기반 4개 FS 의존 테스트에 assertion 강화 (`spec/` 폴더 포함 확인, `files.length` 하한 상향).
10. **(WARNING — 중기)** CI 에 `spec-link-integrity.test.ts` 강제 실행 확인 및 `markdown-link-check` 도입 검토로 앵커 수동 관리 구조적 취약점 해소.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (7명): `requirement`, `scope`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **강제 포함(router_safety)** (2명): `documentation`, `requirement`
- **제외** (7명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| security | 변경 범위가 spec 문서 링크 수정에 한정, 보안 취약점 도입 가능성 낮음 |
| performance | 코드 변경 없음, 성능 영향 없음 |
| architecture | 아키텍처 변경 없음 |
| side_effect | 부수효과 유발 코드 변경 없음 |
| dependency | 의존성 추가/변경 없음 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
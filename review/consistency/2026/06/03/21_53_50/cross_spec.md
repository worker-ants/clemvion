# Cross-Spec 일관성 검토 결과

검토 대상: `spec/` 전체 (--impl-done, diff-base=origin/main)
변경 파일: 8개
- `spec/3-workflow-editor/1-node-common.md`
- `spec/4-nodes/1-logic/9-foreach.md`
- `spec/4-nodes/4-integration/0-common.md`
- `spec/4-nodes/5-data/0-common.md`
- `spec/4-nodes/6-presentation/0-common.md`
- `spec/4-nodes/6-presentation/5-template.md`
- `spec/5-system/5-expression-language.md`
- `spec/5-system/8-embedding-pipeline.md`

---

## 발견사항

### [WARNING] Template 캔버스 요약 포맷: 0-common vs 5-template.md 불일치
- **target 위치**: `spec/4-nodes/6-presentation/0-common.md` §5 캔버스 요약 (변경 후)
- **충돌 대상**: `spec/4-nodes/6-presentation/5-template.md` §9 캔버스 요약 (lines 297-300)
- **상세**: `0-common.md` 는 Template 행을 단일 행 `{{outputFormat}} · {{buttons.length}} buttons` (`summaryTemplate`) 로 갱신했다. 반면 `5-template.md` §9 캔버스 요약은 여전히 구분된 두 행 — 버튼 없음 `{outputFormat} · {N} lines` / 버튼 있음 `{outputFormat} · {N} buttons` — 을 기술한다. 버튼 없음 시 줄 수(`N lines`)를 표시하는지, `0 buttons`를 표시하는지가 모순이다.
- **제안**: `spec/4-nodes/6-presentation/5-template.md` §9 캔버스 요약을 `0-common.md` 의 단일-행 `summaryTemplate` 기술에 맞춰 업데이트한다. 버튼 없음 시 `buttons.length` = 0이므로 `html · 0 buttons` 가 표시되는 것이 현행 코드 동작인지 확인 후 반영.

### [WARNING] Send Email 캔버스 요약 포맷: 0-common vs 3-send-email.md 불일치
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 (변경 후 line 99)
- **충돌 대상**: `spec/4-nodes/4-integration/3-send-email.md` §7 캔버스 요약 (line 328)
- **상세**: `0-common.md` 는 Send Email 요약을 `{{to.length}} recipients · {{subject}}` 로 갱신했다. `3-send-email.md` §7은 여전히 구 포맷인 `to: {수신자}. 수신자 2명 초과 시 +N 표시` 를 기술한다. 두 spec이 서로 다른 요약 포맷을 가리키고 있다.
- **제안**: `spec/4-nodes/4-integration/3-send-email.md` §7 캔버스 요약을 `{{to.length}} recipients · {{subject}}` 로 동기화한다.

### [WARNING] Database Query 캔버스 요약 포맷: 0-common vs 2-database-query.md 불일치
- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 (변경 후 line 98)
- **충돌 대상**: `spec/4-nodes/4-integration/2-database-query.md` §7 캔버스 요약 (line 353-355)
- **상세**: `0-common.md` 는 Database Query 요약을 `{{queryType|upper}} · {{query}}` (구현됨) 로 갱신했다. `2-database-query.md` §7은 여전히 `{queryType} · {쿼리 첫 줄}` (대소문자 필터 없음, `{쿼리 첫 줄}` 표현) 로 기술하며 구현 완료를 반영하지 않는다.
- **제안**: `spec/4-nodes/4-integration/2-database-query.md` §7을 `{{queryType|upper}} · {{query}}` (구현됨)으로 동기화한다.

### [INFO] 실행 엔진 context 변수 테이블에 $itemIsFirst/$itemIsLast 미등재
- **target 위치**: `spec/4-nodes/1-logic/9-foreach.md` §3 (변경 후) + `spec/5-system/5-expression-language.md` §변수 테이블 (변경 후)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §context 변수 테이블 (line 543-545)
- **상세**: foreach spec 과 expression-language spec 은 `$itemIsFirst` / `$itemIsLast` 를 ForEach 컨텍스트 표현식 변수로 등재했다. 그러나 execution-engine spec 의 context 변수 테이블(§Expression Context — line 544)은 여전히 `$item`, `$itemIndex` 두 개만 기재하고 `$itemIsFirst`/`$itemIsLast` 를 누락한다.
- **제안**: `spec/5-system/4-execution-engine.md` line 544의 `$item`, `$itemIndex` 행에 `$itemIsFirst`, `$itemIsLast` 를 추가한다.

### [INFO] data-flow/6-knowledge-base.md 시퀀스 다이어그램: metadata INSERT 생략
- **target 위치**: `spec/5-system/8-embedding-pipeline.md` §6.1 (변경 후) — md/pdf 파서가 `metadata.section`/`metadata.page` 를 채운다고 기술
- **충돌 대상**: `spec/data-flow/6-knowledge-base.md` 시퀀스 다이어그램 lines 70-75 — `INSERT document_chunk (document_id, knowledge_base_id, chunk_index, content, embedding, token_count)` 에서 `metadata` 생략
- **상세**: 임베딩 파이프라인 spec 이 파서 경로(md→section, pdf→page)를 명시했으므로, data-flow 다이어그램의 INSERT 컬럼 나열이 부분적으로 오래된 것이 된다. (schema table line 167은 metadata를 포함하고 있어 부분 불일치다.)
- **제안**: `spec/data-flow/6-knowledge-base.md` 시퀀스 다이어그램 line 74의 INSERT 컬럼 목록에 `metadata` 를 추가한다.

### [INFO] config.errorHandling nested 형태가 spec/5-system/3-error-handling.md 에 미반영
- **target 위치**: `spec/3-workflow-editor/1-node-common.md` line 169 (변경 후) — `config.errorHandling = { policy, retryConfig?, defaultOutput? }` nested 형태 정의
- **충돌 대상**: `spec/5-system/3-error-handling.md` §3.3 Retry 설정 — `maxRetries`, `retryInterval`, `backoffMultiplier` 필드 목록은 있으나 이것이 `config.errorHandling.retryConfig.*` 경로임을 명시하지 않는다
- **상세**: `3-error-handling.md` §3.3은 필드를 flat 테이블로 나열한다. `1-node-common.md` 가 nested config 형태(`config.errorHandling.retryConfig.{maxRetries, retryInterval, backoffMultiplier}`)를 신규 SoT로 확정했으므로, error-handling spec이 같은 config 경로를 참조하지 않아 독자가 경로를 알 수 없다.
- **제안**: `spec/5-system/3-error-handling.md` §3.3에 "이 필드들은 `config.errorHandling.retryConfig.*` 경로에 저장된다. SoT: `spec/3-workflow-editor/1-node-common.md §2.4`" 를 추가한다.

---

## 요약

이번 변경 8개 파일은 impl-done 상태 승격과 기구현 사항 반영이 중심이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 영역에서는 직접 모순이 없다. 다만 캔버스 요약 포맷 정의가 공통(`0-common.md`) 에서 갱신된 반면 노드별 상세 spec(`3-send-email.md`, `2-database-query.md`, `5-template.md`) 의 §캔버스 요약 절이 미동기화되어 세 건의 WARNING 이 발생한다. 실행 엔진 context 변수 테이블과 data-flow 다이어그램은 INFO 수준의 누락 동기화 항목이다.

---

## 위험도

MEDIUM

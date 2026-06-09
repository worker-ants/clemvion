# 보안(Security) 코드 리뷰

**대상**: KB 검색 불가(재임베딩 필요/진행 중) 신호화 + 목록 경고 (PR kb-unsearchable-warning)
**날짜**: 2026-06-06

---

## 발견사항

### 1. **[INFO]** LLM에게 전달되는 `note` 필드에 내부 상태 정보 포함
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` — `not_searchable` 봉투 내 `note` 문자열
- **상세**: `note` 필드가 "This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding (or that it is in progress); do not claim the KB is empty or fabricate an answer." 라는 고정 문자열을 LLM tool_result 에 전달한다. 이 문자열은 서버 내부 처리 로직(재임베딩 상태)을 LLM 지시로 노출한다. 내용 자체는 민감 정보가 아니지만, 프롬프트 인젝션 공격자가 KB 이름·쿼리 입력값을 통해 이 note 가 LLM 컨텍스트에 포함된다는 사실을 역이용할 수 있다. 현재 `kbName`과 `args.query`는 사용자 입력에서 비롯되는데, 이 두 값이 `JSON.stringify` 를 통해 content 내부에 삽입된다.
- **제안**: `JSON.stringify` 직렬화 방식은 키-값 이스케이핑을 보장하므로 인젝션 경로가 존재하지 않는다. 현 구현은 안전하다. 단, `note` 문자열이 LLM 응답에 그대로 사용자에게 반사될 가능성을 UI 레이어에서 필터링하는지 확인 권장.

### 2. **[INFO]** `reembedStatus` 필드값이 DB에서 신뢰 없이 직접 LLM reason으로 매핑
- **위치**: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `KbRow.reembedStatus` 처리 로직 (라인 199-206)
- **상세**: DB에서 조회한 `reembedStatus` 값(`'idle' | 'in_progress'`)이 유효성 검증 없이 `KbUnsearchableReason` 으로 매핑되어 LLM tool_result `reason` 필드로 노출된다. TypeScript 타입 정의로 `'idle' | 'in_progress'` 로 제한하고 있으나, DB에서 예상치 못한 값이 반환될 경우(예: DB 스키마 마이그레이션 간 타입 불일치) `reason` 이 `'reembedding_required'`(fallback)로 처리된다. 이는 기능적으로 안전한 fallback이나, 명시적 enum 검증이 없다.
- **제안**: 런타임 방어를 위해 `reembedStatus` 값을 허용 목록으로 검증하거나, TypeORM/Prisma 레이어에서 enum 제약을 보장하는지 확인. 현재 구현은 보안 위험은 낮으나 방어적 코딩 측면에서 검증 추가 권장.

### 3. **[INFO]** 프론트엔드 i18n 키 값에 HTML 특수문자 없음 — XSS 위험 없음
- **위치**: `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`, `ko/knowledgeBases.ts`
- **상세**: `reembeddingRequired`, `reembeddingInProgress` 신규 i18n 키 값에 HTML 특수문자(`<`, `>`, `&`)가 없다. `page.tsx` 에서 `{t("knowledgeBases.reembeddingRequired")}` 형태로 React 렌더링하므로 XSS 위험 없음. 확인 완료.
- **제안**: 해당 없음.

### 4. **[INFO]** `embeddingDimension == null` 비교 — 타입 강제 비교 미사용
- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` — 조건 `kb.embeddingDimension == null`
- **상세**: `==` (느슨한 비교)를 사용해 `null`과 `undefined` 모두 처리한다. API 응답에서 `embeddingDimension` 이 `undefined` 로 올 수 있는 경우를 포함하므로 의도적 선택으로 보인다. XSS나 인젝션 위험 없음. 단, API DTO가 `null`만 반환한다면 `=== null`로 명시하는 것이 더 명확하다.
- **제안**: 기능 동작에 영향 없음. API 계약이 명확히 `null`임을 보장한다면 `=== null` 사용 권장 (방어적 코딩 차원).

### 5. **[INFO]** `_retry_state.json`에 절대 파일시스템 경로 노출
- **위치**: `review/consistency/2026/06/06/21_40_26/_retry_state.json`
- **상세**: JSON 파일에 `/Volumes/project/private/clemvion/...` 형태의 절대 경로가 하드코딩되어 있다. 이는 개발자 로컬 환경의 디렉토리 구조를 노출한다. 이 파일이 공개 저장소에 커밋될 경우 공격자에게 파일시스템 레이아웃 정보를 제공할 수 있다.
- **제안**: `review/` 산출물 디렉토리 전체를 `.gitignore` 에 추가하거나, `_retry_state.json` 같은 내부 상태 파일을 공개 저장소에서 제외하는 정책 수립 권장. 단, 이 저장소가 비공개(private)라면 위험도는 낮다.

---

## 요약

이번 변경은 KB 검색 불가 상태를 "silent 빈 결과"에서 명시적 신호(`not_searchable` 봉투, `unsearchable` 배지)로 전환하는 기능적 개선이다. 보안 관점에서 중대한 취약점은 발견되지 않았다. 주요 데이터 흐름인 DB 조회 → TypeScript 타입 매핑 → JSON 직렬화 → LLM tool_result 전달 경로는 `JSON.stringify`의 자동 이스케이핑으로 인젝션 위험이 없다. 프론트엔드 렌더링도 React의 기본 XSS 방어 메커니즘을 통해 안전하게 처리된다. `_retry_state.json`의 절대 경로 노출은 저장소 가시성에 따라 정보 노출 위험이 있으나 현재 구현 코드 자체의 취약점은 아니다. 하드코딩된 시크릿, 인증/인가 우회, SQL 인젝션, 커맨드 인젝션, 안전하지 않은 암호화 알고리즘은 해당 없음.

---

## 위험도

NONE
